// Condensed structural formulas, the way they are written in class:
// CH3CH2OH, CH3COOH, (CH3)2CHOH, CH3(CH2)4CH3, CH2=CHCl, HC≡CH,
// CH3CH(NH2)COOH, C2H5OH, C6H5CH3, CH2OHCHOHCH2OH.
//
// Each heavy atom takes the hydrogens and halogens written after it, and
// the atoms join in a chain in the order written. A group in brackets hangs
// off the atom before it (or the one after it, at the start), except a
// CH2-like group, which repeats in the chain: (CH2)4. In the middle of a
// chain, an O or S with nothing on it after a carbon that still needs a
// double bond is a C=O (the CO in CH3COCH3 and CH3COOH), and an OH or NH2
// hangs off the carbon before it (CH2OHCH2OH). C6H5 is a phenyl ring and
// C2H5, C3H7 and so on are straight alkyl groups. Bond orders are then
// filled in from the atoms' usual valences.
//
// condensedToSmiles(text) returns a SMILES string with every hydrogen
// written, or null when the text cannot be read this way (the caller then
// tries other readings).

import { ELEMENTS } from "./elements.js";

const HALOGENS = new Set(["F", "Cl", "Br", "I"]);
// Usual valences, smallest first; the filling pass steps up when it must
// (the S in SO3).
const VALENCES = {
  C: [4], N: [3], O: [2], S: [2, 4, 6], P: [3, 5], B: [3], Si: [4], Se: [2],
  F: [1], Cl: [1], Br: [1], I: [1],
}; // prettier-ignore
const MAX_HEAVY = 120;

class Unreadable extends Error {}
const no = () => {
  throw new Unreadable();
};

// Tokens: element symbols with counts, brackets with counts, bond marks.
function tokenize(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === "[") {
      out.push({ t: "(" });
      i++;
    } else if (ch === ")" || ch === "]") {
      const m = /^\d*/.exec(text.slice(i + 1))[0];
      out.push({ t: ")", n: m ? Number(m) : 1 });
      i += 1 + m.length;
    } else if ("=#≡-–".includes(ch)) {
      out.push({ t: "bond", order: ch === "=" ? 2 : ch === "#" || ch === "≡" ? 3 : 1 });
      i++;
    } else if (/[A-Z]/.test(ch)) {
      // Two-letter symbols (Cl, Br, Si), but only real ones.
      let sym = ch;
      if (/[a-z]/.test(text[i + 1] ?? "") && ELEMENTS[ch + text[i + 1]]) sym = ch + text[i + 1];
      if (!ELEMENTS[sym]) no();
      i += sym.length;
      const m = /^\d*/.exec(text.slice(i))[0];
      i += m.length;
      const n = m ? Number(m) : 1;
      if (n < 1 || n > MAX_HEAVY) no();
      out.push({ t: "atom", el: sym, n });
    } else no();
  }
  return out;
}

// A unit is one heavy atom (or a phenyl ring, "Ph"): its hydrogens, the
// groups on it (`subs`, each a chain), the next unit in its chain, and the
// bond order written before it (0: fill in).
const unit = (el, h = 0) => ({ el, h, subs: [], next: null, order: 0 });

function clone(u) {
  return { ...u, subs: u.subs.map(clone), next: u.next && clone(u.next) };
}
function size(u) {
  return 1 + u.subs.reduce((s, x) => s + size(x), 0) + (u.next ? size(u.next) : 0);
}

// Reads tokens from `at` up to a closing bracket (or the end) into a chain
// of units. Returns [first unit, index after it].
function readChain(toks, at, count) {
  const chain = [];
  let pendingH = 0; // H written before the first heavy atom (HCOOH, HOCH2...)
  const pendingSubs = []; // groups in brackets before the first heavy atom
  let order = 0;
  let i = at;
  const last = () => chain[chain.length - 1];
  const grow = (n) => {
    count.n += n;
    if (count.n > MAX_HEAVY) no();
  };
  const push = (u) => {
    grow(1);
    if (chain.length) {
      u.order = order;
      last().next = u;
    } else {
      u.h += pendingH;
      u.subs.push(...pendingSubs);
      pendingH = 0;
      pendingSubs.length = 0;
    }
    order = 0;
    chain.push(u);
  };
  while (i < toks.length && toks[i].t !== ")") {
    const tk = toks[i];
    const after = toks[i + 1];
    if (tk.t === "bond") {
      if (!chain.length || order) no();
      order = tk.order;
      i++;
    } else if (tk.t === "(") {
      const [head, j] = readChain(toks, i + 1, count);
      if (toks[j]?.t !== ")") no();
      const n = toks[j].n;
      i = j + 1;
      // A single CH2-like unit repeats in the chain: (CH2)4, (CF2)2.
      const lone = !head.next && head.subs.every((s) => HALOGENS.has(s.el));
      if (lone && head.el === "C" && head.h + head.subs.length === 2 && chain.length) {
        grow(-1);
        for (let r = 0; r < n; r++) push(clone(head));
        continue;
      }
      // Anything else hangs off the atom before it (after it, at the start).
      grow((n - 1) * size(head));
      const copies = [head, ...Array.from({ length: n - 1 }, () => clone(head))];
      if (chain.length) last().subs.push(...copies);
      else pendingSubs.push(...copies);
    } else if (tk.el === "H") {
      if (chain.length) last().h += tk.n;
      else pendingH += tk.n;
      i++;
    } else if (tk.el === "C" && after?.el === "H" && tk.n === 6 && after.n === 5) {
      // A phenyl ring.
      grow(5);
      push(unit("Ph"));
      i += 2;
    } else if (tk.el === "C" && tk.n > 1 && after?.el === "H" && after.n === 2 * tk.n + 1) {
      // A straight alkyl group, C2H5 or C3H7: the free end joins the chain.
      const units = Array.from({ length: tk.n }, (_, r) => unit("C", r ? 2 : 3));
      if (chain.length) units.reverse();
      units.forEach(push);
      i += 2;
    } else if (chain.length && (HALOGENS.has(tk.el) || tk.n > 1)) {
      // Halogens sit on the atom before them (CHCl3, CH2ClCH2Cl); so does
      // a counted atom (the O2 in CO2 and NO2, the O3 in SO3).
      grow(tk.n);
      for (let r = 0; r < tk.n; r++) last().subs.push(unit(tk.el));
      i++;
    } else {
      // A counted atom at the start (N2, O2) makes a chain of them.
      for (let r = 0; r < tk.n; r++) push(unit(tk.el));
      i++;
    }
  }
  if (order || pendingH) no();
  if (!chain.length) {
    // "(CH3)" alone is just its group.
    if (pendingSubs.length !== 1) no();
    return [pendingSubs[0], i];
  }
  if (pendingSubs.length) no();
  return [chain[0], i];
}

// Valence left on atom i at its first usual valence.
function freeOf(i, atoms, bonds) {
  const a = atoms[i];
  let used = a.h;
  for (const [x, y, o] of bonds) if (x === i || y === i) used += o;
  return (VALENCES[a.el]?.[0] ?? 0) - used;
}

// The heavy-atom graph: atoms { el, h, charge } and bonds [a, b, order,
// fixed].
function toGraph(first) {
  const atoms = [];
  const bonds = [];
  const place = (u, from, order) => {
    const id = atoms.length;
    atoms.push({ el: u.el, h: u.h, charge: 0 });
    if (from >= 0) bonds.push([from, id, order || 1, order > 0]);
    for (const s of u.subs) chainFrom(s, id, s.order);
    return id;
  };
  const chainFrom = (u, from, order) => {
    let prev = place(u, from, order);
    for (let n = u.next; n; n = n.next) {
      const chalc = n.el === "O" || n.el === "S";
      const plain = !n.subs.length && !n.order;
      const bare = chalc && !n.h && plain;
      const hanging = plain && ((chalc && n.h === 1) || (n.el === "N" && n.h === 2));
      if (
        n.next &&
        atoms[prev].el === "C" &&
        (hanging || (bare && freeOf(prev, atoms, bonds) >= 3))
      ) {
        place({ ...n, next: null }, prev, bare ? 2 : 1);
        continue;
      }
      prev = place(n, prev, n.order);
    }
  };
  chainFrom(first, -1, 0);
  return { atoms, bonds };
}

// A nitro group (an N with two bare O and one other bond) is written with
// charges: [N+](=O)[O-].
function markNitro(atoms, bonds) {
  atoms.forEach((a, i) => {
    if (a.el !== "N" || a.h) return;
    const mine = bonds.filter((b) => b[0] === i || b[1] === i);
    const other = (b) => (b[0] === i ? b[1] : b[0]);
    const os = mine.filter((b) => atoms[other(b)].el === "O" && !atoms[other(b)].h);
    if (os.length !== 2 || mine.length !== 3) return;
    if (bonds.some((b) => os.some((o) => b !== o && (b[0] === other(o) || b[1] === other(o)))))
      return;
    a.charge = 1;
    Object.assign(os[0], { 2: 2, 3: true });
    Object.assign(os[1], { 2: 1, 3: true });
    atoms[other(os[1])].charge = -1;
  });
}

// Fills in double and triple bonds from the atoms' valences, stepping an
// S or P up to a higher valence when it has too many bonds or its
// neighbours need more. Returns false when nothing fits.
function fillBonds(atoms, bonds) {
  const level = atoms.map(() => 0);
  const kind = (i) => (atoms[i].el === "Ph" ? "C" : atoms[i].el);
  const levels = (i) => VALENCES[kind(i)] ?? [ELEMENTS[kind(i)]?.valences?.[0] ?? 0];
  const valence = (i) => {
    const list = levels(i);
    const a = atoms[i];
    return (
      list[Math.min(level[i], list.length - 1)] + (a.el === "N" || a.el === "O" ? a.charge : 0)
    );
  };
  const stepUp = (i) => {
    if (level[i] >= levels(i).length - 1) return false;
    level[i]++;
    return true;
  };
  for (let tries = 0; tries < 12; tries++) {
    for (const b of bonds) if (!b[3]) b[2] = 1;
    const free = atoms.map((a, i) => valence(i) - (a.el === "Ph" ? 3 : a.h));
    for (const [x, y, o] of bonds) {
      free[x] -= o;
      free[y] -= o;
    }
    if (free.some((f) => f < 0)) {
      let stepped = false;
      free.forEach((f, i) => (stepped = (f < 0 && stepUp(i)) || stepped));
      if (!stepped) return false;
      continue;
    }
    // Raise bonds between atoms that both have room, most constrained
    // atom first.
    for (;;) {
      const open = (i) =>
        bonds.filter((b) => !b[3] && b[2] < 3 && (b[0] === i || b[1] === i) && free[b[0]] > 0 && free[b[1]] > 0); // prettier-ignore
      const ready = atoms.map((_, i) => i).filter((i) => free[i] > 0 && open(i).length);
      if (!ready.length) break;
      ready.sort((a, b) => open(a).length - open(b).length);
      const b = open(ready[0])[0];
      b[2]++;
      free[b[0]]--;
      free[b[1]]--;
    }
    if (free.every((f) => f === 0)) return true;
    // Room left over: step up a neighbour that can take more bonds.
    let stepped = false;
    free.forEach((f, i) => {
      if (f <= 0 || stepped) return;
      for (const [x, y] of bonds) {
        const j = x === i ? y : y === i ? x : -1;
        if (j >= 0 && stepUp(j)) {
          stepped = true;
          break;
        }
      }
    });
    if (!stepped) return false;
  }
  return false;
}

function writeSmiles(atoms, bonds) {
  const nbrs = atoms.map(() => []);
  for (const [x, y, o] of bonds) {
    nbrs[x].push([y, o]);
    nbrs[y].push([x, o]);
  }
  const mark = { 1: "", 2: "=", 3: "#" };
  const atomText = (a) => {
    if (a.el === "Ph") return "c1ccccc1";
    const h = a.h ? `H${a.h > 1 ? a.h : ""}` : "";
    const q = a.charge > 0 ? "+" : a.charge < 0 ? "-" : "";
    return `[${a.el}${h}${q}]`;
  };
  const walk = (i, from) => {
    const kids = nbrs[i].filter(([j]) => j !== from);
    let s = atomText(atoms[i]);
    kids.forEach(([j, o], k) => {
      const part = mark[o] + walk(j, i);
      s += k < kids.length - 1 ? `(${part})` : part;
    });
    return s;
  };
  return walk(0, -1);
}

export function condensedToSmiles(text) {
  const s = String(text ?? "")
    .trim()
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
    .replace(/\s+/g, "");
  if (!/^[A-Z]/.test(s) && !/^[([]/.test(s)) return null;
  try {
    const toks = tokenize(s);
    const [first, end] = readChain(toks, 0, { n: 0 });
    if (end !== toks.length) return null;
    const { atoms, bonds } = toGraph(first);
    markNitro(atoms, bonds);
    if (!fillBonds(atoms, bonds)) return null;
    return writeSmiles(atoms, bonds);
  } catch (err) {
    if (err instanceof Unreadable) return null;
    throw err;
  }
}
