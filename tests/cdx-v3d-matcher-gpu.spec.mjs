// MIT. Actual GPU results and raw integer tables, independently checked against CPU SIFT.
import { test, expect } from "@playwright/test";

test("small GPU match chunks preserve every integer result and CPU mutual match", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { gpuMatchAll } = await import("/vendor/splatjs/src/sfm/gpumatch.js");
    const { matchSift } = await import("/vendor/splatjs/src/sfm/sift.js");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("The matcher regression requires a WebGPU adapter");
    const device = await adapter.requestDevice(),
      errors = [],
      tables = [];
    device.addEventListener("uncapturederror", (event) => errors.push(event.error.message));
    const allocate = device.createBuffer.bind(device);
    device.createBuffer = (description) => {
      const buffer = allocate(description);
      if (description.usage & GPUBufferUsage.MAP_READ) {
        const read = buffer.getMappedRange.bind(buffer);
        buffer.getMappedRange = (...args) => {
          const mapped = read(...args);
          tables.push(Array.from(new Uint32Array(mapped)));
          return mapped;
        };
      }
      return buffer;
    };
    let state = 777;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) >>> 24;
    const base = Uint8Array.from({ length: 65 * 128 }, random);
    const feats = [3, 65, 17].map((n) => ({ n, desc: base.slice(0, n * 128) }));
    feats[1].desc.set(feats[1].desc.subarray(0, 128), 128); // Equal nearest distances must fail ratio.
    const pairs = [
      [0, 1],
      [1, 2],
      [0, 2],
      [2, 1],
      [0, 0],
      [0, 1],
    ];
    const expected = pairs.map(([i, j]) =>
      matchSift(feats[i].desc, feats[i].n, feats[j].desc, feats[j].n),
    );
    try {
      const variants = [];
      for (const maxPairsPerChunk of [undefined, 1, 2, 4]) {
        tables.length = 0;
        const matches = await gpuMatchAll(feats, pairs, 0.8, () => {}, device, null, {
          maxPairsPerChunk,
        });
        variants.push({ matches, tables: tables.flat(), chunks: tables.length });
      }
      await device.queue.onSubmittedWorkDone();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { expected, variants, errors };
    } finally {
      device.destroy();
    }
  });
  expect(result.errors).toEqual([]);
  expect(result.variants.map((v) => v.chunks)).toEqual([1, 6, 3, 2]);
  expect(result.variants[0].tables.length).toBeGreaterThan(0);
  for (const variant of result.variants) {
    expect(variant.matches).toEqual(result.expected);
    expect(variant.tables).toEqual(result.variants[0].tables);
  }
});
