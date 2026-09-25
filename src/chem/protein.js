// Proteins from PDB and mmCIF files, for the cartoon-ribbon toy.
//
// parseStructure(text, fileName) returns
//
//   {
//     title, id,
//     chains: [{ id, residues: [{ name, seq, icode, atoms: [{ name, el, p }], ss }] }],
//     ligands: [{ name, chain, seq, atoms: [{ name, el, p }], bonds: [[i, j, order]] }],
//   }
//
// Only the first model and the first alternate location are kept, and water
// is dropped. `ss` is "H" (helix), "E" (strand) or "C" (coil), taken from the
// file's HELIX/SHEET records (or mmCIF _struct_conf/_struct_sheet_range) and
// otherwise worked out from backbone hydrogen bonds (a simplified DSSP).
// DNA and RNA are skipped for now.
//
// ribbonPath(chain) gives a smooth backbone through the CA atoms for drawing a
// cartoon, and centreStructure(structure) moves everything onto the
// protein's centre.

import { readPdbAtom, perceiveBonds, guessBondOrders } from "./molfile.js";
import { element, normalSymbol } from "./elements.js";

export const MAX_STRUCTURE_ATOMS = 20000;

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

const fail = (message) => {
  throw new Error(message);
};

// ---- Collecting atoms into residues -----------------------------------------

// Gathers atoms (from either format) into residues, keeping the first
// alternate location and counting against the size limit.
function residueCollector() {
  const byKey = new Map();
  const list = [];
  let count = 0;
  const add = (a) => {
    if (WATER.has(a.resName)) return;
    const key = `${a.chain}\u0000${a.seq}\u0000${a.icode}`;
    let res = byKey.get(key);
    if (!res) {
      res = {
        chain: a.chain,
        name: a.resName,
        seq: a.seq,
        icode: a.icode,
        het: a.het,
        atoms: [],
        alt: "",
        names: new Set(),
        serials: [],
      };
      byKey.set(key, res);
      list.push(res);
    }
    // A second residue type at the same place is an alternate; skip it.
    if (res.name !== a.resName) return;
    if (a.alt) {
      if (!res.alt) res.alt = a.alt;
      if (a.alt !== res.alt) return;
    }
    if (res.names.has(a.name)) return;
    if (++count > MAX_STRUCTURE_ATOMS)
      fail(
        `That structure has more than ${MAX_STRUCTURE_ATOMS.toLocaleString("en")} atoms, ` +
          "too many for the protein toy. Try a smaller protein or a single chain.",
      );
    res.names.add(a.name);
    res.serials.push(a.serial);
    res.atoms.push({ name: a.name, el: a.el, p: a.p });
  };
  return { add, list };
}

const isNucleic = (res) =>
  NUCLEIC.has(res.name) || (res.names.has("P") && res.names.has("C1'") && !res.names.has("CA"));
const isAmino = (res) =>
  !isNucleic(res) &&
  (AMINO.has(res.name) || (res.names.has("N") && res.names.has("CA") && res.names.has("C")));

// Splits residues into protein chains and ligands. `conect` maps an atom
// serial number to bonded serials with repeat counts (PDB only).
function assemble(list, conect) {
  const chains = [];
  const byId = new Map();
  const ligands = [];
  let nucleic = false;
  for (const res of list) {
    if (isAmino(res)) {
      let chain = byId.get(res.chain);
      if (!chain) {
        chain = { id: res.chain, residues: [] };
        byId.set(res.chain, chain);
        chains.push(chain);
      }
      const { name, seq, icode, atoms } = res;
      chain.residues.push({ name, seq, icode, atoms, ss: "C" });
    } else if (isNucleic(res)) nucleic = true;
    else ligands.push(ligandOf(res, conect));
  }
  return { chains, ligands, nucleic };
}

function ligandOf(res, conect) {
  const index = new Map(res.serials.map((s, i) => [s, i]));
  let bonds = [];
  if (conect?.size) {
    const seen = new Map();
    res.serials.forEach((s, i) => {
      for (const [other, times] of conect.get(s) ?? []) {
        const j = index.get(other);
        if (j === undefined || j === i) continue;
        const key = Math.min(i, j) * 1e5 + Math.max(i, j);
        seen.set(key, Math.max(seen.get(key) ?? 0, times));
      }
    });
    bonds = [...seen].map(([key, times]) => [Math.floor(key / 1e5), key % 1e5, Math.min(3, times)]);
  }
  if (!bonds.length && res.atoms.length > 1) bonds = perceiveBonds(res.atoms);
  if (bonds.every((b) => b[2] === 1)) guessBondOrders(res.atoms, bonds);
  return { name: res.name, chain: res.chain, seq: res.seq, atoms: res.atoms, bonds };
}

// Marks residues inside secondary-structure ranges from the file. Each range
// is { ss, chain, from: [seq, icode], to: [seq, icode] }.
function applyRanges(chains, ranges) {
  for (const chain of chains) chain.residues.forEach((r) => (r.ss = "C"));
  const byId = new Map(chains.map((c) => [c.id, c]));
  // Strands first, so a helix record wins where the two overlap.
  const sorted = [...ranges.filter((r) => r.ss === "E"), ...ranges.filter((r) => r.ss !== "E")];
  for (const { ss, chain, from, to } of sorted) {
    const residues = byId.get(chain)?.residues;
    if (!residues) continue;
    const find = ([seq, icode], last) => {
      const exact = residues.findIndex((r) => r.seq === seq && r.icode === icode);
      if (exact >= 0) return exact;
      // No exact match: the nearest residue inside the range.
      if (last) {
        for (let i = residues.length - 1; i >= 0; i--) if (residues[i].seq <= seq) return i;
        return -1;
      }
      return residues.findIndex((r) => r.seq >= seq);
    };
    const a = find(from, false);
    const b = find(to, true);
    if (a < 0 || b < a) continue;
    for (let i = a; i <= b; i++) residues[i].ss = ss;
  }
}

// ---- PDB ---------------------------------------------------------------------

function parsePdb(text) {
  const lines = String(text).split(/\r?\n/);
  const collector = residueCollector();
  const conect = new Map();
  const ranges = [];
  const title = [];
  let id = "";
  let header = "";
  for (const line of lines) {
    const rec = line.slice(0, 6);
    if (rec === "ENDMDL") break;
    if (rec === "HEADER") {
      id = line.slice(62, 66).trim();
      header = line.slice(10, 50).trim();
    } else if (rec === "TITLE ") title.push(line.slice(10, 80).trim());
    else if (rec === "HELIX ") {
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
    } else if (rec === "ATOM  " || rec === "HETATM") {
      const a = readPdbAtom(line);
      if (!a.p.every(Number.isFinite) || !Number.isFinite(a.seq)) continue;
      collector.add(a);
    } else if (rec === "CONECT") {
      const serials = [];
      for (let c = 6; c < line.length; c += 5) {
        const v = parseInt(line.slice(c, c + 5), 10);
        if (Number.isFinite(v)) serials.push(v);
      }
      const [from, ...to] = serials;
      if (!conect.has(from)) conect.set(from, new Map());
      const m = conect.get(from);
      for (const s of to) m.set(s, (m.get(s) ?? 0) + 1);
    }
  }
  return {
    id,
    title: title.join(" ").replace(/\s+/g, " ").trim() || header,
    list: collector.list,
    conect,
    ranges: ranges.filter((r) => Number.isFinite(r.from[0]) && Number.isFinite(r.to[0])),
  };
}

// ---- mmCIF -------------------------------------------------------------------

// Calls token(value, quoted) for each token of CIF text: bare words, quoted
// strings and ;-delimited text fields. Reads line by line without splitting
// the whole file, and stops early when token() returns false, so a huge
// file costs little once the reader has what it needs.
function eachCifToken(text, token) {
  const src = String(text);
  let field = null; // lines of a ;-delimited text field being read
  for (let start = 0; start < src.length; ) {
    let end = src.indexOf("\n", start);
    if (end < 0) end = src.length;
    const line = src.slice(start, src[end - 1] === "\r" ? end - 1 : end);
    start = end + 1;
    if (field) {
      if (line[0] !== ";") {
        field.push(line);
        continue;
      }
      if (token(field.join("\n").trim(), true) === false) return;
      field = null;
      continue;
    }
    if (line[0] === ";") {
      field = [line.slice(1)];
      continue;
    }
    const n = line.length;
    for (let k = 0; k < n; ) {
      const c = line[k];
      if (c === " " || c === "\t") {
        k++;
        continue;
      }
      if (c === "#") break;
      let value;
      let quoted = false;
      if (c === "'" || c === '"') {
        // A quote ends only where it is followed by a space or the line end.
        let e = k + 1;
        while (e < n && !(line[e] === c && (e + 1 === n || line[e + 1] === " " || line[e + 1] === "\t"))) e++; // prettier-ignore
        value = line.slice(k + 1, e);
        quoted = true;
        k = e + 1;
      } else {
        let e = k;
        while (e < n && line[e] !== " " && line[e] !== "\t") e++;
        value = line.slice(k, e);
        k = e;
      }
      if (token(value, quoted) === false) return;
    }
  }
  if (field) token(field.join("\n").trim(), true);
}

// "?" and "." stand for unknown or missing values.
const unknown = (v) => (v === "?" || v === "." ? "" : v);

// Reads the first data block of CIF text into categories: a Map from
// "_category" to { fields, values }, with the values of each row laid out
// one after another. Loops named in `stream` are not stored: each row goes
// to stream[category](row, fields) instead, which may return false to stop
// reading altogether.
export function readCif(text, { stream = {} } = {}) {
  const categories = new Map();
  let id = "";
  let blocks = 0;
  let state = "top"; // "top", "pair" (tag read, value next), "fields" or "values" of a loop
  let pair = null;
  let fields = [];
  let values = null;
  let row = [];
  let sink = null;
  const startValues = () => {
    const cat = fields[0].split(".")[0].toLowerCase();
    const names = fields.map((f) => (f.split(".")[1] ?? "").toLowerCase());
    sink = stream[cat] ? (r) => stream[cat](r, names) : null;
    values = [];
    row = [];
    if (!sink) categories.set(cat, { fields: names, values });
    state = "values";
  };
  eachCifToken(text, (t, quoted) => {
    const keyword = !quoted && (t[0] === "_" || /^(loop_|data_|save_|global_)/i.test(t));
    if (state === "pair") {
      state = "top";
      pair.values.push(keyword ? "" : quoted ? t : unknown(t));
      if (!keyword) return true;
    }
    if (state === "fields") {
      if (keyword && t[0] === "_") {
        fields.push(t);
        return true;
      }
      if (fields.length) startValues();
      else state = "top";
    }
    if (state === "values") {
      if (!keyword) {
        const v = quoted ? t : unknown(t);
        if (!sink) {
          values.push(v);
          return true;
        }
        row.push(v);
        if (row.length < fields.length) return true;
        const go = sink(row);
        row = [];
        return go;
      }
      state = "top";
    }
    if (keyword && /^data_/i.test(t)) {
      if (blocks++) return false;
      id = t.slice(5);
    } else if (keyword && t.toLowerCase() === "loop_") {
      state = "fields";
      fields = [];
    } else if (keyword && t[0] === "_") {
      const [cat, field = ""] = t.toLowerCase().split(".");
      if (!categories.has(cat)) categories.set(cat, { fields: [], values: [] });
      pair = categories.get(cat);
      pair.fields.push(field);
      state = "pair";
    }
    return true;
  });
  if (state === "pair") pair.values.push("");
  if (state === "fields" && fields.length) startValues();
  return { id, categories };
}

// Row accessor for a CIF category: get(row, "field", "fallback field") -> string.
function rows(category) {
  if (!category) return { count: 0, has: () => false, get: () => "" };
  const nf = category.fields.length;
  const col = new Map(category.fields.map((f, i) => [f, i]));
  return {
    count: nf ? Math.floor(category.values.length / nf) : 0,
    has: (f) => col.has(f),
    get: (r, ...names) => {
      for (const f of names) {
        const c = col.get(f);
        const v = c === undefined ? "" : category.values[r * nf + c];
        if (v !== "") return v;
      }
      return "";
    },
  };
}

function parseMmcif(text) {
  const collector = residueCollector();
  let model = null;
  let auth = false;
  let atoms = 0;
  let columns = null;
  let columnsFor = null;
  // Atom rows go straight to the collector, which stops at the size limit;
  // reading stops at the end of the first model.
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
    atoms++;
    const m = get("pdbx_pdb_model_num");
    if (model === null) model = m;
    if (m !== model) return false;
    const name = get("auth_atom_id", "label_atom_id");
    const typed = normalSymbol(get("type_symbol"));
    const xyz = [get("cartn_x"), get("cartn_y"), get("cartn_z")];
    const p = xyz.map(Number);
    const seq = parseInt(get("auth_seq_id", "label_seq_id"), 10);
    if (xyz.includes("") || !p.every(Number.isFinite)) return true;
    collector.add({
      het: get("group_pdb") === "HETATM",
      serial: parseInt(get("id"), 10),
      name,
      alt: get("label_alt_id"),
      resName: get("auth_comp_id", "label_comp_id"),
      chain: get("auth_asym_id", "label_asym_id"),
      seq: Number.isFinite(seq) ? seq : 0,
      icode: get("pdbx_pdb_ins_code"),
      p,
      el: element(typed) ? typed : normalSymbol(name.replace(/[^A-Za-z]/g, "").slice(0, 1)),
    });
    return true;
  };
  const { id, categories } = readCif(text, { stream: { _atom_site: atomSite } });
  if (!atoms) fail("The mmCIF file has no atoms (_atom_site table).");
  // Secondary structure, numbered the same way as the atoms.
  const fields = (end, what) => [...(auth ? [`${end}_auth_${what}`] : []), `${end}_label_${what}`];
  const side = (t, r, end) => [
    parseInt(t.get(r, ...fields(end, "seq_id")), 10),
    t.get(r, `pdbx_${end}_pdb_ins_code`),
  ];
  const range = (t, r, ss) => ({
    ss,
    chain: t.get(r, ...fields("beg", "asym_id")),
    from: side(t, r, "beg"),
    to: side(t, r, "end"),
  });
  const ranges = [];
  const conf = rows(categories.get("_struct_conf"));
  for (let r = 0; r < conf.count; r++)
    if (/^HELX/i.test(conf.get(r, "conf_type_id"))) ranges.push(range(conf, r, "H"));
  const sheet = rows(categories.get("_struct_sheet_range"));
  for (let r = 0; r < sheet.count; r++) ranges.push(range(sheet, r, "E"));
  const title = rows(categories.get("_struct")).get(0, "title");
  return {
    id,
    title: title.replace(/\s+/g, " ").trim(),
    list: collector.list,
    conect: null,
    ranges: ranges.filter((x) => Number.isFinite(x.from[0]) && Number.isFinite(x.to[0])),
  };
}

// ---- Reading a structure -------------------------------------------------------------

// Reads a PDB or mmCIF file (see the top of this file for the result).
export function parseStructure(text, fileName = "") {
  const src = String(text ?? "");
  const file = String(fileName ?? "");
  if (!src.trim()) fail("That file is empty.");
  const ext = (/\.([a-z0-9]+)$/i.exec(file)?.[1] ?? "").toLowerCase();
  let cif = ext === "cif" || ext === "mmcif";
  if (!cif && ext !== "pdb" && ext !== "ent") {
    if (/^data_/m.test(src) && src.includes("_atom_site.")) cif = true;
    else if (!/^(ATOM  |HETATM)/m.test(src)) fail("This does not look like a PDB or mmCIF file.");
  }
  const raw = cif ? parseMmcif(src) : parsePdb(src);
  if (!raw.list.length) fail("No atoms found in this file.");
  const { chains, ligands, nucleic } = assemble(raw.list, raw.conect);
  if (!chains.length)
    fail(
      nucleic
        ? "This file only has DNA or RNA; the protein toy draws protein chains."
        : "No protein chains in this file.",
    );
  if (raw.ranges.length) applyRanges(chains, raw.ranges);
  else assignSecondaryStructure(chains);
  const base = file.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  return { title: raw.title || raw.id || base, id: raw.id || base, chains, ligands };
}

// ---- Secondary structure from hydrogen bonds (simplified DSSP) ------------------

const atomOf = (res, name) => res.atoms.find((a) => a.name === name)?.p ?? null;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Works out helices and strands from backbone N–H···O=C hydrogen bonds, as
// DSSP does (Kabsch & Sander 1983), and writes ss on every residue. The
// amide H is placed 1 Å from N, opposite the previous C=O. Helices come from
// two i→i+4 turns in a row (i→i+3 and i→i+5 turns give 3₁₀ and π helices,
// also drawn as helix); strands from ladders of bridge partners.
export function assignSecondaryStructure(chains) {
  const all = [];
  for (const chain of chains) chain.residues.forEach((r) => all.push({ r, chain }));
  const n = all.length;
  const N = all.map(({ r }) => atomOf(r, "N"));
  const CA = all.map(({ r }) => atomOf(r, "CA"));
  const C = all.map(({ r }) => atomOf(r, "C"));
  const O = all.map(({ r }) => atomOf(r, "O") ?? atomOf(r, "OT1"));
  // linked[k]: residue k follows k-1 in the same chain with a peptide bond.
  const linked = all.map(({ chain }, k) => {
    if (k === 0 || all[k - 1].chain !== chain || !C[k - 1] || !N[k]) return false;
    return d3(C[k - 1], N[k]) < 2.5;
  });
  // breaks[k] counts gaps up to k, so a stretch i..j is unbroken when equal.
  const breaks = new Int32Array(n);
  for (let k = 1; k < n; k++) breaks[k] = breaks[k - 1] + (linked[k] ? 0 : 1);
  const unbroken = (i, j) => i >= 0 && j < n && breaks[i] === breaks[j];
  const H = all.map(({ r }, k) => {
    if (!linked[k] || r.name === "PRO" || !O[k - 1]) return null;
    const co = [0, 1, 2].map((c) => C[k - 1][c] - O[k - 1][c]);
    const l = Math.hypot(...co);
    return [0, 1, 2].map((c) => N[k][c] + co[c] / l);
  });

  // hbond(a, d): C=O of residue a accepts from N-H of residue d.
  const bonds = new Set();
  const hbond = (a, d) => a >= 0 && d >= 0 && a < n && d < n && bonds.has(a * n + d);
  for (let d = 0; d < n; d++) {
    if (!H[d] || !CA[d]) continue;
    for (let a = 0; a < n; a++) {
      if (a === d || a === d - 1 || !C[a] || !O[a] || !CA[a]) continue;
      const dx = CA[a][0] - CA[d][0];
      const dy = CA[a][1] - CA[d][1];
      const dz = CA[a][2] - CA[d][2];
      if (dx * dx + dy * dy + dz * dz > 81) continue;
      const rON = d3(O[a], N[d]);
      const rCH = d3(C[a], H[d]);
      const rOH = d3(O[a], H[d]);
      const rCN = d3(C[a], N[d]);
      const e =
        Math.min(rON, rCH, rOH, rCN) < 0.5
          ? -9.9
          : 0.084 * 332 * (1 / rON + 1 / rCH - 1 / rOH - 1 / rCN);
      if (e < -0.5) bonds.add(a * n + d);
    }
  }

  const ss = new Array(n).fill("C");
  const turn = (k, span) => unbroken(k, k + span) && hbond(k, k + span);
  // Helices: α first, then 3₁₀ and π where nothing else is.
  const helix = new Uint8Array(n);
  for (let k = 1; k + 4 < n; k++)
    if (turn(k - 1, 4) && turn(k, 4)) for (let j = k; j < k + 4; j++) helix[j] = 1;
  const other = new Uint8Array(n);
  for (const span of [3, 5])
    for (let k = 1; k + span < n; k++)
      if (turn(k - 1, span) && turn(k, span)) for (let j = k; j < k + span; j++) other[j] = 1;

  // Bridges between residues i < j.
  const bridges = [];
  for (let i = 1; i < n - 1; i++) {
    if (!CA[i] || !unbroken(i - 1, i + 1)) continue;
    for (let j = i + 3; j < n - 1; j++) {
      if (!CA[j] || !unbroken(j - 1, j + 1)) continue;
      const dx = CA[i][0] - CA[j][0];
      const dy = CA[i][1] - CA[j][1];
      const dz = CA[i][2] - CA[j][2];
      if (dx * dx + dy * dy + dz * dz > 49) continue;
      if ((hbond(i - 1, j) && hbond(j, i + 1)) || (hbond(j - 1, i) && hbond(i, j + 1)))
        bridges.push({ i, j, anti: false });
      else if ((hbond(i, j) && hbond(j, i)) || (hbond(i - 1, j + 1) && hbond(j - 1, i + 1)))
        bridges.push({ i, j, anti: true });
    }
  }
  // Ladders: two bridges of the same kind a step apart (with a bulge of up
  // to one residue on one side and four on the other) make a strand.
  const strand = new Uint8Array(n);
  for (const b1 of bridges)
    for (const b2 of bridges) {
      if (b1.anti !== b2.anti) continue;
      const di = b2.i - b1.i;
      const dj = b1.anti ? b1.j - b2.j : b2.j - b1.j;
      if (di < 1 || dj < 1 || !((di <= 2 && dj <= 5) || (di <= 5 && dj <= 2))) continue;
      for (let k = b1.i; k <= b2.i; k++) strand[k] = 1;
      for (let k = Math.min(b1.j, b2.j); k <= Math.max(b1.j, b2.j); k++) strand[k] = 1;
    }
  for (let k = 0; k < n; k++) ss[k] = helix[k] ? "H" : strand[k] ? "E" : other[k] ? "H" : "C";
  all.forEach(({ r }, k) => (r.ss = ss[k]));
  return chains;
}

// ---- Cartoon path -----------------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : null;
};
// The part of `v` at right angles to unit vector `t`, made unit length.
const across = (v, t) =>
  unit(
    sub(
      v,
      t.map((x) => x * dot(v, t)),
    ),
  );
const anyAcross = (t) => across(Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], t);

// A smooth backbone through the CA atoms of a chain (a Catmull-Rom spline),
// `perResidue` points per residue step. Each point is
//
//   { p, t, side, normal, ss, res, seg }
//
// with `t` the unit tangent, `side` a unit vector across the ribbon that
// follows the peptide plane (from the C=O direction, flipped so it never
// jumps), `normal` = t × side, `ss` and `res` (index into chain.residues) of
// the residue the point belongs to. `seg` goes up by one at each chain break
// (CA to CA over 4.3 Å); start a new ribbon there.
export function ribbonPath(chain, { perResidue = 8 } = {}) {
  const steps = Math.max(1, Math.round(perResidue));
  const guide = [];
  chain.residues.forEach((r, index) => {
    const ca = atomOf(r, "CA");
    if (ca) guide.push({ index, ca, c: atomOf(r, "C"), o: atomOf(r, "O") ?? atomOf(r, "OT1") });
  });
  const segments = [];
  guide.forEach((g, k) => {
    if (k === 0 || d3(guide[k - 1].ca, g.ca) > 4.3) segments.push([]);
    segments[segments.length - 1].push(g);
  });
  const out = [];
  segments.forEach((seg, segIndex) => {
    const m = seg.length;
    const P = seg.map((g) => g.ca);
    const pt = (k) =>
      k < 0
        ? m > 1
          ? sub(P[0], sub(P[1], P[0]))
          : P[0]
        : k >= m
          ? m > 1
            ? sub(P[m - 1], sub(P[m - 2], P[m - 1]))
            : P[m - 1]
          : P[k];
    // A side vector for each residue, kept from flipping.
    const sides = [];
    seg.forEach((g, k) => {
      const t = unit(sub(pt(k + 1), pt(k - 1))) ?? [1, 0, 0];
      const bend = sub(sub(P[k], pt(k - 1)), sub(pt(k + 1), P[k]));
      let s = (g.c && g.o && across(sub(g.o, g.c), t)) || across(bend, t) || anyAcross(t);
      if (k && dot(s, sides[k - 1]) < 0) s = s.map((x) => -x);
      sides.push(s);
    });
    const push = (k, u, prev) => {
      const [p0, p1, p2, p3] = [pt(k - 1), P[k], pt(Math.min(k + 1, m - 1)), pt(k + 2)];
      const p = [0, 1, 2].map((c) => {
        const a = 2 * p1[c];
        const b = p2[c] - p0[c];
        const q = 2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c];
        const e = -p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c];
        return 0.5 * (a + b * u + q * u * u + e * u * u * u);
      });
      const dp = [0, 1, 2].map((c) => {
        const b = p2[c] - p0[c];
        const q = 2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c];
        const e = -p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c];
        return 0.5 * (b + 2 * q * u + 3 * e * u * u);
      });
      const t = unit(dp) ?? prev?.t ?? [1, 0, 0];
      const k2 = Math.min(k + 1, m - 1);
      const mix = [0, 1, 2].map((c) => sides[k][c] * (1 - u) + sides[k2][c] * u);
      let side = across(mix, t) ?? (prev && across(prev.side, t)) ?? anyAcross(t);
      if (prev && dot(side, prev.side) < 0) side = side.map((x) => -x);
      const index = seg[u < 0.5 ? k : k2].index;
      const point = {
        p,
        t,
        side,
        normal: unit(cross(t, side)),
        ss: chain.residues[index].ss,
        res: index,
        seg: segIndex,
      };
      out.push(point);
      return point;
    };
    let prev = null;
    if (m === 1) prev = push(0, 0, null);
    for (let k = 0; k + 1 < m; k++) for (let s = 0; s < steps; s++) prev = push(k, s / steps, prev);
    if (m > 1) push(m - 2, 1, prev);
  });
  return out;
}

// Moves every atom (chains and ligands) so the protein's centre (the mean of
// its atoms) sits on the origin. Changes the structure in place, records the
// offset as `centre`, and returns the structure.
export function centreStructure(structure) {
  const protein = structure.chains.flatMap((c) => c.residues.flatMap((r) => r.atoms));
  const pool = protein.length ? protein : structure.ligands.flatMap((l) => l.atoms);
  if (!pool.length) return structure;
  const centre = [0, 1, 2].map((k) => pool.reduce((s, a) => s + a.p[k], 0) / pool.length);
  const move = (a) => (a.p = [a.p[0] - centre[0], a.p[1] - centre[1], a.p[2] - centre[2]]);
  structure.chains.forEach((c) => c.residues.forEach((r) => r.atoms.forEach(move)));
  structure.ligands.forEach((l) => l.atoms.forEach(move));
  structure.centre = centre;
  return structure;
}
