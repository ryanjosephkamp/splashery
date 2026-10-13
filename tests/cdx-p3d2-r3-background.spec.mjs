import { test, expect } from "@playwright/test";
import { backgroundImage } from "../src/photo3d/background.js";

test("hidden background excludes foreground colors even when a soft depth edge leaves one connected piece", () => {
  const w = 64,
    h = 48,
    data = new Uint8Array(w * h * 4),
    depth = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = x >= 22 && x < 42 && y >= 14 && y < 34;
      data.set(near ? [224, 48, 24, 255] : [24, 72, 184, 255], (y * w + x) * 4);
      depth[y * w + x] = near ? 0.8 : 0;
    }
  const b = backgroundImage({ w, h, data }, depth, w, h, 0.78, new Int32Array(w * h));
  const i = 24 * w + 32;
  expect(b.depth[i]).toBe(0);
  expect(Array.from(b.rgba.slice(i * 4, i * 4 + 3))).toEqual([24, 72, 184]);
});
