import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { PNG } from "pngjs";
import { openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";

for (const profile of ["phone", "desktop"]) {
  test(`${profile}: a changing native border keeps its cut-cell support`, async ({ browser }) => {
    test.setTimeout(180000);
    const page = await browser.newPage(
      profile === "phone"
        ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    );
    try {
      await openRender(page, {
        id: "sample-long",
        tier: profile === "phone" ? "low" : "mid",
        stepped: true,
      });
      const frame = await renderFrame(page, 14.88525, { verifyDepth: true });
      expect(frame.depthPixelsVerified).toBe(true);
      expect(frame.holes).toBe(0);
      expect(frame.edgeSpecks).toBe(0);
    } finally {
      await page.close();
    }
  });

  test(`${profile}: removing faces without raster samples leaves identical pixels`, async ({
    browser,
  }) => {
    test.setTimeout(600000);
    const config =
      profile === "phone"
        ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
    const helper = await fs.readFile("src/packs/moving-photo-raster.js", "utf8");
    for (const id of ["sample", "bridge", "machine-long"]) {
      const pictures = [];
      for (const variant of ["optimized", "full-raster", "both-caps", "quad-caps"]) {
        const page = await browser.newPage(config);
        if (variant === "full-raster")
          await page.context().route("**/src/packs/moving-photo-raster.js", (route) =>
            route.fulfill({
              contentType: "text/javascript",
              body:
                helper.replace(
                  "export function clipRasterPlanes(",
                  "function referenceRasterPlanes(",
                ) + "\nexport function clipRasterPlanes(planes) { return planes; }\n",
            }),
          );
        if (variant === "both-caps") {
          const geometry = await fs.readFile("src/packs/moving-photo-geometry.js", "utf8");
          await page.context().route("**/src/packs/moving-photo-geometry.js", (route) =>
            route.fulfill({
              contentType: "text/javascript",
              body: geometry.replace("coincidentCaps(patches, floors, p) ? 32 : 33", "33"),
            }),
          );
        }
        if (variant === "quad-caps") {
          const geometry = await fs.readFile("src/packs/moving-photo-geometry.js", "utf8");
          await page.context().route("**/src/packs/moving-photo-geometry.js", (route) =>
            route.fulfill({
              contentType: "text/javascript",
              body:
                geometry.replace(
                  "export function indexClipCaps(",
                  "function referenceIndexClipCaps(",
                ) +
                "\nexport function indexClipCaps(planes) { return {instances:planes,caps:null}; }\n",
            }),
          );
        }
        try {
          await openRender(page, {
            id,
            source: id === "sample" ? "assets/toys/screen/bunny.mp4" : undefined,
            tier: profile === "phone" ? "low" : "mid",
            stepped: true,
          });
          const frames = [];
          for (const yaw of [-0.45, 0.18, 0.8])
            for (const time of [0.015625, 1.25]) {
              const frame = await renderFrame(page, time, { yaw, pictureOnly: true });
              expect(frame.holes, `${id} / ${yaw} / ${time}`).toBe(0);
              expect(frame.edgeSpecks, `${id} / ${yaw} / ${time}`).toBe(0);
              frames.push(PNG.sync.read(Buffer.from(frame.picture.split(",")[1], "base64")));
            }
          pictures.push(frames);
        } finally {
          await page.close();
        }
      }
      for (const alternate of pictures.slice(1))
        for (let i = 0; i < pictures[0].length; i++) {
          const a = pictures[0][i],
            b = alternate[i];
          expect([a.width, a.height]).toEqual([b.width, b.height]);
          expect(a.data.equals(b.data), `${id}, view ${i}`).toBe(true);
        }
    }
  });
}

test("native bounds retain exactly the JavaScript faces", async () => {
  const { geometryRaster } = await import("../src/packs/moving-photo-geometry.js");
  const { clipRasterPlanes } = await import("../src/packs/moving-photo-raster.js");
  const module = await WebAssembly.compile(
    await fs.readFile("assets/toys/moving-photo-3d/clip-geometry.wasm"),
  );
  expect(WebAssembly.Module.imports(module)).toEqual([]);
  const native = geometryRaster(module);
  let seed = 7;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
  for (const [w, h] of [
    [2, 3],
    [16, 12],
    [480, 270],
    [173, 617],
  ])
    for (let trial = 0; trial < 40; trial++) {
      const planes = new Float32Array(4000 * 8),
        codes = new Uint32Array(planes.buffer),
        bits = Math.ceil(Math.log2(w));
      for (let k = 0; k < 4000; k++) {
        const at = k * 8;
        for (let j = 0; j < 8; j++) planes[at + j] = random();
        codes[at + 3] =
          0x08000000 |
          Math.floor(random() * w) |
          (Math.floor(random() * h) << bits) |
          (Math.floor(random() * 6) << 24);
      }
      const matrix = Float64Array.from({ length: 16 }, () => random() * 0.003 - 0.0015);
      matrix[15] = 1;
      matrix[0] = 2 / w;
      matrix[5] = 2 / h;
      matrix[12] = -1;
      matrix[13] = -1;
      const view = {
        matrix,
        error: Float64Array.from({ length: 4 }, () => random() * 1e-5),
        width: 390,
        height: 844,
        quantum: trial % 2 ? 1 / 16 : 1 / 256,
      };
      const reference = clipRasterPlanes(planes, w, h, view),
        actual = clipRasterPlanes(planes, w, h, view, native);
      expect(
        Buffer.from(actual.buffer).equals(Buffer.from(reference.buffer)),
        `${w}x${h}, view ${trial}`,
      ).toBe(true);
    }
});
