import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { encodeQR } from "../src/qr/encode.js";
import { weaveDetail } from "../src/qr-craft/detail.js";
import { squareSample } from "../src/qr-craft/picture.js";
import { validateDetail } from "../src/qr-craft/scan-pool.js";
import { loadBlurKernel } from "../src/qr-craft/fast-blur.js";
import { loadSecondReader } from "../src/qr-craft/second-reader.js";
import { read } from "../tools/qrc-picture.mjs";

test("Luminance-gradient projection changes less RGB color and keeps both readers' camera margin", async () => {
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
  await loadSecondReader(fs.readFileSync("src/qr-craft/vendor/zxing/reader/zxing_reader.wasm"));
  const picture = { w: 40, h: 40, data: new Float32Array(40 * 40 * 3).fill(0.5) },
    code = encodeQR("https://example.org/least-color-change", "H", { min: 6, boost: false }),
    options = { center: "small", margin: 0.14 },
    rgb = weaveDetail(code, picture, options),
    weighted = weaveDetail(code, picture, { ...options, channel: "weighted" }),
    source = squareSample(picture, weighted.G),
    error = (woven) => woven.cells.reduce((sum, color, i) => sum + (color - source[i]) ** 2, 0);
  expect(error(weighted)).toBeLessThan(error(rgb) * 0.85);
  weighted.rendering.texture = "tiles";
  const checked = await validateDetail(weighted, picture, "square", read);
  expect(checked).toMatchObject({ ok: true, readers: ["jsqr", "zxingcpp"] });
});
