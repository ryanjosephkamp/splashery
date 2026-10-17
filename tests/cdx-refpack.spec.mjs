import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { newPack, loadPack, localFile, validatePack, observations } from "../tools/refpack.mjs";
import { maskImage, pngBytes, segment, maskBounds } from "../tools/refpack-image.mjs";
import { deltaE2000, silhouetteIoU, boundaryF1, exposureMatch } from "../tools/refpack-metrics.mjs";
import { compare3d } from "../tools/refpack-3d.mjs";
import { meshFromModel, plyFromKit, readPlyPoints, writeGLB } from "../tools/refpack-geometry.mjs";
import { loadResult } from "../tools/refpack-score.mjs";
import { visualHullModel } from "../tools/refbuild-kit-hull.mjs";
import { sampleSurface } from "../src/packs/studio-models-core.js";
import { buildKit, writeResult } from "../tools/refbuild-kit.mjs";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "refpack-test-"));
function picture() {
  const mask = Uint8Array.from(
    { length: 32 * 32 },
    (_, i) => +(i % 32 > 5 && i % 32 < 26 && i >= 6 * 32 && i < 26 * 32),
  );
  return maskImage(mask, 32, 32);
}
function packFixture() {
  const dir = temp(),
    image = path.join(dir, "input.png");
  fs.writeFileSync(image, pngBytes(picture()));
  const out = path.join(dir, "pack"),
    pack = newPack([image], out);
  return { dir, out, pack, image };
}
test("new pictures become a valid private schema-1 pack without questions", () => {
  const { dir, out, pack } = packFixture();
  try {
    expect(pack.license.images).toBe("private");
    expect(pack.images[0].view).toBe("unknown");
    expect(pack).not.toHaveProperty("size");
    expect(pack).not.toHaveProperty("notes");
    const command = spawnSync("node", ["tools/refpack.mjs", "check", out], { encoding: "utf8" });
    expect(command.status, command.stderr).toBe(0);
    expect(() => newPack([path.join(dir, "input.png")], out)).toThrow("already exists");
    expect(loadPack(out).id).toBe(pack.id);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("checker rejects wrong contracts, traversal, symlinks, and mismatched masks", () => {
  const { dir, out, pack, image } = packFixture();
  try {
    for (const patch of [
      { schema: 2 },
      { budget: { minutes: 0, quality: "good" } },
      { budget: { minutes: 1, quality: "great" } },
      { images: [] },
      { size: { width: -1 } },
      { moves: [{ part: "seat", how: "warp", axis: "y", amount: 20 }] },
      { parts: [{ name: "a" }, { name: "a" }] },
      { notes: 42 },
    ])
      expect(() => validatePack({ ...pack, ...patch }, out)).toThrow();
    expect(() => localFile(out, "../input.png")).toThrow();
    expect(() => localFile(out, image)).toThrow();
    fs.symlinkSync(image, path.join(out, "escape.png"));
    expect(() => localFile(out, "escape.png")).toThrow("escapes");
    const p = picture();
    p.width = 16;
    p.height = 64;
    fs.writeFileSync(path.join(out, "wrong-mask.png"), pngBytes(p));
    expect(() =>
      validatePack({ ...pack, images: [{ ...pack.images[0], mask: "wrong-mask.png" }] }, out),
    ).toThrow("dimensions");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("color segmentation preserves a foreground object and its enclosed hole", () => {
  const w = 40,
    data = new Uint8Array(w * w * 4).fill(255);
  for (let y = 8; y < 32; y++)
    for (let x = 8; x < 32; x++)
      if (!(x > 15 && x < 24 && y > 15 && y < 24)) data.set([120, 30, 20, 255], (y * w + x) * 4);
  const result = segment({ width: w, height: w, data });
  expect(result.method).toBe("border-color-and-edges");
  expect(result.review).toBe(false);
  expect(result.mask[20 * w + 20]).toBe(0);
  expect(maskBounds(result.mask, w, w).width).toBe(24);
});
test("CIEDE2000 matches published Sharma/Wu/Dalal reference pairs", () => {
  // https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
  for (const [a, b, expected] of [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, 0, 0], [50, -1, 2], 2.3669],
  ])
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 4);
});
test("silhouettes, boundaries, and global exposure have meaningful endpoints", () => {
  const a = Uint8Array.from(
    { length: 100 },
    (_, i) => +(i % 10 >= 2 && i % 10 < 8 && i >= 20 && i < 80),
  );
  const b = Uint8Array.from(a, (x) => 1 - x);
  expect(silhouetteIoU(a, a)).toBe(1);
  expect(silhouetteIoU(a, b)).toBe(0);
  expect(boundaryF1(a, a, 10, 10)).toBe(1);
  const photo = { data: Uint8Array.from([128, 128, 128, 255]) },
    render = { data: Uint8Array.from([128, 128, 128, 255]) };
  expect(exposureMatch([{ photo, render, mask: [1], renderedMask: [1] }])).toBeCloseTo(1);
});
test("3D metrics distinguish identical and displaced closed boxes", () => {
  const model = (x) =>
    meshFromModel({ shapes: [{ type: "box", size: [1, 1, 1], pos: [x, 0, 0] }] });
  const same = compare3d(model(0), model(0), 32),
    shifted = compare3d(model(0), model(0.5), 48);
  expect(same.chamferDistance).toBe(0);
  expect(same.volumeIoU).toBe(1);
  expect(shifted.chamferDistance).toBeGreaterThan(0.1);
  expect(shifted.volumeIoU).toBeCloseTo(1 / 3, 1);
  expect(compare3d({ ...model(0), indices: [] }, model(0), 24).volumeIoU).toBe(null);
});
test("builder works when truth is unavailable and exports named rigid parts within its cap", async () => {
  const { dir, out, pack } = packFixture();
  try {
    pack.moves = [{ part: "object", how: "bounce", axis: "y", amount: 0.1 }];
    pack.images[0].view = "front";
    fs.writeFileSync(path.join(out, "pack.json"), JSON.stringify(pack));
    fs.mkdirSync(path.join(out, "truth"));
    fs.writeFileSync(path.join(out, "truth/truth.json"), "Do not read this invalid JSON.");
    const built = await buildKit(out, {
      minutes: 0.2,
      quality: "draft",
      out: path.join(dir, "result"),
      maxEvaluations: 20,
      renderChecks: 0,
    });
    expect(built.metadata.withinBudget).toBe(true);
    expect(built.metadata.minutes).toBeLessThan(0.2);
    expect(built.metadata.inputs.some((s) => s.includes("truth"))).toBe(false);
    expect(built.metadata.parts[0].name).toBe("object");
    expect(fs.statSync(path.join(built.out, "parts/object.ply")).size).toBeGreaterThan(1000);
    const positions = readPlyPoints(fs.readFileSync(path.join(built.out, "result.ply"))).positions;
    expect(positions.every(Number.isFinite)).toBe(true);
    const recipe = await import(path.join(built.out, "recipe.mjs"));
    expect(recipe.RECIPES[pack.id].action.key).toBe("play");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("all seven kit shape families emit finite splats and export companion geometry", () => {
  for (const type of ["box", "rounded-box", "sphere", "cylinder", "cone", "lathe", "extrusion"]) {
    const model = {
      shapes: [
        {
          type,
          size: [1, 1, 1],
          profile: [
            [0.4, -0.5],
            [0.5, 0],
            [0.2, 0.5],
          ],
          outline: [
            [-0.3, 0.3, -0.5],
            [-0.5, 0.5, 0],
            [-0.2, 0.2, 0.5],
          ],
        },
      ],
    };
    const points = readPlyPoints(plyFromKit(model, 800)).positions;
    expect(points.length, type).toBeGreaterThan(1000);
    expect(points.every(Number.isFinite), type).toBe(true);
    expect(meshFromModel(model).indices.length, type).toBeGreaterThan(20);
  }
});

test("GLB-only results preserve an external builder's shared coordinates", async () => {
  const dir = temp();
  try {
    const model = {
      shapes: [{ type: "box", size: [1, 1, 1], pos: [3, 2, 1], color: [0.4, 0.5, 0.6] }],
    };
    await writeGLB(path.join(dir, "result.glb"), meshFromModel(model));
    fs.writeFileSync(
      path.join(dir, "result.json"),
      JSON.stringify({ schema: 1, pack: "external-box", builder: "blender", minutes: 0.1 }),
    );
    const result = await loadResult(dir, { id: "external-box" });
    const sampled = sampleSurface(result.mesh.prep, 64, { light: false });
    expect(sampled.rgb[1]).toBeCloseTo(0.5, 3);
    const points = readPlyPoints(result.bytes).positions;
    const xs = Array.from(points).filter((_, i) => i % 3 === 0);
    const ys = Array.from(points).filter((_, i) => i % 3 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(2.49);
    expect(Math.max(...xs)).toBeLessThanOrEqual(3.51);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(1.49);
    expect(Math.max(...ys)).toBeLessThanOrEqual(2.51);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("visual-hull initialization keeps front-facing holes in separate rigid extrusions", () => {
  const image = { width: 32, height: 32, data: new Uint8Array(32 * 32 * 4) };
  const mask = Uint8Array.from(
    { length: 32 * 32 },
    (_, i) =>
      +(
        i % 32 >= 8 &&
        i % 32 < 24 &&
        i >= 8 * 32 &&
        i < 24 * 32 &&
        !(i % 32 >= 13 && i % 32 < 19 && i >= 13 * 32 && i < 19 * 32)
      ),
  );
  const model = visualHullModel(
    [
      { entry: { view: "front" }, image, mask },
      { entry: { view: "back" }, image, mask },
    ],
    [1, 1, 0.5],
    "frame",
    [0.4, 0.4, 0.4],
    8,
  );
  expect(model.shapes.length).toBeGreaterThan(8);
  expect(model.shapes.every((s) => s.type === "extrusion" && s.part === "frame")).toBe(true);
});
