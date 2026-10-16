// Copy only review deliverables to the separate, never-merged clips worktree.
import fs from "node:fs/promises";
import path from "node:path";
import { option } from "./cdx-mp2-r4-harness.mjs";

const out = option("out", "work/r4-clips");
const groups = [
  ["quality", "work/r4-final-movies", "Source-clock picture comparisons: main and round 4"],
  ["round-3", "work/r4-r3-movies", "Source-clock picture comparisons: round 3 and round 4"],
  ["live-r3", "work/r4-live-r3", "Round 3 live presentations"],
  ["live-r4", "work/r4-live-r4", "Round 4 live presentations"],
  ["live-pairs", "work/r4-live-pairs", "Live presentations side by side"],
];
const manifest = { exportedAt: new Date().toISOString(), groups: [], ledgers: [] },
  sections = [];
await fs.mkdir(out, { recursive: true });
for (const [name, root, title] of groups) {
  const bytes = await fs.readFile(path.join(root, "manifest.json")).catch(() => null);
  if (!bytes) continue;
  const data = JSON.parse(bytes),
    records = data.clips || data.cases || [],
    folder = path.join(out, name);
  await fs.mkdir(folder, { recursive: true });
  const publicFiles = (await fs.readdir(root)).filter((file) => /\.(mp4|jpg)$/.test(file));
  // A failed or superseded encode must not leave an unreferenced public movie.
  const accepted = new Set(
    records
      .flatMap((row) => [
        ...(row.outputs || []).map((file) => (typeof file === "string" ? file : file.file)),
        ...(row.files || []).map((file) => (typeof file === "string" ? file : file.file)),
        typeof row.poster === "string" ? row.poster : row.poster?.file,
        row.output?.file,
        row.output?.poster,
      ])
      .filter(Boolean),
  );
  for (const file of await fs.readdir(folder))
    if (/\.(mp4|jpg)$/.test(file) && !accepted.has(file)) await fs.unlink(path.join(folder, file));
  for (const file of publicFiles) {
    if (!accepted.has(file)) continue;
    await fs.copyFile(path.join(root, file), path.join(folder, file));
    if (file.endsWith(".jpg") && (await fs.stat(path.join(folder, file))).size > 1000000)
      throw Error(`Image exceeds 1 MB: ${file}`);
  }
  await fs.copyFile(path.join(root, "manifest.json"), path.join(folder, "manifest.json"));
  const movies = publicFiles.filter((file) => accepted.has(file) && file.endsWith(".mp4"));
  manifest.groups.push({ directory: name, title, cases: records.length, movies });
  const posters = records.flatMap((row) => {
    const poster =
        typeof row.poster === "string" ? row.poster : row.poster?.file || row.output?.poster,
      pair =
        (row.outputs || []).find((output) => output.file.endsWith("side-by-side.mp4"))?.file ||
        row.output?.file;
    return poster && pair
      ? [`[![${row.title || row.id}](${name}/${poster})](${name}/${pair})`]
      : [];
  });
  sections.push(
    `## ${title}\n\n${data.note || data.protocol || ""}\n\n` +
      posters.join("\n\n") +
      "\n\n" +
      movies.map((file) => `- [${file}](${name}/${file})`).join("\n") +
      `\n\n[Credits, source hashes, timestamps, and transformations](${name}/manifest.json).\n`,
  );
}
const ledgers = [
  "r4-main-final-quality.json",
  "r4-final-quality.json",
  "r4-r3-final-quality.json",
  "r4-final-source.json",
  "r4-test-ledger.json",
  "r4-test-ledger.md",
  "r4-phone-main.json",
  "r4-phone-r3.json",
  "r4-phone-r4.json",
  "r4-startup-main.json",
  "r4-startup-r4.json",
  "r4-final-r3-cpu.json",
  "r4-final-r4-cpu.json",
];
await fs.mkdir(path.join(out, "ledgers"), { recursive: true });
for (const file of ledgers) {
  const bytes = await fs.readFile(path.join("work", file)).catch(() => null);
  if (!bytes) continue;
  await fs.writeFile(path.join(out, "ledgers", file), bytes);
  manifest.ledgers.push(file);
}
await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(
  path.join(out, "README.md"),
  `# Moving photo to 3D: round 4 evidence\n
Made by Ryan with Codex (GPT-6), October 16, 2026. This is the separate
\`codex/moving-photo-r4-clips\` branch. **Never merge it into main.**

The implementation and honest Goal status are in the draft PR replacing
[round 3, PR #560](https://github.com/ryanjosephkamp/splashery/pull/560).

Source-clock films use every original source frame and its original hold duration. They show
picture quality, not live frame rate. Individual phone cards are 390 × 844; paired films are
780 × 844. Silent live recordings retain actual CDP presentation times, with capture overhead.
Their paired exports duplicate held pictures at 60 fps without interpolation; exact VFR recordings
remain available separately. Clean cadence and startup have separate isolated ledgers.

Original procedural inputs are CC0 1.0. Existing films and renderings keep their specific CC BY
licenses, authors, and source pages in each manifest and on each film. No blanket relicensing of
the film content is intended. Export code is MIT. All supplied poster images are below 1 MB.

${sections.join("\n")}
## Measurement ledgers\n\n${manifest.ledgers.map((file) => `- [${file}](ledgers/${file})`).join("\n")}

Incomplete measurements remain explicitly incomplete. Earlier failures are preserved in the test
ledger; latest whole-file reruns do not erase them. These are Chromium software-rendered phone
emulations, not tests on a physical Android phone or Brave.\n`,
);
console.log(JSON.stringify(manifest.groups));
