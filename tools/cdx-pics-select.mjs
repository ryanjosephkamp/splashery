// Task 54: the highest picture-detail scores among backgrounds that pass every default check.
import fs from "node:fs";
import { QR_PICTURES as previous } from "../src/qr-craft/codex-pictures.js";
const root = "docs/audits/sample-pictures-2026-10/";
const rows = JSON.parse(fs.readFileSync(root + "qr-scores.json"));
const browser = new Map(
  JSON.parse(fs.readFileSync(root + "qr-browser-scores.json")).map((r) => [r.id, r]),
);
for (const r of rows) {
  r.rasterEligible = r.rasterEligible ?? r.eligible;
  r.browserEligible = browser.get(r.id)?.eligible ?? false;
  r.eligible = r.rasterEligible && r.browserEligible;
}
const pending = rows.filter((r) => r.rasterEligible && !browser.has(r.id));
if (pending.length)
  throw Error(`${pending.length} raster-qualified candidates still lack browser checks.`);
const ranked = rows.filter((r) => r.eligible).sort((a, b) => b.score - a.score);
if (ranked.length < 24)
  throw Error(`Only ${ranked.length} browser-qualified backgrounds; need 24.`);
const keep = new Set(ranked.slice(0, 24).map((r) => r.id));
for (const r of rows) {
  r.kept = keep.has(r.id);
  r.reason = r.kept
    ? "Highest picture-detail score after all default raster, stage, and export checks."
    : !r.rasterEligible
      ? "Raster scan failure."
      : !r.browserEligible
        ? "Production render/export scan failure."
        : "Lower picture-detail score among fully qualified candidates.";
  delete r.file;
  if (r.kept) {
    r.file = `assets/toys/qr-picture/codex/${r.id}.jpg`;
    fs.copyFileSync(`.cache/cdx-pics/qr/${r.id}.jpg`, r.file);
  }
}
const data = ranked.slice(0, 24).map((r) => ({
  id: r.id,
  label: r.label,
  file: r.file,
  author: "Ryan, with Codex (GPT-6)",
  page: `https://github.com/ryanjosephkamp/splashery/blob/main/tools/${r.carrier ? "cdx-pics-qr-grid.mjs" : r.series ? "cdx-pics-qr-print.mjs" : "cdx-pics-qr.mjs"}`,
  license: "CC0 1.0",
  score: r.score,
  defaultPayloadSpecific: !!r.carrier,
}));
fs.writeFileSync(
  "src/qr-craft/codex-pictures.js",
  "// Task 54: original procedural CC0 backgrounds, loaded only when picked.\nexport const QR_PICTURES = " +
    JSON.stringify(data, null, 2) +
    ";\n",
);
fs.writeFileSync(root + "qr-scores.json", JSON.stringify(rows, null, 2) + "\n");
// Keep previous files until any in-flight regression worker finishes; cleanup before committing.
fs.writeFileSync(
  ".cache/cdx-pics/previous-qr-files.json",
  JSON.stringify(previous.filter((r) => !keep.has(r.id)).map((r) => r.file)),
);
console.log(`Kept 24 of ${rows.length}; ${ranked.length} pass all default trials.`);
