import { join as pathJoin } from "path/posix";
import { Open as unzipperOpen } from "unzipper";
import { EntryItemFeat } from "./foundry/types";
import fetch from "node-fetch";
import {
  downloadFile,
  downloadManifest,
  parseJsonStream,
} from "./foundry/system";

const TRANSIFEX_TOKEN = process.env.TTOKEN ?? "?";
const TRANSIFEX_URL = "https://rest.api.transifex.com";

async function main() {
  const manifest = await downloadManifest();
  await downloadFile(manifest.download, "tmp/system.zip");
  // await updateTags("equipment-srd", "equipment.db");
  // await updateTags("feats", "feats.db");
  // await updateTags("spells", "spells.db");
  // await updateTags("classfeatures", "classfeatures.db");
  await updateTags("pf2ebackgroundsjson", "backgrounds.db");
}

async function updateTags(resId: string, fileName: string) {
  const directory = await unzipperOpen.file("tmp/system.zip");
  const files = Object.fromEntries(directory.files.map((f) => [f.path, f]));

  const feats = parseJsonStream<EntryItemFeat>(
    await files[pathJoin(".", "pf2e", "packs", fileName)].buffer()
  );
  const featsMap = new Map(feats.map((f) => [f.name, f]));

  const data = await transifexGetAll(`/resource_strings`, {
    "filter[resource]": `o:foundryvtt-ita:p:pathfinder-2e-2:r:${resId}`,
    "filter[tags][all]": "untagged",
    limit: 1000,
  });

  const toUpdate: { id: string; key: string; tag: string }[] = [];
  for (const element of data) {
    const {
      id,
      attributes: { key },
    } = element;
    const match = key.match(/^entries\.([^\.]*)\..*$/);
    if (!match) continue;
    const [, name] = match;
    const source = featsMap.get(name)?.data?.source?.value;
    const tag = getRealTag(source);
    if (tag) toUpdate.push({ id, key, tag });
    else if (source != "")
      console.log(`Unknown source: ${source} (item: ${name})`);
  }

  console.log(`not updated: ${data.length - toUpdate.length}`);

  for (const { id, key, tag } of toUpdate) {
    console.log(`updating ${key} [${tag}]`);
    await transifexPatch(`/resource_strings/${id}`, {
      attributes: {
        tags: [tag],
      },
      id,
      type: "resource_strings",
    });
  }
}

async function transifexPatch(url: string, data: any) {
  const resp = await fetch(`${TRANSIFEX_URL}${url}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TRANSIFEX_TOKEN}`,
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({ data }),
  });
  return await resp.json();
}

async function transifexGetAll(url: string, query: any): Promise<any[]> {
  const queryString = new URLSearchParams(query).toString();
  if (queryString.length > 0) url += `?${queryString}`;
  url = `${TRANSIFEX_URL}${url}`;

  const actualData = [];
  while (true) {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TRANSIFEX_TOKEN}`,
      },
    });
    const data: any = await resp.json();
    actualData.push(...data.data);

    if (data.links.next) {
      url = data.links.next;
      continue;
    }
    break;
  }
  return actualData;
}

async function transifexGet(url: string, query: any): Promise<any> {
  const queryString = new URLSearchParams(query).toString();
  if (queryString.length > 0) url += `?${queryString}`;

  const resp = await fetch(`${TRANSIFEX_URL}${url}`, {
    headers: {
      Authorization: `Bearer ${TRANSIFEX_TOKEN}`,
    },
  });
  return await resp.json();
}

function getRealTag(source?: string) {
  switch (source) {
    case "":
      return "unknown";
    // TRADOTTI
    // CORE
    case "Core Rulebook":
    case "Pathfinder Core Rulebook":
      return "core-rulebook";
    case "Bestiary":
    case "Pathfinder Bestiary":
      return "bestiary1";
    case "Gamemastery Guide":
    case "Pathfinder Gamemastery Guide":
      return "gamemastery-guide";
    case "Bestiary 2":
    case "Pathfinder Bestiary 2":
      return "bestiary2";
    case "Advanced Player's Guide":
    case "Pathfinder Advanced Player's Guide":
      return "advanced-players-guide";
    // LOST OMENS
    case "Character Guide":
    case "Pathfinder Lost Omens: Character Guide":
      return "character-guide";
    case "World Guide":
    case "Pathfinder Lost Omens: World Guide":
    case "Pathfinder Lost Omens World Guide":
      return "world-guide";
    case "Gods & Magic":
    case "Pathfinder Lost Omens: Gods & Magic":
      return "gods-and-magic";
    // ADVENTURE PATH
    case "Pathfinder: Age of Ashes Player's Guide":
    case "Age of Ashes Player's Guide":
      return "age-of-ashes1";
    case "Pathfinder #145":
      return "age-of-ashes1";
    case "Pathfinder #146":
      return "age-of-ashes2";
    case "Pathfinder #147":
    case "Pathfinder #147: Tomorrow Must Burn":
      return "age-of-ashes3";
    case "Pathfinder #148":
    case "Pathfinder #148: Fires of the Haunted City":
      return "age-of-ashes4";
    case "Pathfinder #149":
    case "Pathfinder #149: Against the Scarlet Triad":
      return "age-of-ashes5";
    case "Pathfinder #150":
    case "Pathfinder #150: Broken Promises":
      return "age-of-ashes6";
    case "Pathfinder: Agents of Edgewatch Player's Guide":
    case "Agents of Edgewatch Player's Guide":
    case "Pathfinder #157":
    case "Pathfinder #157: Devil at the Dreaming Palace":
      return "agents-of-edgewatch1";
    case "Pathfinder #158":
    case "Pathfinder #158: Sixty Feet Under":
      return "agents-of-edgewatch2";
    case "Pathfinder #159":
    case "Pathfinder #159: All or Nothing":
      return "agents-of-edgewatch3";
    case "Pathfinder #160":
    case "Pathfinder #160: Assault on Hunting Lodge Seven":
      return "agents-of-edgewatch4";
    case "Pathfinder #161":
    case "Pathfinder #161: Belly of the Black Whale":
      return "agents-of-edgewatch5";
    case "Pathfinder #162":
    case "Pathfinder #162: Ruins of the Radiant Siege":
      return "agents-of-edgewatch6";
    // ADVENTURE
    case "The Fall of Plaguestone":
    case "Pathfinder Adventure: The Fall of Plaguestone":
      return "the-fall-of-plaguestone";

    // NON TRADOTTI
    // CORE
    case "Bestiary 3":
    case "Pathfinder Bestiary 3":
      return "bestiary3";
    case "Pathfinder Beginner Box: Hero's Handbook":
    case "Pathfinder Beginner Box":
      return "beginner-box";
    case "Secrets of Magic":
    case "Pathfinder Secrets of Magic":
      return "secrets-of-magic";
    case "Guns & Gears":
    case "Pathfinder Guns and Gears":
    case "Pathfinder Guns & Gears":
      return "guns-and-gears";
    // LOST OMENS
    case "Ancestry Guide":
    case "Pathfinder Lost Omens: Ancestry Guide":
      return "ancestry-guide";
    case "Legends":
    case "Pathfinder Lost Omens: Legends":
      return "legends";
    case "PFS Guide":
    case "Pathfinder Lost Omens: PFS Guide":
    case "Pathfinder Lost Omens: Pathfinder Society Guide":
      return "pfs-guide";
    case "The Mwangi Expanse":
    case "Pathfinder Lost Omens: The Mwangi Expanse":
      return "the-mwangi-expanse";
    case "Grand Bazaar":
    case "Pathfinder Lost Omens: The Grand Bazaar":
    case "Pathfinder Lost Omens: Grand Bazaar":
      return "grand-bazaar";
    // ADVENTURE PATH
    case "Pathfinder: Extinction Curse Player's Guide":
    case "Pathfinder #151":
    case "Pathfinder #151: The Show Must Go On":
      return "extinction-curse1";
    case "Pathfinder #152":
    case "Pathfinder #152: Legacy of the Lost God":
      return "extinction-curse2";
    case "Pathfinder #153":
    case "Pathfinder #153: Life's Long Shadows":
    case "Pathfinder #153: Life's Long Shadow":
      return "extinction-curse3";
    case "Pathfinder #154":
    case "Pathfinder #154: Siege of the Dinosaurs":
      return "extinction-curse4";
    case "Pathfinder #155":
    case "Pathfinder #155: Lord of the Black Sands":
      return "extinction-curse5";
    case "Pathfinder #156":
    case "Pathfinder #156: The Apocalypse Prophet":
      return "extinction-curse6";
    case "Abomination Vaults Player's Guide":
    case "Pathfinder: Abomination Vaults Player's Guide":
    case "Pathfinder #163":
    case "Pathfinder #163: Ruins of Gauntlight":
      return "abomination-vaults1";
    case "Pathfinder #164":
    case "Pathfinder #164: Hands of the Devil":
      return "abomination-vaults2";
    case "Pathfinder #165":
    case "Patfinder #165: Eyes of Empty Death":
    case "Pathfinder #165: Eyes of Empty Death":
      return "abomination-vaults3";
    case "Pathfinder: Fists of the Ruby Phoenix Player's Guide":
    case "Pathfinder #166":
    case "Pathfinder #166: Despair on Danger Island":
      return "fists-of-the-ruby-phoenix1";
    case "Pathfinder #167":
    case "Pathfinder #167: Ready? Fight!":
      return "fists-of-the-ruby-phoenix2";
    case "Pathfinder #168":
    case "Patfinder #168: King of the Mountain":
    case "Pathfinder #168: King of the Mountain":
      return "fists-of-the-ruby-phoenix3";
    case "Strength of Thousands Player's Guide":
    case "Pathfinder #169":
    case "Pathfinder #169: Kindled Magic":
      return "strength-of-thousands1";
    case "Pathfinder #170":
    case "Pathfinder #170: Spoken on the Song Wind":
      return "strength-of-thousands2";
    case "Pathfinder #171":
      return "strength-of-thousands3";
    case "Pathfinder #172":
      return "strength-of-thousands4";
    case "Pathfinder: Quest for the Frozen Flame Player's Guide":
      return "quest-for-the-frozen-flame1";
    // ADVENTURE
    case "The Slithering":
    case "Pathfinder Adventure: The Slithering":
      return "the-slithering";
    case "Troubles in Otari":
      return "troubles-in-otari";
    case "Malevolence":
    case "Pathfinder Adventure: Malevolence":
      return "malevolence";
    case "Night of the Gray Death":
    case "Pathfinder Adventure: Night of the Gray Death":
      return "night-of-the-gray-death";
    // WEB
    case "Azarketi Ancestry Web Supplement":
      return "azarketi-ancestry-web-supplement";
    case "Pathfinder Adventure: Little Trouble in Big Absalom":
      return "little-trouble-in-big-absalom";
    case "Pathfinder Adventure: Redpitch Alchemy":
      return "redpitch-alchemy";
  }
  return null;
}

main().then(console.log);
