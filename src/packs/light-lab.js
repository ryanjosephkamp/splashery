// Lane Sound and light lab (prefix sll): the Light lab, on the Lab shelf
// (labs only). Four views, one toy:
//
// - Line spectra: the visible lines of sixteen elements from NIST's
//   Handbook of Basic Atomic Spectroscopic Data (src/labs/nist-lines.js,
//   built by tools/sll-nist.mjs), drawn as real line spectra on a panel of
//   splats, one strip per element, to compare. A tap picks the next element
//   and labels its strongest lines.
// - Prism and grating: an optical bench of splats. A lamp's beam passes a
//   glass prism (Snell's law at both faces, the glass's index from its
//   Sellmeier fit) or a grating (d sin θ = m λ), and every ray goes where
//   the sums send it, onto a card that shows the spectrum. White light makes
//   a rainbow; an element's lamp makes its lines. A tap changes the lamp.
// - Home spectrometer: the camera (asked for only on a tap), a CD or DVD as
//   a grating, and a fluorescent lamp. A band of the picture becomes a
//   spectrum, calibrated on mercury's blue and green lines, shown beside
//   NIST's lines. Before the camera is on it reads a picture the page makes.
//
// Everything that changes with the lamp is drawn into the toy's screen
// canvas: the panels and the card are screen splats, and the rays are
// relief splats that hide where their wavelength has no light (alpha), so a
// new lamp needs no rebuild.

import { shade, mix, clamp, quatFromTo } from "../kit.js";
import { live } from "../live/live.js";
import { NIST_LINES } from "../labs/nist-lines.js";
import { boxSplats, faceSplats, lit, budgetN, budgetGap } from "../labs/splat-shapes.js";
import { nmColor, nmHex, prismGeometry, minDeviationBeam, prismRay, minDeviation, gratingAngle, GRATINGS, lineSpectrum, profileOf, brightBand, calibrate, pxToNm, nmToPx, peaksOf, samplePhoto, HG_BLUE, HG_GREEN, NM_LO, NM_HI } from "../labs/light-optics.js"; // prettier-ignore

const FONT = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
const LW = 1024; // the left half of the canvas: colors
const LH = 576;
const RAY_ROW = 560; // the rays' colors along this row, their masks in the right half
const MAX_RAYS = 1024;
// The toy's camera looks down by PITCH (src/toys.js), so its panels lean
// back by as much to face it.
const PITCH = 0.5;
const FACE_UP = [0, Math.cos(PITCH), -Math.sin(PITCH)];

// ---- Glass ------------------------------------------------------------------------------
// Schott's Sellmeier fits (λ in µm): n² − 1 = Σ Bᵢ λ² / (λ² − Cᵢ).
export const GLASSES = {
  sf11: { label: "Dense flint glass (N-SF11)", B: [1.73759695, 0.313747346, 1.89878101], C: [0.013188707, 0.0623068142, 155.23629] }, // prettier-ignore
  bk7: { label: "Crown glass (N-BK7)", B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] }, // prettier-ignore
};
export function glassIndex(glass, nm) {
  const g = GLASSES[glass] || GLASSES.sf11;
  const l2 = (nm / 1000) ** 2;
  let s = 1;
  for (let i = 0; i < 3; i++) s += (g.B[i] * l2) / (l2 - g.C[i]);
  return Math.sqrt(s);
}

// ---- Sets of elements -------------------------------------------------------------------
export const SETS = {
  lamps: {
    label: "Lamps: hydrogen, helium, neon, sodium, mercury",
    els: ["H", "He", "Ne", "Na", "Hg"],
  },
  noble: { label: "Noble gases", els: ["He", "Ne", "Ar", "Kr", "Xe"] },
  flames: { label: "Flame colors", els: ["Li", "Na", "K", "Ca", "Sr", "Ba", "Cu"] },
  metals: { label: "Metal vapors", els: ["Na", "Zn", "Cd", "Hg"] },
  all: { label: "All sixteen", els: NIST_LINES.map((e) => e.symbol) },
};
const NAME = Object.fromEntries(NIST_LINES.map((e) => [e.symbol, e.name]));

// The lamps for the bench: white light, then every element.
export const SOURCES = ["white", ...NIST_LINES.map((e) => e.symbol)];
const sourceName = (s) => (s === "white" ? "White light" : `${NAME[s]} lamp`);

// ---- State ---------------------------------------------------------------------------
export const LL = {
  view: "spectra",
  set: "lamps",
  glass: "sf11",
  grating: "cd",
  highlight: 0, // the element picked in the spectra view (index in the set)
  source: "white",
  rays: [], // the bench's rays: { nm, el (null for white light), rel, order }
  bench: null, // the bench's geometry for the card
  version: 0,
  taps: 0,
  // The spectrometer.
  photo: null, // an opened picture: { width, height, data, name }
  sample: null,
  frozen: null, // a held reading
  band: null, // [y0, y1] picked by hand (fractions), or null for the brightest band
  reading: null, // { img, band, profile, cal, peaks, from }
  frame: null, // a scratch canvas for camera frames
};

export const lightLabState = () => ({
  view: LL.view,
  set: LL.set,
  source: LL.source,
  highlight: SETS[LL.set].els[LL.highlight % SETS[LL.set].els.length],
  rays: LL.rays.length,
  card: LL.bench?.card ? { ...LL.bench.card } : null,
  reading: LL.reading && {
    from: LL.reading.from,
    band: LL.reading.band,
    cal: LL.reading.cal && { a: LL.reading.cal.a, b: LL.reading.cal.b, blue: LL.reading.cal.blue, green: LL.reading.cal.green }, // prettier-ignore
    peaks: LL.reading.peaks?.map((p) => p.nm) ?? [],
  },
});

export function setSource(s) {
  if (SOURCES.includes(s)) LL.source = s;
  LL.version++;
}

// ---- Drawing helpers -------------------------------------------------------------------
function label(
  g,
  text,
  x,
  y,
  { size = 16, color = "#c9d6e2", align = "left", weight = "600", base = "alphabetic" } = {},
) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = base;
  g.fillText(text, x, y);
}
const hexOf = (c) =>
  `#${c
    .map((v) =>
      Math.round(clamp(v, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
const rgbCss = ([r, gg, b], k = 1) => `rgb(${Math.round(Math.min(1, r * k) * 255)},${Math.round(Math.min(1, gg * k) * 255)},${Math.round(Math.min(1, b * k) * 255)})`; // prettier-ignore

// A strip of an element's lines (or white light's continuum) from x0 to x1.
function strip(g, x0, y, w, h, sym) {
  g.fillStyle = "#020306";
  g.fillRect(x0, y, w, h);
  const xs = (nm) => x0 + ((nm - NM_LO) / (NM_HI - NM_LO)) * w;
  if (sym === "white") {
    for (let i = 0; i < w; i++) {
      g.fillStyle = rgbCss(nmColor(NM_LO + ((i + 0.5) / w) * (NM_HI - NM_LO)));
      g.fillRect(x0 + i, y, 1, h);
    }
    return;
  }
  g.globalCompositeOperation = "lighter";
  for (const l of lineSpectrum(sym)) {
    // Brightness by NIST's relative intensity, on a square-root scale so the
    // weaker lines still show (as the eye sees a lamp).
    const k = Math.sqrt(l.rel);
    if (k < 0.08) continue;
    g.fillStyle = rgbCss(nmColor(l.nm), 0.25 + 0.95 * k);
    g.fillRect(Math.round(xs(l.nm)) - 2, y, 4, h);
  }
  g.globalCompositeOperation = "source-over";
}

function axis(g, x0, y, w, { color = "#9fb2c4", size = 18 } = {}) {
  for (let nm = 400; nm <= 750; nm += 50) {
    const x = x0 + ((nm - NM_LO) / (NM_HI - NM_LO)) * w;
    g.fillStyle = color;
    g.fillRect(Math.round(x), y, 1, 6);
    label(g, String(nm), x, y + 22, { size, color, align: "center" });
  }
  label(g, "nm", x0 + w + 6, y + 22, { size, color });
}

// ---- The line spectra view --------------------------------------------------------------
function drawSpectra(g) {
  g.fillStyle = "#0a0e14";
  g.fillRect(0, 0, LW, 512);
  const els = SETS[LL.set].els;
  const hi = els[LL.highlight % els.length];
  label(g, "Emission lines (NIST)", 18, 36, { size: 28, color: "#eef3f8", weight: "700" }); // prettier-ignore
  label(g, `${NAME[hi]} (${hi})`, LW - 18, 34, { size: 22, color: "#ffe9a8", weight: "700", align: "right" }); // prettier-ignore
  const x0 = 120;
  const w = LW - x0 - 40;
  const rows = ["white", ...els];
  const top = 52;
  const room = 512 - top - 92;
  const h = Math.min(56, Math.floor(room / rows.length) - 6);
  rows.forEach((sym, i) => {
    const y = top + i * (h + 6);
    strip(g, x0, y, w, h, sym);
    const isHi = sym === hi;
    if (isHi) {
      g.strokeStyle = "#ffe9a8";
      g.lineWidth = 2;
      g.strokeRect(x0 - 2, y - 2, w + 4, h + 4);
    }
    const txt = sym === "white" ? "White" : `${sym}`;
    label(g, txt, x0 - 12, y + h / 2 + 7, { size: Math.min(22, h * 0.6 + 6), color: isHi ? "#ffe9a8" : "#c9d6e2", align: "right", weight: "700" }); // prettier-ignore
  });
  const yAxis = top + rows.length * (h + 6);
  axis(g, x0, yAxis, w);
  // The picked element's strongest lines, labeled.
  const lines = lineSpectrum(hi)
    .slice()
    .sort((a, b) => b.rel - a.rel)
    .slice(0, 5)
    .sort((a, b) => a.nm - b.nm);
  label(g, lines.map((l) => `${l.nm.toFixed(1)}`).join("   ") + "  nm (strongest)", x0, yAxis + 56, { size: 22, color: "#ffe9a8", weight: "700" }); // prettier-ignore
}

// ---- The bench (prism and grating) ------------------------------------------------------
// Builds the rays for every lamp, so a new lamp only changes which show.
// Each ray is { nm, el, rel, order, k } with k its pixel in the ray row.
function benchRays(view) {
  const rays = [];
  // One pixel of the ray row per wavelength and lamp, shared by its orders
  // (they show together); the last pixel is the beam's.
  const pix = new Map();
  const add = (r) => {
    const key = `${r.nm}|${r.el}`;
    if (!pix.has(key)) pix.set(key, pix.size);
    const k = pix.get(key);
    if (k < MAX_RAYS - 1) rays.push({ ...r, k, i: rays.length });
  };
  const orders = view === "grating" ? [-2, -1, 1, 2] : [1];
  for (const order of orders) {
    for (let nm = 382; nm <= 748; nm += view === "grating" ? 6 : 4)
      add({ nm, el: null, rel: 1, order });
    for (const e of NIST_LINES)
      for (const l of lineSpectrum(e.symbol)) if (l.rel >= 0.02) add({ nm: l.nm, el: e.symbol, rel: l.rel, order }); // prettier-ignore
  }
  return rays;
}

// Which rays show for the lamp, and how bright (0..1).
function rayLight(r) {
  if (LL.source === "white") return r.el === null ? 1 : 0;
  return r.el === LL.source ? 0.3 + 0.7 * Math.sqrt(r.rel) : 0;
}

// The light's mixed color (for the beam before it is split).
function sourceColor() {
  if (LL.source === "white") return [1, 1, 1];
  const c = [0, 0, 0];
  for (const l of lineSpectrum(LL.source)) {
    const k = nmColor(l.nm);
    for (let i = 0; i < 3; i++) c[i] += k[i] * l.rel;
  }
  const m = Math.max(...c, 1e-6);
  return c.map((v) => v / m);
}

function drawRayMasks(g) {
  // The beam (k = MAX_RAYS - 1) and the zero order take the lamp's color.
  g.clearRect(0, RAY_ROW - 8, LW * 2, 16);
  for (const r of LL.rays) {
    const v = rayLight(r);
    g.fillStyle = rgbCss(nmColor(r.nm), 0.35 + 0.9 * v);
    g.fillRect(r.k, RAY_ROW - 8, 1, 16);
    g.fillStyle = v > 0.01 ? "rgba(128,128,128,1)" : "rgba(128,128,128,0)";
    g.fillRect(LW + r.k, RAY_ROW - 8, 1, 16);
  }
  const k = MAX_RAYS - 1;
  g.fillStyle = rgbCss(sourceColor());
  g.fillRect(k, RAY_ROW - 8, 1, 16);
  g.fillStyle = "rgba(128,128,128,1)";
  g.fillRect(LW + k, RAY_ROW - 8, 1, 16);
}

// The card: where each ray lands, as the screen shows it (card x from
// card.x0 to card.x1, in recipe units, across the card's canvas region).
const CARD = { x: 0, y: 300, w: LW, h: 200 };
function drawCard(g) {
  const b = LL.bench;
  g.fillStyle = "#f3f0e8";
  g.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  if (!b) return;
  const px = (x) => CARD.x + ((x - b.card.x0) / (b.card.x1 - b.card.x0)) * CARD.w;
  // A dim room: the card is gray where no light lands.
  g.fillStyle = "#38383e";
  g.fillRect(CARD.x, CARD.y + 40, CARD.w, CARD.h - 80);
  g.globalCompositeOperation = "lighter";
  const shown = LL.rays.filter((r) => rayLight(r) > 0 && b.hits[r.i] !== null);
  // White light: each ray fills to the next one of its order (a smooth band).
  for (const r of shown) {
    const x = px(b.hits[r.i]);
    let wpx = 12;
    if (r.el === null) {
      const next = LL.rays.find((q) => q.el === null && q.order === r.order && q.nm > r.nm);
      if (next && b.hits[next.i] !== null) wpx = Math.max(1, Math.abs(px(b.hits[next.i]) - x) + 1);
    }
    g.fillStyle = rgbCss(nmColor(r.nm), (r.el === null ? 0.9 : 0.4 + 0.9 * Math.sqrt(r.rel)) / (Math.abs(r.order) > 1 ? 1.6 : 1)); // prettier-ignore
    g.fillRect(Math.min(x, x + wpx) - (r.el === null ? 0 : 6), CARD.y + 40, wpx, CARD.h - 80);
  }
  if (b.zero !== null) {
    g.fillStyle = rgbCss(sourceColor());
    g.fillRect(px(b.zero) - 3, CARD.y + 40, 6, CARD.h - 80);
  }
  g.globalCompositeOperation = "source-over";
  // Orders labeled on the grating's card.
  for (const m of b.labels || []) label(g, m.text, px(m.x), CARD.y + 30, { size: 20, color: "#3a3a40", align: "center" }); // prettier-ignore
}

function drawBenchInfo(g) {
  g.fillStyle = "#0a0e14";
  g.fillRect(0, 0, LW, 280);
  const src = sourceName(LL.source);
  label(g, src, 20, 42, { size: 34, color: "#ffe9a8", weight: "700" });
  label(g, "tap for the next lamp", LW - 20, 40, { size: 20, color: "#7d90a2", align: "right" });
  const lines = [];
  if (LL.view === "prism") {
    const g1 = GLASSES[LL.glass];
    const n4 = glassIndex(LL.glass, 486.1);
    const n6 = glassIndex(LL.glass, 656.3);
    lines.push(`${g1.label}, a 60° prism.`);
    lines.push(`Index: ${n4.toFixed(4)} at 486 nm (blue), ${n6.toFixed(4)} at 656 nm (red).`);
    const d = LL.bench?.devs;
    if (d) lines.push(`Bent by ${d[0].toFixed(1)}° (400 nm) to ${d[1].toFixed(1)}° (700 nm): blue bends most.`); // prettier-ignore
    lines.push("Snell's law at both faces; least bending at 550 nm.");
  } else {
    const gr = GRATINGS[LL.grating];
    const a1 = gratingAngle(400, gr.d, 1);
    const a7 = gratingAngle(700, gr.d, 1);
    lines.push(`${gr.label}.`);
    lines.push(`d sin θ = m λ: first order from ${((a1 * 180) / Math.PI).toFixed(1)}° (400 nm) to ${((a7 * 180) / Math.PI).toFixed(1)}° (700 nm).`); // prettier-ignore
    const a72 = gratingAngle(700, gr.d, 2);
    lines.push(a72 === null ? "Second order: only up to " + Math.floor(gr.d / 2) + " nm fits (sin θ ≤ 1)." : "Second order: twice as spread; it overlaps the first."); // prettier-ignore
    lines.push("Red bends most, unlike a prism; the middle stays white.");
  }
  lines.forEach((t, i) =>
    label(g, t, 20, 92 + i * 46, { size: 27, color: "#dbe4ec", weight: "700" }),
  );
}

// ---- The spectrometer ---------------------------------------------------------------------
const PIC = { x: 16, y: 56, w: 560, h: 316 };
const GRAPH = { x: 600, y: 56, w: 408, h: 316 };

// A picture's pixels: the camera's frame now, the opened photo or the sample.
function currentPicture() {
  const v = live.on("camera") ? live.camera?.video : null;
  if (v?.videoWidth) {
    const w = 480;
    const h = Math.round((w * v.videoHeight) / v.videoWidth);
    if (!LL.frame || LL.frame.width !== w || LL.frame.height !== h) {
      LL.frame = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); // prettier-ignore
    }
    const fg = LL.frame.getContext("2d", { willReadFrequently: true });
    fg.drawImage(v, 0, 0, w, h);
    return { ...fg.getImageData(0, 0, w, h), from: "camera" };
  }
  if (LL.photo) return { ...LL.photo, from: "photo" };
  LL.sample ||= samplePhoto();
  return { ...LL.sample, from: "sample" };
}

export function readSpectrum(img) {
  const band = LL.band ? [LL.band[0] * img.height, LL.band[1] * img.height] : brightBand(img);
  const profile = profileOf(img, band[0], band[1]);
  const cal = calibrate(profile);
  const peaks = cal ? peaksOf(profile, cal) : [];
  return { img, band, profile, cal, peaks, from: img.from };
}

function drawSpectrometer(g) {
  g.fillStyle = "#0a0e14";
  g.fillRect(0, 0, LW, 512);
  const r = LL.frozen || (LL.reading = readSpectrum(currentPicture()));
  if (LL.frozen) LL.reading = LL.frozen;
  const head = r.from === "camera" ? "Your camera" : r.from === "photo" ? LL.photo.name : "A sample picture (made by the page: a fluorescent lamp)"; // prettier-ignore
  label(g, head, 16, 36, { size: 22, color: "#eef3f8", weight: "700" });
  if (LL.frozen) label(g, "held: tap to read again", LW - 16, 36, { size: 18, color: "#ffe9a8", align: "right" }); // prettier-ignore
  // The picture, fitted, with the band read outlined.
  const { img } = r;
  const tmp = scratch(img.width, img.height);
  tmp.g.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  const s = Math.min(PIC.w / img.width, PIC.h / img.height);
  const pw = img.width * s;
  const ph = img.height * s;
  const px = PIC.x + (PIC.w - pw) / 2;
  const py = PIC.y + (PIC.h - ph) / 2;
  g.drawImage(tmp.c, px, py, pw, ph);
  g.strokeStyle = "#ffe9a8";
  g.lineWidth = 2;
  g.strokeRect(px, py + r.band[0] * s, pw, Math.max(2, (r.band[1] - r.band[0]) * s));
  // The graph: the reading against wavelength, with mercury's lines.
  g.fillStyle = "#020306";
  g.fillRect(GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h);
  const gx = (nm) => GRAPH.x + ((nm - NM_LO) / (NM_HI - NM_LO)) * GRAPH.w;
  const ref = lineSpectrum("Hg");
  for (const l of ref) {
    if (l.rel < 0.03) continue;
    g.fillStyle = rgbCss(nmColor(l.nm), 0.5 + 0.5 * Math.sqrt(l.rel));
    g.fillRect(Math.round(gx(l.nm)), GRAPH.y, 2, GRAPH.h);
  }
  if (r.cal) {
    const p = r.profile;
    let top = 1;
    for (let x = 0; x < p.width; x++) top = Math.max(top, p.sum[x]);
    g.beginPath();
    let first = true;
    for (let x = 0; x < p.width; x++) {
      const nm = pxToNm(r.cal, x);
      if (nm < NM_LO || nm > NM_HI) continue;
      const y = GRAPH.y + GRAPH.h - 8 - (p.sum[x] / top) * (GRAPH.h - 24);
      if (first) g.moveTo(gx(nm), y);
      else g.lineTo(gx(nm), y);
      first = false;
    }
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2;
    g.stroke();
    label(g, `Calibrated on mercury: ${HG_BLUE.toFixed(1)} and ${HG_GREEN.toFixed(1)} nm`, GRAPH.x, GRAPH.y + GRAPH.h + 26, { size: 15, color: "#9fb2c4" }); // prettier-ignore
    const pk = r.peaks
      .slice()
      .sort((a, b) => b.v - a.v)
      .slice(0, 6)
      .sort((a, b) => a.nm - b.nm);
    label(g, `Peaks: ${pk.map((q) => q.nm.toFixed(0)).join(", ")} nm`, 16, 410, { size: 20, color: "#ffe9a8" }); // prettier-ignore
  } else {
    label(g, "No spectrum found yet", GRAPH.x + GRAPH.w / 2, GRAPH.y + GRAPH.h / 2, { size: 22, color: "#9fb2c4", align: "center" }); // prettier-ignore
    label(g, "Aim at a fluorescent lamp's spectrum (see the Toy tab).", 16, 410, { size: 18, color: "#9fb2c4" }); // prettier-ignore
  }
  axis(g, GRAPH.x, GRAPH.y + GRAPH.h + 32, GRAPH.w, { size: 13 });
  label(g, "Colored lines: mercury (NIST). White: your light.", 16, 446, {
    size: 17,
    color: "#9fb2c4",
  });
}

const SCRATCH = new Map();
function scratch(w, h) {
  const key = `${w}x${h}`;
  if (!SCRATCH.has(key)) {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); // prettier-ignore
    SCRATCH.set(key, { c, g: c.getContext("2d") });
  }
  return SCRATCH.get(key);
}

function drawLightLab(g) {
  g.clearRect(0, 0, LW * 2, LH);
  if (LL.view === "spectra") drawSpectra(g);
  else if (LL.view === "camera") drawSpectrometer(g);
  else {
    drawBenchInfo(g);
    drawCard(g);
    drawRayMasks(g);
  }
}

// ---- Building ------------------------------------------------------------------------------

// A panel of screen splats showing the canvas region (x, y, w, h) (left
// half), in the plane through `center` spanned by `right` and `up`.
function panel(
  k,
  { center, right = [1, 0, 0], up = [0, 1, 0], width, height, region, cols, part = 0 },
) {
  const rows = Math.max(2, Math.round((cols * height) / width));
  const dx = width / cols;
  const s = Math.max(dx, height / rows) * 0.62;
  const nrm = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]]; // prettier-ignore
  const q = quatFromTo([0, 0, 1], nrm);
  const list = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = (i + 0.5) / cols - 0.5;
      const b = 0.5 - (j + 0.5) / rows;
      list.push({
        p: [0, 1, 2].map((c) => center[c] + right[c] * a * width + up[c] * b * height),
        scales: [s, s, s * 0.04],
        quat: q,
        color: "#05070b",
        kind: "screen",
        params: [
          (region.x + (a + 0.5) * region.w) / (LW * 2),
          (region.y + (0.5 - b) * region.h) / LH,
        ],
        opacity: 1,
        part,
        pattern: false,
      });
    }
  k.cloud(
    { share: list.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => list[i] || null,
  );
}

// A ray of light: splats along a segment (x–z plane at height y), colored
// and shown from the canvas's ray row (relief splats, axis 3: hidden where
// the mask's alpha is under a half). Segments are gathered first, then
// spaced to fit `share` of the toy's budget.
function raySplats(list, p0, p1, k, { w = 0.008 } = {}) {
  list.push({ p0, p1, k, w });
}

function emitRays(k, segs, share = 0.3) {
  const len = (s) => Math.hypot(s.p1[0] - s.p0[0], s.p1[1] - s.p0[1], s.p1[2] - s.p0[2]);
  const total = segs.reduce((a, s) => a + len(s), 0);
  const gap = Math.max(0.012, total / Math.max(1000, k.count * share));
  const list = [];
  for (const sg of segs) {
    const d = [sg.p1[0] - sg.p0[0], sg.p1[1] - sg.p0[1], sg.p1[2] - sg.p0[2]];
    const l = len(sg);
    if (l < 1e-6) continue;
    const n = Math.max(2, Math.ceil(l / gap));
    const q = quatFromTo([1, 0, 0], d);
    const u = (sg.k + 0.5) / LW;
    const v = RAY_ROW / LH;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      list.push({
        p: [sg.p0[0] + d[0] * t, sg.p0[1] + d[1] * t, sg.p0[2] + d[2] * t],
        scales: [(l / n) * 0.75, sg.w, sg.w],
        quat: q,
        color: "#ffffff",
        kind: "relief",
        params: [u, v, 3, 0],
        opacity: 0.95,
        pattern: false,
      });
    }
  }
  k.cloud(
    { share: list.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => list[i] || null,
  );
}

// Columns for a panel of `w` by `h` (recipe units) taking `share` of the budget.
const colsFor = (k, share, w, h, max) =>
  Math.min(max, Math.round(Math.sqrt((k.count * share * w) / h)));

function table(k, { w, d, y }) {
  boxSplats(k, { c: [0, y - 0.03, 0], w, h: 0.06, d, gap: budgetGap(k, 0.03), skip: [3], color: lit(shade, "#30353d") }); // prettier-ignore
}

function lamp(k, { at, dir, color = "#3a3e46" }) {
  // A small housing with a slit toward `dir` (x–z), its slit glowing in the
  // lamp's color.
  const ang = Math.atan2(-dir[1], dir[0]);
  boxSplats(k, { c: [at[0], 0, at[1]], w: 0.34, h: 0.3, d: 0.26, turn: ang, color: lit(shade, color) }); // prettier-ignore
  const sp = [at[0] + dir[0] * 0.175, 0, at[1] + dir[1] * 0.175];
  const slit = k.part("slit", { pivot: sp });
  boxSplats(k, { c: sp, w: 0.012, h: 0.16, d: 0.03, gap: 0.004, turn: ang, part: slit, color: "#fff6d8" }); // prettier-ignore
}

function card(k, { x0, x1, z, cols }) {
  // A white card standing on the table, facing the viewer, its face a
  // screen showing CARD.
  const w = x1 - x0;
  const h = (w * CARD.h) / CARD.w;
  const cx = (x0 + x1) / 2;
  boxSplats(k, { c: [cx, h / 2 - 0.2, z - 0.02], w: w + 0.06, h: h + 0.06, d: 0.03, color: lit(shade, "#d8d4cb") }); // prettier-ignore
  panel(k, { center: [cx, h / 2 - 0.2, z], width: w, height: h, region: CARD, cols });
  return { cx, h };
}

function buildPrism(k, o) {
  const P = prismGeometry({ side: 0.62, cx: -0.55, zb: -0.35 });
  const beam = minDeviationBeam(P, glassIndex(LL.glass, 550), 1.0);
  const zCard = -1.25;
  const hits = new Array(LL.rays.length).fill(null);
  const list = [];
  let devs = [0, 0];
  for (const r of LL.rays) {
    const t = prismRay(r.nm, { prism: P, ...beam, zCard, n: glassIndex(LL.glass, r.nm) });
    if (!t) continue;
    hits[r.i] = t.p3[0];
    const y = 0;
    raySplats(list, [t.p1[0], y, t.p1[1]], [t.p2[0], y, t.p2[1]], r.k, { w: 0.008 });
    raySplats(list, [t.p2[0], y, t.p2[1]], [t.p3[0], y, t.p3[1]], r.k, { w: 0.008 });
  }
  const t4 = prismRay(400, { prism: P, ...beam, zCard, n: glassIndex(LL.glass, 400) });
  const t7 = prismRay(700, { prism: P, ...beam, zCard, n: glassIndex(LL.glass, 700) });
  if (t4 && t7) devs = [(t4.deviation * 180) / Math.PI, (t7.deviation * 180) / Math.PI];
  // The beam from the lamp to the prism (k = MAX_RAYS − 1: the lamp's color).
  const enter = prismRay(550, { prism: P, ...beam, zCard, n: glassIndex(LL.glass, 550) });
  raySplats(list, [beam.from[0], 0, beam.from[1]], [enter.p1[0], 0, enter.p1[1]], MAX_RAYS - 1, { w: 0.012 }); // prettier-ignore
  emitRays(k, list, 0.22);
  // Where the card must be: across every ray's landing, with a margin.
  const xs = hits.filter((x) => x !== null);
  const span = Math.max(...xs) - Math.min(...xs);
  const x0 = Math.min(...xs) - Math.max(0.12, span * 0.6);
  const x1 = Math.max(...xs) + Math.max(0.12, span * 0.6);
  LL.bench = { hits, card: { x0, x1, z: zCard }, devs, zero: null };
  card(k, {
    x0,
    x1,
    z: zCard,
    cols: colsFor(k, 0.14, x1 - x0, ((x1 - x0) * CARD.h) / CARD.w, 280),
  });
  // The prism: glass, nearly clear face on and denser where its faces turn
  // away (behaviour "rim"), with brighter edges, standing on the table.
  const H = 0.36;
  const y0 = -0.17;
  const tri = [P.a, P.apex, P.b];
  const ctr = [(P.a[0] + P.b[0] + P.apex[0]) / 3, (P.a[1] + P.b[1] + P.apex[1]) / 3];
  const prism = k.part("prism", { pivot: [ctr[0], y0 + H / 2, ctr[1]] });
  const glass = { color: "#dcf0f8", opacity: 0.4, kind: "rim", params: [0.1, 3], part: prism };
  for (let f = 0; f < 3; f++) {
    const a = tri[f];
    const b = tri[(f + 1) % 3];
    let n = [b[1] - a[1], 0, -(b[0] - a[0])];
    const m = [(a[0] + b[0]) / 2 - ctr[0], (a[1] + b[1]) / 2 - ctr[1]];
    if (n[0] * m[0] + n[2] * m[1] < 0) n = n.map((x) => -x);
    const l = Math.hypot(...n);
    faceSplats(k, (u, v) => [a[0] + (b[0] - a[0]) * u, y0 + v * H, a[1] + (b[1] - a[1]) * u], { nu: budgetN(k, 40), nv: budgetN(k, 22), n: n.map((x) => x / l), ...glass }); // prettier-ignore
  }
  for (const [yy, ny] of [
    [y0, -1],
    [y0 + H, 1],
  ])
    faceSplats(
      k,
      (u, v) => [P.a[0] + u * (P.b[0] - P.a[0]), yy, P.a[1] + v * (P.apex[1] - P.a[1])],
      {
        nu: 60,
        nv: 52,
        n: [0, ny, 0],
        ...glass,
        // Inside the triangle: |x − apex x| ≤ half the side at that depth.
        keep: (u, v) => Math.abs(u - 0.5) <= 0.5 * (1 - v),
      },
    );
  // Edges: thin bright lines of exactly sized splats.
  const edges = [];
  const edge = (a, b) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...d);
    const n = Math.ceil(l / 0.006);
    const q = quatFromTo([1, 0, 0], d);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      edges.push({ p: [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t], scales: [l / n, 0.004, 0.004], quat: q, color: "#f4fcff", opacity: 0.95, part: prism, pattern: false }); // prettier-ignore
    }
  };
  for (let f = 0; f < 3; f++)
    for (const yy of [y0, y0 + H]) {
      const a = tri[f];
      const b = tri[(f + 1) % 3];
      edge([a[0], yy, a[1]], [b[0], yy, b[1]]);
    }
  for (const a of tri) edge([a[0], y0, a[1]], [a[0], y0 + H, a[1]]);
  k.cloud(
    { share: edges.length / k.count, pattern: false, jitter: 0 },
    (rand, i) => edges[i] || null,
  );
  lamp(k, { at: [beam.from[0] - beam.dir[0] * 0.17, beam.from[1] - beam.dir[1] * 0.17], dir: beam.dir }); // prettier-ignore
  table(k, { w: 3.2, d: 2.0, y: -0.17 });
  return { infoAt: [0, 0.95, -1.35] };
}

function buildGrating(k) {
  const gr = GRATINGS[LL.grating];
  const zG = 0.35;
  const zCard = -0.85;
  const L = zG - zCard;
  const hits = new Array(LL.rays.length).fill(null);
  const list = [];
  const half = 1.7;
  for (const r of LL.rays) {
    const th = gratingAngle(r.nm, gr.d, r.order);
    if (th === null) continue;
    const x = L * Math.tan(th);
    // A ray beyond the card's edge stops at the edge of the table.
    if (Math.abs(x) > half) {
      const s = half / Math.abs(x);
      raySplats(list, [0, 0, zG], [x * s, 0, zG - L * s], r.k, { w: 0.007 });
      continue;
    }
    hits[r.i] = x;
    raySplats(list, [0, 0, zG], [x, 0, zCard], r.k, { w: 0.007 });
  }
  // The beam in, and straight on through (the zero order: every color).
  raySplats(list, [0, 0, 1.25], [0, 0, zG], MAX_RAYS - 1, { w: 0.012 });
  raySplats(list, [0, 0, zG], [0, 0, zCard], MAX_RAYS - 1, { w: 0.008 });
  emitRays(k, list, 0.22);
  const labels = [-2, -1, 0, 1, 2].map((m) => {
    if (m === 0) return { x: 0, text: "0" };
    const th = gratingAngle(550, gr.d, m);
    return th === null ? null : { x: L * Math.tan(th), text: m > 0 ? `+${m}` : `${m}` };
  }).filter((l) => l && Math.abs(l.x) < half - 0.05); // prettier-ignore
  LL.bench = { hits, card: { x0: -half, x1: half, z: zCard }, zero: 0, labels };
  card(k, {
    x0: -half,
    x1: half,
    z: zCard,
    cols: colsFor(k, 0.14, 2 * half, (2 * half * CARD.h) / CARD.w, 340),
  });
  // The grating: a disc (a CD or DVD) or a slide in its frame, upright.
  if (LL.grating === "slide") {
    boxSplats(k, { c: [0, 0.02, zG], w: 0.5, h: 0.36, d: 0.02, color: lit(shade, "#e8e4da") });
    faceSplats(k, (u, v) => [(u - 0.5) * 0.34, 0.02 + (0.5 - v) * 0.24, zG + 0.012], { nu: budgetN(k, 40), nv: budgetN(k, 28), n: [0, 0, 1], color: "#8fa6b4" }); // prettier-ignore
  } else {
    const r0 = 0.3;
    // Silver with a rainbow sheen, as a disc looks under a lamp; a clear hub.
    faceSplats(k, (u, v) => [(u - 0.5) * 2 * r0, r0 - 0.17 + (0.5 - v) * 2 * r0, zG], {
      nu: budgetN(k, 60),
      nv: budgetN(k, 60),
      n: [0, 0, 1],
      keep: (u, v) => {
        const rr = Math.hypot(u - 0.5, v - 0.5) * 2;
        return rr <= 1 && rr >= 0.25;
      },
      color: "#c8ccd2",
    });
    faceSplats(k, (u, v) => [(u - 0.5) * 2 * r0, r0 - 0.17 + (0.5 - v) * 2 * r0, zG - 0.004], {
      nu: budgetN(k, 60),
      nv: budgetN(k, 60),
      n: [0, 0, -1],
      keep: (u, v) => {
        const rr = Math.hypot(u - 0.5, v - 0.5) * 2;
        return rr <= 1 && rr >= 0.25;
      },
      color: "#9aa0a8",
    });
    // A stand.
    boxSplats(k, { c: [0, -0.14, zG], w: 0.16, h: 0.06, d: 0.12, color: lit(shade, "#3a3e46") });
  }
  lamp(k, { at: [0, 1.42], dir: [0, -1] });
  table(k, { w: 3.6, d: 2.5, y: -0.17 });
  return { infoAt: [0, 0.95, -1.05] };
}

function buildPanelOnly(k) {
  // A big panel on a slim stand.
  const W = 2.6;
  const H = (W * 512) / LW;
  boxSplats(k, { c: [0, 0, -0.045], w: W + 0.12, h: H + 0.12, d: 0.08, tilt: PITCH, skip: [5], color: lit(shade, "#2a3038") }); // prettier-ignore
  const cols = Math.min(LW, Math.round(Math.sqrt(Math.min(k.count * 0.78, 220000) * (LW / 512))));
  panel(k, { center: [0, 0, 0.002], up: FACE_UP, width: W, height: H, region: { x: 0, y: 0, w: LW, h: 512 }, cols }); // prettier-ignore
  boxSplats(k, {
    c: [0, -H / 2 - 0.36, 0],
    w: 0.6,
    h: 0.05,
    d: 0.34,
    color: lit(shade, "#2a3038"),
  });
  boxSplats(k, {
    c: [0, -H / 2 - 0.2, -0.05],
    w: 0.08,
    h: 0.3,
    d: 0.05,
    color: lit(shade, "#3a4048"),
  });
}

// ---- The panel in the Toy tab ------------------------------------------------------------
function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function lightPanel() {
  const box = el("div", { className: "sll-panel", id: "sll-light" });
  const src = el("select", { id: "sll-source", ariaLabel: "Lamp" });
  for (const s of SOURCES)
    src.add(new Option(s === "white" ? "White light" : `${NAME[s]} (${s})`, s));
  src.addEventListener("change", () => {
    setSource(src.value);
    live.wake?.();
  });
  const srcRow = el("label", { className: "row" }, el("span", { textContent: "Lamp" }), src);
  const hiSel = el("select", { id: "sll-highlight", ariaLabel: "Element" });
  hiSel.addEventListener("change", () => {
    LL.highlight = Number(hiSel.value);
    LL.version++;
    live.wake?.();
  });
  const hiRow = el("label", { className: "row" }, el("span", { textContent: "Labeled" }), hiSel);
  // The spectrometer: the band read, holding a reading, and the how-to.
  const auto = el("input", { type: "checkbox", id: "sll-band-auto", className: "switch", checked: true }); // prettier-ignore
  auto.setAttribute("role", "switch");
  const bandRow = el("label", { className: "check-row" }, auto, el("span", { textContent: "Find the spectrum's band by itself" })); // prettier-ignore
  const band = el("input", { type: "range", id: "sll-band", min: "0", max: "1", step: "0.01", value: "0.5" }); // prettier-ignore
  const bandPick = el("label", { className: "row" }, el("span", { textContent: "Band (top to bottom)" }), band); // prettier-ignore
  const setBand = () => {
    LL.band = auto.checked ? null : [Math.max(0, Number(band.value) - 0.04), Math.min(1, Number(band.value) + 0.04)]; // prettier-ignore
    LL.frozen = null;
    LL.version++;
    live.wake?.();
  };
  auto.addEventListener("change", setBand);
  band.addEventListener("input", setBand);
  const how = el("div", { className: "note", id: "sll-howto" });
  how.innerHTML = `<b>Make a spectrometer</b><ol style="margin:4px 0 0 18px;padding:0">
<li>Take an old CD or DVD you don't need (a DVD spreads the colors more). Hold it shiny side up, near the camera.</li>
<li>Point a lamp at it from the side: a fluorescent tube or a compact fluorescent bulb is best, because its mercury lines (436 and 546 nm) calibrate the scale.</li>
<li>Tilt the disc until the camera sees a rainbow band reflected in it, held level across the picture.</li>
<li>Tap “Use my camera” and aim so the band runs left to right. The reading calibrates itself on the blue and green lines; tap the toy to hold it.</li>
</ol>Or open a photo of a spectrum you took. A white LED or a bulb shows a smooth band with no lines: there is nothing to calibrate on.`;
  box.append(srcRow, hiRow, bandRow, bandPick, how);
  const sync = () => {
    const v = LL.view;
    srcRow.hidden = !(v === "prism" || v === "grating");
    if (src.value !== LL.source) src.value = LL.source;
    hiRow.hidden = v !== "spectra";
    const els = SETS[LL.set].els;
    if (hiSel.options.length !== els.length || hiSel.dataset.set !== LL.set) {
      hiSel.textContent = "";
      els.forEach((s, i) => hiSel.add(new Option(`${NAME[s]} (${s})`, String(i))));
      hiSel.dataset.set = LL.set;
    }
    hiSel.value = String(LL.highlight % els.length);
    for (const e of [bandRow, how]) e.hidden = v !== "camera";
    bandPick.hidden = v !== "camera" || auto.checked;
  };
  sync();
  const timer = setInterval(() => (box.isConnected ? sync() : clearInterval(timer)), 300);
  return box;
}

// An opened picture, read into pixels (at most 640 wide).
async function readPhoto(file) {
  const bmp = await createImageBitmap(file);
  const w = Math.min(640, bmp.width);
  const h = Math.max(1, Math.round((w * bmp.height) / bmp.width));
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); // prettier-ignore
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const d = g.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data, name: file.name };
}

const LIGHT_LAB = {
  alive: () => LL.view === "camera" && live.on("camera") && !LL.frozen,
  density: 1.6,
  turntable: false,
  // Labs only: the sharper splat falloff (docs/lab/KERNELS.md), for crisp text and lines
  // (the owner's "Please make sharper", October 5, 2026).
  kernel: "sharp",
  options: [
    {
      key: "view",
      label: "Show",
      type: "select",
      default: "spectra",
      choices: [
        { id: "spectra", label: "Line spectra to compare" },
        { id: "prism", label: "A prism splits the light" },
        { id: "grating", label: "A grating splits the light" },
        { id: "camera", label: "Home spectrometer (camera)" },
      ],
    },
    {
      key: "set",
      label: "Elements",
      type: "select",
      default: "lamps",
      choices: Object.entries(SETS).map(([id, s]) => ({ id, label: s.label })),
    },
    {
      key: "glass",
      label: "Prism glass",
      type: "select",
      default: "sf11",
      choices: Object.entries(GLASSES).map(([id, g]) => ({ id, label: g.label })),
    },
    {
      key: "grating",
      label: "Grating",
      type: "select",
      default: "cd",
      choices: Object.entries(GRATINGS).map(([id, g]) => ({ id, label: g.label })),
    },
  ],
  controls: [{ key: "next", label: "Next", type: "pulse", ease: 0.4 }],
  action: { key: "next", label: "Next element or lamp" },
  input: {
    title: "Light lab",
    binary: true,
    accept: "image/*",
    fileButton: "Open a photo of a spectrum…",
    async read(text, name, file) {
      if (!file) return {};
      LL.photo = await readPhoto(file);
      LL.frozen = null;
      return { view: "camera" };
    },
    shown: () => (LL.view === "camera" && LL.photo && !live.on("camera") ? `Reading ${LL.photo.name}` : ""), // prettier-ignore
    live: [
      { render: lightPanel },
      {
        kind: "camera",
        rebuild: false,
        options: { facing: "environment", width: 1280, height: 720 },
      },
    ],
    note: "The camera is asked for only when you tap its button, and only in Home spectrometer. Pictures stay on this device; nothing is recorded or sent.",
  },
  screen: {
    width: LW * 2,
    height: LH,
    version: (time) => (LL.view === "camera" && live.on("camera") && !LL.frozen ? `c${Math.floor(time * 15)}` : `${LL.view}|${LL.version}|${LL.source}`), // prettier-ignore
    draw: (g) => drawLightLab(g),
  },
  credits: [
    {
      label: "Light lab",
      title: "Handbook of Basic Atomic Spectroscopic Data, strong lines of 16 neutral atoms (Sansonetti and Martin; NIST SRD 108)", // prettier-ignore
      source: "https://www.nist.gov/pml/handbook-basic-atomic-spectroscopic-data",
      author: "NIST Physical Measurement Laboratory",
      license: "Measured values (facts), credited to NIST",
      licenseUrl: "https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications", // prettier-ignore
    },
    {
      label: "Light lab",
      title: "Optical glass data sheets, N-SF11 and N-BK7 (Sellmeier coefficients)",
      source: "https://www.schott.com/en-us/products/optical-glass-p1000267/downloads",
      author: "SCHOTT AG",
      license: "Published constants (facts)",
      licenseUrl: "https://www.schott.com/en-us/products/optical-glass-p1000267/downloads",
    },
  ],
  drive(t, c, out, info) {
    const n = info.tap?.n ?? 0;
    if (n < LL.taps) LL.taps = 0;
    if (n > LL.taps) {
      LL.taps = n;
      if (LL.view === "spectra") LL.highlight = (LL.highlight + 1) % SETS[LL.set].els.length;
      else if (LL.view === "camera") LL.frozen = LL.frozen ? null : LL.reading;
      else LL.source = SOURCES[(SOURCES.indexOf(LL.source) + 1) % SOURCES.length];
      LL.version++;
    }
    out.parts.slit = { glow: 0.8, tint: hexOf(sourceColor()) };
  },
  build(k, o) {
    LL.view = o.view ?? "spectra";
    LL.set = SETS[o.set] ? o.set : "lamps";
    LL.glass = GLASSES[o.glass] ? o.glass : "sf11";
    LL.grating = GRATINGS[o.grating] ? o.grating : "cd";
    LL.version++;
    LL.bench = null;
    LL.rays = [];
    if (LL.view === "spectra" || LL.view === "camera") {
      buildPanelOnly(k);
      k.data = { lightLab: LL.view };
      return;
    }
    LL.rays = benchRays(LL.view);
    const { infoAt } = LL.view === "prism" ? buildPrism(k, o) : buildGrating(k, o);
    // The info panel above the bench, facing the viewer.
    // Capped at 420 columns: smaller splats fall under the engine's two-pixel cull at a
    // high budget (the panel went blank).
    const W = 2.6;
    panel(k, { center: infoAt, up: FACE_UP, width: W, height: (W * 280) / LW, region: { x: 0, y: 0, w: LW, h: 280 }, cols: colsFor(k, 0.26, W, (W * 280) / LW, 420) }); // prettier-ignore
    boxSplats(k, { c: [infoAt[0], infoAt[1] - 0.025 * Math.sin(PITCH), infoAt[2] - 0.025 * Math.cos(PITCH)], w: W + 0.08, h: (W * 280) / LW + 0.08, d: 0.04, tilt: PITCH, skip: [5], color: lit(shade, "#2a3038") }); // prettier-ignore
    k.data = { lightLab: LL.view };
  },
};

export const RECIPES = { "light-lab": LIGHT_LAB };
