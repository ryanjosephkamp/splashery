// Draws the diagram on "How Splashery is built" from manual/built-data.js. A <figure
// data-diagram="built"> holds an empty <svg>; this file fills it, so the picture is the data. The
// SVG is plain (no scripts inside), so the PDF prints it as it is.

import { LAYERS } from "./built-data.js";

const NS = "http://www.w3.org/2000/svg";
const W = 360;
const PAD = 12;
const GAP = 8;
const ARROW = 30;
const el = (name, attrs = {}, text) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
};
// Words broken into lines of at most `max` characters (the page font is proportional; this is a
// good enough measure at 11 to 12 px).
const wrap = (text, max) => {
  const lines = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line && (line + " " + w).length > max) {
      lines.push(line);
      line = w;
    } else line = line ? line + " " + w : w;
  }
  if (line) lines.push(line);
  return lines;
};

function draw(svg) {
  let y = 4;
  const g = el("g");
  svg.replaceChildren(g);
  LAYERS.forEach((layer, li) => {
    const cols = layer.cols || 1;
    const inner = W - 2 * PAD;
    const bw = (inner - GAP * (cols - 1)) / cols;
    const maxChars = Math.floor((bw - 10) / 5.9);
    const boxes = layer.boxes.map((b) => ({ ...b, t: wrap(b.t, maxChars), s: wrap(b.s, maxChars + 2) })); // prettier-ignore
    const rows = [];
    for (let i = 0; i < boxes.length; i += cols) rows.push(boxes.slice(i, i + cols));
    const rowH = rows.map((r) => Math.max(...r.map((b) => 16 + 14 * b.t.length + 13 * b.s.length)));
    const h = 24 + rowH.reduce((a, b) => a + b + GAP, -GAP) + 10;
    const frame = el("rect", { x: 2, y, width: W - 4, height: h, rx: 8, class: layer.lazy || layer.off ? "sv-soft" : "sv-box" }); // prettier-ignore
    g.append(frame);
    g.append(el("text", { x: PAD, y: y + 17, class: "sv-title" }, layer.title));
    let by = y + 26;
    rows.forEach((row, ri) => {
      row.forEach((b, ci) => {
        const x = PAD + ci * (bw + GAP);
        g.append(el("rect", { x, y: by, width: bw, height: rowH[ri], rx: 5, class: layer.off ? "sv-box" : layer.lazy ? "sv-soft" : "sv-acc" })); // prettier-ignore
        let ty = by + 15;
        for (const line of b.t) {
          g.append(el("text", { x: x + bw / 2, y: ty, "text-anchor": "middle", class: "sv-title" }, line)); // prettier-ignore
          ty += 14;
        }
        for (const line of b.s) {
          g.append(el("text", { x: x + bw / 2, y: ty - 1, "text-anchor": "middle", class: "sv-muted" }, line)); // prettier-ignore
          ty += 13;
        }
      });
      by += rowH[ri] + GAP;
    });
    y += h;
    if (layer.then) {
      g.append(el("path", { d: `M${W / 2} ${y + 3} V${y + ARROW - 8} m-4 -5 l4 5 l4 -5`, class: "sv-line" })); // prettier-ignore
      g.append(el("text", { x: W / 2 + 12, y: y + ARROW / 2 + 4, class: "sv-muted" }, layer.then)); // prettier-ignore
      y += ARROW;
    } else if (li < LAYERS.length - 1) y += 14;
  });
  svg.setAttribute("viewBox", `0 0 ${W} ${y + 4}`);
}

for (const fig of document.querySelectorAll('figure[data-diagram="built"]')) {
  const svg = fig.querySelector("svg");
  if (svg) draw(svg);
}
