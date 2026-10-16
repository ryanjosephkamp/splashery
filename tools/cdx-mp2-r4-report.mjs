// Regenerate transparent comparison tables from the preserved ledgers.
import fs from "node:fs/promises";
import path from "node:path";
import { option } from "./cdx-mp2-r4-harness.mjs";
import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";

const out = option("out", "work/r4-measurements.md"),
  read = async (name) => JSON.parse(await fs.readFile(`work/${name}.json`).catch(() => "null")),
  main = await read("r4-main-final-quality"),
  current = await read("r4-final-quality"),
  perf = await Promise.all(["main", "r3", "r4"].map((name) => read(`r4-phone-${name}`))),
  startup = await Promise.all(["main", "r4"].map((name) => read(`r4-startup-${name}`))),
  tests = await read("r4-test-ledger");
const fixed = (number, digits = 3) =>
    Number.isFinite(number) ? number.toFixed(digits) : "pending",
  table = (head, rows) =>
    `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`,
  interval = (row, key = "cadence") =>
    row ? `${fixed(row[key]?.median, 1)} / ${fixed(row[key]?.worst, 1)}` : "pending",
  med = (array) => {
    const values = [...array].sort((a, b) => a - b),
      i = Math.floor(values.length / 2);
    return values.length % 2 ? values[i] : (values[i - 1] + values[i]) / 2;
  },
  lines = [
    `# Round 4 measurement tables\n\nGenerated ${new Date().toISOString()}. Missing cases are pending, never passes.\n`,
  ];
lines.push(
  "## Picture coverage and stability\n\nEvery original source frame, including native video and GIF timestamps. Main receives the disclosed correct source picture in the geometry comparison. Height jitter and large edge flips are depth-stability proxies, not an independent acuity measure.\n",
);
for (const profile of ["phone", "desktop"]) {
  lines.push(`### ${profile}\n\n`);
  lines.push(
    table(
      [
        "Input",
        "Frames",
        "Main jitter",
        "R4 jitter",
        "Main flips/1,000",
        "R4 flips/1,000",
        "R4 worst hole share",
        "R4 max specks",
      ],
      R4_CASES.map((item) => {
        const a = main?.results.find((row) => row.profile === profile && row.id === item.id),
          b = current?.results.find((row) => row.profile === profile && row.id === item.id);
        return [
          item.id,
          b ? `${b.framesMeasured}/${b.framesTotal}` : "pending",
          fixed(a?.heightJitter, 6),
          fixed(b?.heightJitter, 6),
          fixed(a?.edgeFlipsPer1000, 4),
          fixed(b?.edgeFlipsPer1000, 4),
          fixed(b?.worstHoleShare, 8),
          b?.maxEdgeSpecks ?? "pending",
        ];
      }),
    ),
  );
}
lines.push(
  `\nMain code hash: \`${main?.sourceHash || "pending"}\`. Round 4: \`${current?.sourceHash || "pending"}\`. Complete: main ${main?.complete ?? false}; round 4 ${current?.complete ?? false}.\n`,
);
lines.push(
  "## Isolated phone cadence\n\nFrameend median / worst in milliseconds, using the Operator's protocol. These are update intervals. The next table separately reports actual postrender and changed bound-source-clock submissions. CPU slowdown is 4; workers are not throttled. One browser, no competing workloads.\n",
);
lines.push(
  table(
    ["Input", "Main", "Round 3", "Round 4", "R4 ≤50 / ≤250 ms"],
    R4_CASES.map((item) => {
      const rows = perf.map((report) => report?.cases.find((row) => row.id === item.id)),
        r4 = rows[2];
      return [
        item.id,
        ...rows.map((row) => interval(row)),
        r4 ? String(r4.cadence.median <= 50 && r4.cadence.worst <= 250) : "pending",
      ];
    }),
  ),
);
lines.push(
  "\nChanged bound-source-clock counts are proxies, not pixel-uniqueness or decoder fps. A 10 fps input cannot supply 20 distinct source pictures per second.\n",
);
lines.push(
  table(
    [
      "Input",
      "Main draw ms",
      "R4 draw ms",
      "Main source clocks/s",
      "R4 source clocks/s",
      "Main / R4 media drops",
    ],
    R4_CASES.map((item) => {
      const a = perf[0]?.cases.find((row) => row.id === item.id),
        b = perf[2]?.cases.find((row) => row.id === item.id),
        drops = (row) =>
          row?.nativeMediaCounters?.end
            ? row.nativeMediaCounters.end.droppedVideoFrames -
              row.nativeMediaCounters.start.droppedVideoFrames
            : "unavailable";
      return [
        item.id,
        interval(a, "renderedCadence"),
        interval(b, "renderedCadence"),
        fixed(a?.pictureSubmissionFps, 2),
        fixed(b?.pictureSubmissionFps, 2),
        `${drops(a)} / ${drops(b)}`,
      ];
    }),
  ),
);
lines.push(
  "\n## Repeated clean cadence\n\nA full paired pass covers all fourteen inputs; Bunny and Horse receive two additional passes to check the closest comparison with main. The first-pass table above keeps the Operator's original per-window protocol; this table retains each pass's median and the worst observed interval across passes. Missing repeats stay explicit. Source-clock rates are proxies, as described above.\n",
);
const repeatPairs = [[perf[0], perf[2]]];
for (const repeat of [2, 3]) {
  const pair = await Promise.all(
    ["main", "r4"].map((name) => read(`r4-phone-${name}-repeat${repeat}`)),
  );
  pair.forEach((report, i) => {
    if (report && repeatPairs[0][i] && report.sourceHash !== repeatPairs[0][i].sourceHash)
      throw Error("Repeated cadence source pins differ");
  });
  repeatPairs.push(pair);
}
lines.push(
  table(
    [
      "Input",
      "Main median ms, each pass",
      "R4 median ms, each pass",
      "Worst ms, main / R4",
      "Mean source clocks/s, main / R4",
      "Runs, main / R4",
    ],
    R4_CASES.map((item) => {
      const versions = [0, 1].map((version) =>
          repeatPairs
            .map((pair) => pair[version]?.cases.find((row) => row.id === item.id))
            .filter(Boolean),
        ),
        medians = versions.map((rows) =>
          rows.length ? rows.map((row) => fixed(row.cadence.median, 1)).join(", ") : "pending",
        ),
        worst = versions.map((rows) =>
          rows.length ? fixed(Math.max(...rows.map((row) => row.cadence.worst)), 1) : "pending",
        ),
        fps = versions.map((rows) =>
          rows.length
            ? fixed(rows.reduce((sum, row) => sum + row.pictureSubmissionFps, 0) / rows.length, 2)
            : "pending",
        );
      return [
        item.id,
        ...medians,
        worst.join(" / "),
        fps.join(" / "),
        versions.map((rows) => rows.length).join(" / "),
      ];
    }),
  ),
);
lines.push(
  "\n## Isolated phone startup\n\nFresh context per repeat, selection to first actual submitted front-surface draw with usable picture and estimated depth. Opening the default toy includes observer module preparation in both versions; other clips start from the already open default toy. Background refinement need not finish. Milliseconds; median [minimum–maximum], repeat count.\n",
);
lines.push(
  table(
    ["Input", "Main", "Round 4", "R4 median ≤ main"],
    R4_CASES.map((item) => {
      const values = startup.map(
          (report) =>
            report?.results
              .filter((row) => row.id === item.id && !row.error && !row.errors.length)
              .map((row) => row.ms) || [],
        ),
        format = (values) =>
          values.length
            ? `${fixed(med(values), 1)} [${fixed(Math.min(...values), 1)}–${fixed(Math.max(...values), 1)}], n=${values.length}`
            : "pending";
      return [
        item.id,
        ...values.map(format),
        values.every((row) => row.length) ? String(med(values[1]) <= med(values[0])) : "pending",
      ];
    }),
  ),
);
lines.push(
  "\n## Instrumented pipeline costs\n\nInclusive mean milliseconds per frameend update. Rows overlap and must not be summed. Instrumented runs are separate from the clean cadence table. Native media tracing includes the two-second warmup; its function durations are overlapping wall time, not additive decoder CPU. GPU elapsed queries may be unavailable.\n",
);
const cpu = await Promise.all(["r3", "r4"].map((name) => read(`r4-final-${name}-cpu`))),
  phases = [
    "longFrame",
    "canvasDraw",
    "canvasRead",
    "freezeVideoFrame",
    "workerPost",
    "videoFrameCallback",
    "clipCellDepth",
    "fillClip",
    "texImage2D",
    "texSubImage2D",
    "generateMipmap",
    "bufferData",
    "bufferSubData",
    "sortVisible",
    "drawElements",
    "drawElementsInstanced",
  ];
for (const id of ["sample", "machine-long"]) {
  const rows = cpu.map((report) => report?.cases.find((row) => row.id === id));
  lines.push(`### ${id}\n\n`);
  lines.push(
    table(
      ["Inclusive page operation", "Round 3 ms/update", "Round 4 ms/update"],
      phases.map((phase) => [
        phase,
        ...rows.map((row) =>
          row
            ? row.costs[phase]
              ? fixed(row.costs[phase].total / (row.cadence.n + 1))
              : "not observed"
            : "pending",
        ),
      ]),
    ),
  );
  const r4 = rows[1];
  lines.push(
    `\nGPU timers: round 3 ${rows[0] ? (rows[0].gpuDraw?.supported ? "available" : "unavailable") : "pending"}; round 4 ${r4 ? (r4.gpuDraw?.supported ? "available" : "unavailable") : "pending"}.\n`,
  );
  if (r4?.stream) {
    lines.push(
      `\nParallel worker phases, mean ms/completed packet over the recent ${r4.stream.recentWorkerFrames} frames; may include warmup. Do not add to inclusive page costs.\n`,
    );
    lines.push(
      table(
        ["Worker phase", "Round 4 ms/packet"],
        Object.entries(r4.stream.meanPhases).map(([phase, value]) => [phase, fixed(value)]),
      ),
    );
    lines.push(
      `\nAccepted frozen-picture age, recent ${r4.stream.presentationAgeMs.n} packets: median ${fixed(r4.stream.presentationAgeMs.median, 1)} ms; worst ${fixed(r4.stream.presentationAgeMs.worst, 1)} ms. This is media-clock age at acceptance, not physical audio-to-display latency.\n`,
    );
  }
  const decode = rows.map((row) => row?.nativeMediaTrace?.durations?.vpx_codec_decode);
  lines.push(
    "\n" +
      table(
        ["Native VP9 function wall time", "Calls", "Total ms", "Worst ms"],
        decode.map((row, i) => [
          i ? "Round 4" : "Round 3",
          row?.count ?? "unavailable",
          fixed(row?.totalMs),
          fixed(row?.worstMs),
        ]),
      ),
  );
}
lines.push("\n## Test ledger\n\n");
if (tests)
  lines.push(
    `${tests.expectedFiles - tests.missing.length}/${tests.expectedFiles} complete whole-file reports. Latest totals: ${JSON.stringify(tests.totals)}. Every earlier failure remains in the ledger. Individual run revisions were not recorded by Playwright; the full suite spans implementation and upstream merges, with affected files rerun.\n\nLatest failed files: ${
      tests.files
        .filter((row) => row.failed)
        .map((row) => row.file)
        .join(", ") || "none"
    }.\n`,
  );
else lines.push("Pending.\n");
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, lines.join("\n"));
console.log(out);
