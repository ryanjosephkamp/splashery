// Lane Live r10: Sound in a box follows music at the plate's pace, explains
// its modes, and both it and the Chladni plate take the colors you choose.
// The physics and the colors in Node; the toys in the browser.

import { test, expect } from "@playwright/test";
import {
  CELL_MODES,
  Beads,
  LIVE,
  ladder,
  cellDrive,
  cellFreq,
  heardFreq,
  modesInfo,
  MODE_NOTES,
} from "../src/packs/chladni-3d.js";
import {
  PALETTES,
  colorOptions,
  colorsOnly,
  paint,
  gradient,
  flagShares,
  hash01,
} from "../src/packs/chladni-colors.js";
import { resolveOptions } from "../src/player.js";
import { RECIPES } from "../src/packs/studio.js";
import { mix } from "../src/kit.js";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const BOX = "/src/packs/chladni-3d.js";
const STUDIO = "/src/packs/studio.js";

function rng(seed = 7) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
async function until(page, fn, arg, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${fn}`);
    await page.waitForTimeout(150);
  }
}
const cube = (id) => ladder("cube").find((m) => m.id === id);

// ---- 1. Responsiveness, in Node ---------------------------------------------------------

test("music moves the beads to a new figure at the plate's pace, quiet music too", () => {
  // Settled on one figure, then a new note at 60% loudness: halfway to its
  // figure within 1.3 s (was 3.2 s), at full loudness within 0.9 s (was 1.2
  // to 2.2 s; the plate's sand 0.5 to 0.9 s).
  for (const [from, to, loud, within] of [
    ["cube-012", "cube-111", 0.6, 1.3],
    ["cube-110", "cube-122", 0.6, 1.3],
    ["cube-012", "cube-111", 1, 0.9],
    ["cube-010", "cube-012", 1, 0.9],
  ]) {
    const b = new Beads(3000, cube(from), rng(3));
    for (let i = 0; i < 6 * 30; i++) b.step(1 / 30, [{ mode: cube(from), a: 1 }]);
    const d = cellDrive(heardFreq(cube(to)), loud, "cube").modes;
    let t = 0;
    while (b.settled(cube(to)) < 0.5 && t < 4) {
      b.step(1 / 30, d, 0, LIVE.secs);
      t += 1 / 30;
    }
    expect(t, `${from} → ${to} at ${loud}`).toBeLessThan(within);
    // And the figure is as crisp as before once held.
    for (let i = 0; i < 3 * 30; i++) b.step(1 / 30, d, 0, LIVE.secs);
    expect(b.settled(cube(to)), `${from} → ${to}`).toBeGreaterThan(0.85);
  }
});

test("the loudness sets the energy in the cell; a tap's ring keeps its own pace", () => {
  for (const m of ladder("cube")) {
    const lead = (loud) => cellDrive(heardFreq(m), loud, "cube").modes.find((d) => d.mode.id === m.id).a; // prettier-ignore
    expect(lead(1)).toBeCloseTo(1, 6);
    expect(lead(0.25)).toBeCloseTo(0.5, 6); // energy a² = loudness
  }
  // The tap's own mode moves exactly as before (no time scale given).
  const a = new Beads(1500, CELL_MODES[2], rng(4));
  const b = new Beads(1500, CELL_MODES[2], rng(4));
  for (let i = 0; i < 20; i++) {
    a.step(1 / 30, 1);
    b.step(1 / 30, 1, 0, 1.1);
  }
  expect(Array.from(a.P)).toEqual(Array.from(b.P));
  expect(LIVE.secs).toBeLessThan(0.5);
});

// ---- 2. The modes explained, in Node ---------------------------------------------------

test("the info panel explains every mode with its real pitch, and names its sources", () => {
  const text = modesInfo()
    .flatMap(([h, p]) => [h, ...p])
    .join("\n");
  for (const m of CELL_MODES) {
    expect(MODE_NOTES[m.id], m.id).toBeTruthy();
    expect(text).toContain(`${m.name} (${(cellFreq(m) / 1000).toFixed(0)} kHz`);
  }
  for (const m of [...ladder("cube"), ...ladder("flask")]) expect(MODE_NOTES[m.id], m.id).toBeTruthy(); // prettier-ignore
  // Plain words first, then the equation, the boundary condition, how a
  // pitch picks a mode, the defense, and what is a model.
  expect(modesInfo()[0][0]).toBe("In plain words");
  for (const w of ["Helmholtz", "rigid wall", "j_l′(ka) = 0", "√(l² + m² + n²)", "256", "Gor'kov", "Model choices"]) // prettier-ignore
    expect(text, w).toContain(w);
  for (const ref of ["Bruus", "Muller", "Ghanem", "Andrade", "Skrodzki", "Mehl"]) expect(text, ref).toContain(ref); // prettier-ignore
  // The example in the text is right: A4 rings the cube's 1, 1, 0 mode.
  const a4 = cellDrive(440, 1, "cube");
  expect(a4.modes.reduce((b, d) => (!b || d.a > b.a ? d : b)).mode.id).toBe("cube-110");
  expect(Math.round(a4.ultra / 1000)).toBe(113);
});

// ---- 3. Colors, in Node -----------------------------------------------------------------

test("colors: the default look is unchanged, and old scenes keep it", () => {
  const tone = Array.from({ length: 50 }, (_, i) => hash01(i + 100));
  const asMade = (i) => mix("#c8701f", "#eba443", tone[i]);
  const p = paint(50, { colors: "amber" }, { asMade, tone, pale: 0.78 });
  for (let i = 0; i < 50; i++) for (let a = 0; a < 3; a++) expect(p[i * 3 + a]).toBeCloseTo(asMade(i)[a], 6); // prettier-ignore
  // A scene or link with no color setting resolves to the default.
  expect(resolveOptions(RECIPES["chladni-cell"], { mode: "cube-111" }).colors).toBe("amber");
  expect(resolveOptions(RECIPES["chladni-plate"], { mode: "2-3+" }).colors).toBe("sand");
  expect(resolveOptions(RECIPES["chladni-cell"], { colors: "bogus" }).colors).toBe("amber");
});

test("colors: one, a few, a flag's, and the gradients", () => {
  const n = 600;
  const tone = Array.from({ length: n }, (_, i) => hash01(i));
  const asMade = () => [1, 0, 1];
  // One color: every grain within a shade of it.
  const one = paint(n, { colors: "one", color: "#2f7fd8" }, { asMade, tone });
  for (let i = 0; i < n; i++) {
    const r = one[i * 3 + 2] / Math.max(1e-6, one[i * 3]);
    expect(r).toBeCloseTo(0xd8 / 0x2f, 1);
  }
  // A few colors: each palette color is used.
  const pal = PALETTES.find((q) => q.id === "candy");
  const few = paint(n, { colors: "few", palette: "candy" }, { asMade, tone });
  const hues = new Set();
  for (let i = 0; i < n; i++) hues.add([0, 1, 2].map((a) => Math.round((few[i * 3 + a] / Math.max(...[0, 1, 2].map((b) => few[i * 3 + b]))) * 4)).join()); // prettier-ignore
  expect(hues.size).toBeGreaterThanOrEqual(pal.colors.length);
  // A flag (here three equal stripes, as France's): its colors in their shares.
  const W = 90;
  const H = 60;
  const px = new Uint8ClampedArray(W * H * 4);
  const stripes = [
    [0, 38, 84],
    [255, 255, 255],
    [206, 17, 38],
  ];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = stripes[Math.floor(x / 30)];
      px.set([...c, 255], (y * W + x) * 4);
    }
  const f = flagShares(px);
  expect(f.length).toBe(3);
  for (const s of f) expect(s.share).toBeCloseTo(1 / 3, 2);
  const fl = paint(n, { colors: "flag" }, { asMade, tone, flag: f, pale: 0.78 });
  // White beads stay visible on the light stage: pale gray, not white.
  let whites = 0;
  for (let i = 0; i < n; i++) {
    const m = Math.min(fl[i * 3], fl[i * 3 + 1], fl[i * 3 + 2]);
    expect(m).toBeLessThanOrEqual(0.7801);
    if (m > 0.7) whites++;
  }
  expect(whites / n).toBeGreaterThan(0.25);
  expect(whites / n).toBeLessThan(0.42);
  // The gradients run the palette from end to end.
  const v = PALETTES[0].colors;
  expect(gradient({ palette: "viridis" }, 0).map((x) => Math.round(x * 255))).toEqual([0x44, 0x01, 0x54]); // prettier-ignore
  expect(gradient({ palette: "viridis" }, 1).map((x) => Math.round(x * 255))).toEqual([0xfd, 0xe7, 0x25]); // prettier-ignore
  expect(v.length).toBe(5);
  // Only the options a choice uses show; a change of colors only is told apart.
  let now = "amber";
  const opts = colorOptions("cell", { id: "amber", label: "Amber" }, () => now);
  const shown = () => opts.filter((o) => !o.hidden).map((o) => o.key);
  expect(shown()).toEqual(["colors"]);
  now = "flag";
  expect(shown()).toEqual(["colors", "flag"]);
  now = "height";
  expect(shown()).toEqual(["colors", "palette"]);
  expect(colorOptions("plate", { id: "sand", label: "Sand" }, () => "").find((o) => o.key === "colors").choices.map((c) => c.id)).toEqual(["sand", "one", "few", "flag"]); // prettier-ignore
  expect(colorsOnly({ mode: "a", colors: "amber" }, { mode: "a", colors: "flag" })).toBe(true);
  expect(colorsOnly({ mode: "a", colors: "amber" }, { mode: "b", colors: "flag" })).toBe(false);
  expect(colorsOnly({ mode: "a" }, { mode: "a" })).toBe(false);
});

// ---- In the browser ---------------------------------------------------------------------

test.describe("in the browser", () => {
  test.describe.configure({ timeout: 300_000 });
  test.use({ viewport: { width: 390, height: 844 } });

  test("Sound in a box: colors as chosen, a flag's from its image, the beads kept in place; the info panel", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
    await until(page, async (m) => document.getElementById("progress").hidden && (await import(m)).cellState().n > 0, BOX); // prettier-ignore
    const state = () => page.evaluate(async (m) => (await import(m)).cellState(), BOX);
    expect((await state()).colors).toBe("amber");
    // Only "Bead colors" shows until a choice needs more.
    const labels = () => page.$$eval("#toy-options .row > span:first-child", (els) => els.map((e) => e.textContent)); // prettier-ignore
    expect(await labels()).toEqual(["Mode", "Bead colors"]);
    // Ring the cell and let the figure form, then change the colors: the
    // beads stay where they are.
    await page.evaluate(() => window.__splashery.player.act(null));
    await until(page, async (m) => (await import(m)).cellState().settled > 0.6, BOX, 60_000);
    const before = await page.evaluate(async (m) => (await import(m)).cellAudioState().at, BOX);
    await page.evaluate(() => window.__splashery.app.setToyOptions({ colors: "flag", flag: "ua" }));
    await until(page, async (m) => (await import(m)).cellState().colors === "flag", BOX);
    expect(await labels()).toEqual(["Mode", "Bead colors", "Flag"]);
    const after = await page.evaluate(async (m) => (await import(m)).cellAudioState().at, BOX);
    expect(after).toEqual(before);
    // The flag's colors, read from its image: Ukraine's blue and yellow.
    await until(page, async (m) => { const p = (await import(m)).cellState().paint; return p.length && p[0] + p[1] + p[2] !== 0 && !(p[0] > 0.7 && p[1] < 0.5 && p[2] < 0.25); }, BOX, 30_000); // prettier-ignore
    const p = (await state()).paint;
    for (let i = 0; i < 10; i++) {
      const [r, g, b] = p.slice(i * 3, i * 3 + 3);
      const blue = b > r + 0.2 && b > g;
      const yellow = r > 0.6 && g > 0.5 && b < 0.3;
      expect(blue || yellow, `bead ${i}: ${[r, g, b]}`).toBe(true);
    }
    // By height: the palette shows.
    await page.evaluate(() => window.__splashery.app.setToyOptions({ colors: "height" }));
    await until(page, async (m) => (await import(m)).cellState().colors === "height", BOX);
    expect(await labels()).toEqual(["Mode", "Bead colors", "Palette"]);
    // The info panel, in the Toy tab.
    const panel = page.locator("#cell-modes");
    await expect(panel).toHaveCount(1);
    await expect(panel.locator("summary")).toContainText("What are these modes?");
    for (const w of ["In plain words", "Helmholtz", "Cube 1, 1, 0", "Flask, double cone", "Bruus"])
      await expect(panel).toContainText(w);
    expect(errors).toEqual([]);
  });

  test("the Chladni plate: sand colors as chosen, the sand kept in place", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-plate"));
    await until(page, async (m) => document.getElementById("progress").hidden && (await import(m)).chladniSand().n > 0, STUDIO); // prettier-ignore
    const sand = () => page.evaluate(async (m) => (await import(m)).chladniSand(), STUDIO);
    expect((await sand()).colors).toBe("sand");
    // The default sand is pale, as made.
    for (const v of (await sand()).paint) expect(v).toBeGreaterThan(0.6);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(2500);
    const before = (await sand()).at;
    await page.evaluate(() => window.__splashery.app.setToyOptions({ colors: "one", color: "#d02040" })); // prettier-ignore
    await until(page, async (m) => (await import(m)).chladniSand().colors === "one", STUDIO);
    const s = await sand();
    // (The bow may still be moving it: the grains are where they were, give
    // or take this frame's hop.)
    for (let i = 0; i < before.length; i++) expect(Math.abs(s.at[i] - before[i])).toBeLessThan(0.05); // prettier-ignore
    for (let i = 0; i < 10; i++) {
      const [r, g, b] = s.paint.slice(i * 3, i * 3 + 3);
      expect(r).toBeGreaterThan(g * 3);
      expect(r).toBeGreaterThan(b * 2);
    }
    expect(errors).toEqual([]);
  });
});

// ---- Screenshots (lv10-*.png) -------------------------------------------------------------

test.describe("screenshots", () => {
  test.describe.configure({ timeout: 300_000 });
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`Sound in a box colored by height, and its modes panel, at ${w}×${h}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
      await until(page, async (m) => document.getElementById("progress").hidden && (await import(m)).cellState().n > 0, BOX); // prettier-ignore
      await page.evaluate(() => window.__splashery.app.setToyOptions({ mode: "cube-111", colors: "height" })); // prettier-ignore
      await until(page, async (m) => (await import(m)).cellState().mode === "cube-111", BOX);
      await page.evaluate(() => window.__splashery.player.act(null));
      await until(page, async (m) => (await import(m)).cellState().settled > 0.8, BOX, 60_000);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/screenshots/lv10-cell-height-${w}x${h}.png` });
      // The modes panel, open in the Toy tab.
      await page.evaluate(() => {
        window.__splashery.app.ui.showTab("play");
        const d = document.getElementById("cell-modes");
        d.open = true;
        d.scrollIntoView({ block: "start" });
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `tests/screenshots/lv10-cell-modes-${w}x${h}.png` });
    });
    test(`the Chladni plate in a flag's colors at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("chladni-plate"));
      await until(page, async (m) => document.getElementById("progress").hidden && (await import(m)).chladniSand().n > 0, STUDIO); // prettier-ignore
      await page.evaluate(() =>
        window.__splashery.app.setToyOptions({ colors: "flag", flag: "br" }),
      );
      await until(page, async (m) => { const s = (await import(m)).chladniSand(); return s.colors === "flag" && s.paint[1] < 0.8; }, STUDIO, 30_000); // prettier-ignore
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `tests/screenshots/lv10-plate-flag-${w}x${h}.png` });
    });
  }
});
