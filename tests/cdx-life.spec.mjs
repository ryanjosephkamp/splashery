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
  for (const [method, selector] of [
    ["copyLink", "#link-note"],
    ["updateEmbed", "#embed-note"],
  ]) {
    await page.evaluate(async (method) => {
      const { app, player } = window.__splashery;
      const clay = player.proc.clay,
        paint = player.scene.paint.stamps;
      const pending = app[method]();
      player.proc.clay = [];
      player.scene.toy.clay = [];
      player.scene.paint.stamps = [];
      await pending;
      player.proc.clay = clay;
      player.scene.toy.clay = clay.slice();
      player.scene.paint.stamps = paint;
    }, method);
    await expect(page.locator(selector)).toContainText("400 clay edits");
    await expect(page.locator(selector)).toContainText("800 paint stamps");
  }
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

test("generator sliders have the correct values when Make first opens before the toy loads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/toys/cactus/**", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.__splashery?.app.ui);
    await page.locator("#sheet-toggle").click();
    await page.locator("#tab-make").click();
    await expect(page.locator("#gen-count")).toBeVisible();
    // Hold the asset, not a guessed timeout: late onToy initialization cannot mask the flash.
    expect(await page.evaluate(() => window.__splashery.ready)).toBe(false);
    expect(
      await page
        .locator("#pane-make input[type=range]")
        .evaluateAll((inputs) => inputs.map((e) => e.value)),
    ).toEqual(["60000", "35", "30", "25"]);
    await expect(page.locator("#gen-count-value")).toHaveText("60k");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("saving a new toy while it loads does not report the previous toy's discarded clay as capped", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.makeToy({ ...app.generator, count: 10000 });
    player.proc.clay = Array.from({ length: 2400 }, () => ["e", 0, 0, 0, 0.04]);
    player.scene.toy.clay = player.proc.clay.slice();
  });
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/toys/cactus/**", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.evaluate(() => {
      window.__lifeSwitch = window.__splashery.app.chooseToy("cactus");
    });
    await page.waitForFunction(
      () =>
        window.__splashery.player.scene.toy.id === "cactus" &&
        window.__splashery.player.proc?.clay.length === 2400,
    );
    const downloaded = page.waitForEvent("download");
    await page.evaluate(() => window.__splashery.app.exportJSON());
    const file = await downloaded;
    const scene = JSON.parse(await fs.readFile(await file.path(), "utf8"));
    expect(scene.toy).toEqual({ kind: "builtin", id: "cactus" });
    expect(await page.locator("#toast").textContent()).toBe("Scene saved as JSON.");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await page.evaluate(async () => {
      await window.__lifeSwitch;
      delete window.__lifeSwitch;
    });
  }
});

test("Sound lab stops polling its controls while hidden and still cleans up on a toy switch", async ({
  page,
}) => {
  await page.addInitScript(installCounters);
  await ready(page);
  await choose(page, "sound-lab");
  await settle(page);
  const hidden = await hiddenSample(page);
  const site = Object.keys(hidden.after.totals).find((s) => s.includes("/packs/sound-lab.js"));
  expect(site).toBeTruthy();
  expect(
    hidden.after.totals[site].hiddenCalls - hidden.before.totals[site].hiddenCalls,
  ).toBeGreaterThan(0);
  // Unconditional sync() writes the real tone, metronome, and note DOM on every hidden tick.
  expect(
    hidden.after.totals[site].hiddenMutations - hidden.before.totals[site].hiddenMutations,
  ).toBe(0);
  await page.locator("#sll-tone").dispatchEvent("click");
  await expect(page.locator("#sll-tone")).toHaveText("Stop the tone");
  await choose(page, "basketball");
  await settle(page);
  expect(
    Object.keys((await snapshot(page)).intervals).some((s) => s.includes("/packs/sound-lab.js")),
  ).toBe(false);
});

test.describe("live controls with Chromium's fake microphone", () => {
  test("live input keeps its source running without refreshing hidden controls", async ({
    page,
  }) => {
    await page.addInitScript(installCounters);
    await ready(page);
    await choose(page, "sound-lab");
    await page.locator("#live-mic").dispatchEvent("click");
    await expect(page.locator("#live-mic")).toHaveAttribute("aria-pressed", "true");
    const hidden = await hiddenSample(page);
    const site = Object.keys(hidden.after.totals).find((s) => s.includes("/live/panel.js"));
    expect(site).toBeTruthy();
    expect(
      hidden.after.totals[site].hiddenCalls - hidden.before.totals[site].hiddenCalls,
    ).toBeGreaterThan(0);
    expect(
      hidden.after.totals[site].hiddenMutations - hidden.before.totals[site].hiddenMutations,
    ).toBe(0);
    await expect(page.locator("#live-mic")).toHaveAttribute("aria-pressed", "true");
    await choose(page, "basketball");
    await settle(page);
    expect(
      Object.keys((await snapshot(page)).intervals).some((s) => s.includes("/live/panel.js")),
    ).toBe(false);
  });
});
