import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { makeWoven } from "../src/qr-craft/picture.js";
import { validateDetail } from "../src/qr-craft/scan-pool.js";
import { loadBlurKernel } from "../src/qr-craft/fast-blur.js";
import { loadSecondReader } from "../src/qr-craft/second-reader.js";
import { read } from "../tools/qrc-picture.mjs";

test("A narrower optional finder guard restores picture cells and still passes the complete two-reader forecast", async () => {
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
  await loadSecondReader(fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"));
  const pic = { w: 48, h: 48, data: new Float32Array(48 * 48 * 3).fill(0.5) };
  const options = {
    text: "https://example.org/finder-guard",
    shape: "square",
    fidelity: "detail",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    preferContinuous: true,
    texture: "tiles",
    channel: "weighted",
  };
  const original = makeWoven(pic, { ...options, finderGuard: 3 });
  const narrower = makeWoven(pic, { ...options, finderGuard: 1 });
  expect(narrower.plain.reduce((sum, x) => sum + x, 0)).toBeLessThan(
    original.plain.reduce((sum, x) => sum + x, 0),
  );
  expect(narrower.code.dark).toEqual(original.code.dark);
  expect(await validateDetail(narrower, pic, "square", read)).toMatchObject({
    ok: true,
    layoutChecked: true,
    readers: ["jsqr", "zxingcpp"],
  });
});
