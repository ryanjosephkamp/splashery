// MIT. CPU ownership controls; actual packed-target fitting is tested on WebGPU separately.
import { test, expect } from "@playwright/test";
import { Session } from "../vendor/splatjs/src/session.js";
import { GSTrainer } from "../vendor/splatjs/src/gs/trainer.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test("background fitting joins the active frame and suppresses preview and training until it releases", async () => {
  const frame = deferred(),
    fit = deferred(),
    calls = [],
    session = new Session();
  const trainer = {
    fitBackground: async (options) => {
      calls.push(options);
      return fit.promise;
    },
    dispose() {},
  };
  session.trainer = trainer;
  session.holdout = 2;
  session.testCams = [3];
  session._frameRunning = frame.promise;
  const work = session.fitBackground();
  await Promise.resolve();
  expect(calls).toHaveLength(0);
  expect(() => session.start()).toThrow(/background fitting/);
  session._scheduleFrame();
  expect(session._framePending).toBe(false);
  frame.resolve();
  for (let i = 0; i < 5 && !calls.length; i++) await Promise.resolve();
  expect(calls).toHaveLength(1);
  expect(calls[0].validationCams).toEqual([2, 3]);
  expect(calls[0].isCurrent()).toBe(true);
  await expect(session.fitBackground()).rejects.toThrow(/already running/);
  fit.resolve({ accepted: false, reason: "test" });
  expect(await work).toEqual({ accepted: false, reason: "test" });
  expect(session._backgroundFitTrainer).toBe(null);
  session.dispose();
});

test("a late background read cannot return a result or change scheduling for a replacement trainer", async () => {
  const fit = deferred(),
    session = new Session();
  let options;
  const old = {
    fitBackground: async (value) => {
      options = value;
      return fit.promise;
    },
    dispose() {},
  };
  session.trainer = old;
  const work = session.fitBackground();
  for (let i = 0; i < 8 && !options; i++) await Promise.resolve();
  expect(options.isCurrent()).toBe(true);
  const next = { dispose() {} };
  session.trainer = next;
  session._backgroundFitTrainer = next;
  expect(options.isCurrent()).toBe(false);
  fit.resolve({ accepted: true });
  await expect(work).rejects.toMatchObject({ name: "AbortError" });
  expect(session._backgroundFitTrainer).toBe(next);
  expect(session._finishing).toBeFalsy();
  session.dispose();
});

for (const failure of ["cancel-map", "encode"]) {
  test(`background fitting releases its temporary GPU readback on ${failure}`, async () => {
    const previous = ["GPUBufferUsage", "GPUMapMode"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]);
    Object.defineProperty(globalThis, "GPUBufferUsage", {
      configurable: true,
      value: { COPY_DST: 1, MAP_READ: 2 },
    });
    Object.defineProperty(globalThis, "GPUMapMode", { configurable: true, value: { READ: 1 } });
    const pending = deferred(),
      controller = new AbortController(),
      buffers = [];
    try {
      const trainer = Object.assign(Object.create(GSTrainer.prototype), {
        opts: { fitBackground: true },
        ssaa: 1,
        holdout: 1,
        excluded: new Set(),
        camMeta: [
          { w: 1, h: 1, offset: 0 },
          { w: 1, h: 1, offset: 1 },
        ],
        _camUniform: () => {
          const u = new Float32Array(40);
          u[19] = 1;
          return u;
        },
        encodeRaster() {
          if (failure === "encode") throw new Error("encoding failed");
        },
        device: {
          createBuffer() {
            const rb = {
              destroyed: 0,
              unmapped: 0,
              mapAsync: () => pending.promise,
              unmap() {
                this.unmapped++;
              },
              destroy() {
                this.destroyed++;
              },
            };
            buffers.push(rb);
            return rb;
          },
          queue: { writeBuffer() {}, submit() {} },
          createCommandEncoder: () => ({
            beginComputePass: () => ({ end() {} }),
            copyBufferToBuffer() {},
            finish() {},
          }),
        },
      });
      const work = trainer.fitBackground({ validationCams: [1], signal: controller.signal });
      if (failure === "cancel-map") {
        expect(buffers).toHaveLength(1);
        controller.abort();
        await expect(work).rejects.toMatchObject({ name: "AbortError" });
        pending.resolve();
      } else await expect(work).rejects.toThrow("encoding failed");
      expect(buffers).toHaveLength(1);
      expect(buffers[0].destroyed).toBe(1);
      expect(buffers[0].unmapped).toBe(1);
    } finally {
      for (const [name, value] of previous) {
        if (value) Object.defineProperty(globalThis, name, value);
        else delete globalThis[name];
      }
    }
  });
}
