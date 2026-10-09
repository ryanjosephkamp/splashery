// Lane Photo sharp view (docs/handoff/PhotoSharpView.md): the "Sharp picture" view of Photo to 3D
// and Moving photo to 3D: the picture at its full resolution on a relief lifted by the splats' own
// depth, a choice beside the splats (which stay the default). Nothing new goes into scenes.

import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { sharpView, SHARP_CELLS } from "../src/packs/photo-sharp.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

// How sharp a screenshot's middle is: the mean squared Sobel gradient of its luminance.
function tenengrad(buf, box) {
  const p = PNG.sync.read(buf);
  const L = (x, y) => {
    const i = (y * p.width + x) * 4;
    return 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
  };
  let s = 0;
  let n = 0;
  for (let y = box.y0 + 1; y < box.y1 - 1; y++)
    for (let x = box.x0 + 1; x < box.x1 - 1; x++) {
      const gx = L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1); // prettier-ignore
      const gy = L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1); // prettier-ignore
      s += gx * gx + gy * gy;
      n++;
    }
  return s / n;
}

function meanLum(buf, box) {
  const p = PNG.sync.read(buf);
  let s = 0;
  let n = 0;
  for (let y = box.y0; y < box.y1; y += 2)
    for (let x = box.x0; x < box.x1; x += 2) {
      const i = (y * p.width + x) * 4;
      s += 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
      n++;
    }
  return s / n;
}

async function open(page, toy, test) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
  await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
  test.info().annotations.push({ type: "toy", description: toy });
  return errors;
}

const state = (page) => page.evaluate(() => window.__psv.state());
const splatsOn = (page) => page.evaluate(() => window.__splashery.player.stage.toy.entity.gsplat.enabled); // prettier-ignore

test.describe("the module", () => {
  test("Sharp picture is the default, and the relief fits each profile's budget", () => {
    // (the owner's call of October 8, 2026: "Make sharp the default")
    expect(sharpView("photo-3d")).toBe("sharp");
    expect(sharpView("moving-photo-3d")).toBe("sharp");
    expect(SHARP_CELLS.low).toBeLessThan(SHARP_CELLS.mid);
    expect(SHARP_CELLS.max).toBeLessThanOrEqual(300000);
  });
});

test.describe("Photo to 3D", () => {
  test.setTimeout(300_000);

  test("Sharp picture shows the photo at full size on its relief, and back to the splats", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await open(page, "photo-3d", test);
    // The switch is in the Toy tab's panel, Sharp picture pressed: it opens sharp.
    await expect(page.locator("#psv-sharp")).toHaveAttribute("aria-pressed", "true");
    await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 30_000 });
    expect(await splatsOn(page)).toBe(false);
    await expect(page.locator("#toy-status")).toContainText("Sharp picture");
    // A tool that works on splats (Poke) brings them back while it is picked, and says so.
    await page.evaluate(() => window.__splashery.app.setTool("poke"));
    await page.waitForFunction(() => !window.__psv.state().on, null, { timeout: 30_000 });
    expect(await splatsOn(page)).toBe(true);
    await expect(page.locator("#toy-status")).toContainText("splats");
    await expect(page.locator(".psv-switch .note")).toContainText("Showing the splats");
    await page.evaluate(() => window.__splashery.app.setTool("orbit"));
    await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 30_000 });
    // Splats, then raise the depth and look at both views.
    await page.evaluate(() => document.querySelector("#psv-splats").click());
    await page.waitForFunction(() => !window.__psv.state().on, null, { timeout: 30_000 });
    expect(await splatsOn(page)).toBe(true);
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForFunction(() => window.__splashery.player.motion.state.flat < 0.01, null, { timeout: 60_000 }); // prettier-ignore
    await page.waitForTimeout(800);
    const box = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const a = pl.stage.toScreen(pl.fromRecipe([-0.4, 0.3, 0]));
      const b = pl.stage.toScreen(pl.fromRecipe([0.4, -0.3, 0]));
      return {
        x0: Math.round(a[0]),
        y0: Math.round(a[1]),
        x1: Math.round(b[0]),
        y1: Math.round(b[1]),
      };
    });
    const splatShot = await page.locator("canvas").first().screenshot();
    await page.evaluate(() => window.__psv.set("photo-3d", "sharp"));
    await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 30_000 });
    await page.waitForTimeout(800);
    const s = await state(page);
    const info = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.photo);
    expect(s.kind).toBe("photo");
    expect(s.color).toEqual([1280, 853]); // the sample photo at its own size
    expect(s.depth).toEqual(info.grid); // the splats' own depth
    expect(s.grid[0] * s.grid[1]).toBeLessThanOrEqual(SHARP_CELLS.mid * 1.01);
    expect(await splatsOn(page)).toBe(false);
    await expect(page.locator("#psv-sharp")).toHaveAttribute("aria-pressed", "true");
    const sharpShot = await page.locator("canvas").first().screenshot();
    // the photo is on screen, not the white page, with detail in it (how much sharper it reads
    // than the splats is measured by tools/psv-legibility.mjs, on text)
    expect(tenengrad(sharpShot, box)).toBeGreaterThan(0.5 * tenengrad(splatShot, box));
    expect(meanLum(sharpShot, box)).toBeLessThan(200);
    // A tap on the relief reaches the toy (its tap box), and lays it flat.
    expect(await page.evaluate(() => !!window.__splashery.player.motion.ctx.kit.data.tapBox)).toBe(true); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForFunction(() => window.__splashery.player.motion.state.flat > 0.95, null, { timeout: 60_000 }); // prettier-ignore
    // A new depth rebuilds the toy; the relief follows it.
    await page.evaluate(() => window.__splashery.app.setToyOptions({ depth: 1 }));
    await page.waitForFunction(() => !window.__splashery.player.loading && window.__psv.state().on, null, { timeout: 60_000 }); // prettier-ignore
    expect(await splatsOn(page)).toBe(false);
    // Nothing new in the scene but the view itself (round 2: saved scenes remember it).
    const options = await page.evaluate(() => Object.keys(window.__splashery.player.scene.toy.options || {})); // prettier-ignore
    const known = ["source", "depth", "original", "photoName", "view"];
    expect(options.every((k) => known.includes(k))).toBe(true);
    // Back to the splats.
    await page.evaluate(() => document.querySelector("#psv-splats").click());
    await page.waitForFunction(() => !window.__psv.state().on, null, { timeout: 30_000 }); // (at the next update)
    expect(await splatsOn(page)).toBe(true);
    expect(await page.evaluate(() => !!window.__splashery.player.motion.ctx.kit.data.tapBox)).toBe(false); // prettier-ignore
    expect(errors).toEqual([]);
  });

  test("another toy takes the relief away", async ({ page }) => {
    const errors = await open(page, "photo-3d", test);
    await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 30_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
    await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data?.moving, null, { timeout: 120_000 }); // prettier-ignore
    // (Moving photo to 3D in Splats, picked here: no relief at all may stay on screen)
    await page.evaluate(() => window.__psv.set("moving-photo-3d", "splats"));
    // (the splats come back at the next update, and the relief goes then: r3)
    await page.waitForFunction(() => !window.__psv.state().on, null, { timeout: 30_000 });
    expect(await splatsOn(page)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe("Moving photo to 3D", () => {
  test.setTimeout(300_000);

  test("Sharp picture takes its color straight from the video, and follows pause and scrubbing", async ({
    page,
  }) => {
    const errors = await open(page, "moving-photo-3d", test);
    await page.evaluate(() => window.__psv.set("moving-photo-3d", "sharp"));
    await page.waitForFunction(() => window.__psv.state().on && window.__psv.state().video, null, { timeout: 60_000 }); // prettier-ignore
    const s = await state(page);
    expect(s.kind).toBe("clip");
    const clip = await page.evaluate(async () => {
      const { MOVING } = await import("/src/packs/moving-photo.js");
      return { w: MOVING.clip.w, h: MOVING.clip.h };
    });
    expect(s.depth).toEqual([clip.w, clip.h]);
    expect(await splatsOn(page)).toBe(false);
    // the status line says what is on screen
    await expect(page.locator("#toy-status")).toContainText("Sharp picture");
    await expect(page.locator("#toy-status")).not.toContainText("splats");
    // pause, then scrub: the video copy goes where the clip is
    await page.evaluate(() => window.__splashery.app.act());
    await page.evaluate(async () =>
      (await import("/src/packs/moving-photo.js")).movingTransport.seek(3.2),
    );
    await page.waitForTimeout(1500);
    const t = await page.evaluate(async () => {
      const { MOVING } = await import("/src/packs/moving-photo.js");
      return MOVING.t;
    });
    expect(Math.abs(t - 3.2)).toBeLessThan(0.1);
    await page.evaluate(() => window.__psv.set("moving-photo-3d", "splats"));
    await page.waitForFunction(() => !window.__psv.state().on, null, { timeout: 30_000 }); // (at the next update)
    expect(await splatsOn(page)).toBe(true);
    await expect(page.locator("#toy-status")).toContainText("splats");
    expect(errors).toEqual([]);
  });
});

test.describe("screenshots", () => {
  test.setTimeout(300_000);
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ])
    for (const toy of ["photo-3d", "moving-photo-3d"])
      test(`${toy} in Sharp picture at ${w}x${h}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await open(page, toy, test);
        if (toy === "photo-3d") {
          await page.evaluate(() => window.__splashery.app.act());
          await page.waitForFunction(() => window.__splashery.player.motion.state.flat < 0.01, null, { timeout: 60_000 }); // prettier-ignore
        }
        await page.evaluate((t) => window.__psv.set(t, "sharp"), toy);
        await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `tests/screenshots/psv-${toy}-${w}x${h}.png` });
      });
});
