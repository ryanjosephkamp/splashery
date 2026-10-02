// Lane UI r5 (engine): the gallery button in the top row, the stage that ends
// above the song and game bars on a phone, a toy entry's free tilt, Record (a
// live recording of the stage with its sound) and a recipe's own file cap.

import { test, expect } from "@playwright/test";

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SHOTS = new URL("./screenshots/", import.meta.url);
const shot = (name) => new URL(name, SHOTS).pathname;

async function open(page) {
  await page.goto("/?renderer=webgl2&profile=weak");
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

const box = (page, sel) => page.locator(sel).boundingBox();

test.describe("phone", () => {
  test.use(PHONE);

  test("the gallery button sits in the top row, clear of the name, and opens the full grid", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    // Not in the category row any more.
    await expect(page.locator("#shelf-chips #gallery-open")).toHaveCount(0);
    const g = await box(page, "#gallery-open");
    const flag = await box(page, "#flag-toggle");
    const name = await box(page, ".brand h1");
    expect(g.y).toBeLessThan(60);
    expect(Math.abs(g.y - flag.y)).toBeLessThan(2);
    expect(g.x + g.width).toBeLessThanOrEqual(flag.x);
    expect(g.x).toBeGreaterThan(name.x + name.width); // the name stays readable
    // Scrolled far along the category row, it is still one tap away.
    await page.evaluate(() => (document.getElementById("shelf-chips").scrollLeft = 2000));
    await page.click("#gallery-open");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await expect(page.locator("body")).toHaveClass(/sheet-full/);
    await expect(page.locator("#gallery-open")).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: shot("ui5-gallery-open-390x844.png") });
    // The sheet's own control (or the button again, where it shows) closes it.
    await page.evaluate(() => window.__splashery.app.ui.toggleGallery());
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    await page.screenshot({ path: shot("ui5-gallery-390x844.png") });
    expect(errors).toEqual([]);
  });

  test("with a song or game bar up, the stage ends above the bar, so the bar never covers the toy", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    const plain = (await box(page, "#stage")).height;
    for (const id of [
      "grand-piano",
      "upright-piano",
      "harpsichord",
      "electronic-keyboard",
      "chess-set",
    ]) {
      await pick(page, id);
      await expect(page.locator("#game-bar")).toBeVisible();
      await page.waitForTimeout(300);
      const stage = await box(page, "#stage");
      const bar = await box(page, "#game-bar");
      expect(stage.y + stage.height, id).toBeLessThanOrEqual(bar.y + 1);
      expect(stage.height, id).toBeLessThan(plain - 60);
      // The drawing buffer follows the smaller stage (the camera frames the toy in it).
      const ratio = await page.evaluate(() => {
        const c = document.getElementById("stage");
        return c.height / c.width / (c.clientHeight / c.clientWidth);
      });
      expect(Math.abs(ratio - 1), id).toBeLessThan(0.03);
      if (id === "grand-piano") await page.screenshot({ path: shot("ui5-song-bar-390x844.png") });
      if (id === "chess-set") await page.screenshot({ path: shot("ui5-game-bar-390x844.png") });
    }
    // A toy without a bar gets the whole stage back.
    await pick(page, "donut");
    await expect(page.locator("#game-bar")).toBeHidden();
    await page.waitForTimeout(300);
    expect(Math.abs((await box(page, "#stage")).height - plain)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });

  test("Record: the pill shows the time and Stop on the stage, then Save; the video has the sound", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "toy-piano");
    // Started from the Share tab: the sheet closes so the toy can be played.
    await page.click("#sheet-toggle");
    await page.click("#tab-share");
    await expect(page.locator("#record-row")).toBeVisible();
    await page.click("#record-start");
    await expect(page.locator("#rec-pill")).toBeVisible();
    await expect(page.locator("#rec-stop")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/sheet-open/);
    await page.evaluate(() => window.__splashery.app.sound.setEnabled(true));
    await page.evaluate(() => window.__splashery.app.sound.play({ voice: "bell", f: 660, vol: 1 }, { key: "ui5" })); // prettier-ignore
    await expect(page.locator("#rec-time")).toHaveText(/^0:0[1-9] \/ 1:00$/, { timeout: 10_000 });
    await page.screenshot({ path: shot("ui5-record-390x844.png") });
    await page.click("#rec-stop");
    await expect(page.locator("#rec-save")).toBeVisible({ timeout: 20_000 });
    const got = await page.evaluate(() => {
      const r = window.__splashery.app.recorded;
      return { type: r.blob.type, size: r.blob.size, name: r.name, s: r.seconds };
    });
    expect(got.type).toMatch(/^video\/(mp4|webm)$/);
    expect(got.name).toMatch(/^splashery-\d{8}-\d{6}\.(mp4|webm)$/);
    expect(got.size).toBeGreaterThan(1000);
    expect(got.s).toBeGreaterThan(0.5);
    await page.screenshot({ path: shot("ui5-record-done-390x844.png") });
    const download = page.waitForEvent("download");
    await page.click("#rec-save");
    expect((await download).suggestedFilename()).toBe(got.name);
    await page.click("#rec-close");
    await expect(page.locator("#rec-pill")).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe("computer", () => {
  test.use(DESK);

  test("the gallery button beside the search field (and G) opens and closes the gallery page, and never covers the stage", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    // In the panel, beside the search field, not over the stage.
    await expect(page.locator("#shelf-find #gallery-open")).toHaveCount(1);
    const g = await box(page, "#gallery-open");
    const search = await box(page, "#shelf-search");
    const panel = await box(page, "#panel");
    expect(Math.abs(g.y + g.height / 2 - (search.y + search.height / 2))).toBeLessThan(3);
    expect(g.x).toBeGreaterThanOrEqual(search.x + search.width);
    expect(g.x).toBeGreaterThanOrEqual(panel.x);
    await page.screenshot({ path: shot("ui5-gallery-1440x900.png") });
    await page.click("#gallery-open");
    await expect(page.locator("body")).toHaveClass(/gallery-page/);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/gallery-page/);
    await page.locator("#stage").focus();
    await page.keyboard.press("g");
    await expect(page.locator("body")).toHaveClass(/gallery-page/);
    await page.keyboard.press("g");
    await expect(page.locator("body")).not.toHaveClass(/gallery-page/);
    // Narrowed to a phone's width, it goes back to the top row.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#shelf-find #gallery-open")).toHaveCount(0);
    expect((await box(page, "#gallery-open")).y).toBeLessThan(60);
    expect(errors).toEqual([]);
  });

  test('a toy entry with tilt: "free" starts unlocked on a shelf that holds still', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    const lock = () => page.evaluate(() => window.__splashery.player.camera.tiltLock);
    await pick(page, "drum");
    expect(await lock()).toBe(true);
    await page.evaluate(async () => {
      const { TOYS } = await import("/src/toys.js");
      TOYS.find((t) => t.id === "toy-piano").tilt = "free";
    });
    await pick(page, "toy-piano");
    expect(await lock()).toBe(false);
    // Still not spinning by itself: the shelf's turntable default stays.
    expect(await page.evaluate(() => window.__splashery.player.camera.turntable)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("Record stops by itself at its time limit", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut"); // a light toy, so the page's main thread is free
    await page.waitForTimeout(1000);
    const out = await page.evaluate(async () => {
      const { startRecording, recordSupport } = await import("/src/exports.js");
      const { app } = window.__splashery;
      app.sound.setEnabled(true);
      const ctx = app.sound.audio();
      // A small canvas drawn here, so the take does not hang on how fast a
      // software renderer draws the stage (the time limit is what is tested).
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      document.body.append(canvas);
      const g = canvas.getContext("2d");
      let i = 0;
      const draw = setInterval(() => {
        g.fillStyle = `hsl(${(i++ * 25) % 360} 70% 50%)`;
        g.fillRect(0, 0, 160, 120);
        rec.frame();
      }, 50);
      const rec = startRecording({ canvas, audio: { ctx, node: app.sound.master }, maxSeconds: 3 });
      const osc = ctx.createOscillator();
      osc.connect(app.sound.master);
      osc.start();
      const t0 = performance.now();
      const { blob, ext, seconds } = await rec.done;
      osc.stop();
      clearInterval(draw);
      canvas.remove();
      return { sup: recordSupport(), ext, seconds, took: performance.now() - t0, size: blob.size, type: blob.type }; // prettier-ignore
    });
    expect(out.sup.ok).toBe(true);
    expect(out.took).toBeGreaterThan(2800);
    expect(out.took).toBeLessThan(7000);
    expect(out.seconds).toBeCloseTo(3, 1);
    expect(out.size).toBeGreaterThan(500);
    expect(out.type).toContain(out.ext);
    expect(errors).toEqual([]);
  });

  test("a recipe's own file cap (input.maxBytes)", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "model-splats");
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/studio-models.js");
      RECIPES["model-splats"].input.maxBytes = () => 1000;
    });
    await page.locator("#toy-input-file").setInputFiles({
      name: "big.glb",
      mimeType: "model/gltf-binary",
      buffer: Buffer.alloc(2000),
    });
    // The generic message, or the recipe's own (input.tooBig) where it has one.
    await expect(page.locator("#toy-input .warning")).toHaveText(
      /too big|the most this device can open/,
    );
    expect(errors).toEqual([]);
  });
});
