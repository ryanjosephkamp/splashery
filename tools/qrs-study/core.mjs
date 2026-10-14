// Lane QR lab r2, the study of splat QR codes: one capture, start to end.
// A job is one code (a variable at one value, a level, a text, a trial):
// build its splats (src/qr-lab/splats.js), damage them (src/qr-lab/damage.js),
// render them on a screen with the software splat rasterizer (raster.mjs),
// then photograph that screen with each of the scan lab's phone-like
// captures (tools/qr-scan-lab/sim.mjs) and read each photo with the three
// readers (readers.mjs). For a code seen straight on, it also reads the
// modules where it knows they are and asks src/qr-lab/read.js whether every
// block's error correction can fix what was lost.
import fs from "node:fs";
import { encodeSteps } from "../../src/qr-lab/steps.js";
import { codeSplats, moduleCenter, QUIET } from "../../src/qr-lab/splats.js";
import { applyDamage, rng } from "../../src/qr-lab/damage.js";
import { sampleModules, toDark, analyze } from "../../src/qr-lab/read.js";
import { applyCondition, conditions } from "../qr-scan-lab/sim.mjs";
import { render, screenCamera, projector } from "./raster.mjs";
import { readAll, READERS } from "./readers.mjs";

// The three texts: a short one (version 2 at M), a link (version 4 at M) and
// a long text (version 10 at M).
export const TEXTS = {
  short: "Splats make a code!",
  url: "https://ryanjosephkamp.github.io/splashery/",
  long:
    "Splashery is a toy box of 3D Gaussian splats. This long text fills a larger QR code, " +
    "version 10 at level M, so the study sees how a dense code of splats holds up under damage.",
};
export const LEVELS = ["L", "M", "Q", "H"];

// The scan lab's captures the study uses: straight on (no noise), and its
// two combined phone-like recipes ("phone": 5 px per module, 20° yaw, blur,
// JPEG 50, noise, uneven light; "hard": 4 px, 30°, more of each).
export const CONDITIONS = conditions().filter((c) => ["front", "phone", "hard"].includes(c.id));
export const condById = (id) => CONDITIONS.find((c) => c.id === id);

export const SCREEN_PPM = 8; // pixels per module on the screen the phone photographs

const stepsCache = new Map();
export function stepsFor(text, level) {
  const key = `${level}:${text}`;
  if (!stepsCache.has(key)) stepsCache.set(key, encodeSteps(text, level));
  return stepsCache.get(key);
}

// ---- Colors -----------------------------------------------------------------------------
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const relLum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function wcag(a, b) {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const W709 = [0.2126, 0.7152, 0.0722];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// The QR toy's Alive wave (src/qr/field.js): a module's color moves toward
// the wave color at the same Rec. 709 gray, by up to 85%, in a wave that
// rolls across the code: wave = 0.5 + 0.5 sin(2π·phase − 5(gx + gy)).
export function aliveColor(c, waveColor, col, row, N, phase) {
  const gx = col / Math.max(N - 1, 1);
  const gy = row / Math.max(N - 1, 1);
  const w = 0.5 + 0.5 * Math.sin(2 * Math.PI * phase - (gx + gy) * 5);
  const k = dot(c, W709) / Math.max(dot(waveColor, W709), 0.02);
  const same = waveColor.map((v) => Math.min(1, Math.max(0, v * k)));
  return mix(c, same, w * 0.85);
}

// ---- One job ----------------------------------------------------------------------------

// spec: what the variable sets, from variables.mjs:
//   { opts (codeSplats options), damages ([...]), view { yaw, pitch, dist },
//     recolor (s, steps) => color, transform (splats, steps) => splats,
//     frontOn (whether module positions are known) }
export function buildSplats(steps, spec, trial) {
  const opts = { ...(spec.opts || {}) };
  let splats = codeSplats(steps.modules, steps.size, opts);
  if (spec.recolor) for (const s of splats) if (s.mod >= 0 && s.dark) s.color = spec.recolor(s, steps); // prettier-ignore
  if (spec.damages && spec.damages.length) {
    const ds = spec.damages.map((d) => ({ ...d, seed: (d.seed ?? 0) + 1 + trial * 13 }));
    splats = applyDamage(splats, ds, { size: steps.size }).splats;
  }
  if (spec.transform) splats = spec.transform(splats, steps);
  return splats;
}

// The camera and the screen picture for a job.
export function screenShot(steps, spec, trial) {
  const quiet = spec.opts?.quiet ?? QUIET;
  // The screen shows the code, its quiet zone and a margin of the app's dark
  // background (a tenth of the code's width on each side, so a turned code
  // stays in the frame).
  const tall = Math.round((steps.size + 2 * quiet) * (spec.frame ?? 1.2));
  const aspect = spec.aspect ?? 1;
  const r = rng(trial * 7919 + 3);
  const offset = [r() - 0.5, r() - 0.5];
  const view = spec.view || {};
  const cam = screenCamera(tall, { ppm: SCREEN_PPM, yaw: view.yaw || 0, pitch: view.pitch || 0, dist: view.dist || 1, offset, depth: (3 * (steps.size + 2 * quiet)) / tall, aspect }); // prettier-ignore
  const splats = buildSplats(steps, spec, trial);
  // wide: the frame's width in modules (what the captures scale by).
  return { img: render(splats, cam, { backdrop: spec.backdrop }), cam, wide: tall * aspect };
}

// Where the scan lab's capture() puts a point of the screen picture (in
// pixel-edge coordinates) in its photo: the same pinhole model, run forward.
export function captureMapper(screenW, modules, c, screenH = screenW) {
  const codePx = Math.round(modules * c.modulePx);
  const srcW = Math.max(8, codePx);
  const W = Math.round(codePx * (1 + 0.25 * 2));
  const f = 1000;
  const k = codePx / srcW;
  const d = f / k;
  const rad = (x) => (x * Math.PI) / 180;
  const [cy, sy] = [Math.cos(rad(c.yaw)), Math.sin(rad(c.yaw))];
  const [cp, sp] = [Math.cos(rad(c.pitch)), Math.sin(rad(c.pitch))];
  const [cr, sr] = [Math.cos(rad(c.roll)), Math.sin(rad(c.roll))];
  const mul = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, _v, t) => s + A[i][t] * B[t][j], 0))); // prettier-ignore
  const R = mul(
    mul(
      [
        [cy, 0, sy],
        [0, 1, 0],
        [-sy, 0, cy],
      ],
      [
        [1, 0, 0],
        [0, cp, -sp],
        [0, sp, cp],
      ],
    ),
    [
      [cr, -sr, 0],
      [sr, cr, 0],
      [0, 0, 1],
    ],
  );
  const s = srcW / screenW;
  const srcH = Math.max(1, Math.round((screenH * srcW) / screenW));
  return (U, V) => {
    const q = [U * s - srcW / 2, V * s - srcH / 2, 0];
    const P = [0, 1, 2].map((i) => R[i][0] * q[0] + R[i][1] * q[1]);
    const z = P[2] + d;
    return [(P[0] / z) * f + W / 2, (P[1] / z) * f + W / 2];
  };
}

// Reads the modules of a photo where we know they are, and analyzes them.
function blockVerdict(photo, steps, cam, wide, c) {
  const prj = projector(cam);
  const map = captureMapper(cam.width, wide, c, cam.height);
  const toPixel = (row, col) => {
    const [u, v] = prj(moduleCenter(steps.size, row, col));
    return map(u, v);
  };
  const samples = sampleModules(photo, steps.size, toPixel, Math.max(0.5, 0.3 * c.modulePx));
  const a = analyze(steps, toDark(samples));
  return {
    blocks: a.decodes ? 1 : 0,
    wrong: a.wrong.length,
    lostMax: Math.max(...a.blocks.map((b) => b.lost)),
    finders: a.finders.reduce((x, y) => x + y, 0),
    format: a.format.ok ? 1 : 0,
  };
}

// Runs one job: { variable, value, x, level, text, trial, conds, spec }.
// Returns one row per capture condition.
export async function runJob(job, spec) {
  const text = TEXTS[job.text] ?? job.text;
  const steps = stepsFor(text, job.level);
  const t0 = performance.now();
  const { img, cam, wide } = screenShot(steps, spec, job.trial);
  const rows = [];
  for (const cid of job.conds) {
    const c = condById(cid);
    const photo = applyCondition(img, wide, c, 7 + job.trial * 101 + cid.length);
    const got = await readAll(photo);
    const row = {
      variable: job.variable,
      value: job.value,
      x: job.x,
      level: job.level,
      text: job.text,
      version: steps.version,
      trial: job.trial,
      cond: cid,
    };
    for (const r of READERS) row[r] = got[r] === text ? 1 : 0;
    const v = spec.frontOn ? blockVerdict(photo, steps, cam, wide, c) : null;
    row.blocks = v ? v.blocks : "";
    row.wrong = v ? v.wrong : "";
    row.lostMax = v ? v.lostMax : "";
    row.fixable = steps.fixable;
    row.finders = v ? v.finders : "";
    row.format = v ? v.format : "";
    rows.push(row);
  }
  const ms = (performance.now() - t0) / rows.length;
  rows.forEach((r) => (r.ms = Math.round(ms)));
  return rows;
}

// ---- Statistics -------------------------------------------------------------------------

// Wilson score interval (95%) for k successes in n.
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// Where a sweep (points [{ x, rate }] in sweep order, from the easy end)
// first falls below `level`: linear interpolation between the last point at
// or above it and the first below. Returns { x, kind }: kind "crossed",
// "never" (it never fell below), or "start" (already below at the first).
export function crossing(points, level) {
  if (!points.length) return { x: null, kind: "none" };
  if (points[0].rate < level) return { x: points[0].x, kind: "start" };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.rate < level) {
      const t = (a.rate - level) / (a.rate - b.rate || 1);
      return { x: a.x + (b.x - a.x) * t, kind: "crossed" };
    }
  }
  return { x: null, kind: "never" };
}

// Writes a JSON or HTML file formatted as the repository's Prettier does, so
// `npx prettier --check .` stays clean after a run.
export async function writePretty(file, text) {
  const prettier = await import("prettier");
  const options = (await prettier.resolveConfig(file)) || {};
  fs.writeFileSync(file, await prettier.format(text, { ...options, filepath: file }));
}

export const toCSV = (rows, cols) =>
  [cols.join(",")]
    .concat(
      rows.map((r) =>
        cols
          .map((c) =>
            typeof r[c] === "string" && /[",]/.test(r[c])
              ? `"${r[c].replace(/"/g, '""')}"`
              : (r[c] ?? ""),
          )
          .join(","),
      ),
    ) // prettier-ignore
    .join("\n") + "\n";
