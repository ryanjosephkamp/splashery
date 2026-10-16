// MIT. Exactness tests for the explicit software-sort option; no performance assertion.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { GSTrainer } from "../vendor/splatjs/src/gs/trainer.js";
import { SORT_SRC, SERIAL_SORT_SRC } from "../vendor/splatjs/src/gs/shaders.js";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const comparePairs = (a, b) =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
const capacity = (count) => (count <= 2048 ? count : 2 ** Math.ceil(Math.log2(count)));

test("serial sorting requires explicit true and preserves the default pipeline", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { gpu: { getPreferredCanvasFormat: () => "bgra8unorm" } },
  });
  // These mocks only observe pipeline selection; GPU math is tested below.
  const device = {
    limits: { maxStorageBufferBindingSize: 128 * 1024 * 1024 },
    features: new Set(),
    createShaderModule: (description) => description,
    createComputePipeline: (description) => description,
    createRenderPipeline: (description) => description,
  };
  try {
    for (const serialSort of [undefined, false, 0, 1, "true", true]) {
      const trainer = new GSTrainer(device, { serialSort, shDeg: 0, compact: false });
      expect(trainer.serialSort).toBe(serialSort === true);
      expect(trainer.pipeSort.compute.module.code).toBe(
        serialSort === true ? SERIAL_SORT_SRC : SORT_SRC,
      );
      expect(trainer.tileGrad).toBe(true);
      trainer.dispose();
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else delete globalThis.navigator;
  }
});

async function emptyPage(page) {
  await page.route("**/__software-sort.html", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Exact tile sorting</title>" }),
  );
  await page.goto("/__software-sort.html");
}

async function saveRaw(testInfo, name, bytes) {
  const file = testInfo.outputPath(name);
  fs.writeFileSync(file, bytes);
  await testInfo.attach(name, { path: file, contentType: "application/octet-stream" });
  return { file: name, bytes: bytes.length, sha256: sha256(bytes) };
}

test("both GPU sorters match unsigned JS ordering, padded tails, and disjoint canaries", async ({
  page,
}, testInfo) => {
  let state = 0x5a88c0de;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const counts = [0, 1, 2, 17, 2048, 2049, 0, 1, 2, 31];
  for (let i = 0; i < 24; i++) counts.push(random() % 80);
  // Start after a prefix canary. Dropped/empty tiles have zero-length segments.
  const starts = [7];
  for (const count of counts) starts.push(starts.at(-1) + capacity(count));
  const input = Uint32Array.from({ length: 2 * (starts.at(-1) + 13) }, random);
  for (let t = 0; t < counts.length; t++)
    for (let i = 0; i < counts[t]; i++) {
      input[2 * (starts[t] + i)] = [0, 0x7fffffff, 0x80000000, 0xffffffff, random()][i % 5];
      input[2 * (starts[t] + i) + 1] = i % 11 ? random() % 19 : 0xffffffff;
    }
  const expected = input.slice();
  for (let t = 0; t < counts.length; t++) {
    const sorted = Array.from({ length: counts[t] }, (_, i) => [
      input[2 * (starts[t] + i)],
      input[2 * (starts[t] + i) + 1],
    ]).sort(comparePairs);
    for (let i = 0; i < sorted.length; i++) expected.set(sorted[i], 2 * (starts[t] + i));
    if (counts[t] > 2048) expected.fill(0xffffffff, 2 * (starts[t] + counts[t]), 2 * starts[t + 1]);
  }
  await emptyPage(page);
  const result = await page.evaluate(
    async ({ input, starts, counts }) => {
      const { createGpu } = await import("/vendor/splatjs/src/gpu/context.js");
      const { SORT_SRC, SERIAL_SORT_SRC } = await import("/vendor/splatjs/src/gs/shaders.js");
      const gpu = await createGpu(),
        device = gpu.device,
        errors = [],
        rows = [];
      device.addEventListener("uncapturederror", (event) => errors.push(event.error.message));
      try {
        for (const [name, code] of [
          ["bitonic", SORT_SRC],
          ["serial", SERIAL_SORT_SRC],
        ]) {
          device.pushErrorScope("validation");
          const resources = [];
          try {
            const buffer = (values) => {
              const data = Uint32Array.from(values),
                resource = device.createBuffer({
                  size: data.byteLength,
                  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                });
              resources.push(resource);
              device.queue.writeBuffer(resource, 0, data);
              return resource;
            };
            const tileStart = buffer(starts),
              tileCursor = buffer(counts.map((c, i) => starts[i] + c)),
              entries = buffer(input),
              pipeline = device.createComputePipeline({
                layout: "auto",
                compute: { module: device.createShaderModule({ code }), entryPoint: "main" },
              }),
              bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [tileStart, tileCursor, entries].map((buffer, binding) => ({
                  binding,
                  resource: { buffer },
                })),
              }),
              readback = device.createBuffer({
                size: input.length * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
              });
            resources.push(readback);
            const encoder = device.createCommandEncoder(),
              pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(counts.length);
            pass.end();
            encoder.copyBufferToBuffer(entries, 0, readback, 0, input.length * 4);
            device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            rows.push({ name, words: Array.from(new Uint32Array(readback.getMappedRange())) });
            readback.unmap();
          } finally {
            for (const resource of resources) resource.destroy();
          }
          const error = await device.popErrorScope();
          if (error) errors.push(error.message);
        }
        await device.queue.onSubmittedWorkDone();
        return { rows, errors };
      } finally {
        gpu.dispose();
      }
    },
    { input: Array.from(input), starts, counts },
  );
  expect(result.errors).toEqual([]);
  const files = [
    await saveRaw(testInfo, "sort-input.u32", Buffer.from(input.buffer)),
    await saveRaw(testInfo, "sort-js-oracle.u32", Buffer.from(expected.buffer)),
  ];
  for (const row of result.rows) {
    const actual = Uint32Array.from(row.words);
    files.push(await saveRaw(testInfo, `${row.name}-entries.u32`, Buffer.from(actual.buffer)));
    expect(Buffer.from(actual.buffer).equals(Buffer.from(expected.buffer))).toBe(true);
  }
  await testInfo.attach("sort-proof", {
    body: JSON.stringify({ counts, starts, files, prefixPairs: 7, suffixPairs: 13 }),
    contentType: "application/json",
  });
});

test("software sort and direct gradients preserve raster bytes and three real optimizer steps", async ({
  page,
}, testInfo) => {
  await emptyPage(page);
  const result = await page.evaluate(async () => {
    const { GSTrainer } = await import("/vendor/splatjs/src/gs/trainer.js"),
      { createGpu } = await import("/vendor/splatjs/src/gpu/context.js"),
      { gaussiansToPly } = await import("/vendor/splatjs/src/io/ply.js"),
      { readSplatPly } = await import("/src/video3d/ply.js");
    const gpu = await createGpu(),
      device = gpu.device,
      errors = [],
      rows = [],
      n = 96,
      w = 48,
      h = 32,
      params = new Float32Array(n * 16),
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
      },
      opts = { shDeg: 0, maxIters: 3, maxSplats: n, capMult: 1, entriesCap: 16384, seed: 88 };
    for (let i = 0; i < n; i++)
      params.set(
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
          (i % 3) * 0.2 - 0.5,
          (i % 7) * 0.1 - 0.5,
          -0.2,
          0.35,
          0,
          0,
        ],
        i * 16,
      );
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        image.set([0.2 + x / w / 3, 0.25 + y / h / 4, 0.3], 3 * (y * w + x));
    device.addEventListener("uncapturederror", (event) => errors.push(event.error.message));
    const base64 = (bytes) => {
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768)
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(binary);
    };
    const raw = async (buffer, size) => {
      const readback = device.createBuffer({
          size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        }),
        encoder = device.createCommandEncoder();
      try {
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, size);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const bytes = new Uint8Array(readback.getMappedRange().slice(0));
        readback.unmap();
        return base64(bytes);
      } finally {
        readback.destroy();
      }
    };
    const setup = (config) => {
      const trainer = new GSTrainer(device, { ...opts, ...config, gpu }, gpu.info);
      trainer.setup(
        { data: params.slice(), n, dc: "sigmoid" },
        [camera],
        [{ tw: w, th: h, rgb: image }],
        w,
        h,
        1,
      );
      return trainer;
    };
    try {
      for (const config of [
        { serialSort: false, tileGrad: true },
        { serialSort: true, tileGrad: true },
        { serialSort: true, tileGrad: false },
      ]) {
        device.pushErrorScope("validation");
        const trainer = setup(config),
          bytes = {};
        try {
          trainer._writeTrainUniforms(trainer.camUniforms[0]);
          device.queue.writeBuffer(trainer.bufTileCnt, 0, trainer.tileZero);
          const encoder = device.createCommandEncoder(),
            pass = encoder.beginComputePass();
          trainer.encodeRaster(pass, trainer.camMeta[0], true);
          pass.end();
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
          for (const [kind, buffer, size] of [
            ["entries", trainer.bufEntries, opts.entriesCap * 8],
            ["gradients", trainer.bufGradP, n * 16 * 4],
            ["output", trainer.bufOut, w * h * 4 * 4],
            ["stats", trainer.bufStats, 16],
            ["starts", trainer.bufTileStart, (trainer.maxTiles + 1) * 4],
            ["cursors", trainer.bufTileCursor, trainer.maxTiles * 4],
          ])
            bytes[kind] = await raw(buffer, size);
        } finally {
          trainer.dispose();
        }
        // Fresh buffers ensure the gradient-only probe cannot affect training.
        const trained = setup(config);
        try {
          for (let i = 0; i < 3; i++) {
            trained.stepOnce();
            await device.queue.onSubmittedWorkDone();
          }
          const model = await trained.readGaussians(),
            blob = gaussiansToPly(model.data, model.n, model.sh, model.shK, model.dc),
            ply = new Uint8Array(await blob.arrayBuffer()),
            parsed = readSplatPly(ply);
          bytes.trainedParameters = base64(new Uint8Array(model.data.buffer));
          bytes.ply = base64(ply);
          rows.push({
            ...config,
            bytes,
            iterations: trained.iter,
            count: parsed.count,
            changed: model.data.some((v, i) => v !== params[i]),
            finite: [
              model.data,
              parsed.pos,
              parsed.scales,
              parsed.opacity,
              parsed.color,
              parsed.quat,
            ].every((values) => values && Array.from(values).every(Number.isFinite)),
          });
        } finally {
          trained.dispose();
        }
        const error = await device.popErrorScope();
        if (error) errors.push(error.message);
      }
      await device.queue.onSubmittedWorkDone();
      return { rows, errors };
    } finally {
      gpu.dispose();
    }
  });
  expect(result.errors).toEqual([]);
  const files = [];
  for (const row of result.rows) {
    for (const [kind, encoded] of Object.entries(row.bytes))
      files.push(
        await saveRaw(
          testInfo,
          `${row.serialSort ? (row.tileGrad ? "serial" : "serial-direct") : "bitonic"}-${kind}.bin`,
          Buffer.from(encoded, "base64"),
        ),
      );
    expect(row.iterations).toBe(3);
    expect(row.count).toBe(96);
    expect(row.changed).toBe(true);
    expect(row.finite).toBe(true);
  }
  for (const row of result.rows.slice(1))
    for (const kind of Object.keys(result.rows[0].bytes))
      expect(row.bytes[kind], `${kind} must remain byte-identical`).toBe(
        result.rows[0].bytes[kind],
      );
  const gradients = Buffer.from(result.rows[0].bytes.gradients, "base64"),
    output = Buffer.from(result.rows[0].bytes.output, "base64"),
    stats = Buffer.from(result.rows[0].bytes.stats, "base64");
  expect(
    Array.from(new Int32Array(gradients.buffer, gradients.byteOffset, gradients.length / 4)).some(
      (v) => v !== 0,
    ),
  ).toBe(true);
  expect(
    Array.from(new Float32Array(output.buffer, output.byteOffset, output.length / 4)).every(
      Number.isFinite,
    ),
  ).toBe(true);
  expect(new Uint32Array(stats.buffer, stats.byteOffset, 4)[2]).toBe(48 * 32);
  expect(new Uint32Array(stats.buffer, stats.byteOffset, 4)[3]).toBe(0);
  await testInfo.attach("raster-proof", {
    body: JSON.stringify({ files, iterations: 3, count: 96, noEntryDrops: true, byteExact: true }),
    contentType: "application/json",
  });
});
