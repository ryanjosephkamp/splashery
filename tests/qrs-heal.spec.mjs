// Lane QR lab r2 (X3, "the code that heals"): the Damage lab's healing is
// real Reed–Solomon decoding of the damaged blocks. Codes are damaged module
// by module (data and error correction modules flipped at random), and
// src/qr-lab/read.js must find and fix every block that has lost no more
// codewords than it can fix, give back exactly the true code, and refuse the
// blocks that lost more. Node only, no browser.

import { test, expect } from "@playwright/test";
import { encodeSteps, ROLE } from "../src/qr-lab/steps.js";
import { analyze, nearestFormat } from "../src/qr-lab/read.js";
import { formatBits } from "../src/qr-lab/steps.js";

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

// Flips modules so that each block loses exactly want[b] codewords (one or
// more modules of each chosen codeword).
function damage(s, want, r) {
  const dark = s.modules.slice();
  const byCodeword = new Map();
  s.path.forEach((m, i) => {
    if (i >= s.sequence.length * 8) return;
    const cw = i >>> 3;
    if (!byCodeword.has(cw)) byCodeword.set(cw, []);
    byCodeword.get(cw).push(m);
  });
  const lost = s.blocks.map(() => 0);
  const order = [...byCodeword.keys()].sort(() => r() - 0.5);
  for (const cw of order) {
    const b = s.origin[cw].block;
    if (lost[b] >= want[b]) continue;
    const mods = byCodeword.get(cw);
    const n = 1 + Math.floor(r() * mods.length);
    for (let k = 0; k < n; k++) dark[mods[(k * 3) % mods.length]] ^= 1;
    lost[b]++;
  }
  return { dark, lost };
}

test("healing fixes every block within its capacity and gives back the true code", () => {
  const r = rng(5);
  let healed = 0;
  for (const [text, level] of [
    ["HELLO WORLD", "Q"],
    ["https://ryanjosephkamp.github.io/splashery/", "M"],
    ["https://ryanjosephkamp.github.io/splashery/", "L"],
    ["0123456789".repeat(12), "H"],
    ["x".repeat(160), "M"],
  ]) {
    const s = encodeSteps(text, level);
    for (let trial = 0; trial < 12; trial++) {
      const want = s.blocks.map(() => Math.floor(r() * (s.fixable + 1)));
      const { dark, lost } = damage(s, want, r);
      const a = analyze(s, dark);
      expect(a.format.ok).toBe(true);
      a.blocks.forEach((b, j) => {
        expect(b.lost, `${level} block ${j}`).toBe(lost[j]);
        expect(b.ok, `${level} block ${j}: ${b.lost} of ${b.fixable}`).toBe(true);
        expect(b.errors.length).toBe(lost[j]);
      });
      expect(a.decodes).toBe(true);
      expect(Array.from(a.healed)).toEqual(Array.from(s.modules));
      // Each block's turn changes exactly the modules it got wrong.
      const wrongData = new Set(
        a.wrong.filter((m) => s.bitOf[m] >= 0 && s.role[m] !== ROLE.remainder),
      );
      expect(new Set(a.changed.flat())).toEqual(wrongData);
      healed++;
    }
  }
  expect(healed).toBe(60);
});

test("a block that lost more than it can fix is not healed", () => {
  const r = rng(9);
  let refused = 0;
  for (const [text, level] of [
    ["https://ryanjosephkamp.github.io/splashery/", "M"],
    ["0123456789".repeat(12), "Q"],
  ]) {
    const s = encodeSteps(text, level);
    const half = Math.floor(s.eccPerBlock / 2);
    for (let trial = 0; trial < 10; trial++) {
      const want = s.blocks.map((_, j) => (j === 0 ? half + 2 + Math.floor(r() * 4) : 0));
      const { dark } = damage(s, want, r);
      const a = analyze(s, dark);
      expect(a.blocks[0].ok).toBe(false);
      expect(a.blocks[0].lost).toBeGreaterThan(s.fixable);
      expect(a.decodes).toBe(false);
      for (let j = 1; j < a.blocks.length; j++) expect(a.blocks[j].ok).toBe(true);
      refused++;
    }
  }
  expect(refused).toBe(20);
});

test("the format information is read through up to three wrong bits", () => {
  for (const level of ["L", "M", "Q", "H"])
    for (let mask = 0; mask < 8; mask++) {
      const f = formatBits(level, mask);
      for (const flips of [0, 0b1, 0b100000001, 0b10000100000010]) {
        const n = nearestFormat(f ^ flips);
        expect([n.level, n.mask]).toEqual([level, mask]);
      }
    }
});
