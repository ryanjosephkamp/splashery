// MIT. Made by Ryan with Codex (GPT-6). Real GPU controls; no corpus-quality claim.
import { test, expect } from "@playwright/test";
import { backgroundShrinkGpuFixture } from "./helpers/v3d-background-shrink-fixture.mjs";
test("bounded environment color preserves default rejection and both unchanged error guards", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/background-shrink-empty.html", (r) =>
    r.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  );
  await page.goto("/background-shrink-empty.html");
  const result = await page.evaluate(backgroundShrinkGpuFixture, "/vendor/splatjs");
  expect(errors).toEqual([]);
  expect(result.errors).toEqual([]);
  expect(result.cases.map((c) => c.id)).toEqual([
    "legacy-rejection",
    "bounded-color",
    "unchanged-full-fit",
    "harmful-direction",
    "insufficient-training-gain",
  ]);
  for (const c of result.cases) {
    expect(c.modelExact, c.id).toBe(true);
    expect(c.iters, c.id).toBe(0);
    expect(c.cameraReads, c.id).toEqual([0, 2, 1]);
    expect(c.fit.accepted, c.id).toBe(c.expectedAccepted);
    expect(c.fit.reason, c.id).toBe(c.expectedReason);
  }
  const bounded = result.cases.find((c) => c.id === "bounded-color").fit;
  expect(bounded.validationScale).toBeGreaterThan(0);
  expect(bounded.validationScale).toBeLessThan(1);
  expect(bounded.improvement).toBeGreaterThanOrEqual(0.01);
  for (const camera of bounded.validation)
    expect(camera.fittedMse).toBeLessThanOrEqual(camera.baseMse);
  const full = result.cases.find((c) => c.id === "unchanged-full-fit").fit;
  expect(full.proposedRgb).toBeUndefined();
  expect(full.validationScale ?? 1).toBe(1);
  const tiny = result.cases.find((c) => c.id === "insufficient-training-gain").fit;
  expect(tiny.improvement).toBeLessThan(0.01);
  expect(tiny.accepted).toBe(false);
  const legacy = result.cases.find((c) => c.id === "legacy-rejection").fit;
  expect(legacy.validation[0].fittedMse).toBeGreaterThan(legacy.validation[0].baseMse);
});
