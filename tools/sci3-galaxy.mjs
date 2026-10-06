#!/usr/bin/env node
// Lane Science r3: more galaxies for "Galaxy in a box", and their stars for
// the telescope view. Each is a FIRE-2 snapshot (CC BY 4.0, FlatHUB; the
// release's citation is in the file's header), read with jsfive as
// tools/sci-galaxy.mjs reads m12i's gas, with the same center (a shrinking
// sphere on the stars) and the same turn (the cool gas's spin up, +y).
//
//   node --max-old-space-size=12000 tools/sci3-galaxy.mjs <sim> [--gas] [--stars]
//
// <sim> is one of SIMS below; its files are in .cache/sci3/fire/ (the tool
// prints the curl lines when they are missing). --gas writes the gas file
// (tools/sci-galaxy.mjs's format, "splashery-sph-gas-1"); --stars writes the
// stars ("splashery-stars-1": a uint32 byte length, a JSON header padded to 4
// bytes, then n × 3 int16 positions in units of half / 32767 kpc, n uint16
// ages, log10(age / yr) = 6 + 4.5 v / 65535, and n uint16 masses,
// log10(m / M☉) = 2 + 6 v / 65535). Ages come from each star's formation
// scale factor and the snapshot's cosmology (flat ΛCDM: t(a) = 2 / (3 H₀
// √Ω_Λ) · asinh(√(Ω_Λ / Ω_m) a^1.5)).

import fs from "node:fs";
import path from "node:path";
import * as hdf5 from "jsfive";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const BASE = "https://users.flatironinstitute.org/~mgrudic/fire2_public_release/core";
const DIR = ".cache/sci3/fire";
export const SIMS = {
  m12i: {
    name: "FIRE-2 m12i (res7100), snapshot 600 (z = 0)",
    cite: "m12i: Wetzel et al. (2016).",
    files: [0, 1, 2, 3].map((i) => [`m12i_600.${i}.hdf5`, `${BASE}/m12i_res7100/output/snapdir_600/snapshot_600.${i}.hdf5`]), // prettier-ignore
    half: 20,
    halfY: 6,
    out: "m12i",
  },
  "m12i-z2": {
    name: "FIRE-2 m12i (res7100), snapshot 172 (z = 2, 10.4 billion years ago)",
    cite: "m12i: Wetzel et al. (2016).",
    files: [0, 1, 2, 3].map((i) => [`m12i_172.${i}.hdf5`, `${BASE}/m12i_res7100/output/snapdir_172/snapshot_172.${i}.hdf5`]), // prettier-ignore
    half: 12,
    halfY: 12,
    out: "m12i-z2",
  },
  m11h: {
    name: "FIRE-2 m11h (res7100), snapshot 600 (z = 0)",
    cite: "m11h: El-Badry et al. (2018).",
    files: [[`m11h_600.hdf5`, `${BASE}/m11h_res7100/output/snapshot_600.hdf5`]],
    half: 8,
    halfY: 8,
    out: "m11h",
  },
};
const simId = args.find((a) => !a.startsWith("--"));
const SIM = SIMS[simId];
if (!SIM) throw new Error(`Usage: tools/sci3-galaxy.mjs <${Object.keys(SIMS).join("|")}> [--gas] [--stars]`); // prettier-ignore
const wantGas = args.includes("--gas");
const wantStars = args.includes("--stars");
const half = Number(opt("half", SIM.half));
const halfY = Number(opt("half-y", SIM.halfY));
const mostGas = Number(opt("keep", 300000));
const mostStars = Number(opt("keep-stars", 250000));
const inputs = SIM.files.map(([f, url]) => {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) throw new Error(`Download it first: curl -L -o ${p} ${url}`);
  return p;
});
// (Read in pieces: readFileSync stops at 2 GB, and m11h's one file is 2.9.)
function readBig(file) {
  const size = fs.statSync(file).size;
  const buf = Buffer.allocUnsafe(size);
  const fd = fs.openSync(file, "r");
  for (let o = 0; o < size; ) o += fs.readSync(fd, buf, o, Math.min(1 << 30, size - o), o);
  fs.closeSync(fd);
  return buf;
}
const open = (file) => {
  const buf = readBig(file);
  const ab = buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength ? buf.buffer : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); // prettier-ignore
  return new hdf5.File(ab, path.basename(file));
};

// ---- The center and the turn (as tools/sci-galaxy.mjs finds them) ----

let head = null;
let starList = [];
for (const file of inputs) {
  const f = open(file);
  head ??= f.get("Header").attrs;
  if (f.keys.includes("PartType4")) starList.push(Float64Array.from(f.get("PartType4/Coordinates").value)); // prettier-ignore
}
const hub = head.HubbleParam;
const aNow = head.Time;
const toKpc = aNow / hub;
console.log(`${SIM.name}: z = ${head.Redshift.toFixed(3)}, ${head.NumPart_Total[0]} gas, ${head.NumPart_Total[4]} stars`); // prettier-ignore
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

const MP = 1.6726e-24;
const KB = 1.380649e-16;
const tempOf = (u, ne) => {
  const X = 0.76;
  const mu = 4 / (1 + 3 * X + 4 * X * ne);
  return ((2 / 3) * u * 1e10 * mu * MP) / KB;
};
const reach = Math.max(half, halfY) * Math.sqrt(3);
const gas = [];
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
    gas.push({ p, v: [gv[i * 3], gv[i * 3 + 1], gv[i * 3 + 2]], m: mass[i], h: hs[i] * toKpc, T: tempOf(u[i], ne[i]) }); // prettier-ignore
  }
}
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
const ref = Math.abs(ly[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]; // prettier-ignore
const unit = (v) => v.map((x) => x / Math.hypot(...v));
const ez = unit(cross(ref, ly));
const ex = cross(ly, ez);
const rot = (p) => [ex, ly, ez].map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
const center = c.map((v) => v * toKpc);
console.log(`center ${center.map((v) => v.toFixed(2)).join(", ")} kpc, spin ${ly.map((v) => v.toFixed(4)).join(", ")}`); // prettier-ignore

const cite = `We use the publicly-available FIRE-2 cosmological zoom-in simulations (Wetzel et al. 2023, 2025), from the Feedback In Realistic Environments (FIRE) project, generated using the Gizmo code (Hopkins 2015) and the FIRE-2 physics model (Hopkins et al. 2018). ${SIM.cite}`; // prettier-ignore
const inBox = (p) => Math.abs(p[0]) < half && Math.abs(p[1]) < halfY && Math.abs(p[2]) < half;
function write(file, header, arrays) {
  let json = Buffer.from(JSON.stringify(header));
  const pad = (4 - ((4 + json.length) % 4)) % 4;
  json = Buffer.concat([json, Buffer.alloc(pad, 32)]);
  const len = Buffer.alloc(4);
  len.writeUInt32LE(json.length, 0);
  fs.writeFileSync(file, Buffer.concat([len, json, ...arrays.map((a) => Buffer.from(a.buffer))]));
}
let seed = 12345;
const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---- The gas (tools/sci-galaxy.mjs's format and thinning) ----

if (wantGas) {
  const keep = [];
  for (const g of gas) {
    const p = rot(g.p);
    if (inBox(p)) keep.push([g, p]);
  }
  const DENSE_SHARE = 0.65;
  let nDense = keep.length;
  let widenRest = 1;
  const all = keep.length;
  if (keep.length > mostGas) {
    keep.sort((p, q) => p[0].h - q[0].h);
    nDense = Math.round(mostGas * DENSE_SHARE);
    const rest = shuffle(keep.slice(nDense));
    widenRest = Math.cbrt(rest.length / (mostGas - nDense));
    keep.length = nDense;
    keep.push(...rest.slice(0, mostGas - nDense));
  }
  const n = keep.length;
  const pos = new Int16Array(n * 3);
  const hq = new Uint16Array(n);
  const tq = new Uint16Array(n);
  const H = Math.max(half, halfY);
  keep.forEach(([g, p], j) => {
    for (let k = 0; k < 3; k++) pos[j * 3 + k] = Math.round((p[k] / H) * 32767);
    hq[j] = Math.max(0, Math.min(65535, Math.round((Math.log2(g.h) + 8) * 4096)));
    tq[j] = Math.max(0, Math.min(65535, Math.round(((Math.log10(Math.max(10, g.T)) - 1) / 8) * 65535))); // prettier-ignore
  });
  const out = `assets/toys/galaxy-box/${SIM.out}-gas.bin`;
  write(out, { format: "splashery-sph-gas-1", simulation: SIM.name, source: BASE, license: "CC BY 4.0", cite, half: H, halfY, n, inBox: all, nDense, widenRest, of: n0, center, spin: ly, redshift: head.Redshift }, [pos, hq, tq]); // prettier-ignore
  console.log(
    `${out}: ${n} of ${all} gas particles, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`,
  );
}

// ---- The stars ----

if (wantStars) {
  // Cosmic time (Gyr) at scale factor a, flat ΛCDM.
  const Om = head.Omega0;
  const OL = head.OmegaLambda;
  const H0 = (100 * hub) / 3.0857e19; // 1/s
  const GYR = 3.15576e16;
  const tOf = (a) => ((2 / (3 * H0 * Math.sqrt(OL))) * Math.asinh(Math.sqrt(OL / Om) * a ** 1.5)) / GYR; // prettier-ignore
  const tNow = tOf(aNow);
  const stars = [];
  let all = 0;
  for (const file of inputs) {
    const f = open(file);
    if (!f.keys.includes("PartType4")) continue;
    const xs = f.get("PartType4/Coordinates").value;
    const ms = f.get("PartType4/Masses").value;
    const af = f.get("PartType4/StellarFormationTime").value;
    for (let i = 0; i < ms.length; i++) {
      const p = rot([0, 1, 2].map((k) => (xs[i * 3 + k] - c[k]) * toKpc));
      if (!inBox(p)) continue;
      all++;
      const age = Math.max(1e-3, tNow - tOf(af[i])); // Gyr
      stars.push([p, age, ms[i] * 1e10 / hub]); // prettier-ignore
    }
  }
  shuffle(stars);
  const kept = stars.slice(0, mostStars);
  const n = kept.length;
  const pos = new Int16Array(n * 3);
  const aq = new Uint16Array(n);
  const mq = new Uint16Array(n);
  const H = Math.max(half, halfY);
  kept.forEach(([p, age, m], j) => {
    for (let k = 0; k < 3; k++) pos[j * 3 + k] = Math.round((p[k] / H) * 32767);
    aq[j] = Math.max(0, Math.min(65535, Math.round(((Math.log10(age * 1e9) - 6) / 4.5) * 65535)));
    mq[j] = Math.max(0, Math.min(65535, Math.round(((Math.log10(m) - 2) / 6) * 65535)));
  });
  const out = `assets/toys/galaxy-box/${SIM.out}-stars.bin`;
  write(out, { format: "splashery-stars-1", simulation: SIM.name, source: BASE, license: "CC BY 4.0", cite, half: H, halfY, n, inBox: all, center, spin: ly, redshift: head.Redshift, age: tNow }, [pos, aq, mq]); // prettier-ignore
  console.log(
    `${out}: ${n} of ${all} star particles, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`,
  );
}
