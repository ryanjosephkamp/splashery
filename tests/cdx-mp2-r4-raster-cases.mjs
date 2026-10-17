// Task 101: retain every native raster sample, variant, pose, and pixel comparison.
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { PNG } from "pngjs";
import { openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";

export function rasterCases(profile) {
  const cases = [];

  cases.push([
    `${profile}: a changing native border keeps its cut-cell support`,
    async ({ browser }) => {
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
    },
  ]);

  cases.push([
    `${profile}: removing faces without raster samples leaves identical pixels`,
    async ({ browser }) => {
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
    },
  ]);

  return cases;
}
