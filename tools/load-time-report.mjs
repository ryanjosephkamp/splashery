// Task 51: publish compact summaries; all request traces and captures stay outside Git.
import fs from "node:fs";
const dir = "docs/audits/load-time-2026-10";
const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const read = (file) => JSON.parse(fs.readFileSync(file));
const summarize = (r) => ({
  id: r.id,
  label: r.label,
  labs: r.labs,
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
const stats = (rows) => {
  const times = rows.map((r) => r.firstFrameMs).sort((a, b) => a - b);
  return {
    n: times.length,
    median: (times[Math.floor((times.length - 1) / 2)] + times[Math.floor(times.length / 2)]) / 2,
    min: times[0],
    max: times.at(-1),
    bytes: Math.round(rows.reduce((n, r) => n + r.bytes, 0) / rows.length),
    requests: Math.round(rows.reduce((n, r) => n + r.requests, 0) / rows.length),
  };
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const ms = (n) => n.toFixed(1);
const groups = (rows) => [...new Set(rows.map((r) => `${r.device}:${r.id}`))];
function loadRun(root) {
  if (!fs.existsSync(`${root}/before.json`) || !fs.existsSync(`${root}/after.json`)) return null;
  const data = {
    before: read(`${root}/before.json`).map(summarize),
    after: read(`${root}/after.json`).map(summarize),
    method: {
      before: read(`${root}/before-method.json`),
      after: read(`${root}/after-method.json`),
    },
  };
  if (
    data.method.before.frozenMain !== data.method.after.frozenMain ||
    data.method.before.candidateSource !== data.method.after.candidateSource
  )
    throw Error(`Before/after source references differ: ${root}`);
  const beforeGroups = groups(data.before).sort();
  const afterGroups = groups(data.after).sort();
  if (!beforeGroups.length || JSON.stringify(beforeGroups) !== JSON.stringify(afterGroups))
    throw Error(`Before/after groups differ: ${root}`);
  for (const phase of ["before", "after"])
    for (const k of groups(data[phase])) {
      const rows = data[phase].filter((r) => `${r.device}:${r.id}` === k);
      if (
        rows.length < 5 ||
        rows.some(
          (r) =>
            r.status !== "ok" ||
            !Array.isArray(r.errors) ||
            r.errors.length ||
            !Number.isFinite(r.firstFrameMs) ||
            r.firstFrameMs <= 0 ||
            !Number.isFinite(r.bytes) ||
            r.bytes <= 0 ||
            !Number.isFinite(r.requests),
        ) ||
        JSON.stringify(rows.map((r) => r.sample).sort((a, b) => a - b)) !==
          JSON.stringify(Array.from({ length: rows.length }, (_, i) => i)) ||
        rows.length !==
          data[phase === "before" ? "after" : "before"].filter((r) => `${r.device}:${r.id}` === k)
            .length
      )
        throw Error(`Incomplete or failed five-run group: ${phase}:${k}`);
    }
  return data;
}
const timing = loadRun(option("timing", "../load-time-runs/review-timing-pyrite"));
const payload = loadRun(option("payload", "../load-time-runs/review-top20"));
if (
  payload &&
  (groups(payload.before).length !== 20 ||
    payload.before.some((r) => r.device !== "phone") ||
    groups(payload.before).some(
      (k) => payload.before.filter((r) => `${r.device}:${r.id}` === k).length !== 5,
    ))
)
  throw Error("The payload run must contain exactly 20 phone groups.");
if (timing) fs.writeFileSync(`${dir}/review-timing.json`, JSON.stringify(timing, null, 2) + "\n");
if (payload) fs.writeFileSync(`${dir}/review-top20.json`, JSON.stringify(payload, null, 2) + "\n");
const historical = {
  before: read(`${dir}/before-summary.json`),
  after: read(`${dir}/after-summary.json`),
};
const images = read(`${dir}/image-diffs.json`),
  lossy = read(`${dir}/lossy-options.json`);
const compression = read(`${dir}/compressed-opening.json`),
  museum = read(`${dir}/museum-prefixes.json`);
const verification = read(`${dir}/verification.json`).reviewValidation;
const lines = [
  "# Load-time audit — October 14, 2026",
  "",
  "Codex built the lossless changes and this audit on `codex/load-time`. This revision addresses [the Operator's review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6153708959).",
  "",
  "## Changes and exactness",
  "",
  "- Museum scans fetch alongside their deferred helpers. A browser test holds the helper response and verifies that the scan transfer has already started.",
  "- Shared Real objects and museum scans load their helper module eagerly after the engine mapping is installed and before GPU initialization. Browser checks observe the actual WebGL-context creation order for both `j.` and `d.` links and verify that only the compressed engine transfers. Unrelated toys still defer the helper. The async ES-module bootstrap starts the engine request while a stylesheet blocks DOM readiness.",
  "- The engine's complete, unchanged 2.22.3 source loads through a native import-map alias and `src/pc.js`. All 1,318 exports, including the live `app` binding, are checked in a browser. Unsupported decompression or import-map additions retain the original URL. Custom elements retain their original module path.",
  "- Help and the manual use exact gzip copies. The full help text, PDF pages, and notices are retained. The manual transfers while PDF.js loads.",
  "- Five Real objects recipes retain exact low/mid scan records and original population counts. The globe, armillary, Stannern, and Pyrite low-tier files also retain exact Float64 means computed over every original record. Larger budgets retain full scans. No rendered count, camera, texture, or color precision was reduced.",
  "- The mapped engine retains a module preload. Selected scans start their normal recipe preparation before GPU setup, with the same profile, budget, and options; the later build reuses the cached scan. Browser checks observe the actual transfer before WebGL-context creation, and the preload's completion while the app entry is held.",
  "",
  "| Exact gzip source | Original bytes | Compressed bytes | Saving |",
  "| --- | ---: | ---: | ---: |",
];
for (const r of compression)
  lines.push(
    `| ${r.source} | ${fmt(r.sourceBytes)} | ${fmt(r.bytes)} | ${((1 - r.bytes / r.sourceBytes) * 100).toFixed(1)}% |`,
  );
lines.push(
  "",
  "| Additional scan | Original bytes | Opening bytes | License |",
  "| --- | ---: | ---: | --- |",
);
for (const r of museum)
  lines.push(`| ${r.id} | ${fmt(r.beforeBytes)} | ${fmt(r.afterBytes)} | ${r.credit.license} |`);
lines.push(
  "",
  "Hashes and unchanged-byte checks are in [compressed-opening.json](load-time-2026-10/compressed-opening.json). Museum hashes, transformations, and inherited credits are in [museum-prefixes.json](load-time-2026-10/museum-prefixes.json). Armillary and Stannern's live pages were opened on October 13, 2026. On October 14, 2026, Pyrite's model page returned 503; its [live model API](https://api.sketchfab.com/v3/models/0b7c6e8e32144b72806ed31cb49b4145) confirmed CC0 and Digital Atlas of Ancient Life. Stannern retains its NC tag and in-app notice.",
  "",
  "## Reviewed timing increases",
  "",
);
if (timing) {
  const sunglassesSamples = timing.before.filter(
    (r) => r.id === "sunglasses" && r.device === "phone",
  ).length;
  lines.push(
    `Sources: baseline main \`${timing.method.before.frozenMain}\`; frozen candidate \`${timing.method.after.candidateSource}\`.`,
    "",
    `One fresh browser and context per opening, with each toy/setting's before/after pair adjacent. Phase order alternates on each pass. At least five observations per phase/setting; each row lists its sample count, median, and range in milliseconds.${sunglassesSamples === 15 ? " Phone Sunglasses was extended to a fixed 15 pairs after its first five had overlapping ranges and a higher median; every observation is retained." : ""}`,
    "",
    "| Toy | Setting | Samples per phase | Before median (range) | After median (range) | Change |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  );
  for (const k of groups(timing.before)) {
    const a = stats(timing.before.filter((r) => `${r.device}:${r.id}` === k)),
      b = stats(timing.after.filter((r) => `${r.device}:${r.id}` === k));
    lines.push(
      `| ${k.split(":")[1]} | ${k.split(":")[0]} | ${a.n} | ${ms(a.median)} (${ms(a.min)}–${ms(a.max)}) | ${ms(b.median)} (${ms(b.min)}–${ms(b.max)}) | ${((b.median / a.median - 1) * 100).toFixed(1)}% |`,
    );
  }
  const originalBefore = stats(
    timing.before.filter((r) => r.id === "sunglasses" && r.device === "phone" && r.sample < 5),
  );
  const originalAfter = stats(
    timing.after.filter((r) => r.id === "sunglasses" && r.device === "phone" && r.sample < 5),
  );
  lines.push(
    "",
    `Phone Sunglasses' original five-pair medians were ${ms(originalBefore.median)} → ${ms(originalAfter.median)} ms (${((originalAfter.median / originalBefore.median - 1) * 100).toFixed(1)}%). The extended sample does not remove or replace those observations.`,
    "The ten added pairs were collected after validation, in a later session where both phases often took longer. Adjacent pairs and alternating order reduce phase bias, but the combined 15-pair median mixes those time windows. It is not a claim that the original five-pair increase disappeared.",
  );
} else
  lines.push(
    "Final paired measurements are pending. Earlier five-run observations are retained in compact summaries under `paired/`.",
  );
lines.push(
  "",
  "Pyrite's museum path serialized helper loading before scan fetching; the parallel transfer removes that dependency. Soda can, Sunglasses, and Fountain pen inherited a later helper import after the catalog stopped loading it eagerly: traces showed the selected pack waiting until after renderer initialization. Their helpers now transfer independently of the app graph and finish before GPU setup. Their scan data also starts transferring before WebGL initialization, with the original recipe choosing its profile, budget, and options. The first compressed bootstrap deferred its engine request behind DOM/style readiness and omitted the original engine preload; async module startup and the mapped preload restore early transfer and compilation. Pyrite additionally uses exact full-scan means to avoid recalculating smoothing over unrendered records. Original observations had large delays on unchanged controls after GPU/display/execution-service interruptions. Those are measurement limits, not proof that every earlier increase had a code cause. New immediate pairs and fresh browsers avoid shared-browser code-cache and phase drift; any final measured increases remain explicit.",
  "",
  "## The 20 heaviest phone openings",
  "",
);
if (payload) {
  const ranked = groups(payload.before)
    .map((k) => ({
      k,
      before: stats(payload.before.filter((r) => `${r.device}:${r.id}` === k)),
      after: stats(payload.after.filter((r) => `${r.device}:${r.id}` === k)),
    }))
    .sort((a, b) => b.before.bytes - a.before.bytes);
  const before = ranked.reduce((n, r) => n + r.before.bytes, 0),
    after = ranked.reduce((n, r) => n + r.after.bytes, 0);
  lines.push(
    `Sources: baseline main \`${payload.method.before.frozenMain}\`; frozen candidate \`${payload.method.after.candidateSource}\`. The set is the initial full-catalog screen's 20 heaviest phone toys; bytes and requests below are means over five openings, and timings are medians.`,
    "",
    `Combined bytes: ${fmt(before)} → ${fmt(after)} (${((1 - after / before) * 100).toFixed(1)}% saving). ${ranked.filter((r) => r.after.bytes <= r.before.bytes * 0.75).length}/${ranked.length} individually meet 25%.`,
    "",
    `${ranked.filter((r) => r.after.median > r.before.median).length}/${ranked.length} have a higher measured first-frame median in this five-pair payload screen. The task's no-slower-opening target is not established. These observations are retained; they are not discarded as noise or replaced by the historical full-catalog results.`,
    "",
    "| Toy | Before bytes | After bytes | Saving | Requests before → after | First frame before → after (ms) |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const r of ranked)
    lines.push(
      `| ${r.k.split(":")[1]} | ${fmt(r.before.bytes)} | ${fmt(r.after.bytes)} | ${((1 - r.after.bytes / r.before.bytes) * 100).toFixed(1)}% | ${r.before.requests} → ${r.after.requests} | ${ms(r.before.median)} → ${ms(r.after.median)} |`,
    );
} else
  lines.push(
    "Final top-20 observations are pending. The initial revision saved 2.1% combined; it did not meet the target.",
  );
lines.push(
  "",
  "The 1.33 MiB unused-normal PLY opportunity from [task 06](perf-2026-10.md) is deferred: PR #562's protected manifest pins the original `liberty.ply` checksum. Its default loading path is also protected. Changing that input would invalidate the manifest. Existing SOG captures already compress the fields they draw; reducing their rendered points or texture precision would alter the look. These limits are separate from lossless code/manual compression.",
  "",
  "## Image evidence",
  "",
  `${images.length} comparisons have ${images.reduce((n, r) => n + r.differentPixels, 0)} changed RGBA pixels, with ${images.filter((r) => r.tapChangedPixels > 0).length} moved tap poses. Full PNGs, diffs, and request traces are outside Git; SHA-256 values and comparison results are retained in [image-diffs.json](load-time-2026-10/image-diffs.json). Identical before/after PNG bytes share a single retained representative file.`,
  "The desktop book pair is visually identical: eight of 964,800 pixels differ by at most one RGB level (RMS 0.00288). Both stills were inspected, and the original PDF and decoded gzip copy are byte-identical. Its before/after stills and amplified diff are retained. Every scan comparison remains pixel-identical.",
  "",
  "| Toy | Setting | Pose | Changed pixels | Representative |",
  "| --- | --- | --- | ---: | --- |",
);
for (const r of images)
  lines.push(
    `| ${r.id} | ${r.device} | ${r.pose} | ${r.differentPixels} | ${r.preview ? `[Identical still](load-time-2026-10/images/${r.preview})` : r.previewBefore ? `[Before](load-time-2026-10/images/${r.previewBefore}), [after](load-time-2026-10/images/${r.previewAfter}), [diff](load-time-2026-10/images/${r.diffPreview})` : "Regenerate from script"} |`,
  );
lines.push(
  "",
  "Captures use seed 424242, preset cameras, frozen production clocks, the actual one-second tap decay, explicit center resets/resorting, at least 12 frame-end events, and a settling delay. The revised capture waits for WebGL completion with `gl.finish()` before saving. This is separate from opening timing: the task-06 first-frame metric remains a ready submitted `postrender`, not a GPU-completion timing.",
  "",
  "## Lossy options — not shipped",
  "",
  "These remain owner decision examples. A 45,000 recipe budget replaces 90,000 in the capture tool only; the current asset transfer is unchanged. Smaller data files would be needed for wire savings.",
  "",
  "| Toy | Before | After | Changed pixels |",
  "| --- | --- | --- | ---: |",
);
for (const r of lossy)
  lines.push(
    `| ${r.id} | [90,000](load-time-2026-10/images/${r.before.file}) | [45,000](load-time-2026-10/images/${r.after.file}) | ${fmt(r.differentPixels)} |`,
  );
lines.push(
  "",
  "## Method, limits, and reproduction",
  "",
  "Phone: 390×844, DPR 3, touch/mobile, weak/low. Desktop: 1440×900, DPR 1, high. WebGL2, adaptation and sound off, seed 424242, preset camera, unthrottled localhost, disabled HTTP cache, and blocked service workers. Linux Chromium 151/Mesa llvmpipe differs from task 06's Mac/Metal and is not a physical-phone measurement. Only one rendering page runs at a time; no unrelated CPU-heavy work should run during the final timing collection.",
  "",
  "Opening bytes count completed HTTP bodies at a snapshot after a real 1.5-second delay. They exclude headers, blob/data URLs, and incomplete bodies. Worker timing is approximate. The local server does not apply HTTP compression; live Pages wire totals can differ. Idle/tap cadence and a heap census were not repeated.",
  "",
  "Serve archived baseline main on port 4174 and the frozen candidate on 4173. `tools/load-time-audit.mjs` and `tools/load-time-paired.mjs` accept `--only=ID,ID`, `--device=phone`, `--samples=5`, `--out=DIR`, `--frozen-main=COMMIT`, and `--candidate-source=COMMIT`. Their defaults save raw runs beside the repository, not under `docs/audits/`. Run with `DISPLAY=:93 LP_NUM_THREADS=2 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium nice -n 10`. The paired script creates a fresh browser per opening and alternates each adjacent pair.",
  "",
  "`tools/load-time-visuals.mjs --out=DIR --frozen-main=COMMIT --candidate-source=COMMIT` writes full captures outside Git. `tools/load-time-publish-visuals.mjs --visuals=DIR` retains representative stills and hashes after checking 50 visually identical comparisons and GPU completion. `tools/load-time-prefixes.mjs`, `tools/load-time-smoothing.mjs`, and `tools/load-time-compress.mjs` regenerate production files. `tools/load-time-report.mjs --timing=DIR --payload=DIR` publishes compact summaries and tables. No raw request JSON or bulk captures belong in this task's audit tree.",
  "",
  "## Verification and scope",
  "",
  "[verification.json](load-time-2026-10/verification.json) preserves the original 160-test run, separate recovery checks, image hashes, and method limits. The initial broad run's strawberry image threshold failure is retained; isolated baseline/candidate runs and the later 160-test run passed.",
  ...(verification
    ? [
        "",
        `Review validation on merged source \`${verification.source}\`, including main \`${verification.integratedMain}\`: the requested suite recorded ${verification.suite.stats.expected} passed, ${verification.suite.stats.unexpected} failed, ${verification.suite.stats.skipped} skipped, and ${verification.suite.stats.flaky} flaky. It includes smoke, taps, kit, unit, Real Objects, and every load-time spec. ${verification.rerunNote} ${verification.packNote} The NC check passed. The embed transfer ceiling remains green. Measurements and captures use frozen runtime \`${verification.measuredSource}\`; the merge leaves its optimized runtime files unchanged.`,
        "",
        "The Real Objects walkthrough passed in isolation. The kit catalog still exceeded its 10-minute deadline, and the scan-rig strawberry return-to-rest check failed twice on this branch while passing on frozen main. The latter remains an unresolved regression check. Frozen main also exceeded the pack speed threshold for 10 builds, versus eight in the idle candidate check; neither reported non-finite geometry.",
        ...(verification.latestIntegration
          ? [
              "",
              `Later main \`${verification.latestIntegration.main}\` adds QR work and documentation. On integrated source \`${verification.latestIntegration.source}\`, unit, taps, every load-time spec, and the two new QR specs recorded ${verification.latestIntegration.stats.expected} passed, ${verification.latestIntegration.stats.unexpected} failed, and ${verification.latestIntegration.stats.skipped} skipped. The full smoke, kit, and Real Objects specs were not repeated after this later merge. Optimized runtime files remain unchanged; the frozen measurements exclude the incoming QR changes.`,
            ]
          : []),
        "",
        "The revised runtime was measured for the 20 heaviest phone openings and the four reviewed toys on phone and desktop; the historical full-catalog screen was not repeated. These observations do not establish that every toy opens sooner on physical phones. Capture recovery preserved completed rows after a renderer exit; the final ten mid-tier pairs use a fixed canvas crop to avoid an element-stability timeout. All captures use the same canvas dimensions and GPU fence.",
      ]
    : []),
  "",
  "Protected paths are PRs #560, #562, #566, #581, and #582. Their union was refreshed before the review changes. No renderer version, production budget, original scan, protected PLY, or protected code file is changed. The exact compressed helper derives from the protected original without editing it.",
  "",
  "<details>",
  "<summary>Initial complete catalog matrix (historical)</summary>",
  "",
  "This screen compares frozen main `49c809b4` with the initial measured runtime `2c229dbd` (tree-identical published `b9c081a6`). It is not the revised runtime. The 924 observations per phase remain in compact [before](load-time-2026-10/before-summary.json) and [after](load-time-2026-10/after-summary.json) summaries; their raw request records are regenerated by the collector, not committed.",
  "",
  "| Toy | Setting | Bytes before → after | Requests | Submitted first frame ms |",
  "| --- | --- | ---: | ---: | ---: |",
);
for (const a of historical.before) {
  const b = historical.after.find((r) => r.id === a.id && r.device === a.device);
  lines.push(
    `| ${a.id} | ${a.device} | ${fmt(a.bytes)} → ${fmt(b.bytes)} | ${a.requestCount} → ${b.requestCount} | ${ms(a.firstFrameMs)} → ${ms(b.firstFrameMs)} |`,
  );
}
lines.push(
  "",
  "</details>",
  "",
  "Rule check: prior unpublished email-metadata history rewrite conflicts with E1; the review changes use additive commits and do not rewrite published history.",
  "",
);
fs.writeFileSync(`${dir}.md`, lines.join("\n"));
