// Copy completed public audit evidence into the separate, never-merged review branch.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { inputs } from "./cdx-p3d2-r3-common.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const cache = opt("cache", ".cache/cdx-p3d2/r3");
const finalDest = path.resolve(
  opt("dest", "/workspace/splashery-r3-clips/docs/audits/photo-3d-r3"),
);
const read = (f) => JSON.parse(fs.readFileSync(f));
const builds = read(path.join(cache, "builds.json"));
const publication = fs.existsSync(path.join(cache, "publication-provenance.json"))
  ? read(path.join(cache, "publication-provenance.json"))
  : null;
const publicRenderer = publication?.equivalents.find(
  (r) => r.measuredLocalCommit === builds.after.commit,
)?.publicCommit;
const sameBuild = (a, b) =>
  !!(
    a &&
    b &&
    a.commit === b.commit &&
    JSON.stringify(Object.entries(a.files || {}).sort()) ===
      JSON.stringify(Object.entries(b.files || {}).sort())
  );
const clipLocations = new Map();
const captureManifests = [];
const clips = { builds: { before: builds.before, after: builds.after }, rows: [] };
for (const dir of opt("clip-dirs", "clips,clips-six,clips-warmed").split(",")) {
  const file = path.join(cache, dir, "clips.json");
  if (!fs.existsSync(file)) continue;
  const manifest = read(file);
  if (
    !sameBuild(manifest.builds.before, builds.before) ||
    !sameBuild(manifest.builds.after, builds.after)
  )
    throw new Error(`The clips do not match the recorded final builds: ${dir}`);
  captureManifests.push({ dir, file, manifest });
  for (const row of manifest.rows) {
    if (clipLocations.has(row.file)) throw new Error(`Duplicate review clip: ${row.file}`);
    clipLocations.set(row.file, path.join(cache, dir, row.file));
    clips.rows.push({ ...row, captureManifest: `capture-manifests/${dir}.json` });
  }
}
const selected = inputs();
const requiredViews = opt("required-views", "sharp").split(",");
const missing = selected.flatMap((s) =>
  ["sharp", "splats"]
    .filter((view) => !clips.rows.some((r) => r.id === s.id && r.view === view))
    .map((view) => `${s.id}/${view}`),
);
const requiredMissing = missing.filter((key) => requiredViews.includes(key.split("/").at(-1)));
if (requiredMissing.length && opt("partial", "false") !== "true")
  throw new Error(`Required review clips are incomplete (${requiredMissing.length} missing).`);
for (const [dir, expected] of [
  ["sweep-before", builds.before],
  ["sweep-after", builds.after],
  ["sweep-after-desktop", builds.after],
]) {
  const settings = path.join(cache, dir, "settings.json");
  if (fs.existsSync(settings) && !sameBuild(read(settings).build, expected))
    throw new Error(`Stale sweep build: ${dir}`);
}
for (const [file, expected] of [
  ["frame-main-all-phone.json", builds.main],
  ["frame-after-all-phone.json", builds.after],
])
  if (
    fs.existsSync(path.join(cache, file)) &&
    !sameBuild(read(path.join(cache, file)).build, expected)
  )
    throw new Error(`Stale timing build: ${file}`);
const anchorSettings = path.join(cache, "anchored-sweep/settings.json");
if (
  fs.existsSync(anchorSettings) &&
  (!sameBuild(read(anchorSettings).before, builds.before) ||
    !sameBuild(read(anchorSettings).after, builds.after))
)
  throw new Error("Stale anchored audit builds.");
fs.mkdirSync(path.dirname(finalDest), { recursive: true });
const dest = fs.mkdtempSync(path.join(path.dirname(finalDest), ".photo-3d-r3-stage-"));
fs.mkdirSync(dest, { recursive: true });
const copy = (from, relative) => {
  const to = path.join(dest, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
copy(path.join(cache, "builds.json"), "builds.json");
const licenses = fs.readFileSync("LICENSES.md", "utf8");
const notices = licenses.slice(licenses.indexOf("## Photo to 3D round 3 test tools"));
if (!notices.startsWith("## Photo to 3D round 3 test tools"))
  throw new Error("The actual round-3 test-tool notices are missing.");
fs.writeFileSync(path.join(dest, "TEST-TOOLS-LICENSES.md"), notices);
for (const { dir, file, manifest } of captureManifests) {
  copy(file, `capture-manifests/${dir}.json`);
  const digest = crypto.createHash("sha256");
  for (const name of ["cdx-p3d2-r3-common.mjs", "cdx-p3d2-r3-clips.mjs"]) {
    const source = path.join(cache, dir, "method-source", name);
    digest.update(fs.readFileSync(source));
    copy(source, `capture-methods/${dir}/${name}`);
  }
  if (digest.digest("hex") !== manifest.methodHash)
    throw new Error(`Archived clip method does not match the executed method: ${dir}`);
}
for (const r of clips.rows) {
  const file = clipLocations.get(r.file);
  if (!fs.existsSync(file)) throw new Error(`Missing completed clip: ${r.file}`);
  copy(file, `clips/${r.file}`);
}
fs.writeFileSync(path.join(dest, "clips.json"), JSON.stringify(clips, null, 2) + "\n");
const sources = read(path.join(cache, "sources/manifest.json"));
const publicSources = sources.map((s) => {
  const file = `sources/${path.basename(s.file)}`;
  const depthFile = `sources/${path.basename(s.depthFile)}`;
  for (const [from, relative] of [
    [s.file, file],
    [s.depthFile, depthFile],
  ])
    copy(from, relative);
  if (
    s.sha256 &&
    crypto.createHash("sha256").update(fs.readFileSync(s.file)).digest("hex") !== s.sha256
  )
    throw new Error(`Source hash changed: ${s.id}`);
  return {
    ...s,
    file,
    depthFile,
    depthSha256: crypto.createHash("sha256").update(fs.readFileSync(s.depthFile)).digest("hex"),
    ...(s.file.endsWith(".gif") ? { derivativeMadeBy: "Ryan with Codex (GPT-6)" } : {}),
  };
});
fs.writeFileSync(
  path.join(dest, "sources/manifest.json"),
  JSON.stringify(publicSources, null, 2) + "\n",
);
const credits = [
  "# Round 3 review credits",
  "",
  "Code and archived capture-tool sources made by Ryan with Codex (GPT-6), offered under Splashery's MIT license. Paired review clips and the GIF conversion work were made by Ryan with Codex (GPT-6), CC0 1.0. The original photos and their derivatives retain their source licenses. No Chromium, Xvfb, FFmpeg or other outside program is shipped in this folder.",
  "The actual test-tool notices are retained in [TEST-TOOLS-LICENSES.md](TEST-TOOLS-LICENSES.md).",
  "",
  "The 36 unchanged built-in Photo to 3D inputs retain their existing records in [Splashery's credits](../../../CREDITS.md). AI-made Studio inputs are labeled in the review clips. The additional public inputs are listed below; [the manifest](sources/manifest.json) also records hashes, conversion details and the unchanged-model depth inference.",
  "",
  "| Input | Source author | Live source | License | Checked |",
  "| --- | --- | --- | --- | --- |",
  ...publicSources.map(
    (s) => `| ${s.id} | ${s.author} | [source](${s.source}) | ${s.license} | ${s.checked} |`,
  ),
];
fs.writeFileSync(path.join(dest, "CREDITS.md"), credits.join("\n") + "\n");
for (const dir of ["sweep-before", "sweep-after", "sweep-after-desktop", "anchored-sweep"]) {
  const from = path.join(cache, dir);
  if (!fs.existsSync(from)) continue;
  for (const name of fs.readdirSync(from)) {
    if (!/\.(json|png)$/.test(name) || !fs.statSync(path.join(from, name)).isFile()) continue;
    // A stopped group can have a provisional image before its pose rows commit.
    if (dir.startsWith("sweep-") && name.endsWith(".png")) {
      const group = name.replace(/-worst-(?:halo|hole)\.png$/, ".json");
      if (!fs.existsSync(path.join(from, group))) continue;
    }
    copy(path.join(from, name), `${dir}/${name}`);
    // Gallery paths remain stable; desktop phase images keep their own raw archive too.
    if (dir === "sweep-after-desktop" && name.endsWith(".png")) {
      if (fs.existsSync(path.join(dest, "sweep-after", name)))
        throw new Error(`Conflicting target phase gallery image: ${name}`);
      copy(path.join(from, name), `sweep-after/${name}`);
    }
  }
  const anchors = path.join(from, "anchors");
  if (dir === "anchored-sweep" && fs.existsSync(anchors))
    for (const name of fs.readdirSync(anchors))
      if (name.endsWith(".json")) copy(path.join(anchors, name), `${dir}/anchors/${name}`);
}
for (const name of [
  "summary.json",
  "summary.md",
  "frame-main-all-phone.json",
  "frame-after-all-phone.json",
  "raw-video-handoff-proof.json",
  "capture-activation-proof.json",
  "capture-check.json",
  "clip-archive-rejection-proof.json",
  "input-warning-proof.json",
  "controls-proof.json",
  "compact-pixels.json",
  "profile-main-street.json",
  "profile-compact-street.json",
  "text-final.json",
  "verification.json",
  "delivery-checks.json",
  "baseline-desktop-pause.json",
  "target-phone-complete.json",
  "goal-status-final-prepared.md",
  "publication-provenance.json",
  "bounded-stop.json",
])
  if (fs.existsSync(path.join(cache, name))) copy(path.join(cache, name), name);
for (const round of [1, 2])
  for (const build of ["main", "after"]) {
    const name = `frame-retake-${round}-${build}.json`;
    const file = path.join(cache, name);
    if (!fs.existsSync(file)) continue;
    if (!sameBuild(read(file).build, builds[build]))
      throw new Error(`Stale timing retake: ${name}`);
    copy(file, name);
  }
for (const backend of ["webgl2", "webgpu"]) {
  const dir = `text-final-${backend}`;
  const from = path.join(cache, dir);
  if (!fs.existsSync(from)) continue;
  for (const name of fs.readdirSync(from))
    if (/\.(json|png)$/.test(name)) copy(path.join(from, name), `${dir}/${name}`);
}
for (const dir of ["full-suite", "full-suite-rechecks"])
  if (fs.existsSync(path.join(cache, dir, "run-metadata.json")))
    copy(path.join(cache, dir, "run-metadata.json"), `${dir}-metadata.json`);
if (fs.existsSync(path.join(cache, "full-suite/supplemental-metadata.json")))
  copy(
    path.join(cache, "full-suite/supplemental-metadata.json"),
    "full-suite-supplemental-metadata.json",
  );
if (fs.existsSync(path.join(cache, "hole-debug-lighthouse/result.json"))) {
  copy(path.join(cache, "hole-debug-lighthouse/result.json"), "hole-debug-lighthouse/result.json");
  copy(path.join(cache, "hole-debug-lighthouse/frame.png"), "hole-debug-lighthouse/frame.png");
}
const link = (file, label) =>
  fs.existsSync(path.join(dest, file)) ? `[${label}](${file})` : "pending";
const lines = [
  "# Photo to 3D round 3 review media",
  "",
  "Made by Ryan with Codex (GPT-6). Original review assets are CC0; code is under Splashery's MIT license. Source photos and their GIF derivatives retain the source licenses and credits in [the source manifest](sources/manifest.json). AI-made Studio samples are labeled in each clip.",
  "",
  `Before: \`${builds.before.commit}\`. Round 3 renderer: \`${builds.after.commit}\`. Main comparison: \`${builds.main.commit}\`. See [source hashes](builds.json).`,
  ...(publication
    ? [
        "",
        `GitHub rejected the original private-email push. Original local commits and raw measured identities remain intact; newly packaged no-reply commits preserve the public PR ancestry. The public renderer equivalent is \`${publicRenderer}\`. Its entire tracked tree matches the actual measured local renderer tree, with the nine renderer hashes and separate UI hashes checked in [publication-provenance.json](publication-provenance.json). Measurements ran on the original checkout, not on the new publication commit. No existing remote history was rewritten.`,
      ]
    : []),
  "",
  "Each completed MP4 has two 390×844 halves: the previous PR head on the left and round 3 on the right. The actual phone profile is 390×844 at device scale factor 3, with the existing low-profile drawing buffer of 585×1266. Review export reduces each half to phone size. Clips sweep yaw and pitch through ±30° at depth 1. GIF inputs exercise the app's first-frame photo decode; these are not moving-photo clips.",
  `Sharp sampling rates: ${[...new Set(clips.rows.filter((r) => r.view === "sharp").map((r) => `${r.frames} captured poses at ${r.fps} fps`))].join("; ") || "pending"}. Each clip's counts and original capture-method hash are in clips.json and its linked capture manifest. Playback rate is a review choice, not a physical-device frame-rate measurement. Every yaw/pitch extreme reaches 30 degrees. The encoder receives lossless raw RGBA; the retained handoff check matches the former PNG input pixel for pixel.`,
  "",
  `Required clips complete: ${selected.length * requiredViews.length - requiredMissing.length}/${selected.length * requiredViews.length} (${requiredViews.join(", ")}). Optional Fine Splats clips complete: ${clips.rows.filter((r) => r.view === "splats").length}/${selected.length}. ${missing.length ? `Missing clips: ${missing.join(", ")}.` : "Every input has Sharp and Fine Splats clips."}`,
  "",
  "| Input | Sharp (required) | Fine Splats (hybrid, optional) | Phone worst halo, before / after | Desktop worst halo, before / after |",
  "| --- | --- | --- | --- | --- |",
];
for (const s of selected) {
  const imagePair = (screen) =>
    ["before", "after"]
      .map((build) => link(`sweep-${build}/${screen}-${s.id}-worst-halo.png`, build))
      .join(" / ");
  lines.push(
    `| ${s.id} | ${link(`clips/${s.id}-sharp-before-after.mp4`, "clip")} | ${link(`clips/${s.id}-splats-before-after.mp4`, "clip")} | ${imagePair("phone")} | ${imagePair("desktop")} |`,
  );
}
lines.push(
  "",
  "## Measurements and limits",
  "",
  "[Retained pose and spec counts](summary.md) report each worst pose, including incomplete coverage. The source-color transport diagnostic detects filtering errors around rendered depth cuts; it cannot prove correct hidden content or the absence of every geometric outline. The separate source-anchored audit uses stable color edges and an inferred depth-plane surrogate; its anchor coverage and missing crossings must be read with its scores. No inferred depth map is geometric ground truth.",
  "",
  "Sharp cadence measurements use WebGL2 completion fences, without screenshot readbacks in the timed interval. They include software-GPU scheduling overhead. Fine Splats and actual physical-phone smoothness have not been measured. Existing tests and thresholds are unchanged; initial failures and isolated rechecks are reported separately.",
  "",
  "## Reproduce",
  "",
  "Use the task branch's tools/cdx-p3d2-r3-*.mjs and the recorded immutable checkouts. Serve before on 4174, main on 4176, and the final renderer on 4177. Copy the public source files and depth fixtures into .cache/cdx-p3d2/r3/sources and restore the manifest's file/depthFile paths to that cache directory. Copy builds.json into the cache. Built-in sources remain the repository's unchanged samples. The source manifest records each live source page, author, license, hash and modification.",
  ...(publicRenderer
    ? [
        "",
        `For a public clone, check out renderer \`${publicRenderer}\` for port 4177 rather than the original local-only measured SHA. Before and main remain the public commits in builds.json. Keep the raw build records unchanged; the equivalence proof supplies the public checkout and verifies identical source bytes.`,
      ]
    : []),
  "",
  "The run used /usr/bin/chromium 151.0.7922.173, temporary Debian Xvfb 2:21.1.16-1.3+deb13u4 displays, and Mesa llvmpipe. The requested /opt/pw-browsers/chromium was absent. No Playwright browser download was installed. Set SPLASHERY_CHROMIUM=/usr/bin/chromium and SPLASHERY_GL=llvmpipe. Cadence jobs ran alone with LP_NUM_THREADS=2 and DISPLAY=:90. Target pose, anchored-edge and review-clip captures used LP_NUM_THREADS=1 on displays :90–:93; baseline pose captures used LP_NUM_THREADS=2 on :94. The first desktop target group used one thread; the resumed remaining desktop groups use two threads on :90, preserving completed groups and persistent console history. The target phone phase uses sweep-after; its original full-matrix worker is paused once all phone groups finish. The separate sweep-after-desktop phase uses the same method, inputs, views and capture policy. Reproduce both target profiles with the full-matrix command below, or capture desktop separately with the second command; do not duplicate desktop poses across phases. These software-GPU worker limits do not change image resolution or camera poses. Original clip-tool sources are retained under capture-methods/; their combined SHA-256 must match the linked capture manifest. Restore each cohort's two files into tools/ before reproducing its clip command.",
  "",
  "```sh",
  "node tools/cdx-p3d2-r3-measure.mjs --build=before --url=http://127.0.0.1:4174/ --depths=1 --views=sharp --diagonal=false --sharp-rest-frames=1 --resume=true --out=.cache/cdx-p3d2/r3/sweep-before",
  "node tools/cdx-p3d2-r3-measure.mjs --build=after --url=http://127.0.0.1:4177/ --depths=1 --diagonal=false --sharp-rest-frames=1 --resume=true --out=.cache/cdx-p3d2/r3/sweep-after",
  "# Alternative desktop phase while the original worker captures only phone groups:",
  "node tools/cdx-p3d2-r3-measure.mjs --build=after --url=http://127.0.0.1:4177/ --screens=desktop --depths=1 --diagonal=false --sharp-rest-frames=1 --resume=true --out=.cache/cdx-p3d2/r3/sweep-after-desktop",
  "node tools/cdx-p3d2-r3-anchor-sweep.mjs --before=http://127.0.0.1:4174/ --after=http://127.0.0.1:4177/ --depths=1 --out=.cache/cdx-p3d2/r3/anchored-sweep",
  "node tools/cdx-p3d2-r3-frame.mjs --build=main --url=http://127.0.0.1:4176/ --samples=all --screens=phone --out=.cache/cdx-p3d2/r3/frame-main-all-phone.json",
  "node tools/cdx-p3d2-r3-frame.mjs --build=after --url=http://127.0.0.1:4177/ --samples=all --screens=phone --out=.cache/cdx-p3d2/r3/frame-after-all-phone.json",
  ...captureManifests.flatMap(({ dir, manifest }) => {
    const row = manifest.rows[0];
    if (!row) return [];
    const samples = [...new Set(manifest.rows.map((r) => r.id))].join(",");
    const views = [...new Set(manifest.rows.map((r) => r.view))].join(",");
    const warmed = manifest.capturePolicy?.sharpRest;
    return [
      `# Restore the two archived files from capture-methods/${dir}/ into tools/ first.`,
      `node tools/cdx-p3d2-r3-clips.mjs --before=http://127.0.0.1:4174/ --after=http://127.0.0.1:4177/ --samples=${samples} --views=${views} --fps=${row.fps} --seconds=${row.frames / row.fps}${warmed ? ` --sharp-rest-frames=${warmed}` : ""} --out=.cache/cdx-p3d2/r3/${dir}`,
    ];
  }),
  "```",
);
fs.writeFileSync(path.join(dest, "README.md"), lines.join("\n") + "\n");
const previous = `${finalDest}.previous`;
fs.rmSync(previous, { recursive: true, force: true });
if (fs.existsSync(finalDest)) fs.renameSync(finalDest, previous);
fs.renameSync(dest, finalDest);
fs.rmSync(previous, { recursive: true, force: true });
console.log(`Published ${clips.rows.length} completed clips and public evidence to ${finalDest}`);
