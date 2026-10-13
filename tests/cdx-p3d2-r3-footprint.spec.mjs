import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { photoBorderR3 } from "../tools/cdx-p3d2-r3-common.mjs";
import { holesR3 } from "../tools/cdx-p3d2-r3-measure.mjs";

test("the footprint follows every actual boundary vertex of a nonsquare mesh", () => {
  const expected = [
    [0, 0],
    [1 / 3, 0],
    [2 / 3, 0],
    [1, 0],
    [1, 1 / 5],
    [1, 2 / 5],
    [1, 3 / 5],
    [1, 4 / 5],
    [1, 1],
    [2 / 3, 1],
    [1 / 3, 1],
    [0, 1],
    [0, 4 / 5],
    [0, 3 / 5],
    [0, 2 / 5],
    [0, 1 / 5],
  ].map((p) => p.map(Math.fround));
  expect(photoBorderR3(3, 5)).toEqual(expected);
  expect(new Set(photoBorderR3(3, 5).map((p) => p.join(","))).size).toBe(16);
});

test("a coarse chord can invent holes outside a curved, fully covered photo", () => {
  const project = ([u, v]) => [
    8 + 84 * u,
    v === 0 ? 10 + 7 * Math.sin(8 * Math.PI * u) : 10 + 60 * v,
  ];
  const native = [];
  for (let x = 0; x < 100; x++) native.push(project([Math.fround(x / 100), 0]));
  for (let y = 0; y < 50; y++) native.push(project([1, Math.fround(y / 50)]));
  for (let x = 100; x > 0; x--) native.push(project([Math.fround(x / 100), 1]));
  for (let y = 50; y > 0; y--) native.push(project([0, Math.fround(y / 50)]));
  const image = new PNG({ width: 100, height: 80 });
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      let inside = false;
      for (let i = 0, j = native.length - 1; i < native.length; j = i++) {
        const a = native[i],
          b = native[j];
        if (
          a[1] > y + 0.5 !== b[1] > y + 0.5 &&
          x + 0.5 < a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
        )
          inside = !inside;
      }
      image.data.set(inside ? [255, 255, 255, 255] : [0, 255, 0, 255], (y * image.width + x) * 4);
    }
  expect(holesR3(image, photoBorderR3(32, 32).map(project)).holes).toBeGreaterThan(0);
  expect(holesR3(image, photoBorderR3(100, 50).map(project)).holes).toBe(0);
});
