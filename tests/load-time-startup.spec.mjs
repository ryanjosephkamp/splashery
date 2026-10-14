import { test, expect } from "@playwright/test";
import { createScene } from "../src/state.js";
import { deflateRawSync } from "node:zlib";

const openingHash = Buffer.from(
  JSON.stringify(createScene({ toy: { kind: "builtin", id: "cactus" } })),
).toString("base64url");

test("the app graph transfers alongside the native engine", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.route("**/playcanvas.min.mjs", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(`/?renderer=none&labs=1#s=j.${openingHash}`, { waitUntil: "commit" });
    await expect.poll(() => requests.includes("/src/app.js"), { timeout: 5000 }).toBe(true);
    await expect.poll(() => requests.includes("/src/player.js"), { timeout: 5000 }).toBe(true);
    expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
  } finally {
    release();
  }
  await expect.poll(() => requests.includes("/src/player.js"), { timeout: 30000 }).toBe(true);
  expect(requests.filter((path) => path === "/src/app.js")).toHaveLength(1);
  expect(requests.filter((path) => path === "/vendor/playcanvas/playcanvas.min.mjs")).toHaveLength(
    1,
  );
  expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
  await expect(page.locator("#worlds-link")).toHaveJSProperty("hidden", false);
});

for (const hash of ["", `#s=j.${openingHash}`])
  test(`warmed ${hash ? "shared-scene" : "homepage"} graph responses do not produce preload warnings`, async ({
    page,
  }) => {
    const warnings = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("preload"))
        warnings.push(message.text());
    });
    await page.goto(`/?renderer=none${hash}`);
    await page.waitForSelector("body[data-ready='true']");
    await page.waitForTimeout(6000);
    expect(warnings).toEqual([]);
  });

test("the default homepage keeps the original engine module", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/?renderer=none#s=");
  await page.waitForSelector("body[data-ready='true']");
  expect(requests).toContain("/vendor/playcanvas/playcanvas.min.mjs");
  expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
});

for (const format of ["j", "d"])
  test(`${format} Book links use the native engine entry`, async ({ page }) => {
    const scene = Buffer.from(
      JSON.stringify(createScene({ toy: { kind: "builtin", id: "your-book" } })),
    );
    const bytes = format === "d" ? deflateRawSync(scene) : scene;
    const requests = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.goto(`/?renderer=none#s=${format}.${bytes.toString("base64url")}`);
    await page.waitForSelector("body[data-ready='true']");
    expect(requests).toContain("/vendor/playcanvas/playcanvas.min.mjs");
    expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs.gz");
    expect(requests).not.toContain("/src/boot.js");
  });
