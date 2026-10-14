// Checks for the Toy Box page. Run: node concepts/toybox/tools/verify.mjs
import assert from 'node:assert/strict';
import {
  TOYS, STROKE_MAX, CUT, INK_KEPT, splatAlpha, covariance, q8, d8,
  yawToByte, byteToYaw, pitchToByte, byteToPitch,
  toBase64Url, fromBase64Url, encodeScene, decodeScene,
} from '../scene.js';

// 1. Every byte value, at every position in a base64 group, at every tail length.
let b64 = 0;
for (let len = 1; len <= 6; len++) {
  for (let pos = 0; pos < len; pos++) {
    for (let v = 0; v < 256; v++) {
      const bytes = new Uint8Array(len).fill(0xa5);
      bytes[pos] = v;
      assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
      b64++;
    }
  }
}

// 2. Every header a link can carry: toy x dropped x yaw x pitch.
let headers = 0;
for (let toy = 0; toy < TOYS.length; toy++) {
  for (const drop of [false, true]) {
    for (let yawByte = 0; yawByte < 256; yawByte++) {
      for (let pitchByte = 0; pitchByte < 256; pitchByte++) {
        const scene = { toy, drop, yawByte, pitchByte, strokes: [] };
        const text = encodeScene(scene);
        assert.deepEqual(decodeScene(text), scene);
        headers++;
      }
    }
  }
}

// 3. Every value a dab's coordinate, color, yaw or pitch byte can take survives
//    being turned into a number and back.
for (let b = 0; b < 256; b++) {
  assert.equal(q8(d8(b)), b);
  assert.equal(yawToByte(byteToYaw(b)), b);
  assert.equal(pitchToByte(byteToPitch(b)), b);
}
let dabs = 0;
for (let c = 0; c < 8; c++) {
  for (let v = 0; v < 256; v++) {
    for (const axis of ['x', 'y', 'z']) {
      const s = { x: 7, y: 77, z: 177, c };
      s[axis] = v;
      const scene = { toy: 0, drop: false, yawByte: 0, pitchByte: 128, strokes: [s] };
      assert.deepEqual(decodeScene(encodeScene(scene)), scene);
      dabs++;
    }
  }
}

// 4. Whole scenes with every number of dabs from none to the most a link carries.
let seed = 20261012;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (let n = 0; n <= STROKE_MAX; n++) {
  for (let rep = 0; rep < 20; rep++) {
    const strokes = Array.from({ length: n }, () => ({
      x: (rand() * 256) | 0, y: (rand() * 256) | 0, z: (rand() * 256) | 0, c: (rand() * 8) | 0,
    }));
    const scene = { toy: (rand() * TOYS.length) | 0, drop: rand() < 0.5, yawByte: (rand() * 256) | 0, pitchByte: (rand() * 256) | 0, strokes };
    assert.deepEqual(decodeScene(encodeScene(scene)), scene);
  }
}
assert.equal(decodeScene('not a scene'), null);
assert.equal(decodeScene(''), null);

// 5. How much of a Gaussian's paint the cut-off keeps: add it up the slow way.
//    The whole Gaussian is summed out to 3 cut-off radii (9 sigma), where what is
//    left is below 1e-17.
const STEPS = 4096;
let inside = 0, whole = 0;
const h = 6 / STEPS;
for (let j = 0; j < STEPS; j++) {
  const y = -3 + (j + 0.5) * h;
  for (let i = 0; i < STEPS; i++) {
    const x = -3 + (i + 0.5) * h;
    const r2 = x * x + y * y;
    whole += Math.exp(-0.5 * CUT * CUT * r2);
    inside += splatAlpha(r2);
  }
}
const kept = inside / whole;
assert.ok(Math.abs(kept - INK_KEPT) < 2e-4, `kept ${kept} vs ${INK_KEPT}`);
assert.equal((INK_KEPT * 100).toFixed(1), '98.9');

// 6. The covariance readout, at every position of the three sliders: its trace and
//    determinant must be those of the two squared sigmas it was built from.
let covs = 0;
for (let w = 20; w <= 100; w++) {
  for (let hh = 20; hh <= 100; hh++) {
    for (let deg = 0; deg <= 180; deg++) {
      const [xx, xy, yy] = covariance(w / 100, hh / 100, (deg * Math.PI) / 180);
      const sa = (w / 100 / CUT) ** 2, sb = (hh / 100 / CUT) ** 2;
      assert.ok(Math.abs(xx + yy - (sa + sb)) < 1e-12);
      assert.ok(Math.abs(xx * yy - xy * xy - sa * sb) < 1e-12);
      covs++;
    }
  }
}

console.log(`base64url: ${b64.toLocaleString('en-US')} byte placements round-trip`);
console.log(`headers:   ${headers.toLocaleString('en-US')} of ${headers.toLocaleString('en-US')} (toy x dropped x yaw x pitch) round-trip`);
console.log(`dabs:      ${dabs.toLocaleString('en-US')} single-dab scenes, then ${(STROKE_MAX + 1) * 20} scenes of 0 to ${STROKE_MAX} dabs`);
console.log(`cut-off:   ${(kept * 100).toFixed(3)}% summed over ${(STEPS * STEPS).toLocaleString('en-US')} samples; 1 - e^-4.5 = ${(INK_KEPT * 100).toFixed(3)}%`);
console.log(`covariance: ${covs.toLocaleString('en-US')} slider positions`);
console.log('all checks pass');
