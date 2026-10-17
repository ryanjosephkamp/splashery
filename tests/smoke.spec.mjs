// Task 101: independent smoke groups can run on separate suite shards.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";
import { TOYS, CATEGORIES, searchToys } from "../src/toys.js";
import { encodeSceneHash } from "../src/codec.js";

import {
  SHOTS,
  ORIGIN,
  WEBGL,
  NO_WEBGPU,
  watchConsole,
  loadApp,
  waitForToy,
  cameraStill,
  countDifferentPixels,
  inkPixels,
} from "./smoke-helpers.mjs";

test.describe("Splashery app (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("loads with no console errors and shows the shelf", async ({ page }) => {
    const problems = watchConsole(page);
    const renderer = await loadApp(page);
    expect(renderer).toBe("webgl2");
    await waitForToy(page, "Cactus");
    const cards = page.locator(".toy-card");
    await expect(cards).toHaveCount(TOYS.length);
    for (const id of ["cactus", "strawberry", "cookie", "bee", "torus", "blob", "knot"]) {
      // The new shelf order puts Shapes farther down; exercise native lazy loading there too.
      await page.locator(`.toy-card[data-toy='${id}'] img`).scrollIntoViewIfNeeded();
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
    expect(await shown()).toEqual(["torus", "blob", "knot"]);
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
    await page.click("#tab-tools");
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
      await page.waitForFunction(() => window.__splashery.app.toolState?.started);
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(cx + dx + i * 8, cy - 30 + i * 6);
        await page.waitForFunction(() => !window.__splashery.app.toolState?.busy);
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
      /^<iframe src="http:\/\/127\.0\.0\.1:\d+\/embed\/#s=d\./,
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
    expect(sizes.has(`${ORIGIN}/assets/toys/bee/bee.sog`)).toBe(true);
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
    expect(state.link).toContain(ORIGIN.slice("http://".length));
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
    // The Share tab shows Video or GIF, one at a time (Share lane, October 15, 2026).
    await page.click("#clip-kind [data-clip=gif]");
    await page.selectOption("#gif-frames", "24");
    await page.selectOption("#gif-size", "256");
    const gif = await save("#export-gif");
    expect(gif.name).toMatch(/\.gif$/);
    expect(gif.size).toBeGreaterThan(20000);
    const webm = await page.evaluate(() => !document.getElementById("webm-row").hidden);
    if (webm) {
      await page.click("#clip-kind [data-clip=video]");
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
    await page.click("#tab-tools");
    await page.click("#fx-wind");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, "app-1440x900-dark.png") });
    expect(problems).toEqual([]);
    await ctx.close();
  });
});
