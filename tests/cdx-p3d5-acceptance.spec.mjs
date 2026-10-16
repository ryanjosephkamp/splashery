import { test, expect } from "@playwright/test";
import { POSES } from "../tools/p3df/scoring.mjs";
import { compareAtlases, repeatNoise, rankClasses } from "../tools/cdx-p3d5-compare.mjs";

function atlas(values = {}) {
  const profile = () => ({
    renderer: "fixture",
    browser: "fixture",
    native: [585, 1266],
    ratio: 1.5,
    errors: [],
    externalRequests: [],
    rows: POSES.map(([yaw, pitch]) => ({
      yaw,
      pitch,
      halo: { anchoredProfiles: 4 },
      fringe: { evaluated: 3 },
      depth: {
        kind: "T-junction hypothesis; not reference depth",
        flattenedFraction: values.flatDepth ?? values.streaks ?? 0.4,
      },
    })),
    values: { halos: 0.12, streaks: 0.4, textureLoss: 0.8, holes: 0, fringes: 0.5, ...values },
  });
  return {
    complete: true,
    source: { sha256: "same" },
    settings: { poses: POSES, profiles: ["phone", "desktop"], inputHashes: ["source"] },
    inputs: [{ id: "one", sha256: "source", profiles: { phone: profile(), desktop: profile() } }],
  };
}
const compare = (a, b, options) =>
  compareAtlases(a, b, {
    expectedInputs: 1,
    noise: repeatNoise(a, [structuredClone(a)]),
    ...options,
  });

test("an improved class mean cannot hide one worse input/profile", () => {
  const a = atlas(),
    b = atlas({ halos: 0.01, streaks: 0.01, textureLoss: 0.01 });
  b.inputs[0].profiles.phone.values.halos = 0.121;
  const result = compare(a, b);
  expect(result.targets.find((r) => r.metric === "halos").reduction).toBeGreaterThan(0.25);
  expect(result.regressions).toHaveLength(1);
  expect(result.qualityPassed).toBe(false);
});

test("lost metric and probe support cannot count as an improvement", () => {
  const a = atlas(),
    b = atlas({ halos: null, streaks: 0.1, textureLoss: 0.1 });
  b.inputs[0].profiles.phone.rows[0].fringe.evaluated = 2;
  const result = compare(a, b);
  expect(result.errors.some((e) => e.startsWith("Lost metric support"))).toBe(true);
  expect(result.errors.some((e) => e.startsWith("Lost probe support"))).toBe(true);
  expect(result.targets.find((r) => r.metric === "halos").required).toBe(2);
  expect(result.qualityPassed).toBe(false);
});

test("unchanged quality fails the requested 25 percent class improvement", () => {
  const result = compare(atlas(), atlas());
  expect(result.regressions).toEqual([]);
  expect(result.targets.every((r) => r.reduction === 0)).toBe(true);
  expect(result.qualityPassed).toBe(false);
});

test("measured noise belongs to its input, profile, and metric, and source must match", () => {
  const a = atlas(),
    repeated = atlas();
  repeated.inputs[0].profiles.phone.values.fringes += 0.001;
  const noise = repeatNoise(a, [repeated]);
  const b = atlas({ halos: 0.06, streaks: 0.2, textureLoss: 0.4 });
  b.inputs[0].profiles.phone.values.fringes += 0.0005;
  expect(compare(a, b, { noise }).qualityPassed).toBe(true);
  b.inputs[0].profiles.desktop.values.fringes += 0.0005;
  expect(compare(a, b, { noise }).qualityPassed).toBe(false);
  repeated.source.sha256 = "changed";
  expect(() => repeatNoise(a, [repeated])).toThrow(/identical source/);
});

test("ranking uses each class's count times severity at the existing review level", () => {
  const ranked = rankClasses(atlas());
  expect(ranked[0].metric).toBe("halos");
  expect(ranked[0].cost).toBe(6);
  expect(
    compare(atlas(), atlas({ halos: 0.06, streaks: 0.2, textureLoss: 0.4 })).qualityPassed,
  ).toBe(true);
});

test("unmeasured noise and changed metric methods block acceptance", () => {
  const a = atlas(),
    b = atlas({ halos: 0.06, streaks: 0.2, textureLoss: 0.4 });
  expect(compare(a, b, { noise: undefined }).errors).toContain(
    "Repeat noise has not been measured.",
  );
  a.source.files = { "tools/p3df/scoring.mjs": "original" };
  b.source.files = { "tools/p3df/scoring.mjs": "changed" };
  expect(
    compare(a, b).errors.some((e) => e.startsWith("Calibration or camera helper changed")),
  ).toBe(true);
});

test("a lower RGB average cannot hide wider edges or a missing transition", () => {
  const a = atlas(),
    b = atlas({ halos: 0.06, streaks: 0.2, textureLoss: 0.4 });
  for (const row of a.inputs[0].profiles.phone.rows)
    Object.assign(row.halo, { transitionWidthExcessP95: 1, missingTransitionProfiles: 0 });
  for (const row of b.inputs[0].profiles.phone.rows)
    Object.assign(row.halo, { transitionWidthExcessP95: 1.1, missingTransitionProfiles: 1 });
  const result = compare(a, b);
  expect(result.regressions.map((r) => r.metric)).toEqual(["transitionWidth", "lostTransitions"]);
  expect(result.qualityPassed).toBe(false);
});
