import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const get = (name) => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, "utf8"));
const expected = { lab: 80, peers: 84, peerslow: 4, lower: 60, safe: 20, stress: 28, auto: 8 };
const errors = [];
const all = [];
const q = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2;
};
for (const [batch, count] of Object.entries(expected)) {
  const rows = get(batch),
    method = get(`${batch}-method`);
  if (rows.length !== count) errors.push(`${batch}: ${rows.length}/${count}`);
  if (new Set(rows.map((r) => r.key)).size !== count) errors.push(`${batch}: duplicate keys`);
  if (
    method.cells.length !== count ||
    method.cells.some((c) => !rows.some((r) => r.key === JSON.stringify(c)))
  )
    errors.push(`${batch}: missing configured cells`);
  for (const r of rows) {
    if (r.status !== "ok" || r.errors.length) errors.push(`${batch}/${r.key}: ${r.status}`);
    if (r.actualRenderer !== r.renderer) errors.push(`${batch}/${r.key}: renderer fallback`);
    if (r.id === "fluid-lab") {
      const wantMode =
        r.renderer === "webgpu" && ["glass", "splash"].includes(r.scene) ? "gpu" : "worker";
      if (r.ready.fluid?.mode !== wantMode)
        errors.push(`${batch}/${r.key}: fluid runtime fallback`);
      if (["candle", "cup"].includes(r.scene) && !r.windows.at(-1).snapshot.fluid.grids.length)
        errors.push(`${batch}/${r.key}: no gas grid`);
    }
    if (r.ready.profile !== (r.profile === "auto" ? "mid" : r.profile))
      errors.push(`${batch}/${r.key}: profile mismatch`);
    if (r.windows?.length !== 2) errors.push(`${batch}/${r.key}: window count`);
    for (const w of r.windows || []) {
      if (w.elapsedMs < (w.phase === "idle" ? 5000 : 6000))
        errors.push(`${batch}/${r.key}: short window`);
      for (const event of ["frame", "render"]) {
        const v = w[event],
          s = w[`${event}Summary`];
        const mismatch = v.length
          ? Math.abs(median(v) - s.median) > 1e-7 || Math.abs(q(v, 0.95) - s.p95) > 1e-7
          : s.median !== null || s.p95 !== null;
        if (v.length !== s.n || v.some((n) => !Number.isFinite(n) || n <= 0) || mismatch)
          errors.push(`${batch}/${r.key}: invalid ${event} vectors`);
      }
    }
    all.push({ batch, ...r });
  }
}
const inventory = get("source-inventory");
const changedAfterBaseline = [];
for (const f of inventory.inspected) {
  const original = execFileSync("git", ["show", `${inventory.baseline}:${f.path}`], {
    cwd: root,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (crypto.createHash("sha256").update(original).digest("hex") !== f.sha256)
    errors.push(`Baseline hash mismatch: ${f.path}`);
  if (
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(`${root}/${f.path}`))
      .digest("hex") !== f.sha256
  )
    changedAfterBaseline.push(f.path);
}
for (const b of Object.keys(expected))
  if (get(`${b}-method`).baseline !== inventory.baseline)
    errors.push(`${b}: mixed measurement baseline`);
const solver = get("solver"),
  soak = get("soak");
const growth = get("growth");
if (
  growth.errors.length ||
  growth.cycles.length !== 6 ||
  growth.before.snapshot.deviceType !== "webgpu"
)
  errors.push("growth identity probe incomplete or errors");
if (solver.length !== 80) errors.push(`solver: ${solver.length}/80`);
if (new Set(solver.map((r) => r.key)).size !== 80) errors.push("solver: duplicate keys");
for (const r of solver) {
  if (
    r.times.length !== 150 ||
    r.seed !== 3456224641 ||
    r.times.some((n) => !Number.isFinite(n) || n < 0) ||
    Math.abs(median(r.times) - r.medianMs) > 1e-7 ||
    Math.abs(q(r.times, 0.95) - r.p95Ms) > 1e-7
  )
    errors.push(`solver: invalid ${r.key}`);
}
if (soak.length !== 2 || soak.some((s) => s.errors.length || s.observations.length !== 36))
  errors.push("soak incomplete or errors");
if (errors.length) {
  fs.writeFileSync(
    `${dir}/validation.json`,
    JSON.stringify({ passed: false, errors }, null, 2) + "\n",
  );
  throw new Error(errors.join("\n"));
}
const validation = {
  passed: true,
  baseline: inventory.baseline,
  expected,
  renderingCells: all.length,
  windows: all.length * 2,
  solverCells: solver.length,
  solverSimulationSteps: solver.reduce((n, r) => n + r.frames, 0),
  solverTimedSteps: solver.reduce((n, r) => n + r.times.length, 0),
  solverLiquidTimedSteps: solver.filter((r) => !r.gridGas).reduce((n, r) => n + r.times.length, 0),
  independentPilotCells: get("pilot").length,
  soakRenderers: soak.length,
  checkedSourceFiles: inventory.inspected.length,
  actualRenderers: [...new Set(all.map((r) => r.actualRenderer))],
  pageErrors: all.reduce((n, r) => n + r.errors.length, 0),
  frameIntervals: all.reduce(
    (n, r) => n + r.windows.reduce((n, w) => n + w.frame.length + w.render.length, 0),
    0,
  ),
  physicalPhoneUsed: false,
  errors: [],
};
validation.sourceVerification = {
  pinnedBaselineHashes: true,
  checkoutHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  changedAfterBaseline,
  allTimingBatchesAtPinnedBaseline: true,
};
validation.growthProbeCycles = growth.cycles.length;
fs.writeFileSync(`${dir}/validation.json`, JSON.stringify(validation, null, 2) + "\n");
const num = (n, d = 1) => (n == null ? "—" : n.toFixed(d));
const mib = (n) => (n == null ? "—" : num(n / 1048576));
const last = (r) => r.windows.at(-1).snapshot;
function systems(r) {
  return last(r).fluid?.systems.length ? last(r).fluid.systems : r.workerEnd?.[0]?.systems || [];
}
const liquid = (r) => systems(r).find((s) => s.kind === "liquid");
const cells = (r) =>
  last(r).fluid?.grids.length
    ? last(r).fluid.grids.reduce((n, g) => n + g.cells, 0)
    : (liquid(r)?.grid?.reduce((n, v) => n * v, 1) ?? null);
const tracked = (r) => last(r).gpuMemory.trackedBytes;
const heap = (r) => `${mib(r.heapEnd.usedSize)}/${mib(r.workerHeapEnd?.usedSize)}`;
const name = (r) => (r.id === "fluid-lab" ? `${r.scene}/${r.liquid}` : r.id);
const frame = (w) => `${num(w.renderSummary.median)}/${num(w.renderSummary.p95)}`;
const flat = all.flatMap((r) =>
  r.windows.map((w) => ({
    batch: r.batch,
    toy: r.id,
    scene: r.scene || "",
    liquid: r.liquid || "",
    setting: r.setting,
    renderer: r.actualRenderer,
    phase: w.phase,
    medianMs: w.renderSummary.median,
    p95Ms: w.renderSummary.p95,
    maxMs: w.renderSummary.max,
    frames: w.renderSummary.n,
    longTasks: w.longSummary.count,
    longTaskMs: w.longSummary.totalMs,
    endPageHeapBytes: r.heapEnd.usedSize,
    endWorkerHeapBytes: r.workerHeapEnd?.usedSize ?? null,
    endGPUTrackedBytes: tracked(r),
    endLiquidActive: liquid(r)?.n ?? null,
    endLiquidCap: liquid(r)?.cap ?? null,
    endGridCells: cells(r),
    baseSplats: r.ready.baseSplats,
    fluidSlots: last(r).fluid?.stats.slots ?? null,
    firstFrameMs: r.opening.firstFrameMs,
  })),
);
const columns = Object.keys(flat[0]);
fs.writeFileSync(
  `${dir}/metrics.csv`,
  columns.join(",") +
    "\n" +
    flat.map((r) => columns.map((c) => r[c] ?? "").join(",")).join("\n") +
    "\n",
);
function table(rows) {
  return (
    "| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n" +
    rows
      .map(
        (r) =>
          `| ${r.setting}${r.batch === "lower" && r.scene === "splash" && r.renderer === "webgl2" ? "†" : ""} / ${r.actualRenderer === "webgpu" ? "GPU" : "GL"} | ${frame(r.windows[0])} | ${frame(r.windows[1])} | ${r.windows[0].longSummary.count}/${r.windows[1].longSummary.count} | ${heap(r)} | ${mib(tracked(r))} | ${liquid(r) ? `${liquid(r).n}/${liquid(r).cap}` : "—"} | ${cells(r) ?? "—"} | ${num(r.opening.firstFrameMs, 0)} |`,
      )
      .join("\n")
  );
}
// Data tables are regenerated independently of the report's interpretation.
const tables = [
  "# Generated tables",
  "",
  ...[...new Set(get("lab").map(name))].flatMap((n) => [
    `## ${n}`,
    "",
    table(all.filter((r) => r.id === "fluid-lab" && name(r) === n)),
    "",
    ...(n.startsWith("glass/") || n.startsWith("splash/")
      ? [
          "| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |",
          "| --- | ---: | ---: | ---: |",
          ...solver
            .filter((r) => `${r.scene}/${r.liquid}` === n)
            .map((r) => {
              const s = r.systems.find((s) => s.kind === "liquid");
              const rejected =
                r.scene === "splash" && ["half", "quarter", "eighth"].includes(r.setting);
              return `| ${r.setting}${rejected ? "†" : ""} | ${num(r.medianMs)}/${num(r.p95Ms)} | ${s ? `${s.n}/${s.cap}` : "—"} | ${r.slots} |`;
            }),
        ]
      : [
          "The solver-only probe excludes gas grids. Its zero-work rows do not measure this scene's gas simulation.",
        ]),
    "",
  ]),
  "## Fluid visual peers",
  "",
  ...[...new Set(get("peers").map(name))].flatMap((n) => [
    `### ${n}`,
    "",
    table(all.filter((r) => r.id === n)),
    "",
  ]),
].join("\n");
fs.writeFileSync(`${dir}/tables.md`, tables + "\n");
const comparison = get("safe").map((r) => {
  const d = all.find(
    (x) =>
      x.batch === "lab" && name(x) === name(r) && x.setting === "mid6" && x.renderer === r.renderer,
  );
  const high = all.find(
    (x) =>
      x.batch === "stress" &&
      name(x) === name(r) &&
      x.setting === "high6phone" &&
      x.renderer === r.renderer,
  );
  return {
    scene: name(r),
    renderer: r.renderer,
    defaultP95: d.windows[1].renderSummary.p95,
    safeP95: r.windows[1].renderSummary.p95,
    highPhoneP95: high.windows[1].renderSummary.p95,
    defaultGPUBytes: tracked(d),
    safeGPUBytes: tracked(r),
    savedGPUBytes: tracked(d) - tracked(r),
    defaultCells: cells(d),
    safeCells: cells(r),
    defaultBaseSplats: d.ready.baseSplats,
    safeBaseSplats: r.ready.baseSplats,
  };
});
fs.writeFileSync(`${dir}/comparisons.json`, JSON.stringify(comparison, null, 2) + "\n");
console.log(JSON.stringify(validation));
