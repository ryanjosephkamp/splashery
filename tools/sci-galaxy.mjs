#!/usr/bin/env node
// Lane Science's "Galaxy in a box" sample: the gas of a FIRE-2 galaxy (CC BY
// 4.0, FlatHUB) cut into a small file of particles for the toy.
//
//   for i in 0 1 2 3; do curl -L -o .cache/sci/m12i_600.$i.hdf5 \
//     https://users.flatironinstitute.org/~mgrudic/fire2_public_release/core/m12i_res7100/output/snapdir_600/snapshot_600.$i.hdf5; done
//   node --max-old-space-size=12000 tools/sci-galaxy.mjs [--sim=m12i] [--in=a.hdf5,b.hdf5] [--half=20] [--half-y=20] [--out=…]
//
// (7.2 GB for m12i's four files; --sim=m11i reads a dwarf galaxy's single 0.9 GB file.)
//
// It reads the snapshot with jsfive (a pinned devDependency; LICENSES.md),
// finds the galaxy (a shrinking sphere on its stars), turns it so its gas
// disk's spin points up (+y), keeps every gas particle in a cube of ±half
// kpc round it (the dense gas and a random share of the diffuse gas if there
// are more than --keep), and works out each one's temperature from its internal
// energy (T = (γ − 1) u μ m_p / k_B, with μ from a hydrogen fraction of 0.76
// and the electron abundance).
//
// The file: a uint32 byte length, then a JSON header (the snapshot, the
// box, the counts, the credit), padded to 4 bytes, then n × 3 int16
// positions (units of half / 32767 kpc), n uint16 smoothing lengths
// (h = 2^(v / 4096 − 8) kpc) and n uint16 temperatures
// (log10 T = v / 65535 × 8 + 1).

import fs from "node:fs";
import path from "node:path";
import * as hdf5 from "jsfive";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
// The simulations tried (the FIRE page lists the article that introduced each).
const SIMS = {
  m12i: {
    name: "FIRE-2 m12i (res7100), snapshot 600 (z = 0)",
    source:
      "https://users.flatironinstitute.org/~mgrudic/fire2_public_release/core/m12i_res7100/output/snapdir_600/",
    cite: "m12i: Wetzel et al. (2016).",
    files: [0, 1, 2, 3].map((i) => `.cache/sci/m12i_600.${i}.hdf5`).join(","),
  },
  m11i: {
    name: "FIRE-2 m11i (res7100), snapshot 600 (z = 0)",
    source:
      "https://users.flatironinstitute.org/~mgrudic/fire2_public_release/core/m11i_res7100/output/snapshot_600.hdf5",
    cite: "m11i: El-Badry et al. (2018).",
    files: ".cache/sci/m11i_600.hdf5",
  },
};
const SIM = SIMS[opt("sim", "m12i")];
if (!SIM) throw new Error(`--sim is one of ${Object.keys(SIMS).join(", ")}`);
const inPath = opt("in", SIM.files);
const half = Number(opt("half", 10));
const halfY = Number(opt("half-y", half)); // a flatter box: its half height
const most = Number(opt("keep", 300000)); // at most this many particles (a random subset)
const outPath = opt("out", `assets/toys/galaxy-box/${opt("sim", "m12i")}-gas.bin`);

// A snapshot can be split over several files (snapdir_600/snapshot_600.0.hdf5, …).
const inputs = inPath.split(",");
const open = (file) => {
  const buf = fs.readFileSync(file);
  const ab = buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength ? buf.buffer : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); // prettier-ignore
  return new hdf5.File(ab, path.basename(file));
};
let head = null;
let starList = [];
for (const file of inputs) {
  const f = open(file);
  head ??= f.get("Header").attrs;
  if (f.keys.includes("PartType4")) starList.push(Float64Array.from(f.get("PartType4/Coordinates").value)); // prettier-ignore
}
const hub = head.HubbleParam;
const a = head.Time; // the scale factor: physical = comoving × a / h
const toKpc = a / hub;
console.log(`z = ${head.Redshift.toFixed(3)}, h = ${hub}, ${head.NumPart_Total[0]} gas particles in ${inputs.length} file(s)`); // prettier-ignore

// The galaxy's center: a shrinking sphere on the stars.
const sp = new Float64Array(starList.reduce((n, x) => n + x.length, 0));
starList.reduce((o, x) => (sp.set(x, o), o + x.length), 0);
starList = null;
const ns = sp.length / 3;
let c = [0, 0, 0];
for (let i = 0; i < ns; i++) for (let k = 0; k < 3; k++) c[k] += sp[i * 3 + k] / ns;
let R = 2000 / toKpc;
for (let it = 0; it < 80; it++) {
  const s = [0, 0, 0];
  let m = 0;
  for (let i = 0; i < ns; i++) {
    const d = Math.hypot(sp[i * 3] - c[0], sp[i * 3 + 1] - c[1], sp[i * 3 + 2] - c[2]);
    if (d < R) {
      for (let k = 0; k < 3; k++) s[k] += sp[i * 3 + k];
      m++;
    }
  }
  if (m < 500) break;
  c = s.map((v) => v / m);
  R *= 0.9;
}

// Temperature (K) from the internal energy ((km/s)² per unit mass).
const MP = 1.6726e-24;
const KB = 1.380649e-16;
// The hydrogen mass fraction is taken as 0.76 (the primordial value; the
// snapshot's per-particle helium and metals would change T by a few percent,
// and reading them doesn't fit in memory for the big runs).
const tempOf = (u, ne) => {
  const X = 0.76;
  const mu = 4 / (1 + 3 * X + 4 * X * ne);
  return ((2 / 3) * u * 1e10 * mu * MP) / KB;
};

// The gas near the galaxy (within the cube's corner distance), from every file.
const reach = half * Math.sqrt(3);
const gas = []; // { p: [kpc], v, m, h, T }
let n0 = 0;
for (const file of inputs) {
  const f = open(file);
  if (!f.keys.includes("PartType0")) continue;
  const gp = f.get("PartType0/Coordinates").value;
  const gv = f.get("PartType0/Velocities").value;
  const hs = f.get("PartType0/SmoothingLength").value;
  const u = f.get("PartType0/InternalEnergy").value;
  const ne = f.get("PartType0/ElectronAbundance").value;
  const mass = f.get("PartType0/Masses").value;
  n0 += hs.length;
  for (let i = 0; i < hs.length; i++) {
    const p = [0, 1, 2].map((k) => (gp[i * 3 + k] - c[k]) * toKpc);
    if (Math.abs(p[0]) > reach || Math.abs(p[1]) > reach || Math.abs(p[2]) > reach) continue;
    if (Math.hypot(...p) > reach) continue;
    gas.push({
      p,
      v: [gv[i * 3], gv[i * 3 + 1], gv[i * 3 + 2]],
      m: mass[i],
      h: hs[i] * toKpc,
      T: tempOf(u[i], ne[i]),
    });
  }
  console.log(
    `${path.basename(file)}: ${hs.length} gas particles, ${gas.length} near the galaxy so far`,
  );
}

// The disk's spin: the angular momentum of the cool gas within 5 kpc.
const vc = [0, 0, 0];
let vm = 0;
for (const g of gas)
  if (Math.hypot(...g.p) < 5) {
    for (let k = 0; k < 3; k++) vc[k] += g.v[k] * g.m;
    vm += g.m;
  }
for (let k = 0; k < 3; k++) vc[k] /= vm;
const L = [0, 0, 0];
for (const g of gas) {
  if (Math.hypot(...g.p) > 5 || g.T > 2e4) continue;
  const p = g.p;
  const v = [0, 1, 2].map((k) => g.v[k] - vc[k]);
  L[0] += g.m * (p[1] * v[2] - p[2] * v[1]);
  L[1] += g.m * (p[2] * v[0] - p[0] * v[2]);
  L[2] += g.m * (p[0] * v[1] - p[1] * v[0]);
}
const ly = L.map((v) => v / Math.hypot(...L));
// A rotation taking ly to +y: rows e_x, e_y = ly, e_z.
const ref = Math.abs(ly[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]; // prettier-ignore
const unit = (v) => v.map((x) => x / Math.hypot(...v));
const ez = unit(cross(ref, ly));
const ex = cross(ly, ez);
const rot = (p) => [ex, ly, ez].map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);

// Every gas particle in the cube.
const keep = [];
let inBox = 0;
for (const g of gas) {
  const p = rot(g.p);
  if (Math.abs(p[0]) < half && Math.abs(p[1]) < halfY && Math.abs(p[2]) < half) keep.push([g, p]);
}
// When there are more than --keep, the dense gas (where the spiral arms and
// the star-forming clouds are) is all kept and only the diffuse gas is
// thinned, at random (the same on every run): the file is the densest
// DENSE_SHARE of --keep particles, sorted by smoothing length, then a random
// share of the rest. The toy draws each kept diffuse particle wider by the
// cube root of its thinning, so that gas still closes (the same mass in
// fewer, bigger pieces), and the dense ones at their own size.
const DENSE_SHARE = 0.65;
let nDense = keep.length;
let widenRest = 1;
if (keep.length > most) {
  keep.sort((p, q) => p[0].h - q[0].h);
  nDense = Math.round(most * DENSE_SHARE);
  const rest = keep.slice(nDense);
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  inBox = keep.length;
  widenRest = Math.cbrt(rest.length / (most - nDense));
  keep.length = nDense;
  keep.push(...rest.slice(0, most - nDense));
}
const n = keep.length;
const pos = new Int16Array(n * 3);
const hq = new Uint16Array(n);
const tq = new Uint16Array(n);
let tmin = Infinity;
let tmax = 0;
keep.forEach(([g, p], j) => {
  for (let k = 0; k < 3; k++) pos[j * 3 + k] = Math.round((p[k] / half) * 32767);
  hq[j] = Math.max(0, Math.min(65535, Math.round((Math.log2(g.h) + 8) * 4096)));
  tmin = Math.min(tmin, g.T);
  tmax = Math.max(tmax, g.T);
  tq[j] = Math.max(0, Math.min(65535, Math.round(((Math.log10(Math.max(10, g.T)) - 1) / 8) * 65535))); // prettier-ignore
});
const header = {
  format: "splashery-sph-gas-1",
  simulation: SIM.name,
  source: SIM.source,
  license: "CC BY 4.0",
  cite: `We use the publicly-available FIRE-2 cosmological zoom-in simulations (Wetzel et al. 2023, 2025), from the Feedback In Realistic Environments (FIRE) project, generated using the Gizmo code (Hopkins 2015) and the FIRE-2 physics model (Hopkins et al. 2018). ${SIM.cite}`,
  half,
  halfY,
  n,
  inBox: inBox || n,
  nDense,
  hCut: nDense < n ? keep[nDense - 1][0].h : null,
  widenRest,
  of: n0,
  center: c.map((v) => v * toKpc),
  spin: ly,
  temperature: [tmin, tmax],
};
let json = Buffer.from(JSON.stringify(header));
const pad = (4 - ((4 + json.length) % 4)) % 4;
json = Buffer.concat([json, Buffer.alloc(pad, 32)]);
const len = Buffer.alloc(4);
len.writeUInt32LE(json.length, 0);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, Buffer.concat([len, json, Buffer.from(pos.buffer), Buffer.from(hq.buffer), Buffer.from(tq.buffer)])); // prettier-ignore
console.log(`${outPath}: ${n} of the ${inBox || n} gas particles in ±${half} kpc (of ${n0}), T ${tmin.toExponential(1)}–${tmax.toExponential(1)} K, ${(fs.statSync(outPath).size / 1e6).toFixed(2)} MB`); // prettier-ignore
