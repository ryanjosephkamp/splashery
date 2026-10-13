// Final review selection: recognizable subjects, all five rendered links, then worst-link detail.
import fs from "node:fs";
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
const ranked = subjects.filter((r) => r.eligible).sort((a, b) => b.score - a.score);
const selected = [],
  families = new Set();
for (const r of ranked) {
  const family = r.ai ? r.id : r.label.replace(/(?: soft)? \d+$/, "");
  if (families.has(family)) continue;
  selected.push(r);
  families.add(family);
  if (selected.length === 24) break;
}
if (selected.length !== 24) throw Error(`Only ${selected.length} distinct subjects qualify.`);
const keep = new Set(selected.map((r) => r.id));
for (const r of subjects) {
  r.kept = keep.has(r.id);
  r.reason = r.kept
    ? "Clear subject at 330px; all five rendered links pass; highest worst-link detail with distinct subjects."
    : !r.rasterEligible
      ? "Production layout scan failure."
      : !r.browserEligible
        ? "Rendered link scan failure."
        : !r.visualPass
          ? visual[r.id]?.reason || "Subject not clear enough at phone size."
          : "Lower worst-link detail score or a repeated subject.";
  if (r.kept) {
    const destination = `assets/toys/qr-picture/codex/${r.id}.jpg`;
    if (r.file !== destination) fs.copyFileSync(r.file, destination);
    r.file = destination;
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
