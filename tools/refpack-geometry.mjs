import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO, Accessor } from "@gltf-transform/core";
import { parseModel, prepareModel, sampleSurface } from "../src/packs/studio-models-core.js";
import { Kit } from "../src/kit.js";
import { buildShapes, shapeMesh } from "../src/refbuild/shapes.js";
import { decodeImage } from "./refpack-image.mjs";
import { linear } from "./refpack-metrics.mjs";

export function normalizeMesh(mesh) {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], mesh.positions[i]);
    hi[i % 3] = Math.max(hi[i % 3], mesh.positions[i]);
  }
  const center = lo.map((x, k) => (x + hi[k]) / 2),
    radius = Math.hypot(...hi.map((x, k) => (x - lo[k]) / 2)) || 1;
  return {
    ...mesh,
    positions: Float32Array.from(mesh.positions, (x, i) => (x - center[i % 3]) / radius),
    normalization: { center, scale: 1 / radius },
    size: hi.map((x, k) => x - lo[k]),
  };
}
export async function readMesh(file, { normalize = false, simplifyTo = 0 } = {}) {
  const dir = path.dirname(file),
    files = {};
  // GLB is self-contained. glTF is allowed only for explicit build-time sources.
  if (file.endsWith(".gltf")) {
    const json = JSON.parse(fs.readFileSync(file));
    for (const item of [...(json.buffers || []), ...(json.images || [])])
      if (item.uri && !item.uri.startsWith("data:")) {
        const f = path.resolve(dir, item.uri);
        if (!f.startsWith(path.resolve(dir) + path.sep))
          throw new Error("External model resource escapes its folder.");
        if (fs.existsSync(f)) files[item.uri] = new Uint8Array(fs.readFileSync(f));
      }
  }
  const raw = parseModel(new Uint8Array(fs.readFileSync(file)), path.basename(file), { files });
  const prep = await prepareModel(raw, {
    simplifyTo,
    decodeImage(bytes) {
      const p = decodeImage(bytes);
      return { w: p.width, h: p.height, data: p.data };
    },
  });
  const mesh = { positions: prep.pos, indices: prep.tri, prep };
  return normalize ? normalizeMesh(mesh) : mesh;
}
export function meshFromModel(model, detail = 24) {
  const positions = [],
    indices = [],
    colors = [];
  for (const s of model.shapes) {
    const m = shapeMesh(s, detail),
      start = positions.length / 3;
    positions.push(...m.positions);
    indices.push(...m.indices.map((i) => i + start));
    for (let i = 0; i < m.positions.length / 3; i++)
      colors.push(...(s.color || [0.6, 0.6, 0.6]).map(linear));
  }
  return { positions, indices, colors };
}
export async function writeGLB(file, mesh) {
  const document = new Document(),
    buffer = document.createBuffer();
  const position = document
    .createAccessor()
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array(mesh.positions))
    .setBuffer(buffer);
  const index = document
    .createAccessor()
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint32Array(mesh.indices))
    .setBuffer(buffer);
  const primitive = document.createPrimitive().setAttribute("POSITION", position).setIndices(index);
  if (mesh.colors)
    primitive.setAttribute(
      "COLOR_0",
      document
        .createAccessor()
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(mesh.colors))
        .setBuffer(buffer),
    );
  primitive.setMaterial(document.createMaterial().setDoubleSided(true).setRoughnessFactor(0.8));
  document
    .createScene()
    .addChild(document.createNode().setMesh(document.createMesh().addPrimitive(primitive)));
  fs.writeFileSync(file, await new NodeIO().writeBinary(document));
}
const PROPS = [
  "x",
  "y",
  "z",
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
const C0 = 0.28209479177387814;
export function plyFromKit(model, count = 12000, onlyPart = null) {
  const k = new Kit(113, { count, fit: false });
  const selected = onlyPart
    ? { ...model, shapes: model.shapes.filter((s) => s.part === onlyPart) }
    : model;
  buildShapes(k, selected);
  const it = k.emit();
  while (!it.next().done);
  const b = k.buf,
    data = new Float32Array(b.count * PROPS.length);
  for (let i = 0; i < b.count; i++)
    data.set(
      [
        ...b.pos.subarray(i * 3, i * 3 + 3),
        ...b.color.subarray(i * 4, i * 4 + 3).map((x) => (x - 0.5) / C0),
        Math.log(b.color[i * 4 + 3] / (1 - b.color[i * 4 + 3])),
        ...b.scale.subarray(i * 3, i * 3 + 3).map(Math.log),
        b.rot[i * 4 + 3],
        ...b.rot.subarray(i * 4, i * 4 + 3),
      ],
      i * PROPS.length,
    );
  return makePly(data, b.count);
}
function makePly(data, count) {
  const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${count}\n${PROPS.map((p) => `property float ${p}`).join("\n")}\nend_header\n`;
  return Buffer.concat([Buffer.from(header), Buffer.from(data.buffer)]);
}
export function plyFromMesh(prep, count = 18000, { preserveCoordinates = false } = {}) {
  const s = sampleSurface(prep, count, { seed: 113, light: true });
  if (preserveCoordinates) {
    const center = prep.bbox.min.map((x, k) => (x + prep.bbox.max[k]) / 2);
    for (let i = 0; i < s.pos.length; i++) s.pos[i] = s.pos[i] / s.scale + center[i % 3];
    for (let i = 0; i < s.sigma.length; i++) s.sigma[i] /= s.scale;
  }
  const data = new Float32Array(s.n * PROPS.length);
  for (let i = 0; i < s.n; i++) {
    const [nx, ny, nz] = s.nrm.subarray(i * 3, i * 3 + 3),
      w = 1 + nz,
      l = Math.hypot(w, nx, ny);
    const q = l < 1e-7 ? [0, 1, 0, 0] : [w / l, -ny / l, nx / l, 0];
    data.set(
      [
        ...s.pos.subarray(i * 3, i * 3 + 3),
        ...s.rgb.subarray(i * 3, i * 3 + 3).map((x) => (x - 0.5) / C0),
        Math.log(0.97 / 0.03),
        Math.log(s.sigma[i]),
        Math.log(s.sigma[i]),
        Math.log(s.sigma[i] * 0.14),
        ...q,
      ],
      i * PROPS.length,
    );
  }
  return makePly(data, s.n);
}
export function readPlyPoints(bytes) {
  const end = bytes.indexOf("end_header\n"),
    head = bytes.subarray(0, end).toString();
  if (end < 0 || !head.includes("format binary_little_endian 1.0"))
    throw new Error("Expected a binary little-endian splat PLY.");
  const count = Number(head.match(/element vertex (\d+)/)?.[1]),
    props = [...head.matchAll(/property float (\w+)/g)].map((m) => m[1]);
  if (!count || !["x", "y", "z"].every((k) => props.includes(k)))
    throw new Error("PLY lacks positions.");
  const view = new DataView(bytes.buffer, bytes.byteOffset + end + 11, bytes.length - end - 11);
  if (view.byteLength < count * props.length * 4) throw new Error("Truncated PLY.");
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++)
      positions[i * 3 + k] = view.getFloat32(
        (i * props.length + props.indexOf("xyz"[k])) * 4,
        true,
      );
  return { positions, indices: [] };
}
