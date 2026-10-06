// Lane QR lab r2, the study of splat QR codes: small SVG line charts for the
// report. One chart is a column of panels (one per reader, or per region);
// each panel plots scan rate (0–100%) against the variable, one line per
// series (the four error correction levels), each with its own marker shape
// and a label at its end, so color is never the only cue. The SVG carries
// its own light and dark colors (prefers-color-scheme).

// The reference categorical palette's first four slots (blue, orange, aqua,
// yellow), light and dark steps.
const SERIES = [
  ["#2a78d6", "#3987e5"],
  ["#eb6834", "#d95926"],
  ["#1baf7a", "#199e70"],
  ["#eda100", "#c98500"],
  ["#e87ba4", "#d55181"],
];
const MARKS = ["circle", "square", "triangle", "diamond", "circle"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function marker(kind, x, y, cls) {
  const r = 4.5;
  if (kind === "square") return `<rect class="${cls}" x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="1"/>`; // prettier-ignore
  if (kind === "triangle") return `<path class="${cls}" d="M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z"/>`; // prettier-ignore
  if (kind === "diamond") return `<path class="${cls}" d="M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z"/>`; // prettier-ignore
  return `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
}

const nice = (lo, hi) => {
  const span = hi - lo || 1;
  const step0 = span / 5;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 6) || mag * 10;
  const ticks = [];
  for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step)
    ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
};

// panels: [{ title, series: [{ name, points: [{ x, rate }] }] }]
// o: { title, subtitle, xLabel, reverseX (draw the axis right to left) }
export function lineChart(panels, o = {}) {
  const W = 640;
  const PH = 220; // panel plot height
  const top = o.subtitle ? 74 : 52;
  const gapY = 70;
  const left = 64;
  const right = 92;
  const H = top + panels.length * (PH + gapY) + 10;
  const xs = panels.flatMap((p) => p.series.flatMap((s) => s.points.map((q) => q.x)));
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x0 === x1) x1 = x0 + 1;
  const ticks = nice(x0, x1).filter((t) => t >= x0 - 1e-9 && t <= x1 + 1e-9);
  const pw = W - left - right;
  const X = (x) => left + (o.reverseX ? (x1 - x) / (x1 - x0) : (x - x0) / (x1 - x0)) * pw;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" role="img" aria-label="${esc(o.title || "")}">`); // prettier-ignore
  const css = (mode) =>
    SERIES.map((c, i) => `.s${i}{stroke:${c[mode]};fill:none}.m${i}{fill:${c[mode]};stroke:var(--bg);stroke-width:1.5}`).join(""); // prettier-ignore
  out.push(`<style>
svg{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e4e3df;--axis:#a3a29c}
${css(0)}
@media (prefers-color-scheme: dark){svg{--bg:#1a1a19;--ink:#ffffff;--ink2:#c3c2b7;--grid:#34332f;--axis:#6b6a64}${css(1)}}
.bg{fill:var(--bg)}.t{fill:var(--ink);font-size:20px;font-weight:600}.st{fill:var(--ink2);font-size:15px}
.pt{fill:var(--ink);font-size:16px;font-weight:600}.ax{fill:var(--ink2);font-size:14px}.lb{font-size:14px;font-weight:600;fill:var(--ink)}
.g{stroke:var(--grid);stroke-width:1}.a{stroke:var(--axis);stroke-width:1}
path.s0,path.s1,path.s2,path.s3,path.s4{stroke-width:2.25;stroke-linejoin:round;stroke-linecap:round}
</style>`);
  out.push(`<rect class="bg" x="0" y="0" width="${W}" height="${H}"/>`);
  out.push(`<text class="t" x="16" y="30">${esc(o.title || "")}</text>`);
  if (o.subtitle) out.push(`<text class="st" x="16" y="54">${esc(o.subtitle)}</text>`);
  panels.forEach((p, pi) => {
    const y0 = top + pi * (PH + gapY) + 22;
    const Y = (r) => y0 + (1 - r) * PH;
    out.push(`<text class="pt" x="${left}" y="${y0 - 10}">${esc(p.title)}</text>`);
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      out.push(`<line class="g" x1="${left}" x2="${left + pw}" y1="${Y(r)}" y2="${Y(r)}"/>`);
      out.push(`<text class="ax" x="${left - 8}" y="${Y(r) + 5}" text-anchor="end">${r * 100}%</text>`); // prettier-ignore
    }
    out.push(`<line class="a" x1="${left}" x2="${left + pw}" y1="${Y(0)}" y2="${Y(0)}"/>`);
    for (const t of ticks)
      out.push(`<text class="ax" x="${X(t)}" y="${Y(0) + 20}" text-anchor="middle">${t}</text>`);
    out.push(`<text class="ax" x="${left + pw / 2}" y="${Y(0) + 40}" text-anchor="middle">${esc(o.xLabel || "")}</text>`); // prettier-ignore
    // Lines, then markers, then end labels (nudged apart).
    const ends = [];
    p.series.forEach((s, si) => {
      const pts = s.points.filter((q) => q.rate != null);
      if (!pts.length) return;
      const ci = s.slot ?? si;
      out.push(`<path class="s${ci}" d="${pts.map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)} ${Y(q.rate).toFixed(1)}`).join("")}"/>`); // prettier-ignore
      for (const q of pts) out.push(marker(MARKS[ci], +X(q.x).toFixed(1), +Y(q.rate).toFixed(1), `m${ci}`)); // prettier-ignore
      const last = pts.reduce((a, b) => (X(b.x) > X(a.x) ? b : a));
      ends.push({ y: Y(last.rate), x: X(last.x), name: s.name, ci });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 17) ends[i].y = ends[i - 1].y + 17; // prettier-ignore
    const lx = o.reverseX ? left + pw + 10 : left + pw + 10;
    for (const e of ends) {
      out.push(marker(MARKS[e.ci], lx + 5, e.y, `m${e.ci}`));
      out.push(`<text class="lb" x="${lx + 15}" y="${e.y + 5}">${esc(e.name)}</text>`);
    }
  });
  out.push("</svg>");
  return out.join("\n") + "\n";
}
