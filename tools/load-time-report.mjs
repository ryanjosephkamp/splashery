// Task 51: publish compact summaries; all request traces and captures stay outside Git.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
  };
  const beforeGroups = groups(data.before).sort();
  const afterGroups = groups(data.after).sort();
  if (!beforeGroups.length || JSON.stringify(beforeGroups) !== JSON.stringify(afterGroups))
    throw Error(`Before/after groups differ: ${root}`);
  for (const phase of ["before", "after"])
    for (const k of groups(data[phase])) {
      const rows = data[phase].filter((r) => `${r.device}:${r.id}` === k);
      if (
        rows.length !== 5 ||
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
        JSON.stringify(rows.map((r) => r.sample).sort((a, b) => a - b)) !== "[0,1,2,3,4]"
      )
        throw Error(`Incomplete or failed five-run group: ${phase}:${k}`);
    }
  return data;
}
const timing = loadRun(option("timing", "../load-time-runs/review-timing"));
const payload = loadRun(option("payload", "../load-time-runs/review-top20"));
if (
  payload &&
  (groups(payload.before).length !== 20 || payload.before.some((r) => r.device !== "phone"))
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
const lines = [
  "# Load-time audit — October 13, 2026",
  "",
  "Codex built the lossless changes and this audit on `codex/load-time`. This revision addresses [the Operator's review](https://github.com/ryanjosephkamp/splashery/pull/588#issuecomment-6153708959).",
  "",
  "## Changes and exactness",
  "",
  "- Museum scans fetch alongside their deferred helpers. A browser test holds the helper response and verifies that the scan transfer has already started.",
  "- The engine's complete, unchanged 2.22.3 source loads through a native import-map alias and `src/pc.js`. All 1,318 exports, including the live `app` binding, are checked in a browser. Unsupported decompression or import-map additions retain the original URL. Custom elements retain their original module path.",
  "- Help and the manual use exact gzip copies. The full help text, PDF pages, and notices are retained. The manual transfers while PDF.js loads.",
  "- Five Real objects recipes retain exact low/mid scan records and original population counts. The globe, armillary, and Stannern low-tier files also retain exact Float64 means computed over every original record. Larger budgets retain full scans. No rendered count, camera, texture, or color precision was reduced.",
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
  "Hashes and unchanged-byte checks are in [compressed-opening.json](load-time-2026-10/compressed-opening.json). Museum hashes, transformations, and inherited credits are in [museum-prefixes.json](load-time-2026-10/museum-prefixes.json). The live pages were opened on October 13, 2026; Stannern retains its NC tag and in-app notice.",
  "",
  "## Reviewed timing increases",
  "",
);
if (timing) {
  lines.push(
    "One fresh browser and context per opening, with each toy/setting's before/after pair adjacent. Phase order alternates on each pass. Five observations per phase/setting; median and range in milliseconds.",
    "",
    "| Toy | Setting | Before median (range) | After median (range) | Change |",
    "| --- | --- | ---: | ---: | ---: |",
  );
  for (const k of groups(timing.before)) {
    const a = stats(timing.before.filter((r) => `${r.device}:${r.id}` === k)),
      b = stats(timing.after.filter((r) => `${r.device}:${r.id}` === k));
    lines.push(
      `| ${k.split(":")[1]} | ${k.split(":")[0]} | ${ms(a.median)} (${ms(a.min)}–${ms(a.max)}) | ${ms(b.median)} (${ms(b.min)}–${ms(b.max)}) | ${((b.median / a.median - 1) * 100).toFixed(1)}% |`,
    );
  }
} else
  lines.push(
    "Final paired measurements are pending. Earlier five-run observations are retained in compact summaries under `paired/`.",
  );
lines.push(
  "",
  "The initial Pyrite path serialized helper loading before scan fetching; this dependency is removed. The earlier larger increases also contained delays before the helper request and after the scan completed. Unchanged controls slowed after GPU/display/execution-service interruptions. Those observations do not isolate a per-toy code cause. New immediate pairs and fresh browsers avoid shared-browser code-cache and phase drift; final measured increases, if any, must remain explicit.",
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
    `Combined bytes: ${fmt(before)} → ${fmt(after)} (${((1 - after / before) * 100).toFixed(1)}% saving). ${ranked.filter((r) => r.after.bytes <= r.before.bytes * 0.75).length}/${ranked.length} individually meet 25%.`,
    "",
    "| Toy | Before bytes | After bytes | Saving |",
    "| --- | ---: | ---: | ---: |",
  );
  for (const r of ranked)
    lines.push(
      `| ${r.k.split(":")[1]} | ${fmt(r.before.bytes)} | ${fmt(r.after.bytes)} | ${((1 - r.after.bytes / r.before.bytes) * 100).toFixed(1)}% |`,
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
  "The original 40 comparisons had zero changed RGBA pixels, with 19 moved tap poses. Full PNGs, diffs, and request traces are outside Git; SHA-256 values and comparison results are retained in [image-diffs.json](load-time-2026-10/image-diffs.json). Identical before/after PNG bytes share a single retained representative file.",
  "",
  "| Toy | Setting | Pose | Changed pixels | Representative |",
  "| --- | --- | --- | ---: | --- |",
);
for (const r of images)
  lines.push(
    `| ${r.id} | ${r.device} | ${r.pose} | ${r.differentPixels} | ${r.preview ? `[Identical still](load-time-2026-10/images/${r.preview})` : "Regenerate from script"} |`,
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
  "Serve archived baseline main on port 4174 and the frozen candidate on 4173. `tools/load-time-audit.mjs` and `tools/load-time-paired.mjs` accept `--only=ID,ID`, `--device=phone`, `--samples=5`, `--out=DIR`, `--frozen-main=COMMIT`, and `--candidate-source=COMMIT`. Their defaults save raw runs beside the repository, not under `docs/audits/`. Run with `DISPLAY=:92 LP_NUM_THREADS=2 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium nice -n 10`. The paired script creates a fresh browser per opening and alternates each adjacent pair.",
  "",
  "`tools/load-time-visuals.mjs --out=DIR` writes full captures outside Git. `tools/load-time-prefixes.mjs`, `tools/load-time-smoothing.mjs`, and `tools/load-time-compress.mjs` regenerate production files. `tools/load-time-report.mjs --timing=DIR --payload=DIR` publishes compact summaries and tables. No raw request JSON or bulk captures belong in this task's audit tree.",
  "",
  "## Verification and scope",
  "",
  "[verification.json](load-time-2026-10/verification.json) preserves the original 160-test run, separate recovery checks, image hashes, and method limits. The initial broad run's strawberry image threshold failure is retained; isolated baseline/candidate runs and the later 160-test run passed. Final review validation is recorded separately when complete.",
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
