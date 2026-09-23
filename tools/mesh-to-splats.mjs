#!/usr/bin/env node
// Turns a CC0 or CC BY 3D model (glTF) into a Gaussian splat PLY that
// tools/prepare-assets.mjs then packs into SOG files, like a captured toy.
//
//   node tools/mesh-to-splats.mjs              # every model in tools/models.json
//   node tools/mesh-to-splats.mjs rubber-duck  # one model
//
// For each model: downloads the glTF (Poly Haven's API for "polyhaven:<asset>"
// sources, or a direct URL), samples points on its surface evenly by area,
// takes each point's colour from the base-colour texture (times the
// material's colour factor; alpha-masked texels are skipped), and writes
// flat splats lying on the surface to .cache/models/<id>/<id>.ply.
//
// Build-time only: @gltf-transform/core (MIT), jpeg-js (BSD-3-Clause) and
// pngjs (MIT) are devDependencies; nothing here ships with the site.

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools/models.json"), "utf8"));
const only = process.argv.slice(2);
const UA = "SplasheryBuild/1.0 (https://github.com/ryanjosephkamp/splashery; build tool)";
const SH_C0 = 0.28209479177387814;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  throw new Error(`Download failed: ${url}`);
}

// Fetches a Poly Haven model's glTF with its buffers and textures.
async function fetchPolyHaven(asset, res, dir) {
  const r = await fetch(`https://api.polyhaven.com/files/${asset}`, {
    headers: { "User-Agent": UA },
  });
  if (!r.ok) throw new Error(`Poly Haven has no files for ${asset}`);
  const files = await r.json();
  const g = files.gltf?.[res] || files.gltf?.["2k"] || files.gltf?.["1k"];
  if (!g) throw new Error(`No glTF for ${asset}`);
  const gltf = g.gltf;
  const main = path.join(dir, `${asset}.gltf`);
  await download(gltf.url, main);
  for (const [rel, f] of Object.entries(gltf.include || {}))
    await download(f.url, path.join(dir, rel));
  return main;
}

function decodeImage(bytes, mime) {
  if (mime === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { w: png.width, h: png.height, data: png.data };
  }
  const img = jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { w: img.width, h: img.height, data: img.data };
}

// Bilinear texture lookup with wrapping; returns [r, g, b, a] in 0..1.
function sample(tex, u, v) {
  const x = (((u % 1) + 1) % 1) * tex.w - 0.5;
  const y = (((v % 1) + 1) % 1) * tex.h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const px = (xx, yy) => {
    const i = ((((yy % tex.h) + tex.h) % tex.h) * tex.w + (((xx % tex.w) + tex.w) % tex.w)) * 4;
    return tex.data.subarray(i, i + 4);
  };
  const a = px(x0, y0);
  const b = px(x0 + 1, y0);
  const c = px(x0, y0 + 1);
  const d = px(x0 + 1, y0 + 1);
  const out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    out[k] = ((a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy) / 255;
  }
  return out;
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function transformDir(m, n) {
  // Normals: the inverse transpose; fine to approximate with the matrix for
  // the uniform scales these models use, then renormalise.
  const v = [
    m[0] * n[0] + m[4] * n[1] + m[8] * n[2],
    m[1] * n[0] + m[5] * n[1] + m[9] * n[2],
    m[2] * n[0] + m[6] * n[1] + m[10] * n[2],
  ];
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Quaternion (w, x, y, z) turning +Z onto n, spun by `spin` about n.
function discQuat(n, spin) {
  let q;
  if (n[2] < -0.9999) q = [0, 1, 0, 0];
  else {
    const w = 1 + n[2];
    const x = -n[1];
    const y = n[0];
    const l = Math.hypot(w, x, y);
    q = [w / l, x / l, y / l, 0];
  }
  const h = spin / 2;
  const s = Math.sin(h);
  const r = [Math.cos(h), n[0] * s, n[1] * s, n[2] * s];
  // r * q in (w, x, y, z)
  return [
    r[0] * q[0] - r[1] * q[1] - r[2] * q[2] - r[3] * q[3],
    r[0] * q[1] + r[1] * q[0] + r[2] * q[3] - r[3] * q[2],
    r[0] * q[2] - r[1] * q[3] + r[2] * q[0] + r[3] * q[1],
    r[0] * q[3] + r[1] * q[2] - r[2] * q[1] + r[3] * q[0],
  ];
}

async function convert(model) {
  const dir = path.join(root, ".cache/models", model.id);
  fs.mkdirSync(dir, { recursive: true });
  let file;
  if (model.source.startsWith("polyhaven:")) {
    file = await fetchPolyHaven(model.source.slice(10), model.resolution || "2k", dir);
  } else {
    file = path.join(dir, path.basename(new URL(model.source).pathname));
    await download(model.source, file);
  }
  const io = new NodeIO();
  const doc = await io.read(file);
  const texCache = new Map();
  const tris = []; // { p: [a, b, c], n, uv, mat }
  let totalArea = 0;
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const nor = prim.getAttribute("NORMAL");
        const uv = prim.getAttribute("TEXCOORD_0");
        const idx = prim.getIndices();
        const mat = prim.getMaterial();
        // Clear glass (clock faces, lantern panes) would hide what is behind
        // it, and splats cannot be see-through glass, so it is left out.
        const skip = new RegExp(model.skipMaterials || "glass", "i");
        if (mat && skip.test(mat.getName())) continue;
        let tex = null;
        const texInfo = mat?.getBaseColorTexture();
        if (texInfo) {
          if (!texCache.has(texInfo)) {
            texCache.set(texInfo, decodeImage(texInfo.getImage(), texInfo.getMimeType()));
          }
          tex = texCache.get(texInfo);
        }
        const material = {
          tex,
          factor: mat?.getBaseColorFactor() || [1, 1, 1, 1],
          mask: mat?.getAlphaMode() === "MASK" || mat?.getAlphaMode() === "BLEND",
          cutoff: mat?.getAlphaCutoff() ?? 0.5,
        };
        const count = idx ? idx.getCount() : pos.getCount();
        const get = (i) => (idx ? idx.getScalar(i) : i);
        const P = (i) => transformPoint(m, pos.getElement(i, []));
        const N = (i) => (nor ? transformDir(m, nor.getElement(i, [])) : null);
        const U = (i) => (uv ? uv.getElement(i, []) : [0, 0]);
        for (let t = 0; t + 2 < count; t += 3) {
          const ia = get(t);
          const ib = get(t + 1);
          const ic = get(t + 2);
          const a = P(ia);
          const b = P(ib);
          const c = P(ic);
          const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const cr = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
          ];
          const area = Math.hypot(...cr) / 2;
          if (!(area > 0)) continue;
          totalArea += area;
          tris.push({
            p: [a, b, c],
            n: [N(ia), N(ib), N(ic)],
            face: cr.map((v) => v / (2 * area)),
            uv: [U(ia), U(ib), U(ic)],
            mat: material,
            cum: totalArea,
          });
        }
      }
    });
  }
  if (!tris.length) throw new Error(`${model.id}: no triangles`);
  const N = model.splats || 200000;
  const rand = mulberry32(model.seed || 1);
  const size = Math.sqrt(totalArea / (N * Math.PI)) * (model.sizeScale || 1.3);
  const props = [
    "x",
    "y",
    "z",
    "nx",
    "ny",
    "nz",
    "f_dc_0",
    "f_dc_1",
    "f_dc_2",
    "opacity",
    "scale_0",
    "scale_1",
    "scale_2",
    "rot_0",
    "rot_1",
    "rot_2",
    "rot_3",
  ];
  const data = new Float32Array(N * props.length);
  let n = 0;
  let tries = 0;
  const logit = (a) => Math.log(a / (1 - a));
  while (n < N && tries < N * 20) {
    tries++;
    const x = rand() * totalArea;
    let lo = 0;
    let hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tris[mid].cum < x) lo = mid + 1;
      else hi = mid;
    }
    const t = tris[lo];
    let r1 = rand();
    let r2 = rand();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    const w0 = 1 - r1 - r2;
    const lerp3 = (arr) => [0, 1, 2].map((k) => arr[0][k] * w0 + arr[1][k] * r1 + arr[2][k] * r2);
    const p = lerp3(t.p);
    let nn = t.n[0] ? lerp3(t.n) : t.face;
    const nl = Math.hypot(...nn) || 1;
    nn = nn.map((v) => v / nl);
    const uv = [
      t.uv[0][0] * w0 + t.uv[1][0] * r1 + t.uv[2][0] * r2,
      t.uv[0][1] * w0 + t.uv[1][1] * r1 + t.uv[2][1] * r2,
    ];
    const f = t.mat.factor;
    let col = [f[0], f[1], f[2], f[3]];
    if (t.mat.tex) {
      const c = sample(t.mat.tex, uv[0], uv[1]);
      col = [c[0] * f[0], c[1] * f[1], c[2] * f[2], c[3] * f[3]];
    }
    if (t.mat.mask && col[3] < t.mat.cutoff) continue;
    const q = discQuat(nn, rand() * Math.PI * 2);
    const s = size * Math.exp((rand() - 0.5) * 0.3);
    const row = [
      p[0],
      p[1],
      p[2],
      nn[0],
      nn[1],
      nn[2],
      (col[0] - 0.5) / SH_C0,
      (col[1] - 0.5) / SH_C0,
      (col[2] - 0.5) / SH_C0,
      logit(0.97),
      Math.log(s),
      Math.log(s * (0.85 + rand() * 0.3)),
      Math.log(s * (model.flat ?? 0.2)),
      q[0],
      q[1],
      q[2],
      q[3],
    ];
    data.set(row, n * props.length);
    n++;
  }
  const head =
    `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n` +
    props.map((p) => `property float ${p}`).join("\n") +
    "\nend_header\n";
  const out = path.join(dir, `${model.id}.ply`);
  fs.writeFileSync(
    out,
    Buffer.concat([Buffer.from(head), Buffer.from(data.buffer, 0, n * props.length * 4)]),
  );
  console.log(
    `${model.id}: ${tris.length} triangles, area ${totalArea.toFixed(3)}, ${n} splats -> ${path.relative(root, out)}`,
  );
}

for (const model of manifest.models) {
  if (only.length && !only.includes(model.id)) continue;
  await convert(model);
}
