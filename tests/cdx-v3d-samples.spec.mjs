import { test, expect } from "@playwright/test";
import { readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { SAMPLES } from "../src/video3d/samples.js";
import { sceneFromSplats } from "../src/packs/video3d.js";
import { readBakedScene } from "../src/video3d/baked.js";
import { createScene } from "../src/state.js";
import { encodeSceneHash } from "../src/codec.js";

test("new captures retain their provenance and match every shipped file hash", () => {
  const records = JSON.parse(readFileSync("tools/assets.json")).videoSamples;
  const fresh = SAMPLES.filter((s) => s.transformationCredit);
  expect(fresh.length).toBeGreaterThanOrEqual(4);
  expect(fresh.length).toBeLessThanOrEqual(8);
  for (const sample of fresh) {
    const record = records.find((r) => r.id === sample.id);
    expect(record.page).toBe(sample.source);
    expect(record.author).toBe(sample.author);
    expect(record.license).toBe(sample.license);
    expect(record.checked).toBe(sample.checked);
    expect(record.transformationCredit).toBe(sample.transformationCredit);
    expect(record.captureSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(record.files).length).toBeGreaterThanOrEqual(4);
    for (const [file, declared] of Object.entries(record.files)) {
      const bytes = readFileSync(file);
      expect(bytes.length, file).toBe(declared.bytes);
      expect(bytes.length, file).toBeLessThan(20_000_000);
      expect(createHash("sha256").update(bytes).digest("hex"), file).toBe(declared.sha256);
    }
    expect(record.files[record.file].sha256).toBe(
      record.file.endsWith(".ply") ? sample.sha256 : sample.bakedSha256,
    );
    for (const [file, declared] of Object.entries(record.baked.files)) {
      const bytes = readFileSync(file);
      expect(bytes.length, file).toBe(declared.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), file).toBe(declared.sha256);
    }
    expect(record.baked.files[record.baked.file].sha256).toBe(sample.bakedSha256);
    expect(record.defaultBytes).toBe(record.baked.defaultBytes);
    const meta = JSON.parse(readFileSync(record.path));
    expect(record.baked.sourcePlySha256, sample.id).toBe(sample.sha256);
    if (meta.bake.backend === "msplat/Metal") {
      expect(meta.stats.iters, sample.id).toBeGreaterThanOrEqual(30000);
      expect(meta.stats.frames, sample.id).toBe(60);
      expect(meta.stats.registered, sample.id).toBeGreaterThanOrEqual(54);
      expect(meta.bake.settings.downscaleFactor, sample.id).toBe(1);
      expect(meta.bake.settings.numDownscales, sample.id).toBe(0);
      expect(meta.bake.settings.keepCrs, sample.id).toBe(true);
      expect(meta.bake.training.plySha256, sample.id).toBe(sample.sha256);
      expect(meta.bake.sourceSha256, sample.id).toBe(record.captureSha256);
      expect(meta.bake.source.span, sample.id).toEqual(sample.span);
      expect(meta.bake.exportTrainSide, sample.id).toBe(
        Math.max(...meta.cams.map((c) => Math.max(c.w, c.h))),
      );
      continue;
    }
    const finish = meta.continuation;
    expect(finish.completedIterations, sample.id).toBeGreaterThan(0);
    expect(finish.actualIteration, sample.id).toBe(meta.stats.iters);
    expect(finish.initialIter + finish.completedIterations, sample.id).toBe(meta.stats.iters);
    expect(finish.trainSide, sample.id).toBe(640);
    expect(meta.bake.exportTrainSide, sample.id).toBe(finish.trainSide);
    expect(finish.projectionError, sample.id).toBeLessThan(1e-10);
    expect(finish.exportTrainingFrameSizes, sample.id).toHaveLength(meta.stats.registered);
    expect(
      finish.exportTrainingFrameSizes.every(
        (c) => Math.max(c.w, c.h) === 640 && Number.isFinite(c.f) && c.f > 0,
      ),
      sample.id,
    ).toBe(true);
    expect(finish.sourceOrigin.fullCaptureSha256, sample.id).toBe(record.captureSha256);
    expect(finish.sourceOrigin.span, sample.id).toEqual(sample.span);
  }
});

test("every baked sample has usable splats, a solved path, a credit, and a light default load", async () => {
  expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(SAMPLES.length);
  const records = JSON.parse(readFileSync("tools/assets.json")).videoSamples;
  for (const sample of SAMPLES) {
    const base = `assets/toys/video-3d/${sample.id}`;
    const json = readFileSync(`${base}.json`);
    const meta = JSON.parse(json);
    const raw = await readBakedScene(
      pathToFileURL(resolve(`assets/toys/video-3d/${sample.baked}`)),
    );
    const { scene, path } = sceneFromSplats(raw, meta.cams, { affine: true });
    const record = records.find((r) => r.id === sample.id || r.file === `${base}.ply`);
    expect(record.baked.defaultBytes, sample.id).toBeLessThan(15_000_000);
    expect(scene.count, sample.id).toBeGreaterThan(1000);
    expect(path.length, sample.id).toBeGreaterThanOrEqual(3);
    expect(meta.stats.registered, sample.id).toBe(meta.cams.length);
    if (existsSync(`${base}.ply`))
      expect(meta.stats.plyBytes, sample.id).toBe(statSync(`${base}.ply`).size);
    expect(meta.stats.iters, sample.id).toBeGreaterThan(0);
    expect(
      path.every((c) => c.pos.every(Number.isFinite)),
      sample.id,
    ).toBe(true);
    expect(
      path.every((c) => c.time >= 0 && c.time <= sample.span.length + 0.05),
      sample.id,
    ).toBe(true);
    expect(sample.source).toMatch(/^https:\/\//);
    expect(sample.author).toBeTruthy();
    expect(sample.license).toMatch(/CC BY|CC0|public domain/i);
    for (const ext of ["mp4", "webm"])
      expect(statSync(`${base}-source.${ext}`).size).toBeLessThan(20_000_000);
  }
});

test("each selected sample loads in the browser without fetching the trainer", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/?labs=1&renderer=webgl2&profile=low&adapt=off");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
  for (const sample of SAMPLES) {
    await page.evaluate(
      (id) => window.__splashery.app.setToyOptions({ source: id, navigation: "walk" }),
      sample.id,
    );
    const info = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.video);
    expect(info.uid).toBe(sample.id);
    expect(info.splats).toBeGreaterThan(1000);
    await expect(page.locator("#v3d-source-credit")).toContainText(sample.license);
    await expect(page.locator("#v3d-source-credit")).toContainText(sample.author);
  }
  expect(errors).toEqual([]);
  expect(requests.filter((u) => /vendor\/splatjs/.test(u))).toEqual([]);
  expect(requests.filter((u) => /video-3d\/[^/]+\.ply(?:\?|$)/.test(u))).toEqual([]);
  expect(requests.filter((u) => /\.bkd\.gz(?:\?|$)/.test(u)).length).toBeGreaterThanOrEqual(6);
});

for (const source of ["toolse", "poltsamaa"])
  test(`a saved ${source} walk-mode BY-SA sample keeps visible, clickable attribution`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 200 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const hash = await encodeSceneHash(
      createScene({
        toy: {
          kind: "builtin",
          id: "video-3d",
          options: { source, navigation: "walk" },
        },
      }),
    );
    await page.goto(`/embed/?renderer=webgl2&labs=1&profile=low&adapt=off#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']");
    const state = await page.evaluate(() => ({
      scene: window.__splashery.scene(),
      info: window.__splashery.player.proc?.ctx?.kit?.data?.video,
    }));
    expect(state.scene.toy.id).toBe("video-3d");
    expect(state.info?.uid).toBe(source);
    expect(state.info.splats).toBeGreaterThan(1000);
    await expect(page.locator("#v3d-source-credit")).toContainText("Sillerkiil");
    await expect(page.locator("#v3d-source-credit")).toContainText("CC BY-SA 4.0");
    await expect(page.locator("#v3d-walk")).toBeVisible();
    await page.waitForFunction(() => {
      const p = window.__splashery.player;
      return (
        p.proc.ctx.kit.data.walk &&
        p.camera
          .pose()
          .position.every((v, k) => Math.abs(v - p.proc.ctx.kit.data.walk.state.pos[k]) < 1e-6)
      );
    });
    const credit = await page.locator("#v3d-source-credit").boundingBox();
    expect(credit.y).toBeGreaterThanOrEqual(0);
    expect(credit.y + credit.height).toBeLessThanOrEqual(200);
    const move = await page.locator('[data-pad="move"]').boundingBox();
    expect(credit.y + credit.height).toBeLessThanOrEqual(move.y);
    for (const link of await page.locator("#v3d-source-credit a").all()) {
      expect(
        await link.evaluate((a) => {
          const r = a.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === a;
        }),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
