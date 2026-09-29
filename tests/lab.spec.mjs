// Lane Lab (docs/handoff/Lab.md, docs/lab/FIELDS.md): the splat field toy on
// the Lab shelf, labs only. Its splats are placed and colored by a program on
// the GPU every frame (the recipe's gpuField).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, labs) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${APP}&labs=${labs}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

// Two frames of the toy, `secs` apart, from the home view.
async function twoFrames(page, program, secs = 1.5) {
  return page.evaluate(
    async ({ program, secs }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy("splat-field");
      await app.setToyOption("program", program);
      player.camera.setTurntable(false);
      const cam = player.camera;
      cam.cur = { ...cam.home };
      cam.tgt = { ...cam.home };
      const grab = async () => {
        for (let i = 0; i < 3; i++) await player.stage.captureFrame();
        const c = await player.stage.captureFrame();
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        return Array.from(d.filter((_, i) => i % 16 === 0));
      };
      const a = await grab();
      await new Promise((r) => setTimeout(r, secs * 1000));
      const b = await grab();
      return { a, b, splats: player.toyInfo.splats };
    },
    { program, secs },
  );
}

const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const drawn = (px) => px.filter((v, i) => i % 4 !== 3 && v < 200).length;

test("the Lab shelf shows only with labs on", async ({ page }) => {
  await open(page, 0);
  const off = await page.evaluate(async () => {
    const { shelfCategories } = await import("/src/toys.js");
    return shelfCategories().map((c) => c.id);
  });
  expect(off).not.toContain("lab");
  await open(page, 1);
  const on = await page.evaluate(async () => {
    const { shelfCategories, TOYS } = await import("/src/toys.js");
    return { ids: shelfCategories().map((c) => c.id), field: TOYS.find((t) => t.id === "splat-field") }; // prettier-ignore
  });
  expect(on.ids).toContain("lab");
  expect(on.field).toMatchObject({ category: "lab", kind: "kit", pack: "lab", labs: true });
});

test("with labs, every field moves on the GPU, drawing something", async ({ page }) => {
  const errors = await open(page, 1);
  for (const program of ["galaxy", "ocean", "knot"]) {
    const r = await twoFrames(page, program);
    expect(r.splats, program).toBeGreaterThan(100_000);
    expect(drawn(r.a), program).toBeGreaterThan(200);
    expect(diff(r.a, r.b), `${program} moves`).toBeGreaterThan(0.3);
  }
  expect(errors).toEqual([]);
});

test("without labs the toy opens frozen at t = 0 (no GPU program)", async ({ page }) => {
  const errors = await open(page, 0);
  const r = await twoFrames(page, "ocean");
  expect(drawn(r.a)).toBeGreaterThan(200);
  expect(diff(r.a, r.b)).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});

test("every JavaScript field is finite and in range, and each program has all three hooks", async ({
  page,
}) => {
  await open(page, 1);
  const r = await page.evaluate(async () => {
    const { FIELDS, fieldModifier } = await import("/src/packs/lab.js");
    const ok = [];
    for (const [name, f] of Object.entries(FIELDS))
      for (let i = 0; i < 500; i++) {
        const p = f((i * 0.754877) % 1, (i * 0.56984) % 1, i * 0.1);
        ok.push(p.every(Number.isFinite) && Math.hypot(...p) < 1.3 ? 1 : 0);
      }
    const m = fieldModifier("knot", { c: [0, 0, 0], s: 1 });
    return {
      finite: ok.every(Boolean),
      hooks: ["modifySplatCenter", "modifySplatRotationScale", "modifySplatColor"].every(
        (h) => m.glsl.includes(h) && m.wgsl.includes(h),
      ),
    };
  });
  expect(r).toEqual({ finite: true, hooks: true });
});

test("the field compiles and moves on WebGPU too", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?renderer=webgpu&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  test.skip(dev !== "webgpu", "No WebGPU adapter in this browser.");
  const r = await twoFrames(page, "galaxy");
  expect(drawn(r.a)).toBeGreaterThan(200);
  expect(diff(r.a, r.b)).toBeGreaterThan(0.3);
  expect(errors).toEqual([]);
});
