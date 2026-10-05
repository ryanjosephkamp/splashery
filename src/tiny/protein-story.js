// The DNA to protein toy's story (lane Tiny world r2), worked out from a gene
// or a typed sequence and a mutation, before anything is drawn: which bases
// are drawn, which codons the ribosome reads base by base, the protein the
// genetic code gives, and whether it folds into a known structure.

import { GENES } from "./genes.js";
import { AMINO, START, mutate, rna, translate } from "./genetic-code.js";

export const SAMPLES = ["hbb", "ins", "lyz", "gfp"];
export const LEAD = 5; // bases drawn before the start codon
export const TAIL = 4; // bases drawn after the stop codon
export const START_CODONS = 7; // codons drawn base by base from the start
export const MIDDLE = 9; // bases drawn (plain) for the codons in between
export const ALL_SHOWN = 10; // a gene this short (codons with the stop) is drawn whole

// opts: { gene, sequence, change, codon, pos, base }. gene "custom" reads the
// typed sequence (already checked by readSequence).
export function buildStory(opts) {
  const known = GENES[opts.gene] ? opts.gene : null;
  let seq;
  let at;
  if (known) {
    const g = GENES[known];
    seq = g.lead + g.cds + g.utr3;
    at = g.lead.length;
  } else {
    seq = opts.sequence || "";
    at = seq.indexOf(START);
    if (at < 0) throw new Error("There's no start codon (ATG) in this sequence.");
  }
  const original = translate(seq, at);
  // The mutation (codon 1 is the start codon, which is never changed).
  let mut = null;
  if (opts.change && opts.change !== "none") {
    const codon = Math.max(2, Math.round(opts.codon || 2));
    const pos = Math.max(1, Math.min(3, Math.round(opts.pos || 1)));
    const base = "ACGT".includes(opts.base) ? opts.base : "T";
    const index = at + (codon - 1) * 3 + (pos - 1);
    if (index < seq.length) {
      const before = seq;
      seq = mutate(seq, at, { kind: opts.change, codon, pos, base });
      mut = { kind: opts.change, codon, pos, base, index, was: before[index] };
      if (opts.change === "point" && before[index] === base) mut.same = true;
    }
  }
  const tr = translate(seq, at);
  const protein = tr.seq;
  const nonstop = tr.stop < 0;
  // Codons read, from the start codon to the stop codon (or the end).
  const nCodons = protein.length + (nonstop ? 0 : 1);
  const codons = [];
  for (let i = 0; i < nCodons; i++) codons.push(seq.slice(at + 3 * i, at + 3 * i + 3));

  // What is drawn, left to right: { base, codon (index, -1 outside the
  // reading frame), pos (0..2 in the codon), mid (a plain base standing for
  // the codons not drawn), mut }.
  const items = [];
  const nt = (i, codon = -1, pos = 0) =>
    items.push({ base: seq[i], codon, pos, at: i, mut: !!mut && mut.kind !== "delete" && i === mut.index }); // prettier-ignore
  for (let i = Math.max(0, at - LEAD); i < at; i++) nt(i);
  let shown;
  let middle = null;
  if (nCodons <= ALL_SHOWN) {
    shown = codons.map((_, i) => i);
  } else {
    // The first codons, a plain stretch for the middle, then the last
    // codon and the stop codon (or the last two codons of a non-stop mRNA).
    const tail = 2;
    shown = [];
    for (let c = 0; c < START_CODONS; c++) shown.push(c);
    middle = { from: START_CODONS, to: nCodons - tail - 1 }; // codons, inclusive
    for (let c = nCodons - tail; c < nCodons; c++) shown.push(c);
  }
  for (const c of shown) {
    if (middle && c === middle.to + 1)
      for (let j = 0; j < MIDDLE; j++) items.push({ base: null, codon: -1, mid: true, pos: j });
    for (let p = 0; p < 3; p++) nt(at + 3 * c + p, c, p);
  }
  const end = at + 3 * nCodons;
  for (let i = end; i < Math.min(seq.length, end + TAIL); i++) nt(i);

  // The fold: a known protein folds into its structure when the mutation
  // leaves its length alone (a missense or silent change).
  let fold = null;
  let why = "";
  const ref = known
    ? GENES[known]
    : SAMPLES.map((id) => GENES[id]).find((g) => g.protein === protein);
  if (ref && protein.length === ref.protein.length) {
    const changed = [];
    for (let i = 0; i < protein.length; i++) if (protein[i] !== ref.protein[i]) changed.push(i);
    const removed = new Set();
    for (const [a, b] of ref.removed || []) for (let r = a; r <= b; r++) removed.add(r - 1);
    fold = { ca: ref.ca, removed, changed, pdb: ref.pdb, label: ref.label };
  } else if (ref || known) {
    why = nonstop
      ? "no stop codon"
      : `stops after ${protein.length} amino acids instead of ${(ref || GENES[known]).protein.length}`;
  } else {
    why = "no known structure";
  }
  return {
    gene: known,
    label: known ? GENES[known].label : "Your sequence",
    seq,
    at,
    mut,
    protein,
    original: original.seq,
    nonstop,
    codons,
    items,
    shown,
    middle,
    fold,
    why,
  };
}

// The amino acid a codon gives, in words ("GAG: glutamic acid").
export function codonWords(codon) {
  const t = translate(codon);
  if (t.stop === 0) return `${rna(codon)}: stop`;
  const a = AMINO[t.seq];
  return `${rna(codon)}: ${a ? a[1] : "?"}`;
}

// One line for the toy's panel: what the gene makes, and what a mutation does.
export function storyLine(s) {
  const parts = [`${s.label}: ${s.codons.length} codons, ${s.protein.length} amino acids`];
  if (s.mut) {
    const m = s.mut;
    if (m.same) parts.push(`codon ${m.codon} already has ${m.base} there`);
    else if (m.kind === "point") {
      const was = s.original[m.codon - 1];
      const now = s.protein[m.codon - 1];
      const before = s.seq.slice(0, m.index) + m.was + s.seq.slice(m.index + 1);
      const oldCodon = before.slice(s.at + (m.codon - 1) * 3, s.at + m.codon * 3);
      const newCodon = s.seq.slice(s.at + (m.codon - 1) * 3, s.at + m.codon * 3);
      const name = (x) => (x ? AMINO[x][1] : "stop");
      const effect =
        was === now
          ? `still ${name(now)} (a silent change)`
          : `${name(was)} becomes ${name(now)}${now ? "" : " (a nonsense change)"}`;
      parts.push(`codon ${m.codon} ${rna(oldCodon)} to ${rna(newCodon)}: ${effect}`);
    } else {
      const what = m.kind === "insert" ? `an extra ${m.base}` : `a missing ${m.was}`;
      parts.push(`${what} in codon ${m.codon} shifts the reading frame`);
    }
  }
  if (s.fold) {
    const cut = s.fold.removed.size;
    parts.push(
      `folds as in PDB ${s.fold.pdb}` + (cut ? `, after ${cut} amino acid${cut > 1 ? "s are" : " is"} cut away` : ""), // prettier-ignore
    );
  } else if (s.why) parts.push(`no fold shown (${s.why})`);
  return parts.join("; ") + ".";
}
