import { test, expect } from "@playwright/test";
import { Session } from "../vendor/splatjs/src/session.js";

function fixture(options = {}) {
  const session = new Session({ maxIters: 4, itersPerFrame: 1, ...options });
  const callbacks = [],
    events = [];
  session.trainer = {
    iter: 0,
    n: 2,
    opts: {},
    camMeta: [{}],
    stepOnce() {
      this.iter++;
    },
    device: { queue: { onSubmittedWorkDone: async () => {} } },
    async readLoss() {
      return 0.01;
    },
    dispose() {},
  };
  session.view._tick = () => {};
  session.on("event", (event) => events.push(event));
  session._ensureScheduler();
  session._sched.raf = (callback) => callbacks.push(callback);
  return { session, callbacks, events };
}

test("an encoding failure stops training immediately and cannot complete as a successful bake", async () => {
  const { session, callbacks, events } = fixture();
  const failure = new Error("deterministic command encoding failure");
  session.trainer.stepOnce = () => {
    throw failure;
  };
  try {
    session.start();
    callbacks.shift()();
    await session._frameRunning;
    await Promise.resolve();
    expect(session.training).toBe(false);
    expect(session.trainingError).toBe(failure);
    expect(callbacks).toHaveLength(0);
    expect(events.filter((e) => e.kind === "train-error")).toEqual([
      { kind: "train-error", iter: 0, message: failure.message },
    ]);
    expect(() => session.start()).toThrow(failure.message);
    await expect(session.finish()).rejects.toBe(failure);
    expect(events.filter((e) => e.kind === "train-complete")).toHaveLength(0);
  } finally {
    session.dispose();
  }
});

test("a failed asynchronous refinement reports the originating error once", async () => {
  const { session, callbacks, events } = fixture({ refineStart: 0, refineEvery: 1 });
  const failure = new Error("refinement readback failed");
  session.trainer.refine = async () => {
    throw failure;
  };
  try {
    session.start();
    callbacks.shift()();
    await session._frameRunning;
    expect(session.training).toBe(false);
    expect(session.trainingError).toBe(failure);
    await expect(session.finish()).rejects.toBe(failure);
    expect(events.map((e) => e.kind)).toEqual(["train-error"]);
  } finally {
    session.dispose();
  }
});

test("a rejected fence from a replaced trainer cannot fail its replacement", async () => {
  const { session, callbacks, events } = fixture({ fenceRing: 0 });
  let rejectFence;
  const fence = new Promise((_, reject) => {
    rejectFence = reject;
  });
  session.trainer.device.queue.onSubmittedWorkDone = () => fence;
  try {
    session.start();
    callbacks.shift()();
    const pending = session._frameRunning;
    const replacement = { ...session.trainer, iter: 0 };
    session.trainer = replacement;
    rejectFence(new Error("old device fence rejected"));
    await pending;
    expect(session.trainer).toBe(replacement);
    expect(session.training).toBe(true);
    expect(session.trainingError).toBeNull();
    expect(events).toEqual([]);
  } finally {
    session.dispose();
  }
});
