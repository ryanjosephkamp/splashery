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

test.describe("Settings panel (WebGL2)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("the Toy tab has the essentials, and Reset everything takes a toy back to how it started", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    // The main tab: Detail, the turntable switch and flag colors.
    const toy = page.locator("#pane-play");
    await expect(toy).toBeVisible();
    await expect(toy.locator("#look-detail")).toBeVisible();
    await expect(toy.locator("#auto-turntable")).toHaveAttribute("role", "switch");
    await expect(page.locator("#tab-play")).toHaveText("Toy");
    // Change things: flag colors, an effect, the speed and the splat size.
    await page.waitForFunction(() => document.querySelectorAll("#toy-flag option").length > 150);
    await page.selectOption("#toy-flag", "fr");
    await expect(page.locator("#toy-status")).toContainText("in the colors of France");
    await page.click("#tab-tools");
    await page.click("#fx-twist");
    await expect(page.locator("#fx-twist")).toBeChecked();
    await page.evaluate(() => {
      const app = window.__splashery.app;
      app.setMotion({ speed: 0.9 });
      app.setLook({ splatScale: 1.6 });
    });
    // Reset everything asks for a second tap, then puts it all back.
    await page.click("#tab-play");
    await page.click("#reset-all");
    await expect(page.locator("#reset-all")).toHaveText("Tap again to reset");
    await page.click("#reset-all");
    await expect(page.locator("#toy-status")).not.toContainText("colors of");
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.pattern.id).toBe("none");
    expect(scene.effects.twist.on).toBe(false);
    expect(scene.motion.speed).toBeCloseTo(0.5, 5);
    expect(scene.look.splatScale).toBeCloseTo(1, 5);
    expect(scene.toy).toEqual({ kind: "builtin", id: "blob" });
    await expect(page.locator("#reset-all")).toHaveText("Reset everything");
    expect(problems).toEqual([]);
  });

  test("the panel and the shelf can be made bigger on a wide screen", async ({ page }) => {
    await loadApp(page);
    const cssPx = (name) =>
      page.evaluate((n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)), name); // prettier-ignore
    const columns = () =>
      page.evaluate(() => getComputedStyle(document.getElementById("shelf")).gridTemplateColumns.split(" ").length); // prettier-ignore
    expect(await cssPx("--panel-w")).toBe(344);
    const narrowCols = await columns();
    // Drag the panel's left edge 200 px to the left.
    const g = await page.locator(".grip-panel").boundingBox();
    await page.mouse.move(g.x + 4, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x - 196, g.y + g.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(await cssPx("--panel-w")).toBeGreaterThan(520);
    expect(await columns()).toBeGreaterThan(narrowCols);
    // Double-click the grip under the shelf for a tall shelf; keys move it too.
    await page.dblclick(".grip-shelf");
    expect(await cssPx("--shelf-h")).toBe(460);
    await page.focus(".grip-shelf");
    await page.keyboard.press("ArrowUp");
    expect(await cssPx("--shelf-h")).toBe(436);
    // The sizes stay after a reload.
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await cssPx("--panel-w")).toBeGreaterThan(520);
    expect(await cssPx("--shelf-h")).toBe(436);
  });

  test("flag colours lie gently over the chess board, and stay with the toy they were chosen on", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    const pattern = () => page.evaluate(() => window.__splashery.player.scene.pattern);
    // A flag picked on another toy: wrapped round it at full strength.
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "fr" }));
    expect(await pattern()).toMatchObject({ projection: "wrap", amount: 1 });
    // Flags stay with their toy (lane Viewer): the chess set comes out plain.
    await page.click(".chip[data-category='toys']");
    await page.click(".toy-card[data-toy='chess-set']");
    await waitForToy(page, "Chess set");
    await expect.poll(pattern).toMatchObject({ id: "none" });
    // Picked on the chess set, it lays on from above at 30%, keeping its squares.
    await page.evaluate(() => window.__splashery.app.setPattern({ id: "flag", flag: "fr" }));
    await expect.poll(pattern).toMatchObject({ projection: "top", amount: 0.3, detail: 1 });
    await expect(page.locator("#toy-status")).toContainText("in the colors of France");
    // The blob gets its own flag back, the usual way.
    await page.click(".chip[data-category='all']");
    await page.click(".toy-card[data-toy='blob']");
    await waitForToy(page, "Jelly blob");
    await expect.poll(pattern).toMatchObject({ projection: "wrap", amount: 1, id: "flag" });
    expect(problems).toEqual([]);
  });

  test("the chess game bar plays, pauses, steps and jumps, and a tap after the end starts again", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await page.click(".chip[data-category='toys']");
    await page.click(".toy-card[data-toy='chess-set']");
    await waitForToy(page, "Chess set");
    const bar = page.locator("#game-bar");
    await expect(bar).toBeVisible();
    await expect(page.locator("#game-bar-title")).toContainText("Opera Game");
    await expect(page.locator("#game-bar-info")).toContainText("1858");
    const state = () => page.evaluate(() => window.__splashery.player.toyInfo.recipe.game.state());
    const played = async () => (await state()).played;
    // Step on two moves and back one; each step slides one piece.
    await page.click("#game-next");
    await expect.poll(played, { timeout: 30_000 }).toBe(1);
    await page.click("#game-next");
    await expect.poll(played, { timeout: 30_000 }).toBe(2);
    await page.click("#game-back");
    await expect.poll(played, { timeout: 30_000 }).toBe(1);
    // Play, then pause: the game stays where it is.
    await page.click("#game-play");
    await expect.poll(played, { timeout: 60_000 }).toBeGreaterThan(1);
    await page.click("#game-play");
    const paused = await played();
    await page.waitForTimeout(2500);
    expect(await played()).toBeLessThanOrEqual(paused + 1);
    // To the end, then back to the start.
    await page.click("#game-end");
    await expect.poll(async () => (await state()).over, { timeout: 30_000 }).toBe(true);
    await expect(page.locator("#game-bar-move")).toContainText("Game over after 17 moves");
    await page.click("#game-start");
    await expect.poll(played, { timeout: 30_000 }).toBe(0);
    // A finished game that is still playing starts again from a tap on the board.
    await page.click("#game-end");
    await expect.poll(async () => (await state()).over, { timeout: 30_000 }).toBe(true);
    await page.evaluate(() => window.__splashery.app.setControl("play", 1));
    const board = await page.locator("#stage").boundingBox();
    await page.mouse.click(board.x + board.width / 2, board.y + board.height / 2);
    await expect.poll(async () => (await state()).over, { timeout: 30_000 }).toBe(false);
    // The game's details can be edited; the title follows them.
    await page.click(".game-details summary");
    await page.fill("#game-tag-event", "Friendly game");
    await page.press("#game-tag-event", "Enter");
    await page.locator("#game-tag-site").focus();
    await expect(page.locator("#game-bar-title")).toContainText("Friendly game");
    // Another toy puts the bar away.
    await page.click(".chip[data-category='objects']");
    await page.click(".toy-card[data-toy='laptop']");
    await waitForToy(page, "Laptop");
    await expect(bar).toBeHidden();
    expect(problems).toEqual([]);
  });
});
