// MIT. Pure analytic controls; no real photographs, heldouts, browser, or GPU work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAccumulator } from "./accumulator.mjs";
const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const inventory = (pixels = 2) => [0, 1, 2].map((id) => ({ id, pixels }));
const close = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function known({ background = [.2, .4, .6], renderBackground = [0, 0, 0], gain = 1, bias = 0 } = {}) {
  const targets = Uint32Array.of(pack(180, 190, 210), pack(190, 200, 220)), rgba = [];
  for (let i = 0; i < 2; i++) {
    const T = [.2, .6][i];
    for (let c = 0; c < 3; c++) {
      const target = ((targets[i] >>> (c * 8)) & 255) / 255,
        black = (target - bias) / gain - T * background[c];
      rgba.push(black + T * renderBackground[c]);
    }
    rgba.push(1 - T);
  }
  return { targets, rgba: Float64Array.from(rgba), gain, bias, renderBackground };
}
function fit(data, oldBackground = [0, 0, 0]) {
  const accumulator = createAccumulator(inventory(data.targets.length), oldBackground);
  for (let id = 0; id < 3; id++) accumulator.add({ id, offset: 0, ...data });
  return accumulator.finish();
}
test("recovers a known three-scalar background without fitting any image detail", () => {
  const result = fit(known());
  result.background.forEach((value, c) => close(value, [.2, .4, .6][c]));
  assert.equal(result.identifiable, true); close(result.newMSE, 0);
  assert.ok(result.deltaMSE < 0);
});
test("gain/bias use A=gT and target-gCblack-b", () => {
  const result = fit(known({ gain: 1.1, bias: -.03 }));
  result.background.forEach((value, c) => close(value, [.2, .4, .6][c]));
});
test("nonblack captures are uncomposited before fitting", () => {
  const result = fit(known({ renderBackground: [.4, .1, .3] }), [.4, .1, .3]);
  result.background.forEach((value, c) => close(value, [.2, .4, .6][c]));
  assert.ok(result.deltaMSE < 0);
});
test("box constraints clip each channel and preserve MSE nonincrease", () => {
  const result = fit(known({ background: [-.2, 1.4, .5] }));
  assert.deepEqual(result.background.slice(0, 2), [0, 1]); close(result.background[2], .5);
  assert.ok(result.deltaMSE <= 0);
});
test("opaque or unsupported pixels cannot force an environment color", () => {
  const data = known(); for (let p = 0; p < 2; p++) data.rgba[p * 4 + 3] = 1;
  const result = fit(data, [.1, .2, .3]);
  assert.deepEqual(result.background, [.1, .2, .3]); assert.equal(result.identifiable, false);
});
test("invalid packed pixels are skipped but soft alpha and nonfinite raw values fail closed", () => {
  const data = known(); data.targets[0] = 0; data.rgba[0] = NaN;
  const result = fit(data); assert.equal(result.invalid, 3); assert.equal(result.pixels, 3);
  for (const bad of ["alpha", "rgb", "opacity"]) {
    const data = known();
    if (bad === "alpha") data.targets[0] = pack(1, 2, 3, 128);
    if (bad === "rgb") data.rgba[0] = NaN;
    if (bad === "opacity") data.rgba[3] = 1.01;
    assert.throws(() => fit(data), /unsupported|Nonfinite|opacity/);
  }
});
test("holdout IDs, missing cameras, and duplicate pixel chunks cannot enter a completed fit", () => {
  const data = known(), holdout = createAccumulator(inventory());
  assert.throws(() => holdout.add({ id: 8, offset: 0, ...data }), /eligible training/);
  const incomplete = createAccumulator(inventory()); incomplete.add({ id: 0, offset: 0, ...data });
  assert.throws(() => incomplete.finish(), /Incomplete/);
  const duplicate = createAccumulator(inventory()); duplicate.add({ id: 0, offset: 0, ...data });
  assert.throws(() => duplicate.add({ id: 0, offset: 0, ...data }), /duplicate/);
});
test("streaming partitions preserve the complete objective", () => {
  const data = known(), expected = fit(data), accumulator = createAccumulator(inventory());
  for (let id = 0; id < 3; id++) for (let offset = 0; offset < 2; offset++)
    accumulator.add({ id, offset, ...data, rgba: data.rgba.subarray(offset * 4, offset * 4 + 4), targets: data.targets.subarray(offset, offset + 1) });
  const actual = accumulator.finish();
  assert.deepEqual(actual, expected);
});
test("deterministic random models never increase their full fixed-model MSE", () => {
  let state = 0xa58888;
  const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
  for (let trial = 0; trial < 200; trial++) {
    const targets = Uint32Array.from({ length: 13 }, () => pack(Math.floor(random()*256),Math.floor(random()*256),Math.floor(random()*256))),
      rgba = Float64Array.from({ length: 13 * 4 }, random),
      result = fit({ targets, rgba }, [random(),random(),random()]);
    assert.ok(result.deltaMSE <= 1e-12); assert.ok(result.newMSE <= result.oldMSE + 1e-12);
    for (const value of result.background) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
});
