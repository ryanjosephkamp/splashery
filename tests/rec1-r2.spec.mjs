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

// The saved take's frames, drawn small: for each, how bright it is on average and how much of
// it differs from its corner (the background), so a black frame or a frame without the toy shows.
async function frames(page) {
  await page.waitForFunction(() => window.__splashery.app.recorded?.blob, null, { timeout: 60_000 }); // prettier-ignore
  return page.evaluate(async () => {
    const r = window.__splashery.app.recorded;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(r.blob);
    await new Promise((ok, no) => ((v.onloadedmetadata = ok), (v.onerror = no)));
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = Math.round((64 * v.videoHeight) / v.videoWidth);
    const g = c.getContext("2d", { willReadFrequently: true });
    const out = [];
    await new Promise((done) => {
      const on = () => {
        g.drawImage(v, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let sum = 0;
        let toy = 0;
        for (let i = 0; i < d.length; i += 4) {
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 60) toy++; // prettier-ignore
        }
        const n = d.length / 4;
        out.push({ light: sum / n, toy: toy / n });
        if (!v.ended) v.requestVideoFrameCallback(on);
      };
      v.requestVideoFrameCallback(on);
      v.onended = done;
      setTimeout(done, 20_000);
      v.play();
    });
    URL.revokeObjectURL(v.src);
    return out;
  });
}

test.use(PHONE);

for (const renderer of ["webgl2", "webgpu"]) {
  for (const [id, labs] of [
    ["donut", false],
    ["photo-3d", true],
  ]) {
    test(`a take shows the picture, not black (${id}, ${renderer})`, async ({ page }) => {
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
      await page.click("#record-start");
      await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/, { timeout: 30_000 });
      await page.waitForTimeout(3000);
      await page.click("#rec-stop");
      const f = await frames(page);
      expect(f.length).toBeGreaterThan(5);
      // Every frame shows the page's light background and the toy on it: none is black.
      const dark = f.filter((x) => x.light < 60);
      expect(dark.length, `dark frames ${dark.length} of ${f.length}`).toBe(0);
      const shown = f.filter((x) => x.toy > 0.01);
      expect(shown.length).toBeGreaterThan(0.8 * f.length);
      expect(errors).toEqual([]);
    });
  }
}
