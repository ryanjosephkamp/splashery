import { test, expect } from "@playwright/test";
import { assertResume, completeStudy } from "../tools/cdx-p3d5-study-state.mjs";
import { POSES } from "../tools/p3df/scoring.mjs";

function fixture() {
  const profile = () => ({
    sharp: { on: true },
    errors: [],
    externalRequests: [],
    rows: POSES.map(([yaw, pitch]) => ({ yaw, pitch })),
  });
  return {
    source: { sha256: "same" },
    settings: { depth: 0.5 },
    methods: { scorer: "same" },
    method: "old",
    inputs: [{ id: "one", profiles: { phone: profile(), desktop: profile() } }],
    attempts: [{ passed: true }, { passed: true }],
  };
}
test("an early stop or missing profile cannot mark a full request complete", () => {
  const d = fixture();
  expect(completeStudy(d, ["one"], ["phone", "desktop"])).toBe(true);
  expect(completeStudy(d, ["one", "two"], ["phone", "desktop"])).toBe(false);
  d.stoppedEarly = { id: "one" };
  expect(completeStudy(d, ["one"], ["phone", "desktop"])).toBe(false);
  delete d.stoppedEarly;
  delete d.inputs[0].profiles.desktop;
  expect(completeStudy(d, ["one"], ["phone", "desktop"])).toBe(false);
});
test("complete coverage requires every pose and a clean Sharp result", () => {
  const d = fixture();
  d.inputs[0].profiles.phone.rows[0] = { yaw: 999, pitch: 0 };
  expect(completeStudy(d, ["one"], ["phone", "desktop"])).toBe(false);
  const b = fixture();
  b.inputs[0].profiles.phone.sharp.on = false;
  expect(completeStudy(b, ["one"], ["phone", "desktop"])).toBe(false);
});
test("resume refuses changed reconstruction, settings, scoring, or unknown controller versions", () => {
  const d = fixture(),
    expected = {
      source: d.source,
      settings: d.settings,
      methods: d.methods,
      method: "new",
      compatibleControllers: ["old"],
      stateMethod: "validation",
    };
  expect(() => assertResume(d, expected)).not.toThrow();
  for (const [key, value] of [
    ["source", { sha256: "changed" }],
    ["settings", { depth: 1 }],
    ["methods", { scorer: "changed" }],
    ["method", "unknown"],
  ]) {
    const a = structuredClone(d);
    a[key] = value;
    expect(() => assertResume(a, expected)).toThrow(/Resume/);
  }
});
