import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import config from "../playwright.config.mjs";
import {
  choose,
  hiddenSample,
  installCounters,
  settle,
  snapshot,
} from "../tools/lifecycle-probe.mjs";

test.use({
  launchOptions: {
    ...config.use.launchOptions,
    args: [
      ...config.use.launchOptions.args,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

const URL = "/?renderer=webgl2&profile=low&labs=1&adapt=off";

async function ready(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__splashery?.ready);
}

test("JSON saving reports the newest clay edits and paint stamps excluded by the caps", async ({
  page,
}) => {
  await ready(page);
  const expected = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.makeToy({ ...app.generator, count: 10000 });
    player.proc.clay = Array.from({ length: 2400 }, (_, i) => ["e", i / 1000, 0, 0, 0.04]);
    player.scene.toy.clay = player.proc.clay.slice();
    player.scene.paint.stamps = Array.from({ length: 4800 }, (_, i) => [
      i / 1000,
      0,
      0,
      0.1,
      "#e63b2e",
      1,
    ]);
    return {
      clay: player.proc.clay.slice(0, 2000),
      paint: player.scene.paint.stamps.slice(0, 4000),
    };
  });
  const downloaded = page.waitForEvent("download");
  await page.evaluate(() => window.__splashery.app.exportJSON());
  const file = await downloaded;
  const scene = JSON.parse(await fs.readFile(await file.path(), "utf8"));
  expect(scene.toy.clay).toHaveLength(2000);
  expect(scene.paint.stamps).toHaveLength(4000);
  expect(scene.toy.clay).toEqual(expected.clay);
  expect(scene.paint.stamps).toEqual(expected.paint);
  // Removing the save warning makes this fail even though the serialized caps still work.
  await expect(page.locator("#toast")).toContainText("400 clay edits");
  await expect(page.locator("#toast")).toContainText("800 paint stamps");
  await expect(page.locator("#toast")).toContainText("newest");
  await expect(page.locator("#toast")).toContainText("not included");
  expect(
    await page.evaluate(() => [
      window.__splashery.player.proc.clay.length,
      window.__splashery.player.scene.paint.stamps.length,
    ]),
  ).toEqual([2400, 4800]);
  await page.evaluate(() => window.__splashery.app.copyLink());
  await expect(page.locator("#link-note")).toContainText("not included");
  await page.evaluate(() => window.__splashery.app.updateEmbed());
  await expect(page.locator("#embed-note")).toContainText("not included");
  await page.evaluate(async (scene) => {
    await window.__splashery.app.importJSONFile(
      new File([JSON.stringify(scene)], "lifecycle.json", { type: "application/json" }),
    );
  }, scene);
  expect(
    await page.evaluate(() => ({
      clay: window.__splashery.player.proc.clay,
      paint: window.__splashery.player.scene.paint.stamps,
    })),
  ).toEqual(expected);
  await page.evaluate(() => window.__splashery.app.exportJSON());
  await expect(page.locator("#toast")).toHaveText("Scene saved as JSON.");
});
