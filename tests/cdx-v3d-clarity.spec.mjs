import { test, expect } from "@playwright/test";

import { sampleBudget, phoneSample } from "../src/video3d/tiers.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { cleanScene } from "../src/video3d/cleanup.js";

test("calibrated sample clouds preserve their camera frame and declare geometry outside kit fitting", async () => {
  const { buildRecipe } = await import("../src/kit.js");
  const { applyClay } = await import("../src/generators.js");
  const { resolveOptions } = await import("../src/player.js");
  const { RECIPES } = await import("../src/packs/video3d.js");
  const recipe = RECIPES["video-3d"];
  for (const navigation of ["orbit", "walk"]) {
    const options = resolveOptions(recipe, { source: "liberty", navigation });
    await recipe.prepare(options);
    const it = buildRecipe(recipe, { seed: 3, count: 8000, options }, applyClay);
    let result = it.next();
    while (!result.done) result = it.next();
    const { kit, buf } = result.value;
    expect(kit.fitOn).toBe(false);
    expect(kit.transform).toEqual({ center: [0, 0, 0], scale: 1 });
    const excluded = new Uint8Array(buf.count);
    for (const item of kit.items)
      if (item.opts.fit === false) excluded.fill(1, item.start, item.end);
    let outside = 0;
    let undeclared = 0;
    for (let i = 0; i < buf.count; i++) {
      if (Math.hypot(...buf.pos.subarray(i * 3, i * 3 + 3)) <= 1.001) continue;
      outside++;
      if (!excluded[i]) undeclared++;
    }
    expect(outside).toBeGreaterThan(0);
    expect(undeclared).toBe(0);
  }
});
test("opaque fitted bars retain camera support while faint rays and unsupported floaters are removed", () => {
  const scene = {
    count: 4,
    pos: Float32Array.from([0, 0.4, -1, 0.2, 0.4, -1, 100, 0.4, -1, 0, 0, 0.001]),
    scales: Float32Array.from([
      0.1, 0.003, 0.002, 0.1, 0.003, 0.002, 0.1, 0.003, 0.002, 0.001, 0.001, 0.001,
    ]),
    quat: Float32Array.from(Array.from({ length: 4 }, () => [1, 0, 0, 0]).flat()),
    color: new Float32Array(12).fill(0.5),
    opacity: Float32Array.from([0.9, 0.2, 0.9, 0.9]),
  };
  const path = Array.from({ length: 3 }, () => ({
    pos: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    f: 1,
    w: 3,
    h: 3,
  }));
  expect(cleanScene(scene, path, { affine: true }).scene.count).toBe(0);
  const fitted = cleanScene(scene, path, { affine: true, preservePhotometric: true });
  expect(fitted.scene.count).toBe(1);
  expect(fitted.removed).toEqual({ ray: 1, unsupported: 1, atPath: 1, invalid: 0 });
});

test("the independent scorer rejects camera changes after a render", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-camera-receipt-"));
  const hash = (data) => createHash("sha256").update(data).digest("hex");
  const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
  try {
    const folder = path.join(scratch, "liberty");
    fs.mkdirSync(path.join(folder, "frames"), { recursive: true });
    const png = new PNG({ width: 16, height: 16 });
    png.data.fill(128);
    const bytes = PNG.sync.write(png),
      ply = Buffer.from("scoring fixture");
    const cams = [{ time: 1, frame: "000.png", frameSha256: hash(bytes), f: 700 }];
    write(path.join(folder, "main.json"), { cams });
    write(path.join(folder, "candidate.json"), { cams });
    fs.writeFileSync(path.join(folder, "candidate.ply"), ply);
    fs.writeFileSync(path.join(folder, "candidate-0.png"), bytes);
    fs.writeFileSync(path.join(folder, "frames/000.png"), bytes);
    write(path.join(scratch, "ledger.json"), {
      main: "fixture",
      samples: [
        {
          id: "liberty",
          heldOut: [0],
          cameraLedgerSha256: hash(fs.readFileSync(path.join(folder, "main.json"))),
        },
      ],
    });
    write(path.join(folder, "candidate-render-receipt.json"), {
      plySha256: hash(ply),
      poseSha256: hash(JSON.stringify(cams)),
      frames: [{ index: 0, time: 1, sha256: hash(bytes) }],
    });
    const score = () =>
      execFileSync(
        process.execPath,
        ["tools/cdx-v3d-clarity.mjs", "score", scratch, "candidate", "liberty"],
        { stdio: "pipe" },
      );
    score();
    write(path.join(folder, "candidate.json"), { cams: [{ ...cams[0], f: 701 }] });
    expect(score).toThrow(/another camera ledger/);
    write(path.join(folder, "candidate.json"), { cams });
    write(path.join(folder, "main.json"), { cams: [{ ...cams[0], f: 701 }] });
    expect(score).toThrow(/Changed frozen camera ledger/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("Auto preserves a compact phone tier and allows the sharper desktop tier", () => {
  expect(sampleBudget(224000, { phone: true, profile: "mid" })).toBe(60000);
  expect(sampleBudget(96000, { profile: "low" })).toBe(60000);
  expect(sampleBudget(224000, { phone: false, profile: "mid" })).toBe(224000);
  expect(sampleBudget(40000, { phone: true })).toBe(40000);
  globalThis.__v3dPhone = true;
  try {
    expect(phoneSample("high", { forced: "", detail: "auto" })).toBe(true);
    expect(phoneSample("high", { forced: "high", detail: "auto" })).toBe(false);
    expect(phoneSample("high", { forced: "", detail: "high" })).toBe(false);
    expect(phoneSample("low", { forced: "low", detail: "high" })).toBe(true);
  } finally {
    delete globalThis.__v3dPhone;
  }
});

test("measured photometric surfaces keep their fitted broad splats while near-camera floaters are removed", async () => {
  const { sceneFromSplats } = await import("../src/packs/video3d.js");
  const count = 33,
    raw = {
      count,
      pos: new Float32Array(count * 3),
      scales: new Float32Array(count * 3),
      quat: new Float32Array(count * 4),
      color: new Float32Array(count * 3),
      opacity: new Float32Array(count),
    };
  for (let i = 0; i < count; i++) {
    raw.pos.set([0, 0, i === 32 ? 0.005 : 2], i * 3);
    raw.scales.set([0.08, 0.06, 0.05], i * 3);
    raw.quat.set([0, 0, 0, 1], i * 4);
    raw.color.set([0.2, 0.4, 0.2], i * 3);
    raw.opacity[i] = 0.2;
  }
  const cams = [0, 1, 2].map((time) => ({
    time,
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    t: [0, 0, 0],
    f: 100,
    w: 100,
    h: 100,
  }));
  const ordinary = sceneFromSplats(raw, cams, { affine: true });
  const measured = sceneFromSplats(raw, cams, { affine: true, preservePhotometric: true });
  expect(ordinary.scene.count).toBe(0);
  expect(measured.scene.count).toBe(32);
  expect(measured.pruned.atCamera).toBe(1);
  expect(measured.scene.scales[0]).toBeCloseTo(0.08 * 0.45, 6);
  for (let i = 0; i < 32; i++) raw.pos[i * 3 + 2] = 10;
  const orbit = sceneFromSplats(raw, cams, { preservePhotometric: true });
  expect(Math.abs(orbit.scene.pos[2])).toBeCloseTo(4.5, 6);
});
import {
  imageMetrics,
  evaluationCameras,
  interpolateCamera,
  meetsClarityGoal,
} from "../tools/cdx-v3d-clarity-metrics.mjs";

const image = (fn) => ({
  width: 32,
  height: 32,
  data: Uint8Array.from({ length: 32 * 32 * 4 }, (_, i) =>
    i % 4 === 3 ? 255 : fn(Math.floor(i / 4) % 32, Math.floor(i / 128)),
  ),
});

test("clarity measurements reject mismatched images and distinguish detail from blur", () => {
  const detailed = image((x, y) => ((x + y) % 2 ? 220 : 35));
  const flat = image(() => 127);
  const exact = imageMetrics(detailed, detailed);
  expect(exact.ssim).toBeCloseTo(1, 10);
  expect(exact.sharpnessRatio).toBeCloseTo(1, 10);
  expect(exact.exact).toBe(true);
  const blurred = imageMetrics(flat, detailed);
  expect(blurred.ssim).toBeLessThan(0.05);
  expect(blurred.laplacian).toBe(0);
  expect(() => imageMetrics({ ...flat, width: 31 }, detailed)).toThrow(/equal-size/);
  expect(meetsClarityGoal({ ssim: 0.4, laplacian: 0.01 }, { ssim: 0.451, laplacian: 0.0151 })).toBe(
    true,
  );
  expect(meetsClarityGoal({ ssim: 0.4, laplacian: 0.01 }, { ssim: 0.449, laplacian: 0.02 })).toBe(
    false,
  );
  expect(meetsClarityGoal({ ssim: 0.4, laplacian: 0.01 }, { ssim: 0.5, laplacian: 0.014 })).toBe(
    false,
  );
  expect(meetsClarityGoal({ ssim: 0.4, laplacian: 0 }, { ssim: 0.9, laplacian: 1 })).toBe(false);
});

test("evaluation images are new midpoints with an orthonormal pose and a frozen one-in-eight split", () => {
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const cams = Array.from({ length: 25 }, (_, time) => ({
    time,
    R: I,
    t: [-time, 0, 0],
    f: 700,
    w: 800,
    h: 450,
  }));
  const split = evaluationCameras(cams);
  expect(split).toHaveLength(49);
  const held = split.filter((c) => c.heldOut);
  expect(held).toHaveLength(6);
  expect(held.every((c) => !cams.some((o) => o.time === c.time))).toBe(true);
  expect(held[0].time).toBe(1.5);
  expect(held[0].t[0]).toBe(-1.5);
  const turn = { ...cams[1], R: [0, 0, 1, 0, 1, 0, -1, 0, 0] };
  const c = interpolateCamera(cams[0], turn, 0.5);
  for (let row = 0; row < 3; row++)
    expect(Math.hypot(...c.R.slice(row * 3, row * 3 + 3))).toBeCloseTo(1, 10);
  const dot = c.R.slice(0, 3).reduce((s, v, k) => s + v * c.R[k + 6], 0);
  expect(dot).toBeCloseTo(0, 10);
});

test("D-SSIM training updates real Gaussian parameters without GPU validation errors", async ({
  page,
}) => {
  await page.route("**/__clarity-test.html", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Trainer validation</title>" }),
  );
  await page.goto("/__clarity-test.html");
  const result = await page.evaluate(async () => {
    const { requestTrainingDevice } = await import("/tools/cdx-v3d-clarity-gpu.mjs");
    const { createSession } = await import("/vendor/splatjs/src/session.js");
    const device = await requestTrainingDevice();
    const errors = [];
    device.addEventListener("uncapturederror", (event) => errors.push(event.error.message));
    const session = createSession({
      device,
      maxViewW: 64,
      maxViewH: 64,
      holdout: -1,
      frames: { trainMaxDim: 64, featMaxDim: 64 },
      trainer: { maxSplats: 1, capMult: 1, shDeg: 0, ssimWeight: 0.2 },
    });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const g = canvas.getContext("2d");
      g.fillStyle = "rgb(180,120,50)";
      g.fillRect(0, 0, 64, 64);
      const blob = await new Promise((r) => canvas.toBlob(r));
      await session.load([
        new File([blob], "frame.png", { type: "image/png" }),
        new File([blob], "second.png", { type: "image/png" }),
      ]);
      session.useReconstruction({
        cams: [{ imgIdx: 0, R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0], f: 60, w: 64, h: 64 }],
        points: [],
      });
      await session.seedFrom(
        {
          data: Float32Array.from([0, 0, 2, -2, -2, -2, 1, 0, 0, 0, -0.5, -0.5, -0.5, 2, 0, 0]),
          n: 1,
          shK: 0,
          dc: "sh",
        },
        { sceneRadius: 2 },
      );
      const before = new Uint8Array(await (await session.exportPlyBlob()).arrayBuffer());
      for (let i = 0; i < 4; i++) session.trainer.stepOnce();
      await device.queue.onSubmittedWorkDone();
      const after = new Uint8Array(await (await session.exportPlyBlob()).arrayBuffer());
      const loss = await session.trainer.readLoss();
      await new Promise((r) => setTimeout(r, 20));
      return { errors, changed: before.some((v, i) => v !== after[i]), loss };
    } finally {
      session.dispose();
      device.destroy();
    }
  });
  expect(result.errors).toEqual([]);
  expect(result.changed).toBe(true);
  expect(result.loss).toBeGreaterThan(0);
});
