// 3D coordinates for a molecule graph, with no outside libraries.
//
// embed3D(graph, { seed }) returns [x, y, z] in ångströms for every atom.
// It works in four steps:
//
//   1. Split the molecule into connected pieces. Each piece is embedded on
//      its own and the pieces are laid side by side.
//   2. First guess: heavy atoms are laid out from their through-bond
//      distances (classical multidimensional scaling), saturated six-rings
//      get a chair pucker, and hydrogens go where the ideal geometry of
//      their atom puts them.
//   3. Relax with a small force field: bond lengths from covalent radii and
//      bond order, angles from hybridisation (sp 180°, sp2 120°, sp3 109.5°),
//      flat sp2 centres and flat conjugated rings, a mild preference for
//      staggered and trans torsions, and soft repulsion between atoms that
//      are not bonded.
//   4. Repeat from a few seeded starts and keep the lowest energy.
//
// Everything is deterministic for a given seed. Stereo is not kept: each
// stereocentre comes out whichever way the relaxation settles.

import { mulberry32, mixSeed } from "../noise.js";
import { element, covalentRadius } from "./elements.js";
import { parseSmiles, withHydrogens, ringBondFlags, adjacency } from "./smiles.js";

const DEG = Math.PI / 180;

// Force constants. Units are roughly kcal/mol and ångströms; only the ratios
// matter, since the energy is used for shape and for picking the best start.
const K_BOND = 400; // (r − r0)²
const K_ANGLE = 90; // (cos θ − cos θ0)²
const K_LINEAR = 120; // (1 + cos θ) for linear centres
const K_IMPROPER = 6; // (signed volume)² keeps sp2 centres flat
const K_PLANAR = 4; // (1 − cos 2φ) across double and aromatic bonds
const K_CONJ = 1.2; // the same across single bonds between sp2 atoms
const K_AMIDE = 3; // ... and across amide C–N bonds
const K_STAGGER = 0.25; // (1 + cos 3φ) across sp3–sp3 bonds
const K_TRANS = 0.3; // (1 + cos φ) between heavy atoms across sp3–sp3 bonds
const K_REPEL = 10; // (d0 − d)² for non-bonded atoms closer than contact
const K_SPHERE = 30; // 1/d² between the neighbours of 5- and 6-coordinate atoms

// Bond length factors by bond order, applied to the sum of covalent radii.
const ORDER_FACTOR = { 1: 1, 2: 0.87, 3: 0.78, 4: 0.78 };
const AROMATIC_FACTOR = 0.917; // C–C 1.39 Å
const CONJUGATED_FACTOR = 0.96; // single bonds between sp2 atoms

// ---- Small vector helpers -----------------------------------------------------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0];
};
const at = (x, i) => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
const put = (x, i, p) => {
  x[3 * i] = p[0];
  x[3 * i + 1] = p[1];
  x[3 * i + 2] = p[2];
};

// Any unit vector at right angles to `a`.
const perpendicular = (a, rng) => {
  const r = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
  const p = sub(r, scale(a, dot(r, a)));
  return len(p) > 1e-3 ? unit(p) : unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
};

// ---- Reading the graph: rings, aromaticity, hybridisation ---------------------------

// For each ring bond, the shortest ring through it (atoms in ring order).
// Together these cover every small ring of fused systems.
function smallRings(n, adj, inRing, maxSize = 8) {
  const rings = [];
  const seen = new Set();
  const parent = new Int32Array(n);
  const depth = new Int32Array(n);
  adj.forEach((edges, a) => {
    for (const { to: b, bond } of edges) {
      if (b < a || !inRing[bond]) continue;
      parent.fill(-2);
      parent[a] = -1;
      depth[a] = 0;
      const queue = [a];
      let found = false;
      for (let q = 0; q < queue.length && !found; q++) {
        const v = queue[q];
        if (depth[v] >= maxSize - 1) continue;
        for (const e of adj[v]) {
          if (e.bond === bond || !inRing[e.bond] || parent[e.to] !== -2) continue;
          parent[e.to] = v;
          depth[e.to] = depth[v] + 1;
          if (e.to === b) {
            found = true;
            break;
          }
          queue.push(e.to);
        }
      }
      if (!found) continue;
      const ring = [];
      for (let v = b; v !== -1; v = parent[v]) ring.push(v);
      const key = [...ring].sort((p, q) => p - q).join(",");
      if (!seen.has(key)) {
        seen.add(key);
        rings.push(ring);
      }
    }
  });
  return rings;
}

// Works out what the force field needs to know about each atom and bond.
function perceive(atoms, bonds) {
  const n = atoms.length;
  const adj = adjacency(n, bonds);
  const inRing = ringBondFlags(n, bonds);
  const rings = smallRings(n, adj, inRing);
  const bondAt = new Map();
  bonds.forEach(([a, b], k) => bondAt.set(a * n + b, k).set(b * n + a, k));
  const bondIndex = (a, b) => bondAt.get(a * n + b) ?? -1;

  const aroBond = new Uint8Array(bonds.length);
  bonds.forEach(([a, b], k) => {
    if (inRing[k] && atoms[a].aromatic && atoms[b].aromatic) aroBond[k] = 1;
  });
  // Rings written in Kekulé form (C1=CC=CC=C1) count as aromatic too, so
  // their bonds get one even length.
  const doubles = (i) => adj[i].filter((e) => bonds[e.bond][2] === 2);
  for (const ring of rings) {
    const ringBonds = ring.map((v, i) => bondIndex(v, ring[(i + 1) % ring.length]));
    if (ringBonds.every((k) => aroBond[k])) continue;
    let aromatic = false;
    if (ring.length === 6) {
      aromatic = ring.every((v) => {
        const d = doubles(v);
        return d.length === 1 && inRing[d[0].bond];
      });
    } else if (ring.length === 5) {
      const inside = ringBonds.filter((k) => bonds[k][2] === 2);
      const covered = new Set(inside.flatMap((k) => bonds[k].slice(0, 2)));
      const rest = ring.filter((v) => !covered.has(v));
      aromatic =
        inside.length === 2 &&
        covered.size === 4 &&
        rest.length === 1 &&
        (["O", "S", "Se"].includes(atoms[rest[0]].el)
          ? adj[rest[0]].length === 2
          : atoms[rest[0]].el === "N" && adj[rest[0]].length === 3);
    }
    if (aromatic) for (const k of ringBonds) aroBond[k] = 1;
  }
  const aroAtom = new Uint8Array(n);
  bonds.forEach(([a, b], k) => {
    if (aroBond[k]) aroAtom[a] = aroAtom[b] = 1;
  });

  // Lone pairs and hybridisation (a light VSEPR count).
  const orderSum = new Float64Array(n);
  const unsat = new Uint8Array(n);
  for (const [a, b, order] of bonds) {
    orderSum[a] += order;
    orderSum[b] += order;
    if (order >= 2) unsat[a] = unsat[b] = 1;
  }
  const lonePairs = new Int32Array(n);
  const hyb = atoms.map((atom, i) => {
    if (aroAtom[i]) unsat[i] = 1;
    const ve = element(atom.el)?.ve;
    const nb = adj[i].length;
    if (ve == null) return nb >= 2 ? "sphere" : "none";
    const lp = Math.max(0, Math.floor((ve - (atom.charge || 0) - orderSum[i]) / 2));
    lonePairs[i] = atom.el === "H" ? 0 : lp;
    const steric = nb + lonePairs[i];
    if (aroAtom[i] && nb <= 3) return "sp2";
    if (steric === 5 && nb === 2) return "sp"; // XeF2, I3-
    if (nb >= 5 || (steric >= 5 && nb >= 3)) return "sphere";
    if (steric <= 2) return "sp";
    return steric === 3 ? "sp2" : "sp3";
  });
  // A lone pair next to a double bond joins the π system: amide and aniline
  // N go flat, ester and phenol O open their angle.
  atoms.forEach((atom, i) => {
    if (hyb[i] !== "sp3" || !lonePairs[i] || adj[i].length > 3) return;
    if (atom.el !== "N" && atom.el !== "O") return;
    if (adj[i].some((e) => unsat[e.to] && hyb[e.to] !== "sp")) hyb[i] = "sp2";
  });
  return { n, adj, inRing, rings, aroBond, aroAtom, hyb, lonePairs, unsat, bondIndex };
}

// Ideal bond length from covalent radii and bond order.
function bondLength(atoms, info, k, [a, b, order]) {
  const sum = covalentRadius(atoms[a].el) + covalentRadius(atoms[b].el);
  if (info.aroBond[k]) return sum * AROMATIC_FACTOR;
  if (order === 1 && info.hyb[a] === "sp2" && info.hyb[b] === "sp2") return sum * CONJUGATED_FACTOR;
  return sum * (ORDER_FACTOR[order] ?? 1);
}

// The natural angle at centre j, before ring corrections.
function baseAngle(atoms, info, j) {
  const h = info.hyb[j];
  if (h === "sp") return 180;
  const el = atoms[j].el;
  if (h === "sp2") return el === "O" ? 117 : 120;
  if (!info.lonePairs[j]) return 109.47;
  if (el === "O") return 107.5;
  if (el === "N") return 108;
  return 100; // S, P, Se ... with a lone pair
}

// Size of the smallest ring (up to 6) holding the angle a–j–b, or 0.
function angleRingSize(info, a, j, b, scratch) {
  const { adj, inRing, bondIndex } = info;
  if (!inRing[bondIndex(a, j)] || !inRing[bondIndex(j, b)]) return 0;
  const { mark, queue } = scratch;
  const stamp = ++scratch.stamp;
  mark[j] = stamp;
  mark[a] = stamp;
  queue[0] = a;
  scratch.depth[a] = 0;
  for (let head = 0, tail = 1; head < tail; head++) {
    const v = queue[head];
    const d = scratch.depth[v];
    if (d >= 4) break;
    for (const e of adj[v]) {
      if (e.to === b) return d + 3;
      if (mark[e.to] === stamp) continue;
      mark[e.to] = stamp;
      scratch.depth[e.to] = d + 1;
      queue[tail++] = e.to;
    }
  }
  return 0;
}

// ---- The force field ----------------------------------------------------------

function buildForceField(atoms, bonds, info) {
  const { n, adj, hyb, aroBond, inRing } = info;
  const heavy = atoms.map((a) => a.el !== "H");

  // Bonds.
  const bondR0 = new Float64Array(bonds.length);
  bonds.forEach((b, k) => (bondR0[k] = bondLength(atoms, info, k, b)));

  // Angles.
  const ang = { i: [], j: [], k: [], cos0: [], linear: [] };
  const sphere = [];
  const scratch = {
    mark: new Int32Array(n),
    depth: new Int32Array(n),
    queue: new Int32Array(n),
    stamp: 0,
  };
  const targets = new Map(); // "a,j,b" -> degrees, reused by the first guess
  for (let j = 0; j < n; j++) {
    const nbs = adj[j].map((e) => e.to);
    if (nbs.length < 2) continue;
    if (hyb[j] === "sphere" || hyb[j] === "none") {
      for (let p = 0; p < nbs.length; p++)
        for (let q = p + 1; q < nbs.length; q++) sphere.push(nbs[p], nbs[q]);
      continue;
    }
    const base = baseAngle(atoms, info, j);
    const pairs = [];
    for (let p = 0; p < nbs.length; p++)
      for (let q = p + 1; q < nbs.length; q++) {
        const size = angleRingSize(info, nbs[p], j, nbs[q], scratch);
        let theta = base;
        let fixed = false;
        if (size && hyb[j] === "sp2") {
          theta = [60, 90, 108, 120][size - 3];
          fixed = true;
        } else if (size && size < 6 && hyb[j] === "sp3") theta = [60, 89, 104.5][size - 3];
        pairs.push({ a: nbs[p], b: nbs[q], theta, fixed });
      }
    // A flat centre's three angles add up to 360°: the ring ones are set, the
    // others share what is left (126° outside a five-ring).
    if (hyb[j] === "sp2" && nbs.length === 3) {
      const fixed = pairs.filter((p) => p.fixed);
      const free = pairs.filter((p) => !p.fixed);
      if (fixed.length && free.length) {
        const left = (360 - fixed.reduce((s, p) => s + p.theta, 0)) / free.length;
        for (const p of free) p.theta = Math.min(150, Math.max(100, left));
      }
    }
    for (const { a, b, theta } of pairs) {
      ang.i.push(a);
      ang.j.push(j);
      ang.k.push(b);
      ang.cos0.push(Math.cos(theta * DEG));
      ang.linear.push(theta >= 179 ? 1 : 0);
      targets.set(`${a},${j},${b}`, theta).set(`${b},${j},${a}`, theta);
    }
  }

  // Flat sp2 centres.
  const imp = [];
  for (let j = 0; j < n; j++)
    if (hyb[j] === "sp2" && adj[j].length === 3) imp.push(j, ...adj[j].map((e) => e.to));

  // Torsions: [i, j, k, l, k1, k2, k3] for k1(1+cos φ) + k2(1−cos 2φ) + k3(1+cos 3φ).
  const tor = [];
  const isAmide = (a, b) =>
    atoms[a].el === "N" &&
    atoms[b].el === "C" &&
    adj[b].some((e) => bonds[e.bond][2] === 2 && ["O", "S"].includes(atoms[e.to].el));
  bonds.forEach(([a, b, order], k) => {
    const ok = (v) => ["sp2", "sp3"].includes(hyb[v]) && adj[v].length >= 2;
    if (!ok(a) || !ok(b)) return;
    let k2 = 0;
    let k3 = 0;
    let trans = false;
    if (order >= 2 || aroBond[k]) k2 = K_PLANAR;
    else if (hyb[a] === "sp2" && hyb[b] === "sp2")
      k2 = isAmide(a, b) || isAmide(b, a) ? K_AMIDE : K_CONJ;
    else if (hyb[a] === "sp3" && hyb[b] === "sp3") {
      k3 = K_STAGGER;
      trans = !inRing[k]; // rings cannot all be trans
    } else return;
    for (const { to: i } of adj[a]) {
      if (i === b) continue;
      for (const { to: l } of adj[b]) {
        if (l === a || l === i) continue;
        const k1 = trans && heavy[i] && heavy[l] ? K_TRANS : 0;
        tor.push(i, a, b, l, k1, k2, k3);
      }
    }
  });

  // Through-bond separation (1, 2, 3, or 0 for further) for the repulsion.
  const topo = new Uint8Array(n * n);
  for (let s = 0; s < n; s++) {
    let frontier = [s];
    topo[s * n + s] = 255;
    for (let d = 1; d <= 3 && frontier.length; d++) {
      const next = [];
      for (const v of frontier)
        for (const { to } of adj[v]) {
          if (topo[s * n + to]) continue;
          topo[s * n + to] = d;
          next.push(to);
        }
      frontier = next;
    }
  }
  const contact = atoms.map((a) => 0.7 + covalentRadius(a.el));

  return {
    n,
    bondR0,
    targets,
    energy: makeEnergy({ atoms, bonds, bondR0, ang, imp, tor, sphere, topo, contact }),
  };
}

// Adds s·(dx, dy, dz) to the gradient of the atom whose x sits at index i.
const addGrad = (g, i, s, dx, dy, dz) => {
  g[i] += s * dx;
  g[i + 1] += s * dy;
  g[i + 2] += s * dz;
};

// The energy function: (x, g) => energy, filling g with the gradient. x and
// g are flat [x0, y0, z0, x1, ...] arrays. Written out longhand for speed.
function makeEnergy({ bonds, bondR0, ang, imp, tor, sphere, topo, contact }) {
  const n = contact.length;
  const bI = Int32Array.from(bonds, (b) => b[0]);
  const bJ = Int32Array.from(bonds, (b) => b[1]);
  const aI = Int32Array.from(ang.i);
  const aJ = Int32Array.from(ang.j);
  const aK = Int32Array.from(ang.k);
  const aC = Float64Array.from(ang.cos0);
  const aL = Uint8Array.from(ang.linear);
  const im = Int32Array.from(imp);
  const tI = Int32Array.from(tor.filter((v, i) => i % 7 < 4));
  const tK = Float64Array.from(tor.filter((v, i) => i % 7 >= 4));
  const sp = Int32Array.from(sphere);

  // Non-bonded pairs within reach, rebuilt when atoms have moved far enough.
  const SKIN = 1.2;
  let pairs = new Int32Array(0);
  let pairD0 = new Float64Array(0);
  let pairK = new Float64Array(0);
  let pairCount = 0;
  const ref = new Float64Array(3 * n).fill(Infinity);
  const maxContact = Math.max(...contact) * 2;
  const rebuild = (x) => {
    const list = [];
    const d0s = [];
    const ks = [];
    const reach = maxContact + SKIN;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const t = topo[i * n + j];
        if (t === 1 || t === 2) continue;
        const dx = x[3 * j] - x[3 * i];
        const dy = x[3 * j + 1] - x[3 * i + 1];
        const dz = x[3 * j + 2] - x[3 * i + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > reach * reach) continue;
        const d0 = (contact[i] + contact[j]) * (t === 3 ? 0.8 : 1);
        if (d2 > (d0 + SKIN) * (d0 + SKIN)) continue;
        list.push(i, j);
        d0s.push(d0);
        ks.push(t === 3 ? K_REPEL * 0.5 : K_REPEL);
      }
    pairs = Int32Array.from(list);
    pairD0 = Float64Array.from(d0s);
    pairK = Float64Array.from(ks);
    pairCount = d0s.length;
    ref.set(x);
  };
  const needsRebuild = (x) => {
    const limit = (SKIN / 2) ** 2;
    for (let i = 0; i < 3 * n; i += 3) {
      const dx = x[i] - ref[i];
      const dy = x[i + 1] - ref[i + 1];
      const dz = x[i + 2] - ref[i + 2];
      if (!(dx * dx + dy * dy + dz * dz <= limit)) return true;
    }
    return false;
  };

  return (x, g) => {
    if (needsRebuild(x)) rebuild(x);
    g.fill(0);
    let e = 0;

    for (let b = 0; b < bI.length; b++) {
      const i = 3 * bI[b];
      const j = 3 * bJ[b];
      const dx = x[j] - x[i];
      const dy = x[j + 1] - x[i + 1];
      const dz = x[j + 2] - x[i + 2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      const dr = r - bondR0[b];
      e += K_BOND * dr * dr;
      const f = (2 * K_BOND * dr) / r;
      addGrad(g, j, f, dx, dy, dz);
      addGrad(g, i, -f, dx, dy, dz);
    }

    for (let a = 0; a < aI.length; a++) {
      const i = 3 * aI[a];
      const j = 3 * aJ[a];
      const k = 3 * aK[a];
      const ux = x[i] - x[j];
      const uy = x[i + 1] - x[j + 1];
      const uz = x[i + 2] - x[j + 2];
      const vx = x[k] - x[j];
      const vy = x[k + 1] - x[j + 1];
      const vz = x[k + 2] - x[j + 2];
      const lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1e-9;
      const lv = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9;
      const c = (ux * vx + uy * vy + uz * vz) / (lu * lv);
      let dEdc;
      if (aL[a]) {
        e += K_LINEAR * (1 + c);
        dEdc = K_LINEAR;
      } else {
        const dc = c - aC[a];
        e += K_ANGLE * dc * dc;
        dEdc = 2 * K_ANGLE * dc;
      }
      // d(cos θ)/d(end atom) for each end; the centre takes minus both.
      const iuv = 1 / (lu * lv);
      const cu = c / (lu * lu);
      const cv = c / (lv * lv);
      const ax = vx * iuv - ux * cu;
      const ay = vy * iuv - uy * cu;
      const az = vz * iuv - uz * cu;
      const bx = ux * iuv - vx * cv;
      const by = uy * iuv - vy * cv;
      const bz = uz * iuv - vz * cv;
      addGrad(g, i, dEdc, ax, ay, az);
      addGrad(g, k, dEdc, bx, by, bz);
      addGrad(g, j, -dEdc, ax + bx, ay + by, az + bz);
    }

    // Flatness: the signed volume of centre + three neighbours goes to zero.
    for (let m = 0; m < im.length; m += 4) {
      const c = 3 * im[m];
      const p = 3 * im[m + 1];
      const q = 3 * im[m + 2];
      const r = 3 * im[m + 3];
      const ux = x[p] - x[c];
      const uy = x[p + 1] - x[c + 1];
      const uz = x[p + 2] - x[c + 2];
      const vx = x[q] - x[c];
      const vy = x[q + 1] - x[c + 1];
      const vz = x[q + 2] - x[c + 2];
      const wx = x[r] - x[c];
      const wy = x[r + 1] - x[c + 1];
      const wz = x[r + 2] - x[c + 2];
      // The volume's gradients are v × w, w × u and u × v.
      const ax = vy * wz - vz * wy;
      const ay = vz * wx - vx * wz;
      const az = vx * wy - vy * wx;
      const bx = wy * uz - wz * uy;
      const by = wz * ux - wx * uz;
      const bz = wx * uy - wy * ux;
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      const vol = ux * ax + uy * ay + uz * az;
      e += K_IMPROPER * vol * vol;
      const f = 2 * K_IMPROPER * vol;
      addGrad(g, p, f, ax, ay, az);
      addGrad(g, q, f, bx, by, bz);
      addGrad(g, r, f, cx, cy, cz);
      addGrad(g, c, -f, ax + bx + cx, ay + by + cy, az + bz + cz);
    }

    // Torsions i–j–k–l, with the dihedral's gradient from Bekker's formulas
    // (as in GROMACS). m and n are the normals of the two planes.
    for (let t = 0, s = 0; t < tI.length; t += 4, s += 3) {
      const i = 3 * tI[t];
      const j = 3 * tI[t + 1];
      const k = 3 * tI[t + 2];
      const l = 3 * tI[t + 3];
      const fx = x[i] - x[j];
      const fy = x[i + 1] - x[j + 1];
      const fz = x[i + 2] - x[j + 2];
      const gx = x[k] - x[j];
      const gy = x[k + 1] - x[j + 1];
      const gz = x[k + 2] - x[j + 2];
      const hx = x[k] - x[l];
      const hy = x[k + 1] - x[l + 1];
      const hz = x[k + 2] - x[l + 2];
      const mx = fy * gz - fz * gy;
      const my = fz * gx - fx * gz;
      const mz = fx * gy - fy * gx;
      const nx = gy * hz - gz * hy;
      const ny = gz * hx - gx * hz;
      const nz = gx * hy - gy * hx;
      const m2 = mx * mx + my * my + mz * mz;
      const n2 = nx * nx + ny * ny + nz * nz;
      const g2 = gx * gx + gy * gy + gz * gz;
      if (m2 < 1e-8 || n2 < 1e-8 || g2 < 1e-8) continue;
      const gl = Math.sqrt(g2);
      // cos φ and sin φ straight from the normals, then 2φ and 3φ by the
      // double- and triple-angle formulas (no trig calls in the loop).
      const mn = Math.sqrt(m2 * n2);
      const c1 = (mx * nx + my * ny + mz * nz) / mn;
      const s1 = (gl * (fx * nx + fy * ny + fz * nz)) / mn;
      const c2 = 2 * c1 * c1 - 1;
      const s2 = 2 * s1 * c1;
      const c3 = c1 * (4 * c1 * c1 - 3);
      const s3 = s1 * (3 - 4 * s1 * s1);
      const k1 = tK[s];
      const k2 = tK[s + 1];
      const k3 = tK[s + 2];
      e += k1 * (1 + c1) + k2 * (1 - c2) + k3 * (1 + c3);
      const dV = -k1 * s1 + 2 * k2 * s2 - 3 * k3 * s3;
      const fi = (-dV * gl) / m2;
      const fl = (dV * gl) / n2;
      const p = (fx * gx + fy * gy + fz * gz) / g2;
      const q = (hx * gx + hy * gy + hz * gz) / g2;
      addGrad(g, i, -fi, mx, my, mz);
      addGrad(g, l, -fl, nx, ny, nz);
      addGrad(g, j, (1 - p) * fi, mx, my, mz);
      addGrad(g, j, q * fl, nx, ny, nz);
      addGrad(g, k, (1 - q) * fl, nx, ny, nz);
      addGrad(g, k, p * fi, mx, my, mz);
    }

    // Neighbours of 5- and 6-coordinate atoms push apart evenly.
    for (let m = 0; m < sp.length; m += 2) {
      const i = 3 * sp[m];
      const j = 3 * sp[m + 1];
      const dx = x[j] - x[i];
      const dy = x[j + 1] - x[i + 1];
      const dz = x[j + 2] - x[i + 2];
      const d2 = dx * dx + dy * dy + dz * dz + 1e-6;
      e += K_SPHERE / d2;
      const f = (-2 * K_SPHERE) / (d2 * d2);
      addGrad(g, j, f, dx, dy, dz);
      addGrad(g, i, -f, dx, dy, dz);
    }

    // Soft repulsion between atoms that are not bonded.
    for (let m = 0; m < pairCount; m++) {
      const i = 3 * pairs[2 * m];
      const j = 3 * pairs[2 * m + 1];
      const dx = x[j] - x[i];
      const dy = x[j + 1] - x[i + 1];
      const dz = x[j + 2] - x[i + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      const d0 = pairD0[m];
      if (d2 >= d0 * d0) continue;
      const d = Math.sqrt(d2) || 1e-9;
      const dd = d0 - d;
      e += pairK[m] * dd * dd;
      const f = (-2 * pairK[m] * dd) / d;
      addGrad(g, j, f, dx, dy, dz);
      addGrad(g, i, -f, dx, dy, dz);
    }
    return e;
  };
}

// Limited-memory BFGS with a backtracking line search. Moves x in place and
// returns the final energy.
function minimize(energy, x, { maxIter = 500, gtol = 0.02, maxStep = 0.4 } = {}) {
  const size = x.length;
  const M = 7;
  const S = Array.from({ length: M }, () => new Float64Array(size));
  const Y = Array.from({ length: M }, () => new Float64Array(size));
  const rho = new Float64Array(M);
  const alpha = new Float64Array(M);
  let stored = 0;
  let newest = -1;
  const g = new Float64Array(size);
  const d = new Float64Array(size);
  const xt = new Float64Array(size);
  const gt = new Float64Array(size);
  let f = energy(x, g);
  let resets = 0;
  for (let it = 0; it < maxIter; it++) {
    let gmax = 0;
    for (let i = 0; i < size; i++) gmax = Math.max(gmax, Math.abs(g[i]));
    if (gmax < gtol) break;

    // Two-loop recursion for the search direction.
    for (let i = 0; i < size; i++) d[i] = -g[i];
    for (let c = 0; c < stored; c++) {
      const m = (newest - c + M) % M;
      let a = 0;
      for (let i = 0; i < size; i++) a += S[m][i] * d[i];
      a *= rho[m];
      alpha[m] = a;
      for (let i = 0; i < size; i++) d[i] -= a * Y[m][i];
    }
    if (stored) {
      let sy = 0;
      let yy = 0;
      for (let i = 0; i < size; i++) {
        sy += S[newest][i] * Y[newest][i];
        yy += Y[newest][i] * Y[newest][i];
      }
      const gamma = sy / yy;
      for (let i = 0; i < size; i++) d[i] *= gamma;
    } else {
      for (let i = 0; i < size; i++) d[i] *= 0.1 / gmax;
    }
    for (let c = stored - 1; c >= 0; c--) {
      const m = (newest - c + M) % M;
      let b = 0;
      for (let i = 0; i < size; i++) b += Y[m][i] * d[i];
      b *= rho[m];
      for (let i = 0; i < size; i++) d[i] += (alpha[m] - b) * S[m][i];
    }
    let slope = 0;
    for (let i = 0; i < size; i++) slope += g[i] * d[i];
    if (!(slope < 0)) {
      for (let i = 0; i < size; i++) d[i] = (-g[i] * 0.1) / gmax;
      slope = 0;
      for (let i = 0; i < size; i++) slope += g[i] * d[i];
      stored = 0;
    }
    // No atom moves more than maxStep in one go.
    let longest = 0;
    for (let i = 0; i < size; i += 3)
      longest = Math.max(longest, d[i] * d[i] + d[i + 1] * d[i + 1] + d[i + 2] * d[i + 2]);
    longest = Math.sqrt(longest);
    if (longest > maxStep) {
      const s = maxStep / longest;
      for (let i = 0; i < size; i++) d[i] *= s;
      slope *= s;
    }
    let t = 1;
    let ft = Infinity;
    let accepted = false;
    for (let ls = 0; ls < 12; ls++) {
      for (let i = 0; i < size; i++) xt[i] = x[i] + t * d[i];
      ft = energy(xt, gt);
      if (ft <= f + 1e-4 * t * slope) {
        accepted = true;
        break;
      }
      t *= 0.4;
    }
    if (!accepted) {
      if (stored === 0 || ++resets > 3) break;
      stored = 0;
      continue;
    }
    newest = (newest + 1) % M;
    let sy = 0;
    for (let i = 0; i < size; i++) {
      S[newest][i] = xt[i] - x[i];
      Y[newest][i] = gt[i] - g[i];
      sy += S[newest][i] * Y[newest][i];
    }
    if (sy > 1e-10) {
      rho[newest] = 1 / sy;
      stored = Math.min(stored + 1, M);
    } else newest = (newest - 1 + M) % M;
    x.set(xt);
    g.set(gt);
    f = ft;
  }
  return f;
}

// ---- First guess ------------------------------------------------------------

// Classical multidimensional scaling: coordinates whose distances best match
// the target distance matrix D (n×n, row-major). Top three eigenvectors by
// orthogonal iteration.
function scaleDistances(D, n, rng, iterations) {
  const B = new Float64Array(n * n);
  const rowMean = new Float64Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d2 = D[i * n + j] ** 2;
      B[i * n + j] = d2;
      rowMean[i] += d2 / n;
    }
    total += rowMean[i] / n;
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      B[i * n + j] = -0.5 * (B[i * n + j] - rowMean[i] - rowMean[j] + total);
  const V = [0, 1, 2].map(() => Float64Array.from({ length: n }, () => rng() - 0.5));
  const W = [0, 1, 2].map(() => new Float64Array(n));
  const orthonormalise = (vs) => {
    vs.forEach((v, a) => {
      for (let b = 0; b < a; b++) {
        let p = 0;
        for (let i = 0; i < n; i++) p += v[i] * vs[b][i];
        for (let i = 0; i < n; i++) v[i] -= p * vs[b][i];
      }
      let l = 0;
      for (let i = 0; i < n; i++) l += v[i] * v[i];
      l = Math.sqrt(l);
      for (let i = 0; i < n; i++) v[i] = l > 1e-12 ? v[i] / l : 0;
    });
  };
  orthonormalise(V);
  const lambda = [0, 0, 0];
  for (let it = 0; it < iterations; it++) {
    for (let a = 0; a < 3; a++) {
      const v = V[a];
      const w = W[a];
      for (let i = 0; i < n; i++) {
        let s = 0;
        const row = i * n;
        for (let j = 0; j < n; j++) s += B[row + j] * v[j];
        w[i] = s;
      }
      let l = 0;
      for (let i = 0; i < n; i++) l += v[i] * w[i];
      lambda[a] = l;
    }
    for (let a = 0; a < 3; a++) V[a].set(W[a]);
    orthonormalise(V);
  }
  const x = new Float64Array(3 * n);
  for (let a = 0; a < 3; a++) {
    const s = Math.sqrt(Math.max(0, lambda[a]));
    for (let i = 0; i < n; i++) x[3 * i + a] = V[a][i] * s;
  }
  return x;
}

// Target through-bond distances: bond lengths, 1–3 distances from the ideal
// angle, and a steady stretch per bond beyond that.
function targetDistances(skeleton, info, ff) {
  const m = skeleton.length;
  const local = new Map(skeleton.map((g, i) => [g, i]));
  const D = new Float64Array(m * m);
  const { adj } = info;
  const r0 = (a, b) => ff.bondR0[info.bondIndex(a, b)];
  const depth = new Int32Array(info.n);
  const parent = new Int32Array(info.n);
  for (let si = 0; si < m; si++) {
    const s = skeleton[si];
    depth.fill(-1);
    depth[s] = 0;
    parent[s] = -1;
    const queue = [s];
    for (let q = 0; q < queue.length; q++) {
      const v = queue[q];
      for (const { to } of adj[v]) {
        if (depth[to] >= 0 || !local.has(to)) continue;
        depth[to] = depth[v] + 1;
        parent[to] = v;
        queue.push(to);
      }
    }
    for (let ti = 0; ti < m; ti++) {
      const t = skeleton[ti];
      const g = depth[t];
      let d;
      if (g <= 0) d = g === 0 ? 0 : 1.26 * m;
      else if (g === 1) d = r0(s, t);
      else if (g === 2) {
        const mid = parent[t];
        const a = r0(s, mid);
        const b = r0(mid, t);
        const theta = (ff.targets.get(`${s},${mid},${t}`) ?? 109.47) * DEG;
        d = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(theta));
      } else d = g <= 6 ? 1.26 * g : 7.56 + 0.95 * (g - 6);
      D[si * m + ti] = d;
    }
  }
  // Keep the matrix exactly symmetric.
  for (let i = 0; i < m; i++)
    for (let j = i + 1; j < m; j++) D[i * m + j] = D[j * m + i] = (D[i * m + j] + D[j * m + i]) / 2;
  return D;
}

// Nudges saturated six-rings into a chair: ring atoms alternate above and
// below the ring's plane. Fused rings share signs so they chair together.
// `placed` holds the atoms that already have positions (not hydrogens).
function puckerRings(x, info, placed) {
  const { rings, aroBond, hyb, bondIndex } = info;
  const chairs = rings.filter(
    (ring) =>
      ring.length === 6 &&
      ring.filter((v) => hyb[v] === "sp3").length >= 4 &&
      !ring.some((v, i) => aroBond[bondIndex(v, ring[(i + 1) % 6])]),
  );
  const sign = new Map();
  const normals = new Map();
  const done = new Set();
  while (done.size < chairs.length) {
    // Next ring: one touching a finished ring if possible.
    let r = chairs.findIndex((ring, i) => !done.has(i) && ring.some((v) => sign.has(v)));
    if (r < 0) r = chairs.findIndex((ring, i) => !done.has(i));
    const ring = chairs[r];
    done.add(r);
    const pts = ring.map((v) => at(x, v));
    let normal = [0, 0, 0];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % 6];
      normal[0] += (p[1] - q[1]) * (p[2] + q[2]);
      normal[1] += (p[2] - q[2]) * (p[0] + q[0]);
      normal[2] += (p[0] - q[0]) * (p[1] + q[1]);
    });
    normal = unit(normal);
    const known = ring.findIndex((v) => sign.has(v));
    let parity = 1;
    if (known >= 0) {
      parity = sign.get(ring[known]) * (known % 2 ? -1 : 1);
      const near = normals.get(ring[known]);
      if (near && dot(near, normal) < 0) normal = scale(normal, -1);
    }
    ring.forEach((v, i) => {
      if (sign.has(v)) return;
      const s = parity * (i % 2 ? -1 : 1);
      sign.set(v, s);
      normals.set(v, normal);
      put(x, v, add(at(x, v), scale(normal, 0.25 * s)));
    });
  }
  // At a ring fusion atom (three ring bonds), the fourth bond is axial: it
  // points the way the atom was nudged. Angular methyls of steroids start
  // there, which lets the rings settle as chairs.
  for (const [v, s] of sign) {
    const ringNbs = info.adj[v].filter((e) => info.inRing[e.bond]);
    const others = info.adj[v].filter((e) => !info.inRing[e.bond] && placed.has(e.to));
    if (ringNbs.length !== 3 || others.length !== 1) continue;
    const w = others[0].to;
    const branch = branchFrom(info, w, v);
    if (!branch) continue;
    const pv = at(x, v);
    const pw = at(x, w);
    const r = len(sub(pw, pv));
    const shift = sub(add(pv, scale(normals.get(v), s * r)), pw);
    for (const b of branch) put(x, b, add(at(x, b), shift));
  }
}

// Atoms reached from `start` without passing `from`, or null if the branch
// loops back (a ring).
function branchFrom(info, start, from) {
  const seen = new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++)
    for (const { to } of info.adj[queue[q]]) {
      if (to === from) {
        if (queue[q] !== start) return null;
        continue;
      }
      if (!seen.has(to)) (seen.add(to), queue.push(to));
    }
  return queue;
}

// Unit directions for `count` bonds around an atom of the given
// hybridisation, in a frame whose first direction is +x and second lies in
// the xy plane.
function idealDirections(count, hyb) {
  const t = 109.47 * DEG;
  if (count <= 1) return [[1, 0, 0]];
  if (count === 2) {
    const a = hyb === "sp" ? Math.PI : hyb === "sp2" ? 120 * DEG : t;
    return [
      [1, 0, 0],
      [Math.cos(a), Math.sin(a), 0],
    ];
  }
  if (count === 3 && hyb === "sp2")
    return [0, 120, 240].map((a) => [Math.cos(a * DEG), Math.sin(a * DEG), 0]);
  if (count <= 4) {
    // Tetrahedron with one corner on +x and one in the xy plane.
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [
      [1, 0, 0],
      [c, s, 0],
      [c, s * Math.cos(120 * DEG), s * Math.sin(120 * DEG)],
      [c, s * Math.cos(240 * DEG), s * Math.sin(240 * DEG)],
    ].slice(0, count);
  }
  // More than four: spread evenly on a sphere.
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    return [y, r * Math.cos(a), r * Math.sin(a)];
  });
}

// Puts each terminal hydrogen where the ideal geometry of its atom wants it.
function placeHydrogens(x, info, ff, hydrogens, rng) {
  const { adj, hyb } = info;
  const owners = new Map();
  for (const h of hydrogens) {
    const a = adj[h][0].to;
    if (!owners.has(a)) owners.set(a, []);
    owners.get(a).push(h);
  }
  const placedSet = new Set(hydrogens);
  for (const [a, hs] of owners) {
    const pa = at(x, a);
    const heavy = adj[a].map((e) => e.to).filter((v) => !placedSet.has(v));
    const us = heavy.map((v) => unit(sub(at(x, v), pa)));
    const total = heavy.length + hs.length;
    let dirs;
    if (heavy.length >= 3 && hs.length === 1) {
      // Opposite the other three bonds (or off their plane if they are flat).
      let d = unit(scale(us.reduce(add), -1));
      if (len(d) < 0.5) d = unit(cross(sub(us[1], us[0]), sub(us[2], us[0])));
      dirs = [d];
    } else if (heavy.length === 2 && hs.length <= 2) {
      // Along the outer bisector, or either side of it for two hydrogens.
      const bis = unit(scale(add(us[0], us[1]), -1));
      const bisector = len(bis) > 0.5 ? bis : perpendicular(us[0], rng);
      const normal = unit(cross(us[0], us[1]));
      const side = len(normal) > 0.5 ? normal : perpendicular(bisector, rng);
      const half = 54.75 * DEG;
      dirs =
        hs.length === 1
          ? [bisector]
          : [1, -1].map((s) =>
              unit(add(scale(bisector, Math.cos(half)), scale(side, s * Math.sin(half)))),
            );
    } else {
      // Build a frame from the first heavy neighbour and, for staggering,
      // the direction away from that neighbour's own neighbours.
      const e1 = us[0] ?? unit([rng() - 0.5, rng() - 0.5, rng() - 0.5]);
      let e2;
      if (us[1]) e2 = us[1];
      else if (heavy.length === 1) {
        const other = adj[heavy[0]].map((e) => e.to).find((v) => v !== a && !placedSet.has(v));
        e2 = other !== undefined ? scale(sub(at(x, other), at(x, heavy[0])), -1) : null;
      }
      e2 = e2 ? sub(e2, scale(e1, dot(e2, e1))) : null;
      e2 = e2 && len(e2) > 1e-3 ? unit(e2) : perpendicular(e1, rng);
      const e3 = cross(e1, e2);
      const ideal = idealDirections(total, hyb[a]);
      dirs = ideal
        .slice(heavy.length)
        .map((d) => add(add(scale(e1, d[0]), scale(e2, d[1])), scale(e3, d[2])));
    }
    hs.forEach((h, i) => {
      const d = dirs[i] ?? perpendicular(us[0] ?? [1, 0, 0], rng);
      const r = ff.bondR0[info.bondIndex(a, h)];
      const jitter = [rng() - 0.5, rng() - 0.5, rng() - 0.5].map((v) => v * 0.05);
      put(x, h, add(add(pa, scale(d, r)), jitter));
    });
  }
}

function firstGuess(atoms, info, ff, rng, attempt) {
  const { n, adj } = info;
  // Terminal hydrogens are placed afterwards; everything else is skeleton.
  const isTerminalH = (i) =>
    atoms[i].el === "H" && adj[i].length === 1 && atoms[adj[i][0].to].el !== "H";
  let skeleton = atoms.map((a, i) => i).filter((i) => !isTerminalH(i));
  if (!skeleton.length) skeleton = atoms.map((a, i) => i);
  const hydrogens = atoms.map((a, i) => i).filter((i) => !skeleton.includes(i));
  const m = skeleton.length;
  const D = targetDistances(skeleton, info, ff);
  if (attempt > 0)
    for (let i = 0; i < m; i++)
      for (let j = i + 1; j < m; j++) D[i * m + j] = D[j * m + i] *= 1 + 0.2 * (rng() - 0.5);
  const iterations = m <= 150 ? 80 : 40;
  const xs = scaleDistances(D, m, rng, iterations);
  const x = new Float64Array(3 * n);
  const noise = attempt ? 0.3 : 0.15;
  skeleton.forEach((g, i) => {
    for (let c = 0; c < 3; c++) x[3 * g + c] = xs[3 * i + c] + noise * (rng() - 0.5);
  });
  puckerRings(x, info, new Set(skeleton));
  placeHydrogens(x, info, ff, hydrogens, rng);
  return x;
}

// ---- Putting it together ------------------------------------------------------

function components(n, bonds) {
  const adj = adjacency(n, bonds);
  const seen = new Int32Array(n).fill(-1);
  const list = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] >= 0) continue;
    const piece = [s];
    seen[s] = list.length;
    for (let q = 0; q < piece.length; q++)
      for (const { to } of adj[piece[q]])
        if (seen[to] < 0) {
          seen[to] = list.length;
          piece.push(to);
        }
    list.push(piece.sort((a, b) => a - b));
  }
  return list;
}

// Embeds one connected piece. Returns a flat Float64Array of coordinates.
function embedPiece(atoms, bonds, seed) {
  const n = atoms.length;
  if (n === 1) return new Float64Array(3);
  const info = perceive(atoms, bonds);
  const ff = buildForceField(atoms, bonds, info);
  // Each start is relaxed part way; the lowest-energy one is then finished.
  // How a start ranks after the first stretch rarely changes later. Fused
  // saturated rings (steroids) get extra starts, since only some starts
  // settle into all-chair rings.
  const saturated = info.rings.filter(
    (ring) => ring.length === 6 && ring.filter((v) => info.hyb[v] === "sp3").length >= 4,
  );
  const fused = saturated.filter((ring) =>
    saturated.some((other) => other !== ring && other.filter((v) => ring.includes(v)).length >= 2),
  ).length;
  const extra = n <= 200 ? Math.min(5, 2 * fused) : 0;
  const restarts = (n <= 40 ? 4 : n <= 150 ? 3 : n <= 400 ? 2 : 1) + extra;
  const screen = restarts > 1 ? 200 : 0;
  let best = null;
  let bestEnergy = Infinity;
  for (let r = 0; r < restarts; r++) {
    const rng = mulberry32(mixSeed(seed, r));
    const x = firstGuess(atoms, info, ff, rng, r);
    const e = screen ? minimize(ff.energy, x, { maxIter: screen }) : 0;
    if (e < bestEnergy - 1e-9 || !best) {
      best = x;
      bestEnergy = e;
    }
  }
  minimize(ff.energy, best, { maxIter: n <= 150 ? 500 : 400 });
  return best;
}

// Turns a flat coordinate array around so its longest extent lies along x
// and its shortest along z (principal axes), centred on the origin.
function alignPrincipal(points) {
  const n = points.length;
  if (!n) return points;
  const c = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / n);
  const q = points.map((p) => sub(p, c));
  const cov = [0, 1, 2].map((a) => [0, 1, 2].map((b) => q.reduce((s, p) => s + p[a] * p[b], 0)));
  // Jacobi eigenvalue sweeps on the 3×3 covariance.
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const A = cov.map((r) => r.slice());
  for (let sweep = 0; sweep < 30; sweep++) {
    for (const [p, r] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(A[p][r]) < 1e-12) continue;
      const theta = (A[r][r] - A[p][p]) / (2 * A[p][r]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const cs = 1 / Math.sqrt(t * t + 1);
      const sn = t * cs;
      for (let k = 0; k < 3; k++) {
        const akp = A[k][p];
        const akr = A[k][r];
        A[k][p] = cs * akp - sn * akr;
        A[k][r] = sn * akp + cs * akr;
      }
      for (let k = 0; k < 3; k++) {
        const apk = A[p][k];
        const ark = A[r][k];
        A[p][k] = cs * apk - sn * ark;
        A[r][k] = sn * apk + cs * ark;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[k][p];
        const vkr = V[k][r];
        V[k][p] = cs * vkp - sn * vkr;
        V[k][r] = sn * vkp + cs * vkr;
      }
    }
  }
  const order = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  const axes = order.map((k) => [V[0][k], V[1][k], V[2][k]]);
  // Keep a right-handed frame, so mirror images never appear.
  if (dot(cross(axes[0], axes[1]), axes[2]) < 0) axes[2] = scale(axes[2], -1);
  return q.map((p) => axes.map((ax) => dot(p, ax)));
}

// Positions in ångströms for every atom of the graph. If the graph still
// has hydrogen counts, they are made into atoms first (as withHydrogens
// does), so the result lines up with withHydrogens(graph).atoms. The result
// is centred on the origin with its longest extent along x.
export function embed3D(graph, { seed = 1 } = {}) {
  const full = graph.atoms.some((a) => a.h > 0) ? withHydrogens(graph) : graph;
  const { atoms, bonds } = full;
  const out = atoms.map(() => [0, 0, 0]);
  let cursor = 0;
  components(atoms.length, bonds).forEach((piece, c) => {
    const local = new Map(piece.map((g, i) => [g, i]));
    const subBonds = bonds
      .filter(([a]) => local.has(a))
      .map(([a, b, o]) => [local.get(a), local.get(b), o]);
    const x = embedPiece(
      piece.map((g) => atoms[g]),
      subBonds,
      mixSeed(seed >>> 0, `piece${c}`),
    );
    const pts = alignPrincipal(piece.map((g, i) => at(x, i)));
    // Lay pieces side by side along x with a small gap.
    const minX = Math.min(...pts.map((p) => p[0]));
    const maxX = Math.max(...pts.map((p) => p[0]));
    const shift = c === 0 ? 0 : cursor + 1.5 - minX;
    pts.forEach((p, i) => (out[piece[i]] = [p[0] + shift, p[1], p[2]]));
    cursor = maxX + shift + 1.5;
  });
  return alignPrincipal(out);
}

// Moves a { atoms: [{ p }] } molecule so its atoms' centroid sits on the
// origin. Changes the molecule in place and returns it.
export function centreMolecule(mol) {
  const n = mol.atoms.length;
  if (!n) return mol;
  const c = [0, 1, 2].map((k) => mol.atoms.reduce((s, a) => s + a.p[k], 0) / n);
  for (const a of mol.atoms) a.p = [a.p[0] - c[0], a.p[1] - c[1], a.p[2] - c[2]];
  return mol;
}

const round = (v) => Math.round(v * 1e4) / 1e4 + 0;

// Builds the toy's molecule format from a graph with explicit hydrogens and
// its positions: { atoms: [{ el, p, charge? }], bonds: [[i, j, order]] },
// centred on the origin.
export function toMolecule(graph, positions) {
  const atoms = graph.atoms.map((a, i) => {
    const atom = { el: a.el, p: positions[i].map(round) };
    if (a.charge) atom.charge = a.charge;
    return atom;
  });
  const bonds = graph.bonds.map(([i, j, o]) => [i, j, Math.min(3, Math.max(1, Math.round(o)))]);
  const mol = centreMolecule({ atoms, bonds });
  for (const a of mol.atoms) a.p = a.p.map(round);
  return mol;
}

// SMILES text straight to a 3D molecule in the toy's format.
export function moleculeFromSmiles(text, { seed = 1 } = {}) {
  const graph = withHydrogens(parseSmiles(text));
  return toMolecule(graph, embed3D(graph, { seed }));
}
