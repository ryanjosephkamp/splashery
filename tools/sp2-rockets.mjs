#!/usr/bin/env node
// Lane Space r2: NASA's Space Launch System and Space Shuttle models, cut
// into the pieces that stage and colored, for the rocket toys. Writes
// assets/toys/real-rockets/sls.glb and space-shuttle.glb.
//
//   node tools/sp2-rockets.mjs
//
// Both come from NASA 3D Resources (used under NASA's media guidelines):
//   - SLS: the printable "Space Launch System (SLS)" model, one STL with no
//     colors (https://science.nasa.gov/3d-resources/space-launch-system-sls/).
//   - Space Shuttle: "Space Shuttle (A)" by NASA/Michael D. Carbajal, a GLB
//     compressed with Draco, all one gray
//     (https://science.nasa.gov/3d-resources/space-shuttle-a/).
// Neither carries a texture, so neither carries a logo.
//
// Each is simplified (src/packs/studio-models-core.js's simplifyMesh), stood
// upright, and written as a GLB with one material per piece; the toy (src/
// packs/space-r2.js) tells the pieces apart by material name. The colors are
// the real vehicles': the SLS core stage's orange foam, white boosters, upper
// stage and Orion; the Shuttle's orange external tank, white boosters and
// orbiter, the orbiter's black belly tiles and dark engines.

import fs from "node:fs";
import { Document, NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { parseModel, simplifyMesh } from "../src/packs/studio-models-core.js";

const OUT = "assets/toys/real-rockets";
const BASE = "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources";
const SLS_ZIP = `${BASE}/printable/space-launch-system-(sls)/Space%20Launch%20System%20(SLS).zip`;
const SHUTTLE = `${BASE}/model/space-shuttle-(a)/Space%20Shuttle%20(A).glb`;

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

// The one file in a zip (stored or deflated), by its local header.
async function unzipOne(zip) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  if (v.getUint32(0, true) !== 0x04034b50) throw new Error("not a zip");
  const method = v.getUint16(8, true);
  let size = v.getUint32(18, true);
  const nameLen = v.getUint16(26, true);
  const extraLen = v.getUint16(28, true);
  const start = 30 + nameLen + extraLen;
  // (A size of 0 here means it is in the central directory: find it there.)
  if (!size) {
    for (let i = zip.length - 22; i >= 0; i--)
      if (v.getUint32(i, true) === 0x06054b50) {
        const cd = v.getUint32(i + 16, true);
        size = v.getUint32(cd + 20, true);
        break;
      }
  }
  const data = zip.subarray(start, start + size);
  if (method === 0) return data;
  const zlib = await import("node:zlib");
  return new Uint8Array(zlib.inflateRawSync(data));
}

// Colors (sRGB 0..1) of the pieces.
const COLORS = {
  core: [0.78, 0.43, 0.19],
  srb: [0.92, 0.92, 0.9],
  icps: [0.9, 0.9, 0.88],
  orion: [0.9, 0.9, 0.9],
  las: [0.93, 0.93, 0.92],
  engine: [0.3, 0.3, 0.32],
  nozzle: [0.3, 0.3, 0.32],
  orbiter: [0.93, 0.93, 0.92],
  belly: [0.12, 0.12, 0.13],
  window: [0.06, 0.06, 0.07],
  et: [0.78, 0.43, 0.19],
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// Splits a mesh's triangles into pieces with `pieceOf(centroid, normal)`.
function split(pos, idx, pieceOf) {
  const out = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const cen = [0, 1, 2].map((k) => (pos[a + k] + pos[b + k] + pos[c + k]) / 3);
    const u = [0, 1, 2].map((k) => pos[b + k] - pos[a + k]);
    const w = [0, 1, 2].map((k) => pos[c + k] - pos[a + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n) || 1;
    const name = pieceOf(
      cen,
      n.map((x) => x / l),
    );
    if (!out.has(name)) out.set(name, []);
    out.get(name).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return out;
}

// One raw mesh (simplifyMesh's input) from shared positions and per-piece
// triangle lists; returns the simplified pieces as { name, pos, idx }.
function simplifyPieces(pos, pieces, target) {
  const names = [...pieces.keys()];
  const total = names.reduce((s, n) => s + pieces.get(n).length / 3, 0);
  const idx = new Uint32Array(total * 3);
  const mat = new Uint16Array(total);
  let t = 0;
  names.forEach((n, m) => {
    const list = pieces.get(n);
    idx.set(list, t * 3);
    mat.fill(m, t, t + list.length / 3);
    t += list.length / 3;
  });
  const materials = names.map((name) => ({
    name,
    rgb: COLORS[name],
    color: [...COLORS[name].map(lin), 1],
  }));
  const raw = { pos, nor: null, uv: null, col: null, idx, mat, materials, images: [], notes: [] };
  const sm = total > target * 1.1 ? simplifyMesh(raw, materials, target) : raw;
  return names.map((name, m) => {
    const tris = [];
    for (let i = 0; i < sm.mat.length; i++) if (sm.mat[i] === m) tris.push(sm.idx[i * 3], sm.idx[i * 3 + 1], sm.idx[i * 3 + 2]); // prettier-ignore
    // Only the vertices this piece uses.
    const remap = new Map();
    const p = [];
    const ix = tris.map((v) => {
      if (!remap.has(v)) {
        remap.set(v, remap.size);
        p.push(sm.pos[v * 3], sm.pos[v * 3 + 1], sm.pos[v * 3 + 2]);
      }
      return remap.get(v);
    });
    return { name, pos: new Float32Array(p), idx: new Uint32Array(ix) };
  });
}

async function writeGlb(file, pieces) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh("rocket");
  for (const pc of pieces) {
    const material = doc.createMaterial(pc.name).setBaseColorFactor([...COLORS[pc.name].map(lin), 1]).setRoughnessFactor(0.7).setMetallicFactor(0); // prettier-ignore
    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc.createAccessor().setType("VEC3").setArray(pc.pos).setBuffer(buffer),
      )
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(pc.idx).setBuffer(buffer))
      .setMaterial(material);
    mesh.addPrimitive(prim);
  }
  doc.createScene().addChild(doc.createNode("rocket").setMesh(mesh));
  fs.writeFileSync(file, await new NodeIO().writeBinary(doc));
  const tris = pieces.reduce((s, p) => s + p.idx.length / 3, 0);
  console.log(`${file}: ${pieces.map((p) => `${p.name} ${p.idx.length / 3}`).join(", ")} (${tris} triangles, ${Math.round(fs.statSync(file).size / 1024)} KB)`); // prettier-ignore
}

// A mesh's signed volume (positive when its triangles wind outward).
function signedVolume(mesh, m) {
  let vol = 0;
  const v = [0, 0, 0];
  const w = (i, P) => {
    P.getElement(i, v);
    return [0, 1, 2].map((k) => m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k]);
  };
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute("POSITION");
    const I = prim.getIndices();
    const n = I ? I.getCount() : P.getCount();
    for (let i = 0; i < n; i += 3) {
      const a = w(I ? I.getScalar(i) : i, P);
      const b = w(I ? I.getScalar(i + 1) : i + 1, P);
      const c = w(I ? I.getScalar(i + 2) : i + 2, P);
      vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); // prettier-ignore
    }
  }
  return vol;
}

// Cuts every triangle tagged `tag` that crosses the plane z = z0 into
// pieces on either side (new vertices on the plane). pos, idx and tags are
// plain arrays, changed in place.
function splitAt(pos, idx, tags, tag, z0) {
  const n = idx.length / 3;
  const at = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const add = (p) => (pos.push(...p), pos.length / 3 - 1);
  const cut = (a, b) => {
    const pa = at(a);
    const pb = at(b);
    const t = (z0 - pa[2]) / (pb[2] - pa[2]);
    return add([0, 1, 2].map((k) => pa[k] + (pb[k] - pa[k]) * t));
  };
  for (let t = 0; t < n; t++) {
    if (tags[t] !== tag) continue;
    const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
    const side = v.map((x) => pos[x * 3 + 2] >= z0);
    const up = side.filter(Boolean).length;
    if (up === 0 || up === 3) continue;
    // Rotate so v[0] is the one alone on its side.
    const lone = side.findIndex((x) => side.filter((y) => y === x).length === 1);
    const [a, b, c] = [v[lone], v[(lone + 1) % 3], v[(lone + 2) % 3]];
    const ab = cut(a, b);
    const ac = cut(a, c);
    idx[t * 3] = a;
    idx[t * 3 + 1] = ab;
    idx[t * 3 + 2] = ac;
    idx.push(ab, b, c, ab, c, ac);
    tags.push(tag, tag);
  }
}

fs.mkdirSync(OUT, { recursive: true });

// ---- SLS ----------------------------------------------------------------------------
// The STL stands on +Y, 582 units tall (about 98 m: a unit is about 0.17 m),
// its core stage's axis at x 0.5, z 1. Measured from its profile: the
// boosters reach y 322; the core stage's cylinder ends at y 386 and its
// adapter (the LVSA, which stays with it) narrows to y 424; the upper stage
// (the ICPS) runs to y 452; Orion's adapter and service module (in their
// fairings) to y 497; above that the launch abort system's fairing over the
// crew module and its tower.
{
  const raw = parseModel(await unzipOne(await get(SLS_ZIP)), "sls.stl", { maxTriangles: 4e6 });
  const pos = raw.pos;
  // Center the core's axis.
  for (let i = 0; i < pos.length; i += 3) ((pos[i] -= 0.5), (pos[i + 2] -= 1));
  const pieces = split(pos, raw.idx, ([x, y, z]) => {
    const r = Math.hypot(x, z);
    // (By x, not radius: the core's two long pipes run up its front and back
    // at the boosters' distance.)
    if (Math.abs(x) > 27 && y < 330) return y < 24 ? "nozzle" : "srb";
    if (y < 424) return y < 16 && r < 25 ? "engine" : "core";
    if (y < 452) return "icps";
    if (y < 497) return "orion";
    return "las";
  });
  // (The engines: the four RS-25s under the core; "nozzle": the boosters'.)
  await writeGlb(`${OUT}/sls.glb`, simplifyPieces(pos, pieces, 400000));
}

// ---- Space Shuttle --------------------------------------------------------------------
// The model lies along z, nose toward −z, the orbiter on top (+y), the
// boosters at ±x. Its nodes: pCylinder8 is the external tank, polySur157 the
// two boosters, everything else the orbiter (group13 its three main engines
// and two maneuvering engines). Stood up here: nose up (+y), orbiter toward
// the viewer (+z).
{
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
  const doc = await io.readBinary(await get(SHUTTLE));
  const pos = [];
  const tags = [];
  const idx = [];
  const windows = [];
  doc
    .getRoot()
    .listScenes()[0]
    .traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const name = node.getName();
      // The cockpit windows' frames are 132 tiny meshes (each about 1/3000 of
      // the stack's length, 150,000 triangles in all), far finer than a splat:
      // left out, so the simplifier keeps the rest of the orbiter's shape.
      const box = getBounds(node);
      if (Math.max(...box.max.map((v, i) => v - box.min[i])) < 0.1) {
        // (Each frame's middle, stood up as below, marks a window.)
        const c = box.min.map((v, i) => (v + box.max[i]) / 2);
        windows.push([c[0], -c[2], c[1]]);
        return;
      }
      const piece = name === "pCylinder8" ? "et" : name === "polySur157" ? "srb" : name.startsWith("group13") ? "engine" : "orbiter"; // prettier-ignore
      const m = node.getWorldMatrix();
      // Some of the model's meshes are wound inside out (their normals point
      // in, so they light dark): a mesh whose signed volume is negative is
      // turned the right way out.
      const flip = signedVolume(mesh, m) < 0;
      for (const prim of mesh.listPrimitives()) {
        const P = prim.getAttribute("POSITION");
        const base = pos.length / 3;
        const v = [0, 0, 0];
        for (let i = 0; i < P.getCount(); i++) {
          P.getElement(i, v);
          const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
          const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
          const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
          pos.push(x, -z, y); // (x, y, z) → (x, −z, y): nose up, orbiter forward
        }
        const I = prim.getIndices();
        const n = I ? I.getCount() : P.getCount();
        for (let i = 0; i < n; i += 3) {
          const a = base + (I ? I.getScalar(i) : i);
          const b = base + (I ? I.getScalar(i + 1) : i + 1);
          const c = base + (I ? I.getScalar(i + 2) : i + 2);
          if (flip) idx.push(a, c, b);
          else idx.push(a, b, c);
          tags.push(piece);
        }
      }
    });
  // The belly's edge (z 0.3, just above the wings' plane) cuts straight
  // through the orbiter's triangles, so the black ends on a clean line.
  splitAt(pos, idx, tags, "orbiter", 0.3);
  let tagAt = 0;
  const P = new Float32Array(pos);
  // The orbiter's wings are one mesh wound both ways, so its flat faces are
  // turned by where they are: a face that looks along z (toward the viewer or
  // the tank) faces away from the middle of its piece, the wings' plane
  // (z 0.24) out on the wings and the fuselage's axis (z 1.44) inside them.
  const plane = (x) => (Math.abs(x) > 2.4 ? 0.24 : 1.44);
  const I = new Uint32Array(idx);
  const centroid = (t, k) => (P[I[t] * 3 + k] + P[I[t + 1] * 3 + k] + P[I[t + 2] * 3 + k]) / 3;
  for (let t = 0; t < I.length; t += 3) {
    if (tags[t / 3] !== "orbiter") continue;
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vz = P[c + 2] - P[a + 2];
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, nz) || 1;
    if (Math.abs(nz / len) < 0.6) continue;
    if (Math.sign(nz) !== Math.sign(centroid(t, 2) - plane(centroid(t, 0)))) [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]]; // prettier-ignore
  }
  // The orbiter's belly (its black tiles): everything below the wings' top,
  // toward the tank (−z now).
  const pieces = split(P, I, (cen) => {
    const tag = tags[tagAt++];
    if (tag !== "orbiter") return tag;
    // The cockpit windows, black, where their frames were (within 0.3 m).
    for (const w of windows) if (Math.hypot(cen[0] - w[0], cen[1] - w[1], cen[2] - w[2]) < 0.3) return "window"; // prettier-ignore
    return cen[2] < 0.3 ? "belly" : tag;
  });
  await writeGlb(`${OUT}/space-shuttle.glb`, simplifyPieces(P, pieces, 120000));
}
