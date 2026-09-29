// Lane Viewer (docs/handoff/Viewer.md): whole PDF figures (no black boxes),
// a pinch that only zooms, the tilt lock and Reset view, the top-bar
// settings, flags per toy, and the terms of use.

import { test, expect } from "@playwright/test";
import { buildSheet } from "../src/picture-splats.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const FIGURES = "http://127.0.0.1:4173/tests/fixtures/vw/figures.pdf";

// A half float that is NaN or infinite (drawn black by the GPU).
const badHalf = (h) => (h & 0x7c00) === 0x7c00;

async function ready(page, url = APP) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// Waits until every picture sheet shows what the toy wants.
async function waitSheet(page) {
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      if (!p?.media) return false;
      window.__splashery.player.stage.requestRender();
      return (
        !p.retiring.length &&
        p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) &&
        p.splats() > 0
      );
    },
    null,
    { timeout: 120_000 },
  );
}

test.describe("whole PDF figures", () => {
  test("a flat-colored block never turns the paper NaN (the black boxes)", () => {
    // One 8 x 8 block of each flat color on white paper. Before the fix a
    // flat block's median (rounded to Float32) could sit above its own
    // pixels, leaving none to average: NaN paper, drawn as a black square.
    let bad = 0;
    for (let v = 0; v < 256; v += 1)
      for (const [r, g, b] of [
        [v, v, v],
        [v, 0, 0],
        [0, v, 0],
        [0, 0, v],
        [v, 255 - v, 128],
      ]) {
        // prettier-ignore
        const w = 16;
        const h = 16;
        const px = new Uint8ClampedArray(w * h * 4).fill(255);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px.set([r, g, b, 255], (y * w + x) * 4); // prettier-ignore
        const o = buildSheet({ pixels: px, w, h, method: "ink", origin: [0, 0, 0], right: [1, 0, 0], down: [0, -1, 0], normal: [0, 0, 1] }); // prettier-ignore
        for (let i = 0; i < o.count * 4; i++) if (badHalf(o.color[i])) bad++;
      }
    expect(bad).toBe(0);
  });

  test("every kind of embedded picture builds whole splats at every detail width", async ({
    page,
  }) => {
    await ready(page);
    const res = await page.evaluate(async (url) => {
      const { openMedia } = await import("/src/media.js");
      const { buildSheet } = await import("/src/picture-splats.js");
      const m = await openMedia(url, { profile: "low" });
      const out = [];
      for (const w of [181, 362, 724, 1100, 1448])
        for (let i = 0; i < m.count; i++) {
          const h = Math.round(w / m.aspect(i));
          const c = await m.draw(i, w, h);
          const px = c.getContext("2d").getImageData(0, 0, w, h).data;
          const o = buildSheet({ pixels: px, w, h, method: "ink", origin: [0, 0, 0], right: [1 / w, 0, 0], down: [0, -1 / w, 0], normal: [0, 0, 1] }); // prettier-ignore
          let bad = 0;
          let dark = 0;
          for (let k = 0; k < o.count * 4; k++) if ((o.color[k] & 0x7c00) === 0x7c00) bad++;
          // The figures have no black in them: count black detail pixels.
          for (let k = 0; k < px.length; k += 4) if (px[k] + px[k + 1] + px[k + 2] < 60) dark++;
          out.push({ w, page: i + 1, bad, dark, ink: o.ink });
        }
      m.close();
      return out;
    }, FIGURES);
    expect(res.length).toBe(30);
    for (const r of res) {
      expect(r.bad, `page ${r.page} at ${r.w}`).toBe(0);
      expect(r.dark, `page ${r.page} at ${r.w}`).toBe(0);
      expect(r.ink, `page ${r.page} at ${r.w}`).toBeGreaterThan(0);
    }
  });

  test("the Picture lab shows each figure page with no black on screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, `${APP}&labs=1`);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await page.evaluate((u) => window.__splashery.app.openMedia(u), FIGURES);
    await waitSheet(page);
    const count = await page.evaluate(() => window.__splashery.player.pictures.media.count);
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      await page.evaluate((i) => window.__splashery.player.pictures.go(i), i);
      await waitSheet(page);
      const dark = await page.evaluate(async () => {
        const st = window.__splashery.player.stage;
        st.requestRender();
        await new Promise((r) => setTimeout(r, 300));
        const c = await st.captureFrame();
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 60) n++;
        return n;
      });
      expect(dark, `page ${i + 1}`).toBeLessThan(20);
    }
  });
});
