// Lane QR lab r2, the study of splat QR codes: from the raw rows to the
// numbers in the report: scan rate with Wilson 95% intervals per cell, the
// thresholds (where each sweep first falls below 90% and 50%), how well the
// block verdict predicts the readers, and the charts.
import fs from "node:fs";
import path from "node:path";
import { wilson, crossing, toCSV } from "./core.mjs";
import { READERS, READER_NAMES } from "./readers.mjs";
import { lineChart } from "./charts.mjs";

export const ALL_READERS = [...READERS, "any"];
const r3 = (x) => (x == null ? "" : Math.round(x * 1000) / 1000);
const LEVELS = ["L", "M", "Q", "H"];

const hit = (row, reader) => (reader === "any" ? (row.jsqr || row.zxing || row.zxingcpp ? 1 : 0) : row[reader]); // prettier-ignore

function group(rows, keyOf) {
  const m = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

export function summarize(rows, VARS, out, meta) {
  const byVar = group(rows, (r) => r.variable);
  const cells = [];
  const thresholds = [];
  const conds = [...new Set(rows.map((r) => r.cond))];
  for (const v of VARS) {
    const vr = byVar.get(v.id);
    if (!vr) continue;
    const texts = ["all", ...new Set(vr.map((r) => r.text))];
    for (const text of texts)
      for (const level of LEVELS)
        for (const cond of conds)
          for (const reader of ALL_READERS) {
            const pts = [];
            for (const value of v.values) {
              const cr = vr.filter((r) => r.value === value && r.level === level && r.cond === cond && (text === "all" || r.text === text)); // prettier-ignore
              if (!cr.length) continue;
              const k = cr.reduce((s, r) => s + hit(r, reader), 0);
              const [lo, hi] = wilson(k, cr.length);
              const rate = k / cr.length;
              pts.push({ x: v.x(value), rate });
              if (text === "all") cells.push({ variable: v.id, value, x: v.x(value), level, cond, reader, n: cr.length, k, rate: r3(rate), lo: r3(lo), hi: r3(hi) }); // prettier-ignore
            }
            if (!pts.length) continue;
            const c90 = crossing(pts, 0.9);
            const c50 = crossing(pts, 0.5);
            thresholds.push({ variable: v.id, group: v.group, level, text, cond, reader, x90: r3(c90.x), at90: c90.kind, x50: r3(c50.x), at50: c50.kind, first: r3(pts[0].rate), last: r3(pts[pts.length - 1].rate), min: r3(Math.min(...pts.map((p) => p.rate))) }); // prettier-ignore
          }
  }
  // The block verdict against the readers (front-on codes only).
  const known = rows.filter((r) => r.blocks === 0 || r.blocks === 1);
  const blocks = [];
  const confusion = (rs, label, cond) => {
    for (const reader of ALL_READERS) {
      const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
      for (const r of rs) {
        const p = r.blocks === 1;
        const h = hit(r, reader) === 1;
        c[p ? (h ? "tp" : "fp") : h ? "fn" : "tn"]++;
      }
      const n = rs.length;
      blocks.push({ group: label, cond, reader, n, ...c, agree: r3((c.tp + c.tn) / (n || 1)), readWhenBlocksOk: r3(c.tp / (c.tp + c.fp || 1)), readWhenBlocksFail: r3(c.fn / (c.fn + c.tn || 1)) }); // prettier-ignore
    }
  };
  for (const cond of conds) {
    const rs = known.filter((r) => r.cond === cond);
    confusion(rs, "all", cond);
    const gv = new Map(VARS.map((v) => [v.id, v.group]));
    for (const g of ["splat", "motion", "damage"]) confusion(rs.filter((r) => gv.get(r.variable) === g), g, cond); // prettier-ignore
  }
  fs.writeFileSync(path.join(out, "cells.csv"), toCSV(cells, ["variable", "value", "x", "level", "cond", "reader", "n", "k", "rate", "lo", "hi"])); // prettier-ignore
  fs.writeFileSync(path.join(out, "thresholds.csv"), toCSV(thresholds, ["variable", "group", "level", "text", "cond", "reader", "x90", "at90", "x50", "at50", "first", "last", "min"])); // prettier-ignore
  fs.writeFileSync(path.join(out, "blocks.csv"), toCSV(blocks, ["group", "cond", "reader", "n", "tp", "fp", "fn", "tn", "agree", "readWhenBlocksOk", "readWhenBlocksFail"])); // prettier-ignore
  const captures = rows.length;
  const prev = fs.existsSync(path.join(out, "summary.json")) ? JSON.parse(fs.readFileSync(path.join(out, "summary.json"))) : {}; // prettier-ignore
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ ...prev, meta: { ...meta, captures }, blocks }, null, 1) + "\n"); // prettier-ignore
  charts(cells, VARS, out);
}

// One chart per variable (panels: the three readers; lines: the levels;
// the "phone" capture, the texts pooled). One per damage kind (panels: the
// regions; lines: the levels; zxing-cpp, "phone").
function charts(cells, VARS, out) {
  const dir = path.join(out, "charts");
  fs.mkdirSync(dir, { recursive: true });
  const pick = (vid, level, cond, reader) =>
    cells.filter((c) => c.variable === vid && c.level === level && c.cond === cond && c.reader === reader).map((c) => ({ x: c.x, rate: c.rate })); // prettier-ignore
  const series = (vid, cond, reader) =>
    LEVELS.map((l, i) => ({ name: `Level ${l}`, slot: i, points: pick(vid, l, cond, reader) })).filter((s) => s.points.length); // prettier-ignore
  for (const v of VARS.filter((v) => v.group !== "damage")) {
    if (!cells.some((c) => c.variable === v.id)) continue;
    const panels = READERS.map((r) => ({ title: READER_NAMES[r], series: series(v.id, "phone", r) })); // prettier-ignore
    if (!panels[0].series.length) continue;
    fs.writeFileSync(path.join(dir, `${v.id}.svg`), lineChart(panels, { title: v.label, subtitle: "Share of “phone” captures read exactly, by reader", xLabel: v.axis })); // prettier-ignore
  }
  const kinds = [...new Set(VARS.filter((v) => v.group === "damage").map((v) => v.kind))];
  for (const kind of kinds) {
    const vs = VARS.filter((v) => v.kind === kind && cells.some((c) => c.variable === v.id));
    if (!vs.length) continue;
    const panels = vs.map((v) => ({ title: `Region: ${v.region}`, series: series(v.id, "phone", "zxingcpp") })); // prettier-ignore
    fs.writeFileSync(path.join(dir, `dmg-${kind}.svg`), lineChart(panels, { title: `Damage: ${kind}`, subtitle: "Share of “phone” captures zxing-cpp read exactly", xLabel: vs[0].axis })); // prettier-ignore
  }
}
