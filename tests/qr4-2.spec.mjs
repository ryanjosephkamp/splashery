// Lane QR r4 part 2 (docs/handoff/QRr4.md): the scene as a QR code. In Node:
// the code's level and version for links of real lengths, and the limit. In
// the browser: Share → QR code shows a code that reads back (the saved PNG,
// with jsQR and zxing-cpp, straight and as a camera sees it: tilted and a
// little soft, with zxing-cpp), and opening what it holds lands on the same scene; a scene
// too long for one code says so and offers Save JSON.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { readBarcodes } from "zxing-wasm/full";
import { initZxingCpp } from "../tools/qrs-study/readers.mjs";
import { shareCode, MAX_BYTES } from "../src/qr/share-code.js";
import { gaussBlur } from "../src/qr-craft/picture.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const readJs = (img) => jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null; // prettier-ignore
async function readZx(img) {
  await initZxingCpp();
  const r = await readBarcodes({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height, colorSpace: "srgb" }, { formats: ["QRCode"] }); // prettier-ignore
  return r.filter((x) => x.isValid).map((x) => x.text)[0] ?? null;
}

// A camera's view of a flat picture: tilted in perspective (the far edge
// shrunk by `k`), turned by `turn` radians, on a gray table, then softened.
function cameraView(img, { k = 0.85, turn = 0.1, blur = 1, out = 900 } = {}) {
  const o = new Uint8ClampedArray(out * out * 4);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  for (let y = 0; y < out; y++)
    for (let x = 0; x < out; x++) {
      // Screen to the picture's plane: undo the turn, then the perspective.
      const X = (x - out / 2) / (out * 0.3);
      const Y = (y - out / 2) / (out * 0.3);
      const u0 = c * X + s * Y;
      const v0 = -s * X + c * Y;
      const scale = 1 + (1 - k) * v0; // nearer rows (v0 > 0) larger
      const u = u0 / scale;
      const v = v0 / scale;
      const px = Math.floor(((u + 1) / 2) * img.width);
      const py = Math.floor(((v + 1) / 2) * img.height);
      const j = (y * out + x) * 4;
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) {
        o[j] = o[j + 1] = o[j + 2] = 120;
      } else {
        const i = (py * img.width + px) * 4;
        o[j] = img.data[i];
        o[j + 1] = img.data[i + 1];
        o[j + 2] = img.data[i + 2];
      }
      o[j + 3] = 255;
    }
  if (blur) gaussBlur(o, out, out, blur);
  return { data: o, width: out, height: out };
}

test.describe("the scene as a QR code: sizes", () => {
  test("links of real lengths get M, then L, and a link longer than one code is refused", () => {
    const base = "https://ryanjosephkamp.github.io/splashery/#s=";
    const link = (n) => base + "x".repeat(n - base.length);
    // A default toy's link is about 700 characters.
    const a = shareCode(link(700));
    expect([a.ok, a.level, a.code.version]).toEqual([true, "M", 21]);
    // About 2,000 (a busy scene): M would need past version 30, so L.
    const b = shareCode(link(2000));
    expect([b.ok, b.level]).toEqual([true, "L"]);
    expect(b.code.version).toBeLessThanOrEqual(40);
    // The most one code holds, and one byte more.
    expect(shareCode(link(MAX_BYTES)).ok).toBe(true);
    expect(shareCode(link(MAX_BYTES + 1)).ok).toBe(false);
  });
});

test("Share → QR code: the code reads back, as a camera sees it too, and opens the same scene", async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("graph-plotter"));
  await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "graph-plotter" && !window.__splashery.app.busy, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.app.player.switchTo({ options: { eq: "y = sin(2*x)*x/3" } })); // prettier-ignore
  await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
  // Share tab → QR code.
  await page.evaluate(() => document.getElementById("share-qr").click());
  await page.waitForSelector("#sqr[open]");
  await page.waitForFunction(() => document.getElementById("sqr-check")?.textContent.includes("It scans"), null, { timeout: 60_000 }); // prettier-ignore
  const shown = await page.evaluate(() => ({ info: document.getElementById("sqr-info").textContent, scene: window.__splashery.app.exportScene() })); // prettier-ignore
  expect(shown.info).toMatch(/Version \d+/);
  // The saved PNG reads back with jsQR and zxing-cpp, straight and as a
  // camera sees it.
  const dl = page.waitForEvent("download");
  await page.click("#sqr-save");
  const file = await (await dl).path();
  const png = PNG.sync.read(fs.readFileSync(file));
  const url = readJs(png);
  expect(url).toMatch(/#s=/);
  expect(await readZx(png)).toBe(url);
  const tilted = cameraView(png);
  // zxing-cpp is the closer stand-in for a phone's reader; jsQR handles
  // a steep tilt poorly (docs/handoff/QRr4.md, "Camera check").
  expect(await readZx(tilted)).toBe(url);
  // What it holds opens the same scene (a fresh page, as a phone would).
  const page2 = await context.newPage();
  await page2.goto(url.replace(/^https:\/\/[^#]+/, "http://127.0.0.1:4173/"));
  await page2.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page2.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "graph-plotter" && !window.__splashery.app.busy, null, { timeout: 120_000 }); // prettier-ignore
  const opened = await page2.evaluate(() => window.__splashery.app.exportScene());
  expect(opened.toy.id).toBe(shown.scene.toy.id);
  expect(opened.toy.options).toEqual(shown.scene.toy.options);
  expect(errors).toEqual([]);
});

test("a scene too long for one QR code says so and offers Save JSON", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // 150 paint dabs: about 3,700 characters as a link.
  await page.evaluate(() => {
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    window.__splashery.app.player.scene.paint.stamps = Array.from({ length: 150 }, () => [r() - 0.5, r() - 0.5, r() - 0.5, 0.02 + r() * 0.1, "#" + Math.floor(r() * 0xffffff).toString(16).padStart(6, "0"), 1]); // prettier-ignore
  });
  await page.evaluate(() => document.getElementById("share-qr").click());
  await page.waitForSelector("#sqr[open]");
  expect(await page.locator("#sqr-long").textContent()).toMatch(/more than one QR code can hold/);
  expect(await page.locator("#sqr-json").count()).toBe(1);
  expect(await page.locator("#sqr-canvas").count()).toBe(0);
});
