// Task 54: new samples use the real browser and production scan paths.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { PICTURES } from "../src/packs/codex-picture-samples.js";
import { QR_PICTURES } from "../src/qr-craft/codex-pictures.js";
import { SAMPLES as QR_SAMPLES } from "../src/qr-craft/samples.js";
import { DOT_SAMPLES } from "../src/packs/dot-samples.js";
import { load, read, TEXT } from "../tools/cdx-pics-qr.mjs";
import { pictureTrials } from "../tools/cdx-pics-review.mjs";
import { LINKS } from "../tools/cdx-pics-links.mjs";
import { capturePicture } from "../tools/cdx-pics-capture.mjs";
import { renderedTrials } from "../tools/cdx-pics-review-browser.mjs";
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("20 Studio samples and 24 payload-independent QR pictures have complete records and honest labels", async () => {
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
  expect(QR_PICTURES.some((s) => s.ai)).toBe(true);
  expect(new Set(LINKS).size).toBe(5);
  expect(Math.max(...LINKS.map((s) => s.length))).toBeGreaterThanOrEqual(100);
  for (const s of QR_PICTURES) {
    expect(s.defaultPayloadSpecific).toBeFalsy();
    const label = QR_SAMPLES.find((x) => x.id === s.id).label;
    expect(label).not.toContain("default link");
    if (s.ai) {
      expect(s.author).toBe("Ryan, the owner of Splashery (made with an AI image tool)");
      expect(s.license).toBe("AI-made by the owner");
      expect(label).toContain("(AI-made)");
    } else {
      expect(s.author).toContain("Ryan, with Codex");
      expect(s.license).toBe("CC0 1.0");
      expect(label).toContain("CC0, Ryan with Codex");
    }
    const record = records.find((r) => r.id === s.id);
    expect(record).toBeTruthy();
    expect(record.ai).toBe(s.ai);
    expect(record.carrier).toBeUndefined();
  }
});

for (const s of QR_PICTURES)
  test(`${s.label}: production layout scans all five links at default H`, () => {
    const results = pictureTrials(load(s.file));
    expect(results.map((r) => r.text)).toEqual(LINKS);
    expect(results.every((r) => r.eligible)).toBe(true);
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

for (const s of QR_PICTURES)
  test(`${s.label}: five-link browser scans, credits, and lazy loading`, async ({ page }) => {
    test.setTimeout(240000);
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
    {
      await page.evaluate(
        (id) =>
          window.__splashery.app.setToyOptions({
            picture: id,
            text: "https://ryanjosephkamp.github.io/splashery/",
          }),
        s.id,
      );
      await page.waitForFunction(
        (id) =>
          !window.__splashery.app.busy &&
          window.__splashery.qrCraft.picture().options?.picture === id,
        s.id,
      );
      const ck = await page.evaluate(() => window.__splashery.qrCraft.checkPicture());
      expect(ck.ok, s.id).toBe(true);
      expect(
        ck.stage.map((r) => r.text),
        s.id,
      ).toEqual([TEXT, TEXT]);
      await expect(page.locator("#credits")).toContainText(s.label);
      await expect(page.locator("#credits")).toContainText(s.author);
      await expect(page.locator("#credits")).toContainText(s.ai ? "AI-made" : "CC0 1.0");
      for (const text of LINKS) {
        await page.evaluate((text) => window.__splashery.app.setToyOptions({ text }), text);
        const shot = await capturePicture(page, 900, true),
          png = PNG.sync.read(Buffer.from(shot.bytes));
        expect(shot.text).toBe(text);
        expect(shot.options.level).toBe("H");
        const result = renderedTrials(png, shot.codeSize, text, { rawDiagnostic: false });
        expect(
          result.scans.filter((r) => !r.ok),
          s.id + ": " + text,
        ).toEqual([]);
      }
      // Exercise the actual export API as well, with the longest link.
      const exported = await page.evaluate(async () => {
        const q = window.__splashery.qrCraft;
        const b = await q.savePNG(900);
        return {
          bytes: Array.from(new Uint8Array(await b.arrayBuffer())),
          size: q.picture().woven.code.size,
        };
      });
      const png = PNG.sync.read(Buffer.from(exported.bytes));
      expect(png.width).toBe(900);
      expect(
        renderedTrials(png, exported.size, LINKS.at(-1), { rawDiagnostic: false }).eligible,
        s.id,
      ).toBe(true);
      console.log(`${s.label}: five links, production scan, credits, and export passed`);
    }
    expect(requests.some((u) => u.includes("/ai/cdx-"))).toBe(false);
    expect(new Set(requests.filter((u) => u.includes("/qr-picture/codex/"))).size).toBe(1);
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
