// Pack: molecule-viewer (lane Molecule viewer, October 5, 2026; labs). A
// molecule viewer made of splats: open a PDB, mmCIF, SDF/MOL or XYZ file from
// this device, or fetch an entry from the Protein Data Bank by its code, and
// see it as balls and sticks, space-filling atoms, a cartoon of its chains or
// its molecular surface, colored by element, chain, residue, B-factor, along
// each chain or by secondary structure. Tap two atoms to measure the distance
// between them, a third for the angle.
//
//   src/molview/parse.js   the readers (one flat model for every format)
//   src/molview/worker.js  reading off the main thread
//   src/molview/load.js    the worker's client and the RCSB fetch
//   src/molview/geom.js    turning, measuring, picking and the surface
//   src/molview/draw.js    the splats (with a budget: the level of detail)

import { quatAxisAngle, smoothstep } from "../kit.js";
import { readModel, fetchEntry, pdbCode, RCSB, MAX_FETCH_BYTES } from "../molview/load.js";
import { KIND, MAX_ATOMS } from "../molview/parse.js";
import { distance, angle, nearestAtom, atomLabel, pos, outerAtoms } from "../molview/geom.js";
import { vdwRadius, hasVdw, cpk } from "../molview/radii.js";
import {
  SplatList,
  drawAtoms,
  drawBonds,
  drawCartoon,
  drawSurface,
  markerSplats,
  beadSplats,
  colorer,
  openness,
  occluded,
  CHAIN_COLORS,
  residueColor,
} from "../molview/draw.js";

// ---- The samples (a dated snapshot, for use offline) -------------------------------------------

const CC0 = {
  license: "CC0 1.0 (wwPDB data)",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
};
export const SNAPSHOT_DATE = "October 5, 2026";
export const SAMPLES = [
  {
    id: "1crn",
    label: "Crambin (1CRN), a small plant protein",
    file: "1crn.cif",
    source: "https://www.rcsb.org/structure/1CRN",
    author:
      "W. A. Hendrickson and M. M. Teeter (the structure); M. M. Teeter, PNAS 81, 6014 (1984)",
  },
  {
    id: "1ema",
    label: "Green fluorescent protein (1EMA)",
    file: "1ema.cif",
    source: "https://www.rcsb.org/structure/1EMA",
    author:
      "M. Ormö and S. J. Remington (the structure); M. Ormö, A. B. Cubitt, K. Kallio, L. A. Gross, R. Y. Tsien and S. J. Remington, Science 273, 1392 (1996)",
  },
  {
    id: "1lyz",
    label: "Hen egg-white lysozyme (1LYZ)",
    file: "1lyz.cif",
    source: "https://www.rcsb.org/structure/1LYZ",
    author:
      "R. Diamond, D. C. Phillips, C. C. F. Blake and A. C. T. North (the structure); R. Diamond, J. Mol. Biol. 82, 371 (1974)",
  },
  {
    id: "1bna",
    label: "B-DNA, twelve base pairs (1BNA)",
    file: "1bna.cif",
    source: "https://www.rcsb.org/structure/1BNA",
    author:
      "H. R. Drew, R. M. Wing, T. Takano, C. Broka, S. Tanaka, K. Itakura and R. E. Dickerson (PNAS 78, 2179, 1981)",
  },
  {
    id: "caffeine",
    label: "Caffeine (PDB chemical component CFF)",
    file: "caffeine-cff-ideal.sdf",
    title: "Caffeine",
    source: "https://www.rcsb.org/ligand/CFF",
    author: "the wwPDB Chemical Component Dictionary (ideal coordinates)",
  },
];
// Codes to try (checked against RCSB on October 5, 2026).
export const EXAMPLES = [
  ["1MBN", "sperm whale myoglobin"],
  ["2DHB", "horse hemoglobin"],
  ["1STP", "streptavidin holding biotin"],
  ["1BL8", "a bacterial potassium channel"],
  ["1EHZ", "yeast transfer RNA"],
  ["1AON", "the GroEL–GroES chaperonin, about 59,000 atoms"],
];

// ---- State ---------------------------------------------------------------------------------------

const MV = {
  cache: new Map(), // sample id -> model
  file: null, // { name, model }
  fetched: null, // { code, model, url, at }
  want: null, // { model, kind: "sample" | "file" | "fetched", sample?, note? }
  shown: null, // what the last build drew (for the panel, the taps and the tests)
  picks: [], // atom indexes picked for measuring (up to three)
  lastTap: 0,
};
export const viewerState = () => MV;

const fmt = (v) => Math.round(v).toLocaleString("en");
const clean = (s, n = 80) =>
  String(s ?? "")
    .replace(/[^\x20-\x7eÀ-ɏ–—Å]/g, "")
    .slice(0, n);

async function readAsset(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return fs.readFile(url, "utf8");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return r.text();
}

// ---- Measuring -------------------------------------------------------------------------------------

// The measurement the picks make, in words: a distance in ångströms for two
// atoms, the angle at the middle atom in degrees for three.
export function measureText(m, picks = MV.picks) {
  if (!m || !picks.length) return "";
  const [a, b, c] = picks;
  if (picks.length === 1) return `${atomLabel(m, a)}. Tap a second atom for the distance.`;
  // Atoms of one residue are named once: "NE–CZ in Arg 10 (chain A)".
  const small = m.format === "sdf" || m.format === "xyz";
  const one = !small && picks.every((i) => m.res[i] === m.res[a]);
  // Otherwise "CA (Thr 2)", with the chain only when the atoms' chains differ.
  const chains = new Set(picks.map((i) => m.residues[m.res[i]].chain)).size > 1;
  const name = (i) => {
    if (small || one) return atomLabel(m, i).replace(/ of .*$/, "");
    const r = m.residues[m.res[i]];
    const res = `${r.name.length === 3 ? r.name[0] + r.name.slice(1).toLowerCase() : r.name} ${r.seq}${r.icode}`;
    return `${m.atomName[i]} (${res}${chains && m.chains[r.chain]?.id ? `, chain ${m.chains[r.chain].id}` : ""})`;
  };
  const where = one ? ` in ${atomLabel(m, a).replace(/^\S+ of /, "")}` : "";
  const ab = distance(m, a, b).toFixed(2);
  if (picks.length === 2)
    return `Distance ${name(a)} to ${name(b)}${where}: ${ab} Å. Tap a third atom for the angle.`;
  return `Angle ${name(a)}–${name(b)}–${name(c)}${where}: ${angle(m, a, b, c).toFixed(1)}° (arms ${ab} Å and ${distance(m, b, c).toFixed(2)} Å).`; // prettier-ignore
}

// Adds an atom to the picks: a fourth starts over, the last one again takes
// it back.
export function pickAtom(atom) {
  const P = MV.picks;
  if (P.length && P[P.length - 1] === atom) P.pop();
  else if (P.length >= 3 || P.includes(atom)) MV.picks = [atom];
  else P.push(atom);
  MV.pickTime = (MV.pickTime ?? 0) + 1;
}

// The Play button (a tap with no place): measures the distance across a
// bond angle near the middle, then the angle, then clears.
function demoStep() {
  const S = MV.shown;
  if (!S) return;
  const m = S.model;
  if (MV.picks.length >= 3 || !S.demo) {
    MV.picks = [];
    return;
  }
  // First the distance across the angle (its line is in the open), then the angle.
  MV.picks = MV.picks.length >= 2 ? S.demo.slice(0, 3) : [S.demo[0], S.demo[2]];
}

// A bonded triple of shown heavy atoms near the middle: [a, b, c] with a–b
// and b–c bonds.
function demoTriple(m, shown, bonds) {
  // Near the middle of the side that faces the viewer (+z), so its marks show.
  let front = -Infinity;
  for (let i = 0; i < m.n; i++) if (shown[i] && m.z[i] > front) front = m.z[i];
  const nb = new Map();
  for (const [i, j] of bonds) {
    if (!shown[i] || !shown[j] || m.el[i] === "H" || m.el[j] === "H") continue;
    if (!nb.has(i)) nb.set(i, []);
    if (!nb.has(j)) nb.set(j, []);
    nb.get(i).push(j);
    nb.get(j).push(i);
  }
  let best = null;
  let bd = Infinity;
  for (const [b, list] of nb) {
    if (list.length < 2) continue;
    const d = m.x[b] ** 2 + m.y[b] ** 2 + (m.z[b] - front) ** 2;
    if (d < bd) {
      bd = d;
      best = [list[0], b, list[1]];
    }
  }
  if (best) return best;
  // A cartoon shows no bonds: three CA (or P) atoms in a row instead.
  const list = [];
  for (let i = 0; i < m.n; i++) if (shown[i]) list.push(i);
  for (let k = 0; k + 2 < list.length; k++) {
    const [a, b, c] = [list[k], list[k + 1], list[k + 2]];
    if (distance(m, a, b) > 7.5 || distance(m, b, c) > 7.5) continue;
    const d = m.x[b] ** 2 + m.y[b] ** 2 + (m.z[b] - front) ** 2;
    if (d < bd) {
      bd = d;
      best = [a, b, c];
    }
  }
  return best;
}

// ---- Options --------------------------------------------------------------------------------------

const STYLES = [
  { id: "auto", label: "Best for this structure" },
  { id: "cartoon", label: "Cartoon (chains as ribbons)" },
  { id: "ballstick", label: "Balls and sticks" },
  { id: "spacefill", label: "Space-filling atoms" },
  { id: "surface", label: "Molecular surface" },
];
const COLORS = [
  { id: "element", label: "Element (CPK)" },
  { id: "chain", label: "Chain" },
  { id: "residue", label: "Residue type" },
  { id: "bfactor", label: "B-factor (how much atoms move)" },
  { id: "rainbow", label: "Along each chain" },
  { id: "structure", label: "Helix, strand, coil" },
];

const isMacro = (m) => m.residues.some((r) => r.kind === KIND.amino || r.kind === KIND.nucleic);
const styleFor = (o, m) => (o.style === "auto" || !o.style ? (isMacro(m) ? "cartoon" : "ballstick") : o.style); // prettier-ignore

// ---- Splat budget --------------------------------------------------------------------------------------

// The toy draws twice the kit's count, within each tier's cap (120k, 240k,
// 300k and 400k splats: the polish round, for sharper atoms and ribbons). Big
// structures spread these thinner, down to one Gaussian per atom.
export const VIEWER_DENSITY = 2;
const BALL = 0.25; // ball-and-stick: a ball is this share of the van der Waals radius
const STICK = 0.13; // ball-and-stick: the stick's radius, Å
const SS_COLORS = { H: [0.9, 0.3, 0.38], E: [0.95, 0.78, 0.22], C: [0.82, 0.83, 0.8] };

function rainbow(t) {
  const stops = [
    [0.23, 0.3, 0.75],
    [0.31, 0.64, 0.88],
    [0.42, 0.78, 0.42],
    [0.95, 0.82, 0.29],
    [0.94, 0.52, 0.24],
    [0.84, 0.2, 0.29],
  ];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return [0, 1, 2].map((k) => stops[i][k] + (stops[i + 1][k] - stops[i][k]) * (x - i));
}

// ---- The recipe ------------------------------------------------------------------------------------------

const MARKERS = 3;
const BEADS = 14; // per measuring line
const ARC = 12; // beads in the angle's arc
const TOKENS = MARKERS + 2 * BEADS + ARC; // 43 of the kit's 48
const PICK_COLORS = [
  [1, 0.84, 0.25],
  [0.35, 0.9, 1],
  [1, 0.45, 0.85],
];

const VIEWER = {
  density: VIEWER_DENSITY,
  turntable: false, // it holds still for measuring (drag to turn it)
  kernel: "sharp", // crisper edges on the bigger splats (labs; src/kernels.js)
  options: [
    {
      key: "structure",
      label: "Structure",
      type: "select",
      default: "1crn",
      choices: [
        ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "fetched", label: "Fetched by its code (below)" },
        { id: "file", label: "Your file (open one below)" },
      ],
    },
    { key: "style", label: "Draw as", type: "select", default: "auto", choices: STYLES },
    { key: "color", label: "Color by", type: "select", default: "element", choices: COLORS },
    { key: "hydrogens", label: "Hydrogens", type: "switch", default: true },
    { key: "water", label: "Water", type: "switch", default: false },
    { key: "code", label: "PDB code", type: "text", default: "", hidden: true },
    { key: "fileName", label: "File name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "pick", label: "Measure", type: "pulse", ease: 1.1 }],
  action: {
    key: "pick",
    label: "Measure an example",
    // A tap on an atom picks it (two give a distance, three an angle); a tap
    // far from every atom clears the picks.
    at(point) {
      const S = MV.shown;
      if (!S) return undefined;
      const hit = nearestAtom(S.model, point, S.pickable);
      if (!hit || hit.d > S.reach) {
        const had = MV.picks.length;
        MV.picks = [];
        return had ? { key: "pick", say: "Measurement cleared." } : undefined;
      }
      pickAtom(hit.atom);
      return { key: "pick", say: measureText(S.model) || "Measurement cleared." };
    },
  },
  input: {
    title: "Open a structure, or fetch one by its PDB code",
    placeholder: "A PDB code, like 1MBN",
    button: "Fetch",
    fileButton: "Open a PDB, mmCIF, SDF, MOL or XYZ file…",
    accept: ".pdb,.ent,.cif,.mmcif,.sdf,.sd,.mol,.mdl,.xyz",
    drop: true, // a file of these kinds dropped on the page opens here
    maxBytes: MAX_FETCH_BYTES,
    note:
      `Codes to try: ${EXAMPLES.map(([c, w]) => `${c} (${w})`).join(", ")}. ` +
      "Fetch reads the entry from the Protein Data Bank (files.rcsb.org) only when you press it; nothing is stored or sent. " +
      `A file you open stays on this device. Up to ${MAX_ATOMS.toLocaleString("en")} atoms (the first model).`,
    async read(text, fileName, _file, _files, progress = () => {}) {
      if (fileName) {
        progress(`Reading ${clean(fileName, 60)}…`);
        const model = await readModel(text, fileName);
        MV.file = { name: clean(fileName, 60), model };
        MV.picks = [];
        return { structure: "file", fileName: clean(fileName, 60) };
      }
      const code = pdbCode(text);
      if (!code)
        throw new Error(
          String(text ?? "").trim()
            ? "A PDB code has four characters and starts with a digit, like 1MBN."
            : "Type a PDB code first, like 1MBN.",
        );
      const got = await fetchEntry(code, { progress });
      progress(`Reading ${code} (${(got.bytes / 1e6).toFixed(1)} MB)…`);
      const model = await readModel(got.text, `${code}.cif`);
      MV.fetched = { code, model, url: got.url, at: got.at };
      MV.picks = [];
      return { structure: "fetched", code };
    },
    shown: () => shownText(),
  },
  // The About tab's credits: the samples, and the entry that is showing.
  get credits() {
    const out = SAMPLES.map((s) => ({
      label: s.label,
      title: `${s.title ?? s.label.replace(/ \(.*$/, "")}, snapshot of ${SNAPSHOT_DATE}`,
      source: s.source,
      author: s.author,
      ...CC0,
    }));
    const f = MV.fetched;
    if (f && MV.want?.kind === "fetched") {
      const m = f.model;
      out.unshift({
        label: `Fetched entry ${f.code}`,
        title: clean(m.title, 120) || f.code,
        source: `https://www.rcsb.org/structure/${f.code}`,
        author: authorsOf(m) || "its depositors",
        ...CC0,
      });
    }
    return out;
  },
  async prepare(o) {
    if (o.structure === "file" && MV.file) {
      MV.want = { model: MV.file.model, kind: "file", name: MV.file.name };
      return;
    }
    if (o.structure === "fetched" && MV.fetched && (!o.code || o.code === MV.fetched.code)) {
      MV.want = { model: MV.fetched.model, kind: "fetched" };
      return;
    }
    // A link or saved scene names a file or a fetched entry that isn't here:
    // the first sample, with a word about it (nothing is fetched by itself).
    let note = "";
    if (o.structure === "file") note = "Open your file again to see it.";
    if (o.structure === "fetched")
      note = o.code ? `Type ${clean(o.code, 4)} and press Fetch to see it again.` : "Type a code and press Fetch."; // prettier-ignore
    const def = SAMPLES.find((s) => s.id === o.structure) || SAMPLES[0];
    if (!MV.cache.has(def.id)) {
      const text = await readAsset(`../../assets/toys/molecule-viewer/${def.file}`);
      const model = await readModel(text, def.file);
      if (def.title) model.title = def.title;
      MV.cache.set(def.id, model);
    }
    if (MV.want?.sample !== def.id) MV.picks = [];
    MV.want = { model: MV.cache.get(def.id), kind: "sample", sample: def.id, note };
  },
  drive(t, c, out, info) {
    const S = MV.shown;
    const tap = info.tap;
    if (tap && tap.n !== MV.lastTap) {
      MV.lastTap = tap.n;
      if (!tap.point) demoStep();
    }
    const tokens = [];
    for (let i = 0; i < TOKENS; i++) tokens.push({ base: [0, 0, 0], offset: [0, 0, 0], visible: 0 }); // prettier-ignore
    out.tokens = tokens;
    if (!S) return;
    const m = S.model;
    const P = MV.picks.filter((i) => i < m.n);
    // The marks are drawn in depth order where they stand: sort them again
    // when the picks change (the player's resortTokens).
    const key = `${S.splats}:${P.join(",")}`;
    if (key !== MV.sorted) {
      MV.sorted = key;
      out.resort = true;
    }
    // The newest pick's marks arrive as the tap's pulse runs out: its marker
    // turns a full circle, its line runs out from the last atom.
    const run = 1 - Math.max(0, Math.min(1, c.pick ?? 0));
    const grow = smoothstep(0, 0.55, run);
    P.forEach((a, k) => {
      const newest = k === P.length - 1;
      tokens[k] = {
        base: [0, 0, 0],
        offset: pos(m, a),
        quat: newest ? quatAxisAngle([0.35, 1, 0.2], Math.PI * 2 * smoothstep(0, 1, run)) : [0, 0, 0, 1], // prettier-ignore
        visible: 1,
      };
    });
    const line = (from, to, first, reveal) => {
      const A = pos(m, from);
      const B = pos(m, to);
      for (let j = 0; j < BEADS; j++) {
        const f = (j + 0.5) / BEADS;
        tokens[first + j] = {
          base: [0, 0, 0],
          offset: [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f],
          visible: f <= reveal ? 1 : 0,
        };
      }
    };
    if (P.length >= 2) line(P[0], P[1], MARKERS, P.length === 2 ? grow : 1);
    if (P.length >= 3) {
      line(P[1], P[2], MARKERS + BEADS, grow);
      // The arc of the angle, round the middle atom.
      const B = pos(m, P[1]);
      const u = unitTo(B, pos(m, P[0]));
      const w = unitTo(B, pos(m, P[2]));
      // Outside the middle atom's ball, inside the shorter arm.
      const arm = Math.min(distance(m, P[0], P[1]), distance(m, P[1], P[2]));
      const r = Math.min(0.8 * arm, Math.max(0.4 * arm, S.markR * 0.95));
      const th = Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1] + u[2] * w[2])));
      for (let j = 0; j < ARC; j++) {
        const f = (j + 0.5) / ARC;
        const d = slerp(u, w, th, f);
        tokens[MARKERS + 2 * BEADS + j] = {
          base: [0, 0, 0],
          offset: [B[0] + d[0] * r, B[1] + d[1] * r, B[2] + d[2] * r],
          visible: f <= grow ? 1 : 0,
        };
      }
    }
  },
  build(k, o) {
    const want = MV.want;
    if (!want) throw new Error("There is no structure to show.");
    const m = want.model;
    const style = styleFor(o, m);
    const scheme = o.color || "element";
    const budget = k.count * 0.92;
    const rand = k.rand;
    // Which atoms show.
    const shown = new Uint8Array(m.n);
    for (let i = 0; i < m.n; i++) {
      const kind = m.residues[m.res[i]].kind;
      shown[i] = (kind !== KIND.water || o.water) && (m.el[i] !== "H" || o.hydrogens !== false) ? 1 : 0; // prettier-ignore
    }
    const color = colorer(m, scheme === "rainbow" || scheme === "structure" ? "element" : scheme, (i) => shown[i] === 1); // prettier-ignore
    const L = new SplatList(Math.min(1 << 20, Math.ceil(budget * 1.1)));
    const pickable = new Uint8Array(m.n);
    const notes = [];
    let reach = 2.5; // a tap counts on an atom within this many Å of it
    let markR = 0.8;
    // Bonds between shown atoms.
    const bondList = (keep) => {
      const out = [];
      for (let q = 0; q < m.order.length; q++) {
        const i = m.bonds[2 * q];
        const j = m.bonds[2 * q + 1];
        if (shown[i] && shown[j] && keep(i) && keep(j)) out.push([i, j, m.order[q]]);
      }
      return out;
    };
    const lodNotes = [];
    // Level of detail when even one splat per atom passes the budget: only the
    // atoms on the outside are drawn, and if those are still too many, every k-th.
    const thin = (atoms, cap, radius) => {
      if (atoms.length <= cap) return atoms;
      let out = outerAtoms(m, atoms, radius);
      lodNotes.push(`only the ${fmt(out.length)} atoms on the outside (of ${fmt(atoms.length)}) are drawn`); // prettier-ignore
      if (out.length > cap) {
        const step = Math.ceil(out.length / cap);
        out = out.filter((_, q) => q % step === 0);
        lodNotes.push(`and of those, one in ${step}`);
      }
      return out;
    };
    const ballstick = (atoms, share) => {
      const cap = budget * share;
      const radius = (i) => BALL * vdwRadius(m.el[i]);
      const pairs = (list) => {
        const set = new Uint8Array(m.n);
        for (const i of list) set[i] = 1;
        return bondList((i) => set[i] === 1);
      };
      let bonds = pairs(atoms);
      let area = 0;
      for (const i of atoms) area += 4 * Math.PI * radius(i) ** 2;
      for (const [i, j] of bonds) area += 2 * Math.PI * STICK * Math.max(0.1, distance(m, i, j) - radius(i) - radius(j)); // prettier-ignore
      // A small molecule needs no more than about 700 splats per Å² to look solid.
      const density = Math.min(700, cap / Math.max(1, area));
      const lines = bonds.reduce((n, b) => n + (b[2] === 1 ? 1 : 2), 0);
      let mode = "full";
      if ((density * area) / Math.max(1, atoms.length) < 8) {
        // Too few splats for solid balls: one Gaussian per atom, and per half
        // bond, or per bond, or no bonds at all, whichever fits.
        if (atoms.length + 2 * lines <= cap) mode = "halves";
        else if (atoms.length + bonds.length <= cap) mode = "whole";
        else mode = "atoms";
      }
      let drawR = radius;
      if (mode === "atoms") {
        atoms = thin(atoms, cap, (i) => vdwRadius(m.el[i]));
        bonds = [];
        drawR = (i) => 1.8 * radius(i); // bigger balls, so the atoms still touch
        lodNotes.push("one Gaussian per atom with no sticks");
      } else if (mode === "whole") lodNotes.push("one Gaussian per atom and per bond");
      else if (mode === "halves") lodNotes.push("one Gaussian per atom and per half bond");
      const a = drawAtoms(L, m, atoms, { radius: drawR, color, density, rand });
      const b = bonds.length ? drawBonds(L, m, bonds, { stick: STICK, color, density, ball: radius, whole: mode === "whole" }) : { single: 0 }; // prettier-ignore
      for (const i of atoms) pickable[i] = 1;
      return { bonds, density, single: a.single + b.single };
    };
    const atomsWhere = (f) => {
      const out = [];
      for (let i = 0; i < m.n; i++) if (shown[i] && f(i)) out.push(i);
      return out;
    };
    const kindOf = (i) => m.residues[m.res[i]].kind;
    const macro = (i) => kindOf(i) === KIND.amino || kindOf(i) === KIND.nucleic;
    let drawnBonds = [];
    if (style === "ballstick") {
      const r = ballstick(
        atomsWhere(() => true),
        1,
      );
      drawnBonds = r.bonds;
      reach = 1.2;
      markR = 0.75;
    } else if (style === "spacefill") {
      const radius = (i) => vdwRadius(m.el[i]);
      const all = thin(
        atomsWhere(() => true),
        budget,
        radius,
      );
      // Most of each sphere is buried in its neighbors: the buried splats are
      // left out (up to 30,000 atoms) and the budget goes to the rest.
      const cull = all.length <= 30000;
      // Buried atoms a little darker (ambient occlusion), so the shape reads in depth.
      const shade = occluded(color, openness(m, all));
      const r = drawAtoms(L, m, all, { radius, color: shade, density: 700, budget, cull, rand });
      if (r.single) lodNotes.push("one Gaussian per atom");
      for (const i of all) pickable[i] = 1;
      drawnBonds = bondList(() => true);
      reach = 2.4;
      markR = 2.1;
    } else if (style === "surface") {
      const inSurface = isMacro(m) ? macro : (i) => kindOf(i) !== KIND.water;
      const use = (i) => inSurface(i) && m.el[i] !== "H";
      const others = atomsWhere((i) => !inSurface(i));
      const share = others.length ? Math.min(0.25, (others.length * 30) / budget) : 0;
      const inside = atomsWhere(use);
      const shade = occluded(color, openness(m, inside));
      const sf = drawSurface(L, m, { use, color: shade, max: budget * (1 - share), rand });
      if (others.length) drawnBonds = ballstick(others, share).bonds;
      // Only atoms on the outside can be tapped: their markers show through the
      // surface. (A very big entry skips the search; at that scale a tap lands
      // on the outside anyway.)
      const outside = inside.length <= 60000 ? outerAtoms(m, inside, (i) => vdwRadius(m.el[i])) : inside; // prettier-ignore
      for (const i of outside) pickable[i] = 1;
      notes.push(`The surface is a blobby (Gaussian) surface over the heavy atoms at their van der Waals radii, sampled every ${sf.h.toFixed(2)} Å: close to the solvent-excluded surface, but smoother in deep crevices.`); // prettier-ignore
      reach = 3.4;
      markR = 2.9;
    } else {
      // Cartoon: ribbons for the chains, balls and sticks for the rest.
      const residueAtom = (ri) => {
        const r = m.residues[ri];
        for (let i = r.start; i < r.end; i++) if (m.atomName[i] === "CA" || m.atomName[i] === "P") return i; // prettier-ignore
        return r.start;
      };
      const chainLen = new Map();
      m.residues.forEach((r) => chainLen.set(r.chain, (chainLen.get(r.chain) ?? 0) + 1));
      const colorRes = (ri, t, rung = false) => {
        const r = m.residues[ri];
        if (scheme === "chain") return CHAIN_COLORS[r.chain % CHAIN_COLORS.length];
        if (scheme === "residue") return residueColor(r.name);
        if (scheme === "bfactor") return color(residueAtom(ri));
        if (scheme === "rainbow") return rainbow(t);
        // Element and structure: helices, strands and coil (a ribbon has no element).
        if (r.kind === KIND.nucleic) return rung ? residueColor(r.name) : [0.62, 0.68, 0.95];
        return SS_COLORS[r.ss] ?? SS_COLORS.C;
      };
      const others = atomsWhere((i) => !macro(i));
      let macroRes = 0;
      for (const r of m.residues) if (r.kind === KIND.amino) macroRes += 1;
      let nuc = 0;
      for (const r of m.residues) if (r.kind === KIND.nucleic) nuc += 1;
      const ribbonArea = macroRes * 3.8 * 5.2 + nuc * 6.5 * 7;
      const share = others.length ? Math.min(0.3, (others.length * 40) / budget) : 0;
      const cd = drawCartoon(L, m, { colorRes, density: (budget * (1 - share)) / Math.max(1, ribbonArea), rand }); // prettier-ignore
      for (const i of cd.backbone) pickable[i] = 1;
      if (others.length) drawnBonds = ballstick(others, share).bonds;
      reach = 3;
      markR = 1.5;
      if (scheme === "element")
        notes.push("A ribbon has no element: it is colored by its secondary structure (helix red, strand yellow, coil gray), the rest by element."); // prettier-ignore
    }
    // Bigger marks on a big structure, so they show from the home view.
    let ext = 0;
    for (let i = 0; i < m.n; i += Math.max(1, Math.floor(m.n / 20000))) if (shown[i]) ext = Math.max(ext, Math.abs(m.x[i]), Math.abs(m.y[i]), Math.abs(m.z[i])); // prettier-ignore
    markR = Math.max(markR, ext * 0.03);
    // Beads wider than a stick, so a line along a bond still shows.
    const bead = Math.max(0.17, ext * 0.005, markR * 0.11);
    if (!L.n)
      throw new Error("Nothing to show: every atom is hidden. Switch Hydrogens or Water on.");
    k.cloud({ count: ((L.n + 0.4) * 160000) / k.count, jitter: 0 }, (_r, i) => L.sample(i));
    // The measuring marks: tokens drawn at the origin, moved by drive().
    for (let t = 0; t < MARKERS; t++) {
      const ring = markerSplats(markR, PICK_COLORS[t]);
      k.cloud({ count: ((ring.length + 0.4) * 160000) / k.count, jitter: 0, fit: false, pattern: false }, (_r, i) => (ring[i] ? { ...ring[i], kind: "token", params: [t, 0] } : null)); // prettier-ignore
    }
    for (let t = MARKERS; t < TOKENS; t++) {
      const ball = beadSplats(bead, t >= MARKERS + 2 * BEADS ? [1, 0.55, 0.9] : [1, 0.96, 0.55]);
      k.cloud({ count: ((ball.length + 0.4) * 160000) / k.count, jitter: 0, fit: false, pattern: false }, (_r, i) => (ball[i] ? { ...ball[i], kind: "token", params: [t, 0] } : null)); // prettier-ignore
    }
    const demo = demoTriple(m, pickable, drawnBonds.length ? drawnBonds : bondList(() => true));
    if (style === "spacefill" || style === "surface") {
      const missing = [...new Set(m.el.filter((e) => !hasVdw(e)))];
      if (missing.length)
        notes.push(`No tabulated van der Waals radius for ${missing.slice(0, 6).join(", ")}; 2.0 Å is used.`); // prettier-ignore
    }
    MV.shown = {
      model: m,
      style,
      scheme,
      pickable,
      reach,
      markR,
      demo,
      lod: lodNotes.join(", "),
      notes,
      splats: L.n,
      shownAtoms: shown.reduce((s, v) => s + v, 0),
      bonds: drawnBonds.length,
      kind: want.kind,
      note: want.note,
    };
    MV.picks = MV.picks.filter((i) => i < m.n && pickable[i]);
    k.data = { viewer: { splats: L.n, style } };
  },
};

function unitTo(a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
}
function slerp(u, w, th, f) {
  if (th < 1e-4) return u;
  const s = Math.sin(th);
  const a = Math.sin((1 - f) * th) / s;
  const b = Math.sin(f * th) / s;
  return [u[0] * a + w[0] * b, u[1] * a + w[1] * b, u[2] * a + w[2] * b];
}

// "Hendrickson, W.A., Teeter, M.M." -> "W.A. Hendrickson and M.M. Teeter"; more
// than three: the first and "and others".
function authorsOf(m) {
  const names = (m.meta?.authors ?? []).map((a) => {
    const s = clean(a, 60);
    const r = /^([^,]+),\s*(.+)$/.exec(s);
    return r ? `${r[2]} ${r[1]}` : s;
  });
  if (!names.length) return "";
  if (names.length > 3) return `${names[0]} and others`;
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// What the Toy tab says beside the structure: its title, who made it, where it
// came from and when, what is drawn, and the measurement.
export function shownText() {
  const S = MV.shown;
  if (!S) return "";
  const m = S.model;
  const out = [];
  const title = clean(m.title, 160);
  const code = m.id && /^[0-9][A-Za-z0-9]{3}$/.test(m.id) ? m.id.toUpperCase() : "";
  out.push(code && !title.includes(code) ? `${code}: ${title}.` : `${title}.`);
  const who = authorsOf(m);
  const cite = m.meta?.citation;
  if (who) out.push(`By ${who}${cite?.year ? ` (${cite.year})` : ""}.`);
  const facts = [];
  if (m.meta?.method) facts.push(clean(m.meta.method.toLowerCase(), 60));
  if (m.meta?.resolution) facts.push(`${m.meta.resolution} Å resolution`);
  if (facts.length) facts[0] = facts[0][0].toUpperCase() + facts[0].slice(1);
  if (facts.length) out.push(`${facts.join(", ")}.`);
  if (S.kind === "fetched" && MV.fetched) {
    const at = MV.fetched.at;
    const when = at.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); // prettier-ignore
    out.push(`Fetched from the Protein Data Bank (${RCSB}${MV.fetched.code}.cif) on ${when}. wwPDB data, CC0.`); // prettier-ignore
  } else if (S.kind === "sample") {
    out.push(`A snapshot from the Protein Data Bank, fetched ${SNAPSHOT_DATE}. wwPDB data, CC0.`);
  } else if (S.kind === "file") {
    out.push(`From your file ${MV.file?.name ?? ""}, read on this device.`);
  }
  if (S.note) out.push(S.note);
  const c = m.counts;
  const parts = [`${fmt(c.atoms)} atoms`];
  if (c.chains > 0 && c.residues) parts.push(`${fmt(c.residues)} residues in ${c.chains} chain${c.chains > 1 ? "s" : ""}`); // prettier-ignore
  if (c.ligands && m.format !== "sdf" && m.format !== "xyz") parts.push(`${fmt(c.ligands)} other groups`); // prettier-ignore
  if (c.waters) parts.push(`${fmt(c.waters)} waters`);
  out.push(`${parts.join(", ")}; ${fmt(S.splats)} splats.`);
  out.push(`Bonds: ${m.bondSource === "file" ? "from the file" : m.bondSource === "distance" ? "from distances (covalent radii)" : "from distances and the file's CONECT records"}.`); // prettier-ignore
  if (S.style === "cartoon" && m.ssSource === "file")
    out.push("Helices and strands: from the file's records.");
  if (S.style === "cartoon" && m.ssSource === "inferred")
    out.push(
      "Helices and strands: inferred from backbone hydrogen bonds (the file has no records).",
    );
  if (S.lod) out.push(`Level of detail: ${S.lod}.`);
  if (S.scheme === "bfactor" && !m.hasB)
    out.push("This file has no B-factors, so the atoms are gray.");
  out.push(...m.notes, ...S.notes);
  const meas = measureText(m);
  if (meas) out.push(meas);
  return out.join(" ");
}

export const RECIPES = { "molecule-viewer": VIEWER };

// For the tests: the samples' element colors and radii come from these.
export { cpk, vdwRadius };
