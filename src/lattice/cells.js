// Crystal unit cells (lane Lattices and orbitals): real lattice constants and
// atom positions, blocks of cells, nearest-neighbor bonds and the thermal
// motion of each atom. docs/evidence/unit-cells.json lists every source.
//
// A crystal is { cell: { a, b, c, gamma } (ångströms, degrees; alpha = beta =
// 90° for all of these), basis: [[el, fx, fy, fz]] (fractional, the whole
// conventional cell), radius by element (Å), bonds: [[elA, elB, length, tol]],
// U by element: the mean-square displacement along x, y (in the ab plane)
// and z (along c) in Å², from the published B (U = B / 8π²) or U values }.

const EIGHT_PI2 = 8 * Math.PI * Math.PI;

// The four sites of an fcc lattice, and the 4f sites of P6₃/mmc.
const FCC = [
  [0, 0, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
  [0.5, 0.5, 0],
];
const site4f = (z) => [
  [1 / 3, 2 / 3, z],
  [2 / 3, 1 / 3, z + 0.5],
  [2 / 3, 1 / 3, -z],
  [1 / 3, 2 / 3, 0.5 - z],
];
const wrap = (x) => x - Math.floor(x + 1e-9);

const iso = (B) => [B / EIGHT_PI2, B / EIGHT_PI2, B / EIGHT_PI2];

export const CRYSTALS = {
  // Diamond: Fd-3m, a = 3.56679 Å at room temperature (COD 9008564, from
  // Wyckoff, Crystal Structures, 1963). Carbon on the fcc sites and at
  // (¼, ¼, ¼) from each. B = 0.1435 Å² at 293 K (Peng et al. 1996).
  diamond: {
    label: "Diamond (C)",
    cell: { a: 3.56679, b: 3.56679, c: 3.56679, gamma: 90 },
    basis: FCC.flatMap((f) => [
      ["C", ...f],
      ["C", f[0] + 0.25, f[1] + 0.25, f[2] + 0.25],
    ]),
    // The covalent radius: half the C–C bond, a√3/8.
    radius: { C: (3.56679 * Math.sqrt(3)) / 8 },
    bonds: [["C", "C", (3.56679 * Math.sqrt(3)) / 4, 0.05]],
    U: { C: iso(0.1435) },
    temperature: "293 K",
    color: { C: "#bcd9f4" },
    finish: "gem",
  },
  // Graphite: P6₃/mmc, a = 2.464 Å, c = 6.711 Å, with its anisotropic U
  // (Trucano & Chen 1975, neutron diffraction; COD 9011577). Carbon at 2b
  // (0, 0, ¼), (0, 0, ¾) and 2c (⅓, ⅔, ¼), (⅔, ⅓, ¾).
  graphite: {
    label: "Graphite (C)",
    cell: { a: 2.464, b: 2.464, c: 6.711, gamma: 120 },
    basis: [
      ["C", 0, 0, 0.25],
      ["C", 0, 0, 0.75],
      ["C", 1 / 3, 2 / 3, 0.25],
      ["C", 2 / 3, 1 / 3, 0.75],
    ],
    // Half the in-plane C–C bond, a/√3 / 2.
    radius: { C: 2.464 / Math.sqrt(3) / 2 },
    bonds: [["C", "C", 2.464 / Math.sqrt(3), 0.05]],
    // U11 = U22 = 0.0031 Å² in the layers; U33 = 0.016 (C1) and 0.017 (C2)
    // across them: the layers move apart far more than atoms move in them.
    U: { C: [0.0031, 0.0031, 0.0165] },
    temperature: "room temperature",
    color: { C: "#545a64" },
    finish: "satin",
  },
  // Ice Ih: P6₃/mmc, a = 4.506 Å, c = 7.346 Å, O at 4f with z = 0.0618 (Goto,
  // Hondoh and Mae 1990, single-crystal X-ray; COD 1538173). Each hydrogen
  // sits 1.00 Å from its oxygen along an O–O line (the file's H1 site at z =
  // 0.198 is (0.198 − 0.0618) × 7.346 = 1.00 Å above its O), two on each
  // oxygen and one on each O–O line (the ice rules), placed by cells.iceHydrogens.
  ice: {
    label: "Ice Ih (H₂O)",
    cell: { a: 4.506, b: 4.506, c: 7.346, gamma: 120 },
    basis: site4f(0.0618).map((f) => ["O", ...f.map(wrap)]),
    // Covalent radii (Cordero et al. 2008): O 0.66 Å, H 0.31 Å.
    radius: { O: 0.66, H: 0.31 },
    bonds: [
      ["O", "H", 1.0, 0.05],
      ["H", "O", 1.76, 0.12, "hydrogen"],
    ],
    // Uiso at 81 K: O 0.008 Å² (its Ueq), H 0.026 Å² (Kovalev et al. 2024,
    // IUCrJ 11, 3D electron diffraction; COD 1572227).
    U: { O: [0.008, 0.008, 0.008], H: [0.026, 0.026, 0.026] },
    temperature: "81 K",
    color: { O: "#e5473d", H: "#f3f4f6" },
    finish: "satin",
    hydrogens: { bond: 1.0, oo: 2.76 },
  },
  // Copper: Fm-3m, a = 3.61496 Å at room temperature (COD 9008468, from
  // Wyckoff 1963). B = 0.5505 Å² at 293 K (Peng et al. 1996).
  copper: {
    label: "Copper (Cu), face-centered cubic",
    cell: { a: 3.61496, b: 3.61496, c: 3.61496, gamma: 90 },
    basis: FCC.map((f) => ["Cu", ...f]),
    // Nearest neighbors touch: the metallic radius a√2/4.
    radius: { Cu: (3.61496 * Math.SQRT2) / 4 },
    bonds: [["Cu", "Cu", 3.61496 / Math.SQRT2, 0.05]],
    U: { Cu: iso(0.5505) },
    temperature: "293 K",
    color: { Cu: "#c97b4b" },
    finish: "metal",
  },
  // α-iron: Im-3m, a = 2.8665 Å at 298 K (COD 9008536, from Wyckoff 1963).
  // B = 0.3250 Å² at 293 K (Peng et al. 1996).
  iron: {
    label: "Iron (Fe), body-centered cubic",
    cell: { a: 2.8665, b: 2.8665, c: 2.8665, gamma: 90 },
    basis: [
      ["Fe", 0, 0, 0],
      ["Fe", 0.5, 0.5, 0.5],
    ],
    // Nearest neighbors (along the body diagonal) touch: a√3/4.
    radius: { Fe: (2.8665 * Math.sqrt(3)) / 4 },
    bonds: [["Fe", "Fe", (2.8665 * Math.sqrt(3)) / 2, 0.05]],
    U: { Fe: iso(0.325) },
    temperature: "293 K",
    color: { Fe: "#8e959e" },
    finish: "metal",
  },
  // Magnesium: P6₃/mmc, a = 3.20927 Å, c = 5.21033 Å (COD 9008506, from
  // Wyckoff 1963). Mg at 2c: (⅓, ⅔, ¼) and (⅔, ⅓, ¾). B = 1.8122 Å² at
  // 293 K (Peng et al. 1996).
  magnesium: {
    label: "Magnesium (Mg), hexagonal close-packed",
    cell: { a: 3.20927, b: 3.20927, c: 5.21033, gamma: 120 },
    basis: [
      ["Mg", 1 / 3, 2 / 3, 0.25],
      ["Mg", 2 / 3, 1 / 3, 0.75],
    ],
    // Neighbors in a layer are a apart and touch: a/2. (Neighbors in the
    // next layer are √(a²/3 + c²/4) = 3.197 Å apart, almost the same: c/a =
    // 1.624, close to the ideal 1.633.)
    radius: { Mg: 3.20927 / 2 },
    bonds: [["Mg", "Mg", 3.203, 0.03]],
    U: { Mg: iso(1.8122) },
    temperature: "293 K",
    color: { Mg: "#c4c9d0" },
    finish: "metal",
  },
};
export const CRYSTAL_ORDER = ["diamond", "graphite", "ice", "copper", "iron", "magnesium"];

// The cell's axes in Cartesian ångströms (a along x, b in the xy plane, c
// along z), as rows.
export function cellAxes({ a, b, c, gamma }) {
  const g = (gamma * Math.PI) / 180;
  return [
    [a, 0, 0],
    [b * Math.cos(g), b * Math.sin(g), 0],
    [0, 0, c],
  ];
}
export function toCart(axes, f) {
  return [0, 1, 2].map((k) => f[0] * axes[0][k] + f[1] * axes[1][k] + f[2] * axes[2][k]);
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// The atoms of an n × n × n block of cells, boundaries included (an atom on
// a face of the block is kept): [{ el, f (fractional, in block cells), p
// (Å), cell: [i, j, l] (the cell it lies in, its lowest corner) }].
export function blockAtoms(crystal, n) {
  const axes = cellAxes(crystal.cell);
  const out = [];
  const seen = new Set();
  const eps = 1e-6;
  for (let i = -1; i <= n; i++)
    for (let j = -1; j <= n; j++)
      for (let l = -1; l <= n; l++)
        for (const [el, fx, fy, fz] of crystal.basis) {
          const f = [i + wrap(fx), j + wrap(fy), l + wrap(fz)];
          if (f.some((x) => x < -eps || x > n + eps)) continue;
          const key = f.map((x) => x.toFixed(4)).join(",");
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            el,
            f,
            p: toCart(axes, f),
            cell: f.map((x) => Math.min(n - 1, Math.floor(x + eps))),
          });
        }
  return out;
}

// Bonds of a set of atoms by the crystal's bond list: [[i, j, kind]], kind
// "covalent" or "hydrogen". A grid of buckets keeps it fast.
export function findBonds(crystal, atoms) {
  const maxL = Math.max(...crystal.bonds.map((b) => b[2] + b[3]));
  const key = (p) => p.map((x) => Math.floor(x / maxL)).join(",");
  const grid = new Map();
  atoms.forEach((a, i) => {
    const k = key(a.p);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const out = [];
  atoms.forEach((a, i) => {
    const c = a.p.map((x) => Math.floor(x / maxL));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) || []) {
            if (j <= i) continue;
            const b = atoms[j];
            const d = dist(a.p, b.p);
            for (const [ea, eb, L, tol, kind = "covalent"] of crystal.bonds)
              if (
                ((a.el === ea && b.el === eb) || (a.el === eb && b.el === ea)) &&
                Math.abs(d - L) <= tol
              ) {
                out.push([i, j, kind]);
                break;
              }
          }
  });
  return out;
}

// Ice's hydrogens, by the ice rules (Bernal and Fowler): one hydrogen on
// each O–O line, two on each oxygen. The oxygens of a periodic block of P
// cells form a graph where every oxygen has four neighbors, so it has an
// Euler circuit; walking it and giving each O–O line's hydrogen to the
// oxygen the walk leaves from gives every oxygen exactly two (one per visit
// out). The walk takes random turns, so the arrangement is one of the many
// disordered ones real ice has. Returns hydrogenAt(oxygen fractional
// position f, in cells) -> the fractional positions of its two hydrogens'
// partners (the neighbor oxygens they point to), for any f in the lattice.
export function iceHydrogens(crystal, rand, P = 6) {
  const axes = cellAxes(crystal.cell);
  const oo = crystal.hydrogens.oo;
  // The oxygens of the periodic block, by their wrapped fractional place.
  const sites = [];
  for (let i = 0; i < P; i++)
    for (let j = 0; j < P; j++)
      for (let l = 0; l < P; l++)
        for (const [, fx, fy, fz] of crystal.basis) sites.push([i + fx, j + fy, l + fz]);
  const idOf = new Map();
  const fk = (f) => f.map((x) => (((x % P) + P) % P).toFixed(4)).join(",");
  sites.forEach((f, i) => idOf.set(fk(f), i));
  // Edges: each oxygen to its four neighbors (with the cell shift that
  // reaches the neighbor's image), each line once.
  const edges = [];
  const adj = sites.map(() => []);
  const near = [];
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      for (let dl = -1; dl <= 1; dl++)
        for (const [, fx, fy, fz] of crystal.basis) near.push([di + fx, dj + fy, dl + fz]);
  sites.forEach((f, i) => {
    const base = f.map(Math.floor);
    const own = f.map((x, k) => x - base[k]);
    const pi = toCart(axes, own);
    for (const g of near) {
      const pj = toCart(axes, g);
      if (Math.abs(dist(pi, pj) - oo) > 0.1) continue;
      const gf = g.map((x, k) => x + base[k]);
      const j = idOf.get(fk(gf));
      // Each line once: from the lower id, or (same pair) by its shift.
      const shift = gf.map((x, k) => x - f[k]);
      if (j < i || (j === i && shift.join() < shift.map((x) => -x).join())) continue;
      const e = edges.length;
      edges.push({ i, j, shift, from: -1 });
      adj[i].push(e);
      adj[j].push(e);
    }
  });
  // Hierholzer's walk with random turns.
  const used = new Uint8Array(edges.length);
  const ptr = adj.map(() => 0);
  for (const list of adj)
    for (let a = list.length - 1; a > 0; a--) {
      const b = Math.floor(rand() * (a + 1));
      [list[a], list[b]] = [list[b], list[a]];
    }
  for (let start = 0; start < sites.length; start++) {
    if (adj[start].every((e) => used[e])) continue;
    const stack = [start];
    while (stack.length) {
      const v = stack[stack.length - 1];
      while (ptr[v] < adj[v].length && used[adj[v][ptr[v]]]) ptr[v]++;
      if (ptr[v] === adj[v].length) {
        stack.pop();
        continue;
      }
      const e = adj[v][ptr[v]];
      used[e] = 1;
      edges[e].from = v;
      stack.push(edges[e].i === v ? edges[e].j : edges[e].i);
    }
  }
  // For each oxygen, the shifts to the neighbors its hydrogens point to.
  const out = sites.map(() => []);
  for (const e of edges) {
    if (e.from === e.i) out[e.i].push(e.shift);
    else out[e.j].push(e.shift.map((x) => -x));
  }
  return (f) => {
    const i = idOf.get(fk(f));
    return (out[i] || []).map((s) => f.map((x, k) => x + s[k]));
  };
}

// The hydrogens of a block of ice (adds them to atoms, as { el: "H", p, f,
// cell, owner }).
export function addIceHydrogens(crystal, atoms, rand) {
  const axes = cellAxes(crystal.cell);
  const partners = iceHydrogens(crystal, rand);
  const bond = crystal.hydrogens.bond;
  const H = [];
  atoms.forEach((a, owner) => {
    if (a.el !== "O") return;
    for (const g of partners(a.f)) {
      const q = toCart(axes, g);
      const d = q.map((x, k) => x - a.p[k]);
      const L = Math.hypot(...d);
      const p = a.p.map((x, k) => x + (d[k] / L) * bond);
      const f = a.f.map((x, k) => x + ((g[k] - x) * bond) / L);
      H.push({ el: "H", p, f, cell: a.cell, owner });
    }
  });
  return atoms.concat(H);
}
