import { test, expect } from "@playwright/test";
import { buildPhotoSplats, preparePhotoColors } from "../src/packs/photo-3d-core.js";

function picture(w, h) {
  const data = Uint8Array.from({ length: w * h * 4 }, (_, i) =>
    i % 4 === 3 ? 255 : (Math.imul(i + 11, 1664525) >>> 13) & 255,
  );
  return { w, h, data };
}
for (const shape of [
  [96, 80, 20, 18],
  [80, 96, 18, 20],
  [31, 17, 28, 14],
])
  test(`preparing colors before depth preserves every surface value (${shape.join("x")})`, () => {
    const [w, h, dw, dh] = shape,
      p = picture(w, h),
      d = {
        w: dw,
        h: dh,
        d: Float32Array.from(
          { length: dw * dh },
          (_, i) => 1 + Math.sin(i * 0.13) + 0.4 * Math.cos(i * 0.41),
        ),
      };
    for (const flat of [false, true]) {
      const options = { count: 2500, depth: 1, keepFlat: flat, sharpCells: 1500 };
      const prepared = preparePhotoColors(p, {
        count: options.count,
        depthWidth: dw,
        depthHeight: dh,
      });
      expect(buildPhotoSplats(p, d, { ...options, prepared })).toEqual(
        buildPhotoSplats(p, d, options),
      );
      expect(buildPhotoSplats({ ...p }, d, { ...options, prepared })).toEqual(
        buildPhotoSplats(p, d, options),
      );
    }
  });

test("a bounded preparation falls back without changing a flat page or a different budget", () => {
  const p = picture(80, 64),
    d = { w: 14, h: 14, d: Float32Array.from({ length: 196 }, (_, i) => 10 + Math.sin(i) * 0.01) },
    options = { count: 1000, depth: 1, keepFlat: true, sharpCells: 800 };
  const prepared = preparePhotoColors(p, {
    count: 1000,
    depthWidth: 14,
    depthHeight: 14,
    maxWeightBytes: 0,
  });
  expect(prepared.depthWeights).toBeNull();
  expect(buildPhotoSplats(p, d, { ...options, prepared })).toEqual(buildPhotoSplats(p, d, options));
  expect(buildPhotoSplats(p, d, { ...options, count: 900, prepared })).toEqual(
    buildPhotoSplats(p, d, { ...options, count: 900 }),
  );
});
