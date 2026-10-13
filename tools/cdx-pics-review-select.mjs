// Final review selection: recognizable subjects, all five rendered links, then worst-link detail.
import fs from "node:fs";
import { QR_PICTURES } from "../src/qr-craft/codex-pictures.js";
const directory = "docs/audits/sample-pictures-2026-10/";
const subjects = JSON.parse(fs.readFileSync(directory + "qr-review-scores.json"));
const browser = new Map(
  JSON.parse(fs.readFileSync(directory + "qr-review-browser.json")).map((r) => [r.id, r]),
);
const visual = JSON.parse(fs.readFileSync(directory + "qr-subject-review.json"));
const pending = subjects.filter((r) => r.rasterEligible && !browser.has(r.id));
if (pending.length) throw Error(`${pending.length} subjects still need rendered-link checks.`);
for (const r of subjects) {
  r.browserEligible = browser.get(r.id)?.eligible ?? false;
  r.visualPass = visual[r.id]?.clear ?? false;
  r.eligible = r.rasterEligible && r.browserEligible && r.visualPass;
}
// The final review accepts the existing 21 AI subjects and retires all procedural panels.
// Choose only the three replacements from the new, individually reviewed single objects.
const replacements = new Set(
  JSON.parse(fs.readFileSync("tools/cdx-pics-qr-ai-prompts.json"))
    .filter((r) => r.round === 3)
    .map((r) => r.id),
);
const accepted = new Set(
  QR_PICTURES.filter((r) => r.ai && !replacements.has(r.id)).map((r) => r.id),
);
if (accepted.size !== 21) throw Error(`Expected 21 accepted AI pictures, got ${accepted.size}.`);
const selected = subjects.filter((r) => accepted.has(r.id));
if (selected.some((r) => !r.eligible)) throw Error("An accepted subject no longer qualifies.");
const ranked = subjects
  .filter((r) => replacements.has(r.id) && r.eligible)
  .sort((a, b) => b.score - a.score);
selected.push(...ranked.slice(0, 3));
selected.sort((a, b) => b.score - a.score);
if (selected.length !== 24) throw Error(`Only ${selected.length} distinct subjects qualify.`);
const keep = new Set(selected.map((r) => r.id));
for (const r of subjects) {
  r.kept = keep.has(r.id);
  r.reason = r.kept
    ? accepted.has(r.id)
      ? "Accepted AI subject retained; clear at 330px; all five rendered links pass."
      : "Clear single AI subject at 330px; all five rendered links pass; one of the three highest worst-link replacement scores."
    : !r.ai
      ? "Retired in the final Operator review: replace procedural panels and the flat vase silhouette with stronger AI subjects."
      : !r.rasterEligible
        ? "Production layout scan failure."
        : !r.browserEligible
          ? "Rendered link scan failure."
          : !r.visualPass
            ? visual[r.id]?.reason || "Subject not clear enough at phone size."
            : replacements.has(r.id)
              ? "Lower worst-link detail than the three qualified replacement subjects."
              : "Not selected in the earlier accepted AI set.";
  if (r.kept) {
    const destination = `assets/toys/qr-picture/codex/${r.id}.jpg`;
    if (r.file !== destination) fs.copyFileSync(r.file, destination);
    r.file = destination;
  } else if (r.file.startsWith("assets/toys/qr-picture/codex/")) {
    const cached = `.cache/cdx-pics/qr/${r.id}.jpg`;
    if (!fs.existsSync(cached)) throw Error(`Missing preserved original: ${r.id}`);
    r.file = cached;
  }
}
const model = selected.map((r) => ({
  id: r.id,
  label: r.label,
  file: r.file,
  author: r.ai
    ? "Ryan, the owner of Splashery (made with an AI image tool)"
    : "Ryan, with Codex (GPT-6)",
  page: `https://github.com/ryanjosephkamp/splashery/blob/main/${r.ai ? "CREDITS.md" : r.id.includes("-print-") ? "tools/cdx-pics-qr-print.mjs" : "tools/cdx-pics-qr.mjs"}`,
  license: r.ai ? "AI-made by the owner" : "CC0 1.0",
  ai: r.ai,
  score: r.score,
  ...(r.ai
    ? {
        prompt: `C54-Q${JSON.parse(fs.readFileSync("tools/cdx-pics-qr-ai-prompts.json")).findIndex((x) => x.id === r.id) + 1}`,
      }
    : {}),
}));
fs.writeFileSync(
  "src/qr-craft/codex-pictures.js",
  "// Task 54 review: payload-independent pictures, loaded only when picked.\nexport const QR_PICTURES = " +
    JSON.stringify(model, null, 2) +
    ";\n",
);
fs.writeFileSync(directory + "qr-review-scores.json", JSON.stringify(subjects, null, 2) + "\n");
// Retire only this task's unselected files. All generated originals and rejected JPEGs stay local.
for (const name of fs.readdirSync("assets/toys/qr-picture/codex")) {
  if (!keep.has(name.replace(/\.jpg$/, ""))) fs.unlinkSync("assets/toys/qr-picture/codex/" + name);
}
console.log(
  `Selected 24 recognizable subjects: ${selected.filter((r) => r.ai).length} AI-made, ${selected.filter((r) => !r.ai).length} CC0.`,
);
