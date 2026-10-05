// Lane Molecule viewer (docs/handoff/MolView.md). The readers are checked against known values
// (atom counts of the samples, the same structure read from PDB and mmCIF, the peptide bond's
// length and the backbone angle in crambin against Engh and Huber's standard values, crambin's
// three disulfide bridges, caffeine's C=O bonds, the file's helices and strands), the drawing and
// its level of detail on a big structure, the measuring taps, and in the browser the Fetch by code
// (the RCSB answer is mocked; no test needs the network) and the screenshots.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  readStructure,
  parsePdb,
  sniffFormat,
  bondsByDistance,
  KIND,
  MAX_ATOMS,
} from "../src/molview/parse.js";
import { orient, distance, angle, nearestAtom, blobbySurface } from "../src/molview/geom.js";
import { VDW, vdwRadius, cpk } from "../src/molview/radii.js";
import { pdbCode, fetchEntry, RCSB } from "../src/molview/load.js";
import {
  RECIPES,
  SAMPLES,
  viewerState,
  measureText,
  pickAtom,
  shownText,
  sentenceCase,
  VIEWER_DENSITY,
} from "../src/packs/molecule-viewer.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const ID = "molecule-viewer";
const DIR = "assets/toys/molecule-viewer/";
const read = (file) => readStructure(fs.readFileSync(DIR + file, "utf8"), file);
const recipe = RECIPES[ID];

async function build(options = {}, count = 160000) {
  const o = resolveOptions(recipe, options);
  await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// The atom named `name` in residue `seq` of a model.
const atomOf = (m, seq, name) => {
  const r = m.residues.find((x) => x.seq === seq && x.kind !== KIND.water);
  for (let i = r.start; i < r.end; i++) if (m.atomName[i] === name) return i;
  return -1;
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

test.describe("the shelf", () => {
  test("a labs toy on the Atoms shelf, with a sound, a how-to, an About, credits and a plan", () => {
    const t = TOYS.find((x) => x.id === ID);
    expect(t).toMatchObject({ labs: true, category: "atoms", pack: ID, kind: "kit" });
    expect(TOY_SOUNDS[ID]).toBeTruthy();
    expect(TOY_HELP[ID]?.howTo.length).toBeLessThanOrEqual(110);
    expect(TOY_HELP[ID]?.about).toContain("Protein Data Bank");
    expect(recipe.credits.length).toBe(SAMPLES.length);
    for (const c of recipe.credits) expect(c.license).toContain("CC0");
    const plan = JSON.parse(fs.readFileSync("tools/toy-plan.json", "utf8")).toys[ID];
    expect(plan.v).toBe("keep");
    // Every sample is listed in tools/assets.json with its license.
    const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).moleculeViewerSamples;
    for (const s of SAMPLES) expect(assets.some((a) => a.file === DIR + s.file && a.license === "CC0 1.0")).toBe(true); // prettier-ignore
  });
});

test.describe("the readers", () => {
  test("each sample's atom count, residues, chains and waters", () => {
    const want = {
      "1crn.cif": { atoms: 327, residues: 46, chains: 1, waters: 0 },
      "1ema.cif": { atoms: 1866, residues: 225, chains: 1, waters: 95 },
      "1lyz.cif": { atoms: 1102, residues: 129, chains: 1, waters: 101 },
      "1bna.cif": { atoms: 566, residues: 24, chains: 2, waters: 80 },
    };
    for (const [file, w] of Object.entries(want)) expect(read(file).counts, file).toMatchObject(w);
    const caf = read("caffeine-cff-ideal.sdf");
    expect(caf.n).toBe(24);
    expect(caf.order.length).toBe(25);
    expect(caf.bondSource).toBe("file");
    // C8H10N4O2, as the formula of caffeine.
    const count = (el) => caf.el.filter((e) => e === el).length;
    expect([count("C"), count("H"), count("N"), count("O")]).toEqual([8, 10, 4, 2]);
  });

  test("the same structure read from PDB and from mmCIF is the same", () => {
    const cif = read("1crn.cif");
    const pdb = readStructure(fs.readFileSync("tests/fixtures/mol/1crn.pdb", "utf8"), "1crn.pdb");
    expect(pdb.n).toBe(cif.n);
    for (let i = 0; i < cif.n; i++) {
      expect(pdb.el[i]).toBe(cif.el[i]);
      expect(Math.abs(pdb.x[i] - cif.x[i]) + Math.abs(pdb.y[i] - cif.y[i]) + Math.abs(pdb.z[i] - cif.z[i])).toBeLessThan(1e-3); // prettier-ignore
      expect(pdb.b[i]).toBeCloseTo(cif.b[i], 2);
    }
    expect(pdb.order.length).toBe(cif.order.length);
    expect(pdb.title.toLowerCase()).toBe(cif.title.toLowerCase());
    expect(cif.meta.resolution).toBe(1.5);
    expect(cif.meta.authors).toEqual(["Hendrickson, W.A.", "Teeter, M.M."]);
    expect(cif.meta.citation.doi).toBe("10.1073/pnas.81.19.6014");
  });

  test("crambin's peptide bonds and backbone angles match the standard values", () => {
    // Engh and Huber (1991): C–N 1.329 Å (σ 0.014), N–CA–C 111.2° (σ 2.8).
    const m = read("1crn.cif");
    const cn = [];
    const ncac = [];
    for (let seq = 1; seq <= 46; seq++) {
      ncac.push(angle(m, atomOf(m, seq, "N"), atomOf(m, seq, "CA"), atomOf(m, seq, "C")));
      if (seq < 46) cn.push(distance(m, atomOf(m, seq, "C"), atomOf(m, seq + 1, "N")));
    }
    expect(cn.length).toBe(45);
    expect(Math.abs(mean(cn) - 1.329)).toBeLessThan(0.01);
    expect(Math.abs(mean(ncac) - 111.2)).toBeLessThan(1);
    // One by hand: the first peptide bond, Thr 1 C to Thr 2 N.
    expect(distance(m, atomOf(m, 1, "C"), atomOf(m, 2, "N"))).toBeCloseTo(1.329, 1);
  });

  test("bonds by distance find crambin's three disulfide bridges, about 2.04 Å long", () => {
    const m = read("1crn.cif");
    expect(m.bondSource).toBe("distance");
    const ss = [];
    for (let q = 0; q < m.order.length; q++) {
      const i = m.bonds[2 * q];
      const j = m.bonds[2 * q + 1];
      if (m.el[i] === "S" && m.el[j] === "S") ss.push([m.residues[m.res[i]].seq, m.residues[m.res[j]].seq, distance(m, i, j)]); // prettier-ignore
    }
    expect(ss.map(([a, b]) => [a, b])).toEqual([
      [3, 40],
      [4, 32],
      [16, 26],
    ]);
    for (const [, , d] of ss) expect(Math.abs(d - 2.04)).toBeLessThan(0.05);
    // No atom has more bonds than chemistry allows (hydrogens keep one).
    const deg = new Map();
    for (const v of m.bonds) deg.set(v, (deg.get(v) ?? 0) + 1);
    for (const [i, d] of deg) expect(d, `${m.atomName[i]}`).toBeLessThanOrEqual(4);
  });

  test("caffeine's C=O double bonds are 1.22 Å", () => {
    const m = read("caffeine-cff-ideal.sdf");
    const co = [];
    for (let q = 0; q < m.order.length; q++) {
      const i = m.bonds[2 * q];
      const j = m.bonds[2 * q + 1];
      if (m.order[q] === 2 && [m.el[i], m.el[j]].sort().join("") === "CO") co.push(distance(m, i, j)); // prettier-ignore
    }
    expect(co.length).toBe(2);
    for (const d of co) expect(Math.abs(d - 1.22)).toBeLessThan(0.01);
  });

  test("helices and strands come from the file's records, or are inferred and say so", () => {
    const m = read("1crn.cif");
    expect(m.ssSource).toBe("file");
    const seqs = (ss) => m.residues.filter((r) => r.ss === ss).map((r) => r.seq);
    const range = (a, b) => [...Array(b - a + 1)].map((_, i) => a + i);
    expect(seqs("H")).toEqual([...range(7, 19), ...range(23, 30)]);
    expect(seqs("E")).toEqual([...range(1, 4), ...range(32, 35)]);
    // The PDB file without its HELIX and SHEET records: worked out from hydrogen bonds.
    const text = fs.readFileSync("tests/fixtures/mol/1crn.pdb", "utf8");
    const bare = parsePdb(text.split("\n").filter((l) => !/^(HELIX |SHEET )/.test(l)).join("\n"));
    expect(bare.ssSource).toBe("inferred");
    const same = bare.residues.filter((r, i) => r.ss === m.residues[i].ss).length;
    expect(same / m.residues.length).toBeGreaterThan(0.75);
  });

  test("XYZ: atoms back as written, bonds by distance as the SDF lists them", () => {
    const caf = read("caffeine-cff-ideal.sdf");
    const xyz = `${caf.n}\ncaffeine\n${caf.el.map((e, i) => `${e} ${caf.x[i]} ${caf.y[i]} ${caf.z[i]}`).join("\n")}\n`; // prettier-ignore
    expect(sniffFormat(xyz, "")).toBe("xyz");
    const m = readStructure(xyz, "caffeine.xyz");
    expect(m.n).toBe(24);
    expect(m.bondSource).toBe("distance");
    const key = (mm) => {
      const out = [];
      for (let q = 0; q < mm.order.length; q++) out.push(`${mm.bonds[2 * q]}-${mm.bonds[2 * q + 1]}`);
      return out.sort();
    };
    expect(key(m)).toEqual(key(caf));
  });

  test("a flat 2D drawing gets a built 3D shape and says so", () => {
    const mol = [
      "ethanol",
      "  drawn               2D",
      "",
      "  3  2  0  0  0  0  0  0  0  0999 V2000",
      "    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
      "    1.2990    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
      "    2.5981    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0",
      "  1  2  1  0",
      "  2  3  1  0",
      "M  END",
    ].join("\n");
    const m = readStructure(mol, "ethanol.mol");
    expect(m.n).toBe(9); // C2H6O with its hydrogens
    expect(m.notes.join(" ")).toContain("estimates, not measurements");
  });

  test("plain messages for empty, unknown and too-big files", () => {
    expect(() => readStructure("", "x.pdb")).toThrow("empty");
    expect(() => readStructure("hello there", "notes.txt")).toThrow("Could not tell");
    expect(() => readStructure(`${MAX_ATOMS + 1}\nbig\nC 0 0 0\n`, "big.xyz")).toThrow("more than 250,000 atoms"); // prettier-ignore
    expect(() => readStructure("data_x\n_cell.length_a 5\n", "x.cif")).toThrow("Thermal ellipsoids");
  });

  test("radii and colors: Bondi's van der Waals radii and the CPK colors", () => {
    expect([VDW.H, VDW.C, VDW.N, VDW.O, VDW.S, VDW.P]).toEqual([1.2, 1.7, 1.55, 1.52, 1.8, 1.8]);
    expect(vdwRadius("Fe")).toBe(2.0); // none tabulated: the stated default
    expect(cpk("O")[0]).toBeGreaterThan(0.85); // oxygen red
    expect(cpk("N")[2]).toBeGreaterThan(0.85); // nitrogen blue
  });

  test("PDB codes", () => {
    expect(pdbCode(" 1crn ")).toBe("1CRN");
    expect(pdbCode("4HHB")).toBe("4HHB");
    for (const bad of ["", "crn1", "1CR", "1CRN2", "0abc", "1C-N"]) expect(pdbCode(bad)).toBe(null);
  });
});

test.describe("geometry", () => {
  test("turning to face the viewer keeps every distance", () => {
    const m = read("1lyz.cif");
    const before = [distance(m, 0, 500), distance(m, 10, 900), angle(m, 3, 100, 700)];
    orient(m);
    expect(distance(m, 0, 500)).toBeCloseTo(before[0], 4);
    expect(distance(m, 10, 900)).toBeCloseTo(before[1], 4);
    expect(angle(m, 3, 100, 700)).toBeCloseTo(before[2], 3);
    // The widest spread lies across (x), the flattest toward the viewer (z).
    const spread = (a) => Math.sqrt(mean([...a].map((v) => v * v)));
    expect(spread(m.x)).toBeGreaterThan(spread(m.y));
    expect(spread(m.y)).toBeGreaterThan(spread(m.z));
  });

  test("the blobby surface sits at the van der Waals radius round a lone atom", () => {
    const m = { n: 1, x: [0], y: [0], z: [0], el: ["C"] };
    const s = blobbySurface(m, { radius: () => 1.7, use: () => true, max: 20000 });
    expect(s.count).toBeGreaterThan(100);
    for (let k = 0; k < s.count; k++) {
      const r = Math.hypot(s.points[k * 3], s.points[k * 3 + 1], s.points[k * 3 + 2]);
      expect(Math.abs(r - 1.7)).toBeLessThan(0.05);
    }
  });

  test("a tap picks the nearest shown atom", () => {
    const m = read("caffeine-cff-ideal.sdf");
    const shown = new Uint8Array(m.n).fill(1);
    expect(nearestAtom(m, [m.x[5] + 0.1, m.y[5], m.z[5]], shown).atom).toBe(5);
    shown[5] = 0;
    expect(nearestAtom(m, [m.x[5] + 0.1, m.y[5], m.z[5]], shown).atom).not.toBe(5);
  });

  test("bonds by distance on a lone water: two O–H bonds, no H–H", () => {
    const m = { n: 3, x: [0, 0.757, -0.757], y: [0, 0.586, 0.586], z: [0, 0, 0], el: ["O", "H", "H"] };
    expect(bondsByDistance(m).sort((a, b) => a[1] - b[1])).toEqual([
      [0, 1],
      [0, 2],
    ]);
  });
});

test.describe("the toy", () => {
  test("every sample builds in every style, inside the budget, with finite splats", async () => {
    for (const s of SAMPLES)
      for (const style of ["auto", "cartoon", "ballstick", "spacefill", "surface"]) {
        const { kit } = await build({ structure: s.id, style, color: "chain" }, 60000);
        const buf = kit.buf;
        expect(buf.count, `${s.id} ${style}`).toBeGreaterThan(500);
        expect(buf.count, `${s.id} ${style}`).toBeLessThan(60000 * 1.05);
        for (let i = 0; i < buf.count * 3; i += 97) expect(Number.isFinite(buf.pos[i])).toBe(true);
      }
  });

  test("color by B-factor, residue, chain and along the chain all build; B-factor says when absent", async () => {
    for (const color of ["element", "chain", "residue", "bfactor", "rainbow", "structure"])
      await build({ structure: "1ema", color }, 30000);
    await build({ structure: "caffeine", color: "bfactor" }, 30000);
    expect(shownText()).toContain("no B-factors");
  });

  test("the Toy tab names the entry, its authors, the snapshot and the license", async () => {
    await build({ structure: "1crn" });
    const t = shownText();
    expect(t).toContain("1CRN: Water structure of a hydrophobic protein");
    expect(t).toContain("W.A. Hendrickson and M.M. Teeter");
    expect(t).toContain("snapshot from the Protein Data Bank, fetched October 5, 2026");
    expect(t).toContain("CC0");
    expect(t).toContain("Helices and strands: from the file's records.");
    expect(sentenceCase("STRUCTURE OF A B-DNA DODECAMER. CONFORMATION")).toBe("Structure of a B-DNA dodecamer. Conformation"); // prettier-ignore
  });

  test("taps measure a distance in ångströms and an angle in degrees", async () => {
    await build({ structure: "1crn", style: "ballstick" });
    const S = viewerState();
    const m = S.shown.model;
    S.picks = [];
    const N = atomOf(m, 2, "N");
    const CA = atomOf(m, 2, "CA");
    const C = atomOf(m, 2, "C");
    // A tap lands on the splats round an atom: here, half an ångström off N.
    const r = recipe.action.at([m.x[N] + 0.3, m.y[N] + 0.3, m.z[N]], {});
    expect(r.key).toBe("pick");
    expect(S.picks).toEqual([N]);
    pickAtom(CA);
    expect(measureText(m)).toMatch(/^Distance N of Thr 2 \(chain A\) to CA of Thr 2 \(chain A\): 1\.\d\d Å/);
    pickAtom(C);
    const text = measureText(m);
    expect(text).toContain(`${angle(m, N, CA, C).toFixed(1)}°`);
    // Picking the last atom again takes it back; a fourth starts over.
    pickAtom(C);
    expect(S.picks).toEqual([N, CA]);
    pickAtom(C);
    pickAtom(atomOf(m, 3, "N"));
    expect(S.picks.length).toBe(1);
    // A tap far from every atom clears them.
    expect(recipe.action.at([500, 500, 500], {})).toMatchObject({ say: "Measurement cleared." });
    expect(S.picks).toEqual([]);
  });

  test("the marks follow the picks: a marker on each atom, a line, and an arc for the angle", async () => {
    await build({ structure: "caffeine" });
    const S = viewerState();
    const m = S.shown.model;
    S.picks = [0, 1, 2];
    const out = { parts: {}, tokens: null };
    recipe.drive(1, { pick: 0 }, out, { time: 1, tap: null });
    const shown = out.tokens.filter((t) => t.visible).length;
    expect(shown).toBe(3 + 14 + 14 + 12);
    expect(out.tokens[1].offset).toEqual([m.x[1], m.y[1], m.z[1]]);
    // Right after the tap the newest line has only begun.
    recipe.drive(1, { pick: 0.95 }, out, { time: 1, tap: null });
    expect(out.tokens.filter((t) => t.visible).length).toBeLessThan(shown - 10);
    S.picks = [];
  });

  test("the Play button measures a bond near the middle, then its angle, then clears", async () => {
    await build({ structure: "caffeine" });
    const S = viewerState();
    S.picks = [];
    const out = () => ({ parts: {}, tokens: null });
    let n = S.lastTap;
    recipe.drive(1, { pick: 1 }, out(), { time: 1, tap: { n: ++n, point: null } });
    expect(S.picks.length).toBe(2);
    const [a, b] = S.picks;
    expect(distance(S.shown.model, a, b)).toBeLessThan(1.6); // a real bond
    recipe.drive(2, { pick: 1 }, out(), { time: 2, tap: { n: ++n, point: null } });
    expect(S.picks.length).toBe(3);
    recipe.drive(3, { pick: 1 }, out(), { time: 3, tap: { n: ++n, point: null } });
    expect(S.picks).toEqual([]);
  });

  test("a big structure falls to one Gaussian per atom and stays inside the budget", async () => {
    // 64,000 atoms on a diamond-like grid, 1.54 Å apart, as an XYZ file.
    const rows = [];
    for (let a = 0; a < 40; a++)
      for (let b = 0; b < 40; b++)
        for (let c = 0; c < 40; c++) rows.push(`C ${a * 1.54} ${b * 1.54} ${c * 1.54}`);
    const text = `${rows.length}\nbig grid\n${rows.join("\n")}\n`;
    const opts = await recipe.input.read(text, "grid.xyz");
    expect(opts).toEqual({ structure: "file", fileName: "grid.xyz" });
    const t0 = Date.now();
    const { kit } = await build({ ...opts, style: "ballstick" }, 72000);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(kit.buf.count).toBeLessThan(72000 * 1.05);
    expect(viewerState().shown.lod).toContain("one Gaussian per atom");
    expect(shownText()).toContain("Level of detail");
  });

  test("Fetch: a code is fetched from RCSB, read, and shown with its source and time", async () => {
    const text = fs.readFileSync(DIR + "1crn.cif", "utf8");
    const asked = [];
    const fetchFn = async (url) => {
      asked.push(url);
      return { ok: true, status: 200, headers: { get: () => String(text.length) }, text: async () => text }; // prettier-ignore
    };
    const got = await fetchEntry("1CRN", { fetchFn });
    expect(asked).toEqual([`${RCSB}1CRN.cif`]);
    expect(got.text.length).toBe(text.length);
    const missing = async () => ({ ok: false, status: 404, headers: { get: () => "" } });
    await expect(fetchEntry("9ZZZ", { fetchFn: missing })).rejects.toThrow("no entry 9ZZZ");
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(fetchEntry("1CRN", { fetchFn: offline })).rejects.toThrow("offline");
    await expect(recipe.input.read("hello", "")).rejects.toThrow("four characters");
  });
});

test.describe("in the browser", () => {
  test("nothing of the viewer loads before it opens", async ({ page }) => {
    const asked = [];
    page.on("request", (r) => asked.push(r.url()));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(asked.filter((u) => /molview|molecule-viewer|rcsb/.test(u))).toEqual([]);
  });

  test("Fetch by code (RCSB mocked), a tap's measurement, and the screenshots", async ({ page }) => {
    test.setTimeout(400_000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const outside = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.hostname !== "127.0.0.1") outside.push(r.url());
    });
    // The Protein Data Bank's answer, from the snapshot (no network).
    await page.route("https://files.rcsb.org/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "chemical/x-cif",
        headers: { "access-control-allow-origin": "*" },
        body: fs.readFileSync(DIR + "1ema.cif", "utf8"),
      }),
    );
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(async (id) => {
        const { app } = window.__splashery;
        await app.chooseToy(id);
        while (app.busy) await new Promise((r) => setTimeout(r, 50));
      }, ID);
      if (w > 1000) {
        // Fetch 1EMA by its code through the panel.
        await page.evaluate(() => window.__splashery.app.ui.showTab("play"));
        await page.fill("#toy-input-text", "1ema");
        await page.click("#toy-input-go");
        await expect(page.locator(".input-shown")).toContainText("Fetched from the Protein Data Bank", { timeout: 60_000 }); // prettier-ignore
        const shown = await page.locator(".input-shown").textContent();
        expect(shown).toContain("https://files.rcsb.org/download/1EMA.cif");
        expect(shown).toMatch(/on [A-Z][a-z]+ \d+, \d{4}/);
        expect(shown).toContain("Ormo");
        // The fetched entry heads the About tab's credits.
        expect(recipe.credits).toBeTruthy();
      }
      // Tap two atoms: their screen places from the recipe's own coordinates.
      const said = await page.evaluate(async () => {
        const { app, player } = window.__splashery;
        const { viewerState } = await import("/src/packs/molecule-viewer.js");
        while (app.busy) await new Promise((r) => setTimeout(r, 50));
        const S = viewerState();
        S.picks = [];
        const demo = S.shown.demo;
        const m = S.shown.model;
        for (const a of demo.slice(0, 2)) player.act(player.fromRecipe([m.x[a], m.y[a], m.z[a]]));
        await new Promise((r) => setTimeout(r, 1600));
        return { toast: document.getElementById("toast").textContent, picks: S.picks.length };
      });
      expect(said.picks).toBe(2);
      expect(said.toast).toMatch(/^Distance .* \d\.\d\d Å/);
      await page.screenshot({ path: `tests/screenshots/mol-viewer-${w}x${h}.png` });
    }
    expect(outside.filter((u) => !u.startsWith("https://files.rcsb.org/download/1EMA.cif"))).toEqual([]); // prettier-ignore
    expect(errors).toEqual([]);
  });

  test("the viewer's density", () => {
    expect(recipe.density).toBe(VIEWER_DENSITY);
  });
});
