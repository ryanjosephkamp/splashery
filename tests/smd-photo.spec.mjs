// Lane Studio media r2: Photo to 3D's backing layer. Where a near part pulls away from what is
// behind it as the view turns, the gap shows that part of the picture (the spiral staircase's glass
// pane used to leave a white band). The layer sits behind the relief, inside the picture, and takes
// the colors of the far side.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import jpeg from "jpeg-js";
import { buildPhotoSplats } from "../src/packs/photo-3d-core.js";
import { backingOf, unpackDepth } from "../src/packs/photo-3d.js";

const load = (id) => {
  const j = jpeg.decode(fs.readFileSync(`assets/toys/photo-3d/${id}.jpg`), { useTArray: true });
  const depth = unpackDepth(new Uint8Array(fs.readFileSync(`assets/toys/photo-3d/${id}.depth`)));
  return { photo: { w: j.width, h: j.height, data: j.data }, depth };
};

test.describe("the backing layer", () => {
  for (const id of ["spiral-stairs", "forest", "still-life"]) {
    test(`${id}: behind the relief, inside the picture, in its colors`, () => {
      const { photo, depth } = load(id);
      const s = buildPhotoSplats(photo, depth, { count: 60000, depth: 0.5 });
      const b = backingOf(s, 40);
      expect(b.n).toBeGreaterThan(500);
      let zlo = Infinity;
      for (let i = 0; i < s.n; i++) zlo = Math.min(zlo, s.relief[i * 3 + 2]);
      for (let i = 0; i < b.n; i++) {
        expect(Math.abs(b.pos[i * 3])).toBeLessThanOrEqual(s.aspect / 2);
        expect(Math.abs(b.pos[i * 3 + 1])).toBeLessThanOrEqual(0.5);
        expect(Number.isFinite(b.pos[i * 3 + 2])).toBe(true);
        for (let k = 0; k < 3; k++) expect(b.rgb[i * 3 + k]).toBeGreaterThanOrEqual(0);
      }
      // behind the relief: never in front of its nearest splat
      let zhi = -Infinity;
      for (let i = 0; i < s.n; i++) zhi = Math.max(zhi, s.relief[i * 3 + 2]);
      for (let i = 0; i < b.n; i++) expect(b.pos[i * 3 + 2]).toBeLessThan(zhi);
      expect(zlo).toBeLessThanOrEqual(zhi);
    });
  }

  test("the spiral's near pane gets the far stairs' colors behind it", () => {
    const { photo, depth } = load("spiral-stairs");
    const s = buildPhotoSplats(photo, depth, { count: 60000, depth: 0.5 });
    const b = backingOf(s, 40);
    // the layer is deeper over the left pane (a near surface) than the pane itself
    let nearZ = 0;
    let nearN = 0;
    for (let i = 0; i < s.n; i++)
      if (s.relief[i * 3] / s.aspect < -0.4) {
        nearZ += s.relief[i * 3 + 2];
        nearN++;
      }
    let backZ = 0;
    let backN = 0;
    for (let i = 0; i < b.n; i++)
      if (b.pos[i * 3] / s.aspect < -0.4) {
        backZ += b.pos[i * 3 + 2];
        backN++;
      }
    expect(backZ / backN).toBeLessThan(nearZ / nearN);
  });
});
