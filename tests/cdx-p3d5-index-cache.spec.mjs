import { test, expect } from "@playwright/test";
import { preparePhotoColors, upsampleDepth } from "../src/packs/photo-3d-core.js";

function fixture() {
  const photo = { w: 48, h: 40, data: new Uint8Array(48 * 40 * 4).fill(128) };
  for (let i = 3; i < photo.data.length; i += 4) photo.data[i] = 255;
  const dw = 8,
    dh = 7,
    prepared = preparePhotoColors(photo, { count: 500, depthWidth: dw, depthHeight: dh }),
    d = Float32Array.from({ length: dw * dh }, (_, i) => i / (dw * dh));
  const gather = (cache = prepared.depthWeights) =>
    upsampleDepth(d, dw, dh, cache.guideLo, prepared.gx, prepared.gy, cache.guideHi, 0.09, cache);
  return { prepared, gather };
}

test("a prepared gather keeps its original source addresses when public axis metadata changes", () => {
  const { prepared, gather } = fixture(),
    before = gather();
  prepared.depthWeights.ax.index.fill(0);
  prepared.depthWeights.ay.index.fill(0);
  expect(gather()).toEqual(before);
  // Inspecting the legacy table after that edit must still expose the addresses
  // that were prepared, rather than regenerate them from the edited metadata.
  expect(prepared.depthWeights.indices.some((v) => v !== 0)).toBe(true);
  expect(gather()).toEqual(before);
});

test("the legacy index table retains stable identity and remains writable", () => {
  const { prepared, gather } = fixture(),
    cache = prepared.depthWeights,
    original = cache.indices;
  expect(cache.indices).toBe(original);
  expect(gather().some((v) => v > 0)).toBe(true);
  cache.indices = new Uint32Array(original.length);
  expect(gather().every((v) => v === 0)).toBe(true);
});

test("a structured clone of the prepared gather retains its numerical result", () => {
  const { prepared, gather } = fixture(),
    before = gather(),
    clone = structuredClone(prepared.depthWeights);
  expect(gather(clone)).toEqual(before);
});
