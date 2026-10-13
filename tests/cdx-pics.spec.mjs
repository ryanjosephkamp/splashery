// Task 54: new samples use the real browser and production scan paths.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { PICTURES } from "../src/packs/codex-picture-samples.js";
import { QR_PICTURES } from "../src/qr-craft/codex-pictures.js";
import { SAMPLES as QR_SAMPLES } from "../src/qr-craft/samples.js";
import { DOT_SAMPLES } from "../src/packs/dot-samples.js";
import { load, read, trials, TEXT, OPTIONS } from "../tools/cdx-pics-qr.mjs";
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("exactly 20 new Studio samples and 24 CC0 QR backgrounds carry complete file records", async () => {
  expect(PICTURES).toHaveLength(20);
  expect(QR_PICTURES).toHaveLength(24);
  const records = JSON.parse(
    fs.readFileSync("docs/audits/sample-pictures-2026-10/asset-records.json"),
  );
  for (const r of records) {
    expect(r.sha256).toBe(hash(r.file));
    expect(r.checked).toBe("October 13, 2026");
    if (r.depth) expect(r.depthSha256).toBe(hash(r.depth));
  }
  for (const [, file] of PICTURES) {
    const s = DOT_SAMPLES.find((s) => s.file === file);
    expect(s.ai).toBe(true);
    expect(s.label).toContain("(AI-made)");
    expect(s.license).toBe("AI-made by the owner");
  }
  for (const s of QR_PICTURES) {
    expect(s.author).toContain("Ryan, with Codex");
    expect(s.license).toBe("CC0 1.0");
    expect(QR_SAMPLES.find((x) => x.id === s.id).label).toContain("CC0, Ryan with Codex");
    if (s.defaultPayloadSpecific)
      expect(QR_SAMPLES.find((x) => x.id === s.id).label).toContain("default link");
    expect(records.some((r) => r.id === s.id)).toBe(true);
  }
});

for (const s of QR_PICTURES)
  test(`${s.label}: raw encoder scans at phone and printed sizes`, () => {
    const results = trials(load(s.file), OPTIONS, [TEXT]);
    expect(results.filter((r) => !r.ok)).toEqual([]);
  });

test("every new Studio sample loads and raises into 3D; other new assets stay lazy", async ({
  page,
}) => {
  test.setTimeout(360000);
  const requests = [],
    errors = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  expect(requests.filter((u) => /\/ai\/cdx-|\/qr-picture\/codex\//.test(u))).toEqual([]);
  const start = requests.length;
  for (const [, file, name] of PICTURES) {
    await page.evaluate(
      (id) => window.__splashery.app.setToyOptions({ source: id, depth: 0.5 }),
      `dot-${file}`,
    );
    await page.waitForFunction(
      (label) => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.name === label,
      `${name} (AI-made)`,
      { timeout: 90000 },
    );
    const flat = await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.idle.weight = 0;
      p.camera.setTurntable(false);
      p.camera.cur = { ...p.camera.home, yaw: 0.35, pitch: 0.1 };
      p.camera.tgt = { ...p.camera.cur };
      p.motion.setControl("flat", 1, { snap: true });
      for (let i = 0; i < 4; i++) await p.stage.captureFrame();
      return (await p.stage.captureFrame(180, 180)).toDataURL();
    });
    const raised = await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.motion.setControl("flat", 0, { snap: true });
      p.camera.cur = { ...p.camera.home, yaw: 0.35, pitch: 0.1 };
      p.camera.tgt = { ...p.camera.cur };
      for (let i = 0; i < 4; i++) await p.stage.captureFrame();
      return {
        image: (await p.stage.captureFrame(180, 180)).toDataURL(),
        info: p.proc.ctx.kit.data.photo,
      };
    });
    expect(raised.info.splats).toBeGreaterThan(5000);
    expect(raised.info.relief).toBeGreaterThan(0.3);
    expect(raised.image).not.toBe(flat);
  }
  expect(requests.slice(start).some((u) => /onnx|ort-wasm/.test(u))).toBe(false);
  expect(requests.some((u) => u.includes("/qr-picture/codex/"))).toBe(false);
  expect(errors).toEqual([]);
});

test("every new QR background loads, the stage scans, and its 900-pixel export scans", async ({
  page,
}) => {
  test.setTimeout(600000);
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await import("/src/packs/qr-craft.js");
    window.__splashery.qrCraft.autoCheck = false;
    await window.__splashery.app.chooseToy("qr-picture");
  });
  expect(requests.filter((u) => u.includes("/qr-picture/codex/"))).toEqual([]);
  for (const s of QR_PICTURES) {
    await page.evaluate((id) => window.__splashery.app.setToyOptions({ picture: id }), s.id);
    await page.waitForFunction(
      (id) =>
        !window.__splashery.app.busy &&
        window.__splashery.qrCraft.picture().options?.picture === id,
      s.id,
    );
    const result = await page.evaluate(async () => {
      const q = window.__splashery.qrCraft;
      const ck = await q.checkPicture();
      const blob = await q.savePNG(900);
      return {
        ok: ck.ok,
        stage: ck.stage.map((s) => s.text),
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      };
    });
    expect(result.ok, s.id).toBe(true);
    await expect(page.locator("#credits")).toContainText(s.label);
    await expect(page.locator("#credits")).toContainText("Ryan, with Codex (GPT-6)");
    await expect(page.locator("#credits")).toContainText("CC0 1.0");
    expect(result.stage, s.id).toEqual([TEXT, TEXT]);
    const png = PNG.sync.read(Buffer.from(result.bytes));
    expect(png.width).toBe(900);
    expect(read(png.data, png.width, png.height), s.id).toBe(TEXT);
  }
  expect(requests.some((u) => u.includes("/ai/cdx-"))).toBe(false);
  expect(new Set(requests.filter((u) => u.includes("/qr-picture/codex/"))).size).toBe(24);
  expect(errors).toEqual([]);
});

test("selected samples at phone and desktop sizes", async ({ browser }) => {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await page.evaluate(
      (id) => window.__splashery.app.setToyOptions({ source: id }),
      "dot-" + PICTURES[0][1],
    );
    await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.motion.setControl("flat", 0, { snap: true });
      p.camera.cur = { ...p.camera.home, yaw: 0.35, pitch: 0.1 };
      p.camera.tgt = { ...p.camera.cur };
      for (let i = 0; i < 4; i++) await p.stage.captureFrame();
    });
    await page.screenshot({ path: `tests/screenshots/cdx-pics-photo-${width}x${height}.png` });
    await page.evaluate(async () => {
      await import("/src/packs/qr-craft.js");
      window.__splashery.qrCraft.autoCheck = false;
      await window.__splashery.app.chooseToy("qr-picture");
    });
    await page.evaluate(
      (id) => window.__splashery.app.setToyOptions({ picture: id }),
      QR_PICTURES[0].id,
    );
    await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) await window.__splashery.player.stage.captureFrame();
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
    await page.screenshot({ path: `tests/screenshots/cdx-pics-qr-${width}x${height}.png` });
    await page.close();
  }
});
