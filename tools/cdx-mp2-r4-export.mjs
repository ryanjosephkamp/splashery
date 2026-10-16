// Copy only review deliverables to the separate, never-merged clips worktree.
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { option } from "./cdx-mp2-r4-harness.mjs";

const out = option("out", "work/r4-clips");
const groups = [
  ["quality", "work/r4-final-movies", "Source-clock picture comparisons: main and round 4"],
  ["round-3", "work/r4-r3-movies", "Source-clock picture comparisons: round 3 and round 4"],
  ["live-r3", "work/r4-live-r3", "Round 3 live presentations"],
  ["live-r4", "work/r4-live-r4", "Round 4 live presentations"],
  ["live-pairs", "work/r4-live-pairs", "Live presentations side by side"],
];
const shortTitles = {
  quality: "Main / round 4 quality",
  "round-3": "Round 3 / round 4 quality",
  "live-r3": "Round 3 live",
  "live-r4": "Round 4 live",
  "live-pairs": "Live comparisons",
};
const manifest = { exportedAt: new Date().toISOString(), groups: [], ledgers: [] },
  sections = [],
  galleries = [];
const escape = (value) =>
  String(value || "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
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
  const declared = new Map(
    records
      .flatMap((row) => [...(row.outputs || []), ...(row.files || []), row.poster, row.output])
      .filter((entry) => entry && typeof entry === "object" && entry.file)
      .map((entry) => [entry.file, entry]),
  );
  for (const file of await fs.readdir(folder))
    if (/\.(mp4|jpg)$/.test(file) && !accepted.has(file)) await fs.unlink(path.join(folder, file));
  for (const file of publicFiles) {
    if (!accepted.has(file)) continue;
    const bytes = await fs.readFile(path.join(root, file)),
      expected = declared.get(file);
    if (file.endsWith(".mp4") && !expected?.sha256)
      throw Error(`Movie has no recorded hash: ${file}`);
    if (expected?.sha256 && createHash("sha256").update(bytes).digest("hex") !== expected.sha256)
      throw Error(`Review file changed after validation: ${file}`);
    await fs.copyFile(path.join(root, file), path.join(folder, file));
    if (file.endsWith(".jpg") && (await fs.stat(path.join(folder, file))).size > 1000000)
      throw Error(`Image exceeds 1 MB: ${file}`);
  }
  await fs.copyFile(path.join(root, "manifest.json"), path.join(folder, "manifest.json"));
  for (const file of ["index.html", "README.md"])
    if (await fs.stat(path.join(root, file)).catch(() => null))
      await fs.copyFile(path.join(root, file), path.join(folder, file));
  const movies = publicFiles.filter((file) => accepted.has(file) && file.endsWith(".mp4"));
  manifest.groups.push({ directory: name, title, cases: records.length, movies });
  galleries.push(
    `<section id="${name}"><h2>${escape(shortTitles[name])}</h2><details><summary>Recording details</summary><p>${escape(data.note || data.protocol)}</p></details>${records
      .map((row) => {
        const output =
            (row.outputs || []).find((entry) => entry.file.endsWith("side-by-side.mp4")) ||
            row.output,
          poster =
            typeof row.poster === "string" ? row.poster : row.poster?.file || row.output?.poster,
          individual = (row.outputs || []).filter(
            (entry) => !entry.file.endsWith("side-by-side.mp4"),
          );
        if (!output) return "";
        return `<article><h3>${escape(row.title || row.id)}</h3><video controls preload="none" ${poster ? `poster="${name}/${escape(poster)}"` : ""} src="${name}/${escape(output.file)}"></video><p>${individual.map((entry) => `<a href="${name}/${escape(entry.file)}">${escape(entry.file)} · 390 × 844</a>`).join(" · ")}</p><p>${escape(row.author)} · <a href="${escape(row.licenseUrl)}">${escape(row.license)}</a> · <a href="${escape(row.sourcePage)}">Source</a></p></article>`;
      })
      .join("\n")}</section>`,
  );
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
  "r4-quality-source.json",
  "r4-source-validation-map.json",
  "r4-input-transform-flags.json",
  "r4-orientation-copy-probe.json",
  "r4-worker-transform-before-after.json",
  "r4-rotated-container-probe.json",
  "r4-node22-runtime.json",
  "r4-publication.json",
  "r4-measurements.md",
  "r4-test-ledger.json",
  "r4-test-ledger.md",
  "r4-phone-main.json",
  "r4-phone-r3.json",
  "r4-phone-r4.json",
  "r4-phone-main-repeat2.json",
  "r4-phone-r4-repeat2.json",
  "r4-phone-main-repeat3.json",
  "r4-phone-r4-repeat3.json",
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
manifest.traces = [];
for (const file of await fs.readdir("work")) {
  if (!/^r4-final-r[34]-cpu\.json\.(sample|machine-long)\.(trace\.json|cpuprofile)$/.test(file))
    continue;
  const bytes = await fs.readFile(path.join("work", file)),
    compressed = gzipSync(bytes),
    target = file + ".gz";
  await fs.writeFile(path.join(out, "ledgers", target), compressed);
  const sha = (value) => createHash("sha256").update(value).digest("hex");
  manifest.traces.push({
    file: target,
    bytes: compressed.length,
    sha256: sha(compressed),
    uncompressedBytes: bytes.length,
    uncompressedSha256: sha(bytes),
  });
}
await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(
  path.join(out, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moving photo round 4 evidence</title><style>body{max-width:850px;margin:24px auto;padding:0 16px;font:16px/1.5 system-ui;background:#f0f3f8;color:#111827}video{width:100%;max-width:780px;height:auto}article{margin:36px 0}a{color:#1545a4}h1{font-size:28px;line-height:1.2}h2{font-size:24px}h3{font-size:20px}nav{display:flex;gap:16px;flex-wrap:wrap}</style><h1>Moving photo: round 4</h1><p>Quality clips use source timing. Live clips show captured presentations, with recording overhead. All films are silent.</p><p>390 × 844 per movie · 780 × 844 paired</p><p><a href="README.md">Notes</a> · <a href="manifest.json">Data</a> · <a href="https://github.com/ryanjosephkamp/splashery/pull/677">Draft PR #677</a></p><nav>${manifest.groups.map((group) => `<a href="#${group.directory}">${escape(shortTitles[group.directory])}</a>`).join(" ")}</nav>${galleries.join("\n")}<footer><p>Original film licenses remain attached to each rendering. Capture contributions made by Ryan with Codex (GPT-6).</p></footer></html>\n`,
);
await fs.writeFile(
  path.join(out, "README.md"),
  `# Moving photo to 3D: round 4 evidence\n
Made by Ryan with Codex (GPT-6), October 16, 2026. This is the separate
\`codex/moving-photo-r4-clips\` branch. **Never merge it into main.**

The implementation and honest Goal status are in [draft PR #677](https://github.com/ryanjosephkamp/splashery/pull/677),
which replaces [round 3, PR #560](https://github.com/ryanjosephkamp/splashery/pull/560).

Download this branch as a ZIP, extract it, and open [the local gallery](index.html) to play the films.

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

Native traces and CPU profiles are gzip-compressed, with both compressed and original hashes in
the root manifest. Decompress them before loading them in a trace or CPU-profile viewer.
${manifest.traces.map((row) => `- [${row.file}](ledgers/${row.file})`).join("\n")}

Incomplete measurements remain explicitly incomplete. Earlier failures are preserved in the test
ledger; latest whole-file reruns do not erase them. These are Chromium software-rendered phone
emulations, not tests on a physical Android phone or Brave.\n`,
);
console.log(JSON.stringify(manifest.groups));
