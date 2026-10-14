import { test, expect } from "@playwright/test";
import { createScene } from "../src/state.js";

const openingHash = Buffer.from(
  JSON.stringify(createScene({ toy: { kind: "builtin", id: "cactus" } })),
).toString("base64url");

test("the app graph starts transferring before the compressed engine finishes", async ({
  page,
}) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.route("**/playcanvas.min.mjs.gz", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(`/?renderer=none&labs=1#s=j.${openingHash}`, { waitUntil: "commit" });
    await expect.poll(() => requests.includes("/src/app.js"), { timeout: 5000 }).toBe(true);
    await page.waitForLoadState("domcontentloaded");
    expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs");
  } finally {
    release();
  }
  await expect.poll(() => requests.includes("/src/player.js"), { timeout: 30000 }).toBe(true);
  expect(requests.filter((path) => path === "/src/app.js")).toHaveLength(1);
  expect(requests).not.toContain("/vendor/playcanvas/playcanvas.min.mjs");
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
