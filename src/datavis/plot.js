// Lane Data and climate: Data in 3D's charts. Turns a table (src/datavis/
// csv.js) and the person's picks (which column goes on X, Y, Z, color and
// size) into a 3D scatter, a field of bars or a surface, inside a Chart frame
// (src/datavis/chart.js).
//
// A tap drops the marks to the floor and lets them rise back into place
// (morph channel 0): points fall straight down and climb back, bars shrink
// into the floor and grow again, the surface flattens and lifts.

import { Chart, shorten, formatTick, niceTicks } from "./chart.js";
import { sequential, categorical, light } from "./colors.js";
import { mulberry } from "./random.js";

export const CHARTS = [
  { id: "scatter", label: "Scatter" },
  { id: "bars", label: "Bars" },
  { id: "surface", label: "Surface" },
];
export const COUNT = "(row count)"; // a Y for bars and surfaces: how many rows fall in each cell
export const NONE = "(none)";

const usable = (c) => c && (c.type === "number" || c.type === "date" || c.type === "category");

// The picks for a table: the person's where they name a column of it, the
// table's own defaults (samples) or the first usable columns otherwise.
export function resolvePicks(table, given = {}, defaults = {}, chart = "scatter") {
  const byName = new Map(table.columns.map((c) => [c.name, c]));
  const cols = table.columns.filter(usable);
  const nums = cols.filter((c) => c.type !== "category");
  const pick = (key, fallback) => {
    const g = given[key];
    if (g === NONE && key !== "x" && key !== "y") return NONE;
    if (g === COUNT && key === "y" && chart !== "scatter") return COUNT;
    if (g && usable(byName.get(g))) return g;
    const d = defaults[key];
    if (d === NONE || (d && usable(byName.get(d)))) return d;
    return fallback;
  };
  const order = nums.length >= 2 ? nums : cols;
  const x = pick("x", order[0]?.name);
  const y = pick("y", order.find((c) => c.name !== x)?.name ?? (chart === "scatter" ? x : COUNT)); // prettier-ignore
  const z = pick("z", order.find((c) => c.name !== x && c.name !== y)?.name ?? NONE);
  const cat = cols.find((c) => c.type === "category" && c.labels.length <= 8);
  const color = pick("color", cat?.name ?? (y === COUNT ? NONE : y));
  const size = pick("size", NONE);
  return { x, y, z, color, size };
}

// The marks' budget: points for a scatter on this splat count.
export const maxPoints = (count) => Math.max(2000, Math.min(60000, Math.floor(count * 0.45)));

// Builds the chart into the kit. Returns what the panel says about it.
export function buildPlot(
  k,
  table,
  picks,
  { chart = "scatter", title = "", caption = "", flipY = false } = {},
) {
  // prettier-ignore
  const col = (name) => table.columns.find((c) => c.name === name) || null;
  const X = col(picks.x);
  const Y = picks.y === COUNT ? null : col(picks.y);
  const Z = picks.z === NONE ? null : col(picks.z);
  const C = picks.color === NONE ? null : col(picks.color);
  const S = picks.size === NONE ? null : col(picks.size);
  const report = { chart, rows: table.rows, shown: 0, skipped: 0, sampled: false, note: "" };
  if (!X) throw new Error("Pick a column for X.");
  const ch = new Chart({ w: 2, h: 1.3, d: Z || chart !== "scatter" ? 2 : 0.5 });
  if (chart === "scatter") scatter(k, ch, table, { X, Y: Y || X, Z, C, S, flipY }, report);
  else grid(k, ch, table, { X, Y, Z, C }, report, chart);
  if (title) ch.label(shorten(title, 30), [0, ch.h + ch.px * 30, -ch.d / 2], { scale: 1.15, color: "#101318", valign: "bottom" }); // prettier-ignore
  if (caption) ch.label(shorten(caption, 40), [0, ch.h + ch.px * 21, -ch.d / 2], { scale: 0.75, color: "#4a505a", valign: "bottom" }); // prettier-ignore
  ch.emit(k);
  k.data = { labels: ch.labels, report, box: { w: ch.w, h: ch.h, d: ch.d } };
  return report;
}

function axisFor(ch, key, c, { name = c?.name, flip = false, pad = 0 } = {}) {
  if (!c) return ch.axis(key, { name: "", min: 0, max: 1, ticks: [] });
  if (c.type === "category")
    return ch.axis(key, { name, type: "category", labels: c.labels, min: -0.5, max: c.labels.length - 0.5, flip }); // prettier-ignore
  const span = c.max - c.min || 1;
  return ch.axis(key, { name, type: c.type, min: c.min - span * pad, max: c.max + span * pad, flip }); // prettier-ignore
}

// Which rows to draw: all of them, or an even random sample of max.
export function sampleRows(n, max, seed = 7) {
  if (n <= max) return null;
  const rand = mulberry(seed);
  const pick = new Uint8Array(n);
  let left = max;
  for (let i = 0; i < n && left; i++) {
    if (rand() * (n - i) < left) {
      pick[i] = 1;
      left--;
    }
  }
  return pick;
}

function colorOf(C) {
  if (!C) return () => "#3a6fb0";
  if (C.type === "category") return (v) => (Number.isNaN(v) ? "#9aa0a8" : categorical(v));
  const lo = C.min;
  const span = C.max - C.min || 1;
  return (v) => (Number.isNaN(v) ? "#9aa0a8" : sequential((v - lo) / span));
}

function legendFor(ch, C) {
  if (!C) return;
  if (C.type === "category") {
    const n = Math.min(8, C.labels.length);
    const x = ch.w / 2 + ch.px * 6;
    for (let i = 0; i < n; i++) {
      const y = ch.h * 0.7 - i * ch.px * 11;
      for (let j = 0; j < 3; j++) ch.point([x + j * 0.012, y, -ch.d / 2], categorical(i), 0.016, 1);
      ch.label(shorten(C.labels[i], 14), [x + ch.px * 4, y, -ch.d / 2], { align: "left", scale: 0.9 }); // prettier-ignore
    }
    ch.label(shorten(C.name, 18), [x, ch.h * 0.7 + ch.px * 8, -ch.d / 2], { align: "left", valign: "bottom" }); // prettier-ignore
    return;
  }
  const fmt = (v) => valueText(C, v, C.max - C.min);
  ch.legend(sequential, { name: C.name, lo: fmt(C.min), hi: fmt(C.max) });
}

// A value as a legend shows it: a date's day or year, a number to the
// precision its range needs.
export function valueText(c, v, span) {
  if (c.type === "date") {
    const d = new Date(v);
    return span > 3 * 365 * 864e5 ? String(d.getUTCFullYear()) : d.toISOString().slice(0, 10);
  }
  const { step } = niceTicks(0, Math.abs(span) || 1, 5);
  return formatTick(v, step / 10);
}

function scatter(k, ch, table, { X, Y, Z, C, S, flipY }, report) {
  axisFor(ch, "x", X, { pad: 0.02 });
  axisFor(ch, "y", Y, { pad: 0.02, flip: flipY });
  axisFor(ch, "z", Z, { pad: 0.02 });
  ch.frame({ zAxis: !!Z });
  legendFor(ch, C);
  const n = table.rows;
  const keep = sampleRows(n, maxPoints(k.count));
  const color = colorOf(C);
  const sMin = S?.min ?? 0;
  const sSpan = S ? S.max - S.min || 1 : 1;
  let shown = 0;
  let skipped = 0;
  for (let i = 0; i < n; i++) if (!Number.isNaN(X.values[i]) && !Number.isNaN(Y.values[i]) && (!Z || !Number.isNaN(Z.values[i]))) shown++; // prettier-ignore
  const drawn = keep ? Math.min(shown, maxPoints(k.count)) : shown;
  const sigma = Math.max(0.006, Math.min(0.02, 0.17 / Math.cbrt(Math.max(1, drawn))));
  const shadows = drawn <= 6000;
  shown = 0;
  for (let i = 0; i < n; i++) {
    if (keep && !keep[i]) continue;
    const x = X.values[i];
    const y = Y.values[i];
    const z = Z ? Z.values[i] : 0;
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      skipped++;
      continue;
    }
    const p = Z ? ch.at(x, y, z) : [ch.X(x), ch.Y(y), 0];
    const s = S && !Number.isNaN(S.values[i]) ? 0.55 + 1.25 * Math.sqrt((S.values[i] - sMin) / sSpan) : 1; // prettier-ignore
    const c = color(C ? C.values[i] : 0);
    ch.point(p, c, sigma * s, 0.95, { to: [p[0], 0.002, p[2]], channel: 0 });
    // A faint shadow on the floor under each point helps tell near from far.
    if (shadows) ch.point([p[0], 0.001, p[2]], "#6d727a", sigma * s * 0.8, 0.16);
    shown++;
  }
  report.shown = shown;
  report.skipped = keep ? 0 : skipped;
  report.sampled = !!keep;
  report.missing = n - (keep ? n : shown + skipped) + skipped;
}

// Bins a column for bars and surfaces: one bin per category or per whole
// value (years, months), or `want` equal bins.
export function binsOf(c, want) {
  if (c.type === "category") {
    const n = Math.min(c.labels.length, 30);
    return { n, of: (v) => (v < n ? v : -1), center: (b) => b, kind: "category" };
  }
  if (c.type === "number" && c.whole && c.distinct <= 60) {
    const n = c.max - c.min + 1;
    if (n <= 160) return { n, of: (v) => v - c.min, center: (b) => c.min + b, kind: "whole" };
  }
  const span = c.max - c.min || 1;
  return {
    n: want,
    of: (v) => Math.min(want - 1, Math.floor(((v - c.min) / span) * want)),
    center: (b) => c.min + ((b + 0.5) / want) * span,
    kind: "range",
  };
}

function grid(k, ch, table, { X, Y, Z, C }, report, chart) {
  const want = chart === "surface" ? 28 : 14;
  const bx = binsOf(X, want);
  const bz = Z ? binsOf(Z, want) : { n: 1, of: () => 0, center: () => 0, kind: "one" };
  const nx = bx.n;
  const nz = bz.n;
  const sum = new Float64Array(nx * nz);
  const cnt = new Float64Array(nx * nz);
  const csum = new Float64Array(nx * nz);
  const ccnt = new Float64Array(nx * nz);
  const votes = C?.type === "category" ? Array.from({ length: nx * nz }, () => new Map()) : null;
  let skipped = 0;
  for (let i = 0; i < table.rows; i++) {
    const x = X.values[i];
    const z = Z ? Z.values[i] : 0;
    const y = Y ? Y.values[i] : 1;
    if (Number.isNaN(x) || Number.isNaN(z) || Number.isNaN(y)) {
      skipped++;
      continue;
    }
    const a = bx.of(x);
    const b = bz.of(z);
    if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
    const j = b * nx + a;
    sum[j] += y;
    cnt[j]++;
    if (C && !Number.isNaN(C.values[i])) {
      if (votes) votes[j].set(C.values[i], (votes[j].get(C.values[i]) || 0) + 1);
      csum[j] += C.values[i];
      ccnt[j]++;
    }
  }
  const val = new Float64Array(nx * nz).fill(NaN);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < val.length; j++) {
    if (!cnt[j]) continue;
    val[j] = Y ? sum[j] / cnt[j] : cnt[j];
    lo = Math.min(lo, val[j]);
    hi = Math.max(hi, val[j]);
  }
  if (!Number.isFinite(lo)) throw new Error("No rows have values in all of the columns picked.");
  // Bars start at zero, unless every value sits far from it (then the axis
  // says where it starts).
  const far = lo > 0 ? lo > 0.4 * hi : hi < 0 ? hi < 0.4 * lo : false;
  const base = far ? null : 0;
  const yName = Y ? `${Y.name}${table.rows > cnt.filter(Boolean).length ? " (mean)" : ""}` : "Rows";
  const ymin = base === null ? lo - (hi - lo) * 0.08 : Math.min(0, lo);
  const ymax = base === null ? hi + (hi - lo) * 0.04 : Math.max(0, hi);
  ch.axis("y", { name: yName, type: Y?.type === "date" ? "date" : "number", min: ymin, max: ymax });
  const xAxis = { name: X.name, type: bx.kind === "category" ? "category" : X.type };
  if (bx.kind === "category")
    Object.assign(xAxis, { labels: X.labels.slice(0, nx), min: -0.5, max: nx - 0.5 }); // prettier-ignore
  else if (bx.kind === "whole") Object.assign(xAxis, { min: X.min - 0.5, max: X.min + nx - 0.5 });
  else Object.assign(xAxis, { min: X.min, max: X.max });
  ch.axis("x", xAxis);
  if (Z) {
    const zAxis = { name: Z.name, type: bz.kind === "category" ? "category" : Z.type };
    if (bz.kind === "category")
      Object.assign(zAxis, { labels: Z.labels.slice(0, nz), min: -0.5, max: nz - 0.5 }); // prettier-ignore
    else if (bz.kind === "whole") Object.assign(zAxis, { min: Z.min - 0.5, max: Z.min + nz - 0.5 });
    else Object.assign(zAxis, { min: Z.min, max: Z.max });
    ch.axis("z", zAxis);
  } else ch.axis("z", { name: "", min: -0.5, max: 0.5, ticks: [] });
  ch.frame({ zAxis: !!Z });
  // Colors: the color column's mean (or its most common category) per cell,
  // or the height.
  const cellColor = (j) => {
    if (!C) return sequential((val[j] - lo) / (hi - lo || 1));
    if (!ccnt[j]) return "#9aa0a8";
    if (votes) {
      let best = 0;
      let bestN = -1;
      for (const [v, n] of votes[j]) if (n > bestN) [best, bestN] = [v, n];
      return categorical(best);
    }
    return sequential((csum[j] / ccnt[j] - C.min) / (C.max - C.min || 1));
  };
  if (C) legendFor(ch, C);
  else ch.legend(sequential, { name: yName, lo: fmtNear(ch, lo), hi: fmtNear(ch, hi) });
  const y0 = ch.Y(base === null ? ymin : 0);
  const cellW = ch.w / nx;
  const cellD = Z ? ch.d / nz : ch.d * 0.4;
  let cells = 0;
  if (chart === "bars") {
    for (let b = 0; b < nz; b++)
      for (let a = 0; a < nx; a++) {
        const j = b * nx + a;
        if (Number.isNaN(val[j])) continue;
        const x = xAxis.type === "category" || bx.kind === "whole" ? ch.X(bx.center(a)) : -ch.w / 2 + (a + 0.5) * cellW; // prettier-ignore
        const z = !Z ? 0 : bz.kind === "range" ? ch.d / 2 - (b + 0.5) * cellD : ch.Z(bz.center(b));
        const top = ch.Y(val[j]);
        const h = Math.max(0.004, Math.abs(top - y0));
        const yc = (top + y0) / 2;
        const c = cellColor(j);
        k.add(k.box(cellW * 0.78, h, cellD * 0.78), {
          pos: [x, yc, z],
          even: true,
          opacity: 1,
          color: (cc) => light(c, [0.08, -0.12, 0.22, -0.3, 0.02, -0.18][cc.s.face] ?? 0),
          to: (cc) => [cc.p[0], y0 + (cc.p[1] - y0) * 0.02, cc.p[2]],
          channel: 0,
          pattern: false,
        });
        cells++;
      }
  } else {
    // The surface through the cells' centers; gaps of one or two cells are
    // filled from their neighbors, bigger ones stay open.
    const filled = fillGaps(val, nx, nz, 2);
    const at = (u, v) => {
      const fx = u * (nx - 1);
      const fz = v * (nz - 1);
      const a = Math.min(nx - 2, Math.floor(fx));
      const b = Math.min(nz - 2, Math.floor(fz));
      const s = fx - a;
      const t = fz - b;
      const g = (aa, bb) => filled[bb * nx + aa];
      const q = [g(a, b), g(a + 1, b), g(a, b + 1), g(a + 1, b + 1)];
      if (q.some(Number.isNaN)) return NaN;
      return (q[0] * (1 - s) + q[1] * s) * (1 - t) + (q[2] * (1 - s) + q[3] * s) * t;
    };
    const xs = (u) => -ch.w / 2 + (0.5 + u * (nx - 1)) * cellW;
    const zs = (v) => (Z ? ch.d / 2 - (0.5 + v * (nz - 1)) * cellD : 0);
    if (nx < 2 || nz < 2)
      throw new Error("A surface needs at least two values on X and on Z. Try Bars.");
    for (let j = 0; j < filled.length; j++) if (!Number.isNaN(filled[j])) cells++;
    const e = 0.004;
    k.add(
      k.param(
        (u, v) => {
          const h = at(u, v);
          return [xs(u), Number.isNaN(h) ? -10 : ch.Y(h), zs(v)];
        },
        { grid: 96 },
      ),
      {
        even: true,
        opacity: 1,
        flat: 0.35,
        color: (cc) => {
          const u = (cc.lp[0] + ch.w / 2) / cellW - 0.5;
          const v = (ch.d / 2 - cc.lp[2]) / cellD - 0.5;
          const uu = Math.max(0, Math.min(1, u / (nx - 1)));
          const vv = Math.max(0, Math.min(1, v / (nz - 1)));
          const h = at(uu, vv);
          if (Number.isNaN(h)) return null;
          // A light from the upper left, from the surface's slope.
          const dx = (at(Math.min(1, uu + e), vv) - at(Math.max(0, uu - e), vv)) / (2 * e * (nx - 1) * cellW); // prettier-ignore
          const dz = (at(uu, Math.min(1, vv + e)) - at(uu, Math.max(0, vv - e))) / (2 * e * (nz - 1) * cellD); // prettier-ignore
          const sy = ch.h / (ymax - ymin || 1);
          const n = [-dx * sy, 1, dz * sy];
          const l = Math.hypot(...n) || 1;
          const lit = (n[0] * -0.45 + n[1] * 0.8 + n[2] * 0.4) / l;
          const j = Math.round(vv * (nz - 1)) * nx + Math.round(uu * (nx - 1));
          const base = C ? cellColor(j) : sequential((h - lo) / (hi - lo || 1));
          return light(base, Number.isNaN(lit) ? 0 : (lit - 0.75) * 0.6);
        },
        to: (cc) => [cc.p[0], y0 + (cc.p[1] - y0) * 0.02, cc.p[2]],
        channel: 0,
        pattern: false,
      },
    );
  }
  report.shown = cells;
  report.cells = nx * nz;
  report.skipped = skipped;
  report.base = base === null ? fmtNear(ch, ymin) : null;
}

function fmtNear(ch, v) {
  const a = ch.axes.y;
  return valueText({ type: a.type }, v, a.max - a.min);
}

// Fills NaN cells that have numbers around them, `passes` times.
export function fillGaps(val, nx, nz, passes) {
  let cur = Float64Array.from(val);
  for (let p = 0; p < passes; p++) {
    const next = Float64Array.from(cur);
    for (let b = 0; b < nz; b++)
      for (let a = 0; a < nx; a++) {
        const j = b * nx + a;
        if (!Number.isNaN(cur[j])) continue;
        let s = 0;
        let n = 0;
        for (const [da, db] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          // prettier-ignore
          const aa = a + da;
          const bb = b + db;
          if (aa < 0 || bb < 0 || aa >= nx || bb >= nz) continue;
          const v = cur[bb * nx + aa];
          if (!Number.isNaN(v)) {
            s += v;
            n++;
          }
        }
        if (n >= 2) next[j] = s / n;
      }
    cur = next;
  }
  return cur;
}
