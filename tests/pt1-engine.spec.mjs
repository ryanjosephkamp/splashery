// Lane PT1 (engine): a toy's own tool row over the stage (recipe.toolbar),
// paint and option switches handed back by a toy's tools, action.play for
// the Play button, and the keyboard panel kept open while the same toy
// rebuilds. Every toy without these hooks is unchanged.
import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&profile=weak&adapt=off";

async function open(page, width = 390, height = 844) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width, height });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

test("no toy shows a tool row unless its recipe has one", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("#toy-toolbar")).toBeHidden();
  await page.evaluate(() => window.__splashery.app.chooseToy("xylophone"));
  await expect(page.locator("#toy-status")).toContainText(/Xylophone/i);
  await expect(page.locator("#toy-toolbar")).toBeHidden();
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`a recipe's tool row shows over the stage, follows its items, and paints at ${width}×${height}`, async ({
    page,
  }) => {
    const errors = await open(page, width, height);
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/music.js");
      const r = RECIPES.xylophone;
      window.pt1 = { tool: "a", calls: [] };
      r.toolbar = {
        label: "Test tools",
        items: () => [
          { id: "a", text: "Alpha", pressed: window.pt1.tool === "a" },
          { id: "b", text: "Beta", pressed: window.pt1.tool === "b" },
          {
            id: "red",
            text: "Red",
            label: "Paint red",
            color: "#e81c2e",
            hidden: window.pt1.tool !== "b",
          },
          { id: "wash", text: "Wash it off", hidden: window.pt1.tool !== "b" },
          { id: "off", text: "Off", disabled: true },
        ],
        activate(id) {
          window.pt1.calls.push(id);
          if (id === "a" || id === "b") window.pt1.tool = id;
          if (id === "red") return { paint: { at: [0, 0, 0], radius: 0.3, color: "#e81c2e" } };
          if (id === "wash") return { clearPaint: true };
          return null;
        },
      };
      await window.__splashery.app.loadToy({ kind: "builtin", id: "xylophone" });
    });
    const row = page.locator("#toy-toolbar");
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("aria-label", "Test tools");
    await expect(row.locator("button:visible")).toHaveCount(3);
    await expect(row.locator('[data-toy-tool="a"]')).toHaveAttribute("aria-pressed", "true");
    await row.locator('[data-toy-tool="b"]').click();
    await expect(row.locator('[data-toy-tool="b"]')).toHaveAttribute("aria-pressed", "true");
    await expect(row.locator('[data-toy-tool="red"]')).toBeVisible();
    await row.locator('[data-toy-tool="off"]').dispatchEvent("click");
    await row.locator('[data-toy-tool="red"]').click();
    const stamps = () => page.evaluate(() => window.__splashery.player.scene.paint.stamps.length);
    expect(await stamps()).toBe(1);
    const stamp = await page.evaluate(() => window.__splashery.player.scene.paint.stamps[0]);
    expect(stamp[4]).toBe("#e81c2e");
    expect(stamp.slice(0, 4).every(Number.isFinite)).toBe(true);
    await row.locator('[data-toy-tool="wash"]').click();
    expect(await stamps()).toBe(0);
    expect(await page.evaluate(() => window.pt1.calls)).toEqual(["b", "red", "wash"]);
    // The row stays inside the screen and clear of the canvas's edges.
    const box = await row.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `tests/screenshots/pt1-engine-toolbar-${width}x${height}.png` });
    // Another toy hides it.
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    await expect(row).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("a drag's paint result paints one stamp and is not also a tap", async ({ page }) => {
  const errors = await open(page);
  const out = await page.evaluate(async () => {
    const { player } = window.__splashery;
    await window.__splashery.app.chooseToy("xylophone");
    const before = player.motion.tap?.n ?? 0;
    player.dragFired = false;
    player.fireDrag({ paint: { at: [0.1, 0, 0], radius: 0.2, color: "#6a2cff" } });
    return {
      stamps: player.scene.paint.stamps.length,
      color: player.scene.paint.stamps[0]?.[4],
      fired: player.dragFired,
      taps: (player.motion.tap?.n ?? 0) - before,
    };
  });
  expect(out).toEqual({ stamps: 1, color: "#6a2cff", fired: true, taps: 0 });
  expect(errors).toEqual([]);
});

test("action.play answers the Play button and may switch the toy's options", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/music.js");
    const r = RECIPES.xylophone;
    window.pt1Play = 0;
    r.action.play = () => {
      window.pt1Play++;
      return { options: { pt1: String(window.pt1Play) } };
    };
    await window.__splashery.app.chooseToy("xylophone");
  });
  await page.evaluate(() => window.__splashery.player.act());
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.scene.toy.options?.pt1))
    .toBe("1");
  expect(await page.evaluate(() => window.pt1Play)).toBe(1);
  // A tap with a point still goes to action.at (or the plain action).
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/music.js");
    delete RECIPES.xylophone.action.play;
  });
  expect(errors).toEqual([]);
});

test("the keyboard panel stays open while the same toy rebuilds from it", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/music.js");
    const r = RECIPES.xylophone;
    r.keyboard = {
      label: "Edit",
      items: () => [{ id: "more", text: "More", label: "Add one" }],
      activate: () => ({ options: { pt1: String(Math.random()) } }),
    };
    await window.__splashery.app.chooseToy("xylophone");
    window.__splashery.app.ui.setSheetStop("panel");
  });
  await page.locator("#tab-play").click();
  await page.locator("#toy-keyboard summary").click();
  await expect(page.locator("#toy-keyboard")).toHaveJSProperty("open", true);
  const first = await page.evaluate(() => window.__splashery.player.toyInfo);
  await page.locator("#toy-keyboard-controls button").first().click();
  await page.waitForFunction(
    (old) => window.__splashery.player.scene.toy.options?.pt1 !== old,
    first?.options?.pt1,
  );
  await page.waitForFunction(() => !window.__splashery.player.switching);
  await expect(page.locator("#toy-keyboard")).toHaveJSProperty("open", true);
  await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
  await page.evaluate(async () => {
    await window.__splashery.app.chooseToy("xylophone");
  });
  await expect(page.locator("#toy-keyboard")).toHaveJSProperty("open", false);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/music.js");
    delete RECIPES.xylophone.keyboard;
  });
  expect(errors).toEqual([]);
});

// Engine r2: tinted chips, and a tool row item's key answering ahead of the
// site's own number keys (only while that toy is shown).
test("tool row items may carry a tint and a key", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/music.js");
    window.pt1k = [];
    RECIPES.xylophone.toolbar = {
      label: "Keys",
      items: () => [
        { id: "a", text: "Alpha", tint: "#ff3d8b", key: "1" },
        { id: "b", text: "Beta", tint: "#96f0ff", key: "2", hidden: true },
      ],
      activate(id) {
        window.pt1k.push(id);
        return null;
      },
    };
    await window.__splashery.app.chooseToy("xylophone");
  });
  const a = page.locator('#toy-toolbar [data-toy-tool="a"]');
  await expect(a).toHaveClass(/tinted-tool/);
  await expect(a).toHaveAttribute("aria-keyshortcuts", "1");
  const bg = await a.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  await page.locator("#stage").focus();
  await page.keyboard.press("1");
  await page.keyboard.press("2"); // hidden: the site's own key (Poke) instead
  expect(await page.evaluate(() => window.pt1k)).toEqual(["a"]);
  expect(await page.evaluate(() => window.__splashery.app.tool)).toBe("poke");
  // Another toy: 1 is the site's Orbit again.
  await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
  await page.locator("#stage").focus();
  await page.keyboard.press("1");
  expect(await page.evaluate(() => window.__splashery.app.tool)).toBe("orbit");
  expect(await page.evaluate(() => window.pt1k)).toEqual(["a"]);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/music.js");
    delete RECIPES.xylophone.toolbar;
  });
  expect(errors).toEqual([]);
});
