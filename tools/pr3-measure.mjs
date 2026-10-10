#!/usr/bin/env node
// Lane Photoreal r3: a captured toy's splats in world coordinates (the frame src/rigs.js places
// regions and add-ons in), for closing bases and placing parts.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   npx splat-transform assets/toys/<id>/<id>.sog .cache/pr3/<id>.ply
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pr3-measure.mjs [--out=.cache/pr3] id ...
//
// Writes <out>/<id>-world.json: the toy's model-to-world matrix (column-major) and its world box.
// With the PLY above, also <out>/<id>-world.bin: per splat x, y, z, r, g, b, opacity, size and
// stretch (float32: world coordinates, colors 0..1 from the base band, opacity after the sigmoid,
// the longest axis in world units, longest over middle axis), so node scripts can map the
// underside.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const ids = args.filter((a) => !a.startsWith("--"));
const out = opt("out", ".cache/pr3");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
await page.goto(`${base}?labs=1&renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

function readPly(file) {
  const buf = fs.readFileSync(file);
  const end = buf.indexOf("end_header\n") + 11;
  const head = buf.subarray(0, end).toString();
  const count = Number(/element vertex (\d+)/.exec(head)[1]);
  const props = [...head.matchAll(/property float (\w+)/g)].map((m) => m[1]);
  const f = new Float32Array(buf.buffer.slice(buf.byteOffset + end, buf.byteOffset + end + count * props.length * 4)); // prettier-ignore
  const col = (n) => {
    const k = props.indexOf(n);
    return (i) => f[i * props.length + k];
  };
  return { count, col };
}

for (const id of ids) {
  const m = await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    for (let t = 0; player.loading && t < 240; t++) await new Promise((r) => setTimeout(r, 250));
    await new Promise((r) => setTimeout(r, 500));
    return Array.from(player.stage.toy.entity.getWorldTransform().data);
  }, id);
  const tf = (x, y, z) => [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
  const meta = { id, matrix: m };
  const ply = path.join(out, `${id}.ply`);
  if (fs.existsSync(ply)) {
    const p = readPly(ply);
    const [px, py, pz, po] = ["x", "y", "z", "opacity"].map(p.col);
    const dc = ["f_dc_0", "f_dc_1", "f_dc_2"].map(p.col);
    const sc = ["scale_0", "scale_1", "scale_2"].map(p.col);
    const unit = Math.hypot(m[0], m[1], m[2]);
    const bin = new Float32Array(p.count * 9);
    const lo = [1e9, 1e9, 1e9];
    const hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < p.count; i++) {
      const w = tf(px(i), py(i), pz(i));
      const o = 1 / (1 + Math.exp(-po(i)));
      const ax = sc.map((f) => Math.exp(f(i))).sort((a, b) => b - a);
      bin.set([...w, ...dc.map((d) => Math.min(1, Math.max(0, 0.5 + 0.28209479 * d(i)))), o, ax[0] * unit, ax[0] / Math.max(ax[1], 1e-9)], i * 9); // prettier-ignore
      if (o > 0.3) for (let k = 0; k < 3; k++) ((lo[k] = Math.min(lo[k], w[k])), (hi[k] = Math.max(hi[k], w[k]))); // prettier-ignore
    }
    fs.writeFileSync(path.join(out, `${id}-world.bin`), Buffer.from(bin.buffer));
    Object.assign(meta, { count: p.count, lo, hi });
  }
  fs.writeFileSync(path.join(out, `${id}-world.json`), JSON.stringify(meta));
  console.log(id, JSON.stringify({ lo: meta.lo?.map((v) => +v.toFixed(3)), hi: meta.hi?.map((v) => +v.toFixed(3)) })); // prettier-ignore
}
await browser.close();
