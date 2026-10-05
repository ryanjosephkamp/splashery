// Lane Data and climate: the Climate records toy's data and charts.
//
// - readCO2: NOAA GML's monthly mean CO2 at Mauna Loa (the shipped snapshot
//   starts in May 1974; docs/handoff/DataClimate.md says why).
// - readGistemp: NASA GISS GISTEMP v4's global Land-Ocean Temperature Index,
//   monthly anomalies from the 1951-1980 mean, in degrees Celsius.
// - co2Spiral, temperatureBars, temperatureWall: the three views.

import { Chart, formatTick } from "./chart.js";
import { sequential, diverging, light } from "./colors.js";

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]; // prettier-ignore

// NOAA's file: comment lines, then year,month,decimal date,average,
// deseasonalized,ndays,sdev,unc. A negative ndays marks a month NOAA filled in.
export function readCO2(text) {
  const rows = [];
  let header = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const f = line.split(",").map((s) => s.trim());
    if (!header) {
      header = f;
      continue;
    }
    const get = (k) => Number(f[header.indexOf(k)]);
    rows.push({
      year: get("year"),
      month: get("month"),
      decimal: get("decimal date"),
      ppm: get("average"),
      trend: get("deseasonalized"),
      days: get("ndays"),
      filled: get("ndays") < 0,
    });
  }
  if (!rows.length) throw new Error("No CO2 rows found.");
  return rows;
}

// GISTEMP's table: a title line, then Year,Jan..Dec,J-D,D-N,DJF,MAM,JJA,SON;
// "***" marks a value not yet available.
export function readGistemp(text) {
  const out = [];
  let header = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const f = line.split(",").map((s) => s.trim());
    if (!header) {
      if (f[0] === "Year") header = f;
      continue;
    }
    if (!/^\d{4}$/.test(f[0])) continue;
    const num = (s) => (s === "***" || s === "" ? NaN : Number(s));
    const months = MONTHS.map((_, i) => num(f[1 + i]));
    out.push({ year: Number(f[0]), months, annual: num(f[header.indexOf("J-D")]) });
  }
  if (!out.length) throw new Error("No GISTEMP rows found.");
  return out;
}

// ---- The CO2 spiral ---------------------------------------------------------------------
// One turn a year, January in front, climbing from May 1974 at the bottom to
// the latest month at the top; the distance from the center pole is the
// month's mean CO2. So the coil widens as CO2 rises, more steeply in the
// later years, and every turn is pushed out toward May and pulled in toward
// October: the yearly breath of the Northern Hemisphere's plants.

export const SPIRAL = { r0: 0.18, r1: 1.0, lo: 320, hi: 440, H: 1.9 };

export const spiralRadius = (ppm, S = SPIRAL) => S.r0 + ((ppm - S.lo) / (S.hi - S.lo)) * (S.r1 - S.r0); // prettier-ignore

export function spiralPoint(row, first, last, S = SPIRAL) {
  const a = ((row.month - 0.5) / 12) * Math.PI * 2;
  const r = spiralRadius(row.ppm, S);
  const y = ((row.decimal - first.decimal) / (last.decimal - first.decimal)) * S.H;
  return [r * Math.sin(a), y, r * Math.cos(a)];
}

// The curve through the months (Catmull-Rom on the radius between them, the
// angle and the height straight on), t in 0..1 over the record.
export function spiralCurve(rows, S = SPIRAL) {
  const n = rows.length;
  const a0 = ((rows[0].month - 0.5) / 12) * Math.PI * 2;
  const rad = (j) => spiralRadius(rows[Math.max(0, Math.min(n - 1, j))].ppm, S);
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); // prettier-ignore
  };
  return (t) => {
    const f = Math.max(0, Math.min(1, t)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const s = f - i;
    const a = a0 + ((i + s) * Math.PI * 2) / 12;
    const r = cr(rad(i - 1), rad(i), rad(i + 1), rad(i + 2), s);
    return [r * Math.sin(a), (f / (n - 1)) * S.H, r * Math.cos(a)];
  };
}

export function co2Spiral(k, rows, { source = "", px = 0.015 } = {}) {
  const S = SPIRAL;
  const ch = new Chart({ w: 2 * S.r1, h: S.H, d: 2 * S.r1, px });
  const n = rows.length;
  const first = rows[0];
  const last = rows[n - 1];
  const curve = spiralCurve(rows, S);
  // The coil's splats follow the device's budget (fewer on a phone).
  const along = Math.round(Math.min(140000, Math.max(24000, k.count * 0.45)));
  const sigma = 0.0062;
  for (let i = 0; i < along; i++) {
    const t = i / (along - 1);
    const p = curve(t);
    // Colored by CO2, a little light on the side facing the front.
    const c = sequential((Math.hypot(p[0], p[2]) - S.r0) / (S.r1 - S.r0));
    const lit = (p[0] * 0.35 + p[2] * 0.55) / Math.max(0.2, Math.hypot(p[0], p[2]));
    ch.point(p, light(c, lit * 0.14), sigma, 1, { kind: "fade", params: [Math.min(0.999, t + 0.0005), -0.004], channel: 0 }); // prettier-ignore
  }
  const ink = "#3a3f47";
  // The years: a scale standing at the left, outside the coil.
  const xs = -(S.r1 + 0.14);
  ch.line([xs, 0, 0], [xs, S.H, 0], { color: ink, opacity: 0.8, sigma: 0.0038, step: 0.006 });
  for (const y of [1980, 1990, 2000, 2010, 2020]) {
    const h = ((y - first.decimal) / (last.decimal - first.decimal)) * S.H;
    ch.line([xs, h, 0], [xs - 0.04, h, 0], { color: ink, opacity: 0.85, sigma: 0.003 });
    ch.label(`${y}`, [xs - 0.06, h, 0], { align: "right" });
  }
  // The ppm scale: rings on the floor, labeled along a line across the view.
  const tickA = Math.PI / 2 + 0.45;
  for (let v = S.lo + 20; v <= S.hi; v += 20) {
    const r = spiralRadius(v, S);
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      ch.point([r * Math.sin(a), 0, r * Math.cos(a)], "#8b8f97", 0.0045, 0.35);
    }
    if (v === 360 || v === S.hi) ch.label(v === S.hi ? `${v} PPM` : `${v}`, [r * Math.sin(tickA), -px * 1.5, r * Math.cos(tickA)], { valign: "top", scale: 0.9, align: v === S.hi ? "left" : "right" }); // prettier-ignore
  }
  // Four months around the top of the coil (January in front).
  const ring = spiralRadius(last.ppm, S) + 0.1;
  for (let m = 0; m < 12; m += 3) {
    const a = ((m + 0.5) / 12) * Math.PI * 2;
    ch.label(MONTHS[m], [ring * Math.sin(a), S.H, ring * Math.cos(a)], { scale: 0.85 });
  }
  // The ends of the record.
  ch.label(`${MONTHS[first.month - 1]} ${first.year}: ${first.ppm.toFixed(1)} PPM`, [0, -px * 12, 0], { valign: "top", scale: 0.9 }); // prettier-ignore
  ch.label(`${MONTHS[last.month - 1]} ${last.year}: ${last.ppm.toFixed(1)} PPM`, [0, S.H + px * 8, 0], { valign: "bottom", scale: 0.9 }); // prettier-ignore
  ch.label("CO₂ AT MAUNA LOA", [0, S.H + px * 30, 0], { scale: 1.2, color: "#101318", valign: "bottom" }); // prettier-ignore
  if (source) ch.label(source, [0, S.H + px * 20, 0], { scale: 0.75, color: "#4a505a", valign: "bottom" }); // prettier-ignore
  // The pen: a bright bead that leads the line while the record draws itself
  // (a token of its own, after the labels).
  const bead = ch.labels.length;
  const b0 = curve(0);
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996;
    const r = 0.02 * Math.sqrt((i + 0.5) / 40);
    const z = (i / 39 - 0.5) * 0.026;
    ch.point([b0[0] + r * Math.cos(a), b0[1] + r * Math.sin(a), b0[2] + z], i < 12 ? "#ffffff" : "#ffcf5a", 0.01, 1, { kind: "token", params: [bead, 0] }); // prettier-ignore
  }
  ch.emit(k);
  k.data = { view: "co2", labels: ch.labels, bead, b0, curve, rows, first, last };
  return k.data;
}

// ---- Temperature --------------------------------------------------------------------------

const TEMP = { lo: -1.0, hi: 1.6 };
const anomalyColor = (v) => diverging(Math.max(-1, Math.min(1, v / 1.2)));
const degrees = (v) => (v === 0 ? "0" : v > 0 ? `+${formatTick(v, 0.5)}` : formatTick(v, 0.5));

function temperatureFrame(ch, years, { z = true, px }) {
  ch.axis("x", { name: "YEAR", min: years[0] - 0.5, max: years[years.length - 1] + 0.5, ticks: [1900, 1950, 2000].filter((y) => y >= years[0]).map((v) => ({ v, text: String(v) })) }); // prettier-ignore
  ch.axis("y", { name: "°C VS 1951–1980", min: TEMP.lo, max: TEMP.hi, ticks: [-1, -0.5, 0, 0.5, 1, 1.5].map((v) => ({ v, text: degrees(v) })) }); // prettier-ignore
  if (z)
    ch.axis("z", { name: "MONTH", min: 0.5, max: 12.5, ticks: [1, 7].map((m) => ({ v: m, text: MONTHS[m - 1] })) }); // prettier-ignore
  else ch.axis("z", { name: "", min: 0, max: 1, ticks: [] });
  ch.frame({ zAxis: z, walls: true, zSide: "right" });
  // The zero plane's outline: anomalies rise above it or hang below it.
  const y0 = ch.Y(0);
  const [x0, x1, z0, z1] = [-ch.w / 2, ch.w / 2, -ch.d / 2, ch.d / 2];
  const zero = { color: "#5b616b", opacity: 0.6, sigma: 0.0034 };
  ch.line([x0, y0, z0], [x1, y0, z0], zero);
  ch.line([x0, y0, z1], [x1, y0, z1], zero);
  ch.line([x1, y0, z0], [x1, y0, z1], zero);
  ch.line([x0, y0, z0], [x0, y0, z1], zero);
  ch.legend((t) => diverging(t * 2 - 1), { name: "°C", lo: "-1.2", hi: "+1.2" });
  return y0;
}

function bar(k, x, z, w, d, y0, top, color) {
  const h = Math.max(0.003, Math.abs(top - y0));
  k.add(k.box(w, h, d), {
    pos: [x, (top + y0) / 2, z],
    even: true,
    opacity: 1,
    size: 0.8,
    color: (cc) => light(color, [0.06, -0.1, 0.2, -0.3, 0.02, -0.16][cc.s.face] ?? 0),
    to: (cc) => [cc.p[0], y0 + (cc.p[1] - y0) * 0.02, cc.p[2]],
    channel: 0,
    pattern: false,
  });
}

// Every month since 1880: years across, months in depth.
export function temperatureBars(k, data, { source = "", px = 0.015 } = {}) {
  const years = data.map((r) => r.year);
  const ch = new Chart({ w: 2.0, h: 1.35, d: 1.3, px });
  const y0 = temperatureFrame(ch, years, { z: true, px });
  const cw = ch.w / years.length;
  const cd = ch.d / 12;
  let bars = 0;
  for (const r of data)
    for (let m = 0; m < 12; m++) {
      const v = r.months[m];
      if (Number.isNaN(v)) continue;
      bar(k, ch.X(r.year), ch.Z(m + 1), cw * 0.86, cd * 0.8, y0, ch.Y(v), anomalyColor(v));
      bars++;
    }
  ch.label("GLOBAL TEMPERATURE", [0, ch.h + px * 40, -ch.d / 2], { scale: 1.1, color: "#101318", valign: "bottom" }); // prettier-ignore
  if (source) ch.label(source, [0, ch.h + px * 31, -ch.d / 2], { scale: 0.75, color: "#4a505a", valign: "bottom" }); // prettier-ignore
  ch.emit(k);
  k.data = { view: "months", labels: ch.labels, bars, years: [years[0], years[years.length - 1]] };
  return k.data;
}

// Each year's mean as a wall of colored stripes, as high as the year was warm.
export function temperatureWall(k, data, { source = "", px = 0.015 } = {}) {
  const full = data.filter((r) => !Number.isNaN(r.annual));
  const years = full.map((r) => r.year);
  const ch = new Chart({ w: 2.0, h: 1.35, d: 0.4, px });
  const y0 = temperatureFrame(ch, years, { z: false, px });
  const cw = ch.w / years.length;
  for (const r of full) bar(k, ch.X(r.year), 0, cw * 0.94, ch.d * 0.7, y0, ch.Y(r.annual), anomalyColor(r.annual)); // prettier-ignore
  const last = full[full.length - 1];
  ch.label(`${last.year}: ${degrees(last.annual)}`, [ch.X(last.year), ch.Y(last.annual) + px * 5, 0], { align: "right", valign: "bottom", scale: 0.9 }); // prettier-ignore
  ch.label("GLOBAL TEMPERATURE", [0, ch.h + px * 40, -ch.d / 2], { scale: 1.1, color: "#101318", valign: "bottom" }); // prettier-ignore
  if (source) ch.label(source, [0, ch.h + px * 31, -ch.d / 2], { scale: 0.75, color: "#4a505a", valign: "bottom" }); // prettier-ignore
  ch.emit(k);
  k.data = { view: "years", labels: ch.labels, bars: full.length, years: [years[0], last.year] };
  return k.data;
}
