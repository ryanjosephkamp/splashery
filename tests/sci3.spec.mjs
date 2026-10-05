// Lane Science r3 (docs/handoff/ScienceR3.md): more data that already are Gaussians. Item 1,
// the structures: every one of the catalog's structures loads with its anisotropic ellipsoids,
// and the ellipsoids' axes give back the file's own U values (a PDB's ANISOU, and a CIF's U in
// a cell with right angles, where the Cartesian U is the file's); the unit cell and the
// completed molecules from the symmetry operations; the grouped picker. Item 2: the new
// microscopy sets load (NeNA's precision checked on made-up data with a known one); the cryo-EM
// maps' isosurface sits at EMDB's recommended contour level.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { readCrystal, symOf, readCifBlocks, cifNumber } from "../src/science/crystal.js";
import { parseSymop, fillCell, completeMolecules, turnU, cellsFor } from "../src/science/symmetry.js"; // prettier-ignore
import { STRUCTURES } from "../src/science/structures.js";
import {
  RECIPES,
  ellipsoidState,
  ELLIPSOID_SAMPLES,
  MICROSCOPE_SAMPLES,
  microscopeState,
  CRYOEM_SAMPLES,
  cryoemState,
} from "../src/packs/science.js";
import { readSmlm, readThunderstormCsv } from "../src/science/smlm.js";
import { readDensity, readBackbone, isoPoints } from "../src/science/density.js";
import { nena } from "../tools/sci3-samples.mjs";
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

test.describe("microscopy (node)", () => {
  test("NeNA recovers a known localization precision from consecutive frames", () => {
    // 4,000 molecules, each localized in two consecutive frames with σ = 8 nm.
    let seed = 3;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const n = 8000;
    const T = { n, x: new Float32Array(n), y: new Float32Array(n), frame: new Float32Array(n), has3D: false }; // prettier-ignore
    for (let m = 0; m < n / 2; m++) {
      const cx = rnd() * 20000;
      const cy = rnd() * 20000;
      const f = 2 * Math.floor(rnd() * 500);
      for (const k of [0, 1]) {
        T.x[2 * m + k] = cx + 8 * gauss();
        T.y[2 * m + k] = cy + 8 * gauss();
        T.frame[2 * m + k] = f + k;
      }
    }
    const r = nena(T);
    expect(Math.abs(r.sigma - 8)).toBeLessThan(0.6);
  });

  test("a column named frame_ (ShareLoc's ThunderSTORM export) is the frame", () => {
    const csv = "frame_,x [nm],y [nm],uncertainty [nm]\n1,10,20,5\n2,30,40,6\n";
    const t = readThunderstormCsv(csv);
    expect(Array.from(t.frame)).toEqual([1, 2]);
  });

  test("the four new microscopy sets load, each credited, CC BY 4.0, with its precision", async () => {
    const want = { pores: false, actin: false, mitochondria: false, microtubules3d: true };
    for (const [id, is3D] of Object.entries(want)) {
      const def = MICROSCOPE_SAMPLES.find((d) => d.id === id);
      expect(def.license).toBe("CC BY 4.0");
      expect(def.source).toMatch(/^https:\/\/doi\.org\/10\.5281\/zenodo\.\d+$/);
      const file = `assets/toys/smlm-microscope/${def.file}`;
      expect(fs.statSync(file).size).toBeLessThan(4_000_000);
      const T = await readSmlm(new Uint8Array(fs.readFileSync(file)));
      expect(T.has3D, id).toBe(is3D);
      expect(T.n).toBeGreaterThan(100000);
      // Every localization has a precision (the record's, or NeNA's).
      expect(Array.from(T.sxy.slice(0, 1000)).every((v) => v > 0 && v < 60)).toBe(true);
      if (def.note) expect(def.note).toMatch(/NeNA estimates [\d.]+ nm/);
      const out = await build("smlm-microscope", 140000, { data: id });
      expect(out.buf.count).toBeGreaterThan(50000);
      expect(microscopeState().name).toBe(def.label);
    }
  });
});

// EMDB's recommended contour levels, read on each entry's page on October 5, 2026.
const EMDB_LEVELS = { apoferritin: ["EMD-17961", 0.04], ribosome: ["EMD-48329", 0.02], aav: ["EMD-20610", 2] }; // prettier-ignore

test.describe("cryo-EM maps (node)", () => {
  test("each map's isosurface is at EMDB's recommended contour level", async () => {
    for (const [id, [emdb, level]] of Object.entries(EMDB_LEVELS)) {
      const D = await readDensity(new Uint8Array(fs.readFileSync(`assets/toys/cryoem-map/${id}.vol.gz`))); // prettier-ignore
      expect(D.head.emdb).toBe(emdb);
      expect(D.head.level).toBe(level);
      expect(["AUTHOR", "EMDB"]).toContain(D.head.levelSource);
      // The level is inside the stored range, and the bytes map back to it.
      expect(D.head.lo).toBeLessThan(level);
      expect(D.head.hi).toBeGreaterThan(level);
      expect(D.fromByte(D.toByte(level))).toBeCloseTo(level, 9);
      const S = isoPoints(D, level);
      expect(S.count).toBeGreaterThan(10000);
      // Every point is where the map's (trilinear) density equals the level.
      const vAt = (i) => [S.v[3 * i], S.v[3 * i + 1], S.v[3 * i + 2]];
      for (let i = 0; i < S.count; i += 97) expect(Math.abs(D.sample(...vAt(i)) - S.levelByte)).toBeLessThan(1e-3); // prettier-ignore
      // and faces out of the density: a step outward is lower, inward higher.
      let out = 0;
      let tried = 0;
      for (let i = 0; i < S.count; i += 211) {
        const v = vAt(i);
        const g = [S.n[3 * i], S.n[3 * i + 1], S.n[3 * i + 2]];
        const step = (s) => D.sample(...v.map((q, k) => q + s * g[k]));
        tried++;
        if (step(0.4) < S.levelByte && step(-0.4) > S.levelByte) out++;
      }
      expect(out / tried).toBeGreaterThan(0.85);
      const model = await readBackbone(new Uint8Array(fs.readFileSync(`assets/toys/cryoem-map/${id}-model.bin`))); // prettier-ignore
      expect(model.length).toBeGreaterThanOrEqual(24);
    }
  });

  test("the toy draws the map at EMDB's level by default, and the fitted model sits in it", async () => {
    for (const def of CRYOEM_SAMPLES) {
      expect(def.source).toMatch(/^https:\/\/www\.ebi\.ac\.uk\/emdb\/EMD-\d+$/);
      expect(def.model).toMatch(/^https:\/\/www\.rcsb\.org\/structure\//);
      const out = await build("cryoem-map", 140000, { map: def.id });
      const st = cryoemState();
      expect(st.level).toBe(EMDB_LEVELS[def.id][1]);
      expect(st.level).toBe(st.recommended);
      expect(out.buf.count).toBeGreaterThan(30000);
      expect(out.buf.count).toBeLessThanOrEqual(140000 * 1.05);
      // The model's backbone lies in the density: most Cα and P atoms are
      // inside the surface (above the level).
      const D = await readDensity(new Uint8Array(fs.readFileSync(`assets/toys/cryoem-map/${def.id}.vol.gz`))); // prettier-ignore
      const model = await readBackbone(new Uint8Array(fs.readFileSync(`assets/toys/cryoem-map/${def.id}-model.bin`))); // prettier-ignore
      const L = D.toByte(st.level);
      let inside = 0;
      let all = 0;
      for (const ch of model)
        for (let i = 0; i < ch.p.length; i += 7) {
          const v = ch.p[i].map((q, k) => (q - D.at0[k]) / D.voxel[k]);
          if (v.some((q, k) => q < 0 || q > D.n[k] - 1)) continue;
          all++;
          if (D.sample(...v) >= L) inside++;
        }
      expect(inside / all, def.id).toBeGreaterThan(0.6);
    }
    // The other levels and the model.
    await build("cryoem-map", 140000, { map: "apoferritin", level: "higher" });
    expect(cryoemState().level).toBeCloseTo(0.04 * 1.5, 9);
    await build("cryoem-map", 140000, { map: "apoferritin", model: true });
    expect(cryoemState().beads).toBeGreaterThan(4000);
  });
});
