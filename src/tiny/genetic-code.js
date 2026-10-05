// The standard genetic code (NCBI translation table 1) and the small steps
// from DNA to protein, for the DNA to protein toy (lane Tiny world r2).
// Sequences are written 5′ to 3′ in capital letters.

const BASES = "TCAG";
// Table 1 in its usual order: first base T, C, A, G; then the second; then the third.
const AAS = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

export const CODE = {};
for (let i = 0; i < 64; i++) CODE[BASES[i >> 4] + BASES[(i >> 2) & 3] + BASES[i & 3]] = AAS[i];

export const START = "ATG";
export const STOPS = ["TAA", "TAG", "TGA"];

// The twenty amino acids: three-letter names, names, and a kind for color
// (nonpolar, polar, acidic or basic side chain, as in most textbooks).
export const AMINO = {
  A: ["Ala", "alanine", "nonpolar"],
  R: ["Arg", "arginine", "basic"],
  N: ["Asn", "asparagine", "polar"],
  D: ["Asp", "aspartic acid", "acidic"],
  C: ["Cys", "cysteine", "polar"],
  Q: ["Gln", "glutamine", "polar"],
  E: ["Glu", "glutamic acid", "acidic"],
  G: ["Gly", "glycine", "nonpolar"],
  H: ["His", "histidine", "basic"],
  I: ["Ile", "isoleucine", "nonpolar"],
  L: ["Leu", "leucine", "nonpolar"],
  K: ["Lys", "lysine", "basic"],
  M: ["Met", "methionine", "nonpolar"],
  F: ["Phe", "phenylalanine", "nonpolar"],
  P: ["Pro", "proline", "nonpolar"],
  S: ["Ser", "serine", "polar"],
  T: ["Thr", "threonine", "polar"],
  W: ["Trp", "tryptophan", "nonpolar"],
  Y: ["Tyr", "tyrosine", "polar"],
  V: ["Val", "valine", "nonpolar"],
};

const PAIR = { A: "T", T: "A", G: "C", C: "G" };
// The DNA strand that pairs with this one, written 3′ to 5′ under it.
export const complement = (s) => s.replace(/[ACGT]/g, (b) => PAIR[b]);
export const reverseComplement = (s) => complement(s).split("").reverse().join("");
// RNA has U where DNA has T.
export const rna = (s) => s.replace(/T/g, "U");

// The anticodon of the tRNA that reads a codon, written 3′ to 5′ under it
// (each base pairs with the codon's base above it). Exact pairing; real
// cells read some codons by wobble pairing at the third base.
export const anticodon = (codon) => rna(complement(codon.replace(/U/g, "T")));

// Reads codons from `at` (default 0) in steps of three to the first stop
// codon. seq: the amino acids (one letter each) before the stop; stop: the
// stop codon's number from `at` (-1 if the sequence ends first).
export function translate(dna, at = 0) {
  let seq = "";
  for (let i = at; i + 3 <= dna.length; i += 3) {
    const aa = CODE[dna.slice(i, i + 3)];
    if (aa === "*") return { seq, stop: (i - at) / 3 };
    seq += aa ?? "X";
  }
  return { seq, stop: -1 };
}

// Reads typed DNA (or RNA): FASTA headers, spaces, line breaks and numbers
// are skipped, U is read as T. Throws an Error that names any other letter.
export function readSequence(text) {
  const body = String(text)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith(">"))
    .join("")
    .replace(/[\s\d]/g, "")
    .toUpperCase()
    .replace(/U/g, "T");
  const bad = body.match(/[^ACGT]/);
  if (bad) throw new Error(`"${bad[0]}" isn't a DNA base: use only A, C, G and T (or U).`);
  if (!body.length) throw new Error("Type a DNA sequence, such as ATGGTGCATCTGACTCCTGAGTAA.");
  return body;
}

// A mutation in a gene's sequence. kind: "point" (base `pos` of codon
// `codon` becomes `base`), "insert" (`base` goes in before it) or "delete"
// (it goes). codon and pos count from 1 (codon 1 is the start codon), and
// `at` is the index of the start codon in seq.
export function mutate(seq, at, { kind, codon, pos, base }) {
  const i = at + (codon - 1) * 3 + (pos - 1);
  if (kind === "point") return seq.slice(0, i) + base + seq.slice(i + 1);
  if (kind === "insert") return seq.slice(0, i) + base + seq.slice(i);
  if (kind === "delete") return seq.slice(0, i) + seq.slice(i + 1);
  return seq;
}
