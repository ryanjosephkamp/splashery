import { test, expect } from "@playwright/test";
import { buildRoom } from "../src/walk/rooms.js";
import { transform } from "../src/walk/geometry.js";
import { tableFromBuffer } from "../src/walk/io.js";
import { writeSplatFile } from "../src/viewers/splat-io.js";

test("editing settings and interrupted sessions stop held keys and tap walking", async ({
  page,
}) => {
  await page.goto("/?renderer=none");
  const result = await page.evaluate(async () => {
    const { WalkControls } = await import("/src/walk/controls.js");
    const canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    const stick = document.createElement("div");
    stick.append(document.createElement("span"));
    const input = document.createElement("input");
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Settings";
    details.append(summary);
    document.body.append(canvas, stick, input, details);
    let target = true;
    const controls = new WalkControls(canvas, stick, {
      onStop: () => {
        target = false;
      },
    });
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
    const held = controls.read().y;
    target = true;
    input.focus();
    const focused = { movement: controls.read().y, target };
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
    target = true;
    summary.focus();
    const settings = { movement: controls.read().y, target };
    target = true;
    window.dispatchEvent(new Event("blur"));
    const blurred = { movement: controls.read().y, target };
    target = true;
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    const hidden = { movement: controls.read().y, target };
    delete document.hidden;
    controls.destroy();
    return { held, focused, settings, blurred, hidden };
  });
  expect(result.held).toBe(1);
  for (const state of [result.focused, result.settings, result.blurred, result.hidden])
    expect(state).toEqual({ movement: 0, target: false });
});

test("a private PLY opens locally, can be rescaled/leveled, and makes no upload request", async ({
  page,
}) => {
  const source = transform(buildRoom("gallery").buffer, [1, 0, 0, 0], 1);
  const bytes = await writeSplatFile(tableFromBuffer(source), "ply");
  const requests = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") requests.push(r.method() + " " + r.url());
  });
  const scene = Buffer.from(
    JSON.stringify({ app: "splashery", version: 3, toy: { kind: "builtin", id: "walk-inside" } }),
  ).toString("base64url");
  await page.goto(`/?labs=1&renderer=webgl2&profile=low#s=j.${scene}`);
  await page.waitForFunction(() => globalThis.__splashery?.player?.toyInfo?.id === "walk-inside");
  await page.evaluate(() => globalThis.__splashery.app.act());
  await page.waitForFunction(() => document.querySelector("#walk-dialog")?.walk?.body);
  await page.locator("#walk-file").setInputFiles({
    name: "private-place.ply",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(bytes),
  });
  await expect(page.locator("#walk-place")).toHaveValue("custom");
  expect(await page.evaluate(() => document.querySelector("#walk-dialog").walk.result.count)).toBe(
    source.count,
  );
  const width = await page.evaluate(() => {
    const g = document.querySelector("#walk-dialog").walk.grid;
    return g.dims[0] * g.cell;
  });
  await page.locator("#walk-settings summary").click();
  await page.locator("#walk-meters").fill("0.8");
  await page.locator("#walk-auto-level").uncheck();
  await page.locator("#walk-pitch").fill("8");
  await page.locator("#walk-level").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = document.querySelector("#walk-dialog").walk.grid;
        return g.dims[0] * g.cell;
      }),
    )
    .toBeLessThan(width * 0.9);
  const result = await page.evaluate(() => {
    const w = document.querySelector("#walk-dialog").walk;
    return {
      slope: w.result.floor.normal[2],
      clear: w.grid.clear(w.body.pos),
      name: w.place.selectedOptions[0].textContent,
    };
  });
  expect(Math.abs(result.slope)).toBeGreaterThan(0.1);
  expect(result.clear).toBe(true);
  expect(result.name).toBe("private-place.ply");
  expect(requests).toEqual([]);
  await page.locator("#walk-meters").fill("100");
  await page.locator("#walk-level").click();
  await expect(page.locator("#walk-status")).toContainText("too large");
  const status = await page.locator("#walk-status").boundingBox();
  const settings = await page.locator("#walk-settings").boundingBox();
  expect(status.y + status.height).toBeLessThanOrEqual(settings.y);
  await page.locator("#walk-close").click();
});
