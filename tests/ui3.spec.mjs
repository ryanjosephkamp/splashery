// Lane UI r3: a long tap effect pauses and resumes (its sound too), toys that
// read like a chart, a page or an instrument hold still (turntable off, tilt
// locked), and the top bar's flag button sets flag colors for every toy.

import { test, expect } from "@playwright/test";
import { encodeSceneHash } from "../src/codec.js";
import { TOYS, holdsStill } from "../src/toys.js";

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SHOTS = new URL("./screenshots/", import.meta.url);
const shot = (name) => new URL(name, SHOTS).pathname;

async function open(page, hash = "") {
  await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
  await page.goto(`/?renderer=webgl2&profile=weak${hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// The action control's eased value, its state, the sound events scheduled so
// far, the tap count and the action button's label.
const look = (page) =>
  page.evaluate(() => {
    const { player, app } = window.__splashery;
    const m = player.motion;
    const k = m.recipe.action.key;
    return {
      v: m.state[k],
      state: m.effectState(),
      sched: app.sound.scheduled,
      n: m.tap?.n ?? 0,
      label: document.querySelector("#toy-action").textContent.trim(),
    };
  });

test.describe("pause and resume", () => {
  test.use(DESK);

  test("the second tap freezes a long effect and its sound, the third resumes it, and a tap after the end starts it again", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "toy-piano");
    const start = await look(page);
    expect(start.state).toBeNull();
    // First tap: the tune plays (a click, so the page may make sound).
    await page.click("#toy-action");
    await page.waitForFunction(() => window.__splashery.player.motion.effectState() === "running");
    await page.waitForTimeout(1200);
    const playing = await look(page);
    expect(playing.sched).toBeGreaterThan(start.sched);
    expect(playing.label).toBe("Pause");
    // Second tap: it pauses, and no new sound is scheduled while it waits.
    await page.click("#toy-action");
    const paused = await look(page);
    expect(paused.state).toBe("paused");
    await page.waitForTimeout(1500);
    const still = await look(page);
    expect(still.v).toBe(paused.v);
    expect(still.sched).toBe(paused.sched);
    expect(still.label).toBe("Resume");
    await page.screenshot({ path: shot("ui3-paused-1440x900.png") });
    // Third tap: it carries on from the same place (same tap, same position).
    await page.click("#toy-action");
    const resumed = await look(page);
    expect(resumed.state).toBe("running");
    expect(resumed.n).toBe(playing.n);
    expect(Math.abs(resumed.v - paused.v)).toBeLessThan(0.02);
    await page.waitForTimeout(1200);
    const later = await look(page);
    expect(later.v).toBeLessThan(resumed.v);
    expect(later.sched).toBeGreaterThan(still.sched);
    // Once it has finished, a tap starts it again from the top.
    await page.evaluate(() => {
      const m = window.__splashery.player.motion;
      m.state[m.recipe.action.key] = 0; // the tune has run to its end
    });
    await page.click("#toy-action");
    const again = await look(page);
    expect(again.state).toBe("running");
    expect(again.n).toBe(later.n + 1);
    expect(again.v).toBeGreaterThan(0.95);
    expect(errors).toEqual([]);
  });

  test("a tune never overlaps itself: a new play stops the old one", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "toy-piano");
    await page.click("#toy-action");
    await page.waitForTimeout(600);
    const first = await page.evaluate(() => {
      const h = window.__splashery.app.sound.held.toy;
      window.__firstTune = h;
      return h.i;
    });
    expect(first).toBeGreaterThan(0);
    // It ends (as if run through) and is played again while notes remain.
    await page.evaluate(() => {
      const m = window.__splashery.player.motion;
      m.state[m.recipe.action.key] = 0;
    });
    await page.click("#toy-action");
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const s = window.__splashery.app.sound;
      return { held: Object.keys(s.held), same: s.held.toy === window.__firstTune, oldAt: window.__firstTune.i }; // prettier-ignore
    });
    expect(r.held).toEqual(["toy"]);
    expect(r.same).toBe(false);
    // The first tune scheduled nothing more after it was stopped.
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__firstTune.i)).toBe(r.oldAt);
    expect(errors).toEqual([]);
  });

  test("a short effect restarts on a second tap, as before", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "popcorn");
    await page.click("#toy-action");
    await page.waitForTimeout(300);
    const one = await look(page);
    expect(one.state).toBeNull(); // short: never "running" in the pause sense
    await page.click("#toy-action");
    const two = await look(page);
    expect(two.n).toBe(one.n + 1);
    expect(two.v).toBeGreaterThan(0.95);
    expect(two.label).not.toBe("Pause");
    expect(errors).toEqual([]);
  });
});

test.describe("toys that hold still", () => {
  test.use(PHONE);

  test("every listed toy and shelf holds still", () => {
    for (const shelf of ["computing", "music", "objects"])
      for (const t of TOYS.filter((x) => x.category === shelf)) expect(holdsStill(t), t.id).toBe(true); // prettier-ignore
    for (const id of ["graph-plotter", "surface-plotter", "unit-circle", "fourier-circles", "pythagoras-proof", "chess-set", "puzzle-cube", "periodic-table", "splat-equation", "chladni-plate", "anatomy-atlas"]) // prettier-ignore
      expect(holdsStill(TOYS.find((t) => t.id === id)), id).toBe(true);
    for (const id of ["donut", "cactus", "basketball", "earth"])
      expect(holdsStill(TOYS.find((t) => t.id === id)), id).toBe(false);
  });

  test("the listed toys open with the turntable off and the tilt locked; the choice to spin one holds for it", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    const view = () => page.evaluate(() => ({ spin: window.__splashery.player.camera.turntable, lock: window.__splashery.player.camera.tiltLock })); // prettier-ignore
    for (const id of [
      "graph-plotter",
      "fourier-circles",
      "chess-set",
      "puzzle-cube",
      "toy-piano",
      "laptop",
      "cnn",
      "periodic-table",
      "splat-equation",
      "anatomy-atlas",
    ]) {
      // prettier-ignore
      await pick(page, id);
      expect(await view(), id).toEqual({ spin: false, lock: true });
      if (id === "fourier-circles") await page.screenshot({ path: shot("ui3-still-390x844.png") });
    }
    // Any other toy spins as before.
    await pick(page, "donut");
    expect(await view()).toEqual({ spin: true, lock: false });
    // The turntable switched on for a still toy holds for that toy, and the
    // device's own choice is untouched.
    await pick(page, "graph-plotter");
    await page.click("#turntable-toggle");
    expect((await view()).spin).toBe(true);
    await pick(page, "donut");
    expect((await view()).spin).toBe(true);
    await pick(page, "graph-plotter");
    expect((await view()).spin).toBe(true);
    await pick(page, "chess-set");
    expect((await view()).spin).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("splashery.turntable"))).toBeNull();
    expect(errors).toEqual([]);
  });

  test("an old link and a saved scene keep their own camera and turntable", async ({ page }) => {
    const errors = watchErrors(page);
    const camera = { yaw: 1.1, pitch: 0.35, roll: 0, distance: 4.2 };
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 2,
      seed: 3,
      toy: { kind: "builtin", id: "graph-plotter" },
      camera,
      autoplay: { turntable: true, effect: "none" },
    });
    await open(page, `#s=${hash}`);
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "graph-plotter", null, { timeout: 120_000 }); // prettier-ignore
    const s = await page.evaluate(() => window.__splashery.exportScene());
    expect(s.camera).toEqual(camera);
    expect(s.autoplay.turntable).toBe(true);
    expect(await page.evaluate(() => window.__splashery.player.camera.turntable)).toBe(true);
    // A saved scene (schema v3) opened from a file keeps its camera too.
    const saved = { ...s, camera: { yaw: -0.7, pitch: 0.2, roll: 0, distance: 3.6 } };
    await page.evaluate(async (obj) => {
      const f = new File([JSON.stringify(obj)], "saved.json", { type: "application/json" });
      await window.__splashery.app.importJSONFile(f);
    }, saved);
    const s2 = await page.evaluate(() => window.__splashery.exportScene());
    expect(s2.camera).toEqual(saved.camera);
    expect(errors).toEqual([]);
  });
});

test.describe("the flag button", () => {
  for (const [name, use] of [
    ["390x844", PHONE],
    ["1440x900", DESK],
  ]) {
    test.describe(name, () => {
      test.use(use);
      test(`sets flag colors for every toy (${name})`, async ({ page }) => {
        const errors = watchErrors(page);
        await open(page);
        await pick(page, "donut");
        await page.click("#flag-toggle");
        await expect(page.locator("#flag-pop")).toBeVisible();
        await page.waitForFunction(() => document.querySelectorAll("#flag-global option").length > 150); // prettier-ignore
        await page.screenshot({ path: shot(`ui3-flag-${name}.png`) });
        await page.selectOption("#flag-global", "fr");
        await expect(page.locator("#flag-pop")).toBeHidden();
        await expect(page.locator("#flag-toggle")).toHaveAttribute("aria-pressed", "true");
        const pattern = () => page.evaluate(() => window.__splashery.player.scene.pattern);
        expect(await pattern()).toMatchObject({ id: "flag", flag: "fr" });
        for (const id of ["strawberry", "basketball", "donut"]) {
          await pick(page, id);
          expect(await pattern(), id).toMatchObject({ id: "flag", flag: "fr" });
        }
        await expect(page.locator("#toy-status")).toContainText("France");
        // No flag takes it off every toy.
        await page.click("#flag-toggle");
        await page.selectOption("#flag-global", "");
        expect((await pattern()).id).toBe("none");
        await pick(page, "strawberry");
        expect((await pattern()).id).toBe("none");
        expect(errors).toEqual([]);
      });
    });
  }
});
