// Lane Studio Models: 3D model files to splats (docs/handoff/StudioModels.md).
// The parsers and the converter are checked on small models of our own (tests/fixtures/stm/,
// made by tools/stm-fixtures.mjs); the toy is checked through the kit and in the browser.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import {
  parseModel,
  prepareModel,
  sampleSurface,
  wireGeometry,
  wireSplats,
  NeedsFilesError,
  MODEL_BUDGETS,
  MODEL_DENSITY,
  TIER_COUNTS,
  linearToSrgb,
} from "../src/packs/studio-models-core.js";
import { RECIPES, useModel, liftShape, modelState } from "../src/packs/studio-models.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS, CATEGORIES } from "../src/toys.js";

const FIX = "tests/fixtures/stm";
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const bytes = (f) => new Uint8Array(fs.readFileSync(path.join(FIX, f)));
const decodeImage = (b, mime) => {
  if (mime === "image/png" || b[0] === 0x89) {
    const p = PNG.sync.read(Buffer.from(b));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const j = jpeg.decode(Buffer.from(b), { useTArray: true });
  return { w: j.width, h: j.height, data: j.data };
};
const load = async (name, files) => {
  const raw = parseModel(bytes(name), name, { files });
  return prepareModel(raw, { decodeImage });
};
const RECIPE = RECIPES["model-splats"];

// Builds the toy at a splat count with a model shown as "your model".
function buildToy(prep, count, options = {}) {
  useModel(prep);
  const o = resolveOptions(RECIPE, { source: "custom", ...options });
  return RECIPE.prepare(o).then(() => {
    const it = buildRecipe(RECIPE, { seed: 1, count, options: o }, applyClay);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  });
}

test.describe("reading model files", () => {
  test("a glTF binary (a textured quad) loads", async () => {
    const p = await load("quad.glb");
    expect(p.format).toBe("glb");
    expect(p.triangles).toBe(2);
    expect(p.totalArea).toBeCloseTo(1, 5);
    expect(p.textured).toBe(true);
  });

  test("a glTF with embedded data and vertex colors loads", async () => {
    const p = await load("cube.gltf");
    expect(p.format).toBe("gltf");
    expect(p.triangles).toBe(12);
    expect(p.totalArea).toBeCloseTo(6, 5);
    expect(p.col).toBeTruthy();
  });

  test("a glTF that needs its own file says which, and loads once it has it", async () => {
    let err = null;
    try {
      parseModel(bytes("quad-loose.gltf"), "quad-loose.gltf");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NeedsFilesError);
    expect(err.message).toContain("quad-loose.bin");
    expect(err.message).toContain(".glb");
    const p = await load("quad-loose.gltf", { "quad-loose.bin": bytes("quad-loose.bin") });
    expect(p.triangles).toBe(2);
  });

  test("an OBJ takes its colors from its MTL, and shows gray without it", async () => {
    const p = await load("pyramid.obj", new Map([["pyramid.mtl", bytes("pyramid.mtl")]]));
    expect(p.triangles).toBe(6); // four sides and a quad base cut in two
    const names = p.materials.map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(["side", "base"]));
    const bare = await load("pyramid.obj");
    expect(bare.notes.join(" ")).toContain("pyramid.mtl");
    expect(bare.materials[0].color[0]).toBeCloseTo(bare.materials[0].color[1], 5);
  });

  test("an STL loads, binary and ASCII", async () => {
    const a = await load("tetra-ascii.stl");
    expect(a.triangles).toBe(4);
    expect(a.format).toBe("stl");
    const b = await load("cube-binary.stl");
    expect(b.triangles).toBe(12);
    expect(b.totalArea).toBeCloseTo(600, 3); // a cube 10 across
  });

  test("things that are not models give a plain message", async () => {
    expect(() => parseModel(new TextEncoder().encode("hello"), "x.txt")).toThrow(/not a 3D model/);
    expect(() => parseModel(new TextEncoder().encode('{"asset":{"version":"1.0"}}'), "x.gltf")).toThrow(/2\.0/); // prettier-ignore
    const draco = { asset: { version: "2.0" }, extensionsRequired: ["KHR_draco_mesh_compression"] };
    expect(() => parseModel(new TextEncoder().encode(JSON.stringify(draco)), "x.gltf")).toThrow(/Draco/); // prettier-ignore
  });

  test("every format turns into splats that lie on it", async () => {
    for (const [f, files] of [
      ["quad.glb"],
      ["cube.gltf"],
      ["pyramid.obj", new Map([["pyramid.mtl", bytes("pyramid.mtl")]])],
      ["tetra-ascii.stl"],
      ["cube-binary.stl"],
    ]) {
      const p = await load(f, files);
      const s = sampleSurface(p, 4000, { up: "y" });
      expect(s.n, f).toBeGreaterThan(2500);
      expect(s.n, f).toBeLessThanOrEqual(4000);
      let bad = 0;
      for (let i = 0; i < s.n * 3; i++) if (!Number.isFinite(s.pos[i])) bad++;
      // Inside a sphere of radius 1 (the toy's fit).
      for (let i = 0; i < s.n; i++) {
        if (Math.hypot(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]) > 1.001) bad++;
      }
      expect(bad, f).toBe(0);
    }
  });
});

test.describe("the conversion", () => {
  test("the tier budgets are the kit's counts for the toy", () => {
    for (const tier of Object.keys(TIER_COUNTS)) {
      const t = PROFILES[tier];
      expect(MODEL_BUDGETS[tier]).toBe(Math.round(Math.min(t.maxCount, t.defaultCount * MODEL_DENSITY))); // prettier-ignore
      expect(MODEL_BUDGETS[tier]).toBeLessThanOrEqual(t.maxCount);
    }
    expect(RECIPE.density).toBe(MODEL_DENSITY);
  });

  test("a sample model stays within each tier's budget, in splats and in a wireframe", async () => {
    const vase = await (async () => {
      const bytesV = new Uint8Array(fs.readFileSync("assets/toys/model-splats/vase.glb"));
      return prepareModel(parseModel(bytesV, "vase.glb"), { decodeImage });
    })();
    expect(vase.textured).toBe(true);
    for (const tier of ["low", "mid", "high", "max"]) {
      const budget = MODEL_BUDGETS[tier];
      const ctx = await buildToy(vase, budget);
      expect(ctx.buf.count, tier).toBeLessThanOrEqual(budget);
      expect(ctx.buf.count, tier).toBeGreaterThan(budget * 0.9);
      expect(modelState().splats).toBe(ctx.buf.count);
    }
    const w = await buildToy(vase, MODEL_BUDGETS.low, { show: "wire" });
    expect(w.buf.count).toBeLessThan(MODEL_BUDGETS.low * 0.5);
    expect(modelState().wire).toBe(true);
    expect(modelState().edges).toBeGreaterThan(100);
  });

  test("a flat quad closes: no holes, and nothing to see through", async () => {
    const quad = await load("quad-loose.gltf", { "quad-loose.bin": bytes("quad-loose.bin") });
    for (const count of [3000, 6000, 30000]) {
      const ctx = await buildToy(quad, count, { light: false });
      const b = ctx.buf;
      // Every splat is solid, and flat on the quad.
      let weak = 0;
      for (let i = 0; i < b.count; i++) {
        if (!(b.color[i * 4 + 3] > 0.9) || Math.abs(b.pos[i * 3 + 2]) > 1e-4) weak++;
      }
      expect(weak).toBe(0);
      // The area is covered: composite each splat's Gaussian (as the renderer draws it,
      // exp(-r²/σ²)) over a grid of points and read the opacity that builds up.
      let lo = Infinity;
      let hi = -Infinity;
      let sigMax = 0;
      for (let i = 0; i < b.count; i++) {
        lo = Math.min(lo, b.pos[i * 3], b.pos[i * 3 + 1]);
        hi = Math.max(hi, b.pos[i * 3], b.pos[i * 3 + 1]);
        sigMax = Math.max(sigMax, b.scale[i * 3]);
      }
      const margin = 2.5 * sigMax; // the rim itself is half covered by nature
      const cell = 3 * sigMax;
      const grid = new Map();
      const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
      for (let i = 0; i < b.count; i++) {
        const k = key(b.pos[i * 3], b.pos[i * 3 + 1]);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
      let n = 0;
      let sum = 0;
      let worst = 1;
      const G = 90;
      for (let a = 0; a < G; a++)
        for (let c = 0; c < G; c++) {
          const x = lo + margin + ((a + 0.5) / G) * (hi - lo - 2 * margin);
          const y = lo + margin + ((c + 0.5) / G) * (hi - lo - 2 * margin);
          let T = 1;
          for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
              for (const i of grid.get(key(x + dx * cell, y + dy * cell)) || []) {
                const s = b.scale[i * 3];
                const d2 = (x - b.pos[i * 3]) ** 2 + (y - b.pos[i * 3 + 1]) ** 2;
                T *= 1 - b.color[i * 4 + 3] * Math.exp(-d2 / (s * s));
              }
          n++;
          sum += 1 - T;
          worst = Math.min(worst, 1 - T);
        }
      expect(sum / n, `${count} splats`).toBeGreaterThan(0.98);
      expect(worst, `${count} splats`).toBeGreaterThan(0.8);
    }
  });

  test("colors follow the texture (the quad's four colors land where they should)", async () => {
    const quad = await load("quad.glb");
    const s = sampleSurface(quad, 8000, { light: false });
    const want = {
      "0,1": [1, 0, 0], // top left: red
      "1,1": [0, 1, 0], // top right: green
      "0,0": [0, 0, 1], // bottom left: blue
      "1,0": [1, 1, 0], // bottom right: yellow
    };
    let checked = 0;
    let right = 0;
    const sc = s.scale; // the quad's toy coordinates are its own, centered, times scale
    for (let i = 0; i < s.n; i++) {
      // Back to the quad's own 0..1 (the middle of the quad is at 0.5).
      const x = s.pos[i * 3] / sc + 0.5;
      const y = s.pos[i * 3 + 1] / sc + 0.5;
      // Only near the middle of each texel, where the picture has one color.
      if (Math.abs(((x * 2) % 1) - 0.5) > 0.2 || Math.abs(((y * 2) % 1) - 0.5) > 0.2) continue;
      const e = want[`${x > 0.5 ? 1 : 0},${y > 0.5 ? 1 : 0}`];
      checked++;
      if ([0, 1, 2].every((k) => Math.abs(s.rgb[i * 3 + k] - e[k]) < 0.15)) right++;
    }
    expect(checked).toBeGreaterThan(1000);
    expect(right / checked).toBeGreaterThan(0.97);
  });

  test("vertex colors and MTL colors show, and light shades them softly", async () => {
    // A cube whose corners are colored by position: color = position + 0.5 on every face.
    const cube = await load("cube.gltf");
    const s = sampleSurface(cube, 6000, { light: false, up: "y" });
    let off = 0;
    for (let i = 0; i < s.n; i++) {
      for (let k = 0; k < 3; k++) {
        const raw = s.pos[i * 3 + k] / s.scale + 0.5;
        if (Math.abs(s.rgb[i * 3 + k] - linearToSrgb(Math.min(1, Math.max(0, raw)))) > 0.04) off++;
      }
    }
    expect(off / (s.n * 3)).toBeLessThan(0.02);
    // The pyramid: red sides, a green base.
    const pyr = await load("pyramid.obj", new Map([["pyramid.mtl", bytes("pyramid.mtl")]]));
    const t = sampleSurface(pyr, 6000, { light: false });
    let red = 0;
    let green = 0;
    for (let i = 0; i < t.n; i++) {
      const [r, g] = [t.rgb[i * 3], t.rgb[i * 3 + 1]];
      if (r > 0.8 && g < 0.3) red++;
      if (g > 0.7 && r < 0.3) green++;
    }
    expect(red / t.n).toBeGreaterThan(0.6);
    expect(green / t.n).toBeGreaterThan(0.1);
    // Light only dims and brightens a little (the other kit toys' soft key light).
    const lit = sampleSurface(pyr, 3000, { light: true });
    const dark = sampleSurface(pyr, 3000, { light: false });
    const sum = (a) => a.rgb.reduce((p, q) => p + q, 0) / a.n;
    expect(sum(lit) / sum(dark)).toBeGreaterThan(0.75);
    expect(sum(lit) / sum(dark)).toBeLessThan(1.05);
  });

  test("hard edges are found, and an upright STL turns to Y up", async () => {
    const cube = await load("cube-binary.stl");
    // Every face of a cube meets its neighbors at a hard edge.
    expect(cube.crease.every((b) => b !== 0)).toBe(true);
    const z = sampleSurface(cube, 3000, { up: "auto" });
    const yTop = Math.max(...Array.from({ length: z.n }, (_, i) => z.pos[i * 3 + 1]));
    expect(yTop).toBeGreaterThan(0.5); // its Z axis became up
  });

  test("the wireframe is the mesh's edges", async () => {
    const cube = await load("cube.gltf");
    const w = wireGeometry(cube, {});
    expect(w.edges).toBe(18); // 12 sides of the cube and a diagonal on each of the six faces
    const list = wireSplats(w, 4000);
    expect(list.length).toBeGreaterThan(18);
    expect(list.length).toBeLessThanOrEqual(4000);
    expect(list.some((e) => e.hard)).toBe(true);
    // A denser mesh is simplified to a net that stays readable.
    const vase = await prepareModel(
      parseModel(new Uint8Array(fs.readFileSync("assets/toys/model-splats/vase.glb")), "vase.glb"),
      { decodeImage },
    );
    expect(wireGeometry(vase, {}).edges).toBeLessThan(3000);
  });

  test("the command-line tool writes a splat PLY", () => {
    const out = ".cache/stm/test-quad.ply";
    const log = execFileSync("node", ["tools/model-to-splats.mjs", `${FIX}/quad.glb`, "--splats", "2000", "--out", out], { encoding: "utf8" }); // prettier-ignore
    expect(log).toContain("quad");
    const head = fs.readFileSync(out).subarray(0, 200).toString("latin1");
    const n = Number(/element vertex (\d+)/.exec(head)[1]);
    expect(n).toBeGreaterThan(1500);
    expect(n).toBeLessThanOrEqual(2000);
    expect(fs.readFileSync(out).subarray(0, 600).toString("latin1")).toContain(
      "property float scale_2",
    );
  });
});

test.describe("the tap", () => {
  test("the lift is 0 at rest, rises through the model like a wave and settles back to 0", () => {
    expect(liftShape(0, 0)).toBe(0);
    expect(liftShape(1, 0)).toBe(0);
    expect(liftShape(1, 3)).toBeCloseTo(0, 6);
    // The bottom starts before the top; every channel reaches the full lift.
    expect(liftShape(0.15, 0)).toBeGreaterThan(liftShape(0.15, 3));
    for (let ch = 0; ch < 4; ch++) expect(liftShape(0.4, ch)).toBeCloseTo(1, 6);
    // No jumps: the shape changes smoothly.
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      expect(Math.abs(liftShape(p, 1) - prev)).toBeLessThan(0.1);
      prev = liftShape(p, 1);
    }
  });

  test("each splat has its own place in the cloud, and every number is finite", async () => {
    const pyr = await load("pyramid.obj", new Map([["pyramid.mtl", bytes("pyramid.mtl")]]));
    const ctx = await buildToy(pyr, 5000);
    const m = ctx.kit.morph;
    const seen = new Set();
    let bad = 0;
    for (let i = 0; i < ctx.buf.count; i++) {
      const d = [m[i * 3], m[i * 3 + 1], m[i * 3 + 2]];
      if (!d.every(Number.isFinite) || Math.hypot(...d) >= 0.8) bad++;
      seen.add(d.map((v) => v.toFixed(4)).join());
    }
    expect(bad).toBe(0);
    expect(seen.size).toBeGreaterThan(ctx.buf.count * 0.95);
    const out = { morph: null };
    RECIPE.drive(0, { lift: 0.5 }, out, {});
    expect(out.morph.length).toBe(4);
    RECIPE.drive(0, { lift: 0 }, out, {});
    expect(out.morph.every((v) => v === 0)).toBe(true);
  });
});

test.describe("the toy in the browser", () => {
  test.describe.configure({ timeout: 300_000 });

  test("it is a labs toy on the Studio shelf", () => {
    const t = TOYS.find((x) => x.id === "model-splats");
    expect(t.labs).toBe(true);
    expect(t.category).toBe("studio");
    expect(CATEGORIES.some((c) => c.id === "studio")).toBe(true);
  });

  test("a sample shows, a tap lifts and settles, opening your own models works", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("model-splats"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
    const first = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.model);
    expect(first.name).toBe("Burger");
    expect(first.splats).toBeLessThanOrEqual(240_000);
    await expect(page.locator("#toy-input")).toContainText("triangles became");
    // The tap: lifts, then settles back to rest.
    await page.evaluate(() => window.__splashery.app.act());
    await page.waitForFunction(() => window.__splashery.player.motion.state.lift > 0.2, null, { timeout: 30_000 }); // prettier-ignore
    await page.waitForFunction(() => window.__splashery.player.motion.state.lift === 0, null, { timeout: 60_000 }); // prettier-ignore
    // Your own model: a binary STL, then a GLB with a texture.
    await page.locator("#toy-input-file").setInputFiles(path.join(FIX, "cube-binary.stl"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === "cube-binary", null, { timeout: 60_000 }); // prettier-ignore
    const stl = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.model);
    expect(stl.triangles).toBe(12);
    expect(stl.up).toBe("z");
    await page.locator("#toy-input-file").setInputFiles(path.join(FIX, "quad.glb"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === "quad", null, { timeout: 60_000 }); // prettier-ignore
    // The wireframe view.
    await page.evaluate(() => window.__splashery.app.setToyOptions({ show: "wire" }));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.wire === true, null, { timeout: 60_000 }); // prettier-ignore
    // A file that is not a model gives a message, not a crash.
    await page.locator("#toy-input-file").setInputFiles({ name: "x.glb", mimeType: "model/gltf-binary", buffer: Buffer.from("not a model") }); // prettier-ignore
    await expect(page.locator(".warning:visible")).toBeVisible();
    // A .gltf that needs another file says which.
    await page.locator("#toy-input-file").setInputFiles(path.join(FIX, "quad-loose.gltf"));
    await expect(page.locator(".warning:visible")).toContainText("quad-loose.bin");
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      // prettier-ignore
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("model-splats"));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
      await page.evaluate(() => window.__splashery.app.setToyOptions({ source: "vase" }));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === "Blue-and-white vase", null, { timeout: 60_000 }); // prettier-ignore
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/screenshots/stm-model-splats-${w}x${h}.png` });
      await page.close();
    }
  });
});
