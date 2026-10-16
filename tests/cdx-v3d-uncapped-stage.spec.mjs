// MIT. Made by Ryan with Codex (GPT-6). Uncapped desktop work still honors cancellation.
import { test, expect } from "@playwright/test";
import { runWithDeadline } from "../src/video3d/deadline.js";

test("an uncapped stage accepts a late result without scheduling a timeout", async () => {
  const clock = Object.getOwnPropertyDescriptor(performance, "now");
  const originalTimer = globalThis.setTimeout;
  let now = 100;
  const timers = [];
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  globalThis.setTimeout = (...args) => {
    timers.push(args[1]);
    return originalTimer(...args);
  };
  try {
    expect(
      await runWithDeadline(
        () => {
          now += 30 * 60000;
          return "completed";
        },
        { timeoutMs: null },
      ),
    ).toBe("completed");
    expect(timers).toEqual([]);
  } finally {
    globalThis.setTimeout = originalTimer;
    if (clock) Object.defineProperty(performance, "now", clock);
    else delete performance.now;
  }
});

test("canceling an uncapped stage aborts its child and discards its late result", async () => {
  const caller = new AbortController();
  let child, complete;
  const pending = runWithDeadline(
    (signal) => {
      child = signal;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
    { signal: caller.signal, timeoutMs: null },
  );
  await Promise.resolve();
  caller.abort();
  complete("late result");
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(child.aborted).toBe(true);
  let started = false;
  await expect(
    runWithDeadline(
      () => {
        started = true;
      },
      { signal: caller.signal, timeoutMs: null },
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(started).toBe(false);
});
