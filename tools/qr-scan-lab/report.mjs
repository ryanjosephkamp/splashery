#!/usr/bin/env node
// Builds the scorecard tables from a lab summary: node tools/qr-scan-lab/report.mjs [source]
// Prints Markdown tables (worst first) to stdout; the written findings live in the scorecard itself.
import fs from "node:fs";

const source = process.argv[2] || "reference";
const s = JSON.parse(fs.readFileSync(`tools/qr-scan-lab/data/${source}-summary.json`, "utf8"));
const pct = (v) => `${Math.round(v * 100)}%`;
const table = (title, head, rows) =>
  [
    `### ${title}`,
    "",
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
    "",
  ].join("\n");

const out = [];
out.push(
  table(
    "Decode rate per style (all colors except inverted; both readers must decode the exact text)",
    ["Style", "Both", "jsQR", "zxing"],
    Object.entries(s.byStyle)
      .sort((a, b) => a[1].both - b[1].both)
      .map(([k, v]) => [k, pct(v.both), pct(v.jsqr), pct(v.zxing)]),
  ),
);
const conds = s.conditions.map((c) => c.id);
const styles = Object.keys(s.byStyle);
const cellRate = (st, c) => s.byStyleCondition[`${st}|${c}`]?.both ?? 0;
out.push(
  table(
    "Decode rate per condition, worst first (every error correction level and color scheme pooled)",
    ["Condition", ...styles],
    conds
      .map((c) => [c, ...styles.map((st) => cellRate(st, c))])
      .sort((a, b) => a.slice(1).reduce((x, y) => x + y, 0) - b.slice(1).reduce((x, y) => x + y, 0))
      .map((r) => [r[0], ...r.slice(1).map(pct)]),
  ),
);
const schemes = [...new Set(Object.keys(s.byStyleScheme).map((k) => k.split("|")[1]))];
out.push(
  table(
    "Decode rate per color scheme",
    ["Scheme", ...styles],
    schemes.map((sc) => [
      sc,
      ...styles.map((st) => pct(s.byStyleScheme[`${st}|${sc}`]?.both ?? 0)),
    ]),
  ),
);
const ecs = [...new Set(Object.keys(s.byStyleEc).map((k) => k.split("|")[1]))];
out.push(
  table(
    "Decode rate per error correction level",
    ["Level", ...styles],
    ecs.map((e) => [e, ...styles.map((st) => pct(s.byStyleEc[`${st}|${e}`]?.both ?? 0))]),
  ),
);
console.log(out.join("\n"));
