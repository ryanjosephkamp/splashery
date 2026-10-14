import test from "node:test";
import assert from "node:assert/strict";
const m = await import("../tools/studio-truth/sampling.mjs").catch(() => ({}));

test("reference color averages source pixel areas so render sharpness is not compared with aliased noise", () => {
  assert.equal(typeof m.sampleTruth, "function");
  const rgba = new Uint8Array(4 * 4 * 4);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      rgba.set([((x + y) % 2) * 255, ((x + y) % 2) * 255, ((x + y) % 2) * 255, 255], i);
    }
  const t = {
    pose: {
      width: 4,
      height: 4,
      K: [
        [4, 0, 2],
        [0, 4, 2],
        [0, 0, 1],
      ],
    },
    z: new Float32Array(16).fill(2),
    mask: new Uint8Array(16).fill(1),
    rgb: rgba,
  };
  const result = m.sampleTruth(t, 2, 2);
  assert.deepEqual(Array.from(result.rgba), Array(4).fill([128, 128, 128, 255]).flat());
  assert.deepEqual(result.pose.K, [
    [2, 0, 1],
    [0, 2, 1],
    [0, 0, 1],
  ]);
  assert.deepEqual(Array.from(result.z), [2, 2, 2, 2]);
});
