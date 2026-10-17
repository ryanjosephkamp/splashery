import { test, expect } from "@playwright/test";
import { TOYS } from "../src/toys.js";
import { buildRecipe, quatRotate } from "../src/kit.js";
import { resolveOptions } from "../src/player.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { parseNotes } from "../src/voices.js";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import { normalizeScene } from "../src/state.js";

const ID = "name-toy";
const APP = "/?labs=1&renderer=webgl2&profile=low&adapt=off";
const load = () => import("../src/packs/name-toy.js");
const blank = () => ({ parts: {}, tokens: [], cues: [] });

async function build(given = {}, count = 60000) {
  const { RECIPES } = await load();
  const recipe = RECIPES[ID];
  const options = resolveOptions(recipe, given);
  const it = buildRecipe(recipe, { seed: 7, count, options }, () => {});
  let r = it.next();
  while (!r.done) r = it.next();
  return { recipe, options, ctx: r.value };
}

test("part d is registered on the Pictures and pages shelf behind labs", async () => {
  expect(TOYS.find((t) => t.id === ID)).toMatchObject({
    kind: "kit",
    pack: "name-toy",
    category: "pictures",
    labs: true,
  });
  const [{ RECIPES }, { RECIPES: pictures }] = await Promise.all([
    load(),
    import("../src/packs/pictures.js"),
  ]);
  expect(RECIPES[ID].tiltLock).toBe(true);
  expect(pictures[ID]).toBe(RECIPES[ID]);
});

// Lane PT1 rebuilt the toy to match Toy Box (October 16, 2026): any text,
// emoji included, through src/text-splats.js; tools on a stage row; drop
// pieces; the site's paint. Its own tests are in tests/pt1.spec.mjs; these
// keep Codex task 78d's checks that still hold, brought up to date.
test("names keep what was typed, any script or emoji, and reject empty or oversized input", async () => {
  const { RECIPES, nameLayout } = await load();
  const input = RECIPES[ID].input;
  expect(await input.read("  Ryan   Kamp  ")).toMatchObject({ name: "Ryan Kamp", paints: "" });
  expect(await input.read("ann-marie")).toMatchObject({ name: "ann-marie" });
  expect(await input.read("💩")).toMatchObject({ name: "💩" });
  const layout = nameLayout("RYAN KAMP");
  expect(layout.letters.map((l) => l.char).join("")).toBe("RYANKAMP");
  expect(layout.letters[0].center[1]).toBeGreaterThan(layout.letters[4].center[1]);
  for (const text of ["", "   ", "A".repeat(49)]) await expect(input.read(text)).rejects.toThrow();
});

test("five detail steps honor the device budget and build finite, deterministic solid letters", async () => {
  const { nameBudget } = await load();
  expect(nameBudget(60000, "auto")).toBe(24000);
  expect(nameBudget(140000, "auto")).toBe(48000);
  expect(nameBudget(200000, "auto")).toBe(96000);
  expect(nameBudget(60000, "192000")).toBe(48000);
  expect(nameBudget(8000, "auto")).toBe(8000);
  for (const detail of ["12000", "24000", "48000", "96000", "192000"]) {
    const { ctx } = await build({ name: "ADA", detail }, 200000);
    expect(ctx.buf.count).toBe(Number(detail));
    expect(Array.from(ctx.buf.pos).every(Number.isFinite)).toBe(true);
    // Three letters of four pieces each: tokens 0 to 11.
    expect(ctx.buf.anim.filter((_, i) => i % 4 === 2).reduce((a, b) => Math.max(a, b), 0)).toBe(11); // prettier-ignore
    expect(ctx.kit.data.layout.letters).toHaveLength(3);
  }
  const a = (await build()).ctx.buf;
  const b = (await build()).ctx.buf;
  expect(a.pos).toEqual(b.pos);
  expect(a.color).toEqual(b.color);
  expect(
    Array.from(a.color.subarray(0, a.count * 4).filter((_, i) => i % 4 === 3)).every(
      (v) => v === 1,
    ),
  ).toBe(true);
});

test("every old verb's Play moves whole pieces rigidly and returns them exactly home, twice", async () => {
  for (const verb of ["spin", "poke", "paint", "drop", "blow"]) {
    const { recipe, ctx } = await build({ name: "ADA", verb });
    const data = ctx.kit.data;
    const rest = blank();
    recipe.drive(0, { play: 0 }, rest, { data, time: 0 });
    let travel = 0;
    let t = 0;
    for (const n of [1, 2]) {
      for (let j = 0; j <= 100; j++) {
        const out = blank();
        t += 1 / 30;
        recipe.drive(t, { play: 1 - j / 100 }, out, {
          data,
          time: t,
          tap: { key: "play", point: null, pick: null, n },
        });
        expect(out.tokens).toHaveLength(12);
        for (const token of out.tokens) {
          expect([...token.offset, ...token.quat].every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...token.quat)).toBeCloseTo(1, 10);
          // Two points on the same piece keep their distance under its transform.
          const p = quatRotate(token.quat, [0.1, 0.2, 0.03]);
          const q = quatRotate(token.quat, [-0.2, 0.05, -0.02]);
          expect(Math.hypot(...p.map((v, i) => v - q[i]))).toBeCloseTo(
            Math.hypot(0.3, 0.15, 0.05),
            10,
          );
          travel = Math.max(travel, Math.hypot(...token.offset));
        }
        if (j === 100)
          for (const token of out.tokens) {
            expect(token.offset).toEqual([0, 0, 0]);
            expect(token.quat).toEqual([0, 0, 0, 1]);
          }
      }
    }
    expect(travel, verb).toBeGreaterThan(0.12);
  }
});

test("each letter has its own note, and old painted letters survive detail changes and links", async () => {
  const { notesFor } = await load();
  const painted = await build({ name: "ADA", paints: ".4.", detail: "12000" });
  const finer = await build({ name: "ADA", paints: ".4.", detail: "48000" });
  expect(painted.ctx.kit.data.colors).toEqual(finer.ctx.kit.data.colors);
  expect(painted.ctx.kit.data.colors[1].map((v) => Math.round(v * 255))).toEqual([106, 44, 255]);
  const notes = notesFor(painted.ctx.kit.data.layout);
  expect(new Set(notes).size).toBe(3);
  expect(parseNotes(notes.join(" "))).toHaveLength(3);
  expect(TOY_SOUNDS[ID]).toMatchObject({ voice: "bar" });
  const scene = normalizeScene({
    version: 3,
    toy: { kind: "builtin", id: ID, options: painted.options },
  });
  expect(normalizeScene(await decodeSceneHash(await encodeSceneHash(scene))).toy).toEqual(
    scene.toy,
  );
  for (const version of [2, 3]) {
    const old = { version, toy: { kind: "builtin", id: "cactus" }, seed: 5 };
    expect(normalizeScene(await decodeSceneHash(await encodeSceneHash(old))).toy.id).toBe("cactus");
  }
});

async function open(page, profile = "low") {
  await page.goto(APP.replace("profile=low", `profile=${profile}`));
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), ID);
  await expect(page.locator("#toy-status")).toHaveText(/^Your name in splats/);
  await expect(page.locator("#tilt-toggle")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.__splashery.player.camera.tiltLock)).toBe(true);
}

test("phone input, error recovery, paint, and the actual #s= link reload the name", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.locator("#sheet-toggle").click();
  await page.locator("#tab-play").click();
  await page.locator("#toy-input-text").fill("Ada Lovelace");
  await page.locator("#toy-input-go").click();
  const options = () => page.evaluate(() => window.__splashery.player.scene.toy.options);
  await expect.poll(options).toMatchObject({ name: "Ada Lovelace" });
  await page.locator("#toy-input-text").fill("   ");
  await page.locator("#toy-input-go").click();
  await expect(page.locator("#toy-input .warning")).toBeVisible();
  expect(await options()).toMatchObject({ name: "Ada Lovelace" });
  await page.evaluate(() => window.__splashery.app.ui.collapseSheet());
  await page.locator('#toy-toolbar [data-toy-tool="paint"]').click();
  await page.locator('#toy-toolbar [data-toy-tool="paint-violet"]').click();
  await page.waitForFunction(() => !!window.__splashery.player.motion.ctx?.kit?.data?.sim);
  const stamps = await page.evaluate(() => {
    const p = window.__splashery.player;
    const c = p.motion.ctx.kit.data.layout.letters[0].center;
    const at = [c[0], c[1], 0.17];
    p.grabStart(p.fromRecipe(at), ...p.screenPoint(at));
    p.grabEnd();
    return p.scene.paint.stamps;
  });
  expect(stamps).toHaveLength(1);
  expect(stamps[0][4]).toBe("#6a2cff");
  await page.evaluate(() => window.__splashery.app.copyLink());
  const url = page.url();
  expect(url).toContain("#s=");
  await page.goto("about:blank");
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']");
  await expect(page.locator("#toy-status")).toHaveText(/^Your name in splats/);
  expect(await options()).toMatchObject({ name: "Ada Lovelace" });
  expect(await page.evaluate(() => window.__splashery.player.scene.paint.stamps)).toEqual(stamps);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`real GPU renders all five tools and a screenshot at ${width}×${height}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await open(page, width === 390 ? "low" : "high");
    await page.evaluate(() => {
      const p = window.__splashery.player;
      p.opts.idleDelay = 1e9;
      p.idle.weight = 0;
    });
    // The name flies in when it opens (Toy Box); let it settle first.
    await page.waitForFunction(
      () => window.__splashery.player.motion.ctx.kit.data.sim.letters.every((b) => Math.hypot(...b.d) === 0), // prettier-ignore
      null,
      { timeout: 60_000 },
    );
    await page.screenshot({ path: `tests/screenshots/cdx-pfd-name-toy-${width}x${height}.png` });
    for (const tool of ["spin", "poke", "paint", "drop", "blow"]) {
      const { diff, edgePixels } = await page.evaluate(async (tool) => {
        const { app, player: p } = window.__splashery;
        if (tool === "blow") app.setLook({ background: "#111111" });
        const data = p.motion.ctx.kit.data;
        const c = data.layout.letters[1].center;
        const at = [c[0], c[1], 0.17];
        return app.withCapture([390, 390], async (base) => {
          const frame = async () => {
            const cv = await p.renderAt(p.time, base.cam);
            return cv.getContext("2d").getImageData(0, 0, 390, 390).data;
          };
          const rest = await frame();
          if (tool === "drop") p.playTool("drop");
          else if (tool !== "spin") p.playTool(tool);
          if (tool === "paint") p.playTool("paint-ink");
          if (tool === "spin" || tool === "poke") p.act(p.fromRecipe(at));
          if (tool === "paint" || tool === "blow") p.grabStart(p.fromRecipe(at), ...p.screenPoint(at)); // prettier-ignore
          if (tool === "paint")
            for (const l of data.layout.letters.slice(0, 4)) {
              const q = [l.center[0], l.center[1], 0.17];
              p.grabAt(...p.screenPoint(q));
              p.grabAt(...p.screenPoint([q[0], q[1] - 0.2, 0.17]));
            }
          let action;
          // Blow: the whole gust stays inside the capture (a 6-pixel margin
          // of background all round, as Codex task 78d's check had).
          let edgePixels = 0;
          for (let k = 0; k < (tool === "blow" ? 15 : 6); k++) {
            p.time += 0.08;
            action = await frame();
            if (tool !== "blow") continue;
            for (let y = 0; y < 390; y++)
              for (let x = 0; x < 390; x++) {
                if (x >= 6 && x < 384 && y >= 6 && y < 384) continue;
                const i = (y * 390 + x) * 4;
                if (Math.abs(action[i] - 17) + Math.abs(action[i + 1] - 17) + Math.abs(action[i + 2] - 17) > 30) edgePixels++; // prettier-ignore
              }
          }
          if (tool === "paint" || tool === "blow") p.grabEnd();
          if (tool === "drop") p.playTool("drop");
          let changed = 0;
          for (let i = 0; i < rest.length; i += 4)
            if (
              Math.abs(rest[i] - action[i]) +
                Math.abs(rest[i + 1] - action[i + 1]) +
                Math.abs(rest[i + 2] - action[i + 2]) >
              30
            )
              changed++;
          return { diff: changed, edgePixels };
        });
      }, tool);
      expect(diff, tool).toBeGreaterThan(400);
      expect(edgePixels, `${tool} stays inside the capture`).toBe(0);
      await page.evaluate(() => window.__splashery.player.clearPaint());
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
