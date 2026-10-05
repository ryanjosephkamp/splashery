// Lane QR lab r2, the study of splat QR codes: "Do codes have to be
// square?" (item 4), part one: shapes made from a square QR code. Each shape
// is the same code (the link, levels M and H) built from splats and changed
// one way (rounded or dotted modules, round finders, framed in a circle,
// clipped by a circle, decoy modules around it, a thinner quiet zone,
// stretched, turned), rendered and photographed as in the sweeps, and read
// by the three readers. Writes shapes.csv and a picture of each shape in
// shapes/.
import fs from "node:fs";
import path from "node:path";
import { codeSplats } from "../../src/qr-lab/splats.js";
import { ROLE } from "../../src/qr-lab/steps.js";
import { rng } from "../../src/qr-lab/damage.js";
import { applyCondition } from "../qr-scan-lab/sim.mjs";
import { screenShot, stepsFor, TEXTS, CONDITIONS, toCSV, wilson } from "./core.mjs";
import { readAll, READERS } from "./readers.mjs";
import { toPNG } from "./raster.mjs";
import { resize } from "../qr-scan-lab/sim.mjs";

const FG = [0.07, 0.08, 0.1];
const WHITE = [1, 1, 1];
const RING = [0.11, 0.31, 0.61];
const QF = [0, 0, 0, 1];

// A disk (or ring) of flat splats: points on a lattice of `sp` inside
// keep(x, y), at depth z.
function fill(box, sp, keep, color, z) {
  const out = [];
  const [x0, y0, x1, y1] = box;
  for (let layer = 0; layer < 2; layer++)
    for (let y = y0 + sp * (0.5 + layer * 0.5); y < y1; y += sp)
      for (let x = x0 + sp * (0.5 + layer * 0.5); x < x1; x += sp)
        if (keep(x, y)) out.push({ p: [x, y, z], scales: [0.55 * sp, 0.55 * sp, 0.01 * sp], quat: QF, color, opacity: 1, mod: -3, dark: 0 }); // prettier-ignore
  return out;
}
const half = (steps, q = 4) => steps.size / 2 + q;
const isEye = (steps) => (s) => s.mod >= 0 && steps.role[s.mod] === ROLE.finder;
const finderCenters = (N) => [
  [-N / 2 + 3.5, N / 2 - 3.5],
  [N / 2 - 3.5, N / 2 - 3.5],
  [-N / 2 + 3.5, -N / 2 + 3.5],
];

// Decoy modules: a random half of the module cells between the square
// `inner` (half-width) and a circle of radius R, dark.
function decoys(steps, inner, R, seed) {
  const r = rng(seed);
  const out = [];
  const lim = Math.ceil(R);
  for (let gy = -lim; gy < lim; gy++)
    for (let gx = -lim; gx < lim; gx++) {
      // On the code's own module grid (centers on whole numbers for an odd size).
      const cx = gx + (steps.size % 2 ? 0 : 0.5);
      const cy = gy + (steps.size % 2 ? 0 : 0.5);
      if (Math.max(Math.abs(cx), Math.abs(cy)) < inner + 0.5) continue;
      if (Math.hypot(cx, cy) > R - 0.6) continue;
      if (r() < 0.5) continue;
      out.push(...fill([cx - 0.5, cy - 0.5, cx + 0.5, cy + 0.5], 1 / 3, () => true, FG, 0.01));
    }
  return out;
}

export const SHAPES = [
  { id: "square", label: "Square modules (the baseline)", spec: () => ({}) },
  {
    id: "rounded",
    label: "Rounded modules",
    spec: () => ({ opts: { shape: "rounded", gap: 0.1 } }),
  },
  { id: "dots", label: "Dots, finders too", spec: () => ({ opts: { shape: "dot", gap: 0.15 } }) },
  {
    id: "dots-eyes",
    label: "Dots, solid square finders",
    spec: () => ({
      opts: { shape: "dot", gap: 0.15 },
      transform: (sp, steps) => {
        const plain = codeSplats(steps.modules, steps.size, {});
        return sp.filter((s) => !isEye(steps)(s)).concat(plain.filter(isEye(steps)));
      },
    }),
  },
  {
    id: "round-eyes",
    label: "Round finders (rings and a disk)",
    spec: () => ({
      transform: (sp, steps) => {
        const keep = sp.filter((s) => !isEye(steps)(s));
        for (const [fx, fy] of finderCenters(steps.size)) {
          const ring = (x, y) => {
            const d = Math.hypot(x - fx, y - fy);
            return (d <= 3.5 && d >= 2.5) || d <= 1.5;
          };
          keep.push(...fill([fx - 3.5, fy - 3.5, fx + 3.5, fy + 3.5], 1 / 3, ring, FG, 0.01));
        }
        return keep;
      },
    }),
  },
  {
    id: "circle-frame",
    label: "Framed in a circle (quiet zone kept)",
    spec: () => ({
      frame: 1.75,
      transform: (sp, steps) => {
        const R = half(steps) * Math.SQRT2 + 0.6;
        const disk = fill([-R - 2, -R - 2, R + 2, R + 2], 0.5, (x, y) => Math.hypot(x, y) <= R, WHITE, -0.05); // prettier-ignore
        const ring = fill([-R - 2, -R - 2, R + 2, R + 2], 0.5, (x, y) => Math.hypot(x, y) > R && Math.hypot(x, y) <= R + 1.5, RING, -0.05); // prettier-ignore
        return sp.concat(disk, ring);
      },
    }),
  },
  {
    id: "circle-tight",
    label: "Cut to a circle through the code's corners",
    spec: () => ({
      transform: (sp, steps) => sp.filter((s) => Math.hypot(s.p[0], s.p[1]) <= (steps.size / 2) * Math.SQRT2 + 0.3), // prettier-ignore
    }),
  },
  {
    id: "circle-clip",
    label: "Cut to a circle inside the code (finders cut)",
    spec: () => ({
      transform: (sp, steps) => sp.filter((s) => Math.hypot(s.p[0], s.p[1]) <= steps.size / 2 + 1), // prettier-ignore
    }),
  },
  {
    id: "decoys-4",
    label: "Circle of decoy modules, 4-module quiet zone",
    spec: () => ({
      frame: 1.75,
      transform: (sp, steps) => {
        const R = half(steps) * Math.SQRT2 + 3;
        const disk = fill([-R - 1, -R - 1, R + 1, R + 1], 0.5, (x, y) => Math.hypot(x, y) <= R, WHITE, -0.05); // prettier-ignore
        return sp.concat(disk, decoys(steps, half(steps), R - 1, 5));
      },
    }),
  },
  {
    id: "decoys-1",
    label: "Circle of decoy modules, 1-module quiet zone",
    spec: () => ({
      frame: 1.75,
      transform: (sp, steps) => {
        const R = half(steps) * Math.SQRT2 + 3;
        const disk = fill([-R - 1, -R - 1, R + 1, R + 1], 0.5, (x, y) => Math.hypot(x, y) <= R, WHITE, -0.05); // prettier-ignore
        return sp.concat(disk, decoys(steps, steps.size / 2 + 1, R - 1, 5));
      },
    }),
  },
  { id: "quiet-2", label: "Quiet zone of 2 modules", spec: () => ({ opts: { quiet: 2 } }) },
  { id: "quiet-1", label: "Quiet zone of 1 module", spec: () => ({ opts: { quiet: 1 } }) },
  { id: "quiet-0", label: "No quiet zone (on the dark screen)", spec: () => ({ opts: { quiet: 0 } }) }, // prettier-ignore
  {
    id: "quiet-0-white",
    label: "No quiet zone, on a white screen",
    spec: () => ({ opts: { quiet: 0 }, backdrop: [255, 255, 255] }),
  },
  {
    id: "quiet-pattern",
    label: "Quiet zone filled with a pattern",
    spec: () => ({
      transform: (sp, steps) => sp.concat(decoys(steps, steps.size / 2, half(steps) * 1.5, 9).filter((s) => Math.max(Math.abs(s.p[0]), Math.abs(s.p[1])) < half(steps))), // prettier-ignore
    }),
  },
  {
    id: "stretch-2x1",
    label: "Stretched 2:1 sideways",
    spec: () => ({
      aspect: 2,
      transform: (sp) => sp.map((s) => ({ ...s, p: [s.p[0] * 2, s.p[1], s.p[2]], scales: [s.scales[0] * 2, s.scales[1], s.scales[2]] })), // prettier-ignore
    }),
  },
  {
    id: "turn-45",
    label: "Turned 45° (a diamond)",
    spec: () => ({
      frame: 1.6,
      transform: (sp) => {
        const c = Math.SQRT1_2;
        const q = [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];
        return sp.map((s) => ({ ...s, p: [c * s.p[0] - c * s.p[1], c * s.p[0] + c * s.p[1], s.p[2]], quat: q })); // prettier-ignore
      },
    }),
  },
];

export async function runShapes(out, { trials = 5, levels = ["M", "H"], text = "url" } = {}) {
  const dir = path.join(out, "shapes");
  fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  const t0 = Date.now();
  for (const sh of SHAPES)
    for (const level of levels) {
      const steps = stepsFor(TEXTS[text], level);
      for (let trial = 0; trial < trials; trial++) {
        const spec = sh.spec();
        const { img, wide } = screenShot(steps, spec, trial);
        if (trial === 0 && level === "M") fs.writeFileSync(path.join(dir, `${sh.id}.png`), toPNG(resize(img, Math.min(img.width, 280)))); // prettier-ignore
        for (const c of CONDITIONS) {
          const photo = applyCondition(img, wide, c, 7 + trial * 101 + c.id.length);
          const got = await readAll(photo);
          const row = { shape: sh.id, level, version: steps.version, trial, cond: c.id };
          for (const r of READERS) row[r] = got[r] === TEXTS[text] ? 1 : 0;
          rows.push(row);
        }
      }
    }
  fs.writeFileSync(path.join(out, "shapes-raw.csv"), toCSV(rows, ["shape", "level", "version", "trial", "cond", ...READERS])); // prettier-ignore
  // Summary: per shape, level and capture, each reader's reads out of n.
  const sum = [];
  for (const sh of SHAPES)
    for (const level of levels)
      for (const c of CONDITIONS) {
        const rs = rows.filter((r) => r.shape === sh.id && r.level === level && r.cond === c.id);
        const row = { shape: sh.id, label: sh.label, level, cond: c.id, n: rs.length };
        for (const r of READERS) {
          const k = rs.reduce((s, x) => s + x[r], 0);
          const [lo, hi] = wilson(k, rs.length);
          row[r] = k;
          row[`${r}_ci`] = `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
        }
        sum.push(row);
      }
  fs.writeFileSync(path.join(out, "shapes.csv"), toCSV(sum, ["shape", "label", "level", "cond", "n", ...READERS.flatMap((r) => [r, `${r}_ci`])])); // prettier-ignore
  console.log(`shapes: ${rows.length} captures in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return sum;
}
