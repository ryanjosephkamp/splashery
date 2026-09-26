// Unit checks for the v3 engine pieces that need no browser: the toy kit and
// every pack recipe, the scene schema v3 (and its v2 migration), patterns,
// the flag catalogue and the motion driver.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { normalizeScene, createScene, normalizeHex, SCENE_VERSION } from "../src/state.js";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { buildRecipe, Kit } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { KINDS } from "../src/effects.js";
import { MotionDriver } from "../src/motion.js";
import {
  normalizePattern,
  surfaceAspect,
  patternUniforms,
  PATTERN_IDS,
  PROJECTION_IDS,
} from "../src/patterns.js";
import { resolveOptions } from "../src/player.js";

const KIT = TOYS.filter((t) => t.kind === "kit");

test("scene version 3 adds pattern and motion; version 2 scenes and links still load", async () => {
  expect(SCENE_VERSION).toBe(3);
  const v2 = {
    app: "splashery",
    version: 2,
    seed: 5,
    toy: { kind: "builtin", id: "cactus" },
    effects: { wind: { on: true, strength: 0.4 } },
    camera: { yaw: 1, pitch: 0.2, distance: 4 },
  };
  const s = normalizeScene(v2);
  expect(s.version).toBe(3);
  expect(s.toy).toEqual({ kind: "builtin", id: "cactus" });
  expect(s.effects.wind).toMatchObject({ on: true, strength: 0.4 });
  expect(s.pattern.id).toBe("none");
  expect(s.motion).toEqual({ alive: true, move: "still", speed: 0.5, controls: {} });
  // An old share link (a v2 scene) decodes and normalises the same way.
  const hash = await encodeSceneHash(v2);
  expect(normalizeScene(await decodeSceneHash(hash))).toEqual({
    ...s,
    createdAt: expect.any(String),
  });
  // A default v3 scene normalises to itself.
  const d = normalizeScene(createScene({ seed: 9 }));
  expect(normalizeScene(JSON.parse(JSON.stringify(d)))).toEqual(d);
});

test("v3 fields are validated: options, clay on shelf toys, pattern and motion", () => {
  const s = normalizeScene({
    version: 3,
    toy: {
      kind: "builtin",
      id: "heart",
      options: { color: "#FF0000", style: "love", bad: { x: 1 }, "no way": 1, n: 1e9 },
      clay: [["e", 0, 0, 0, 0.1], ["x"]],
    },
    pattern: { id: "flag", flag: "fr", projection: "sideways", repeats: 9, amount: 7 },
    motion: { alive: false, move: "moonwalk", speed: 3, controls: { open: 2, "x y": 1 } },
  });
  expect(s.toy).toEqual({
    kind: "builtin",
    id: "heart",
    options: { color: "#ff0000", style: "love", n: 1e6 },
    clay: [["e", 0, 0, 0, 0.1]],
  });
  expect(s.pattern).toMatchObject({
    id: "flag",
    flag: "fr",
    projection: "wrap",
    repeats: 4,
    amount: 1,
  });
  expect(s.motion).toEqual({ alive: false, move: "still", speed: 1, controls: { open: 1 } });
  expect(
    normalizeScene({ version: 3, pattern: { id: "nope", flag: "<script>" } }).pattern,
  ).toMatchObject({
    id: "none",
    flag: "",
  });
});

test("every kit toy has a recipe that builds deterministically and fits the unit ball", async () => {
  expect(KIT.length).toBeGreaterThan(0);
  const kinds = new Set(Object.values(KINDS));
  for (const def of KIT) {
    expect(
      CATEGORIES.some((c) => c.id === def.category),
      def.id,
    ).toBe(true);
    const mod = await import(`../src/packs/${def.pack}.js`);
    const recipe = mod.RECIPES[def.id];
    expect(recipe, `${def.id} in packs/${def.pack}.js`).toBeTruthy();
    const variants = [{}];
    for (const o of recipe.options || [])
      if (o.type === "select") for (const c of o.choices) variants.push({ [o.key]: c.id });
    for (const given of variants) {
      const options = resolveOptions(recipe, given);
      await recipe.prepare?.(options);
      const build = () => {
        const it = buildRecipe(recipe, { seed: 3, count: 8000, options }, applyClay);
        let r = it.next();
        while (!r.done) r = it.next();
        return r.value;
      };
      const a = build();
      const b = build();
      const buf = a.buf;
      let same = a.buf.count === b.buf.count;
      let bad = 0;
      let far = 0;
      // Shapes added with `fit: false` are left out of the fit on purpose (the Möbius riders'
      // hidden copies sit off to one side for draw order), so they may lie outside the ball.
      const unfit = new Uint8Array(buf.count);
      for (const item of a.kit.items)
        if (item.opts.fit === false) unfit.fill(1, item.start, item.end);
      for (let i = 0; i < buf.count; i++) {
        for (let k = 0; k < 3; k++) {
          const v = buf.pos[i * 3 + k];
          if (v !== b.buf.pos[i * 3 + k]) same = false;
          if (!Number.isFinite(v)) bad++;
        }
        const r = Math.hypot(buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]);
        if (r > 1.001 && !unfit[i]) far++;
        for (let k = 0; k < 4; k++)
          if (!(buf.color[i * 4 + k] >= 0 && buf.color[i * 4 + k] <= 1)) bad++;
        if (!kinds.has(buf.anim[i * 4 + 1])) bad++;
        if ((buf.anim[i * 4] & 15) >= a.parts.length) bad++;
      }
      expect({ id: def.id, given, same, bad, far, enough: buf.count > 4000 }).toEqual({
        id: def.id,
        given,
        same: true,
        bad: 0,
        far: 0,
        enough: true,
      });
      expect(a.parts.length).toBeLessThanOrEqual(16);
    }
    // Controls and the action refer to real controls.
    const keys = new Set((recipe.controls || []).map((c) => c.key));
    if (recipe.action?.key) expect(keys.has(recipe.action.key), def.id).toBe(true);
    // Every kit toy has a shelf thumbnail.
    expect(fs.existsSync(path.resolve(`assets/toys/${def.id}/thumb.webp`)), def.id).toBe(true);
  }
});

test("the kit shares the budget by area and moves part pivots with the fit", () => {
  const k = new Kit(1, { count: 20000 });
  const big = k.add(k.sphere(1));
  const small = k.add(k.sphere(0.5), { pos: [2, 0, 0] });
  const lid = k.part("lid", { pivot: [2, 0.5, 0], axis: [1, 0, 0] });
  const it = k.emit();
  while (!it.next().done);
  expect(big.n / small.n).toBeGreaterThan(3.5);
  expect(big.n / small.n).toBeLessThan(4.5);
  // Everything fits radius 0.95 around the centre; the pivot moved with it.
  const pv = k.parts[lid].pivot;
  const t = k.transform;
  expect(pv[0]).toBeCloseTo((2 - t.center[0]) * t.scale, 6);
  expect(pv[1]).toBeCloseTo((0.5 - t.center[1]) * t.scale, 6);
});

test("the flag catalogue is public domain, complete and safe to draw", () => {
  const dir = path.resolve("assets/flags");
  const json = JSON.parse(fs.readFileSync(path.join(dir, "flags.json"), "utf8"));
  expect(json.flags.length).toBeGreaterThanOrEqual(190);
  const codes = new Set();
  for (const f of json.flags) {
    expect(f.code).toMatch(/^[a-z]{2}$/);
    expect(codes.has(f.code)).toBe(false);
    codes.add(f.code);
    expect(["Public domain", "CC0"]).toContain(f.license);
    expect(f.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    const svg = fs.readFileSync(path.join(dir, f.file), "utf8");
    expect(svg).toMatch(/<svg[\s>]/);
    expect(svg).not.toMatch(/<script|javascript:|xlink:href="https?:|href="https?:/i);
  }
  for (const c of ["us", "gb", "fr", "jp", "br", "in", "ng", "cn", "de", "mx"])
    expect(codes.has(c)).toBe(true);
});

test("patterns normalise and are drawn at the aspect of the surface they wrap", () => {
  const p = normalizePattern({ id: "stripes", colors: ["#FFF", "bad"], scale: 2 }, normalizeHex);
  expect(p).toMatchObject({ id: "stripes", colors: ["#ffffff", "#e63b2e", "#0b4f9c"], scale: 1 });
  expect(PATTERN_IDS).toContain("flag");
  const half = [0.8, 0.8, 0.8];
  expect(surfaceAspect({ projection: "wrap", repeats: 1 }, half)).toBeCloseTo(Math.PI, 5);
  expect(surfaceAspect({ projection: "wrap", repeats: 2 }, half)).toBeCloseTo(Math.PI / 2, 5);
  expect(surfaceAspect({ projection: "front", repeats: 1 }, half)).toBeCloseTo(1, 5);
  // Top: laid over a flat toy from above (the chess board), at its width / depth.
  const board = [1, 0.1, 0.5];
  expect(surfaceAspect({ projection: "top", repeats: 3 }, board)).toBeCloseTo(2, 5);
  const u = patternUniforms({ ...p, projection: "top", repeats: 3 }, board, 0.5, true);
  expect(u.uSpPat[1]).toBe(PROJECTION_IDS.indexOf("top"));
  expect(u.uSpPat[2]).toBe(1);
  expect(u.uSpPatB[1]).toBeCloseTo(0.5, 5);
  expect(u.uSpPatB[3]).toBeCloseTo(1, 5);
});

test("flag colours tint the chess board gently and leave the pieces their own colours", async () => {
  const { RECIPES } = await import("../src/packs/games.js");
  const chess = RECIPES["chess-set"];
  // The board takes the flag from above, at 30%, keeping its light and dark squares.
  expect(chess.patternProjection).toBe("top");
  expect(chess.patternAmount).toBeCloseTo(0.3, 5);
  expect(chess.patternDetail).toBe(1);
  const ctx = (() => {
    const it = buildRecipe(
      chess,
      { seed: 1, count: 60000, options: resolveOptions(chess, {}) },
      applyClay,
    );
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  })();
  const { anim, count } = ctx.buf;
  let pieces = 0;
  let piecesPatterned = 0;
  let boardPatterned = 0;
  for (let i = 0; i < count; i++) {
    const noPattern = anim[i * 4] >= 16;
    if (anim[i * 4 + 1] === KINDS.token) {
      pieces++;
      if (!noPattern) piecesPatterned++;
    } else if (!noPattern) boardPatterned++;
  }
  expect(pieces).toBeGreaterThan(10000);
  expect(piecesPatterned).toBe(0);
  expect(boardPatterned).toBeGreaterThan(10000);
});

test("the pixel font has digits, and every flag knows its shape", async () => {
  const { inked, FONT } = await import("../src/font.js");
  for (const d of "0123456789") expect(FONT[d], d).toBeTruthy();
  // The middle of the 1's stem is inked, its left edge is not.
  expect(inked(["1"], 2.5, 3.5)).toBe(true);
  expect(inked(["1"], 0.5, 3.5)).toBe(false);
  const fs = await import("node:fs");
  const flags = JSON.parse(fs.readFileSync("assets/flags/flags.json", "utf8")).flags;
  for (const f of flags) expect(f.aspect, f.code).toBeGreaterThan(0.5);
  expect(flags.find((f) => f.code === "ch").aspect).toBeCloseTo(1, 2);
  expect(flags.find((f) => f.code === "us").aspect).toBeCloseTo(1.9, 2);
  const { svgAspect } = await import("../tools/flag-aspects.mjs");
  expect(svgAspect('<svg width="1e3" height="500">')).toBeCloseTo(2, 5);
  expect(svgAspect('<svg viewBox="0 0 75 18" width="1400" height="550">')).toBeCloseTo(2.545, 3);
});

test("the motion driver hops, eases toggles and fills the part uniforms", () => {
  const recipe = {
    controls: [{ key: "open", type: "toggle", default: 0, ease: 1 }],
    action: { key: "open", label: "Open" },
    drive(t, c, out) {
      out.parts.lid = { angle: c.open };
    },
  };
  const ctx = {
    parts: [
      { name: "body", pivot: [0, 0, 0] },
      { name: "lid", pivot: [0, 1, 0], axis: [1, 0, 0] },
    ],
    transform: { scale: 1 },
  };
  const m = new MotionDriver();
  m.setToy(recipe, ctx);
  const info = { center: [0, 0, 0], half: [1, 1, 1], radius: 1 };
  const motion = { alive: true, move: "still", speed: 0.5 };
  m.act(0);
  let u;
  for (let i = 1; i <= 5; i++)
    u = m.compute({ time: i * 0.1, dt: 0.1, motion, info, cameraPos: [0, 0, 5] });
  expect(m.state.open).toBeCloseTo(0.5, 5);
  expect(m.isAnimating(motion, 0.5)).toBe(true);
  const parts = u["uSpParts[0]"];
  expect(parts.length).toBe(192);
  // Part 1's rotation is a quarter turn's worth of 0.5 rad about X.
  expect(parts[12]).toBeCloseTo(Math.sin(0.25), 5);
  expect(parts[15]).toBeCloseTo(Math.cos(0.25), 5);
  // A toy without an action hops and then settles.
  const plain = new MotionDriver();
  plain.setToy(null, null);
  plain.act(0);
  const still = { alive: true, move: "still", speed: 0.5 };
  expect(plain.isAnimating(still, 0.2)).toBe(true);
  expect(plain.isAnimating(still, 5)).toBe(false);
  const hop = plain.compute({ time: 0.3, dt: 0.016, motion: still, info, cameraPos: [0, 0, 5] });
  expect(hop.uSpBodyT[1]).toBeGreaterThan(0.3);
});

test("a culled part sends its visibility as -1 - v so the shader hides its far side", () => {
  const recipe = {
    drive(t, c, out) {
      out.parts.band = { angle: 1, visible: 0.8, cull: true };
      out.parts.plain = { visible: 0.8 };
    },
  };
  const ctx = {
    parts: [
      { name: "body", pivot: [0, 0, 0] },
      { name: "band", pivot: [0, 0, 0], axis: [0, 1, 0] },
      { name: "plain", pivot: [0, 0, 0], axis: [0, 1, 0] },
    ],
    transform: { scale: 1 },
  };
  const m = new MotionDriver();
  m.setToy(recipe, ctx);
  const info = { center: [0, 0, 0], half: [1, 1, 1], radius: 1 };
  const motion = { alive: true, move: "still", speed: 0.5 };
  const u = m.compute({ time: 0.1, dt: 0.1, motion, info, cameraPos: [0, 0, 5] });
  const parts = u["uSpParts[0]"];
  expect(parts[1 * 12 + 11]).toBeCloseTo(-1.8, 5);
  expect(parts[2 * 12 + 11]).toBeCloseTo(0.8, 5);
});
