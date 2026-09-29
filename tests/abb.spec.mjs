// Lane A/B (maker B)'s own checks (docs/OPERATING.md): the toy piano. Its
// drive() runs in Node, frame by frame, as the app plays it.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildRecipe, quatRotate, vec } from "../src/kit.js";
import { RECIPES, TOY_PIANO_SONG } from "../src/packs/music.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { parseNotes, specProblems } from "../src/voices.js";

const r = RECIPES["toy-piano"];
const NAMES = "C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5 C6 C#6 D6 D#6 E6 F6".split(" ");

function build() {
  const it = buildRecipe(r, { seed: 5, count: 20000, options: { case: "#c8202e" } }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

// Plays from a tap until `secs` after it; step(s, out) sees each frame.
function play(tap, secs, step) {
  const c = { play: 0, strike: 0 };
  const dt = 1 / 60;
  const t0 = 10;
  const ease = (k) => r.controls.find((x) => x.key === k).ease;
  const frame = (s, tapInfo) => {
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }; // prettier-ignore
    r.drive(t0 + s, c, out, { time: t0 + s, R: 1, tap: tapInfo });
    return out;
  };
  frame(-dt, null);
  const info = { n: 1, time: t0, key: tap.key, pick: tap.pick ?? null, point: null };
  for (let s = 0; s <= secs + 1e-9; s += dt) {
    c[tap.key] = Math.max(0, 1 - s / ease(tap.key));
    step(s, frame(s, info));
  }
}

// How far a token's piece has turned (radians) from its quaternion.
const turn = (tk) => (tk?.quat ? 2 * Math.acos(Math.min(1, Math.abs(tk.quat[3]))) : 0);

test("the toy piano has 18 keys, hammers and rods, each its own piece", async () => {
  const kit = build();
  const tokens = new Set();
  const parts = new Set();
  const kinds = kit.buf.count;
  expect(kinds).toBeGreaterThan(10000);
  // Rods 12-17 are parts; everything else moves as tokens 0-47.
  for (let i = 12; i < 18; i++) parts.add(`rod${i}`);
  expect(
    kit.parts
      .map((p) => p.name)
      .filter((n) => n !== "body")
      .sort(),
  ).toEqual([...parts].sort());
  play({ key: "strike", pick: 3 }, 0.2, (s, out) => {
    if (s > 0.15) out.tokens.forEach((tk, i) => tk && tokens.add(i));
  });
  expect(tokens.size).toBe(48);
});

test("a tap on a key, its hammer or its rod picks that key; elsewhere plays the song", async () => {
  const at = (p) => r.action.at(p, {});
  // White keys at their fronts, black keys on their raised tops.
  const whites = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];
  whites.forEach((i, j) => expect(at([(j - 5) * 0.108, 0.46, 0.4])).toEqual({ key: "strike", pick: i })); // prettier-ignore
  const blacks = [1, 3, 6, 8, 10, 13, 15];
  const bx = [0.5, 1.5, 3.5, 4.5, 5.5, 7.5, 8.5];
  blacks.forEach((i, j) => expect(at([(bx[j] - 5) * 0.108, 0.49, 0.2])).toEqual({ key: "strike", pick: i })); // prettier-ignore
  // A rod or a hammer, seen through the open back or the raised lid.
  for (const i of [0, 8, 17]) {
    const x = (i - 8.5) * 0.064;
    expect(at([x, 0.8, -0.2])).toEqual({ key: "strike", pick: i });
    expect(at([x, 0.63, 0])).toEqual({ key: "strike", pick: i });
  }
  // The lid, the cheeks, the plinth and the lower front play the song.
  for (const p of [[0, 1.3, -0.5], [0.66, 0.6, 0], [0, 0.02, 0.1], [0, 0.2, 0.08]]) expect(at(p)).toBe(null); // prettier-ignore
});

test("a struck key dips, its hammer meets its rod as the note sounds, and the rod shivers", async () => {
  for (const pick of [0, 7, 13, 17]) {
    let hit = null;
    let maxHam = 0;
    let rodMoves = 0;
    let keyDown = 0;
    const cues = [];
    const others = new Set();
    play({ key: "strike", pick }, 1.7, (s, out) => {
      const tk = out.tokens;
      keyDown = Math.max(keyDown, turn(tk[pick]));
      const h = turn(tk[18 + pick]);
      if (h > maxHam) [maxHam, hit] = [h, s];
      const rod = pick < 12 ? turn(tk[36 + pick]) : Math.abs(out.parts[`rod${pick}`]?.angle ?? 0);
      if (s > 0.12 && rod > 0.01) rodMoves++;
      for (const c of out.cues) cues.push([s, c]);
      tk.forEach((t, i) => {
        if (i !== pick && i !== 18 + pick && i !== 36 + pick && turn(t) > 1e-6) others.add(i);
      });
      if (s > 1.62) {
        // Back at rest.
        tk.forEach((t) => expect(turn(t)).toBeLessThan(1e-6));
        for (const k in out.parts) expect(Math.abs(out.parts[k].angle)).toBeLessThan(1e-6);
      }
    });
    expect(keyDown).toBeGreaterThan(0.1);
    // The hammer swings about a sixth of a turn and lands 0.09 s after the tap.
    expect(maxHam).toBeGreaterThan(0.9);
    expect(hit).toBeGreaterThan(0.07);
    expect(hit).toBeLessThan(0.11);
    expect(rodMoves).toBeGreaterThan(20);
    expect(others.size).toBe(0);
    // One note, the key's own, as the hammer lands.
    expect(cues.length).toBe(1);
    expect(cues[0][0]).toBeGreaterThan(0.08);
    expect(cues[0][0]).toBeLessThan(0.12);
    expect(cues[0][1][0].f).toBe(NAMES[pick]);
    expect(specProblems(cues[0][1])).toEqual([]);
  }
});

test("the hammer's head just meets its rod at the strike, without passing into it", async () => {
  // The head's centre at rest and its pivot, in recipe coordinates.
  const pivot = [0, 0.52, -0.13];
  const head = [0, 0.632, -0.002];
  // The rod's front is at z = -0.2 + 0.0115; the head's radius is 0.025.
  const meet = -0.2 + 0.0115 + 0.025;
  let nearest = Infinity;
  play({ key: "strike", pick: 4 }, 0.6, (s, out) => {
    const q = out.tokens[22].quat;
    const p = vec.add(pivot, quatRotate(q, vec.sub(head, pivot)));
    expect(p[2]).toBeGreaterThan(meet - 0.002);
    nearest = Math.min(nearest, p[2] - meet);
  });
  expect(nearest).toBeLessThan(0.008);
});

test("the song is Twinkle, Twinkle, and every key moves on its own note", async () => {
  const spec = TOY_SOUNDS["toy-piano"];
  expect(specProblems(spec)).toEqual([]);
  const notes = parseNotes(spec[0].notes).map((n) => (n.length ? NAMES.indexOf(n[0]) : -1));
  expect(notes).toEqual(TOY_PIANO_SONG);
  for (const layer of spec) expect(layer.notes).toBe(spec[0].notes);
  // Each note's hammer lands when the sound plays it.
  const strikes = [];
  const was = new Map();
  play({ key: "play" }, r.controls[0].ease, (s, out) => {
    for (let k = 0; k < 18; k++) {
      const h = turn(out.tokens[18 + k]);
      const prev = was.get(k) ?? { h: 0, up: false };
      if (prev.up && h < prev.h - 1e-4) strikes.push([s, k]);
      was.set(k, { h, up: h > prev.h + 1e-4 && h > 0.5 });
    }
    expect(out.cues.length).toBe(0);
  });
  const want = TOY_PIANO_SONG.map((k, j) => [spec[0].at + j * spec[0].step, k]).filter(
    ([, k]) => k >= 0,
  );
  expect(strikes.length).toBe(want.length);
  strikes.forEach(([s, k], j) => {
    expect(k).toBe(want[j][1]);
    // A strike shows on the frame after the hammer lands (two frames at most).
    expect(Math.abs(s - want[j][0])).toBeLessThan(0.04);
  });
});

const SHOTS = path.resolve("tests/screenshots");

test("toy piano screenshots at 390x844 and 1440x900, mid-song", async ({ browser }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h, mobile] of [
    [390, 844, true],
    [1440, 900, false],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      ...(mobile ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto("/?renderer=webgl2&profile=weak");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("toy-piano"));
    await expect(page.locator("#toy-status")).toHaveText(/^Toy piano/, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOTS, `abb-toy-piano-${w}x${h}.png`) });
    expect(problems).toEqual([]);
    await ctx.close();
  }
});
