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
const timing = load(option("timing", "../load-time-runs/round4/reviewed"));
const payload = load(option("payload", "../load-time-runs/round4/top20"));
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
const fallback = load(option("fallback", "../load-time-runs/round4/full-scan-fallback"));
const fallbackKeys = ["phone:sunglasses", "phone:soda-can", "phone:fountain-pen"].sort();
if (
  JSON.stringify([...new Set(fallback.before.map(key))].sort()) !== JSON.stringify(fallbackKeys) ||
  fallback.method.before.frozenMain !== payload.method.before.frozenMain
)
  throw Error("Unexpected fallback groups or baseline");
const current = {
  before: [...payload.before, ...timing.before],
  after: [...payload.after, ...timing.after],
  method: payload.method,
  timingMethod: timing.method,
  fallbackMethod: fallback.method,
  finalCandidateSource: fallback.method.after.candidateSource,
};
for (const phase of ["before", "after"])
  current[phase] = current[phase].map((row) => {
    const replacement = fallback[phase].find((r) => key(r) === key(row) && r.sample === row.sample);
    return {
      ...(replacement || row),
      measuredSource:
        phase === "before"
          ? current.method.before.frozenMain
          : replacement
            ? current.finalCandidateSource
            : current.method.after.candidateSource,
    };
  });
if (new Set(current.before.map((r) => `${key(r)}:${r.sample}`)).size !== current.before.length)
  throw Error("Duplicate current group");
fs.writeFileSync(`${dir}/current-results.json`, JSON.stringify(current, null, 2) + "\n");
const stats = (rows) => {
  if (new Set(rows.map((r) => r.measuredSource)).size !== 1)
    throw Error("Mixed candidate revisions within one group");
  const values = rows.map((r) => r.firstFrameMs).sort((a, b) => a - b);
  return {
    source: rows[0].measuredSource,
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
const images = read(`${dir}/image-diffs.json`);
const compression = read(`${dir}/compressed-opening.json`);
const verificationFile = read(`${dir}/verification.json`);
const verification = verificationFile.round4;
const postMerge = verificationFile.postMerge;
const strawberry = read(`${dir}/strawberry-repeat.json`);
const currentStrawberry = strawberry.currentTest;
const control = read(`${dir}/same-main-control.json`);
if (
  verification?.runtimeSource !== current.finalCandidateSource ||
  verification?.frozenMain !== current.method.before.frozenMain ||
  strawberry.groups.after.source !== current.method.after.candidateSource ||
  strawberry.groups.before.source !== verification.frozenMain ||
  currentStrawberry?.groups.after.source !== current.method.after.candidateSource ||
  currentStrawberry?.groups.before.source !== verification.frozenMain
)
  throw Error("Current evidence has mixed source pins");
const higher = rows.filter((r) => r.a.median > r.b.median);
const originalSlower = [
  "phone:video-3d",
  "phone:living-city",
  "phone:celestial-globe",
  "phone:crochet-earth",
  "phone:seeded-loaf",
  "phone:moving-photo-3d",
  "phone:turtle-souvenir",
  "phone:maple-tree",
  "phone:cave-lioness",
  "phone:soda-can",
  "phone:sunglasses",
  "desktop:pyrite-cubes",
];
const lines = [
  "# Load-time audit — October 15, 2026",
  "",
  "Codex (GPT-6) built these lossless changes and this audit on `codex/load-time`. This revision addresses [the Operator's October 15 review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6198837043).",
  "",
  "## Current opening results",
  "",
  `Baseline main: \`${current.method.before.frozenMain}\`. Measured fallback candidate: \`${current.finalCandidateSource}\`. The three phone full-scan fallbacks were measured on that revision; the other 25 groups retain their actual \`${current.method.after.candidateSource}\` source pins. A guarded diff between the two measured candidate revisions confirms that their only runtime difference removes these three prefix-selector entries; every other data selection and loader/build function is unchanged. Each group has five adjacent, alternating before/after pairs on the same Linux software-rendering device. Every opening uses a fresh browser and context, disabled cache, and the same renderer, viewport, profile, count, seed, and camera. No repeated-test or other rendering job ran alongside these measurements. Superseded experiments and the replaced prefix samples are not pooled into this table.`,
  "",
  ...(postMerge
    ? [
        `After timing collection, main \`${postMerge.integratedMain}\` was merged additively at \`${postMerge.merge}\`, followed by refreshed byte-identical compressed manuals at \`${postMerge.validationSource}\`. The table retains its actual earlier baseline and candidate pins; these upstream UI, QR, photo, and manual changes were not timed again. Shared rig, camera, and animation-clock files remain unchanged. Final regression checks are recorded separately below.`,
        "",
      ]
    : []),
  `The original top-20 phone set averages ${fmt(before)} → ${fmt(after)} local HTTP-body bytes combined (${((1 - after / before) * 100).toFixed(1)}% saving); ${heavy.filter((r) => r.a.bytes <= r.b.bytes * 0.75).length}/20 individually reach 25%. The combined 25% target is ${after <= before * 0.75 ? "met" : "not met"}. Public per-toy wire savings were not measured.`,
  "",
  `The strict median screen has ${higher.length}/28 higher medians. ${higher.length ? "It is not claimed met; each measured increase remains visible below." : "It is met in these observations, without establishing a universal timing guarantee."}`,
  "",
  "| Toy | Setting | Measured candidate | Samples per phase | Bytes before → after | Requests before → after | First-frame median before → after (ms) | Change | Before range (ms) | After range (ms) |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const r of rows)
  lines.push(
    `| ${r.k.split(":")[1]} | ${r.k.split(":")[0]} | ${r.a.source.slice(0, 8)} | 5 | ${fmt(r.b.bytes)} → ${fmt(r.a.bytes)} | ${r.b.requests} → ${r.a.requests} | ${ms(r.b.median)} → ${ms(r.a.median)} | ${((r.a.median / r.b.median - 1) * 100).toFixed(1)}% | ${ms(r.b.min)}–${ms(r.b.max)} | ${ms(r.a.min)}–${ms(r.a.max)} |`,
  );
lines.push(
  "",
  "All observations and settings are in [current-results.json](load-time-2026-10/current-results.json). Bytes and request counts are means; first-frame times are medians with full ranges. A smaller payload alone does not prove a faster opening.",
  "",
  `A separate fixed five-pair control opened the identical frozen main on the same HTTP origin in both phases for all 12 previously slower groups. It produced ${control.higherMedians}/12 higher medians, with group median changes from ${control.minMedianChangePercent.toFixed(1)}% to ${control.maxMedianChangePercent.toFixed(1)}%. [same-main-control.json](load-time-2026-10/same-main-control.json) records all settings and ranges. This quantifies repeatability on this device; it is not pooled with candidate results and does not establish that any particular candidate increase is noise.`,
  "",
  "## Eager fallback for every previously slower group",
  "",
  "The preceding implementation still awaited an opening-pack promise before renderer creation, decoded shared scenes again inside Player.init, started scan preparation before GPU initialization, loaded scan helpers dynamically, and inflated a Blob help module. The current change removes those paths globally. On measured fallback revision 30ed36e5, the app, Player, UI, and embed JavaScript entry files match the frozen main byte for byte; the original HTML engine preload and native app entry remain. The original eager museum-helper import is restored, and the scan decoder is back in its original module so it adds no runtime module request.",
  "",
  "A new browser regression test holds compressed shared-scene decoding. Before the fix, renderer creation never starts within the unchanged test window; after the fix, it starts before the scene is released and the same shared toy then loads. Two further tests hold the unused PDF decompressor and edition metadata responses and verify that an ordinary opening can finish. Both PDF-only module dependencies are removed from ordinary startup. Red and green receipts, source hashes, the parser-based eager import comparison, and exact fallback coverage are recorded in [eager-fallback.json](load-time-2026-10/eager-fallback.json). These tests establish the removed startup dependencies; they do not assign each historical median difference to one cause.",
  "",
  "The fallback covers all 12 groups named in the review:",
  "",
  ...originalSlower.map(
    (key) =>
      `- ${key.replace(":", " / ")}: restored main's eager startup order and native help loading.`,
  ),
  "",
  "Sunglasses, Soda can, and Fountain pen now use their unchanged original full scan files at every detail setting. The new full-file selection tests failed before this fallback and pass after. Their three phone groups use five fresh pairs on the final revision; none of the earlier prefix measurements is pooled into them. The disabled prefix files remain as generated artifacts with their original byte proofs; they are not requested at runtime. Water bottle and Baseball cap retain exact-record prefixes with original population counts; four museum scans also retain the exact full-scan Float64 smoothing means. Higher detail uses the original full scan. Geometry, rendered splat counts, precision, textures, controls, clocks, and cameras are unchanged. PDF gzip retains every decoded byte; GIF encoding code remains deferred until export.",
  "",
  "## Strawberry repeated comparison",
  "",
  `The original protected test from 613213cf was run ten times per source on the eager-startup revision b222e93a and frozen main, in alternating adjacent order, without changed controls, clocks, thresholds, waits, retries, or fixture observers. Main: ${strawberry.groups.before.passed}/10 passed, ${strawberry.groups.before.failed}/10 failed. Candidate: ${strawberry.groups.after.passed}/10 passed, ${strawberry.groups.after.failed}/10 failed. Complete per-run statuses, failure messages, dates, source pins, and the original test hash are in [strawberry-repeat.json](load-time-2026-10/strawberry-repeat.json). Pilot or interrupted batches are excluded.`,
  "",
  `In the separate current-test batch with the upstream readiness fix, the strawberry section passed ${currentStrawberry.groups.before.strawberry.passed}/10 on main and ${currentStrawberry.groups.after.strawberry.passed}/10 on the candidate. Strawberry-section failures: ${currentStrawberry.groups.before.strawberry.failed} main, ${currentStrawberry.groups.after.strawberry.failed} candidate; unclassified outcomes: ${currentStrawberry.groups.before.strawberry.unknown} main, ${currentStrawberry.groups.after.strawberry.unknown} candidate. The full composite test, which continues through Lantern and Jelly blob, passed ${currentStrawberry.groups.before.passed}/10 on main (${currentStrawberry.groups.before.failed} failures) and ${currentStrawberry.groups.after.passed}/10 on the candidate (${currentStrawberry.groups.after.failed} failures). Every later failure and its source location remains recorded. Section completion is inferred only from a passed full test or a failure after that section. Distinct test hashes and complete ten-run receipts are retained; the two versions are not pooled, and differing observed rates are not proof of equal underlying rates.`,
  "",
  "The retained failure traces show why this is sensitive to wall time: one original main return-frame screenshot took 26,841 ms, longer than the entire 15,000 ms poll. In the branch failure, the two return-frame screenshots took 4,029 and 6,027 ms. These are timings from the existing Playwright traces, with no added observer. The fixed test waits for camera and pulse readiness before entering that image poll; the animation clock and pixel thresholds are unchanged.",
  "",
  "Current main independently changed this smoke test to wait for its camera to settle and for its animation pulse to finish before comparing return frames. Those upstream changes arrived through an ordinary merge; this PR does not edit the protected test. The ten-per-source comparison deliberately uses the earlier, unchanged test, so the result does not come from relaxing that predicate. [Earlier observed failures](load-time-2026-10/superseded/round3-strawberry-timing.json) on both sources expired with the pulse still running (1.8667 and 1.9332 of its 2.2 simulation seconds). That observation explains why a 15-second wall-time poll can miss the end on a slow software renderer; it is historical evidence with its own source pins, not a new rate measurement.",
  "",
  "## Visual and regression evidence",
  "",
  `${images.length} prior GPU-finished comparisons remain in [image-diffs.json](load-time-2026-10/image-diffs.json): 49 are pixel-identical; the desktop book differs at eight pixels by at most one RGB level. Every recorded tap pose moved. Their original capture source pins remain intact. The eager fallback changes discovery order; the final three scan fallbacks restore the original data files. At measured fallback revision 30ed36e5, the 13 shared renderer, rig, camera, entry, and help files are unchanged from the repeated-test source and frozen main. The exact-buffer and decoded-byte tests verify the retained lossless data. Lossy point-budget alternatives remain unshipped in [lossy-options.json](load-time-2026-10/lossy-options.json).`,
  "",
  `Required regression results: ${verification.required.passed} passed, ${verification.required.failed} failed, and ${verification.required.skipped} skipped. ${verification.required.processFailures.length} spec processes returned a nonzero exit code.`,
  "",
  ...verification.required.groups.flatMap((group) =>
    group.cases
      .filter((row) => !["passed", "skipped"].includes(row.status))
      .map((row) => `- ${group.name}: ${row.title} — ${row.status}.`),
  ),
  "",
  "Latest validation, all red tests by name, commands, source pins, and protected-file checks are in [verification.json](load-time-2026-10/verification.json). These required smoke, taps, kit, unit, Real Objects, and load-time results belong to measured fallback source 30ed36e5. The repeated Strawberry runs retain their actual earlier source pins; the scan-selector fallback and later upstream main merge did not change the shared rig, camera, renderer, or clock files. Historical validation is labeled by its actual source and is not counted as this run.",
  "",
  ...(postMerge
    ? [
        `After the final main merge and manual refresh, ${postMerge.required.passed} tests passed, ${postMerge.required.failed} failed, and ${postMerge.required.skipped} were skipped on \`${postMerge.validationSource}\`. The scope repeats smoke, taps, kit, unit, Real Objects, all load-time specs, and help. The captured-toy embed transfer check remains below 30 MB. ${postMerge.required.processFailures.length} spec processes returned a nonzero exit code. The complete cases and commands are retained separately from the earlier run.`,
        ...postMerge.required.groups.flatMap((group) =>
          group.cases
            .filter((row) => !["passed", "skipped"].includes(row.status))
            .map((row) => `- ${group.name}: ${row.title} — ${row.status}.`),
        ),
        "",
      ]
    : []),
  "| Lossless PDF source | Original bytes | Gzip bytes | Saving |",
  "| --- | ---: | ---: | ---: |",
);
for (const r of compression)
  lines.push(
    `| ${r.source} | ${fmt(r.sourceBytes)} | ${fmt(r.bytes)} | ${((1 - r.bytes / r.sourceBytes) * 100).toFixed(1)}% |`,
  );
lines.push(
  "",
  "Hashes and unchanged-byte proofs are in [compressed-opening.json](load-time-2026-10/compressed-opening.json), [prefixes.json](load-time-2026-10/prefixes.json), and [museum-prefixes.json](load-time-2026-10/museum-prefixes.json). Asset licenses, notices, and NC tags remain unchanged. No new asset source was introduced by this review change.",
  "",
  "## Method and limits",
  "",
  "Phone: 390×844, DPR 3, touch/mobile, weak/low. Desktop: 1440×900, DPR 1, high. Chromium 151, WebGL2 through Linux llvmpipe, three Mesa threads, four CPU quota, nice 10, display :99. Sound and adaptation are off; seed is 424242. This is one software-rendering device using phone and desktop settings, not a physical phone or the earlier Mac/Metal device. First frame is navigation through the first submitted postrender after the requested toy becomes ready.",
  "",
  "Payload counts completed HTTP bodies at a 1.5-second settling cutoff and excludes headers, unfinished responses, and blob/data URLs. Local plain-server bodies are not public transfer sizes. Historical public per-file GETs in [production-transport.json](load-time-2026-10/production-transport.json) showed that Pages already compresses native JavaScript; custom engine and help gzip loading have both been removed. The candidate data files have not been deployed, and their public transfer savings are unmeasured.",
  "",
  "Serve frozen main on 4174 and candidate on 4173. Run `node tools/load-time-paired.mjs --only=ID,ID --device=phone --samples=5 --out=DIR --frozen-main=COMMIT --candidate-source=COMMIT`. Run the four reviewed toys at both settings in a separate directory. `node tools/load-time-report.mjs --timing=DIR --payload=DIR --fallback=DIR` validates complete groups and source pins, then writes this single current table. Raw request traces, repeated-test JSON, and browser artifacts stay outside Git; the compact audit remains strictly below 3,000,000 bytes.",
  "",
  "Older numeric screens and verification receipts are superseded, with their source metadata retained. The original heavy set is retained for comparison; the full catalog has not been rescreened on current main. No frame-cadence or heap claim is made. Protected PLY assets remain unchanged, so the unused-column option is still deferred.",
  "",
  "Rule check: the prior unpublished email metadata history rewrite conflicts with E1. All subsequent review changes, including the current main merge, are additive.",
  "",
);
fs.writeFileSync(`${dir}.md`, lines.join("\n"));
console.log({
  groups: rows.length,
  combinedSaving: (1 - after / before) * 100,
  higherMedians: higher.map((r) => r.k),
});
