// Lane QR lab r2 (docs/handoff/QRLabR2.md): the "How a QR code works" toy's
// step-by-step encoder (src/qr-lab/steps.js) and the Reed–Solomon decoder
// (src/qr-lab/rs.js), checked step by step against Project Nayuki's encoder
// (vendor/qrcodegen/, the one the QR code toy uses). Node only, no browser.

import { test, expect } from "@playwright/test";
import qrcodegen from "../vendor/qrcodegen/qrcodegen.js";
import {
  encodeSteps,
  penalty,
  LEVELS,
  dataCodewords,
  totalCodewords,
  BLOCKS,
  ECC_PER_BLOCK,
  fixable,
  asText,
  formatBits,
  versionBits,
} from "../src/qr-lab/steps.js";
import { eccFor, decode, generator } from "../src/qr-lab/rs.js";

const { QrCode, QrSegment } = qrcodegen;
const ECL = { L: QrCode.Ecc.LOW, M: QrCode.Ecc.MEDIUM, Q: QrCode.Ecc.QUARTILE, H: QrCode.Ecc.HIGH };

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// Texts in every mode and of many lengths (up to version 40 at L).
function texts() {
  const r = rng(7);
  const pick = (set, n) => Array.from({ length: n }, () => set[Math.floor(r() * set.length)]).join(""); // prettier-ignore
  const out = ["", "0", "01234567", "HELLO WORLD", "https://ryanjosephkamp.github.io/splashery/", "Ünïcödé ✓ 日本 🙂"]; // prettier-ignore
  for (const n of [1, 2, 3, 7, 17, 40, 41, 100, 300, 1000, 2900]) out.push(pick("0123456789", n));
  for (const n of [1, 2, 9, 25, 77, 200, 600, 1800]) out.push(pick("ABCXYZ0189 $%*+-./:", n));
  for (const n of [1, 5, 14, 30, 90, 260, 700, 1200]) out.push(pick("abcdefghijklmnopqrstuvwxyz -_?=&é", n)); // prettier-ignore
  return out;
}

const nayukiModules = (qr) => {
  const out = new Uint8Array(qr.size * qr.size);
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) out[y * qr.size + x] = qr.getModule(x, y) ? 1 : 0; // prettier-ignore
  return out;
};

test("every encoding step matches Nayuki's encoder", () => {
  let checked = 0;
  for (const text of texts())
    for (const level of LEVELS) {
      let ny;
      try {
        ny = QrCode.encodeSegments(QrSegment.makeSegments(text), ECL[level], 1, 40, -1, false);
      } catch {
        // Too long for this level: ours must say so too.
        expect(() => encodeSteps(text, level), `${level} ${text.length}`).toThrow();
        continue;
      }
      const s = encodeSteps(text, level);
      const tag = `${level} "${text.slice(0, 20)}" (${text.length})`;
      // The segment: mode indicator, character count, data bits.
      const segs = QrSegment.makeSegments(text);
      if (segs.length) {
        expect(segs.length).toBe(1);
        const seg = segs[0];
        expect(parseInt(s.bits.mode, 2), tag).toBe(seg.mode.modeBits);
        expect(s.count, tag).toBe(seg.numChars);
        expect(s.bits.count.length, tag).toBe(seg.mode.numCharCountBits(s.version));
        expect(s.bits.data, tag).toBe(seg.getData().join(""));
      } else expect(s.bits.mode + s.bits.count + s.bits.data, tag).toBe("");
      // The version and the chosen mask.
      expect(s.version, tag).toBe(ny.version);
      expect(s.mask, tag).toBe(ny.mask);
      // The data codewords: Nayuki's code built from ours, with the same mask,
      // is the very code Nayuki made from the text (the placement is
      // one-to-one, so equal modules mean equal codewords).
      expect(s.dataCodewords.length).toBe(dataCodewords(s.version, level));
      const fromOurs = new QrCode(s.version, ECL[level], s.dataCodewords, s.mask);
      expect(asText(nayukiModules(fromOurs), ny.size), tag).toBe(asText(nayukiModules(ny), ny.size)); // prettier-ignore
      // The error correction codewords, and their interleaving with the data.
      expect(s.sequence, tag).toEqual(fromOurs.addEccAndInterleave(s.dataCodewords));
      expect(s.sequence.length).toBe(totalCodewords(s.version));
      expect(s.blocks.length).toBe(BLOCKS[level][s.version]);
      for (const b of s.blocks) {
        const div = QrCode.reedSolomonComputeDivisor(ECC_PER_BLOCK[level][s.version]);
        expect(b.ecc).toEqual(QrCode.reedSolomonComputeRemainder(b.data, div));
      }
      // Each mask's penalty (Nayuki's score for the code made with that mask).
      if (s.version <= 10)
        for (const m of s.masks) {
          const q = new QrCode(s.version, ECL[level], s.dataCodewords, m.mask);
          expect(m.penalty.total, `${tag} mask ${m.mask}`).toBe(q.getPenaltyScore());
          expect(asText(m.modules, s.size), `${tag} mask ${m.mask}`).toBe(asText(nayukiModules(q), q.size)); // prettier-ignore
        }
      // The final modules.
      expect(asText(s.modules, s.size), tag).toBe(asText(nayukiModules(ny), ny.size));
      checked++;
    }
  expect(checked).toBeGreaterThan(90);
});

test("the zigzag path puts each bit where Nayuki's encoder does", () => {
  for (const [text, level] of [
    ["HELLO WORLD", "Q"],
    ["https://ryanjosephkamp.github.io/splashery/qr", "M"],
    ["x".repeat(160), "L"], // version 7: version information blocks
  ]) {
    const s = encodeSteps(text, level);
    // A bare Nayuki code with only its function patterns drawn (a finished
    // one drops its map of function modules).
    const q = Object.create(QrCode.prototype);
    Object.assign(q, {
      version: s.version,
      size: s.size,
      errorCorrectionLevel: ECL[level],
      mask: 0,
    });
    q.modules = Array.from({ length: s.size }, () => new Array(s.size).fill(false));
    q.isFunction = Array.from({ length: s.size }, () => new Array(s.size).fill(false));
    q.drawFunctionPatterns();
    const n = s.sequence.length * 8;
    for (let i = 0; i < n; i += i < 400 ? 1 : 37) {
      // One bit set: the one dark data module must be the path's i-th.
      const seq = new Array(s.sequence.length).fill(0);
      seq[i >>> 3] = 1 << (7 - (i & 7));
      for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (!q.isFunction[y][x]) q.modules[y][x] = false; // prettier-ignore
      q.drawCodewords(seq);
      const dark = [];
      for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (!q.isFunction[y][x] && q.modules[y][x]) dark.push(y * q.size + x); // prettier-ignore
      expect(dark, `${text.slice(0, 10)} bit ${i}`).toEqual([s.path[i]]);
    }
    // The function patterns are the modules Nayuki marks as function modules.
    for (let y = 0; y < q.size; y++)
      for (let x = 0; x < q.size; x++) expect(s.bitOf[y * q.size + x] < 0).toBe(q.isFunction[y][x]); // prettier-ignore
  }
});

test("the format and version information are the standard's", () => {
  // Thonky's format information table: L with mask 0 is 111011111000100,
  // H with mask 7 is 000100000111011; version 7's information is
  // 000111110010010100 (Thonky's version information table).
  expect(formatBits("L", 0).toString(2).padStart(15, "0")).toBe("111011111000100");
  expect(formatBits("H", 7).toString(2).padStart(15, "0")).toBe("000100000111011");
  expect(formatBits("M", 5).toString(2).padStart(15, "0")).toBe("100000011001110");
  expect(versionBits(7).toString(2).padStart(18, "0")).toBe("000111110010010100");
  expect(versionBits(40).toString(2).padStart(18, "0")).toBe("101000110001101001");
  // Thonky's worked example: "HELLO WORLD" at 1-Q.
  const s = encodeSteps("HELLO WORLD", "Q");
  expect(s.bits.mode).toBe("0010");
  expect(s.bits.count).toBe("000001011");
  expect(s.groups.map((g) => g.bits)).toEqual(["01100001011", "01111000110", "10001011100", "10110111000", "10011010100", "001101"]); // prettier-ignore
  expect(s.dataCodewords).toEqual([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236]);
  expect(s.blocks[0].ecc).toEqual([168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
  // Generator polynomial for 7 codewords (Thonky: α exponents 0, 87, 229,
  // 146, 149, 238, 102, 21).
  expect(generator(7)).toEqual([1, 127, 122, 154, 164, 11, 68, 117]);
  expect(fixable(1, "L")).toBe(2);
  expect(fixable(1, "H")).toBe(8);
  expect(fixable(5, "Q")).toBe(9);
});

test("the penalty rules add up", () => {
  const s = encodeSteps("https://ryanjosephkamp.github.io/splashery/", "M");
  for (const m of s.masks) {
    const p = penalty(m.modules, s.size);
    expect(p.total).toBe(p.n1 + p.n2 + p.n3 + p.n4);
    expect(p.n2 % 3).toBe(0);
    expect(p.n3 % 40).toBe(0);
  }
  expect(s.masks[s.mask].penalty.total).toBe(Math.min(...s.masks.map((m) => m.penalty.total)));
});

test("Reed–Solomon decoding fixes up to half the error correction codewords", () => {
  const r = rng(11);
  let fixed = 0;
  let refused = 0;
  for (let trial = 0; trial < 600; trial++) {
    const n = [7, 10, 13, 17, 22, 26, 30][trial % 7];
    const k = 4 + Math.floor(r() * 40);
    const data = Array.from({ length: k }, () => Math.floor(r() * 256));
    const block = data.concat(eccFor(data, n));
    expect(decode(block, n).ok).toBe(true);
    const t = Math.floor(n / 2);
    const nErr = 1 + Math.floor(r() * (t + 3));
    const bad = block.slice();
    const where = new Set();
    while (where.size < nErr) where.add(Math.floor(r() * bad.length));
    for (const i of where) bad[i] ^= 1 + Math.floor(r() * 255);
    const res = decode(bad, n);
    if (nErr <= t) {
      expect(res.ok, `${nErr} errors of ${t}`).toBe(true);
      expect(res.block).toEqual(block);
      expect(res.errors.map((e) => e.index).sort((a, b) => a - b)).toEqual([...where].sort((a, b) => a - b)); // prettier-ignore
      fixed++;
    } else if (!res.ok) refused++;
    else expect(res.errors.length).toBeLessThanOrEqual(t); // a miscorrection: still a valid codeword
  }
  expect(fixed).toBeGreaterThan(300);
  expect(refused).toBeGreaterThan(20);
});
