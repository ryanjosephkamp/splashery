import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { preparePhotoColors, upsampleDepth } from "../src/packs/photo-3d-core.js";
const reference = JSON.parse(
  fs.readFileSync(new URL("./fixtures/photo-gather-hashes.json", import.meta.url)),
);
test("the cached depth gather retains checkpoint bytes, including unmatched-color bilinear fallbacks", () => {
  let fallbacks = 0;
  for (const { w, h, count, dw, dh, fallback, sha256 } of reference.rows) {
    const photo = {
      w,
      h,
      data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) =>
        i % 4 === 3 ? 255 : (i * 29 + Math.floor(i / (w * 4)) * 113) % 256,
      ),
    };
    const p = preparePhotoColors(photo, { count, depthWidth: dw, depthHeight: dh }),
      d = Float32Array.from({ length: dw * dh }, (_, i) => ((i * 17) % 127) / 127);
    for (const prepared of [null, p.depthWeights]) {
      const result = upsampleDepth(d, dw, dh, p.guideLo, p.gx, p.gy, p.sharpened, 0.09, prepared);
      expect(
        crypto.createHash("sha256").update(new Uint8Array(result.buffer)).digest("hex"),
        `${w}x${h} ${!!prepared}`,
      ).toBe(sha256);
    }
    fallbacks += fallback;
  }
  expect(fallbacks).toBeGreaterThan(0);
});
