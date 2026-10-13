// Generate task 51's source-backed report after the full cold-opening matrix.
import fs from "node:fs";
import { TOYS } from "../src/toys.js";

const dir = "docs/audits/load-time-2026-10";
const read = (name) => JSON.parse(fs.readFileSync(`${dir}/${name}`));
const before = read("before.json");
const after = read("after.json");
const images = read("image-diffs.json");
const lossy = read("lossy-options.json");
const prefixes = read("prefixes.json");
const smoothing = read("smoothing-prefix.json");
const pairedBefore = fs.existsSync(`${dir}/paired/before.json`) ? read("paired/before.json") : [];
const pairedAfter = fs.existsSync(`${dir}/paired/after.json`) ? read("paired/after.json") : [];
const key = (r) => `${r.device}:${r.id}`;
const b = new Map(before.filter((r) => r.sample === 0).map((r) => [key(r), r]));
const a = new Map(after.filter((r) => r.sample === 0).map((r) => [key(r), r]));
for (const toy of TOYS)
  for (const device of ["phone", "desktop"])
    if (!b.has(`${device}:${toy.id}`) || !a.has(`${device}:${toy.id}`))
      throw new Error(`Missing matrix cell: ${device}:${toy.id}`);
if (
  images.length !== 40 ||
  images.some((r) => r.differentPixels !== 0 || (r.pose === "tap" && !r.tapChangedPixels))
)
  throw new Error("Visual equality or moved-pose coverage is incomplete");
const ok = (r) => r?.status === "ok";
const cells = [...b].map(([k, r]) => ({ before: r, after: a.get(k) }));
const phone = cells.filter((r) => r.before.device === "phone" && ok(r.before) && ok(r.after));
const saving = (r) =>
  ok(r.before) && ok(r.after) ? ((r.before.bytes - r.after.bytes) / r.before.bytes) * 100 : null;
const meetsTarget = (r) => saving(r) !== null && saving(r) >= 25;
const heavy = cells
  .filter((r) => r.before.device === "phone" && ok(r.before))
  .sort((x, y) => y.before.bytes - x.before.bytes)
  .slice(0, 20);
const heavyTotals = heavy.every((r) => ok(r.after))
  ? {
      before: heavy.reduce((sum, r) => sum + r.before.bytes, 0),
      after: heavy.reduce((sum, r) => sum + r.after.bytes, 0),
    }
  : null;
const slower = cells.filter(
  (r) => ok(r.before) && ok(r.after) && r.after.firstFrameMs > r.before.firstFrameMs * 1.1 + 100,
);
const errors = cells.filter(
  (r) => !ok(r.before) || !ok(r.after) || r.before.errors.length || r.after.errors.length,
);
const oversizedPhone = phone.filter((r) => r.after.bytes > 15_000_000);
const largeBodies = new Map();
for (const r of cells)
  for (const request of r.after.network || [])
    if (request.body > 20_000_000) largeBodies.set(new URL(request.url).pathname, request.body);
const number = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
const time = (n) => (n == null ? "—" : n.toFixed(1));
const imageLink = (name, label) => `[${label}](load-time-2026-10/images/${name})`;
const method = read("before-method.json");
const afterMethod = read("after-method.json");
const lines = [
  "# Load-time audit — October 13, 2026",
  "",
  "Codex built these changes and this audit on `codex/load-time`.",
  "",
  `- Frozen main: \`${method.frozenMain}\`.`,
  `- Measured runtime source: \`${afterMethod.candidateSource}\`; later commits add audit evidence and tests and integrate newer main.`,
  `- Coverage: ${TOYS.filter((t) => !t.labs).length} public and ${TOYS.filter((t) => t.labs).length} labs toys, at both task 06 settings.`,
  "- Five recipes transfer only the exact scan records their low or mid budget uses; their original population count and rendered buffers are preserved.",
  "- Unrelated toys defer Real objects helpers; GIF encoding loads only for a GIF export.",
  "- The celestial globe transfers exact used records and exact full-scan smoothing means in a gzip file on the low tier, avoiding the unused neighbors' transfer and repeated averaging.",
  "- All 40 before/after image pairs have zero changed RGBA pixels; every tap capture also differs from its rest pose.",
  `- The 25% target for the 20 heaviest phone openings: ${heavy.filter(meetsTarget).length}/20 meet it. ${heavy.length === 20 && heavy.every(meetsTarget) ? "Met." : "Not met."}`,
  ...(heavyTotals
    ? [
        `- Combined opening bytes for that same top 20: ${number(heavyTotals.before)} → ${number(heavyTotals.after)} (${((1 - heavyTotals.after / heavyTotals.before) * 100).toFixed(1)}% saving).`,
      ]
    : []),
  `- Single-run timing screening flags ${slower.length} cells above a 10% plus 100 ms increase; it does not establish the no-slower-first-frame target.`,
  `- ${errors.length} cells have readiness or console errors; details remain in the raw matrix.`,
  "",
  "## What changed and why it stays identical",
  "",
  "The opening files copy each used 14-byte ROS1 record without quantization, reordering, recoloring, or changing the recipe budget. ROP1 retains the original population count for the same `sqrt(n / m)` size adjustment and stores a separate loaded capacity. The full scans remain available for larger budgets, saved scenes, and existing tools. Running shoe needs its complete scan for color smoothing; hoodie uses its tail to close holes, so both keep full files.",
  "",
  "Low budgets use up to 90,000 recipe splats; mid budgets use up to 210,000. Each file retains only the recipe's used share. Unknown or larger budgets use the full scan. The cache retains the largest completed capacity so concurrent players and later detail increases remain safe.",
  "",
  "The decoder, complete render-buffer equality at both budgets, low-to-high reloads, real browser requests, and a scheduled concurrent-read regression are covered by `tests/load-time*.spec.mjs`. `prefixes.json` records original and derived hashes, inherited source credits, and exact decoded-array equality. The two deferred imports change loading order, with the same functions and data at use time.",
  "",
  `The celestial globe's low-tier file is ${number(smoothing.afterBytes)} bytes instead of ${number(smoothing.beforeBytes)}. ROP2 retains the original records and population, plus the full scan's per-cell mean colors as Float64 values. The same smoothing expression consumes those exact doubles. [smoothing-prefix.json](load-time-2026-10/smoothing-prefix.json) records the hashes and source credit. Native gzip decompression handles the file; a body already decoded by HTTP is accepted, and browsers without the API use the original full scan. Mid and higher tiers keep the full scan.`,
  "",
  "| Toy | Recipe budget | Full bytes | Opening bytes | Saving | Original population | Loaded records |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const p of prefixes)
  lines.push(
    `| ${p.id} | ${number(p.budget)} | ${number(p.beforeBytes)} | ${number(p.afterBytes)} | ${((1 - p.afterBytes / p.beforeBytes) * 100).toFixed(1)}% | ${number(p.originalCount)} | ${number(p.capacity)} |`,
  );
lines.push(
  "",
  "The files preserve each full scan's source, author, and license, as recorded in `tools/ro-sources.mjs`, `CREDITS.md`, and its recipe. The new hashes and transformation are in [prefixes.json](load-time-2026-10/prefixes.json). No original asset, scene schema, PlayCanvas version, or protected PR file was changed.",
  "The existing authors and license links were checked again on their live source pages on October 13, 2026; [source-pages.json](load-time-2026-10/source-pages.json) records those checks. The globe retains its CC0 record from `tools/models.json`.",
  "",
  "## The 20 heaviest phone openings",
  "",
  "Ranked by the frozen main's measured opening body bytes. Exact opening data helps six recipes. Many other captures use the existing SOG compression, and shared loading changes overlap protected PR files. The target is not claimed as complete.",
  "",
  "| Toy | Before bytes | After bytes | Saving | Before requests | After requests | Before first frame ms | After first frame ms |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const r of heavy)
  lines.push(
    `| ${r.before.id} | ${number(r.before.bytes)} | ${number(r.after.bytes)} | ${saving(r) === null ? "unmeasured" : `${saving(r).toFixed(1)}%`} | ${r.before.requestCount} | ${r.after.requestCount ?? "—"} | ${time(r.before.firstFrameMs)} | ${time(r.after.firstFrameMs)} |`,
  );
lines.push(
  "",
  `Phone size guidance (D4), using decimal MB: ${oversizedPhone.length} candidate openings exceed 15 MB; ${largeBodies.size} observed response bodies exceed 20 MB. These are existing-size observations, not new file limits.`,
);
if (oversizedPhone.length)
  lines.push(
    "",
    ...oversizedPhone.map(
      (r) => `- \`${r.after.id}\`: ${number(r.after.bytes)} opening body bytes.`,
    ),
  );
if (largeBodies.size)
  lines.push(
    "",
    ...[...largeBodies].map(([url, bytes]) => `- \`${url}\`: ${number(bytes)} body bytes.`),
  );
const timingSummary = (rows) => {
  const times = rows
    .filter(ok)
    .map((r) => r.firstFrameMs)
    .sort((x, y) => x - y);
  const middle = times.length / 2;
  return {
    samples: times.length,
    median: times.length % 2 ? times[Math.floor(middle)] : (times[middle - 1] + times[middle]) / 2,
    min: times[0],
    max: times.at(-1),
  };
};
const pairedKeys = [...new Set([...pairedBefore, ...pairedAfter].map(key))];
const focusedSamples = pairedKeys.length
  ? Math.max(...pairedBefore.map((r) => r.sample), ...pairedAfter.map((r) => r.sample)) + 1
  : 0;
for (const k of pairedKeys)
  for (const [phase, rows] of [
    ["before", pairedBefore],
    ["after", pairedAfter],
  ]) {
    const samples = rows.filter((r) => key(r) === k);
    if (
      samples.length !== focusedSamples ||
      new Set(samples.map((r) => r.sample)).size !== focusedSamples ||
      samples.some((r) => !ok(r) || r.errors.length || !Number.isFinite(r.firstFrameMs)) ||
      !Array.from({ length: focusedSamples }, (_, i) => i).every((i) =>
        samples.some((r) => r.sample === i),
      )
    )
      throw new Error(`Incomplete or failed focused samples: ${phase}:${k}`);
  }
const paired = pairedKeys.map((k) => ({
  id: pairedBefore.find((r) => key(r) === k).id,
  device: pairedBefore.find((r) => key(r) === k).device,
  before: timingSummary(pairedBefore.filter((r) => key(r) === k)),
  after: timingSummary(pairedAfter.filter((r) => key(r) === k)),
}));
if (paired.length) {
  lines.push(
    "",
    "## Focused timing reruns",
    "",
    `Fresh contexts and disabled HTTP cache, with before/after phase order alternating on each pass. This covers changed scan paths, the deferred museum helpers, a capture control, and selected screening increases. Median and observed range are milliseconds. ${focusedSamples} complete observations per setting reduce single-run noise; this subset still does not establish a no-slower result for every toy.`,
    "",
    "| Toy | Setting | Samples before / after | Before median (range) | After median (range) | Median change |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  );
  for (const r of paired)
    lines.push(
      `| ${r.id} | ${r.device} | ${r.before.samples} / ${r.after.samples} | ${time(r.before.median)} (${time(r.before.min)}–${time(r.before.max)}) | ${time(r.after.median)} (${time(r.after.min)}–${time(r.after.max)}) | ${((r.after.median / r.before.median - 1) * 100).toFixed(1)}% |`,
    );
  const medianChange = (id, device) => {
    const r = paired.find((r) => r.id === id && r.device === device);
    return `${time(r.before.median)} → ${time(r.after.median)} ms (+${((r.after.median / r.before.median - 1) * 100).toFixed(1)}%)`;
  };
  lines.push(
    "",
    `Observed increases remain a review risk: phone Pyrite ${medianChange("pyrite-cubes", "phone")}, Soda can ${medianChange("soda-can", "phone")}, and Sunglasses ${medianChange("sunglasses", "phone")}; desktop Fountain pen ${medianChange("fountain-pen", "desktop")}, Soda can ${medianChange("soda-can", "desktop")}, and Sunglasses ${medianChange("sunglasses", "desktop")}. The no-slower-first-frame target is not established. These repeated increases should not be dismissed as noise; attribution remains unresolved.`,
    "",
    "The deferred museum import creates a serialized dependency before scan fetching. In the five candidate phone Pyrite observations, helper-request start to scan-request start ranges from 30 to 426 ms, with a 254 ms median, including scheduling delays. That interval does not isolate import overhead or explain the full first-frame increase. In sample 3, unchanged PlayCanvas takes 902–4,520 ms to transfer and the helper request starts at 10,675 ms. Candidate sample 4 is faster than baseline, desktop Pyrite improves slightly, and the unrelated desktop Seeded loaf median also increases by 219%. A stable environment and an isolated import comparison are needed before making a causal timing claim. Overlapping museum scan fetching with helper loading is a possible follow-up, requiring its own validation and measurements.",
  );
}
for (const labs of [false, true]) {
  lines.push(
    "",
    `## Every ${labs ? "labs" : "public"} toy`,
    "",
    "Bytes and requests are opening observations; time is navigation to the first ready submitted render. Values show before → after.",
    "",
    "| Toy / ID | Setting | Body bytes | Requests | First frame ms |",
    "| --- | --- | ---: | ---: | ---: |",
  );
  for (const toy of TOYS.filter((t) => !!t.labs === labs).sort(
    (x, y) => (b.get(`phone:${y.id}`)?.bytes || 0) - (b.get(`phone:${x.id}`)?.bytes || 0),
  ))
    for (const device of ["phone", "desktop"]) {
      const x = b.get(`${device}:${toy.id}`),
        y = a.get(`${device}:${toy.id}`);
      lines.push(
        `| ${toy.label} (\`${toy.id}\`) | ${device} | ${number(x.bytes)} → ${number(y.bytes)} | ${x.requestCount ?? "—"} → ${y.requestCount ?? "—"} | ${time(x.firstFrameMs)} → ${time(y.firstFrameMs)}${!ok(x) || !ok(y) ? " (failed readiness)" : ""} |`,
      );
    }
}
lines.push(
  "",
  "## Image proof",
  "",
  "Fixed seed 424242, preset camera, frozen clocks, default look, and matching viewports. Tap pulses use their production decay formula at one second; the tap-versus-rest check confirms a moved pose. Low, high, and mid comparisons cover the five prefix recipes. Cactus covers the shared startup changes; pyrite covers the deferred museum helpers. The Node buffer checks also cover the complete geometry and shading inputs.",
  "",
  "Preflight moving-pose captures differed in three pairs, including a desktop full/full control with unchanged scan bytes. The capture was updated to reset centers and explicitly resort the fixed pose, then wait at least 12 frame-end events plus 1.5 seconds. All final pairs match. This does not establish the cause of the preflight differences. Frame-end is not a sorter or GPU fence, and these samples do not test every possible animation frame.",
  "",
  "| Toy | Setting | Pose | Changed pixels | Before | After | Difference ×8 |",
  "| --- | --- | --- | ---: | --- | --- | --- |",
);
for (const r of images)
  lines.push(
    `| ${r.id} | ${r.device} | ${r.pose} | ${r.differentPixels} | ${imageLink(r.before.file, "Still")} | ${imageLink(r.after.file, "Still")} | ${imageLink(r.diff, "Diff")} |`,
  );
lines.push(
  "",
  "## Lossy options for the owner — not shipped",
  "",
  "These are visual decision examples, confined to the audit tool. They halve the recipe's phone budget from 90,000 to 45,000. The prototype still transfers the shipped opening asset; an additional smaller prefix would be needed for a corresponding transfer saving. No production budget or texture was changed.",
  "",
  "| Option | Before rendered splats | After rendered splats | Changed pixels | Before | After | Diff |",
  "| --- | ---: | ---: | ---: | --- | --- | --- |",
);
for (const r of lossy)
  lines.push(
    `| ${r.id}: half budget | ${number(r.before.splats)} | ${number(r.after.splats)} | ${number(r.differentPixels)} | ${imageLink(r.before.file, "Still")} | ${imageLink(r.after.file, "Still")} | ${imageLink(r.diff, "Diff")} |`,
  );
lines.push(
  "",
  "## Method, limits, and reproduction",
  "",
  "Raw observations: [before](load-time-2026-10/before.json), [after](load-time-2026-10/after.json), and [timing screening](load-time-2026-10/screening.json). The [before method](load-time-2026-10/before-method.json) and [after method](load-time-2026-10/after-method.json) record browser flags, settings, and source commits. Focused reruns retain their own before/after rows under `load-time-2026-10/paired/`.",
  "",
  "The four large request matrices retain their full JSON contents and formatting checks. `.gitattributes` disables their line diffs so Git and the required American English checker do not collect millions of irrelevant JSON lines. The first English-check attempt exceeded that checker's 64 MiB diff buffer; its source is protected and was not edited. JSON is outside that checker's public-text scope.",
  "",
  "[Task 06's opening method](perf-2026-10.md) is retained: phone 390×844, device scale 3, touch/mobile, weak/low; desktop 1440×900, device scale 1, high. WebGL2, adaptation off, sound off, no reduced motion, seed 424242, preset camera, default options, still-toy turntable choice, unthrottled localhost, fresh context per cell, CDP cache disabled, and service workers blocked. Only one rendering page runs at a time.",
  "",
  `The browser is Chromium ${method.browser} on Linux with Mesa llvmpipe, two Mesa threads, and an Xvfb display. Task 06 used Mac Chrome with Metal. These are matched settings on this environment, not physical-phone results or timings directly comparable to the Mac audit.`,
  "",
  "The first-frame hook is the first `postrender` after the requested toy is ready. It is a submitted render, not a GPU fence or confirmation that streamed pictures have finished. Opening bytes include HTTP bodies completed by the snapshot after a real 1.5-second settling delay. CDP completion timestamps are checked against the cutoff; initial worker scripts use parent Resource Timing when necessary, and worker imports count independently. Headers, blob/data URLs, and aborted or incomplete bodies are excluded. Worker timing is approximate, as in task 06. The local server does not compress HTTP responses; these are body payloads, not live Pages wire totals.",
  "",
  "This task records opening metrics. Task 06's separate five-second idle/tap frame-cadence windows and heap census were not repeated. A single cold run per cell is a screening measurement; CPU load, shader caches, and OS caches can move the first-frame result. Timing increases need paired reruns before declaring a regression or claiming the no-slower target.",
  "",
  "Reproduction: serve archives of the recorded frozen main on port 4174 and measured candidate on 4173 with `python3 -m http.server PORT --bind 127.0.0.1`. Run `node tools/load-time-audit.mjs --phase=before` and then `node tools/load-time-audit.mjs --phase=after --base=http://127.0.0.1:4173`, adding `--frozen-main=49c809b4 --candidate-source=2c229dbd --out=NEW_DIR` to both commands, with `SPLASHERY_CHROMIUM`, `DISPLAY`, `SPLASHERY_GL=llvmpipe`, and `LP_NUM_THREADS=2`. Use a new output directory for fresh measurements; each run resumes completed version-2 cells. The explicit commit options keep method receipts accurate when the collector repository has advanced beyond the served archives. `--only=ID,ID`, `--device=phone`, `--samples=N`, and `--out=DIR` support focused reruns. `node tools/load-time-paired.mjs --only=ID,ID --samples=5` accepts the same commit options and alternates before/after phase order while adding one sample per pass. Recovery runs used `nice -n 10` and `--navigation-timeout=180000 --readiness-timeout=300000`; focused recovery additionally used `--cell-timeout=180000`. Run `tools/load-time-visuals.mjs` for stills, `tools/load-time-prefixes.mjs` and `tools/load-time-smoothing.mjs` to regenerate exact opening assets, and `tools/load-time-report.mjs` for this report.",
  "",
  "## Verification and remaining work",
  "",
  "The protected-file list was obtained from PRs #560, #562, #566, #570, and #576 before edits; [protected-files.json](load-time-2026-10/protected-files.json) preserves it. The changed-file intersection is checked again before push. Static files, direct ES modules, the existing PlayCanvas 2.22.3 bridge, and old share/scene formats are preserved.",
  "",
  "Main advanced to `c66a49e963f1d9f9adf79949d51db1ec9cf71d74` during collection and is integrated before handoff. It includes the American English sweep, manual updates, and new Photo to 3D samples. The frozen opening matrices and 160-test receipt remain observations of their recorded earlier source commits; they do not measure the merged main changes. A separate integration check is recorded in the verification receipt. The final protected-file refresh covers 428 paths with no intersection with this PR's changes.",
  "",
  "Test and formatting receipts are recorded in [verification.json](load-time-2026-10/verification.json). On the measured runtime, the required suite passed all 160 tests without skips or retries: smoke, taps, kit, unit, the Real objects spec, and the new load-time specs. Three additional audit-store recovery tests passed separately. After integrating main, all 37 unit and load-time checks passed; the full required suite was not repeated after that merge. An actual browser probe forced the collector's watchdog to exit with status 2, then successfully resumed the same output with a normal timeout. The embed test observed 9.1 MiB, below its 30 MiB limit. All 15 touched-pack recipes passed their Node checks. Photoreal r3 has no dedicated existing pack spec; its browser deferred-load/tap test and all eight recipes' Node pack checks cover that pack. Lossy samples, all raw request observations, and the timing screening flags are retained for review.",
  "",
  "An earlier broad suite had one strawberry return-to-rest image-threshold failure; isolated checks on frozen main and the candidate, and the final broad suite, passed. During the candidate matrix the audit browser's GPU process exited after 578 completed cells and the collector stopped advancing. Those completed rows were retained, and a fresh browser resumed the remaining cells. Neither event is presented as proof of a production defect or a clean first attempt.",
  "",
  "Timings after that interruption became much slower even on unchanged code. After a fresh graphics display, a frozen-main desktop Cactus control took 55.4 seconds to its first frame, versus 4.8 seconds in the earlier matrix; its body payload stayed exactly 11,021,766 bytes. The candidate control took 69.5 seconds and retained the same 98,325-byte saving as its earlier opening. The [recovery control before](load-time-2026-10/recovery-control/before.json) and [after](load-time-2026-10/recovery-control/after.json) are separate from the five-sample focused reruns. This environment change prevents treating the later matrix's timing differences as isolated effects of the patch. The raw observations and focused ranges are retained, and the no-slower timing target is not claimed.",
  "",
  "The execution service subsequently disconnected after 615 completed candidate cells and stopped the local servers and display. The services were restored, and the remaining cells and focused repeats used process priority 10 (`nice -n 10`) so rendering would yield to the execution service. Earlier measurements used normal priority. The final method files record that priority; source commits, scene settings, and rendering flags are unchanged. These recovery differences are another limit on comparing the full timing matrix.",
  "",
  "An alternate SwiftShader desktop Cactus control also showed the slowdown: [frozen main](load-time-2026-10/swiftshader-control/before.json) took 71.3 seconds, and [the candidate](load-time-2026-10/swiftshader-control/after.json) took 37.9 seconds, with the same body sizes as the llvmpipe controls. The main matrix retains llvmpipe. Anatomy atlas and Oak subsequently hit the original collection timeouts without console errors; [opening-retries.json](load-time-2026-10/opening-retries.json) preserves those attempts. Recovery collection allows 180 seconds for navigation and 300 seconds for readiness. These limits affect how long collection waits; recorded first-frame timings retain their actual elapsed values. Further timeout attempts, if any, remain in the collector's error logs beside the raw matrices.",
  "",
  "The graphics process exited again after 25 completed observations in the first focused candidate pass. Those observations were retained. Focused recovery uses a 180-second total per-cell watchdog and automatically restarts a failed collector pass up to twice from saved observations. The watchdog checkpoints completed rows and terminates only the collector's own child processes. These recovery limits are recorded in each focused method file.",
  "",
  "What was cut: unused PLY-column changes in the protected Video to 3D work; changes to the protected manual PDF loaded by Your book; edits to the protected shared UI, player, catalog, help, and sound files; reduced texture resolution; reduced production splat budgets; renderer upgrades; a bundler or CDN; and hosting header changes. The 20-heaviest target and a statistically supported no-slower-first-frame result remain open.",
  "",
  "Rule check: none.",
  "",
);
fs.writeFileSync("docs/audits/load-time-2026-10.md", lines.join("\n"));
fs.writeFileSync(
  `${dir}/screening.json`,
  JSON.stringify(
    {
      matrixCellsPerPhase: b.size,
      top20PhoneTargetsMet: heavy.filter(meetsTarget).length,
      top20PhoneTotals: heavyTotals,
      focusedTiming: paired,
      slowerScreening: slower.map((r) => ({
        id: r.before.id,
        device: r.before.device,
        beforeMs: r.before.firstFrameMs,
        afterMs: r.after.firstFrameMs,
      })),
      errors: errors.map((r) => ({
        id: r.before.id,
        device: r.before.device,
        before: r.before.error || r.before.errors,
        after: r.after.error || r.after.errors,
      })),
    },
    null,
    2,
  ) + "\n",
);
