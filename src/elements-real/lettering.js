// Real elements (lane Elements): the site's 5 x 7 capitals and digits (src/font.js) plus the small
// letters element symbols need, as ink cells for splat lettering.
import { BITMAP } from "../font.js";

// prettier-ignore
const LOWER = {
  a: "00000 00000 01110 00001 01111 10001 01111",
  b: "10000 10000 10110 11001 10001 10001 11110",
  c: "00000 00000 01110 10000 10000 10001 01110",
  d: "00001 00001 01101 10011 10001 10001 01111",
  e: "00000 00000 01110 10001 11111 10000 01110",
  f: "00110 01001 01000 11100 01000 01000 01000",
  g: "00000 01111 10001 10001 01111 00001 01110",
  h: "10000 10000 10110 11001 10001 10001 10001",
  i: "00100 00000 01100 00100 00100 00100 01110",
  k: "10000 10000 10010 10100 11000 10100 10010",
  l: "01100 00100 00100 00100 00100 00100 01110",
  m: "00000 00000 11010 10101 10101 10001 10001",
  n: "00000 00000 10110 11001 10001 10001 10001",
  o: "00000 00000 01110 10001 10001 10001 01110",
  p: "00000 11110 10001 10001 11110 10000 10000",
  r: "00000 00000 10110 11001 10000 10000 10000",
  s: "00000 00000 01111 10000 01110 00001 11110",
  t: "01000 01000 11100 01000 01000 01001 00110",
  u: "00000 00000 10001 10001 10001 10011 01101",
  v: "00000 00000 10001 10001 10001 01010 00100",
  y: "00000 10001 10001 01111 00001 10001 01110",
};
const GLYPH = {
  ...BITMAP,
  ...Object.fromEntries(
    Object.entries(LOWER).map(([ch, rows]) => [ch, rows.split(" ").map((r) => parseInt(r, 2))]),
  ),
};

export const textWidth = (str) => str.length * 6 - 1;

// The ink cells of a line of text, its left edge at x (or centered on x with center: true) and
// its middle at y: [x, y] of each font pixel's center, px apart.
export function inkCells(str, x, y, px, center = false) {
  const out = [];
  const x0 = center ? x - (textWidth(str) * px) / 2 : x;
  const y0 = y + 3 * px;
  for (let ci = 0; ci < str.length; ci++) {
    const g = GLYPH[str[ci]];
    if (!g) continue;
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if ((g[gy] >> (4 - gx)) & 1) out.push([x0 + (ci * 6 + gx + 0.5) * px, y0 - gy * px]);
  }
  return out;
}
