import { test, expect } from "@playwright/test";
import { pausePreviousView } from "../src/video3d/pause-view.js";

function player(paused = false) {
  return {
    paused,
    calls: [],
    setPaused(value) {
      this.paused = !!value;
      this.calls.push(this.paused);
    },
  };
}

test("training holds the previous view and restores its original pause state", () => {
  for (const paused of [false, true]) {
    const view = player(paused),
      original = view.setPaused,
      release = pausePreviousView(view);
    expect(view.paused).toBe(true);
    release();
    expect(view.paused).toBe(paused);
    expect(view.setPaused).toBe(original);
    const count = view.calls.length;
    release();
    expect(view.calls).toHaveLength(count);
  }
});

test("embed visibility requests during training retain their latest intent", () => {
  for (const requested of [false, true]) {
    const view = player(!requested),
      release = pausePreviousView(view);
    view.setPaused(!requested);
    view.setPaused(requested);
    expect(view.paused).toBe(true);
    release();
    expect(view.paused).toBe(requested);
  }
});

test("overlapping file operations release once, including immediate cancellation", () => {
  const view = player(),
    controller = new AbortController(),
    first = pausePreviousView(view),
    second = pausePreviousView(view, { signal: controller.signal });
  first();
  expect(view.paused).toBe(true);
  controller.abort();
  expect(view.paused).toBe(false);
  second();
  expect(view.calls).toEqual([true, false]);
  const canceled = new AbortController();
  canceled.abort();
  pausePreviousView(view, { signal: canceled.signal })();
  expect(view.calls).toEqual([true, false]);
  expect(() => pausePreviousView(null)()).not.toThrow();
});

test("releasing training does not replace a newer host pause method", () => {
  const view = player(),
    release = pausePreviousView(view),
    replacement = () => {};
  view.setPaused = replacement;
  pausePreviousView(view)();
  release();
  expect(view.setPaused).toBe(replacement);
  expect(view.calls).toEqual([true]);
});

test("training releases only its own stage hold after all overlapping operations settle", () => {
  const view = player(),
    liveHolds = new Set(["another loading cover"]);
  view.stage = {
    holdRendering() {
      const token = {};
      liveHolds.add(token);
      return () => liveHolds.delete(token);
    },
  };
  const controller = new AbortController(),
    first = pausePreviousView(view),
    second = pausePreviousView(view, { signal: controller.signal });
  expect(liveHolds.size).toBe(2);
  first();
  expect(liveHolds.size).toBe(2);
  controller.abort();
  expect([...liveHolds]).toEqual(["another loading cover"]);
  second();
  expect([...liveHolds]).toEqual(["another loading cover"]);
});
