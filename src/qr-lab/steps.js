// Lane QR lab r2: a QR code made step by step, keeping every step so the
// "How a QR code works" toy can show it and the tests can check it.
//
// This is a second encoder, written from the standard as open sources
// describe it (ISO/IEC 18004:2015 for QR Code Model 2; Wikipedia's "QR code"
// article; Thonky's QR code tutorial, https://www.thonky.com/qr-code-tutorial/;
// Project Nayuki's "Creating a QR Code step by step"). It covers the numeric,
// alphanumeric and byte modes, every version (1 to 40) and every error
// correction level. tests/qrs-steps.spec.mjs checks each step against the
// vendored Nayuki encoder (vendor/qrcodegen/): the segments' bits, the
// version, the data codewords, the error correction codewords and their
// interleaving, the placement, each mask's penalty, the chosen mask and the
// final modules.
//
// Coordinates: x is the column (0 at the left), y the row (0 at the top);
// modules are stored row by row, index y * size + x, 1 for dark.

import { eccFor } from "./rs.js";

// ---- The standard's tables ------------------------------------------------------------

export const LEVELS = ["L", "M", "Q", "H"];
// The two format bits for each level (L 01, M 00, Q 11, H 10).
export const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
// What each level can restore: the share of codewords (the standard's figures).
export const LEVEL_RECOVERY = { L: 7, M: 15, Q: 25, H: 30 };

// Error correction codewords per block, and the number of blocks, by level
// and version (index 0 unused). From the standard's table 9 (Thonky's "Error
// correction code words and block information" table).
// prettier-ignore
export const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
// prettier-ignore
export const BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
// Misdecode protection: in the smallest codes the standard keeps p of the
// error correction codewords back to catch wrong fixes, so a block can fix
// (ecc - p) / 2 codewords, not ecc / 2 (table 9's footnotes).
const MISDECODE = { "1L": 3, "1M": 2, "1Q": 1, "1H": 1, "2L": 2, "3L": 1 };
export const misdecode = (version, level) => MISDECODE[`${version}${level}`] || 0;
// How many wrong codewords one block can fix, by the standard.
export const fixable = (version, level) =>
  Math.floor((ECC_PER_BLOCK[level][version] - misdecode(version, level)) / 2);

export const sizeOf = (version) => version * 4 + 17;

// Every module that isn't a function pattern: data, error correction and
// remainder bits (the standard's table 1).
export function rawDataModules(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const a = Math.floor(version / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}
export const totalCodewords = (version) => Math.floor(rawDataModules(version) / 8);
export const dataCodewords = (version, level) =>
  totalCodewords(version) - ECC_PER_BLOCK[level][version] * BLOCKS[level][version];

// The alignment patterns' centers on each axis (the standard's annex E table,
// computed: evenly spaced from 6 to size - 7, the steps even).
export function alignmentCenters(version) {
  if (version === 1) return [];
  const n = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const out = [6];
  for (let pos = sizeOf(version) - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ---- Modes and segments ------------------------------------------------------------------

export const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
export const MODES = {
  numeric: { name: "Numeric", indicator: 0b0001, countBits: [10, 12, 14] },
  alphanumeric: { name: "Alphanumeric", indicator: 0b0010, countBits: [9, 11, 13] },
  byte: { name: "Byte", indicator: 0b0100, countBits: [8, 16, 16] },
};
// The character count's width: versions 1–9, 10–26 and 27–40.
export const countWidth = (mode, version) =>
  MODES[mode].countBits[version <= 9 ? 0 : version <= 26 ? 1 : 2];

const bin = (v, n) => v.toString(2).padStart(n, "0");

// The mode a text needs: numeric for digits only, alphanumeric for the 45
// characters of that set (capitals, digits, space and $%*+-./:), else bytes
// (UTF-8). One segment, as most encoders (Nayuki's included) make for a text.
export function modeOf(text) {
  if (/^[0-9]*$/.test(text)) return "numeric";
  if ([...text].every((ch) => ALNUM.includes(ch))) return "alphanumeric";
  return "byte";
}

// The data bits of a text in a mode, in groups as the standard packs them:
// [{ chars, value, bits }].
export function dataGroups(text, mode) {
  const out = [];
  if (mode === "numeric") {
    // Three digits to 10 bits, a last two to 7, a last one to 4.
    for (let i = 0; i < text.length; i += 3) {
      const chars = text.slice(i, i + 3);
      const v = Number(chars);
      out.push({ chars, value: v, bits: bin(v, [0, 4, 7, 10][chars.length]) });
    }
  } else if (mode === "alphanumeric") {
    // Two characters to 11 bits (45 × the first + the second), a last one to 6.
    for (let i = 0; i < text.length; i += 2) {
      const chars = text.slice(i, i + 2);
      const v = chars.length === 2 ? ALNUM.indexOf(chars[0]) * 45 + ALNUM.indexOf(chars[1]) : ALNUM.indexOf(chars); // prettier-ignore
      out.push({ chars, value: v, bits: bin(v, chars.length === 2 ? 11 : 6) });
    }
  } else {
    // Each byte of the UTF-8 text to 8 bits.
    const bytes = new TextEncoder().encode(text);
    const chars = [...text];
    let ci = 0;
    let left = 0;
    for (const b of bytes) {
      // Label the first byte of each character with the character.
      let label = "";
      if (left === 0) {
        label = chars[ci++] ?? "";
        left = new TextEncoder().encode(label).length;
      }
      left--;
      out.push({ chars: label, value: b, bits: bin(b, 8) });
    }
  }
  return out;
}

// The count a segment's header carries: characters, or bytes in byte mode.
export const charCount = (text, mode) =>
  mode === "byte" ? new TextEncoder().encode(text).length : text.length;

// ---- Function patterns --------------------------------------------------------------------

export const ROLE = {
  finder: 1,
  separator: 2,
  timing: 3,
  alignment: 4,
  format: 5,
  version: 6,
  darkModule: 7,
  data: 8,
  ecc: 9,
  remainder: 10,
};
export const ROLE_NAMES = Object.fromEntries(Object.entries(ROLE).map(([k, v]) => [v, k]));

// The format information: the level's two bits and the mask's three, a
// BCH(15, 5) code of them (generator 0x537), XORed with 101010000010010.
export function formatBits(level, mask) {
  const data = (LEVEL_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}
// The version information (versions 7 and up): six bits of version and a
// BCH(18, 6) code of them (generator 0x1F25).
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | (rem & 0xfff);
}

// Where each of the 15 format bits goes (bit i of formatBits): two copies,
// [[x, y] in the first, [x, y] in the second].
export function formatPositions(size) {
  const a = [];
  for (let i = 0; i <= 5; i++) a.push([8, i]);
  a.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) a.push([14 - i, 8]);
  const b = [];
  for (let i = 0; i < 8; i++) b.push([size - 1 - i, 8]);
  for (let i = 8; i < 15; i++) b.push([8, size - 15 + i]);
  return a.map((p, i) => [p, b[i]]);
}

// The function patterns of a version: { size, role, dark } with role 0 for
// the modules left for data. Format and version modules are drawn light
// until a mask is chosen (formatBits fills them in).
export function functionPatterns(version) {
  const size = sizeOf(version);
  const role = new Uint8Array(size * size);
  const dark = new Uint8Array(size * size);
  const set = (x, y, r, d) => {
    role[y * size + x] = r;
    dark[y * size + x] = d ? 1 : 0;
  };
  // Timing patterns: row 6 and column 6, dark on even positions.
  for (let i = 0; i < size; i++) {
    set(6, i, ROLE.timing, i % 2 === 0);
    set(i, 6, ROLE.timing, i % 2 === 0);
  }
  // Finder patterns (7 × 7) with their light separators (one module wide).
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d === 4 ? ROLE.separator : ROLE.finder, d !== 2 && d !== 4);
      }
  // Alignment patterns (5 × 5), except where a finder sits.
  const pos = alignmentCenters(version);
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++)
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          set(pos[i] + dx, pos[j] + dy, ROLE.alignment, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); // prettier-ignore
    }
  // Format information, reserved (two copies of 15 bits).
  for (const [[ax, ay], [bx, by]] of formatPositions(size)) {
    set(ax, ay, ROLE.format, 0);
    set(bx, by, ROLE.format, 0);
  }
  // The dark module, always dark, beside the lower left finder.
  set(8, size - 8, ROLE.darkModule, 1);
  // Version information (versions 7 and up): two 6 × 3 blocks.
  if (version >= 7) {
    const v = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (v >>> i) & 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, ROLE.version, bit);
      set(b, a, ROLE.version, bit);
    }
  }
  return { size, role, dark };
}

// ---- Placement ---------------------------------------------------------------------------

// The zigzag path through the data area: pairs of columns from the right,
// upward then downward, skipping column 6 (the timing pattern). Returns the
// module indices in order.
export function zigzag(version, role) {
  const size = sizeOf(version);
  const order = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = upward ? size - 1 - v : v;
        if (!role[y * size + x]) order.push(y * size + x);
      }
  }
  return order;
}

// ---- Masks ---------------------------------------------------------------------------------

// The eight mask patterns: a module (x, y) is flipped where the condition holds.
export const MASKS = [
  { formula: "(row + column) mod 2 = 0", f: (x, y) => (x + y) % 2 === 0 },
  { formula: "row mod 2 = 0", f: (x, y) => y % 2 === 0 },
  { formula: "column mod 3 = 0", f: (x) => x % 3 === 0 },
  { formula: "(row + column) mod 3 = 0", f: (x, y) => (x + y) % 3 === 0 },
  { formula: "(⌊row / 2⌋ + ⌊column / 3⌋) mod 2 = 0", f: (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0 }, // prettier-ignore
  { formula: "(row × column) mod 2 + (row × column) mod 3 = 0", f: (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0 }, // prettier-ignore
  { formula: "((row × column) mod 2 + (row × column) mod 3) mod 2 = 0", f: (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0 }, // prettier-ignore
  { formula: "((row + column) mod 2 + (row × column) mod 3) mod 2 = 0", f: (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0 }, // prettier-ignore
];

// The penalty a masked code scores (the standard's section 7.8.3), by rule:
//   n1  runs of five or more same-colored modules in a row or column: 3, plus
//       1 for each module past five
//   n2  each 2 × 2 square of one color: 3
//   n3  each finder-like pattern (dark-light-dark-dark-dark-light-dark, 1 1 3
//       1 1, with four light modules on one side, the edge counting as
//       light): 40
//   n4  the balance: 10 for each full 5% the dark share is away from 50%
// The lowest total wins.
export function penalty(dark, size) {
  let n1 = 0;
  let n3 = 0;
  const at = (x, y) => dark[y * size + x];
  // Runs and finder-like patterns, along each row and then each column. A
  // line's history of run lengths, newest first, with the border outside the
  // code counted as light (as Nayuki's encoder does).
  const finderLike = (h) => {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0); // prettier-ignore
  };
  const scan = (get) => {
    let color = 0;
    let run = 0;
    const h = [0, 0, 0, 0, 0, 0, 0];
    const push = (len) => {
      if (h[0] === 0) len += size; // the light border before the line
      h.pop();
      h.unshift(len);
    };
    for (let i = 0; i < size; i++) {
      const c = get(i);
      if (c === color) {
        run++;
        if (run === 5) n1 += 3;
        else if (run > 5) n1++;
      } else {
        push(run);
        if (!color) n3 += finderLike(h);
        color = c;
        run = 1;
      }
    }
    if (color) {
      push(run);
      run = 0;
    }
    push(run + size); // the light border after the line
    n3 += finderLike(h);
  };
  for (let y = 0; y < size; y++) scan((x) => at(x, y));
  for (let x = 0; x < size; x++) scan((y) => at(x, y));
  let n2 = 0;
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) n2++;
    }
  let darkCount = 0;
  for (let i = 0; i < size * size; i++) darkCount += dark[i];
  const total = size * size;
  const k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
  const p = { n1, n2: n2 * 3, n3: n3 * 40, n4: k * 10, darkShare: darkCount / total };
  p.total = p.n1 + p.n2 + p.n3 + p.n4;
  return p;
}

// ---- The whole code ------------------------------------------------------------------------

// Every step of encoding `text` at `level`. `version`: the smallest that fits
// unless given; `mask`: the lowest penalty unless given (0–7).
export function encodeSteps(text, level = "M", { version: vAsk = 0, mask: mAsk = -1 } = {}) {
  if (!LEVELS.includes(level)) throw new Error(`Unknown level ${level}.`);
  text = String(text ?? "");
  const mode = modeOf(text);
  const groups = dataGroups(text, mode);
  const count = charCount(text, mode);
  const dataBitsLen = groups.reduce((n, g) => n + g.bits.length, 0);
  // 1. The version: the smallest whose data codewords hold the segment
  // (its header's count width depends on the version).
  let version = 0;
  for (let v = vAsk || 1; v <= (vAsk || 40); v++) {
    const need = 4 + countWidth(mode, v) + dataBitsLen;
    if (count < 1 << countWidth(mode, v) && need <= dataCodewords(v, level) * 8) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error(vAsk ? `That doesn't fit in version ${vAsk} at level ${level}.` : `That is too long for a QR code at level ${level}.`); // prettier-ignore
  const size = sizeOf(version);
  const capacity = dataCodewords(version, level) * 8;
  // 2. The bit stream: mode, count, data; then the terminator (up to four
  // zeros), zeros to the next whole byte, and the pad bytes 11101100 and
  // 00010001 in turn until the capacity is full.
  const modeBits = text.length || mode !== "numeric" ? bin(MODES[mode].indicator, 4) : "";
  const countBitsStr = modeBits ? bin(count, countWidth(mode, version)) : "";
  const dataBits = groups.map((g) => g.bits).join("");
  let bits = modeBits + countBitsStr + dataBits;
  const terminator = "0".repeat(Math.min(4, capacity - bits.length));
  bits += terminator;
  const byteFill = "0".repeat((8 - (bits.length % 8)) % 8);
  bits += byteFill;
  const padBytes = [];
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) {
    padBytes.push(pad);
    bits += bin(pad, 8);
  }
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8), 2));
  // 3. Blocks: the data codewords split into blocks (the short ones first,
  // the long ones one codeword longer), each with its own error correction
  // codewords.
  const nBlocks = BLOCKS[level][version];
  const eccLen = ECC_PER_BLOCK[level][version];
  const raw = totalCodewords(version);
  const nShort = nBlocks - (raw % nBlocks);
  const shortData = Math.floor(raw / nBlocks) - eccLen;
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const len = shortData + (i < nShort ? 0 : 1);
    const d = data.slice(k, k + len);
    blocks.push({ data: d, ecc: eccFor(d, eccLen), start: k });
    k += len;
  }
  // 4. Interleaving: the first data codeword of each block, then the second
  // of each, and so on; then the error correction codewords the same way.
  // Each final codeword remembers its block and place: { block, index, ecc }.
  const sequence = [];
  const origin = [];
  for (let i = 0; i < shortData + 1; i++)
    blocks.forEach((b, j) => {
      if (i < b.data.length) {
        sequence.push(b.data[i]);
        origin.push({ block: j, index: i, ecc: false });
      }
    });
  for (let i = 0; i < eccLen; i++)
    blocks.forEach((b, j) => {
      sequence.push(b.ecc[i]);
      origin.push({ block: j, index: b.data.length + i, ecc: true });
    });
  // 5. Placement along the zigzag; the remainder bits (0 to 7) left light.
  const fp = functionPatterns(version);
  const path = zigzag(version, fp.role);
  const bitOf = new Int32Array(size * size).fill(-1); // module -> bit index in the sequence
  const placed = fp.dark.slice();
  const role = fp.role.slice();
  path.forEach((m, i) => {
    bitOf[m] = i;
    if (i < sequence.length * 8) {
      placed[m] = (sequence[i >>> 3] >>> (7 - (i & 7))) & 1;
      role[m] = origin[i >>> 3].ecc ? ROLE.ecc : ROLE.data;
    } else {
      placed[m] = 0;
      role[m] = ROLE.remainder;
    }
  });
  // 6. Masks: each of the eight, with its format bits drawn in, scored.
  const pos = formatPositions(size);
  const masked = (m) => {
    const out = placed.slice();
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (bitOf[i] >= 0 && MASKS[m].f(x, y)) out[i] ^= 1;
      }
    const fb = formatBits(level, m);
    pos.forEach(([[ax, ay], [bx, by]], i) => {
      const b = (fb >>> i) & 1;
      out[ay * size + ax] = b;
      out[by * size + bx] = b;
    });
    return out;
  };
  const masks = MASKS.map((mk, m) => {
    const modules = masked(m);
    return { mask: m, formula: mk.formula, modules, penalty: penalty(modules, size) };
  });
  let mask = mAsk;
  if (mask < 0) {
    mask = 0;
    for (const m of masks) if (m.penalty.total < masks[mask].penalty.total) mask = m.mask;
  }
  return {
    text,
    level,
    mode,
    modeName: MODES[mode].name,
    groups,
    count,
    version,
    size,
    capacity,
    bits: { mode: modeBits, count: countBitsStr, data: dataBits, terminator, byteFill, pad: padBytes.map((b) => bin(b, 8)).join("") }, // prettier-ignore
    padBytes,
    dataCodewords: data,
    blocks,
    eccPerBlock: eccLen,
    fixable: fixable(version, level),
    misdecode: misdecode(version, level),
    sequence,
    origin,
    remainderBits: path.length - sequence.length * 8,
    role,
    functionDark: fp.dark,
    path,
    bitOf,
    placed,
    masks,
    mask,
    format: formatBits(level, mask),
    versionInfo: version >= 7 ? versionBits(version) : null,
    modules: masks[mask].modules,
  };
}

// The codeword (index in the interleaved sequence) a module carries, or -1.
export const codewordAt = (steps, i) =>
  steps.bitOf[i] >= 0 && steps.bitOf[i] < steps.sequence.length * 8 ? steps.bitOf[i] >>> 3 : -1;

// The modules as text, one row per line ("#" dark, "." light).
export function asText(modules, size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    let s = "";
    for (let x = 0; x < size; x++) s += modules[y * size + x] ? "#" : ".";
    rows.push(s);
  }
  return rows.join("\n");
}
