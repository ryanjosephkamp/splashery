// Lane Live r8: Sound in a box (the Chladni plate in 3D), and the plate's
// sharper build. The physics (src/packs/chladni-3d.js) is checked in Node;
// the toy in the browser.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import { fakeCamera, openMirror, FACE } from "../tools/lv7-mirror-measure.mjs";
import {
  CELL_MODES,
  Beads,
  modeShape,
  potentialGrid,
  cellFreq,
  F1,
  F2,
} from "../src/packs/chladni-3d.js";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";

// A seeded random source, so the Node checks don't wobble.
function rng(seed = 7) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

test("the Gor'kov potential's lowest places are the pressure nodes (1D check)", () => {
  // Polystyrene in water: the acoustic contrast factor f1/3 + f2/2 is
  // positive, so beads go to the pressure nodes.
  expect(F1 / 3 + F2 / 2).toBeGreaterThan(0);
  // Cube mode 1, 1, 0's nodes are the planes x = 0 and y = 0 (from −1 to
  // 1); along a line through the cell, U is lowest at x = 0.
  const mode = { shape: "cube", terms: [[1, 0, 0, 1]] };
  const g = potentialGrid(mode);
  const N = g.N;
  const mid = (N - 1) / 2;
  let best = 0;
  for (let i = 1; i < N - 1; i++)
    if (g.U[(mid * N + mid) * N + i] < g.U[(mid * N + mid) * N + best]) best = i;
  expect(Math.abs(best - mid)).toBeLessThanOrEqual(1);
});

test("the cell's frequencies are the textbook ones", () => {
  // A 1 cm cube of water: c / 2L √(l² + m² + n²).
  const cube = CELL_MODES.find((m) => m.id === "cube-110");
  expect(cellFreq(cube)).toBeCloseTo((1497 / 0.02) * Math.SQRT2, 0);
  // The flask's l = 2 mode at ka = 3.3421: the wall is rigid there (j2′ = 0).
  const flask = CELL_MODES.find((m) => m.id === "flask-2-1");
  const r = (x) => modeShape(flask, 0, x, 0);
  const slope = (r(0.999) - r(0.997)) / 0.002;
  expect(Math.abs(slope)).toBeLessThan(0.02);
});

test("every mode's beads settle on its nodal surfaces", () => {
  for (const mode of CELL_MODES) {
    const b = new Beads(3000, mode, rng(11));
    const before = b.settled();
    for (let i = 0; i < 6 * 30; i++) b.step(1 / 30, 1);
    const after = b.settled();
    expect(before, mode.id).toBeLessThan(0.15);
    expect(after, mode.id).toBeGreaterThan(0.6);
    // Silence leaves them where they are.
    const P = b.P.slice();
    expect(b.step(1 / 30, 0)).toBe(false);
    expect(b.P).toEqual(P);
  }
});

// The plate's build: its stand in fine discs on its round surfaces (it was
// scattered at random over a cylinder, a fuzz of specks from the side), and
// the rim's top discs set inside the plate's edge (they spilled a fringe
// 16 mm past it, and a spike at each corner).
test("the plate's stand and rim are ordered discs inside their edges", async () => {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/studio.js");
  const it = buildRecipe(RECIPES["chladni-plate"], { seed: 7, count: 240000, options: { mode: "2-3+" } }, () => {}); // prettier-ignore
  let b = it.next();
  while (!b.done) b = it.next();
  const { buf, transform: tf } = b.value;
  let base = 0;
  let post = 0;
  let rimTop = 0;
  let worst = 0;
  for (let i = 0; i < buf.count; i++) {
    const [x, y, z] = [0, 1, 2].map((a) => buf.pos[i * 3 + a] / tf.scale + tf.center[a]);
    const r = Math.hypot(x, z);
    if (y > -1.095 && y < -1.005) {
      base++;
      expect(Math.abs(r - 0.5)).toBeLessThan(0.003);
    } else if (y > -0.95 && y < -0.1 && r < 0.3) {
      post++;
      expect(Math.abs(r - 0.09)).toBeLessThan(0.002);
    } else if (Math.abs(y - 0.001) < 0.0005 && Math.max(Math.abs(x), Math.abs(z)) > 0.95) {
      // (The bow, hidden until a tap, stands 4 cm past the front edge.)
      if (z > 1.03) continue;
      rimTop++;
      worst = Math.max(worst, Math.max(Math.abs(x), Math.abs(z)));
    }
  }
  expect(base).toBeGreaterThan(1500);
  expect(post).toBeGreaterThan(5000);
  expect(rimTop).toBeGreaterThan(2000);
  expect(worst).toBeLessThan(1 - 0.004);
});

test.describe("in the browser", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Sound in a box: a tap rings the cell and the beads form the figure", async ({ page }) => {
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
    await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "chladni-cell");
    const state = () =>
      page.evaluate(async () => (await import("/src/packs/chladni-3d.js")).cellState());
    await page.waitForFunction(
      async () => (await import("/src/packs/chladni-3d.js")).cellState().n > 0,
    );
    const s0 = await state();
    expect(s0.settled).toBeLessThan(0.15);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForFunction(
      async () => (await import("/src/packs/chladni-3d.js")).cellState().settled > 0.6,
      null,
      { timeout: 120_000 },
    );
    expect((await state()).mode).toBe("cube-012");
  });
});

// The Splat mirror's depth slider (Engine PR #383 draws it): shown over the
// stage on a camera, clear of the face and of every other control. On a
// generated mannequin (tools/lv7-mannequin.mjs), as lane Live r7 measures.
test.describe("the Splat mirror's depth slider", () => {
  test.describe.configure({ timeout: 600_000 });
  let y4m;
  test.beforeAll(() => {
    y4m = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "splashery-lv8-")), "still.y4m");
    execFileSync("node", ["tools/lv7-mannequin.mjs", y4m, "--still", "--frames=20"], { stdio: "ignore" }); // prettier-ignore
  });

  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ])
    test(`at ${w}×${h}: present, clear of the face`, async ({ playwright, baseURL }) => {
      const browser = await playwright.chromium.launch({ ...config.use.launchOptions, args: fakeCamera(y4m, config.use.launchOptions.args) }); // prettier-ignore
      try {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await openMirror(page, baseURL + "/");
        const dial = page.locator("#stage-dial");
        await expect(dial).toBeVisible();
        await expect(page.locator("#stage-dial-input")).toHaveValue("0.5");
        // The face's box on the page, from where the picture shows it.
        const face = await page.evaluate(async (F) => {
          const { MIRROR } = await import("/src/live/relief.js");
          const p = window.__splashery.player;
          const height = (2 * MIRROR.rows) / MIRROR.cols;
          const z = 0.9 * MIRROR.gain * 0.8;
          const r = document.getElementById("stage").getBoundingClientRect();
          const pts = [
            [F.x0, F.y0],
            [F.x1, F.y1],
            [F.x0, F.y1],
            [F.x1, F.y0],
          ].map(([u, v]) => p.screenPoint([(u - 0.5) * 2, (0.5 - v) * height, z]));
          const xs = pts.map((q) => q[0] + r.left);
          const ys = pts.map((q) => q[1] + r.top);
          return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }; // prettier-ignore
        }, FACE);
        const box = await dial.boundingBox();
        const apart =
          box.x >= face.right || box.x + box.width <= face.left || box.y >= face.bottom || box.y + box.height <= face.top; // prettier-ignore
        expect(apart, JSON.stringify({ box, face })).toBe(true);
        await page.screenshot({ path: `tests/screenshots/lv8-mirror-dial-${w}x${h}.png` });
      } finally {
        await browser.close();
      }
    });
});
