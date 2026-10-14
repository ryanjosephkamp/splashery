import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { deflateRawSync, gunzipSync } from "node:zlib";
import { createScene } from "../src/state.js";
import { MANUAL_PDF } from "../manual/pdf-edition.js";

const openingHash = Buffer.from(
  JSON.stringify(createScene({ toy: { kind: "builtin", id: "cactus" } })),
).toString("base64url");

test("opening gzip copies preserve every original byte", () => {
  const copies = JSON.parse(
    fs.readFileSync("docs/audits/load-time-2026-10/compressed-opening.json"),
  );
  for (const { source, file } of copies)
    expect(gunzipSync(fs.readFileSync(file)).equals(fs.readFileSync(source)), source).toBe(true);
});

test("the opening scan starts transferring before GPU initialization", async ({ page }) => {
  await page.addInitScript(() => {
    let scanStarted = false;
    const fetch = window.fetch;
    window.fetch = function (input, ...args) {
      if (String(input?.url ?? input).includes("/assets/toys/soda-can/")) scanStarted = true;
      return fetch.call(this, input, ...args);
    };
    window.__scanBeforeGpu = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (this.id === "stage" && kind === "webgl2") window.__scanBeforeGpu.push(scanStarted);
      return getContext.call(this, kind, ...args);
    };
  });
  const scene = Buffer.from(
    JSON.stringify(createScene({ toy: { kind: "builtin", id: "soda-can" } })),
  );
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off#s=j.${scene.toString("base64url")}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const order = await page.evaluate(() => window.__scanBeforeGpu);
  expect(order.length).toBeGreaterThan(0);
  expect(order.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("soda-can");
});

test("the native engine finishes transferring while the app entry is held", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/src/app.js", async (route) => {
    await held;
    await route.continue();
  });
  const engine = page.waitForResponse("**/vendor/playcanvas/playcanvas.min.mjs");
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off#s=j.${openingHash}`, {
    waitUntil: "commit",
  });
  try {
    await (await engine).finished();
  } finally {
    release();
  }
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(async () => (await import("/src/pc.js")).version)).toBe("2.22.3");
});

test("the app graph transfers while the selected scan helper is held", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/src/packs/real-objects.js", async (route) => {
    await held;
    await route.continue();
  });
  const scene = Buffer.from(
    JSON.stringify(createScene({ toy: { kind: "builtin", id: "sunglasses" } })),
  );
  const helper = page.waitForRequest("**/src/packs/real-objects.js", { timeout: 10000 });
  const app = page.waitForRequest("**/src/app.js", { timeout: 10000 });
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off#s=j.${scene.toString("base64url")}`, {
    waitUntil: "commit",
  });
  try {
    await helper;
    await app;
  } finally {
    release();
  }
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("sunglasses");
});

test("the selected scan helper transfers while an app dependency is held", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/src/ui.js", async (route) => {
    await held;
    await route.continue();
  });
  const scene = Buffer.from(
    JSON.stringify(createScene({ toy: { kind: "builtin", id: "soda-can" } })),
  );
  const helper = page.waitForRequest("**/src/packs/real-objects.js", { timeout: 10000 });
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off#s=j.${scene.toString("base64url")}`, {
    waitUntil: "commit",
  });
  try {
    await helper;
  } finally {
    release();
  }
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("soda-can");
});

for (const [id, format] of [
  ["sunglasses", "j"],
  ["pyrite-cubes", "d"],
])
  test(`${format} links finish their scan helper before GPU initialization`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__helperAtGpu = [];
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (this.id === "stage" && kind === "webgl2")
          window.__helperAtGpu.push(
            performance
              .getEntriesByType("resource")
              .some((r) => r.name.endsWith("/src/packs/real-objects.js") && r.responseEnd > 0),
          );
        return getContext.call(this, kind, ...args);
      };
    });
    const requests = [];
    page.on("request", (r) => requests.push(new URL(r.url()).pathname));
    const scene = Buffer.from(JSON.stringify(createScene({ toy: { kind: "builtin", id } })));
    const hash = `${format}.${(format === "d" ? deflateRawSync(scene) : scene).toString("base64url")}`;
    await page.goto(`/?renderer=webgl2&profile=weak&adapt=off&labs=1#s=${hash}`, {
      waitUntil: "commit",
    });
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe(id);
    const order = await page.evaluate(() => window.__helperAtGpu);
    expect(order.length).toBeGreaterThan(0);
    expect(order.every(Boolean)).toBe(true);
    expect(requests).toContain("/vendor/playcanvas/playcanvas.min.mjs");
    expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
  });

test("engine transfer starts while the stylesheet still blocks DOM readiness", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/styles.css", async (route) => {
    await held;
    await route.continue();
  });
  const engine = page.waitForRequest("**/playcanvas.min.mjs", { timeout: 10000 });
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off#s=j.${openingHash}`, {
    waitUntil: "commit",
  });
  try {
    await engine;
  } finally {
    release();
  }
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
});

test("native startup preserves the complete live PlayCanvas namespace and compressed help", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off&help=show#s=j.${openingHash}`);
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
  expect(requests).toContain("/vendor/playcanvas/playcanvas.min.mjs");
  expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
  expect(requests).toContain("/assets/opening/toy-help.mjs.gz");
});

test("unsupported native decompression retains the original engine and help", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "DecompressionStream", { value: undefined }),
  );
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off&help=show#s=j.${openingHash}`);
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
  await page.route(`**/manual/${MANUAL_PDF}.gz`, async (route) => {
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
