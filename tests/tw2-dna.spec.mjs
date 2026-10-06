// Lane Tiny world r2: the DNA to protein toy's science, checked from data
// (docs/evidence/dna-to-protein.json names these tests).

import { test, expect } from "@playwright/test";
import { GENES } from "../src/tiny/genes.js";
import {
  CODE,
  AMINO,
  anticodon,
  complement,
  readSequence,
  rna,
  translate,
} from "../src/tiny/genetic-code.js";
import { buildStory, SAMPLES } from "../src/tiny/protein-story.js";

test("the genetic code: 61 sense codons, 3 stops, ATG the only codon for methionine", () => {
  const codons = Object.keys(CODE);
  expect(codons.length).toBe(64);
  expect(codons.filter((c) => CODE[c] === "*").sort()).toEqual(["TAA", "TAG", "TGA"]);
  expect(codons.filter((c) => CODE[c] === "M")).toEqual(["ATG"]);
  expect(codons.filter((c) => CODE[c] === "W")).toEqual(["TGG"]);
  // Every amino acid has codons, and the counts are the textbook ones.
  const count = (aa) => codons.filter((c) => CODE[c] === aa).length;
  expect(Object.keys(AMINO).map(count)).toEqual(
    Object.keys(AMINO).map((aa) => ({ L: 6, S: 6, R: 6, A: 4, G: 4, P: 4, T: 4, V: 4, I: 3, M: 1, W: 1 })[aa] ?? 2), // prettier-ignore
  );
  // A few spot checks against the table.
  expect([CODE.GAG, CODE.GTG, CODE.TTT, CODE.AAA, CODE.CCC, CODE.GGG]).toEqual(["E", "V", "F", "K", "P", "G"]); // prettier-ignore
});

test("each sample gene translates to its record's protein, start to stop codon", () => {
  for (const id of SAMPLES) {
    const g = GENES[id];
    expect(g.cds.length % 3, id).toBe(0);
    expect(g.cds.slice(0, 3), id).toBe("ATG");
    const t = translate(g.cds);
    expect(t.seq, id).toBe(g.protein);
    expect(t.stop, id).toBe(g.cds.length / 3 - 1);
    // The structure's alpha carbons sit about 3.8 Å apart along the chain
    // (within 0.5 Å: the coordinates are rounded to 0.1 Å, and 4HHB, refined
    // in 1984, is looser; a cis peptide before a proline is about 2.9 Å).
    for (let i = 1; i < g.ca.length; i++) {
      const [a, b] = [g.ca[i - 1], g.ca[i]];
      if (!a || !b) continue;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const cis = g.protein[i] === "P" && d > 2.8 && d < 3.2;
      expect(cis || (d > 3.3 && d < 4.3), `${id} ${i}: ${d.toFixed(2)} Å`).toBe(true);
    }
  }
  expect(GENES.hbb.protein.length).toBe(147);
  expect(GENES.ins.protein.length).toBe(110);
  expect(GENES.lyz.protein.length).toBe(148);
  expect(GENES.gfp.protein.length).toBe(238);
});

test("transcription and pairing: mRNA matches the coding strand, anticodons pair with codons", () => {
  const coding = "ATGGTGCATCTG";
  const template = complement(coding); // 3′ to 5′ under the coding strand
  expect(template).toBe("TACCACGTAGAC");
  // The mRNA is the template's complement, with U for T: the coding strand's letters.
  expect(rna(complement(template))).toBe("AUGGUGCAUCUG");
  expect(anticodon("ATG")).toBe("UAC");
  expect(anticodon("GAG")).toBe("CUC");
});

test("the sickle-cell change: HBB codon 7 GAG to GTG, glutamic acid to valine", () => {
  const s = buildStory({ gene: "hbb", change: "point", codon: 7, pos: 2, base: "T" });
  expect(s.codons[6]).toBe("GTG");
  expect(s.protein[6]).toBe("V");
  expect(s.original[6]).toBe("E");
  expect(s.protein.length).toBe(147);
  expect(s.fold?.changed).toEqual([6]);
});

test("a frameshift changes every codon after it and stops early; no fold is shown", () => {
  const s = buildStory({ gene: "hbb", change: "insert", codon: 7, pos: 2, base: "T" });
  expect(s.protein.slice(0, 6)).toBe("MVHLTP");
  expect(s.protein.length).toBeLessThan(147);
  expect(s.fold).toBe(null);
  const d = buildStory({ gene: "hbb", change: "delete", codon: 4, pos: 1 });
  expect(d.codons.at(-1)).toBe("TGA");
  expect(d.protein).toBe("MVH");
});

test("typed DNA: FASTA, U and spaces are read; the first ATG starts the frame", () => {
  expect(readSequence(">x\nAUG GTG\n123 taa")).toBe("ATGGTGTAA");
  expect(() => readSequence("ATGXTAA")).toThrow(/X/);
  const s = buildStory({ gene: "custom", sequence: "GGCATGAAATTTTAGCC" });
  expect(s.at).toBe(3);
  expect(s.protein).toBe("MKF");
  expect(s.codons.at(-1)).toBe("TAG");
  // A typed copy of a sample gene folds like it.
  const g = GENES.lyz;
  expect(buildStory({ gene: "custom", sequence: g.lead + g.cds + g.utr3 }).fold?.pdb).toBe("1LZ1");
});

test("your own DNA with no sequence, or no start codon, shows the default gene instead of failing", () => {
  for (const sequence of ["", "GGGCCC", "not dna"]) {
    const s = buildStory({ gene: "custom", sequence });
    expect(s.gene).toBe("hbb");
    expect(s.fallback.length).toBeGreaterThan(0);
    expect(s.protein).toBe(GENES.hbb.protein);
  }
});

test("the toy builds for every gene and change, and its drive stays finite", async () => {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/tiny-r2.js");
  const r = RECIPES["dna-to-protein"];
  const base = Object.fromEntries(r.options.map((o) => [o.key, o.default]));
  const cases = [
    ...SAMPLES.map((gene) => ({ gene })),
    { gene: "hbb", change: "insert" },
    { gene: "hbb", change: "delete", codon: 4, pos: 1 },
    { gene: "custom", sequence: "ATGAAATTTTAG" },
    { gene: "custom", sequence: "" },
  ];
  for (const o of cases) {
    const options = { ...base, ...o };
    const it = buildRecipe(r, { seed: 5, count: 30000, options }, () => {});
    let b = it.next();
    while (!b.done) b = it.next();
    const data = b.value.kit.data;
    for (let v = 1; v >= 0; v -= 0.01) {
      const out = { parts: {}, cues: [], tokens: null };
      r.drive(1, { go: v }, out, { time: 1, R: 1, data });
      const nums = [...out.morph, ...out.levers.flat()];
      for (const p of Object.values(out.parts)) nums.push(...(p.offset || []), p.visible ?? 1);
      for (const tk of out.tokens) if (tk) nums.push(...tk.offset, tk.visible);
      expect(nums.every(Number.isFinite), JSON.stringify(o)).toBe(true);
    }
  }
});
