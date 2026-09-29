// Lane AI (AI and computing): the eleven kit toys on the computing shelf.
// tests/taps.spec.mjs plays every toy's tap with its default options; here
// each option is played too, and a few toys are checked against the idea
// they show (the sort really sorts, the ball settles in the valley, the
// perceptron only fires after it learns).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { RECIPES } from "../src/packs/computing.js";

const IDS = ["perceptron", "multilayer-perceptron", "neural-network", "cnn", "rnn", "transformer", "looped-transformer", "diffusion-model", "gradient-descent", "word-vectors", "sorting-machine", "half-adder"]; // prettier-ignore
const PLAN = JSON.parse(fs.readFileSync(new URL("../tools/toy-plan.json", import.meta.url), "utf8")).toys; // prettier-ignore

// The word vectors toy reads its word list before it builds.
test.beforeAll(async () => {
  await RECIPES["word-vectors"].prepare({});
});

function build(id, options = {}) {
  const r = RECIPES[id];
  const opts = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
  Object.assign(opts, options);
  const it = buildRecipe(r, { seed: 5, count: 6000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

// Plays the tap frame by frame; returns the frames' outputs by time.
function play(id, options = {}, fps = 30) {
  const r = RECIPES[id];
  const kit = build(id, options);
  const ctl = r.controls.find((c) => c.key === r.action.key);
  const secs = ctl.ease;
  const frames = [];
  const frame = (v) => {
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, cues: [], fx: {}, tokens: null };
    r.drive(0, { [ctl.key]: v }, out, { time: 0, R: 1, tap: { n: 1 }, data: kit.data });
    return out;
  };
  const rest = frame(0);
  for (let s = 0; s <= secs; s += 1 / fps) frames.push({ s, out: frame(Math.max(0, 1 - s / secs)) }); // prettier-ignore
  frames.push({ s: secs, out: frame(0) });
  return { rest, frames, kit };
}

test("the computing shelf: after Maths, with its twelve toys, sounds and plan entries", () => {
  const ids = CATEGORIES.map((c) => c.id);
  expect(ids.indexOf("computing")).toBe(ids.indexOf("maths") + 1);
  expect(CATEGORIES.find((c) => c.id === "computing").label).toBe("AI and computing");
  for (const id of IDS) {
    const t = TOYS.find((x) => x.id === id);
    expect(t, id).toBeTruthy();
    expect(t.category).toBe("computing");
    expect(t.pack).toBe("computing");
    expect(TOY_SOUNDS[id], id).toBeTruthy();
    expect(PLAN[id], id).toBeTruthy();
    expect(RECIPES[id].build, id).toBeTruthy();
  }
  // Lane AI's own pack; later lanes may add toys to this shelf (the Gaussian splatting toy).
  expect(TOYS.filter((t) => t.pack === "computing").length).toBe(IDS.length);
});

// Every option of every toy: the tap stays finite, uses at most the kit's
// 15 parts and 48 tokens, and ends exactly where it rests.
for (const id of IDS) {
  const r = RECIPES[id];
  const variants = [{}];
  for (const o of r.options || [])
    if (o.type === "select")
      for (const c of o.choices) if (c.id !== o.default) variants.push({ [o.key]: c.id });
  for (const v of variants) {
    const name = Object.values(v)[0] || "default";
    test(`${id} (${name}): the tap is finite and ends at rest`, () => {
      const { rest, frames, kit } = play(id, v);
      expect(kit.parts.length).toBeLessThanOrEqual(16);
      const shown = (x) => (x?.visible ?? 1) * (x?.scale ?? 1);
      const at = (x) => x?.offset || [0, 0, 0];
      for (const { s, out } of frames) {
        expect((out.tokens || []).length, `${id} at ${s}`).toBeLessThanOrEqual(48);
        const nums = [...(out.morph || []), out.grow];
        for (const pd of Object.values(out.parts))
          nums.push(pd.angle, pd.visible, pd.scale, ...(pd.offset || []), ...(pd.quat || []));
        for (const tk of out.tokens || []) nums.push(...at(tk), ...(tk.quat || []), tk.visible);
        const bad = nums.filter((n) => n !== undefined && !Number.isFinite(n));
        expect(bad, `${id} at ${s.toFixed(2)}`).toEqual([]);
      }
      const last = frames[frames.length - 2].out;
      for (const [k, pd] of Object.entries(last.parts))
        expect(Math.abs(shown(pd) - shown(rest.parts[k])), `${id}: part ${k}`).toBeLessThan(0.05);
      (last.tokens || []).forEach((tk, i) => {
        const q = rest.tokens?.[i];
        expect(Math.abs(shown(tk) - shown(q)), `${id}: piece ${i}`).toBeLessThan(0.05);
        if (shown(tk) > 0.05)
          expect(Math.hypot(...at(tk).map((x, j) => x - at(q)[j])), `${id}: piece ${i}`).toBeLessThan(0.03); // prettier-ignore
      });
      // Channels that move splats (morphs) are back at 0; light channels
      // may park anywhere dark.
      const { anim, count } = kit.buf;
      const shaped = new Set();
      for (let i = 0; i < count; i++) if (anim[i * 4 + 1] === KINDS.morph) shaped.add(Math.floor(anim[i * 4 + 3] / 4096)); // prettier-ignore
      for (const ch of shaped) expect(Math.abs(rest.morph?.[ch] ?? 0), `${id}: channel ${ch}`).toBeLessThan(0.05); // prettier-ignore
      // out.grow ends where it rests.
      expect(Math.abs((last.grow ?? 1) - (rest.grow ?? 1))).toBeLessThan(0.05);
    });
  }
}

test("sorting machine: every algorithm ends with the bars in order, and shuffles back", () => {
  for (const algo of [
    "bubble",
    "quick",
    "merge",
    "insertion",
    "selection",
    "cocktail",
    "shell",
    "heap",
  ]) {
    const kit = build("sorting-machine", { algo });
    const steps = kit.data.steps;
    expect(steps[steps.length - 1], algo).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Each bubble or quicksort step swaps exactly two bars.
    if (algo !== "merge")
      for (let i = 1; i < steps.length; i++)
        expect(steps[i].filter((v, j) => v !== steps[i - 1][j]).length).toBe(2);
    // At 4.1 s the bars stand in height order, left to right.
    const { frames } = play("sorting-machine", { algo });
    const f = frames.find((x) => x.s >= 4.1).out;
    const xs = f.tokens.slice(0, 8).map((tk, v) => tk.offset[0] + xOf(v));
    for (let v = 1; v < 8; v++) expect(xs[v], algo).toBeGreaterThan(xs[v - 1]);
  }
  function xOf(v) {
    return ([5, 2, 7, 0, 6, 3, 1, 4].indexOf(v) - 3.5) * 0.24;
  }
});

test("gradient descent: just right settles in the valley; too high keeps bouncing", () => {
  const good = build("gradient-descent", { rate: "good" }).data.path;
  const high = build("gradient-descent", { rate: "high" }).data.path;
  const low = build("gradient-descent", { rate: "low" }).data.path;
  const end = good[good.length - 1];
  expect(Math.abs(end[0] - 0.3)).toBeLessThan(0.05);
  expect(Math.abs(end[2])).toBeLessThan(0.05);
  // Too low creeps: it has not reached the valley by the last step.
  expect(low[low.length - 1][0]).toBeLessThan(0);
  // Too high: its last steps still jump far from side to side.
  const jumps = high.slice(-4).map((p, i, a) => (i ? Math.abs(p[0] - a[i - 1][0]) : 0));
  expect(Math.max(...jumps)).toBeGreaterThan(0.5);
});

test("perceptron: the lamp only snaps on after the wires thicken", () => {
  const { frames } = play("perceptron");
  const lampAt = frames.findIndex((f) => f.out.morph[2] > 0.5);
  const learnAt = frames.findIndex((f) => f.out.morph[0] > 0.9);
  const wrongAt = frames.findIndex((f) => f.out.morph[3] > 0.5);
  expect(wrongAt).toBeGreaterThan(0);
  expect(learnAt).toBeGreaterThan(wrongAt);
  expect(lampAt).toBeGreaterThan(learnAt);
});

test("diffusion model: the counter runs from 50 down to 0 and back", () => {
  const { rest, frames } = play("diffusion-model");
  const digits = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"]; // prettier-ignore
  const read = (tokens, from) => {
    const on = [0, 1, 2, 3, 4, 5, 6].filter((i) => tokens[from + i].visible).map((i) => "abcdefg"[i]).join(""); // prettier-ignore
    return on ? digits.indexOf(on) : 0;
  };
  const value = (out) => read(out.tokens, 0) * 10 + read(out.tokens, 7);
  expect(value(rest)).toBe(50);
  const seen = frames.map((f) => value(f.out));
  expect(Math.min(...seen)).toBe(0);
  for (let i = 1; i < seen.length; i++) if (frames[i].s < 3.5) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]); // prettier-ignore
  expect(seen[seen.length - 1]).toBe(50);
});

// The lane's screenshots (ai-*.png): toys in the middle of their taps, on a
// phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait] of [
  ["neural-network", "Neural network", 2900],
  ["diffusion-model", "Diffusion model", 2300],
  ["transformer", "Transformer", 2000],
]) {
  test(`${id} mid-tap screenshots at 390x844 and 1440x900`, async ({ browser }) => {
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
      await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
      await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__splashery.player.act(null));
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `ai-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}

test("word vectors: typed words work out A − B + C from the real vectors", async () => {
  const r = RECIPES["word-vectors"];
  const cases = [
    ["king - man + woman", "queen"],
    ["Paris minus France plus Italy", "rome"],
  ];
  for (const [typed, answer] of cases) {
    const o = await r.input.read(typed);
    const kit = build("word-vectors", o);
    expect(kit.data.words.answer, typed).toBe(answer);
  }
  await expect(r.input.read("king - man")).rejects.toThrow(/three words/);
  await expect(r.input.read("king - zzqx + woman")).rejects.toThrow(/not one of/);
  // A word it does not know in a saved link falls back to the default.
  expect(build("word-vectors", { a: "zzqx", b: "man", c: "woman" }).data.words.answer).toBe(
    "queen",
  );
});

test("neural network: any size in the options plays through and ends at rest", () => {
  for (const o of [
    { layers: 2, neurons: 3 },
    { layers: 3, neurons: 5, inputs: 4, outputs: 3 },
    { inputs: 2, outputs: 1, neurons: 2 },
    { layers: 2, neurons: 4, view: "model" },
  ]) {
    const { rest, frames, kit } = play("neural-network", o);
    const n = kit.data.sizes.reduce((a, b) => a + b, 0);
    expect(n, JSON.stringify(o)).toBeLessThanOrEqual(14);
    expect(kit.parts.length).toBeLessThanOrEqual(16);
    const last = frames[frames.length - 2].out;
    for (const [key, pd] of Object.entries(last.parts))
      expect(Math.abs((pd.visible ?? 1) * (pd.scale ?? 1) - (rest.parts[key]?.visible ?? 1) * (rest.parts[key]?.scale ?? 1))).toBeLessThan(0.05); // prettier-ignore
    for (const tk of last.tokens || []) expect(tk.visible ?? 1).toBe(0);
    expect(Math.abs(rest.morph[0])).toBeLessThan(0.05);
  }
});

test("transformer: both diagrams in both views play through and end at rest", () => {
  for (const diagram of ["tokens", "classic"])
    for (const view of ["poster", "model"]) {
      const { rest, frames } = play("transformer", { diagram, view });
      const last = frames[frames.length - 2].out;
      (last.tokens || []).forEach((tk, i) => {
        const q = rest.tokens?.[i];
        expect(Math.abs((tk.visible ?? 1) - (q?.visible ?? 1)), `${diagram} ${view} piece ${i}`).toBeLessThan(0.05); // prettier-ignore
      });
      // The classic diagram's packets really travel.
      if (diagram === "classic") {
        const mid = frames.find((f) => f.s >= 2.0).out;
        expect(mid.tokens[1].visible).toBe(1);
        expect(Math.hypot(...mid.tokens[1].offset)).toBeGreaterThan(0.3);
      }
    }
});

test("CNN: the drawable network reads typed samples and drawings with its trained weights", async () => {
  const r = RECIPES.cnn;
  // Every sample digit is read as itself.
  for (let d = 0; d < 10; d++) {
    const o = await r.input.read(String(d));
    expect(o.view).toBe("draw");
    expect(build("cnn", o).data.digit, `sample ${d}`).toBe(d);
  }
  // A drawing from the pad: a plain vertical stroke reads as a 1.
  const one = Array.from({ length: 64 }, (_, i) => (i % 8 === 3 || i % 8 === 4 ? 16 : 0));
  const o = await r.input.read(`pad:${one.join(",")}`);
  expect(build("cnn", o).data.digit).toBe(1);
  await expect(r.input.read(`pad:${new Array(64).fill(0).join(",")}`)).rejects.toThrow(/empty/);
  await expect(r.input.read("12")).rejects.toThrow(/single digit/);
  // A saved link with a broken drawing falls back to the sample 7.
  expect(build("cnn", { view: "draw", digit: "pad:1,2,3" }).data.digit).toBe(7);
});
