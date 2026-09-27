#!/usr/bin/env node
// Lists British spellings in Splashery's public text, so new text stays in
// American English (docs/OPERATING.md, "Language"). It never changes a file.
//
//   node tools/us-english.mjs --diff               # only the lines this branch adds
//   node tools/us-english.mjs --diff=origin/main   # the same, against another base
//   node tools/us-english.mjs [paths...]           # every line (for the one-time sweep)
//
// Public text: Markdown files (README, CREDITS, CLAUDE.md, docs/, but not
// docs/reviews/, which keeps the owner's own words), and the strings in
// src/**/*.js, index.html and embed/. In code only string literals are read,
// and a hit there may be an option key or something saved in links: those stay
// as they are. Exit code 1 when anything is listed.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });

// British → American. Each entry matches as a whole word, any case; the ending
// groups cover the usual forms.
const OUR = "colour favour behaviour neighbour flavour honour humour labour rumour harbour armour vapour odour savour splendour vigour rigour clamour glamour parlour endeavour".split(" "); // prettier-ignore
const RE = "centre metre litre fibre theatre sombre calibre spectre lustre meagre sabre".split(" ");
const ISE = "real organ recogn synthes visual custom optim minim maxim priorit normal random summar apolog emphas final initial special stabil symbol memor categor character util local personal raster pressur capital critic sanit serial standard sympath energ vapor polar crystall author civil fertil harmon ideal immun industrial jeopard legal material mobil monopol neutral oxid patron penal popular public quant radical steril subsid tantal terror trivial vandal western dramat magnet digit colon".split(" "); // prettier-ignore
const SINGLE = {
  grey: "gray",
  greys: "grays",
  greyish: "grayish",
  maths: "math",
  licence: "license",
  licences: "licenses",
  defence: "defense",
  offence: "offense",
  catalogue: "catalog",
  catalogues: "catalogs",
  dialogue: "dialog (or dialogue for speech)",
  analogue: "analog",
  programme: "program",
  programmes: "programs",
  tyre: "tire",
  tyres: "tires",
  aluminium: "aluminum",
  jewellery: "jewelry",
  cheque: "check",
  mould: "mold",
  moulded: "molded",
  plough: "plow",
  towards: "toward",
  amongst: "among",
  whilst: "while",
  anticlockwise: "counterclockwise",
  aeroplane: "airplane",
  aeroplanes: "airplanes",
  pyjamas: "pajamas",
  moustache: "mustache",
  sceptical: "skeptical",
  manoeuvre: "maneuver",
  fulfil: "fulfill",
  enrol: "enroll",
  skilful: "skillful",
  judgement: "judgment",
  ageing: "aging",
  cosy: "cozy",
  draught: "draft",
  sulphur: "sulfur",
  haemoglobin: "hemoglobin",
  anaemia: "anemia",
  oesophagus: "esophagus",
  foetus: "fetus",
  paediatric: "pediatric",
  kerb: "curb",
  practise: "practice (verb)",
  practised: "practiced",
  storey: "story (of a building)",
  storeys: "stories",
  travelled: "traveled",
  travelling: "traveling",
  modelled: "modeled",
  modelling: "modeling",
  labelled: "labeled",
  labelling: "labeling",
  cancelled: "canceled",
  cancelling: "canceling",
  levelled: "leveled",
  levelling: "leveling",
  signalled: "signaled",
  fuelled: "fueled",
  jewelled: "jeweled",
  marvellous: "marvelous",
  woollen: "woolen",
  tonne: "metric ton",
};
const rules = [];
for (const w of OUR)
  rules.push([new RegExp(`\\b${w}(s|ed|ing|ful|less|ite|ites|able|ably|ist)?\\b`, "gi"), (m) => m.replace(/our/i, "or")]); // prettier-ignore
for (const w of RE)
  rules.push([new RegExp(`\\b${w}(s|d)?\\b`, "gi"), (m) => m.replace(/re(s|d)?$/i, "er$1")]);
for (const s of ISE)
  rules.push([
    new RegExp(`\\b${s}is(e|es|ed|ing|ation|ations|er|ers)\\b`, "gi"),
    (m) => m.replace(/is(e|es|ed|ing|ation|ations|er|ers)$/i, "iz$1"),
  ]);
for (const [gb, us] of Object.entries(SINGLE)) rules.push([new RegExp(`\\b${gb}\\b`, "gi"), () => us]); // prettier-ignore
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"; // prettier-ignore
rules.push([new RegExp(`\\b\\d{1,2} (${MONTHS}) \\d{4}\\b`, "g"), (m) => {
  const [d, mo, y] = m.split(" ");
  return `${mo} ${d}, ${y}`;
}]); // prettier-ignore

const isPublic = (f) =>
  (/\.md$/.test(f) && !f.startsWith("docs/reviews/") && !f.startsWith("node_modules/")) ||
  (/^src\/.*\.js$/.test(f) && !f.startsWith("src/vendor")) ||
  f === "index.html" ||
  f.startsWith("embed/");
const isCode = (f) => /\.(js|mjs|html)$/.test(f);

// The text of a line worth checking: string literals in code, everything else in prose.
function textOf(file, line) {
  if (!isCode(file)) return line.replace(/`[^`]*`/g, " "); // inline code is code
  const parts = [];
  for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g))
    parts.push(m[1] ?? m[2] ?? m[3] ?? "");
  if (/\.html$/.test(file)) parts.push(line.replace(/<[^>]*>/g, " "));
  return parts.join(" | ");
}
function check(file, lineNo, line, out) {
  const text = textOf(file, line);
  if (!text) return;
  for (const [re, fix] of rules)
    for (const m of text.matchAll(re)) out.push(`${file}:${lineNo}: "${m[0]}" → ${fix(m[0])}`);
}

const args = process.argv.slice(2);
const diffArg = args.find((a) => a === "--diff" || a.startsWith("--diff="));
const out = [];
if (diffArg) {
  const base = diffArg.includes("=") ? diffArg.split("=")[1] : "origin/main";
  const mergeBase = git(`merge-base ${base} HEAD`).trim();
  const diff = git(`diff -U0 --no-color ${mergeBase}`);
  let file = null;
  let n = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.slice(4).replace(/^b\//, "");
      if (file === "/dev/null" || !isPublic(file)) file = null;
    } else if (line.startsWith("@@")) {
      n = Number(line.match(/\+(\d+)/)[1]);
    } else if (file && line.startsWith("+")) {
      check(file, n, line.slice(1), out);
      n++;
    }
  }
} else {
  const want = args.length ? args : git("ls-files").split("\n").filter(Boolean);
  for (const f of want.filter(isPublic)) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) continue;
    fs.readFileSync(full, "utf8")
      .split("\n")
      .forEach((line, i) => check(f, i + 1, line, out));
  }
}
for (const line of out) console.log(line);
console.log(
  out.length
    ? `\n${out.length} British spelling${out.length === 1 ? "" : "s"}. Leave code identifiers, file names and anything saved in links as they are.`
    : "No British spellings found.",
);
process.exit(out.length ? 1 : 0);
