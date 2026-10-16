// MIT. Made by Ryan with Codex (GPT-6). CPU ownership and exact-chunk tests; no GPU timing claim.
import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { gpuMatchAll } from "../vendor/splatjs/src/sfm/gpumatch.js";
import { matchSift } from "../vendor/splatjs/src/sfm/sift.js";
import { runSfM } from "../vendor/splatjs/src/sfm/sfm.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const shaderHash = "e0da9c2eb7c2a0830813efd3593538a031e4d4f39676a0feae6c176c4734c3d1";

function features(count = 9, image = 0) {
  const desc = new Uint8Array(count * 128);
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 128; k++) desc[i * 128 + k] = (i * 29 + k * 17 + (k % 7) * i + image) % 256;
  // Ties and high uint8 values exercise nearest/second-nearest ordering.
  if (count > 2) desc.copyWithin(2 * 128, 0, 128);
  return { n: count, desc, sift: true, x: new Float32Array(count), y: new Float32Array(count) };
}

function fakeDevice({ fail, mapGate, onSubmit } = {}) {
  const buffers = [],
    dispatches = [],
    shaders = [];
  let writes = 0;
  const trip = (name) => {
    if (fail === name) throw new Error(`injected ${name}`);
  };
  const device = {
    buffers,
    dispatches,
    shaders,
    destroyed: 0,
    createShaderModule({ code }) {
      shaders.push(code);
      return {};
    },
    createComputePipeline() {
      return { getBindGroupLayout: () => ({}) };
    },
    createBuffer({ size }) {
      trip(`buffer${buffers.length + 1}`);
      const buffer = {
        data: new ArrayBuffer(size),
        destroyed: 0,
        mapped: false,
        async mapAsync() {
          trip("map");
          if (mapGate) await mapGate.promise;
          this.mapped = true;
        },
        getMappedRange() {
          trip("range");
          return this.data;
        },
        unmap() {
          trip("unmap");
          this.mapped = false;
        },
        destroy() {
          this.destroyed++;
          this.mapped = false;
        },
      };
      buffers.push(buffer);
      return buffer;
    },
    createBindGroup({ entries }) {
      trip("bind");
      return entries.map((e) => e.resource.buffer);
    },
    createCommandEncoder() {
      trip("encode");
      const command = {};
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup(_index, buffers) {
              command.bind = buffers;
            },
            dispatchWorkgroups(x, y) {
              command.x = x;
              command.y = y;
            },
            end() {},
          };
        },
        copyBufferToBuffer(source, _a, target, _b, size) {
          command.copy = { source, target, size };
        },
        finish() {
          return command;
        },
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        trip(`write${++writes}`);
        new Uint8Array(buffer.data).set(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
          offset,
        );
      },
      submit(commands) {
        trip("submit");
        for (const command of commands) {
          const [descriptors, jobsBuffer, output] = command.bind,
            bytes = new Uint8Array(descriptors.data),
            jobs = new Uint32Array(jobsBuffer.data),
            out = new Uint32Array(output.data);
          // Emulate only the unchanged shader's integer L2 table, independently from matchSift.
          for (let job = 0; job < command.y; job++) {
            const [offA, nA, offB, nB, outOff] = jobs.slice(job * 8, job * 8 + 5);
            for (let a = 0; a < nA; a++) {
              let best = 0xffffffff,
                second = best,
                bestIndex = best;
              for (let b = 0; b < nB; b++) {
                let distance = 0;
                for (let k = 0; k < 128; k++) {
                  const d = bytes[offA * 4 + a * 128 + k] - bytes[offB * 4 + b * 128 + k];
                  distance += d * d;
                }
                if (distance < best) {
                  second = best;
                  best = distance;
                  bestIndex = b;
                } else if (distance < second) second = distance;
              }
              out.set([bestIndex, best, second], outOff + a * 3);
            }
          }
          const { source, target, size } = command.copy;
          new Uint8Array(target.data).set(new Uint8Array(source.data, 0, size));
          dispatches.push({
            x: command.x,
            y: command.y,
            jobs: Array.from(jobs),
            raw: Array.from(out),
          });
          onSubmit?.(dispatches.length);
        }
      },
    },
    destroy() {
      this.destroyed++;
    },
  };
  return device;
}

function install(gpu = {}) {
  const names = ["navigator", "GPUBufferUsage", "GPUMapMode"],
    before = names.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const [key, value] of Object.entries({
    navigator: { gpu },
    GPUBufferUsage: { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4, MAP_READ: 8 },
    GPUMapMode: { READ: 1 },
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  return () =>
    names.forEach((key, i) => {
      if (before[i]) Object.defineProperty(globalThis, key, before[i]);
      else delete globalThis[key];
    });
}
const released = (device, owned = false) => {
  expect(device.buffers.every((buffer) => buffer.destroyed === 1 && !buffer.mapped)).toBe(true);
  expect(device.destroyed).toBe(owned ? 1 : 0);
};

test("exact pair chunks preserve default raw integer tables, match order, and unchanged shader", async () => {
  const restore = install(),
    feats = [features(9), features(7, 1), features(11, 2)],
    pairs = [
      [0, 1],
      [2, 0],
      [1, 2],
      [0, 2],
      [0, 1],
    ],
    expected = pairs.map(([i, j]) =>
      matchSift(feats[i].desc, feats[i].n, feats[j].desc, feats[j].n),
    );
  try {
    let rawDefault;
    for (const maxPairsPerChunk of [undefined, 1, 2, 4, 8]) {
      const device = fakeDevice(),
        progress = [],
        result = await gpuMatchAll(
          feats,
          pairs,
          0.8,
          () => {},
          device,
          (done, total) => progress.push([done, total]),
          { maxPairsPerChunk },
        );
      expect(result).toEqual(expected);
      const raw = device.dispatches.flatMap((d) => d.raw);
      if (rawDefault) expect(raw).toEqual(rawDefault);
      else rawDefault = raw;
      expect(device.dispatches.map((d) => d.y / 2)).toEqual(
        maxPairsPerChunk === undefined || maxPairsPerChunk >= 5
          ? [5]
          : maxPairsPerChunk === 1
            ? [1, 1, 1, 1, 1]
            : maxPairsPerChunk === 2
              ? [2, 2, 1]
              : [4, 1],
      );
      expect(progress.at(-1)).toEqual([5, 5]);
      expect(hash(device.shaders[0])).toBe(shaderHash);
      released(device);
    }
  } finally {
    restore();
  }
});

test("chunk bounds and pre-abort reject before GPU allocation; no pairs allocates nothing", async () => {
  let requests = 0;
  const restore = install({
    requestAdapter: () => {
      requests++;
      throw new Error("unexpected adapter");
    },
  });
  try {
    for (const maxPairsPerChunk of [0, -1, 1.5, NaN, Infinity, "4", null, 32768])
      await expect(
        gpuMatchAll([], [], 0.8, () => {}, null, null, { maxPairsPerChunk }),
      ).rejects.toThrow(/maxPairsPerChunk/);
    const controller = new AbortController();
    controller.abort();
    await expect(
      gpuMatchAll([], [], 0.8, () => {}, null, null, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(await gpuMatchAll([], [])).toEqual([]);
    expect(requests).toBe(0);
  } finally {
    restore();
  }
});

test("every partial GPU allocation is released on allocation, submission, mapping, or readback errors", async () => {
  const restore = install();
  try {
    for (const fail of [
      "buffer2",
      "buffer3",
      "buffer4",
      "write2",
      "bind",
      "encode",
      "submit",
      "map",
      "range",
      "unmap",
    ]) {
      const device = fakeDevice({ fail });
      await expect(
        gpuMatchAll([features(), features()], [[0, 1]], 0.8, () => {}, device),
      ).rejects.toThrow(`injected ${fail}`);
      released(device);
    }
  } finally {
    restore();
  }
});

test("abort during pending map settles promptly, removes its listener, and never dispatches later chunks", async () => {
  const gate = deferred(),
    controller = new AbortController(),
    device = fakeDevice({ mapGate: gate }),
    restore = install(),
    signal = controller.signal,
    listeners = new Set(),
    add = signal.addEventListener.bind(signal),
    remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (name, fn, options) => {
    if (name === "abort") listeners.add(fn);
    add(name, fn, options);
  };
  signal.removeEventListener = (name, fn, options) => {
    listeners.delete(fn);
    remove(name, fn, options);
  };
  const pending = gpuMatchAll(
    [features(), features()],
    [
      [0, 1],
      [1, 0],
    ],
    0.8,
    () => {},
    device,
    null,
    { signal, maxPairsPerChunk: 1 },
  ).then(
    () => "success",
    (e) => e.name,
  );
  try {
    await turn();
    expect(device.dispatches).toHaveLength(1);
    controller.abort();
    const result = await Promise.race([
      pending,
      new Promise((resolve) => setTimeout(() => resolve("still pending"), 30)),
    ]);
    expect(result).toBe("AbortError");
    expect(listeners.size).toBe(0);
    released(device);
  } finally {
    gate.reject(new Error("late destroyed mapping"));
    await pending;
    restore();
  }
});

test("temporary device is destroyed on success and on a late requestDevice after abort", async () => {
  for (const late of [false, true]) {
    const device = fakeDevice(),
      gate = deferred(),
      controller = new AbortController(),
      adapter = {
        limits: { maxStorageBufferBindingSize: 1 << 28, maxBufferSize: 1 << 28 },
        requestDevice: () => (late ? gate.promise : Promise.resolve(device)),
      },
      restore = install({ requestAdapter: async () => adapter });
    const pending = gpuMatchAll([features(), features()], [[0, 1]], 0.8, () => {}, null, null, {
      signal: controller.signal,
    }).then(
      () => "success",
      (e) => e.name,
    );
    try {
      if (late) {
        await turn();
        controller.abort();
      }
      const result = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve("still pending"), 30)),
      ]);
      expect(result).toBe(late ? "AbortError" : "success");
      if (late) {
        gate.resolve(device);
        await turn();
      }
      released(device, true);
    } finally {
      gate.resolve(device);
      await pending;
      restore();
    }
  }
});

test("deadline timers can abort between exact chunks even with immediately resolved maps", async () => {
  const controller = new AbortController(),
    device = fakeDevice({ onSubmit: () => setTimeout(() => controller.abort(), 0) }),
    restore = install();
  try {
    await expect(
      gpuMatchAll(
        [features(), features()],
        [
          [0, 1],
          [1, 0],
        ],
        0.8,
        () => {},
        device,
        null,
        { signal: controller.signal, maxPairsPerChunk: 1 },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(device.dispatches).toHaveLength(1);
    released(device);
  } finally {
    restore();
  }
});

test("pending adapter cancellation and owned-device readback errors release their ownership", async () => {
  const controller = new AbortController(),
    gate = deferred(),
    restore = install({ requestAdapter: () => gate.promise });
  const pending = gpuMatchAll([features(), features()], [[0, 1]], 0.8, () => {}, null, null, {
    signal: controller.signal,
  }).then(
    () => "success",
    (e) => e.name,
  );
  try {
    controller.abort();
    expect(
      await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve("still pending"), 30)),
      ]),
    ).toBe("AbortError");
  } finally {
    gate.resolve(null);
    await pending;
    restore();
  }
  const device = fakeDevice({ fail: "map" }),
    restoreOwned = install({
      requestAdapter: async () => ({
        limits: { maxStorageBufferBindingSize: 1 << 28, maxBufferSize: 1 << 28 },
        requestDevice: async () => device,
      }),
    });
  try {
    await expect(gpuMatchAll([features(), features()], [[0, 1]])).rejects.toThrow("injected map");
    released(device, true);
  } finally {
    restoreOwned();
  }
});

test("SfM forwards cancellation and exact chunk size without CPU fallback after abort", async () => {
  const controller = new AbortController(),
    device = fakeDevice(),
    restore = install(),
    logs = [],
    images = Array.from({ length: 6 }, () => ({ fw: 16, fh: 16, gray: new Float32Array(256) }));
  try {
    await expect(
      runSfM(
        images,
        (message) => logs.push(message),
        () => [0, 0, 0],
        {
          _feats: images.map((_, i) => features(9, i)),
          gpu: { device },
          signal: controller.signal,
          maxPairsPerChunk: 2,
          workers: false,
          onEvent(event) {
            if (event.stage === "matching") controller.abort();
          },
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(device.dispatches.map((d) => d.y / 2)).toEqual([2]);
    expect(logs.some((line) => line.includes("CPU fallback"))).toBe(false);
    released(device);
  } finally {
    restore();
  }
});
