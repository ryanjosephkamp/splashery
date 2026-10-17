// Most detail keeps continuous picture colors and constrains the complete camera footprint.
// The legacy halftone remains in picture.js. Helpers run only after its module initializes.
import { centerById, squareSample, plainModules, cellWeights, FG, BG, gray } from "./picture.js";
const clamp = (x) => Math.min(1, Math.max(0, x));
const grayAt = (data, q) => 0.2126 * data[q] + 0.7152 * data[q + 1] + 0.0722 * data[q + 2];
const luminance = [0.2126, 0.7152, 0.0722];
function shift(cells, at, delta, channel = "rgb") {
  if (channel === "weighted") {
    for (let ch = 0; ch < 3; ch++) cells[at + ch] = clamp(cells[at + ch] + delta * luminance[ch]);
    return;
  }
  if (channel === "green") {
    if (delta < 0 ? cells[at + 1] > 0 : cells[at + 1] < 1) {
      cells[at + 1] = clamp(cells[at + 1] + delta);
      return;
    }
    cells[at] = clamp(cells[at] + delta);
    cells[at + 2] = clamp(cells[at + 2] + delta);
    return;
  }
  for (let ch = 0; ch < 3; ch++) cells[at + ch] = clamp(cells[at + ch] + delta);
}
function greenSlope(cells, q, dark) {
  if (dark ? cells[q + 1] > 0 : cells[q + 1] < 1) return 0.7152;
  return (
    ((dark ? cells[q] > 0 : cells[q] < 1) ? 0.2126 : 0) +
    ((dark ? cells[q + 2] > 0 : cells[q + 2] < 1) ? 0.0722 : 0)
  );
}
function colorSlope(cells, q, dark, channel) {
  if (channel === "green") return greenSlope(cells, q, dark);
  let result = 0;
  for (let ch = 0; ch < 3; ch++)
    if (dark ? cells[q + ch] > 0 : cells[q + ch] < 1) result += luminance[ch] ** 2;
  return result;
}
function continuous(code, pic, o = {}) {
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
        const g = grayAt(cells, q);
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
          const g = grayAt(cells, q);
          seen += w * g;
          if (!forced[j] && (dark ? g > 0.002 : g < 0.998))
            norm +=
              w *
              w *
              (o.channel && o.channel !== "rgb" ? colorSlope(cells, q, dark, o.channel) : 1);
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
          if (!forced[j]) shift(cells, q, (delta * w) / norm, o.channel);
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
    channel: o.channel || "rgb",
    finderGuard: o.finderGuard ?? 3,
  };
}

function cameraProject(w, o = {}) {
  const { code, k, G, cells, plain } = w,
    N = code.size;
  const sigma = o.cameraSigma ?? 0.32,
    rad = Math.ceil(3 * sigma * k),
    one = [];
  const erf = (x) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x);
    return x < 0 ? -y : y;
  };
  const cdf = (x) => 0.5 * (1 + erf(x / (sigma * Math.SQRT2)));
  let total = 0;
  for (let d = -rad; d <= rad; d++) {
    const v = cdf((d + 0.5) / k) - cdf((d - 0.5) / k);
    one.push(v);
    total += v;
  }
  for (let i = 0; i < one.length; i++) one[i] /= total;
  const offset = Math.floor(k / 2),
    margin = o.cameraMargin ?? 0.1;
  for (let round = 0; round < 4; round++) {
    const means = new Float32Array(N * N),
      thresholds = new Float32Array(N * N);
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        const q = (y * G + x) * 3;
        means[Math.floor(y / k) * N + Math.floor(x / k)] += grayAt(cells, q) / (k * k);
      }
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        let sum = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const yy = r + dy,
              xx = c + dx;
            sum += yy < 0 || xx < 0 || yy >= N || xx >= N ? 1 : means[yy * N + xx];
          }
        thresholds[r * N + c] = 0.5 * (0.5 + sum / 25);
      }
    let changed = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const m = r * N + c;
        if (plain[m]) continue;
        const dark = code.dark[m] === 1,
          cy = r * k + offset,
          cx = c * k + offset;
        let seen = 0,
          norm = 0;
        for (let dy = -rad; dy <= rad; dy++)
          for (let dx = -rad; dx <= rad; dx++) {
            const y = cy + dy,
              x = cx + dx,
              v = one[dy + rad] * one[dx + rad];
            const g = y < 0 || x < 0 || y >= G || x >= G ? 1 : grayAt(cells, (y * G + x) * 3);
            seen += v * g;
            if (Math.abs(dy) <= offset && Math.abs(dx) <= offset) {
              const q = (y * G + x) * 3;
              const slope = (dark ? cells[q] > 0 : cells[q] < 1) ? 0.2126 : 0;
              const green = (dark ? cells[q + 1] > 0 : cells[q + 1] < 1) ? 0.7152 : 0;
              const blue = (dark ? cells[q + 2] > 0 : cells[q + 2] < 1) ? 0.0722 : 0;
              norm +=
                v *
                v *
                (o.channel && o.channel !== "rgb"
                  ? colorSlope(cells, q, dark, o.channel)
                  : slope + green + blue);
            }
          }
        const delta = thresholds[m] + (dark ? -margin : margin) - seen;
        if ((dark ? delta >= -0.001 : delta <= 0.001) || norm <= 0) continue;
        changed++;
        for (let v = 0; v < k; v++)
          for (let u = 0; u < k; u++) {
            const weight = one[v - offset + rad] * one[u - offset + rad];
            shift(cells, ((r * k + v) * G + c * k + u) * 3, (delta * weight) / norm, o.channel);
          }
      }
    if (!changed) break;
  }
  return w;
}

function alignmentMoat(w) {
  const N = w.code.size;
  const p = w.code.pieces
    .filter((p) => p.kind === "alignment")
    .sort((a, b) => b.row + b.col - (a.row + a.col))[0];
  if (!p) return w;
  for (let y = p.row - 1; y <= p.row + 5; y++)
    for (let x = p.col - 1; x <= p.col + 5; x++) {
      if (y >= p.row && y < p.row + 5 && x >= p.col && x < p.col + 5) continue;
      if (y < 0 || x < 0 || y >= N || x >= N) continue;
      w.plain[y * N + x] = 1;
      for (let v = 0; v < w.k; v++)
        for (let u = 0; u < w.k; u++) {
          const j = (y * w.k + v) * w.G + x * w.k + u;
          w.cells.set(BG, j * 3);
          w.forced[j] = 1;
        }
    }
  return w;
}

export function weaveDetail(code, pic, o = {}) {
  const margin = o.margin ?? 0.08;
  let w = continuous(code, pic, {
    ...o,
    margin: 0.1,
    sigma: 0.35,
    adaptive: true,
    areaMargin: 0.03,
    guard: 0,
    finderGuard: o.finderGuard ?? 3,
  });
  if (code.ecc === "H") w = alignmentMoat(w);
  w = cameraProject(w, { cameraMargin: margin, cameraSigma: 0.36, channel: o.channel });
  return finishDetail(w, o);
}

export function finishDetail(w, o = {}) {
  const code = w.code;
  for (const p of w.code.pieces.filter((p) => p.kind === "finder"))
    for (let y = p.row; y < p.row + 7; y++)
      for (let x = p.col; x < p.col + 7; x++)
        if (code.dark[y * code.size + x])
          for (let v = 0; v < w.k; v++)
            for (let u = 0; u < w.k; u++) {
              const q = ((y * w.k + v) * w.G + x * w.k + u) * 3;
              const edge = x === p.col || x === p.col + 6 || y === p.row || y === p.row + 6;
              const tone = edge
                ? (o.finderEdge ?? o.finderTone ?? 0.24)
                : (o.finderCore ?? o.finderTone ?? 0.08);
              w.cells[q] = w.cells[q + 1] = w.cells[q + 2] = tone;
            }
  return {
    ...w,
    fidelity: "detail",
    decoration: "picture",
    margin: o.margin ?? w.margin,
    rendering: {
      method: o.method || "continuous",
      sigma: o.method === "halftone" ? 0.28 : 0.36,
      edge: o.finderEdge ?? 0.24,
      core: o.finderCore ?? 0.08,
      channel: w.channel || "rgb",
      finderGuard: w.finderGuard,
    },
  };
}

// Preserve the halftone's fine texture while constraining the complete camera footprint.
export function projectHalftone(w, o = {}) {
  const copy = { ...w, cells: w.cells.slice(), plain: w.plain.slice(), forced: w.forced.slice() };
  if (copy.code.ecc === "H") alignmentMoat(copy);
  cameraProject(copy, { cameraMargin: o.margin ?? w.margin, cameraSigma: 0.36 });
  const finished = finishDetail(copy, { ...o, method: "halftone-camera" });
  finished.rendering.seedMargin = w.margin;
  return finished;
}
