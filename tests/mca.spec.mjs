// Lane Machines A (machines that compute): the Turing machine, the
// difference engine, the Enigma machine and the Bombe. Each builds within
// its tier budget, follows its real rules on what is typed, moves only as
// solid pieces and ends its tap where it rests.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { PROFILES } from "../src/generators.js";
import { RECIPES, TURING, DIFFERENCE, ENIGMA, BOMBE } from "../src/packs/computing-history.js";

const IDS = ["turing-machine", "difference-engine", "enigma-machine", "bombe"];
const PLAN = JSON.parse(fs.readFileSync(new URL("../tools/toy-plan.json", import.meta.url), "utf8")).toys; // prettier-ignore

function build(id, options = {}, count = 6000) {
  const r = RECIPES[id];
  const opts = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
  Object.assign(opts, options);
  const it = buildRecipe(r, { seed: 5, count, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

// Plays taps frame by frame (30 fps), as the app does; returns every frame.
function play(id, kit, taps = 1) {
  const r = RECIPES[id];
  const ctl = r.controls.find((c) => c.key === r.action.key);
  const frames = [];
  let time = 1;
  const frame = (v, n) => {
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, { [ctl.key]: v }, out, { time, R: 1, tap: n ? { n } : null, data: kit.data });
    return out;
  };
  const rest0 = frame(0, 0);
  for (let n = 1; n <= taps; n++) {
    for (let s = 0; s < ctl.ease; s += 1 / 30) {
      time += 1 / 30;
      frames.push({ n, s, out: frame(Math.max(0.0004, 1 - s / ctl.ease), n) });
    }
    time += 1 / 30;
    frames.push({ n, s: ctl.ease, out: frame(0, n), rest: true });
  }
  return { rest0, frames };
}

test("the four toys: on the computing shelf, with sounds, help and plan entries", () => {
  for (const id of IDS) {
    const t = TOYS.find((x) => x.id === id);
    expect(t, id).toBeTruthy();
    expect(t.category).toBe("computing");
    expect(t.pack).toBe("computing-history");
    expect(t.labs, id).toBeFalsy();
    expect(TOY_SOUNDS[id], id).toBeTruthy();
    expect(TOY_HELP[id]?.about, id).toBeTruthy();
    expect(PLAN[id]?.v, id).toBe("keep");
    expect(fs.existsSync(`assets/toys/${id}/thumb.webp`), id).toBe(true);
  }
});

for (const id of IDS) {
  test(`${id}: builds within every tier's budget, with at most 15 parts`, () => {
    for (const tier of ["low", "high"]) {
      const count = PROFILES[tier].defaultCount;
      const t0 = performance.now();
      const kit = build(id, {}, count);
      const ms = performance.now() - t0;
      expect(kit.buf.count, `${id} ${tier}`).toBeLessThanOrEqual(PROFILES[tier].maxCount);
      expect(kit.buf.count, `${id} ${tier}`).toBeGreaterThan(count * 0.9);
      expect(kit.parts.length, id).toBeLessThanOrEqual(16);
      expect(ms, `${id} ${tier}: build time`).toBeLessThan(3000);
    }
  });

  test(`${id}: moves only as solid pieces and ends its taps where it rests`, () => {
    const kit = build(id);
    // No splat bends: nothing uses a morph, so every piece is rigid (parts
    // and tokens move whole; fade channels only show and hide letters).
    let bent = 0;
    for (let i = 0; i < kit.buf.count; i++) if (kit.buf.anim[i * 4 + 1] === KINDS.morph) bent++;
    expect(bent).toBe(0);
    const { frames } = play(id, kit, 2);
    const shown = (x) => (x?.visible ?? 1) * (x?.scale ?? 1);
    const bad = [];
    for (const f of frames) {
      if ((f.out.tokens || []).length > 48) bad.push(`${f.s}: too many pieces`);
      (f.out.tokens || []).forEach((tk, i) => {
        const q = tk?.quat || [0, 0, 0, 1];
        if (Math.abs(Math.hypot(...q) - 1) > 1e-6) bad.push(`${f.s}: piece ${i} turn is not a rotation`); // prettier-ignore
        if (![...(tk?.offset || []), ...q, tk?.visible ?? 1].every(Number.isFinite)) bad.push(`${f.s}: piece ${i} not finite`); // prettier-ignore
      });
    }
    expect(bad).toEqual([]);
    // Each tap's last moment matches the rest after it.
    for (const n of [1, 2]) {
      const mine = frames.filter((f) => f.n === n);
      const last = mine[mine.length - 2].out;
      const rest = mine[mine.length - 1].out;
      (last.tokens || []).forEach((tk, i) => {
        expect(Math.abs(shown(tk) - shown(rest.tokens[i])), `${id} piece ${i}`).toBeLessThan(0.05);
        const d = (tk?.offset || [0, 0, 0]).map((x, j) => x - (rest.tokens[i]?.offset?.[j] ?? 0));
        expect(Math.hypot(...d), `${id} piece ${i}`).toBeLessThan(0.03);
      });
      for (const [k, pd] of Object.entries(last.parts))
        expect(Math.abs(shown(pd) - shown(rest.parts[k])), `${id} part ${k}`).toBeLessThan(0.05);
    }
  });
}

test("Turing machine: the programs write the right tapes", () => {
  const { PROGRAMS, run, tape } = TURING;
  const ones = (t) => Object.values(t).filter((b) => b).length;
  const read = (t, from, to) => Array.from({ length: to - from + 1 }, (_, i) => t[from + i] || 0).join(""); // prettier-ignore
  // Add one: the carry ripples left.
  const r1 = run(PROGRAMS.add, tape("1011"));
  expect(read(r1.tape, -3, 0)).toBe("1100");
  expect(r1.steps.length).toBe(3);
  expect(r1.halted).toBe(true);
  expect(read(run(PROGRAMS.add, tape("111")).tape, -3, 0)).toBe("1000");
  for (let n = 0; n < 64; n++) {
    const bits = n.toString(2);
    const out = run(PROGRAMS.add, tape(bits)).tape;
    expect(parseInt(read(out, -8, 0), 2), bits).toBe(n + 1);
  }
  // The busy beavers: four 1s in 6 steps, and six 1s in 13.
  const b2 = run(PROGRAMS.bb2, {});
  expect([b2.halted, b2.steps.length, ones(b2.tape)]).toEqual([true, 6, 4]);
  const b3 = run(PROGRAMS.bb3, {});
  expect([b3.halted, b3.steps.length, ones(b3.tape)]).toEqual([true, 13, 6]);
  // Typed numbers.
  expect(TURING.readBits("1011")).toBe("1011");
  expect(TURING.readBits("11")).toBe("11");
  expect(TURING.readBits("12")).toBe("1100");
  expect(() => TURING.readBits("1021x")).toThrow();
  expect(() => TURING.readBits("1".repeat(13))).toThrow();
});

test("Turing machine: each tap of Add one adds one more (it counts up)", () => {
  const kit = build("turing-machine", { program: "add", bits: "1011" });
  play("turing-machine", kit, 3);
  const t = kit.data.tape;
  const value = parseInt(Array.from({ length: 5 }, (_, i) => t[i - 4] || 0).join(""), 2);
  expect(value).toBe(14);
});

test("difference engine: every turn gives the polynomial's next value", () => {
  for (const [eq, start] of [
    ["x^2", 1],
    ["x³", 0],
    ["2x^3 - x + 5", 3],
    ["n(n+1)/2", 1],
    ["x^3 - 10x", 0],
  ]) {
    const { f } = DIFFERENCE.read(eq, start);
    let st = DIFFERENCE.setup(f, start);
    for (let i = 0; i < 12; i++) {
      expect(st.v, `${eq} at x = ${start + i}`).toBe((((Math.round(f(start + i)) % 1e5) + 1e5) % 1e5)); // prettier-ignore
      expect(st.x).toBe(start + i);
      st = DIFFERENCE.turn(st).next;
    }
  }
  expect(() => DIFFERENCE.read("x^4", 1)).toThrow(/x³/);
  expect(() => DIFFERENCE.read("x/2", 1)).toThrow(/whole/);
});

test("difference engine: three taps turn n² to 16, the wheels showing it", () => {
  const kit = build("difference-engine");
  const { frames } = play("difference-engine", kit, 1);
  expect(kit.data.st.v).toBe(4);
  // Three quick taps queue three turns.
  const r = RECIPES["difference-engine"];
  let time = 100;
  const out = () => ({ parts: {}, cues: [], tokens: null });
  for (let n = 0; n < 3; n++) {
    time += 0.05;
    r.drive(0, { go: 1 }, out(), { time, data: kit.data });
    time += 0.05;
    r.drive(0, { go: 0.99 }, out(), { time, data: kit.data });
  }
  for (let s = 0; s < 14; s += 0.05) {
    time += 0.05;
    r.drive(0, { go: Math.max(0.001, 0.98 - s / 12) }, out(), { time, data: kit.data });
  }
  expect(kit.data.st.v).toBe(25);
  expect(kit.data.st.x).toBe(5);
  // The value column's wheels (units at the bottom) read 00025 at rest.
  const o = out();
  r.drive(0, { go: 0 }, o, { time: time + 0.05, data: kit.data });
  const col = DIFFERENCE.DE.cols.find((c) => c.id === "v");
  const digits = [];
  for (let j = 0; j < 5; j++) {
    const q = o.tokens[col.token + j].quat;
    const turns = (2 * Math.atan2(q[1], q[3])) / (2 * Math.PI);
    digits.push(Math.round(((turns * 10) % 10) + 10) % 10);
  }
  expect(digits.reverse().join("")).toBe("00025");
  expect(frames.length).toBeGreaterThan(0);
});

test("Enigma machine: known test vectors, the double step, and decoding", () => {
  const { machine, AZ } = ENIGMA;
  const bare = machine({ plugs: "" });
  const type = (m, text, pos) =>
    m
      .type(text, pos)
      .map((e) => AZ[e.lamp])
      .join("");
  // Rotors I-II-III, reflector B, rings and start at AAA: AAAAA gives BDZGO.
  expect(type(bare, "AAAAA", [0, 0, 0])).toBe("BDZGO");
  // The double step: from ADU the rotors show ADV, AEW, then BFX.
  let p = [0, 3, 20];
  const seen = [];
  for (let i = 0; i < 3; i++) {
    p = bare.step(p);
    seen.push(p.map((x) => AZ[x]).join(""));
  }
  expect(seen).toEqual(["ADV", "AEW", "BFX"]);
  // A letter never comes out as itself, and typing the code back decodes it.
  const m = machine();
  const coded = type(m, "WEATHERREPORTHELLO", [3, 11, 24]);
  for (let i = 0; i < coded.length; i++) expect(coded[i]).not.toBe("WEATHERREPORTHELLO"[i]);
  expect(type(m, coded, [3, 11, 24])).toBe("WEATHERREPORTHELLO");
  expect(ENIGMA.clean("Hello, world!")).toBe("HELLOWORLD");
});

test("Enigma machine: the first tap codes the message, the second decodes it", () => {
  const kit = build("enigma-machine", { message: "HELLO" });
  expect(kit.data.coded).toBe("ILBDT");
  const { frames } = play("enigma-machine", kit, 2);
  const restAfter = (n) => frames.filter((f) => f.n === n && f.rest)[0].out;
  expect(restAfter(1).morph.slice(0, 2)).toEqual([1, 0]);
  expect(restAfter(2).morph.slice(0, 2)).toEqual([1, 1]);
  // The keys pressed on the first tap spell the message, one at a time.
  const pressed = [];
  let was = -1;
  for (const f of frames.filter((x) => x.n === 1)) {
    const down = (f.out.tokens || []).findIndex((t, i) => i < 26 && t.offset[1] < -0.01);
    if (down >= 0 && down !== was) pressed.push(down);
    was = down;
  }
  expect(pressed.map((i) => ENIGMA.AZ[i]).join("")).toBe("HELLO");
});

test("Bombe: the search stops on a setting that decodes the whole message", () => {
  for (const msg of ["WEATHERREPORT", "ATTACKATDAWN", "HELLOFROMBLETCHLEY"]) {
    const cs = BOMBE.crack(msg);
    expect(cs.found, msg).toBeTruthy();
    expect(cs.plain).toBe(msg);
    // The crib fits at the setting found, and at no earlier one.
    const m = ENIGMA.machine();
    const fits = (pos) => m.type(cs.crib, pos).every((e, j) => ENIGMA.AZ[e.lamp] === cs.coded[j]);
    expect(fits(cs.found.pos)).toBe(true);
    for (let i = 0; i < cs.found.i; i += 37)
      expect(fits([Math.floor(i / 676), Math.floor(i / 26) % 26, i % 26])).toBe(false);
  }
});

// The lane's screenshots (mca-*.png): each toy in the middle of its tap, on
// a phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const [id, label, wait] of [
  ["turing-machine", "Turing machine", 1500],
  ["difference-engine", "Difference engine", 1300],
  ["enigma-machine", "Enigma machine", 1600],
  ["bombe", "Bombe", 5600],
]) {
  test(`${id} mid-tap screenshots at 390x844 and 1440x900`, async ({ browser }) => {
    test.setTimeout(240_000);
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
      await page.screenshot({ path: path.join(SHOTS, `mca-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}
