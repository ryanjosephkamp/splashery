// Lane QR lab r2 (docs/handoff/QRLabR2.md): the three labs toys in the
// browser. "How a QR code works" shows the very code the step-by-step
// encoder makes, and it scans; the Damage lab's meter agrees with jsQR on a
// fixed set of damage (the test reads the same picture with jsQR in Node);
// healing brings a code back to scanning; and the three codes in one square
// read back with the splitting reader.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { encodeSteps } from "../src/qr-lab/steps.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const read = (rgba, w, h) =>
  jsQR(new Uint8ClampedArray(rgba), w, h, { inversionAttempts: "dontInvert" })?.data ?? null;

async function open(page, id) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.app.player.toyInfo?.id === id && !window.__splashery.app.busy, id, { timeout: 60_000 }); // prettier-ignore
  return errors;
}
// Rebuild with options, fire a control, and wait for the new toy.
async function switchTo(page, options, key) {
  await page.evaluate(([o, k]) => window.__splashery.app.player.switchTo({ options: o, key: k, value: 1 }), [options, key]); // prettier-ignore
}

test("How a QR code works: its code is the encoder's, and it scans", async ({ page }) => {
  const errors = await open(page, "qr-anatomy");
  await switchTo(page, { view: "encode", step: "done", text: "Splashery QR", level: "M" }, "lift");
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const { steps } = window.__splashery.qrLab.anatomy();
    return { version: steps.version, mask: steps.mask, modules: Array.from(steps.modules), level: steps.level }; // prettier-ignore
  });
  const s = encodeSteps("Splashery QR", "M");
  expect(info.version).toBe(s.version);
  expect(info.mask).toBe(s.mask);
  expect(info.modules).toEqual(Array.from(s.modules));
  // Front on, the finished code reads back.
  await page.evaluate(() => {
    const p = window.__splashery.app.player;
    p.camera.setState(window.__splashery.qrLab.frontPose(12, 2), { snap: true });
  });
  await page.waitForTimeout(800);
  const png = PNG.sync.read(await page.locator("canvas").first().screenshot());
  expect(read(png.data, png.width, png.height)).toBe("Splashery QR");
  // Every part and step builds.
  for (const part of ["finder", "timing", "alignment", "format", "mask"]) await switchTo(page, { view: "parts", part }, "lift"); // prettier-ignore
  for (const step of ["mode", "pad", "blocks", "place", "mask4", "chosen"]) await switchTo(page, { view: "encode", step }, "lift"); // prettier-ignore
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

// The Damage lab's fixed set: none, light, splat-only, heavy, a finder covered.
const SET = [
  "",
  "scratch:0.24:all:1",
  "blur:0.5:all:1",
  "shrink:0.6:all:1;jitter:0.3:all:2",
  "sticker:0.35:center:1",
  "sticker:0.8:center:1",
  "tear:0.4:corner:1;smudge:0.5:center:2",
  "sticker:0.24:finder:1",
  "fade:0.75:all:1",
  "color:0.85:all:1",
];

test("the Damage lab's meter agrees with jsQR on a fixed set", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await open(page, "qr-damage");
  await page.evaluate(() => (window.__splashery.qrLab.autoCheck = false));
  const rows = [];
  for (const damage of SET) {
    await switchTo(page, { damage, level: "M", show: "damaged" }, "drop");
    await page.waitForTimeout(4000); // the damage lands
    const r = await page.evaluate(async () => {
      const c = await window.__splashery.qrLab.checkDamage();
      const img = window.__splashery.qrLab.lastShot();
      return { codes: c.codes.map((x) => ({ scans: x.scans, decodes: x.analysis.decodes, wrong: x.analysis.wrong.length, blocks: x.analysis.blocks.map((b) => [b.lost, b.fixable]) })), w: img.width, h: img.height, data: Array.from(img.data) }; // prettier-ignore
    });
    // jsQR in Node on the very picture the meter read.
    const text = read(r.data, r.w, r.h);
    const want = "https://ryanjosephkamp.github.io/splashery/";
    expect(r.codes[0].scans, damage).toBe(text === want);
    rows.push({ damage, scans: r.codes[0].scans, decodes: r.codes[0].decodes, wrong: r.codes[0].wrong, blocks: r.codes[0].blocks }); // prettier-ignore
  }
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/qrs-meter.json", JSON.stringify(rows, null, 1));
  // The clear cases: a clean code scans and every block is fine; a code
  // mostly under a sticker doesn't, and its blocks say so. (The blocks alone
  // don't promise a read: blurred splats keep every module's center right
  // but hide the finders' edges from jsQR, so the meter shows both.)
  expect(rows[0]).toMatchObject({ scans: true, decodes: true, wrong: 0 });
  expect(rows[5]).toMatchObject({ scans: false, decodes: false });
  expect(errors).toEqual([]);
});

test("healing: a code with a covered finder scans again", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await open(page, "qr-damage");
  await page.evaluate(() => (window.__splashery.qrLab.autoCheck = false));
  await switchTo(page, { damage: "sticker:0.24:finder:1;scratch:0.3:all:2", level: "M", show: "damaged" }, "drop"); // prettier-ignore
  await page.waitForTimeout(4000);
  const before = await page.evaluate(async () => {
    const c = await window.__splashery.qrLab.checkDamage();
    return { scans: c.codes[0].scans, decodes: c.codes[0].analysis.decodes, finders: c.codes[0].analysis.finders }; // prettier-ignore
  });
  expect(before.scans).toBe(false);
  expect(before.decodes).toBe(true);
  expect(before.finders[0]).toBeGreaterThan(0);
  await page.evaluate(() => window.__splashery.qrLab.heal());
  await page.waitForFunction(() => (window.__splashery.app.player.motion.state.heal ?? 0) >= 1, null, { timeout: 200_000 }); // prettier-ignore
  await page.waitForTimeout(500);
  const after = await page.evaluate(async () => {
    const c = await window.__splashery.qrLab.checkDamage();
    return { scans: c.codes[0].scans, wrong: c.codes[0].analysis.wrong.length };
  });
  expect(after).toEqual({ scans: true, wrong: 0 });
  expect(errors).toEqual([]);
});

test("three codes in one: the splitting reader reads all three", async ({ page }) => {
  const errors = await open(page, "qr-three");
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => window.__splashery.qrLab.readThree());
  expect(r.split).toEqual(["https://ryanjosephkamp.github.io/splashery/", "Three codes in one square", "Red, green and blue"]); // prettier-ignore
  // An ordinary reader sees gray, mostly green: it reads the green code or nothing.
  expect([null, "Three codes in one square"]).toContain(r.plain);
  await page.evaluate(() => window.__splashery.app.act());
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});
