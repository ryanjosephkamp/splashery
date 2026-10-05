// Lane Data and climate: words made of splats for chart labels. Each label is
// a flat block of 5 x 7 font pixels (src/font.js, plus the marks a chart
// needs), dark letters with a pale rim so they read on the light and the dark
// themes. Every label is one token of its own (up to MAX_LABELS), and the
// recipe's drive turns each one about its anchor to face the camera, so the
// ticks and titles stay readable however the chart is turned.

import { BITMAP } from "../font.js";

export const MAX_LABELS = 48;

// Marks the chart labels need beyond the shared font (5 x 7, rows top down).
const EXTRA = {
  "(": "00010 00100 01000 01000 01000 00100 00010",
  ")": "01000 00100 00010 00010 00010 00100 01000",
  "/": "00001 00010 00010 00100 01000 01000 10000",
  ":": "00000 01100 01100 00000 01100 01100 00000",
  "%": "11001 11010 00010 00100 01000 01011 10011",
  "+": "00000 00100 00100 11111 00100 00100 00000",
  "=": "00000 00000 11111 00000 11111 00000 00000",
  _: "00000 00000 00000 00000 00000 00000 11111",
  "°": "01100 10010 10010 01100 00000 00000 00000",
  "·": "00000 00000 00000 01100 01100 00000 00000",
  "&": "01100 10010 10100 01000 10101 10010 01101",
  "#": "01010 01010 11111 01010 11111 01010 01010",
  "<": "00010 00100 01000 10000 01000 00100 00010",
  ">": "01000 00100 00010 00001 00010 00100 01000",
  "*": "00000 00100 10101 01110 10101 00100 00000",
  '"': "01010 01010 10100 00000 00000 00000 00000",
  "–": "00000 00000 00000 01110 00000 00000 00000",
  "−": "00000 00000 00000 11111 00000 00000 00000",
  "₂": "00000 00000 00000 01100 00010 00100 01110",
  "×": "00000 10001 01010 00100 01010 10001 00000",
  "…": "00000 00000 00000 00000 00000 00000 10101",
};
const GLYPHS = {
  ...BITMAP,
  ...Object.fromEntries(Object.entries(EXTRA).map(([c, r]) => [c, r.split(" ").map((x) => parseInt(x, 2))])), // prettier-ignore
};

export const glyphOf = (ch) => {
  if (ch === " ") return null;
  const g = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()];
  if (g) return g;
  const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return GLYPHS[plain.toUpperCase()] ?? GLYPHS["?"];
};

// The inked pixels of a text, and its size in font pixels (6 per character,
// the last column blank). Lines split at "\n" sit 10 pixels apart, each
// aligned within the block ("left", "center" or "right").
export function textPixels(text, align = "left") {
  const lines = String(text)
    .split("\n")
    .map((l) => [...l]);
  const widths = lines.map((l) => Math.max(0, l.length * 6 - 1));
  const width = Math.max(...widths);
  const ink = [];
  lines.forEach((s, li) => {
    const shift = align === "right" ? width - widths[li] : align === "center" ? Math.round((width - widths[li]) / 2) : 0; // prettier-ignore
    for (let i = 0; i < s.length; i++) {
      const g = glyphOf(s[i]);
      if (!g) continue;
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 5; c++) if (g[r] & (1 << (4 - c))) ink.push([shift + i * 6 + c, li * 10 + r]); // prettier-ignore
    }
  });
  return { ink, width, height: lines.length * 10 - 3 };
}

// Splits a long title into two lines at the space nearest its middle.
export function wrapText(text, max = 12) {
  const t = String(text);
  if (t.length <= max || !t.includes(" ")) return t;
  let best = -1;
  for (let i = 0; i < t.length; i++)
    if (t[i] === " " && (best < 0 || Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2)))
      best = i;
  return `${t.slice(0, best)}\n${t.slice(best + 1)}`;
}

// Lays out a label: anchor in recipe units, px the size of a font pixel,
// align "left" | "center" | "right" and valign "top" | "middle" | "bottom"
// relative to the anchor, in the label's own frame (x right, y up, facing +z).
// Returns splat samples for a k.cloud, all on token `token`.
export function labelSplats(
  text,
  {
    anchor,
    px,
    align = "center",
    valign = "middle",
    token,
    color = "#1f2328",
    rim = "#fbfaf5",
    opacity = 1,
  },
) {
  // prettier-ignore
  const { ink, width, height } = textPixels(text, align);
  const ox = align === "left" ? 0 : align === "right" ? -width : -width / 2;
  const oy = valign === "top" ? 0 : valign === "bottom" ? height : height / 2;
  const on = new Set(ink.map(([x, y]) => `${x},${y}`));
  const rimSet = new Set();
  for (const [x, y] of ink)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${x + dx},${y + dy}`;
        if (!on.has(key)) rimSet.add(key);
      }
  const out = [];
  const place = (x, y) => [
    anchor[0] + (ox + x + 0.5) * px,
    anchor[1] + (oy - y - 0.5) * px,
    anchor[2],
  ];
  const sigma = px * 0.62;
  for (const key of rimSet) {
    const [x, y] = key.split(",").map(Number);
    out.push({
      p: place(x, y),
      color: rim,
      opacity: 0.92 * opacity,
      scales: [sigma, sigma, px * 0.08],
      quat: [0, 0, 0, 1],
      kind: "token",
      params: [token, 0],
      pattern: false,
    });
  }
  // Polish round: each font pixel is four smaller splats (2 x 2), so strokes
  // have square, crisp edges instead of round blobs, and a diagonal step
  // (ink at two corners, none on the sides) gets a bridging splat between
  // them, so slanted strokes (A, V, 2, 7) read as lines, not staircases.
  const ink2 = (p) => ({
    p,
    color,
    opacity,
    scales: [px * 0.29, px * 0.29, px * 0.06],
    quat: [0, 0, 0, 1],
    kind: "token",
    params: [token, 0],
    pattern: false,
  });
  for (const [x, y] of ink)
    for (const [sx, sy] of [
      [-0.25, -0.25],
      [0.25, -0.25],
      [-0.25, 0.25],
      [0.25, 0.25],
    ]) {
      // prettier-ignore
      const c = place(x + sx, y + sy);
      out.push(ink2(c));
    }
  for (const [x, y] of ink)
    for (const dx of [-1, 1]) {
      const dy = 1;
      if (on.has(`${x + dx},${y + dy}`) && !on.has(`${x + dx},${y}`) && !on.has(`${x},${y + dy}`))
        out.push(ink2(place(x + dx / 2, y + dy / 2)));
    }
  return out;
}

// Turns the labels to face the camera about the vertical (info.view is the
// camera's bearing about the toy). Returns out.tokens.
export function faceLabels(labels, view) {
  const tokens = [];
  if (view === null || view === undefined || Number.isNaN(view)) return tokens;
  const h = view / 2;
  const quat = [0, Math.sin(h), 0, Math.cos(h)];
  for (const l of labels) tokens[l.token] = { base: l.anchor, quat };
  return tokens;
}
