import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { holesR3, edgesR3 } from "../tools/cdx-p3d2-r3-measure.mjs";

test("the hole counter includes the full projected footprint and its boundary pixels", () => {
  const image = new PNG({ width: 3, height: 3 });
  for (let i = 0; i < 9; i++) image.data.set([0, 255, 0, 255], i * 4);
  expect(
    holesR3(image, [
      [0, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ]),
  ).toEqual({ area: 9, holes: 9, holeFraction: 1 });
});

test("the source-edge diagnostic distinguishes faithful color, an added bright rim, and lost contrast", () => {
  const actual = new PNG({ width: 16, height: 16 }),
    mask = new PNG({ width: 16, height: 16 }),
    uv = new PNG({ width: 16, height: 16 });
  const near = [224, 48, 24],
    far = [24, 72, 184];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      actual.data.set([...(x < 8 ? near : far), 255], i);
      mask.data.set([0, x < 8 ? 64 : 128, 0, 255], i);
      uv.data[i + 3] = 255;
    }
  const texture = (color) => {
    const p = new PNG({ width: 1, height: 1 });
    p.data.set([...color, 255]);
    return p;
  };
  const textures = { surface: texture(near), background: texture(far) };
  const good = edgesR3(actual, mask, uv, textures, 1);
  expect(good.edgePixels).toBeGreaterThan(0);
  expect(good.haloMean).toBe(0);
  expect(good.contrastLoss).toBe(0);
  for (let y = 0; y < 16; y++) actual.data.set([255, 255, 255, 255], (y * 16 + 6) * 4);
  expect(edgesR3(actual, mask, uv, textures, 1).haloMean).toBeGreaterThan(0);
  for (let y = 0; y < 16; y++) {
    actual.data.set([...near, 255], (y * 16 + 6) * 4);
    actual.data.set(near.map((v, k) => Math.round((v + far[k]) / 2)).concat(255), (y * 16 + 7) * 4);
  }
  expect(edgesR3(actual, mask, uv, textures, 1).contrastLoss).toBeGreaterThan(0);
});
