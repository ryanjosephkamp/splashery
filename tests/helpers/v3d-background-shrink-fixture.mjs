// MIT. Made by Ryan with Codex (GPT-6). Synthetic actual-GPU constrained-fit controls.
export async function backgroundShrinkGpuFixture(base) {
  const { GSTrainer } = await import(base + "/src/gs/trainer.js"),
    { createGpu } = await import(base + "/src/gpu/context.js");
  const gpu = await createGpu(),
    d = gpu.device,
    errors = [],
    cases = [];
  d.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
  const read = async (buffer, size) => {
    const rb = d.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      const e = d.createCommandEncoder();
      e.copyBufferToBuffer(buffer, 0, rb, 0, size);
      d.queue.submit([e.finish()]);
      await rb.mapAsync(GPUMapMode.READ);
      return new Uint8Array(rb.getMappedRange().slice(0));
    } finally {
      try {
        rb.unmap();
      } catch {}
      rb.destroy();
    }
  };
  try {
    for (const [id, shrink, target, gain, expectedAccepted, expectedReason] of [
      ["legacy-rejection", false, [77, 64, 51], 1, false, "validation-regression"],
      ["bounded-color", true, [77, 64, 51], 1, true, "training-and-validation-improved"],
      ["unchanged-full-fit", true, [204, 153, 102], 1, true, "training-and-validation-improved"],
      ["harmful-direction", true, [0, 0, 0], 1, false, "validation-regression"],
      ["insufficient-training-gain", true, [1, 1, 1], 16, false, "insufficient-training-gain"],
    ]) {
      d.pushErrorScope("validation");
      const w = 32,
        h = 24,
        params = Float32Array.of(0, 0, -2, -4, -4, -4, 1, 0, 0, 0, 0, 0, 0, -20, 0, 0);
      const camera = (i) => ({
        imgIdx: i,
        R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        t: [0, 0, 0],
        f: 32,
        cx: 16,
        cy: 12,
        w,
        h,
        g: i === 1 ? Math.log(gain) : 0,
      });
      const images = [0, 1, 2].map((i) => ({
        tw: w,
        th: h,
        rgb: Float32Array.from(
          { length: w * h * 3 },
          (_, p) => (i === 1 ? target : [204, 153, 102])[p % 3] / 255,
        ),
      }));
      const t = new GSTrainer(
        d,
        {
          shDeg: 0,
          compact: false,
          tileGrad: false,
          serialSort: true,
          tileSize: 8,
          maxSplats: 4,
          maxRasterTiles: 12,
          entriesCap: 2048,
          fitBackground: true,
          backgroundFitShrink: shrink,
        },
        gpu.info,
      );
      try {
        t.setup(
          { data: params.slice(), n: 1, dc: "sigmoid" },
          [0, 1, 2].map(camera),
          images,
          w,
          h,
          1,
        );
        const before = await read(t.bufParams, 64),
          calls = [],
          uniform = t._camUniform;
        t._camUniform = function (...args) {
          calls.push(args[3]);
          return uniform.apply(this, args);
        };
        const fit = await t.fitBackground({ validationCams: [1] });
        const after = await read(t.bufParams, 64);
        cases.push({
          id,
          fit,
          expectedAccepted,
          expectedReason,
          cameraReads: calls,
          modelExact: before.every((v, i) => v === after[i]),
          iters: t.iter,
        });
      } finally {
        t.dispose();
        const e = await d.popErrorScope();
        if (e) errors.push(e.message);
      }
    }
    await d.queue.onSubmittedWorkDone();
    return { cases, errors };
  } finally {
    gpu.dispose();
  }
}
