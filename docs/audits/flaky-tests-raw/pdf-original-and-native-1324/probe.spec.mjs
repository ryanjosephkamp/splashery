import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url));
test.afterEach(async ({page},info)=>{
  const evidence=await page.evaluate(()=>({nativeReady:window.__pdfGuard,records:window.__pdfRecords || []}));
  fs.writeFileSync(path.join(out,(evidence.nativeReady?'native-ready':'original-fixed-frames')+'.json'),JSON.stringify({status:info.status,...evidence},null,2));
});
const ready = async (page) => {
  await page.waitForFunction(
    () => {
      const pl = window.__splashery.player,
        p = pl.pictures;
      pl.stage.requestRender();
      return (
        p?.media && p.splats() > 0 && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key)
      );
    },
    null,
    { timeout: 180000 },
  );
};
for (const nativeReady of [false,true]) {
 const renderer="webgl2";
 test.describe(nativeReady?"native-ready":"original-fixed-frames",()=>{
test(`opaque tilted PDF faces cover their own paper backing (${renderer})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await ready(page);
    await page.evaluate(async (guard) => {
      const p = window.__splashery.player;
      const { state } = await import('/tests/helpers/native-sort.mjs');
      state(p.stage);
      window.__pdfGuard = guard;
      window.__pdfRecords = [];
      const native = p.stage.captureFrame;
      p.stage.captureFrame = async function (...args) {
        const frame = await native.apply(this, args);
        window.__pdfRecords.push({
          frame: window.__pdfRecords.length + 1,
          clock: performance.now(),
          native: state(this).map(s => ({...s, applied: s.applied ?? null})),
          camera: JSON.parse(JSON.stringify(p.camera.cur)),
          sheets: p.pictures.sheets.map(s => ({
            id:s.id, hidden:s.hidden, faceBacked:s.slot?.faceBacked,
            enabled:s.slot?.entity.gsplat.enabled, surface:!!s.slot?.surface,
            want:s.want?.key, shown:s.shown?.key,
          })),
          retiring:p.pictures.retiring.map(s => ({frames:s.frames,enabled:s.slot.entity.gsplat.enabled})),
        });
        return frame;
      };
    }, nativeReady);
    await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.frozen = true;
      p.glide = null;
      p.camera.cur.yaw = p.camera.tgt.yaw = 0.45;
      p.camera.cur.pitch = p.camera.tgt.pitch = 0.3;
      p.camera.interact();
      for (let i = 0; i < 4; i++) await p.stage.captureFrame();
    });
    await ready(page);
    const difference = await page.evaluate(async () => {
      const p = window.__splashery.player;
      const sh = p.pictures.sheets.find((s) => !s.hidden && s.slot?.surface);
      const face = sh.slot.surface,
        g = face.geom;
      if (window.__pdfGuard) {
        const { captureSortedFrame } = await import('/tests/helpers/native-sort.mjs');
        await captureSortedFrame(p.stage);
      }
      const frame = await p.stage.captureFrame();
      const a = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
      const mask = document.createElement("canvas");
      mask.width = frame.width;
      mask.height = frame.height;
      const ctx = mask.getContext("2d");
      const ratio = frame.width / p.canvas.clientWidth;
      ctx.beginPath();
      for (const [i, [u, v]] of [
        [0, [0.2, 0.2]],
        [1, [0.8, 0.2]],
        [2, [0.8, 0.8]],
        [3, [0.2, 0.8]],
      ]) {
        const xyz = g.origin.map(
          (o, k) =>
            o +
            g.right[k] * face.color.width * u +
            g.down[k] * face.color.height * v +
            g.normal[k] * (g.lift || 0),
        );
        const point = p.stage.toScreen(xyz);
        if (!i) ctx.moveTo(point[0] * ratio, point[1] * ratio);
        else ctx.lineTo(point[0] * ratio, point[1] * ratio);
      }
      ctx.closePath();
      ctx.fill();
      const inside = ctx.getImageData(0, 0, mask.width, mask.height).data;
      const components = p.pictures.sheets.filter((s) => s.slot).map((s) => s.slot.entity.gsplat);
      for (const component of components) component.enabled = false;
      let without;
      for (let i = 0; i < 4; i++) without = await p.stage.captureFrame();
      if (window.__pdfGuard) {
        const { captureSortedFrame } = await import('/tests/helpers/native-sort.mjs');
        without = await captureSortedFrame(p.stage);
      }
      const b = without.getContext("2d").getImageData(0, 0, without.width, without.height).data;
      let total = 0,
        count = 0;
      for (let i = 0; i < a.length; i += 4)
        if (inside[i + 3] === 255) {
          for (let k = 0; k < 3; k++) total += Math.abs(a[i + k] - b[i + k]);
          count++;
        }
      for (const component of components) component.enabled = true;
      return { mean: total / (count * 3), count };
    });
    console.log("PDF_DIFFERENCE", JSON.stringify({ nativeReady, ...difference }));
    expect(difference.count).toBeGreaterThan(1000);
    expect(difference.mean).toBeLessThan(0.5);
  });
 });
}
