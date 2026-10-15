import fs from "node:fs";
import { test, expect } from "@playwright/test";
import {
  BORDER_CHOICES,
  EYE_CHOICES,
  FIT_EXTRA,
  FIT_BAND,
  pictureEyeChoices,
} from "../src/qr/fit-options.js";
import { CANDIDATES } from "../tools/cdx-qr-fit-study.mjs";
import { SAMPLES } from "../src/qr-craft/samples.js";

test("new border and eye choices meet their complete three-reader qualification gates", () => {
  const result = JSON.parse(
    fs.readFileSync("docs/audits/picture-qr-fit-2026-10-study.json", "utf8"),
  );
  expect(result.quick).toBe(false);
  expect(result.plainOnly).toBe(false);
  expect(result.geometryExtra).toBe(FIT_EXTRA);
  expect(result.decorationBand).toBe(FIT_BAND);
  expect(result.pictureCrop).toBe("Original sample crop, matching the default saved recipes");
  expect(result.pictures.map((p) => p.id).sort()).toEqual(SAMPLES.map((p) => p.id).sort());
  expect(result.summary.map((s) => s.id).sort()).toEqual(CANDIDATES.map((c) => c.id).sort());
  const trials = (20 * 4 + SAMPLES.length * 5) * 4 * 6;
  for (const row of result.summary) expect(row.trials, row.id).toBe(trials);
  const rows = new Map(result.summary.map((row) => [row.id, row]));
  const all = (id) => {
    const row = rows.get(id);
    expect(row.all, id).toBe(trials);
    expect(
      result.failures.filter((f) => f.candidate === id),
      id,
    ).toEqual([]);
  };
  const quiet = { wide: 4, medium: 2, thin: 1, none: 0 };
  for (const choice of BORDER_CHOICES.filter((c) => c.id !== "legacy")) {
    all(`border-${quiet[choice.id]}-pale`);
    if (choice.id !== "wide" && EYE_CHOICES.some((c) => c.id === "rounded"))
      all(`eyes-rounded-border-${quiet[choice.id]}`);
  }
  for (const eye of EYE_CHOICES.filter((c) => c.id !== "style")) {
    for (const shape of ["square", "circle"]) {
      const row = rows.get(`eyes-${eye.id}-${shape}`);
      for (const kind of ["plain", "picture"]) {
        if (kind === "picture" && !pictureEyeChoices(shape).some((c) => c.id === eye.id)) continue;
        for (const size of ["phone", "8ppm"]) {
          const part = row.byKind[kind][size];
          expect(part.trials, `${kind}/${eye.id}/${shape}/${size}`).toBe(
            (kind === "plain" ? 80 : 160) * 6,
          );
          for (const reader of ["jsqr", "zxing", "zxingcpp"])
            expect(part[reader], `${kind}/${eye.id}/${shape}/${size}/${reader}`).toBe(part.trials);
        }
      }
    }
  }
});

test("study rotation preserves RGBA values and image orientation", async () => {
  const { turn } = await import("../tools/cdx-circle-study.mjs");
  const pixels = (ids) =>
    new Uint8ClampedArray(ids.flatMap((id) => [id, id + 10, id + 20, id + 30]));
  const img = { width: 3, height: 2, data: pixels([1, 2, 3, 4, 5, 6]) };
  expect(turn(img)).toEqual({ width: 2, height: 3, data: pixels([4, 1, 5, 2, 6, 3]) });
  expect(turn(turn(turn(turn(img))))).toEqual(img);
});
