import { test, expect } from "@playwright/test";

const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: android,
});

for (const mode of ["mobile", "desktop site"])
  test.describe(mode, () => {
    test.use(
      mode === "desktop site"
        ? {
            isMobile: false,
            userAgent:
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
          }
        : {},
    );
    test("every sample shows its own texture when switched on a slowed Android profile", async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(600_000);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
      await page.waitForSelector("body[data-ready='true']");
      await page.evaluate(async () => {
        const moving = (window.__mobileMoving = await import("/src/packs/moving-photo.js"));
        const { ReliefMesh } = await import("/src/live/relief-mesh.js");
        const original = ReliefMesh.prototype.setColor;
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        window.__mobileCanvasVideos = new WeakMap();
        CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
          const result = draw.call(this, source, ...args);
          if (source instanceof HTMLVideoElement)
            window.__mobileCanvasVideos.set(this.canvas, source);
          return result;
        };
        // Observe the real upload and material binding; do not replace their behavior.
        ReliefMesh.prototype.setColor = function (src) {
          const result = original.call(this, src);
          window.__mobileMesh = this;
          return result;
        };
        await window.__splashery.app.chooseToy("moving-photo-3d");
        window.__splashery.app.setControl("play", 0);
        window.__mobileIds = moving.MOVING_PHOTO.options
          .find((option) => option.key === "clip")
          .choices.filter((clip) => clip.id !== "custom")
          .map((clip) => clip.id);
      });
      await page.waitForFunction(() => !window.__splashery.player.loading);
      const ids = await page.evaluate(() => window.__mobileIds);
      expect(ids).toEqual(
        expect.arrayContaining(["sample", "horse", "dragon", "bridge", "machine"]),
      );
      const results = [];
      for (const [index, id] of [
        ...ids,
        "sample",
        "machine",
        "sample",
        "bridge",
        "machine",
      ].entries()) {
        if (index === ids.length + 4) {
          // Keep Sintel's real first sheet pending until Machine has committed.
          // Its late preview/completion must not replace the selected picture.
          const sheet = "**/assets/toys/moving-photo-3d/sintel-sheet-1.jpg";
          let requested = false,
            release;
          const gate = new Promise((resolve) => (release = resolve));
          await page.route(sheet, async (route) => {
            requested = true;
            await gate;
            await route.continue();
          });
          try {
            await page.evaluate(() => {
              window.__mobileMoving.MOVING.samples.delete("dragon");
              window.__oldSamplePick = window.__splashery.app.setToyOptions({ clip: "dragon" });
            });
            await expect.poll(() => requested).toBe(true);
            await page.evaluate(() => window.__splashery.app.setToyOptions({ clip: "machine" }));
            expect(await page.evaluate(() => window.__mobileMoving.MOVING.clip.sample)).toBe(
              "machine",
            );
            release();
            await page.evaluate(() => window.__oldSamplePick);
          } finally {
            release();
            await page.unroute(sheet);
          }
        } else {
          await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), id);
        }
        await page.waitForFunction(() => !window.__splashery.player.loading);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const result = await page.evaluate(() => {
          const { MOVING } = window.__mobileMoving;
          const clip = MOVING.clip,
            mesh = window.__mobileMesh;
          const source = mesh?.colorSrc,
            level = mesh?.color?._levels[0];
          const expected = clip.colors?.[MOVING.frame];
          let own = false;
          if (ArrayBuffer.isView(level) && expected) {
            own =
              level.length === expected.length && level.every((value, i) => value === expected[i]);
          } else if (source instanceof HTMLVideoElement) {
            own =
              source.readyState >= 2 &&
              source.videoWidth > 0 &&
              Math.abs(source.currentTime - MOVING.t) < 0.25 &&
              (source === clip.video || source.currentSrc === clip.audio?.url);
          } else if (source instanceof HTMLCanvasElement) {
            const shown = source
              .getContext("2d")
              .getImageData(0, 0, source.width, source.height).data;
            const video = window.__mobileCanvasVideos.get(source);
            const belongs = video && (video === clip.video || video.currentSrc === clip.audio?.url);
            if (belongs && video.videoWidth > 0) {
              // Require a whole-frame exact match to one independent Canvas2D
              // conversion path; CPU and GPU paths can round video colors differently.
              for (const cpu of [false, true]) {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const g = canvas.getContext("2d", { willReadFrequently: cpu });
                g.drawImage(video, 0, 0);
                const native = g.getImageData(0, 0, canvas.width, canvas.height).data;
                own ||=
                  shown.length === native.length && shown.every((value, i) => value === native[i]);
              }
            }
          }
          return {
            sample: clip.sample,
            selected: window.__splashery.player.scene.toy.options?.clip || "sample",
            sharp: window.__psv.state().on,
            own,
            bound: !!mesh?.color && mesh.matS.getParameter("uColor")?.data === mesh.color,
            size: mesh?.color ? [mesh.color.width, mesh.color.height] : null,
            sourceTime: source?.currentTime,
            clipTime: MOVING.t,
            sourceKind: source?.constructor.name,
            audio: clip.audio?.url,
          };
        });
        results.push(result);
        console.log(`Android sample ${id}: ${JSON.stringify(result)}`);
        expect(result, `${id}: actual picture texture belongs to the selected clip`).toMatchObject({
          sample: id,
          selected: id,
          sharp: true,
          own: true,
          bound: true,
        });
        if (["dragon", "bridge", "machine"].includes(id))
          await page.screenshot({ path: testInfo.outputPath(`${id}-android.png`) });
      }
      await testInfo.attach("sample-textures", {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });
      expect(errors).toEqual([]);
    });
  });
