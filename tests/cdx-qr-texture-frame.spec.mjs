import { test, expect } from "@playwright/test";
import { textureFrame, tileColors } from "../src/qr-craft/frame.js";
import {
  textureFrame as referenceFrame,
  tileColors as referenceColors,
} from "../tools/picture-qr-fidelity/research/frame-reference.mjs";

function frameFixture(n, k) {
  let seed = n * 113 + k;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const G = n * k;
  return {
    w: {
      code: { size: n },
      k,
      G,
      cells: Float32Array.from({ length: G * G * 3 }, random),
      rendering: { texture: "tiles" },
    },
    pic: { w: 41, h: 73, data: Float32Array.from({ length: 41 * 73 * 3 }, random) },
  };
}

test("Texture predictions remain byte-identical at fractional sample phases and Circle edges", () => {
  for (const n of [21, 37, 69, 109])
    for (const k of [1, 3, 7])
      for (const shape of ["square", "circle"])
        for (const width of [113, 257, 720]) {
          const { w, pic } = frameFixture(n, k);
          const actual = textureFrame(w, pic, shape, width),
            expected = referenceFrame(w, pic, shape, width);
          expect(actual.width).toBe(expected.width);
          expect(Buffer.compare(Buffer.from(actual.data), Buffer.from(expected.data))).toBe(0);
        }
});

test("Tile bytes retain clamping and ties-to-even rounding for all source buffer types", () => {
  const values = [
    -Infinity,
    -1,
    -0.01,
    0,
    0.5 / 255,
    1.5 / 255,
    2.5 / 255,
    254.5 / 255,
    1,
    1.01,
    Infinity,
    NaN,
  ];
  for (const Type of [Array, Float32Array, Float64Array]) {
    const cells = Type.from(values),
      w = { cells, rendering: {} };
    expect(tileColors(w)).toEqual(referenceColors(w));
    expect(tileColors(w)).toBe(tileColors(w));
  }
});
