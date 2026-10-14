// Report worst strong poses without turning absent support into a pass.
import fs from "node:fs";
import path from "node:path";
const opt = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const input = opt("study", ".cache/photo-3d-r4/matrix-final-fast/results.json");
const out = opt("out", ".cache/photo-3d-r4/summary");
const study = JSON.parse(fs.readFileSync(input));
const definitions = {
  holes: ["holes", "holes"],
  holeFraction: ["holes", "holeFraction"],
  haloMean: ["edges", "haloMean"],
  haloFraction: ["edges", "haloFraction"],
  sourceColorMAE: ["edges", "sourceColorMAE"],
  contrastLoss: ["edges", "contrastLoss"],
  directionalExcess: ["streak", "directionalExcess"],
  fringeMean: ["thin", "fringeMean"],
  fringeLocalMean: ["thinLocal", "fringeMean"],
  missingThin: ["thin", "missing"],
};
const get = (data, keys) =>
  keys[0] === "thin" && keys[1] === "missing" && !(data.thin?.evaluated > 0)
    ? null
    : keys.reduce((v, k) => v?.[k], data);
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const groups = new Map();
for (const row of study.rows) {
  const key = JSON.stringify([row.id, row.screen, row.view]);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
const rows = [];
for (const values of groups.values()) {
  const first = values[0],
    strong = values.filter((r) => Math.abs(r.yaw) >= 20 || Math.abs(r.pitch) >= 20);
  const metrics = {};
  for (const [name, keys] of Object.entries(definitions)) {
    const worst = (build) => {
      const measured = strong.filter((r) => finite(get(r.comparison[build], keys)));
      if (!measured.length) return null;
      const row = measured.reduce((a, b) =>
        get(b.comparison[build], keys) > get(a.comparison[build], keys) ? b : a,
      );
      return {
        value: get(row.comparison[build], keys),
        pose: [row.yaw, row.pitch],
        supportedPoses: measured.length,
      };
    };
    const before = worst(0),
      after = worst(1);
    metrics[name] = {
      before,
      after,
      status:
        !before || !after
          ? "unsupported"
          : after.value < before.value
            ? "better"
            : after.value > before.value
              ? "worse"
              : "same",
      regressedPoses: strong
        .filter(
          (r) =>
            finite(get(r.comparison[0], keys)) &&
            finite(get(r.comparison[1], keys)) &&
            get(r.comparison[1], keys) > get(r.comparison[0], keys),
        )
        .map((r) => ({
          pose: [r.yaw, r.pitch],
          before: get(r.comparison[0], keys),
          after: get(r.comparison[1], keys),
        })),
    };
  }
  rows.push({
    id: first.id,
    screen: first.screen,
    view: first.view,
    observedPoses: values.length,
    strongPoses: strong.length,
    coverage: values.length === 9 && strong.length === 8 ? "complete" : "partial",
    thinSupport: first.thinSupport,
    metrics,
  });
}
const expectedPoses = [
  [0, 0],
  ...[20, -20, 30, -30].flatMap((a) => [
    [a, 0],
    [0, a],
  ]),
];
const missing = [];
for (const input of study.inputHashes)
  for (const screen of ["phone", "desktop"])
    for (const [yaw, pitch] of expectedPoses)
      if (
        !study.rows.some(
          (r) =>
            r.id === input.id &&
            r.screen === screen &&
            r.view === "sharp" &&
            r.yaw === yaw &&
            r.pitch === pitch,
        )
      )
        missing.push({ id: input.id, screen, view: "sharp", yaw, pitch });
const summary = {
  study: input,
  observations: study.rows.length,
  expectedObservations: study.inputHashes.length * 2 * expectedPoses.length,
  missing,
  errors: study.errors || [],
  groups: rows.length,
  independentlyCapturedCandidateColor: study.rows.length,
  reusedPairedObservations: study.rows.filter((r) => r.reusedObservation).length,
  sharedCandidateDiagnostics: study.rows.filter((r) => r.comparison[1].sharedDiagnostics).length,
  completeGroups: rows.filter((r) => r.observedPoses === 9).length,
  metrics: Object.fromEntries(
    Object.keys(definitions).map((k) => [
      k,
      Object.fromEntries(
        ["better", "same", "worse", "unsupported"].map((status) => [
          status,
          rows.filter((r) => r.metrics[k].status === status).length,
        ]),
      ),
    ]),
  ),
  rows,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + ".json", JSON.stringify(summary, null, 2));
const columns = [
  "id",
  "screen",
  "view",
  "observedPoses",
  "strongPoses",
  "thinAnchors",
  "metric",
  "beforeWorst",
  "beforePose",
  "afterWorst",
  "afterPose",
  "status",
  "regressedPoseCount",
];
const quote = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
const csv = [columns.map(quote).join(",")];
for (const row of rows)
  for (const [metric, m] of Object.entries(row.metrics))
    csv.push(
      [
        row.id,
        row.screen,
        row.view,
        row.observedPoses,
        row.strongPoses,
        row.thinSupport?.supported,
        metric,
        m.before?.value,
        m.before?.pose.join(" / "),
        m.after?.value,
        m.after?.pose.join(" / "),
        m.status,
        m.regressedPoses.length,
      ]
        .map(quote)
        .join(","),
    );
fs.writeFileSync(out + ".csv", csv.join("\n") + "\n");
console.log(
  JSON.stringify({
    observations: summary.observations,
    groups: summary.groups,
    metrics: summary.metrics,
  }),
);
