import { createWriteStream } from "fs";
import fetch from "node-fetch";
import { join } from "path/posix";
import { Open as unzipperOpen } from "unzipper";
import { Entry, FoundrySystemManifest } from "./types";

const baseUrl =
  "https://gitlab.com/hooking/foundry-vtt---pathfinder-2e/-/jobs/artifacts/master/raw";

export async function downloadManifest(): Promise<FoundrySystemManifest> {
  const resp = await fetch(`${baseUrl}/system.json?job=build`);
  const data = await resp.text();
  return JSON.parse(data);
}

export async function downloadFile(url: string, path: string) {
  const resp = await fetch(url);
  const fileStream = createWriteStream(path);
  await new Promise((ful, rej) => {
    resp.body!.pipe(fileStream);
    resp.body!.on("error", rej);
    resp.body!.on("finish", ful);
  });
}

export async function readSystemZip(manifest: FoundrySystemManifest) {
  const directory = await unzipperOpen.file("tmp/system.zip");
  const files = Object.fromEntries(directory.files.map((f) => [f.path, f]));

  const langFile = await files[join(".", "pf2e", "lang", "en.json")].buffer();
  const langData = JSON.parse(langFile.toString("utf-8"));

  return [
    await Promise.all(
      manifest.packs
        .map((pack) => {
          const path = join(".", "pf2e", pack.path);
          const file = files[path];
          return [pack, file] as const;
        })
        .filter(([pack, file]) => file && enabledPacks.includes(pack.name))
        .map(async ([pack, file]) => {
          const stream = await file.buffer();
          const data = parseJsonStream<Entry>(stream);
          return { ...pack, entries: data };
        })
    ),
    langData,
  ] as const;
}

export function parseJsonStream<T>(stream: Buffer) {
  return stream
    .toString("utf-8")
    .split("\n")
    .filter((x) => x)
    .map((p) => JSON.parse(p) as T);
}

const enabledPacks = [
  "actionspf2e",
  "age-of-ashes-bestiary",
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
  "heritages",
  "npc-gallery",
  "pathfinder-bestiary-2",
  "pathfinder-bestiary",
  "spell-effects",
  "spells-srd",
  "vehicles",
];
