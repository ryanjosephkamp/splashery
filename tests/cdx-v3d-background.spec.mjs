import { test, expect } from "@playwright/test";
import { holdTrainingBackground, trainingBackground } from "../src/video3d/background.js";
import { makeFlight } from "../src/video3d/flight.js";

function stage() {
  const color = { r: 0.8, g: 0.9, b: 1, a: 0.5 };
  return {
    cameraEntity: { camera: { clearColor: color } },
    calls: [],
    setClearColor(rgb, alpha) {
      // Model an engine that updates its existing color object in place.
      Object.assign(color, { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha });
      this.calls.push([...rgb, alpha]);
    },
  };
}
const color = (s) => Object.values(s.cameraEntity.camera.clearColor);

test("a fitted view restores its prior composite once after leaving", () => {
  const s = stage(),
    original = s.setClearColor,
    release = holdTrainingBackground(s, [0, 0, 0]);
  expect(color(s)).toEqual([0, 0, 0, 1]);
  release();
  release();
  expect(color(s)).toEqual([0.8, 0.9, 1, 0.5]);
  expect(s.setClearColor).toBe(original);
  expect(s.calls).toHaveLength(2);
});

test("host color choices and a newer setter remain authoritative", () => {
  const s = stage(),
    release = holdTrainingBackground(s, [0, 0, 0]);
  s.setClearColor([1, 0.5, 0.25], 1);
  release();
  expect(color(s)).toEqual([1, 0.5, 0.25, 1]);
  const other = holdTrainingBackground(s, [0, 0, 0]),
    replacement = () => {};
  s.setClearColor = replacement;
  other();
  expect(s.setClearColor).toBe(replacement);
});

test("overlapping views do not restore each other's colors", () => {
  const s = stage(),
    original = s.setClearColor,
    first = holdTrainingBackground(s, [0, 0, 0]),
    second = holdTrainingBackground(s, [0.1, 0.2, 0.3]);
  first();
  expect(color(s)).toEqual([0.1, 0.2, 0.3, 1]);
  second();
  expect(color(s)).toEqual([0.8, 0.9, 1, 0.5]);
  expect(s.setClearColor).toBe(original);
});

test("direct camera changes, invalid metadata, and absent stages are preserved", () => {
  const s = stage(),
    release = holdTrainingBackground(s, [0, 0, 0]);
  s.cameraEntity.camera.clearColor.r = 0.75;
  release();
  expect(color(s)).toEqual([0.75, 0, 0, 1]);
  const calls = s.calls.length;
  for (const value of [null, [], [0, 0], [-1, 0, 0], [0, NaN, 0], [0, 0, 2], [0, 0, 0, 1]]) {
    expect(trainingBackground(value)).toBeNull();
    holdTrainingBackground(s, value)();
  }
  expect(s.calls).toHaveLength(calls);
  expect(() => holdTrainingBackground(null, [0, 0, 0])()).not.toThrow();
});

test("flight disposal restores only its own background, including a late embed owner", () => {
  const before = globalThis.window;
  try {
    globalThis.window = {};
    const flight = makeFlight([], null, { background: [0, 0, 0] });
    const s = stage();
    window.__splashery = { player: { stage: s, loadToken: 1, scene: { toy: { id: "video-3d" } } } };
    flight(0, {});
    expect(color(s)).toEqual([0, 0, 0, 1]);
    flight.dispose();
    flight.dispose();
    expect(color(s)).toEqual([0.8, 0.9, 1, 0.5]);
  } finally {
    if (before === undefined) delete globalThis.window;
    else globalThis.window = before;
  }
});
