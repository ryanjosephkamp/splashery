#!/usr/bin/env node
// Writes the small test models of lane Studio Models (tests/fixtures/stm/), made from
// nothing but numbers, so they are ours and CC0:
//   quad.glb        a flat 2 x 2 square (two triangles) with a 2 x 2 texture:
//                   red and green on the top row, blue and yellow below
//   cube.gltf       a cube with a color at every corner (COLOR_0), all data embedded
//   pyramid.obj/.mtl  a square pyramid, red sides and a green base (two MTL colors)
//   tetra-ascii.stl a tetrahedron as ASCII STL
//   cube-binary.stl a cube as binary STL
//   quad-loose.gltf/.bin  the quad with its buffer in a separate file (needs its file)
// Build-time only: pngjs (MIT) is a devDependency.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "tests/fixtures/stm");
fs.mkdirSync(out, { recursive: true });

const pad4 = (b, fill = 0) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);

function glb(json, bin) {
  const j = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const b = pad4(bin);
  const head = Buffer.alloc(12);
  head.write("glTF", 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const ch = (len, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(len, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };
  return Buffer.concat([head, ch(j.length, 0x4e4f534a), j, ch(b.length, 0x004e4942), b]);
}
const f32 = (a) => Buffer.from(new Float32Array(a).buffer);
const u16 = (a) => Buffer.from(new Uint16Array(a).buffer);

// The quad: x, y in 0..1 (a unit square in the XY plane), uv with v down.
const qPos = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const qUv = [0, 1, 1, 1, 1, 0, 0, 0];
const qIdx = [0, 1, 2, 0, 2, 3];
const png = new PNG({ width: 2, height: 2 });
[[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]].forEach((c, i) => png.data.set([...c, 255], i * 4)); // prettier-ignore
const tex = PNG.sync.write(png);
{
  const bin = Buffer.concat([pad4(f32(qPos)), pad4(f32(qUv)), pad4(u16(qIdx)), pad4(tex)]);
  const o1 = pad4(f32(qPos)).length;
  const o2 = o1 + pad4(f32(qUv)).length;
  const o3 = o2 + pad4(u16(qIdx)).length;
  const json = {
    asset: { version: "2.0", generator: "tools/stm-fixtures.mjs" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] },
    ],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 } }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 3, mimeType: "image/png" }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 2, componentType: 5123, count: 6, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48 },
      { buffer: 0, byteOffset: o1, byteLength: 32 },
      { buffer: 0, byteOffset: o2, byteLength: 12 },
      { buffer: 0, byteOffset: o3, byteLength: tex.length },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  fs.writeFileSync(path.join(out, "quad.glb"), glb(json, bin));
  // The same quad with its buffer in a separate file (untextured, one color).
  const b2 = Buffer.concat([pad4(f32(qPos)), pad4(u16(qIdx))]);
  fs.writeFileSync(path.join(out, "quad-loose.bin"), b2);
  fs.writeFileSync(
    path.join(out, "quad-loose.gltf"),
    JSON.stringify({
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 4,
          type: "VEC3",
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
        { bufferView: 1, componentType: 5123, count: 6, type: "SCALAR" },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 48 },
        { buffer: 0, byteOffset: 48, byteLength: 12 },
      ],
      buffers: [{ uri: "quad-loose.bin", byteLength: b2.length }],
    }),
  );
}

// A cube from -0.5 to 0.5, each corner its own color (COLOR_0), all data embedded (a data URI).
const cubeCorners = [];
for (let i = 0; i < 8; i++)
  cubeCorners.push((i & 1) - 0.5, ((i >> 1) & 1) - 0.5, ((i >> 2) & 1) - 0.5);
const cubeCols = [];
for (let i = 0; i < 8; i++) cubeCols.push(i & 1, (i >> 1) & 1, (i >> 2) & 1, 1);
const cubeIdx = [
  0, 2, 1, 1, 2, 3, // -z
  4, 5, 6, 5, 7, 6, // +z
  0, 1, 4, 1, 5, 4, // -y
  2, 6, 3, 3, 6, 7, // +y
  0, 4, 2, 2, 4, 6, // -x
  1, 3, 5, 3, 7, 5, // +x
]; // prettier-ignore
{
  const bin = Buffer.concat([f32(cubeCorners), f32(cubeCols), pad4(u16(cubeIdx))]);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      { bufferView: 1, componentType: 5126, count: 8, type: "VEC4" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 96 },
      { buffer: 0, byteOffset: 96, byteLength: 128 },
      { buffer: 0, byteOffset: 224, byteLength: 72 },
    ],
    buffers: [
      {
        byteLength: bin.length,
        uri: `data:application/octet-stream;base64,${bin.toString("base64")}`,
      },
    ],
  };
  fs.writeFileSync(path.join(out, "cube.gltf"), JSON.stringify(json));
}

// A square pyramid as OBJ with an MTL: red sides and a green base.
fs.writeFileSync(
  path.join(out, "pyramid.obj"),
  [
    "# a square pyramid (tools/stm-fixtures.mjs)",
    "mtllib pyramid.mtl",
    "v -0.5 0 -0.5", "v 0.5 0 -0.5", "v 0.5 0 0.5", "v -0.5 0 0.5", "v 0 0.8 0",
    "usemtl side",
    "f 1 5 2", "f 2 5 3", "f 3 5 4", "f 4 5 1",
    "usemtl base",
    "f 1 2 3 4",
  ].join("\n") + "\n", // prettier-ignore
);
fs.writeFileSync(
  path.join(out, "pyramid.mtl"),
  "newmtl side\nKd 0.9 0.1 0.1\nnewmtl base\nKd 0.1 0.8 0.2\n",
);

// STL: a tetrahedron (ASCII) and a cube (binary).
{
  const v = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const faces = [
    [0, 2, 1],
    [0, 1, 3],
    [1, 2, 3],
    [0, 3, 2],
  ];
  let s = "solid tetra\n";
  for (const f of faces) {
    s += "facet normal 0 0 0\n outer loop\n";
    for (const i of f) s += `  vertex ${v[i].join(" ")}\n`;
    s += " endloop\nendfacet\n";
  }
  fs.writeFileSync(path.join(out, "tetra-ascii.stl"), s + "endsolid tetra\n");
  const tris = [];
  for (let k = 0; k < cubeIdx.length; k += 3) tris.push(cubeIdx.slice(k, k + 3));
  const b = Buffer.alloc(84 + tris.length * 50);
  b.write("binary stl cube (tools/stm-fixtures.mjs)", 0);
  b.writeUInt32LE(tris.length, 80);
  tris.forEach((t, n) => {
    let o = 84 + n * 50 + 12;
    for (const i of t)
      for (let c = 0; c < 3; c++, o += 4) b.writeFloatLE(cubeCorners[i * 3 + c] * 10, o);
  });
  fs.writeFileSync(path.join(out, "cube-binary.stl"), b);
}
console.log(fs.readdirSync(out).join(" "));
