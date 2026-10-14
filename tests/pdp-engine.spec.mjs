// Lane Photo depth, the engine part (docs/handoff/PhotoDepth.md): the depth slider over the stage
// can be dragged anywhere on it (its small button too), is remembered on this device per layout,
// stays inside the stage as it changes size (full screen on a computer re-centers it), and puts
// itself back with a double-click or Home. A recipe may pick its tap sound from its options.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const KEY = "splashery.stageDialPos";

async function start(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "photo-3d");
  await expect(page.locator("#stage-dial")).toBeVisible();
}

const rect = (page, sel) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; // prettier-ignore
  }, sel);

function inside(a, s) {
  expect(a.x).toBeGreaterThanOrEqual(s.x - 0.5);
  expect(a.y).toBeGreaterThanOrEqual(s.y - 0.5);
  expect(a.x + a.w).toBeLessThanOrEqual(s.x + s.w + 0.5);
  expect(a.y + a.h).toBeLessThanOrEqual(s.y + s.h + 0.5);
}

// Drags an element by a point on it (its name, for the slider) to a place on screen.
async function drag(page, sel, to) {
  const b = await rect(page, sel);
  await page.mouse.move(b.cx, b.cy);
  await page.mouse.down();
  await page.mouse.move(b.cx + 10, b.cy + 10, { steps: 2 });
  await page.mouse.move(to[0], to[1], { steps: 6 });
  await page.mouse.up();
}

for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  test.describe(`at ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("the slider drags, stays inside the stage, is remembered, and goes back", async ({
      page,
    }) => {
      await start(page);
      const before = await rect(page, "#stage-dial");
      const stage = await rect(page, "#stage");
      // Dragged by its name to the stage's left side: it goes there and the value is untouched.
      const to = [stage.x + stage.w * 0.2, stage.y + stage.h * 0.55];
      const grip = await rect(page, "#stage-dial-label");
      await drag(page, "#stage-dial-label", to);
      const after = await rect(page, "#stage-dial");
      // (the point held, its name, lands where it was dropped)
      expect(Math.abs(after.cx - (to[0] - grip.cx + before.cx))).toBeLessThan(3);
      expect(Math.abs(after.cy - (to[1] - grip.cy + before.cy))).toBeLessThan(3);
      expect(after.cx).toBeLessThan(before.cx - 50);
      await expect(page.locator("#stage-dial-input")).toHaveValue("0.5");
      const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
      const lay = w <= 760 ? "phone" : "wide";
      expect(Object.keys(saved)).toEqual([lay]);
      expect(saved[lay][0]).toBeCloseTo((after.cx - stage.x) / stage.w, 2);

      // Past the stage's edge: clamped inside it.
      await drag(page, "#stage-dial-label", [stage.x - 200, stage.y + stage.h + 300]);
      inside(await rect(page, "#stage-dial"), stage);

      // Arrow keys move it while its name has the focus; Home puts it back.
      await drag(page, "#stage-dial-label", to);
      await page.locator("#stage-dial-label").focus();
      const a0 = await rect(page, "#stage-dial");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Shift+ArrowDown");
      const a1 = await rect(page, "#stage-dial");
      expect(Math.round(a1.cx - a0.cx)).toBe(10);
      expect(Math.round(a1.cy - a0.cy)).toBe(40);

      // Remembered after a reload, at the same place.
      await page.reload();
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
      await expect(page.locator("#stage-dial")).toBeVisible();
      const again = await rect(page, "#stage-dial");
      expect(Math.abs(again.cx - a1.cx)).toBeLessThan(2);
      expect(Math.abs(again.cy - a1.cy)).toBeLessThan(2);

      // A double-click on its frame puts it back where it starts.
      await page.locator("#stage-dial-label").dblclick();
      const home = await rect(page, "#stage-dial");
      expect(Math.abs(home.cx - before.cx)).toBeLessThan(2);
      expect(Math.abs(home.cy - before.cy)).toBeLessThan(2);
      expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)).toEqual({});

      // Home, with the focus on its name.
      await drag(page, "#stage-dial-label", to);
      await page.locator("#stage-dial-label").focus();
      await page.keyboard.press("Home");
      const home2 = await rect(page, "#stage-dial");
      expect(Math.abs(home2.cx - before.cx)).toBeLessThan(2);
    });

    test("the small Depth button drags too, and a tap still shows the slider", async ({ page }) => {
      await start(page);
      await page.locator("#stage-dial-hide").click();
      const show = page.locator("#stage-dial-show");
      await expect(show).toBeVisible();
      const stage = await rect(page, "#stage");
      const to = [stage.x + stage.w * 0.3, stage.y + stage.h * 0.7];
      await drag(page, "#stage-dial-show", to);
      // A drag isn't a tap: it stays hidden, and the button is where it was dropped.
      await expect(show).toBeVisible();
      const b = await rect(page, "#stage-dial-show");
      expect(Math.abs(b.cx - to[0])).toBeLessThan(3);
      expect(Math.abs(b.cy - to[1])).toBeLessThan(3);
      // The slider shows at the same place (its center there, kept inside the stage).
      await show.click();
      await expect(page.locator("#stage-dial")).toBeVisible();
      const d = await rect(page, "#stage-dial");
      expect(Math.abs(d.cx - to[0])).toBeLessThan(3);
      inside(d, stage);
      // Arrow keys move the button while it has the focus.
      await page.locator("#stage-dial-hide").click();
      await show.focus();
      const s0 = await rect(page, "#stage-dial-show");
      await page.keyboard.press("ArrowLeft");
      const s1 = await rect(page, "#stage-dial-show");
      expect(Math.round(s1.cx - s0.cx)).toBe(-10);
      await expect(page.locator("#stage-dial")).toBeHidden();
    });
  });
}

test.describe("full screen on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("focus mode gives the panel's room to the stage, and the slider follows", async ({
    page,
  }) => {
    await start(page);
    const panelW = () =>
      page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--panel-w").trim());
    expect(await panelW()).not.toBe("0px");
    const open = await rect(page, "#stage-dial");
    await page.evaluate(() => document.getElementById("focus-toggle").click());
    await expect(page.locator("body")).toHaveClass(/focus/);
    expect(await panelW()).toBe("0px");
    // At its usual place, at the full-screen stage's right edge (not where the panel was).
    const stage = await rect(page, "#stage");
    expect(stage.w).toBeGreaterThan(1400);
    const full = await rect(page, "#stage-dial");
    expect(full.cx).toBeGreaterThan(open.cx + 200);
    expect(stage.x + stage.w - (full.x + full.w)).toBeLessThan(80);
    // The toy's own slider (#toy-slider) and the rest center on the whole stage.
    const center = await page.evaluate(() => {
      const el = document.getElementById("toy-slider");
      el.hidden = false;
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    expect(Math.abs(center - stage.cx)).toBeLessThan(30);

    // A place set outside focus mode is the same share of the stage in it.
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/focus/);
    const s0 = await rect(page, "#stage");
    await drag(page, "#stage-dial-label", [s0.x + s0.w * 0.25, s0.y + s0.h * 0.5]);
    const d0 = await rect(page, "#stage-dial");
    const share = (d0.cx - s0.x) / s0.w;
    await page.evaluate(() => document.getElementById("focus-toggle").click());
    await expect(page.locator("body")).toHaveClass(/focus/);
    await page.waitForTimeout(200);
    const s1 = await rect(page, "#stage");
    const d1 = await rect(page, "#stage-dial");
    expect(Math.abs(d1.cx - (s1.x + s1.w * share))).toBeLessThan(3);
  });
});

test.describe("without storage", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("storage that throws: it still drags and hides, for this visit", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const no = () => {
        throw new Error("no storage");
      };
      for (const k of ["getItem", "setItem", "removeItem"])
        Object.defineProperty(Storage.prototype, k, { value: no, configurable: true });
    });
    await start(page);
    const stage = await rect(page, "#stage");
    const to = [stage.x + stage.w * 0.3, stage.y + stage.h * 0.5];
    const d0 = await rect(page, "#stage-dial");
    await drag(page, "#stage-dial-label", to);
    const d = await rect(page, "#stage-dial");
    expect(d.cx).toBeLessThan(d0.cx - 50);
    await page.locator("#stage-dial-hide").click();
    await expect(page.locator("#stage-dial-show")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("the tap sound", () => {
  test("a recipe may pick its tap sound from its options; others keep theirs", async ({ page }) => {
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.recipe);
    const r = await page.evaluate(async () => {
      const app = window.__splashery.app;
      const { toySound } = await import("/src/toy-sounds.js");
      const toy = app.player.scene.toy;
      const recipe = app.player.toyInfo.recipe;
      const had = recipe.toySound;
      const out = {};
      recipe.toySound = undefined;
      out.plain = JSON.stringify(app.ownSound(toy)) === JSON.stringify(toySound("photo-3d"));
      recipe.toySound = (o) => (o.sound === "none" ? [] : null);
      toy.options = { ...toy.options, sound: "none" };
      out.none = app.ownSound(toy);
      toy.options = { ...toy.options, sound: "paper" };
      out.paper = JSON.stringify(app.ownSound(toy)) === JSON.stringify(toySound("photo-3d"));
      recipe.toySound = had;
      out.other = app.ownSound({ kind: "procedural", id: "x" });
      return out;
    });
    expect(r).toEqual({ plain: true, none: [], paper: true, other: null });
  });
});
