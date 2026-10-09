// Lane Photo fidelity r2: the adaptive grid for One color per splat (src/packs/photo-3d-core.js),
// and the edge-aware depth the round measured (guidedDepth, src/packs/moving-photo.js).

import { test, expect } from "@playwright/test";
import {
  adaptiveGrid,
  buildPhotoSplats,
  fineCells,
  FINE_CELLS,
  DETAIL_MIN,
  LEVELS,
} from "../src/packs/photo-3d-core.js";
import { guidedDepth } from "../src/packs/moving-photo.js";

// A page: white, with dark "letters" (2 by 3 pixel strokes) in rows across its top half.
const page = (w = 240, h = 320) => {
  const data = new Uint8Array(w * h * 4).fill(255);
  for (let y = 0; y < h / 2; y++)
    for (let x = 0; x < w; x++) {
      const ink = y % 16 < 9 && x % 6 < 2 && (x >> 3) % 5 !== 4;
      if (ink) data.set([20, 20, 20, 255], (y * w + x) * 4);
    }
  return { w, h, data };
};
const flatDepth = { w: 14, h: 14, d: new Float32Array(196).fill(1) };

test("a plain picture is a few big splats; a page's letters get the small ones", () => {
  const photo = page();
  const s = buildPhotoSplats(photo, flatDepth, { count: 6000 });
  expect(s.n).toBeLessThanOrEqual(6000);
  expect(s.n).toBeGreaterThan(6000 * 0.9);
  const [one, two, four, eight] = s.stats.levels;
  expect(one + two + four + eight).toBe(s.n);
  expect(eight).toBeGreaterThan(0); // the plain bottom half
  // most splats are on the letters' half (top, +y); the biggest are on the plain half
  let top = 0;
  let botBig = 0;
  let big = 0;
  const cell = 1 / s.gy;
  for (let i = 0; i < s.n; i++) {
    const y = s.relief[i * 3 + 1];
    if (y > 0) top++;
    if (s.sigma[i] > 6 * cell) ((big += 1), (botBig += y < 0 ? 1 : 0));
  }
  expect(top).toBeGreaterThan(3 * (s.n - top));
  expect(botBig / big).toBeGreaterThan(0.8); // (the top half has plain gaps between its rows too)
  // a plain page is mostly plain, so its grid is as fine as the budget allows
  expect(fineCells(photo, 6000)).toBe(FINE_CELLS);
});

test("the blocks cover the grid once, within the budget, and no block holds a depth cut", () => {
  const gx = 64;
  const gy = 48;
  const rgb = new Float32Array(gx * gy * 3);
  const d = new Float32Array(gx * gy);
  const m = new Uint8Array(gx * gy);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      const near = i >= 21 && i < 43 && j >= 13 && j < 35;
      d[c] = near ? 0.9 : 0.1;
      rgb.fill(near ? 0.8 : 0.3, c * 3, c * 3 + 3);
    }
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      if (i + 1 < gx && d[c] === d[c + 1]) m[c] |= 1;
      if (j + 1 < gy && d[c] === d[c + gx]) m[c] |= 2;
    }
  const g = adaptiveGrid({ gx, gy, levels: LEVELS, count: 900, rgb, d, m });
  expect(g.n).toBeLessThanOrEqual(900);
  const seen = new Uint8Array(gx * gy);
  for (let k = 0; k < g.n; k++) {
    const vals = new Set();
    for (let j = g.y[k]; j < g.y[k] + g.size[k]; j++)
      for (let i = g.x[k]; i < g.x[k] + g.size[k]; i++) {
        seen[j * gx + i]++;
        vals.add(d[j * gx + i]);
      }
    expect(vals.size).toBe(1); // one side of the cut only
  }
  expect(Array.from(seen).every((v) => v === 1)).toBe(true);
});

test("a bigger splat sits a hair behind the smaller ones, in the relief and laid flat", () => {
  const s = buildPhotoSplats(page(), flatDepth, { count: 6000 });
  const cell = 1 / s.gy;
  let smallZ = -Infinity;
  let bigZ = Infinity;
  for (let i = 0; i < s.n; i++) {
    if (s.sigma[i] < 1.5 * cell) smallZ = Math.max(smallZ, s.flat[i * 3 + 2]);
    if (s.sigma[i] > 6 * cell) bigZ = Math.min(bigZ, s.flat[i * 3 + 2]);
  }
  expect(smallZ).toBe(0);
  expect(bigZ).toBeLessThan(0);
  expect(bigZ).toBeGreaterThan(-0.01); // still in front of the backing layer (z -0.01)
});

test("a busy photo keeps a coarser grid than a plain page, never coarser than r1's", () => {
  const w = 200;
  const h = 150;
  const data = new Uint8Array(w * h * 4);
  let r = 7;
  for (let i = 0; i < w * h * 4; i++) {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    data[i] = i % 4 === 3 ? 255 : r & 255;
  }
  const f = fineCells({ w, h, data }, 5000);
  expect(f).toBeGreaterThanOrEqual(2.2);
  expect(f).toBeLessThan(3.1);
});

test("guidedDepth puts a blurred depth edge on the picture's own edge", () => {
  const w = 120;
  const h = 80;
  const dw = 30;
  const dh = 20;
  const inside = (x, y) => x >= 45 && x < 80;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) rgba.set(inside(x, y) ? [220, 120, 40, 255] : [30, 90, 40, 255], (y * w + x) * 4); // prettier-ignore
  const dn = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const X = ((x + 0.5) * w) / dw;
      dn[y * dw + x] = Math.min(1, Math.max(0, Math.min(X - 41, 84 - X) / 8)); // a soft ramp
    }
  const g = guidedDepth(dn, dw, dh, rgba, w, h);
  // just outside the edge: far, just inside: nearer than the plain ramp would put it
  const y = 40;
  expect(g[y * w + 43]).toBeLessThan(0.25);
  expect(g[y * w + 47]).toBeGreaterThan(0.45);
});

test("screenshots: Photo to 3D in Splats, One color per splat, at phone and desktop size", async ({
  browser,
}) => {
  test.setTimeout(400_000);
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto("/?renderer=webgl2&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      (await import("/src/packs/photo-sharp.js")).setSharpView("photo-3d", "splats");
      await app.chooseToy("photo-3d");
      (await import("/src/packs/photo-sharp.js")).setSharpView("photo-3d", "splats"); // (before the rebuild)
      await app.setToyOptions({ detail: "splats", view: "splats" });
      player.motion.setControl("flat", 0, { snap: true });
    });
    await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/screenshots/phf2-photo-3d-${w}x${h}.png` });
    await page.close();
  }
});

test("from DETAIL_MIN splats up, a page's letters are drawn in single cells only", () => {
  const photo = page(1200, 1600);
  const big = buildPhotoSplats(photo, flatDepth, { count: DETAIL_MIN });
  const small = buildPhotoSplats(photo, flatDepth, { count: DETAIL_MIN - 1 });
  // (2 by 2 splats are only on plain ground then; below it they also cover letters)
  expect(big.stats.levels[1]).toBeLessThan(0.15 * big.stats.levels[0]);
  expect(small.stats.levels[1]).toBeGreaterThan(big.stats.levels[1]);
});
