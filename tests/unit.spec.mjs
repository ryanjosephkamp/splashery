// Unit checks that need no browser: the scene schema, the link codec, the
// procedural generators and the toys' sounds.

import { test, expect } from "@playwright/test";
import { normalizeScene, createScene, SCENE_VERSION } from "../src/state.js";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import {
  generateSync,
  normalizeGenerator,
  SHAPE_IDS,
  PALETTE_IDS,
  PROFILES,
} from "../src/generators.js";
import fs from "node:fs";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { specProblems, specFor, LEGACY_NAMES } from "../src/voices.js";

test("a default scene normalises to itself", () => {
  const scene = normalizeScene(createScene({ seed: 42 }));
  expect(scene.version).toBe(SCENE_VERSION);
  expect(normalizeScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
});

test("normalizeScene clamps garbage and refuses non-scenes", () => {
  expect(() => normalizeScene(null)).toThrow();
  expect(() => normalizeScene({ version: 1 })).toThrow(/v1 planet/);
  expect(() => normalizeScene({ version: 99 })).toThrow(/newer/);
  const s = normalizeScene({
    version: 2,
    toy: { kind: "procedural", generator: { shape: "nope", count: 1e9, roughness: 7 } },
    look: { background: "red", exposure: 99, theme: "sepia" },
    effects: {
      drop: { on: true },
      dissolve: { on: true },
      wind: { strength: -3 },
      poke: { on: true },
    },
    paint: { stamps: [[0, 0, 0, 0.1, "#ff0000", 1], ["x"], [1, 2, 3, -1, "#00ff00", 1]] },
    camera: { distance: 1000 },
  });
  expect(s.toy.generator.shape).toBe("blob");
  expect(s.toy.generator.count).toBe(PROFILES.strong.maxCount);
  expect(s.toy.generator.roughness).toBe(1);
  expect(s.look).toMatchObject({ background: "page", exposure: 2.5, theme: "auto" });
  expect(s.effects.drop.on).toBe(true);
  expect(s.effects.dissolve.on).toBe(false);
  expect(s.effects.wind.strength).toBe(0);
  expect(s.effects.poke.on).toBe(false);
  expect(s.paint.stamps).toEqual([[0, 0, 0, 0.1, "#ff0000", 1]]);
  expect(s.camera.distance).toBe(10);
  expect(normalizeScene({ version: 2 }, "weak").toy).toEqual({ kind: "builtin", id: "blob" });
});

test("the link codec round-trips a scene through deflate and base64url", async () => {
  const scene = normalizeScene(createScene({ seed: 7 }));
  const hash = await encodeSceneHash(scene);
  expect(hash.startsWith("d.")).toBe(true);
  expect(hash).toMatch(/^d\.[A-Za-z0-9_-]+$/);
  expect(await decodeSceneHash(hash)).toEqual(scene);
});

test("generators are deterministic, finite and stay inside the unit ball", () => {
  const clay = [
    ["a", 0.7, 0, 0, 0.15],
    ["e", 0, 0.7, 0, 0.1],
  ];
  for (const shape of SHAPE_IDS) {
    for (const palette of PALETTE_IDS) {
      const g = normalizeGenerator({ shape, palette, seed: 99, count: 6000 });
      const a = generateSync(g, { clay }).buf;
      const b = generateSync(g, { clay }).buf;
      let same = a.count === b.count;
      let bad = 0;
      for (let i = 0; i < a.count * 3; i++) {
        if (a.pos[i] !== b.pos[i]) same = false;
        if (!Number.isFinite(a.pos[i]) || Math.abs(a.pos[i]) > 1.3) bad++;
      }
      for (let i = 0; i < a.count * 4; i++) if (!(a.color[i] >= 0 && a.color[i] <= 1)) bad++;
      expect({ shape, palette, same, bad, enough: a.count > 6000 }).toEqual({
        shape,
        palette,
        same: true,
        bad: 0,
        enough: true,
      });
    }
  }
});

test("the low tier stays bounded and the tiers grow in order", () => {
  expect(normalizeGenerator({ count: 300000 }, "low").count).toBe(120000);
  expect(PROFILES.low.defaultCount).toBeLessThanOrEqual(60000);
  // The old names still work: weak is low, strong is high.
  expect(normalizeGenerator({ count: 300000 }, "weak").count).toBe(120000);
  expect(normalizeGenerator({ count: 300000 }, "strong").count).toBe(300000);
  const tiers = ["low", "mid", "high", "max"].map((t) => PROFILES[t]);
  for (let i = 1; i < tiers.length; i++) {
    expect(tiers[i].defaultCount).toBeGreaterThan(tiers[i - 1].defaultCount);
    expect(tiers[i].maxCount).toBeGreaterThanOrEqual(tiers[i - 1].maxCount);
  }
  expect(PROFILES.mid.defaultCount).toBe(140000);
  expect(PROFILES.high.defaultCount).toBe(200000);
});

// JSON with sorted keys, so two specs that differ only in key order match.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

test("every shelf toy has its own sound, and no two share the exact same spec", () => {
  const problems = [];
  const seen = new Map();
  for (const t of TOYS) {
    const spec = TOY_SOUNDS[t.id];
    if (!spec) {
      problems.push(`${t.id}: no sound in src/toy-sounds.js`);
      continue;
    }
    problems.push(...specProblems(spec, t.id));
    // Each toy uses the voice library, not one of the old shared names.
    if (typeof spec === "string") problems.push(`${t.id}: uses the shared sound "${spec}"`);
    const key = canonical(spec);
    if (seen.has(key)) problems.push(`${t.id}: same sound as ${seen.get(key)}`);
    seen.set(key, t.id);
    // The halves of a toggle differ too.
    const on = specFor(spec, true);
    const off = specFor(spec, false);
    if (on !== off && canonical(on) === canonical(off)) problems.push(`${t.id}: on and off match`);
  }
  for (const id of Object.keys(TOY_SOUNDS))
    if (!TOYS.some((t) => t.id === id)) problems.push(`${id}: in src/toy-sounds.js, not on the shelf`); // prettier-ignore
  expect(problems).toEqual([]);
});

test("twins sound different: they use different voices", () => {
  const voices = (id) =>
    JSON.stringify(TOY_SOUNDS[id])
      .match(/"voice":"(\w+)"/g)
      .sort()
      .join();
  const twins = [
    ["rubber-duck", "rubber-duck-real"],
    ["croissant", "croissant-real"],
    ["alarm-clock", "clock"],
    ["cactus", "saguaro"],
    ["grape", "grapes"],
  ];
  for (const [a, b] of twins) expect(voices(a), `${a} and ${b}`).not.toBe(voices(b));
});

test("old sound names still work, and specs are checked", () => {
  for (const name of LEGACY_NAMES) expect(specProblems(name)).toEqual([]);
  expect(specProblems("nope")).toHaveLength(1);
  expect(specProblems({ voice: "bell", pitch: 0.8, decay: 1.2 })).toEqual([]);
  expect(specProblems({ voice: "kazoo" })[0]).toMatch(/unknown voice/);
  expect(specProblems({ voice: "bell", wobble: 1 })[0]).toMatch(/unknown key/);
  expect(specProblems({ voice: "bell", notes: "C4 H4" })[0]).toMatch(/Unknown note/);
  expect(specProblems({ on: { voice: "bell" } })[0]).toMatch(/both on and off/);
  const toggle = { on: { voice: "bell" }, off: "close" };
  expect(specFor(toggle, true)).toEqual({ voice: "bell" });
  expect(specFor(toggle, false)).toBe("close");
  expect(specFor("chime", false)).toBe("chime");
});

test("embeds never load the sound code", () => {
  // Walks the static imports from each embed entry point.
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/^import[^;]*?from\s+"\.\/([\w-]+\.js)"/gm)) walk(m[1]);
  };
  walk("element.js");
  walk("embed.js");
  expect(seen.has("viewer.js")).toBe(true);
  for (const f of ["sound.js", "voices.js", "toy-sounds.js"]) expect(seen.has(f), f).toBe(false);
});

test("a tap knows where it landed: a xylophone bar strikes that bar", async () => {
  const { MotionDriver } = await import("../src/motion.js");
  const { RECIPES } = await import("../src/packs/music.js");
  const m = new MotionDriver();
  m.setToy(RECIPES.xylophone, { parts: [], transform: { center: [0, 0, 0], scale: 1 } });
  // The third bar (x = -0.33), on its top face.
  const r = m.act(0, [-0.33, 0.1, 0.1]);
  expect(r).toMatchObject({ key: "strike", pick: 2, value: 1 });
  expect(m.tap).toMatchObject({ key: "strike", pick: 2, n: 1 });
  // Off the bars (a rail end, low down) plays the whole scale.
  expect(m.act(1, [0.9, -0.05, 0.4])).toMatchObject({ key: "play", pick: null });
  // The Play button has no point: the usual action.
  expect(m.act(2, null)).toMatchObject({ key: "play", pick: null });
  expect(m.tap.n).toBe(3);
  // drive() sees the tap: the struck bar dips when the mallet lands.
  m.act(3, [0.77, 0.1, 0]);
  expect(m.tap.pick).toBe(7);
  m.state.play = 0;
  m.state.strike = 1 - 0.305;
  const out = { parts: {} };
  RECIPES.xylophone.drive(0, m.state, out, { tap: m.tap });
  expect(out.parts.bar7.offset[1]).toBeLessThan(-0.005);
  expect(out.parts.bar0.offset[1]).toBe(0);
});
