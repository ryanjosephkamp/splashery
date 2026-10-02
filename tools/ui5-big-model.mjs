// Lane UI r5: writes a big textured GLB for testing "Model to splats" with
// large files: a UV sphere with a dented surface and a striped texture, at
// any number of triangles. Not shipped; the file goes where you say.
//
//   node tools/ui5-big-model.mjs <out.glb> [triangles, default 6000000]

import fs from "node:fs";
import { PNG } from "pngjs";

const [out, want = "6000000"] = process.argv.slice(2);
if (!out) throw new Error("usage: node tools/ui5-big-model.mjs <out.glb> [triangles]");
// A sphere of `seg` columns and `rings` rows has 2 * seg * (rings - 1) triangles.
const rings = Math.max(8, Math.round(Math.sqrt(Number(want) / 4)));
const seg = rings * 2;
const nv = (seg + 1) * (rings + 1);
const nt = 2 * seg * (rings - 1);
const pos = new Float32Array(nv * 3);
const uv = new Float32Array(nv * 2);
let k = 0;
for (let r = 0; r <= rings; r++) {
  const th = (r / rings) * Math.PI;
  for (let s = 0; s <= seg; s++) {
    const ph = (s / seg) * Math.PI * 2;
    // Fine dents, so the surface really needs its triangles.
    const rad = 1 + 0.015 * Math.sin(ph * 40) * Math.sin(th * 40);
    pos[k * 3] = rad * Math.sin(th) * Math.cos(ph);
    pos[k * 3 + 1] = rad * Math.cos(th);
    pos[k * 3 + 2] = rad * Math.sin(th) * Math.sin(ph);
    uv[k * 2] = s / seg;
    uv[k * 2 + 1] = r / rings;
    k++;
  }
}
const idx = new Uint32Array(nt * 3);
let t = 0;
for (let r = 0; r < rings; r++)
  for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s;
    const b = a + seg + 1;
    if (r > 0) idx.set([a, b, a + 1], 3 * t++);
    if (r < rings - 1) idx.set([a + 1, b, b + 1], 3 * t++);
  }
// The texture: eight colored stripes around, a dark band at the equator.
const png = new PNG({ width: 512, height: 256 });
const stripes = [[230, 60, 60], [240, 160, 40], [240, 220, 60], [80, 190, 90], [50, 160, 220], [90, 90, 210], [170, 80, 200], [240, 240, 240]]; // prettier-ignore
for (let y = 0; y < 256; y++)
  for (let x = 0; x < 512; x++) {
    const c = Math.abs(y - 128) < 10 ? [30, 30, 30] : stripes[Math.floor((x / 512) * 8)];
    png.data.set([...c, 255], (y * 512 + x) * 4);
  }
const img = PNG.sync.write(png);
const pad = (n) => (4 - (n % 4)) % 4;
const parts = [Buffer.from(pos.buffer), Buffer.from(uv.buffer), Buffer.from(idx.buffer), img];
const views = [];
let off = 0;
for (const p of parts) {
  views.push({ buffer: 0, byteOffset: off, byteLength: p.length });
  off += p.length + pad(p.length);
}
const bin = Buffer.alloc(off);
parts.forEach((p, i) => p.copy(bin, views[i].byteOffset));
const json = {
  asset: { version: "2.0", generator: "splashery ui5-big-model" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
  textures: [{ source: 0 }],
  images: [{ bufferView: 3, mimeType: "image/png" }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: nv, type: "VEC3", min: [-1.02, -1.02, -1.02], max: [1.02, 1.02, 1.02] }, // prettier-ignore
    { bufferView: 1, componentType: 5126, count: nv, type: "VEC2" },
    { bufferView: 2, componentType: 5125, count: nt * 3, type: "SCALAR" },
  ],
  bufferViews: views.map(({ buffer, byteOffset, byteLength }) => ({ buffer, byteOffset, byteLength })),
  buffers: [{ byteLength: bin.length }],
};
let js = Buffer.from(JSON.stringify(json));
js = Buffer.concat([js, Buffer.alloc(pad(js.length), 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const ch = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
fs.writeFileSync(out, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin])); // prettier-ignore
console.log(`${out}: ${nt.toLocaleString("en-US")} triangles, ${(fs.statSync(out).size / 1e6).toFixed(0)} MB`);
