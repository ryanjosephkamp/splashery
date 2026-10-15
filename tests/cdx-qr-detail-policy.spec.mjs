import { test, expect } from "@playwright/test";
import { detailFraction } from "../src/qr-craft/detail-policy.js";
import { loadPicture } from "../tools/qrc-picture.mjs";
import { detailCandidates } from "../src/qr-craft/picture.js";

test("Low-contrast Square pictures reserve more correction share while Circle keeps its reserve", () => {
  const soft = loadPicture("assets/toys/qr-picture/themes/cdx-theme-seasons-11-2.jpg");
  const varied = loadPicture("assets/toys/photo-3d/wildflowers.jpg");
  expect(detailFraction(soft, "square")).toBe(0.6);
  expect(detailFraction(soft, "circle")).toBe(0.4);
  expect(detailFraction(varied, "square")).toBe(0.4);
  expect(detailFraction(null, "square")).toBe(0.4);
});

test("A Circle that rejects its first four forecasts tries another QR mask", () => {
  const picture = loadPicture("assets/toys/photo-3d/wildflowers.jpg");
  const candidates = detailCandidates(picture, {
    text: "https://ryanjosephkamp.github.io/splashery/",
    fidelity: "detail",
    shape: "circle",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    texture: "tiles",
    channel: "weighted",
    preferContinuous: true,
    preferCorrection: true,
    errorFraction: 0.4,
    captureValidation: true,
  });
  let next = candidates.next();
  const firstMask = next.value.code.mask;
  for (let i = 0; i < 4; i++)
    next = candidates.next({ ok: false, preflight: true, ppm: 4, blur: 0.3, view: 1 });
  expect(next.done).toBe(false);
  expect(next.value.code.mask).not.toBe(firstMask);
  expect(next.value.rendering.edge).toBe(0.4);
});
