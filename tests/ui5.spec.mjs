// Lane UI r5 (toys): the rotation defaults the owner asked for on October 2,
// 2026 (the storybook, the umbrella, the xylophone and the upright piano turn
// any way from the start), and "Model to splats" with big files: the device's
// own caps, a progress line, and a very detailed mesh simplified on the device.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SHOTS = new URL("./screenshots/", import.meta.url);
const shot = (name) => new URL(name, SHOTS).pathname;

async function open(page) {
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const view = (page) =>
  page.evaluate(() => {
    const c = window.__splashery.player.camera;
    return { lock: c.tiltLock, spin: c.turntable, pitch: c.home.pitch };
  });

test.describe("rotation defaults", () => {
  test.use(PHONE);

  test("the storybook, umbrella, xylophone and upright piano open with the tilt free; the rest of their shelves stay locked", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    for (const id of ["book", "umbrella", "xylophone", "upright-piano"]) {
      await pick(page, id);
      const v = await view(page);
      expect(v.lock, id).toBe(false);
      expect(v.spin, id).toBe(false); // their shelves still hold still by default
      await expect(page.locator("#tilt-toggle")).toHaveAttribute("aria-pressed", "false");
      if (id === "xylophone") {
        expect(v.pitch).toBeCloseTo(0.62, 2); // a little more from above
        await page.waitForTimeout(800);
        await page.screenshot({ path: shot("ui5-xylophone-390x844.png") });
      }
    }
    // A drag can now tip the upright piano to look from above.
    await pick(page, "upright-piano");
    const before = await view(page);
    const box = await page.locator("#stage").boundingBox();
    // From the empty corner above the piano (a drag on the keys plays them).
    const x = box.x + box.width * 0.08;
    const y = box.y + box.height * 0.22;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x + 2, y + i * 16);
    await page.mouse.up();
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => window.__splashery.player.camera.tgt.pitch);
    expect(after).toBeGreaterThan(before.pitch + 0.2);
    await page.screenshot({ path: shot("ui5-upright-above-390x844.png") });
    // Unchanged: the other music and objects toys keep the lock.
    for (const id of ["grand-piano", "toy-piano", "laptop", "music-box"]) {
      await pick(page, id);
      expect((await view(page)).lock, id).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("big models", () => {
  const dir = path.join(process.cwd(), "test-results");
  const file = path.join(dir, "ui5-3m.glb");
  test.beforeAll(() => {
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) execFileSync("node", ["tools/ui5-big-model.mjs", file, "3000000"]);
  });

  test.describe("computer", () => {
    test.use(DESK);

    test("a 66 MB model with 3 million triangles opens (over the old 40 MB cap), with a progress line, simplified on the device", async ({
      page,
    }) => {
      test.setTimeout(400_000);
      const errors = watchErrors(page);
      await open(page);
      await pick(page, "model-splats");
      const lim = await page.evaluate(async () => (await import("/src/packs/studio-models.js")).modelLimits()); // prettier-ignore
      expect(lim.maxBytes).toBeGreaterThanOrEqual(300e6);
      expect(lim.simplifyTo).toBe(1_200_000);
      expect(fs.statSync(file).size).toBeGreaterThan(40e6);
      await page.locator("#toy-input-file").setInputFiles(file);
      await expect(page.locator("#toy-input .input-progress")).toBeVisible();
      await expect(page.locator("#toy-input .input-progress")).toHaveText(/Reading|Simplifying|Spreading/); // prettier-ignore
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === "ui5-3m", null, { timeout: 300_000 }); // prettier-ignore
      const m = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.model);
      expect(m.triangles).toBeLessThan(1_600_000);
      expect(m.triangles).toBeGreaterThan(800_000);
      expect(m.splats).toBeGreaterThan(5000);
      expect(m.notes.join(" ")).toMatch(/simplified to/);
      await expect(page.locator("#toy-input .input-progress")).toBeHidden();
      await expect(page.locator("#toy-input")).toContainText("simplified to");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: shot("ui5-model-big-1440x900.png") });
      expect(errors).toEqual([]);
    });
  });

  test.describe("phone", () => {
    test.use(PHONE);

    test("a phone gets smaller caps, simplifies to fewer triangles (keeping crisp edges), and says what to do with a file that is too big", async ({
      page,
    }) => {
      test.setTimeout(400_000);
      const errors = watchErrors(page);
      await open(page);
      await pick(page, "model-splats");
      const out = await page.evaluate(async () => {
        const { modelLimits, RECIPES } = await import("/src/packs/studio-models.js");
        const input = RECIPES["model-splats"].input;
        return { lim: modelLimits(), cap: input.maxBytes(), msg: input.tooBig(input.maxBytes()) };
      });
      expect(out.lim.simplifyTo).toBe(400_000);
      expect(out.lim.maxBytes).toBeGreaterThanOrEqual(120e6);
      expect(out.lim.maxBytes).toBeLessThanOrEqual(250e6);
      expect(out.cap).toBe(out.lim.maxBytes);
      expect(out.msg).toMatch(/^That file is over \d+ MB, the most this device can open\. Try it on a computer/); // prettier-ignore
      await page.locator("#toy-input-file").setInputFiles(file);
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === "ui5-3m", null, { timeout: 300_000 }); // prettier-ignore
      const m = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.model);
      expect(m.triangles).toBeLessThanOrEqual(450_000);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: shot("ui5-model-big-390x844.png") });
      expect(errors).toEqual([]);
    });
  });
});
