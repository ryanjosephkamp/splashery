// Lane Fix6 (docs/handoff/Fix6.md), part 2: the Enigma machine takes typing, the periodic
// table switches elements without a flash and tours them, and the acoustic guitar is smooth.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RECIPES as HISTORY, ENIGMA } from "../src/packs/computing-history.js";

async function open(page, id, { size = [390, 844] } = {}) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id);
  await page.waitForTimeout(800);
}

// Taps the canvas where a recipe point shows.
async function tapAt(page, p) {
  const [x, y] = await page.evaluate((p) => {
    const { player } = window.__splashery;
    const r = player.canvas.getBoundingClientRect();
    const [sx, sy] = player.screenPoint(p);
    return [r.left + sx, r.top + sy];
  }, p);
  await page.mouse.click(x, y);
}

const enigma = (page) => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.pad);
const KEY = (ch) => {
  const rows = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
  const r = rows.findIndex((x) => x.includes(ch));
  const i = rows[r].indexOf(ch);
  return [(i - (rows[r].length - 1) / 2) * 0.155 + (r === 1 ? 0.02 : 0), 0.066, 0.18 + r * 0.15];
};
// The machine's own coding of a message typed from the start.
const code = (msg) =>
  ENIGMA.machine()
    .type(msg, [0, 0, 0])
    .map((e) => ENIGMA.AZ[e.lamp])
    .join("");

test("Enigma: a tapped key types its letter in code, and a keyboard types too", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "enigma-machine");
  // Tapping keys on the machine: each one goes down and writes its letter and code.
  // Wait for each letter before the next tap, so a busy machine can't swap their order.
  for (const [i, ch] of [..."SPL"].entries()) {
    await tapAt(page, KEY(ch));
    await page.waitForFunction((n) => window.__splashery.player.proc.ctx.kit.data.pad.coded.length === n, i + 1, { timeout: 30_000 }); // prettier-ignore
  }
  await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.coded.length === 3, null, { timeout: 30_000 }); // prettier-ignore
  expect(await enigma(page)).toMatchObject({ plain: "SPL", coded: code("SPL"), typed: true });
  // A keyboard: letters type; a plain p and r stay the site's shortcuts, Shift types them.
  await page.keyboard.type("ash");
  await page.keyboard.press("p");
  await page.keyboard.press("Shift+P");
  await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.coded.length === 7, null, { timeout: 30_000 }); // prettier-ignore
  expect(await enigma(page)).toMatchObject({ plain: "SPLASHP", coded: code("SPLASHP") });
  // Typing in a text field never types on the machine.
  const taken = await page.evaluate(() => {
    const field = document.getElementById("toy-input-text");
    let n = 0;
    for (const key of "zzz") {
      const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      field.dispatchEvent(e);
      if (e.defaultPrevented) n++;
    }
    return n;
  });
  expect(taken).toBe(0);
  await page.waitForTimeout(600);
  expect((await enigma(page)).plain).toBe("SPLASHP");
  // A tap off the keys decodes what was typed: the message comes back.
  await page.evaluate(() => window.__splashery.player.act(null));
  await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.dec.length === 7, null, { timeout: 60_000 }); // prettier-ignore
  expect((await enigma(page)).dec).toBe("SPLASHP");
  // The next key starts a clean sheet from the start position.
  await page.keyboard.press("h");
  await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.coded.length === 1, null, { timeout: 30_000 }); // prettier-ignore
  expect(await enigma(page)).toMatchObject({ plain: "H", coded: code("H"), dec: "" });
  // A tap on the pad: a clean sheet.
  await page.waitForTimeout(500);
  await tapAt(page, [0, 0.55, -1.1]);
  await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.plain === "", null, { timeout: 30_000 }); // prettier-ignore
  // Then a tap off the keys types the stored message, and the next decodes it, as before.
  await page.evaluate(() => window.__splashery.player.act(null));
  await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.coded === "ILBDT", null, { timeout: 60_000 }); // prettier-ignore
  expect(await enigma(page)).toMatchObject({ plain: "HELLO", typed: false });
  expect(errors).toEqual([]);
});

test("Enigma: a key press moves the key, steps the rotor and lights its lamp", () => {
  const r = HISTORY["enigma-machine"];
  const data = {
    msg: "HELLO",
    coded: "ILBDT",
    runs: [[], []],
    mach: ENIGMA.machine(),
    m: {},
    run: null,
    key: null,
    home: null,
    pad: { plain: "", coded: "", dec: "", typed: true },
    rest: [0, 0, 0],
  };
  // A tap off the keys always types or decodes: UI r3 never pauses it.
  expect(r.controls.find((c) => c.key === "go").pausable).toBe(false);
  expect(r.typeKey("q")).toEqual({ key: "type", pick: ENIGMA.AZ.indexOf("Q") });
  expect(r.typeKey("p")).toBeNull();
  expect(r.typeKey("r")).toBeNull();
  expect(r.typeKey("1")).toBeNull();
  const frames = [];
  for (let t = 0; t < 0.6; t += 1 / 30) {
    const out = { parts: {}, cues: [], tokens: null };
    r.drive(10 + t, { go: 0, type: 0, clear: 0 }, out, { data });
    frames.push(out);
  }
  const q = ENIGMA.AZ.indexOf("Q");
  expect(Math.min(...frames.map((f) => f.tokens[q].offset[1]))).toBeLessThan(-0.025);
  expect(frames.some((f) => f.tokens[26].visible === 1)).toBe(true);
  expect(frames.at(-1).tokens[q].offset[1]).toBe(0);
  expect(frames.at(-1).tokens[26].visible).toBe(0);
  // The right rotor stepped one place, and stays there.
  expect(frames.at(-1).parts.rotorR.angle).toBeCloseTo((2 * Math.PI) / 26, 5);
  expect(data.pad).toMatchObject({ plain: "Q", coded: code("Q") });
  expect(frames.flatMap((f) => f.cues.map((c) => c.voice))).toEqual(["clack", "ratchet", "click"]); // prettier-ignore
});

const SHOTS = path.resolve("tests/screenshots");
test("Enigma screenshots at 390x844 and 1440x900, typed on", async ({ browser }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage();
    await open(page, "enigma-machine", { size: [w, h] });
    await page.keyboard.type("SPLASHERY");
    await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.pad.coded.length === 9, null, { timeout: 60_000 }); // prettier-ignore
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, `fx6-enigma-machine-${w}x${h}.png`) });
    await page.close();
  }
});

// ---- The periodic table: the tour --------------------------------------------------------

// Taps the periodic table at a recipe point, as a tap on the canvas would.
const tableTap = async (page, which) => {
  await page.waitForFunction(() => window.__splashery.player.motion.ctx?.transform);
  return page.evaluate((which) => {
    const { player } = window.__splashery;
    const recipe = player.toyInfo.recipe;
    const tf = player.motion.ctx.transform;
    // The empty board between hydrogen and helium, at the tiles' depth.
    const h = recipe.tileAt("H");
    const p = which === "board" ? [(h[0] + recipe.tileAt("He")[0]) / 2, h[1], h[2]] : recipe.tileAt(which); // prettier-ignore
    return player.act(p.map((v, i) => (v - tf.center[i]) * tf.scale)).key;
  }, which);
};

// Watches the tour: the elements shown in turn, whether the overlay ever showed, and whether
// the shown tile was lit each time.
async function watchTour(page, n) {
  return page.evaluate(async (n) => {
    const { player } = window.__splashery;
    const el = document.getElementById("progress");
    let overlay = false;
    const mo = new MutationObserver(() => (overlay ||= !el.hidden));
    mo.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    const seen = [];
    const lit = {};
    const t0 = performance.now();
    while (seen.length < n && performance.now() - t0 < 150_000) {
      const sym = player.scene.toy.options?.element;
      if (seen.at(-1) !== sym) seen.push(sym);
      if (player.motion.out?.parts?.halo?.visible === 1) lit[sym] = true;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    mo.disconnect();
    return { seen, overlay, lit };
  }, n);
}

test("periodic table: a tap on the empty board tours the elements by number, with no overlay; a tap stops it", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "periodic-table");
  expect(await tableTap(page, "board")).toBe("walk");
  const r = await watchTour(page, 4);
  // From carbon, the default, to hydrogen and on by atomic number.
  expect(r.seen.filter((s) => s !== "C").slice(0, 3)).toEqual(["H", "He", "Li"]);
  expect(r.overlay).toBe(false);
  expect(r.lit).toMatchObject({ H: true, He: true });
  // A tap stops it: the table stays on that element, its atom up.
  expect(await tableTap(page, "Na")).toBe("walk");
  const stopped = await page.evaluate(() => window.__splashery.player.scene.toy.options.element);
  await page.waitForTimeout(6000);
  expect(await page.evaluate(() => window.__splashery.player.scene.toy.options.element)).toBe(stopped); // prettier-ignore
  expect(await page.evaluate(() => window.__splashery.player.motion.out.parts.halo.visible)).toBe(0); // prettier-ignore
  // The shown element's own tile lowers its atom; another tile raises its own.
  expect(await tableTap(page, stopped)).toBe("up");
  expect(await page.evaluate(() => window.__splashery.player.motion.targets.up)).toBe(0);
  expect(errors).toEqual([]);
});

test("periodic table: the tour's shuffled order", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "periodic-table");
  await page.evaluate(() => window.__splashery.app.setToyOption("tour", "shuffle"));
  await page.waitForTimeout(500);
  await tableTap(page, "board");
  const r = await watchTour(page, 4);
  const { ELEMENT_LIST } = await import("../src/chem/atom-model.js");
  const order = r.seen.filter((s) => s !== "C").slice(0, 3);
  const z = order.map((s) => ELEMENT_LIST.findIndex((e) => e.symbol === s));
  expect(z.every((v) => v >= 0)).toBe(true);
  // Not hydrogen, helium, lithium in a row (a shuffle gives that once in 1.6 million).
  expect(order).not.toEqual(["H", "He", "Li"]);
  await tableTap(page, "board");
});

test("periodic table and Enigma: the help names the new gestures", async () => {
  const { TOY_HELP } = await import("../src/toy-help.js");
  expect(TOY_HELP["periodic-table"].howTo).toMatch(/again to lower/);
  expect(TOY_HELP["periodic-table"].howTo).toMatch(/tour/);
  expect(TOY_HELP["enigma-machine"].howTo).toMatch(/keys/);
  // How-to lines fit the help line (95 characters, tests/hta.spec.mjs).
  for (const id of ["periodic-table", "enigma-machine"])
    expect(TOY_HELP[id].howTo.length).toBeLessThanOrEqual(95);
});

// ---- The acoustic guitar: smooth lacquer, clean strings ----------------------------------

test("guitar: every solid piece is placed evenly with no color noise; the strings still strum", async () => {
  const { RECIPES } = await import("../src/packs/music.js");
  const { buildRecipe } = await import("../src/kit.js");
  const r = RECIPES.guitar;
  const it = buildRecipe(r, { seed: 5, count: 60000, options: { finish: "sunburst" } }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const kit = b.value.kit;
  // The soundboard, back, ribs, neck, fingerboard, headstock, bridge and strings: no grain
  // speckle (the old top had fine sine stripes and every piece random color noise).
  const solid = kit.items.filter((x) => x.kind === "surface");
  expect(solid.length).toBeGreaterThan(20);
  for (const x of solid) {
    expect(x.opts.jitter ?? 0.04).toBe(0);
    expect(x.opts.even).toBe(true);
  }
  // Neighboring splats on the top differ only by the soft sunburst and the light: compare each
  // top splat with the next one along the build (even placement keeps them close).
  const top = solid[0];
  let worst = 0;
  for (let i = top.start + 1; i < top.end; i++) {
    const d = (a, b) => Math.hypot(...[0, 1, 2].map((k) => kit.buf.pos[a * 3 + k] - kit.buf.pos[b * 3 + k])); // prettier-ignore
    if (d(i, i - 1) > 0.02) continue;
    const c = [0, 1, 2].map((k) => Math.abs(kit.buf.color[i * 4 + k] - kit.buf.color[(i - 1) * 4 + k])); // prettier-ignore
    worst = Math.max(worst, ...c);
  }
  expect(worst).toBeLessThan(0.08);
  // A strum still moves every string.
  const out = { parts: {}, cues: [] };
  r.drive(1, { strum: 0.9 }, out, {});
  for (let i = 0; i < 6; i++) expect(Math.abs(out.parts[`s${i}a`].angle)).toBeGreaterThan(0);
});

test("guitar screenshot at 1440x900", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "guitar", { size: [1440, 900] });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "fx6-guitar-1440x900.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "fx6-guitar-390x844.png") });
});
