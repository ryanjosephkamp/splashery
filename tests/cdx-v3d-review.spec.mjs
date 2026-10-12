import { test, expect } from "@playwright/test";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  copyFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { SAMPLES } from "../src/video3d/samples.js";
import { ORIGINAL_CAPTURES } from "../tools/cdx-v3d-mac-bake.mjs";

function room() {
  const points = [];
  for (let x = -1; x <= 1; x += 0.04) for (let y = -0.6; y <= 0.6; y += 0.04) points.push(x, y, -1);
  const count = points.length / 3;
  return {
    count,
    pos: new Float32Array(points),
    scales: new Float32Array(count * 3).fill(0.02),
    quat: Float32Array.from({ length: count * 4 }, (_, i) => Number(i % 4 === 3)),
    color: new Float32Array(count * 3).fill(0.5),
    opacity: new Float32Array(count).fill(0.9),
  };
}
const cameras = [0, 0.05, 0.1, 0.15].map((z, time) => ({
  time,
  pos: [0, 0, -z],
  yaw: 0,
  pitch: 0,
  f: 100,
  w: 160,
  h: 120,
}));

test("Walk can cross supported space away from the camera path and stops at unknown space", async () => {
  const { buildWalkRegion } = await import("../src/video3d/region.js");
  const { createWalk, closestPathPoint } = await import("../src/video3d/walk.js");
  const region = buildWalkRegion(room(), cameras);
  expect(region.contains([0.2, 0, -0.4])).toBe(true);
  expect(region.contains([0, 0, -1.1])).toBe(false);
  expect(region.contains([1, 0, -0.4])).toBe(false);
  expect(region.stats.multiViewCells).toBeGreaterThan(region.stats.cameraCells);
  const walk = createWalk(cameras, { region });
  for (let i = 0; i < 300; i++) walk.step(1 / 60, { forward: 1, right: 0.6 });
  expect(closestPathPoint(cameras, walk.state.pos).distance).toBeGreaterThan(0.08);
  expect(region.contains(walk.state.pos)).toBe(true);
  for (let i = 0; i < 3000; i++) walk.step(1 / 60, { right: 1 });
  expect(region.contains(walk.state.pos)).toBe(true);
  expect(walk.state.boundary).toBe(true);
  const before = walk.state.pos.slice();
  walk.step(60, { right: 1 });
  expect(Math.hypot(...walk.state.pos.map((v, k) => v - before[k]))).toBeLessThan(0.02);
});

test("a large native build export is compacted before the site byte gate", () => {
  test.setTimeout(120000);
  const scratch = mkdtempSync(join(tmpdir(), "cdx-v3d-register-"));
  try {
    const assets = join(scratch, "assets/toys/video-3d");
    const input = join(scratch, "input");
    mkdirSync(assets, { recursive: true });
    mkdirSync(input);
    mkdirSync(join(scratch, "tools"));
    mkdirSync(join(scratch, "src/video3d"), { recursive: true });
    writeFileSync(join(scratch, "tools/assets.json"), readFileSync("tools/assets.json"));
    writeFileSync(
      join(scratch, "CREDITS.md"),
      "<!-- Codex task 40 new Video to 3D captures -->\n<!-- End Codex task 40 new Video to 3D captures -->\n",
    );
    for (const sample of SAMPLES) {
      const base = resolve(`assets/toys/video-3d/${sample.id}`);
      copyFileSync(`${base}.ply`, join(assets, `${sample.id}.ply`));
      writeFileSync(join(assets, `${sample.id}.json`), readFileSync(`${base}.json`));
      if (!sample.transformationCredit) continue;
      for (const ext of ["mp4", "webm"])
        symlinkSync(`${base}-source.${ext}`, join(assets, `${sample.id}-source.${ext}`));
      let bytes = readFileSync(`${base}.ply`);
      const meta = JSON.parse(readFileSync(`${base}.json`));
      if (sample.id === "lihula") {
        // Standard-format fixture only: repeat real Gaussian rows, not a new trained scene.
        const end = bytes.indexOf("end_header\n") + "end_header\n".length;
        const count = Number(
          bytes
            .subarray(0, end)
            .toString()
            .match(/element vertex (\d+)/)[1],
        );
        const header = Buffer.from(
          bytes
            .subarray(0, end)
            .toString()
            .replace(`element vertex ${count}`, `element vertex ${count * 30}`),
        );
        bytes = Buffer.concat([header, ...Array(30).fill(bytes.subarray(end))]);
        expect(bytes.length).toBeGreaterThan(20_000_000);
        meta.stats.splats = count * 30;
        meta.bake.backend = "msplat/Metal"; // Exercise backend-aware registration, not training.
        meta.bake.source = ORIGINAL_CAPTURES.lihula;
        meta.bake.sourceTimeOffset = 18;
        meta.bake.fixture = true;
      }
      const folder = join(input, sample.id);
      mkdirSync(folder);
      writeFileSync(join(folder, `${sample.id}.ply`), bytes);
      writeFileSync(join(folder, `${sample.id}.json`), JSON.stringify(meta));
    }
    execFileSync(process.execPath, [resolve("tools/cdx-v3d-register.mjs"), input], {
      cwd: scratch,
      timeout: 110000,
      maxBuffer: 2e6,
    });
    const registry = JSON.parse(readFileSync(join(scratch, "tools/assets.json")));
    const record = registry.videoSamples.find((r) => r.id === "lihula");
    expect(record.note).toContain("COLMAP and msplat on Metal");
    expect(record.defaultBytes).toBeLessThan(15_000_000);
    expect(existsSync(join(assets, "lihula.ply"))).toBe(false);
    expect(record.captureSha256).toBe(ORIGINAL_CAPTURES.lihula.captureSha256);
    const metadata = JSON.parse(readFileSync(join(assets, "lihula.json")));
    expect(metadata.provenance.captureUrl).toBe(ORIGINAL_CAPTURES.lihula.captureUrl);
    expect(metadata.bake.sourceTimeOffset).toBe(18);
    expect(record.file).toMatch(/manifest\.json$/);
    const manifest = JSON.parse(readFileSync(join(scratch, record.baked.file)));
    expect(manifest.defaultTier).toBe(400000);
    expect(Math.max(...manifest.tiers.map((t) => t.splats))).toBe(720000);
    for (const file of Object.values(record.files)) expect(file.bytes).toBeLessThan(20_000_000);
    expect(readFileSync(join(scratch, "CREDITS.md"), "utf8")).toContain(
      "the backend recorded in each sample JSON",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("Walk supports a full turn and clamps pitch without snapping to the filmed heading", async () => {
  const { createWalk } = await import("../src/video3d/walk.js");
  const walk = createWalk(cameras);
  for (let i = 0; i < 100; i++) walk.step(1 / 60, { lookX: 10, lookY: 20 });
  expect(Math.abs(walk.state.yaw)).toBeGreaterThan(1);
  expect(Math.abs(walk.state.pitch)).toBeLessThanOrEqual(Math.PI * 0.44);
  const before = walk.state.yaw;
  walk.step(1 / 60);
  expect(Math.abs(walk.state.yaw - before)).toBeLessThan(0.1);
});

test("six BKD1 scenes preserve cameras and reduce default bytes", async () => {
  const { readBakedScene } = await import("../src/video3d/baked.js");
  const { sceneFromSplats } = await import("../src/packs/video3d.js");
  const { readSplatPly } = await import("../src/video3d/ply.js");
  const assets = JSON.parse(readFileSync("tools/assets.json"));
  expect(assets.bakedSamples.length).toBeGreaterThan(0);
  expect(assets.videoReviewEvidence).toBeUndefined();
  for (const sample of SAMPLES) {
    const file = `assets/toys/video-3d/${sample.baked}`;
    const raw = await readBakedScene(pathToFileURL(resolve(file)));
    const meta = JSON.parse(readFileSync(`assets/toys/video-3d/${sample.id}.json`));
    const result = sceneFromSplats(raw, meta.cams, { affine: true });
    expect(raw.count).toBe(
      readSplatPly(new Uint8Array(readFileSync(`assets/toys/video-3d/${sample.id}.ply`))).count,
    );
    expect(result.path.length).toBe(meta.cams.length);
    expect(result.scene.count).toBeGreaterThan(1000);
    expect(raw.pos.every(Number.isFinite)).toBe(true);
    const record = assets.videoSamples.find(
      (r) => r.id === sample.id || r.file.endsWith(`/${sample.id}.ply`),
    );
    expect(record.baked.defaultBytes).toBeLessThan(meta.stats.plyBytes);
  }
});

test("Walk and Turn and zoom both reject giants and smears and derive a sky dome", async () => {
  const { sceneFromSplats } = await import("../src/packs/video3d.js");
  const points = [];
  for (let i = 0; i < 32; i++) points.push((i % 8) * 0.1 - 0.4, Math.floor(i / 8) * 0.1 - 0.2, 2);
  points.push(0, 0, 1.8, 0.1, 0, 1.8);
  for (let i = 0; i < 20; i++) points.push((i - 10) * 0.1, -3, 10);
  const count = points.length / 3;
  const raw = {
    ...room(),
    count,
    pos: new Float32Array(points),
    scales: new Float32Array(count * 3).fill(0.003),
    quat: Float32Array.from({ length: count * 4 }, (_, i) => Number(i % 4 === 3)),
    opacity: new Float32Array(count).fill(0.9),
    color: new Float32Array(count * 3).fill(0.8),
  };
  raw.scales.fill(1, 32 * 3, 33 * 3);
  raw.scales.fill(0.03, 33 * 3, 34 * 3);
  raw.opacity[33] = 0.3;
  const cams = [0, 0.05, 0.1].map((x, time) => ({
    time,
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    t: [-x, 0, 0],
    f: 100,
    w: 160,
    h: 120,
  }));
  for (const affine of [false, true]) {
    const result = sceneFromSplats(raw, cams, { affine });
    expect(result.pruned.giant).toBeGreaterThan(0);
    expect(result.pruned.smear).toBeGreaterThan(0);
    expect(result.skyCount).toBeGreaterThan(10);
    expect(result.sky.every((c) => Math.abs(c - 0.8) < 1e-5)).toBe(true);
    expect(result.dome.radius).toBeGreaterThanOrEqual(4);
  }
});
