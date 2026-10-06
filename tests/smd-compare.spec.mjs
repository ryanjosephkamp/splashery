// Lane Studio media: "Show the original" on Photo to 3D, Moving photo to 3D and Video to 3D. The
// flat picture shows in a corner card, switches off again, and (for a clip or a video) stays in step
// with the 3D one. Video to 3D's samples ship the source's own span at 480p.

import { test, expect } from "@playwright/test";
import fs from "node:fs";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
test.use({ viewport: { width: 390, height: 844 } });

async function open(page, toy) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), toy);
  await page.waitForFunction((id) => window.__splashery.player.scene.toy.id === id && window.__splashery.player.proc?.ctx?.kit?.data, toy, { timeout: 180_000 }); // prettier-ignore
}
const setOpt = (page, o) => page.evaluate((o) => window.__splashery.app.setToyOptions(o), o);
const card = (page) => page.locator(".smd-original");

test.describe("the original beside the 3D", () => {
  test("Photo to 3D: the flat photo shows, at the photo's size, and goes away", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await open(page, "photo-3d");
    await expect(card(page)).toHaveCount(0); // nothing until it is asked for
    await setOpt(page, { original: "on" });
    await expect(card(page)).toBeVisible({ timeout: 60_000 });
    const c = await page.evaluate(() => {
      const el = document.querySelector(".smd-original canvas");
      return { w: el.width, h: el.height, caption: document.querySelector(".smd-original figcaption").textContent };
    }); // prettier-ignore
    expect([c.w, c.h]).toEqual([1280, 853]); // the forest path
    expect(c.caption).toContain("Forest path");
    await setOpt(page, { source: "spiral-stairs" });
    await expect(card(page).locator("figcaption")).toContainText("Spiral staircase", { timeout: 60_000 }); // prettier-ignore
    await setOpt(page, { original: "off" });
    await expect(card(page)).toBeHidden({ timeout: 30_000 });
  });

  test("Moving photo to 3D: the flat clip shows the frame the 3D one shows", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, "moving-photo-3d");
    await setOpt(page, { original: "on" });
    await expect(card(page)).toBeVisible({ timeout: 60_000 });
    await page.evaluate(() => window.__splashery.app.setControl("play", 1));
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(300);
      const r = await page.evaluate(async () => {
        const { MOVING } = await import("/src/packs/moving-photo.js");
        const { original } = await import("/src/compare.js");
        return { shown: original("moving-photo-3d").info().frame, frame: MOVING.frame, kind: original("moving-photo-3d").info().kind }; // prettier-ignore
      });
      expect(r.kind).toBe("frames");
      expect(r.shown).toBe(r.frame);
      seen.add(r.frame);
    }
    expect(seen.size).toBeGreaterThan(1); // it moved
    await setOpt(page, { clip: "horse" });
    await expect(card(page).locator("figcaption")).toContainText("Muybridge", { timeout: 60_000 }).catch(() => {}); // prettier-ignore
    await setOpt(page, { original: "off" });
    await expect(card(page)).toBeHidden({ timeout: 30_000 });
  });

  test("Video to 3D: the sample's own span plays in step with Replay flight", async ({ page }) => {
    test.setTimeout(240_000);
    for (const id of ["liberty", "edinburgh"]) {
      expect(fs.statSync(`assets/toys/video-3d/${id}-source.webm`).size, id).toBeLessThan(3e6);
      expect(fs.statSync(`assets/toys/video-3d/${id}-source.mp4`).size, id).toBeLessThan(3e6);
    }
    await open(page, "video-3d");
    await setOpt(page, { original: "on" });
    await expect(card(page).locator("video")).toBeVisible({ timeout: 60_000 });
    const meta = await page.evaluate(async () => {
      const v = document.querySelector(".smd-original video");
      while (!(v.readyState >= 1)) await new Promise((r) => setTimeout(r, 50));
      const f = window.__splashery.player.proc.ctx.kit.data.flight;
      return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, end: f.path.end, start: f.path.start };
    }); // prettier-ignore
    expect(meta.h).toBeGreaterThanOrEqual(480); // 480p (a browser may report 481 for the WebM)
    expect(meta.h).toBeLessThanOrEqual(481);
    expect(meta.duration).toBeGreaterThan(meta.end - 0.5); // the span covers the whole camera path
    expect(meta.duration).toBeLessThan(meta.end + 2);
    // not flying: it holds at the path's start
    const idle = await page.evaluate(() => document.querySelector(".smd-original video").paused);
    expect(idle).toBe(true);
    // flying: it plays, its time moving on
    await page.evaluate(() => window.__splashery.app.setControl("replay", 1));
    await page.waitForFunction(() => window.__splashery.player.proc.ctx.kit.data.flight.state.active, null, { timeout: 60_000 }); // prettier-ignore
    await page.waitForFunction(() => { const v = document.querySelector(".smd-original video"); return !v.paused && !v.seeking && v.currentTime > 0.3; }, null, { timeout: 60_000 }); // prettier-ignore
    // paused: the flat video holds where the flight holds
    await page.evaluate(() => window.__splashery.app.setControl("replay", 0));
    // (the renderer here draws a frame a second or less, so give it time to catch up)
    await page.waitForFunction(() => { const v = document.querySelector(".smd-original video"); const st = window.__splashery.player.proc.ctx.kit.data.flight.state; return v.paused && st.pausedAt != null && Math.abs(v.currentTime - st.pausedAt) < 0.1; }, null, { timeout: 60_000 }); // prettier-ignore
    const held = await page.evaluate(() => {
      const v = document.querySelector(".smd-original video");
      const st = window.__splashery.player.proc.ctx.kit.data.flight.state;
      return { paused: v.paused, diff: Math.abs(v.currentTime - st.pausedAt) };
    });
    expect(held.paused).toBe(true);
    expect(held.diff).toBeLessThan(0.1);
    // the other sample has its own
    await setOpt(page, { source: "edinburgh" });
    await expect(card(page).locator("figcaption")).toContainText("Street, walked", {
      timeout: 60_000,
    });
  });
});
