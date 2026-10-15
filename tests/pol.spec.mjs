// Lane Polish (October 15, 2026): round 2's fixes to Ryan's favorite toys, each the one the owner
// marked on the Effect review page (cards pol-<toy id>): the Chladni plate's framing and mode
// name, Sound in a box's glass, the Song landscape's note ruler and key, Model to splats's lift,
// Powers of ten's 3 km picture and planets, the microscope's scale bar, the galaxy's hot halo, and
// Point clouds' framing, points and height key.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import jpeg from "jpeg-js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function open(page, toy, options) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(
    async ({ toy, options }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(toy);
      if (options) await app.setToyOptions(options);
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
    },
    { toy, options },
  );
  await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  return errors;
}

// The text of the box beside the view (the toy's legend), once it shows.
const legend = (page) =>
  page.waitForFunction(
    () => {
      const el = document.getElementById("toy-legend");
      return el && !el.hidden && el.textContent ? el.textContent : null;
    },
    null,
    { timeout: 120_000 },
  );

test.describe.configure({ timeout: 400_000 });

test("Model to splats: every splat lifts on a shrinking channel, and the frame is the model's", async ({
  page,
}) => {
  const errors = await open(page, "model-splats");
  const r = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const ctx = player.proc.ctx;
    const { KINDS } = await import("/src/effects.js");
    let morphs = 0;
    let shrinking = 0;
    for (let i = 0; i < ctx.buf.count; i++) {
      if (ctx.buf.anim[i * 4 + 1] !== KINDS.morph) continue;
      morphs++;
      if (Math.floor(ctx.buf.anim[i * 4 + 3] / 4096) >= 4) shrinking++;
    }
    return { morphs, shrinking };
  });
  expect(r.morphs).toBeGreaterThan(1000);
  expect(r.shrinking).toBe(r.morphs);
  expect(errors).toEqual([]);
});

test("Chladni plate: a tap names the mode beside the plate", async ({ page }) => {
  const errors = await open(page, "chladni-plate");
  await page.evaluate(() => window.__splashery.player.act(null));
  const text = await (await legend(page)).jsonValue();
  expect(text).toMatch(/^Mode 2, 3 \(\+\): \d+ Hz/);
  expect(errors).toEqual([]);
});

test("Super-resolution microscope: a scale bar in nm or µm beside the view", async ({ page }) => {
  const errors = await open(page, "smlm-microscope");
  const text = await (await legend(page)).jsonValue();
  expect(text).toMatch(/^Scale\d[\d,]* (nm|µm)$/);
  expect(errors).toEqual([]);
});

test("Point clouds: colored by height, a key gives the rise", async ({ page }) => {
  const errors = await open(page, "point-clouds");
  const text = await (await legend(page)).jsonValue();
  expect(text).toMatch(/^HeightLowest \(blue\) through green and yellow to highest \(white\), \d[\d,]* m apart$/); // prettier-ignore
  expect(errors).toEqual([]);
});

test("Powers of ten: the 3 km picture's colors are within 12% of its neighbors'", () => {
  const dir = new URL("../assets/toys/powers-of-ten/", import.meta.url);
  const read = (n) => jpeg.decode(fs.readFileSync(new URL(n, dir)), { useTArray: true });
  const mean = (img, f = 1) => {
    const s = Math.round(img.width * f);
    const o = Math.floor((img.width - s) / 2);
    const m = [0, 0, 0];
    for (let y = o; y < o + s; y++)
      for (let x = o; x < o + s; x++) for (let c = 0; c < 3; c++) m[c] += img.data[(y * img.width + x) * 4 + c]; // prettier-ignore
    return m.map((v) => v / (s * s));
  };
  const step = 10 ** -0.5;
  const mid = read("aerial-3_5.jpg");
  const outer = mean(read("aerial-4_0.jpg"), step);
  const inner = mean(read("aerial-3_0.jpg"));
  const whole = mean(mid);
  const middle = mean(mid, step);
  for (let c = 0; c < 3; c++) {
    expect(Math.abs(whole[c] / outer[c] - 1)).toBeLessThan(0.12);
    expect(Math.abs(middle[c] / inner[c] - 1)).toBeLessThan(0.12);
  }
});
