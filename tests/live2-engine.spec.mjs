// Lane Live input r2's engine hooks (docs/handoff/LiveInput.md): the relief
// kind's 3D offset (axis 3), a recipe's action.onAct inside the tap itself,
// and input.maxBytes for a toy that streams its file.

import { test, expect } from "@playwright/test";
import { Kit } from "../src/kit.js";
import { KINDS } from "../src/effects.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

test("relief splats keep axis 3 (a 3D offset), and wilder axes clamp to it", () => {
  const k = new Kit(1, { count: 2000 });
  const items = [
    { p: [0, 0, 0], kind: "relief", params: [0.5, 0.25, 3, 0.4] },
    { p: [0, 1, 0], kind: "relief", params: [0.5, 0.25, 9, 0.4] },
  ];
  k.add(k.box(1, 1, 1), { share: 0.9 });
  k.cloud({ share: 0.001, pattern: false }, (rand, i) => items[i] || null);
  for (const _ of k.emit());
  const anim = k.buf.anim;
  const got = [];
  for (let i = 0; i < k.buf.count; i++) {
    if (anim[i * 4 + 1] !== KINDS.relief) continue;
    const z = anim[i * 4 + 2];
    const axis = Math.floor(z / 2);
    got.push({ u: z - 2 * axis, axis, lift: Math.floor(anim[i * 4 + 3] / 2) / 1000 });
  }
  expect(got.length).toBe(2);
  for (const g of got) expect(g).toMatchObject({ u: 0.5, axis: 3 });
  expect(Math.abs(got[0].lift - 0.4 * k.transform.scale)).toBeLessThan(0.002);
});

test("a recipe's onAct runs inside the tap, before the tap's own motion", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const { player, app } = window.__splashery;
    const a = player.motion.recipe.action;
    const seen = [];
    a.onAct = (point, state) => seen.push({ point, state: typeof state });
    app.act();
    const now = seen.length; // synchronous: already called
    delete a.onAct;
    return { now, state: seen[0]?.state };
  });
  expect(r.now).toBe(1);
  expect(r.state).toBe("object");
  expect(errors).toEqual([]);
});

test("input.maxBytes sets a toy's own file-size cap (40 MB without it)", async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__splashery.player.motion.recipe.input.maxBytes = 2e6));
  await page.locator("#toy-input-file").setInputFiles({ name: "big.wav", mimeType: "audio/wav", buffer: Buffer.alloc(3e6) }); // prettier-ignore
  await expect(page.locator("#toy-input .warning[role=alert]")).toHaveText(
    "That file is too big (over 2 MB).",
  );
});
