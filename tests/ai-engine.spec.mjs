// Engine for lane AI: a drawing pad in a toy's input panel (input.pad), and
// input.fileButton: false to leave the file button out. No toy on main uses
// them yet, so the test lends the molecule toy a pad for a moment.

import { test, expect } from "@playwright/test";

test("a toy's input panel can carry a drawing pad that hands its drawing to read()", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/atoms.js");
    const input = RECIPES.molecule.input;
    window.__padTest = { saved: { ...input }, got: null };
    Object.assign(input, {
      pad: {
        cols: 8,
        rows: 8,
        max: 16,
        button: "Read it",
        value: () => "pad:" + "0,".repeat(63) + "16",
      },
      fileButton: false,
      read: async (text) => {
        window.__padTest.got = text;
        return {};
      },
    });
    await window.__splashery.app.chooseToy("molecule");
  });
  const pad = page.locator("#toy-input-pad");
  await expect(pad).toBeAttached({ timeout: 60_000 });
  await expect(page.locator("#toy-input-open")).toBeHidden();
  // Draw a stroke across the middle of the pad (pointer events on the
  // canvas, which may sit in a closed sheet on this layout), then read it.
  await pad.evaluate((c) => {
    const r = c.getBoundingClientRect();
    const at = (f) => ({ clientX: r.left + r.width * f, clientY: r.top + r.height * 0.5, pointerId: 1, bubbles: true }); // prettier-ignore
    c.dispatchEvent(new PointerEvent("pointerdown", at(0.2)));
    for (let f = 0.25; f <= 0.8; f += 0.05) c.dispatchEvent(new PointerEvent("pointermove", at(f)));
    c.dispatchEvent(new PointerEvent("pointerup", at(0.8)));
  });
  await page.locator("#toy-input-pad-go").click({ force: true });
  const got = await page.waitForFunction(() => window.__padTest.got).then((h) => h.jsonValue());
  expect(got.startsWith("pad:")).toBe(true);
  const cells = got.slice(4).split(",").map(Number);
  expect(cells).toHaveLength(64);
  expect(cells.every((v) => v >= 0 && v <= 16)).toBe(true);
  expect(cells[63]).toBe(16); // the drawing it started from
  expect(cells.slice(24, 40).some((v) => v > 0)).toBe(true); // the stroke
  // Clear empties it.
  await page.evaluate(() => (window.__padTest.got = null));
  await page.locator("#toy-input-pad-clear").click({ force: true });
  await page.locator("#toy-input-pad-go").click({ force: true });
  const cleared = await page.waitForFunction(() => window.__padTest.got).then((h) => h.jsonValue());
  expect(
    cleared
      .slice(4)
      .split(",")
      .every((v) => v === "0"),
  ).toBe(true);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/atoms.js");
    const input = RECIPES.molecule.input;
    delete input.pad;
    delete input.fileButton;
    Object.assign(input, window.__padTest.saved);
  });
});
