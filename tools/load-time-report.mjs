// One current result table. Earlier observations are explicitly superseded.
import fs from "node:fs";
const dir = "docs/audits/load-time-2026-10";
const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const read = (file) => JSON.parse(fs.readFileSync(file));
const summarize = (r) => ({
  id: r.id,
  label: r.label,
  device: r.device,
  sample: r.sample,
  status: r.status,
  bytes: r.bytes,
  requests: r.requestCount ?? r.requests,
  firstFrameMs: r.firstFrameMs,
  errors: r.errors,
  profile: r.profile,
  splats: r.splats,
  canvas: r.canvas,
  gpu: r.gpu,
});
const key = (r) => `${r.device}:${r.id}`;
function load(root) {
  const result = {
    before: read(`${root}/before.json`).map(summarize),
    after: read(`${root}/after.json`).map(summarize),
    method: {
      before: read(`${root}/before-method.json`),
      after: read(`${root}/after-method.json`),
    },
  };
  if (
    result.method.before.frozenMain !== result.method.after.frozenMain ||
    result.method.before.candidateSource !== result.method.after.candidateSource
  )
    throw Error("Source references differ");
  const keys = [...new Set(result.before.map(key))].sort();
  if (JSON.stringify(keys) !== JSON.stringify([...new Set(result.after.map(key))].sort()))
    throw Error("Groups differ");
  for (const phase of ["before", "after"])
    for (const k of keys) {
      const rows = result[phase].filter((r) => key(r) === k);
      if (
        rows.length !== 5 ||
        rows.some(
          (r) =>
            r.status !== "ok" ||
            r.errors.length ||
            !Number.isFinite(r.firstFrameMs) ||
            r.firstFrameMs <= 0 ||
            !Number.isFinite(r.bytes) ||
            r.bytes <= 0 ||
            !Number.isInteger(r.requests) ||
            r.requests <= 0,
        ) ||
        JSON.stringify(rows.map((r) => r.sample).sort((a, b) => a - b)) !== "[0,1,2,3,4]"
      )
        throw Error(`Incomplete current group: ${phase}:${k}`);
    }
  for (const before of result.before) {
    const after = result.after.find((r) => key(r) === key(before) && r.sample === before.sample);
    for (const field of ["profile", "splats", "canvas", "gpu"])
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field]))
        throw Error(`Opening setting changed: ${key(before)}:${before.sample}:${field}`);
  }
  return result;
}
const timing = load(option("timing", "../load-time-runs/round3-reviewed"));
const payload = load(option("payload", "../load-time-runs/round3-top20"));
const reviewed = ["pyrite-cubes", "soda-can", "sunglasses", "fountain-pen"];
const expectedTiming = ["phone", "desktop"]
  .flatMap((device) => reviewed.map((id) => `${device}:${id}`))
  .sort();
if (JSON.stringify([...new Set(timing.before.map(key))].sort()) !== JSON.stringify(expectedTiming))
  throw Error("Expected all four reviewed toys at both settings");
if (
  new Set(payload.before.map(key)).size !== 20 ||
  payload.before.some((r) => r.device !== "phone")
)
  throw Error("Expected 20 phone payload groups");
if (
  JSON.stringify(timing.method.before.frozenMain) !==
    JSON.stringify(payload.method.before.frozenMain) ||
  timing.method.before.candidateSource !== payload.method.before.candidateSource
)
  throw Error("Current datasets use different sources");
const current = {
  before: [...payload.before, ...timing.before],
  after: [...payload.after, ...timing.after],
  method: payload.method,
  timingMethod: timing.method,
};
if (new Set(current.before.map((r) => `${key(r)}:${r.sample}`)).size !== current.before.length)
  throw Error("Duplicate current group");
fs.writeFileSync(`${dir}/current-results.json`, JSON.stringify(current, null, 2) + "\n");
const stats = (rows) => {
  const values = rows.map((r) => r.firstFrameMs).sort((a, b) => a - b);
  return {
    n: rows.length,
    median: values[2],
    min: values[0],
    max: values.at(-1),
    bytes: Math.round(rows.reduce((n, r) => n + r.bytes, 0) / rows.length),
    requests: Math.round(rows.reduce((n, r) => n + r.requests, 0) / rows.length),
  };
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const ms = (n) => n.toFixed(1);
const keys = [...new Set(current.before.map(key))];
const rows = keys.map((k) => ({
  k,
  b: stats(current.before.filter((r) => key(r) === k)),
  a: stats(current.after.filter((r) => key(r) === k)),
}));
const heavy = rows.filter((r) => payload.before.some((x) => key(x) === r.k));
const before = heavy.reduce((n, r) => n + r.b.bytes, 0),
  after = heavy.reduce((n, r) => n + r.a.bytes, 0);
const images = read(`${dir}/image-diffs.json`),
  compression = read(`${dir}/compressed-opening.json`),
  museum = read(`${dir}/museum-prefixes.json`);
const verification = read(`${dir}/verification.json`).round3;
if (
  verification?.runtimeSource !== current.method.after.candidateSource ||
  verification?.frozenMain !== current.method.before.frozenMain
)
  throw Error("Current verification source does not match the measured sources");
const lines = [
  "# Load-time audit — October 14, 2026",
  "",
  "Codex (GPT-6) built the lossless changes and this audit on `codex/load-time`. This revision addresses [the Operator's newest review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6163399711).",
  "",
  "## Current opening results",
  "",
  `Baseline main: \`${current.method.before.frozenMain}\`. Candidate: \`${current.method.after.candidateSource}\`. This is the only current timing table. Each group has five fresh-browser before/after pairs, adjacent and alternating in order, collected with no other rendering or heavy validation job running. Sunglasses uses five new pairs from one session; none of the old five or extended 15 observations are mixed in.`,
  "",
  `The original top-20 phone set averages ${fmt(before)} → ${fmt(after)} bytes combined (${((1 - after / before) * 100).toFixed(1)}% saving); ${heavy.filter((r) => r.a.bytes <= r.b.bytes * 0.75).length}/20 individually reach 25%. ${heavy.filter((r) => r.a.median > r.b.median).length}/20 have a higher measured first-frame median.`,
  "",
  `The combined 25% local opening-body target is ${after <= before * 0.75 ? "met" : "not met"}. The no-slower screen is ${rows.some((r) => r.a.median > r.b.median) ? "not met" : "met in these five-pair observations"} across all 28 groups (${rows.filter((r) => r.a.median > r.b.median).length} higher medians). Public per-toy wire saving was not measured.`,
  "",
  "| Toy | Setting | Samples per phase | Bytes before → after | Requests before → after | First-frame median before → after (ms) | Change | Before range (ms) | After range (ms) |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const r of rows)
  lines.push(
    `| ${r.k.split(":")[1]} | ${r.k.split(":")[0]} | 5 | ${fmt(r.b.bytes)} → ${fmt(r.a.bytes)} | ${r.b.requests} → ${r.a.requests} | ${ms(r.b.median)} → ${ms(r.a.median)} | ${((r.a.median / r.b.median - 1) * 100).toFixed(1)}% | ${ms(r.b.min)}–${ms(r.b.max)} | ${ms(r.a.min)}–${ms(r.a.max)} |`,
  );
lines.push(
  "",
  "All observations and device/profile metadata are in [current-results.json](load-time-2026-10/current-results.json). Higher medians remain visible; a smaller payload does not establish a faster opening.",
  "",
  "## Causes and changes",
  "",
  "The custom engine bootstrap added a full-body gzip decode, a Blob module, and an import-map gate before native evaluation. Its first revision also serialized app dependency discovery behind engine transfer. Restoring the original HTTP engine URL, module preload, and native app/embed entry removes that extra path for every toy. A held-engine browser test verifies app and player requests start before the engine response is released; the engine is requested once.",
  "",
  "GitHub Pages already gzips the [native engine](https://ryanjosephkamp.github.io/splashery/vendor/playcanvas/playcanvas.min.mjs): an actual public GET transferred 640,711 bytes, versus 634,277 bytes for our custom gzip (6,434 bytes difference). The decoded response exactly matches the vendored source. The earlier 26% combined saving used an uncompressed localhost server and is superseded; it was not a comparable public-wire saving. Native loading preserves the browser's ordinary module streaming, source URL, and cache behavior.",
  "",
  "The eight higher phone medians in round 2 were your-book, video-3d, splat-toolkit, powers-of-ten, dog-plush, moving-photo-3d, maple-tree, and cave-lioness. All used this custom engine startup. The final change retains the old native engine entry globally, including every named toy. This removes the shared extra loading path; it does not prove that each earlier multi-second difference had that single cause. No per-toy cause is inferred from a five-sample timing difference alone. The final table keeps any remaining higher medians visible.",
  "",
  "A separate native opening-pack module starts selected scan helper discovery alongside the app graph. A held-ui response test first failed when this module could start only through the app; starting it independently in HTML removes that serialization. App and embed await its shared promise before GPU initialization. GIF export keeps its import map. No compressed-engine mapping or source-preload promotion remains.",
  "",
  "In the final phone observations, Sunglasses and Soda can still have higher first-frame medians despite earlier median scan-response completion. [startup-stages.json](load-time-2026-10/startup-stages.json) records the completed-response stages. A response finishing before GPU setup leaves that setup in the later interval; these traces do not time module evaluation or GPU work and do not establish the remaining cause. No further timing fix is claimed.",
  "",
  "The latest main also changed the default manual to a content-addressed filename. The previous compressed loader matched only the legacy filename. The current and legacy documents now use exact gzip copies, overlapping PDF.js transfer and retaining every page, filename, notice, and original URL.",
  "",
  "Museum helpers and scan transfers overlap. Selected scan helpers finish before GPU setup in app and embed. App shared-scene openings also start scan preparation before WebGL initialization; embed scan preparation retains its normal order after GPU setup. The native engine retains its module preload. Five Real Objects prefixes and the globe, armillary, Stannern, and Pyrite prefixes retain exact records, original population counts, and exact full-scan Float64 means where needed. Higher budgets still use full scans. No rendered count, camera, texture, color precision, or engine version was reduced.",
  "",
  "| Lossless source | Original bytes | Gzip bytes | Saving |",
  "| --- | ---: | ---: | ---: |",
);
for (const r of compression)
  lines.push(
    `| ${r.source} | ${fmt(r.sourceBytes)} | ${fmt(r.bytes)} | ${((1 - r.bytes / r.sourceBytes) * 100).toFixed(1)}% |`,
  );
lines.push(
  "",
  "Exact hashes and unchanged-byte checks: [compressed-opening.json](load-time-2026-10/compressed-opening.json). Scan hashes and inherited license records: [museum-prefixes.json](load-time-2026-10/museum-prefixes.json). Armillary and Stannern's live pages were opened on October 13, 2026. Pyrite's page returned 503 on October 14; its [live model API](https://api.sketchfab.com/v3/models/0b7c6e8e32144b72806ed31cb49b4145) confirmed CC0 and Digital Atlas of Ancient Life. NC tags and in-app notices remain.",
  "",
  "## Visual and regression evidence",
  "",
  `${images.length} existing GPU-finished comparisons remain in [image-diffs.json](load-time-2026-10/image-diffs.json): 49 are pixel-identical; the desktop book differs at eight pixels by at most one RGB level and is visually identical. All 23 recorded tap poses moved. These captures use the previous frozen sources recorded in each row; restoring native engine discovery does not change their scene buffers. The updated manual's decoded bytes are checked separately.`,
  "",
  "All openings now use the original HTTP engine. This is not a demonstrated strawberry fix: prior raw-path runs both passed and failed. An observer around the unchanged original protected test found latest main and candidate still running the effect when its wall-time predicate expired. Candidate had advanced 1.8667 of 2.2 simulation seconds, and main 1.9332 seconds; their pop controls remained 0.1515 and 0.1213. Both observed executions used the original HTTP engine. The unchanged update clamps large frame deltas at 0.1 seconds; slow software frames can leave this simulation-time effect unfinished at the wall-time deadline. See [strawberry-timing.json](load-time-2026-10/strawberry-timing.json). The protected predicate, production clocks, and animation remain unchanged; current full-suite outcomes are recorded below.",
  "",
  `Current full-suite strawberry return-to-rest result: **${verification.finalStrawberry.result.status}** in the unchanged protected rig case on \`${verification.finalStrawberry.source}\`. Earlier native-path runs both passed and failed. This current outcome is reported separately from the preceding diagnostic failures; a pass does not establish a causal fix.`,
  "",
  "The strawberry probe leaves production clocks, controls, and cameras running. It records control decay, simulation time, wall time, and paired rest/pop/settled images. Its raw captures stay outside Git. The current verification receipt states the original smoke results and main comparison; the protected smoke test was not edited.",
  "",
  verification
    ? verification.summary
    : "Current required-suite verification is not complete; no passing result is claimed.",
  "",
  `Measured main \`${current.method.before.frozenMain}\` is merged into the candidate, including its video-loading updates. Latest main \`${verification.integratedLatestMain.main}\` was then merged before validation; its only additional change is docs/STATUS.md. The repeated validation uses \`${verification.validationSource}\`, with zero runtime/test/tool/asset differences from measured candidate \`${current.method.after.candidateSource}\`. Earlier comparisons retain their actual source pins in the verification receipt.`,
  "",
  "Details, commands, source pins, initial failures, and comparison results are retained in [verification.json](load-time-2026-10/verification.json).",
  "",
  ...(verification.finalChecks
    ? [
        `Final check receipts: Prettier, American English, whitespace, and the audit-budget test all exit 0. All ${verification.finalChecks.protected.unionCount} fully paginated protected paths have zero committed and working-tree intersections. Commands and results are in verification.json; the strict final audit size remains below 3,000,000 bytes.`,
        "",
      ]
    : []),
  "## Method and reproduction",
  "",
  "Phone: 390×844, DPR 3, touch/mobile, weak/low. Desktop: 1440×900, DPR 1, high. WebGL2, sound and adaptation off, seed 424242, preset camera, localhost, disabled HTTP cache, and blocked service workers. Raw method files record Chromium, renderer, process priority, thread count, and display. This Linux software-renderer session is not a physical-phone or task 06 Mac/Metal measurement. First frame means submitted postrender readiness; captures separately finish the GPU.",
  "",
  "Bytes and requests are means; timings are medians and full ranges. Opening bytes count completed bodies after a real 1.5-second delay, excluding headers, blob/data URLs, and incomplete responses. This local plain-server byte metric is not public transfer size. Actual public per-file headers and byte comparisons are retained in [production-transport.json](load-time-2026-10/production-transport.json). Pages already compresses [help](https://ryanjosephkamp.github.io/splashery/src/toy-help.js) to 118,347 bytes, so its local custom gzip is only 2,494 bytes smaller than the public encoded body; the [current PDF](https://ryanjosephkamp.github.io/splashery/manual/tinkerers-manual-85d32b96193ea275.pdf) is served uncompressed at 7,792,711 bytes, and its local 5,858,411-byte exact gzip is 1,934,300 bytes smaller. The candidate gzip files have not been deployed, so their public transfer size is not measured. A public per-toy opening was not measured. The full catalog was not rescreened after the latest main merge; this current screen covers the original top-20 phone set and four reviewed toys at both settings. Frame cadence and a heap census were not repeated.",
  "",
  "Serve archived baseline main on port 4174 and the frozen candidate on 4173. `tools/load-time-paired.mjs --only=ID,ID --device=phone --samples=5 --out=DIR --frozen-main=COMMIT --candidate-source=COMMIT` runs the adjacent alternating pairs. Raw runs default outside the repository. `tools/load-time-report.mjs --timing=DIR --payload=DIR` validates complete groups and writes this single current table. `tools/load-time-compress.mjs`, `tools/load-time-prefixes.mjs`, and `tools/load-time-smoothing.mjs` regenerate the lossless files.",
  "",
  "## Superseded results and remaining limits",
  "",
  "All earlier catalog, paired, top-20, and mixed-session Sunglasses observations are **superseded**. Their compact records are archived under [superseded/](load-time-2026-10/superseded/); they are not current results and no historical numeric table is reproduced here. Earlier verification receipts remain labeled by source and date.",
  "",
  "Unused PLY-column removal remains deferred because PR #562's protected manifest pins the original file and its loading path. Already compressed SOG captures keep their drawn points and precision. Both combined and individual 25% targets are reported above. Restoring the native engine gives up the misleading local-only gzip win; the target is not claimed met when measured savings fall short. The audit stays below 3,000,000 bytes; raw request traces and bulk captures remain outside Git, and no added -diff attributes remain.",
  "",
  "Lossy point-budget options were not shipped. Their paired stills and diffs remain in [lossy-options.json](load-time-2026-10/lossy-options.json) for the owner.",
  "",
  "Rule check: the prior unpublished email metadata history rewrite conflicts with E1. Subsequent review changes are additive.",
  "",
);
fs.writeFileSync(`${dir}.md`, lines.join("\n"));
console.log({
  groups: rows.length,
  combinedSaving: (1 - after / before) * 100,
  higherMedians: heavy.filter((r) => r.a.median > r.b.median).map((r) => r.k),
});
