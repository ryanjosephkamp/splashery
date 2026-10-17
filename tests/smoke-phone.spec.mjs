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

  test("a panel opened while a toy from the grid is still loading stays open", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await waitForToy(page, "Cactus");
    // A slow download, like a scan on a phone.
    await page.route("**/assets/toys/horse-statue/**", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.tap("#sheet-handle");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.tap('#shelf .toy-card[data-toy="horse-statue"]');
    await expect(page.locator("body")).not.toHaveClass(/shelf-grid/);
    // More, while the horse is still loading.
    await page.tap("#sheet-toggle");
    await expect(page.locator("#panel-body")).toBeVisible();
    await waitForToy(page, "Horse");
    await page.waitForTimeout(500);
    await expect(page.locator("#panel-body")).toBeVisible();
    await page.tap("#tab-look");
    await expect(page.locator("#tab-look")).toHaveAttribute("aria-selected", "true");
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
