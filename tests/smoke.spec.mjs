// Task 101: keep all seven upkeep screenshot tests at their original entry point.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { searchToys } from "../src/toys.js";

import { SHOTS, watchConsole, loadApp, waitForToy, inkPixels } from "./smoke-helpers.mjs";

test.describe("Splashery app (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

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

test.describe("Splashery v3 engine (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

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
});

test.describe("Sports balls (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

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
    // Tap immediately after the swipe: a native fling must not swallow it.
    const more = await page.locator("#sheet-toggle").boundingBox();
    expect(more.height).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(more.x + more.width / 2, more.y + more.height / 2);
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
    await expect(page.locator("#sheet-toggle")).toHaveText("More");
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
    // The reordered shelf reveals Strawberry farther down; pull to close starts at the top.
    await shelf.evaluate((el) => (el.scrollTop = 0));
    await expect(shelf).toHaveJSProperty("scrollTop", 0);
    const g = await shelf.boundingBox();
    await swipe(g.x + 120, g.y + 30, g.y + 250);
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    const row2 = await shelf.boundingBox();
    expect(Math.abs(row2.height - row.height)).toBeLessThan(2);
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    await expect(page.locator("#panel-body")).toBeHidden();

    // From the grid, More opens the settings in one tap, and Done closes them.
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.tap("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    await expect(page.locator("#sheet-toggle")).toHaveText("Done");
    await page.tap("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeHidden();

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
});
