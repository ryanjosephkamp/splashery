import { test, expect } from "@playwright/test";

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
    await page.goto("/?renderer=none&labs=1", { waitUntil: "commit" });
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

test("warmed graph responses do not produce unused-preload warnings", async ({ page }) => {
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("preloaded using link preload"))
      warnings.push(message.text());
  });
  await page.goto("/?renderer=none");
  await page.waitForSelector("body[data-ready='true']");
  await page.waitForTimeout(6000);
  expect(warnings).toEqual([]);
});
