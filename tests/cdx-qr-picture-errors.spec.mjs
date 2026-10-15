import { test, expect } from "@playwright/test";
import { encodeQR } from "../src/qr/encode.js";
import { fitPictureErrors } from "../src/qr/picture-errors.js";
import { rotateCode } from "../src/qr-craft/orientation.js";
import { rasterize } from "../src/qr-craft/picture.js";
import { read } from "../tools/qrc-picture.mjs";
import { readZxingCpp } from "../tools/qrs-study/readers.mjs";

// Uneven block sizes and rotated grids exercise the interleaved codeword map.
test("Picture errors preserve function modules, reserve correction margin, and decode", async () => {
  const text = "https://example.org/a-picture-with-correction-margin";
  const source = { w: 40, h: 40, data: new Float32Array(40 * 40 * 3) };
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++) source.data.set([x / 40, y / 40, (x + y) / 80], (y * 40 + x) * 3);
  for (const version of [6, 9, 17, 30])
    for (const turns of [0, 1, 2, 3]) {
      const encoded = encodeQR(text, "H", { min: version, boost: false });
      const code = rotateCode(encoded, turns),
        fitted = fitPictureErrors(code, source, 0.9);
      expect(fitted.intentionalErrors.fraction).toBe(0.6);
      expect(fitted.intentionalErrors.flipped).toBeGreaterThan(0);
      for (const used of fitted.intentionalErrors.usedByBlock)
        expect(used).toBeLessThanOrEqual(Math.floor(fitted.intentionalErrors.maxErrors * 0.6));
      expect(fitted.encodedDark).toBe(code.dark);
      expect(fitted.role).toBe(code.role);
      for (let m = 0; m < code.dark.length; m++)
        if (code.role[m]) expect(fitted.dark[m]).toBe(code.dark[m]);
      const cells = new Float32Array(code.size * code.size * 3);
      for (let m = 0; m < code.dark.length; m++)
        cells.fill(fitted.dark[m] ? 0 : 1, m * 3, m * 3 + 3);
      const image = rasterize({ code: fitted, G: code.size, k: 1, cells }, 8, { blur: 0.3 });
      expect(read(image.data, image.width, image.height), `${version}/${turns} jsQR`).toBe(text);
      expect(await readZxingCpp(image), `${version}/${turns} zxing-cpp`).toBe(text);
    }
});

test("Picture errors leave other correction levels untouched", () => {
  const code = encodeQR("https://example.org/", "M", { boost: false });
  expect(fitPictureErrors(code, { w: 1, h: 1, data: new Float32Array(3) })).toBe(code);
});
