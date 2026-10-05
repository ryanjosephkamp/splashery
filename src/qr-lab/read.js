// Lane QR lab r2: reading a picture of a code module by module, when we know
// where each module is, and what error correction makes of what was read.
// The Damage lab's per-block counts and its healing (X3) come from here, and
// the study uses it to say which blocks failed.
//
// It reads as a decoder does once it has found the code: the format
// information first (the nearest valid format of either copy, which is how
// BCH(15, 5) corrects up to three wrong bits), then the data along the zigzag
// path with the mask removed, then each block's Reed–Solomon decoding.

import { MASKS, formatBits, formatPositions, LEVELS, ROLE } from "./steps.js";
import { decode } from "./rs.js";

const gray = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

// The mean gray (0..255) of a small disk of pixels around each module's
// center. toPixel(row, col) gives the center in pixels; r the disk's radius.
export function sampleModules(img, size, toPixel, r = 1) {
  const out = new Float32Array(size * size);
  const R = Math.max(0, r);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const [px, py] = toPixel(row, col);
      let sum = 0;
      let n = 0;
      for (let y = Math.floor(py - R); y <= Math.ceil(py + R); y++)
        for (let x = Math.floor(px - R); x <= Math.ceil(px + R); x++) {
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 > R * R + 0.5) continue;
          sum += gray(img.data, (y * img.width + x) * 4);
          n++;
        }
      out[row * size + col] = n ? sum / n : 255;
    }
  return out;
}

// Otsu's threshold over the module samples: the cut that best splits them
// into two groups.
export function otsu(values) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let cut = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      cut = t + 0.5;
    }
  }
  return cut;
}

// Samples to modules (1 dark), by Otsu's cut.
export function toDark(samples) {
  const cut = otsu(samples);
  return Uint8Array.from(samples, (v) => (v < cut ? 1 : 0));
}

// The nearest valid format information to 15 read bits: { level, mask, dist }.
export function nearestFormat(bits) {
  let best = null;
  for (const level of LEVELS)
    for (let mask = 0; mask < 8; mask++) {
      let x = formatBits(level, mask) ^ bits;
      let dist = 0;
      while (x) {
        dist += x & 1;
        x >>>= 1;
      }
      if (!best || dist < best.dist) best = { level, mask, dist };
    }
  return best;
}

// What a reader makes of read modules `dark` (a Uint8Array), for a code whose
// steps (src/qr-lab/steps.js, encodeSteps) we know. Returns
//   wrong        modules read wrong (indices)
//   finders      wrong modules in each finder pattern (upper left, upper
//                right, lower left)
//   format       { level, mask, dist, ok } read from the better copy (ok: within
//                3 bits of a valid format, and the right one)
//   blocks       per block: { lost (wrong codewords), fixable, ok, errors,
//                fixedBy }: lost is counted against the true codewords; ok is
//                whether its Reed–Solomon decoding came back right
//   decodes      every block decoded right and the format read right
//   healed       the modules after correction (Uint8Array), and changed: the
//                modules each block's correction set right ([[index…]…])
export function analyze(steps, dark) {
  const { size, path, sequence, origin, blocks, eccPerBlock, fixable, role } = steps;
  const truth = steps.modules;
  const wrong = [];
  for (let i = 0; i < size * size; i++) if (dark[i] !== truth[i]) wrong.push(i);
  // The finders.
  const finders = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ].map(([x0, y0]) => {
    let n = 0;
    for (let y = y0; y < y0 + 7; y++) for (let x = x0; x < x0 + 7; x++) n += dark[y * size + x] !== truth[y * size + x] ? 1 : 0; // prettier-ignore
    return n;
  });
  // The format information, both copies; the closer wins.
  const read15 = (copy) => {
    let bits = 0;
    const pos = copy === 0 ? formatPos(size).a : formatPos(size).b;
    pos.forEach(([x, y], i) => (bits |= dark[y * size + x] << i));
    return bits;
  };
  const f0 = nearestFormat(read15(0));
  const f1 = nearestFormat(read15(1));
  const f = f0.dist <= f1.dist ? f0 : f1;
  const format = { ...f, ok: f.dist <= 3 && f.level === steps.level && f.mask === steps.mask };
  // The codewords as read: unmask with the mask the format says (the true
  // one if the format can't be read), along the path.
  const mask = f.dist <= 3 ? f.mask : steps.mask;
  const read = new Array(sequence.length).fill(0);
  for (let i = 0; i < sequence.length * 8; i++) {
    const m = path[i];
    const x = m % size;
    const y = (m / size) | 0;
    const bit = dark[m] ^ (MASKS[mask].f(x, y) ? 1 : 0);
    read[i >>> 3] |= bit << (7 - (i & 7));
  }
  // Back into blocks.
  const got = blocks.map((b) => new Array(b.data.length + eccPerBlock).fill(0));
  origin.forEach((o, i) => (got[o.block][o.index] = read[i]));
  const want = blocks.map((b) => b.data.concat(b.ecc));
  const out = [];
  const fixedSeq = read.slice();
  const where = blocks.map((b) => new Array(b.data.length + eccPerBlock));
  origin.forEach((o, i) => (where[o.block][o.index] = i));
  for (let j = 0; j < blocks.length; j++) {
    let lost = 0;
    for (let i = 0; i < got[j].length; i++) if (got[j][i] !== want[j][i]) lost++;
    const res = decode(got[j], eccPerBlock, { limit: Math.floor(eccPerBlock / 2) });
    const right = res.ok && res.block.every((v, i) => v === want[j][i]);
    if (res.ok) res.block.forEach((v, i) => (fixedSeq[where[j][i]] = v));
    out.push({ lost, fixable, ok: right, decoded: res.ok, errors: res.errors.map((e) => e.index), codewords: got[j].length }); // prettier-ignore
  }
  // The healed modules: each block's corrections placed back, masked again.
  const healed = dark.slice();
  const changed = blocks.map(() => []);
  for (let i = 0; i < sequence.length * 8; i++) {
    const m = path[i];
    const x = m % size;
    const y = (m / size) | 0;
    const bit = ((fixedSeq[i >>> 3] >>> (7 - (i & 7))) & 1) ^ (MASKS[mask].f(x, y) ? 1 : 0);
    if (bit !== healed[m]) {
      healed[m] = bit;
      changed[origin[i >>> 3].block].push(m);
    }
  }
  // Function patterns are known to any reader: put them back too (a
  // reader doesn't need them right once it has found the code).
  for (let i = 0; i < size * size; i++) if (role[i] !== ROLE.data && role[i] !== ROLE.ecc && role[i] !== ROLE.remainder) healed[i] = truth[i]; // prettier-ignore
  return {
    wrong,
    finders,
    format,
    blocks: out,
    decodes: format.ok && out.every((b) => b.ok),
    healed,
    changed,
  };
}

const formatPos = (size) => {
  const both = formatPositions(size);
  return { a: both.map((p) => p[0]), b: both.map((p) => p[1]) };
};
