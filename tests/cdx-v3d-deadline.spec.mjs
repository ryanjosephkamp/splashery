import { test, expect } from "@playwright/test";
import { runWithDeadline } from "../src/video3d/deadline.js";

async function withClock(work) {
  const descriptor = Object.getOwnPropertyDescriptor(performance, "now");
  let now = 100;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  try {
    await work((ms) => (now += ms));
  } finally {
    if (descriptor) Object.defineProperty(performance, "now", descriptor);
    else delete performance.now;
  }
}

test("blocking work cannot publish success after its deadline", async () => {
  await withClock(async (advance) => {
    let child;
    await expect(
      runWithDeadline(
        (signal) => {
          child = signal;
          advance(25); // Synchronous work consumes time before the timer task can run.
          return "late result";
        },
        { timeoutMs: 5, message: "The camera path took too long. Try a shorter stretch." },
      ),
    ).rejects.toThrow(/too long.*shorter/);
    expect(child.aborted).toBe(true);
  });
});

test("blocking failure after the deadline retains the actionable timeout", async () => {
  await withClock(async (advance) => {
    await expect(
      runWithDeadline(
        () => {
          advance(25);
          throw new Error("Internal late failure");
        },
        { timeoutMs: 5, message: "Try a shorter video." },
      ),
    ).rejects.toThrow("Try a shorter video.");
  });
});

test("timely completion clears the timer without aborting completed work", async () => {
  let child;
  expect(
    await runWithDeadline(
      (signal) => {
        child = signal;
        return 42;
      },
      { timeoutMs: 20, message: "Timed out." },
    ),
  ).toBe(42);
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(child.aborted).toBe(false);
});

test("canceling active work aborts its child and discards a later result", async () => {
  const caller = new AbortController();
  let child;
  let complete;
  const pending = runWithDeadline(
    (signal) => {
      child = signal;
      return new Promise((resolve) => (complete = resolve));
    },
    { signal: caller.signal, timeoutMs: 1000, message: "Timed out." },
  );
  await Promise.resolve();
  caller.abort();
  complete("late result");
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(child.aborted).toBe(true);
});
