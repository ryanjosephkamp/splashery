// The element facts behind the chemistry toys' atoms (lane Chemistry): each
// element's protons, neutrons and electrons, where the nucleons sit in a
// packed nucleus, and the order the electrons fill their shells in. The
// numbers come from src/chem/periodic.js (NIST, PubChem and IUPAC; see
// tools/chs-data.mjs).

import { PERIODIC } from "./periodic.js";

export const ELEMENT_LIST = PERIODIC.map(
  ([z, symbol, name, A, abundant, family, shells, config, line, spectrum, color]) =>
    Object.freeze({
      z,
      symbol,
      name,
      A,
      abundant: !!abundant,
      family,
      shells: Object.freeze(shells.slice()),
      config,
      line: line || null,
      spectrum: spectrum || null,
      lineColor: color || null,
      protons: z,
      neutrons: A - z,
      electrons: z,
    }),
);

const BY_SYMBOL = new Map(ELEMENT_LIST.map((e) => [e.symbol, e]));

export const elementOf = (symbol) => BY_SYMBOL.get(symbol) || null;

// The subshells of a configuration such as "[Ar] 3d10 4s2 4p": [n, l, count]
// (l as 0 s, 1 p, 2 d, 3 f), with a noble-gas core written out.
const L = { s: 0, p: 1, d: 2, f: 3, g: 4 };
export function subshells(config) {
  const out = [];
  const core = config.match(/\[([A-Z][a-z]?)\]/);
  if (core) out.push(...subshells(elementOf(core[1]).config));
  for (const [, n, l, k] of config.replace(/\[[A-Za-z]+\]/, "").matchAll(/(\d)([spdfg])(\d*)/g))
    out.push([Number(n), L[l], k ? Number(k) : 1]);
  return out;
}

// The shell (n - 1) of each electron in the order they fill: subshells by
// the Madelung rule (lowest n + l first, then lowest n), as the atom builds
// itself. The counts are the element's real ground state.
export function fillOrder(el) {
  const subs = subshells(el.config).sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
  const out = [];
  for (const [n, , k] of subs) for (let i = 0; i < k; i++) out.push(n - 1);
  return out;
}

// A small seeded random number generator (the same atom every time).
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A packed nucleus: A touching balls of radius rb, on the face-centered
// cubic points nearest the middle (the densest packing, as nucleons pack),
// centered, in the order they sit outward from the middle. `proton[i]` says
// which are protons: Z of them, mixed evenly through the nucleus.
export function packNucleus(A, Z, rb = 1) {
  const a = rb * 2 * Math.SQRT2;
  const m = Math.ceil(Math.cbrt(A)) + 2;
  const pts = [];
  for (let i = -m; i <= m; i++)
    for (let j = -m; j <= m; j++)
      for (let l = -m; l <= m; l++) {
        if ((i + j + l) & 1) continue;
        const p = [(i * a) / 2, (j * a) / 2, (l * a) / 2];
        // Ties (points the same distance out) break by a fixed spiral.
        const d = Math.hypot(...p) + 1e-6 * ((i * 7 + j * 13 + l * 29 + 1000) % 97);
        pts.push({ p, d });
      }
  pts.sort((x, y) => x.d - y.d);
  const out = pts.slice(0, A).map((x) => x.p);
  const c = [0, 1, 2].map((k) => out.reduce((s, p) => s + p[k], 0) / A);
  const balls = out.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
  // Z protons mixed through: every ball in turn gets its fair share of
  // protons, with a shuffle so no pattern shows.
  const rand = seeded(A * 131 + Z);
  const proton = balls.map(() => false);
  const order = balls.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < Z; i++) proton[order[i]] = true;
  const radius = balls.reduce((r, p) => Math.max(r, Math.hypot(...p)), 0) + rb;
  return { balls, proton, radius };
}
