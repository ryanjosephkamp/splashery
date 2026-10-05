// Lane Molecule viewer: reads PDB, mmCIF, SDF/MOL and XYZ files into one flat
// model the viewer draws. Pure functions with no DOM, so the same code runs in
// a Web Worker (src/molview/worker.js), in Node for the tools and the tests,
// and on the main thread as a fallback.
//
// readStructure(text, fileName) returns
//
//   {
//     format: "pdb" | "mmcif" | "sdf" | "xyz",
//     id, title,                     the entry's code and title (or the file's)
//     meta: { authors, citation: { title, journal, year, doi }, method,
//             resolution, deposited, released },
//     n,                             atoms (the first model only)
//     x, y, z,                       Float32Array positions, ångströms, as in the file
//     el, atomName,                  arrays of strings ("C", "CA")
//     b, hasB,                       Float32Array B-factors (0 when the file has none)
//     het,                           Uint8Array: 1 for HETATM records
//     res,                           Int32Array: each atom's residue index
//     residues: [{ name, seq, icode, chain, kind, start, end, ss }],
//                                    kind: 0 other (a ligand or ion), 1 amino
//                                    acid, 2 nucleotide, 3 water; atoms
//                                    start..end-1; ss "H", "E" or "C"
//     chains: [{ id }],              residue.chain indexes this
//     bonds: Uint32Array (pairs), order: Uint8Array (1, 2 or 3; 4 aromatic),
//     bondSource: "file" | "distance" | "file and distance",
//     ssSource: "file" | "inferred" | "none",
//     notes: [plain sentences about what was read and what was left out],
//   }
//
// Only the first model and the first alternate location of each residue are
// kept. Bonds come from the file where it lists them (SDF/MOL bond blocks, PDB
// CONECT records) and otherwise from distances: two atoms closer than the sum
// of their covalent radii (Cordero et al. 2008) plus 0.45 Å are bonded, and a
// hydrogen keeps only its nearest partner. Errors are thrown with short
// messages meant for the person who opened the file.

import { eachCifToken, readCif, assignSecondaryStructure } from "../chem/protein.js";
import { pdbElement, parseMolfile, readMoleculeFile } from "../chem/molfile.js";
import { element, normalSymbol } from "../chem/elements.js";
import { covalent } from "./radii.js";

// The most atoms the viewer reads from one model. A 250,000-atom structure
// is about four ribosomes; phones draw it at one splat per atom (the level of
// detail in src/packs/molecule-viewer.js).
export const MAX_ATOMS = 250000;
export const BOND_TOLERANCE = 0.45;
// Secondary structure is worked out from hydrogen bonds only up to this many
// amino acids (the method compares every pair of residues).
export const MAX_INFER_RESIDUES = 3000;

const fail = (message) => {
  throw new Error(message);
};
const tooMany = () =>
  fail(
    `That structure has more than ${MAX_ATOMS.toLocaleString("en")} atoms in its first model, ` +
      "more than the viewer can draw smoothly. Try a smaller entry, or one chain of it saved as its own file.",
  );

// prettier-ignore
const AMINO = new Set([
  "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE", "LEU", "LYS", "MET",
  "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL", "MSE", "SEC", "PYL", "SEP", "TPO", "PTR",
  "HYP", "MLY", "CSO", "CME", "KCX", "LLP", "OCS", "CSD", "ASX", "GLX", "UNK", "HID", "HIE",
  "HIP", "HSD", "HSE", "HSP", "CYX", "ASH", "GLH", "LYN", "NLE", "ABA", "AIB",
]);
// prettier-ignore
const NUCLEIC = new Set([
  "A", "C", "G", "U", "T", "I", "N", "DA", "DC", "DG", "DT", "DU", "DI", "DN",
  "ADE", "CYT", "GUA", "THY", "URA", "RA", "RC", "RG", "RU",
]);
const WATER = new Set(["HOH", "WAT", "DOD", "H2O", "TIP", "TIP3", "SOL"]);
export const KIND = { other: 0, amino: 1, nucleic: 2, water: 3 };

// ---- Collecting atoms -------------------------------------------------------------------

// Gathers atoms into growing arrays and residues, keeping the first alternate
// location and skipping repeated atom names within a residue.
function collector() {
  let cap = 4096;
  let x = new Float32Array(cap);
  let y = new Float32Array(cap);
  let z = new Float32Array(cap);
  let b = new Float32Array(cap);
  let het = new Uint8Array(cap);
  let res = new Int32Array(cap);
  const el = [];
  const atomName = [];
  const serial = [];
  const residues = [];
  const chains = [];
  const chainIndex = new Map();
  let n = 0;
  let cur = null;
  let hasB = false;
  const grow = () => {
    cap *= 2;
    const g = (a, T) => {
      const t = new T(cap);
      t.set(a);
      return t;
    };
    x = g(x, Float32Array);
    y = g(y, Float32Array);
    z = g(z, Float32Array);
    b = g(b, Float32Array);
    het = g(het, Uint8Array);
    res = g(res, Int32Array);
  };
  // a: { chain, resName, seq, icode, alt, name, el, p: [x, y, z], b, het, serial }
  const add = (a) => {
    if (
      !cur ||
      cur.chainId !== a.chain ||
      cur.seq !== a.seq ||
      cur.icode !== a.icode ||
      cur.name !== a.resName
    ) {
      // A second residue type at the same place is an alternate; skip it.
      if (cur && cur.chainId === a.chain && cur.seq === a.seq && cur.icode === a.icode) return;
      let ci = chainIndex.get(a.chain);
      if (ci === undefined) {
        ci = chains.length;
        chainIndex.set(a.chain, ci);
        chains.push({ id: a.chain });
      }
      cur = {
        name: a.resName,
        seq: a.seq,
        icode: a.icode,
        chain: ci,
        chainId: a.chain,
        kind: KIND.other,
        start: n,
        end: n,
        ss: "C",
        alt: "",
        names: [],
      };
      residues.push(cur);
    }
    if (a.alt) {
      if (!cur.alt) cur.alt = a.alt;
      if (a.alt !== cur.alt) return;
    }
    if (cur.names.includes(a.name)) return;
    if (n >= MAX_ATOMS) tooMany();
    if (n >= cap) grow();
    cur.names.push(a.name);
    x[n] = a.p[0];
    y[n] = a.p[1];
    z[n] = a.p[2];
    const bf = Number.isFinite(a.b) ? a.b : 0;
    if (bf) hasB = true;
    b[n] = bf;
    het[n] = a.het ? 1 : 0;
    res[n] = residues.length - 1;
    el.push(a.el);
    atomName.push(a.name);
    serial.push(a.serial);
    n++;
    cur.end = n;
  };
  const finish = () => {
    for (const r of residues) {
      const has = (nm) => r.names.includes(nm);
      if (WATER.has(r.name)) r.kind = KIND.water;
      else if (NUCLEIC.has(r.name) || (has("P") && has("C1'") && !has("CA")))
        r.kind = KIND.nucleic; // prettier-ignore
      else if (AMINO.has(r.name) || (has("N") && has("CA") && has("C"))) r.kind = KIND.amino;
      delete r.names;
      delete r.alt;
      delete r.chainId;
    }
    return {
      n,
      x: x.slice(0, n),
      y: y.slice(0, n),
      z: z.slice(0, n),
      b: b.slice(0, n),
      het: het.slice(0, n),
      res: res.slice(0, n),
      el,
      atomName,
      serial,
      residues,
      chains,
      hasB,
    };
  };
  return { add, finish, count: () => n };
}

// ---- Bonds from distances ---------------------------------------------------------------

// Bonds between atoms closer than the sum of their covalent radii plus the
// tolerance, found with a grid so a big structure costs little. Water
// oxygens and lone ions get none they don't have; a hydrogen keeps only its
// nearest partner. `skip(i)` leaves an atom out. Returns [i, j] pairs (i < j).
export function bondsByDistance(m, { tolerance = BOND_TOLERANCE, skip = null } = {}) {
  const { n, x, y, z, el } = m;
  const rad = new Float32Array(n);
  let rmax = 0.5;
  for (let i = 0; i < n; i++) {
    rad[i] = covalent(el[i]);
    if (rad[i] > rmax) rmax = rad[i];
  }
  const cell = 2 * rmax + tolerance;
  let lo = [Infinity, Infinity, Infinity];
  for (let i = 0; i < n; i++) {
    if (x[i] < lo[0]) lo[0] = x[i];
    if (y[i] < lo[1]) lo[1] = y[i];
    if (z[i] < lo[2]) lo[2] = z[i];
  }
  if (!n) return [];
  lo = lo.map((v) => v - 1e-3);
  const key = (gx, gy, gz) => (gx * 73856093) ^ (gy * 19349663) ^ (gz * 83492791);
  const gi = new Int32Array(n * 3);
  const head = new Map();
  const next = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (skip?.(i)) continue;
    const a = Math.floor((x[i] - lo[0]) / cell);
    const bq = Math.floor((y[i] - lo[1]) / cell);
    const c = Math.floor((z[i] - lo[2]) / cell);
    gi[i * 3] = a;
    gi[i * 3 + 1] = bq;
    gi[i * 3 + 2] = c;
    const k = key(a, bq, c);
    const h = head.get(k);
    next[i] = h === undefined ? -1 : h;
    head.set(k, i);
  }
  const pairs = [];
  const dists = [];
  for (let i = 0; i < n; i++) {
    if (skip?.(i)) continue;
    const a = gi[i * 3];
    const bq = gi[i * 3 + 1];
    const c = gi[i * 3 + 2];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          let j = head.get(key(a + dx, bq + dy, c + dz));
          while (j !== undefined && j >= 0) {
            if (
              j > i &&
              gi[j * 3] === a + dx &&
              gi[j * 3 + 1] === bq + dy &&
              gi[j * 3 + 2] === c + dz
            ) {
              const ex = x[i] - x[j];
              const ey = y[i] - y[j];
              const ez = z[i] - z[j];
              const d2 = ex * ex + ey * ey + ez * ez;
              const lim = rad[i] + rad[j] + tolerance;
              if (d2 > 0.16 && d2 < lim * lim && !(el[i] === "H" && el[j] === "H")) {
                pairs.push(i, j);
                dists.push(Math.sqrt(d2));
              }
            }
            j = next[j];
          }
        }
  }
  // Each hydrogen keeps its closest bond only.
  const best = new Map();
  for (let k = 0; k < dists.length; k++)
    for (const h of [pairs[2 * k], pairs[2 * k + 1]])
      if (el[h] === "H") {
        const was = best.get(h);
        if (was === undefined || dists[was] > dists[k]) best.set(h, k);
      }
  const out = [];
  for (let k = 0; k < dists.length; k++) {
    const i = pairs[2 * k];
    const j = pairs[2 * k + 1];
    if (el[i] === "H" && best.get(i) !== k) continue;
    if (el[j] === "H" && best.get(j) !== k) continue;
    out.push([i, j]);
  }
  return out;
}

// ---- Secondary structure ------------------------------------------------------------------

// Marks residues inside ranges { ss, chain (id), from: [seq, icode], to } and
// returns how many residues it marked.
function applyRanges(m, ranges) {
  const byChain = new Map();
  m.residues.forEach((r, i) => {
    if (r.kind !== KIND.amino) return;
    const id = m.chains[r.chain].id;
    if (!byChain.has(id)) byChain.set(id, []);
    byChain.get(id).push(i);
  });
  let marked = 0;
  // Strands first, so a helix record wins where the two overlap.
  const sorted = [...ranges.filter((r) => r.ss === "E"), ...ranges.filter((r) => r.ss !== "E")];
  for (const { ss, chain, from, to } of sorted) {
    const list = byChain.get(chain);
    if (!list) continue;
    const at = ([seq, icode], last) => {
      const exact = list.findIndex((i) => m.residues[i].seq === seq && m.residues[i].icode === icode); // prettier-ignore
      if (exact >= 0) return exact;
      if (last) {
        for (let k = list.length - 1; k >= 0; k--) if (m.residues[list[k]].seq <= seq) return k;
        return -1;
      }
      return list.findIndex((i) => m.residues[i].seq >= seq);
    };
    const a = at(from, false);
    const b = at(to, true);
    if (a < 0 || b < a) continue;
    for (let k = a; k <= b; k++) {
      m.residues[list[k]].ss = ss;
      marked++;
    }
  }
  return marked;
}

// Works out helices and strands from backbone hydrogen bonds (src/chem/protein.js,
// a simplified DSSP) for structures up to MAX_INFER_RESIDUES amino acids.
function inferSecondary(m) {
  const amino = m.residues.filter((r) => r.kind === KIND.amino);
  if (!amino.length) return "none";
  if (amino.length > MAX_INFER_RESIDUES) {
    m.notes.push(
      `The file has no helix or sheet records, and with ${amino.length.toLocaleString("en")} amino acids it is too big to work them out here, so the cartoon is drawn as coil.`,
    );
    return "none";
  }
  const chains = new Map();
  for (const r of amino) {
    if (!chains.has(r.chain)) chains.set(r.chain, { residues: [] });
    const atoms = [];
    for (let i = r.start; i < r.end; i++)
      if (["N", "CA", "C", "O", "OT1"].includes(m.atomName[i]))
        atoms.push({ name: m.atomName[i], p: [m.x[i], m.y[i], m.z[i]] });
    chains.get(r.chain).residues.push({ name: r.name, atoms, ss: "C", ref: r });
  }
  const list = [...chains.values()];
  assignSecondaryStructure(list);
  for (const c of list) for (const r of c.residues) r.ref.ss = r.ss;
  return "inferred";
}

// ---- Shared finishing -----------------------------------------------------------------------

function finishMacro(raw, { format, id, title, meta, ranges, conect, notes }) {
  const m = raw.finish();
  if (!m.n) fail("No atoms found in this file.");
  Object.assign(m, { format, id, title, meta, notes });
  // Bonds: by distance, never across waters; plus CONECT records (PDB) that
  // distance missed or that give a higher order.
  const pairs = bondsByDistance(m, { skip: (i) => m.residues[m.res[i]].kind === KIND.water });
  const order = new Map();
  for (const [i, j] of pairs) order.set(i * MAX_ATOMS + j, 1);
  let fromFile = 0;
  if (conect?.size) {
    const index = new Map();
    m.serial.forEach((s, i) => index.set(s, i));
    for (const [s, partners] of conect) {
      const i = index.get(s);
      if (i === undefined) continue;
      for (const [t, times] of partners) {
        const j = index.get(t);
        if (j === undefined || j === i) continue;
        const key = Math.min(i, j) * MAX_ATOMS + Math.max(i, j);
        const o = Math.min(3, times);
        if (!order.has(key) || order.get(key) < o) {
          order.set(key, o);
          fromFile++;
        }
      }
    }
  }
  m.bonds = new Uint32Array(order.size * 2);
  m.order = new Uint8Array(order.size);
  let k = 0;
  for (const [key, o] of order) {
    m.bonds[2 * k] = Math.floor(key / MAX_ATOMS);
    m.bonds[2 * k + 1] = key % MAX_ATOMS;
    m.order[k++] = o;
  }
  m.bondSource = fromFile ? "file and distance" : "distance";
  delete m.serial;
  // Secondary structure: the file's records, or worked out.
  if (ranges.length && applyRanges(m, ranges)) m.ssSource = "file";
  else m.ssSource = inferSecondary(m);
  const waters = m.residues.filter((r) => r.kind === KIND.water).length;
  m.counts = {
    atoms: m.n,
    residues: m.residues.filter((r) => r.kind === KIND.amino || r.kind === KIND.nucleic).length,
    waters,
    chains: m.chains.length,
    ligands: m.residues.filter((r) => r.kind === KIND.other).length,
  };
  return m;
}

// ---- PDB ------------------------------------------------------------------------------------

const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");
// "05-JAN-81" -> "1981-01-05"
function pdbDate(s) {
  const r = /^(\d\d)-([A-Z]{3})-(\d\d)$/.exec(String(s).trim());
  if (!r) return "";
  const mo = MONTHS.indexOf(r[2]) + 1;
  if (!mo) return "";
  const yy = Number(r[3]);
  return `${yy < 50 ? 2000 + yy : 1900 + yy}-${String(mo).padStart(2, "0")}-${r[1]}`;
}

export function parsePdb(text) {
  const src = String(text);
  const raw = collector();
  const conect = new Map();
  const ranges = [];
  const title = [];
  const authors = [];
  const jrnl = { title: [], ref: [], doi: "" };
  const meta = { authors: [], citation: null, method: "", resolution: null, deposited: "" };
  let id = "";
  let header = "";
  let models = 0;
  for (let start = 0; start < src.length; ) {
    let end = src.indexOf("\n", start);
    if (end < 0) end = src.length;
    const line = src.slice(start, src[end - 1] === "\r" ? end - 1 : end);
    start = end + 1;
    const rec = line.slice(0, 6);
    if (rec === "ATOM  " || rec === "HETATM") {
      const p = [line.slice(30, 38), line.slice(38, 46), line.slice(46, 54)].map(Number);
      const seq = parseInt(line.slice(22, 26), 10);
      if (!p.every(Number.isFinite)) continue;
      raw.add({
        het: rec === "HETATM",
        serial: parseInt(line.slice(6, 11), 10),
        name: line.slice(12, 16).trim(),
        alt: line.slice(16, 17).trim(),
        resName: line.slice(17, 20).trim(),
        chain: line.slice(21, 22).trim(),
        seq: Number.isFinite(seq) ? seq : 0,
        icode: line.slice(26, 27).trim(),
        p,
        b: parseFloat(line.slice(60, 66)),
        el: pdbElement(line) || "X",
      });
    } else if (rec === "MODEL ") {
      if (models++) break;
    } else if (rec === "ENDMDL") break;
    else if (rec === "HEADER") {
      id = line.slice(62, 66).trim();
      header = line.slice(10, 50).trim();
      meta.deposited = pdbDate(line.slice(50, 59));
    } else if (rec === "TITLE ") title.push(line.slice(10, 80).trim());
    else if (rec === "AUTHOR") authors.push(line.slice(10, 79).trim());
    else if (rec === "EXPDTA") meta.method = (meta.method + " " + line.slice(10, 79).trim()).trim();
    else if (rec === "JRNL  ") {
      const tag = line.slice(12, 16).trim();
      const v = line.slice(19, 79).trim();
      if (tag === "TITL") jrnl.title.push(v);
      else if (tag === "REF") jrnl.ref.push(line.slice(19, 66).trim());
      else if (tag === "DOI") jrnl.doi = v;
    } else if (rec === "REMARK" && line.slice(6, 10).trim() === "2") {
      const r = /RESOLUTION\.\s+([\d.]+)\s+ANGSTROM/.exec(line);
      if (r) meta.resolution = Number(r[1]);
    } else if (rec === "HELIX ") {
      ranges.push({
        ss: "H",
        chain: line.slice(19, 20).trim(),
        from: [parseInt(line.slice(21, 25), 10), line.slice(25, 26).trim()],
        to: [parseInt(line.slice(33, 37), 10), line.slice(37, 38).trim()],
      });
    } else if (rec === "SHEET ") {
      ranges.push({
        ss: "E",
        chain: line.slice(21, 22).trim(),
        from: [parseInt(line.slice(22, 26), 10), line.slice(26, 27).trim()],
        to: [parseInt(line.slice(33, 37), 10), line.slice(37, 38).trim()],
      });
    } else if (rec === "CONECT") {
      const serials = [];
      for (let c = 6; c < Math.min(31, line.length); c += 5) {
        const v = parseInt(line.slice(c, c + 5), 10);
        if (Number.isFinite(v)) serials.push(v);
      }
      const [from, ...to] = serials;
      if (!conect.has(from)) conect.set(from, new Map());
      const mm = conect.get(from);
      for (const s of to) mm.set(s, (mm.get(s) ?? 0) + 1);
    }
  }
  if (!raw.count()) fail("No atoms found in this PDB file.");
  meta.authors = authors
    .join("")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (jrnl.title.length || jrnl.doi) {
    const ref = jrnl.ref.join(" ").replace(/\s+/g, " ");
    const year = /(\d{4})\s*$/.exec(ref)?.[1] ?? "";
    meta.citation = {
      title: jrnl.title.join(" ").replace(/\s+/g, " ").trim(),
      journal: ref.replace(/\s*V\.\s*\d+.*$/, "").trim(),
      year,
      doi: jrnl.doi,
    };
  }
  const notes = [];
  if (models > 1) notes.push("The file has several models; the first is shown.");
  return finishMacro(raw, {
    format: "pdb",
    id,
    title: title.join(" ").replace(/\s+/g, " ").trim() || header,
    meta,
    ranges: ranges.filter((r) => Number.isFinite(r.from[0]) && Number.isFinite(r.to[0])),
    conect,
    notes,
  });
}

// ---- mmCIF -------------------------------------------------------------------------------------

// Row accessor for a stored CIF category: get(row, "field", "fallback") -> string.
function rows(category) {
  if (!category) return { count: 0, get: () => "" };
  const nf = category.fields.length;
  const col = new Map(category.fields.map((f, i) => [f, i]));
  return {
    count: nf ? Math.floor(category.values.length / nf) : 0,
    get: (r, ...names) => {
      for (const f of names) {
        const c = col.get(f);
        const v = c === undefined ? "" : category.values[r * nf + c];
        if (v !== "" && v !== undefined) return v;
      }
      return "";
    },
  };
}

export function parseMmcif(text) {
  const raw = collector();
  let model = null;
  let models = 1;
  let columns = null;
  let columnsFor = null;
  let auth = false;
  const atomSite = (row, fields) => {
    if (fields !== columnsFor) {
      columnsFor = fields;
      columns = new Map(fields.map((f, i) => [f, i]));
      auth = columns.has("auth_seq_id");
    }
    const get = (...names) => {
      for (const f of names) {
        const v = row[columns.get(f)] ?? "";
        if (v !== "") return v;
      }
      return "";
    };
    const mnum = get("pdbx_pdb_model_num");
    if (model === null) model = mnum;
    if (mnum !== model) {
      models = 2;
      return false;
    }
    const p = [get("cartn_x"), get("cartn_y"), get("cartn_z")].map((v) => (v === "" ? NaN : Number(v))); // prettier-ignore
    if (!p.every(Number.isFinite)) return true;
    const name = get("auth_atom_id", "label_atom_id");
    const typed = normalSymbol(get("type_symbol"));
    const seq = parseInt(get("auth_seq_id", "label_seq_id"), 10);
    raw.add({
      het: get("group_pdb") === "HETATM",
      serial: parseInt(get("id"), 10),
      name,
      alt: get("label_alt_id"),
      resName: get("auth_comp_id", "label_comp_id"),
      chain: get("auth_asym_id", "label_asym_id"),
      seq: Number.isFinite(seq) ? seq : 0,
      icode: get("pdbx_pdb_ins_code"),
      p,
      b: parseFloat(get("b_iso_or_equiv")),
      el: element(typed) ? typed : normalSymbol(name.replace(/[^A-Za-z]/g, "").slice(0, 1)) || "X",
    });
    return true;
  };
  const { id, categories } = readCif(text, { stream: { _atom_site: atomSite } });
  if (!raw.count()) fail("The mmCIF file has no atoms (_atom_site table).");
  const cat = (name) => rows(categories.get(name));
  const fields = (end, what) => [...(auth ? [`${end}_auth_${what}`] : []), `${end}_label_${what}`];
  const side = (t, r, end) => [parseInt(t.get(r, ...fields(end, "seq_id")), 10), t.get(r, `pdbx_${end}_pdb_ins_code`)]; // prettier-ignore
  const range = (t, r, ss) => ({ ss, chain: t.get(r, ...fields("beg", "asym_id")), from: side(t, r, "beg"), to: side(t, r, "end") }); // prettier-ignore
  const ranges = [];
  const conf = cat("_struct_conf");
  for (let r = 0; r < conf.count; r++)
    if (/^HELX/i.test(conf.get(r, "conf_type_id"))) ranges.push(range(conf, r, "H"));
  const sheet = cat("_struct_sheet_range");
  for (let r = 0; r < sheet.count; r++) ranges.push(range(sheet, r, "E"));
  // What the entry is and who made it.
  const meta = { authors: [], citation: null, method: "", resolution: null, deposited: "", released: "" }; // prettier-ignore
  const au = cat("_audit_author");
  for (let r = 0; r < au.count; r++) meta.authors.push(au.get(r, "name"));
  const cit = cat("_citation");
  for (let r = 0; r < cit.count; r++) {
    if (r && cit.get(r, "id") !== "primary") continue;
    meta.citation = {
      title: cit.get(r, "title").replace(/\s+/g, " ").trim(),
      journal: cit.get(r, "journal_abbrev"),
      year: cit.get(r, "year"),
      doi: cit.get(r, "pdbx_database_id_doi"),
    };
    if (cit.get(r, "id") === "primary") break;
  }
  const ex = cat("_exptl");
  meta.method = [...Array(ex.count)].map((_, r) => ex.get(r, "method")).join(", ");
  const resolution =
    cat("_refine").get(0, "ls_d_res_high") ||
    cat("_reflns").get(0, "d_resolution_high") ||
    cat("_em_3d_reconstruction").get(0, "resolution");
  meta.resolution = resolution && Number.isFinite(Number(resolution)) ? Number(resolution) : null;
  meta.deposited = cat("_pdbx_database_status").get(0, "recvd_initial_deposition_date");
  meta.released = cat("_pdbx_audit_revision_history").get(0, "revision_date");
  const notes = [];
  if (models > 1) notes.push("The file has several models; the first is shown.");
  return finishMacro(raw, {
    format: "mmcif",
    id: cat("_entry").get(0, "id") || id,
    title: cat("_struct").get(0, "title").replace(/\s+/g, " ").trim(),
    meta,
    ranges: ranges.filter((x) => Number.isFinite(x.from[0]) && Number.isFinite(x.to[0])),
    conect: null,
    notes,
  });
}

// ---- Small molecules: SDF/MOL and XYZ --------------------------------------------------------

// A small-molecule model: one residue, bonds as given (orders 1–3; 4 marks
// an aromatic bond).
function smallModel(format, name, atoms, bonds, { bondSource, notes = [] }) {
  const n = atoms.length;
  if (!n) fail("No atoms found in this file.");
  if (n > MAX_ATOMS) tooMany();
  const m = {
    format,
    id: "",
    title: name,
    meta: { authors: [], citation: null, method: "", resolution: null, deposited: "", released: "" }, // prettier-ignore
    n,
    x: Float32Array.from(atoms, (a) => a.p[0]),
    y: Float32Array.from(atoms, (a) => a.p[1]),
    z: Float32Array.from(atoms, (a) => a.p[2]),
    el: atoms.map((a) => a.el),
    atomName: atoms.map((a, i) => `${a.el}${i + 1}`),
    b: new Float32Array(n),
    hasB: false,
    het: new Uint8Array(n).fill(1),
    res: new Int32Array(n),
    residues: [{ name: "MOL", seq: 1, icode: "", chain: 0, kind: KIND.other, start: 0, end: n, ss: "C" }], // prettier-ignore
    chains: [{ id: "" }],
    bonds: new Uint32Array(bonds.length * 2),
    order: new Uint8Array(bonds.length),
    bondSource,
    ssSource: "none",
    notes,
  };
  bonds.forEach(([i, j, o], k) => {
    m.bonds[2 * k] = Math.min(i, j);
    m.bonds[2 * k + 1] = Math.max(i, j);
    m.order[k] = o === 1.5 ? 4 : Math.max(1, Math.min(3, Math.round(o)));
  });
  m.counts = { atoms: n, residues: 0, waters: 0, chains: 0, ligands: 1 };
  return m;
}

export function parseSdf(text, fileName = "") {
  const src = String(text);
  const records = src.split(/^\$\$\$\$\s*$/m).filter((r) => r.trim()).length;
  let raw;
  try {
    raw = parseMolfile(src);
  } catch (err) {
    if (/atoms; the molecule toy/.test(err.message))
      fail(
        "That MOL file is too big for an SDF reader; save the structure as PDB or mmCIF instead.",
      );
    throw err;
  }
  const notes = [];
  if (records > 1) notes.push(`The file holds ${records} molecules; the first is shown.`);
  const base = String(fileName).replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, ""); // prettier-ignore
  if (raw.is2D) {
    // A flat drawing: build a 3D shape (src/chem/embed.js), with the hydrogens
    // the drawing leaves out. Its lengths and angles are worked out, not measured.
    const mol = readMoleculeFile(src, fileName || "molecule.sdf");
    notes.push(
      "The file is a flat 2D drawing; Splashery built its 3D shape, so lengths and angles are estimates, not measurements.",
    );
    return smallModel("sdf", raw.name || mol.name || base, mol.atoms, mol.bonds, { bondSource: "file", notes }); // prettier-ignore
  }
  const atoms = raw.atoms.map((a) => ({ el: element(a.el) ? a.el : "X", p: a.p }));
  return smallModel("sdf", raw.name || base, atoms, raw.bonds, { bondSource: "file", notes });
}

export function parseXyz(text, fileName = "") {
  const lines = String(text).split(/\r?\n/);
  let k = 0;
  while (k < lines.length && !lines[k].trim()) k++;
  const count = /^\s*\d+\s*$/.test(lines[k] ?? "") ? Number(lines[k]) : -1;
  if (count > MAX_ATOMS) tooMany();
  const comment = count >= 0 ? (lines[k + 1] ?? "").trim() : "";
  const body = count >= 0 ? lines.slice(k + 2, k + 2 + count) : lines.slice(k);
  const atoms = [];
  body.forEach((line, i) => {
    const t = line.trim().split(/\s+/);
    if (!t[0]) return;
    const el = /^\d+$/.test(t[0])
      ? element(Number(t[0]))?.symbol
      : normalSymbol(t[0].replace(/[^A-Za-z].*$/, ""));
    const p = t.slice(1, 4).map(Number);
    if (!el || p.length < 3 || !p.every(Number.isFinite))
      fail(`Could not read line ${i + (count >= 0 ? k + 3 : k + 1)} of the XYZ file.`);
    atoms.push({ el: element(el) ? el : "X", p });
  });
  if (count >= 0 && atoms.length < count)
    fail(`The XYZ file says ${count} atoms but has ${atoms.length}.`);
  const base = String(fileName).replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, ""); // prettier-ignore
  const m = smallModel("xyz", comment.slice(0, 80) || base, atoms, [], { bondSource: "distance" });
  const pairs = bondsByDistance(m);
  m.bonds = new Uint32Array(pairs.length * 2);
  m.order = new Uint8Array(pairs.length).fill(1);
  pairs.forEach(([i, j], q) => {
    m.bonds[2 * q] = i;
    m.bonds[2 * q + 1] = j;
  });
  if (lines.slice(k + 2 + Math.max(0, count)).some((l) => /^\s*\d+\s*$/.test(l)))
    m.notes.push("The file has several frames; the first is shown.");
  return m;
}

// ---- Reading any of them ---------------------------------------------------------------------

const FORMATS = {
  pdb: "pdb",
  ent: "pdb",
  cif: "mmcif",
  mmcif: "mmcif",
  mol: "sdf",
  sdf: "sdf",
  sd: "sdf",
  mdl: "sdf",
  xyz: "xyz",
};

// Which reader a file needs, from its name or else from its text.
export function sniffFormat(text, fileName = "") {
  const ext = (/\.([a-z0-9]+)$/i.exec(String(fileName))?.[1] ?? "").toLowerCase();
  if (FORMATS[ext]) return FORMATS[ext];
  const src = String(text).slice(0, 200000);
  if (/^data_/m.test(src) && src.includes("_atom_site.")) return "mmcif";
  if (/^(ATOM  |HETATM)/m.test(src)) return "pdb";
  if (/V[23]000/.test(src) || /^M {2}END/m.test(src)) return "sdf";
  if (/^\s*\d+\s*$/.test(src.split(/\r?\n/).find((l) => l.trim()) ?? "")) return "xyz";
  return "";
}

export function readStructure(text, fileName = "") {
  const src = String(text ?? "");
  if (!src.trim()) fail("That file is empty.");
  const format = sniffFormat(src, fileName);
  if (!format)
    fail("Could not tell what kind of file this is. The viewer opens .pdb, .cif (mmCIF), .sdf, .mol and .xyz files."); // prettier-ignore
  if (format === "mmcif" && !src.includes("_atom_site."))
    fail("This CIF file has no _atom_site table. A small-molecule crystal CIF opens in the Thermal ellipsoids toy."); // prettier-ignore
  const m =
    format === "pdb"
      ? parsePdb(src)
      : format === "mmcif"
        ? parseMmcif(src)
        : format === "sdf"
          ? parseSdf(src, fileName)
          : parseXyz(src, fileName);
  const base = String(fileName).replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, ""); // prettier-ignore
  if (!m.title) m.title = m.id || base || "Your structure";
  return m;
}

// Exported for the tests: the CIF tokenizer this reader shares.
export { eachCifToken };
