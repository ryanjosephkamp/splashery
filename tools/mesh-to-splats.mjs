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
// Textures are read through a mip chain at the level that matches a splat's
// footprint, so a splat gets the average colour of the texels it covers rather
// than one random texel (that aliasing made busy textures look grainy).
//
// Options per model in tools/models.json (all optional):
//   splats, seed, sizeScale, flat   count, random seed, splat size and thickness
//   skipMaterials   regex of material names to leave out (default "glass")
//   darkGlass       regex of material names drawn as dark glass (camera lenses)
//   light           bake soft studio light into the colours: {} for the
//                   defaults, or { ambient, key, dir: [x, y, z] }. Splats are
//                   unlit, so without it a mesh looks flat; with it the shape
//                   and (with normalMap) the carved or embossed detail read.
//   normalMap       true: use the material's normal map for the baked light
//   armAO           true: the metallic-roughness texture is Poly Haven's
//                   "arm" pack, whose red channel is ambient occlusion
//   exposure, gamma tone the final colour (exposure multiplies linear light)
//   paintOut        [{ image, uv: [u0, v0, u1, v1], color: [r, g, b] }]: paint
//                   the light, grey texels in a UV box of one texture (the
//                   image file name contains `image`) with a colour, to hide
//                   brand names printed on a model.
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

// Paints the light, unsaturated texels (printed lettering) in a UV box.
function paintOut(img, { uv, color }) {
  const [u0, v0, u1, v1] = uv;
  for (let y = Math.floor(v0 * img.h); y < Math.ceil(v1 * img.h); y++) {
    for (let x = Math.floor(u0 * img.w); x < Math.ceil(u1 * img.w); x++) {
      const i = (y * img.w + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      const hi = Math.max(r, g, b);
      if (hi > 70 && hi - Math.min(r, g, b) < 60) {
        img.data[i] = color[0] * 255;
        img.data[i + 1] = color[1] * 255;
        img.data[i + 2] = color[2] * 255;
      }
    }
  }
}

// A box-filtered mip chain: levels[0] is the image itself.
function mipChain(img) {
  const levels = [img];
  let cur = img;
  while (cur.w > 1 || cur.h > 1) {
    const w = Math.max(1, cur.w >> 1);
    const h = Math.max(1, cur.h >> 1);
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let k = 0; k < 4; k++) {
          let sum = 0;
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const sx = Math.min(cur.w - 1, x * 2 + dx);
              const sy = Math.min(cur.h - 1, y * 2 + dy);
              sum += cur.data[(sy * cur.w + sx) * 4 + k];
            }
          }
          data[(y * w + x) * 4 + k] = (sum + 2) >> 2;
        }
      }
    }
    cur = { w, h, data };
    levels.push(cur);
  }
  return { w: img.w, h: img.h, levels };
}

// Trilinear lookup: `texels` is how many level-0 texels the splat spans.
function sampleMip(tex, u, v, texels) {
  const lod = Math.min(tex.levels.length - 1, Math.max(0, Math.log2(Math.max(1, texels))));
  const l0 = Math.floor(lod);
  const a = sample(tex.levels[l0], u, v);
  if (l0 === lod || l0 + 1 >= tex.levels.length) return a;
  const b = sample(tex.levels[l0 + 1], u, v);
  const f = lod - l0;
  return a.map((x, k) => x * (1 - f) + b[k] * f);
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Soft studio light baked into a colour: a sky/ground ambient, a key light
// from above and in front, and for polished metal a brighter top and a
// highlight. `col` is sRGB; so is the result.
function bakeLight(col, n, { metal = 0, rough = 1, ao = 1 }, light, model) {
  const ambient = light.ambient ?? 0.42;
  const key = light.key ?? 0.62;
  const L = norm(light.dir || [-0.35, 0.85, 0.45]);
  const up = n[1] * 0.5 + 0.5;
  const nl = Math.max(0, dot(n, L));
  const diffuse = ambient * (0.7 + 0.3 * up) + key * nl;
  const shine = metal * (1 - rough);
  const metalLight = 0.3 + 0.75 * up * up + 0.6 * nl ** 12;
  const e = (diffuse * (1 - shine) + metalLight * shine) * ao * (model.exposure ?? 1);
  // Glossy paint and plastic: a faint white sheen facing up and a highlight,
  // so black lacquer reads as black and shiny rather than as a hole.
  const gloss = (1 - metal) * (1 - rough) ** 2;
  const spec = gloss * (light.sheen ?? 0.12) * (0.25 + up * up + 2.5 * nl ** 16) * ao;
  const g = model.gamma ?? 1;
  return col.map((c) => Math.min(1, toSrgb(toLinear(c) * e + spec) ** g));
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
        const loadTex = (texInfo) => {
          if (!texInfo) return null;
          if (!texCache.has(texInfo)) {
            const img = decodeImage(texInfo.getImage(), texInfo.getMimeType());
            const uri = texInfo.getURI() || texInfo.getName() || "";
            for (const p of model.paintOut || []) if (uri.includes(p.image)) paintOut(img, p);
            texCache.set(texInfo, mipChain(img));
          }
          return texCache.get(texInfo);
        };
        const name = mat?.getName() || "";
        const material = {
          tex: loadTex(mat?.getBaseColorTexture()),
          arm: model.light ? loadTex(mat?.getMetallicRoughnessTexture()) : null,
          ao: model.light ? loadTex(mat?.getOcclusionTexture()) : null,
          nrm: model.light && model.normalMap ? loadTex(mat?.getNormalTexture()) : null,
          metal: mat?.getMetallicFactor() ?? 1,
          rough: mat?.getRoughnessFactor() ?? 1,
          factor: mat?.getBaseColorFactor() || [1, 1, 1, 1],
          mask: mat?.getAlphaMode() === "MASK" || mat?.getAlphaMode() === "BLEND",
          cutoff: mat?.getAlphaCutoff() ?? 0.5,
          darkGlass: !!model.darkGlass && new RegExp(model.darkGlass, "i").test(name),
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
          const uvs = [U(ia), U(ib), U(ic)];
          const d1 = [uvs[1][0] - uvs[0][0], uvs[1][1] - uvs[0][1]];
          const d2 = [uvs[2][0] - uvs[0][0], uvs[2][1] - uvs[0][1]];
          const det = d1[0] * d2[1] - d2[0] * d1[1];
          // Tangent and bitangent: the surface directions of increasing u and v.
          const r = det ? 1 / det : 0;
          const tan = [0, 1, 2].map((k) => (e1[k] * d2[1] - e2[k] * d1[1]) * r);
          const bit = [0, 1, 2].map((k) => (e2[k] * d1[0] - e1[k] * d2[0]) * r);
          tris.push({
            p: [a, b, c],
            n: [N(ia), N(ib), N(ic)],
            face: cr.map((v) => v / (2 * area)),
            uv: uvs,
            tan,
            bit,
            // Texels per unit length is this times the texture's size.
            uvDensity: Math.sqrt(Math.abs(det) / 2 / area),
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
    const m = t.mat;
    const f = m.factor;
    // How many texels of a 1-texel-per-unit texture one splat spans.
    const span = t.uvDensity * size * 2;
    const texels = (tex) => span * Math.sqrt(tex.w * tex.h);
    let col = [f[0], f[1], f[2], f[3]];
    if (m.tex) {
      const c = sampleMip(m.tex, uv[0], uv[1], texels(m.tex));
      col = [c[0] * f[0], c[1] * f[1], c[2] * f[2], c[3] * f[3]];
    }
    if (m.mask && col[3] < m.cutoff) continue;
    if (m.darkGlass) col = [0.07, 0.09, 0.13, 1];
    if (model.light) {
      let shade = nn;
      if (m.nrm) {
        const c = sampleMip(m.nrm, uv[0], uv[1], texels(m.nrm));
        const s = model.normalStrength ?? 1;
        const x = (c[0] * 2 - 1) * s;
        const y = (c[1] * 2 - 1) * s;
        const z = c[2] * 2 - 1;
        // Gram-Schmidt the tangent frame against the shading normal; glTF's
        // v runs down the image, so the map's +y is the -v direction.
        const T = norm(t.tan.map((v, k) => v - nn[k] * dot(t.tan, nn)));
        const B = norm(t.bit.map((v, k) => v - nn[k] * dot(t.bit, nn)));
        shade = norm([0, 1, 2].map((k) => T[k] * x - B[k] * y + nn[k] * z));
      }
      const surf = { metal: m.metal, rough: m.rough, ao: 1 };
      if (m.arm) {
        const c = sampleMip(m.arm, uv[0], uv[1], texels(m.arm));
        surf.rough *= c[1];
        surf.metal *= c[2];
        if (model.armAO) surf.ao = c[0];
      }
      if (m.ao) surf.ao = sampleMip(m.ao, uv[0], uv[1], texels(m.ao))[0];
      if (m.darkGlass) Object.assign(surf, { metal: 1, rough: 0 });
      col = [...bakeLight(col.slice(0, 3), shade, surf, model.light, model), col[3]];
    }
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
