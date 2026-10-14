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

test("part d is registered on the Pictures and pages shelf behind labs", () => {
  expect(TOYS.find((t) => t.id === ID)).toMatchObject({
    kind: "kit",
    pack: "name-toy",
    category: "pictures",
    labs: true,
  });
});

test("names use the existing word paths, preserve spaces, and reject unsupported or oversized input", async () => {
  const { RECIPES, nameLayout } = await load();
  const input = RECIPES[ID].input;
  expect(await input.read("  Ryan   Kamp  ")).toMatchObject({ name: "RYAN KAMP", paints: "" });
  expect(await input.read("ann-marie")).toMatchObject({ name: "ANN-MARIE" });
  const { charPath } = await import("../src/packs/maths.js");
  const layout = nameLayout("RYAN KAMP");
  expect(layout.letters.map((l) => l.char).join("")).toBe("RYANKAMP");
  expect(layout.letters[0].path).toEqual(charPath("R", 192));
  expect(layout.letters[0].center[1]).toBeGreaterThan(layout.letters[4].center[1]);
  for (const text of ["", "   ", "<script>", "A".repeat(25), "💩"])
    await expect(input.read(text)).rejects.toThrow();
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
    // Kit shares are rounded separately for each surface.
    expect(Math.abs(ctx.buf.count - Number(detail))).toBeLessThanOrEqual(4);
    expect(Array.from(ctx.buf.pos).every(Number.isFinite)).toBe(true);
    expect(ctx.buf.anim.filter((_, i) => i % 4 === 2).reduce((a, b) => Math.max(a, b), 0)).toBe(2);
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

test("all five verbs move entire letters rigidly and return them exactly home, including a second tap", async () => {
  for (const verb of ["spin", "poke", "paint", "drop", "blow"]) {
    const { recipe, ctx } = await build({ name: "ADA", verb });
    const data = ctx.kit.data;
    const rest = blank();
    recipe.drive(0, { play: 0 }, rest, { data });
    let travel = 0;
    for (const n of [1, 2]) {
      for (let j = 0; j <= 100; j++) {
        const out = blank();
        recipe.drive(j / 30, { play: 1 - j / 100 }, out, {
          data,
          tap: { key: "play", pick: null, n },
        });
        expect(out.tokens).toHaveLength(3);
        for (const token of out.tokens) {
          expect([...token.offset, ...token.quat].every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...token.quat)).toBeCloseTo(1, 10);
          // Two points on the same letter keep their distance under its transform.
          const p = quatRotate(token.quat, [0.1, 0.2, 0.03]);
          const q = quatRotate(token.quat, [-0.2, 0.05, -0.02]);
          expect(Math.hypot(...p.map((v, i) => v - q[i]))).toBeCloseTo(
            Math.hypot(0.3, 0.15, 0.05),
            10,
          );
          travel = Math.max(travel, Math.hypot(...token.offset), Math.abs(token.quat[2]));
        }
        if (j === 100) expect(out.tokens).toEqual(rest.tokens);
      }
    }
    expect(travel, verb).toBeGreaterThan(0.12);
  }
});

test("tapping a letter chooses its own note, and paint survives detail changes and scene links", async () => {
  const { recipe, ctx } = await build({ name: "ADA", verb: "paint", color: "violet" });
  const hit = recipe.action.at(ctx.kit.data.layout.letters[1].center);
  expect(hit).toMatchObject({ key: "play", pick: 1 });
  expect(hit.options.paints).toBe(".4.");
  const painted = await build({ name: "ADA", ...hit.options, detail: "12000" });
  const finer = await build({ name: "ADA", ...hit.options, detail: "48000" });
  expect(painted.ctx.kit.data.colors).toEqual(finer.ctx.kit.data.colors);
  expect(painted.ctx.kit.data.colors[1]).toBe("#6a2cff");
  const notes = parseNotes(TOY_SOUNDS[ID].notes).flat();
  expect(notes).toHaveLength(24);
  expect(new Set(notes).size).toBe(24);
  expect(parseNotes(recipe.toySound({ name: "ADA" }).notes)).toHaveLength(3);
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
  await expect.poll(options).toMatchObject({ name: "ADA LOVELACE" });
  await page.locator("#toy-input-text").fill("<script>");
  await page.locator("#toy-input-go").click();
  await expect(page.locator("#toy-input .warning")).toBeVisible();
  expect(await options()).toMatchObject({ name: "ADA LOVELACE" });
  await page
    .locator("#toy-options label")
    .filter({ hasText: /^Action/ })
    .locator("select")
    .selectOption("paint");
  await page
    .locator("#toy-options label")
    .filter({ hasText: /^Paint color/ })
    .locator("select")
    .selectOption("violet");
  await page.evaluate(() => {
    const p = window.__splashery.player;
    const data = p.motion.ctx.kit.data;
    return p.switchTo(p.toyInfo.recipe.action.at(data.layout.letters[0].center));
  });
  await expect.poll(options).toMatchObject({ paints: expect.stringMatching(/^4/) });
  await page.evaluate(() => window.__splashery.app.copyLink());
  const url = page.url();
  expect(url).toContain("#s=");
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']");
  await expect(page.locator("#toy-status")).toHaveText(/^Your name in splats/);
  expect(await options()).toMatchObject({
    name: "ADA LOVELACE",
    paints: expect.stringMatching(/^4/),
  });
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`real GPU renders all five actions and a screenshot at ${width}×${height}`, async ({
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
      p.frozen = true;
    });
    await page.screenshot({ path: `tests/screenshots/cdx-pfd-name-toy-${width}x${height}.png` });
    for (const verb of ["spin", "poke", "paint", "drop", "blow"]) {
      const diff = await page.evaluate(async (verb) => {
        const { app, player: p } = window.__splashery;
        await app.setToyOption("verb", verb);
        return app.withCapture([390, 390], async () => {
          const frame = async (v) => {
            p.motion.setControl("play", v, { snap: true });
            const c = await p.renderAt(p.time, p.camera.home);
            return c.getContext("2d").getImageData(0, 0, 390, 390).data;
          };
          const rest = await frame(0);
          const action = await frame(0.65);
          let changed = 0;
          for (let i = 0; i < rest.length; i += 4)
            if (
              Math.abs(rest[i] - action[i]) +
                Math.abs(rest[i + 1] - action[i + 1]) +
                Math.abs(rest[i + 2] - action[i + 2]) >
              30
            )
              changed++;
          return changed;
        });
      }, verb);
      expect(diff, verb).toBeGreaterThan(400);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
