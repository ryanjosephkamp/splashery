// MIT; made by Ryan with Codex (GPT-6). Run alone: fresh browsers, paired phone inputs.
import fs from "node:fs";
import path from "node:path";
import { inventory, hash } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { measureNext } from "./p3d-next-browser.mjs";
import { median } from "./p3d-next-score.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const root = path.resolve(args.root || ".cache/photo-3d-fill"),
  out = path.resolve(args.out || path.join(root, "cost")),
  atlas = JSON.parse(fs.readFileSync(path.join(root, "atlas.json"))),
  all = [...inventory(), ...inventory({ manifest: path.join(root, "extra-manifest.json") })],
  ids = args.samples ? args.samples.split(",") : atlas.inputs.map((r) => r.id),
  entries = ids.map((id) => all.find((e) => e.id === id)),
  runs = Number(args.runs || 5);
if (
  entries.some((e) => !e) ||
  new Set(ids).size !== ids.length ||
  !Number.isInteger(runs) ||
  runs < 1
)
  throw new Error("Need unique atlas inputs and a positive run count");
for (const e of entries) {
  const prior = atlas.inputs.find((r) => r.id === e.id);
  if (
    prior?.sha256 !== e.sha256 ||
    prior.depthSha256 !== e.depthSha256 ||
    prior.truthSha256 !== e.truthSha256
  )
    throw new Error("Cost input changed: " + e.id);
}
fs.mkdirSync(out, { recursive: true });
const sources = [
    "tools/p3d-fill-cost.mjs",
    "tools/p3d-next-browser.mjs",
    "tools/p3df/browser.mjs",
    "src/photo3d/next/fill.js",
    "src/photo3d/next/patchmatch.js",
    "src/photo3d/build-worker.js",
    "src/packs/photo-3d.js",
    "src/packs/photo-3d-core.js",
    "src/live/relief-mesh.js",
    "src/depth/engine.js",
    "playwright.config.mjs",
  ],
  settings = {
    sources: Object.fromEntries(sources.map((f) => [f, hash(fs.readFileSync(f))])),
    gl: process.env.SPLASHERY_GL || "swiftshader",
    runs,
    inputs: entries.map((e) => ({ id: e.id, hash: e.sha256 })),
  },
  guard = path.join(out, "settings.json");
if (
  fs.existsSync(guard) &&
  JSON.stringify(JSON.parse(fs.readFileSync(guard))) !== JSON.stringify(settings)
)
  throw new Error("Cost source or settings changed; use a fresh folder");
fs.writeFileSync(guard, JSON.stringify(settings, null, 2));
const result = {
    complete: false,
    scope: "Uncontended Chromium phone profile; not physical phone measurements",
    settings,
    rows: [],
  },
  save = () => fs.writeFileSync(path.join(out, "cost.json"), JSON.stringify(result, null, 2)),
  server = await localServer(entries);
try {
  for (let trial = 0; trial < runs; trial++)
    for (const [index, entry] of entries.entries())
      for (const candidate of (index + trial) % 2 ? ["fill", "classic"] : ["classic", "fill"]) {
        const folder = path.join(out, `${trial}-${entry.id}-${candidate}`),
          file = path.join(folder, "observation.json");
        fs.mkdirSync(folder, { recursive: true });
        const o = fs.existsSync(file)
          ? JSON.parse(fs.readFileSync(file))
          : await measureNext(entry, "phone", {
              server,
              out: folder,
              poses: [[0, 0]],
              depth: 0.5,
              diagnostics: false,
              candidate,
            });
        if (
          o.errors.length ||
          o.externalRequests.length ||
          o.rows.length !== 1 ||
          o.timing.backgroundPending ||
          !Number.isFinite(o.timing.first3dMs) ||
          !Number.isFinite(o.memory.peakPssBytes) ||
          o.memory.peakPssBytes <= 0
        )
          throw new Error("Invalid first-frame observation");
        fs.writeFileSync(file, JSON.stringify(o));
        result.rows.push({
          id: entry.id,
          trial,
          candidate,
          photoHash: entry.sha256,
          first3dMs: o.timing.first3dMs,
          timingSource: o.timing.source,
          peakPssBytes: o.memory.peakPssBytes,
          renderer: o.renderer,
          browser: o.browser,
          overlayProof: o.overlayProof,
        });
        save();
        console.log(
          trial,
          entry.id,
          candidate,
          Math.round(o.timing.first3dMs),
          new Date().toISOString(),
        );
      }
  for (const [file, digest] of Object.entries(settings.sources))
    if (hash(fs.readFileSync(file)) !== digest) throw new Error("A timing source changed: " + file);
  result.complete = ids.length === 118 && result.rows.length === 236 * runs;
  result.methods = ["classic", "fill"].map((candidate) => {
    const rows = result.rows.filter((r) => r.candidate === candidate);
    return {
      candidate,
      observations: rows.length,
      medianMs: median(rows.map((r) => r.first3dMs)),
      peakPssBytes: Math.max(...rows.map((r) => r.peakPssBytes)),
    };
  });
  result.timeRatio = result.methods[1].medianMs / result.methods[0].medianMs;
  result.timePass = result.complete && result.timeRatio <= 1.25;
  result.maximumPairedPssIncreaseMiB = Math.max(
    ...result.rows
      .filter((r) => r.candidate === "fill")
      .map((r) => {
        const base = result.rows.find(
          (b) => b.id === r.id && b.trial === r.trial && b.candidate === "classic",
        );
        if (!base || base.browser !== r.browser || base.renderer !== r.renderer)
          throw new Error("Unpaired cost observation");
        return (r.peakPssBytes - base.peakPssBytes) / 1024 ** 2;
      }),
  );
  result.memoryPass = result.complete && result.maximumPairedPssIncreaseMiB <= 150;
} finally {
  save();
  await server.close();
}
