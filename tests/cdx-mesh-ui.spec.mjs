import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { makeSplat, makeSpz, makePly } from "./fixtures.mjs";
import { deflateRawSync } from "node:zlib";

test("source adapters build kit and procedural toys without the renderer", async () => {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  for (const id of ["torus", "soccer-ball", "rubber-duck", "blob"]) {
    const { table, metadata } = await loadSource({ kind: "toy", id }, "phone");
    expect(table.count).toBeGreaterThan(1000);
    expect(table.count).toBeLessThanOrEqual(120000);
    expect(metadata.license).toBe("CC0 1.0");
  }
});

test("worker file adapters read all four supported splat formats", async () => {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  const inputs = [
    ["ball.ply", makePly(2000)],
    ["ball.splat", makeSplat(2000)],
    ["ball.spz", makeSpz(2000)],
    ["ball.sog", fs.readFileSync("tests/fixtures/vwr/ball.sog")],
  ];
  for (const [name, bytes] of inputs) {
    const result = await loadSource({ kind: "file", file: new File([bytes], name) }, "phone");
    expect(result.table.count, name).toBe(2000);
    expect(result.metadata.license).toContain("Source license");
  }
});

test("SOG expansion budgets are checked before ZIP entries are decoded", async () => {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  const bytes = new Uint8Array(fs.readFileSync("tests/fixtures/vwr/ball.sog"));
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      view.setUint32(i + 24, 100000000, true);
      break;
    }
  await expect(
    loadSource({ kind: "file", file: new File([bytes], "large.sog") }, "phone"),
  ).rejects.toThrow(/budget|memory|expand/i);
});

test("ZIP expansion limits measure actual deflated bytes, including dishonest size headers", async () => {
  const { zipStored } = await import("../src/viewers/splat-io.js");
  const { checkZipBudget } = await import("../src/mesh-export/input-budget.js");
  const compressed = new Uint8Array(deflateRawSync(new Uint8Array(4096)));
  const bytes = zipStored([["data", compressed]]),
    view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(8, 8, true);
  view.setUint32(22, 1, true);
  for (let i = 0; i < bytes.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      view.setUint16(i + 10, 8, true);
      view.setUint32(i + 24, 1, true);
      break;
    }
  await expect(Promise.resolve().then(() => checkZipBudget(bytes, 1024))).rejects.toThrow(
    /budget|expand|size/i,
  );
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`Studio converts, previews, cancels, and saves at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForFunction(() => !!window.__splashery?.app);
    await page.evaluate(() => window.__splashery.app.chooseToy("splats-to-mesh"));
    if (
      width < 760 &&
      (await page.locator("#sheet-toggle").getAttribute("aria-expanded")) === "false"
    )
      await page.locator("#sheet-toggle").click();
    await page.locator("#tab-play").click();
    await expect(page.locator("#mesh-panel")).toBeVisible();
    await page.getByText("Density, triangle budget, and attribution", { exact: true }).click();
    await page.locator("#mesh-file").setInputFiles({
      name: "sphere.splat",
      mimeType: "application/octet-stream",
      buffer: makeSplat(2000),
    });
    await page.locator("#mesh-resolution").fill("40");
    await page.locator("#mesh-convert").click();
    await expect(page.locator("#mesh-status")).toContainText("Mesh ready", { timeout: 60000 });
    await expect(page.locator("#mesh-report")).toContainText("triangles");
    await expect(page.locator("#mesh-license")).toContainText("Source license");
    await expect(page.locator("#mesh-preview")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const dl = page.waitForEvent("download");
    await page.locator("#mesh-save").click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/\.glb$/);
    expect((await fs.promises.stat(await download.path())).size).toBeGreaterThan(100);
    await page.locator("#mesh-preview").evaluate((e) => e.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `tests/screenshots/cdx-mesh-${width}x${height}.png` });
    await page.evaluate(() => {
      document.querySelector("#mesh-convert").click();
      document.querySelector("#mesh-cancel").click();
    });
    await expect(page.locator("#mesh-status")).toContainText("Canceled");
    await expect(page.locator("#mesh-save")).toBeDisabled();
    await page.locator("#mesh-file").setInputFiles({
      name: "damaged.ply",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a ply"),
    });
    await page.locator("#mesh-convert").click();
    await expect(page.locator("#mesh-status")).toContainText(/could not|invalid|PLY|header/i);
    expect(errors).toEqual([]);
  });
}
