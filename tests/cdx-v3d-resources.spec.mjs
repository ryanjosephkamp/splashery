import { test, expect } from "@playwright/test";
import { Session } from "../vendor/splatjs/src/session.js";
import { GSTrainer } from "../vendor/splatjs/src/gs/trainer.js";
import { runWorkerPool } from "../vendor/splatjs/src/sfm/worker-pool.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
const points = (n = 20) =>
  Array.from({ length: n }, (_, i) => ({
    X: [i, i % 3, 2 + (i % 7)],
    rgb: [0.2, 0.4, 0.6],
  }));
function session(options = {}) {
  const s = new Session({ maskTraining: false, initTarget: 40, ...options });
  s.recon = { points: points(), cams: [] };
  s.gpu = { owned: false, info: {}, dispose() {} };
  return s;
}
function pool(options = {}) {
  const workers = [];
  const work = runWorkerPool({
    url: "fake-worker",
    size: 2,
    jobs: [0, 1, 2, 3],
    message: (id) => ({ id }),
    onResult() {},
    createWorker() {
      const w = {
        messages: [],
        terminated: 0,
        postMessage(message) {
          this.messages.push(message);
        },
        terminate() {
          this.terminated++;
        },
        reply(data) {
          this.onmessage?.({ data });
        },
      };
      workers.push(w);
      return w;
    },
    ...options,
  });
  return { workers, work };
}

function pendingMetricSession() {
  const readback = deferred(),
    oldFence = deferred(),
    effects = [],
    s = session({ maxIters: 20, itersPerFrame: 1, fenceRing: 2 });
  const oldTrainer = {
    iter: 0,
    n: 20,
    camMeta: [{}],
    stepOnce() {
      this.iter++;
    },
    readLoss() {
      effects.push("old readLoss started");
      return readback.promise;
    },
    device: {
      queue: {
        onSubmittedWorkDone() {
          effects.push("old device fence requested");
          return oldFence.promise;
        },
      },
    },
    dispose() {},
  };
  s.trainer = oldTrainer;
  s.view._tick = () => effects.push("view ticked");
  s.on("metrics", () => effects.push("metrics emitted"));
  return { s, readback, oldFence, effects };
}

test("a readLoss completing after disposal cannot emit metrics or submit more GPU work", async () => {
  const originalRaf = globalThis.requestAnimationFrame,
    callbacks = [],
    { s, readback, oldFence, effects } = pendingMetricSession();
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback);
  try {
    s.start();
    s._lastStats = performance.now() - 10000;
    callbacks.shift()();
    await turn();
    expect(effects).toEqual(["old readLoss started"]);
    s.dispose();
    effects.length = 0;
    readback.resolve(0.1);
    await turn();
    expect({
      lateEffects: effects,
      disposedFenceRetained: s._fences.includes(oldFence.promise),
    }).toEqual({ lateEffects: [], disposedFenceRetained: false });
  } finally {
    readback.resolve(0.1);
    oldFence.resolve();
    s.dispose();
    await turn();
    if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRaf;
  }
});

test("a readLoss completing after recovery cannot contaminate the replacement trainer's fence ring", async () => {
  const originalRaf = globalThis.requestAnimationFrame,
    callbacks = [],
    replacementFence = deferred(),
    { s, readback, oldFence, effects } = pendingMetricSession();
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback);
  const replacement = {
    iter: 0,
    n: 30,
    camMeta: [{}],
    stepOnce() {
      this.iter++;
    },
    device: { queue: { onSubmittedWorkDone: () => replacementFence.promise } },
    dispose() {},
  };
  try {
    s.start();
    s._lastStats = performance.now() - 10000;
    callbacks.shift()();
    await turn();
    expect(effects).toEqual(["old readLoss started"]);
    s._deviceLost({ reason: "destroyed", message: "test device loss" });
    // Substitute only GPU reinitialization; recovery and both frame loops stay real.
    s.seed = async () => {
      s.trainer = replacement;
      return s.model;
    };
    await s.recover();
    s.start();
    for (let i = 0; i < 3; i++) {
      expect(callbacks.length).toBeGreaterThan(0);
      callbacks.shift()();
      await turn();
    }
    expect(replacement.iter).toBe(3);
    expect(s._frameRunning).not.toBeNull();
    expect(s._fences).toHaveLength(2);
    expect(s._fences.every((fence) => fence === replacementFence.promise)).toBe(true);
    effects.length = 0;
    readback.resolve(0.1);
    await turn();
    expect({
      lateEffects: effects,
      oldDeviceFenceInReplacementRing: s._fences.includes(oldFence.promise),
      onlyReplacementFences: s._fences.every((fence) => fence === replacementFence.promise),
      replacementIterations: replacement.iter,
    }).toEqual({
      lateEffects: [],
      oldDeviceFenceInReplacementRing: false,
      onlyReplacementFences: true,
      replacementIterations: 3,
    });
  } finally {
    readback.resolve(0.1);
    oldFence.resolve();
    replacementFence.resolve();
    s.dispose();
    await turn();
    if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRaf;
  }
});

test("phone pause and resume never overlap a pending GPU frame, and Finish joins it", async () => {
  const originalRaf = globalThis.requestAnimationFrame,
    callbacks = [],
    fence = deferred(),
    events = [],
    metrics = [];
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback);
  const s = session({ maxIters: 10, itersPerFrame: 1, fenceRing: 0 });
  s.trainer = {
    iter: 0,
    n: 20,
    camMeta: [{}],
    device: { queue: { onSubmittedWorkDone: () => fence.promise } },
    stepOnce() {
      this.iter++;
    },
    dispose() {},
  };
  s.view._tick = () => {};
  s._emitMetrics = async (final) => metrics.push({ final, iter: s.trainer.iter });
  s.on("event", (event) => events.push(event));
  try {
    s.start();
    expect(callbacks).toHaveLength(1);
    callbacks.shift()();
    expect(s.trainer.iter).toBe(1);
    for (let i = 0; i < 3; i++) {
      s.pause();
      s.start();
    }
    expect(callbacks).toHaveLength(0);
    expect(s.trainer.iter).toBe(1);
    const finished = s.finish(),
      finishedAgain = s.finish();
    s.start(); // A late duty-cycle tick cannot restart a finishing run.
    await turn();
    expect(metrics).toEqual([]);
    expect(events).toEqual([]);
    expect(s.training).toBe(false);
    fence.resolve();
    await Promise.all([finished, finishedAgain]);
    expect(metrics).toEqual([{ final: true, iter: 1 }]);
    expect(events).toEqual([{ kind: "train-complete", iter: 1, splats: 20 }]);
    expect(callbacks).toHaveLength(0);
    expect(s._frameRunning).toBeNull();
  } finally {
    fence.resolve();
    s.dispose();
    if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRaf;
  }
});

test("a resume request starts one next frame after its pending GPU fence settles", async () => {
  const originalRaf = globalThis.requestAnimationFrame,
    callbacks = [],
    fence = deferred();
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback);
  const s = session({ maxIters: 10, itersPerFrame: 1, fenceRing: 0 });
  s.trainer = {
    iter: 0,
    n: 20,
    camMeta: [{}],
    device: { queue: { onSubmittedWorkDone: () => fence.promise } },
    stepOnce() {
      this.iter++;
    },
    dispose() {},
  };
  s.view._tick = () => {};
  try {
    s.start();
    callbacks.shift()();
    s.pause();
    s.start();
    s.pause();
    s.start();
    expect(callbacks).toHaveLength(0);
    fence.resolve();
    await turn();
    expect(callbacks).toHaveLength(1);
    expect(s.trainer.iter).toBe(1);
    callbacks.shift()();
    expect(s.trainer.iter).toBe(2);
    s.pause();
    await turn();
    s.dispose();
    for (const callback of callbacks) callback();
    expect(s.trainer).toBeNull();
  } finally {
    fence.resolve();
    s.dispose();
    if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRaf;
  }
});

test("Finish joins automatic completion without a second final readback or completion event", async () => {
  const originalRaf = globalThis.requestAnimationFrame,
    callbacks = [],
    readback = deferred(),
    events = [];
  let metricCalls = 0;
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback);
  const s = session({ maxIters: 3 });
  s.trainer = {
    iter: 3,
    n: 20,
    camMeta: [{}],
    device: { queue: { onSubmittedWorkDone: async () => {} } },
    dispose() {},
  };
  s.view._tick = () => {};
  s._emitMetrics = async () => {
    metricCalls++;
    await readback.promise;
  };
  s.on("event", (event) => events.push(event));
  try {
    s.start();
    callbacks.shift()();
    expect(metricCalls).toBe(1);
    const finishing = s.finish();
    expect(events).toEqual([]);
    readback.resolve();
    await finishing;
    expect(metricCalls).toBe(1);
    expect(events).toEqual([{ kind: "train-complete", iter: 3, splats: 20 }]);
    await s.finish();
    expect(metricCalls).toBe(1);
    expect(events).toHaveLength(1);
  } finally {
    readback.resolve();
    s.dispose();
    if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRaf;
  }
});

test("SfM pool abort stops queued jobs and terminates all active workers", async () => {
  const ctrl = new AbortController(),
    results = [];
  const { workers, work } = pool({ signal: ctrl.signal, onResult: (r) => results.push(r) });
  expect(workers.map((w) => w.messages)).toEqual([[{ id: 0 }], [{ id: 1 }]]);
  const late = workers[0].onmessage;
  ctrl.abort();
  await expect(work).rejects.toMatchObject({ name: "AbortError" });
  late({ data: "late result" });
  expect(results).toEqual([]);
  expect(workers.map((w) => w.messages.length)).toEqual([1, 1]);
  expect(workers.map((w) => w.terminated)).toEqual([1, 1]);
  expect(workers.every((w) => w.onmessage === null && w.onerror === null)).toBe(true);
  const before = pool({ signal: ctrl.signal });
  await expect(before.work).rejects.toMatchObject({ name: "AbortError" });
  expect(before.workers).toHaveLength(0);
});

test("SfM pool errors, handler errors, and constructor failures release every worker", async () => {
  const failed = pool();
  failed.workers[0].onerror({ message: "broken worker" });
  await expect(failed.work).rejects.toThrow(/broken worker/);
  expect(failed.workers.map((w) => w.terminated)).toEqual([1, 1]);
  const handler = pool({
    onResult() {
      throw new Error("invalid worker result");
    },
  });
  handler.workers[0].reply({});
  await expect(handler.work).rejects.toThrow(/invalid worker result/);
  expect(handler.workers.map((w) => w.terminated)).toEqual([1, 1]);
  const constructed = [];
  await expect(
    runWorkerPool({
      url: "fake",
      size: 2,
      jobs: [0, 1],
      message: (id) => id,
      onResult() {},
      createWorker() {
        if (constructed.length) throw new Error("constructor failed");
        const w = {
          postMessage() {},
          terminate() {
            this.closed = true;
          },
        };
        constructed.push(w);
        return w;
      },
    }),
  ).rejects.toThrow(/constructor failed/);
  expect(constructed[0].closed).toBe(true);
});

test("SfM pool preserves result/job association and closes workers after success", async () => {
  const results = [];
  const { workers, work } = pool({ onResult: (result, job) => results.push([result, job]) });
  workers[1].reply("one");
  workers[0].reply("zero");
  workers[1].reply("two");
  workers[0].reply("three");
  await work;
  expect(results).toEqual([
    ["one", 1],
    ["zero", 0],
    ["two", 2],
    ["three", 3],
  ]);
  expect(workers.map((w) => w.terminated)).toEqual([1, 1]);
});

test("a disposed session destroys a device that arrives after GPU creation", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const device = deferred();
  let requested = false,
    destroyed = 0;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      gpu: {
        requestAdapter: async () => ({
          features: new Set(),
          limits: { maxStorageBufferBindingSize: 1e8, maxBufferSize: 1e8 },
          requestDevice() {
            requested = true;
            return device.promise;
          },
        }),
      },
    },
  });
  const s = session();
  s.gpu = null;
  try {
    const pending = s.seed();
    await turn();
    expect(requested).toBe(true);
    s.dispose();
    device.resolve({
      destroy() {
        destroyed++;
      },
    });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(destroyed).toBe(1);
    expect(s.gpu).toBeNull();
    expect(s.trainer).toBeNull();
  } finally {
    s.dispose();
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
});

test("late trainer completion cannot revive a disposed seed or continuation", async () => {
  const original = GSTrainer.create;
  try {
    for (const operation of ["seed", "seedFrom"]) {
      const trainer = deferred();
      let created = 0,
        released = 0,
        setup = 0,
        gpuReleased = 0;
      GSTrainer.create = () => {
        created++;
        return trainer.promise;
      };
      const s = session();
      s.gpu = {
        owned: true,
        info: {},
        dispose() {
          gpuReleased++;
        },
      };
      s._setupTrainer = () => setup++;
      const pending =
        operation === "seed" ? s.seed() : s.seedFrom({ n: 1, data: new Float32Array(16) });
      await turn();
      expect(created).toBe(1);
      s.dispose();
      trainer.resolve({
        dispose() {
          released++;
        },
      });
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(released).toBe(1);
      expect(gpuReleased).toBe(1);
      expect(setup).toBe(0);
      expect(s.trainer).toBeNull();
      expect(s.gpu).toBeNull();
    }
  } finally {
    GSTrainer.create = original;
  }
});

test("canceling load closes a late bitmap and prevents frame publication", async () => {
  const original = globalThis.createImageBitmap,
    bitmap = deferred();
  let decoding = 0,
    closed = 0;
  globalThis.createImageBitmap = () => {
    decoding++;
    return bitmap.promise;
  };
  const s = new Session();
  s._slicePanos = async () => ({ prepared: [{ source: {} }, { source: {} }], rigs: null });
  try {
    const pending = s.load([{}, {}]);
    await turn();
    expect(decoding).toBe(1);
    s.dispose();
    bitmap.resolve({
      width: 8,
      height: 6,
      close() {
        closed++;
      },
    });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(closed).toBe(1);
    expect(decoding).toBe(1);
    expect(s.frames).toEqual([]);
  } finally {
    globalThis.createImageBitmap = original;
    s.dispose();
  }
});

test("trainer disposal frees its buffers without destroying a host-owned device", async () => {
  let bufferDestroyed = 0,
    hostDestroyed = 0;
  const b = {
    destroy() {
      bufferDestroyed++;
    },
  };
  const trainer = Object.assign(Object.create(GSTrainer.prototype), {
    device: {
      destroy() {
        hostDestroyed++;
      },
    },
    bufParams: b,
    bufShDummy: [b],
    uniTrain: {
      destroy() {
        bufferDestroyed++;
      },
    },
    n: 1,
  });
  const s = new Session();
  s.gpu = {
    owned: false,
    device: trainer.device,
    dispose() {
      hostDestroyed++;
    },
  };
  s.trainer = trainer;
  s.dispose();
  s.dispose();
  trainer.dispose();
  expect(bufferDestroyed).toBe(2);
  expect(hostDestroyed).toBe(0);
  expect(s.trainer).toBeNull();
  await expect(s.seed()).rejects.toMatchObject({ name: "AbortError" });
});

// Exercise the real trainer's count/cap/upload path, intercepting its first buffer write.
// No device, shader, or browser is created; subsequent GPU setup is outside this CPU test.
async function captureSeed(extra, options = {}) {
  const original = GSTrainer.create,
    usage = globalThis.GPUBufferUsage;
  const stop = Symbol("captured upload");
  let uploaded;
  const s = session({ trainer: { maxSplats: 30 }, ...options });
  globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
  GSTrainer.create = async (trainerOptions) => {
    const t = Object.assign(Object.create(GSTrainer.prototype), {
      opts: trainerOptions,
      dcMode: "sigmoid",
      shK: 0,
      bindLimit: 1e8,
      device: {
        limits: { maxStorageBufferBindingSize: 1e8 },
        createBuffer: () => ({ destroy() {} }),
        queue: {
          writeBuffer(_buffer, _offset, data, offset, length) {
            uploaded = new Float32Array(data, offset, length / 4).slice();
            throw stop;
          },
        },
      },
    });
    const setup = t.setup.bind(t);
    t.setup = (...args) => {
      try {
        setup(...args);
      } catch (e) {
        if (e !== stop) throw e;
      }
    };
    return t;
  };
  try {
    const model = await s.seed(extra);
    return { model, uploaded, n: s.trainer.n, appended: s._appendedSeed };
  } finally {
    s.dispose();
    GSTrainer.create = original;
    if (usage === undefined) delete globalThis.GPUBufferUsage;
    else globalThis.GPUBufferUsage = usage;
  }
}

test("seedLimit reserves appended rows before the real trainer cap and covers the sparse cloud", async () => {
  const append = new Float32Array(8 * 16);
  for (let i = 0; i < 8; i++) {
    append[i * 16] = 1000 + i;
    append[i * 16 + 6] = 1;
  }
  const result = await captureSeed({
    seedLimit: 12,
    appendGaussians: { n: 8, data: append, protectIters: 220 },
  });
  expect(result.model.n).toBe(12);
  expect(result.n).toBe(12);
  expect(result.model.appendedSeedCount).toBe(8);
  expect(result.appended).toEqual({ from: 4, to: 12, protectIters: 220, freezePos: false });
  expect(Array.from({ length: 4 }, (_, i) => result.uploaded[i * 16])).toEqual([2, 7, 12, 17]);
  expect(result.uploaded.subarray(4 * 16)).toEqual(append);
  const ceiling = await captureSeed({ seedLimit: 100, appendGaussians: { n: 8, data: append } });
  expect(ceiling.n).toBe(30);
  expect(ceiling.model.n).toBe(30);
  expect(Array.from({ length: 20 }, (_, i) => ceiling.uploaded[i * 16])).toEqual(
    Array.from({ length: 20 }, (_, i) => i),
  );
  expect(ceiling.uploaded.subarray(22 * 16)).toEqual(append);
  const allAppend = await captureSeed({ seedLimit: 4, appendGaussians: { n: 8, data: append } });
  const legacy = await captureSeed({ appendGaussians: { n: 8, data: append } });
  expect(legacy.n).toBe(30);
  expect(legacy.model.appendedSeedCount).toBe(0);
  expect(legacy.appended).toBeNull();
  expect(allAppend.model.n).toBe(4);
  expect(allAppend.appended.from).toBe(0);
  expect(Array.from({ length: 4 }, (_, i) => allAppend.uploaded[i * 16])).toEqual([
    1001, 1003, 1005, 1007,
  ]);
});

test("omitting seedLimit preserves the existing Gaussian parameter bytes", async () => {
  const { initGaussians } = await import("../vendor/splatjs/src/gs/init.js");
  const result = await captureSeed({});
  const original = initGaussians(points(), 2);
  expect(result.model.n).toBe(original.n);
  expect(result.model.data).toEqual(original.data);
  await expect(captureSeed({ seedLimit: 0 })).rejects.toThrow(/positive integer/);
});

test("disposing a session aborts its actual SfM worker pool", async () => {
  const original = globalThis.Worker,
    workers = [];
  globalThis.Worker = class {
    constructor() {
      workers.push(this);
    }
    postMessage() {
      this.posted = true;
    }
    terminate() {
      this.closed = true;
    }
  };
  const s = session({ sfm: { workers: 2 } });
  s.frames = [0, 1].map(() => ({ fw: 8, fh: 6, gray: new Float32Array(48) }));
  try {
    const pending = s.solve();
    await turn();
    expect(workers).toHaveLength(2);
    expect(workers.every((w) => w.posted)).toBe(true);
    s.dispose();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(workers.every((w) => w.closed && w.onmessage === null)).toBe(true);
  } finally {
    s.dispose();
    if (original === undefined) delete globalThis.Worker;
    else globalThis.Worker = original;
  }
});

test("seedLimit remains a ceiling on weak solves and empty solves fail clearly", async () => {
  const weak = await captureSeed(
    { seedLimit: 15000 },
    { initTarget: 15000, trainer: { maxSplats: 30000 } },
  );
  expect(weak.model.n).toBe(20 * 201);
  expect(weak.n).toBe(20 * 201);
  expect(weak.model.n).toBeLessThan(15000);
  const nonbinding = await captureSeed(
    { seedLimit: 15000 },
    { initTarget: 40, trainer: { maxSplats: 30000 } },
  );
  expect(nonbinding.model.n).toBe(60); // A nonbinding ceiling never grows the legacy request.
  expect(Array.from({ length: 20 }, (_, i) => weak.uploaded[i * 16])).toEqual(
    Array.from({ length: 20 }, (_, i) => i),
  );
  const s = session();
  s.recon.points = [];
  try {
    for (const settings of [{}, { seedLimit: 15000 }])
      await expect(s.seed(settings)).rejects.toThrow(/no 3D points.*Try.*textured/);
    expect(s.model).toBeNull();
  } finally {
    s.dispose();
  }
});

test("a captured device-loss callback stays quiet after session disposal", async () => {
  let destroyed = 0;
  const s = new Session({
    device: {
      destroy() {
        destroyed++;
      },
    },
  });
  const events = [];
  s.on("event", (event) => events.push(event));
  const gpu = await s._getGpu();
  const late = gpu.onLost;
  s.dispose();
  late({ reason: "unknown", message: "late callback" });
  expect(s.deviceLost).toBe(false);
  expect(events).toEqual([]);
  expect(destroyed).toBe(0);
  expect(gpu.onLost).toBeNull();
});

test("surface rows survive the seed ceiling and train on actual WebGPU", async ({ page }) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { createSession } = await import("/vendor/splatjs/src/session.js");
    const { surfaceSeed } = await import("/src/video3d/surface-seed.js");
    const { readSplatPly } = await import("/src/video3d/ply.js");
    const { createGpu } = await import("/vendor/splatjs/src/gpu/context.js");
    const hostGpu = await createGpu();
    const errors = [];
    hostGpu.device.addEventListener("uncapturederror", (e) => errors.push(e.error.message));
    const frames = [0, 1].map((i) => ({
      name: `plane-${i}.jpg`,
      fw: 48,
      fh: 36,
      tw: 48,
      th: 36,
      rgb: Float32Array.from({ length: 48 * 36 * 3 }, (_, k) => {
        const pixel = Math.floor(k / 3),
          x = (pixel % 48) + 0.5,
          y = Math.floor(pixel / 48) + 0.5;
        return [
          0.4 + (((x - 24) / 32) * 2 + i * 0.15) * 0.05,
          0.5 + ((y - 18) / 32) * 2 * 0.05,
          0.3,
        ][k % 3];
      }),
    }));
    const points = [];
    for (let y = -0.8; y <= 0.81; y += 0.4)
      for (let x = -1; x <= 1.01; x += 0.5)
        points.push({ X: [x, y, 2], rgb: [0.4 + x * 0.05, 0.5 + y * 0.05, 0.3] });
    const recon = {
      points,
      cams: [0, 1].map((i) => ({
        imgIdx: i,
        R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        t: [-i * 0.15, 0, 0],
        f: 32,
      })),
    };
    const surface = surfaceSeed(recon, frames, { maxPoints: 40, stride: 2 });
    const session = createSession({
      device: hostGpu.device,
      maxIters: 3,
      refineStart: 10,
      maxViewW: 48,
      maxViewH: 36,
      lowMem: true,
      maskTraining: false,
      evalHoldEvery: 1e9,
      trainer: { shDeg: 0, maxSplats: 96 },
    });
    try {
      session.useFrames(frames);
      session.useReconstruction(recon);
      const model = await session.seed({
        initTarget: 96 - surface.n,
        seedLimit: 96,
        appendGaussians: surface,
      });
      const initial = { n: model.n, surface: model.appendedSeedCount, generated: surface.n };
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("The real GPU did not complete the small training run.")),
          60000,
        );
        session.on("event", (event) => {
          if (event.kind === "train-complete") {
            clearTimeout(timeout);
            resolve();
          }
          if (event.kind === "device-lost") {
            clearTimeout(timeout);
            reject(new Error("GPU device lost"));
          }
        });
        session.start();
      });
      const blob = await session.exportPlyBlob();
      const parsed = readSplatPly(new Uint8Array(await blob.arrayBuffer()));
      await session.gpu.device.queue.onSubmittedWorkDone();
      return {
        initial,
        iters: session.trainer.iter,
        count: parsed.count,
        finite: [parsed.pos, parsed.scales, parsed.opacity].every((values) =>
          Array.from(values).every(Number.isFinite),
        ),
        errors,
      };
    } finally {
      session.dispose();
      // Disposing the trainer releases its buffers while the supplied device remains usable.
      try {
        const encoder = hostGpu.device.createCommandEncoder();
        hostGpu.device.queue.submit([encoder.finish()]);
        await hostGpu.device.queue.onSubmittedWorkDone();
      } finally {
        hostGpu.dispose();
      }
    }
  });
  expect(result.initial.generated).toBeGreaterThan(0);
  expect(result.initial.surface).toBe(result.initial.generated);
  expect(result.initial.n).toBeLessThanOrEqual(96);
  expect(result.iters).toBe(3);
  expect(result.count).toBe(result.initial.n);
  expect(result.finite).toBe(true);
  expect(result.errors).toEqual([]);
});
