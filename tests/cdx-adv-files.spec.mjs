// Task 84 follow-up: a recipient can supply a local file or keep the sample.
import { test, expect } from "@playwright/test";
import { encodeSceneHash } from "../src/codec.js";
import fs from "node:fs/promises";

const APP = "/?labs=1&renderer=webgl2&profile=mid&adapt=off";
const errors = new WeakMap();
test.beforeEach(({ page }) => {
  const seen = [];
  errors.set(page, seen);
  page.on("pageerror", (error) => seen.push(error.message));
  page.on("console", (message) => message.type() === "error" && seen.push(message.text()));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
const routes = [
  { id: "photo-3d", source: "source", name: "photoName", fixture: "tests/fixtures/p3d/scene.jpg" },
  {
    id: "moving-photo-3d",
    source: "clip",
    name: "clipName",
    fixture: "tests/fixtures/psv3/silent.webm",
  },
];
const saved = (r, version = 3, local = true) => ({
  version,
  seed: 1,
  toy: {
    kind: "builtin",
    id: r.id,
    options: local ? { [r.source]: "custom", [r.name]: "A shared <file> & its name" } : {},
  },
  autoplay: { turntable: false },
});

async function ready(page, id) {
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.waitForFunction((id) => {
    const { app, player } = window.__splashery;
    return !app.busy && !player.loading && player.toyInfo?.id === id;
  }, id);
}

for (const r of routes) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`${r.id}: recipient notice at ${viewport.width} names the file and offers keyboard actions`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const requests = [];
      page.on("request", (request) =>
        requests.push({ url: request.url(), method: request.method() }),
      );
      await page.goto(`${APP}#s=${await encodeSceneHash(saved(r))}`);
      await ready(page, r.id);
      const notice = page.getByRole("region", { name: "Open the shared file" });
      await expect(notice).toBeVisible({ timeout: 3000 });
      await expect(notice).toContainText("A shared <file> & its name");
      await expect(notice).toContainText("stays on the sender's device");
      await expect(notice.getByRole("status")).toContainText("Open the same file");
      await test.info().attach("notice-accessibility-tree", {
        body: await notice.ariaSnapshot(),
        contentType: "text/plain",
      });
      const box = await notice.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThan(viewport.height);
      const dial = await page.locator("#stage-dial").boundingBox();
      if (dial) {
        const width = Math.max(
          0,
          Math.min(box.x + box.width, dial.x + dial.width) - Math.max(box.x, dial.x),
        );
        const height = Math.max(
          0,
          Math.min(box.y + box.height, dial.y + dial.height) - Math.max(box.y, dial.y),
        );
        expect(width * height, "the depth slider must not overlap the notice").toBe(0);
      }
      await page.screenshot({
        path: test.info().outputPath(`${r.id}-${viewport.width}x${viewport.height}.png`),
      });

      const open = notice.getByRole("button", { name: "Open the file", exact: true });
      await open.focus();
      const picker = page.waitForEvent("filechooser");
      await page.keyboard.press("Enter");
      expect((await picker).isMultiple()).toBe(false);
      // Canceling the picker leaves the notice and the working sample available.
      await (await picker).setFiles([]);
      await expect(notice).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(notice.getByRole("button", { name: "Keep the sample" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(notice).toBeHidden();
      await expect(page.locator("#stage")).toBeFocused();
      await page.evaluate(() => window.__splashery.app.setToyOptions({ depth: 0.55 }));
      await expect(notice).toBeHidden();
      expect(requests.every((request) => request.method === "GET")).toBe(true);
      expect(requests.some((request) => request.url.includes("shared%20%3Cfile%3E"))).toBe(false);
    });
  }

  test(`${r.id}: a recipient opens the file through the notice and retains the scene settings`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.goto(`${APP}#s=${await encodeSceneHash(saved(r))}`);
    await ready(page, r.id);
    const notice = page.getByRole("region", { name: "Open the shared file" });
    await expect(notice).toBeVisible();
    const picker = page.waitForEvent("filechooser");
    await notice.getByRole("button", { name: "Open the file", exact: true }).click();
    // Saved names keep their case, including when the picked file uses capitals.
    await (
      await picker
    ).setFiles({
      name: r.fixture.split("/").at(-1).toUpperCase(),
      mimeType: r.id === "photo-3d" ? "image/jpeg" : "video/webm",
      buffer: await fs.readFile(r.fixture),
    });
    await expect(notice).toBeHidden({ timeout: 180_000 });
    const scene = await page.evaluate(() => window.__splashery.app.exportScene());
    expect(scene.toy.id).toBe(r.id);
    expect(scene.toy.options[r.source]).toBe("custom");
    expect(scene.toy.options[r.name]).toBe(
      r.fixture
        .split("/")
        .at(-1)
        .toUpperCase()
        .replace(/\.[^.]+$/, ""),
    );
    // Loading the same saved scene in this page keeps the already-open local file.
    await page.evaluate(
      (scene) =>
        window.__splashery.app.importJSONFile(
          new File([JSON.stringify(scene)], "same-scene.json", { type: "application/json" }),
        ),
      scene,
    );
    await expect(notice).toBeHidden();
    // An already-open, different local file cannot stand in for the sender's file.
    await page.evaluate(
      (scene) =>
        window.__splashery.app.importJSONFile(
          new File([JSON.stringify(scene)], "other-file-scene.json", { type: "application/json" }),
        ),
      saved(r),
    );
    await expect(notice).toBeVisible({ timeout: 3000 });
    const showingCustom = await page.evaluate(async (id) => {
      if (id === "photo-3d") return window.__splashery.player.proc.ctx.kit.data.photo.custom;
      const { MOVING } = await import("/src/packs/moving-photo.js");
      return MOVING.clip === MOVING.custom;
    }, r.id);
    expect(showingCustom).toBe(false);
  });

  test(`${r.id}: a picker error stays visible in the notice with the controls folded`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}#s=${await encodeSceneHash(saved(r))}`);
    await ready(page, r.id);
    const notice = page.getByRole("region", { name: "Open the shared file" });
    const picker = page.waitForEvent("filechooser");
    await notice.getByRole("button", { name: "Open the file", exact: true }).click();
    await (
      await picker
    ).setFiles({
      name: r.id === "photo-3d" ? "damaged.jpg" : "damaged.webm",
      mimeType: r.id === "photo-3d" ? "image/jpeg" : "video/webm",
      buffer: Buffer.from("This is not a photo or a video."),
    });
    await expect(notice.getByRole("alert")).toBeVisible({ timeout: 3000 });
    await expect(notice.getByRole("alert")).not.toBeEmpty();
    await expect(notice.getByRole("button", { name: "Open the file", exact: true })).toBeEnabled();
    await notice.getByRole("button", { name: "Keep the sample" }).click();
    await expect(notice).toBeHidden();
  });

  test(`${r.id}: v2 and v3 scene files and old links retain their loading behavior`, async ({
    page,
  }) => {
    await page.goto(`${APP}#s=${await encodeSceneHash(saved(r, 2, false))}`);
    await ready(page, r.id);
    const notice = page.getByRole("region", { name: "Open the shared file" });
    await expect(notice).toBeHidden();
    // Choosing the empty custom slot yourself has no sender or named missing file.
    await page.evaluate(
      ({ source, name }) =>
        window.__splashery.app.setToyOptions({ [source]: "custom", [name]: "" }),
      r,
    );
    await expect(notice).toBeHidden({ timeout: 3000 });
    for (const version of [2, 3]) {
      await page.evaluate(
        (scene) =>
          window.__splashery.app.importJSONFile(
            new File([JSON.stringify(scene)], "sample-scene.json", { type: "application/json" }),
          ),
        saved(r, version, false),
      );
      await expect(notice).toBeHidden();
      expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe(r.id);
    }
    await page.evaluate(
      (scene) =>
        window.__splashery.app.importJSONFile(
          new File([JSON.stringify(scene)], "local-scene.json", { type: "application/json" }),
        ),
      saved(r),
    );
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Keep the sample" }).click();
    await page.evaluate(
      (scene) =>
        window.__splashery.app.importJSONFile(
          new File([JSON.stringify(scene)], "local-scene.json", { type: "application/json" }),
        ),
      saved(r),
    );
    await expect(notice).toBeVisible();
  });
}
