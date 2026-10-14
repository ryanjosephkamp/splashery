import test from "node:test";
import assert from "node:assert/strict";
const m = await import("../tools/studio-truth/alignment.mjs").catch(() => ({}));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} vs ${b}`);

test("camera-gauge alignment recovers a known scale, rotation, and translation", () => {
  assert.equal(typeof m.fitSimilarity, "function");
  const source = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 2, 0],
    [0, 0, 3],
    [1, 2, 3],
  ];
  const target = source.map(([x, y, z]) => [4 - 3 * y, 2 + 3 * x, -1 + 3 * z]);
  const fit = m.fitSimilarity(source, target);
  close(fit.scale, 3);
  close(fit.rmsMeters, 0);
  const point = m.applySimilarity([0.2, 0.4, 0.6], fit);
  point.forEach((v, i) => close(v, [2.8, 2.6, 0.8][i]));
  const back = m.invertSimilarity(point, fit);
  back.forEach((v, i) => close(v, [0.2, 0.4, 0.6][i]));
});

test("stationary or collinear camera paths cannot claim an unambiguous similarity calibration", () => {
  assert.throws(
    () =>
      m.fitSimilarity(
        [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
      ),
    /calibration/,
  );
  assert.throws(
    () =>
      m.fitSimilarity(
        [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
        [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
      ),
    /calibration/,
  );
});
