import { createWriteStream as fsCreateWriteStream } from "fs";
import {
  mkdir as fsMkdir,
  rm as fsRm,
  writeFile as fsWriteFile,
} from "fs/promises";
import { join as pathJoin } from "path/posix";
import fetch from "node-fetch";
import { Open as unzipperOpen } from "unzipper";
import { FoundrySystemManifest } from "./types";
import _ from "lodash";

const baseUrl =
  "https://gitlab.com/hooking/foundry-vtt---pathfinder-2e/-/jobs/artifacts/master/raw";

async function downloadManifest(): Promise<FoundrySystemManifest> {
  const resp = await fetch(`${baseUrl}/system.json?job=build`);
  const data = await resp.text();
  return JSON.parse(data);
}

async function downloadFile(url: string, path: string) {
  const resp = await fetch(url);
  const fileStream = fsCreateWriteStream(path);
  await new Promise((ful, rej) => {
    resp.body!.pipe(fileStream);
    resp.body!.on("error", rej);
    resp.body!.on("finish", ful);
  });
}

function parseJsonStream<T>(stream: Buffer) {
  return stream
    .toString("utf-8")
    .split("\n")
    .filter((x) => x)
    .map((p) => JSON.parse(p) as T);
}

type Entry = EntryHazard | EntryNPC | EntryItem | EntryJournalEntry;

type EntryActor = EntryHazard | EntryNPC;

interface BaseEntry {
  _id: string;
  name: string;
}

interface EntryHazard extends BaseEntry {
  type: "hazard";
  data: {
    details: {
      description: string;
      disable: string;
      reset: string;
      routine: string;
    };
  };
}

interface EntryNPC extends BaseEntry {
  type: "npc";
  items: EntryItem[];
  data: {
    details: {
      publicNotes: string;
    };
  };
}

type EntryItem = EntryItemGeneric | EntryItemSpell;

interface EntryItemGeneric extends BaseEntry {
  type: "action" | "condition" | "weapon" | "melee" | "ranged" | "lore";
  data: {
    description: {
      value: string;
    };
  };
}

interface EntryItemSpell extends BaseEntry {
  type: "spell";
  data: {
    description: { value: string };
    materials: { value: string };
    target: { value: string };
  };
}

interface EntryJournalEntry extends BaseEntry {
  content: string;
}

interface Compendium {
  label: string;
  mapping?: Record<string, string | { path: string; converter: string }>;
  entries: Record<string, any>;
}

async function handleItem(id: string, label: string, entries: EntryItem[]) {
  const out: Compendium = {
    label,
    mapping: {
      name: "name",
      description: "data.description.value",
    },
    entries: {},
  };

  let hasSpells = false;

  for (const entry of entries) {
    const el: any = (out.entries[entry.name] = {
      name: entry.name,
      description: entry.data.description.value,
    });

    if (entry.type === "spell") {
      hasSpells = true;

      if (entry.data.materials?.value) {
        el.materials = entry.data.materials?.value;
      }
      if (entry.data.target?.value) {
        el.target = entry.data.target?.value;
      }
    }
  }

  if (hasSpells) {
    out.mapping!.materials = "data.materials.value";
    out.mapping!.target = "data.target.value";
  }

  const outData = JSON.stringify(out, null, 2);

  await fsMkdir("out/compendium").catch((e) => Promise.resolve());
  await fsWriteFile(pathJoin("out/compendium", id + ".json"), outData);
}

async function handleJournalEntry(
  id: string,
  name: string,
  entries: EntryJournalEntry[]
) {
  const out: Compendium = {
    label: name,
    entries: {},
  };
  for (const { name, content } of entries) {
    out.entries[name] = {
      name: name,
      description: content,
    };
  }

  const outData = JSON.stringify(out, null, 2);

  await fsMkdir("out/compendium").catch((e) => Promise.resolve());
  await fsWriteFile(pathJoin("out/compendium", id + ".json"), outData);
}

const itemTypes = [
  "action",
  "armor",
  "attack",
  "backpack",
  "condition",
  "consumable",
  "effect",
  "equipment",
  "lore",
  "melee",
  "spell",
  "spellcastingEntry",
  "treasure",
  "weapon",
];
const ignoredItemTypes = ["condition", "lore", "spellcastingEntry"];

async function handleActor(
  id: string,
  label: string,
  entries: EntryActor[],
  itemEntries: Record<string, EntryItem[]>
) {
  const out: Compendium = {
    label,
    mapping: {
      name: "name",
      items: {
        path: "items",
        converter: "fromPack",
      },
      tokenName: {
        path: "token.name",
        converter: "name",
      },
    },
    entries: {},
  };

  let hasHazards = false;
  let hasMonsters = false;

  for (const entry of entries) {
    if (entry.type === "hazard") {
      hasHazards = true;
      const el: any = (out.entries[entry.name] = {
        name: label,
        hazardDescription: entry.data.details.description,
      });

      if (entry.data.details.disable) {
        el.hazardDisable = entry.data.details.disable;
      }
      if (entry.data.details.reset) {
        el.hazardReset = entry.data.details.reset;
      }
      if (entry.data.details.routine) {
        el.hazardRoutine = entry.data.details.routine;
      }

      continue;
    }

    hasMonsters = true;
    const el: any = (out.entries[entry.name] = {
      name: entry.name,
      description: entry.data.details.publicNotes,
    });

    for (const item of entry.items) {
      if (!itemTypes.includes(item.type))
        throw new Error(`unknown item type: ${item.type}`);

      if (
        ignoredItemTypes.includes(item.type) ||
        (item.type == "spell" && !item.name.includes("("))
      )
        continue;

      const found =
        itemEntries[item.name.toLowerCase()]?.find(
          (x) =>
            (x.data.description.value &&
              item.data.description.value.startsWith(
                x.data.description.value
              )) ||
            !x.data.description.value
        ) ?? null;

      if (!found) {
        el.items ??= {};
        const itemEl: any = (el.items[item.name] = {
          name: item.name,
        });

        if (item.data.description.value) {
          itemEl.description = item.data.description.value;
        }
      }
    }
  }

  if (hasHazards) {
    out.mapping!.hazardDescription = "data.details.description";
    out.mapping!.hazardDisable = "data.details.disable";
    out.mapping!.hazardReset = "data.details.reset";
    out.mapping!.hazardRoutine = "data.details.routine";
  }
  if (hasMonsters) {
    out.mapping!.description = "data.details.publicNotes";
  }

  const outData = JSON.stringify(out, null, 2);

  await fsMkdir("out/compendium").catch((e) => Promise.resolve());
  await fsWriteFile(pathJoin("out/compendium", id + ".json"), outData);
}

const enabledPacks = [
  "actionspf2e",
  "age-of-ashes-bestiary",
  "agents-of-edgewatch-bestiary",
  "ancestries",
  "ancestryfeatures",
  "archetypes",
  "backgrounds",
  "bestiary-ability-glossary-srd",
  "bestiary-effects",
  "bestiary-family-ability-glossary",
  "boons-and-curses",
  "classes",
  "classfeatures",
  "conditionitems",
  "consumable-effects",
  "deities",
  "equipment-effects",
  "equipment-srd",
  "fall-of-plaguestone-bestiary",
  "familiar-abilities",
  "feat-effects",
  "feats-srd",
  "feature-effects",
  "gmg-srd",
  "hazards",
  "npc-gallery",
  "pathfinder-bestiary-2",
  "pathfinder-bestiary",
  "spell-effects",
  "spells-srd",
  "vehicles",
];

async function main() {
  const manifest = await downloadManifest();

  await fsMkdir("out").catch((e) => Promise.resolve());
  await fsMkdir("tmp").catch((e) => Promise.resolve());
  await fsRm("tmp/system.zip").catch((e) => Promise.resolve());
  await downloadFile(manifest.download, "tmp/system.zip");

  const directory = await unzipperOpen.file("tmp/system.zip");
  const files = Object.fromEntries(directory.files.map((f) => [f.path, f]));

  const langFile = await files[
    pathJoin(".", "pf2e", "lang", "en.json")
  ].buffer();
  const langData = JSON.parse(langFile.toString("utf-8"));

  await fsWriteFile("out/en.json", JSON.stringify(langData, null, 2));

  const allPacks = await Promise.all(
    manifest.packs
      .map((pack) => {
        const path = pathJoin(".", "pf2e", pack.path);
        const file = files[path];
        return [pack, file] as const;
      })
      .filter(([pack, file]) => file && enabledPacks.includes(pack.name))
      .map(async ([pack, file]) => {
        const stream = await file.buffer();
        const data = parseJsonStream<Entry>(stream);
        return { ...pack, entries: data };
      })
  );

  const itemEntries = _.groupBy(
    allPacks
      .filter((x) => x.type == "Item")
      .flatMap((x) => x.entries as EntryItem[]),
    (x) => x.name.toLowerCase()
  );

  for (const pack of allPacks) {
    if (pack.type === "Actor") {
      await handleActor(
        pack.name,
        pack.label,
        pack.entries as EntryActor[],
        itemEntries
      );
    } else if (pack.type === "Item") {
      await handleItem(pack.name, pack.label, pack.entries as EntryItem[]);
    } else if (pack.type === "JournalEntry") {
      await handleJournalEntry(
        pack.name,
        pack.label,
        pack.entries as EntryJournalEntry[]
      );
    } else {
      throw new Error(`not implemented: ${pack.type}`);
    }
  }

  await fsWriteFile(
    "tmp/changes.txt",
    `updated to version ${manifest.version}`
  );
}

main().then(console.log);
