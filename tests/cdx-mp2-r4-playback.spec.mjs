// Keep the Operator pack selector aware of "moving-photo-3d" checks in shared helpers.
// Task 101: this independent phone group keeps its original fixtures and solo execution.
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

import { android, watchPictures } from "./cdx-mp2-r4-helpers.mjs";

test.describe("phone clip playback", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  test("a still camera keeps drawing short and long clip pictures", async ({ page, context }) => {
    test.setTimeout(240000);
    const worker = await fs.readFile("src/packs/moving-photo-geometry-worker.js", "utf8");
    await context.route("**/moving-photo-geometry-worker.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: worker.replace(
          "const started = performance.now();",
          "const started = performance.now(); await new Promise((resolve) => setTimeout(resolve, 160));",
        ),
      }),
    );
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    for (const id of ["sample", "bridge", "machine-long"]) {
      await page.evaluate(async (id) => {
        const { app, player } = window.__splashery;
        app.setControl("play", 0);
        await app.setToyOptions({ clip: id });
        player.idle.weight = 0;
        player.opts.idleDelay = 1e9;
        const device = player.stage.device;
        window.__r4DrawnFrames = new Set();
        if (!window.__r4DrawSpy) {
          const draw = device.draw;
          device.draw = function (primitive, buffer, ...rest) {
            const result = draw.call(this, primitive, buffer, ...rest);
            const mesh = window.__r4Mesh;
            if (
              this.shaderValid &&
              primitive.count > 0 &&
              buffer === mesh?.surface.mesh.indexBuffer[0] &&
              mesh.clipGeometryOwner === window.__r4Moving.MOVING.clip
            )
              window.__r4DrawnFrames.add(mesh.clipBitmapTime ?? window.__r4Moving.MOVING.frame);
            return result;
          };
          window.__r4DrawSpy = true;
        }
        app.setControl("play", 1);
      }, id);
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__r4DrawnFrames.clear());
      await page.waitForFunction(() => window.__r4DrawnFrames.size >= 4, null, { timeout: 6000 });
      const state = await page.evaluate(() => {
        const m = window.__r4Mesh;
        window.__splashery.app.setControl("play", 0);
        return {
          drawn: window.__r4DrawnFrames.size,
          frame: window.__r4Moving.MOVING.frame,
          waiting: m.clipWaitingDepth,
          cache: m.clipCache?.stats,
          stream: m.clipStream?.stats,
        };
      });
      console.log(`${id} still camera: ${JSON.stringify(state)}`);
      expect(state.drawn, id).toBeGreaterThanOrEqual(4);
    }
  });
  test("each drawn accelerated relief uses the current depth frame", async ({ page, context }) => {
    test.setTimeout(120000);
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await watchPictures(page);
    const result = await page.evaluate(async () => {
      const { prepareGeometry, geometryField, drawFields } =
        await import("/src/packs/moving-photo-geometry.js");
      const { player, app } = window.__splashery,
        m = window.__r4Mesh,
        c = window.__r4Moving.MOVING.clip;
      const reference = geometryField(await prepareGeometry(), c.w, c.h, m.cols, m.rows);
      return new Promise((resolve) => {
        const seen = new Set(),
          errors = [];
        const finish = () => {
          clearTimeout(timer);
          player.stage.app.off("postrender", draw);
          app.setControl("play", 0);
          resolve({ frames: seen.size, errors });
        };
        const timer = setTimeout(finish, 15000);
        const draw = () => {
          const frame = window.__r4Moving.MOVING.frame;
          if (seen.has(frame)) return;
          seen.add(frame);
          try {
            const count = reference.compute(c.near[frame], true, m.clipAspect);
            const expected = drawFields(reference, count, m.cols, m.rows).instances;
            const actual = m.matS.getParameter("uClipSoft").data.getSource();
            if (actual.some((v, i) => v !== reference.soft[i * 4]))
              errors.push(`surface at frame ${frame}`);
            if (
              expected.length !== m.clipAllPlanes.length ||
              expected.some((v, i) => v !== m.clipAllPlanes[i])
            )
              errors.push(`solid at frame ${frame}`);
          } catch (error) {
            errors.push(error.message);
          }
          if (seen.size === 5 || errors.length) finish();
        };
        player.stage.app.on("postrender", draw);
        app.setControl("play", 1);
      });
    });
    expect(result.errors).toEqual([]);
    expect(result.frames).toBe(5);
  });
  test("a hidden video without frame notifications keeps uploading its picture", async ({
    page,
    context,
  }) => {
    await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']");
    await page.evaluate(() => {
      HTMLVideoElement.prototype.requestVideoFrameCallback = () => 1;
      HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
      HTMLVideoElement.prototype.getVideoPlaybackQuality = () => ({ totalVideoFrames: 0 });
      window.__r4VideoUploads = [];
      for (const name of ["texImage2D", "texSubImage2D"]) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) {
          const video = window.__r4Moving?.MOVING.clip?.video;
          if (video && !video.paused && args.includes(video))
            window.__r4VideoUploads.push(video.currentTime);
          return original.apply(this, args);
        };
      }
    });
    await watchPictures(page);
    const times = await page.evaluate(async () => {
      window.__r4VideoUploads = [];
      window.__splashery.app.setControl("play", 1);
      await new Promise((r) => setTimeout(r, 1800));
      window.__splashery.app.setControl("play", 0);
      return window.__r4VideoUploads;
    });
    expect(times.length).toBeGreaterThanOrEqual(3);
    expect(times.at(-1) - times[0]).toBeGreaterThan(0.5);
  });
});
