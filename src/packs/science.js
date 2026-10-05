// Pack: science (lane Science, September 30, 2026). Real science data that
// already are Gaussians, shown exactly as splats, behind the labs switch:
//
//   thermal-ellipsoids  each atom of a crystal structure is the Gaussian of
//                       its measured displacement tensor U (src/science/crystal.js)
//   smlm-microscope     each molecule a super-resolution microscope found is a
//                       Gaussian as wide as its localization precision
//                       (src/science/smlm.js)
//   galaxy-box          each gas particle of a FIRE-2 galaxy is a Gaussian of
//                       the same spread as its smoothing kernel (an approximation)
//   cryoem-map          a cryo-EM density map's isosurface at EMDB's recommended
//                       level, a small flat splat per surface crossing
//                       (src/science/density.js; lane Science r3)
//
// The toys bring their own GPU program (src/science/field.js, labs only): the
// jiggle, the magnifier and the Gaussians' exact shapes.

import { quatFromTo, mix, shade, smoothstep, vec } from "../kit.js";
import { evenEllipsoid, evenCylinder, evenBox } from "./even.js";
import { element } from "../chem/elements.js";
import { perceiveBonds } from "../chem/molfile.js";
import { readCrystal, probabilityScale, centerOf, eigenSym3 } from "../science/crystal.js";
import { readSmlm, readLocalizations } from "../science/smlm.js";
import { STRUCTURES } from "../science/structures.js";
import { fillCell, cellsFor, completeMolecules } from "../science/symmetry.js";
import { readDensity, readBackbone, isoPoints } from "../science/density.js";
import { TERRAIN, CONTOUR } from "../science/terrain.js";
import {
  SCI_TYPE,
  sciPart,
  packAtom,
  quatFromAxes,
  sciModifier,
  unmagnify,
} from "../science/field.js";

// ---- Shared ------------------------------------------------------------------------------

// A file of this pack's assets as text or bytes (fetched in a browser, read
// from disk in Node for the build tools and tests).
async function readAsset(rel, binary = false) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    const b = await fs.readFile(url);
    return binary ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : b.toString("utf8");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return binary ? new Uint8Array(await r.arrayBuffer()) : r.text();
}

const f32 = new Float32Array(1);
const asF32 = (x) => ((f32[0] = x), f32[0]);
const fmt = (n) => Math.round(n).toLocaleString("en");
const clean = (s, n = 80) =>
  String(s ?? "")
    .replace(/[^\x20-\x7e]/g, "")
    .slice(0, n);

// Soft studio light baked into the colors (splats are unlit), as the other
// kit toys do: a key light from the upper left and a little gloss.
const LIGHT = vec.unit([-0.35, 0.8, 0.5]);
const VIEW = vec.unit([0.5, 0.28, 0.82]);
const HALF = vec.unit(vec.add(LIGHT, VIEW));
function lit(col, n, gloss = 0.35) {
  const d = vec.dot(n, LIGHT);
  const out = shade(col, 0.62 + 0.42 * Math.max(0, d) + 0.06 * d);
  return mix(out, "#ffffff", gloss * Math.max(0, vec.dot(n, HALF)) ** 24);
}

// The magnifier's state, shared by the toys: where it looks (toy units)
// and how far it has moved there.
function focusState() {
  return { at: [0, 0, 0], goal: [0, 0, 0], last: null };
}
function easeFocus(F, time) {
  const dt = F.last === null ? 0 : Math.max(0, Math.min(0.1, time - F.last));
  F.last = time;
  const k = 1 - Math.exp(-dt / 0.28);
  for (let i = 0; i < 3; i++) F.at[i] += (F.goal[i] - F.at[i]) * k;
}

// ---- Thermal ellipsoids ------------------------------------------------------------------

// r3: twenty-five structures in six groups (tools/sci3-structures.mjs writes
// the catalog; the ids of r1's aspirin and crambin are kept for old links).
export const ELLIPSOID_SAMPLES = STRUCTURES;

const ELL = {
  cache: new Map(), // sample id -> structure
  custom: null, // { name, structure }
  want: null, // the structure the next build draws
  info: null, // what the last build drew
  sigMaxToy: 1,
  focus: focusState(),
};
export const ellipsoidState = () => (ELL.info ? { ...ELL.info } : null);

const LEVELS = { 30: 0.3, 50: 0.5, 90: 0.9 };
const MAX_ZOOM = 9; // the magnifier's largest magnification
const STICK = 0.075; // bond radius, Å
const H_SIGMA = [0.075, 0.075, 0.075]; // a small hydrogen's "sigma" at 50%: a sphere of 0.115 Å

// Element colors (the familiar CPK ones), a little softened for the dark stage.
function atomColor(el) {
  const c = element(el)?.color ?? "#ff66cc";
  if (el === "C") return "#8d9297";
  if (el === "H") return "#eef1f4";
  if (el === "O") return "#e8403a";
  if (el === "N") return "#3f6ff0";
  return c;
}

const apply = (R, v) => R.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

// Rows of a rotation that lays the atoms' principal axes along x, y, z.
function faceOn(atoms) {
  const c = centerOf(atoms);
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const a of atoms)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) m[i][j] += (a.p[i] - c[i]) * (a.p[j] - c[j]);
  return eigenSym3(m).vectors;
}

// r3: the structure as the Show option asks: the file's atoms, or the unit
// cell (a block of cells for a small one) with each atom's symmetry copies.
// Only a small-molecule CIF has a cell to fill; a protein shows its atoms.
const FILLED = new WeakMap(); // the file's molecules, completed by symmetry
const CELLS = new WeakMap(); // the unit cell
function shownStructure(s, show = "auto", suits = "molecule") {
  const want = show === "auto" || !show ? suits : show;
  if (want === "file") return s;
  if (want !== "cell") {
    if (!FILLED.has(s)) FILLED.set(s, completeMolecules(s));
    return FILLED.get(s);
  }
  if (s.format !== "cif" || !s.cellM) {
    return { ...s, notes: [...s.notes, "Only a small-molecule CIF has a unit cell to fill, so this shows the file's atoms."] }; // prettier-ignore
  }
  if (!CELLS.has(s)) {
    // A molecule's copies stay whole; a mineral's atoms wrap into the cell.
    const molecular = s.atoms.some((a) => a.el === "C") && s.atoms.some((a) => a.el === "H");
    CELLS.set(s, fillCell(s, { cells: molecular ? [1, 1, 1] : cellsFor(s.cell), molecular }));
  }
  return CELLS.get(s);
}

// The bonds: the heavy atoms' from their distances, and each hydrogen to its
// nearest heavy atom (r3: ice's hydrogens are half-occupied sites, two to an
// O···O line, and must not bond to each other).
function bondsOf(atoms, pos) {
  const heavy = [];
  const hyd = [];
  atoms.forEach((a, i) => (a.el === "H" ? hyd : heavy).push(i));
  const bonds = perceiveBonds(heavy.map((i) => ({ el: atoms[i].el, p: pos[i] }))).map(([a, b]) => [heavy[a], heavy[b]]); // prettier-ignore
  if (!hyd.length) return bonds;
  const cell = 1.3;
  const grid = new Map();
  const key = (p) => p.map((v) => Math.floor(v / cell));
  for (const i of heavy) {
    const k = key(pos[i]).join(",");
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  for (const h of hyd) {
    const [cx, cy, cz] = key(pos[h]);
    let best = -1;
    let bd = 1.25 * 1.25;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const i of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
            const d = vec.sub(pos[i], pos[h]);
            const d2 = vec.dot(d, d);
            if (d2 < bd && d2 > 0.25) [best, bd] = [i, d2];
          }
    if (best >= 0) bonds.push([best, h]);
  }
  return bonds;
}

// A molecule needs fewer splats than most toys: 0.6 of the kit's count (36k,
// 84k, 120k and 168k by tier) keeps every atom solid and a phone smooth.
export const THERMAL_DENSITY = 0.6;
const THERMAL = {
  density: THERMAL_DENSITY,
  alive: (c) => (c.jiggle ?? 0) > 0,
  options: [
    {
      key: "structure",
      label: "Structure",
      type: "select",
      default: "aspirin",
      choices: [
        ...ELLIPSOID_SAMPLES.map((s) => ({ id: s.id, label: s.label, group: s.group })),
        { id: "custom", label: "Your file (open one below)" },
      ],
    },
    {
      // r3: a mineral's file lists only a few atoms (the asymmetric unit);
      // its symmetry copies fill the unit cell.
      key: "show",
      label: "Show",
      type: "select",
      default: "auto",
      choices: [
        { id: "auto", label: "What suits it" },
        { id: "file", label: "The atoms the file lists" },
        { id: "cell", label: "The unit cell" },
      ],
    },
    {
      key: "level",
      label: "Probability",
      type: "select",
      default: "50",
      choices: [
        { id: "30", label: "30%" },
        { id: "50", label: "50% (the usual)" },
        { id: "90", label: "90%" },
      ],
    },
    {
      key: "look",
      label: "Draw each atom as",
      type: "select",
      default: "solid",
      choices: [
        { id: "solid", label: "A solid ellipsoid" },
        { id: "gauss", label: "One Gaussian splat" },
      ],
    },
    { key: "bonds", label: "Bonds", type: "switch", default: true },
    {
      key: "hydrogens",
      label: "Hydrogens",
      type: "select",
      default: "small",
      choices: [
        { id: "small", label: "Small spheres (the usual)" },
        { id: "measured", label: "As refined" },
        { id: "hidden", label: "Hidden" },
      ],
    },
    { key: "fileName", label: "File name", type: "text", default: "", hidden: true },
  ],
  controls: [
    { key: "jiggle", label: "Jiggle", type: "toggle", default: 0, ease: 0.7 },
    { key: "zoom", label: "Zoom in", type: "slider", default: 0 },
    { key: "look", label: "Look there", type: "pulse", ease: 0.4 },
  ],
  action: {
    key: "jiggle",
    label: "Jiggle the atoms",
    // Zoomed in, a tap looks at the atom you tap instead.
    at(point, c) {
      if ((c.zoom ?? 0) < 0.04 || !ELL.toy) return undefined;
      const toy = ELL.toy(point);
      const m = Math.pow(MAX_ZOOM, c.zoom);
      const u = smoothstep(0, 0.3, c.zoom);
      ELL.focus.goal = unmagnify(toy, ELL.focus.at, m, u);
      return { key: "look" };
    },
  },
  input: {
    title: "Your own crystal structure",
    fileButton: "Open a CIF, mmCIF or PDB file…",
    accept: ".cif,.mmcif,.pdb,.ent,.txt",
    note: "A small-molecule CIF (with _atom_site_aniso_U_11 … U_23), or an mmCIF or PDB file with anisotropic records (_atom_site_anisotrop or ANISOU). Atoms with only an isotropic U show as spheres. The file stays on this device.",
    async read(text, fileName) {
      const s = readCrystal(text, fileName);
      const base = String(fileName || "Your structure").replace(/\.[^.]+$/, "");
      const named = s.name && s.name !== s.id && s.name !== s.formula;
      const name = clean(named ? s.name : s.formula ? `${base} (${s.formula})` : base, 60);
      ELL.custom = { name, structure: s };
      return { structure: "custom", fileName: clean(fileName || name) };
    },
    shown() {
      const i = ELL.info;
      if (!i) return "";
      const c = i.counts;
      return [
        `${i.name}: ${fmt(c.atoms)} atoms (${fmt(c.aniso)} anisotropic), ${fmt(i.splats)} splats.`,
        ...i.notes,
      ].join(" ");
    },
  },
  credits: ELLIPSOID_SAMPLES.map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
  // Points the magnifier at a residue ("TYR44") or an atom's label (for the
  // clips; a tap does the same when zoomed in).
  sciFocus(label) {
    const S = ELL.shown;
    if (!S || !ELL.toy) return false;
    const want = String(label).toUpperCase();
    const hit = S.atoms.map((a, i) => (a.label.toUpperCase().startsWith(`${want} `) || a.label.toUpperCase() === want ? i : -1)).filter((i) => i >= 0); // prettier-ignore
    if (!hit.length) return false;
    const c = [0, 0, 0];
    for (const i of hit) for (let k = 0; k < 3; k++) c[k] += S.pos[i][k] / hit.length;
    ELL.focus.goal = ELL.toy(c);
    ELL.focus.at = ELL.focus.goal.slice();
    return true;
  },
  async prepare(o) {
    if (o.structure === "custom" && ELL.custom) {
      const st = shownStructure(ELL.custom.structure, o.show, "molecule");
      ELL.want = { name: ELL.custom.name, structure: st, custom: true };
      return;
    }
    const def = ELLIPSOID_SAMPLES.find((s) => s.id === o.structure) || ELLIPSOID_SAMPLES[0];
    if (!ELL.cache.has(def.id)) {
      const text = await readAsset(`../../assets/toys/thermal-ellipsoids/${def.file}`);
      ELL.cache.set(def.id, readCrystal(text, def.file));
    }
    const name = def.temperature ? `${def.title}, measured at ${Math.round(def.temperature)} K` : def.title; // prettier-ignore
    ELL.want = { name, structure: shownStructure(ELL.cache.get(def.id), o.show, def.show), custom: false }; // prettier-ignore
  },
  drive(t, c, out, info) {
    const z = Math.max(0, Math.min(1, c.zoom ?? 0));
    const m = Math.pow(MAX_ZOOM, z);
    const u = smoothstep(0, 0.3, z);
    const F = ELL.focus;
    easeFocus(F, info.time);
    const j = smoothstep(0, 1, c.jiggle ?? 0);
    // Zoomed in, a clipping slab keeps the atoms in front of the focus out
    // of the way (off at rest).
    const clip = z > 0.001 ? 1.6 - 1.05 * u : 0;
    out.morph = [j, m, 0, clip];
    out.glow = [F.at[0], F.at[1], F.at[2], u];
  },
  build(k, o) {
    const want = ELL.want;
    if (!want) throw new Error("There is no structure to show.");
    const s = want.structure;
    const level = LEVELS[o.level] ?? 0.5;
    const P = probabilityScale(level);
    const gauss = o.look === "gauss";
    // Hydrogens usually ride on their atoms with a U set from the atom's, not
    // measured, so crystallographers draw them as small spheres.
    const hyd = o.hydrogens === false ? "hidden" : o.hydrogens === true ? "measured" : o.hydrogens; // prettier-ignore
    let atoms = s.atoms
      .filter((a) => hyd !== "hidden" || a.el !== "H")
      .map((a) => (a.el === "H" && hyd !== "measured" && !a.aniso ? { ...a, draw: H_SIGMA } : a)); // prettier-ignore
    if (!atoms.length) throw new Error("This structure has only hydrogens; switch Hydrogens on.");
    // Turned to face the camera: the widest spread across, the flattest
    // direction toward you (a crystal's axes say nothing about the view).
    const R = faceOn(atoms);
    const c0 = centerOf(atoms);
    const pos = atoms.map((a) => apply(R, vec.sub(a.p, c0)));
    atoms = atoms.map((a) => ({ ...a, axes: a.axes.map((e) => apply(R, e)) }));
    // The fit is known only after the build; the packed sizes are fractions
    // of the largest, and gpuField() gets the fit's scale from k.
    const sigMax = Math.max(...atoms.map((a) => a.sigma[0]));
    k.fitMorphs = false;
    const unit = evenEllipsoid(k, 1, 1, 1, 40);
    atoms.forEach((a, i) => {
      const quat = quatFromAxes(a.axes);
      const [px, pz, pw] = packAtom(SCI_TYPE.atom, quat, a.sigma, sigMax, i);
      const col = atomColor(a.el);
      if (gauss) return;
      const r = (a.draw ?? a.sigma).map((x) => x * P);
      // ORTEP's principal ellipses: a dark line round each principal plane
      // of an anisotropic atom (spheres, the isotropic atoms, have none).
      const band = a.aniso ? 0.075 : 0;
      // The colors never ask the kit to keep them from a pattern ({ keep }):
      // that adds 16 to the part field, which holds the packed type here, and
      // turned every atom's splats into whole-atom Gaussians (r2: the owner's
      // "really big" ellipsoids).
      k.add(unit, {
        pos: pos[i],
        quat,
        scale: r,
        even: true,
        flat: 0.2,
        jitter: 0.008,
        opacity: 1,
        part: px,
        params: [pz, pw],
        color: (cc) => {
          const lp = cc.lp;
          const line = band && Math.min(Math.abs(lp[0]), Math.abs(lp[1]), Math.abs(lp[2])) < band;
          return lit(line ? shade(col, a.el === "H" ? 0.5 : 0.35) : col, cc.n);
        },
      });
    });
    if (gauss) {
      const root2 = Math.SQRT2;
      k.cloud({ count: (atoms.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
        const a = atoms[i];
        if (!a) return null;
        const quat = quatFromAxes(a.axes);
        const [px, pz, pw] = packAtom(SCI_TYPE.gauss, quat, a.draw ?? a.sigma, sigMax, i);
        const base = k.baseSize || 0.01;
        return {
          p: pos[i],
          n: a.axes[2],
          flat: a.sigma[2] / a.sigma[0],
          size: (root2 * a.sigma[0]) / base,
          color: atomColor(a.el),
          opacity: 1,
          part: px,
          params: [pz, pw],
        };
      });
    }
    let bonds = [];
    if (o.bonds !== false) {
      bonds = bondsOf(atoms, pos);
      // A unit cell's sticks are thinner, so its small ellipsoids show.
      const r = s.edges ? STICK * 0.55 : STICK;
      const stick = evenCylinder(r, r, 1, false);
      for (const [i, j] of bonds) {
        const d = vec.sub(pos[j], pos[i]);
        const len = vec.len(d);
        if (len < 1e-3) continue;
        const ci = atomColor(atoms[i].el);
        const cj = atomColor(atoms[j].el);
        k.add(stick, {
          pos: vec.mul(vec.add(pos[i], pos[j]), 0.5),
          quat: quatFromTo([0, 1, 0], vec.mul(d, 1 / len)),
          scale: [1, len, 1],
          even: true,
          flat: 0.2,
          jitter: 0.008,
          opacity: 1,
          weight: 0.6,
          part: sciPart(SCI_TYPE.bond),
          color: (cc) => lit(shade(cc.lp[1] < 0 ? ci : cj, 0.85), cc.n, 0.2),
        });
      }
    }
    // r3: the unit cell's edges, as thin lines of splats stretched along them.
    if (s.edges) {
      const SEG = 24;
      const lines = [];
      for (const [a, b] of s.edges) {
        const pa = apply(R, vec.sub(a, c0));
        const pb = apply(R, vec.sub(b, c0));
        const d = vec.sub(pb, pa);
        const len = vec.len(d);
        for (let i = 0; i < SEG; i++)
          lines.push({ p: vec.add(pa, vec.mul(d, (i + 0.5) / SEG)), dir: vec.mul(d, 1 / len), len: len / SEG }); // prettier-ignore
      }
      k.cloud({ count: (lines.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
        const e = lines[j];
        if (!e) return null;
        const base = k.baseSize || 0.01;
        const across = 0.035; // Å
        return {
          p: e.p,
          dir: e.dir,
          size: across / base,
          stretch: (0.8 * e.len) / across,
          color: "#8a94ad",
          opacity: 0.9,
          part: sciPart(SCI_TYPE.plain),
        };
      });
    }
    ELL.sigMax = sigMax;
    ELL.focus = focusState();
    ELL.shown = { atoms, pos };
    ELL.info = {
      name: want.name,
      custom: want.custom,
      format: s.format,
      counts: s.counts,
      notes: s.notes,
      shownAtoms: atoms.length,
      bonds: bonds.length,
      level,
      scale: P,
      get splats() {
        return k.buf?.count ?? 0;
      },
    };
    k.data = { ellipsoids: ELL.info };
  },
};

// The fit is applied after build(); gpuField() and the tap need it.
function afterFit(fit) {
  const s = fit?.scale ?? 1;
  const c = fit?.center ?? [0, 0, 0];
  ELL.sigMaxToy = (ELL.sigMax ?? 1) * s;
  ELL.toy = (p) => p.map((v, i) => (v - c[i]) * s);
}
THERMAL.gpuField = function (_o, fit) {
  afterFit(fit);
  return sciModifier(ELL.sigMaxToy);
};

// ---- Super-resolution microscope ---------------------------------------------------------

const CC_BY = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" };
export const MICROSCOPE_SAMPLES = [
  {
    id: "sample",
    choice: "Microtubules and clathrin",
    file: "cos7-mt-clathrin.smlm",
    label: "Microtubules and clathrin in a COS cell (a 12 µm square)",
    title: "Microtubules and clathrin in a Cos cell (ShareLoc.XYZ, 10.5281/zenodo.5507427)",
    author:
      "Christophe Leterrier (Aix Marseille Université, CNRS, NeuroCyto), on ShareLoc.XYZ; a 12 µm square cut from the record (a subset)",
    source: "https://doi.org/10.5281/zenodo.5507427",
    ...CC_BY,
  },
  {
    id: "nucleus",
    choice: "A whole nucleus (3D)",
    file: "nucleus-nup.smlm",
    label: "Nuclear pores over a whole nucleus, in 3D (half the localizations)",
    title: "Zola-3D NUP full nucleus (ShareLoc.XYZ, 10.5281/zenodo.7233696)",
    author:
      "Andrey Aristov (Institut Pasteur), uploaded by Benoit Lelandais, on ShareLoc.XYZ; a random half of the localizations (a subset)",
    source: "https://doi.org/10.5281/zenodo.7233696",
    ...CC_BY,
  },
  // r3 (the brief's "nuclear pores, actin, mitochondria ... 3D sets"): four
  // more ShareLoc.XYZ records, cut by tools/sci3-samples.mjs. Three have no
  // precision column; theirs is estimated from the data by NeNA (the
  // distances between a molecule's localizations in consecutive frames),
  // one value for the whole set.
  {
    id: "pores",
    choice: "Nuclear pores",
    file: "pores-wga.smlm",
    conserve: 1,
    label: "Nuclear pores in a frog oocyte's nuclear envelope (an 8 µm square)",
    title: "Xenopus laevis nuclear pore complex stained with WGA-ATTO520 (ShareLoc.XYZ, 10.5281/zenodo.7182237)", // prettier-ignore
    author: "Anna Löschberger, on ShareLoc.XYZ; an 8 µm square cut from the record (a subset)",
    source: "https://doi.org/10.5281/zenodo.7182237",
    note: "The record gives no precision; NeNA estimates 11.5 nm for the whole set.",
    ...CC_BY,
  },
  {
    id: "actin",
    choice: "Actin",
    file: "actin-cos7.smlm",
    conserve: 1,
    label: "Actin filaments at a COS-7 cell's edge (a 10 µm square)",
    title: "Actin with PhalloidinAF647 in COS7 (ShareLoc.XYZ, 10.5281/zenodo.5510661)",
    author: "Sarah Aufmkolk, on ShareLoc.XYZ; a 10 µm square of one cell, 174,903 of its localizations (a subset)", // prettier-ignore
    source: "https://doi.org/10.5281/zenodo.5510661",
    note: "The record gives no precision; NeNA estimates 9.9 nm for the whole set.",
    ...CC_BY,
  },
  {
    id: "mitochondria",
    choice: "Mitochondria",
    file: "mitochondria-tom22.smlm",
    conserve: 1,
    label: "Mitochondria (their outer membrane's TOM22) in a COS-7 cell (a 15 µm square)",
    title: "Mitochondrial protein TOM22 in COS7 cells (ShareLoc.XYZ, 10.5281/zenodo.5512636)",
    author: "Wei Ouyang, on ShareLoc.XYZ; a 15 µm square of one field, 219,846 of its localizations (a subset)", // prettier-ignore
    source: "https://doi.org/10.5281/zenodo.5512636",
    note: "The record gives no precision; NeNA estimates 12.4 nm for the whole set.",
    ...CC_BY,
  },
  {
    id: "microtubules3d",
    choice: "Microtubules (3D)",
    file: "microtubules-zola-3d.smlm",
    conserve: 1,
    label: "Microtubules in 3D in a U-373 cell (a 12 µm square)",
    title: "ZOLA-3D microtubules (ShareLoc.XYZ, 10.5281/zenodo.6861446)",
    author: "Andrey Aristov, Benoit Lelandais and Christophe Zimmer (Institut Pasteur), on ShareLoc.XYZ; a 12 µm square, 159,785 of its localizations (a subset)", // prettier-ignore
    source: "https://doi.org/10.5281/zenodo.6861446",
    ...CC_BY,
  },
];
export const MICROSCOPE_SAMPLE = MICROSCOPE_SAMPLES[0];

const MIC = {
  samples: new Map(), // sample id -> its table
  custom: null, // { name, table }
  want: null,
  info: null,
  sliceZ: 0, // the tap's slice depth (toy units)
  unit: 1, // toy units per µm
  toy: null,
  grid: null, // localizations bucketed by x, y for the tap's depth
};
export const microscopeState = () => (MIC.info ? { ...MIC.info } : null);

// Splat budgets by tier: the kit's count with density 1.4 (84k, 196k,
// 280k and 392k localizations on the low, mid, high and max tiers), so the
// sample's 170,401 are all drawn from the mid tier up.
export const MICROSCOPE_DENSITY = 1.4;
// r2 (the owner: "Couldn't they just zoom in really, really far
// themselves?"): the camera comes all the way in with a pinch or the wheel,
// to 0.02 of the field's radius (about 150 times closer than the home view, a
// view about 120 nm across on the sample; closer, the camera would be inside
// a 3D cloud of molecules).
export const MICROSCOPE_CLOSE = 0.02;
// The tap's slice: 100 nm either side of the depth you tap.
const SLICE_NM = 100;
const UM = 1e-3; // nm to µm (the recipe's units)

// A perceptual rainbow for depth (Google's Turbo, a polynomial fit) and a
// dark-to-bright one for time.
function turbo(t) {
  const x = Math.max(0, Math.min(1, t));
  const r = 0.1357 + x * (4.5974 - x * (42.3277 - x * (130.5887 - x * (150.5666 - x * 58.1375))));
  const g = 0.0914 + x * (2.1856 + x * (4.8052 - x * (14.0195 - x * (4.2109 + x * 2.7747))));
  const b = 0.1067 + x * (12.5925 - x * (60.1097 - x * (109.0745 - x * (88.5066 - x * 26.8183))));
  return [r, g, b].map((v) => Math.max(0, Math.min(1, v)));
}
const TIME_STOPS = ["#3b2a98", "#2f7fd0", "#23b8a8", "#8fd24a", "#f5e03c"];
function timeColor(t) {
  const x = Math.max(0, Math.min(1, t)) * (TIME_STOPS.length - 1);
  const i = Math.min(TIME_STOPS.length - 2, Math.floor(x));
  return mix(TIME_STOPS[i], TIME_STOPS[i + 1], x - i);
}
const CHANNEL_COLORS = ["#ff4a24", "#1ee8ff", "#ffe23a", "#b86bff"];

// Robust ends of a column (the 1st and 99th percentiles, from a sample).
function range(a, n) {
  const step = Math.max(1, Math.floor(n / 20000));
  const v = [];
  for (let i = 0; i < n; i += step) if (Number.isFinite(a[i])) v.push(a[i]);
  if (!v.length) return [0, 1];
  v.sort((p, q) => p - q);
  const lo = v[Math.floor(v.length * 0.01)];
  const hi = v[Math.floor(v.length * 0.99)];
  return hi > lo ? [lo, hi] : [lo - 1, lo + 1];
}

// The median of a column (from a sample of it).
function median(a, n) {
  const step = Math.max(1, Math.floor(n / 20000));
  const v = [];
  for (let i = 0; i < n; i += step) if (a[i] > 0) v.push(a[i]);
  v.sort((p, q) => p - q);
  return v.length ? v[v.length >> 1] : 1;
}

// Which localizations to draw when a file has more than the budget: an even
// spread (every k-th after a fixed shuffle of blocks), the same on every build.
function pickIndices(n, budget) {
  if (n <= budget) return null;
  const out = new Uint32Array(budget);
  const step = n / budget;
  for (let j = 0; j < budget; j++) out[j] = Math.min(n - 1, Math.floor(j * step + ((j * 0.618034) % 1) * step)); // prettier-ignore
  return out;
}

const MICROSCOPE = {
  alive: false,
  density: MICROSCOPE_DENSITY,
  options: [
    {
      key: "data",
      label: "Data",
      type: "select",
      default: "sample",
      choices: [
        ...MICROSCOPE_SAMPLES.map((d) => ({ id: d.id, label: d.choice })),
        { id: "custom", label: "Your file (open one below)" },
      ],
    },
    {
      key: "color",
      label: "Color by",
      type: "select",
      default: "depth",
      choices: [
        { id: "depth", label: "Depth (z)" },
        { id: "frame", label: "Time (frame)" },
        { id: "channel", label: "Channel" },
      ],
    },
    {
      key: "stretch",
      label: "Depth scale",
      type: "select",
      default: "1",
      choices: [
        { id: "1", label: "True (1×)" },
        { id: "4", label: "Stretched 4×" },
      ],
    },
    {
      key: "precision",
      label: "Precision",
      type: "select",
      default: "all",
      choices: [
        { id: "all", label: "All localizations" },
        { id: "5", label: "Better than 5 nm" },
        { id: "3", label: "Better than 3 nm" },
      ],
    },
    { key: "fileName", label: "File name", type: "text", default: "", hidden: true },
  ],
  closeUp: { minDistance: MICROSCOPE_CLOSE },
  controls: [
    { key: "slice", label: "A slice at one depth", type: "toggle", default: 0, ease: 0.6 },
  ],
  action: {
    key: "slice",
    label: "Show a slice at the depth you tap",
    // A tap shows a thin slice (200 nm) at the depth of the molecules you tap;
    // a second tap shows them all again.
    at(point, c) {
      if ((c.slice ?? 0) > 0.5 || !MIC.toy || !MIC.info) return undefined;
      MIC.sliceZ = MIC.toy(focusPoint(point))[2];
      return undefined;
    },
  },
  input: {
    title: "Your own localizations",
    fileButton: "Open a .smlm or ThunderSTORM CSV file…",
    accept: ".smlm,.csv,.txt,.zip",
    binary: true,
    note: "A .smlm file (ShareLoc.XYZ's format) or a CSV from ThunderSTORM with x, y (and z) in nanometers and the localization uncertainty. Each localization becomes a Gaussian as wide as its precision. The file stays on this device.",
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a .smlm or CSV file.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const table = await readLocalizations(bytes, fileName);
      const name = clean(String(file.name || fileName || "Your localizations").replace(/\.[^.]+$/, ""), 60); // prettier-ignore
      MIC.custom = { name, table };
      return { data: "custom", fileName: clean(file.name || fileName) };
    },
    shown() {
      const i = MIC.info;
      if (!i) return "";
      const kept = i.kept < i.n ? ` ${fmt(i.kept)} pass the precision filter.` : "";
      const some = i.drawn < i.kept ? ` Drawing ${fmt(i.drawn)} of them (this device's budget).` : ""; // prettier-ignore
      return [`${i.name}: ${fmt(i.n)} localizations.${kept}${some}`, ...i.notes].join(" ");
    },
  },
  credits: MICROSCOPE_SAMPLES.map((d) => ({
    label: d.choice,
    title: d.title,
    source: d.source,
    author: d.author,
    license: d.license,
    licenseUrl: d.licenseUrl,
  })),
  async prepare(o) {
    if (o.data === "custom" && MIC.custom) {
      MIC.want = { name: MIC.custom.name, table: MIC.custom.table, custom: true };
      return;
    }
    const def = MICROSCOPE_SAMPLES.find((d) => d.id === o.data) || MICROSCOPE_SAMPLES[0];
    if (!MIC.samples.has(def.id)) {
      const bytes = await readAsset(`../../assets/toys/smlm-microscope/${def.file}`, true);
      MIC.samples.set(def.id, await readSmlm(bytes));
    }
    MIC.want = { name: def.label, table: MIC.samples.get(def.id), custom: false, note: def.note, conserve: def.conserve ?? 0 }; // prettier-ignore
  },
  drive(t, c, out) {
    // Every localization is drawn at least about a pixel wide, wherever the
    // camera is; the slice narrows from the whole field to 200 nm.
    const s = smoothstep(0, 1, c.slice ?? 0);
    const thin = SLICE_NM * UM * (MIC.grid?.stretch ?? 1) * (MIC.unit ?? 1);
    out.morph = [0, 1, 0.0008, MIC.want?.conserve ?? 0];
    // (on a log scale, so it visibly narrows all the way)
    out.glow = [0, 0, MIC.sliceZ ?? 0, s > 0.01 ? thin * Math.pow(2 / thin, 1 - s) : 0];
  },
  build(k, o) {
    const want = MIC.want;
    if (!want) throw new Error("There are no localizations to show.");
    const T = want.table;
    const budget = Math.max(1000, Math.floor(k.count * 0.985));
    // The precision filter keeps the localizations fitted better than a
    // limit (as SMLM tools filter by uncertainty); then the budget.
    const limit = Number(o.precision) || Infinity;
    let pool = null;
    if (limit < Infinity) {
      pool = [];
      for (let i = 0; i < T.n; i++) if (T.sxy[i] < limit) pool.push(i);
      if (!pool.length) throw new Error(`No localization in this file is better than ${limit} nm.`);
      pool = Uint32Array.from(pool);
    }
    const nPool = pool ? pool.length : T.n;
    const pick = pickIndices(nPool, budget);
    const count = pick ? pick.length : nPool;
    const at = (j) => {
      const q = pick ? pick[j] : j;
      return pool ? pool[q] : q;
    };
    const stretch = Number(o.stretch) || 1;
    const [x0, x1] = range(T.x, T.n);
    const [y0, y1] = range(T.y, T.n);
    const [z0, z1] = T.has3D ? range(T.z, T.n) : [-1, 1];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const cz = T.has3D ? (z0 + z1) / 2 : 0;
    const f0 = T.frames?.[0] ?? 0;
    const fr = Math.max(1, (T.frames?.[1] ?? 1) - f0);
    // The slide: a dark plate just behind the molecules, as big as the field.
    const w = (x1 - x0) * UM * 1.06;
    const h = (y1 - y0) * UM * 1.06;
    const back = (z0 - cz) * UM * stretch - Math.max(w, h) * 0.02;
    k.add(evenBox(w, h, Math.max(w, h) * 0.01), {
      pos: [0, 0, back - Math.max(w, h) * 0.005],
      even: true,
      color: "#07080b",
      jitter: 0,
      opacity: 1,
      flat: 0.3,
      part: sciPart(SCI_TYPE.plain),
    });
    const P = (i) => [(T.x[i] - cx) * UM, -(T.y[i] - cy) * UM, (T.z[i] - cz) * UM * stretch];
    // Each localization carries the same total light, as ThunderSTORM's
    // normalized Gaussians do: a spot twice as uncertain is a quarter as
    // bright, so the precise ones stand out (the median's opacity is `base`).
    const sMed = median(T.sxy, T.n);
    const base = T.has3D ? 0.55 : 0.35;
    const alphaOf = (i) => Math.max(0.05, Math.min(0.9, base * (sMed / T.sxy[i]) ** 2));
    const colorOf = (i) => {
      if (o.color === "frame") return timeColor((T.frame[i] - f0) / fr);
      if (o.color === "channel") return CHANNEL_COLORS[T.channel[i] % CHANNEL_COLORS.length];
      // A flat (2D) file has no depth to color by: one warm color, so the
      // density shows instead.
      return T.has3D ? turbo((T.z[i] - z0) / (z1 - z0)) : "#ffb347";
    };
    k.cloud({ count: (count * 160000) / k.count, jitter: 0 }, (_r, j) => {
      if (j >= count) return null;
      const i = at(j);
      const base = k.baseSize || 0.01;
      // Its true size (√2 σ, for the renderer's exp(−r²/s²)), which the GPU
      // program uses; the stored splat is at least 30 nm wide so the field
      // shows without labs too (thumbnails, a link with labs off).
      const sxy = T.sxy[i] * UM * Math.SQRT2;
      const sz = T.sz[i] * UM * Math.SQRT2 * stretch;
      const shown = Math.max(sxy, 0.03);
      return {
        p: P(i),
        n: [0, 0, 1],
        flat: Math.max(sz, 0.03) / shown,
        size: shown / base,
        color: colorOf(i),
        opacity: alphaOf(i),
        part: sciPart(SCI_TYPE.loc),
        params: [asF32(sxy), asF32(sz)],
      };
    });
    // For the tap: the localizations bucketed in 250 nm cells, to find the
    // depth of the molecules where you tap.
    const cell = 250;
    const grid = new Map();
    for (let j = 0; j < count; j += 1) {
      const i = at(j);
      const key = `${Math.floor(T.x[i] / cell)},${Math.floor(T.y[i] / cell)}`;
      let g = grid.get(key);
      if (!g) grid.set(key, (g = []));
      if (g.length < 64) g.push(T.z[i]);
    }
    MIC.grid = { cell, grid, cx, cy, cz, stretch };
    MIC.info = {
      name: want.name,
      custom: want.custom,
      n: T.n,
      kept: nPool,
      drawn: count,
      has3D: T.has3D,
      channels: T.channels,
      notes: want.note ? [...T.notes, want.note] : T.notes,
      size: [(x1 - x0) * UM, (y1 - y0) * UM],
    };
    k.data = { microscope: MIC.info };
  },
};

const mixN = (a, b, t) => a + (b - a) * t;

// The tapped point (recipe units, µm), moved to the depth of the molecules
// there (the most crowded depth of the localizations within about 250 nm).
function focusPoint(p) {
  const G = MIC.grid;
  if (!G) return p;
  const x = p[0] / UM + G.cx;
  const y = -p[1] / UM + G.cy;
  const zs = [];
  const cx = Math.floor(x / G.cell);
  const cy = Math.floor(y / G.cell);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) zs.push(...(G.grid.get(`${cx + dx},${cy + dy}`) ?? []));
  if (!zs.length) return [p[0], p[1], 0];
  // The most crowded depth there (100 nm bins, the nearer one on a tie):
  // the structure itself, not a middle that may be empty (a nucleus).
  const bins = new Map();
  for (const z of zs) {
    const b = Math.floor(z / 100);
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  let best = null;
  for (const [b, n] of bins)
    if (!best || n > best[1] || (n === best[1] && b > best[0])) best = [b, n];
  const inBin = zs.filter((z) => Math.floor(z / 100) === best[0]);
  const zc = inBin.reduce((a, z) => a + z, 0) / inBin.length;
  return [p[0], p[1], (zc - G.cz) * UM * G.stretch];
}

MICROSCOPE.gpuField = function (_o, fit) {
  const s = fit?.scale ?? 1;
  const c = fit?.center ?? [0, 0, 0];
  MIC.toy = (p) => p.map((v, i) => (v - c[i]) * s);
  MIC.unit = s;
  return sciModifier(1, s, { free: true });
};
// For the clips: [x, y] in µm from the field's center, moved to the depth
// of the molecules there (recipe units).
MICROSCOPE.sciPoint = (xy) => focusPoint([xy[0], xy[1], 0]);

// ---- Galaxy in a box ---------------------------------------------------------------------

export const GALAXY_SAMPLE = {
  file: "m12i-gas.bin",
  label: "FIRE-2 m12i, a Milky Way–mass galaxy today (z = 0)",
  title: "FIRE-2 cosmological zoom-in simulation m12i, snapshot 600 (z = 0), gas",
  author:
    "The FIRE project: Wetzel et al. (2023, 2025), Hopkins (2015), Hopkins et al. (2018); m12i from Wetzel et al. (2016). A subset: 300,000 of the 2.45 million gas particles in a 40 kpc box round the galaxy",
  source: "https://flathub.flatironinstitute.org/fire",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};

// r3: more galaxies, each a FIRE-2 snapshot cut by tools/sci3-galaxy.mjs
// (the gas as tools/sci-galaxy.mjs cuts it, and the stars for the
// telescope view).
const FIRE_CITE =
  "The FIRE project: Wetzel et al. (2023, 2025), Hopkins (2015), Hopkins et al. (2018)";
export const GALAXY_SAMPLES = [
  {
    id: "m12i",
    choice: "A Milky Way–mass galaxy today",
    gas: GALAXY_SAMPLE.file,
    stars: "m12i-stars.bin",
    label: GALAXY_SAMPLE.label,
    title: GALAXY_SAMPLE.title,
    author: GALAXY_SAMPLE.author,
  },
  {
    id: "m12i-z2",
    choice: "The same galaxy 10.4 billion years ago",
    gas: "m12i-z2-gas.bin",
    stars: "m12i-z2-stars.bin",
    label: "FIRE-2 m12i at z = 2, 10.4 billion years ago, when it was young and clumpy",
    title: "FIRE-2 cosmological zoom-in simulation m12i, snapshot 172 (z = 2), gas and stars",
    author: `${FIRE_CITE}; m12i from Wetzel et al. (2016). A subset of the particles in a 24 kpc box round the galaxy`, // prettier-ignore
  },
  {
    id: "m11h",
    choice: "A dwarf galaxy today",
    gas: "m11h-gas.bin",
    stars: "m11h-stars.bin",
    label: "FIRE-2 m11h, a dwarf galaxy about as massive as the Small Magellanic Cloud, today",
    title: "FIRE-2 cosmological zoom-in simulation m11h, snapshot 600 (z = 0), gas and stars",
    author: `${FIRE_CITE}; m11h from El-Badry et al. (2018). A subset of the particles in a 16 kpc box round the galaxy`, // prettier-ignore
  },
].map((d) => ({ ...d, source: GALAXY_SAMPLE.source, license: GALAXY_SAMPLE.license, licenseUrl: GALAXY_SAMPLE.licenseUrl })); // prettier-ignore

const GAL = { data: null, info: null, gas: new Map(), stars: new Map(), want: null, expose: { last: null, t0: 0 } }; // prettier-ignore
export const KERNEL_SIGMA = 0.274; // the cubic spline's σ over its support radius
// r2: how close the camera may come (the box's radii).
export const GALAXY_CLOSE = 0.05;
export const galaxyState = () => (GAL.info ? { ...GAL.info } : null);
// The gas's big see-through splats cost the most to draw (they overlap), so
// the galaxy keeps the kit's plain counts: 60k, 140k, 200k and 280k by tier.
export const GALAXY_DENSITY = 1;

// The file tools/sci-galaxy.mjs writes (its header says how).
export function readGalaxy(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + len)));
  if (head.format !== "splashery-sph-gas-1") throw new Error("This isn't a galaxy file.");
  const n = head.n;
  let o = 4 + len;
  const pos = new Int16Array(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + n * 6)); // prettier-ignore
  o += n * 6;
  const hq = new Uint16Array(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + n * 2)); // prettier-ignore
  o += n * 2;
  const tq = new Uint16Array(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + n * 2)); // prettier-ignore
  const q = head.half / 32767;
  return {
    head,
    n,
    pos: (i) => [pos[i * 3] * q, pos[i * 3 + 1] * q, pos[i * 3 + 2] * q],
    h: (i) => Math.pow(2, hq[i] / 4096 - 8),
    logT: (i) => (tq[i] / 65535) * 8 + 1,
  };
}

// The stars file tools/sci3-galaxy.mjs writes (its header says how).
export function readStars(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + len)));
  if (head.format !== "splashery-stars-1") throw new Error("This isn't a stars file.");
  const n = head.n;
  let o = 4 + len;
  const pos = new Int16Array(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + n * 6)); // prettier-ignore
  o += n * 6;
  const aq = new Uint16Array(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + n * 2)); // prettier-ignore
  o += n * 2;
  const mq = new Uint16Array(bytes.buffer.slice(bytes.byteOffset + o, bytes.byteOffset + o + n * 2)); // prettier-ignore
  const q = head.half / 32767;
  return {
    head,
    n,
    pos: (i) => [pos[i * 3] * q, pos[i * 3 + 1] * q, pos[i * 3 + 2] * q],
    ageGyr: (i) => Math.pow(10, 6 + (aq[i] / 65535) * 4.5) / 1e9,
    mass: (i) => Math.pow(10, 2 + (mq[i] / 65535) * 6),
  };
}

// ---- The telescope (r3) ----
//
// The galaxy as a telescope would record it, told plainly as a simulation:
// its stars (the simulation's star particles) seen as if it were 100 Mpc
// away (about 330 million light-years, where 1″ is 0.48 kpc), each blurred
// by the point spread of the seeing, through a filter, with the cold, dense
// gas absorbing as dust; each tap starts a new exposure whose light builds
// up with the grain of photon noise smoothing out.
//
// A star particle is thousands of stars of one age. How bright such a
// population is per unit mass falls as it ages, faster in blue light than
// red (young populations are blue, old ones red): here roughly as
// age^−1.0 in blue and age^−0.6 in red, scaled to be equal at 1 Gyr, an
// approximation of stellar population models (for example Bruzual and
// Charlot 2003), not a model fit.
export const TELESCOPE = {
  kpcPerArcsec: 0.485, // at 100 Mpc
  seeing: { space: 0.1, ground: 1, poor: 2.5 }, // arcseconds (FWHM)
  exposureSecs: 6, // how long a toy exposure takes to build up
};
export function starLight(ageGyr, mass) {
  const a = Math.max(0.003, ageGyr);
  const blue = mass * Math.pow(a, -1.0);
  const red = mass * Math.pow(a, -0.6);
  return { blue, red, green: Math.sqrt(blue * red) };
}

// Temperature colors: cold molecular gas deep blue, the warm disk pale,
// hot gas orange to red.
const TEMP_STOPS = [
  [1.0, "#1a2a8a"],
  [2.5, "#2a62d4"],
  [3.7, "#4ab0e0"],
  [4.2, "#b8d8f0"],
  [4.8, "#ffd27a"],
  [5.5, "#ff8a2a"],
  [6.3, "#e0362a"],
  [7.2, "#9a1a64"],
];
function tempColor(logT) {
  const S = TEMP_STOPS;
  if (logT <= S[0][0]) return S[0][1];
  for (let i = 0; i < S.length - 1; i++)
    if (logT <= S[i + 1][0]) return mix(S[i][1], S[i + 1][1], (logT - S[i][0]) / (S[i + 1][0] - S[i][0])); // prettier-ignore
  return S[S.length - 1][1];
}

const GALAXY = {
  alive: (c) => GAL.want?.telescope === true && (GAL.info?.exposure ?? 1) < 1,
  density: GALAXY_DENSITY,
  options: [
    {
      key: "galaxy",
      label: "Galaxy",
      type: "select",
      default: "m12i",
      choices: GALAXY_SAMPLES.map((d) => ({ id: d.id, label: d.choice })),
    },
    {
      key: "view",
      label: "View",
      type: "select",
      default: "gas",
      choices: [
        { id: "gas", label: "The gas (the simulation)" },
        { id: "telescope", label: "Through a telescope (simulated)" },
      ],
    },
    {
      key: "filter",
      label: "Telescope filter",
      type: "select",
      default: "color",
      choices: [
        { id: "color", label: "Color (blue, green and red)" },
        { id: "blue", label: "Blue light (young stars)" },
        { id: "red", label: "Red light (older stars)" },
      ],
    },
    {
      key: "seeing",
      label: "Telescope's sharpness",
      type: "select",
      default: "ground",
      choices: [
        { id: "space", label: "A space telescope (0.1″)" },
        { id: "ground", label: "A good night on the ground (1″)" },
        { id: "poor", label: "A hazy night (2.5″)" },
      ],
    },
    {
      key: "color",
      label: "Color by",
      type: "select",
      default: "temperature",
      choices: [
        { id: "temperature", label: "Temperature" },
        { id: "density", label: "Density" },
      ],
    },
    { key: "box", label: "The box", type: "switch", default: true },
  ],
  // r2: a pinch or the wheel zooms all the way in, to 0.05 of the box's
  // radius (about 60 times closer than the home view, a few hundred parsecs).
  closeUp: { minDistance: GALAXY_CLOSE },
  controls: [
    { key: "peel", label: "Only the cold gas", type: "toggle", default: 0, ease: 1.6 },
    { key: "expose", label: "A new exposure", type: "toggle", default: 0, ease: 0.01 },
  ],
  // A tap peels the hot gas away (the cold, dense gas of the disk and its
  // arms stays); a second tap brings it back. Through the telescope, a tap
  // starts a new exposure.
  action: {
    key: "peel",
    label: "Peel away the hot gas",
    at() {
      return GAL.want?.telescope ? { key: "expose" } : undefined;
    },
  },
  credits: GALAXY_SAMPLES.map((d) => ({
    label: d.choice,
    title: d.title,
    source: d.source,
    author: d.author,
    license: d.license,
    licenseUrl: d.licenseUrl,
  })),
  async prepare(o) {
    const def = GALAXY_SAMPLES.find((d) => d.id === o.galaxy) || GALAXY_SAMPLES[0];
    const telescope = o.view === "telescope";
    if (!GAL.gas.has(def.id)) GAL.gas.set(def.id, readGalaxy(await readAsset(`../../assets/toys/galaxy-box/${def.gas}`, true))); // prettier-ignore
    if (telescope && !GAL.stars.has(def.id)) GAL.stars.set(def.id, readStars(await readAsset(`../../assets/toys/galaxy-box/${def.stars}`, true))); // prettier-ignore
    GAL.data = GAL.gas.get(def.id);
    GAL.want = { def, telescope, stars: GAL.stars.get(def.id) ?? null };
    GAL.expose = { last: null, t0: null };
  },
  drive(t, c, out, info) {
    out.grow = 1 - smoothstep(0, 1, c.peel ?? 0);
    // Every particle at least about a pixel wide, wherever the camera is.
    out.morph = [0, 1, 0.0006, 0];
    out.glow = [0, 0, 0, 0];
    if (GAL.want?.telescope) {
      // Each flip of the exposure control (a tap) starts a new exposure; one
      // also starts when the view opens.
      const E = GAL.expose;
      const flip = (c.expose ?? 0) > 0.5;
      if (E.t0 === null || flip !== E.last) E.t0 = info.time;
      E.last = flip;
      const e = Math.max(0, Math.min(1, (info.time - E.t0) / TELESCOPE.exposureSecs));
      if (GAL.info) GAL.info.exposure = e;
      // (light grows as the exposure, at a rate that fills in over its time)
      out.glow = [e, 1, 0, 0];
    }
  },
  gpuField() {
    return sciModifier(1, 1, { free: true });
  },
  build(k, o) {
    if (GAL.want?.telescope) return buildTelescope(k, o);
    const G = GAL.data;
    if (!G) throw new Error("The galaxy hasn't loaded.");
    const half = G.head.half;
    const budget = Math.max(1000, Math.floor(k.count * 0.97));
    // The file holds the dense gas first (all of it, drawn at its own size),
    // then a random share of the diffuse gas (drawn wider by the file's
    // widenRest). A smaller budget keeps DENSE_SHARE of it for dense gas and
    // thins each group evenly, widening by the cube root of its thinning, so
    // the gas still closes (the same mass in fewer, bigger pieces).
    const nDense = Math.min(G.n, G.head.nDense ?? G.n);
    const nRest = G.n - nDense;
    let dKeep = nDense;
    let rKeep = nRest;
    if (G.n > budget) {
      rKeep = Math.min(nRest, Math.round(budget * 0.35));
      dKeep = Math.min(nDense, budget - rKeep);
      rKeep = Math.min(nRest, budget - dKeep);
    }
    const dPick = pickIndices(nDense, dKeep);
    const rPick = pickIndices(nRest, rKeep);
    const count = dKeep + rKeep;
    const at = (j) => (j < dKeep ? (dPick ? dPick[j] : j) : nDense + (rPick ? rPick[j - dKeep] : j - dKeep)); // prettier-ignore
    const widenD = dPick ? Math.cbrt(nDense / dKeep) : 1;
    const widenR = (G.head.widenRest ?? G.head.widen ?? 1) * (rPick ? Math.cbrt(nRest / rKeep) : 1);
    const widenOf = (i) => (i < nDense ? widenD : widenR);
    // The box: its floor (dark, so the gas shows against it from above) and
    // its twelve edges.
    const hy = G.head.halfY ?? half;
    const size = [half, hy, half];
    if (o.box !== false) {
      k.add(evenBox(2 * half, 0.08, 2 * half), {
        pos: [0, -hy - 0.06, 0],
        even: true,
        color: "#090a10",
        jitter: 0,
        opacity: 1,
        flat: 0.3,
        weight: 0.5,
        part: sciPart(SCI_TYPE.plain),
      });
    }
    // Its twelve edges: thin lines of splats stretched along each edge, so
    // they stay crisp.
    if (o.box !== false) {
      const SEG = 80;
      const edges = [];
      for (const axis of [0, 1, 2]) {
        const others = [0, 1, 2].filter((x) => x !== axis);
        for (const a of [-1, 1])
          for (const b of [-1, 1])
            for (let i = 0; i < SEG; i++) {
              const p = [0, 0, 0];
              p[others[0]] = a * size[others[0]];
              p[others[1]] = b * size[others[1]];
              p[axis] = -size[axis] + ((i + 0.5) / SEG) * 2 * size[axis];
              const dir = [0, 0, 0];
              dir[axis] = 1;
              edges.push({ p, dir, len: (2 * size[axis]) / SEG });
            }
      }
      k.cloud({ count: (edges.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
        const e = edges[j];
        if (!e) return null;
        const base = k.baseSize || 0.01;
        const across = 0.03 / 0.7; // about 0.03 kpc across
        return {
          p: e.p,
          dir: e.dir,
          size: across / base,
          stretch: (0.8 * e.len) / across,
          color: "#c4ccdc",
          opacity: 1,
          part: sciPart(SCI_TYPE.plain),
        };
      });
    }
    k.reach([half, hy, half]);
    k.reach([-half, -hy, -half]);
    // The gas is cut round (a disk inside the box), so the galaxy doesn't
    // end in a square.
    const R = half * 0.96;
    let emitted = 0;
    let first = -1;
    k.cloud({ count: (count * 160000) / k.count, jitter: 0 }, (_r, j) => {
      if (j >= count) return null;
      const i = at(j);
      const p = G.pos(i);
      if (p[0] * p[0] + p[2] * p[2] > R * R) return null;
      if (first < 0) first = i;
      emitted++;
      const w = widenOf(i);
      const h = G.h(i) * w;
      const logT = G.logT(i);
      // The Gaussian with the same spread as the simulation's kernel: FIRE's
      // cubic spline, whose smoothing length h is its support radius, has a
      // standard deviation of 0.274 h along each axis (it isn't a Gaussian;
      // this is the look, not the physics).
      const sigma = KERNEL_SIGMA * h;
      const base = k.baseSize || 0.01;
      // Denser gas (smaller h) is more opaque: the column through a
      // particle goes as its mass over h², and the masses are nearly equal.
      // Hot gas is thin and spread out; it is lifted a little so it shows.
      const hot = 1 + 3 * smoothstep(4.3, 5.5, logT);
      // A widened piece is as faint as its size says: the thinned diffuse
      // gas stays a faint haze, so the dense arms show through it.
      const alpha = Math.min(0.8, 0.8 * (0.07 / h) ** 2 * hot);
      // Denser gas is brighter, so the spiral arms stand out.
      const dense = Math.max(0, Math.min(1, (Math.log10(0.5 / h) + 0.1) / 1.4));
      const color =
        o.color === "density"
          ? tempColor(1 + 7 * dense)
          : shade(tempColor(logT), 0.6 + 0.95 * dense);
      return {
        p,
        size: (Math.SQRT2 * sigma) / base,
        color,
        opacity: alpha,
        part: sciPart(SCI_TYPE.gas),
        params: [asF32(logT), 0],
      };
    });
    GAL.info = {
      n: G.n,
      drawn: count,
      half,
      widen: widenD,
      widenRest: widenR,
      nDense,
      simulation: G.head.simulation,
      get emitted() {
        return emitted;
      },
      get first() {
        return first;
      },
    };
    k.data = { galaxy: GAL.info };
  },
};

// The telescope view's build: the stars through the filter, blurred by the
// seeing, and the cold, dense gas in front of them as dust.
function buildTelescope(k, o) {
  const S = GAL.want.stars;
  const G = GAL.data;
  if (!S || !G) throw new Error("The galaxy's stars haven't loaded.");
  const base = () => k.baseSize || 0.01;
  const psfFwhm = (TELESCOPE.seeing[o.seeing] ?? 1) * TELESCOPE.kpcPerArcsec; // kpc
  const psf = psfFwhm / 2.3548; // σ
  const filter = o.filter ?? "color";
  const budget = Math.max(2000, Math.floor(k.count * 0.75));
  const pick = pickIndices(S.n, budget);
  const nStars = pick ? pick.length : S.n;
  const at = (j) => (pick ? pick[j] : j);
  // Each star's light in the filter (blue, green, red), and its brightness.
  const light = new Float32Array(nStars * 3);
  const bright = new Float32Array(nStars);
  for (let j = 0; j < nStars; j++) {
    const i = at(j);
    const L = starLight(S.ageGyr(i), S.mass(i));
    const rgb = filter === "blue" ? [L.blue, L.blue, L.blue] : filter === "red" ? [L.red, L.red, L.red] : [L.red, L.green, L.blue]; // prettier-ignore
    light.set(rgb, j * 3);
    bright[j] = (rgb[0] + rgb[1] + rgb[2]) / 3;
  }
  // An astronomer's stretch (asinh) of the brightness, about its median.
  const sorted = Array.from(bright).sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1] || 1;
  const top = sorted[Math.floor(sorted.length * 0.995)] || 1;
  const soft = 0.25 * med; // the stretch's knee: below it light is linear
  const stretch = (b) => Math.asinh(b / soft) / Math.asinh(top / soft);
  // The whole exposure's photons for the median star: the grain's scale.
  const photons = 60;
  let shown = 0;
  k.cloud({ count: (nStars * 160000) / k.count, jitter: 0 }, (_r, j) => {
    if (j >= nStars) return null;
    const i = at(j);
    const p = S.pos(i);
    const sb = Math.max(0, Math.min(1, stretch(bright[j])));
    if (sb <= 0.002) return null;
    shown++;
    const r = light[j * 3];
    const g = light[j * 3 + 1];
    const b = light[j * 3 + 2];
    const mx = Math.max(r, g, b) || 1;
    // The star's color (its filters' ratio), brightened by the stretch.
    const col = [r / mx, g / mx, b / mx].map((v) => Math.min(1, v * (0.75 + 0.25 * sb)));
    // Its size: the point spread (and a little for the particle itself).
    const size = Math.SQRT2 * Math.hypot(psf, 0.01);
    return {
      p,
      size: size / base(),
      color: col,
      opacity: Math.min(0.9, 0.02 + 0.5 * sb * sb),
      part: sciPart(SCI_TYPE.star),
      params: [asF32((bright[j] / med) * photons), (i * 2654435761) % 1000003],
    };
  });
  // Dust: the cold, dense gas (below 20,000 K, smoothing length under 0.3
  // kpc) dims what is behind it, more in blue light than red.
  const absorb = filter === "red" ? 0.45 : filter === "blue" ? 1 : 0.75;
  const dRoom = Math.max(1000, Math.floor(k.count * 0.22));
  const dust = [];
  for (let i = 0; i < G.n && dust.length < dRoom * 3; i++)
    if (G.logT(i) < 4.3 && G.h(i) < 0.3) dust.push(i);
  const dPick = pickIndices(dust.length, dRoom);
  const nDust = dPick ? dPick.length : dust.length;
  const widen = dPick ? Math.cbrt(dust.length / nDust) : 1;
  k.cloud({ count: (nDust * 160000) / k.count, jitter: 0 }, (_r, j) => {
    if (j >= nDust) return null;
    const i = dust[dPick ? dPick[j] : j];
    const h = G.h(i) * widen;
    return {
      p: G.pos(i),
      size: (Math.SQRT2 * Math.hypot(KERNEL_SIGMA * h, psf)) / base(),
      color: "#120a06",
      opacity: Math.min(0.15, absorb * 0.04 * (0.06 / h) ** 2),
      part: sciPart(SCI_TYPE.plain),
    };
  });
  const half = G.head.half;
  // The night sky behind it: a dark plate under the galaxy, a little wider
  // than the box (the view looks down on the disk).
  k.add(evenBox(2.3 * half, 0.04, 2.3 * half), {
    pos: [0, -(G.head.halfY ?? half) - 0.5, 0],
    even: true,
    color: "#020205",
    jitter: 0,
    opacity: 1,
    flat: 0.3,
    weight: 0.4,
    part: sciPart(SCI_TYPE.plain),
  });
  k.reach([half, G.head.halfY ?? half, half]);
  k.reach([-half, -(G.head.halfY ?? half), -half]);
  GAL.info = {
    telescope: true,
    galaxy: GAL.want.def.id,
    stars: S.n,
    drawn: nStars,
    get shown() {
      return shown;
    },
    dust: nDust,
    psfKpc: psfFwhm,
    filter,
    photons,
    exposure: 0,
    simulation: S.head.simulation,
  };
  k.data = { galaxy: GAL.info };
}

// ---- Cryo-EM map (lane Science r3) ------------------------------------------------------

const EMDB_LICENSE = {
  license: "Public domain (EMDB: free of all copyright restrictions)",
  licenseUrl: "https://www.ebi.ac.uk/emdb/faq",
};
export const CRYOEM_SAMPLES = [
  {
    id: "apoferritin",
    choice: "Apoferritin (2.6 Å)",
    label: "Apoferritin, the cell's iron store: 24 copies of one protein in a hollow ball",
    title: "Mouse heavy-chain apoferritin by cryo-EM at 100 keV, 2.6 Å (EMD-17961), with its fitted model (PDB 8PVC)", // prettier-ignore
    author: "G. McMullan, K. Naydenova, D. Mihaylov et al. (PNAS 120, e2312905120, 2023), via EMDB and the PDB", // prettier-ignore
    source: "https://www.ebi.ac.uk/emdb/EMD-17961",
    model: "https://www.rcsb.org/structure/8PVC",
  },
  {
    id: "ribosome",
    choice: "A ribosome (3.2 Å)",
    label: "A bacterial ribosome (E. coli 70S) with the antibiotic arbekacin bound",
    title: "Arbekacin-bound E. coli 70S ribosome, 3.2 Å (EMD-48329), with its fitted model (PDB 9MKK)", // prettier-ignore
    author: "S. Majumdar, N. P. Parajuli, X. Ge, A. Emmerich and S. Sanyal (Scientific Reports 15, 18271, 2025), via EMDB and the PDB", // prettier-ignore
    source: "https://www.ebi.ac.uk/emdb/EMD-48329",
    model: "https://www.rcsb.org/structure/9MKK",
  },
  {
    id: "aav",
    choice: "A virus capsid (3.0 Å)",
    label: "The empty shell of adeno-associated virus 2 (AAV2), a gene-therapy carrier: 60 copies of one protein", // prettier-ignore
    title: "AAV2 virus-like particle, 3.02 Å (EMD-20610), with its fitted model (PDB 6U0V)",
    author: "M. Agbandje-McKenna and A. Bennett (deposited 2019), via EMDB and the PDB",
    source: "https://www.ebi.ac.uk/emdb/EMD-20610",
    model: "https://www.rcsb.org/structure/6U0V",
    // 60 copies of one protein: colored by radius, as capsids usually are.
    color: "radius",
  },
].map((d) => ({ ...d, ...EMDB_LICENSE }));

const EM = { maps: new Map(), models: new Map(), want: null, info: null };
export const cryoemState = () => (EM.info ? { ...EM.info } : null);
// The level's choices, as multiples of EMDB's recommended contour.
export const CRYOEM_LEVELS = { lower: 0.75, recommended: 1, higher: 1.5 };
export const CRYOEM_DENSITY = 1;

// Chain colors: proteins in cool hues, RNA and DNA in warm ones, each chain
// its own (a golden-angle walk round the hue circle).
function chainColor(i, kind) {
  const h = kind === "nucleic" ? 0.02 + ((i * 0.618034) % 1) * 0.13 : 0.45 + ((i * 0.618034) % 1) * 0.45; // prettier-ignore
  const s = kind === "nucleic" ? 0.75 : 0.5;
  const l = kind === "nucleic" ? 0.6 : 0.62;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const hex = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
// Distance from the center: the classic radial coloring of capsids.
const RADIAL = ["#3a4fd0", "#38a6d8", "#5fd08a", "#e8d84a", "#ef7a35", "#d8344a"];
function radialColor(t) {
  const x = Math.max(0, Math.min(1, t)) * (RADIAL.length - 1);
  const i = Math.min(RADIAL.length - 2, Math.floor(x));
  return mix(RADIAL[i], RADIAL[i + 1], x - i);
}

const CRYOEM = {
  alive: false,
  density: CRYOEM_DENSITY,
  options: [
    {
      key: "map",
      label: "Map",
      type: "select",
      default: "apoferritin",
      choices: CRYOEM_SAMPLES.map((d) => ({ id: d.id, label: d.choice })),
    },
    {
      key: "level",
      label: "Level",
      type: "select",
      default: "recommended",
      choices: [
        { id: "lower", label: "Lower (more of the density)" },
        { id: "recommended", label: "EMDB's recommended" },
        { id: "higher", label: "Higher (only the strongest)" },
      ],
    },
    {
      key: "color",
      label: "Color by",
      type: "select",
      default: "auto",
      choices: [
        { id: "auto", label: "What suits it" },
        { id: "chain", label: "Chain (from the fitted model)" },
        { id: "radius", label: "Distance from the center" },
        { id: "plain", label: "One color" },
      ],
    },
    { key: "model", label: "Fitted atomic model", type: "switch", default: false },
  ],
  controls: [{ key: "cut", label: "Cut it open", type: "toggle", default: 0, ease: 0.9 }],
  // A tap cuts the front half away, as a molecular viewer's clipping plane
  // does, to show the inside (apoferritin's and the capsid's hollow middle);
  // a second tap closes it.
  action: { key: "cut", label: "Cut it open" },
  credits: CRYOEM_SAMPLES.map((d) => ({
    label: d.choice,
    title: d.title,
    source: d.source,
    author: d.author,
    license: d.license,
    licenseUrl: d.licenseUrl,
  })),
  async prepare(o) {
    const def = CRYOEM_SAMPLES.find((d) => d.id === o.map) || CRYOEM_SAMPLES[0];
    if (!EM.maps.has(def.id)) {
      const [vol, model] = await Promise.all([
        readAsset(`../../assets/toys/cryoem-map/${def.id}.vol.gz`, true),
        readAsset(`../../assets/toys/cryoem-map/${def.id}-model.bin`, true),
      ]);
      EM.maps.set(def.id, await readDensity(vol));
      EM.models.set(def.id, await readBackbone(model));
    }
    EM.want = { def, D: EM.maps.get(def.id), model: EM.models.get(def.id) };
  },
  drive(t, c, out) {
    // The cut: a clipping plane through the middle, facing the camera,
    // sweeping in from in front (toy units in front of the middle).
    const u = smoothstep(0, 1, c.cut ?? 0);
    out.morph = [0, 1, 0, u > 0.001 ? 1.4 - 1.38 * u : 0];
    out.glow = [0, 0, 0, 0];
  },
  gpuField() {
    return sciModifier(1, 1);
  },
  build(k, o) {
    const W = EM.want;
    if (!W) throw new Error("The map hasn't loaded.");
    const { D, model, def } = W;
    const level = D.head.level * (CRYOEM_LEVELS[o.level] ?? 1);
    const colorBy = o.color === "auto" || !o.color ? (def.color ?? "chain") : o.color;
    const S = isoPoints(D, level);
    if (!S.count) throw new Error("Nothing of the map is above this level.");
    // The middle: the center of the surface.
    const P = S.p;
    const c = [0, 0, 0];
    for (let i = 0; i < S.count; i++) for (let a = 0; a < 3; a++) c[a] += P[3 * i + a] / S.count;
    const radiusOf = (i) => Math.hypot(P[3 * i] - c[0], P[3 * i + 1] - c[1], P[3 * i + 2] - c[2]);
    // The radial colors run between the 2nd and 99.5th percentiles of the
    // radius (a stray speck far out doesn't squeeze them).
    const radii = [];
    for (let i = 0; i < S.count; i += Math.max(1, Math.floor(S.count / 20000)))
      radii.push(radiusOf(i));
    radii.sort((a, b) => a - b);
    const r0 = radii[Math.floor(radii.length * 0.02)];
    const rMax = radii[Math.floor(radii.length * 0.995)];
    // Each surface point's chain: the nearest backbone atom's (within 8 Å).
    const atoms = [];
    model.forEach((ch, ci) => ch.p.forEach((p) => atoms.push([p, ci])));
    const cell = 8;
    const grid = new Map();
    for (const a of atoms) {
      const key = a[0].map((v) => Math.floor(v / cell)).join(",");
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(a);
    }
    // (cached per 2 Å cell: neighbors on the surface share their chain)
    const cache = new Map();
    const nearestChain = (p) => {
      const key =
        Math.floor(p[0] / 2) + 4096 * (Math.floor(p[1] / 2) + 4096 * Math.floor(p[2] / 2));
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const ci = nearestChainAt(p);
      cache.set(key, ci);
      return ci;
    };
    const nearestChainAt = (p) => {
      const g = p.map((v) => Math.floor(v / cell));
      let best = -1;
      let bd = cell * cell;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const [q, ci] of grid.get(`${g[0] + dx},${g[1] + dy},${g[2] + dz}`) ?? []) {
              const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
              if (d < bd) [best, bd] = [ci, d];
            }
      return best;
    };
    const showModel = o.model === true;
    // With the model, the map is a sparse, pale dotted surface (7% of its
    // points, small), so the colored backbone inside shows through.
    const alpha = showModel ? 0.3 : 1;
    // The budget: when the surface has more points than this device draws,
    // an even share of them, each a little bigger to close the surface.
    const budget = Math.max(2000, Math.floor(k.count * (showModel ? 0.8 : 0.98)));
    const keep = Math.min(showModel ? 0.07 : 1, budget / S.count);
    const vox = D.voxel[0];
    const size = showModel ? vox * 0.6 : vox * 1.05 * Math.sqrt(1 / keep);
    const pick = [];
    for (let i = 0; i < S.count; i++) if ((i * 0.618034) % 1 < keep) pick.push(i);
    const base = () => k.baseSize || 0.01;
    k.cloud({ count: (pick.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
      const i = pick[j];
      if (i === undefined) return null;
      const p = [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
      const n = [S.n[3 * i], S.n[3 * i + 1], S.n[3 * i + 2]];
      let col = "#c9ccd6";
      if (showModel) col = "#d8dbe2";
      else if (colorBy === "radius") col = radialColor((radiusOf(i) - r0) / (rMax - r0));
      else if (colorBy !== "plain") {
        const ci = nearestChain(p);
        col = ci >= 0 ? chainColor(ci, model[ci].kind) : "#9aa0ad";
      }
      return {
        p: [p[0] - c[0], p[1] - c[1], p[2] - c[2]],
        n,
        flat: 0.25,
        size: size / base(),
        color: lit(col, n, 0.25),
        opacity: alpha,
        part: sciPart(SCI_TYPE.plain),
      };
    });
    // The fitted model's backbone: a bead at each Cα (or P) and between
    // neighbors along the chain, in its chain's color.
    let beads = 0;
    if (showModel) {
      const pts = [];
      model.forEach((ch, ci) => {
        const col = chainColor(ci, ch.kind);
        const gap = ch.kind === "nucleic" ? 8 : 4.5;
        const steps = ch.kind === "nucleic" ? 7 : 4;
        ch.p.forEach((p, i) => {
          pts.push([p, col]);
          const q = ch.p[i + 1];
          if (!q) return;
          const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
          if (d > gap) return;
          for (let s2 = 1; s2 < steps; s2++) {
            const t = s2 / steps;
            pts.push([p.map((v, k2) => v + (q[k2] - v) * t), col]);
          }
        });
      });
      const room = Math.max(1000, Math.floor(k.count * 0.18));
      const every = Math.max(1, Math.ceil(pts.length / room));
      const bead = 1.0 * Math.sqrt(every); // Å across
      const shown = pts.filter((_, i) => i % every === 0);
      beads = shown.length;
      k.cloud({ count: (shown.length * 160000) / k.count, jitter: 0 }, (_r, j) => {
        const e = shown[j];
        if (!e) return null;
        return {
          p: [e[0][0] - c[0], e[0][1] - c[1], e[0][2] - c[2]],
          size: bead / base(),
          color: e[1],
          opacity: 1,
          part: sciPart(SCI_TYPE.plain),
        };
      });
    }
    EM.info = {
      id: def.id,
      name: def.label,
      emdb: D.head.emdb,
      pdb: D.head.pdb,
      level,
      recommended: D.head.level,
      levelSource: D.head.levelSource,
      resolution: D.head.resolution,
      voxel: vox,
      surface: S.count,
      drawn: pick.length,
      beads,
      chains: model.length,
      radius: rMax,
      center: c,
    };
    k.data = { cryoem: EM.info };
  },
  input: {
    title: "About this map",
    fileButton: false,
    shown() {
      const i = EM.info;
      if (!i) return "";
      return `${i.emdb} at ${i.resolution} Å, resampled to ${i.voxel.toFixed(2)} Å voxels. Level ${+i.level.toPrecision(3)} (EMDB's recommended: ${i.recommended}, set by the ${String(i.levelSource || "depositors").toLowerCase() === "author" ? "authors" : "depositors"}). ${fmt(i.surface)} surface points, ${fmt(i.drawn)} drawn; ${fmt(i.chains)} chains in the fitted model (${i.pdb}).`; // prettier-ignore
    },
  },
};

export const RECIPES = {
  "thermal-ellipsoids": THERMAL,
  "smlm-microscope": MICROSCOPE,
  "galaxy-box": GALAXY,
  "cryoem-map": CRYOEM,
  "terrain-box": TERRAIN,
  "contour-lab": CONTOUR,
};
