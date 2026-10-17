// MIT; made by Ryan with Codex (GPT-6). Fail-closed rollup of the completed evidence.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import zlib from "node:zlib";
import { compareFillQuality, compareFillBoundaries } from "./p3d-fill-score.mjs";
import { scoreViews } from "./p3d-next-score.mjs";

const root = path.resolve(process.argv[2] || ".cache/photo-3d-fill"),
  read = (f) => JSON.parse(fs.readFileSync(f)),
  hash = (b) => createHash("sha256").update(b).digest("hex"),
  atlas = read(path.join(root, "atlas.json")),
  ids = atlas.inputs.map((r) => r.id),
  rows = [];
for (const profile of ["phone", "desktop"]) {
  const capture = read(path.join(root, profile, "capture.json"));
  if (
    !capture.finishedUTC ||
    !capture.scopeComplete ||
    capture.settings.method !== "layered-h-classic-foreground-v1" ||
    capture.rows.length !== 236 ||
    capture.settings.inputs.length !== 118 ||
    JSON.stringify(capture.settings.profiles) !== JSON.stringify([profile])
  )
    throw new Error("The profile controller did not finish and verify its sources: " + profile);
  for (const r of capture.rows) {
    const input = atlas.inputs.find((x) => x.id === r.id);
    if (!input || input.sha256 !== r.photoHash) throw new Error("Source photo differs");
    const probe = fs.readFileSync(path.join(root, "probes", `${r.id}-${profile}-anchors.json.gz`));
    if (hash(probe) !== r.probeSha256) throw new Error("Source probes changed");
    for (const frame of r.observation.rows)
      for (const [file, digest] of Object.entries(frame.artifacts))
        if (hash(fs.readFileSync(path.join(root, profile, r.candidate, file))) !== digest)
          throw new Error("Native evidence changed: " + file);
    rows.push(r);
  }
}
const quality = compareFillQuality(rows, ids);
if (!quality.complete) throw new Error("Incomplete atlas: " + JSON.stringify(quality.issues));
let identicalDiagnosticRasters = 0;
for (const h of rows.filter((r) => r.candidate === "fill")) {
  const b = rows.find((r) => r.id === h.id && r.profile === h.profile && r.candidate === "classic");
  if (!h.observation.overlayProof.colorBinding?.foregroundMatchesClassic)
    throw new Error("Missing Classic foreground binding proof");
  for (const pose of h.observation.rows) {
    const base = b.observation.rows.find((r) => r.yaw === pose.yaw && r.pitch === pose.pitch);
    for (const kind of ["mask", "uv"]) {
      const file = `renders/${h.id}-${h.profile}-${pose.yaw}-${pose.pitch}-${kind}.png`;
      if (!pose.artifacts[file] || pose.artifacts[file] !== base.artifacts[file])
        throw new Error("Classic coverage or UV raster differs: " + file);
      identicalDiagnosticRasters++;
    }
  }
}
const truth = {};
for (const candidate of ["classic", "fill"]) {
  const folder = path.join(root, "truth-captures", candidate);
  fs.mkdirSync(folder, { recursive: true });
  const truthRows = rows
    .filter((r) => r.candidate === candidate && r.id.startsWith("truth-"))
    .map((r) => {
      const o = r.observation,
        rebase = (f) => path.relative(folder, path.join(root, r.profile, candidate, f));
      return {
        ...o,
        id: r.id,
        profile: r.profile,
        photoHash: r.photoHash,
        rows: o.rows.map((p) => ({
          ...p,
          image: rebase(p.image),
          boundaryFile: rebase(p.boundaryFile),
        })),
      };
    });
  if (truthRows.length !== 24) throw new Error("Missing truth capture");
  fs.writeFileSync(
    path.join(folder, "capture.json"),
    JSON.stringify({ candidate, complete: true, rows: truthRows }),
  );
  truth[candidate] = scoreViews(folder, path.join(root, "targets-official"));
  fs.writeFileSync(path.join(root, candidate + "-truth.json"), JSON.stringify(truth[candidate]));
}
truth["layered-a"] = scoreViews(
  path.join(root, "layered-a-truth"),
  path.join(root, "targets-official"),
);
const aCapture = read(path.join(root, "layered-a-truth/capture.json")),
  truthThinProbes = {
    scope: "12 truth scenes, both profiles, every supported pose",
    evaluated: 0,
    classicLost: 0,
    hLost: 0,
    aLost: 0,
  };
for (const a of aCapture.rows) {
  const actual = read(
      path.join(root, "layered-a-truth/renders", `${a.id}-${a.profile}-anchors.json`),
    ),
    frozen = JSON.parse(
      zlib.gunzipSync(
        fs.readFileSync(path.join(root, "probes", `${a.id}-${a.profile}-anchors.json.gz`)),
      ),
    );
  for (const key of ["field", "thin", "edges"])
    if (JSON.stringify(actual[key]) !== JSON.stringify(frozen[key]))
      throw new Error("Layered A source probes differ: " + a.id + "/" + a.profile);
  const b = rows.find(
      (r) => r.id === a.id && r.profile === a.profile && r.candidate === "classic",
    ).observation,
    h = rows.find(
      (r) => r.id === a.id && r.profile === a.profile && r.candidate === "fill",
    ).observation;
  if (JSON.stringify(a.targetCameras) !== JSON.stringify(b.targetCameras))
    throw new Error("Layered A cameras differ");
  for (const pose of b.rows) {
    const aa = a.rows.find((r) => r.yaw === pose.yaw && r.pitch === pose.pitch)?.fringe,
      hh = h.rows.find((r) => r.yaw === pose.yaw && r.pitch === pose.pitch)?.fringe,
      bb = pose.fringe;
    if (!aa || !hh || aa.evaluated !== bb.evaluated || hh.evaluated !== bb.evaluated)
      throw new Error("Layered A thin support differs");
    truthThinProbes.evaluated += bb.evaluated;
    truthThinProbes.classicLost += bb.missing;
    truthThinProbes.hLost += hh.missing;
    truthThinProbes.aLost += aa.missing;
  }
}
fs.writeFileSync(path.join(root, "layered-a-truth.json"), JSON.stringify(truth["layered-a"]));
const boundaries = compareFillBoundaries(truth.classic, truth.fill),
  cost = read(path.join(root, "cost/cost.json"));
if (
  !cost.complete ||
  cost.settings.runs !== 5 ||
  cost.rows.length !== 1180 ||
  new Set(cost.settings.inputs.map((r) => r.id)).size !== 118 ||
  !ids.every((id) => cost.settings.inputs.some((r) => r.id === id))
)
  throw new Error("Need all five fresh-browser cost trials for all 118 inputs and both methods");
const compactTruth = (t) => ({
  complete: t.complete,
  views: t.views,
  medianError: t.medianError,
  medianBoundaryError: t.medianBoundaryError,
  medianEdgeF1: t.medianEdgeF1,
  boundaryViews: t.boundaryViews,
  boundaryPixels: t.boundaryPixels,
  scenes: t.scenes,
});
const summary = {
  builder: "Codex (GPT-6)",
  task: "99b",
  generatedUTC: new Date().toISOString(),
  inputs: 118,
  profiles: 2,
  methodBuilds: rows.length,
  colorViews: rows.length * 9,
  identicalDiagnosticRasters,
  ribbonPass: quality.ribbonPass,
  everyInputAtLeast60Percent: quality.everyInputRibbonPass,
  thinPass: quality.thinPass,
  boundaries,
  truthThinProbes,
  truth: Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, compactTruth(v)])),
  profiles: quality.profiles.map((p) => ({
    ...p,
    pairs: p.pairs.map((r) => ({
      id: r.id,
      classicRibbons: r.classic.streaks,
      hRibbons: r.fill.streaks,
      classicTextureLoss: r.classic.textureLoss,
      hTextureLoss: r.fill.textureLoss,
    })),
  })),
  cost: {
    complete: cost.complete,
    observations: cost.rows.length,
    trialsPerInputAndMethod: 5,
    physicalPhone: false,
    methods: cost.methods,
    timeRatio: cost.timeRatio,
    maximumPairedPssIncreaseMiB: cost.maximumPairedPssIncreaseMiB,
    timePass: cost.timePass,
    memoryPass: cost.memoryPass,
  },
  objectivePass:
    quality.ribbonPass &&
    quality.thinPass &&
    boundaries.pass &&
    boundaries.truthPass &&
    cost.timePass &&
    cost.memoryPass,
  ownerBlindResult: null,
  productionOptionEnabled: false,
  evidence: {
    atlasCommit: "0e28cf877598399273199b772e636467788b294b",
    calibrationCommit: "9919cdf66f7fe5a875cf5c1e1596b479b8f87995",
    sourceGuards: Object.fromEntries(
      ["phone", "desktop", "cost"].map((p) => [
        p,
        hash(fs.readFileSync(path.join(root, p, "settings.json"))),
      ]),
    ),
  },
};
const bytes = JSON.stringify(summary, null, 2) + "\n";
if (Buffer.byteLength(bytes) > 300 * 1024)
  throw new Error("Summary exceeds the audit JSON size limit");
fs.writeFileSync(path.join(root, "summary.json"), bytes);
console.log(
  JSON.stringify({
    objectivePass: summary.objectivePass,
    ribbonPass: summary.ribbonPass,
    thinPass: summary.thinPass,
    boundaryPass: boundaries.pass,
    truthPass: boundaries.truthPass,
    timePass: cost.timePass,
    memoryPass: cost.memoryPass,
  }),
);
