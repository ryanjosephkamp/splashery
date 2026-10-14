import { test, expect } from "@playwright/test";
import { pixelsToText } from "../src/export/ascii.js";

test.setTimeout(45_000);

// The canvas test only needs a same-origin page that can import the module.
const PAGE = "/";
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
  await page.goto(PAGE);
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
