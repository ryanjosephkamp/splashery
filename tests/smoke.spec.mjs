// Splashery v2 smoke test. Runs in headless Chromium with SwiftShader (see
// playwright.config.mjs). WebGL2 assertions force ?renderer=webgl2 and are
// never skipped in the sandbox; WebGPU assertions skip with a message when
// Chromium offers no WebGPU adapter.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";

const SHOTS = path.resolve("tests/screenshots");
const WEBGL = "/?renderer=webgl2&profile=weak";
const NO_WEBGPU =
  "WebGPU is unavailable in this headless Chromium (no adapter from SwiftShader/Vulkan), so the WebGPU assertions are skipped. WebGL2 is covered by the other tests.";

// Console problems, minus Chromium's own note that WebGPU is experimental on Linux.
function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function loadApp(page, url = WEBGL) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return page.evaluate(() => window.__splashery.renderer);
}

// Waits until the toy status line starts with the given label.
async function waitForToy(page, label) {
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), {
    timeout: 180_000,
  });
  await page.waitForTimeout(1500);
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

// Non-background pixels in the stage (proves something was drawn).
async function inkPixels(page) {
  const shot = await page.locator("#stage").screenshot({ type: "png" });
  return page.evaluate(async (b64) => {
    const res = await fetch(`data:image/png;base64,${b64}`);
    const bmp = await createImageBitmap(await res.blob());
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) n++;
    return n;
  }, shot.toString("base64"));
}

test.describe("Splashery app (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("loads with no console errors and shows the shelf", async ({ page }) => {
    const problems = watchConsole(page);
    const renderer = await loadApp(page);
    expect(renderer).toBe("webgl2");
    await waitForToy(page, "Cactus");
    const cards = page.locator(".toy-card");
    await expect(cards).toHaveCount(8);
    for (const id of ["cactus", "strawberry", "cookie", "bee", "blob", "donut", "knot", "planet"]) {
      await expect(page.locator(`.toy-card[data-toy='${id}'] img`)).toHaveJSProperty(
        "complete",
        true,
      );
    }
    const loaded = await page.evaluate(() =>
      [...document.querySelectorAll(".toy-card img")].every((img) => img.naturalWidth > 0),
    );
    expect(loaded).toBe(true);
    await expect(page.locator(".toy-card[data-toy='cactus']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await inkPixels(page)).toBeGreaterThan(2000);
    expect(problems).toEqual([]);
  });

  test("the shelf filters by category and search, and Surprise me picks a toy", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
    const shown = () =>
      page.locator("#shelf .toy-card").evaluateAll((cards) => cards.map((c) => c.dataset.toy));
    await page.click(".chip[data-category='shapes']");
    expect(await shown()).toEqual(["blob", "donut", "knot", "planet"]);
    await expect(page.locator(".chip[data-category='shapes']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.fill("#shelf-search", "fruit");
    expect(await shown()).toEqual(["strawberry"]);
    await page.fill("#shelf-search", "zzzz");
    await expect(page.locator("#shelf-empty")).toBeVisible();
    await page.fill("#shelf-search", "");
    await page.click(".chip[data-category='all']");
    expect((await shown()).length).toBe(8);
    await page.click("#shelf-surprise");
    await expect(page.locator("#toy-status")).not.toHaveText(/^Cactus/, { timeout: 180_000 });
    expect(problems).toEqual([]);
  });

  test("generating a procedural toy changes canvas pixels", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.click("#tab-make");
    await page.selectOption("#gen-shape", "knot");
    await page.selectOption("#gen-palette", "sunset");
    await page.fill("#gen-seed", "4242");
    await page.click("#gen-make");
    await waitForToy(page, "Your toy");
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(3000);
    const toy = await page.evaluate(() => window.__splashery.exportScene().toy);
    expect(toy.kind).toBe("procedural");
    expect(toy.generator).toMatchObject({ shape: "knot", palette: "sunset", seed: 4242 });
    expect(problems).toEqual([]);
  });

  test("toggling an effect changes canvas pixels", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    // A still twist, so the before/after frames are both stable.
    await page.evaluate(() => window.__splashery.app.setEffectParam("twist", "wobble", 0));
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.click("#fx-twist");
    await expect(page.locator("#fx-twist")).toBeChecked();
    await page.waitForTimeout(2000);
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(3000);
    // Poke, paint and the other effects run on the GPU as well.
    await page.click("#fx-twist");
    await page.click("#fx-slice");
    await page.waitForTimeout(1500);
    const sliced = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, sliced)).toBeGreaterThan(3000);
    expect(problems).toEqual([]);
  });

  test("paint and poke tools change the toy where it is touched", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    const canvas = page.locator("#stage");
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const before = await canvas.screenshot({ type: "png" });
    await page.click("[data-tool='paint']");
    await page.mouse.move(cx - 40, cy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(cx - 40 + i * 10, cy + Math.sin(i) * 8);
      await page.waitForTimeout(60);
    }
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const painted = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, painted)).toBeGreaterThan(500);
    const stamps = await page.evaluate(() => window.__splashery.exportScene().paint.stamps.length);
    expect(stamps).toBeGreaterThan(3);
    await expect(page.locator("#clear-paint")).toBeEnabled();
    expect(problems).toEqual([]);
  });

  test("clay adds and erases blobs on a generated toy and survives a JSON round trip", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    const canvas = page.locator("#stage");
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const before = await canvas.screenshot({ type: "png" });
    await page.click("[data-tool='clay']");
    const drag = async (dx) => {
      await page.mouse.move(cx + dx, cy - 30);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(cx + dx + i * 8, cy - 30 + i * 6);
        await page.waitForTimeout(160);
      }
      await page.mouse.up();
      await page.waitForTimeout(800);
    };
    await drag(-60);
    await page.click("#clay-erase");
    await drag(20);
    await page.waitForTimeout(1200);
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(800);
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.toy.kind).toBe("procedural");
    expect(scene.toy.clay.some((op) => op[0] === "a")).toBe(true);
    expect(scene.toy.clay.some((op) => op[0] === "e")).toBe(true);
    const count = await page.evaluate(() => window.__splashery.player.proc.ctx.buf.count);
    // Replaying the saved clay rebuilds exactly the same splats.
    await page.click(".toy-card[data-toy='knot']");
    await waitForToy(page, "Neon knot");
    await page.setInputFiles("#import-json", {
      name: "clay.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(scene)),
    });
    await waitForToy(page, "Jelly blob");
    const replay = await page.evaluate(() => ({
      clay: window.__splashery.exportScene().toy.clay,
      count: window.__splashery.player.proc.ctx.buf.count,
    }));
    expect(replay.clay).toEqual(scene.toy.clay);
    expect(replay.count).toBe(count);
    expect(problems).toEqual([]);
  });

  test("shows a friendly poster when no GPU renderer is available", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/?renderer=none");
    await page.waitForSelector("body[data-ready='true']");
    await expect(page.locator("#fallback")).toBeVisible();
    await expect(page.locator("#fallback svg.poster")).toBeVisible();
    await expect(page.locator("#fallback h2")).toHaveText(/needs WebGL2 or WebGPU/);
    expect(problems).toEqual([]);
  });

  test("JSON export then import round-trips the scene", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='donut']");
    await waitForToy(page, "Donut");
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      app.setLook({ exposure: 1.3, background: "#f4efe6" });
      app.setEffectParam("wind", "strength", 0.8);
      app.toggleEffect("wind", true);
      app.setEffectParam("slice", "axis", "z");
      app.setAutoplay({ effect: "pokes" });
      const hit = [0.6, 0.29, 0.2];
      player.paintAt(hit, true);
    });
    await page.waitForTimeout(800);
    await page.click("#tab-share");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#export-json");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^splashery-.*\.json$/);
    const file = await download.path();
    const scene = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(scene.version).toBe(2);
    expect(scene.app).toBe("splashery");
    expect(scene.toy).toEqual({ kind: "builtin", id: "donut" });
    expect(scene.look.exposure).toBeCloseTo(1.3, 5);
    expect(scene.effects.wind).toMatchObject({ on: true, strength: 0.8 });
    expect(scene.effects.slice.axis).toBe("z");
    expect(scene.autoplay.effect).toBe("pokes");
    expect(scene.paint.stamps.length).toBeGreaterThan(3);

    // Change everything, then load the file through the real file input.
    await page.click(".toy-card[data-toy='knot']");
    await waitForToy(page, "Neon knot");
    await page.evaluate(() => {
      const { app } = window.__splashery;
      app.allEffectsOff();
      app.setLook({ exposure: 1 });
    });
    await page.setInputFiles("#import-json", {
      name: "scene.json",
      mimeType: "application/json",
      buffer: fs.readFileSync(file),
    });
    await waitForToy(page, "Donut");
    const again = await page.evaluate(() => window.__splashery.exportScene());
    for (const key of ["toy", "look", "effects", "paint", "autoplay", "seed"]) {
      expect(again[key]).toEqual(scene[key]);
    }
    expect(again.camera.distance).toBeCloseTo(scene.camera.distance, 2);
    expect(problems).toEqual([]);
  });

  test("the embed page loads a scene from the hash", async ({ page, browser }) => {
    await loadApp(page);
    await page.click(".toy-card[data-toy='planet']");
    await waitForToy(page, "Tiny planet");
    await page.evaluate(() => {
      window.__splashery.app.toggleEffect("twist", true);
      window.__splashery.app.setAutoplay({ effect: "breeze" });
    });
    await page.click("#tab-share");
    await expect(page.locator("#embed-snippet")).toHaveValue(
      /^<iframe src="http:\/\/127\.0\.0\.1:4173\/embed\/#s=d\./,
    );
    const snippet = await page.locator("#embed-snippet").inputValue();
    const src = snippet.match(/src="([^"]+)"/)[1];
    await expect(page.locator("#element-snippet")).toHaveValue(/<splashery-toy scene="d\./);

    const ctx = await browser.newContext({
      viewport: { width: 400, height: 300 },
      reducedMotion: "reduce",
    });
    const embed = await ctx.newPage();
    const problems = watchConsole(embed);
    await embed.goto(src.replace("/embed/#", "/embed/?renderer=webgl2#"));
    await embed.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await embed.waitForTimeout(2500);
    const loaded = await embed.evaluate(() => {
      const s = window.__splashery.scene();
      return { toy: s.toy, twist: s.effects.twist.on, autoplay: s.autoplay.effect };
    });
    expect(loaded).toEqual({
      toy: { kind: "builtin", id: "planet" },
      twist: true,
      autoplay: "breeze",
    });
    await expect(embed.locator("#open-link")).toHaveAttribute("href", /#s=d\./);
    expect(await inkPixels(embed)).toBeGreaterThan(1500);
    expect(problems).toEqual([]);
    fs.mkdirSync(SHOTS, { recursive: true });
    await embed.screenshot({ path: path.join(SHOTS, "embed-400x300.png") });
    await ctx.close();
  });

  test("an embedded captured toy stays under 30 MB of transfer", async ({ page }) => {
    const sizes = new Map();
    page.on("response", async (res) => {
      // Network transfer only: blob: URLs are in-memory copies made while unpacking.
      if (!/^https?:/.test(res.url())) return;
      try {
        sizes.set(res.url(), (await res.body()).length);
      } catch {
        // redirects and aborted requests have no body
      }
    });
    await page.goto("/embed/?toy=bee&profile=strong&renderer=webgl2");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    expect(sizes.has("http://127.0.0.1:4173/assets/toys/bee/bee.sog")).toBe(true);
    expect(total).toBeLessThan(30 * 1024 * 1024);
    console.log(`embed transfer, bee at the strong profile: ${(total / 1048576).toFixed(1)} MB`);
  });

  test("the <splashery-toy> element renders without an iframe", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/embed/demo.html");
    await page.waitForSelector("splashery-toy[data-ready='true']", { timeout: 180_000 });
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => {
      const el = document.querySelector("splashery-toy");
      return { toy: el.viewer.player.toyInfo?.id, link: el.shadowRoot.querySelector("a").href };
    });
    expect(state.toy).toBe("cactus");
    expect(state.link).toContain("127.0.0.1:4173");
    expect(problems).toEqual([]);
  });

  test("bring-your-own PLY, SPLAT, SPZ and SOG files load in the browser", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
    const files = [
      { name: "ball.ply", buffer: makePly() },
      { name: "ball.splat", buffer: makeSplat() },
      { name: "ball.spz", buffer: makeSpz() },
      { name: "cactus-lite.sog", buffer: fs.readFileSync("assets/toys/cactus/cactus-lite.sog") },
    ];
    for (const f of files) {
      await page.setInputFiles("#byo-file", { ...f, mimeType: "application/octet-stream" });
      await waitForToy(page, f.name.replace(".", "\\."));
      const toy = await page.evaluate(() => window.__splashery.exportScene().toy);
      expect(toy).toMatchObject({ kind: "file", file: { name: f.name } });
      expect(await inkPixels(page)).toBeGreaterThan(1500);
    }
    // A link for a user's own file carries the settings only, and says so.
    await page.click("#tab-share");
    await expect(page.locator("#embed-note")).toContainText("settings only");
    expect(problems).toEqual([]);
  });

  test("PNG, GIF and WebM exports produce files", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='knot']");
    await waitForToy(page, "Neon knot");
    await page.click("#tab-share");
    const save = async (selector) => {
      const p = page.waitForEvent("download", { timeout: 200_000 });
      await page.click(selector);
      const d = await p;
      return { name: d.suggestedFilename(), size: fs.statSync(await d.path()).size };
    };
    const png = await save("#export-png");
    expect(png.name).toMatch(/\.png$/);
    expect(png.size).toBeGreaterThan(5000);
    await page.selectOption("#gif-frames", "24");
    await page.selectOption("#gif-size", "256");
    const gif = await save("#export-gif");
    expect(gif.name).toMatch(/\.gif$/);
    expect(gif.size).toBeGreaterThan(20000);
    const webm = await page.evaluate(() => !document.getElementById("webm-row").hidden);
    if (webm) {
      await page.selectOption("#webm-seconds", "3");
      const video = await save("#export-webm");
      expect(video.name).toMatch(/\.webm$/);
      expect(video.size).toBeGreaterThan(1000);
    } else {
      await expect(page.locator("#webm-unavailable")).toBeVisible();
    }
    expect(problems).toEqual([]);
  });

  test("desktop screenshot at 1440x900", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "app-1440x900.png") });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.click(".toy-card[data-toy='strawberry']");
    await waitForToy(page, "Strawberry");
    await page.click("#fx-wind");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, "app-1440x900-dark.png") });
    expect(problems).toEqual([]);
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
    await waitForToy(page, "Cactus");
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
    await expect(page.locator(".toy-card").first()).toBeVisible();
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "app-390x844.png") });
    await page.tap("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeVisible();
    await expect(page.locator("#sheet-toggle")).toHaveAttribute("aria-expanded", "true");
    m = await measure();
    expect(m.doc).toBeLessThanOrEqual(m.inner);
    // The stage shrinks to the space above the open sheet, so the toy stays in view.
    const layout = await page.evaluate(() => ({
      stage: document.getElementById("stage").getBoundingClientRect().bottom,
      panel: document.getElementById("panel").getBoundingClientRect().top,
    }));
    expect(layout.stage).toBeLessThanOrEqual(layout.panel + 20);
    await page.screenshot({ path: path.join(SHOTS, "app-390x844-sheet.png") });

    // Tapping the toy closes the sheet (and does not poke or paint).
    await page.tap("#stage", { position: { x: 195, y: 120 } });
    await expect(page.locator("#panel-body")).toBeHidden();
    await expect(page.locator("#sheet-toggle")).toHaveAttribute("aria-expanded", "false");

    // Swiping the handle up opens it, swiping down closes it.
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (x, y0, y1) => {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: y0 }],
      });
      for (let i = 1; i <= 6; i++) {
        const y = y0 + ((y1 - y0) * i) / 6;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    let handle = await page.locator("#sheet-handle").boundingBox();
    await swipe(handle.x + handle.width / 2, handle.y + handle.height / 2, handle.y - 140);
    await expect(page.locator("#panel-body")).toBeVisible();
    handle = await page.locator("#sheet-handle").boundingBox();
    await swipe(handle.x + handle.width / 2, handle.y + handle.height / 2, handle.y + 140);
    await expect(page.locator("#panel-body")).toBeHidden();

    // Tabs switch panes; search finds toys and Enter picks the first one.
    await page.tap("#sheet-toggle");
    await page.tap("#tab-look");
    await expect(page.locator("#pane-look")).toBeVisible();
    await expect(page.locator("#pane-play")).toBeHidden();
    await page.tap("#shelf-search-toggle");
    await page.fill("#shelf-search", "straw");
    await expect(page.locator("#shelf .toy-card")).toHaveCount(1);
    await page.press("#shelf-search", "Enter");
    await waitForToy(page, "Strawberry");
    expect(problems).toEqual([]);
  });

  test("has no horizontal overflow at 360px", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await loadApp(page);
    await waitForToy(page, "Cactus");
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(m.doc).toBeLessThanOrEqual(m.inner);
    await page.tap("#sheet-toggle");
    const m2 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(m2).toBeLessThanOrEqual(360);
    await ctx.close();
  });
});

test.describe("Splashery on WebGPU", () => {
  test.use({ viewport: { width: 1000, height: 700 }, reducedMotion: "reduce" });

  test("auto picks WebGPU when an adapter exists and effects render", async ({ page }) => {
    // navigator.gpu only exists in a secure context, so probe from the site.
    await page.goto("/LICENSES.md");
    const hasAdapter = await page.evaluate(async () => {
      if (!navigator.gpu) return false;
      try {
        return !!(await navigator.gpu.requestAdapter());
      } catch {
        return false;
      }
    });
    test.skip(!hasAdapter, NO_WEBGPU);
    const problems = watchConsole(page);
    const renderer = await loadApp(page, "/?profile=weak");
    expect(renderer).toBe("webgpu");
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    await page.evaluate(() => window.__splashery.app.setEffectParam("twist", "wobble", 0));
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.click("#fx-twist");
    await page.waitForTimeout(2500);
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(3000);
    expect(problems).toEqual([]);
  });
});
