// Lane AUD1 (docs/audits/core-promises-2026-10.md): proofs for the audit of
// the app's core. Each test states a promise the code makes and checks the
// promise itself (what the toy draws, what the link keeps), not only that the
// control moved. They fail on main where the report says they do.

import { test, expect } from "@playwright/test";

async function open(page, query = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?renderer=webgl2&adapt=off${query}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

const choose = (page, id) =>
  page.evaluate((id) => window.__splashery.app.chooseToy(id), id);

const splats = (page) => page.evaluate(() => window.__splashery.player.toyInfo.splats);

// F1. Detail pressed while an export runs (app.busy): the choice is saved and
// shown, and the tier changes, but the toy is never rebuilt with it.
test("F1: a Detail choice made during an export reaches the toy", async ({ page }) => {
  const errors = await open(page, "&profile=");
  await choose(page, "clock");
  await page.evaluate(() => window.__splashery.app.setDetail("auto"));
  const before = await page.evaluate(() => window.__splashery.player.profile);
  const want = before === "max" ? "high" : "max";
  // An export holds the app busy for a moment (withBusy, as every export does).
  await page.evaluate(async (want) => {
    const { app } = window.__splashery;
    let release;
    const held = app.withBusy("Exporting…", () => new Promise((r) => (release = r)));
    await app.setDetail(want);
    release();
    await held;
  }, want);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const drawn = player.toyInfo.splats;
    // The same toy built now, at the tier the Detail choice set.
    await app.loadToy(player.scene.toy);
    return { detail: player.detail, drawn, rebuilt: player.toyInfo.splats };
  });
  expect(r.detail).toBe(want);
  expect(r.drawn).toBe(r.rebuilt);
  expect(errors).toEqual([]);
});
