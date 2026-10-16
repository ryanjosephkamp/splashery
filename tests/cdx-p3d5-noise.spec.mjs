import { test, expect } from "@playwright/test";
import { boundedNoise } from "../tools/cdx-p3d5-noise.mjs";
import { POSES } from "../tools/p3df/scoring.mjs";

function fixture() {
  const profile = () => ({
    renderer: "fixture",
    browser: "fixture",
    native: [585, 1266],
    ratio: 1.5,
    sharp: { on: true },
    errors: [],
    externalRequests: [],
    values: { halos: 0.1 },
    rows: POSES.map(([yaw, pitch]) => ({
      yaw,
      pitch,
      halo: { anchoredProfiles: 4 },
      fringe: { evaluated: 3 },
    })),
  });
  return {
    complete: true,
    source: { sha256: "same" },
    settings: {
      profiles: ["phone", "desktop"],
      poses: POSES,
      inputHashes: [{ id: "one", sha256: "original" }],
    },
    inputs: [{ id: "one", sha256: "original", profiles: { phone: profile(), desktop: profile() } }],
  };
}
const noise = (a, b) => boundedNoise(a, [b], { expectedInputs: 1 });

test("a partial repeat grants tolerance only to the actual repeated profile", () => {
  const a = fixture(),
    b = fixture();
  b.complete = false;
  delete b.inputs[0].profiles.desktop;
  b.inputs[0].profiles.phone.values.halos += 0.001;
  const result = noise(a, b);
  expect(result.completeCorpus).toBe(false);
  expect(result.coveredProfiles).toBe(1);
  expect(result.tolerance[JSON.stringify(["one", "phone", "halos"])]).toBeGreaterThan(0);
  expect(result.tolerance[JSON.stringify(["one", "desktop", "halos"])]).toBeUndefined();
  expect(result.coverage.find((r) => r.profile === "desktop").repeats).toBe(0);
});

test("a missing pose or lost probe cannot become measured noise", () => {
  const a = fixture(),
    b = fixture();
  b.inputs[0].profiles.phone.rows.pop();
  expect(() => noise(a, b)).toThrow(/complete/);
  const c = fixture();
  c.inputs[0].profiles.phone.rows[0].fringe.evaluated = 2;
  expect(() => noise(a, c)).toThrow(/probe support/);
});

test("source, input bytes, and rendering settings must match", () => {
  const a = fixture(),
    b = fixture();
  b.source.sha256 = "other";
  expect(() => noise(a, b)).toThrow(/identical source/);
  const c = fixture();
  c.inputs[0].sha256 = "other";
  expect(() => noise(a, c)).toThrow(/input bytes/);
  const d = fixture();
  d.settings.poses = [[0, 0]];
  expect(() => noise(a, d)).toThrow(/settings/);
});
