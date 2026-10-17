// Lane PT1: the shared text module (src/text-splats.js), Your name in splats
// rebuilt to match Ryan Kamp's Toy Box name toy, and Shape morph's list of
// forms. Old links and saved scenes of both toys keep opening.
import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import { normalizeScene } from "../src/state.js";
import { graphemes, cleanText, visibleCount, textRows, textSplats, layoutText } from "../src/text-splats.js"; // prettier-ignore

const APP = "/?labs=1&renderer=webgl2&adapt=off";
const blank = () => ({ parts: {}, tokens: null, cues: [] });

async function build(id, pack, given = {}, count = 24000) {
  const { RECIPES } = await import(`../src/packs/${pack}.js`);
  const recipe = RECIPES[id];
  const options = resolveOptions(recipe, given);
  if (recipe.prepare) await recipe.prepare(options);
  const it = buildRecipe(recipe, { seed: 7, count, options }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return { recipe, options, ctx: r.value };
}

// ---- The text module ---------------------------------------------------------------

test("text splits into what a person sees as characters, emoji sequences included", () => {
  expect(graphemes("Ryan")).toEqual(["R", "y", "a", "n"]);
  // A family joined by zero-width joiners, a flag, a skin tone, and a
  // letter with a combining accent are one character each.
  const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
  const flag = "\u{1F1EF}\u{1F1F5}";
  const thumb = "\u{1F44D}\u{1F3FD}";
  const accent = "é";
  expect(graphemes(`${family}${flag}${thumb}${accent}`)).toEqual([family, flag, thumb, accent]);
  expect(visibleCount(`a b\n${flag}`)).toBe(3);
  expect(cleanText("  Ada \t  Lovelace \r\n\r\n x ")).toBe("Ada Lovelace\nx");
  expect(textRows("RYAN KAMP", 8).map((r) => r.join(""))).toEqual(["RYAN", "KAMP"]);
  expect(textRows("ABCDEFGHIJ", 4).map((r) => r.join(""))).toEqual(["ABCD", "EFGH", "IJ"]);
});

test("right-to-left rows read right to left, and joined scripts draw whole words", () => {
  // Hebrew: the first letter (shin) ends up on the right.
  expect(textRows("שלום", 8)[0]).toEqual(["ם", "ו", "ל", "ש"]);
  const g = layoutText("שלום").glyphs;
  expect(g.at(-1).g).toBe("ש");
  expect(g.at(-1).x).toBeGreaterThan(g[0].x);
  // Two Hebrew words: the first on the right; Latin and digits inside keep their order.
  expect(textRows("Hi שלום 123", 12)[0].join("")).toBe("Hi םולש 123");
  expect(textRows("שלום Ryan", 12)[0].join("")).toBe("Ryan םולש");
  // Arabic and Devanagari words are one shaped piece each, Arabic right to left.
  expect(textRows("مرحبا بالعالم", 8)[0]).toEqual(["بالعالم", " ", "مرحبا"]);
  expect(textRows("नमस्ते Ryan", 12)[0][0]).toBe("नमस्ते");
});

test("text splats are deterministic, fill the budget, and give each character its own range", () => {
  const a = textSplats("Hi 日本 ✓", { count: 6000, seed: 3 });
  const b = textSplats("Hi 日本 ✓", { count: 6000, seed: 3, colorKey: "again" });
  expect(a.n).toBe(6000);
  expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
  expect(a.layout.glyphs.map((g) => g.g)).toEqual(["H", "i", "日", "本", "✓"]);
  let next = 0;
  a.ranges.forEach(([s, e], gi) => {
    expect(s).toBe(next);
    expect(e).toBeGreaterThan(s);
    for (let i = s; i < e; i++) expect(a.glyph[i]).toBe(gi);
    next = e;
  });
  expect(next).toBe(6000);
  expect(Array.from(a.pos).every(Number.isFinite)).toBe(true);
  // A slab: front and back faces and a rim.
  expect(new Set(a.face)).toEqual(new Set([0, 1, 2]));
  expect(textSplats("x", { count: 500, depth: 0 }).face.every((f) => f === 0)).toBe(true);
});

// ---- Your name in splats -------------------------------------------------------------

test("names take any script, symbols, and emoji, up to 48 characters", async () => {
  const { RECIPES, readName } = await import("../src/packs/name-toy.js");
  const input = RECIPES["name-toy"].input;
  for (const name of [
    "Ryan Kamp",
    "Zoë-Ánn O'Brien",
    "李小龍",
    "مرحبا",
    "Ryan 🎉 🇺🇸 👍🏽",
    "<script>",
    "#1 ★ ♥ ∞",
  ])
    expect((await input.read(name)).name).toBe(cleanText(name));
  expect(readName("A".repeat(48))).toHaveLength(48);
  // A link's name is cut to its first 48 characters, not dropped.
  const { nameLayout } = await import("../src/packs/name-toy.js");
  expect(nameLayout("B".repeat(60)).letters).toHaveLength(48);
  for (const bad of ["", "   ", "\n", "A".repeat(49)]) expect(() => readName(bad)).toThrow();
});

test("the name builds deterministic solid pieces, at most 48 tokens, at every detail", async () => {
  for (const [name, detail] of [
    ["RYAN KAMP", "12000"],
    ["Ryan 🎉", "24000"],
    ["ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijkl", "48000"],
  ]) {
    const { ctx } = await build("name-toy", "name-toy", { name, detail }, 200000);
    const { buf, kit } = ctx;
    expect(buf.count).toBe(Number(detail));
    expect(Array.from(buf.pos.subarray(0, buf.count * 3)).every(Number.isFinite)).toBe(true);
    const tokens = new Set();
    for (let i = 0; i < buf.count; i++) tokens.add(buf.anim[i * 4 + 2]);
    expect(tokens.size).toBe(kit.data.layout.tokens);
    expect(Math.max(...tokens)).toBeLessThan(48);
    expect(kit.data.layout.letters).toHaveLength(visibleCount(name));
  }
  const a = (await build("name-toy", "name-toy")).ctx.buf;
  const b = (await build("name-toy", "name-toy")).ctx.buf;
  expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
  expect(Array.from(a.color)).toEqual(Array.from(b.color));
});

function play(recipe, data, taps, frames, start = 1, dt = 1 / 30) {
  let t = start;
  let out;
  let travel = 0;
  let n = 0;
  const cues = [];
  for (let f = 0; f < frames; f++) {
    t += dt;
    const now = (taps[f] || []).map((point) => ({ n: ++n + 1000 * start, key: "play", point, time: t })); // prettier-ignore
    out = blank();
    recipe.drive(t, { play: 0 }, out, { time: t, taps: now, data });
    cues.push(...out.cues);
    for (const tk of out.tokens) {
      expect([...tk.offset, ...tk.quat].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...tk.quat)).toBeCloseTo(1, 9);
      travel = Math.max(travel, Math.hypot(...tk.offset));
    }
  }
  return { out, travel, cues, t };
}

test("a poke rings out letter by letter, plays the touched letter's bar, and settles exactly home", async () => {
  const { recipe, ctx } = await build("name-toy", "name-toy");
  const data = ctx.kit.data;
  const R = data.layout.letters[0].center;
  const { out, travel, cues } = play(recipe, data, { 2: [[R[0], R[1], 0.17]] }, 150);
  expect(travel).toBeGreaterThan(0.2);
  expect(cues[0]).toMatchObject({ voice: "bar", f: "C5" }); // Toy Box's scale starts at C5
  for (const tk of out.tokens) {
    expect(tk.offset).toEqual([0, 0, 0]);
    expect(tk.quat).toEqual([0, 0, 0, 1]);
  }
});

test("Drop breaks letters into pieces that fall, land with knocks, and come back together", async () => {
  const { RECIPES, setDrop } = await import("../src/packs/name-toy.js");
  const recipe = RECIPES["name-toy"];
  const { ctx } = await build("name-toy", "name-toy");
  const data = ctx.kit.data;
  const sim = data.sim;
  const layout = data.layout;
  expect(layout.tokens).toBe(32); // RYAN KAMP: 8 letters of 4 pieces
  setDrop(sim, true, 1);
  const fall = play(recipe, data, {}, 120);
  // Every piece lies on the floor, apart from its letter.
  for (const tk of fall.out.tokens) expect(tk.offset[1]).toBeLessThan(-0.05);
  const ys = fall.out.tokens.map((tk, i) => layout.pieceList[i].center[1] + tk.offset[1]);
  expect(Math.min(...ys)).toBeGreaterThan(layout.floor - 0.05);
  expect(fall.cues.filter((c) => c.voice === "wood").length).toBeGreaterThan(8);
  setDrop(sim, false, fall.t);
  const back = play(recipe, data, {}, 180, fall.t);
  expect(back.cues.some((c) => c.voice === "breath")).toBe(true);
  for (const tk of back.out.tokens) {
    expect(tk.offset).toEqual([0, 0, 0]);
    expect(tk.quat).toEqual([0, 0, 0, 1]);
  }
});

test("Toy Box's tool buttons: colors, keys 1 to 5, and a pop when one is picked", async () => {
  const { RECIPES } = await import("../src/packs/name-toy.js");
  const items = RECIPES["name-toy"].toolbar.items().slice(0, 5);
  expect(items.map((i) => [i.text, i.key])).toEqual([["Spin", "1"], ["Poke", "2"], ["Paint", "3"], ["Drop", "4"], ["Blow", "5"]]); // prettier-ignore
  expect(items.every((i) => /^#[0-9a-f]{6}$/.test(i.tint))).toBe(true);
});

test("old links and saved scenes of the name toy still open sensibly", async () => {
  // The options of Codex task 78d's version: name, verb, color, paints, detail.
  const old = { name: "ADA", verb: "paint", color: "violet", paints: ".4.", detail: "12000" };
  const { ctx, options } = await build("name-toy", "name-toy", old, 60000);
  expect(options).toMatchObject(old);
  expect(ctx.buf.count).toBe(12000);
  expect(ctx.kit.data.layout.name).toBe("ADA");
  // Letter 2 keeps its violet paint; the others their Toy Box colors.
  expect(ctx.kit.data.colors[1].map((v) => Math.round(v * 255))).toEqual([106, 44, 255]);
  expect(ctx.kit.data.colors[0].map((v) => Math.round(v * 255))).toEqual([255, 214, 10]);
  const { RECIPES } = await import("../src/packs/name-toy.js");
  expect(RECIPES["name-toy"].toolbar.items().find((i) => i.id === "paint").pressed).toBe(true);
  for (const verb of ["spin", "poke", "drop", "blow", "nonsense"])
    expect((await build("name-toy", "name-toy", { ...old, verb })).ctx.buf.count).toBe(12000);
  for (const version of [2, 3]) {
    const scene = { version, toy: { kind: "builtin", id: "name-toy", options: old }, seed: 5 };
    const back = normalizeScene(await decodeSceneHash(await encodeSceneHash(scene)));
    expect(back.toy).toMatchObject({ id: "name-toy", options: old });
  }
});

// ---- Shape morph ---------------------------------------------------------------------

test("Shape morph's list: old links open at their form, and taps and Play go to the next", async () => {
  const { RECIPES, formList, showForm } = await import("../src/packs/shape-morph.js");
  const recipe = RECIPES["shape-morph"];
  // A link from before the list: its form in the original six.
  expect(formList({ form: "klein", word: "HELLO", qrText: "Hi" })).toEqual({
    list: ["w:HELLO", "lorenz", "klein", "gyroid", "loop", "q:Hi"],
    at: 2,
  });
  const list = ["w:Ryan 🎉", "lorenz", "q:hello"];
  const o = resolveOptions(recipe, showForm(list, 0));
  expect(o).toMatchObject({ form: "word", word: "Ryan 🎉", at: "0" });
  expect(formList(o)).toEqual({ list, at: 0 });
  // The Toy tab's boxes edit the form showing.
  expect(formList({ ...o, word: "Hello" }).list[0]).toBe("w:Hello");
  expect(showForm(list, 3)).toMatchObject({ at: "0", form: "word" });
  expect(showForm(list, 2)).toMatchObject({ at: "2", form: "qr", qrText: "hello" });
  // Taps and Play: the next form, rebuilt.
  const tap = recipe.action.at([0.1, 0, 0]);
  expect(tap.key).toBe("morph");
  expect(tap.options.at).toBe("1");
  expect(recipe.action.play().options.at).toBe("1");
  expect(recipe.controls.find((c) => c.key === "morph").type).toBe("pulse");
});

test("Shape morph builds emoji words in their own colors and every list form deterministically", async () => {
  const { showForm } = await import("../src/packs/shape-morph.js");
  const list = ["w:Hi 👋🏽", "w:日本", "lorenz", "klein", "gyroid", "loop", "q:Splashery"];
  for (let i = 0; i < list.length; i++) {
    const a = await build("shape-morph", "shape-morph", showForm(list, i), 7200);
    const b = await build("shape-morph", "shape-morph", showForm(list, i), 7200);
    expect(a.ctx.buf.count).toBe(7200);
    expect(Array.from(a.ctx.buf.pos)).toEqual(Array.from(b.ctx.buf.pos));
    let far = 0;
    for (let j = 0; j < 7200; j++) if (Math.hypot(...a.ctx.buf.pos.subarray(j * 3, j * 3 + 3)) > 0.96) far++; // prettier-ignore
    expect(far, list[i]).toBe(0);
  }
});

test("Shape morph's editor adds, moves, and removes forms, and the word box adds any text", async () => {
  const { RECIPES, formList, MAX_FORMS } = await import("../src/packs/shape-morph.js");
  const recipe = RECIPES["shape-morph"];
  const ids = recipe.keyboard.items().map((i) => i.id);
  expect(ids.slice(0, 5)).toEqual(["add-lorenz", "add-klein", "add-gyroid", "add-loop", "add-qr"]);
  const added = recipe.keyboard.activate("add-gyroid");
  expect(JSON.parse(added.options.forms).at(-1)).toBe("gyroid");
  const up = recipe.keyboard.activate("up-1");
  expect(JSON.parse(up.options.forms).slice(0, 2)).toEqual(["lorenz", "w:SPLATS"]);
  expect(up.options.at).toBe("1"); // the word showing moved with it
  const del = recipe.keyboard.activate("del-0");
  expect(JSON.parse(del.options.forms)).toHaveLength(5);
  const word = await recipe.input.read("  Ryan 🇺🇸 Kamp ");
  expect(formList(word).list.at(-1)).toBe("w:Ryan 🇺🇸 Kamp");
  expect(word).toMatchObject({ form: "word", word: "Ryan 🇺🇸 Kamp", at: "6" });
  await expect(recipe.input.read("   ")).rejects.toThrow();
  await expect(recipe.input.read("x".repeat(25))).rejects.toThrow();
  expect(MAX_FORMS).toBe(16);
});

// ---- In the browser ------------------------------------------------------------------

async function open(page, id, width, height) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width, height });
  await page.goto(`${APP}&profile=${width < 700 ? "low" : "high"}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  }, id);
  return errors;
}

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`the name toy's five tools work on the stage, and paint stays in the link, at ${width}×${height}`, async ({
    page,
  }) => {
    const errors = await open(page, "name-toy", width, height);
    const row = page.locator("#toy-toolbar");
    await expect(row.locator("button:visible")).toHaveText(["Spin", "Poke", "Paint", "Drop", "Blow"]); // prettier-ignore
    // Toy Box's census: the splats in each letter.
    expect(
      await page.evaluate(() => window.__splashery.player.toyInfo.recipe.input.shown()),
    ).toMatch(/splats in 8 solid letters\. R [\d,]+ · Y [\d,]+ ·/);
    // Fredoka (the owner's OK of October 16, 2026) is loaded before the letters are drawn.
    const fredoka = () =>
      [...document.fonts].some((f) => /Splashery Fredoka/.test(f.family) && f.status === "loaded");
    expect(await page.evaluate(fredoka)).toBe(true);
    await page.screenshot({ path: `tests/screenshots/pt1-name-toy-${width}x${height}.png` });
    // An emoji name: color glyphs keep their colors.
    await page.evaluate(() => window.__splashery.app.setToyOptions({ name: "Ryan 🎉" }));
    const color = await page.evaluate(async () => {
      const { glyphRaster } = await import("/src/text-splats.js");
      return [!!glyphRaster("🎉").rgb, !!glyphRaster("R").rgb];
    });
    expect(color).toEqual([true, false]);
    await page.evaluate(() => window.__splashery.app.setToyOptions({ name: "RYAN KAMP" }));
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.options?.name === "RYAN KAMP"); // prettier-ignore
    // Paint: the swatches and Wash it off show only for Paint.
    await row.locator('[data-toy-tool="paint"]').click();
    await expect(row.locator("button:visible")).toHaveCount(14);
    await row.locator('[data-toy-tool="paint-violet"]').click();
    const painted = await page.evaluate(async () => {
      const p = window.__splashery.player;
      const pts = [[-1.2, 0.6, 0.17], [-0.6, 0.5, 0.17], [0, 0.6, 0.17], [0.6, 0.5, 0.17]]; // prettier-ignore
      p.grabStart(p.fromRecipe(pts[0]), ...p.screenPoint(pts[0]));
      for (const q of pts.slice(1)) {
        await new Promise((r) => setTimeout(r, 60));
        p.grabAt(...p.screenPoint(q));
      }
      p.grabEnd();
      return p.scene.paint.stamps.map((s) => s[4]);
    });
    expect(painted.length).toBeGreaterThanOrEqual(3);
    expect(new Set(painted)).toEqual(new Set(["#6a2cff"]));
    await page.evaluate(() => window.__splashery.app.copyLink());
    const url = page.url();
    expect(url).toContain("#s=");
    // Poke: a drag rings the letters it crosses.
    await row.locator('[data-toy-tool="poke"]').click();
    await expect(row.locator("button:visible")).toHaveCount(5);
    const moved = await page.evaluate(async () => {
      const p = window.__splashery.player;
      const data = p.motion.ctx.kit.data;
      const pts = [
        [-1.1, -0.5, 0.17],
        [0, -0.55, 0.17],
        [1.1, -0.5, 0.17],
      ];
      p.grabStart(p.fromRecipe(pts[0]), ...p.screenPoint(pts[0]));
      for (const q of pts.slice(1)) {
        // Wait for the toy's clock (a slow renderer draws few frames).
        const t0 = p.time;
        while (p.time - t0 < 0.15) await new Promise((r) => setTimeout(r, 30));
        p.grabAt(...p.screenPoint(q));
      }
      p.grabEnd();
      await new Promise((r) => setTimeout(r, 200));
      return data.sim.letters.filter((b) => Math.hypot(...b.v) + Math.hypot(...b.d) > 0.01).length;
    });
    expect(moved).toBeGreaterThanOrEqual(3);
    // Drop and Blow.
    await row.locator('[data-toy-tool="drop"]').click();
    await expect(row.locator('[data-toy-tool="drop"]')).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.sim.pieces.every((s) => s.free))).toBe(true); // prettier-ignore
    await row.locator('[data-toy-tool="drop"]').click();
    await expect(row.locator('[data-toy-tool="drop"]')).toHaveAttribute("aria-pressed", "false");
    await row.locator('[data-toy-tool="blow"]').click();
    await expect(row.locator('[data-toy-tool="blow"]')).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // Wash it off, then the link brings the paint back.
    await row.locator('[data-toy-tool="paint"]').click();
    await row.locator('[data-toy-tool="wash"]').click();
    expect(await page.evaluate(() => window.__splashery.player.scene.paint.stamps.length)).toBe(0);
    await page.goto("about:blank");
    await page.goto(url);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#toy-status")).toHaveText(/^Your name in splats/);
    expect(await page.evaluate(() => window.__splashery.player.scene.paint.stamps.length)).toBe(
      painted.length,
    );
    expect(errors).toEqual([]);
  });

  test(`Shape morph's chips, taps, and word box at ${width}×${height}`, async ({ page }) => {
    const errors = await open(page, "shape-morph", width, height);
    const row = page.locator("#toy-toolbar");
    await expect(row.locator("button")).toHaveText(["Scatter", "SPLATS", "Lorenz", "Klein bottle", "Gyroid", "Loop", "QR code"]); // prettier-ignore
    await expect(row.locator('[data-toy-tool="go-0"]')).toHaveAttribute("aria-pressed", "true");
    // A tap on the cloud: the next form, flying out from the tap.
    await page.evaluate(() => {
      const p = window.__splashery.player;
      p.act(p.fromRecipe([-0.4, 0, 0]));
    });
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.options?.form === "lorenz");
    const wave = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.origin);
    [-0.4, 0, 0].forEach((v, a) => expect(wave[a]).toBeCloseTo(v, 3));
    await expect(row.locator('[data-toy-tool="go-1"]')).toHaveAttribute("aria-pressed", "true");
    // Play: the next again.
    await page.evaluate(() => window.__splashery.player.act());
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.options?.form === "klein");
    // A chip goes straight to its form.
    await row.locator('[data-toy-tool="go-4"]').click();
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.options?.form === "loop");
    // The word box adds a form with emoji, and the cloud morphs to it.
    await page.evaluate(() => window.__splashery.app.ui.setSheetStop("panel"));
    await page.locator("#tab-play").click();
    await page.locator("#toy-input-text").fill("Hi 👋🏽");
    await page.locator("#toy-input-go").click();
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.options?.word === "Hi 👋🏽");
    await expect(row.locator("button")).toHaveCount(8);
    // The editor: remove the new form; the panel stays open.
    await page.locator("#toy-keyboard summary").click();
    await page.locator('#toy-keyboard-controls button[aria-label^="Remove 7"]').click();
    await expect(row.locator("button")).toHaveCount(7);
    await expect(page.locator("#toy-keyboard")).toHaveJSProperty("open", true);
    await page.evaluate(() => window.__splashery.app.ui.collapseSheet());
    await page.screenshot({ path: `tests/screenshots/pt1-shape-morph-${width}x${height}.png` });
    expect(errors).toEqual([]);
  });
}

test("text that draws nothing never breaks either toy", async ({ page }) => {
  const errors = await open(page, "name-toy", 390, 844);
  const hangul = "\u3164";
  const out = await page.evaluate(async (bad) => {
    const { app, player } = window.__splashery;
    const recipe = player.toyInfo.recipe;
    let rejected = false;
    try {
      await recipe.input.read(bad);
    } catch {
      rejected = true;
    }
    // A link with such a name opens a question mark, and its tools still work.
    await app.setToyOptions({ name: bad });
    const data = player.motion.ctx.kit.data;
    player.act();
    player.act(player.fromRecipe(data.layout.letters[0].center));
    await new Promise((r) => setTimeout(r, 300));
    const letters = data.layout.letters.map((l) => l.char);
    // Shape morph: such a word shows SPLATS, not a point.
    await app.chooseToy("shape-morph");
    let morphRejected = false;
    try {
      await player.toyInfo.recipe.input.read(bad);
    } catch {
      morphRejected = true;
    }
    await app.setToyOptions({ form: "word", word: bad });
    const pos = player.motion.ctx.kit.data.form.pos;
    let spread = 0;
    for (let i = 0; i < pos.length; i += 3) spread = Math.max(spread, Math.abs(pos[i]));
    return { rejected, letters, morphRejected, spread };
  }, hangul);
  expect(out).toEqual({ rejected: true, letters: ["?"], morphRejected: true, spread: expect.any(Number) }); // prettier-ignore
  expect(out.spread).toBeGreaterThan(0.3);
  expect(errors).toEqual([]);
});

test("the name flies in when it opens, and stays silent while it turns", async ({ page }) => {
  const errors = await open(page, "name-toy", 390, 844);
  const out = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.setToyOptions({ name: "FLY IN" });
    const data = player.motion.ctx.kit.data;
    const away = Math.max(...data.sim.letters.map((b) => Math.hypot(...b.d)));
    await new Promise((r) => setTimeout(r, 2500));
    // Turn the view a whole radian. Lane PT3: no tick (they read as clicks
    // under every orbit; tests/pt3.spec.mjs drags a real orbit).
    const cues = [];
    const off = player.on("cue", (c) => cues.push(...c));
    player.camera.begin();
    for (let k = 0; k < 8; k++) {
      player.camera.rotateBy(30, 0, 0.02);
      player.stage.requestRender();
      await new Promise((r) => setTimeout(r, 120));
    }
    player.camera.end();
    off?.();
    return { away, cues: cues.length };
  });
  expect(out.away).toBeGreaterThan(0.3);
  expect(out.cues).toBe(0);
  expect(errors).toEqual([]);
});
