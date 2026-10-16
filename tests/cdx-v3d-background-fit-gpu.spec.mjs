// MIT. Real packed-target readback and fixed-model environment fitting; no performance claim.
import { test, expect } from "@playwright/test";

test("constant environment fitting uses GPU targets after low-memory cleanup and preserves every model parameter", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { createSession } = await import("/vendor/splatjs/src/session.js");
    const R = [1, 0, 0, 0, 1, 0, 0, 0, 1],
      w = 32,
      h = 24,
      rgb = [153 / 255, 102 / 255, 51 / 255];
    const frames = Array.from({ length: 4 }, (_, i) => ({
      name: `${i}.jpg`,
      tw: w,
      th: h,
      fw: w,
      fh: h,
      sharpness: 1,
      rgb: new Float32Array(w * h * 3).fill(0.3),
    }));
    const s = createSession({
      lowMem: true,
      holdout: 2,
      maskTraining: false,
      maxViewW: w,
      maxViewH: h,
      lossCams: (_, i) => i !== 1,
      trainer: { shDeg: 0, fitBackground: true, serialSort: true, tileGrad: false, maxSplats: 32 },
    });
    try {
      s.useFrames(frames);
      s.useReconstruction({
        cams: frames.map((_, i) => ({ R, t: [(i - 1.5) * 0.02, 0, 0], f: 28, imgIdx: i })),
        points: Array.from({ length: 8 }, (_, i) => ({
          X: [
            (i % 2) * 0.12 - 0.06,
            (Math.floor(i / 2) % 2) * 0.12 - 0.06,
            3 + Math.floor(i / 4) * 0.12,
          ],
          rgb: [0.3, 0.4, 0.5],
        })),
      });
      await s.seed({ initTarget: 8, seedLimit: 8 });
      const t = s.trainer,
        d = t.device,
        errors = [];
      d.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
      const raw = async (buffer, bytes) => {
        const rb = d.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        try {
          const enc = d.createCommandEncoder();
          enc.copyBufferToBuffer(buffer, 0, rb, 0, bytes);
          d.queue.submit([enc.finish()]);
          await rb.mapAsync(GPUMapMode.READ);
          return new Uint8Array(rb.getMappedRange().slice(0));
        } finally {
          rb.unmap();
          rb.destroy();
        }
      };
      const original = await raw(t.bufParams, t.n * 64);
      const targetRows = [];
      for (let ci = 0; ci < 4; ci++) {
        const m = t.camMeta[ci],
          enc = d.createCommandEncoder();
        d.queue.writeBuffer(t.uniView, 0, t._camUniform({ ...m, bg: [0, 0, 0] }, 0, m.offset, ci));
        d.queue.writeBuffer(t.bufTileCnt, 0, t.tileZero);
        const pass = enc.beginComputePass();
        t.encodeRaster(pass, m, false);
        pass.end();
        d.queue.submit([enc.finish()]);
        const bytes = await raw(t.bufOut, w * h * 16),
          out = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
        const packed = new Uint32Array(w * h);
        for (let p = 0; p < packed.length; p++) {
          const values = rgb.map((c, k) =>
            Math.round(Math.max(0, Math.min(1, out[p * 4 + k] + (1 - out[p * 4 + 3]) * c)) * 255),
          );
          packed[p] =
            ci === 1
              ? 0xffff00ff
              : (0xff000000 | values[0] | (values[1] << 8) | (values[2] << 16)) >>> 0;
        }
        packed[0] = 0; // The exact invalid-pixel sentinel must not influence the fit.
        d.queue.writeBuffer(t.bufTarget, m.offset * 4, packed);
        targetRows.push(Array.from(packed));
      }
      const readCams = [],
        uniform = t._camUniform;
      t._camUniform = function (...args) {
        readCams.push(args[3]);
        return uniform.apply(this, args);
      };
      const fit = await s.fitBackground();
      t._camUniform = uniform;
      const validation = new Uint32Array(w * h).fill(0xff000000);
      validation[0] = 0;
      d.queue.writeBuffer(t.bufTarget, t.camMeta[2].offset * 4, validation);
      const rejected = await s.fitBackground();
      const after = await raw(t.bufParams, t.n * 64);
      const same = original.length === after.length && original.every((v, i) => v === after[i]);
      await d.queue.onSubmittedWorkDone();
      return {
        fit,
        rejected,
        readCams,
        expected: rgb,
        same,
        cpuRgbReleased: frames.every((f) => f.rgb === null),
        targetCopySource: !!(t.bufTarget.usage & GPUBufferUsage.COPY_SRC),
        errors,
        targetRows,
      };
    } finally {
      s.dispose();
    }
  });
  expect(result.cpuRgbReleased).toBe(true);
  expect(result.targetCopySource).toBe(true);
  expect(result.fit.accepted).toBe(true);
  expect(result.fit.trainCams).toEqual([0, 3]);
  expect(result.fit.validationCams).toEqual([2]);
  expect(result.readCams).toEqual([0, 3, 2]);
  expect(result.fit.invalidPixels).toBe(2);
  expect(result.fit.pixels).toBe(2 * (32 * 24 - 1));
  expect(result.fit.improvement).toBeGreaterThan(0.9);
  for (let c = 0; c < 3; c++)
    expect(Math.abs(result.fit.rgb[c] - result.expected[c])).toBeLessThan(0.002);
  expect(result.fit.validation[0].fittedMse).toBeLessThan(result.fit.validation[0].baseMse);
  expect(result.rejected.accepted).toBe(false);
  expect(result.rejected.reason).toBe("validation-regression");
  expect(result.rejected.validation[0].fittedMse).toBeGreaterThan(
    result.rejected.validation[0].baseMse,
  );
  expect(result.same).toBe(true);
  expect(result.errors).toEqual([]);
});
