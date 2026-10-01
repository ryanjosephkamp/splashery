// Engine for lane UI r4: a recipe's drag may return taps to fire
// (`drag.start` and `drag.move` return { key, pick } or a list), so a finger
// dragged across a keyboard plays each key it crosses. drive() sees every tap
// since the last frame as info.taps. No toy on main uses it yet, so the test
// lends the xylophone a drag for a moment.

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page) {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    await window.__splashery.app.chooseToy("xylophone");
  });
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.id === "xylophone", null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
  await page.waitForTimeout(600);
}

// Lends the xylophone a drag: the strip x in [-1, 1] is cut into `n` keys;
// the drag fires every key between the last point and this one, in order.
async function lendDrag(page, { claim = true, n = 8 } = {}) {
  await page.evaluate(
    async ({ claim, n }) => {
      const { player } = window.__splashery;
      const recipe = player.toyInfo.recipe;
      const keyOf = (p) => Math.max(0, Math.min(n - 1, Math.floor(((p[0] + 1) / 2) * n)));
      let last = null;
      window.__dragTest = { saved: recipe.drag, fired: [], taps: [] };
      const drive = recipe.drive;
      window.__dragTest.drive = drive;
      recipe.drive = (t, c, out, info) => {
        if (info.taps?.length) window.__dragTest.taps.push(info.taps.map((x) => x.pick));
        return drive(t, c, out, info);
      };
      player.on("action", (r) => r.drag && window.__dragTest.fired.push(r.pick));
      recipe.drag = {
        at: () => claim,
        plane: "view",
        start(p) {
          last = keyOf(p);
          return { key: "strike", pick: last };
        },
        move(p) {
          const k = keyOf(p);
          if (k === last) return null;
          const step = k > last ? 1 : -1;
          const out = [];
          for (let i = last + step; i !== k + step; i += step) out.push({ key: "strike", pick: i });
          last = k;
          return out;
        },
      };
      player.stage.requestRender();
    },
    { claim, n },
  );
}

async function restore(page) {
  await page.evaluate(() => {
    const recipe = window.__splashery.player.toyInfo.recipe;
    if (window.__dragTest.saved) recipe.drag = window.__dragTest.saved;
    else delete recipe.drag;
    recipe.drive = window.__dragTest.drive;
  });
}

test("a drag the toy claims fires each key it crosses, in order, and is not also a tap", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await lendDrag(page);
  const yaw0 = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
  const box = await page.locator("#stage").boundingBox();
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width * 0.3;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  // Wait for the drag to begin (the press finds the toy under the pointer).
  await page.waitForFunction(() => window.__dragTest.fired.length > 0, null, { timeout: 30_000 });
  // A fast drag: a few long moves, right then back left.
  for (const f of [0.45, 0.6, 0.7]) await page.mouse.move(box.x + box.width * f, y, { steps: 2 });
  await page.mouse.move(x0, y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ fired: window.__dragTest.fired, taps: window.__dragTest.taps })); // prettier-ignore
  // Up and back down: every key once per crossing, in order, none skipped.
  const fired = r.fired;
  expect(fired.length).toBeGreaterThan(4);
  const top = fired.indexOf(Math.max(...fired));
  for (let i = 1; i <= top; i++) expect(fired[i] - fired[i - 1], `up at ${i}`).toBe(1);
  for (let i = top + 1; i < fired.length; i++) expect(fired[i] - fired[i - 1], `down at ${i}`).toBe(-1); // prettier-ignore
  // drive() saw every tap (several can land between two frames).
  expect(r.taps.flat()).toEqual(fired);
  // The camera did not turn.
  expect(await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)).toBe(yaw0);
  // Letting go was not one more tap: the last tap is the drag's.
  const lastTap = await page.evaluate(() => window.__splashery.player.motion.tap);
  expect(lastTap.pick).toBe(fired[fired.length - 1]);
  await restore(page);
  expect(errors).toEqual([]);
});

test("a press and release on a claimed spot plays once; a drag the toy declines still orbits", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await lendDrag(page);
  const box = await page.locator("#stage").boundingBox();
  const [x, y] = [box.x + box.width * 0.35, box.y + box.height / 2];
  const n0 = await page.evaluate(() => window.__splashery.player.motion.tap?.n ?? 0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForFunction(() => window.__dragTest.fired.length > 0, null, { timeout: 30_000 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__splashery.player.motion.tap.n)).toBe(n0 + 1);
  await restore(page);
  // Declined (at() is false): the drag turns the toy as before.
  await lendDrag(page, { claim: false });
  const yaw0 = await page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(1500); // the press looks for the toy first
  await page.mouse.move(x + 200, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__dragTest.fired.length)).toBe(0);
  expect(Math.abs((await page.evaluate(() => window.__splashery.player.camera.tgt.yaw)) - yaw0)).toBeGreaterThan(0.1); // prettier-ignore
  await restore(page);
  expect(errors).toEqual([]);
});
