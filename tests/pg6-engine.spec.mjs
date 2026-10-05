// Lane Pages r6, the engine part (docs/handoff/PagesR6.md): the top bar's
// Pop out (a recipe control marked `global: "pop"`), a tilt a toy frees
// while it asks (out.tiltFree), the slider over the stage (out.slider and
// info.slider), and figure depths in scenes (toy.figures). No toy on main
// uses them yet, so the browser tests lend them to the Picture lab.

import { test, expect } from "@playwright/test";
import { normalizeFigures, normalizeScene, createScene } from "../src/state.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function ready(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "picture-lab" && !window.__splashery.player.loading); // prettier-ignore
}

// Wraps the toy's drive so a test can steer its out (window.__pg6Out) and
// read what it was handed (window.__pg6Info).
async function lend(page, controls = []) {
  await page.evaluate((controls) => {
    const { player } = window.__splashery;
    const recipe = player.toyInfo.recipe;
    recipe.controls = [...(recipe.controls || []), ...controls];
    for (const c of controls) player.motion.setControl(c.key, 0, { snap: true });
    const drive = recipe.drive;
    recipe.drive = (t, c, out, info) => {
      drive?.(t, c, out, info);
      Object.assign(out, window.__pg6Out || {});
      window.__pg6Info = { slider: info.slider, figures: info.figures, pop: c.pop };
    };
  }, controls);
}

async function frames(page, n = 4) {
  for (let i = 0; i < n; i++)
    await page.evaluate(
      () =>
        new Promise((r) => {
          window.__splashery.player.stage.requestRender();
          requestAnimationFrame(() => requestAnimationFrame(r));
        }),
    );
}

test.describe("figure depths (no browser)", () => {
  test("figures are checked, clamped and kept in a scene", () => {
    const f = normalizeFigures([
      { page: 3, box: [0.1, 0.2, 0.5, 0.6], depth: 2.5 },
      { page: -4, box: [0.5, 0.5, 2, 3], depth: 99 },
      { page: 1, box: [0.6, 0.2, 0.5, 0.6], depth: 2 }, // empty box: dropped
      { page: 1, box: [0, 0, 1], depth: 2 }, // not a box: dropped
      "nonsense",
    ]);
    expect(f).toEqual([
      { page: 3, box: [0.1, 0.2, 0.5, 0.6], depth: 2.5 },
      { page: 0, box: [0.5, 0.5, 1, 1], depth: 6 },
    ]);
    expect(normalizeFigures(Array.from({ length: 80 }, () => ({ box: [0, 0, 1, 1] }))).length).toBe(64); // prettier-ignore
    const scene = createScene();
    scene.toy = { kind: "builtin", id: "your-book", figures: [{ page: 2, box: [0.1, 0.1, 0.4, 0.4], depth: 3 }] }; // prettier-ignore
    const back = normalizeScene(JSON.parse(JSON.stringify(scene)));
    expect(back.toy.figures).toEqual([{ page: 2, box: [0.1, 0.1, 0.4, 0.4], depth: 3 }]);
    // Scenes without them (every older scene) have none.
    delete scene.toy.figures;
    expect(normalizeScene(scene).toy.figures).toBeUndefined();
  });
});

test.describe("Pop out, tilt, slider and figures (in the app)", () => {
  test("the top bar's Pop out: shown for a toy that has it, remembered, set on the toy", async ({
    page,
  }) => {
    await ready(page);
    await expect(page.locator("#pop-toggle")).toBeHidden();
    await lend(page, [{ key: "pop", label: "Pop out", type: "toggle", global: "pop" }]);
    await page.evaluate(() => window.__splashery.app.showPopOut(window.__splashery.player.toyInfo));
    const btn = page.locator("#pop-toggle");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    // The first time on a device, a line says where it is.
    await expect(page.locator("#toast")).toContainText("Pop out");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await frames(page);
    const s = await page.evaluate(() => ({
      stored: localStorage.getItem("splashery.popout"),
      control: window.__splashery.player.scene.motion.controls.pop,
      pop: window.__pg6Info.pop,
    }));
    expect(s).toEqual({ stored: "on", control: 1, pop: 1 });
    // It is not a switch in the Toy tab.
    expect(await page.locator("#toy-controls").textContent()).not.toContain("Pop out");
    // A toy without it hides the button.
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "cactus");
    await expect(btn).toBeHidden();
    // Off again, and remembered.
    await page.evaluate(() => window.__splashery.app.togglePopOut());
    expect(await page.evaluate(() => localStorage.getItem("splashery.popout"))).toBe("off");
  });

  test("a scene with Pop out on turns it on for the visit", async ({ page }) => {
    await ready(page);
    await lend(page, [{ key: "pop", label: "Pop out", type: "toggle", global: "pop" }]);
    const on = await page.evaluate(() => {
      const { app, player } = window.__splashery;
      player.scene.motion.controls = { ...player.scene.motion.controls, pop: 1 };
      app.showPopOut(player.toyInfo);
      return { popOut: app.popOut, stored: localStorage.getItem("splashery.popout") };
    });
    expect(on.popOut).toBe(true);
    expect(on.stored).not.toBe("on");
    await expect(page.locator("#pop-toggle")).toHaveAttribute("aria-pressed", "true");
  });

  test("out.tiltFree frees a locked tilt; when it ends the view comes back level", async ({
    page,
  }) => {
    await ready(page);
    await lend(page);
    expect(await page.evaluate(() => window.__splashery.player.camera.tiltLock)).toBe(true);
    await page.evaluate(() => (window.__pg6Out = { tiltFree: true }));
    await frames(page);
    expect(await page.evaluate(() => window.__splashery.player.camera.tiltLock)).toBe(false);
    await expect(page.locator("#tilt-toggle")).toHaveAttribute("aria-pressed", "false");
    await page.evaluate(() => {
      const cam = window.__splashery.player.camera;
      cam.tgt.pitch = 0.6;
      cam.tgt.yaw += 0.5;
    });
    await page.evaluate(() => (window.__pg6Out = {}));
    await frames(page);
    const cam = await page.evaluate(() => {
      const c = window.__splashery.player.camera;
      return { lock: c.tiltLock, pitch: c.tgt.pitch - c.home.pitch, yaw: Math.sin(c.tgt.yaw - c.home.yaw) }; // prettier-ignore
    });
    expect(cam.lock).toBe(true);
    expect(Math.abs(cam.pitch)).toBeLessThan(1e-6);
    expect(Math.abs(cam.yaw)).toBeLessThan(1e-6);
    await expect(page.locator("#tilt-toggle")).toHaveAttribute("aria-pressed", "true");
  });

  test("the slider over the stage shows while set and hands its value back", async ({ page }) => {
    await ready(page);
    await lend(page);
    await expect(page.locator("#toy-slider")).toBeHidden();
    await page.evaluate(() => (window.__pg6Out = { slider: { id: "f1", label: "Depth", value: 0.25 } })); // prettier-ignore
    await frames(page);
    const sl = page.locator("#toy-slider");
    await expect(sl).toBeVisible();
    await expect(sl).toContainText("Depth");
    expect(Number(await page.locator("#toy-slider-input").inputValue())).toBe(250);
    await page.locator("#toy-slider-input").fill("800");
    await frames(page);
    const got = await page.evaluate(() => window.__pg6Info.slider);
    expect(got.id).toBe("f1");
    expect(got.value).toBeCloseTo(0.8, 5);
    expect(got.n).toBeGreaterThan(0);
    await page.evaluate(() => (window.__pg6Out = {}));
    await frames(page);
    await expect(sl).toBeHidden();
  });

  test("a drive's figure depths go into the scene and come back to it", async ({ page }) => {
    await ready(page);
    await lend(page);
    await page.evaluate(() => (window.__pg6Out = { figures: [{ page: 1, box: [0.2, 0.2, 0.6, 0.5], depth: 4 }] })); // prettier-ignore
    await frames(page);
    await page.evaluate(() => (window.__pg6Out = {}));
    await frames(page);
    const r = await page.evaluate(() => ({
      scene: window.__splashery.player.scene.toy.figures,
      info: window.__pg6Info.figures,
    }));
    expect(r.scene).toEqual([{ page: 1, box: [0.2, 0.2, 0.6, 0.5], depth: 4 }]);
    expect(r.info).toEqual(r.scene);
    // An empty list clears them.
    await page.evaluate(() => (window.__pg6Out = { figures: [] }));
    await frames(page);
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.figures)).toBeUndefined();
  });
});
