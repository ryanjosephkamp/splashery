// Splashery v2 smoke test. Runs in headless Chromium with SwiftShader (see
// playwright.config.mjs). WebGL2 assertions force ?renderer=webgl2 and are
// never skipped in the sandbox; WebGPU assertions skip with a message when
// Chromium offers no WebGPU adapter.

import { expect } from "@playwright/test";

import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");

// The test server's origin: SPLASHERY_PORT gives each local lane its own (docs/OPERATING.md, "Local
// lanes"); everyone else keeps 4173, as playwright.config.mjs does.
const ORIGIN = `http://127.0.0.1:${Number(process.env.SPLASHERY_PORT) || 4173}`;
// Keep the original cactus assertions deterministic; labs=1 retains full-catalog coverage.
// Fresh-visit and public-only behavior have separate release checks below.
const WEBGL = "/?renderer=webgl2&profile=weak&labs=1&first-toy=cactus";
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

// Waits until the camera has eased into the toy's home view (Fix12: in a slow browser, frames come
// about once a second and the ease moves at most 0.1 s a frame, so it outlasts waitForToy's pause).
async function cameraStill(page) {
  await page.waitForFunction(
    () => {
      const c = window.__splashery.player.camera;
      const d = Math.abs(c.cur.yaw - c.tgt.yaw) + Math.abs(c.cur.pitch - c.tgt.pitch) + Math.abs(c.cur.distance - c.tgt.distance) / (c.tgt.distance || 1); // prettier-ignore
      return (
        d < 1e-4 &&
        c.target.every((v, i) => v === c.aim[i]) &&
        c.offset.every((v, i) => v === c.follow[i])
      );
    },
    null,
    { timeout: 30_000 },
  );
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

export {
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
};
