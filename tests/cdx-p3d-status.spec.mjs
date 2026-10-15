import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

const preview = (page) => page.getByRole("img", { name: "Photo preview", exact: true });

async function open(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  return errors;
}

// Hold only the geometry worker's input, then release it to finish the real build.
// The real loading cover remains visible while its theme and background change.
async function holdBuilds(page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__statusHold = true;
    window.__statusPending = [];
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        if (!new URL(url, location.href).pathname.endsWith("/photo3d/build-worker.js")) return;
        const send = this.postMessage.bind(this);
        this.postMessage = (message, ...args) => {
          if (window.__statusHold && message.type !== "colors")
            window.__statusPending.push(() => send(message, ...args));
          else send(message, ...args);
        };
      }
    };
  });
}

async function releaseBuild(page) {
  await page.evaluate(async () => {
    window.__statusHold = false;
    for (const send of window.__statusPending.splice(0)) send();
    await window.__statusBuild;
  });
  await expect(preview(page)).toHaveCount(0);
  await page.waitForFunction(() => !window.__splashery.player.loading && window.__psv.state().on);
}

async function expectBackground(page) {
  await expect(preview(page)).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = window.__splashery.player.stage.cameraEntity.camera.clearColor;
          const expected = document.createElement("div");
          expected.style.backgroundColor = `rgba(${c.r * 255},${c.g * 255},${c.b * 255},${c.a})`;
          document.body.append(expected);
          const color = getComputedStyle(expected).backgroundColor;
          expected.remove();
          const actual = getComputedStyle(
            document.querySelector('[aria-label="Photo preview"]'),
          ).backgroundColor;
          return actual === color ? "match" : `${actual} versus ${color}`;
        }),
      { timeout: 5000 },
    )
    .toBe("match");
}

for (const theme of ["dark", "light"]) {
  test(`${theme} loading cover follows the camera color on open and rebuild`, async ({ page }) => {
    await holdBuilds(page);
    const errors = await open(page);
    await page.evaluate((theme) => {
      const { app } = window.__splashery;
      app.setLook({ theme, background: "page" });
      window.__statusBuild = app.chooseToy("photo-3d");
    }, theme);
    await expect(preview(page)).toBeVisible();
    await expect
      .poll(() => preview(page).evaluate((image) => image.complete && image.naturalWidth > 0))
      .toBe(true);
    await fs.mkdir("tests/screenshots", { recursive: true });
    const tag = process.env.P3D_STATUS_SHOT || "after";
    if (theme === "dark")
      await page.screenshot({
        path: `tests/screenshots/cdx-p3d-status-dark-${tag}-390x844.png`,
        scale: "css",
      });
    await expectBackground(page);
    for (const look of [
      { theme: theme === "dark" ? "light" : "dark" },
      { background: "#234567" },
      { background: "transparent" },
      { theme, background: "page" },
    ]) {
      await page.evaluate((look) => window.__splashery.app.setLook(look), look);
      await expectBackground(page);
    }
    expect(await preview(page).evaluate((image) => image.style.padding)).toBe("12%");
    await releaseBuild(page);

    // Both depth and photo selection use the same real cover on uncached builds.
    for (const options of [{ depth: 0.75 }, { source: "street" }]) {
      await page.evaluate((options) => {
        window.__statusHold = true;
        window.__statusBuild = window.__splashery.app.setToyOptions(options);
      }, options);
      await expectBackground(page);
      await releaseBuild(page);
    }
    expect(errors).toEqual([]);
  });
}

test("Splats with the hybrid background uses the ordinary splat label", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  await page.waitForFunction(() => window.__psv.state().on);
  await page.evaluate(() => document.querySelector("#psv-splats").click());
  await page.waitForFunction(() => !window.__psv.state().on);
  const status = page.locator("#toy-status");
  await expect(status).toHaveText(/ · Hybrid$/);
  await expect(status).not.toContainText("undefined");
  const ordinary = await page.evaluate(async () => {
    const { formatCount } = await import("/src/state.js");
    const p = window.__splashery.player;
    return `${formatCount(p.toyInfo.splats + (p.pictures?.splats() || 0) + (p.chunks?.splats() || 0))} splats`;
  });
  await expect(status).toContainText(`${ordinary} · Hybrid`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await fs.mkdir("tests/screenshots", { recursive: true });
  await page.screenshot({
    path: "tests/screenshots/cdx-p3d-status-hybrid-1440x900.png",
    scale: "css",
  });
  expect(errors).toEqual([]);
});
