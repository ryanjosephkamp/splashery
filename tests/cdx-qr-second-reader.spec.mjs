import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { loadSecondReader } from "../src/qr-craft/second-reader.js";
import { checkPreparedFramesBoth } from "../src/qr-craft/views.js";
import { encodeQR } from "../src/qr/encode.js";
import { rasterize } from "../src/qr-craft/picture.js";
import { read } from "../tools/qrc-picture.mjs";
import { readZxingCpp } from "../tools/qrs-study/readers.mjs";

test("The local C++ reader agrees with the study build and can reject a jsQR success", async () => {
  const second = await loadSecondReader(
    fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"),
  );
  const text = "https://example.org/independent-picture-check",
    code = encodeQR(text, "H");
  const cells = new Float32Array(code.size * code.size * 3);
  for (let m = 0; m < code.dark.length; m++) cells.fill(code.dark[m] ? 0 : 1, m * 3, m * 3 + 3);
  const w = { code, k: 1, G: code.size, cells };
  for (const ppm of [8, 4])
    for (const blur of [0.2, 0.3]) {
      const image = rasterize(w, ppm, { blur });
      expect(await second(image)).toBe(text);
      expect(await second(image)).toBe(await readZxingCpp(image));
    }
  const frames = [{ ppm: 4, blur: 0.3, view: 0, image: rasterize(w, 4) }];
  expect(await checkPreparedFramesBoth(frames, read, text, second)).toEqual({
    ok: true,
    readers: ["jsqr", "zxingcpp"],
  });
  expect(await checkPreparedFramesBoth(frames, read, text, async () => null)).toMatchObject({
    ok: false,
    reader: "zxingcpp",
    ppm: 4,
    blur: 0.3,
  });
});

test("Standard loads no C++ assets; Most detail workers use the local reader", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/qr-craft/vendor/zxing/")) requests.push(request.url());
  });
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(async () => {
    await import("/src/packs/qr-craft.js");
    const { app: a, qrCraft: q } = window.__splashery;
    q.autoCheck = false;
    await a.chooseToy("qr-picture");
  });
  expect(requests).toEqual([]);
  const first = await page.evaluate(async () => {
    const { validateCapture } = await import("/src/qr-craft/scan-pool.js"),
      { encodeQR } = await import("/src/qr/encode.js"),
      { rasterize } = await import("/src/qr-craft/picture.js");
    await import("/vendor/jsqr/jsQR.js");
    const readRGBA = (data, width, height) =>
      globalThis.jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
    const text = "https://example.org/local-worker",
      code = encodeQR(text, "H"),
      cells = new Float32Array(code.size * code.size * 3);
    for (let m = 0; m < code.dark.length; m++) cells.fill(code.dark[m] ? 0 : 1, m * 3, m * 3 + 3);
    const image = rasterize({ code, k: 1, G: code.size, cells }, 8);
    window.__dualScanForTest = () => validateCapture(image, code.size + 8, text, readRGBA, true);
    return validateCapture(image, code.size + 8, text, readRGBA, false);
  });
  expect(first.ok).toBe(true);
  await expect.poll(() => requests.some((url) => url.endsWith("zxing_reader.wasm"))).toBe(true);
  const result = await page.evaluate(() => window.__dualScanForTest());
  expect(result.ok).toBe(true);
  expect(result.workers).toBeGreaterThan(0);
  expect(requests.some((url) => url.endsWith("zxing_reader.wasm"))).toBe(true);
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});
