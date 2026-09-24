// Unit checks that need no browser: the scene schema, the link codec and the
// procedural generators.

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
