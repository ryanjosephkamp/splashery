#!/usr/bin/env node
// Real elements (lane Elements): writes the samples' credits from src/elements-real/samples.js into
// CREDITS.md (the section between the "Real elements" markers) and tools/assets.json
// ("elementSamples"), so the three lists never drift apart.
//
//   node tools/rel-credits.mjs
import fs from "node:fs";
import { SAMPLES, WITH_PHOTO, LICENSE_URL } from "../src/elements-real/samples.js";
import { FACTS } from "../src/elements-real/facts.js";

const CHECKED = "October 5, 2026";
const nameOf = (z) => FACTS[z - 1][2];

// tools/assets.json
const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
assets.elementSamples = WITH_PHOTO.map((z) => {
  const s = SAMPLES[z];
  return {
    id: `element-${z}`,
    file: `assets/toys/real-elements/${z}.jpg`,
    depth: `assets/toys/real-elements/${z}.png`,
    toy: "real-elements",
    name: `${nameOf(z)}: ${s.what}`,
    author: s.author,
    page: s.page,
    license: s.license,
    checked: CHECKED,
    note:
      (s.src === "ioe"
        ? `From ${s.file}. Images of Elements asks for credit by linking to the element's page. `
        : `From the Commons file "${s.file}". `) +
      "Cut out of its background, reduced to 256 x 256 (and 64 x 64 in tiles.jpg), with its depth from Depth Anything V2 Small, by tools/rel-samples.mjs." +
      (s.license.startsWith("CC BY-SA") ? " The cut-out sample stays under the same license." : ""),
  };
});
fs.writeFileSync("tools/assets.json", JSON.stringify(assets, null, 2) + "\n");

// CREDITS.md
const ioe = WITH_PHOTO.filter((z) => SAMPLES[z].src === "ioe");
const commons = WITH_PHOTO.filter((z) => SAMPLES[z].src === "commons");
const lines = [
  "<!-- Real elements: written by tools/rel-credits.mjs -->",
  "",
  "## Real elements (lane Elements)",
  "",
  `The Real elements toy (a labs toy) shows ${WITH_PHOTO.length} elements as photos of real samples, each cut`,
  "out of its background and given depth by Depth Anything V2 Small (Apache 2.0) at build time",
  "(`tools/rel-samples.mjs`), in `assets/toys/real-elements/`. Each license was checked on the live",
  `page on ${CHECKED}.`,
  "",
  `- ${ioe.length} photos from [Images of Elements](https://images-of-elements.com/) (Jumk.de Webprojects),`,
  '  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) ("The images are licensed under a',
  '  Creative Commons Attribution 3.0 Unported License, unless otherwise noted."; none of these is',
  "  otherwise noted), each credited by a link to its element's page:",
  "  " + ioe.map((z) => `[${nameOf(z)}](${SAMPLES[z].page})`).join(", ") + ".",
  ...commons.map(
    (z) =>
      `- ${nameOf(z)}: "${SAMPLES[z].file}" by ${SAMPLES[z].author}, [${SAMPLES[z].license}](${LICENSE_URL[SAMPLES[z].license]}), on [Commons](${SAMPLES[z].page}).` +
      (SAMPLES[z].license.startsWith("CC BY-SA")
        ? " The cut-out sample made from it is shared under the same license, shown beside the sample in the toy."
        : ""),
  ),
  "",
  "The facts come from PubChem's periodic table and element pages (NCBI; public domain U.S.",
  "government data); the uses are our own short sentences, each backed by words PubChem quotes from",
  "Jefferson Lab and Los Alamos National Laboratory (U.S. Department of Energy). See",
  "`tools/rel-facts.mjs` and `docs/evidence/real-elements.json`.",
  "",
  "<!-- End of Real elements -->",
];
let credits = fs.readFileSync("CREDITS.md", "utf8");
const a = credits.indexOf("<!-- Real elements: written by tools/rel-credits.mjs -->");
const b = credits.indexOf("<!-- End of Real elements -->");
const block = lines.join("\n");
if (a >= 0 && b > a)
  credits = credits.slice(0, a) + block + credits.slice(b + "<!-- End of Real elements -->".length); // prettier-ignore
else {
  const at = credits.indexOf("## Word vectors");
  credits = credits.slice(0, at) + block + "\n\n" + credits.slice(at);
}
fs.writeFileSync("CREDITS.md", credits);
console.log(`${WITH_PHOTO.length} samples credited`);
