// Lane Elements: Real elements, a periodic table of real samples (docs/handoff/Elements.md). The
// facts are checked against the saved snapshot of the references they come from (PubChem's
// periodic table and element pages, tools/rel-reference.json), all 118 symbols and numbers against
// the chemistry toys' own NIST and IUPAC table too, and a sample of values by hand. The samples:
// every element has a photo with an allowed license or a reason it has none, and the table loads
// only its atlas until a sample is lifted.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RECIPES, ELEMENTS, elementOf, factsOf } from "../src/packs/real-elements.js";
import { FACTS } from "../src/elements-real/facts.js";
import { SAMPLES, WITH_PHOTO, PICTURED, STANDINS, LICENSE_URL, pictureOf } from "../src/elements-real/samples.js"; // prettier-ignore
import { cellOf, blockOf } from "../src/elements-real/layout.js";
import { PERIODIC } from "../src/chem/periodic.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";

const REF = JSON.parse(fs.readFileSync("tools/rel-reference.json", "utf8"));
const USES = JSON.parse(fs.readFileSync("tools/rel-uses.json", "utf8"));
const RECIPE = RECIPES["real-elements"];
const ASSETS = "assets/toys/real-elements";
const SHOTS = "tests/screenshots";

function build(count, options = {}) {
  const o = resolveOptions(RECIPE, options);
  return RECIPE.prepare(o).then(() => {
    const it = buildRecipe(RECIPE, { seed: 1, count, options: o }, applyClay);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  });
}

test.describe("the facts", () => {
  test("the toy is a labs toy on the Atoms shelf", () => {
    const t = TOYS.find((x) => x.id === "real-elements");
    expect(t.labs).toBe(true);
    expect(t.category).toBe("atoms");
    expect(t.pack).toBe("real-elements");
  });

  test("all 118 numbers, symbols and names match the references", () => {
    expect(FACTS.length).toBe(118);
    expect(REF.rows.length).toBe(118);
    FACTS.forEach((f, i) => {
      expect(f[0]).toBe(i + 1);
      expect(f[0]).toBe(Number(REF.rows[i].AtomicNumber));
      expect(f[1]).toBe(REF.rows[i].Symbol);
      expect(f[2]).toBe(REF.rows[i].Name);
      // The chemistry toys' table (NIST, PubChem and IUPAC; tools/chs-data.mjs) agrees.
      expect(f[0]).toBe(PERIODIC[i][0]);
      expect(f[1]).toBe(PERIODIC[i][1]);
    });
  });

  test("every value matches PubChem's periodic table", () => {
    const num = (s) => (s === "" ? null : Number(s));
    FACTS.forEach(([z, , , mass, , , state, density, melt, boil, year, family], i) => {
      const r = REF.rows[i];
      expect(mass, `${z} mass`).toBe(r.AtomicMass);
      expect(density, `${z} density`).toBe(num(r.Density));
      expect(melt, `${z} melting point`).toBe(num(r.MeltingPoint));
      expect(boil, `${z} boiling point`).toBe(num(r.BoilingPoint));
      expect(year, `${z} discovery`).toBe(r.YearDiscovered);
      expect(family, `${z} category`).toBe(r.GroupBlock);
      expect(state.replace(" (predicted)", ""), `${z} state`).toBe(
        r.StandardState.replace("Expected to be a ", "").toLowerCase(),
      );
    });
  });

  // A sample of values typed in by hand from PubChem's element pages
  // (https://pubchem.ncbi.nlm.nih.gov/element/<Z>): mass (u), density (g/cm³), melting and boiling
  // points (K), state, discovery.
  const HAND = [
    [1, "1.0080", 0.00008988, 13.81, 20.28, "gas", "1766"],
    [6, "12.011", 2.267, 3823, 4098, "solid", "Ancient"],
    [8, "15.999", 0.001429, 54.36, 90.2, "gas", "1774"],
    [26, "55.84", 7.874, 1811, 3134, "solid", "Ancient"],
    [29, "63.55", 8.933, 1357.77, 2835, "solid", "Ancient"],
    [35, "79.90", 3.11, 265.95, 331.95, "liquid", "1826"],
    [79, "196.96657", 19.282, 1337.33, 3129, "solid", "Ancient"],
    [80, "200.59", 13.5336, 234.32, 629.88, "liquid", "Ancient"],
    [92, "238.0289", 18.95, 1408, 4404, "solid", "1789"],
    [118, "295.216", null, null, null, "gas (predicted)", "2006"],
  ];
  for (const [z, mass, density, melt, boil, state, year] of HAND)
    test(`hand-checked values for element ${z}`, () => {
      const e = ELEMENTS[z - 1];
      expect([e.mass, e.density, e.melt, e.boil, e.state, e.year]).toEqual([mass, density, melt, boil, state, year]); // prettier-ignore
    });

  test("groups, periods and blocks follow the table's layout", () => {
    const g = (s) => elementOf(s);
    expect([g("H").group, g("H").period, g("H").block]).toEqual([1, 1, "s"]);
    expect([g("He").group, g("He").period, g("He").block]).toEqual([18, 1, "s"]);
    expect([g("Fe").group, g("Fe").period, g("Fe").block]).toEqual([8, 4, "d"]);
    expect([g("Br").group, g("Br").period, g("Br").block]).toEqual([17, 4, "p"]);
    expect([g("Ba").group, g("Ba").period]).toEqual([2, 6]);
    expect([g("La").group, g("La").period, g("La").block]).toEqual([0, 6, "f"]);
    expect([g("Lr").group, g("Lr").period, g("Lr").block]).toEqual([0, 7, "f"]);
    expect([g("Hf").group, g("Hf").period]).toEqual([4, 6]);
    expect([g("Og").group, g("Og").period, g("Og").block]).toEqual([18, 7, "p"]);
    // 18 columns, 7 periods; 30 elements in the f-block rows.
    expect(ELEMENTS.filter((e) => e.group === 0).length).toBe(30);
    for (const e of ELEMENTS) expect(cellOf(e.z)[1]).toBe(e.period);
    expect(ELEMENTS.filter((e) => blockOf(e.z) === "s").length).toBe(14);
  });

  test("every use is backed by the words of its source", () => {
    expect(USES.length).toBe(118);
    for (const e of ELEMENTS) {
      const want = USES[e.z - 1].uses;
      expect(e.uses.map((u) => u[0])).toEqual(want.map((u) => u.text));
      for (const [text, src] of e.uses) {
        expect(text.length).toBeLessThanOrEqual(90);
        const ref = REF.uses.find((u) => u.z === e.z && u.text === text);
        expect(ref, `${e.symbol}: ${text}`).toBeTruthy();
        expect(ref.src).toBe(src);
        expect(ref.sentence).toContain(ref.quote);
      }
    }
  });

  test("the facts list reads plainly", () => {
    const fe = factsOf(elementOf("Fe"));
    expect(fe.title).toBe("26 Fe · Iron");
    const t = fe.items.map((i) => i.text);
    expect(t).toContain("Atomic mass 55.84 u");
    expect(t).toContain("Group 8 · Period 4");
    expect(t).toContain("Solid at room temperature");
    expect(t).toContain("Density 7.874 g/cm³");
    expect(t).toContain("Melts at 1,537.9 °C · Boils at 2,860.9 °C");
    expect(t).toContain("Known since ancient times");
    expect(t).toContain("Photo: Images of Elements (Jumk.de Webprojects), CC BY 3.0");
    const o = factsOf(elementOf("O")).items.map((i) => i.text);
    expect(o).toContain("Density 1.429 g/L (gas at 0 °C)");
    expect(o).toContain("Discovered in 1774");
    const tc = factsOf(elementOf("Tc")).items.map((i) => i.text);
    expect(tc).toContain("Atomic mass 96.90636 u");
    expect(tc).toContain("Photo: Marco Cardin, CC BY-SA 4.0");
    const og = factsOf(elementOf("Og")).items;
    expect(og.find((i) => i.dim).text).toMatch(/few atoms/);
    expect(og.map((i) => i.text)).toContain("Shown instead: Yuri Oganessian, for whom oganesson is named"); // prettier-ignore
  });
});

test.describe("the samples", () => {
  const ALLOWED = ["CC0", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "Public domain"]; // prettier-ignore

  test("every element has a photo with an allowed license, or says why not", () => {
    for (let z = 1; z <= 118; z++) {
      const s = SAMPLES[z];
      expect(s, `${z}`).toBeTruthy();
      if (s.none) {
        expect(s.none.length).toBeGreaterThan(20);
        continue;
      }
      expect(ALLOWED).toContain(s.license);
      expect(LICENSE_URL[s.license]).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(s.page).toMatch(/^https:\/\/(images-of-elements\.com|commons\.wikimedia\.org)\//);
      expect(s.author.length).toBeGreaterThan(2);
      expect(s.what.length).toBeGreaterThan(8);
    }
    expect(WITH_PHOTO.length).toBe(92);
    // The heaviest have none.
    for (let z = 100; z <= 118; z++) expect(SAMPLES[z].none).toBeTruthy();
  });

  test("every element without a sample photo has a stand-in picture, said to be one", () => {
    expect(PICTURED.length).toBe(118);
    for (let z = 1; z <= 118; z++) {
      if (!SAMPLES[z].none) {
        expect(STANDINS[z]).toBeUndefined();
        continue;
      }
      const s = STANDINS[z];
      expect(s, `${z}`).toBeTruthy();
      expect(["portrait", "flag", "arms", "photo"]).toContain(s.kind);
      expect(ALLOWED).toContain(s.license);
      expect(s.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(s.what.length).toBeLessThanOrEqual(90);
      const items = factsOf(ELEMENTS[z - 1]).items.map((i) => i.text);
      expect(items).toContain(SAMPLES[z].none);
      expect(items).toContain(`Shown instead: ${s.what}`);
      expect(items).toContain(`Picture: ${s.author}, ${s.license}`);
    }
    // Dubnium is named for Dubna, Russia (not Dublin).
    expect(STANDINS[105].what).toMatch(/Dubna/);
  });

  test("the toy credits every Commons photo, BY-SA ones with their license", () => {
    const c = RECIPE.credits;
    for (const z of PICTURED.filter((z) => pictureOf(z).src === "commons"))
      expect(c.find((x) => x.source === pictureOf(z).page)?.license).toBe(pictureOf(z).license);
    expect(c.find((x) => x.source === "https://images-of-elements.com/").license).toBe("CC BY 3.0");
  });

  test("the files are there and small", () => {
    let total = 0;
    for (const z of PICTURED)
      for (const ext of ["jpg", "png"]) {
        const f = path.join(ASSETS, `${z}.${ext}`);
        expect(fs.existsSync(f), f).toBe(true);
        total += fs.statSync(f).size;
      }
    const atlas = fs.statSync(path.join(ASSETS, "tiles.jpg")).size + fs.statSync(path.join(ASSETS, "tiles.png")).size; // prettier-ignore
    // The table opens with the atlas alone; each lifted sample adds its own pair.
    expect(atlas).toBeLessThan(600_000);
    expect(total / PICTURED.length).toBeLessThan(80_000);
  });

  test("the table builds within its budget, the lifted sample in finer detail", async () => {
    const count = 60000;
    const r = await build(count, { element: "Cu" });
    expect(r.buf.count).toBeLessThanOrEqual(count * 1.02);
    const d = r.kit.data;
    expect(d.element).toBe("Cu");
    expect(d.legend.title).toBe("29 Cu · Copper");
    expect(d.splats.lift).toBeGreaterThan(0.12 * count);
    expect(d.splats.tiles).toBeGreaterThan(0.25 * count);
    // An element with no sample photo lifts its stand-in picture (Oganessian's portrait, flat).
    const og = await build(count, { element: "Og" });
    expect(og.kit.data.legend.title).toBe("118 Og · Oganesson");
    expect(og.kit.data.splats.lift).toBeGreaterThan(1000);
  });

  test("a tap on a tile picks its element; on the lifted sample, turns it", () => {
    const r = RECIPE;
    expect(r.action.at(r.tileAt("Na"), { up: 0 })).toEqual({ options: { element: "Na" }, key: "up" }); // prettier-ignore
    expect(r.action.at(r.liftAt(), { up: 1 })).toBe("spin");
  });
});

test.describe("the toy in the app", () => {
  const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";

  async function open(page, seen) {
    page.on("request", (q) => seen?.push(q.url()));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("real-elements"));
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "real-elements" && window.__splashery.player.motion?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
  }

  test("the table loads its atlas and only the sample on show", async ({ page }) => {
    const seen = [];
    await open(page, seen);
    const mine = seen.filter(
      (u) => u.includes("assets/toys/real-elements/") && !u.includes("thumb.webp"),
    );
    const names = mine.map((u) => u.split("/").pop()).sort();
    expect(names).toEqual(["29.jpg", "29.png", "tiles.jpg", "tiles.png"]);
    // No depth model or runtime: the depths are made at build time.
    expect(seen.some((u) => /onnx|depth-anything/.test(u))).toBe(false);
  });

  test("a tap on a tile lifts its sample and shows its facts", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(async () => {
      const { player } = window.__splashery;
      const recipe = player.toyInfo.recipe;
      const tf = player.motion.ctx.transform;
      const world = recipe.tileAt("Bi").map((v, i) => (v - tf.center[i]) * tf.scale);
      player.act(world);
      const t0 = performance.now();
      while (
        (player.toyInfo.options?.element !== "Bi" || player.motion.targets.up !== 1) &&
        performance.now() - t0 < 120_000
      )
        await new Promise((ok) => setTimeout(ok, 100));
      // The facts show once the sample is most of the way up (wait for them, however slow the
      // machine draws).
      const legend = document.getElementById("toy-legend");
      const t1 = performance.now();
      while (!legend.innerText.includes("Bismuth") && performance.now() - t1 < 30_000)
        await new Promise((ok) => setTimeout(ok, 200));
      return {
        element: player.scene.toy.options.element,
        up: player.motion.targets.up,
        legend: document.getElementById("toy-legend").innerText,
      };
    });
    expect(r.element).toBe("Bi");
    expect(r.up).toBe(1);
    expect(r.legend).toContain("83 Bi · Bismuth");
    expect(r.legend).toContain("Density 9.807 g/cm³");
  });

  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`screenshots at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `rel-table-${w}x${h}.png`) });
      await page.evaluate(async () => {
        const { app, player } = window.__splashery;
        await app.setToyOption("element", "S");
        player.motion.setControl("up", 1, { snap: true });
        player.stage.requestRender();
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SHOTS, `rel-sample-${w}x${h}.png`) });
      expect(fs.existsSync(path.join(SHOTS, `rel-sample-${w}x${h}.png`))).toBe(true);
    });
  }
});
