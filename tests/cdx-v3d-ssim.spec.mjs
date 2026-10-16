import { test, expect } from "@playwright/test";

test("structural loss trains and exports with the default eight storage bindings", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { GSTrainer } = await import("/vendor/splatjs/src/gs/trainer.js"),
      { createGpu } = await import("/vendor/splatjs/src/gpu/context.js"),
      { gaussiansToPly } = await import("/vendor/splatjs/src/io/ply.js"),
      { readSplatPly } = await import("/src/video3d/ply.js");
    const gpu = await createGpu(),
      device = gpu.device,
      errors = [],
      rows = [],
      w = 48,
      h = 32,
      n = 96,
      data = new Float32Array(n * 16),
      image = new Float32Array(w * h * 3),
      camera = {
        imgIdx: 0,
        R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        t: [0, 0, 0],
        f: 50,
        cx: w / 2,
        cy: h / 2,
        w,
        h,
      };
    device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
    for (let i = 0; i < n; i++)
      data.set(
        [
          ((i % 12) - 5.5) * 0.035,
          (Math.floor(i / 12) - 3.5) * 0.035,
          1.5 + (i % 5) * 0.01,
          -3.7,
          -3.8,
          -4.2,
          1,
          0,
          0,
          0,
          -0.5,
          -0.2,
          0.1,
          0.35,
          0,
          0,
        ],
        i * 16,
      );
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        image.set([0.2 + x / w / 3, 0.25 + y / h / 4, 0.3], 3 * (y * w + x));
    try {
      for (const tileGrad of [true, false]) {
        device.pushErrorScope("validation");
        const trainer = new GSTrainer(
          device,
          {
            shDeg: 0,
            maxIters: 20,
            maxSplats: n,
            capMult: 1,
            entriesCap: 16384,
            seed: 88,
            serialSort: true,
            tileGrad,
            ssimWeight: 0.2,
            camGrads: false,
          },
          gpu.info,
        );
        try {
          trainer.setup(
            { data: data.slice(), n, dc: "sigmoid" },
            [camera],
            [{ tw: w, th: h, rgb: image }],
            w,
            h,
            1,
          );
          await device.queue.onSubmittedWorkDone();
          const initializationError = await device.popErrorScope();
          if (initializationError)
            return {
              limits: device.limits.maxStorageBuffersPerShaderStage,
              initializationError: initializationError.message,
              errors,
              rows,
            };
          device.pushErrorScope("validation");
          const before = await trainer.evalCamPsnr(0);
          for (let i = 0; i < 20; i++) {
            trainer.stepOnce();
            await device.queue.onSubmittedWorkDone();
          }
          const after = await trainer.evalCamPsnr(0),
            model = await trainer.readGaussians(),
            blob = gaussiansToPly(model.data, model.n, model.sh, model.shK, model.dc),
            parsed = readSplatPly(new Uint8Array(await blob.arrayBuffer()));
          const error = await device.popErrorScope();
          if (error) errors.push(error.message);
          rows.push({
            tileGrad,
            before,
            after,
            iters: trainer.iter,
            count: parsed.count,
            changed: model.data.some((v, i) => v !== data[i]),
            parameters: Array.from(model.data),
            finite: [
              model.data,
              parsed.pos,
              parsed.scales,
              parsed.opacity,
              parsed.color,
              parsed.quat,
            ].every((a) => Array.from(a).every(Number.isFinite)),
          });
        } finally {
          trainer.dispose();
        }
      }
      return {
        limits: device.limits.maxStorageBuffersPerShaderStage,
        initializationError: null,
        errors,
        rows,
      };
    } finally {
      gpu.dispose();
    }
  });
  expect(result.limits).toBe(8);
  expect(result.initializationError).toBeNull();
  expect(result.errors).toEqual([]);
  expect(result.rows).toHaveLength(2);
  expect(result.rows[1].parameters).toEqual(result.rows[0].parameters);
  for (const row of result.rows) {
    expect(row.iters).toBe(20);
    expect(row.count).toBe(96);
    expect(row.changed).toBe(true);
    expect(row.finite).toBe(true);
    expect(Number.isFinite(row.before) && Number.isFinite(row.after)).toBe(true);
    expect(row.after).toBeGreaterThan(row.before);
  }
});
