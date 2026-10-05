#!/usr/bin/env node
// Lane Arcade: the real asteroid shapes for Rock Blaster, from NASA's 3D
// Resources (public domain: "free and without copyright"; CREDITS.md).
// Reads each binary STL, samples points evenly by area over its surface
// with their normals, scales the rock to a radius of 1, and writes them
// small (8 bits a number) to assets/toys/stone-belt/rocks.json.
//
//   node tools/arc-rocks.mjs <dir with the STL files>
//
// The STLs come from https://github.com/nasa/NASA-3D-Resources ("3D Printing").

import fs from "node:fs";
import path from "node:path";

const ROCKS = [
  { id: "bennu", name: "Bennu", file: "Asteroid_101955_Bennu.stl" },
  { id: "itokawa", name: "Itokawa", file: "Asteroid_25143_Itokawa.stl" },
  { id: "eros", name: "Eros", file: "Asteroid_433_Eros.stl" },
  { id: "kleopatra", name: "Kleopatra", file: "Asteroid_216_Kleopatra.stl" },
  { id: "geographos", name: "Geographos", file: "Asteroid_1620_Geographos.stl" },
  { id: "toutatis", name: "Toutatis", file: "Asteroid_4179_Toutatis.stl" },
  { id: "golevka", name: "Golevka", file: "Asteroid_6489_Golevka.stl" },
];
const N = 1600;

const dir = process.argv[2];
if (!dir) throw new Error("Usage: node tools/arc-rocks.mjs <dir with the STL files>");

// A small seeded random (so the file is the same every run).
let seed = 12345;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const out = { source: "https://github.com/nasa/NASA-3D-Resources", license: "Public domain (NASA)", rocks: [] }; // prettier-ignore
for (const r of ROCKS) {
  const buf = fs.readFileSync(path.join(dir, r.file));
  const n = buf.readUInt32LE(80);
  const tris = [];
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50;
    const v = [];
    for (let k = 0; k < 3; k++) v.push([buf.readFloatLE(o + 12 + k * 12), buf.readFloatLE(o + 16 + k * 12), buf.readFloatLE(o + 20 + k * 12)]); // prettier-ignore
    const e1 = v[1].map((x, j) => x - v[0][j]);
    const e2 = v[2].map((x, j) => x - v[0][j]);
    const c = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const a = Math.hypot(...c) / 2;
    if (!(a > 0)) continue;
    tris.push({ v, a, n: c.map((x) => x / (2 * a)) });
    total += a;
    cx += ((v[0][0] + v[1][0] + v[2][0]) / 3) * a;
    cy += ((v[0][1] + v[1][1] + v[2][1]) / 3) * a;
    cz += ((v[0][2] + v[1][2] + v[2][2]) / 3) * a;
  }
  const c0 = [cx / total, cy / total, cz / total];
  // Cumulative areas, then N samples spread evenly along them (stratified).
  const cum = [];
  let acc = 0;
  for (const t of tris) cum.push((acc += t.a));
  const pts = [];
  let j = 0;
  for (let s = 0; s < N; s++) {
    const want = ((s + rand()) / N) * total;
    while (cum[j] < want) j++;
    const t = tris[j];
    let u = rand();
    let w = rand();
    if (u + w > 1) {
      u = 1 - u;
      w = 1 - w;
    }
    const p = t.v[0].map((x, k) => x + (t.v[1][k] - x) * u + (t.v[2][k] - x) * w - c0[k]);
    pts.push({ p, n: t.n });
  }
  const R = Math.max(...pts.map((q) => Math.hypot(...q.p)));
  const q8 = (x) => Math.max(-127, Math.min(127, Math.round(x * 127)));
  const bytes = new Int8Array(N * 6);
  pts.forEach((q, i) => {
    bytes.set(
      [q8(q.p[0] / R), q8(q.p[1] / R), q8(q.p[2] / R), q8(q.n[0]), q8(q.n[1]), q8(q.n[2])],
      i * 6,
    );
  });
  out.rocks.push({
    id: r.id,
    name: r.name,
    n: N,
    data: Buffer.from(bytes.buffer).toString("base64"),
  });
  console.log(`${r.name}: ${tris.length} triangles -> ${N} points`);
}
const dest = new URL("../assets/toys/stone-belt/rocks.json", import.meta.url);
fs.mkdirSync(new URL(".", dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${fs.statSync(dest).size} bytes -> assets/toys/stone-belt/rocks.json`);
