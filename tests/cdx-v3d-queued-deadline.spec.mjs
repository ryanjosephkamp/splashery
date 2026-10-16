// MIT. Made by Ryan with Codex (GPT-6). A controlled clock models a busy event loop without
// changing the original real-time deadline assertions or extending any product timeout.
import { test, expect } from "@playwright/test";
import { runWithDeadline } from "../src/video3d/deadline.js";

async function delayedStart(check) {
  const descriptor = Object.getOwnPropertyDescriptor(performance, "now");
  let now = 100;
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  try {
    await check(() => (now += 25));
  } finally {
    if (descriptor) Object.defineProperty(performance, "now", descriptor);
    else delete performance.now;
  }
}

test("expired queued camera work never starts after the caller's deadline", async () => {
  await delayedStart(async (delay) => {
    let started = false;
    const pending = runWithDeadline(
      () => {
        started = true;
        return "obsolete work";
      },
      { timeoutMs: 10, message: "The camera path took too long. Try a shorter stretch." },
    );
    delay();
    await expect(pending).rejects.toThrow(/too long.*shorter/);
    expect(started).toBe(false);
  });
});

test("canceling expired queued camera work retains cancellation without starting work", async () => {
  await delayedStart(async (delay) => {
    const caller = new AbortController();
    let started = false;
    const pending = runWithDeadline(
      () => {
        started = true;
      },
      { signal: caller.signal, timeoutMs: 10, message: "Try a shorter stretch." },
    );
    delay();
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toBe(false);
  });
});
