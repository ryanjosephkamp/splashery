import { test, expect } from "@playwright/test";
import { deflateRawSync } from "node:zlib";
import { createScene } from "../src/state.js";

test("an unused PDF decompressor cannot block an ordinary opening", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/src/gzip.js", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/?renderer=none", { waitUntil: "commit" });
  try {
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 10000 });
  } finally {
    release();
  }
});

// A slow shared-scene decode must not postpone renderer initialization.
// This catches the extra pre-renderer decode introduced by scan prewarming.
test("renderer creation retains main's order before shared-scene decoding", async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.DecompressionStream;
    let release;
    const held = new Promise((resolve) => (release = resolve));
    window.__releaseScene = release;
    window.DecompressionStream = class {
      constructor(format) {
        const stream = new Native(format);
        this.writable = stream.writable;
        this.readable =
          format === "deflate-raw"
            ? stream.readable.pipeThrough(
                new TransformStream({
                  async transform(chunk, controller) {
                    await held;
                    controller.enqueue(chunk);
                  },
                }),
              )
            : stream.readable;
      }
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (this.id === "stage" && kind === "webgl2") window.__rendererStarted = true;
      return getContext.call(this, kind, ...args);
    };
  });
  const scene = createScene({ toy: { kind: "builtin", id: "sunglasses" } });
  const hash = deflateRawSync(JSON.stringify(scene)).toString("base64url");
  await page.goto(`/?renderer=webgl2&profile=weak&adapt=off#s=d.${hash}`, {
    waitUntil: "domcontentloaded",
  });
  try {
    await expect
      .poll(() => page.evaluate(() => !!window.__rendererStarted), { timeout: 10000 })
      .toBe(true);
  } finally {
    await page.evaluate(() => window.__releaseScene());
  }
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(() => window.__splashery.player.toyInfo.id)).toBe("sunglasses");
});
