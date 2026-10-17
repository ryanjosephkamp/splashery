// Lane PT3: Shape morph and Your name in splats, to the bar. Every Shape
// morph form wears the toy's own ink, the QR form still scans, a morph pairs
// neighbors with neighbors, the lone pad is banned for new toys, the name
// toy is silent while the view orbits, and both toys' counts follow the
// Splats slider.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { textSplats } from "../src/text-splats.js";

const APP = "/?labs=1&renderer=webgl2&adapt=off";

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

// ---- Banned sounds -------------------------------------------------------------------

// The lone pad (docs/PACKS.md, "Banned sounds"): the pad voice on one pitch,
// with no notes. Toys that had it on October 17, 2026 may keep it; none do.
const LONE_PAD_KEPT = [];
const lonePad = (layer) => layer?.voice === "pad" && !layer.notes;
function layers(spec) {
  if (!spec || typeof spec !== "object") return [];
  if (Array.isArray(spec)) return spec.flatMap(layers);
  if (spec.voice) return [spec, ...layers(spec.fallback)];
  return Object.values(spec).flatMap(layers); // a toggle's on and off
}

test("the lone pad is banned: no toy's sound and no pack's cue uses it", () => {
  const using = Object.entries(TOY_SOUNDS)
    .filter(([, spec]) => layers(spec).some(lonePad))
    .map(([id]) => id);
  expect(using.filter((id) => !LONE_PAD_KEPT.includes(id))).toEqual([]);
  expect(TOY_SOUNDS["shape-morph"]).toBeTruthy();
  expect(layers(TOY_SOUNDS["shape-morph"]).some((l) => l.voice === "pad")).toBe(false);
  // Cues a recipe writes itself: every object literal naming the pad voice
  // in a pack's source carries notes.
  const dir = path.resolve("src/packs");
  const bad = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    for (const m of text.matchAll(/\{[^{}]*voice:\s*["']pad["'][^{}]*\}/g))
      if (!/\bnotes\s*:/.test(m[0])) bad.push(`${file}: ${m[0].slice(0, 60)}`);
  }
  expect(bad).toEqual([]);
  // The check itself catches the old sound.
  expect(layers({ voice: "pad", f: "E4", to: 0.94, decay: 0.95, vol: 0.9 }).some(lonePad)).toBe(
    true,
  );
  expect(layers({ on: { voice: "pad", notes: "F4+C5" }, off: [{ voice: "pad" }] }).filter(lonePad)).toHaveLength(1); // prettier-ignore
});

// ---- Shape morph: the palette --------------------------------------------------------

// A color that is a shade of the ink c: darker (c times 0.16..1) or paler
// (c toward white, up to 0.8 of the way).
function shadeOf(color, c, tol = 0.012) {
  const dark = color[0] / c[0];
  if (dark <= 1.0001 && color.every((x, a) => Math.abs(x - c[a] * dark) < tol)) return true;
  const k = (color[0] - c[0]) / (1 - c[0]);
  return k >= -1e-4 && k <= 0.8001 && color.every((x, a) => Math.abs(x - (c[a] + (1 - c[a]) * k)) < tol); // prettier-ignore
}
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test("every Shape morph form is in the toy's ink: emoji give only shape and light, and the QR code is deep on pale", async () => {
  const { RECIPES, makeForm, colorAt, inkAt } = await import("../src/packs/shape-morph.js");
  const recipe = RECIPES["shape-morph"];
  const n = 6000;
  const inks = [
    [0.035, 0.4, 0.43],
    [0.98, 0.31, 0.15],
  ];
  const forms = [
    ["word", { word: "SPLATS" }],
    ["word", { word: "Hi 👋🏽🌈" }],
    ["lorenz", {}],
    ["klein", {}],
    ["gyroid", {}],
    ["loop", {}],
    ["qr", { qrText: "Splashery" }],
  ];
  for (const [id, given] of forms) {
    const o = resolveOptions(recipe, { form: id, ...given });
    await recipe.prepare(o);
    const form = makeForm(id, n, o);
    for (const twoInk of [false, true]) {
      const off = [];
      for (let i = 0; i < n; i++) {
        const c = colorAt(form, i, twoInk);
        const u = Math.min(1, Math.max(0, form.pos[i * 3] / 1.64 + 0.5));
        const ok = twoInk ? inks.some((k) => shadeOf(c, k)) : shadeOf(c, inkAt(u));
        if (!ok) off.push(c.map((x) => x.toFixed(3)).join(","));
      }
      expect(off.slice(0, 3), `${id} ${given.word ?? ""} twoInk=${twoInk}`).toEqual([]);
    }
    if (id === "qr") {
      // Deep modules on a pale ground, all the way across: enough contrast to scan.
      let worst = Infinity;
      for (let i = 0; i < n; i++) {
        if (!form.ink[i]) continue;
        const dark = luminance(colorAt(form, i, false));
        const light = luminance(colorAt({ ...form, ink: new Uint8Array(n) }, i, false));
        worst = Math.min(worst, (light + 0.05) / (dark + 0.05));
      }
      expect(worst).toBeGreaterThan(4.5);
    }
  }
  // (An emoji's own light and dark needs a color font: the browser test below.)
});

test("a morph pairs neighbors with neighbors, so the cloud flows as one sheet", async () => {
  const { makeForm, pairForm } = await import("../src/packs/shape-morph.js");
  const n = 8000;
  const from = makeForm("klein", n, {}).pos;
  const spread = (form) => {
    // How far apart two splats that start side by side land, against two at random.
    let near = 0;
    let any = 0;
    for (let s = 0; s < 400; s++) {
      const i = (s * 7919) % n;
      let best = -1;
      let bd = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const d = Math.hypot(from[i * 3] - from[j * 3], from[i * 3 + 1] - from[j * 3 + 1], from[i * 3 + 2] - from[j * 3 + 2]); // prettier-ignore
        if (d < bd) ((bd = d), (best = j));
      }
      const k = (i * 31 + 17) % n;
      const p = form.pos;
      near += Math.hypot(p[i * 3] - p[best * 3], p[i * 3 + 1] - p[best * 3 + 1], p[i * 3 + 2] - p[best * 3 + 2]); // prettier-ignore
      any += Math.hypot(p[i * 3] - p[k * 3], p[i * 3 + 1] - p[k * 3 + 1], p[i * 3 + 2] - p[k * 3 + 2]); // prettier-ignore
    }
    return near / any;
  };
  const before = spread(makeForm("word", n, { word: "SPLATS" }));
  const after = spread(pairForm(makeForm("word", n, { word: "SPLATS" }), from, n));
  expect(before).toBeGreaterThan(0.6);
  expect(after).toBeLessThan(0.2);
  // The pairing only reorders: the same places, each used once.
  const a = makeForm("word", n, { word: "SPLATS" });
  const b = pairForm(makeForm("word", n, { word: "SPLATS" }), from, n);
  const key = (p) =>
    Array.from({ length: n }, (_, i) => `${p[i * 3]},${p[i * 3 + 1]}`)
      .sort()
      .join(";");
  expect(key(b.pos)).toBe(key(a.pos));
});

test("Shape morph's tap sound is soft and musical: tines a fifth apart over a faint breath", () => {
  const spec = TOY_SOUNDS["shape-morph"];
  expect(spec.map((l) => l.voice)).toEqual(["tine", "breath", "tine"]);
  expect(spec.every((l) => !(l.to > 1))).toBe(true);
});

// ---- Your name in splats ----------------------------------------------------------------

test("the name's count: the Splats slider's when set (up to 400,000), else a link's Detail, else the device's", async () => {
  const { nameBudget, RECIPES } = await import("../src/packs/name-toy.js");
  expect(nameBudget(250000, "auto", true)).toBe(250000);
  expect(nameBudget(900000, "48000", true)).toBe(400000);
  expect(nameBudget(140000, "auto", false)).toBe(48000);
  expect(nameBudget(60000, "12000", false)).toBe(12000);
  expect(nameBudget(300000, "192000", false)).toBe(192000);
  // Detail is folded into Splats: hidden, but an older link's value still opens.
  const detail = RECIPES["name-toy"].options.find((o) => o.key === "detail");
  expect(detail.hidden).toBe(true);
  expect(detail.choices.map((c) => c.id)).toEqual(["auto", "12000", "24000", "48000", "96000", "192000"]); // prettier-ignore
  const { ctx } = await build("name-toy", "name-toy", { name: "ADA", detail: "24000" }, 140000);
  expect(ctx.buf.count).toBe(24000);
});

test("the name toy's sounds are Toy Box's: a sine bar per letter, and no rising glides", async () => {
  const { SOUNDS, RECIPES } = await import("../src/packs/name-toy.js");
  const [body, ring] = TOY_SOUNDS["name-toy"];
  expect([body.voice, ring.voice]).toEqual(["tone", "tone"]);
  expect(body.kind ?? "sine").toBe("sine");
  // A poke's cue: the letter's note, and the ring two octaves up.
  const { ctx } = await build("name-toy", "name-toy", { name: "AB" }, 12000);
  const sim = ctx.kit.data.sim;
  const out = { parts: {}, tokens: null, cues: [] };
  RECIPES["name-toy"].drive(1, { play: 0 }, out, { time: 1, taps: [{ n: 1, key: "play", point: [0.3, 0, 0.17] }], data: ctx.kit.data }); // prettier-ignore
  const bar = out.cues.find(Array.isArray);
  expect(bar).toBeTruthy();
  expect(bar[1].f / bar[0].f).toBeCloseTo(4, 6);
  expect(sim.cues).toEqual([]);
  const all = [SOUNDS.pop, SOUNDS.squelch(0.5), SOUNDS.tick(0.5, 0.3), ...SOUNDS.zip, SOUNDS.wind(0.2)].flat(); // prettier-ignore
  expect(all.every((l) => !(l.to > 1) || l.voice === "pop")).toBe(true);
});

test("letters are crisp: face splats shrink toward the outline", () => {
  const s = textSplats("O", { count: 20000, depth: 0.17 });
  const soft = textSplats("O", { count: 20000, depth: 0.17, crisp: false });
  const sizes = (t) => {
    const out = [];
    for (let i = 0; i < t.n; i++) if (t.face[i] === 0) out.push(t.sigma[i]);
    return out.sort((a, b) => a - b);
  };
  const a = sizes(s);
  const b = sizes(soft);
  // The crisp face has small splats at its edge and full ones inside; the
  // old one used one size (give or take 15%).
  expect(a[0] / a.at(-1)).toBeLessThan(0.5);
  expect(b[0] / b.at(-1)).toBeGreaterThan(0.7);
  expect(s.n).toBe(20000);
});

// ---- In the browser -------------------------------------------------------------------

async function open(page, id, width = 390, height = 844) {
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
    // Count every sound the app is asked to play.
    window.__played = [];
    const play = app.sound.play.bind(app.sound);
    app.sound.play = (spec, o) => {
      window.__played.push({ spec, at: performance.now() });
      return play(spec, o);
    };
  }, id);
  return errors;
}

test("no sound while the view orbits the name, and a tap still rings", async ({ page }) => {
  const errors = await open(page, "name-toy");
  // Let the opening fly-in settle.
  await page.waitForTimeout(3000);
  await page.evaluate(() => (window.__played.length = 0));
  const box = await page.locator("#stage canvas, canvas").first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // A long, wide orbit drag: two full sweeps across the stage.
  await page.mouse.move(cx - 120, cy);
  await page.mouse.down();
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    await page.mouse.move(cx - 120 + 240 * Math.sin(t * Math.PI * 2), cy + 40 * Math.sin(t * 7));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
  const during = await page.evaluate(() => window.__played.length);
  const view = await page.evaluate(() => window.__splashery.player.camera.getState());
  expect(during).toBe(0);
  expect(view).toBeTruthy();
  // A tap on a letter still plays its bar.
  await page.evaluate(() => {
    const p = window.__splashery.player;
    p.act(p.fromRecipe([0, 0.3, 0.17]));
  });
  await page.waitForFunction(() => window.__played.length > 0, null, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test("the name's count follows the Splats slider, and Auto goes back to the device's", async ({
  page,
}) => {
  const errors = await open(page, "name-toy", 1440, 900);
  const count = () => page.evaluate(() => window.__splashery.player.motion.ctx.buf.count);
  expect(await count()).toBe(96000);
  await page.evaluate(() => window.__splashery.app.setSplats(250000));
  await page.waitForFunction(() => window.__splashery.player.motion.ctx.buf.count === 250000, null, { timeout: 120_000 }); // prettier-ignore
  const shown = await page.evaluate(() => window.__splashery.player.toyInfo.recipe.input.shown());
  expect(shown).toContain("250,000 splats");
  await page.evaluate(() => window.__splashery.app.setSplats(null));
  await page.waitForFunction(() => window.__splashery.player.motion.ctx.buf.count === 96000, null, { timeout: 120_000 }); // prettier-ignore
  expect(errors).toEqual([]);
});

test("Shape morph's QR form scans in the toy's colors, and its count follows the slider", async ({
  page,
}) => {
  const errors = await open(page, "shape-morph", 1440, 900);
  await page.evaluate(() => window.__splashery.app.setToyOptions({ form: "qr", qrText: "Splashery" })); // prettier-ignore
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.options?.form === "qr");
  await page.waitForTimeout(5000); // the flight ends
  // Frame the code itself, as a scanner does (as tests/cdx-pfc.spec.mjs).
  const bounds = await page.evaluate(() => {
    const { player } = window.__splashery;
    const a = player.screenPoint([-0.6, 0.6, 0]);
    const b = player.screenPoint([0.6, -0.6, 0]);
    const box = player.canvas.getBoundingClientRect();
    return { x: box.x + a[0], y: box.y + a[1], width: b[0] - a[0], height: b[1] - a[1] };
  });
  const p = PNG.sync.read(await page.screenshot({ clip: bounds }));
  expect(jsQR(new Uint8ClampedArray(p.data), p.width, p.height)?.data).toBe("Splashery");
  // In the ink, not black and white: the ground's left is a pale teal, its right a pale pink.
  const at = (x, y) => {
    const i = (Math.floor(y * p.height) * p.width + Math.floor(x * p.width)) * 4;
    return [p.data[i], p.data[i + 1], p.data[i + 2]];
  };
  const left = at(0.04, 0.5);
  const right = at(0.96, 0.5);
  expect(left[2] - left[0]).toBeGreaterThan(12);
  expect(right[0] - right[1]).toBeGreaterThan(12);
  // An emoji (a color glyph here) gives only its shape and its light and
  // dark: every splat a shade of the ink at its place, over a wide range.
  const emoji = await page.evaluate(async () => {
    const { makeForm, colorAt, inkAt, shade } = await import("/src/packs/shape-morph.js");
    const n = 6000;
    const form = makeForm("word", n, { word: "🌈" });
    const tones = Array.from(form.tone || []).filter((t) => t >= 0);
    let off = 0;
    for (let i = 0; i < n; i++) {
      const u = Math.min(1, Math.max(0, form.pos[i * 3] / 1.64 + 0.5));
      const want = shade(inkAt(u), 0.08 + 0.9 * form.tone[i]);
      if (colorAt(form, i, false).some((x, a) => Math.abs(x - want[a]) > 1e-6)) off++;
    }
    return { count: tones.length, range: Math.max(...tones) - Math.min(...tones), off };
  });
  expect(emoji.count).toBe(6000);
  expect(emoji.range).toBeGreaterThan(0.4);
  expect(emoji.off).toBe(0);
  // Half the slider's count (the recipe's density), up to 200,000.
  await page.evaluate(() => window.__splashery.app.setSplats(300000));
  await page.waitForFunction(() => window.__splashery.player.motion.ctx.buf.count === 150000, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.app.setSplats(null));
  expect(errors).toEqual([]);
});
