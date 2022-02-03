import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
config();

const resources = {
  actionspf2e: "actions",
  "age-of-ashes-bestiary": "age-of-ashes-bestiary",
  ancestries: "ancestries",
  ancestryfeatures: "ancestryfeatures",
  archetypes: "archetypes",
  backgrounds: "pf2ebackgroundsjson",
  "pathfinder-bestiary": "bestiary-1",
  classes: "classes",
  classfeatures: "classfeatures",
  conditionitems: "conditionitems",
  deities: "deities",
  "equipment-srd": "equipment-srd",
  heritages: "heritages",
  "fall-of-plaguestone-bestiary": "fall-of-plaguestone-bestiary",
  "feats-srd": "feats",
  "npc-gallery": "npc-gallery",
  "spells-srd": "spells",

  "abomination-vaults-bestiary": null,
  "agents-of-edgewatch-bestiary": null,
  "april-fools-bestiary": null,
  "blog-bestiary": null,
  "extinction-curse-bestiary": null,
  "fists-of-the-ruby-phoenix-bestiary": null,
  hazards: null,
  "lost-omens-mwangi-expanse-bestiary": null,
  "lost-omens-monsters-of-myth-bestiary": null,
  "malevolence-bestiary": null,
  "menace-under-otari-bestiary": null,
  "one-shot-bestiary": null,
  "pathfinder-bestiary-2": null,
  "pathfinder-bestiary-3": null,
  "pfs-introductions-bestiary": null,
  "pfs-season-1-bestiary": null,
  "pfs-season-2-bestiary": null,
  "pfs-season-3-bestiary": null,
  "strength-of-thousands-bestiary": null,
  "the-slithering-bestiary": null,
  "troubles-in-otari-bestiary": null,
  "night-of-the-gray-death-bestiary": null,
  vehicles: null,
  "familiar-abilities": null,
  "bestiary-effects": null,
  domains: null,
  "boons-and-curses": null,
  "campaign-effects": null,
  "consumable-effects": null,
  "equipment-effects": null,
  "feat-effects": null,
  "feature-effects": null,
  "pathfinder-society-boons": null,
  "spell-effects": null,
  iconics: null,
  "paizo-pregens": null,
  "rollable-tables": null,
  criticaldeck: null,
  "hero-point-deck": null,
  "gmg-srd": null,
  "action-macros": null,
  "pf2e-macros": null,
  "bestiary-ability-glossary-srd": null,
  "bestiary-family-ability-glossary": null,
};

function parseResource(x: any) {
  if (x.entries) {
    return x;
  }
  try {
    const text = (x as string).replace(/(..)"(..)/g, (m, b, a) => {
      if (b[1] == "\\") return m;
      if (b == "  ") return m;
      if (b == ": " || a == ": ") return m;
      if (a == ",\n") return m;
      return `${b}\\"${a}`;
    });
    return JSON.parse(text);
  } catch (e) {
    throw new Error("cant parse!");
  }
}

(async () => {
  const { resourceTranslationDownload } = await import(
    "./transifex/download.js"
  );

  await mkdir("out").catch((e) => Promise.resolve());
  await mkdir("out/compendium").catch((e) => Promise.resolve());

  for (const [compendium, resource] of Object.entries(resources)) {
    if (!resource) continue;

    console.log(`downloading resource ${resource} from transifex`);
    const data = await resourceTranslationDownload(
      `o:foundryvtt-ita:p:pathfinder-2e-2:r:${resource}`
    );

    const realData = parseResource(data);

    await writeFile(
      `out/compendium/pf2e.${compendium}.json`,
      JSON.stringify(realData, null, 2)
    );
  }

  console.log(`downloading resource en.json from transifex`);
  const data = await resourceTranslationDownload(
    `o:foundryvtt-ita:p:pathfinder-2e-2:r:enjson`
  );
  await writeFile(`out/it.json`, JSON.stringify(data, null, 2));
})();
