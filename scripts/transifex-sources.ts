import {
  mkdir as fsMkdir,
  rm as fsRm,
  writeFile as fsWriteFile,
} from "fs/promises";
import _ from "lodash";
import { join as pathJoin } from "path/posix";
import { downloadFile, readSystemZip } from "./foundry/system";
import { downloadManifest } from "./foundry/system";
import { EntryActor, EntryItem, EntryJournalEntry } from "./foundry/types";

const baseUrl =
  "https://gitlab.com/hooking/foundry-vtt---pathfinder-2e/-/jobs/artifacts/master/raw";

interface Compendium {
  label: string;
  mapping?: Record<string, string | { path: string; converter: string }>;
  entries: Record<string, any>;
}

const rangeRegex = /^(?:touch|planetary|[\d.,]+ (?:feet|miles?))$/;
const timeRegex = /^(?:1|2|3|reaction|free|[\d.,]+ (?:minutes?|days?|hours?))$/;

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
      if (entry.data.range?.value) {
        const val = entry.data.range?.value.toLowerCase();
        if (!val.match(rangeRegex)) {
          el.range = entry.data.range?.value;
        }
      }
      if (entry.data.time?.value) {
        const val = entry.data.time?.value.toLowerCase();
        if (!val.match(timeRegex)) {
          el.time = entry.data.time?.value;
        }
      }
    }
  }

  if (hasSpells) {
    out.mapping!.materials = "data.materials.value";
    out.mapping!.target = "data.target.value";
    out.mapping!.range = {
      path: "data.range.value",
      converter: "convertRange",
    };
    out.mapping!.time = {
      path: "data.time.value",
      converter: "convertTime",
    };
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

async function downloadFiles() {
  const manifest = await downloadManifest();
  await fsMkdir("out").catch((e) => Promise.resolve());
  await fsMkdir("tmp").catch((e) => Promise.resolve());
  await fsRm("tmp/system.zip").catch((e) => Promise.resolve());
  await downloadFile(manifest.download, "tmp/system.zip");
  return manifest;
}

async function main() {
  const manifest = await downloadFiles();
  const [allPacks, langData] = await readSystemZip(manifest);

  await fsWriteFile("out/en.json", JSON.stringify(langData, null, 2));

  const itemEntries = _.groupBy(
    allPacks
      .filter((x) => x.entity == "Item")
      .flatMap((x) => x.entries as EntryItem[]),
    (x) => x.name.toLowerCase()
  );

  for (const pack of allPacks) {
    if (pack.entity === "Actor") {
      await handleActor(
        pack.name,
        pack.label,
        pack.entries as EntryActor[],
        itemEntries
      );
    } else if (pack.entity === "Item") {
      await handleItem(pack.name, pack.label, pack.entries as EntryItem[]);
    } else if (pack.entity === "JournalEntry") {
      await handleJournalEntry(
        pack.name,
        pack.label,
        pack.entries as EntryJournalEntry[]
      );
    } else {
      throw new Error(`not implemented: ${pack.entity}`);
    }
  }

  await fsWriteFile(
    "tmp/changes.txt",
    `updated to version ${manifest.version}`
  );
}

main().then(console.log);