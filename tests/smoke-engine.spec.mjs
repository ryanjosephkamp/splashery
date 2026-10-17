// Task 101: independent smoke groups can run on separate suite shards.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";
import { TOYS, CATEGORIES, searchToys } from "../src/toys.js";
import { encodeSceneHash } from "../src/codec.js";

import {
  SHOTS,
  ORIGIN,
  WEBGL,
  NO_WEBGPU,
  watchConsole,
  loadApp,
  waitForToy,
  cameraStill,
  countDifferentPixels,
  inkPixels,
} from "./smoke-helpers.mjs";

test.describe("Splashery v3 engine (WebGL2)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("a kit toy loads from its pack, and its action and a tap open and close it", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    await expect(page.locator("#toy-action")).toHaveText("Open or close");
    const canvas = page.locator("#stage");
    const closed = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(2000);
    const open = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, closed, open)).toBeGreaterThan(3000);
    expect((await page.evaluate(() => window.__splashery.exportScene())).motion.controls.open).toBe(
      1,
    );
    // A tap on the toy (Orbit tool) closes it again.
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.exportScene().motion.controls.open))
      .toBe(0);
    expect(problems).toEqual([]);
  });

  test("a kit toy can change shape: the red blood cell curls into a sickle (morph)", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='red-blood-cell']");
    await waitForToy(page, "Red blood cell");
    await expect(page.locator("#toy-action")).toHaveText("Sickle and relax");
    const canvas = page.locator("#stage");
    const disc = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(1600);
    const sickle = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, disc, sickle)).toBeGreaterThan(3000);
    expect(problems).toEqual([]);
  });

  test("toys move by themselves once motion is on, and any toy can bounce", async ({ page }) => {
    const problems = watchConsole(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loadApp(page);
    await page.click(".toy-card[data-toy='campfire']");
    await waitForToy(page, "Campfire");
    // Reduced motion: nothing moves until asked.
    await expect(page.locator("#toy-alive")).not.toBeChecked();
    await page.click("#toy-alive");
    await page.waitForTimeout(600);
    const canvas = page.locator("#stage");
    const a = await canvas.screenshot({ type: "png" });
    await page.waitForTimeout(700);
    const b = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, a, b)).toBeGreaterThan(1500);
    await page.click(".toy-card[data-toy='cactus']");
    await waitForToy(page, "Cactus");
    const still = await canvas.screenshot({ type: "png" });
    await page.click("#toy-move [data-move='bounce']");
    await page.waitForTimeout(250);
    const up = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, still, up)).toBeGreaterThan(1500);
    expect((await page.evaluate(() => window.__splashery.exportScene())).motion.move).toBe(
      "bounce",
    );
    expect(problems).toEqual([]);
  });

  test("patterns and flags recolour any toy and travel in the link", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    const canvas = page.locator("#stage");
    const before = await canvas.screenshot({ type: "png" });
    await page.click("#tab-look");
    await page.selectOption("#pat-id", "flag");
    await page.waitForFunction(() => document.querySelectorAll("#pat-flag option").length > 150);
    await page.selectOption("#pat-flag", "fr");
    await expect(page.locator("#toy-status")).toContainText("in the colors of France");
    await page.waitForTimeout(1000);
    const flagged = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, flagged)).toBeGreaterThan(5000);
    await page.selectOption("#pat-id", "stripes");
    await page.waitForTimeout(800);
    const striped = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, flagged, striped)).toBeGreaterThan(3000);
    await page.selectOption("#pat-id", "flag");
    await page.selectOption("#pat-flag", "jp");
    const link = await page.evaluate(() => window.__splashery.app.copyLink());
    const hash = new URL(link).hash;
    const page2 = await page.context().newPage();
    await page2.goto(`/?renderer=webgl2&profile=weak${hash}`);
    await page2.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page2.locator("#toy-status")).toContainText("in the colors of Japan", {
      timeout: 60_000,
    });
    expect(problems).toEqual([]);
  });

  test("an old version 2 share link still opens", async ({ page }) => {
    const problems = watchConsole(page);
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 2,
      seed: 12,
      toy: { kind: "builtin", id: "donut" },
      effects: { twist: { on: true, amount: 0.4, wobble: 0, axis: "y" } },
      autoplay: { turntable: false, effect: "none" },
    });
    await page.goto(`/?renderer=webgl2&profile=weak#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await waitForToy(page, "Donut");
    const s = await page.evaluate(() => window.__splashery.exportScene());
    expect(s.version).toBe(3);
    expect(s.effects.twist).toMatchObject({ on: true, amount: 0.4 });
    expect(s.pattern.id).toBe("none");
    expect(problems).toEqual([]);
  });

  test("the sound switch remembers its choice", async ({ page }) => {
    await loadApp(page);
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
    await page.click("#sound-toggle");
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("splashery.sound"))).toBe("on");
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  });

  test("a tap plays the toy's own sound, and a toggle plays its on and off halves", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
    await loadApp(page);
    // Record what the app asks the sound engine to play.
    await page.evaluate(() => {
      const s = window.__splashery.app.sound;
      window.__played = [];
      const play = s.play.bind(s);
      s.play = (spec, o) => {
        window.__played.push(JSON.stringify(spec));
        play(spec, o);
      };
    });
    const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    await page.evaluate(() => (window.__played = []));
    await page.click("#toy-action");
    await page.waitForTimeout(300);
    await page.click("#toy-action");
    await page.waitForTimeout(300);
    const played = await page.evaluate(() => window.__played);
    expect(played).toEqual([
      JSON.stringify(TOY_SOUNDS.chest.on),
      JSON.stringify(TOY_SOUNDS.chest.off),
    ]);
    // A toy that only hops plays its own sound too.
    await page.click(".chip[data-category='balls']");
    await page.click(".toy-card[data-toy='basketball']");
    await waitForToy(page, "Basketball");
    await page.evaluate(() => (window.__played = []));
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect
      .poll(() => page.evaluate(() => window.__played))
      .toEqual([JSON.stringify(TOY_SOUNDS.basketball)]);
    // The audio context really ran.
    expect(await page.evaluate(() => window.__splashery.app.sound.ctx?.state)).toBe("running");
    expect(problems).toEqual([]);
  });

  test("a scan rig moves a part of a captured toy: the cat statue turns its head", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='cat-statue']");
    await waitForToy(page, "Cat statue");
    await expect(page.locator("#toy-action")).toHaveText("Look around");
    // No idle turntable, so only the rig moves.
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    const rest = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(450);
    const turned = await canvas.screenshot({ type: "png" });
    // The look takes 2.6 s of the toy's clock, which steps a clamped amount
    // per frame: SwiftShader draws only a few frames a second, so wait on
    // that clock rather than on wall time.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const p = window.__splashery.player;
            return p.time - p.motion.tap.time;
          }),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(3);
    const back = await canvas.screenshot({ type: "png" });
    const moved = await countDifferentPixels(page, rest, turned);
    expect(moved).toBeGreaterThan(1500);
    // Only the head and tail move, and they come back.
    expect(await countDifferentPixels(page, rest, back)).toBeLessThan(moved / 4);
    expect(problems).toEqual([]);
  });

  test("rigs pick splats by colour, run effects and show add-ons; shelf shapes have rigs", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    // Strawberry: the seeds (a color key) pop out and the berry blushes, then settles.
    await page.click(".toy-card[data-toy='strawberry']");
    await waitForToy(page, "Strawberry");
    await cameraStill(page);
    await expect(page.locator("#toy-action")).toHaveText("Pop seeds");
    const rest = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(600);
    const popped = await canvas.screenshot({ type: "png" });
    const moved = await countDifferentPixels(page, rest, popped);
    expect(moved).toBeGreaterThan(3000);
    // It settles back; slow machines take longer than the effect's own few seconds. Fix12: the pulse
    // runs on frame time, and a canvas screenshot takes about 5 s while it plays in a slow browser,
    // so the poll starts once the pulse has run out (a sample taken mid-effect missed the deadline).
    await page.waitForFunction(
      () => {
        const m = window.__splashery.player.motion;
        return m.state[m.recipe.action.key] === 0;
      },
      null,
      { timeout: 60_000 },
    );
    const settled = async () =>
      countDifferentPixels(page, rest, await canvas.screenshot({ type: "png" }));
    await expect
      .poll(settled, { timeout: 15_000, intervals: [3000, 1000] })
      .toBeLessThan(moved / 4);
    // Lantern: a toggle lights a flame add-on; a second tap puts it out.
    await page.click(".toy-card[data-toy='lantern']");
    await waitForToy(page, "Lantern");
    await cameraStill(page);
    expect(await page.evaluate(() => !!window.__splashery.player.stage.toy.addon)).toBe(true);
    const dark = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(1200);
    const lit = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, dark, lit)).toBeGreaterThan(800);
    await page.click("#toy-action");
    await page.waitForTimeout(1500);
    const out = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, dark, out)).toBeLessThan(400);
    // The jelly blob (a procedural shelf shape) splits in three.
    await page.click(".chip[data-category='shapes']");
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    await cameraStill(page);
    await expect(page.locator("#toy-action")).toHaveText("Split");
    const whole = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await page.waitForTimeout(900);
    const split = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, whole, split)).toBeGreaterThan(5000);
    expect(problems).toEqual([]);
  });

  test("the chess set plays the Opera Game, and the laptop types what you type", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    // Chess: a tap starts the game; pieces leave their squares.
    await page.click(".chip[data-category='toys']");
    await page.click(".toy-card[data-toy='chess-set']");
    await waitForToy(page, "Chess set");
    await expect(page.locator("#toy-action")).toHaveText("Play the Opera Game");
    const start = await canvas.screenshot({ type: "png" });
    await page.click("#toy-action");
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.out?.tokens?.length ?? 0))
      .toBe(48);
    await page.waitForTimeout(4000);
    const later = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, start, later)).toBeGreaterThan(800);
    // Any game from PGN: pasted text plays at once...
    await expect(page.locator("#toy-game")).toContainText("Opera Game");
    await page.click("#game-paste");
    await page.fill(
      "#game-text",
      '[White "Fischer, Robert J."]\n[Black "Spassky, Boris V."]\n[Event "World Championship"]\n[Date "1972.07.23"]\n\n1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 1/2-1/2',
    );
    await page.click("#game-play-text");
    await expect(page.locator("#toy-game")).toContainText(
      "Fischer v Spassky, World Championship 1972",
    );
    await expect(page.locator("#toy-action")).toHaveText("Play the game");
    await expect(page.locator("#game-reset")).toBeVisible();
    // ...a file too, and a file that is not a game says why.
    await page.setInputFiles("#game-file", {
      name: "bad.pgn",
      mimeType: "application/x-chess-pgn",
      buffer: Buffer.from("1. e4 e5 2. Qh5 Nc6 3. Qxf7 Kxf7 4. Kxe8"),
    });
    await expect(page.locator("#toy-game .warning")).toContainText("Move 4.Kxe8");
    await page.setInputFiles("#game-file", {
      name: "scholar.pgn",
      mimeType: "application/x-chess-pgn",
      buffer: Buffer.from("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0"),
    });
    await expect(page.locator("#toy-game .warning")).toBeHidden();
    await expect(page.locator("#toy-game")).toContainText("On the board: A game");
    await page.click("#game-reset");
    await expect(page.locator("#toy-action")).toHaveText("Play the Opera Game");
    // Laptop: real keys type onto the screen.
    await page.click(".chip[data-category='objects']");
    await page.click(".toy-card[data-toy='laptop']");
    await waitForToy(page, "Laptop");
    const before = await canvas.screenshot({ type: "png" });
    await canvas.focus();
    await page.keyboard.type("Hi 42");
    await page.waitForTimeout(1500);
    const typed = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, before, typed)).toBeGreaterThan(300);
    // Keys the laptop takes do not trigger shortcuts (4 would pick the Magnet).
    expect(await page.evaluate(() => window.__splashery.app.tool)).toBe("orbit");
    expect(problems).toEqual([]);
  });

  test("a stretchy toy stretches when dragged and springs back; a drag off it orbits", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".chip[data-category='food']");
    await page.click(".toy-card[data-toy='gummy-bear']");
    await waitForToy(page, "Gummy bear");
    await expect(page.locator("#tool-hint")).toContainText("stretch it");
    // No idle turntable, so the camera turns only if a drag turns it.
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    const canvas = page.locator("#stage");
    const box = await canvas.boundingBox();
    const yaw = () => page.evaluate(() => window.__splashery.player.camera.tgt.yaw);
    const yaw0 = await yaw();
    const rest = await canvas.screenshot({ type: "png" });
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height * 0.52;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => window.__splashery.player.driver.grab.held)).toBe(true); // prettier-ignore
    for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + i * 20, y0 - i * 8);
    await expect.poll(() => page.evaluate(() => window.__splashery.player.driver.grab.held)).toBe(true); // prettier-ignore
    await page.waitForTimeout(400);
    const held = await canvas.screenshot({ type: "png" });
    expect(await countDifferentPixels(page, rest, held)).toBeGreaterThan(3000);
    await page.mouse.up();
    // The camera did not turn, and the bear springs back.
    expect(await yaw()).toBeCloseTo(yaw0, 3);
    // The spring-back takes 1.6 s of the toy's clock, which steps a clamped
    // amount per frame: SwiftShader draws only a few frames a second, so
    // wait on that clock rather than on wall time.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const p = window.__splashery.player;
            return p.time - p.driver.grab.releaseAt > 1.7 ? p.driver.grab.on : "springing";
          }),
        { timeout: 30_000 },
      )
      .toBe(false);
    // A drag that starts beside the toy still orbits.
    await page.mouse.move(box.x + 30, box.y + box.height - 60);
    await page.mouse.down();
    await page.waitForFunction(() => window.__splashery.app.gestures.gesture === "orbit");
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(box.x + 30 + i * 25, box.y + box.height - 60);
    await page.mouse.up();
    expect(Math.abs((await yaw()) - yaw0)).toBeGreaterThan(0.1);
    expect(problems).toEqual([]);
  });

  test("every toy's sound renders: audible, not clipping, under five seconds", async ({ page }) => {
    await page.goto("/tools/");
    const bad = await page.evaluate(async () => {
      const { TOY_SOUNDS } = await import("/src/toy-sounds.js");
      const { playSpec, specFor } = await import("/src/voices.js");
      const { masterChain } = await import("/src/sound.js");
      const out = [];
      for (const [id, spec] of Object.entries(TOY_SOUNDS)) {
        for (const on of [true, false]) {
          const half = specFor(spec, on);
          if (!on && half === specFor(spec, true)) continue;
          const rate = 16000;
          const ctx = new OfflineAudioContext(1, rate * 6, rate);
          playSpec(ctx, masterChain(ctx), 0.01, half);
          const d = (await ctx.startRendering()).getChannelData(0);
          let peak = 0;
          let last = 0;
          for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
            if (a > 0.003) last = i;
          }
          if (!(peak > 0.02 && peak < 0.99 && last / rate < 5))
            out.push(`${id}${on ? "" : ":off"} peak ${peak.toFixed(3)} ${(last / rate).toFixed(2)} s`); // prettier-ignore
        }
      }
      return out;
    });
    expect(bad).toEqual([]);
  });

  test("v3 screenshots at 1440x900 and 390x844", async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desk.newPage();
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='chest']");
    await waitForToy(page, "Treasure chest");
    await page.click("#toy-action");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "gb" }));
    await expect(page.locator("#toy-status")).toContainText("United Kingdom");
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(SHOTS, "v3-1440x900.png") });
    expect(problems).toEqual([]);
    await desk.close();
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const p2 = await phone.newPage();
    await loadApp(p2);
    await p2.click(".chip[data-category='weather']");
    await p2.click(".toy-card[data-toy='campfire']");
    await waitForToy(p2, "Campfire");
    await p2.tap("#sheet-toggle");
    await p2.waitForTimeout(1200);
    await p2.screenshot({ path: path.join(SHOTS, "v3-390x844.png") });
    await phone.close();
  });

  test("an embedded kit toy opens when tapped", async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto("/embed/?toy=chest&renderer=webgl2");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const box = await page.locator("#stage").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.scene.motion.controls.open))
      .toBe(1);
    expect(problems).toEqual([]);
  });
});
