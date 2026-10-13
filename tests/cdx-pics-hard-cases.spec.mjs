// Task 57: real samples, lazy file loading, and the existing toy's flat/raised views.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  HARD_CASE_SAMPLES,
  HARD_CASE_GROUP,
  addHardCaseSamples,
} from "../src/packs/hard-case-samples.js";
import * as pack from "../src/packs/photo-3d.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("20 labeled samples cover all seven cases and carry matching image/depth records", async () => {
  expect(HARD_CASE_SAMPLES).toHaveLength(20);
  expect(new Set(HARD_CASE_SAMPLES.map((s) => s.id)).size).toBe(20);
  expect(new Set(HARD_CASE_SAMPLES.map((s) => s.category)).size).toBe(7);
  const records = JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).photoSamples;
  const credits = fs.readFileSync("CREDITS.md", "utf8");
  for (const s of HARD_CASE_SAMPLES) {
    const r = records.find((r) => r.id === s.id);
    expect(s.ai).toBe(true);
    expect(s.group).toBe(HARD_CASE_GROUP);
    expect(s.label).toMatch(/\(AI-made\)$/);
    expect(s.license).toBe("AI-made by the owner");
    expect(r.ai).toBe(true);
    expect(r.sha256).toBe(hash(r.file));
    expect(r.depthSha256).toBe(hash(r.depth));
    expect(credits).toContain(`(${s.prompt}): \`${r.file}\``);
    const photo = await pack.decodePhoto(new Uint8Array(fs.readFileSync(r.file)));
    expect(photo.w).toBe(1280);
    expect([photo.w, photo.h]).toEqual(r.dimensions);
    expect(fs.statSync(r.file).size).toBe(r.bytes);
    expect(fs.statSync(r.depth).size).toBe(r.depthBytes);
    expect(fs.statSync(r.file).size).toBeLessThan(500_000);
    const depth = pack.unpackDepth(new Uint8Array(fs.readFileSync(r.depth)));
    expect(depth.d.length).toBe(depth.w * depth.h);
    expect(Array.from(depth.d).every(Number.isFinite)).toBe(true);
    let min = Infinity,
      max = -Infinity;
    for (const d of depth.d) {
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    expect(max - min).toBeGreaterThan(0);
  }
});

test("registration preserves existing choices and default and is safe on repeated builds", () => {
  const recipe = pack.RECIPES["photo-3d"];
  const option = recipe.options.find((o) => o.key === "source");
  const before = option.choices.map((c) => c.id);
  const defaultPhoto = option.default;
  addHardCaseSamples(pack);
  const after = option.choices.map((c) => c.id);
  addHardCaseSamples(pack);
  expect(option.choices.map((c) => c.id)).toEqual(after);
  expect(option.default).toBe(defaultPhoto);
  expect(after.filter((id) => !HARD_CASE_SAMPLES.some((s) => s.id === id))).toEqual(before);
  expect(after.at(-1)).toBe("custom");
  for (const s of HARD_CASE_SAMPLES) {
    expect(pack.ALL_SAMPLES.filter((x) => x.id === s.id)).toHaveLength(1);
    expect(recipe.credits.filter((c) => c.label === s.label)).toHaveLength(1);
  }
});

test("every hard-case choice loads its own files and changes from flat to raised in Chromium", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const requests = [],
    errors = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  expect(requests.some((u) => /hard-case-samples|\/hard-cases\//.test(u))).toBe(false);
  await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
  await expect(
    page.locator(`#toy-options optgroup[label="${HARD_CASE_GROUP}"] option`),
  ).toHaveCount(20);
  expect(requests.filter((u) => u.includes("/hard-cases/"))).toEqual([]);
  const start = requests.length;
  for (const s of HARD_CASE_SAMPLES) {
    await page.evaluate(
      (id) => window.__splashery.app.setToyOptions({ source: id, depth: 0.5 }),
      s.id,
    );
    await page.waitForFunction(
      (label) => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.name === label,
      s.label,
    );
    const view = async (flat) =>
      page.evaluate(async (flat) => {
        const p = window.__splashery.player;
        p.idle.weight = 0;
        p.camera.setTurntable(false);
        p.camera.cur = { ...p.camera.home, yaw: 0.35, pitch: 0.1 };
        p.camera.tgt = { ...p.camera.cur };
        p.motion.setControl("flat", flat, { snap: true });
        for (let i = 0; i < 4; i++) await p.stage.captureFrame();
        return {
          image: (await p.stage.captureFrame(180, 180)).toDataURL(),
          info: p.proc.ctx.kit.data.photo,
        };
      }, flat);
    const flat = await view(1);
    const raised = await view(0);
    expect(raised.info.splats, s.id).toBeGreaterThan(5000);
    expect(raised.info.relief, s.id).toBeGreaterThan(0.3);
    expect(raised.image, s.id).not.toBe(flat.image);
    expect(
      requests.filter((u) => u.endsWith(`/hard-cases/${s.file}.jpg`)),
      s.id,
    ).toHaveLength(1);
    expect(
      requests.filter((u) => u.endsWith(`/hard-cases/${s.file}.depth`)),
      s.id,
    ).toHaveLength(1);
  }
  await page.screenshot({ path: "tests/screenshots/cdx-pics-hard-cases-390x844.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "tests/screenshots/cdx-pics-hard-cases-1440x900.png" });
  expect(requests.slice(start).some((u) => /onnx|ort-wasm/.test(u))).toBe(false);
  expect(errors).toEqual([]);
});
