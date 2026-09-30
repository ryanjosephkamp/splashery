// DNA for the molecule toy (lane Chemistry): a short stretch of the double
// helix and its two kinds of base pair, from PDB entry 1BNA (the B-DNA
// dodecamer of Drew, Wing, Takano, Broka, Tanaka, Itakura and Dickerson,
// 1981; wwPDB, CC0). The crystal structure has no hydrogens, so they are
// added here where each atom of a nucleotide carries them, at the usual
// bond lengths and angles.

import { perceiveBonds, guessBondOrders } from "./molfile.js";

// Base pairs 3 to 6 of 1BNA (C·G, G·C, A·T, A·T): residues A3 to A6 and
// B19 to B22, heavy atoms only, in ångströms about their middle.
// "residue name atom x y z"
const ATOMS = `
A3 DC P 10.413 4.333 3.776
A3 DC OP1 11.855 4.028 3.744
A3 DC OP2 9.908 5.124 2.639
A3 DC O5' 9.609 2.958 3.851
A3 DC C5' 9.933 1.997 4.859
A3 DC C4' 8.872 0.945 4.769
A3 DC O4' 7.605 1.556 4.977
A3 DC C3' 8.773 0.269 3.427
A3 DC O3' 9.470 -0.979 3.452
A3 DC C2' 7.279 0.118 3.185
A3 DC C1' 6.627 0.678 4.433
A3 DC N1 5.545 1.601 4.045
A3 DC C2 4.258 1.296 4.340
A3 DC O2 4.034 0.224 4.906
A3 DC N3 3.284 2.159 4.026
A3 DC C4 3.566 3.315 3.421
A3 DC N4 2.570 4.211 3.153
A3 DC C5 4.875 3.657 3.095
A3 DC C6 5.886 2.760 3.423
A4 DG P 9.598 -1.876 2.141
A4 DG OP1 10.769 -2.753 2.289
A4 DG OP2 9.557 -0.992 0.964
A4 DG O5' 8.280 -2.751 2.194
A4 DG C5' 8.063 -3.663 3.277
A4 DG C4' 6.742 -4.328 3.029
A4 DG O4' 5.702 -3.336 3.020
A4 DG C3' 6.613 -5.059 1.700
A4 DG O3' 5.633 -6.074 1.762
A4 DG C2' 6.142 -3.920 0.812
A4 DG C1' 5.065 -3.387 1.742
A4 DG N9 4.654 -2.007 1.393
A4 DG C8 5.366 -1.025 0.756
A4 DG N7 4.662 0.106 0.601
A4 DG C5 3.470 -0.188 1.159
A4 DG C6 2.301 0.616 1.273
A4 DG O6 2.118 1.769 0.892
A4 DG N1 1.282 -0.074 1.876
A4 DG C2 1.321 -1.358 2.340
A4 DG N2 0.180 -1.872 2.877
A4 DG N3 2.417 -2.109 2.241
A4 DG C4 3.433 -1.463 1.645
A5 DA P 5.705 -7.319 0.769
A5 DA OP1 6.465 -8.397 1.416
A5 DA OP2 6.186 -6.865 -0.566
A5 DA O5' 4.159 -7.707 0.685
A5 DA C5' 3.364 -7.719 1.886
A5 DA C4' 2.021 -7.200 1.481
A5 DA O4' 2.191 -5.841 1.085
A5 DA C3' 1.368 -7.895 0.288
A5 DA O3' 0.111 -8.492 0.644
A5 DA C2' 1.301 -6.790 -0.780
A5 DA C1' 1.200 -5.556 0.093
A5 DA N9 1.740 -4.372 -0.609
A5 DA C8 3.007 -4.185 -1.094
A5 DA N7 3.212 -2.942 -1.563
A5 DA C5 2.022 -2.335 -1.378
A5 DA C6 1.579 -1.009 -1.657
A5 DA N6 2.394 -0.066 -2.208
A5 DA N1 0.315 -0.710 -1.358
A5 DA C2 -0.473 -1.636 -0.807
A5 DA N3 -0.188 -2.896 -0.492
A5 DA C4 1.099 -3.178 -0.815
A6 DA P -0.785 -9.282 -0.413
A6 DA OP1 -1.623 -10.249 0.324
A6 DA OP2 0.064 -9.789 -1.508
A6 DA O5' -1.772 -8.177 -0.996
A6 DA C5' -2.849 -7.691 -0.186
A6 DA C4' -3.540 -6.685 -1.041
A6 DA O4' -2.499 -5.828 -1.514
A6 DA C3' -4.234 -7.218 -2.289
A6 DA O3' -5.644 -6.919 -2.295
A6 DA C2' -3.411 -6.596 -3.415
A6 DA C1' -2.952 -5.314 -2.757
A6 DA N9 -1.733 -4.762 -3.398
A6 DA C8 -0.536 -5.389 -3.608
A6 DA N7 0.398 -4.574 -4.120
A6 DA C5 -0.235 -3.387 -4.230
A6 DA C6 0.222 -2.101 -4.661
A6 DA N6 1.510 -1.870 -5.049
A6 DA N1 -0.652 -1.097 -4.624
A6 DA C2 -1.898 -1.326 -4.204
A6 DA N3 -2.441 -2.464 -3.778
A6 DA C4 -1.535 -3.465 -3.819
B19 DT P -0.047 8.257 -9.456
B19 DT OP1 -0.859 9.408 -9.894
B19 DT OP2 1.201 8.548 -8.727
B19 DT O5' -1.018 7.340 -8.591
B19 DT C5' -2.253 6.883 -9.173
B19 DT C4' -2.842 5.929 -8.174
B19 DT O4' -1.884 4.896 -7.942
B19 DT C3' -3.136 6.534 -6.807
B19 DT O3' -4.548 6.664 -6.585
B19 DT C2' -2.384 5.618 -5.846
B19 DT C1' -2.225 4.357 -6.677
B19 DT N1 -1.042 3.562 -6.271
B19 DT C2 -1.209 2.287 -5.820
B19 DT O2 -2.340 1.813 -5.674
B19 DT N3 -0.100 1.537 -5.563
B19 DT C4 1.164 2.033 -5.699
B19 DT O4 2.104 1.282 -5.447
B19 DT C5 1.321 3.359 -6.114
B19 DT C7 2.694 3.951 -6.242
B19 DT C6 0.193 4.117 -6.428
B20 DT P -5.138 7.245 -5.216
B20 DT OP1 -6.506 7.719 -5.478
B20 DT OP2 -4.196 8.225 -4.635
B20 DT O5' -5.256 5.935 -4.323
B20 DT C5' -6.075 4.860 -4.812
B20 DT C4' -5.996 3.772 -3.798
B20 DT O4' -4.648 3.327 -3.712
B20 DT C3' -6.379 4.183 -2.389
B20 DT O3' -7.452 3.369 -1.923
B20 DT C2' -5.065 4.019 -1.616
B20 DT C1' -4.461 2.860 -2.387
B20 DT N1 -2.991 2.782 -2.271
B20 DT C2 -2.394 1.592 -1.990
B20 DT O2 -3.068 0.578 -1.785
B20 DT N3 -1.031 1.541 -1.979
B20 DT C4 -0.249 2.626 -2.251
B20 DT O4 0.974 2.476 -2.224
B20 DT C5 -0.877 3.838 -2.543
B20 DT C7 -0.088 5.070 -2.864
B20 DT C6 -2.266 3.899 -2.550
B21 DC P -8.057 3.535 -0.460
B21 DC OP1 -9.482 3.136 -0.489
B21 DC OP2 -7.781 4.901 0.035
B21 DC O5' -7.242 2.443 0.363
B21 DC C5' -7.320 1.064 -0.043
B21 DC C4' -6.551 0.310 0.985
B21 DC O4' -5.173 0.614 0.787
B21 DC C3' -6.885 0.757 2.403
B21 DC O3' -7.615 -0.247 3.135
B21 DC C2' -5.528 1.126 2.993
B21 DC C1' -4.544 0.455 2.047
B21 DC N1 -3.323 1.268 1.855
B21 DC C2 -2.117 0.651 1.853
B21 DC O2 -2.091 -0.557 2.103
B21 DC N3 -1.012 1.351 1.559
B21 DC C4 -1.091 2.650 1.263
B21 DC N4 0.034 3.340 0.928
B21 DC C5 -2.313 3.321 1.260
B21 DC C6 -3.458 2.590 1.559
B22 DG P -8.142 0.036 4.623
B22 DG OP1 -9.264 -0.891 4.920
B22 DG OP2 -8.416 1.486 4.830
B22 DG O5' -6.884 -0.364 5.517
B22 DG C5' -6.435 -1.729 5.597
B22 DG C4' -5.229 -1.731 6.501
B22 DG O4' -4.158 -1.028 5.843
B22 DG C3' -5.384 -1.021 7.849
B22 DG O3' -4.563 -1.631 8.817
B22 DG C2' -4.900 0.382 7.514
B22 DG C1' -3.663 -0.062 6.780
B22 DG N9 -3.052 1.069 6.067
B22 DG C8 -3.614 2.257 5.683
B22 DG N7 -2.730 3.074 5.090
B22 DG C5 -1.579 2.365 5.104
B22 DG C6 -0.281 2.715 4.626
B22 DG O6 0.096 3.769 4.109
B22 DG N1 0.617 1.695 4.832
B22 DG C2 0.372 0.488 5.415
B22 DG N2 1.415 -0.374 5.562
B22 DG N3 -0.836 0.164 5.874
B22 DG C4 -1.749 1.141 5.675
`;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

// How many hydrogens each atom of a nucleotide carries, and whether it is
// flat (sp2, in a base's ring plane) or tetrahedral.
const SUGAR_H = { "C1'": 1, "C2'": 2, "C3'": 1, "C4'": 1, "C5'": 2 };
const BASE_H = {
  DA: { C2: 1, C8: 1, N6: 2 },
  DG: { C8: 1, N1: 1, N2: 2 },
  DC: { C5: 1, C6: 1, N4: 2 },
  DT: { C6: 1, N3: 1, C7: 3 },
};
const TETRA = new Set([...Object.keys(SUGAR_H), "C7", "O5'", "O3'"]);
// The Watson-Crick hydrogen bonds: [donor, acceptor] atom names, the
// first on the purine.
const PAIR_BONDS = {
  "DA-DT": [
    ["N6", "O4", "purine"],
    ["N3", "N1", "pyrimidine"],
  ],
  "DG-DC": [
    ["N1", "N3", "purine"],
    ["N2", "O2", "purine"],
    ["N4", "O6", "pyrimidine"],
  ],
};
const PARTNER = { A3: "B22", A4: "B21", A5: "B20", A6: "B19" };

const ROWS = ATOMS.trim()
  .split("\n")
  .map((l) => {
    const [res, name, atom, x, y, z] = l.trim().split(/\s+/);
    return { res, name, atom, el: atom[0], p: [Number(x), Number(y), Number(z)] };
  });

// The hydrogens around atom i (bonded to `nb`, the indices of its heavy
// neighbors), `count` of them.
function hydrogens(atoms, i, nb, count, flatRef) {
  const a = atoms[i];
  const L = a.el === "C" ? 1.09 : a.el === "N" ? 1.01 : 0.96;
  const dirs = nb.map((j) => unit(sub(atoms[j].p, a.p)));
  const out = [];
  if (TETRA.has(a.atom)) {
    if (dirs.length === 1) {
      const d = mul(dirs[0], -1);
      const side = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const up = cross(d, side);
      for (let k = 0; k < count; k++) {
        const t = (k / 3) * Math.PI * 2 + 0.4;
        const v = add(mul(d, 0.334), mul(add(mul(side, Math.cos(t)), mul(up, Math.sin(t))), 0.943));
        out.push(add(a.p, mul(v, L)));
      }
    } else if (dirs.length === 2) {
      const b = unit(mul(add(dirs[0], dirs[1]), -1));
      const n = unit(cross(dirs[0], dirs[1]));
      for (const s of [1, -1].slice(0, count)) out.push(add(a.p, mul(add(mul(b, 0.577), mul(n, 0.816 * s)), L))); // prettier-ignore
    } else out.push(add(a.p, mul(unit(mul(add(add(dirs[0], dirs[1]), dirs[2]), -1)), L)));
  } else if (dirs.length >= 2) {
    // In the ring's plane, straight out between its two neighbors.
    out.push(add(a.p, mul(unit(mul(add(dirs[0], dirs[1]), -1)), L)));
  } else {
    // An amino group: two hydrogens at 120 degrees, in the ring's plane.
    const d = mul(dirs[0], -1);
    const perp = unit(cross(flatRef, d));
    for (const s of [1, -1]) out.push(add(a.p, mul(add(mul(d, 0.5), mul(perp, 0.866 * s)), L)));
  }
  return out;
}

// Builds a molecule from rows of 1BNA: bonds from distances, bond orders
// guessed, hydrogens added; `cap` gives extra hydrogens (where a bond was
// cut) as [atom index, direction point]. Returns { atoms, bonds, hbonds }.
function assemble(rows, { cap = [], ends = [] } = {}) {
  const atoms = rows.map((r) => ({ el: r.el, p: r.p.slice(), atom: r.atom, res: r.res, name: r.name })); // prettier-ignore
  const bonds = perceiveBonds(atoms).map(([i, j]) => [i, j, 1]);
  const nbs = atoms.map(() => []);
  for (const [i, j] of bonds) {
    nbs[i].push(j);
    nbs[j].push(i);
  }
  const heavy = atoms.length;
  const addH = (i, p) => {
    atoms.push({ el: "H", p, res: atoms[i].res });
    bonds.push([i, atoms.length - 1, 1]);
  };
  for (let i = 0; i < heavy; i++) {
    const a = atoms[i];
    let count = SUGAR_H[a.atom] ?? BASE_H[a.name]?.[a.atom] ?? 0;
    if (ends.includes(i)) count = 1;
    if (!count) continue;
    // The ring plane at an amino group: its carbon's neighbors.
    let flat = [0, 0, 1];
    if (nbs[i].length === 1) {
      const c = nbs[i][0];
      const [x, y] = nbs[c].filter((k) => k !== i);
      if (y !== undefined) flat = unit(cross(sub(atoms[x].p, atoms[c].p), sub(atoms[y].p, atoms[c].p))); // prettier-ignore
    }
    for (const p of hydrogens(atoms, i, nbs[i], count, flat)) addH(i, p);
  }
  for (const [i, toward] of cap) addH(i, add(atoms[i].p, mul(unit(sub(toward, atoms[i].p)), 1.01)));
  // Bond orders for the heavy atoms (the hydrogens fill their valences).
  guessBondOrders(atoms, bonds);
  // Hydrogen bonds across each base pair: from the donor's hydrogen to the
  // acceptor.
  const hbonds = [];
  const find = (res, name) => atoms.findIndex((a) => a.res === res && a.atom === name);
  for (const [resA, resB] of Object.entries(PARTNER)) {
    const na = rows.find((r) => r.res === resA)?.name;
    const nb = rows.find((r) => r.res === resB)?.name;
    if (!na || !nb) continue;
    const pur = na === "DA" || na === "DG" ? resA : resB;
    const pyr = pur === resA ? resB : resA;
    const key = `${rows.find((r) => r.res === pur).name}-${rows.find((r) => r.res === pyr).name}`;
    for (const [dn, ac, side] of PAIR_BONDS[key] || []) {
      const d = find(side === "purine" ? pur : pyr, dn);
      const acc = find(side === "purine" ? pyr : pur, ac);
      if (d < 0 || acc < 0) continue;
      let h = -1;
      let best = Infinity;
      for (const [i, j] of bonds) {
        const other = i === d ? j : j === d ? i : -1;
        if (other < 0 || atoms[other].el !== "H") continue;
        const dist = Math.hypot(...sub(atoms[other].p, atoms[acc].p));
        if (dist < best) [best, h] = [dist, other];
      }
      if (h >= 0) hbonds.push([h, acc]);
    }
  }
  const plain = atoms.map((a) => ({ el: a.el, p: a.p }));
  return { atoms: plain, bonds, hbonds };
}

// The axes a set of points spreads along, longest first (a Jacobi
// eigen-decomposition of their covariance).
function principalAxes(points) {
  const n = points.length;
  const c = mul(
    points.reduce((s, p) => add(s, p), [0, 0, 0]),
    1 / n,
  );
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const d = sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i][j] += d[i] * d[j];
  }
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 30; sweep++)
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(A[p][q]) < 1e-12) continue;
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      for (let k = 0; k < 3; k++) {
        const akp = A[k][p];
        const akq = A[k][q];
        A[k][p] = cs * akp - sn * akq;
        A[k][q] = sn * akp + cs * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = A[p][k];
        const aqk = A[q][k];
        A[p][k] = cs * apk - sn * aqk;
        A[q][k] = sn * apk + cs * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[k][p];
        const vkq = V[k][q];
        V[k][p] = cs * vkp - sn * vkq;
        V[k][q] = sn * vkp + cs * vkq;
      }
    }
  const axes = [0, 1, 2].map((i) => ({ w: A[i][i], v: [V[0][i], V[1][i], V[2][i]] }));
  axes.sort((a, b) => b.w - a.w);
  return { center: c, axes: axes.map((a) => unit(a.v)) };
}

// Turns a molecule so its longest spread lies along `first` and its
// thinnest along +Z (toward the viewer), about its middle.
function orient(mol, first) {
  const { center, axes } = principalAxes(mol.atoms.map((a) => a.p));
  const [a0, a1] = axes;
  const a2 = cross(a0, a1);
  const [ex, ey] = first === "y" ? [a1, a0] : [a0, a1];
  const ez = first === "y" ? mul(a2, -1) : a2;
  for (const a of mol.atoms) {
    const d = sub(a.p, center);
    const dot = (u) => d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    a.p = [dot(ex), dot(ey), dot(ez)];
  }
  return mol;
}

// A short stretch of the double helix: four base pairs, both strands with
// their sugars and phosphates (the first nucleotide of each strand starts
// at its 5' oxygen, which carries a hydrogen; each strand's last 3' oxygen
// carries one too).
export function dnaStrand() {
  const first = new Set(["A3", "B19"]);
  const rows = ROWS.filter((r) => !(first.has(r.res) && ["P", "OP1", "OP2"].includes(r.atom)));
  const ends = [];
  rows.forEach((r, i) => {
    if ((first.has(r.res) && r.atom === "O5'") || ((r.res === "A6" || r.res === "B22") && r.atom === "O3'")) ends.push(i); // prettier-ignore
  });
  // The helix's axis stands up.
  return orient(assemble(rows, { ends }), "y");
}

// One base pair on its own, the two bases held by their hydrogen bonds:
// "AT" (adenine and thymine, 1BNA's A5 and B20) or "GC" (guanine and
// cytosine, A4 and B21). Each base's bond to its sugar is capped with a
// hydrogen, as in the free base.
export function basePair(kind) {
  const [ra, rb] = kind === "GC" ? ["A4", "B21"] : ["A5", "B20"];
  const backbone = new Set(["P", "OP1", "OP2", "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'"]); // prettier-ignore
  const all = ROWS.filter((r) => r.res === ra || r.res === rb);
  const rows = all.filter((r) => !backbone.has(r.atom));
  const cap = [];
  for (const res of [ra, rb]) {
    const name = all.find((r) => r.res === res).name;
    const glyco = name === "DA" || name === "DG" ? "N9" : "N1";
    const i = rows.findIndex((r) => r.res === res && r.atom === glyco);
    const c1 = all.find((r) => r.res === res && r.atom === "C1'");
    cap.push([i, c1.p]);
  }
  // Flat toward the viewer, the two bases side by side.
  return orient(assemble(rows, { cap }), "x");
}
