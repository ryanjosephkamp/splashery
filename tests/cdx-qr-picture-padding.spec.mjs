import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { encodeQR } from "../src/qr/encode.js";
import { fitPadding } from "../src/qr/picture-padding.js";
import { rotateCode } from "../src/qr-craft/orientation.js";
import { rasterize } from "../src/qr-craft/picture.js";
import { readZxingCpp } from "../tools/qrs-study/readers.mjs";
const source = {
  w: 40,
  h: 40,
  data: Float32Array.from({ length: 4800 }, (_, i) => ((i * 131) % 419) / 419),
};
// Frozen from the original complete-code GF(2) solver, before the block rewrite.
const original = {
  "L/6": "775e4496e88b950ddbe0ce985291b862529200588fd8a4b0fe74d6dc6d87c4f5",
  "L/11": "d27b9403809500b0def13c3fb5adb4e032f7b2f9395d614902f8ed3b9908cdab",
  "L/17": "8e1bbb4c8fe300a01806d1c428ced8c05b18611c5378e636473cd31d4a767430",
  "L/26": "bcde7d380fc7ec151dc7b50e9ce28649d16c58135017c57c9f7e32f4e1a744df",
  "M/6": "ed50345f76cfb7ec91e6b9f716cbf2d73d94907b3ae9c3376084a4191ca7b8e4",
  "M/11": "0b4bf63efda9f3f8af568dae563fc1af78b03e30bcd63a6fc71212f45df0d2fa",
  "M/17": "7f6e1111017b2160f2470a7aaadf12cd691ba5a9c590d817c0202056d149224e",
  "M/26": "1e4007c5bf739fdde153c943e13fdd9dddc40ac2cfbe9d4cc2d27f05ab7ef7bb",
  "Q/6": "1373c5ae9464bec970cf192993c78e3e3d788be7106a1eff33f161a2ee511a20",
  "Q/11": "1c2966b3b2d04b9832e622316d9fa056cedad1fbf17903f60ebb5d0e5657d683",
  "Q/17": "376e099f62064e4eaa56329cd07b46c66eff4bd7292cc6d9d66d695db87c3a3f",
  "Q/26": "717fef7edcf0df4e2618cc49b51c7201a859d43b689b8da54df065b22ff93a4d",
  "H/6": "ff72f627fba83cdb80ae2e5aa593bb82f77a2090cc1492a210642e572a2fe515",
  "H/11": "cf603bdf1f947de8001f64a33802b00843687dc00ccc3ba424db8055352ce2e5",
  "H/17": "15d067db5a92e381e5a33d1beeed17e287627da4c447dae9bd80ea61e492b6e8",
  "H/26": "eb142895c74594f8a3ddb64d13473052be4e1c84e07c2ff76fa65aced95e24be",
};

test("Independent block fits match the complete-code fit with the same 128-byte bound", () => {
  for (const [key, hash] of Object.entries(original)) {
    const [level, version] = key.split("/"),
      code = encodeQR("https://example.org/a-test", level, { min: Number(version), boost: false }),
      fitted = fitPadding(code, source, { maxBits: 1024 });
    expect(createHash("sha256").update(fitted.dark).digest("hex"), key).toBe(hash);
    expect(fitted.padding.rank).toBe(fitted.padding.variables);
  }
});

test("All free bytes retain exact payloads, functions, levels, masks, and rotated grids", async () => {
  for (const [index, text] of [
    "12345678901234567890",
    "A PICTURE 123",
    "https://example.org/a-test",
    "海の写真",
  ].entries())
    for (const level of ["L", "M", "Q", "H"]) {
      const code = encodeQR(text, level, { min: 17 + index * 3, mask: index, boost: false }),
        fitted = fitPadding(code, source);
      expect(fitted.padding.variables).toBeGreaterThan(1024);
      expect(fitted.padding.rank).toBe(fitted.padding.variables);
      expect(fitted.ecc).toBe(level);
      expect(fitted.mask).toBe(index);
      for (let m = 0; m < code.dark.length; m++)
        if (code.role[m]) expect(fitted.dark[m]).toBe(code.dark[m]);
      const rotated = rotateCode(fitted, index),
        cells = new Float32Array(code.size * code.size * 3);
      for (let m = 0; m < code.dark.length; m++)
        cells.fill(rotated.dark[m] ? 0 : 1, m * 3, m * 3 + 3);
      const image = rasterize({ code: rotated, k: 1, G: code.size, cells }, 4, { blur: 0.3 });
      // This is an algebra/payload check. Some pristine high-version mask controls
      // also fail jsQR; both-reader camera margin is qualified on the Picture QR matrix.
      expect(await readZxingCpp(image), `${level}/${index} zxing-cpp`).toBe(text);
    }
});
