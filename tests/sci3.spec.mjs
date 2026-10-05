// Lane Science r3 (docs/handoff/ScienceR3.md): more data that already are Gaussians. Item 1,
// the structures: every one of the catalog's structures loads with its anisotropic ellipsoids,
// and the ellipsoids' axes give back the file's own U values (a PDB's ANISOU, and a CIF's U in
// a cell with right angles, where the Cartesian U is the file's); the unit cell and the
// completed molecules from the symmetry operations; the grouped picker.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { readCrystal, symOf, readCifBlocks, cifNumber } from "../src/science/crystal.js";
import { parseSymop, fillCell, completeMolecules, turnU, cellsFor } from "../src/science/symmetry.js"; // prettier-ignore
import { STRUCTURES } from "../src/science/structures.js";
import { RECIPES, ellipsoidState, ELLIPSOID_SAMPLES } from "../src/packs/science.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const DIR = "assets/toys/thermal-ellipsoids";
const read = (file) => readCrystal(fs.readFileSync(`${DIR}/${file}`, "utf8"), file);
const byId = (id) => STRUCTURES.find((s) => s.id === id);

async function build(id, count, options = {}) {
  const recipe = RECIPES[id];
  const o = resolveOptions(recipe, options);
  if (recipe.prepare) await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Σ σᵢ² eᵢ eᵢᵀ: the tensor the drawn ellipsoid stands for.
function tensorOf(atom) {
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  atom.axes.forEach((e, k) => {
    const s2 = atom.sigma[k] ** 2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += s2 * e[i] * e[j];
  });
  return m;
}
const expectTensor = (m, six, eps = 1e-6) => {
  const want = symOf(six);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) expect(Math.abs(m[i][j] - want[i][j])).toBeLessThan(eps);
};

test.describe("structures (node)", () => {
  test("twenty-five structures in six groups, each with real anisotropic U and a CC0 credit", () => {
    expect(STRUCTURES.length).toBeGreaterThanOrEqual(15);
    expect(STRUCTURES.length).toBeLessThanOrEqual(25);
    expect(new Set(STRUCTURES.map((s) => s.group))).toEqual(
      new Set([
        "Everyday molecules",
        "Medicines",
        "Minerals and gems",
        "Ice and salts",
        "Proteins at atomic resolution",
        "DNA",
      ]),
    );
    // The ids r1 shipped stay (old links).
    expect(byId("aspirin").file).toBe("aspirin-cod-2104857.cif");
    expect(byId("crambin").file).toBe("crambin-1ejg.pdb");
    expect(ELLIPSOID_SAMPLES).toBe(STRUCTURES);
    for (const s of STRUCTURES) {
      const st = read(s.file);
      expect(st.counts.aniso, s.id).toBeGreaterThan(0);
      expect(st.counts.aniso, s.id).toBe(s.aniso);
      expect(s.license).toMatch(/^CC0 1\.0/);
      expect(s.source).toMatch(/^https:\/\/(www\.crystallography\.net\/cod|www\.rcsb\.org\/structure)\//); // prettier-ignore
      expect(s.author.length).toBeGreaterThan(20);
      expect(fs.statSync(`${DIR}/${s.file}`).size).toBeLessThan(300_000);
    }
  });

  test("a PDB file's ellipsoids give back its ANISOU values (10⁻⁴ Å²)", () => {
    for (const [id, n] of [
      ["lysozyme", 3],
      ["z-dna", 3],
      ["rubredoxin", 2],
    ]) {
      const file = byId(id).file;
      const lines = fs.readFileSync(`${DIR}/${file}`, "utf8").split("\n");
      const st = read(file);
      let checked = 0;
      for (let i = 1; i < lines.length && checked < n; i++) {
        if (!lines[i].startsWith("ANISOU") || !/^(ATOM  |HETATM)/.test(lines[i - 1])) continue;
        const name = lines[i - 1].slice(12, 16).trim();
        const seq = Number(lines[i - 1].slice(22, 26));
        const atom = st.atoms.find((a) => a.name === name && a.seq === seq && a.aniso);
        if (!atom || atom.npd) continue;
        const u = [28, 35, 42, 49, 56, 63].map((c) => Number(lines[i].slice(c, c + 7)) * 1e-4);
        expectTensor(tensorOf(atom), u, 1e-8);
        checked++;
      }
      expect(checked, id).toBe(n);
    }
  });

  test("a CIF's ellipsoids give back its U values (urea: a cell with right angles)", () => {
    const file = byId("urea").file;
    const text = fs.readFileSync(`${DIR}/${file}`, "utf8");
    const blk = readCifBlocks(text)[0];
    expect(["alpha", "beta", "gamma"].map((k) => cifNumber(blk.item(`_cell_angle_${k}`)))).toEqual([90, 90, 90]); // prettier-ignore
    const t = blk.table("_atom_site_aniso_label");
    const st = read(file);
    for (let r = 0; r < t.count; r++) {
      const label = t.get(r, "_atom_site_aniso_label");
      const u = ["11", "22", "33", "12", "13", "23"].map((ij) => cifNumber(t.get(r, `_atom_site_aniso_u_${ij}`))); // prettier-ignore
      const atom = st.atoms.find((a) => a.label === label);
      expectTensor(tensorOf(atom), u, 1e-9);
    }
    expect(t.count).toBeGreaterThanOrEqual(4);
  });

  test("symmetry operations: parsing, and a copy's U is the same tensor turned", () => {
    expect(parseSymop("-x+1/2, y, -z")).toEqual({
      W: [
        [-1, 0, 0],
        [0, 1, 0],
        [0, 0, -1],
      ],
      t: [0.5, 0, 0],
    });
    expect(parseSymop("x-y,-y,-z+2/3")).toEqual({
      W: [
        [1, -1, 0],
        [0, -1, 0],
        [0, 0, -1],
      ],
      t: [0, 0, 2 / 3],
    });
    expect(parseSymop("1/2+x,y,z").t).toEqual([0.5, 0, 0]);
    // A 90° turn about z swaps U11 and U22.
    const R = [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ];
    const u = turnU([0.01, 0.03, 0.02, 0.004, 0, 0], R);
    expect(u.map((x) => +x.toFixed(6))).toEqual([0.03, 0.01, 0.02, -0.004, 0, 0]);
  });

  test("the unit cell: rock salt's 27 atoms, quartz's 3 SiO2, eigenvalues kept", () => {
    const salt = read(byId("rock-salt").file);
    expect(cellsFor(salt.cell)).toEqual([1, 1, 1]);
    const cell = fillCell(salt, { cells: [1, 1, 1] });
    // 8 corners and 6 faces of Cl (or Na), 12 edges and the center of the other.
    const by = (el) => cell.atoms.filter((a) => a.el === el).length;
    expect(by("Na") + by("Cl")).toBe(27);
    expect([by("Na"), by("Cl")].sort()).toEqual([13, 14]);
    expect(cell.edges.length).toBe(12);
    const quartz = read(byId("quartz").file);
    const qc = fillCell(quartz, { cells: [1, 1, 1] });
    const inside = (a) => a.f.every((v) => v > 1e-3 && v < 1 - 1e-3);
    expect(qc.atoms.filter((a) => a.el === "Si" && a.f.every((v) => v >= -1e-3 && v < 1 - 1e-3)).length).toBe(3); // prettier-ignore
    expect(qc.atoms.filter((a) => a.el === "O" && inside(a)).length).toBe(6);
    // Every copy's ellipsoid has its original's principal sizes.
    for (const a of qc.atoms) {
      const o = quartz.atoms.find((b) => b.label === a.label);
      a.sigma.forEach((s, k) => expect(Math.abs(s - o.sigma[k])).toBeLessThan(1e-9));
    }
  });

  test("a molecule on a symmetry element is completed (urea, CH4N2O); a whole one is unchanged", () => {
    const urea = read(byId("urea").file);
    expect(urea.atoms.length).toBe(5);
    const done = completeMolecules(urea);
    const count = (el) => done.atoms.filter((a) => a.el === el).length;
    expect([count("C"), count("O"), count("N"), count("H")]).toEqual([1, 1, 2, 4]);
    const aspirin = read(byId("aspirin").file);
    expect(completeMolecules(aspirin)).toBe(aspirin);
  });

  test("the B-DNA file is the duplex: both strands, each atom with its ANISOU", () => {
    const st = read(byId("b-dna").file);
    const chains = new Set(st.atoms.map((a) => a.chain));
    expect(chains.size).toBeGreaterThanOrEqual(2);
    expect(st.counts.aniso).toBe(st.counts.atoms);
    // The two strands are each other's mates under −x, y, −z: same sizes.
    const a = st.atoms.find((x) => x.chain === "A" && x.name === "P");
    const b = st.atoms.find((x) => x.chain === "B" && x.name === "P" && x.seq === a.seq);
    expect(b.p[0]).toBeCloseTo(-a.p[0], 2);
    expect(b.p[2]).toBeCloseTo(-a.p[2], 2);
    a.sigma.forEach((s, k) => expect(Math.abs(s - b.sigma[k])).toBeLessThan(2e-3));
  });

  test("every structure builds as splats, minerals and salts as their unit cell", async () => {
    for (const s of STRUCTURES) {
      const out = await build("thermal-ellipsoids", 36000, { structure: s.id });
      const info = ellipsoidState();
      expect(out.buf.count, s.id).toBeGreaterThan(1000);
      expect(info.counts.aniso, s.id).toBeGreaterThan(0);
      if (s.show === "cell") expect(info.notes[0], s.id).toMatch(/unit cell|block of/);
    }
    // "The atoms the file lists" shows just those.
    await build("thermal-ellipsoids", 36000, { structure: "quartz", show: "file" });
    expect(ellipsoidState().shownAtoms).toBe(2);
    // A protein has no cell to fill and says so.
    await build("thermal-ellipsoids", 36000, { structure: "rubredoxin", show: "cell" });
    expect(ellipsoidState().notes.join(" ")).toMatch(/Only a small-molecule CIF/);
  });
});

test("the picker lists the structures under their six groups", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("thermal-ellipsoids"));
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    while (app.busy) await new Promise((r) => setTimeout(r, 50));
  });
  const groups = await page.evaluate(() =>
    [...document.querySelector("#toy-options select").querySelectorAll("optgroup")].map((g) => [
      g.label,
      g.children.length,
    ]),
  );
  expect(groups.map((g) => g[0])).toEqual([
    "Everyday molecules",
    "Medicines",
    "Minerals and gems",
    "Ice and salts",
    "Proteins at atomic resolution",
    "DNA",
  ]);
  expect(groups.reduce((n, g) => n + g[1], 0)).toBe(STRUCTURES.length);
  expect(errors).toEqual([]);
});
