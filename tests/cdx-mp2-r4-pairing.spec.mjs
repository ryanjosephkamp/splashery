// Task 101: this independent phone group keeps its original fixtures and solo execution.
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";

import { android, watchPictures, chosenPicture } from "./cdx-mp2-r4-helpers.mjs";

test.describe("phone long-clip pairing", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  test("parallel picture processing keeps each drawn bitmap paired with its depth", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "machine-long" }));
    await page.waitForFunction(() => !window.__splashery.player.loading);
    const result = await page.evaluate(async () => {
      const { blendNear, guidedDepth } = await import("/src/packs/moving-photo-depth.js");
      const { prepareGeometry, geometryField, drawFields } =
        await import("/src/packs/moving-photo-geometry.js");
      const { player, app } = window.__splashery,
        m = window.__r4Mesh,
        c = window.__r4Moving.MOVING.clip;
      const reference = geometryField(await prepareGeometry(), c.w, c.h, m.cols, m.rows);
      const canvas = document.createElement("canvas");
      canvas.width = c.w;
      canvas.height = c.h;
      const g = canvas.getContext("2d", { willReadFrequently: true });
      g.imageSmoothingQuality = "high";
      return new Promise((resolve) => {
        const seen = new Set(),
          errors = [];
        const finish = () => {
          clearTimeout(timer);
          player.stage.app.off("postrender", draw);
          app.setControl("play", 0);
          resolve({ frames: seen.size, workers: m.clipStream?.stats.workers, errors });
        };
        const timer = setTimeout(finish, 20000);
        const draw = () => {
          const time = m.clipBitmapTime;
          if (!m.clipBitmap || seen.has(time)) return;
          seen.add(time);
          try {
            const D = c.depth,
              k = Math.max(0, time * D.rate - (D.offset ?? 0.5)),
              a = Math.min(D.n - 1, Math.floor(k)),
              b = Math.min(D.n - 1, a + 1);
            blendNear(D, a, b, k - a);
            g.drawImage(m.clipBitmap, 0, 0, c.w, c.h);
            const near = guidedDepth(
              D.blend,
              D.ms.w,
              D.ms.h,
              g.getImageData(0, 0, c.w, c.h).data,
              c.w,
              c.h,
            );
            const bytes = Uint8Array.from(near, (v) => Math.round(v * 255));
            if (m.depth.getSource().some((v, i) => v !== bytes[i]))
              errors.push(`picture/depth at ${time}`);
            const count = reference.compute(bytes, true, m.clipAspect),
              expected = drawFields(reference, count, m.cols, m.rows).instances;
            if (
              m.matS
                .getParameter("uClipSoft")
                .data.getSource()
                .some((v, i) => v !== reference.soft[i * 4])
            )
              errors.push(`surface at ${time}`);
            if (
              expected.length !== m.clipAllPlanes.length ||
              expected.some((v, i) => v !== m.clipAllPlanes[i])
            )
              errors.push(`solid at ${time}`);
          } catch (error) {
            errors.push(error.message);
          }
          if (seen.size === 3 || errors.length) finish();
        };
        player.stage.app.on("postrender", draw);
        app.setControl("play", 1);
      });
    });
    expect(result.errors).toEqual([]);
    expect(result.frames).toBe(3);
    expect(result.workers).toBe(2);
  });
});
