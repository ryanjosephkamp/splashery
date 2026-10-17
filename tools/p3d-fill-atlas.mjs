// MIT; made by Ryan with Codex (GPT-6). Paired, resumable full-atlas measurements.
// Raw rasters and per-pose records stay in .cache or the separate evidence branch.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { inventory, hash } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { POSES } from "./p3df/scoring.mjs";
import { measureHardEdge as measureNext } from "./p3d-hard-edge-browser.mjs";
import { median } from "./p3d-next-score.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const root = path.resolve(args.root || ".cache/photo-3d-fill"),
  out = path.resolve(args.out || path.join(root, "atlas")),
  profiles = (args.profiles || "phone,desktop").split(","),
  atlas = JSON.parse(fs.readFileSync(path.join(root, "atlas.json"))),
  all = [...inventory(), ...inventory({ manifest: path.join(root, "extra-manifest.json") })],
  selected = args.samples ? args.samples.split(",") : atlas.inputs.map((r) => r.id),
  entries = selected.map((id) => all.find((e) => e.id === id));
if (
  !atlas.complete ||
  atlas.inputs.length !== 118 ||
  entries.some((e) => !e) ||
  new Set(selected).size !== selected.length ||
  profiles.some((p) => !["phone", "desktop"].includes(p)) ||
  new Set(profiles).size !== profiles.length
)
  throw new Error("Need unique atlas inputs and phone/desktop profiles");
for (const entry of entries) {
  const old = atlas.inputs.find((r) => r.id === entry.id);
  if (
    !old ||
    old.sha256 !== entry.sha256 ||
    old.depthSha256 !== entry.depthSha256 ||
    old.truthSha256 !== entry.truthSha256
  )
    throw new Error("Atlas input identity changed: " + entry.id);
}
const sources = [
  "tools/p3d-fill-atlas.mjs",
  "tools/p3d-next-browser.mjs",
  "tools/p3df/browser.mjs",
  "tools/p3df/scoring.mjs",
  "tools/p3df/cohorts.mjs",
  "tools/p3df/artifacts.mjs",
  "tools/cdx-p3d5-fast-metrics.mjs",
  "tools/cdx-p3d2-r3-common.mjs",
  "tools/cdx-p3d2-r3-anchored.mjs",
  "playwright.config.mjs",
  ...Object.keys(atlas.source.files).filter((f) => fs.existsSync(f)),
  "src/photo3d/next/fill.js",
  "src/photo3d/next/patchmatch.js",
  "src/photo3d/next/hard-edge.js",
  "src/photo3d/next/relief.js",
  "tools/p3d-hard-edge-browser.mjs",
];
const importFile = path.join(out, "imported-classic.json"),
  importedClassic = fs.existsSync(importFile) ? JSON.parse(fs.readFileSync(importFile)) : null;
if (importedClassic)
  for (const [file, digest] of Object.entries(importedClassic.sharedSources))
    if (hash(fs.readFileSync(file)) !== digest)
      throw new Error("Imported Classic runtime changed: " + file);
const settings = {
  method: "layered-h-classic-foreground-v1",
  importedClassic,
  sources: Object.fromEntries(
    [...new Set(sources)].sort().map((f) => [f, hash(fs.readFileSync(f))]),
  ),
  atlasSha256: hash(fs.readFileSync(path.join(root, "atlas.json"))),
  gl: process.env.SPLASHERY_GL || "swiftshader",
  profiles,
  poses: POSES,
  depth: 0.5,
  methods: ["classic", "fill"],
  inputs: entries.map((e) => ({
    id: e.id,
    photo: e.sha256,
    depth: e.depthSha256 || null,
    truth: e.truthSha256 || null,
  })),
};
fs.mkdirSync(out, { recursive: true });
const guard = path.join(out, "settings.json");
if (
  fs.existsSync(guard) &&
  JSON.stringify(JSON.parse(fs.readFileSync(guard))) !== JSON.stringify(settings)
)
  throw new Error("Capture settings or source changed; use a fresh output folder");
fs.writeFileSync(guard, JSON.stringify(settings, null, 2));
const result = { complete: false, startedUTC: new Date().toISOString(), settings, rows: [] },
  save = () => fs.writeFileSync(path.join(out, "capture.json"), JSON.stringify(result)),
  server = await localServer(entries);
try {
  for (const [index, entry] of entries.entries())
    for (const profile of profiles) {
      const probeBytes = fs.readFileSync(
          path.join(root, "probes", `${entry.id}-${profile}-anchors.json.gz`),
        ),
        frozen = JSON.parse(zlib.gunzipSync(probeBytes)),
        probeSha256 = hash(probeBytes);
      // Rotate method order. Cost acceptance still uses independent repeated trials.
      for (const candidate of index % 2 ? ["fill", "classic"] : ["classic", "fill"]) {
        const folder = path.join(out, candidate);
        fs.mkdirSync(folder, { recursive: true });
        const file = path.join(folder, `${entry.id}-${profile}.json`);
        const imported = importedClassic?.rows[path.basename(file)];
        if (candidate === "classic" && imported && hash(fs.readFileSync(file)) !== imported)
          throw new Error("Imported Classic metadata changed");
        const row = fs.existsSync(file)
          ? JSON.parse(fs.readFileSync(file))
          : {
              id: entry.id,
              profile,
              candidate,
              photoHash: entry.sha256,
              probeSha256,
              observation: await measureNext(entry, profile, {
                server,
                out: folder,
                poses: POSES,
                depth: 0.5,
                diagnostics: true,
                frozen,
                candidate,
              }),
            };
        if (
          row.id !== entry.id ||
          row.profile !== profile ||
          row.candidate !== candidate ||
          row.photoHash !== entry.sha256 ||
          row.probeSha256 !== probeSha256
        )
          throw new Error("Cached identity changed");
        const o = row.observation;
        if (
          o.errors.length ||
          o.externalRequests.length ||
          o.rows.length !== 9 ||
          o.targetCameras.length !== 9
        )
          throw new Error("Incomplete or invalid capture");
        for (const frame of o.rows)
          for (const [name, digest] of Object.entries(frame.artifacts))
            if (hash(fs.readFileSync(path.join(folder, name))) !== digest)
              throw new Error("Cached artifact changed: " + name);
        fs.writeFileSync(file, JSON.stringify(row));
        result.rows.push(row);
        save();
        console.log(
          entry.id,
          profile,
          candidate,
          JSON.stringify(o.values),
          new Date().toISOString(),
        );
      }
    }
  for (const [file, digest] of Object.entries(settings.sources))
    if (hash(fs.readFileSync(file)) !== digest)
      throw new Error("A capture source changed: " + file);
  result.scopeComplete = entries.length === 118 && result.rows.length === 236 * profiles.length;
  result.complete = result.scopeComplete && profiles.length === 2;
  result.finishedUTC = new Date().toISOString();
  result.summary = profiles.map((profile) => {
    const pairs = entries.map(({ id }) => {
      const base = result.rows.find(
          (r) => r.id === id && r.profile === profile && r.candidate === "classic",
        ).observation,
        value = result.rows.find(
          (r) => r.id === id && r.profile === profile && r.candidate === "fill",
        ).observation;
      if (JSON.stringify(base.targetCameras) !== JSON.stringify(value.targetCameras))
        throw new Error("Unpaired cameras");
      return {
        id,
        classic: base.values,
        fill: value.values,
        extraThinLosses: base.rows.flatMap((b, i) => {
          const v = value.rows[i];
          if (b.yaw !== v.yaw || b.pitch !== v.pitch || b.fringe.evaluated !== v.fringe.evaluated)
            throw new Error("Thin support differs");
          return v.fringe.missing > b.fringe.missing
            ? [{ yaw: b.yaw, pitch: b.pitch, extra: v.fringe.missing - b.fringe.missing }]
            : [];
        }),
      };
    });
    const supported = pairs.filter(
        (r) => Number.isFinite(r.classic.streaks) && Number.isFinite(r.fill.streaks),
      ),
      base = median(supported.map((r) => r.classic.streaks)),
      value = median(supported.map((r) => r.fill.streaks));
    return {
      profile,
      inputs: pairs.length,
      ribbonSupport: supported.length,
      classicStreaks: base,
      fillStreaks: value,
      medianStreakGain: base > 0 ? 1 - value / base : null,
      atLeast60Percent: supported
        .filter((r) => r.fill.streaks <= 0.4 * r.classic.streaks)
        .map((r) => r.id),
      unsupported: pairs
        .filter((r) => !Number.isFinite(r.classic.streaks) || !Number.isFinite(r.fill.streaks))
        .map((r) => r.id),
      extraThinLosses: pairs
        .filter((r) => r.extraThinLosses.length)
        .map((r) => ({ id: r.id, losses: r.extraThinLosses })),
      medianFirst3dRatio: median(pairs.map((r) => r.fill.speed / r.classic.speed)),
      pairs,
    };
  });
} finally {
  save();
  await server.close();
}
