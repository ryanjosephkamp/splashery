import { test, expect } from "@playwright/test";
import { detailFraction, detailOptionsSupported } from "../src/qr-craft/detail-policy.js";
import { loadPicture } from "../tools/qrc-picture.mjs";
import { detailCandidates } from "../src/qr-craft/picture.js";

test("Most detail accepts original geometry and ignores stored Circle-only choices in Square", () => {
  expect(
    detailOptionsSupported({ shape: "square", circleBorder: "thin", eyeShape: "rounded" }),
  ).toBe(true);
  expect(detailOptionsSupported({ shape: "circle" })).toBe(true);
  for (const options of [
    { shape: "circle", circleBorder: "thin" },
    { shape: "circle", eyeShape: "rounded" },
    { shape: "square", cropX: 0.6 },
    { shape: "square", cropY: 0.4 },
    { shape: "square", cropZoom: 1.2 },
    { shape: "square", pictureFit: "code" },
  ])
    expect(detailOptionsSupported(options)).toBe(false);
});

for (const options of [
  { shape: "circle", circleBorder: "thin" },
  { shape: "circle", eyeShape: "rounded" },
  { shape: "square", cropX: 0.6 },
  { shape: "square", pictureFit: "code" },
])
  test(`Most detail preserves unsupported ${JSON.stringify(options)} settings until Original is chosen`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 }),
    );
    await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async () => {
      await window.__splashery.app.chooseToy("qr-picture");
    });
    await page.evaluate(async (options) => {
      await window.__splashery.app.setToyOptions({
        ...options,
        text: "https://example.org/original-fit",
        picture: "ai-farm",
        fidelity: "detail",
        level: "H",
        size: "more",
        style: "color",
      });
    }, options);
    const state = await page.evaluate(() => {
      const { app, qrCraft } = window.__splashery;
      return { options: app.player.scene.toy.options, notice: qrCraft.picture().notice };
    });
    expect(state.options).toMatchObject({ ...options, fidelity: "standard" });
    expect(state.notice).toMatch(/Most detail.*Original.*Standard/);
    await page.locator("#qrc-original-detail").click();
    await page.waitForFunction(
      () => {
        const { app, qrCraft } = window.__splashery,
          p = qrCraft.picture();
        return (
          !app.busy &&
          !p.checking &&
          p.options?.fidelity === "detail" &&
          p.check?.stress?.ok &&
          !app.player.stage.coverDepth
        );
      },
      null,
      { timeout: 30000 },
    );
    expect(await page.evaluate(() => window.__splashery.qrCraft.picture().options)).toMatchObject({
      pictureFit: "legacy",
      cropX: 0.5,
      cropY: 0.5,
      cropZoom: 1,
      circleBorder: "legacy",
      eyeShape: "style",
    });
  });

test("Low-contrast Square pictures reserve more correction share while Circle keeps its reserve", () => {
  const soft = loadPicture("assets/toys/qr-picture/themes/cdx-theme-seasons-11-2.jpg");
  const varied = loadPicture("assets/toys/photo-3d/wildflowers.jpg");
  expect(detailFraction(soft, "square")).toBe(0.6);
  expect(detailFraction(soft, "circle")).toBe(0.4);
  expect(detailFraction(varied, "square")).toBe(0.4);
  expect(detailFraction(null, "square")).toBe(0.4);
  const veryFlat = loadPicture("assets/toys/qr-picture/themes/cdx-theme-space-art-2-1.jpg");
  expect(detailFraction(veryFlat, "square")).toBe(0.65);
  expect(detailFraction(veryFlat, "circle")).toBe(0.4);
  const candidate = detailCandidates(veryFlat, {
    text: "https://example.org/a/1",
    fidelity: "detail",
    shape: "square",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    texture: "tiles",
    channel: "weighted",
    preferContinuous: true,
    preferCorrection: true,
    errorFraction: detailFraction(veryFlat, "square"),
    captureValidation: true,
  }).next().value;
  expect(candidate.rendering.fraction).toBe(0.65);
  expect(candidate.code.intentionalErrors.fraction).toBe(0.65);
  expect(candidate.code.intentionalErrors.limit).toBe(
    Math.floor(candidate.code.intentionalErrors.maxErrors * 0.65),
  );
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
