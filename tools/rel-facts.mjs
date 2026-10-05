#!/usr/bin/env node
// Real elements (lane Elements, prefix rel): builds src/elements-real/facts.js, the facts the toy
// shows for each element, and tools/rel-reference.json, the snapshot of the references the tests
// check them against.
//
// - PubChem's periodic table (NCBI, U.S. National Library of Medicine; public domain U.S.
//   government data): https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON gives each
//   element's atomic mass, standard state, melting and boiling points (K), density (g/cm³) and
//   year of discovery.
// - PubChem's element pages (https://pubchem.ncbi.nlm.nih.gov/element/<Z>), section "Uses", which
//   quote Jefferson Lab's "It's Elemental" and Los Alamos National Laboratory's periodic table
//   (both U.S. Department of Energy): the uses in tools/rel-uses.json are short sentences of our own,
//   each with the exact words from those pages that back it.
// - Group and period come from the element's place in the table (the standard 18-column layout).
//
//   node tools/rel-facts.mjs
import fs from "node:fs";
import path from "node:path";
import { cellOf } from "../src/elements-real/layout.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cache = path.join(root, ".cache/rel");
fs.mkdirSync(path.join(cache, "pv"), { recursive: true });
const UA = { "User-Agent": "SplasheryBuild/1.0 (https://github.com/ryanjosephkamp/splashery; build tool)" }; // prettier-ignore

async function getJson(url, file) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) {
      const t = await r.text();
      fs.writeFileSync(file, t);
      await new Promise((ok) => setTimeout(ok, 300));
      return JSON.parse(t);
    }
    if (i >= 4) throw new Error(`${r.status} ${url}`);
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
  }
}

const table = await getJson(
  "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON",
  path.join(cache, "pubchem.json"),
);
const cols = table.Table.Columns.Column;
const rows = table.Table.Row.map((r) => Object.fromEntries(cols.map((c, i) => [c, r.Cell[i]])));
const uses = JSON.parse(fs.readFileSync(path.join(root, "tools/rel-uses.json"), "utf8"));

// The uses' source texts, from each element's PubChem page.
const SRC = { jlab: "Jefferson Lab", lanl: "Los Alamos National Laboratory" };
const useTexts = {};
for (let z = 1; z <= 118; z++) {
  const d = await getJson(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/${z}/JSON`,
    path.join(cache, "pv", `${z}.json`),
  );
  const refs = Object.fromEntries(d.Record.Reference.map((r) => [r.ReferenceNumber, r.SourceName]));
  const out = {};
  for (const s of d.Record.Section || [])
    if (s.TOCHeading === "Uses")
      for (const inf of s.Information || []) {
        const name = refs[inf.ReferenceNumber] || "";
        const key = Object.keys(SRC).find((k) => name.startsWith(SRC[k]));
        if (key) out[key] = (inf.Value.StringWithMarkup || []).map((m) => m.String).join(" ");
      }
  useTexts[z] = out;
}

const num = (s) => (s === "" || s == null ? null : Number(s));
const STATE = {
  Solid: "solid",
  Liquid: "liquid",
  Gas: "gas",
  "Expected to be a Solid": "solid (predicted)",
  "Expected to be a Gas": "gas (predicted)",
  "Expected to be a Liquid": "liquid (predicted)",
};

const facts = [];
const reference = { source: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON", rows: [], uses: [] }; // prettier-ignore
for (const r of rows) {
  const z = Number(r.AtomicNumber);
  const [group, period, fBlock] = cellOf(z);
  const u = uses.find((x) => x.z === z)?.uses || [];
  for (const x of u) {
    const text = useTexts[z][x.src] || "";
    if (!text.includes(x.quote)) throw new Error(`${z}: the quote is not in the ${x.src} text`);
    // The source's sentence that holds the quote (from the sentence start before it to the next
    // full stop after it), so the tests can check each use against its words.
    const at = text.indexOf(x.quote);
    const from = Math.max(0, text.lastIndexOf(". ", at) + 2);
    const stop = text.indexOf(". ", at + x.quote.length);
    const sentence = text.slice(from > at ? 0 : from, stop < 0 ? text.length : stop + 1).trim();
    reference.uses.push({ z, src: x.src, text: x.text, quote: x.quote, sentence });
  }
  if (!STATE[r.StandardState]) throw new Error(`${z}: unknown state ${r.StandardState}`);
  facts.push([
    z,
    r.Symbol,
    r.Name,
    r.AtomicMass,
    fBlock ? 0 : group,
    period,
    STATE[r.StandardState],
    num(r.Density),
    num(r.MeltingPoint),
    num(r.BoilingPoint),
    r.YearDiscovered,
    r.GroupBlock,
    u.map((x) => [x.text, x.src]),
  ]);
  reference.rows.push({
    AtomicNumber: r.AtomicNumber,
    Symbol: r.Symbol,
    Name: r.Name,
    AtomicMass: r.AtomicMass,
    StandardState: r.StandardState,
    MeltingPoint: r.MeltingPoint,
    BoilingPoint: r.BoilingPoint,
    Density: r.Density,
    GroupBlock: r.GroupBlock,
    YearDiscovered: r.YearDiscovered,
  });
}

const header = `// The facts the Real elements toy shows (lane Elements), written by tools/rel-facts.mjs from
// PubChem's periodic table and element pages (NCBI; public domain U.S. government data); don't
// edit it by hand. Each row: [Z, symbol, name, atomic mass (u, as PubChem gives it), group (0 for
// the lanthanoids and actinoids, which are left out of the group numbers here), period, state at
// room temperature, density (g/cm³), melting point (K), boiling point (K), year of discovery
// ("Ancient" when known since antiquity), PubChem's group block, uses ([text, source]: "jlab"
// Jefferson Lab, "lanl" Los Alamos National Laboratory, as quoted on PubChem's element pages)].
// null: not measured.

// prettier-ignore
export const FACTS = [
${facts.map((f) => `  ${JSON.stringify(f)},`).join("\n")}
];
`;
fs.writeFileSync(path.join(root, "src/elements-real/facts.js"), header);
fs.writeFileSync(path.join(root, "tools/rel-reference.json"), JSON.stringify(reference, null, 2) + "\n"); // prettier-ignore
console.log(`${facts.length} elements, ${reference.uses.length} uses`);
