import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { path } from "../src/packs/incompressible-shuffle-core.js";
import * as pack from "../src/packs/incompressible-shuffle.js";
const id = "incompressible-shuffle";
function build(stretch = "2") {
  const recipe = pack.RECIPES[id];
  const it = buildRecipe(recipe, { seed: 7, count: 30000, options: { stretch } }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value;
}
function drive(ctx, t = 0, extra = {}, c = {}) {
  const out = { parts: {}, cues: [] };
  ctx.recipe.drive(t, { go: 0, pause: 0, reset: 0, pin: 0, ...c }, out, {
    data: ctx.kit.data,
    ...extra,
  });
  return out;
}
test("native skin4 centers agree with analytic paths after float32 fit and token decoding", () => {
  for (const l of [0.5, 1, 2]) {
    const ctx = build(String(l)),
      { buf, transform: f } = ctx;
    expect(buf.count).toBeGreaterThan(10000);
    expect(buf.count).toBeLessThan(50000);
    for (const time of [
      0,
      1.5 / 16,
      3.5 / 16,
      5.5 / 16,
      7.5 / 16,
      9.5 / 16,
      11.5 / 16,
      13.5 / 16,
      1,
    ]) {
      const out = drive(ctx, 0, {
        slider: { id: "shuffle", value: time, n: Math.round(time * 1000) + 1 },
      });
      expect(out.tokens.length).toBeLessThan(48);
      expect(out.resort).toBe(true);
      for (let i = 0; i < buf.count; i += 113) {
        if (buf.anim[i * 4 + 1] !== KINDS.skin4) continue;
        const bits = buf.anim[i * 4 + 2],
          uv = buf.anim[i * 4 + 3];
        const ids = [
          bits % 64,
          Math.floor(bits / 64) % 64,
          Math.floor(bits / 4096) % 64,
          Math.floor(bits / 262144) % 64,
        ];
        const u = Math.floor(uv / 1024) / 1023,
          v = (uv % 1024) / 1023;
        const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
        const actual = [0, 1, 2].map(
          (k) =>
            (buf.pos[i * 3 + k] +
              weights.reduce(
                (s, w, j) => s + w * Math.fround(out.tokens[ids[j]].offset[k] * f.scale),
                0,
              )) /
              f.scale +
            f.center[k],
        );
        const expected = path([-0.4 + 0.8 * u, -0.4 + 0.8 * v], ids[0] / 4, l, time);
        [expected[0], expected[2], expected[1]].forEach((x, k) =>
          expect(Math.abs(actual[k] - x)).toBeLessThan(2e-5),
        );
      }
    }
  }
});
test("Swap, pause, scrub, reset and replay always evaluate original labels", () => {
  const ctx = build();
  drive(ctx);
  drive(ctx, 1, { tap: { n: 1, key: "go" } });
  drive(ctx, 7);
  expect(ctx.kit.data.time).toBeCloseTo(0.5, 8);
  drive(ctx, 8, {}, { pause: 1 });
  const held = ctx.kit.data.time;
  drive(ctx, 18, {}, { pause: 1 });
  expect(ctx.kit.data.time).toBe(held);
  drive(ctx, 19, { slider: { id: "shuffle", n: 1, value: 0.73 } });
  expect(ctx.kit.data.time).toBe(0.73);
  drive(ctx, 21);
  expect(ctx.kit.data.time).toBe(0.73);
  drive(ctx, 22, { tap: { n: 2, key: "go" } });
  expect(ctx.kit.data.time).toBe(0);
  drive(ctx, 40);
  expect(ctx.kit.data.time).toBe(1);
  drive(ctx, 41, { tap: { n: 3, key: "go" } });
  expect(ctx.kit.data.time).toBe(0);
  drive(ctx, 42, { tap: { n: 4, key: "reset" } });
  expect(ctx.kit.data.time).toBe(0);
});
test("inverse picking pins an actual quantized sample and exact seven-segment trail", () => {
  const ctx = build();
  drive(ctx, 0, { slider: { id: "shuffle", n: 1, value: 0.72 } });
  const sample = ctx.kit.data.samples[0][123],
    p = path(sample, 0, 2, 0.72);
  const pick = ctx.recipe.action.at([p[0], p[2], p[1]], {});
  expect(pick.key).toBe("pin");
  expect(pick.pick.branch).toBe(0);
  expect(pick.pick.index).toBe(123);
  const out = drive(ctx, 0, { tap: { n: 1, key: "pin", pick: pick.pick } });
  expect(ctx.kit.data.pin).toEqual(pick.pick);
  expect(out.tokens.slice(8, 16)).toHaveLength(8);
  for (let j = 0; j < 8; j++) {
    const q = path(sample, 0, 2, j / 8);
    expect(out.tokens[j + 8].offset).toEqual([q[0], q[2], q[1]]);
  }
});

test("browser controls update the visible scrubber, pause and reset", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("incompressible-shuffle"));
  await expect(page.locator("#toy-status")).toContainText("Incompressible Shuffle");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#toy-slider-input").fill("730");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.time))
    .toBe(0.73);
  await page.evaluate(() => window.__splashery.player.act());
  await expect
    .poll(async () => Number(await page.locator("#toy-slider-input").inputValue()))
    .toBeLessThan(100);
  await page.evaluate(() => window.__splashery.app.setControl("pause", 1));
  await page.waitForTimeout(100);
  const held = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.time);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.time)).toBe(held);
  await page.evaluate(() => window.__splashery.app.setControl("reset", 1));
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.time))
    .toBe(0);
  expect(errors).toEqual([]);
});

test("recipe cooperates with native replay and visible reset and slider contracts", async () => {
  const { MotionDriver, DEFAULT_MOTION } = await import("../src/motion.js");
  const ctx = build(),
    m = new MotionDriver();
  m.setToy(ctx.recipe, ctx);
  const frame = (time) =>
    m.compute({
      time,
      dt: 0.1,
      motion: DEFAULT_MOTION,
      info: { radius: 1, half: [1, 1, 1], center: [0, 0, 0] },
      cameraPos: [0, 0, 4],
      cameraDistance: 4,
    });
  frame(0);
  m.act(0);
  frame(0.1);
  frame(0.5);
  expect(m.act(0.5).paused).not.toBe(true);
  expect(ctx.recipe.controls.find((c) => c.key === "reset").type).toBe("toggle");
  const a = drive(ctx, 0, { slider: { id: "shuffle", value: 0.73, n: 1 } }).slider;
  const b = drive(ctx, 0, { tap: { n: 9, key: "go" } }).slider;
  expect(b.id).not.toBe(a.id); // UI sets thumb only when id changes.
  drive(ctx, 1, {}, { reset: 1 });
  expect(ctx.kit.data.time).toBe(0);
});

test("both marked patch outlines retain exact area 0.04 at every partial stage", () => {
  const ctx = build();
  for (const time of [0, 0.22, 0.34, 0.47, 0.59, 0.72, 0.84, 1]) {
    const out = drive(ctx, 0, {
      slider: { id: "shuffle", value: time, n: Math.round(time * 1000) + 1 },
    });
    for (let b = 0; b < 2; b++) {
      const pts = out.tokens.slice(17 + b * 4, 21 + b * 4).map((t) => t.offset);
      expect(pts).toHaveLength(4);
      let area = 0;
      pts.forEach((p, j) => {
        const q = pts[(j + 1) % 4];
        area += p[0] * q[2] - q[0] * p[2];
      });
      expect(area / 2).toBeCloseTo(0.04, 12);
    }
  }
});

test("Swap respects visible Pause, reset works on both edges, and idle frames need no sort", () => {
  const ctx = build();
  drive(ctx);
  const paused = drive(ctx, 1, { tap: { n: 1, key: "go" } }, { pause: 1 });
  expect(paused.legend.title).toContain("Paused");
  drive(ctx, 7, {}, { pause: 1 });
  expect(ctx.kit.data.time).toBe(0);
  drive(ctx, 8);
  expect(ctx.kit.data.time).toBeGreaterThan(0);
  drive(ctx, 9, {}, { reset: 1 });
  expect(ctx.kit.data.time).toBe(0);
  drive(ctx, 10, { slider: { n: 1, value: 0.7 } }, { reset: 1 });
  drive(ctx, 11, {}, { reset: 0 });
  expect(ctx.kit.data.time).toBe(0);
  expect(drive(ctx, 12).resort).toBe(false);
});

test("source credit has a valid license link and sound is a quiet non-musical cue", async () => {
  const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
  expect(pack.RECIPES[id].credits[0].licenseUrl).toMatch(
    /^https:\/\/github.com\/openai\/math\/blob\/[a-f0-9]{40}\/LICENSE$/,
  );
  expect(TOY_SOUNDS[id].voice).toBe("whoosh");
  expect(TOY_SOUNDS[id].vol).toBeLessThan(0.3);
});

test("native packed token uniforms hide the unpinned path and reveal all seven segments on pin", async () => {
  const { MotionDriver, DEFAULT_MOTION } = await import("../src/motion.js");
  const ctx = build(),
    m = new MotionDriver();
  m.setToy(ctx.recipe, ctx);
  const frame = (time) =>
    m.compute({
      time,
      dt: 0.1,
      motion: DEFAULT_MOTION,
      info: { radius: 1, half: [1, 1, 1], center: [0, 0, 0] },
      cameraPos: [0, 0, 4],
      cameraDistance: 4,
    });
  frame(0);
  for (let j = 8; j <= 16; j++) expect(m.tokenData[j * 8 + 3]).toBe(0);
  const label = ctx.kit.data.samples[0][123],
    p = path(label, 0, 2, 0);
  m.act(0.1, [p[0], p[2], p[1]]);
  frame(0.1);
  for (let j = 8; j <= 16; j++) expect(m.tokenData[j * 8 + 3]).toBe(1);
  for (let j = 0; j < 7; j++)
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const w = m.tokenData[(8 + j) * 8 + 3] * (1 - u) + m.tokenData[(9 + j) * 8 + 3] * u;
      expect(w).toBe(1);
    }
});

test("a pin event without pointer coordinates chooses a deterministic existing sample", () => {
  const ctx = build();
  drive(ctx, 0, { tap: { n: 1, key: "pin" } });
  expect(ctx.kit.data.pin).toEqual({
    branch: 0,
    index: Math.floor(ctx.kit.data.samples[0].length * 0.68),
  });
  expect(ctx.kit.data.samples[0][ctx.kit.data.pin.index]).toHaveLength(2);
});
