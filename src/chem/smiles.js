// SMILES reader. SMILES is the one-line text form of a molecule that
// chemists paste around, e.g. "CCO" for ethanol or "c1ccccc1" for benzene.
//
// parseSmiles(text) returns a molecule graph:
//
//   {
//     atoms: [{ el, charge, isotope, aromatic, h, implicitH }],
//     bonds: [[i, j, order]],
//   }
//
// `h` is the number of hydrogens on the atom that are not atoms of their
// own. `implicitH` says whether that count was worked out from the normal
// valence (plain atoms like C) or written in brackets (like [NH4+]).
// Aromatic rings are kekulized: their bonds come back as alternating 1 and 2,
// while the atoms keep `aromatic: true`. withHydrogens(graph) turns the
// hydrogen counts into real H atoms, appended after the other atoms.
//
// Stereo marks (@, @@, / and \) are read and ignored. Errors are thrown as
// short, friendly messages meant to be shown to the person who typed them.

import { element } from "./elements.js";

export const MAX_HEAVY_ATOMS = 400;

// Normal valences of the atoms that may be written without brackets
// (the OpenSMILES "organic subset").
const ORGANIC = {
  B: [3],
  C: [4],
  N: [3, 5],
  O: [2],
  P: [3, 5],
  S: [2, 4, 6],
  F: [1],
  Cl: [1],
  Br: [1],
  I: [1],
};
const AROMATIC = { b: "B", c: "C", n: "N", o: "O", p: "P", s: "S", se: "Se", as: "As", te: "Te" };
const BOND_SYMBOLS = { "-": 1, "=": 2, "#": 3, $: 4, ":": 1.5, "/": 1, "\\": 1 };

// Order 1.5 marks an aromatic bond until the ring is kekulized.
const AROMATIC_BOND = 1.5;

// Valences an element can have with a given charge. A charge makes an atom
// behave like its neighbour in the periodic table: N+ bonds like C (4),
// O- like F (1), C+ and C- both make 3 bonds, B- makes 4.
export function valencesFor(el, charge = 0) {
  const e = element(el);
  const base = ORGANIC[el] ?? e?.valences ?? [];
  if (!charge) return base;
  const ve = e?.ve;
  if (ve == null) return base;
  const shift = ve >= 5 ? charge : ve === 4 ? -Math.abs(charge) : -charge;
  return [...new Set(base.map((v) => v + shift).filter((v) => v >= 0))];
}

const fail = (message) => {
  throw new Error(message);
};

// ---- Reading the text -------------------------------------------------------

// Reads one bracket atom such as "13CH3", "NH4+", "Fe+2", "nH" or "C@@H".
function readBracket(body) {
  let k = 0;
  const at = () => body[k] ?? "";
  const bad = () => fail(`Could not read the bracket atom [${body}].`);
  let isotope = 0;
  while (/\d/.test(at())) isotope = isotope * 10 + Number(body[k++]);
  let el;
  let aromatic = false;
  if (/[A-Z]/.test(at())) {
    const two = body.slice(k, k + 2);
    if (/^[A-Z][a-z]$/.test(two) && element(two)) {
      el = two;
      k += 2;
    } else {
      el = body[k++];
      if (/[a-z]/.test(at())) fail(`Unknown element "${el + at()}" in [${body}].`);
    }
    if (!element(el)) fail(`Unknown element "${el}" in [${body}].`);
  } else if (/[a-z]/.test(at())) {
    const two = body.slice(k, k + 2);
    const sym = AROMATIC[two] ? two : body[k];
    if (!AROMATIC[sym]) fail(`"${sym}" in [${body}] is not an aromatic atom.`);
    el = AROMATIC[sym];
    aromatic = true;
    k += sym.length;
  } else if (at() === "*") {
    fail("The * wildcard atom is not supported. Use a real element.");
  } else bad();
  // Chirality: @, @@, @TH1, @SP2, @OH12 ... read and ignored.
  if (at() === "@") {
    k++;
    if (at() === "@") k++;
    else {
      const m = /^(TH|AL|SP|TB|OH)\d+/.exec(body.slice(k));
      if (m) k += m[0].length;
    }
  }
  let h = 0;
  if (at() === "H") {
    k++;
    h = 1;
    if (/\d/.test(at())) {
      h = 0;
      while (/\d/.test(at())) h = h * 10 + Number(body[k++]);
    }
  }
  let charge = 0;
  if (at() === "+" || at() === "-") {
    const sign = at() === "+" ? 1 : -1;
    k++;
    if (/\d/.test(at())) {
      let n = 0;
      while (/\d/.test(at())) n = n * 10 + Number(body[k++]);
      charge = sign * n;
    } else {
      charge = sign;
      while (at() === (sign > 0 ? "+" : "-")) {
        charge += sign;
        k++;
      }
    }
  }
  if (at() === ":") {
    k++;
    if (!/\d/.test(at())) bad();
    while (/\d/.test(at())) k++;
  }
  if (k !== body.length) bad();
  return { el, charge, isotope, aromatic, h, implicitH: false };
}

// Reads a plain atom (no brackets) at position i. Returns [atom, length].
function readPlainAtom(s, i) {
  const two = s.slice(i, i + 2);
  if (two === "Cl" || two === "Br") return [plainAtom(two, false), 2];
  const ch = s[i];
  if (ORGANIC[ch]) return [plainAtom(ch, false), 1];
  if ("bcnops".includes(ch)) return [plainAtom(AROMATIC[ch], true), 1];
  if (ch === "H") fail("Hydrogens go in brackets, e.g. [H][H] or [NH4+], or leave them out.");
  if (ch === "*") fail("The * wildcard atom is not supported. Use a real element.");
  // Elements outside the organic subset need brackets: [Na], [K], [Fe].
  const before = s.slice(i - 1, i + 1);
  const guess = /^[A-Z][a-z]$/.test(two) ? two : /^[A-Z][a-z]$/.test(before) ? before : ch;
  if (/[A-Z]/.test(guess[0]) && element(guess)) fail(`Put ${guess} in brackets, like [${guess}].`);
  return fail(`Unexpected "${ch}" at position ${i + 1}.`);
}

const plainAtom = (el, aromatic) => ({
  el,
  charge: 0,
  isotope: 0,
  aromatic,
  h: 0,
  implicitH: true,
});

// Turns SMILES text into a molecule graph (see the top of this file).
export function parseSmiles(text) {
  const s =
    String(text ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  if (!s) fail("Paste a SMILES string, e.g. CCO for ethanol.");
  if (s.includes(">")) fail("Reactions (with >) are not supported. Paste one molecule.");
  const atoms = [];
  const bonds = [];
  const bonded = new Set();
  const rings = new Map();
  const branches = [];
  let heavy = 0;
  let prev = -1;
  let pending = null;
  let i = 0;

  const join = (a, b, order) => {
    if (a === b) fail("A ring bond joins an atom to itself.");
    const key = a < b ? a * 65536 + b : b * 65536 + a;
    if (bonded.has(key)) fail("Two atoms are joined twice. Check the ring numbers.");
    bonded.add(key);
    bonds.push([a, b, order ?? defaultOrder(a, b)]);
  };
  const defaultOrder = (a, b) => (atoms[a].aromatic && atoms[b].aromatic ? AROMATIC_BOND : 1);

  while (i < s.length) {
    const ch = s[i];
    if (ch === "(") {
      if (prev < 0) fail("A branch '(' needs an atom before it.");
      if (pending !== null) fail(`A bond symbol cannot come just before '(' (position ${i + 1}).`);
      branches.push(prev);
      i++;
    } else if (ch === ")") {
      if (!branches.length) fail(`There is a ')' without a matching '(' (position ${i + 1}).`);
      if (pending !== null) fail(`A bond symbol needs an atom after it (position ${i}).`);
      prev = branches.pop();
      i++;
    } else if (ch === ".") {
      if (pending !== null) fail(`A bond symbol needs an atom after it (position ${i}).`);
      prev = -1;
      i++;
    } else if (BOND_SYMBOLS[ch] !== undefined) {
      if (prev < 0) fail(`A bond symbol needs an atom before it (position ${i + 1}).`);
      if (pending !== null) fail(`Two bond symbols in a row (position ${i + 1}).`);
      pending = BOND_SYMBOLS[ch];
      i++;
    } else if (/\d/.test(ch) || ch === "%") {
      let n;
      if (ch === "%") {
        const digits = s.slice(i + 1, i + 3);
        if (!/^\d\d$/.test(digits)) fail(`A '%' ring number needs two digits (position ${i + 1}).`);
        n = Number(digits);
        i += 3;
      } else {
        n = Number(ch);
        i++;
      }
      if (prev < 0) fail(`Ring number ${n} needs an atom before it.`);
      const open = rings.get(n);
      if (open) {
        if (open.order !== null && pending !== null && open.order !== pending)
          fail(`The two ends of ring bond ${n} have different bond symbols.`);
        join(open.atom, prev, pending ?? open.order);
        rings.delete(n);
      } else rings.set(n, { atom: prev, order: pending });
      pending = null;
    } else {
      let atom;
      if (ch === "[") {
        const end = s.indexOf("]", i);
        if (end < 0) fail("A '[' is never closed with ']'.");
        atom = readBracket(s.slice(i + 1, end));
        i = end + 1;
      } else {
        let len;
        [atom, len] = readPlainAtom(s, i);
        i += len;
      }
      if (atom.el !== "H" && ++heavy > MAX_HEAVY_ATOMS)
        fail(`That molecule is too big: the limit is ${MAX_HEAVY_ATOMS} atoms besides hydrogen.`);
      atoms.push(atom);
      const index = atoms.length - 1;
      if (prev >= 0) join(prev, index, pending);
      else if (pending !== null) fail("A bond symbol needs an atom on both sides.");
      pending = null;
      prev = index;
    }
  }
  if (pending !== null) fail("The SMILES ends with a bond symbol.");
  if (branches.length) fail("A branch '(' is never closed with ')'.");
  if (rings.size) fail(`Ring bond ${[...rings.keys()][0]} is opened but never closed.`);
  if (!atoms.length) fail("Paste a SMILES string, e.g. CCO for ethanol.");
  return finishGraph({ atoms, bonds });
}

// ---- Rings -------------------------------------------------------------------

export function adjacency(n, bonds) {
  const adj = Array.from({ length: n }, () => []);
  bonds.forEach(([a, b], k) => {
    adj[a].push({ to: b, bond: k });
    adj[b].push({ to: a, bond: k });
  });
  return adj;
}

// Marks the bonds that lie in a ring (every bond that is not a bridge).
export function ringBondFlags(n, bonds) {
  const adj = adjacency(n, bonds);
  const inRing = new Uint8Array(bonds.length).fill(1);
  const order = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  let time = 0;
  for (let root = 0; root < n; root++) {
    if (order[root] >= 0) continue;
    // Iterative DFS (Tarjan's bridge finding), so big molecules cannot
    // overflow the call stack.
    const stack = [[root, -1, 0]];
    order[root] = low[root] = time++;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [v, viaBond] = top;
      if (top[2] < adj[v].length) {
        const { to, bond } = adj[v][top[2]++];
        if (bond === viaBond) continue;
        if (order[to] < 0) {
          order[to] = low[to] = time++;
          stack.push([to, bond, 0]);
        } else low[v] = Math.min(low[v], order[to]);
      } else {
        stack.pop();
        if (stack.length) {
          const parent = stack[stack.length - 1][0];
          low[parent] = Math.min(low[parent], low[v]);
          if (low[v] > order[parent]) inRing[viaBond] = 0;
        }
      }
    }
  }
  return inRing;
}

// ---- Hydrogens and kekulization ---------------------------------------------

// Works out implicit hydrogens and turns aromatic bonds (order 1.5) into
// alternating single and double bonds. Atoms with `implicitH` get their `h`
// from the normal valence; the others keep the `h` they have. With
// `strict` (the default), a plain atom with too many bonds is an error.
export function finishGraph(graph, { strict = true } = {}) {
  const { atoms, bonds } = graph;
  const n = atoms.length;
  const inRing = ringBondFlags(n, bonds);
  // An aromatic bond outside any ring (as between the two rings of
  // biphenyl written c1ccccc1c1ccccc1) is a plain single bond.
  bonds.forEach((b, k) => {
    if (b[2] === AROMATIC_BOND && !inRing[k]) b[2] = 1;
  });
  const aromaticCount = new Int32Array(n);
  const bondSum = new Float64Array(n);
  for (const [a, b, order] of bonds) {
    const v = order === AROMATIC_BOND ? 1 : order;
    bondSum[a] += v;
    bondSum[b] += v;
    if (order === AROMATIC_BOND) {
      aromaticCount[a]++;
      aromaticCount[b]++;
    }
  }
  const needsDouble = new Uint8Array(n);
  atoms.forEach((atom, i) => {
    const vals = valencesFor(atom.el, atom.charge);
    const used = bondSum[i] + (atom.implicitH ? 0 : atom.h);
    const v = vals.find((x) => x >= used);
    if (atom.implicitH) {
      if (v === undefined) {
        if (strict && ORGANIC[atom.el] && !atom.charge) {
          const most = Math.max(...vals);
          fail(`A ${element(atom.el).name} atom has ${used} bonds; it can have at most ${most}.`);
        }
        atom.h = 0;
      } else atom.h = v - used;
    }
    // An aromatic atom with a free valence takes part in one ring double bond.
    if (aromaticCount[i] && v !== undefined && v > used) {
      needsDouble[i] = 1;
      if (atom.implicitH) atom.h--;
    }
  });
  kekulize(atoms, bonds, needsDouble);
  return graph;
}

// Picks which aromatic bonds become double: every atom that needs a double
// bond gets exactly one (a perfect matching). If that is impossible, a ring
// nitrogen written without its hydrogen (c1ccnc1 for pyrrole) is given one.
function kekulize(atoms, bonds, needsDouble) {
  const aromaticBonds = bonds.map((b, k) => k).filter((k) => bonds[k][2] === AROMATIC_BOND);
  if (!aromaticBonds.length && !needsDouble.some(Boolean)) return;
  const solve = () => matchDoubles(atoms.length, bonds, aromaticBonds, needsDouble);
  const unmatched = (m) => atoms.filter((a, i) => needsDouble[i] && m[i] < 0).length;
  let match = solve();
  let left = unmatched(match);
  if (left) {
    // Try ring N (or P) atoms as [nH], unmatched ones first; keep each guess
    // that leaves fewer atoms without a double bond.
    const guesses = atoms
      .map((a, i) => i)
      .filter((i) => needsDouble[i] && atoms[i].implicitH && "NP".includes(atoms[i].el));
    guesses.sort((a, b) => (match[b] < 0) - (match[a] < 0));
    for (const i of guesses) {
      if (!left) break;
      needsDouble[i] = 0;
      const tried = solve();
      const after = unmatched(tried);
      if (after < left) {
        match = tried;
        left = after;
        atoms[i].h++;
      } else needsDouble[i] = 1;
    }
  }
  if (left)
    fail(
      "Could not place the double bonds in an aromatic ring. Check the lowercase atoms: " +
        "a ring N with a hydrogen is written [nH].",
    );
  for (const k of aromaticBonds) {
    const [a, b] = bonds[k];
    bonds[k][2] = match[a] === b ? 2 : 1;
  }
}

function matchDoubles(n, bonds, aromaticBonds, needsDouble) {
  const adj = Array.from({ length: n }, () => []);
  for (const k of aromaticBonds) {
    const [a, b] = bonds[k];
    if (!needsDouble[a] || !needsDouble[b]) continue;
    adj[a].push(b);
    adj[b].push(a);
  }
  return maxMatching(adj);
}

// Maximum matching in a general graph (Edmonds' blossom algorithm). Returns
// match[v] = partner or -1. Rings of odd size need the blossom part.
export function maxMatching(adj) {
  const n = adj.length;
  const match = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n);
  const base = new Int32Array(n);
  const used = new Uint8Array(n);
  const blossom = new Uint8Array(n);
  const queue = new Int32Array(n);

  const commonBase = (a, b) => {
    const seen = new Uint8Array(n);
    for (;;) {
      a = base[a];
      seen[a] = 1;
      if (match[a] < 0) break;
      a = parent[match[a]];
    }
    for (;;) {
      b = base[b];
      if (seen[b]) return b;
      b = parent[match[b]];
    }
  };
  const markPath = (v, b, child) => {
    while (base[v] !== b) {
      blossom[base[v]] = blossom[base[match[v]]] = 1;
      parent[v] = child;
      child = match[v];
      v = parent[match[v]];
    }
  };
  const findPath = (root) => {
    used.fill(0);
    parent.fill(-1);
    for (let i = 0; i < n; i++) base[i] = i;
    used[root] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = root;
    while (head < tail) {
      const v = queue[head++];
      for (const to of adj[v]) {
        if (base[v] === base[to] || match[v] === to) continue;
        if (to === root || (match[to] >= 0 && parent[match[to]] >= 0)) {
          const cur = commonBase(v, to);
          blossom.fill(0);
          markPath(v, cur, to);
          markPath(to, cur, v);
          for (let i = 0; i < n; i++) {
            if (!blossom[base[i]]) continue;
            base[i] = cur;
            if (!used[i]) {
              used[i] = 1;
              queue[tail++] = i;
            }
          }
        } else if (parent[to] < 0) {
          parent[to] = v;
          if (match[to] < 0) return to;
          used[match[to]] = 1;
          queue[tail++] = match[to];
        }
      }
    }
    return -1;
  };

  // A quick greedy pass first (atoms with the fewest choices go first), then
  // augmenting paths fix up whatever the greedy pass missed.
  const byChoices = [...adj.keys()].sort((a, b) => adj[a].length - adj[b].length);
  for (const v of byChoices) {
    if (match[v] >= 0) continue;
    const to = adj[v].find((u) => match[u] < 0);
    if (to === undefined) continue;
    match[v] = to;
    match[to] = v;
  }
  for (let v = 0; v < n; v++) {
    if (match[v] >= 0 || !adj[v].length) continue;
    let u = findPath(v);
    while (u >= 0) {
      const pv = parent[u];
      const next = match[pv];
      match[u] = pv;
      match[pv] = u;
      u = next;
    }
  }
  return match;
}

// Returns a copy of the graph with every hydrogen count turned into real H
// atoms, appended after the existing atoms (so earlier indices stay put).
export function withHydrogens(graph) {
  const atoms = graph.atoms.map((a) => ({ ...a, h: 0 }));
  const bonds = graph.bonds.map((b) => b.slice());
  graph.atoms.forEach((a, i) => {
    for (let k = 0; k < a.h; k++) {
      atoms.push({ el: "H", charge: 0, isotope: 0, aromatic: false, h: 0, implicitH: false });
      bonds.push([i, atoms.length - 1, 1]);
    }
  });
  return { atoms, bonds };
}
