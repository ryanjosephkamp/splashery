// Lane UI r4: a glissando. Press a key and drag along the keyboard: each key
// the pointer crosses plays once, in order; a drag that starts off the keys
// still turns the toy.

import { test, expect } from "@playwright/test";
import { keyPoint } from "../src/packs/pianos.js";

const SHOTS = new URL("./screenshots/", import.meta.url);

async function open(page, id) {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.camera.setTurntable(false);
    window.__fired = [];
    player.on("action", (r) => r.drag && window.__fired.push(r.pick));
  });
  await page.waitForTimeout(1500); // the view settles
}

// A recipe point on the canvas (CSS pixels).
const screen = (page, p) => page.evaluate((p) => window.__splashery.player.screenPoint(p), p);

// White keys from `a` to `b` (key indices on the grand piano).
function whites(a, b) {
  const out = [];
  const step = b > a ? 1 : -1;
  for (let i = a; i !== b + step; i += step) if (keyPoint("grand-piano", i)[2] === -0.04) out.push(i); // prettier-ignore
  return out;
}

for (const [name, size] of [
  ["1440x900", { width: 1440, height: 900 }],
  ["390x844", { width: 390, height: 844 }],
]) {
  test.describe(name, () => {
    test.use({ viewport: size });

    test(`a drag along the keys plays each key it crosses, in order, up and back (${name})`, async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page, "grand-piano");
      const keys = whites(39, 51); // C4 up to C5 and a little more
      const front = (i) => keyPoint("grand-piano", i); // a white key, clear of the black ones
      const a = await screen(page, front(keys[0]));
      const b = await screen(page, front(keys[keys.length - 1]));
      const yaw0 = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
      await page.mouse.move(a[0], a[1]);
      await page.mouse.down();
      await page.waitForFunction(() => window.__fired.length > 0, null, { timeout: 30_000 });
      // Fast: a few long moves up, then back down.
      await page.mouse.move(b[0], b[1], { steps: 3 });
      await page.mouse.move(a[0], a[1], { steps: 2 });
      await page.mouse.up();
      await page.waitForTimeout(800);
      if (name === "390x844")
        await page.screenshot({ path: new URL(`ui4-grand-${name}.png`, SHOTS).pathname });
      const fired = await page.evaluate(() => window.__fired);
      const up = keys;
      const down = keys.slice(0, -1).reverse();
      expect(fired).toEqual([...up, ...down]);
      // The camera did not turn.
      expect(await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)).toBe(yaw0);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("off the keys", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a drag that starts off the keys still turns the toy, and plays nothing", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "grand-piano");
    const yaw0 = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
    const box = await page.locator("#stage").boundingBox();
    // An empty corner of the stage (no toy there), then the piano's lid.
    for (const [x, y] of [
      [box.x + 40, box.y + box.height - 60],
      [box.x + box.width / 2, box.y + box.height * 0.3],
    ]) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(1500); // the press looks for the toy first
      await page.mouse.move(x + 160, y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    expect(await page.evaluate(() => window.__fired.length)).toBe(0);
    expect(Math.abs((await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)) - yaw0)).toBeGreaterThan(0.1); // prettier-ignore
    expect(errors).toEqual([]);
  });
});

test("every keyboard and the xylophone take a glissando drag", async () => {
  const { RECIPES: P } = await import("../src/packs/pianos.js");
  const { RECIPES: M } = await import("../src/packs/music.js");
  for (const [id, r] of [
    ["grand-piano", P["grand-piano"]],
    ["upright-piano", P["upright-piano"]],
    ["harpsichord", P.harpsichord],
    ["electronic-keyboard", P["electronic-keyboard"]],
    ["toy-piano", M["toy-piano"]],
    ["xylophone", M.xylophone],
  ])
    expect(typeof r.drag?.move, id).toBe("function");
  // Off the keys, the drag declines (the camera turns instead).
  expect(P["grand-piano"].drag.at([0, 2, 0])).toBe(false);
  // A walk along the keys, sample by sample, fires every key between.
  const d = P["grand-piano"].drag;
  const k0 = keyPoint("grand-piano", 39);
  const k1 = keyPoint("grand-piano", 51);
  expect(d.start(k0)).toEqual({ key: "strike", pick: 39 });
  const picks = d.move(k1).map((t) => t.pick);
  d.end();
  expect(picks[picks.length - 1]).toBe(51);
  for (let i = 1; i < picks.length; i++) expect(picks[i]).toBeGreaterThan(picks[i - 1]);
});
