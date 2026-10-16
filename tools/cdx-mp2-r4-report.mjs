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
  "\n## Isolated phone startup\n\nFresh context per repeat, selection to first actual submitted front-surface draw with usable picture and estimated depth. Background refinement need not finish. Milliseconds; median [minimum–maximum], repeat count.\n",
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
