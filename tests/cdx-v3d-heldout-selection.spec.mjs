import { test, expect } from "@playwright/test";

test("held-out selection retains original midpoints whenever their intervals have unused frames", async () => {
  const { selectHeldoutTimes } = await import("../tools/v3d-bench-metrics.mjs");
  expect(typeof selectHeldoutTimes).toBe("function");
  expect(
    selectHeldoutTimes({
      cameras: Array.from({ length: 10 }, (_, time) => ({ time })),
      sourceTimes: Array.from({ length: 37 }, (_, i) => i / 4),
      attemptedTimes: Array.from({ length: 10 }, (_, i) => i),
      trainingTimes: Array.from({ length: 10 }, (_, i) => i),
      fps: 24,
    }),
  ).toEqual([1.5, 5.5]);
});

test("an exhausted narrow interval uses an independent frame in its own four-interval group", async () => {
  const { selectHeldoutTimes, assertHeldoutTimes } = await import("../tools/v3d-bench-metrics.mjs");
  expect(typeof selectHeldoutTimes).toBe("function");
  const cameras = [0, 0.98, 1.02, 2, 3].map((time) => ({ time }));
  const sourceTimes = [0, 0.75, 23 / 24, 1, 25 / 24, 1.25, 2, 3];
  const attemptedTimes = [0, 0.98, 1, 1.02, 2, 3];
  const times = selectHeldoutTimes({
    cameras,
    sourceTimes,
    attemptedTimes,
    trainingTimes: attemptedTimes,
    fps: 24,
  });
  expect(times).toHaveLength(1);
  expect(times[0]).toBe(0.75);
  expect(() => assertHeldoutTimes(times, attemptedTimes, 24)).not.toThrow();
  expect(sourceTimes).toContain(times[0]);
});

test("no held-out group can borrow another group's view or silently lower its count", async () => {
  const { selectHeldoutTimes } = await import("../tools/v3d-bench-metrics.mjs");
  expect(typeof selectHeldoutTimes).toBe("function");
  expect(() =>
    selectHeldoutTimes({
      cameras: Array.from({ length: 9 }, (_, time) => ({ time })),
      sourceTimes: [0, 1, 2, 3, 4, 4.5, 5.5, 6.5, 7.5, 8],
      attemptedTimes: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      trainingTimes: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      fps: 24,
    }),
  ).toThrow(/independent.*group/i);
});

test("actual presented training frames remain excluded in addition to every attempted seek", async () => {
  const { selectHeldoutTimes, assertHeldoutTimes } = await import("../tools/v3d-bench-metrics.mjs");
  expect(typeof selectHeldoutTimes).toBe("function");
  const attempts = [0, 1, 2, 3, 4],
    training = [0, 1.5, 2, 3, 4];
  const times = selectHeldoutTimes({
    cameras: attempts.map((time) => ({ time })),
    sourceTimes: [0, 0.5, 1, 1.5, 1.75, 2, 2.5, 3, 3.5, 4],
    attemptedTimes: attempts,
    trainingTimes: training,
    fps: 24,
  });
  expect(times).toEqual([1.75]);
  expect(() => assertHeldoutTimes(times, attempts, 24)).not.toThrow();
  expect(() => assertHeldoutTimes(times, training, 24)).not.toThrow();
});

test("held-out selection rejects missing evidence and repeated or unordered camera times", async () => {
  const { selectHeldoutTimes } = await import("../tools/v3d-bench-metrics.mjs");
  expect(typeof selectHeldoutTimes).toBe("function");
  const valid = {
    cameras: [0, 1, 2].map((time) => ({ time })),
    sourceTimes: [0, 0.5, 1, 1.5, 2],
    attemptedTimes: [0, 1, 2],
    trainingTimes: [0, 1, 2],
    fps: 24,
  };
  for (const change of [
    { cameras: [] },
    { cameras: [{ time: 0 }, { time: 1 }, { time: 1 }] },
    { cameras: [{ time: 0 }, { time: 2 }, { time: 1 }] },
    { sourceTimes: [] },
    { sourceTimes: [0, 1, NaN] },
    { attemptedTimes: [] },
    { trainingTimes: [] },
    { fps: 0 },
  ])
    expect(() => selectHeldoutTimes({ ...valid, ...change })).toThrow();
});
