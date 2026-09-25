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
  m.state.strike = 1 - 0.13;
  const out = { parts: {} };
  RECIPES.xylophone.drive(0, m.state, out, { tap: m.tap });
  expect(out.parts.bar7.offset[1]).toBeLessThan(-0.005);
  expect(out.parts.bar0.offset[1]).toBe(0);
});

test("every rig fits the rig limits and names real parts, keys and effects", async () => {
  const { RIGS } = await import("../src/rigs.js");
  const { fxTable, fxFrame, FX_SLOTS, FX_VEC4 } = await import("../src/rig-fx.js");
  const problems = [];
  for (const [id, rig] of Object.entries(RIGS)) {
    if (!TOYS.some((t) => t.id === id)) problems.push(`${id}: not on the shelf`);
    const regions = rig.parts.reduce((n, p) => n + p.regions.length, 0);
    if (rig.parts.length > 15) problems.push(`${id}: more than 15 parts`);
    if (regions > 12) problems.push(`${id}: more than 12 regions`);
    if ((rig.fx || []).length > FX_SLOTS) problems.push(`${id}: more than ${FX_SLOTS} effects`);
    if ((rig.keys || []).length > 2) problems.push(`${id}: more than 2 keys`);
    const keyed = (rig.fx || []).some((f) => /key/.test(f.select));
    if (keyed && !(rig.keys || []).length) problems.push(`${id}: an effect uses a key it lacks`);
    const parts = [{ name: "body" }, ...rig.parts];
    for (const f of rig.fx || []) {
      if (f.select?.part && !parts.some((p) => p.name === f.select.part))
        problems.push(`${id}: effect ${f.name} selects a missing part`);
    }
    if (!rig.action || !rig.controls.some((c) => c.key === rig.action.key))
      problems.push(`${id}: the action has no control`);
    // drive() runs at rest and mid-effect without throwing.
    const state = Object.fromEntries(rig.controls.map((c) => [c.key, 0.5]));
    const out = { parts: {}, fx: {}, body: null, addon: null };
    rig.drive(1.2, state, out, { time: 1.2, R: 1, tap: { n: 1, time: 0 } });
    for (const name of Object.keys(out.fx))
      if (!(rig.fx || []).some((f) => f.name === name)) problems.push(`${id}: drives unknown fx ${name}`); // prettier-ignore
    if (rig.fx) {
      const table = fxTable(rig, parts);
      expect(table.length).toBe(FX_SLOTS * FX_VEC4 * 4);
      fxFrame(table, rig, out.fx, 0.5);
    }
  }
  expect(problems).toEqual([]);
});

test("a rig's effects and part glow reach the modifier's uniforms", async () => {
  const { MotionDriver } = await import("../src/motion.js");
  const { RIGS } = await import("../src/rigs.js");
  const { fxTable } = await import("../src/rig-fx.js");
  const rig = RIGS.strawberry;
  const m = new MotionDriver();
  const parts = [{ name: "body", pivot: [0, 0, 0], axis: [0, 1, 0] }];
  m.setToy(rig, { parts, transform: null, rig: true, fx: fxTable(rig, parts) });
  expect(m.act(0, null)).toMatchObject({ key: "pop", value: 1 });
  const info = { center: [0, 0, 0], half: [1, 1, 1], radius: 1 };
  const motion = { alive: true, move: "still", speed: 0.5 };
  const u = m.compute({ time: 0.4, dt: 0.4, motion, info, cameraPos: [0, 0, 5] });
  const fx = u["uSpFx[0]"];
  // Slot 0 (seeds): selected by key 0, pushed out, staggered, glowing.
  expect([...fx.slice(0, 4)]).toEqual([2, 0, 1, 3]);
  expect(fx[4]).toBeGreaterThan(0); // move
  expect(fx[5]).toBeGreaterThan(0); // colour
  expect(fx[28]).toBeCloseTo(0.4, 5); // seconds since the tap
  expect(u["uSpRigTint[0]"]).toHaveLength(64);
  // A part driven with tint and scale: the lantern's glass glows when lit.
  const lantern = new MotionDriver();
  const lp = [
    { name: "body", pivot: [0, 0, 0] },
    { name: "glass", pivot: [0, -0.2, 0] },
  ];
  lantern.setToy(RIGS.lantern, { parts: lp, transform: null, rig: true, fx: null }, { lit: 1 });
  const lu = lantern.compute({ time: 1, dt: 0.1, motion, info, cameraPos: [0, 0, 5] });
  expect(lu["uSpRigTint[0]"][4]).toBeGreaterThan(0.1);
  expect(lantern.hasBehaviours()).toBe(true);
  lantern.setControl("lit", 0, { snap: true });
  expect(lantern.hasBehaviours()).toBe(false);
});

test("the chess set plays the real Opera Game (Paris, 1858) to its final position", async () => {
  const { OPERA_GAME, replay, toFen } = await import("../src/packs/games.js");
  const { after, captured } = replay(OPERA_GAME);
  expect(OPERA_GAME).toHaveLength(33);
  // 17.Rd8# : the published final position.
  expect(toFen(after.at(-1))).toBe("1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5");
  // Twelve pieces are taken (4.dxe5 to 16...Nxb8), the last the white queen.
  expect(captured.filter(Boolean)).toHaveLength(12);
  expect(captured[31]).toBe("wQ");
});

test("the chess rules count every legal move (perft) from tricky positions", async () => {
  const { parseFen, legalMoves, applyMove, START_FEN } = await import("../src/chess.js");
  const perft = (p, d) => {
    if (!d) return 1;
    let n = 0;
    for (const m of legalMoves(p)) n += perft(applyMove(p, m), d - 1);
    return n;
  };
  // Published counts: the start, "Kiwipete" (castling, pins), an en passant
  // endgame, and two positions full of promotions and checks.
  expect(perft(parseFen(START_FEN), 3)).toBe(8902);
  expect(perft(parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 3)).toBe(97862); // prettier-ignore
  expect(perft(parseFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4)).toBe(43238);
  expect(perft(parseFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3)).toBe(9467); // prettier-ignore
  expect(perft(parseFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), 3)).toBe(62379); // prettier-ignore
});

test("a PGN game is read move by move: tags, comments, variations, castling, en passant, promotion", async () => {
  const { readPgn } = await import("../src/chess.js");
  const { OPERA_GAME } = await import("../src/packs/games.js");
  // The Opera Game as a PGN file, with a comment, a variation and a NAG.
  const opera = readPgn(`[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Morphy, Paul"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 {This is a weak move already.} 4.dxe5 Bxf3 5.Qxf3 dxe5
6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 $6 10.Nxb5 cxb5 11.Bxb5+ Nbd7 (11...Kd8 12.O-O-O)
12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0`);
  expect(opera.title).toBe("Morphy v Duke Karl / Count Isouard, Paris 1858");
  expect(opera.loser).toBe("b");
  expect(opera.plies.map((p) => [p.from, p.to, p.rf, p.rt].filter(Boolean))).toEqual(OPERA_GAME);
  // Both castlings, en passant and an underpromotion to a knight.
  const g = readPgn("1. e4 Nf6 2. e5 d5 3. exd6 e.p. Qxd6 4. Nf3 Nc6 5. Bc4 Bf5 6. O-O O-O-O 7. h4 Kb8 8. h5 a6 9. h6 a5 10. hxg7 a4 11. gxh8=N Qd7 12. Ng6 hxg6 *"); // prettier-ignore
  expect(g.plies[4]).toMatchObject({ from: "e5", to: "d6", ep: "d5" });
  expect(g.plies[10]).toMatchObject({ from: "e1", to: "g1", rf: "h1", rt: "f1" });
  expect(g.plies[11]).toMatchObject({ from: "e8", to: "c8", rf: "a8", rt: "d8" });
  expect(g.plies[20]).toMatchObject({ from: "g7", to: "h8", promo: "N" });
  expect(g.loser).toBe(null);
  // A set-up position (FEN) and a knight move that needs its file.
  const f = readPgn(
    '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/N3K1N1 w - - 0 1"]\n\n1. Nac2 Kd7 2. Ne2 *',
  );
  expect(f.plies[0]).toMatchObject({ from: "a1", to: "c2" });
  expect(f.start).toEqual({ a1: "wN", e1: "wK", g1: "wN", e8: "bK" });
  // Clear messages for things that are not games.
  expect(() => readPgn("")).toThrow("empty");
  expect(() => readPgn("hello there")).toThrow(/Move 1\.hello/);
  expect(() => readPgn("1. e4 e5 2. Ke3")).toThrow(/Move 2\.Ke3: "Ke3" is not a legal move here/);
  expect(() => readPgn("1. e4 e5 2. Nf3 Nc6 3. Nf5")).toThrow(/not a legal move/);
  expect(() => readPgn('[Variant "Chess960"]\n1. e4')).toThrow("standard chess");
});

test("the chess set plays a loaded game: spares rise for a promotion, the en passant pawn leaves", async () => {
  const { RECIPES, TOKEN_COUNT } = await import("../src/packs/games.js");
  const { MAX_TOKENS } = await import("../src/motion.js");
  expect(TOKEN_COUNT).toBe(MAX_TOKENS);
  const chess = RECIPES["chess-set"];
  const g = await chess.game.load("1. e4 Nf6 2. e5 d5 3. exd6 Qxd6 4. Nf3 Nc6 5. Bc4 Bf5 6. O-O O-O-O 7. h4 Kb8 8. h5 a6 9. h6 a5 10. hxg7 a4 11. gxh8=Q Qd7 12. d4 Qe6 1-0"); // prettier-ignore
  expect(chess.action.label).toBe("Play the game");
  expect(chess.game.title()).toBe("A game");
  // Run the game to its end, a frame at a time.
  const out = () => ({ cues: [], tokens: null });
  let o = out();
  chess.drive(0, { play: 1, pace: 1 }, o, { time: 0 });
  let cues = 0;
  for (let t = 0; t < (g.plies.length * 1.35) / 2.5 + 3; t += 0.1) {
    o = out();
    chess.drive(0, { play: 1, pace: 1 }, o, { time: t });
    cues += o.cues.length;
  }
  expect(o.tokens).toHaveLength(MAX_TOKENS);
  // Captured pieces stay in view in the trays and a promotion swaps the
  // pawn for a spare, so 32 pieces are shown: one of them the new queen.
  const onBoard = g.end.board.filter(Boolean).length;
  expect(onBoard).toBe(32 - 4);
  expect(o.tokens.filter((t) => t.visible > 0.99)).toHaveLength(32);
  expect(o.tokens.slice(32).filter((t) => t.visible > 0.99)).toHaveLength(1);
  // A clack for every move, extra ones for captures and the queen, and the
  // black king tipping at the end.
  expect(cues).toBeGreaterThan(g.plies.length);
  expect(o.tokens.some((t) => t.quat)).toBe(true);
  chess.game.reset();
  expect(chess.action.label).toBe("Play the Opera Game");
});

// Phase E2: space, atoms and gems.
const E2 = {
  space:
    "sun solar-system mercury venus earth moon mars jupiter saturn uranus neptune aurora-planet asteroid comet meteor star pulsar black-hole star-cluster planetary-nebula nebula spiral-galaxy",
  atoms: "orbital atom molecule crystal-lattice",
  gems: "diamond ruby emerald sapphire quartz-cluster opal",
};

test("every E2 toy has its own tap: a pulse control that drive() answers", async () => {
  // The Moon lands and stays until a second tap (a toggle).
  const TOGGLES = ["moon"];
  for (const [pack, ids] of Object.entries(E2)) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    for (const id of ids.split(" ")) {
      const r = RECIPES[id];
      const ctl = r.controls?.find((c) => c.key === r.action?.key);
      expect(ctl?.type, id).toBe(TOGGLES.includes(id) ? "toggle" : "pulse");
      // Mid-effect and at rest, drive() gives finite numbers.
      for (const v of [0.5, 0]) {
        const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {} };
        const c = { [ctl.key]: v };
        for (const x of r.controls) if (!(x.key in c)) c[x.key] = x.default ?? 0;
        r.drive(1.5, c, out, { time: 1.5, R: 1, tap: null, data: undefined });
        for (const pd of Object.values(out.parts))
          for (const x of [pd.angle, pd.visible, pd.scale, ...(pd.offset || [])])
            if (x !== undefined) expect(Number.isFinite(x), id).toBe(true);
      }
    }
  }
});

test("a turning planet shows only the copy within a quarter turn of how it was built", async () => {
  const { RECIPES } = await import("../src/packs/space.js");
  // Splats sort in their built pose, so a copy turned further would draw
  // its far side over its near side (see docs/PACKS.md, "Draw order").
  // Earth and Mercury have four copies and show one turned only one way
  // from its build, so the night or the heat above them stays on top.
  for (const [id, key, side] of [
    ["jupiter", "race", 0],
    ["earth", "day", -1],
    ["venus", "swirl", 0],
    ["mercury", "spin", 1],
  ]) {
    for (let v = 1; v > 0; v -= 0.05) {
      const out = { parts: {}, cues: [] };
      RECIPES[id].drive(0, { [key]: v }, out, { time: 0 });
      for (const name of Object.keys(out.parts)) {
        if (!out.parts[`${name}B`]) continue;
        const copies = ["", "B", "C", "D"].map((s) => out.parts[name + s]).filter(Boolean);
        expect(copies.length, `${id} ${name}`).toBe(side ? 4 : 2);
        const shown = copies.filter((c) => c.visible > 0);
        expect(shown.length, `${id} ${name}`).toBe(1);
        const a = Math.atan2(Math.sin(shown[0].angle), Math.cos(shown[0].angle));
        expect(Math.abs(a), `${id} ${name}`).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
        if (side) expect(a * side, `${id} ${name}`).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  }
});

test("a heated molecule moves each atom on its own, along its bonds", async () => {
  const { RECIPES } = await import("../src/packs/atoms.js");
  const { buildRecipe } = await import("../src/kit.js");
  const it = buildRecipe(RECIPES.molecule, { seed: 3, count: 8000, options: { molecule: "water" } }, () => {}); // prettier-ignore
  let r = it.next();
  while (!r.done) r = it.next();
  const data = r.value.kit.data;
  expect(data.tokens.length).toBe(3);
  const out = { parts: {}, tokens: null };
  RECIPES.molecule.drive(0.37, { heat: 0.7 }, out, { data });
  const moves = out.tokens.map((t) => Math.hypot(...t.offset));
  // Both hydrogens move, differently, and further than the heavy oxygen.
  expect(moves[1]).toBeGreaterThan(0.01);
  expect(Math.abs(moves[1] - moves[2])).toBeGreaterThan(1e-4);
  expect(moves[0]).toBeLessThan(Math.max(moves[1], moves[2]));
  // At rest the atoms only jiggle a little.
  const calm = { parts: {} };
  RECIPES.molecule.drive(0.37, { heat: 0 }, calm, { data });
  expect(Math.max(...calm.tokens.map((t) => Math.hypot(...t.offset)))).toBeLessThan(moves[1]);
});

test("the Moon landing is hidden at rest, lands, and leaves nothing behind", async () => {
  const { RECIPES } = await import("../src/packs/space.js");
  const moon = RECIPES.moon;
  const drive = (land, c) => {
    const out = { parts: {}, cues: [] };
    moon.drive(0, Object.assign(c, { land }), out, { time: 0, data: { ground: () => 1 } });
    return out;
  };
  const shown = (out) =>
    Object.entries(out.parts)
      .filter(([, p]) => p.visible > 0)
      .map(([n]) => n);
  expect(shown(drive(0, {}))).toEqual([]);
  // Landed: the lander, the astronaut and the unrolled flag show.
  const c = {};
  for (let v = 0; v <= 1.0001; v += 0.01) drive(Math.min(1, v), c);
  const landed = shown(drive(1, c));
  for (const name of ["lander", "astro", "pole", "cloth0", "cloth5"])
    expect(landed).toContain(name);
  expect(landed).not.toContain("climber");
  expect(landed).not.toContain("roll");
  // Leaving runs to empty again, with the lift-off roar on the way.
  let cues = 0;
  for (let v = 1; v >= -0.0001; v -= 0.01) cues += drive(Math.max(0, v), c).cues.length;
  expect(cues).toBeGreaterThan(0);
  expect(shown(drive(0, c))).toEqual([]);
});

const E3 = {
  tiny: "virus bacterium red-blood-cell astrocyte animal-cell white-blood-cell microglia diatom pollen snowflake chromosome mitochondrion paramecium amoeba",
  anatomy: "heart brain lungs tooth kidney",
  maths: "mobius menger-sponge hypercube torus-knot gyroid mandelbulb seashell-spiral",
};

test("every E3 toy has its own tap, and its channels are near rest when it is done", async () => {
  const { buildRecipe } = await import("../src/kit.js");
  for (const [pack, ids] of Object.entries(E3)) {
    const { RECIPES } = await import(`../src/packs/${pack}.js`);
    for (const id of ids.split(" ")) {
      const r = RECIPES[id];
      const ctl = r.controls?.find((c) => c.key === r.action?.key);
      expect(ctl, id).toBeTruthy();
      const it = buildRecipe(r, { seed: 5, count: 6000 }, () => {});
      let b = it.next();
      while (!b.done) b = it.next();
      const data = b.value.kit.data;
      for (const v of [0.5, 0]) {
        const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {} };
        const c = { [ctl.key]: v };
        for (const x of r.controls) if (!(x.key in c)) c[x.key] = x.default ?? 0;
        r.drive(1.5, c, out, { time: 1.5, R: 1, tap: null, data });
        for (const pd of Object.values(out.parts))
          for (const x of [pd.angle, pd.visible, pd.scale, ...(pd.offset || [])])
            if (x !== undefined) expect(Number.isFinite(x), id).toBe(true);
        for (const m of out.morph || []) expect(Number.isFinite(m), id).toBe(true);
        if (v === 0 && ctl.type === "pulse")
          for (const m of out.morph || []) expect(Math.abs(m), `${id} at rest`).toBeLessThan(0.2);
      }
    }
  }
});

test("a morph splat packs the offset to its target; band, fade and skin pack their channel", async () => {
  const { Kit } = await import("../src/kit.js");
  const { KINDS, MORPH_RANGE } = await import("../src/effects.js");
  const k = new Kit(1, { count: 3000 });
  k.add(k.sphere(1), { to: (c) => [c.p[0] * 1.5, c.p[1], c.p[2]], channel: 2 });
  k.add(k.sphere(0.5), { kind: "band", params: [0.4, 0.1], channel: 1 });
  k.add(k.sphere(0.5), { kind: "fade", params: [0.3, -0.2], channel: 3 });
  k.add(k.sphere(0.5), { skin: () => [3, 7, 0.25] });
  const it = k.emit();
  while (!it.next().done);
  const { anim, pos, count } = k.buf;
  const s = k.transform.scale;
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const kind = anim[i * 4 + 1];
    const [z, w] = [anim[i * 4 + 2], anim[i * 4 + 3]];
    seen.add(kind);
    if (kind === KINDS.morph) {
      const qx = Math.floor(z / 4096);
      const ch = Math.floor(w / 4096);
      const dx = ((qx - 2048) * MORPH_RANGE) / 2048;
      // The target is half as far out again along x (in toy units).
      const x = pos[i * 3] / s + k.transform.center[0];
      expect(ch).toBe(2);
      expect(Math.abs(dx - 0.5 * x * s)).toBeLessThan(0.002);
      expect(Math.abs(((z - qx * 4096 - 2048) * MORPH_RANGE) / 2048)).toBeLessThan(0.002);
    }
    if (kind === KINDS.band) expect([z, w]).toEqual([expect.closeTo(0.4), expect.closeTo(1.1)]);
    if (kind === KINDS.fade) expect([z, w]).toEqual([expect.closeTo(0.3), expect.closeTo(-3.2)]);
    if (kind === KINDS.skin) expect([z, w]).toEqual([3 + 64 * 7, 0.25]);
  }
  for (const kind of ["morph", "band", "fade", "skin"])
    expect(seen.has(KINDS[kind]), kind).toBe(true);
  // Morph targets count in the fit: the stretched sphere fits the frame.
  expect(s).toBeLessThan(0.7);
});
