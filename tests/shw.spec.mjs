// Lane Showcase (docs/handoff/Showcase.md): the reel page, showcase/index.html.
// The playlist loads and names only shelf toys, the measured facts are current,
// every caption fits at phone size, and every scene's toy builds and plays.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { TOYS } from "../src/toys.js";

const PAGE = "/showcase/?record=1&renderer=webgl2&adapt=off";
const playlist = JSON.parse(fs.readFileSync("src/showcase/playlist.json", "utf8"));
const scenes = playlist.chapters.flatMap((c) => c.scenes);

test("the playlist names shelf toys, with words, a card and a length", () => {
  expect(playlist.chapters.length).toBeGreaterThanOrEqual(4);
  const ids = new Set();
  for (const s of scenes) {
    expect(
      TOYS.find((t) => t.id === s.toy),
      s.toy,
    ).toBeTruthy();
    expect(ids.has(s.id), `scene ids are unique: ${s.id}`).toBe(false);
    ids.add(s.id);
    expect(s.what?.length, s.id).toBeGreaterThan(10);
    expect(s.why?.length, s.id).toBeGreaterThan(10);
    expect(s.card, `${s.id} names the review card it was picked from`).toMatch(/^[a-z0-9-]+$/);
    expect(s.secs).toBeGreaterThanOrEqual(3);
    expect(s.secs).toBeLessThanOrEqual(10);
    for (const step of s.steps || [])
      expect(["tap", "fire", "zoom", "turn", "slide"], `${s.id}: ${step.do}`).toContain(step.do);
  }
});

test("the measured facts are current", () => {
  const out = execFileSync("node", ["tools/shw-facts.mjs", "--check"], { encoding: "utf8" });
  expect(out).toContain("current");
});

test("every caption fits at phone size, with the longest numbers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__showcase && document.body.dataset.ready === "true", null, { timeout: 180_000 }); // prettier-ignore
  const bad = await page.evaluate((n) => {
    const box = document.getElementById("shw-caption");
    const out = [];
    for (let i = 0; i < n; i++) {
      window.__showcase.caption(i, { splats: 1_234_000, secs: 12.3, bytes: 23.4e6 });
      if (box.scrollHeight > box.clientHeight + 1) out.push(window.__showcase.SCENES[i].id);
    }
    return out;
  }, scenes.length);
  expect(bad, "captions that overflow at 390×844").toEqual([]);
  // The controls fit on one row, "Open this toy" included.
  const nav = await page.locator(".shw-controls").boundingBox();
  const open = await page.locator("#shw-open").boundingBox();
  expect(open.x + open.width).toBeLessThanOrEqual(nav.x + nav.width + 1);
  expect(open.y).toBeLessThan(nav.y + 30);
});

// Every scene's toy builds, its steps run, and its numbers are finite. Split
// by chapter so each test stays within its time.
for (const ch of playlist.chapters) {
  test(`chapter "${ch.title}": every toy opens and plays`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
    await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 180_000 }); // prettier-ignore
    for (const s of ch.scenes) {
      const i = await page.evaluate((id) => window.__reel.scenes.indexOf(id), s.id);
      await page.evaluate((i) => window.__reel.go(i), i);
      await page.waitForFunction(
        (i) => window.__reel.state().index === i && window.__reel.state().loaded,
        i,
        { timeout: 180_000 },
      );
      const info = await page.evaluate(() => ({
        toy: window.__showcase.player.toyInfo?.id,
        splats: window.__showcase.player.toyInfo?.splats,
        fact: document.getElementById("shw-fact").textContent,
        open: document.getElementById("shw-open").href,
      }));
      expect(info.toy, s.id).toBe(s.toy);
      expect(info.splats, s.id).toBeGreaterThan(1000);
      expect(info.fact, s.id).toMatch(/splats in \d+\.\d s/);
      // Play the scene's first two seconds of steps, a few frames at a time.
      for (let k = 0; k < 8; k++) await page.evaluate(() => window.__reel.frame(0.25));
      const t = await page.evaluate(() => window.__reel.state().t);
      expect(t, s.id).toBeGreaterThan(1.9);
      const open = await page.evaluate(() => document.getElementById("shw-open").href);
      expect(open, `${s.id}: Open this toy links to its scene`).toContain("#s=");
    }
    expect(errors).toEqual([]);
  });
}

test("Open this toy opens the same toy in the app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__reel?.state().loaded, null, { timeout: 180_000 });
  await page.waitForFunction(() => document.getElementById("shw-open").href.includes("#s="));
  const href = await page.evaluate(() => document.getElementById("shw-open").href);
  const url = new URL(href);
  await page.goto(`/${url.search}&renderer=webgl2&adapt=off${url.hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const id = await page.evaluate(() => window.__splashery.player.scene.toy.id);
  expect(id).toBe(scenes[0].toy);
});

test("the controls: pause holds the scene, next and the chapter list move on", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/showcase/?renderer=webgl2&adapt=off");
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 180_000 }); // prettier-ignore
  await expect(page.locator("#shw-intro")).toBeVisible();
  await page.click("#shw-start");
  await expect(page.locator("#shw-intro")).toBeHidden();
  await expect(page.locator("#shw-play")).toHaveAttribute("aria-label", "Pause");
  await page.click("#shw-play");
  await expect(page.locator("#shw-play")).toHaveAttribute("aria-label", "Play");
  const t1 = await page.evaluate(() => window.__showcase.state.t);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__showcase.state.t)).toBe(t1);
  await page.click("#shw-next");
  await page.waitForFunction(() => window.__showcase.state.index === 1);
  await page.click("#shw-chapters");
  await expect(page.locator("#shw-list")).toBeVisible();
  const last = scenes.length - 1;
  await page.click(`#shw-list button[data-index="${last}"]`);
  await page.waitForFunction((n) => window.__showcase.state.index === n, last);
  await expect(page.locator("#shw-list")).toBeHidden();
  await expect(page.locator("#shw-name")).toHaveText(
    TOYS.find((t) => t.id === scenes[last].toy).label,
  );
});
