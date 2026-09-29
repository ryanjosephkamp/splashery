#!/usr/bin/env node
// A still pair for judging the "Model to splats" toy's fidelity (lane Studio Models): the model's
// own triangles (left) and the splats made from it (right), from the same view, drawn by a small
// software renderer here (a test renderer, not the live one). Usage:
//   node tools/stm-compare.mjs <model> <out.png> [--splats N] [--yaw 0.6] [--pitch 0.3] [--size 480]
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { parseModel, prepareModel, sampleSurface, sampleMip, linearToSrgb } from "../src/packs/studio-models-core.js"; // prettier-ignore

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const [file, out] = args.filter(
  (a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"),
);
const N = opt("splats", 200000);
const yaw = opt("yaw", 0.6);
const pitch = opt("pitch", 0.3);
const S = opt("size", 480);
const decodeImage = (b, mime) => {
  if (mime === "image/png" || b[0] === 0x89) {
    const p = PNG.sync.read(Buffer.from(b));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const j = jpeg.decode(Buffer.from(b), { useTArray: true });
  return { w: j.width, h: j.height, data: j.data };
};
const dir = path.dirname(path.resolve(file));
const files = {};
for (const sub of ["", "textures", "Textures"]) {
  const d = path.join(dir, sub);
  if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (fs.statSync(path.join(d, f)).isFile()) files[f] = new Uint8Array(fs.readFileSync(path.join(d, f))); // prettier-ignore
}
const prep = await prepareModel(parseModel(new Uint8Array(fs.readFileSync(file)), path.basename(file), { files }), { decodeImage }); // prettier-ignore
const s = sampleSurface(prep, N, { up: "y" });
const BG = 0.94;
const cy = Math.cos(yaw),
  sy = Math.sin(yaw),
  cp = Math.cos(pitch),
  sp = Math.sin(pitch);
const view = (x, y, z) => {
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
};
const sc = S * 0.46;
const png = new PNG({ width: S * 2 + 10, height: S });
png.data.fill(255);
const put = (ox, buf) => {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      for (let k = 0; k < 3; k++) png.data[(y * png.width + ox + x) * 4 + k] = Math.round(Math.min(1, buf[(y * S + x) * 3 + k]) * 255); // prettier-ignore
};
// The model's triangles (same scale and place as the splats: radius 1, upright, centered).
{
  const { min, max } = prep.bbox;
  const c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  const r = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const buf = new Float32Array(S * S * 3).fill(BG);
  const zb = new Float32Array(S * S).fill(-1e9);
  const px = [0, 0, 0, 0];
  const L = [-0.35, 0.8, 0.5];
  const ll = Math.hypot(...L);
  for (let t = 0; t < prep.nt; t++) {
    const v = [0, 1, 2].map((k) => {
      const i = prep.tri[t * 3 + k] * 3;
      const p = view(
        (prep.pos[i] - c[0]) / r,
        (prep.pos[i + 1] - c[1]) / r,
        (prep.pos[i + 2] - c[2]) / r,
      );
      return [S / 2 + p[0] * sc, S / 2 - p[1] * sc, p[2]];
    });
    const M = prep.materials[prep.mat[t]];
    const x0 = Math.max(0, Math.floor(Math.min(v[0][0], v[1][0], v[2][0])));
    const x1 = Math.min(S - 1, Math.ceil(Math.max(v[0][0], v[1][0], v[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(v[0][1], v[1][1], v[2][1])));
    const y1 = Math.min(S - 1, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1])));
    const den =
      (v[1][1] - v[2][1]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][1] - v[2][1]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const a =
          ((v[1][1] - v[2][1]) * (x + 0.5 - v[2][0]) + (v[2][0] - v[1][0]) * (y + 0.5 - v[2][1])) /
          den;
        const b =
          ((v[2][1] - v[0][1]) * (x + 0.5 - v[2][0]) + (v[0][0] - v[2][0]) * (y + 0.5 - v[2][1])) /
          den;
        const g = 1 - a - b;
        if (a < -0.001 || b < -0.001 || g < -0.001) continue;
        const z = a * v[0][2] + b * v[1][2] + g * v[2][2];
        if (z <= zb[y * S + x]) continue;
        zb[y * S + x] = z;
        let col = [...M.rgb];
        if (M.mip && prep.uv) {
          const i0 = prep.tri[t * 3], i1 = prep.tri[t * 3 + 1], i2 = prep.tri[t * 3 + 2]; // prettier-ignore
          const u = prep.uv[i0 * 2] * a + prep.uv[i1 * 2] * b + prep.uv[i2 * 2] * g;
          const w = prep.uv[i0 * 2 + 1] * a + prep.uv[i1 * 2 + 1] * b + prep.uv[i2 * 2 + 1] * g;
          const texels = prep.uvd[t] * (r / sc) * Math.sqrt(M.mip.w * M.mip.h);
          sampleMip(M.mip, u, w, Math.log2(Math.max(1, texels)), M.wrapS, M.wrapT, px, M.nearest);
          col = [col[0] * px[0], col[1] * px[1], col[2] * px[2]];
        }
        const cn = prep.cn;
        const n = [0, 1, 2].map(
          (k) => cn[t * 9 + k] * a + cn[t * 9 + 3 + k] * b + cn[t * 9 + 6 + k] * g,
        );
        const nl = Math.hypot(...n) || 1;
        const f = 1 - 0.22 + 0.22 * (0.5 + 0.5 * ((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * ll))) + 0.022; // prettier-ignore
        for (let k = 0; k < 3; k++) buf[(y * S + x) * 3 + k] = col[k] * f;
      }
  }
  put(0, buf);
}
// The splats, each a disc that falls off as exp(-r²/σ²) (the live renderer's look), far to near.
{
  const buf = new Float32Array(S * S * 3).fill(BG);
  const ord = Array.from({ length: s.n }, (_, i) => i);
  const V = ord.map((i) => view(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]));
  ord.sort((a, b) => V[a][2] - V[b][2]);
  for (const i of ord) {
    const px = S / 2 + V[i][0] * sc;
    const py = S / 2 - V[i][1] * sc;
    const sg = s.sigma[i] * sc;
    const nv = view(s.nrm[i * 3], s.nrm[i * 3 + 1], s.nrm[i * 3 + 2]);
    const squash = Math.max(0.12, Math.abs(nv[2])); // a disc seen edge-on is thin
    const rad = sg * 2;
    for (let y = Math.max(0, Math.floor(py - rad)); y <= Math.min(S - 1, Math.ceil(py + rad)); y++)
      for (
        let x = Math.max(0, Math.floor(px - rad));
        x <= Math.min(S - 1, Math.ceil(px + rad));
        x++
      ) {
        const dx = x + 0.5 - px, dy = y + 0.5 - py; // prettier-ignore
        // Along the screen direction the normal leans, the disc is squashed by |nz|.
        const nl = Math.hypot(nv[0], nv[1]) || 1;
        const along = (dx * nv[0] + dy * -nv[1]) / nl;
        const across = (dx * nv[1] + dy * nv[0]) / nl;
        const d2 = (along / squash) ** 2 + across ** 2;
        const al = 0.97 * Math.exp(-d2 / (sg * sg));
        if (al < 0.01) continue;
        for (let k = 0; k < 3; k++) {
          const o = (y * S + x) * 3 + k;
          buf[o] = buf[o] * (1 - al) + s.rgb[i * 3 + k] * al;
        }
      }
  }
  put(S + 10, buf);
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(png));
console.log(`${prep.name}: ${prep.triangles} triangles (left) and ${s.n} splats (right) -> ${out}`);
