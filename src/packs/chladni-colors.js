// Lane Live r10: the colors of the Chladni plate's sand and Sound in a box's
// beads (the owner's walkthrough of October 10, 2026: "let people choose the
// particle colors"). Labs dye beads, and some use several dyes or
// fluorescent ones, so every choice here is a real way to color them; the
// physics never looks at the color. The default stays as made: amber beads,
// pale sand. A scene or link with no color setting keeps that look.
//
//   one     one color, each grain a shade lighter or darker (as real grains)
//   few     a small palette, each grain one of its colors
//   flag    a country's flag's colors, each grain one of them, in the share
//           of the flag each color covers (read from the site's own flag
//           images, assets/flags/, public domain or CC0); the colors only,
//           never the flag's symbols or layout
//   height  (Sound in a box) a palette as a gradient from the cell's floor
//           to its top, following each bead as it moves
//   center  (Sound in a box) the same from the middle of the cell outward

import { mix, shade, ramp, rgb, clamp } from "../kit.js";

// The palettes, darkest or first color first. Viridis is matplotlib's
// colormap (CC0), even in lightness from end to end, so a gradient reads as
// height or distance at a glance.
export const PALETTES = [
  { id: "viridis", label: "Viridis (blue to yellow)", colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"] }, // prettier-ignore
  { id: "sunset", label: "Sunset", colors: ["#3b1c6e", "#a0307a", "#e85d4a", "#f7b538"] },
  { id: "ocean", label: "Ocean", colors: ["#0b2e59", "#1f6fb2", "#35b0c9", "#a8e6e2"] },
  { id: "forest", label: "Forest", colors: ["#1d3b2a", "#3f7d3a", "#9bbf4a", "#e3d68a"] },
  { id: "candy", label: "Candy", colors: ["#ff5d8f", "#7bdff2", "#ffd166", "#b28dff", "#7ae582"] },
  { id: "rainbow", label: "Rainbow", colors: ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"] }, // prettier-ignore
];
export const palette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

// The Toy tab's options: `kind` "cell" (Sound in a box, with the gradients)
// or "plate"; `asMade` the default's id and label; `state()` the toy's
// current choice, so only the options that choice uses show.
export function colorOptions(kind, asMade, state) {
  const choices = [
    asMade,
    { id: "one", label: "One color" },
    { id: "few", label: "A few colors" },
    { id: "flag", label: "A flag's colors" },
  ];
  if (kind === "cell")
    choices.push({ id: "height", label: "By height" }, { id: "center", label: "By distance from the center" }); // prettier-ignore
  return [
    { key: "colors", label: kind === "cell" ? "Bead colors" : "Sand colors", type: "select", default: asMade.id, choices }, // prettier-ignore
    { key: "color", label: "Color", type: "color", default: "#2f7fd8", get hidden() { return state() !== "one"; } }, // prettier-ignore
    { key: "palette", label: "Palette", type: "select", default: "viridis", choices: PALETTES.map((p) => ({ id: p.id, label: p.label })), get hidden() { return !["few", "height", "center"].includes(state()); } }, // prettier-ignore
    { key: "flag", label: "Flag", type: "flag", default: "fr", get hidden() { return state() !== "flag"; } }, // prettier-ignore
  ];
}
export const COLOR_KEYS = ["colors", "color", "palette", "flag"];
// Whether only the colors changed between two option sets (a rebuild that
// keeps the grains where they are).
export function colorsOnly(a, b) {
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let changed = false;
  for (const k of keys) {
    if (a[k] === b[k]) continue;
    if (!COLOR_KEYS.includes(k)) return false;
    changed = true;
  }
  return changed;
}

// A grain's own fixed hash, 0..1 (so a grain keeps its color from build to
// build, and the colors don't follow the grains' sizes).
export function hash01(i) {
  let x = (i + 1) * 0x9e3779b1;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 2 ** 32;
}

// Each grain's color as 0..1 RGB (n × 3), for the colors that don't move
// with the grains. `asMade(i)` gives the default's color; `tone` each
// grain's 0..1 tone (its size, as made); `flag` the flag's [{ rgb, share }]
// once read (null until then: the default shows meanwhile); `pale` (0..1),
// if given, the most a white or near-white grain may reach, so it still shows
// on the light stage (a flag's white beads as pale gray ones).
export function paint(n, o, { asMade, tone, flag, pale = 1 }) {
  const out = new Float32Array(n * 3);
  const put = (i, c) => {
    const k = Math.min(c[0], c[1], c[2]) > pale ? pale / Math.min(c[0], c[1], c[2]) : 1;
    out[i * 3] = c[0] * k;
    out[i * 3 + 1] = c[1] * k;
    out[i * 3 + 2] = c[2] * k;
  };
  const mode = o?.colors;
  const pal = palette(o?.palette).colors.map(rgb);
  for (let i = 0; i < n; i++) {
    const h = hash01(i);
    const lift = 0.9 + 0.2 * (tone ? tone[i] : h); // a shade lighter or darker
    if (mode === "one") put(i, shade(o.color || "#2f7fd8", lift));
    else if (mode === "few" || mode === "height" || mode === "center")
      put(i, shade(pal[Math.floor(h * pal.length) % pal.length], lift));
    else if (mode === "flag" && flag?.length) {
      let c = flag[flag.length - 1].rgb;
      let acc = 0;
      for (const f of flag) {
        acc += f.share;
        if (h < acc) {
          c = f.rgb;
          break;
        }
      }
      put(i, shade(c, 0.94 + 0.12 * (tone ? tone[i] : 0.5)));
    } else {
      const c = asMade(i);
      out[i * 3] = c[0];
      out[i * 3 + 1] = c[1];
      out[i * 3 + 2] = c[2];
    }
  }
  return out;
}

// The gradient's color at t (0..1) on a palette, for "height" and "center".
export function gradient(o, t) {
  return ramp(palette(o?.palette).colors.map(rgb), clamp(t, 0, 1));
}
export const moving = (o) => o?.colors === "height" || o?.colors === "center";

// ---- A flag's colors, from its image ----------------------------------------------------
// The flag's SVG drawn small on a canvas; its pixels counted by color (to
// 1/16 a channel), then the edges' blends folded into the nearest big
// color, and every color that covers at least 3% of the flag kept, with its
// share (up to six, the largest first). Read once per flag.
const FLAGS = new Map();
export function flagColors(code) {
  if (!FLAGS.has(code))
    FLAGS.set(
      code,
      (async () => {
        const { loadFlags } = await import("../patterns.js");
        const { assetURL } = await import("../toys.js");
        const info = (await loadFlags()).find((f) => f.code === code);
        if (!info) return null;
        const img = new Image();
        img.decoding = "async";
        img.src = assetURL(`assets/flags/${info.file}`);
        await img.decode();
        const H = 80;
        const W = Math.round(H * (info.aspect || 1.5));
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0, W, H);
        return flagShares(g.getImageData(0, 0, W, H).data);
      })().catch(() => null),
    );
  return FLAGS.get(code);
}

// RGBA pixels → [{ rgb (0..1), share }]: the colors a flag is made of.
export function flagShares(px) {
  const bins = new Map();
  let all = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    all++;
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const b = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++;
    b.r += px[i];
    b.g += px[i + 1];
    b.b += px[i + 2];
    bins.set(key, b);
  }
  if (!all) return null;
  const list = [...bins.values()].sort((a, b) => b.n - a.n).map((b) => ({ n: b.n, rgb: [b.r / b.n / 255, b.g / b.n / 255, b.b / b.n / 255] })); // prettier-ignore
  // The big colors (each at least 3% of the flag); every smaller bin joins
  // the nearest of them if it is close (an edge's blend), else is dropped
  // (an emblem's fine detail).
  const big = list.filter((b) => b.n >= all * 0.03).slice(0, 6);
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const b of list) {
    if (big.includes(b)) continue;
    const to = big.reduce((m, q) => (near(q.rgb, b.rgb) < near(m.rgb, b.rgb) ? q : m), big[0]);
    if (to && near(to.rgb, b.rgb) < 0.25) to.n += b.n;
  }
  const sum = big.reduce((a, b) => a + b.n, 0);
  return big.map((b) => ({ rgb: b.rgb, share: b.n / sum }));
}

// The default look's color for grain i, as `mix(a, b, tone)` (the toys' own).
export const asMadeColor = (a, b, tone) => (i) => mix(a, b, tone[i]);
