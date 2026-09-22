// Splashery smoke test. Runs in headless Chromium with SwiftShader flags (see
// playwright.config.mjs). Rendering assertions are skipped with a message if
// WebGL2 cannot be created at all.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");
const NO_WEBGL2 =
  "WebGL2 is unavailable in this headless Chromium (SwiftShader did not provide a context); skipping rendering assertions.";

function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function loadApp(page, url = "/") {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  return page.evaluate(() => window.__splashery.webgl2);
}

async function sphereCenter(page) {
  const box = await page.locator("#stage").boundingBox();
  // The planet is centred in the viewport; the panel sits on the right.
  return { x: box.x + box.width * 0.35, y: box.y + box.height * 0.5, box };
}

async function paintStroke(page) {
  const { x, y } = await sphereCenter(page);
  await page.mouse.move(x - 80, y - 20);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x - 80 + i * 14, y - 20 + Math.sin(i / 2) * 25);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}

// Counts pixels that differ between two PNG screenshots, decoded in the page.
async function countDifferentPixels(page, a, b) {
  return page.evaluate(
    async ([pa, pb]) => {
      const load = async (b64) => {
        const res = await fetch(`data:image/png;base64,${b64}`);
        const bmp = await createImageBitmap(await res.blob());
        const c = document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [da, db] = await Promise.all([load(pa), load(pb)]);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (
          Math.abs(da[i] - db[i]) > 24 ||
          Math.abs(da[i + 1] - db[i + 1]) > 24 ||
          Math.abs(da[i + 2] - db[i + 2]) > 24
        ) {
          n++;
        }
      }
      return n;
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

test.describe("Splashery app", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("loads with no console errors or warnings", async ({ page }) => {
    const problems = watchConsole(page);
    const webgl2 = await loadApp(page);
    await page.waitForTimeout(800);
    expect(problems).toEqual([]);
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator("#mode-paint")).toHaveAttribute("aria-pressed", "true");
    test.info().annotations.push({ type: "webgl2", description: String(webgl2) });
  });

  test("a painted stroke changes canvas pixels and is logged", async ({ page }) => {
    const problems = watchConsole(page);
    const webgl2 = await loadApp(page);
    test.skip(!webgl2, NO_WEBGL2);
    const canvas = page.locator("#stage");
    await page.waitForTimeout(400);
    const before = await canvas.screenshot({ type: "png" });
    await paintStroke(page);
    await page.waitForTimeout(600);
    const after = await canvas.screenshot({ type: "png" });
    const changed = await countDifferentPixels(page, before, after);
    expect(changed).toBeGreaterThan(400);
    expect(await page.evaluate(() => window.__splashery.strokeCount())).toBe(1);
    await expect(page.locator("#undo")).toBeEnabled();
    expect(problems).toEqual([]);
  });

  test("JSON export then import round-trips the scene", async ({ page }) => {
    const webgl2 = await loadApp(page);
    test.skip(!webgl2, NO_WEBGL2);
    await paintStroke(page);
    await page.waitForTimeout(300);

    // Real download through the button (inside the collapsed export section).
    await page.click("#export-group summary");
    await expect(page.locator("#export-json")).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.click("#export-json");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^splashery-.*\.json$/);
    const filePath = await download.path();
    const scene = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(scene.version).toBe(1);
    expect(typeof scene.createdAt).toBe("string");
    expect(["rocky", "icy", "gas", "plain"]).toContain(scene.template.name);
    expect(scene.camera.rotation).toHaveLength(4);
    expect(scene.lighting).toHaveProperty("exposure");
    expect(scene.brushDefaults).toHaveProperty("wetness");
    expect(scene.strokes).toHaveLength(1);
    expect(scene.strokes[0].points.length).toBeGreaterThan(3);
    expect(scene.strokes[0].points[0][3]).toBe(1); // splash on pointer down
    expect(scene.snapshotPNG.startsWith("data:image/png;base64,")).toBe(true);

    // Change the planet so the import has something to restore, then import
    // the file through the real file input.
    await page.evaluate(() => window.__splashery.app.randomize());
    await page.evaluate(() => window.__splashery.app.clearPaint());
    expect(await page.evaluate(() => window.__splashery.strokeCount())).toBe(0);
    await page.setInputFiles("#import-json", {
      name: "scene.json",
      mimeType: "application/json",
      buffer: fs.readFileSync(filePath),
    });
    await expect
      .poll(() => page.evaluate(() => window.__splashery.strokeCount()), { timeout: 120_000 })
      .toBe(1);
    await expect.poll(() => page.evaluate(() => window.__splashery.app.busy)).toBe(false);

    const again = await page.evaluate(() => window.__splashery.exportScene());
    expect(again.template).toEqual(scene.template);
    expect(again.strokes).toEqual(scene.strokes);
    expect(again.brushDefaults).toEqual(scene.brushDefaults);
    expect(again.physics).toEqual(scene.physics);
    expect(again.camera.distance).toBeCloseTo(scene.camera.distance, 3);
  });

  test("embed page loads a scene from the hash", async ({ page, browser }) => {
    const webgl2 = await loadApp(page);
    test.skip(!webgl2, NO_WEBGL2);
    await paintStroke(page);
    await page.waitForTimeout(300);
    const result = await page.evaluate(() => window.__splashery.makeEmbed());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeLessThanOrEqual(8 * 1024);
    const snippet = await page.locator("#embed-snippet").inputValue();
    expect(snippet).toMatch(/^<iframe src="http:\/\/127\.0\.0\.1:4173\/embed\/#s=d\./);
    const src = snippet.match(/src="([^"]+)"/)[1];
    const seed = await page.evaluate(() => window.__splashery.app.scene.template.seed);

    const ctx = await browser.newContext({ viewport: { width: 480, height: 360 } });
    const embed = await ctx.newPage();
    const problems = watchConsole(embed);
    await embed.goto(src);
    await embed.waitForSelector("body[data-ready='true']", { timeout: 150_000 });
    const loaded = await embed.evaluate(() => {
      const s = window.__splashery.scene();
      return { seed: s.template.seed, strokes: s.strokes.length };
    });
    expect(loaded.seed).toBe(seed);
    expect(loaded.strokes).toBe(1);
    await expect(embed.locator("#open-link")).toBeVisible();
    await expect(embed.locator("#embed-status")).toBeHidden();
    expect(problems).toEqual([]);
    await embed.screenshot({ path: path.join(SHOTS, "embed-480x360.png") });
    await ctx.close();
  });

  test("desktop screenshot at 1440x900", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    const webgl2 = await loadApp(page);
    if (webgl2) {
      await paintStroke(page);
      await page.waitForTimeout(2500);
    }
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "app-1440x900.png") });
    await ctx.close();
  });
});

test.describe("Splashery on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });

  test("has no horizontal overflow at 390px and the sheet opens", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    const measure = () =>
      page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        inner: window.innerWidth,
      }));
    let m = await measure();
    expect(m.doc).toBeLessThanOrEqual(m.inner);
    expect(m.body).toBeLessThanOrEqual(m.inner);
    await expect(page.locator("#panel-body")).toBeHidden();
    await page.click("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeVisible();
    await expect(page.locator("#sheet-toggle")).toHaveAttribute("aria-expanded", "true");
    m = await measure();
    expect(m.doc).toBeLessThanOrEqual(m.inner);
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "app-390x844-sheet.png") });
    await page.click("#sheet-toggle");
    await page.screenshot({ path: path.join(SHOTS, "app-390x844.png") });
    expect(problems).toEqual([]);
  });

  test("has no horizontal overflow at 360px", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await loadApp(page);
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(m.doc).toBeLessThanOrEqual(m.inner);
    await ctx.close();
  });
});
