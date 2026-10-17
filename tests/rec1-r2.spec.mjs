// Lane REC1 r2 (October 17, 2026): recordings show the picture again. After REC1 the recorder
// copied the stage on PlayCanvas's "postrender", before a WebGPU frame is submitted, so every take
// on a WebGPU browser (the default in Chrome and on an iPhone) saved black frames with the right
// sound and length. The specs before forced WebGL2. These record through Record under both
// renderers, on a kit toy and on Photo to 3D, and look at the saved video's frames.
import { test, expect } from "@playwright/test";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function open(page, renderer, { labs = false } = {}) {
  await page.goto(`/?renderer=${renderer}&profile=weak&labs=${labs ? 1 : 0}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return page.evaluate(() => window.__splashery.player.stage.deviceType);
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
}

// The saved take, sampled at eight times spread across it from its start (seeking, so a busy
// browser can't skip any): each drawn small, with how bright it is on average and how much of it
// differs from its corner (the background), so a black frame or a frame without the toy shows.
// Also the take's length and how many frames the recorder was handed.
async function frames(page) {
  await page.waitForFunction(() => window.__splashery.app.recorded?.blob, null, { timeout: 60_000 }); // prettier-ignore
  return page.evaluate(async () => {
    const r = window.__splashery.app.recorded;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(r.blob);
    await new Promise((ok, no) => ((v.onloadedmetadata = ok), (v.onerror = no)));
    // A seek, then the frame it shows (a "seeked" can come before that frame is drawn).
    const seek = (t) =>
      new Promise((ok) => {
        let n = 0;
        const done = () => ++n === 2 && ok();
        v.onseeked = done;
        v.requestVideoFrameCallback(done);
        setTimeout(() => ((n = 1), done()), 5000);
        v.currentTime = t;
      });
    // A recorder's WebM has no length in its header: seeking to the end finds it.
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e9;
      const t0 = performance.now();
      while (!Number.isFinite(v.duration) && performance.now() - t0 < 15_000)
        await new Promise((ok) => setTimeout(ok, 50));
    }
    const duration = v.duration;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = Math.round((64 * v.videoHeight) / v.videoWidth);
    const g = c.getContext("2d", { willReadFrequently: true });
    const out = [];
    for (let k = 0; k < 8; k++) {
      const t = 0.1 + ((duration - 0.35) * k) / 7;
      await seek(t);
      g.drawImage(v, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      let toy = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 60) toy++; // prettier-ignore
      }
      const n = d.length / 4;
      out.push({ t: Math.round(t * 100) / 100, light: Math.round(sum / n), toy: Math.round((1000 * toy) / n) / 1000 }); // prettier-ignore
    }
    URL.revokeObjectURL(v.src);
    return { samples: out, duration, seconds: r.seconds, pushed: r.frames };
  });
}

test.use(PHONE);

for (const renderer of ["webgl2", "webgpu"]) {
  for (const [id, labs] of [
    ["donut", false],
    ["photo-3d", true],
  ]) {
    for (const count of ["0", "3"]) {
      test(`a take shows the picture, not black (${id}, ${renderer}, countdown ${count})`, async ({
        page,
      }) => {
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const dev = await open(page, renderer, { labs });
        test.skip(renderer === "webgpu" && dev !== "webgpu", "No WebGPU adapter in this browser.");
        expect(dev).toBe(renderer);
        await pick(page, id);
        await page.waitForTimeout(3000);
        // Through the Share tab's Record button, as a person does.
        await page.click("#sheet-toggle");
        await page.click("#tab-share");
        // Without a countdown the take starts as the sheet folds away, while the stage changes
        // size (a slow GPU takes a while to draw at the new size); with one, it has settled.
        await page.locator("#record-countdown").selectOption(count);
        await page.click("#record-start");
        await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/, { timeout: 30_000 });
        await page.waitForTimeout(3000);
        await page.click("#rec-stop");
        const { samples, duration, seconds, pushed } = await frames(page);
        const said = JSON.stringify({ samples, duration, seconds, pushed });
        // The recorder was handed frames all through the take (10 a second at least when still).
        expect(pushed / seconds, said).toBeGreaterThan(5);
        expect(duration, said).toBeGreaterThan(seconds - 1.5);
        // Every sample across the take shows the page's light background and the toy on it: none
        // is black, and none is a blank canvas.
        for (const x of samples) {
          expect(x.light, said).toBeGreaterThan(60);
          expect(x.toy, said).toBeGreaterThan(0.01);
        }
        expect(errors).toEqual([]);
      });
    }
  }
}
