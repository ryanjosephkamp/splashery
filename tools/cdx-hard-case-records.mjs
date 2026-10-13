// Task 57: add only this round's records to the shared registries.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { HARD_CASE_SAMPLES } from "../src/packs/hard-case-samples.js";
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const page = "https://github.com/ryanjosephkamp/splashery/blob/main/CREDITS.md";
const candidates = new Map(
  JSON.parse(fs.readFileSync("tools/cdx-hard-case-candidates.json", "utf8")).map((r) => [
    r.file,
    r,
  ]),
);
if (HARD_CASE_SAMPLES.length !== 20) throw Error("Select exactly 20 pictures first.");
const records = HARD_CASE_SAMPLES.map((s) => {
  const file = `assets/toys/photo-3d/hard-cases/${s.file}.jpg`;
  const depth = `assets/toys/photo-3d/hard-cases/${s.file}.depth`;
  return {
    id: s.id,
    file,
    depth,
    toy: "photo-3d",
    name: s.title,
    author: s.author,
    page,
    license: s.license,
    checked: "October 13, 2026",
    ai: true,
    prompt: s.prompt,
    category: s.category,
    sha256: hash(file),
    depthSha256: hash(depth),
    bytes: fs.statSync(file).size,
    depthBytes: fs.statSync(depth).size,
    dimensions: [1280, 853],
    nativeSha256: candidates.get(s.file).nativeSha256,
    note: "Made by Ryan with Codex (GPT-6) and the OpenAI native image tool under the owner's AI-made sample policy. Fictional scene; no people, text, logos, or real landmarks. Resized to 1,280 px wide, JPEG quality 82. Depth map made by the unchanged tools/dsm-depth.mjs (Depth Anything V2 Small). Generator model identity was not returned. Labeled AI-made beside it; used only as a Studio sample.",
  };
});
const registry = fs.readFileSync("tools/assets.json", "utf8");
const parsed = JSON.parse(registry);
if (parsed.photoSamples.some((r) => records.some((s) => s.id === r.id)))
  throw Error("Records already registered; refusing duplicates.");
const end = registry.indexOf("\n  ],", registry.indexOf('  "photoSamples": ['));
if (end < 0) throw Error("Could not find photoSamples closing bracket.");
const text = records
  .map((r) =>
    JSON.stringify(r, null, 2)
      .split("\n")
      .map((line) => "    " + line)
      .join("\n"),
  )
  .join(",\n");
fs.writeFileSync("tools/assets.json", registry.slice(0, end) + ",\n" + text + registry.slice(end));
const credits = [
  "\n## AI-made Studio samples: hard cases (Codex task 57)\n",
  "Made by Ryan with Codex (GPT-6) and the OpenAI native image tool, October 13, 2026. These 20 fictional pictures were selected from 40 original candidates measured in Photo to 3D. They use the existing **AI-made by the owner** credit, with that label beside each picture in the Hard cases picker group. The generator did not return its model identity. No people, text, logos, or real landmarks were seen. They are Studio samples, never real captures or real places, and never used for science, math, engineering, or photoreal shelves. Each JPEG is 1,280 px wide (quality 82); its depth map was made by the unchanged `tools/dsm-depth.mjs`. File hashes, prompts, scores, and selection decisions are in [the scored report](docs/audits/hard-case-samples-2026-10.md).\n",
  ...records.map(
    (r) =>
      `- ${HARD_CASE_SAMPLES.find((s) => s.id === r.id).label.replace(" (AI-made)", "")} (${r.prompt}): \`${r.file}\` (${r.category}).`,
  ),
  "",
];
if (fs.readFileSync("CREDITS.md", "utf8").includes("## AI-made Studio samples: hard cases"))
  throw Error("Credits already present.");
fs.appendFileSync("CREDITS.md", credits.join("\n"));
fs.writeFileSync(
  "docs/audits/hard-case-samples-2026-10/asset-records.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Added 20 asset records and credits without rewriting existing entries.");
