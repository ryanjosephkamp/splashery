// Splashery v2 smoke test. Runs in headless Chromium with SwiftShader (see
// playwright.config.mjs). WebGL2 assertions force ?renderer=webgl2 and are
// never skipped in the sandbox; WebGPU assertions skip with a message when
// Chromium offers no WebGPU adapter.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";
import { TOYS, searchToys } from "../src/toys.js";
import { encodeSceneHash } from "../src/codec.js";

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
    await expect(cards).toHaveCount(TOYS.length);
    for (const id of ["cactus", "strawberry", "cookie", "bee", "blob", "donut", "knot", "planet"]) {
      await expect(page.locator(`.toy-card[data-toy='${id}'] img`)).toHaveJSProperty(
        "complete",
        true,
      );
    }
    // Shelf thumbnails load lazily, so load the offscreen ones before checking them all.
    const loaded = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll(".toy-card img")];
      for (const img of imgs) img.loading = "eager";
      await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
      return imgs.filter((img) => !(img.naturalWidth > 0)).map((img) => img.src);
    });
    expect(loaded).toEqual([]);
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
    const fruit = searchToys("fruit").map((t) => t.id);
    expect(fruit).toContain("strawberry");
    expect(await shown()).toEqual(fruit);
    await page.fill("#shelf-search", "zzzz");
    await expect(page.locator("#shelf-empty")).toBeVisible();
    await page.fill("#shelf-search", "");
    await page.click(".chip[data-category='all']");
    expect((await shown()).length).toBe(TOYS.length);
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
    expect(scene.version).toBe(3);
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
    // The desktop shelf is the same four-column grid as before the phone grid.
    const shelf = await page.evaluate(() => {
      const el = document.getElementById("shelf");
      const cs = getComputedStyle(el);
      const label = getComputedStyle(el.querySelector(".toy-card span"));
      return {
        cols: cs.gridTemplateColumns.split(" ").length,
        maxHeight: cs.maxHeight,
        wrap: label.whiteSpace,
        handle: getComputedStyle(document.getElementById("sheet-handle")).display,
        grid: document.body.classList.contains("shelf-grid"),
      };
    });
    expect(shelf).toEqual({
      cols: 4,
      maxHeight: "232px",
      wrap: "nowrap",
      handle: "none",
      grid: false,
    });
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

test.describe("Splashery v3 engine (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("a kit toy loads from its pack, and its action and a tap open and close it", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    await expect(page.locator("#toy-action")).toHaveText("Open or close");
    const canvas = page.locator("#stage");
    const closed = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(2000);
    const open = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, closed, open)).toBeGreaterThan(3000);
    expect((await page.evaluate(() => window.__splashery.exportScene())).motion.controls.open).toBe(
      1,
    );
    // A tap on the toy (Orbit tool) closes it again.
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.exportScene().motion.controls.open))
      .toBe(0);
    expect(problems).toEqual([]);
  });

  test("toys move by themselves once motion is on, and any toy can bounce", async ({ page }) => {
    const problems = watchConsole(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loadApp(page);
    await page.click(".toy-card[data-toy='campfire']");
    await waitForToy(page, "Campfire");
    // Reduced motion: nothing moves until asked.
    await expect(page.locator("#toy-alive")).not.toBeChecked();
    await page.click("#toy-alive");
    await page.waitForTimeout(600);
    const canvas = page.locator("#stage");
    const a = await canvas.screenshot({ type: "png" });
    await page.waitForTimeout(700);
    const b = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, a, b)).toBeGreaterThan(1500);
    await page.click(".toy-card[data-toy='cactus']");
    await waitForToy(page, "Cactus");
    const still = await canvas.screenshot({ type: "png" });
    await page.click("#toy-move [data-move='bounce']");
    await page.waitForTimeout(250);
    const up = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, still, up)).toBeGreaterThan(1500);
    expect((await page.evaluate(() => window.__splashery.exportScene())).motion.move).toBe(
      "bounce",
    );
    expect(problems).toEqual([]);
  });

  test("patterns and flags recolour any toy and travel in the link", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.click("#tab-look");
    await page.selectOption("#pat-id", "flag");
    await page.waitForFunction(() => document.querySelectorAll("#pat-flag option").length > 150);
    await page.selectOption("#pat-flag", "fr");
    await expect(page.locator("#toy-status")).toContainText("in the colours of France");
    await page.waitForTimeout(1000);
    const flagged = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, flagged)).toBeGreaterThan(5000);
    await page.selectOption("#pat-id", "stripes");
    await page.waitForTimeout(800);
    const striped = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, flagged, striped)).toBeGreaterThan(3000);
    await page.selectOption("#pat-id", "flag");
    await page.selectOption("#pat-flag", "jp");
    const link = await page.evaluate(() => window.__splashery.app.copyLink());
    const hash = new URL(link).hash;
    const page2 = await page.context().newPage();
    await page2.goto(`/?renderer=webgl2&profile=weak${hash}`);
    await page2.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page2.locator("#toy-status")).toContainText("in the colours of Japan", {
      timeout: 60_000,
    });
    expect(problems).toEqual([]);
  });

  test("an old version 2 share link still opens", async ({ page }) => {
    const problems = watchConsole(page);
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 2,
      seed: 12,
      toy: { kind: "builtin", id: "donut" },
      effects: { twist: { on: true, amount: 0.4, wobble: 0, axis: "y" } },
      autoplay: { turntable: false, effect: "none" },
    });
    await page.goto(`/?renderer=webgl2&profile=weak#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await waitForToy(page, "Donut");
    const s = await page.evaluate(() => window.__splashery.exportScene());
    expect(s.version).toBe(3);
    expect(s.effects.twist).toMatchObject({ on: true, amount: 0.4 });
    expect(s.pattern.id).toBe("none");
    expect(problems).toEqual([]);
  });

  test("the sound switch remembers its choice", async ({ page }) => {
    await loadApp(page);
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
    await page.click("#sound-toggle");
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("splashery.sound"))).toBe("on");
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  });

  test("a tap plays the toy's own sound, and a toggle plays its on and off halves", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
    await loadApp(page);
    // Record what the app asks the sound engine to play.
    await page.evaluate(() => {
      const s = window.__splashery.app.sound;
      window.__played = [];
      const play = s.play.bind(s);
      s.play = (spec, o) => {
        window.__played.push(JSON.stringify(spec));
        play(spec, o);
      };
    });
    const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    await page.evaluate(() => (window.__played = []));
    await page.click("#toy-action");
    await page.waitForTimeout(300);
    await page.click("#toy-action");
    await page.waitForTimeout(300);
    const played = await page.evaluate(() => window.__played);
    expect(played).toEqual([
      JSON.stringify(TOY_SOUNDS.chest.on),
      JSON.stringify(TOY_SOUNDS.chest.off),
    ]);
    // A toy that only hops plays its own sound too.
    await page.click(".chip[data-category='balls']");
    await page.click(".toy-card[data-toy='basketball']");
    await waitForToy(page, "Basketball");
    await page.evaluate(() => (window.__played = []));
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect
      .poll(() => page.evaluate(() => window.__played))
      .toEqual([JSON.stringify(TOY_SOUNDS.basketball)]);
    // The audio context really ran.
    expect(await page.evaluate(() => window.__splashery.app.sound.ctx?.state)).toBe("running");
    expect(problems).toEqual([]);
  });

  test("a scan rig moves a part of a captured toy: the cat statue turns its head", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='cat-statue']");
    await waitForToy(page, "Cat statue");
    await expect(page.locator("#toy-action")).toHaveText("Look around");
    // No idle turntable, so only the rig moves.
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    const rest = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(450);
    const turned = await canvas.screenshot({ type: "png" });
    await page.waitForTimeout(3000);
    const back = await canvas.screenshot({ type: "png" });
    const moved = await countDifferentPixels(page, rest, turned);
    expect(moved).toBeGreaterThan(1500);
    // Only the head and tail move, and they come back.
    expect(await countDifferentPixels(page, rest, back)).toBeLessThan(moved / 4);
    expect(problems).toEqual([]);
  });

  test("rigs pick splats by colour, run effects and show add-ons; shelf shapes have rigs", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    // Strawberry: the seeds (a colour key) pop out and the berry blushes, then settles.
    await page.click(".toy-card[data-toy='strawberry']");
    await waitForToy(page, "Strawberry");
    await expect(page.locator("#toy-action")).toHaveText("Pop seeds");
    const rest = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(600);
    const popped = await canvas.screenshot({ type: "png" });
    const moved = await countDifferentPixels(page, rest, popped);
    expect(moved).toBeGreaterThan(3000);
    await page.waitForTimeout(3000);
    const back = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, rest, back)).toBeLessThan(moved / 4);
    // Lantern: a toggle lights a flame add-on; a second tap puts it out.
    await page.click(".toy-card[data-toy='lantern']");
    await waitForToy(page, "Lantern");
    expect(await page.evaluate(() => !!window.__splashery.player.stage.toy.addon)).toBe(true);
    const dark = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(1200);
    const lit = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, dark, lit)).toBeGreaterThan(800);
    await page.click("#toy-action");
    await page.waitForTimeout(1500);
    const out = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, dark, out)).toBeLessThan(400);
    // The jelly blob (a procedural shelf shape) splits in three.
    await page.click(".chip[data-category='shapes']");
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    await expect(page.locator("#toy-action")).toHaveText("Split");
    const whole = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(900);
    const split = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, whole, split)).toBeGreaterThan(5000);
    expect(problems).toEqual([]);
  });

  test("the chess set plays the Opera Game, and the laptop types what you type", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    // Chess: a tap starts the game; pieces leave their squares.
    await page.click(".chip[data-category='toys']");
    await page.click(".toy-card[data-toy='chess-set']");
    await waitForToy(page, "Chess set");
    await expect(page.locator("#toy-action")).toHaveText("Play the Opera Game");
    const start = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.out?.tokens?.length ?? 0))
      .toBe(32);
    await page.waitForTimeout(4000);
    const later = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, start, later)).toBeGreaterThan(800);
    // Laptop: real keys type onto the screen.
    await page.click(".chip[data-category='objects']");
    await page.click(".toy-card[data-toy='laptop']");
    await waitForToy(page, "Laptop");
    const before = await canvas.screenshot({ type: "png" });
    await canvas.focus();
    await page.keyboard.type("Hi 42");
    await page.waitForTimeout(1500);
    const typed = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, typed)).toBeGreaterThan(300);
    // Keys the laptop takes do not trigger shortcuts (4 would pick the Magnet).
    expect(await page.evaluate(() => window.__splashery.app.tool)).toBe("orbit");
    expect(problems).toEqual([]);
  });

  test("a stretchy toy stretches when dragged and springs back; a drag off it orbits", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".chip[data-category='food']");
    await page.click(".toy-card[data-toy='gummy-bear']");
    await waitForToy(page, "Gummy bear");
    await expect(page.locator("#tool-hint")).toContainText("stretch it");
    // No idle turntable, so the camera turns only if a drag turns it.
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    const box = await canvas.boundingBox();
    const yaw = () => page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
    const yaw0 = await yaw();
    const rest = await canvas.screenshot({ type: "png" });
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height * 0.52;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + i * 20, y0 - i * 8);
    await expect.poll(() => page.evaluate(() => window.__splashery.player.driver.grab.held)).toBe(true); // prettier-ignore
    await page.waitForTimeout(400);
    const held = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, rest, held)).toBeGreaterThan(3000);
    await page.mouse.up();
    // The camera did not turn, and the bear springs back.
    expect(await yaw()).toBeCloseTo(yaw0, 3);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.driver.grab.on), { timeout: 5000 })
      .toBe(false);
    // A drag that starts beside the toy still orbits.
    await page.mouse.move(box.x + 30, box.y + box.height - 60);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(box.x + 30 + i * 25, box.y + box.height - 60);
    await page.mouse.up();
    expect(Math.abs((await yaw()) - yaw0)).toBeGreaterThan(0.1);
    expect(problems).toEqual([]);
  });

  test("every toy's sound renders: audible, not clipping, under five seconds", async ({ page }) => {
    await page.goto("/tools/");
    const bad = await page.evaluate(async () => {
      const { TOY_SOUNDS } = await import("/src/toy-sounds.js");
      const { playSpec, specFor } = await import("/src/voices.js");
      const { masterChain } = await import("/src/sound.js");
      const out = [];
      for (const [id, spec] of Object.entries(TOY_SOUNDS)) {
        for (const on of [true, false]) {
          const half = specFor(spec, on);
          if (!on && half === specFor(spec, true)) continue;
          const rate = 16000;
          const ctx = new OfflineAudioContext(1, rate * 6, rate);
          playSpec(ctx, masterChain(ctx), 0.01, half);
          const d = (await ctx.startRendering()).getChannelData(0);
          let peak = 0;
          let last = 0;
          for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
            if (a > 0.003) last = i;
          }
          if (!(peak > 0.02 && peak < 0.99 && last / rate < 5))
            out.push(`${id}${on ? "" : ":off"} peak ${peak.toFixed(3)} ${(last / rate).toFixed(2)} s`); // prettier-ignore
        }
      }
      return out;
    });
    expect(bad).toEqual([]);
  });

  test("v3 screenshots at 1440x900 and 390x844", async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desk.newPage();
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    await page.click("#toy-action");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "gb" }));
    await expect(page.locator("#toy-status")).toContainText("United Kingdom");
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(SHOTS, "v3-1440x900.png") });
    expect(problems).toEqual([]);
    await desk.close();
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const p2 = await phone.newPage();
    await loadApp(p2);
    await p2.click(".chip[data-category='weather']");
    await p2.click(".toy-card[data-toy='campfire']");
    await waitForToy(p2, "Campfire");
    await p2.tap("#sheet-toggle");
    await p2.waitForTimeout(1200);
    await p2.screenshot({ path: path.join(SHOTS, "v3-390x844.png") });
    await phone.close();
  });

  test("an embedded kit toy opens when tapped", async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto("/embed/?toy=chest&renderer=webgl2");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.scene.motion.controls.open))
      .toBe(1);
    expect(problems).toEqual([]);
  });
});

test.describe("Sports balls (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Near-black pixels in the stage (the basketball's seams).
  async function darkPixels(page) {
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
      for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) n++;
      return n;
    }, shot.toString("base64"));
  }

  test("a ball in a country's colours keeps its seams", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".chip[data-category='balls']");
    await expect(page.locator("#shelf .toy-card")).toHaveCount(
      TOYS.filter((t) => t.category === "balls").length,
    );
    await page.click(".toy-card[data-toy='basketball']");
    await waitForToy(page, "Basketball");
    const seams = await darkPixels(page);
    expect(seams).toBeGreaterThan(800);
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.waitForFunction(() => document.querySelectorAll("#toy-flag option").length > 150);
    await page.selectOption("#toy-flag", "us");
    await expect(page.locator("#toy-status")).toContainText("in the colours of the United States");
    await page.waitForTimeout(1200);
    const after = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, after)).toBeGreaterThan(8000);
    // The seams stay dark under the flag.
    expect(await darkPixels(page)).toBeGreaterThan(seams * 0.6);
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.pattern).toMatchObject({ id: "flag", flag: "us" });
    expect(problems).toEqual([]);
  });

  test("ball screenshots at 1440x900 and 390x844", async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desk.newPage();
    await loadApp(page);
    await page.click(".chip[data-category='balls']");
    await page.click(".toy-card[data-toy='soccer-ball']");
    await waitForToy(page, "Soccer ball");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "br" }));
    await expect(page.locator("#toy-status")).toContainText("Brazil");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, "balls-1440x900.png") });
    await desk.close();
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const p2 = await phone.newPage();
    await loadApp(p2);
    await p2.tap(".chip[data-category='balls']");
    await p2.tap(".toy-card[data-toy='basketball']");
    await waitForToy(p2, "Basketball");
    await p2.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "us" }));
    await expect(p2.locator("#toy-status")).toContainText("United States");
    await p2.waitForTimeout(1500);
    await p2.screenshot({ path: path.join(SHOTS, "balls-390x844.png") });
    await phone.close();
  });
});

test.describe("Sharpness and embeds (WebGL2)", () => {
  test.use({ reducedMotion: "reduce" });

  // Canvas backing pixels = CSS pixels x min(device pixel ratio, tier cap).
  for (const [scale, tier, ratio] of [
    [2, "high", 2],
    [3, "mid", 2],
    [3, "max", 3],
    [3, "low", 1.5],
  ]) {
    test(`the canvas renders at ${ratio}x on a ${scale}x screen at the ${tier} tier`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width: 400, height: 300 },
        deviceScaleFactor: scale,
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      await page.goto(`/embed/?toy=blob&renderer=webgl2&profile=${tier}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      const size = () =>
        page.evaluate(() => {
          const c = window.__splashery.player.stage.canvas;
          return [c.width, c.height, c.clientWidth, c.clientHeight];
        });
      await expect
        .poll(async () => {
          const [w, h, cw, ch] = await size();
          return Math.abs(w - cw * ratio) <= 1 && Math.abs(h - ch * ratio) <= 1;
        })
        .toBe(true);
      if (tier === "mid") {
        // Slow frames while moving drop the ratio; the still view gets it back.
        const reduced = await page.evaluate(() => {
          const s = window.__splashery.player.stage;
          s.skipFrames = 0;
          s.setBusy(true);
          for (let i = 0; i < 12; i++) s.timeFrame(40);
          return s.canvas.width / s.canvas.clientWidth;
        });
        expect(reduced).toBeLessThan(ratio);
        expect(reduced).toBeGreaterThanOrEqual(1);
        await expect
          .poll(async () => {
            const [w, , cw] = await size();
            return Math.abs(w - cw * ratio) <= 1;
          })
          .toBe(true);
      }
      await ctx.close();
    });
  }

  test("Detail: High raises the tier, stays in this browser and stays out of links", async ({
    page,
  }) => {
    await loadApp(page, "/?renderer=webgl2&adapt=off");
    await waitForToy(page, "Cactus");
    await page.click("#tab-look");
    await page.click("#look-detail button[data-detail='high']");
    await expect.poll(() => page.evaluate(() => window.__splashery.player.profile)).toBe("high");
    await expect(page.locator("#look-detail button[data-detail='high']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => localStorage.getItem("splashery.detail"))).toBe("high");
    const scene = JSON.stringify(await page.evaluate(() => window.__splashery.exportScene()));
    expect(scene).not.toMatch(/profile|"detail":"|"high"/);
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await page.evaluate(() => window.__splashery.player.profile)).toBe("high");
    await page.click("#tab-look");
    await page.click("#look-detail button[data-detail='auto']");
    expect(await page.evaluate(() => localStorage.getItem("splashery.detail"))).toBe(null);
  });

  test("a transparent embed stays transparent on a dark-mode page", async ({ browser }) => {
    // A host that supports dark mode itself, with today's snippet, and a
    // plain host with the older snippet's color-scheme:normal.
    for (const [meta, scheme] of [
      ['<meta name="color-scheme" content="light dark">', "light"],
      ["", "normal"],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: 480, height: 360 },
        colorScheme: "dark",
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      await page.setContent(
        `<!doctype html>${meta}<body style="margin:0;background:#dd2222">` +
          `<iframe src="http://127.0.0.1:4173/embed/?bg=transparent&toy=blob&renderer=webgl2" ` +
          `style="width:400px;height:300px;border:0;color-scheme:${scheme}"></iframe></body>`,
      );
      const frame = page.frameLocator("iframe");
      await expect(frame.locator("body[data-ready='true']")).toHaveCount(1, { timeout: 180_000 });
      await page.waitForTimeout(1500);
      const png = PNG.sync.read(await page.screenshot());
      // The empty left edge of the iframe: the host's red shows through.
      for (const [x, y] of [
        [12, 150],
        [12, 40],
      ]) {
        const i = (y * png.width + x) * 4;
        const [r, g, b] = png.data.subarray(i, i + 3);
        expect({ scheme, x, y, red: r > 190 && g < 70 && b < 70 }).toEqual({
          scheme,
          x,
          y,
          red: true,
        });
      }
      await ctx.close();
    }
  });

  test("embeds frame the toy closer, take ?zoom= and zoom with buttons and the wheel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 300 });
    const open = async (query) => {
      await page.goto(`/embed/?toy=blob&renderer=webgl2&profile=low${query}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    };
    const distance = () =>
      page.evaluate(() => window.__splashery.player.camera.getState().distance);
    await open("&zoom=2");
    expect(await distance()).toBeCloseTo(1.9, 3);
    await open("&zoom=99&controls=0");
    expect(await distance()).toBeCloseTo(1.9, 3);
    await expect(page.locator("#zoom-buttons")).toBeHidden();
    await open("");
    const start = await distance();
    expect(start).toBeCloseTo(3.8, 3);

    // The page scrolls under a plain wheel until the toy is clicked.
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(200);
    expect(await distance()).toBe(start);
    await expect(page.locator("#embed-status")).toHaveText("Pinch or Ctrl+scroll to zoom");
    await page.mouse.click(box.x + 30, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await expect.poll(distance).toBeLessThan(start);
    // Leaving the toy gives the wheel back to the page.
    await page.evaluate(() =>
      document.getElementById("stage").dispatchEvent(new PointerEvent("pointerleave")),
    );
    const after = await distance();
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
    expect(await distance()).toBe(after);

    await page.click("#zoom-buttons button[data-zoom='-1']");
    await expect.poll(distance).toBeGreaterThan(after);

    // The canvas follows the frame when it is resized.
    await page.setViewportSize({ width: 320, height: 240 });
    await expect.poll(() => page.evaluate(() => document.getElementById("stage").width)).toBe(320);
  });

  test("the embed snippet is responsive and has a size picker", async ({ page }) => {
    await loadApp(page);
    await waitForToy(page, "Cactus");
    await page.click("#tab-share");
    const snippet = page.locator("#embed-snippet");
    await expect(snippet).toHaveValue(
      /^<iframe src="[^"]+" title="Splashery toy" loading="lazy" style="width:100%;max-width:600px;aspect-ratio:4\/3;border:0;border-radius:12px"><\/iframe>$/,
    );
    expect(await snippet.inputValue()).not.toMatch(/ (width|height)="/);
    await expect(page.locator("#element-snippet")).toHaveValue(/max-width:600px;aspect-ratio:4\/3/);
    await page.selectOption("#embed-size", "full");
    await expect(snippet).toHaveValue(/style="width:100%;aspect-ratio:4\/3;border:0/);
    await page.selectOption("#embed-size", "small");
    await page.check("#embed-transparent");
    await expect(snippet).toHaveValue(/\/embed\/\?bg=transparent#s=/);
    await expect(snippet).toHaveValue(/max-width:360px;.*;color-scheme:light"/);
  });

  test("a shelf thumbnail that fails is fetched once more, then shows a plain tile", async ({
    page,
  }) => {
    await loadApp(page);
    const [first, second] = await page.evaluate(() =>
      [...document.querySelectorAll(".toy-card")].slice(0, 2).map((b) => b.dataset.toy),
    );
    await page.route("**/assets/toys/*/thumb.webp*", (route) => {
      const url = route.request().url();
      if (url.includes(`/${second}/`)) return route.abort();
      if (url.includes(`/${first}/`) && !url.includes("retry=")) return route.abort();
      return route.continue();
    });
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const img = page.locator(`.toy-card[data-toy='${first}'] img`);
    await expect(img).toHaveAttribute("src", /retry=/);
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(page.locator(`.toy-card[data-toy='${second}'] span.thumb`)).toHaveCount(1);
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

    // Swiping the handle up opens the shelf grid, swiping down closes it.
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
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await expect(page.locator("#panel-body")).toBeHidden();
    handle = await page.locator("#sheet-handle").boundingBox();
    await swipe(handle.x + handle.width / 2, handle.y + handle.height / 2, handle.y + 140);
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    // With the panel open, swiping the handle down closes it.
    await page.tap("#sheet-toggle");
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
    await expect(page.locator("#shelf .toy-card")).toHaveCount(searchToys("straw").length);
    await expect(page.locator("#shelf .toy-card").first()).toHaveAttribute(
      "data-toy",
      "strawberry",
    );
    await page.press("#shelf-search", "Enter");
    await waitForToy(page, "Strawberry");
    expect(problems).toEqual([]);
  });

  test("dragging the shelf up opens a grid, and picking a toy folds it back", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
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
    const shelf = page.locator("#shelf");
    const row = await shelf.boundingBox();
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "shelf-row-390x844.png") });

    // Drag the row itself up.
    await swipe(row.x + 120, row.y + row.height / 2, row.y - 160);
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await expect(page.locator("#panel-body")).toBeHidden();
    await expect(page.locator("#sheet-toggle")).toHaveText("Done");
    const grid = await page.evaluate(() => {
      const el = document.getElementById("shelf");
      const r = el.getBoundingClientRect();
      const tops = new Set(
        [...el.querySelectorAll(".toy-card")].slice(0, 12).map((c) => c.offsetTop),
      );
      return {
        cols: getComputedStyle(el).gridTemplateColumns.split(" ").length,
        rows: tops.size,
        height: r.height,
        doc: document.documentElement.scrollWidth,
        shelfOverflow: el.scrollWidth - el.clientWidth,
        chips: document.getElementById("shelf-chips").getBoundingClientRect().bottom <= r.top,
      };
    });
    expect(grid.cols).toBeGreaterThanOrEqual(3);
    expect(grid.rows).toBeGreaterThanOrEqual(3);
    expect(grid.height).toBeGreaterThan(row.height * 3);
    expect(grid.doc).toBeLessThanOrEqual(390);
    expect(grid.shelfOverflow).toBeLessThanOrEqual(0);
    expect(grid.chips).toBe(true);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, "shelf-grid-390x844.png") });

    // Tapping a card loads that toy and folds the grid back to the row.
    await page.tap('#shelf .toy-card[data-toy="strawberry"]');
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    await waitForToy(page, "Strawberry");
    await expect(page.locator('#shelf .toy-card[data-toy="strawberry"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Swiping down from the top of the grid, and Done, both go back to the row.
    await swipe(row.x + 120, row.y + row.height / 2, row.y - 160);
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    const g = await shelf.boundingBox();
    await swipe(g.x + 120, g.y + 30, g.y + 250);
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    const row2 = await shelf.boundingBox();
    expect(Math.abs(row2.height - row.height)).toBeLessThan(2);
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.tap("#sheet-toggle");
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    await expect(page.locator("#panel-body")).toBeHidden();

    // More still opens the panel.
    await page.tap("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeVisible();

    // Long names wrap onto two lines instead of ending in "…".
    const cut = await page.evaluate(
      () =>
        [...document.querySelectorAll("#shelf .toy-card span")].filter((s) => {
          const h = s.scrollHeight;
          return s.scrollWidth > s.clientWidth + 1 || h > s.clientHeight + 1;
        }).length,
    );
    expect(cut).toBe(0);
    expect(problems).toEqual([]);
  });

  test("the Make pane explains where to find your own splat", async ({ page }) => {
    await loadApp(page);
    await page.tap("#sheet-toggle");
    await page.tap("#tab-make");
    const help = page.locator("#byo-help");
    await expect(help).toBeVisible();
    await expect(help).not.toHaveAttribute("open", "");
    await help.locator("summary").tap();
    await expect(help).toHaveAttribute("open", "");
    const links = {
      "help-superspl": "https://superspl.at/",
      "help-editor": "https://superspl.at/editor",
      "help-cc": "https://creativecommons.org/cc-licenses/",
      "help-scaniverse": "https://scaniverse.com/",
      "help-polycam": "https://poly.cam/",
      "help-luma": "https://lumalabs.ai/",
      "help-kiri": "https://www.kiriengine.app/",
    };
    for (const [id, href] of Object.entries(links)) {
      await expect(page.locator(`#${id}`)).toHaveAttribute("href", href);
      await expect(page.locator(`#${id}`)).toHaveAttribute("rel", /noopener/);
    }
    for (const word of [".ply", ".splat", ".spz", ".sog", "CC0", "share link"])
      await expect(help).toContainText(word);
    await help.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "make-help-390x844.png") });
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
    // The shelf grid fits too.
    await page.tap("#sheet-toggle");
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    const m3 = await page.evaluate(() => {
      const el = document.getElementById("shelf");
      return {
        doc: document.documentElement.scrollWidth,
        shelf: el.scrollWidth - el.clientWidth,
        cols: getComputedStyle(el).gridTemplateColumns.split(" ").length,
      };
    });
    expect(m3.doc).toBeLessThanOrEqual(360);
    expect(m3.shelf).toBeLessThanOrEqual(0);
    expect(m3.cols).toBeGreaterThanOrEqual(3);
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
    // The kit shader variant (parts, behaviours) and the pattern layer on WebGPU.
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    const closed = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "br" }));
    await page.waitForTimeout(2000);
    const open = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, closed, open)).toBeGreaterThan(3000);
    expect(problems).toEqual([]);
  });
});
