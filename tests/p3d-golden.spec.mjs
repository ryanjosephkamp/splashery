// Classic Photo to 3D is frozen (the owner's call of October 16, 2026; tag `photo-3d-classic-v1`).
// Every built-in sample, rebuilt in plain Node from its shipped photo and depth at the phone and
// desktop budgets, must give byte-identical splats and Sharp surfaces (tools/p3d-golden.mjs). If one
// of these fails, the classic path changed: undo that change, or build the new idea beside classic
// (Codex task 99, `src/photo3d/next/`). Re-pinning needs the owner's yes.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PINS, goldenSamples, fingerprint } from "../tools/p3d-golden.mjs";

const pins = JSON.parse(fs.readFileSync(PINS, "utf8"));

test("every built-in sample is pinned, and only those", () => {
  expect(Object.keys(pins).sort()).toEqual(goldenSamples().map((s) => s.id).sort()); // prettier-ignore
});

for (const sample of goldenSamples())
  test(`classic Photo to 3D is unchanged: ${sample.id}`, async () => {
    expect(await fingerprint(sample)).toEqual(pins[sample.id]);
  });
