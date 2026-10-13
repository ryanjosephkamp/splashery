import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { anchoredEdgesR3, sourceAnchorsR3, colorAtR3 } from "../tools/cdx-p3d2-r3-anchored.mjs";

const near = [224, 48, 24],
  far = [24, 72, 184];
function image(edge = 20, rim = false) {
  const p = new PNG({ width: 40, height: 40 });
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++)
      p.data.set(
        [...(rim && x === 19 ? [255, 255, 255] : x < edge ? near : far), 255],
        (y * 40 + x) * 4,
      );
  return p;
}
function reference(rim = false) {
  const p = image(20, rim),
    profile = [];
  for (let t = -8; t <= 8; t++)
    profile.push({
      u: (20 + t + 0.5) / 40,
      v: 0.5,
      depth: 0.8,
      rgb: Array.from(p.data.slice((20 * 40 + 20 + t) * 4, (20 * 40 + 20 + t) * 4 + 3)),
    });
  return [{ u: 0.5, v: 0.5, near, far, contrast: 257, profile }];
}
const points = [Array.from({ length: 17 }, (_, i) => [12 + i + 0.5, 20.5])];
test("an independently anchored edge detects a source-colored band stretched beyond the silhouette", () => {
  const good = anchoredEdgesR3(image(), points, reference(), image()),
    stretched = anchoredEdgesR3(image(23), points, reference(), image());
  expect(good.anchoredMAE).toBe(0);
  expect(stretched.anchoredMAE).toBeGreaterThan(0.05);
  expect(stretched.edgeDisplacementMax).toBeCloseTo(3, 5);
});
test("a rim already present in the source contributes zero anchored error", () => {
  expect(
    anchoredEdgesR3(image(20, true), points, reference(true), image(20, true)).anchoredMAE,
  ).toBe(0);
});
test("a wider transition is measured separately from colors within the two interiors", () => {
  const p = image();
  for (let y = 0; y < 40; y++)
    for (let x = 17; x <= 22; x++) {
      const a = (x - 16) / 7;
      p.data.set(
        [...near.map((v, c) => Math.round(v * (1 - a) + far[c] * a)), 255],
        (y * 40 + x) * 4,
      );
    }
  expect(anchoredEdgesR3(p, points, reference(), image()).transitionWidthExcessMax).toBeGreaterThan(
    2,
  );
});

test("a two-pixel rim between depth-grid sample points is included at fourfold magnification", () => {
  const source = image(),
    anchors = sourceAnchorsR3(source, {
      width: 40,
      height: 40,
      data: Uint8Array.from({ length: 1600 }, (_, i) => (i % 40 < 20 ? 204 : 51)),
    }).anchors;
  const actual = new PNG({ width: 160, height: 160 });
  for (let y = 0; y < 160; y++)
    for (let x = 0; x < 160; x++)
      actual.data.set(
        [...colorAtR3(source, (x + 0.5) / 4 - 0.5, (y + 0.5) / 4 - 0.5).map(Math.round), 255],
        (y * 160 + x) * 4,
      );
  for (let y = 0; y < 160; y++)
    for (const x of [77, 78]) actual.data.set([255, 255, 255, 255], (y * 160 + x) * 4);
  const projected = anchors.map((a) => a.profile.map((p) => [p.u * 160, p.v * 160]));
  const metric = anchoredEdgesR3(actual, projected, anchors, source);
  expect(metric.anchoredMAE).toBeGreaterThan(0.005);
  expect(metric.anchoredExcess).toBeGreaterThan(0.005);
});

test("the near-plane continuation uses the depth texels' actual center coordinates", () => {
  const source = new PNG({ width: 80, height: 64 });
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 80; x++) source.data.set([...(x < 40 ? near : far), 255], (y * 80 + x) * 4);
  const depth = Uint8Array.from({ length: 80 * 64 }, (_, i) =>
    i % 80 < 40 ? 64 + 2 * (i % 80) : 20,
  );
  const anchors = sourceAnchorsR3(source, { width: 80, height: 64, data: depth }).anchors;
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors)
    expect(a.profile[8].depth).toBeCloseTo((64 + 2 * (a.u * 80 - 0.5)) / 255, 6);
});
test("stable two-sided interiors produce source anchors while depth-noisy fits are rejected", () => {
  const p = image(),
    depth = Uint8Array.from({ length: 1600 }, (_, i) => (i % 40 < 20 ? 204 : 51));
  const stable = sourceAnchorsR3(p, { width: 40, height: 40, data: depth });
  expect(stable.evaluated).toBeGreaterThan(0);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 20; x++) depth[y * 40 + x] = x % 3 ? 128 : 255;
  expect(sourceAnchorsR3(p, { width: 40, height: 40, data: depth }).depthRejected).toBeGreaterThan(
    0,
  );
});
