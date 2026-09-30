// Lane Science: real science data as splats (docs/handoff/Science.md). The readers and the
// math are checked on numbers and on the samples (a CIF's U converted to Cartesian axes against
// a hand-worked value, the ellipsoid's axes against U's eigenvalues, the .smlm and CSV readers);
// the browser tests check that nothing of the Science toys loads before one opens, and take the
// screenshots.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  readCrystal,
  cellMatrices,
  uCifToCart,
  eigenSym3,
  symOf,
  probabilityScale,
  chi3Cdf,
  ellipsoidOf,
  readCifBlocks,
} from "../src/science/crystal.js";
import { readSmlm, readThunderstormCsv, readLocalizations, zipEntries } from "../src/science/smlm.js"; // prettier-ignore
import { packAtom, unpackAtom, quatFromAxes, jiggleNoise, unmagnify } from "../src/science/field.js"; // prettier-ignore
import {
  RECIPES,
  ellipsoidState,
  microscopeState,
  galaxyState,
  readGalaxy,
  MICROSCOPE_DENSITY,
  GALAXY_DENSITY,
} from "../src/packs/science.js";
import { buildRecipe, quatRotate } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const IDS = ["thermal-ellipsoids", "smlm-microscope", "galaxy-box"];
const ASPIRIN = "assets/toys/thermal-ellipsoids/aspirin-cod-2104857.cif";
const CRAMBIN = "assets/toys/thermal-ellipsoids/crambin-1ejg.pdb";
const PARACETAMOL = "tests/fixtures/sci/paracetamol-cod-2104364.cif";
const SMLM = "assets/toys/smlm-microscope/cos7-mt-clathrin.smlm";

async function build(id, count, options = {}) {
  const recipe = RECIPES[id];
  const o = resolveOptions(recipe, options);
  if (recipe.prepare) await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

const close = (a, b, eps) => expect(Math.abs(a - b)).toBeLessThan(eps);

test.describe("the shelf", () => {
  test("three labs toys on a Science shelf, each with a sound, a how-to and an About", () => {
    for (const id of IDS) {
      const t = TOYS.find((x) => x.id === id);
      expect(t, id).toBeTruthy();
      expect(t.labs).toBe(true);
      expect(t.category).toBe("science");
      expect(t.pack).toBe("science");
      expect(TOY_SOUNDS[id], id).toBeTruthy();
      expect(TOY_HELP[id]?.howTo, id).toBeTruthy();
      expect(TOY_HELP[id]?.about, id).toBeTruthy();
      expect(RECIPES[id].credits?.length, id).toBeGreaterThan(0);
    }
  });
});

test.describe("crystal files", () => {
  test("a CIF's cell and its U in Cartesian axes (aspirin's C1, worked by hand)", () => {
    const s = readCrystal(fs.readFileSync(ASPIRIN, "utf8"), "aspirin.cif");
    expect(s.format).toBe("cif");
    expect(s.counts).toMatchObject({ atoms: 21, aniso: 13, iso: 8, npd: 0 });
    // Monoclinic (alpha = gamma = 90°): A·N = [[1/sinβ, 0, cotβ], [0, 1, 0], [0, 0, 1]], so
    // U_xx = U11/sin²β + 2·U13·cotβ/sinβ + U33·cot²β, U_yy = U22, U_zz = U33.
    const [U11, U22, U33, , U13] = [0.0385, 0.0489, 0.0387, -0.0031, -0.0139];
    const b = (68.163 * Math.PI) / 180;
    const hand = U11 / Math.sin(b) ** 2 + (2 * U13 * Math.cos(b)) / Math.sin(b) ** 2 + U33 / Math.tan(b) ** 2; // prettier-ignore
    expect(hand).toBeCloseTo(0.038892, 5);
    const c1 = s.atoms.find((a) => a.label === "C1");
    close(c1.U[0], hand, 1e-6);
    close(c1.U[1], U22, 1e-6);
    close(c1.U[2], U33, 1e-6);
    // Its place: fractional (0.15361, 0.5634, -0.00763) through the cell.
    const { A } = cellMatrices(s.cell);
    const f = [0.15361, 0.5634, -0.00763];
    for (let i = 0; i < 3; i++) close(c1.p[i], A[i][0] * f[0] + A[i][1] * f[1] + A[i][2] * f[2], 1e-9); // prettier-ignore
    close(c1.p[0], 12.2696 * 0.15361 + 11.496 * Math.cos(b) * -0.00763, 1e-4);
  });

  test("the conversion keeps an isotropic U isotropic in any cell", () => {
    const cellM = cellMatrices({ a: 7, b: 9, c: 11, alpha: 81, beta: 97, gamma: 104 });
    // The reciprocal metric: U_cif for an isotropic atom is Uiso · G*⁻¹ scaled... check the
    // other way: an atom that is Uiso·I in Cartesian axes has U_ij = Uiso · (a*_i·a*_j) / (a*_i a*_j).
    const { A, recip } = cellM;
    // Reciprocal vectors are the rows of A⁻¹.
    const inv = invert3(A);
    const Uiso = 0.03;
    const u = [];
    for (const [i, j] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      const d = inv[i][0] * inv[j][0] + inv[i][1] * inv[j][1] + inv[i][2] * inv[j][2];
      u.push((Uiso * d) / (recip[i] * recip[j]));
    }
    const U = uCifToCart(u, cellM);
    for (let k = 0; k < 3; k++) close(U[k], Uiso, 1e-12);
    for (let k = 3; k < 6; k++) close(U[k], 0, 1e-12);
  });

  test("an mmCIF file and the PDB file of the same entry agree (crambin, 1EJG)", () => {
    const pdb = readCrystal(fs.readFileSync(CRAMBIN, "utf8"), "1ejg.pdb");
    expect(pdb.format).toBe("pdb");
    expect(pdb.counts.aniso).toBeGreaterThan(300);
    // A tiny mmCIF made from the PDB file's first atoms.
    const rows = pdb.atoms.slice(0, 4);
    const cif = [
      "data_TEST",
      "loop_",
      ...["group_PDB", "id", "type_symbol", "label_atom_id", "label_alt_id", "label_comp_id", "label_asym_id", "label_seq_id", "Cartn_x", "Cartn_y", "Cartn_z", "B_iso_or_equiv", "pdbx_PDB_model_num"].map((f) => `_atom_site.${f}`), // prettier-ignore
      ...rows.map((a, i) => `ATOM ${i + 1} ${a.el} ${a.name} . ${a.resName} A ${a.seq} ${a.p.join(" ")} 5.0 1`), // prettier-ignore
      "loop_",
      ...["id", "U[1][1]", "U[2][2]", "U[3][3]", "U[1][2]", "U[1][3]", "U[2][3]"].map((f) => `_atom_site_anisotrop.${f}`), // prettier-ignore
      ...rows.map((a, i) => `${i + 1} ${a.U.join(" ")}`),
    ].join("\n");
    const m = readCrystal(cif, "t.cif");
    expect(m.format).toBe("mmcif");
    expect(m.atoms.length).toBe(4);
    m.atoms.forEach((a, i) => {
      for (let k = 0; k < 6; k++) close(a.U[k], rows[i].U[k], 1e-9);
      expect(a.aniso).toBe(true);
    });
    // ANISOU is in 10⁻⁴ Å²: THR1 N's 434 is 0.0434.
    close(pdb.atoms[0].U[0], 0.0434, 1e-9);
  });

  test("a CIF without anisotropic U gives spheres, with a note", () => {
    const text = fs.readFileSync(ASPIRIN, "utf8").replace(/loop_\s+_atom_site_aniso_label[\s\S]*?(?=loop_)/, ""); // prettier-ignore
    const s = readCrystal(text, "iso.cif");
    expect(s.counts.aniso).toBe(0);
    expect(s.notes.join(" ")).toMatch(/no anisotropic displacements/);
    for (const a of s.atoms) expect(a.sigma[0] / a.sigma[2]).toBeCloseTo(1, 6);
  });

  test("a second CIF (paracetamol at 100 K) and the tags read by their full names", () => {
    const s = readCrystal(fs.readFileSync(PARACETAMOL, "utf8"), "p.cif");
    expect(s.counts).toMatchObject({ atoms: 20, aniso: 11 });
    expect(s.temperature).toBe(100);
    const [blk] = readCifBlocks("data_x\n_cell_length_a 5.1(2)\n_atom_site.id 1\n");
    expect(blk.item("_cell_length_a")).toBe("5.1(2)");
    expect(() => readCrystal("hello", "x.cif")).toThrow(/doesn't look like/);
  });

  test("an ellipsoid's axes are the square roots of U's eigenvalues times the probability scale", () => {
    expect(probabilityScale(0.5)).toBeCloseTo(1.5382, 4);
    expect(probabilityScale(0.3)).toBeCloseTo(1.1932, 3);
    expect(probabilityScale(0.9)).toBeCloseTo(2.5003, 3);
    expect(chi3Cdf(1.5382)).toBeCloseTo(0.5, 4);
    const U = [0.05, 0.03, 0.02, 0.01, -0.004, 0.006];
    const { values, vectors } = eigenSym3(symOf(U));
    const e = ellipsoidOf(U);
    for (let i = 0; i < 3; i++) close(e.sigma[i], Math.sqrt(values[i]), 1e-12);
    // U·v = λ·v, and the frame is a rotation.
    const M = symOf(U);
    for (let i = 0; i < 3; i++) {
      const v = vectors[i];
      for (let r = 0; r < 3; r++) close(M[r][0] * v[0] + M[r][1] * v[1] + M[r][2] * v[2], values[i] * v[r], 1e-12); // prettier-ignore
    }
    // The built toy: every atom's solid is its unit sphere scaled to P·σ along its axes.
    const P = probabilityScale(0.5);
    const q = quatFromAxes(e.axes);
    for (let i = 0; i < 3; i++) {
      const axis = [0, 0, 0];
      axis[i] = e.sigma[i] * P;
      const w = quatRotate(q, axis);
      const ref = e.axes[i].map((x) => x * e.sigma[i] * P);
      for (let k = 0; k < 3; k++) close(w[k], ref[k], 1e-9);
    }
    // Packed for the GPU program, the frame and sizes come back within a byte.
    const packed = packAtom(q, e.sigma, e.sigma[0], 1234);
    const back = unpackAtom(packed[0], packed[1], packed[2], e.sigma[0]);
    expect(back.seed).toBe(1234);
    for (let i = 0; i < 3; i++) close(back.sigma[i], e.sigma[i], e.sigma[0] / 200);
    const dq = Math.abs(back.quat.reduce((s, x, i) => s + x * q[i], 0));
    expect(dq).toBeGreaterThan(0.999);
  });

  test("the jiggle's noise has unit variance, so an atom wanders by its own U", () => {
    let s = 0;
    let s2 = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const v = jiggleNoise(17 + (i % 50), i % 3, i * 0.37);
      s += v;
      s2 += v * v;
    }
    close(s / n, 0, 0.05);
    close(s2 / n, 1, 0.08);
  });

  test("the magnifier's tap point maps back where it came from", () => {
    const F = [0.2, -0.1, 0.05];
    const p = [0.3, 0.1, -0.2];
    const m = 7;
    const u = 0.6;
    const shown = p.map((v, k) => (v - F[k]) * m + F[k] * (1 - u));
    const back = unmagnify(shown, F, m, u);
    for (let k = 0; k < 3; k++) close(back[k], p[k], 1e-12);
  });

  test("the thermal ellipsoids build in each look, finite and within the budget", async () => {
    for (const options of [
      {},
      { look: "gauss" },
      { structure: "crambin", level: "90" },
      { hydrogens: "hidden", bonds: false },
    ]) {
      const ctx = await build("thermal-ellipsoids", 60000, options);
      expect(ctx.buf.count).toBeGreaterThan(20);
      expect(ctx.buf.count).toBeLessThanOrEqual(60000 * 1.05);
      expect(ctx.buf.pos.subarray(0, ctx.buf.count * 3).every(Number.isFinite)).toBe(true);
      const st = ellipsoidState();
      expect(st.counts.atoms).toBe(options.structure === "crambin" ? 637 : 21);
      if (options.hydrogens === "hidden") expect(st.shownAtoms).toBe(13);
    }
  });
});

test.describe("localizations", () => {
  test("the .smlm sample reads (a zip with a manifest and two float32 tables)", async () => {
    const bytes = new Uint8Array(fs.readFileSync(SMLM));
    const names = zipEntries(bytes).map((e) => e.name);
    expect(names).toEqual(["manifest.json", "data-0.bin", "data-1.bin"]);
    const t = await readSmlm(bytes);
    expect(t.n).toBe(170401);
    expect(t.channels).toEqual(["clathrin", "microtubules"]);
    expect(t.has3D).toBe(true);
    // The first row of the clathrin table: frame 1, then x, y, z, and the precisions.
    expect(t.frame[0]).toBe(1);
    expect(t.sxy[0]).toBeGreaterThan(0);
    expect(t.sz[0]).toBeCloseTo(2 * t.sxy[0], 4);
    let chan1 = 0;
    for (let i = 0; i < t.n; i++) chan1 += t.channel[i];
    expect(chan1).toBe(132606);
    const bad = new Uint8Array([80, 75, 3, 4, 0, 0]);
    await expect(readSmlm(bad)).rejects.toThrow(/zip/);
  });

  test("a ThunderSTORM CSV reads, and says what's missing", async () => {
    const csv = [
      '"id","frame","x [nm]","y [nm]","z [nm]","sigma [nm]","intensity [photon]","offset [photon]","bkgstd [photon]","uncertainty_xy [nm]","uncertainty_z [nm]"',
      "1,1,1000.5,2000.25,-50,120,800,10,5,8.5,21",
      "2,3,1010,2010,40,110,900,10,5,6,15",
      "3,7,990,1990,0,130,700,10,5,9,24",
    ].join("\n");
    const t = readThunderstormCsv(csv);
    expect(t.n).toBe(3);
    expect(Array.from(t.x)).toEqual([1000.5, 1010, 990]);
    expect(t.sxy[1]).toBe(6);
    expect(t.sz[2]).toBe(24);
    expect(t.frames).toEqual([1, 7]);
    expect(t.has3D).toBe(true);
    const flat = readThunderstormCsv('"x [nm]","y [nm]","uncertainty [nm]"\n1,2,5\n3,4,6\n');
    expect(flat.has3D).toBe(false);
    expect(flat.notes.join(" ")).toMatch(/no z/);
    const none = readThunderstormCsv('"x [nm]","y [nm]"\n1,2\n');
    expect(none.sxy[0]).toBe(20);
    expect(none.notes.join(" ")).toMatch(/20 nm/);
    expect(() => readThunderstormCsv('"x [px]","y [px]"\n1,2\n')).toThrow(/nanometers/);
    expect(() => readThunderstormCsv("a,b\n1,2\n")).toThrow(/x \[nm\]/);
    const viaBytes = await readLocalizations(new TextEncoder().encode(csv), "t.csv");
    expect(viaBytes.n).toBe(3);
  });

  test("each localization is a Gaussian as wide as its precision (σz along z)", async () => {
    const ctx = await build("smlm-microscope", 240000);
    const info = microscopeState();
    expect(info.n).toBe(170401);
    expect(info.drawn).toBe(170401);
    const t = await readSmlm(new Uint8Array(fs.readFileSync(SMLM)));
    // The cloud comes after the slide: find the first localization's splat.
    const s = ctx.transform.scale;
    const buf = ctx.buf;
    const start = buf.count - info.drawn;
    // Its true size rides in its data for the GPU program (√2 σ, in µm);
    // the stored splat is at least 30 nm wide for the view without labs.
    const a = start * 4;
    close(buf.anim[a + 2], Math.SQRT2 * t.sxy[0] * 1e-3, 1e-7);
    close(buf.anim[a + 3], Math.SQRT2 * t.sz[0] * 1e-3, 1e-7);
    expect(buf.anim[a + 1]).toBe(1005);
    close(buf.scale[start * 3] / s, Math.max(Math.SQRT2 * t.sxy[0] * 1e-3, 0.03), 1e-6);
  });

  test("budgets per tier: the microscope and the galaxy keep within each tier's count", async () => {
    for (const [tier, prof] of Object.entries(PROFILES)) {
      if (tier === "weak" || tier === "strong") continue;
      for (const [id, density] of [
        ["smlm-microscope", MICROSCOPE_DENSITY],
        ["galaxy-box", GALAXY_DENSITY],
      ]) {
        const count = Math.round(Math.min(prof.maxCount, prof.defaultCount * density));
        const ctx = await build(id, count);
        expect(ctx.buf.count, `${id} on ${tier}`).toBeLessThanOrEqual(Math.ceil(count * 1.02));
        const st = id === "galaxy-box" ? galaxyState() : microscopeState();
        expect(st.drawn).toBeLessThanOrEqual(count);
        if (tier === "low") expect(st.drawn).toBeLessThan(st.n);
      }
    }
  });
});

test.describe("the galaxy", () => {
  test("the galaxy file reads, and each particle is about half its smoothing length", async () => {
    const G = readGalaxy(new Uint8Array(fs.readFileSync("assets/toys/galaxy-box/m12i-gas.bin")));
    expect(G.head.license).toBe("CC BY 4.0");
    expect(G.n).toBeGreaterThan(50000);
    for (let i = 0; i < G.n; i += 997) {
      const p = G.pos(i);
      for (const v of p) expect(Math.abs(v)).toBeLessThanOrEqual(G.head.half * 1.0001);
      expect(G.h(i)).toBeGreaterThan(0);
      expect(G.logT(i)).toBeGreaterThanOrEqual(1);
    }
    const ctx = await build("galaxy-box", 400000);
    const info = galaxyState();
    const s = ctx.transform.scale;
    // The file's subset is drawn wider by the cube root of its thinning.
    expect(info.widen).toBeCloseTo(Math.cbrt(G.head.inBox / G.n), 6);
    const start = ctx.buf.count - info.emitted;
    const want = Math.SQRT2 * 0.5 * G.h(info.first) * info.widen;
    close(ctx.buf.scale[start * 3] / s / want, 1, 2e-3);
  });
});

test.describe("in the browser", () => {
  test("nothing of the Science toys loads before one opens; each then builds", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const science = (u) => /science|thermal-ellipsoids|smlm-microscope|galaxy-box/.test(u) && !/thumb\.webp/.test(u); // prettier-ignore
    expect(requests.filter(science)).toEqual([]);
    await page.evaluate(() => window.__splashery.app.chooseToy("thermal-ellipsoids"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.ellipsoids?.shownAtoms > 10, null, { timeout: 90_000 }); // prettier-ignore
    expect(requests.some((u) => /packs\/science\.js/.test(u))).toBe(true);
    expect(requests.some((u) => /\.smlm|m12i-gas/.test(u))).toBe(false);
    // Jiggle: the tap toggles it.
    await page.evaluate(() => window.__splashery.app.act());
    expect(await page.evaluate(() => window.__splashery.player.motion.targets.jiggle)).toBe(1);
    // Your own CIF, through the panel.
    await page.locator("#toy-input-file").setInputFiles(PARACETAMOL);
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.ellipsoids?.custom === true, null, { timeout: 90_000 }); // prettier-ignore
    await expect(page.locator("#toy-input")).toContainText("20 atoms");
    await page.locator("#toy-input-file").setInputFiles({ name: "x.cif", mimeType: "text/plain", buffer: Buffer.from("not a crystal") }); // prettier-ignore
    await expect(page.locator(".warning:visible")).toBeVisible();
    await page.evaluate(() => window.__splashery.app.chooseToy("smlm-microscope"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.microscope?.drawn > 1000, null, { timeout: 90_000 }); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.chooseToy("galaxy-box"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.galaxy?.drawn > 1000, null, { timeout: 90_000 }); // prettier-ignore
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ browser }) => {
    test.setTimeout(240_000);
    const shots = [
      ["thermal-ellipsoids", "ellipsoids", (d) => d.ellipsoids],
      ["smlm-microscope", "microscope", (d) => d.microscope],
      ["galaxy-box", "galaxy", (d) => d.galaxy],
    ];
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      for (const [id, name] of shots) {
        await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
        await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id && window.__splashery.player.proc?.ctx?.kit?.data, id, { timeout: 90_000 }); // prettier-ignore
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `tests/screenshots/sci-${name}-${w}x${h}.png` });
      }
      await page.close();
    }
  });
});

function invert3(m) {
  const [a, b, c] = m;
  const det =
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);
  return [
    [(b[1] * c[2] - b[2] * c[1]) / det, (a[2] * c[1] - a[1] * c[2]) / det, (a[1] * b[2] - a[2] * b[1]) / det], // prettier-ignore
    [(b[2] * c[0] - b[0] * c[2]) / det, (a[0] * c[2] - a[2] * c[0]) / det, (a[2] * b[0] - a[0] * b[2]) / det], // prettier-ignore
    [(b[0] * c[1] - b[1] * c[0]) / det, (a[1] * c[0] - a[0] * c[1]) / det, (a[0] * b[1] - a[1] * b[0]) / det], // prettier-ignore
  ];
}
