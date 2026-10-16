// Research candidates, not used by the toy. The audit records retained and rejected variants.
import {
  centerById,
  squareSample,
  plainModules,
  cellWeights,
  FG,
  BG,
  gray,
} from "../../src/qr-craft/picture.js";

const clamp = (x) => Math.min(1, Math.max(0, x));
function shift(cells, at, delta) {
  for (let ch = 0; ch < 3; ch++) cells[at + ch] = clamp(cells[at + ch] + delta);
}

export function continuous(code, pic, o = {}) {
  const { k, c } = o.grid ? { k: o.grid, c: 1 } : centerById(o.center);
  const N = code.size,
    G = N * k,
    plain = plainModules(code);
  if (code.rotation) for (let i = 0; i < plain.length; i++) plain[i] = code.role[i] !== 0 ? 1 : 0;
  if (o.guard) {
    for (const p of code.pieces.filter((p) => p.kind === "alignment")) {
      const extra = o.guard;
      for (let y = Math.max(0, p.row - extra); y < Math.min(N, p.row + 5 + extra); y++)
        for (let x = Math.max(0, p.col - extra); x < Math.min(N, p.col + 5 + extra); x++)
          plain[y * N + x] = 1;
    }
  }
  if (o.finderGuard) {
    for (const p of code.pieces.filter((p) => p.kind === "finder")) {
      const extra = o.finderGuard;
      for (let y = Math.max(0, p.row - extra); y < Math.min(N, p.row + 7 + extra); y++)
        for (let x = Math.max(0, p.col - extra); x < Math.min(N, p.col + 7 + extra); x++)
          plain[y * N + x] = 1;
    }
  }
  const src = squareSample(pic, G),
    cells = src.slice();
  const center = new Uint8Array(G * G),
    forced = new Uint8Array(G * G);
  const lo = (k - c) / 2;
  const W = cellWeights(k, o.sigma ?? 0.28);
  const at = (m, i) => (Math.floor(m / N) * k + Math.floor(i / k)) * G + (m % N) * k + (i % k);
  for (let m = 0; m < N * N; m++)
    for (let i = 0; i < k * k; i++) {
      const j = at(m, i),
        q = j * 3;
      const mid =
        i % k >= lo && i % k < lo + c && Math.floor(i / k) >= lo && Math.floor(i / k) < lo + c;
      center[j] = mid ? 1 : 0;
      if (plain[m]) {
        forced[j] = 1;
        cells.set(code.dark[m] ? FG : BG, q);
      } else if (mid && !o.adaptive) {
        forced[j] = 1;
        const g = gray(cells.subarray(q, q + 3));
        const to = code.dark[m] ? 0.1 : 0.9;
        shift(cells, q, to - g);
      }
    }
  // Alternating projections minimize the color displacement needed by center and area samples.
  const margin = o.margin ?? 0.15;
  for (let m = 0; m < N * N; m++) {
    if (plain[m]) continue;
    const dark = code.dark[m] === 1;
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (const area of o.area === false ? [false] : [false, true]) {
        let seen = 0,
          norm = 0;
        for (let i = 0; i < k * k; i++) {
          const j = at(m, i),
            q = j * 3,
            w = area ? 1 / (k * k) : W[i];
          const g = gray(cells.subarray(q, q + 3));
          seen += w * g;
          if (!forced[j] && (dark ? g > 0.002 : g < 0.998)) norm += w * w;
        }
        const gap = area ? (o.areaMargin ?? margin) : margin;
        const threshold = dark ? 0.5 - gap : 0.5 + gap;
        const delta = threshold - seen;
        if ((dark ? delta >= -0.001 : delta <= 0.001) || norm === 0) continue;
        changed = true;
        for (let i = 0; i < k * k; i++) {
          const j = at(m, i),
            q = j * 3,
            w = area ? 1 / (k * k) : W[i];
          if (!forced[j]) shift(cells, q, (delta * w) / norm);
        }
      }
      if (!changed) break;
    }
  }
  return {
    code,
    k,
    c,
    G,
    cells,
    plain,
    center,
    forced,
    nudged: 0,
    margin,
    contrast: o.contrast ?? 0.5,
    style: "color",
  };
}

export function recolor(w, pic, strength = 0.5) {
  const src = squareSample(pic, w.G),
    cells = w.cells.slice();
  for (let j = 0; j < w.G * w.G; j++) {
    const m = Math.floor(Math.floor(j / w.G) / w.k) * w.code.size + Math.floor((j % w.G) / w.k);
    if (w.plain[m]) continue;
    const q = j * 3,
      g = gray(cells.subarray(q, q + 3)),
      s = gray(src.subarray(q, q + 3));
    for (let ch = 0; ch < 3; ch++)
      cells[q + ch] = clamp(cells[q + ch] + strength * (src[q + ch] - s - (cells[q + ch] - g)));
  }
  return { ...w, cells };
}
