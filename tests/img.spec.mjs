// Lane Imaging: the Imaging shelf's toys (src/packs/imaging.js). The engine's
// volume kind has its own test (tests/img-engine.spec.mjs).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { RECIPES, xrayColor, WALNUT, CUTS } from "../src/packs/imaging.js";

const IDS = [
  "airport-xray",
  "how-ct",
  "walnut-ct",
  "fruit-mri",
  "electron-microscope",
  "thermal-camera",
];
const PLAN = JSON.parse(fs.readFileSync(new URL("../tools/toy-plan.json", import.meta.url), "utf8")).toys; // prettier-ignore

async function build(id, options = {}, count = 40000) {
  const r = RECIPES[id];
  const o = { ...Object.fromEntries((r.options || []).map((x) => [x.key, x.default])), ...options }; // prettier-ignore
  if (r.prepare) await r.prepare(o);
  const it = buildRecipe(r, { seed: 3, count, options: o }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit, o };
}

test("the Imaging shelf: labs toys after Science, each with a sound, help and a plan entry", () => {
  const ids = CATEGORIES.map((c) => c.id);
  expect(ids.indexOf("imaging")).toBe(ids.indexOf("science") + 1);
  for (const id of IDS) {
    const t = TOYS.find((x) => x.id === id);
    expect(t, id).toBeTruthy();
    expect(t.category).toBe("imaging");
    expect(t.pack).toBe("imaging");
    expect(t.labs).toBe(true);
    expect(TOY_SOUNDS[id], id).toBeTruthy();
    expect(TOY_HELP[id]?.howTo, id).toBeTruthy();
    expect(PLAN[id]?.v, id).toBe("keep");
  }
});

test("the X-ray colors: organic orange, metal blue, dense black", () => {
  const hue = ([r, g, b]) => ({ r, g, b });
  const org = hue(xrayColor([0.8, 0, 0]));
  const met = hue(xrayColor([0, 0, 0.8]));
  const ino = hue(xrayColor([0, 0.8, 0]));
  const dense = xrayColor([0, 0, 6]);
  expect(org.r).toBeGreaterThan(org.b + 0.3);
  expect(met.b).toBeGreaterThan(met.r + 0.2);
  expect(ino.g).toBeGreaterThan(Math.max(ino.r, ino.b));
  expect(Math.max(...dense)).toBeLessThan(0.25);
  expect(Math.min(...xrayColor([0, 0, 0]))).toBeGreaterThan(0.85);
});

test("the walnut's volume loads from its file and fits the splat budget", async () => {
  const gz = fs.statSync(new URL("../assets/toys/walnut-ct/walnut.vol.gz", import.meta.url));
  expect(gz.size).toBeLessThan(1024 * 1024);
  for (const count of [60000, 140000]) {
    const { kit } = await build("walnut-ct", {}, count);
    const { anim, count: n } = kit.buf;
    expect(n).toBeGreaterThan(count * 0.6);
    expect(n).toBeLessThan(count * 1.15);
    // Every splat is a volume splat, with the shell's densities and the
    // kernel's (lower) both present.
    let shell = 0;
    let kernel = 0;
    let other = 0;
    for (let i = 0; i < n; i++) {
      if (anim[i * 4 + 1] !== KINDS.volume) other++;
      const d = anim[i * 4 + 2];
      if (d > WALNUT.shell) shell++;
      else if (d > 0.35) kernel++;
    }
    expect(other).toBe(0);
    expect(shell).toBeGreaterThan(n * 0.1);
    expect(kernel).toBeGreaterThan(n * 0.2);
  }
  expect(RECIPES["walnut-ct"].credits[0].license).toBe("CC BY 4.0");
});

test("the walnut's tap and drag set the window and the cut", async () => {
  const { r, kit } = await build("walnut-ct");
  const frame = (dense, at) => {
    CUTS["walnut-ct"].at = at;
    const out = { parts: {} };
    r.drive(1, { dense }, out, { time: 1, data: kit.data });
    CUTS["walnut-ct"].at = at; // (the first drive of a build resets it)
    r.drive(1, { dense }, out, { time: 1, data: kit.data });
    return out.volume;
  };
  const whole = frame(0, 1);
  expect(whole.normal).toBeUndefined();
  expect(whole.window[0]).toBeLessThan(0.3);
  const shell = frame(1, 1);
  expect(shell.window[0]).toBeCloseTo(WALNUT.shell, 3);
  const cut = frame(0, 0.5);
  expect(cut.normal).toEqual([0, 0, 1]);
  expect(Math.abs(cut.at)).toBeLessThan(2);
});

test("the fruit MRI: one slab at a time, the kiwi's seeds dark in bright locules", async () => {
  for (const fruit of ["kiwi", "orange"]) {
    const { r, kit } = await build("fruit-mri", { fruit });
    const { anim, pos, count: n } = kit.buf;
    let dark = 0;
    let bright = 0;
    for (let i = 0; i < n; i++) {
      if (anim[i * 4 + 1] !== KINDS.volume) continue;
      if (anim[i * 4 + 2] < 0.2) dark++;
      if (anim[i * 4 + 2] > 0.7) bright++;
    }
    expect(dark, fruit).toBeGreaterThan(200);
    expect(bright, fruit).toBeGreaterThan(n * 0.1);
    const out = { parts: {} };
    r.drive(1, { play: 0 }, out, { time: 1, data: kit.data });
    expect(out.volume.slab).toBeGreaterThan(0);
    expect(out.volume.normal).toEqual([0, 0, 1]);
    expect(pos.length).toBeGreaterThan(0);
  }
});

test("the electron microscope's taps step through three zoom views", async () => {
  for (const sample of ["pollen", "diatom", "snow"]) {
    const { r, kit } = await build("electron-microscope", { sample });
    const keys = [0, 1, 2, 3].map((n) => {
      const out = { parts: {} };
      r.drive(1, { zoom: 0 }, out, { time: 1, data: kit.data, tap: n ? { n } : null });
      return out.view;
    });
    expect(keys.map((v) => v.key)).toEqual(["sem0", "sem1", "sem2", "sem0"]);
    expect(keys[1].size[0]).toBeGreaterThan(keys[2].size[0]);
  }
});

test("the thermal camera crossfades to false colors and the tea cools", async () => {
  const { r, kit } = await build("thermal-camera");
  const at = (t, thermal) => {
    const out = { parts: {} };
    r.drive(t, { thermal }, out, { time: t, data: kit.data });
    return out.morph;
  };
  expect(at(0, 0)).toEqual([0, 0, 0, 0]);
  const start = at(1, 1);
  expect(start[0]).toBeCloseTo(1, 3);
  expect(start[1]).toBeGreaterThan(0.9); // hot tea
  const later = at(40, 1);
  expect(later[3]).toBeGreaterThan(0.9); // cooled
  at(41, 0);
});
