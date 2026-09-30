// Pack: science (lane Science, September 30, 2026). Real science data that
// already are Gaussians, shown exactly as splats, behind the labs switch:
//
//   thermal-ellipsoids  each atom of a crystal structure is the Gaussian of
//                       its measured displacement tensor U (src/science/crystal.js)
//
// The toys bring their own GPU program (src/science/field.js, labs only): the
// jiggle, the magnifier and the Gaussians' exact shapes.

import { quatFromTo, mix, shade, smoothstep, vec } from "../kit.js";
import { evenEllipsoid, evenCylinder } from "./even.js";
import { element } from "../chem/elements.js";
import { perceiveBonds } from "../chem/molfile.js";
import { readCrystal, probabilityScale, centerOf, eigenSym3 } from "../science/crystal.js";
import { SCI_KIND, packAtom, quatFromAxes, sciModifier, unmagnify } from "../science/field.js";

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

export const ELLIPSOID_SAMPLES = [
  {
    id: "aspirin",
    label: "Aspirin, 300 K (small molecule)",
    file: "aspirin-cod-2104857.cif",
    title: "Aspirin form I at 300 K (COD 2104857)",
    author:
      "E. J. Chan, T. R. Welberry, A. P. Heerdegen and D. J. Goossens (Acta Crystallographica B 66, 696–707, 2010), via the Crystallography Open Database",
    source: "https://www.crystallography.net/cod/2104857.html",
    license: "Public domain (Crystallography Open Database)",
    licenseUrl: "https://www.crystallography.net/cod/",
  },
  {
    id: "crambin",
    label: "Crambin, 0.54 Å (protein)",
    file: "crambin-1ejg.pdb",
    title: "Crambin at ultra-high resolution (PDB 1EJG)",
    author:
      "C. Jelsch, M. M. Teeter, V. Lamzin, V. Pichon-Pesme, R. H. Blessing and C. Lecomte (PNAS 97, 3171–3176, 2000), via the Protein Data Bank",
    source: "https://www.rcsb.org/structure/1EJG",
    license: "CC0 1.0 (wwPDB data policy)",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
];

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

const THERMAL = {
  alive: (c) => (c.jiggle ?? 0) > 0,
  options: [
    {
      key: "structure",
      label: "Structure",
      type: "select",
      default: "aspirin",
      choices: [
        ...ELLIPSOID_SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your file (open one below)" },
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
      ELL.want = { name: ELL.custom.name, structure: ELL.custom.structure, custom: true };
      return;
    }
    const def = ELLIPSOID_SAMPLES.find((s) => s.id === o.structure) || ELLIPSOID_SAMPLES[0];
    if (!ELL.cache.has(def.id)) {
      const text = await readAsset(`../../assets/toys/thermal-ellipsoids/${def.file}`);
      ELL.cache.set(def.id, readCrystal(text, def.file));
    }
    ELL.want = { name: def.title, structure: ELL.cache.get(def.id), custom: false };
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
      const [px, pz, pw] = packAtom(quat, a.sigma, sigMax, i);
      const col = atomColor(a.el);
      if (gauss) return;
      const r = (a.draw ?? a.sigma).map((x) => x * P);
      // ORTEP's principal ellipses: a dark line round each principal plane
      // of an anisotropic atom (spheres, the isotropic atoms, have none).
      const band = a.aniso ? 0.075 : 0;
      k.add(unit, {
        pos: pos[i],
        quat,
        scale: r,
        even: true,
        flat: 0.2,
        jitter: 0.008,
        opacity: 1,
        part: px,
        kind: SCI_KIND.atom,
        params: [pz, pw],
        color: (cc) => {
          const lp = cc.lp;
          const line = band && Math.min(Math.abs(lp[0]), Math.abs(lp[1]), Math.abs(lp[2])) < band;
          return { c: lit(line ? shade(col, a.el === "H" ? 0.5 : 0.35) : col, cc.n), keep: true };
        },
      });
    });
    if (gauss) {
      const root2 = Math.SQRT2;
      k.cloud({ count: (atoms.length * 160000) / k.count, jitter: 0 }, (_r, i) => {
        const a = atoms[i];
        if (!a) return null;
        const quat = quatFromAxes(a.axes);
        const [px, pz, pw] = packAtom(quat, a.draw ?? a.sigma, sigMax, i);
        const base = k.baseSize || 0.01;
        return {
          p: pos[i],
          n: a.axes[2],
          flat: a.sigma[2] / a.sigma[0],
          size: (root2 * a.sigma[0]) / base,
          color: atomColor(a.el),
          opacity: 1,
          part: px,
          kind: SCI_KIND.gauss,
          params: [pz, pw],
        };
      });
    }
    let bonds = [];
    if (o.bonds !== false) {
      bonds = perceiveBonds(atoms.map((a, i) => ({ el: a.el, p: pos[i] })));
      const stick = evenCylinder(STICK, STICK, 1, false);
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
          kind: SCI_KIND.bond,
          color: (cc) => ({ c: lit(shade(cc.lp[1] < 0 ? ci : cj, 0.85), cc.n, 0.2), keep: true }),
        });
      }
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

export const RECIPES = {
  "thermal-ellipsoids": THERMAL,
};
