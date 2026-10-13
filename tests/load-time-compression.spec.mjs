import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";

test("opening gzip copies preserve every original byte", () => {
  const copies = JSON.parse(
    fs.readFileSync("docs/audits/load-time-2026-10/compressed-opening.json"),
  );
  for (const { source, file } of copies)
    expect(gunzipSync(fs.readFileSync(file)).equals(fs.readFileSync(source)), source).toBe(true);
});

test("compressed startup preserves the complete live PlayCanvas namespace and help", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&help=show");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await expect(page.locator("#help-toggle")).toBeVisible();
  const result = await page.evaluate(async () => {
    const bridge = await import("/src/pc.js"),
      direct = await import("/vendor/playcanvas/playcanvas.min.mjs");
    const help = await import("/src/toy-help.js");
    const player = window.__splashery.player;
    return {
      version: bridge.version,
      exports: Object.keys(bridge).length,
      equal: Object.keys(direct).every((key) => bridge[key] === direct[key]),
      liveApp: bridge.app === player.stage.app,
      help: document.querySelector("#help-line-text").textContent,
      originalHelp: help.toyHelp(player.toyInfo).howTo,
    };
  });
  expect(result).toMatchObject({ version: "2.22.3", exports: 1318, equal: true, liveApp: true });
  expect(result.help).toBe(result.originalHelp);
  expect(requests).toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
  expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs");
  expect(requests).toContain("/assets/opening/toy-help.mjs.gz");
});

test("unsupported native decompression retains the original engine and help", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "DecompressionStream", { value: undefined }),
  );
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&help=show");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await expect(page.locator("#help-toggle")).toBeVisible();
  expect(requests).toContain("/vendor/playcanvas/playcanvas.min.mjs");
  expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
  expect(requests).toContain("/src/toy-help.js");
  expect(requests).not.toContain("/assets/opening/toy-help.mjs.gz");
});

test("the manual transfer overlaps PDF.js loading and keeps the original PDF pages", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/manual/tinkerers-manual.pdf.gz", async (route) => {
    await held;
    await route.continue();
  });
  const decoder = page.waitForRequest("**/vendor/pdfjs/pdf.min.mjs", { timeout: 10000 });
  const chosen = page.evaluate(() => window.__splashery.app.chooseToy("your-book"));
  try {
    await decoder;
  } finally {
    release();
    await chosen;
  }
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("your-book");
  expect(
    await page.evaluate(() => window.__splashery.player.pictures.info().count),
  ).toBeGreaterThan(100);
});

test("an HTTP-decoded compressed engine retains its native exports", async ({ page }) => {
  await page.route("**/playcanvas.min.mjs.gz", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: fs.readFileSync("vendor/playcanvas/playcanvas.min.mjs"),
    }),
  );
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(async () => (await import("/src/pc.js")).version)).toBe("2.22.3");
});

test("a missing compressed engine falls back to its original module", async ({ page }) => {
  await page.route("**/playcanvas.min.mjs.gz", (route) => route.fulfill({ status: 404, body: "" }));
  const original = page.waitForRequest("**/vendor/playcanvas/playcanvas.min.mjs");
  await page.goto("/?renderer=webgl2&profile=weak&adapt=off");
  await original;
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(async () => (await import("/src/pc.js")).version)).toBe("2.22.3");
});
