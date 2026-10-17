// Task 101: independent book layout and pointer checks, with their original clocks and fixtures.
import { test, expect } from "@playwright/test";

import {
  waitSheets,
  BK,
  open,
  step,
  turn,
  pointAt,
  pullBy,
  pageNow,
  landed,
  glided,
  pageBox,
} from "./bk-helpers.mjs";
test.describe("your book, the album and the frame (in the app)", () => {
  test.setTimeout(300_000);
  test("a 300-page PDF is as light as a 3-page one: pages not reached are never built", async ({
    page,
  }) => {
    await open(page, "your-book", `${BK}pages3.pdf`);
    await turn(page);
    const small = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      return { splats: p.splats(), slots: p.sheets.filter((s) => s.slot).length };
    });
    await page.evaluate((u) => window.__splashery.app.openMedia(u), `${BK}pages300.pdf`);
    await waitSheets(page);
    for (let i = 0; i < 3; i++) await turn(page);
    await page.evaluate(() => window.__splashery.player.pictures.go(249));
    await step(page, 1);
    const big = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      return {
        splats: p.splats(),
        slots: p.sheets.filter((s) => s.slot).length,
        built: [...new Set(p.stats.rendered.map((r) => r.page))].sort((a, b) => a - b),
        page: p.page,
        count: p.info().count,
      };
    });
    expect(big.count).toBe(300);
    expect(big.page).toBe(249);
    // The splats on show are about one spread's either way.
    expect(big.splats).toBeLessThan(small.splats * 2);
    expect(big.slots).toBeLessThanOrEqual(9);
    // Built: the first spreads, the pages the next turn needs, and around
    // page 250; nothing else of the 300.
    expect(big.built.filter((p) => p > 12 && p < 240)).toEqual([]);
    expect(big.built.length).toBeLessThan(26);
  });

  test("the page shape follows the PDF: wide slides make a wide book", async ({ page }) => {
    await open(page, "your-book", `${BK}slides.pdf`);
    const r = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const f = pl.pictures.sheets.find((s) => s.def.id === "f0").def;
      return { aspect: pl.proc.ctx.kit.media.aspect, w: f.width, h: f.height };
    });
    expect(r.aspect).toBeCloseTo(16 / 9, 2);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 2);
  });

  test("a turned page and the open cover are sorted where they lie, on the left", async ({
    page,
  }) => {
    await open(page, "your-book", `${BK}booklet.pdf`);
    for (let i = 0; i < 2; i++) await turn(page);
    // A page rebuilt at a new detail is sorted where it lies on the next
    // frame (Player.poseStale): let that frame come.
    await page.waitForFunction(() => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      return !pl.poseStale;
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // prettier-ignore
    const r = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const p = pl.pictures;
      // The left page's sheet: its sort centers now lie left of the spine.
      const left = p.sheets.filter((s) => s.slot?.entity.enabled && s.def.normal[2] < 0);
      const xs = left.map((s) => {
        const c = s.slot.container.centers;
        let sum = 0;
        for (let i = 0; i < s.shown.data.count; i++) sum += c[i * 3];
        return sum / s.shown.data.count;
      });
      // The kit's cover too.
      const { buf, parts } = pl.proc.ctx;
      const cover = parts.findIndex((q) => q.name === "cover");
      const cc = pl.proc.container.centers;
      let sx = 0;
      let n = 0;
      for (let i = 0; i < buf.count; i++)
        if ((Math.round(buf.anim[i * 4]) & 15) === cover) {
          sx += cc[i * 3];
          n++;
        }
      return { page: p.page, xs, cover: sx / n };
    });
    expect(r.page).toBe(3);
    expect(r.xs.length).toBe(1);
    expect(r.xs[0]).toBeLessThan(-0.1);
    expect(r.cover).toBeLessThan(-0.1);
  });

  test("the album shows the sample photos mounted with captions, and turns", async ({ page }) => {
    await open(page, "photo-album");
    await turn(page);
    const r = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      return { kind: p.info().kind, count: p.info().count, shown: p.sheets.filter((s) => s.slot?.entity.enabled).map((s) => s.shown.page) }; // prettier-ignore
    });
    expect(r.kind).toBe("image");
    expect(r.count).toBe(6);
    expect(r.shown.sort()).toEqual([0, 1]);
  });

  test("a pointer pulls a page over only when pulled far enough; a tap turns by where it lands", async ({
    page,
  }) => {
    await open(page, "your-book", `${BK}booklet.pdf`);
    await turn(page); // the cover opens
    expect(await pageNow(page)).toBe(1);
    // Pulled a little way and let go: it falls back.
    await pullBy(page, [0.6, 0, 0.02], [0.4, 0, 0.02], 6);
    await landed(page);
    expect(await pageNow(page)).toBe(1);
    // Pulled across the spine: it turns.
    await pullBy(page, [0.6, 0, 0.02], [-0.5, 0, 0.02], 16);
    await landed(page);
    expect(await pageNow(page)).toBe(3);
    // A click on the left page goes back.
    const [x, y] = await pointAt(page, [-0.4, 0, 0.02]);
    await page.mouse.click(x, y);
    await page.waitForFunction(() => window.__splashery.player.pictures.page === 1, null, { timeout: 60_000 }); // prettier-ignore
    await landed(page);
    // A pull that starts off the book turns the view instead.
    await pullBy(page, [0.2, 0.9, 0.02], [-0.3, 0.9, 0.02], 8);
    await landed(page);
    expect(await pageNow(page)).toBe(1);
  });

  test("a double-tap on a page glides the view to it; taps page through; again shows both pages", async ({
    page,
  }) => {
    await open(page, "your-book", `${BK}booklet.pdf`);
    await turn(page); // the cover opens
    const home = await page.evaluate(() => window.__splashery.player.camera.tgt.distance);
    // A double-tap on the right page: it fills the screen (the page isn't turned).
    let [x, y] = await pointAt(page, [0.4, 0, 0.02]);
    await page.mouse.dblclick(x, y);
    await glided(page, "R");
    expect(await pageNow(page)).toBe(1);
    const c = await page.evaluate(() => window.__splashery.player.motion.out.view.center[0]);
    let box = await pageBox(page, c - 0.3, c + 0.3);
    expect(Math.abs(box.cx - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(box.cy - 0.5)).toBeLessThan(0.05);
    // (Landscape: the page's height fills the screen's.)
    expect(box.h).toBeGreaterThan(0.85);
    expect(box.h).toBeLessThan(1.01);
    // A tap on its right half turns the leaf, landing on the next left page.
    [x, y] = await pointAt(page, [c + 0.2, 0, 0.02]);
    await page.mouse.click(x, y);
    await glided(page, "L");
    await landed(page);
    expect(await pageNow(page)).toBe(3);
    // Forward again goes on to the right page, without a turn.
    [x, y] = await pointAt(page, [-c + 0.2, 0, 0.02]);
    await page.mouse.click(x, y);
    await glided(page, "R");
    expect(await pageNow(page)).toBe(3);
    // A double-tap again: both pages, the view back where it was.
    [x, y] = await pointAt(page, [c, 0, 0.02]);
    await page.mouse.dblclick(x, y);
    await glided(page, "all");
    expect(await pageNow(page)).toBe(3);
    const d = await page.evaluate(() => window.__splashery.player.camera.tgt.distance);
    expect(Math.abs(d - home)).toBeLessThan(0.01);
  });

  test("a zoom out lets a page in view go, and Reset still resets the view", async ({ page }) => {
    await open(page, "your-book", `${BK}booklet.pdf`);
    await turn(page); // the cover opens
    const [x, y] = await pointAt(page, [0.4, 0, 0.02]);
    await page.mouse.dblclick(x, y);
    await glided(page, "R");
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 500);
    await glided(page, "all");
    await page.mouse.dblclick(x, y);
    await glided(page, "R");
    await page.keyboard.press("r");
    await glided(page, "all");
    const c = await page.evaluate(() => {
      const cam = window.__splashery.player.camera;
      return [cam.tgt.distance - cam.home.distance, cam.tgt.yaw - cam.home.yaw];
    });
    expect(Math.abs(c[0]) + Math.abs(c[1])).toBeLessThan(0.01);
    expect(await pageNow(page)).toBe(1);
  });

  test("on a phone held upright the book opens reading one page at a time", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "your-book", `${BK}booklet.pdf`);
    await glided(page, "C");
    // (No choice is stored: the link and saved scene are as before.)
    expect(await page.evaluate(() => "reading" in (window.__splashery.player.scene.toy.options || {}))).toBe(false); // prettier-ignore
    await turn(page);
    await glided(page, "R");
    const c = await page.evaluate(() => window.__splashery.player.motion.out.view.center[0]);
    // (Upright: the page's width fills the screen's.)
    const box = await pageBox(page, c - 0.3, c + 0.3);
    expect(Math.abs(box.cx - 0.5)).toBeLessThan(0.05);
    const W = await page.evaluate(() => window.__splashery.player.motion.out.view.size[0]);
    expect((box.w * W) / 0.6).toBeGreaterThan(0.85);
    expect((box.w * W) / 0.6).toBeLessThan(1.01);
    // Both pages, chosen in the Toy tab: the whole book again.
    await page.evaluate(() => window.__splashery.app.setToyOption("reading", "both"));
    await waitSheets(page);
    await glided(page, "all");
    expect(await pageNow(page)).toBe(1);
    const cam = await page.evaluate(() => { const c = window.__splashery.player.camera; return [c.tgt.distance, c.home.distance]; }); // prettier-ignore
    expect(Math.abs(cam[0] - cam[1])).toBeLessThan(0.01);
  });
});
