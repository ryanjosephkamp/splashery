// Lane Data and climate: a 3D chart frame made of splats. A Chart maps data
// values into a box (x across, y up, z in depth), draws its floor grid, axes,
// tick marks and labels, and collects every splat it makes into one exact
// cloud. Labels are tokens that turn to face the camera (src/datavis/text.js).
//
//   const ch = new Chart({ w: 2, h: 1.3, d: 2 });
//   ch.axis("x", { name: "Year", min: 1974, max: 2026 });
//   ...
//   ch.frame(); ch.point([x, y, z], color, sigma); ch.emit(k);
//
// Coordinates: x in -w/2..w/2, y in 0..h, z in -d/2..d/2 (recipe units).

import { labelSplats, MAX_LABELS } from "./text.js";
import { rgb } from "../kit.js";

const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]; // prettier-ignore
const DAY = 86400000;

// "Nice" ticks between min and max: steps of 1, 2 or 5 times a power of ten.
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [], step: 1 };
  if (max === min) return { ticks: [min], step: 1 };
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step)
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { ticks, step };
}

// A tick's text: as few decimals as the step needs, K and M for big numbers.
export function formatTick(v, step = 1) {
  const a = Math.abs(v);
  const minus = v < 0 ? "-" : "";
  if (a >= 1e9 && step >= 1e8) return `${minus}${trim(a / 1e9, step / 1e9)}B`;
  if (a >= 1e6 && step >= 1e5) return `${minus}${trim(a / 1e6, step / 1e6)}M`;
  if (a >= 1e4 && step >= 1e3) return `${minus}${trim(a / 1e3, step / 1e3)}K`;
  return `${minus}${trim(a, step)}`;
}
function trim(v, step) {
  const d = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  return v.toFixed(d);
}

// Ticks for dates (ms since 1970, UTC): whole years, months or days.
export function dateTicks(min, max, count = 5) {
  const span = max - min;
  const out = [];
  if (span > 3 * 365 * DAY) {
    const y0 = new Date(min).getUTCFullYear();
    const y1 = new Date(max).getUTCFullYear() + 1;
    const { ticks } = niceTicks(y0, y1, count);
    for (const y of ticks) {
      const v = Date.UTC(y, 0, 1);
      if (v >= min - DAY && v <= max + DAY) out.push({ v, text: String(y) });
    }
  } else if (span > 75 * DAY) {
    const months = span / (30.44 * DAY);
    const every = [1, 2, 3, 6, 12].find((m) => months / m <= count + 1) || 12;
    const d = new Date(min);
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth() + 1;
    for (;;) {
      if (m > 11) {
        y += Math.floor(m / 12);
        m %= 12;
      }
      const v = Date.UTC(y, m, 1);
      if (v > max) break;
      if (m % every === 0) out.push({ v, text: m === 0 ? String(y) : `${MONTH[m]} ${String(y).slice(2)}` }); // prettier-ignore
      m++;
    }
  } else {
    const days = span / DAY;
    const every = [1, 2, 5, 7, 10, 15].find((s) => days / s <= count + 1) || 15;
    const start = Math.ceil(min / DAY) * DAY;
    for (let v = start, i = 0; v <= max; v += DAY, i++) {
      const d = new Date(v);
      if ((d.getUTCDate() - 1) % every === 0 && d.getUTCDate() < 30)
        out.push({ v, text: `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}` });
    }
    if (!out.length) out.push({ v: min, text: new Date(min).toISOString().slice(0, 10) });
  }
  return out;
}

export class Chart {
  constructor({ w = 2, h = 1.3, d = 2, px = 0.018, grid = "#8b8f97" } = {}) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.px = px;
    this.gridColor = grid;
    this.axes = {};
    this.splats = [];
    this.labels = [];
  }

  // key "x" | "y" | "z"; type "number" | "date" | "category"; labels for
  // categories; ticks: a list of { v, text } to use instead of nice ones.
  axis(key, a) {
    const ax = { type: "number", ...a };
    if (!(ax.max > ax.min)) {
      const c = Number.isFinite(ax.min) ? ax.min : 0;
      ax.min = c - 0.5;
      ax.max = c + 0.5;
    }
    this.axes[key] = ax;
    return ax;
  }

  // A value's place along an axis, 0..1.
  // flip: true runs the axis the other way (depth down, say).
  frac(key, v) {
    const a = this.axes[key];
    const f = (v - a.min) / (a.max - a.min);
    return a.flip ? 1 - f : f;
  }

  // A data point's place in the box.
  at(x, y, z) {
    return [
      (this.frac("x", x) - 0.5) * this.w,
      this.frac("y", y) * this.h,
      (0.5 - this.frac("z", z)) * this.d,
    ];
  }
  X(v) {
    return (this.frac("x", v) - 0.5) * this.w;
  }
  Y(v) {
    return this.frac("y", v) * this.h;
  }
  Z(v) {
    return (0.5 - this.frac("z", v)) * this.d;
  }

  ticks(key, count = 5) {
    const a = this.axes[key];
    if (a.ticks) return a.ticks;
    if (a.type === "date") return dateTicks(a.min, a.max, count);
    if (a.type === "category") {
      const n = a.labels.length;
      const every = Math.max(1, Math.ceil(n / 8));
      const out = [];
      for (let i = 0; i < n; i += every)
        out.push({ v: i, text: shorten(a.labels[i], n > 4 ? 9 : 14) });
      return out;
    }
    const { ticks, step } = niceTicks(a.min, a.max, count);
    return ticks.map((v) => ({ v, text: formatTick(v, step) }));
  }

  // A label (a token of its own). Returns false when the labels are used up.
  label(text, anchor, opts = {}) {
    if (!text || this.labels.length >= MAX_LABELS) return false;
    const token = this.labels.length;
    const px = (opts.scale ?? 1) * this.px;
    this.labels.push({ token, anchor: anchor.slice(), text });
    for (const s of labelSplats(text, { anchor, px, token, ...opts })) this.splats.push(s);
    return true;
  }

  // A thin line of round splats from a to b.
  line(
    a,
    b,
    { color = this.gridColor, opacity = 0.5, sigma = 0.0045, step = 0.011, kind, params } = {},
  ) {
    // prettier-ignore
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.splats.push({
        p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
        color,
        opacity,
        scales: [sigma, sigma, sigma],
        quat: [0, 0, 0, 1],
        pattern: false,
        ...(kind ? { kind, params } : {}),
      });
    }
  }

  point(p, color, sigma, opacity = 0.95, extra = null) {
    this.splats.push({
      p,
      color,
      opacity,
      scales: [sigma, sigma, sigma],
      quat: [0, 0, 0, 1],
      pattern: false,
      ...extra,
    });
  }

  // The floor grid, the back walls' lines for y, the three axes with tick
  // marks, and their labels. sides: which walls carry y lines.
  frame({
    walls = true,
    titles = true,
    xTicks = 5,
    yTicks = 5,
    zTicks = 5,
    zAxis = true,
    zSide = "left",
  } = {}) {
    // prettier-ignore
    const { w, h, d, px } = this;
    const x0 = -w / 2;
    const x1 = w / 2;
    const z0 = -d / 2;
    const z1 = d / 2;
    const gap = px * 4;
    const tick = px * 3;
    const ink = "#3a3f47";
    const xt = this.ticks("x", xTicks);
    const zt = zAxis ? this.ticks("z", zTicks) : [];
    const yt = this.ticks("y", yTicks);
    // Floor grid.
    for (const t of xt) {
      const x = this.X(t.v);
      this.line([x, 0, z0], [x, 0, z1], { opacity: 0.32 });
    }
    for (const t of zt) {
      const z = this.Z(t.v);
      this.line([x0, 0, z], [x1, 0, z], { opacity: 0.32 });
    }
    // Back and left walls: the y lines.
    if (walls) {
      for (const t of yt) {
        const y = this.Y(t.v);
        this.line([x0, y, z0], [x1, y, z0], { opacity: 0.26 });
        this.line([x0, y, z0], [x0, y, z1], { opacity: 0.26 });
      }
    }
    // The axes themselves.
    const axisLine = { color: ink, opacity: 0.85, sigma: 0.006, step: 0.009 };
    this.line([x0, 0, z1], [x1, 0, z1], axisLine);
    const xz = zSide === "right" ? x1 : x0;
    const out = zSide === "right" ? 1 : -1;
    if (zAxis) this.line([xz, 0, z0], [xz, 0, z1], axisLine);
    this.line([x0, 0, z0], [x0, h, z0], axisLine);
    // Ticks and their labels.
    for (const t of xt) {
      const x = this.X(t.v);
      this.line([x, 0, z1], [x, 0, z1 + tick], axisLine);
      this.label(t.text, [x, -gap * 0.4, z1 + tick + gap], { valign: "top" });
    }
    for (const t of zt) {
      const z = this.Z(t.v);
      this.line([xz, 0, z], [xz + out * tick, 0, z], axisLine);
      this.label(t.text, [xz + out * (tick + gap), -gap * 0.4, z], { align: out > 0 ? "left" : "right", valign: "top" }); // prettier-ignore
    }
    for (const t of yt) {
      const y = this.Y(t.v);
      this.line([x0, y, z0], [x0 - tick, y, z0], axisLine);
      this.label(t.text, [x0 - tick - gap * 0.6, y, z0], { align: "right" });
    }
    if (titles) {
      const A = this.axes;
      const big = { scale: 1.2, color: "#14171c" };
      if (A.x.name) this.label(shorten(A.x.name, 26), [0, -px * 16, z1 + tick + gap * 4], { ...big, valign: "top" }); // prettier-ignore
      if (zAxis && A.z.name) this.label(shorten(A.z.name, 22), [xz + out * (tick + gap * 2), -px * 14, z1 + gap * 2], { ...big, valign: "top", align: out > 0 ? "left" : "right" }); // prettier-ignore
      if (A.y.name) this.label(shorten(A.y.name, 26), [x0 - tick, h + px * 6, z0], { ...big, align: "right", valign: "bottom" }); // prettier-ignore
    }
  }

  // A color bar standing at the back-right corner, with its ends labeled.
  legend(color, { name = "", lo = "", hi = "", steps = 40 } = {}) {
    const x = this.w / 2 + this.px * 6;
    const z = -this.d / 2;
    const h = this.h * 0.55;
    const y0 = this.h * 0.08;
    for (let i = 0; i <= steps * 3; i++) {
      const t = i / (steps * 3);
      this.point([x, y0 + t * h, z], color(t), 0.022, 1);
    }
    this.label(hi, [x + this.px * 3, y0 + h, z], { align: "left" });
    this.label(lo, [x + this.px * 3, y0, z], { align: "left" });
    if (name) this.label(shorten(name, 18), [x, y0 + h + this.px * 7, z], { valign: "bottom" });
  }

  // Emits every collected splat as one cloud with exactly that many splats.
  emit(k, extra = {}) {
    const list = this.splats;
    if (!list.length) return;
    k.cloud({ share: (list.length + 0.4) / k.count, jitter: 0, ...extra }, (rand, i) => {
      const s = list[i];
      if (!s) return null;
      return { ...s, color: rgb(s.color) };
    });
  }
}

export function shorten(s, n) {
  s = String(s ?? "");
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}
