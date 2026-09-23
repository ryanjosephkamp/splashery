// The pattern layer: designs drawn on a 2D canvas and wrapped around the toy
// by the effect modifier (see spPattern in effects.js). Patterns are drawn
// at the aspect ratio of the surface they wrap, so dots stay round and
// stripes stay even. National flags are public-domain SVGs from Wikimedia
// Commons, vendored under assets/flags/ (see tools/fetch-flags.mjs).

import { assetURL } from "./toys.js";
import { mulberry32 } from "./noise.js";

export const PATTERNS = [
  { id: "none", label: "None" },
  { id: "flag", label: "Flag" },
  { id: "stripes", label: "Stripes" },
  { id: "bands", label: "Bands" },
  { id: "dots", label: "Polka dots" },
  { id: "checks", label: "Checks" },
  { id: "stars", label: "Stars" },
  { id: "hearts", label: "Hearts" },
  { id: "zigzag", label: "Zigzag" },
  { id: "gradient", label: "Gradient" },
  { id: "rainbow", label: "Rainbow" },
  { id: "marble", label: "Marble" },
];
export const PATTERN_IDS = PATTERNS.map((p) => p.id);

export const PROJECTIONS = [
  { id: "wrap", label: "Wrap" },
  { id: "front", label: "Front" },
  { id: "globe", label: "Globe" },
];
export const PROJECTION_IDS = PROJECTIONS.map((p) => p.id);

export const DEFAULT_PATTERN = Object.freeze({
  id: "none",
  flag: "",
  projection: "wrap",
  repeats: 1,
  colors: ["#ffffff", "#e63b2e", "#0b4f9c"],
  scale: 0.5,
  amount: 1,
  detail: 0.6,
});

// ---- Flags ------------------------------------------------------------------------

let flagList = null;

// The flag catalogue: [{ code, name, file, source, license, author }].
export async function loadFlags() {
  if (!flagList) {
    flagList = fetch(assetURL("assets/flags/flags.json"))
      .then((r) => (r.ok ? r.json() : { flags: [] }))
      .then((j) => j.flags || [])
      .catch(() => []);
  }
  return flagList;
}

export async function flagInfo(code) {
  return (await loadFlags()).find((f) => f.code === code) || null;
}

const imageCache = new Map();
function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("The flag image could not be loaded."));
        img.src = url;
      }),
    );
  }
  return imageCache.get(url);
}

// ---- Drawing ------------------------------------------------------------------------

// Aspect (width / height) of the surface a projection covers on a toy with
// half extents `half`.
export function surfaceAspect(pattern, half) {
  const hw = Math.max(half[0], half[2]);
  const hh = Math.max(1e-3, half[1]);
  const rep = Math.max(1, pattern.repeats || 1);
  if (pattern.projection === "front") return half[0] / hh;
  if (pattern.projection === "globe") return 2 / rep;
  return (Math.PI * hw) / (rep * hh);
}

// Draws the pattern into a canvas and returns it (null for "none").
export async function drawPattern(pattern, half, canvas = document.createElement("canvas")) {
  if (!pattern || pattern.id === "none") return null;
  if (pattern.id === "flag") {
    const info = pattern.flag ? await flagInfo(pattern.flag) : null;
    if (!info) return null;
    const img = await loadImage(assetURL(`assets/flags/${info.file}`));
    const aspect =
      img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.5;
    canvas.width = 768;
    canvas.height = Math.round(768 / aspect);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  const aspect = Math.min(6, Math.max(0.3, surfaceAspect(pattern, half)));
  const H = 256;
  const W = Math.round(Math.min(1024, Math.max(128, H * aspect)));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const [c1, c2, c3] = pattern.colors;
  const s = pattern.scale ?? 0.5;
  // Tiles across the width: a whole number, so the wrap has no seam.
  const across = (per) => Math.max(1, Math.round(per));
  ctx.clearRect(0, 0, W, H);
  switch (pattern.id) {
    case "stripes": {
      const n = across((3 + 13 * s) * aspect) * 2;
      const w = W / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? c2 : c1;
        ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, H);
      }
      break;
    }
    case "bands": {
      const n = Math.round(3 + 11 * s);
      const h = H / n;
      const cols = [c1, c2, c3];
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = cols[i % 3];
        ctx.fillRect(0, Math.floor(i * h), W, Math.ceil(h) + 1);
      }
      break;
    }
    case "dots":
    case "stars":
    case "hearts": {
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, W, H);
      const rows = Math.round(3 + 9 * s);
      const cell = H / rows;
      const cols = across(W / cell);
      const cw = W / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (c + (r % 2 ? 0.5 : 0) + 0.5) * cw;
          const y = (r + 0.5) * cell;
          ctx.fillStyle = r % 2 && c3 ? c3 : c2;
          for (const dx of [-W, 0, W]) {
            if (pattern.id === "dots") circle(ctx, x + dx, y, cell * 0.3);
            else if (pattern.id === "stars") star(ctx, x + dx, y, cell * 0.36);
            else heart(ctx, x + dx, y, cell * 0.34);
          }
        }
      }
      break;
    }
    case "checks": {
      const rows = Math.round(2 + 10 * s) * 2;
      const cell = H / rows;
      const cols = across(W / cell / 2) * 2;
      const cw = W / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 ? c2 : c1;
          ctx.fillRect(
            Math.floor(c * cw),
            Math.floor(r * cell),
            Math.ceil(cw) + 1,
            Math.ceil(cell) + 1,
          );
        }
      }
      break;
    }
    case "zigzag": {
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, W, H);
      const rows = Math.round(3 + 8 * s);
      const band = H / rows;
      const teeth = across((W / band) * 0.8);
      const tw = W / teeth;
      for (let r = 0; r < rows; r += 2) {
        ctx.fillStyle = (r / 2) % 2 && c3 ? c3 : c2;
        ctx.beginPath();
        const y0 = r * band;
        ctx.moveTo(0, y0 + band);
        for (let i = 0; i <= teeth; i++) {
          ctx.lineTo(i * tw, y0 + band);
          ctx.lineTo((i + 0.5) * tw, y0);
        }
        ctx.lineTo(W, y0 + band);
        ctx.lineTo(W, y0 + band * 2);
        for (let i = teeth; i >= 0; i--) {
          ctx.lineTo((i + 0.5) * tw, y0 + band);
          ctx.lineTo(i * tw, y0 + band * 2);
        }
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "gradient": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, c1);
      g.addColorStop(0.5, c2);
      g.addColorStop(1, c3);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "rainbow": {
      const cols = ["#e8423f", "#f39237", "#f6d04d", "#57b45a", "#3a8fd6", "#6d4cc2"];
      const h = H / cols.length;
      cols.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, Math.floor(i * h), W, Math.ceil(h) + 1);
      });
      break;
    }
    case "marble": {
      const img = ctx.createImageData(W, H);
      const a = hex(c1);
      const b = hex(c2);
      const c = hex(c3);
      const noise = valueNoise(7);
      const f = 2 + 6 * s;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // Periodic in x so the wrap is seamless.
          const ang = (x / W) * Math.PI * 2;
          const nx = Math.cos(ang) * aspect * 0.8;
          const nz = Math.sin(ang) * aspect * 0.8;
          const ny = (y / H) * 2;
          const n =
            noise(nx * f, ny * f, nz * f) * 0.6 + noise(nx * f * 2, ny * f * 2, nz * f * 2) * 0.3;
          const v = 0.5 + 0.5 * Math.sin((ny * 3 + n * 6) * Math.PI);
          const vein = Math.pow(1 - Math.abs(Math.sin((ny * 2 + n * 4) * Math.PI)), 12);
          const i = (y * W + x) * 4;
          for (let k = 0; k < 3; k++)
            img.data[i + k] = (a[k] * v + b[k] * (1 - v)) * (1 - vein) + c[k] * vein;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      break;
    }
    default:
      return null;
  }
  return canvas;
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.8);
  ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.8);
  ctx.fill();
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function valueNoise(seed) {
  const rand = mulberry32(seed);
  const T = new Float32Array(4096);
  for (let i = 0; i < T.length; i++) T[i] = rand() * 2 - 1;
  const h = (x, y, z) => T[((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 4095];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = sm(x - xi);
    const fy = sm(y - yi);
    const fz = sm(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(
        l(h(xi, yi, zi), h(xi + 1, yi, zi), fx),
        l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx),
        fy,
      ),
      l(
        l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx),
        l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx),
        fy,
      ),
      fz,
    );
  };
}

// Uniforms for the modifier. `lum` is the toy's mean brightness.
export function patternUniforms(pattern, half, lum, on) {
  const proj = Math.max(0, PROJECTION_IDS.indexOf(pattern.projection));
  const hw = Math.max(half[0], half[2]);
  return {
    uSpPat: [
      on ? 1 : 0,
      proj,
      pattern.projection === "front" ? 1 : Math.max(1, pattern.repeats || 1),
      pattern.amount ?? 1,
    ],
    uSpPatB: [
      pattern.detail ?? 0.6,
      Math.max(1e-3, half[1]),
      Math.max(0.08, lum || 0.5),
      Math.max(1e-3, proj === 1 ? half[0] : hw),
    ],
  };
}

// Normalises a pattern object from a scene file.
export function normalizePattern(p, normalizeHex) {
  const src = p && typeof p === "object" ? p : {};
  const num = (v, d, lo, hi) => {
    const n = Number(v);
    return v === null || v === "" || !Number.isFinite(n) ? d : Math.min(hi, Math.max(lo, n));
  };
  const colors = Array.isArray(src.colors) ? src.colors : [];
  return {
    id: PATTERN_IDS.includes(src.id) ? src.id : "none",
    flag: typeof src.flag === "string" && /^[a-z0-9-]{2,12}$/.test(src.flag) ? src.flag : "",
    projection: PROJECTION_IDS.includes(src.projection) ? src.projection : "wrap",
    repeats: Math.round(num(src.repeats, 1, 1, 4)),
    colors: [0, 1, 2].map((i) => normalizeHex(colors[i], DEFAULT_PATTERN.colors[i])),
    scale: num(src.scale, 0.5, 0, 1),
    amount: num(src.amount, 1, 0, 1),
    detail: num(src.detail, 0.6, 0, 1),
  };
}
