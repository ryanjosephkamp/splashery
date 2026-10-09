import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pixelsToText } from "../src/export/ascii.js";
import { buildHandback } from "../docs/audits/ascii-export-prototype/build-handback.mjs";

test.setTimeout(45_000);

const DEMO = "/docs/audits/ascii-export-prototype/";
const image = (width, height, pixel) => ({
  width,
  height,
  data: Uint8ClampedArray.from(
    { length: width * height * 4 },
    (_, i) => pixel[Math.floor(i / 4) % pixel.length][i % 4],
  ),
});
const solid = (r, g, b, a = 255) => image(8, 8, [[r, g, b, a]]);

test("brightness, alpha and fractional area averaging preserve known pixels", () => {
  expect(pixelsToText(solid(17, 17, 17), { columns: 8 }).rows.join("")).toBe(" ".repeat(32));
  expect(pixelsToText(solid(255, 255, 255), { columns: 8 }).rows.join("")).toBe("@".repeat(32));
  expect(pixelsToText(solid(255, 0, 0, 0))).toEqual(pixelsToText(solid(17, 17, 17)));
  const alpha = pixelsToText(solid(255, 0, 0, 128), { columns: 8, background: [0, 0, 255] });
  expect(alpha.colors[0][0]).toBe(0x80007f);
  // A cell spans 1.25 source pixels: 80% black + 20% white = 51.
  const stripe = pixelsToText(
    image(10, 8, [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]),
    { columns: 8, rows: 4, blackPoint: 0, contrast: 1, gamma: 1, palette: " ." },
  );
  expect(stripe.colors[0].slice(0, 4)).toEqual([0x333333, 0x999999, 0x999999, 0x333333]);
  expect(stripe.rows[0].slice(0, 4)).toBe(" .. ");
});

test("grid geometry, portable rows and byte-for-byte repeatability", () => {
  const source = image(8, 16, [
    [23, 45, 98, 255],
    [255, 10, 30, 80],
  ]);
  const original = source.data.slice();
  const frame = pixelsToText(source, { columns: 96, characterAspect: 0.5 });
  expect(frame.rowCount).toBe(96);
  expect(frame.rows.every((row) => row.length === 96 && /^[\x20-\x7e]+$/.test(row))).toBe(true);
  expect(frame.colors.every((row) => row.length === 96)).toBe(true);
  expect(pixelsToText(source, { columns: 96, characterAspect: 0.5 })).toEqual(frame);
  expect(source.data).toEqual(original);
  expect(pixelsToText(source, { columns: 8, rows: 4 }).rowCount).toBe(4);
  expect(pixelsToText(solid(0, 0, 0), { columns: 200, rows: 200 }).rows).toHaveLength(200);
});

test("malformed and unbounded inputs fail before conversion", () => {
  for (const bad of [
    null,
    {},
    { width: 8, height: 8, data: new Float32Array(256) },
    { width: 5000, height: 8, data: new Uint8Array(0) },
    { width: 8, height: 8, data: new Uint8Array(255) },
  ])
    expect(() => pixelsToText(bad)).toThrow(/RGBA/);
  for (const options of [
    { columns: Infinity },
    { columns: "96" },
    { columns: 201 },
    { rows: 0 },
    { rows: NaN },
    { characterAspect: 0 },
    { gamma: 0 },
    { contrast: Infinity },
    { blackPoint: 255 },
    { palette: " \n" },
    { palette: " .🟢" },
    { palette: [" ", "#"] },
    { background: [0, 0, -1] },
  ])
    expect(() => pixelsToText(solid(100, 100, 100), options)).toThrow(/bounded/);
});

test("canvas keeps matching glyph geometry and fits attribution", async ({ page }) => {
  await page.goto(DEMO);
  const result = await page.evaluate(async () => {
    const { pixelsToText, renderTextCanvas } = await import("/src/export/ascii.js");
    const canvas = document.createElement("canvas");
    const frame = pixelsToText(
      { width: 8, height: 8, data: new Uint8ClampedArray(256).fill(255) },
      { columns: 8 },
    );
    const footer = ["Strawberry - Dany Bittel - CC BY 4.0", "https://superspl.at/scene/84df8849"];
    const mono = renderTextCanvas(canvas, frame, { footer });
    const before = canvas.toDataURL();
    const color = renderTextCanvas(canvas, frame, { color: true, footer });
    const changed = before !== canvas.toDataURL();
    const ctx = canvas.getContext("2d");
    const footerWidth = Math.max(...footer.map((line) => ctx.measureText(line).width));
    const rejects = [];
    for (const style of [{ fontSize: Infinity }, { lineHeight: 1 }, { color: true }]) {
      try {
        renderTextCanvas(canvas, { ...frame, colors: [] }, style);
        rejects.push(false);
      } catch {
        rejects.push(true);
      }
    }
    return { mono, color, changed, width: canvas.width, footerWidth, rejects };
  });
  expect(result.mono.characterAspect).toBeCloseTo(result.mono.advance / 12, 10);
  expect(result.color).toEqual(result.mono);
  expect(result.changed).toBe(true);
  expect(result.width).toBeGreaterThanOrEqual(Math.ceil(result.footerWidth) + 16);
  expect(result.rejects).toEqual([true, true, true]);
});

test("demo converts all recorded examples, plays, scrubs, colors and exports", async ({
  page,
  baseURL,
}) => {
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL) && !request.url().startsWith("data:"))
      external.push(request.url());
  });
  await page.goto(DEMO);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const read = () => page.locator("#text").inputValue();
  const first = await read();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(read).not.toBe(first);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  expect(await read()).toBe(first);
  await page.locator("#timeline").focus();
  await page.locator("#timeline").press("Home");
  for (let i = 0; i < 12; i++) await page.locator("#timeline").press("ArrowRight");
  await expect(page.locator("#preview")).toHaveAttribute("data-frame", "12");
  const gray = await page.locator("#preview").evaluate((canvas) => canvas.toDataURL());
  const text = await read();
  await page.getByLabel("Color characters").check();
  expect(await read()).toBe(text);
  expect(await page.locator("#preview").evaluate((canvas) => canvas.toDataURL())).not.toBe(gray);
  await page.getByLabel("Detail", { exact: true }).selectOption("48");
  await expect(page.locator("#status")).toContainText("48 × 24");
  expect((await read()).split("\n").every((row) => row.length === 48)).toBe(true);
  for (const toy of ["orange", "strawberry"]) {
    await page.getByLabel("Example", { exact: true }).selectOption(toy);
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#status")).toContainText(`${toy} · 48 × 24`);
    await expect(page.locator("#gif")).toHaveAttribute("href", `./samples/${toy}/animation.gif`);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save frame sequence" }).click();
    const download = await pending;
    const exported = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    expect(exported.frames).toHaveLength(36);
    expect(
      exported.frames.some((frame) => frame.rows.join("\n") !== exported.frames[0].rows.join("\n")),
    ).toBe(true);
    expect(exported.options.columns).toBe(48);
    if (toy === "strawberry") expect(exported.metadata.credit.license).toBe("CC BY 4.0");
  }
  const pendingText = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save text frame" }).click();
  const textDownload = await pendingText;
  const exportedText = await fs.readFile(await textDownload.path(), "utf8");
  expect(exportedText).toContain("Dany Bittel");
  expect(exportedText).toContain("https://creativecommons.org/licenses/by/4.0/");
  expect(exportedText).toContain("SH removed");
  const pendingPNG = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG frame" }).click();
  const png = await fs.readFile(await (await pendingPNG).path());
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("mobile layout fits and a rapid example switch retains only the chosen clip", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(DEMO);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Example", { exact: true }).selectOption("orange");
  await page.getByLabel("Example", { exact: true }).selectOption("strawberry");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#status")).toContainText("strawberry");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: "docs/audits/ascii-export-prototype/evidence/mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "docs/audits/ascii-export-prototype/evidence/desktop.png",
    fullPage: true,
  });
});

test("single HTML handback converts and exports offline without file dependencies", async ({
  page,
}) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "splashery-ascii-handback-"));
  const file = path.join(directory, "index.html");
  try {
    const result = await buildHandback(file);
    expect(result.bytes).toBeLessThan(8_000_000);
    const unexpected = [];
    page.on("request", (request) => {
      if (request.url() !== pathToFileURL(file).href && !request.url().startsWith("data:"))
        unexpected.push(request.url());
    });
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(file).href);
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Example", { exact: true }).selectOption("strawberry");
    await expect(page.locator("#status")).toContainText("strawberry · 96 × 48");
    await expect(page.locator("#mp4")).toHaveAttribute("href", /^data:video\/mp4;base64,/);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save text frame" }).click();
    const saved = await fs.readFile(await (await pending).path(), "utf8");
    expect(saved).toContain("Dany Bittel");
    expect(unexpected).toEqual([]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
