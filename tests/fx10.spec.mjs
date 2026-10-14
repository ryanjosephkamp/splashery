// Lane Fix10: the walkthrough's science fixes (October 9, 2026).

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { RECIPES } from "../src/packs/imaging.js";

async function build(r, options = {}, count = 40000) {
  const o = { ...Object.fromEntries((r.options || []).map((x) => [x.key, x.default])), ...options }; // prettier-ignore
  if (r.prepare) await r.prepare(o);
  const it = buildRecipe(r, { seed: 3, count, options: o }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { kit: b.value.kit, o };
}

test("the electron microscope zooms on the object a tap picks", async () => {
  const r = RECIPES["electron-microscope"];
  for (const [sample, count] of [
    ["pollen", 6],
    ["diatom", 2],
    ["snow", 1],
  ]) {
    const { kit } = await build(r, { sample });
    const { targets } = kit.data;
    expect(targets.length, sample).toBe(count);
    // A tap at each object's middle picks that object.
    targets.forEach((t, i) => expect(r.action.at([t.c[0], t.c[1], 0.3]).pick, sample).toBe(i));
    let n = 0;
    const tap = (pick) => {
      const out = { parts: {} };
      n++;
      r.drive(1, { zoom: 0 }, out, { time: 1, data: kit.data, tap: { n, pick } });
      return out.view;
    };
    r.drive(1, { zoom: 0 }, { parts: {} }, { time: 1, data: kit.data, tap: null });
    const last = targets.length - 1;
    // A new object starts its zoom; the same one steps on; the third tap goes out.
    const a = tap(last);
    expect(a.center).toEqual(targets[last].steps[0][0]);
    const b = tap(last);
    expect(b.center).toEqual(targets[last].steps[1][0]);
    expect(b.size[0]).toBeLessThan(a.size[0]);
    expect(tap(last).key).toBe("sem0");
    if (count > 1) {
      tap(0);
      const c = tap(1); // another object while zoomed in: its first step
      expect(c.center).toEqual(targets[1].steps[0][0]);
      expect(c.key).toBe("sem1t1");
    }
  }
});

test("the fruit MRI: a drag and the slider beat the sweep, and one drag covers every slice", async () => {
  const r = RECIPES["fruit-mri"];
  expect(r.turntable).toBe(false);
  expect(r.controls.find((c) => c.key === "play").pausable).toBe(false);
  expect(r.note).not.toMatch(/scroll/i);
  for (const fruit of ["kiwi", "orange"]) {
    const { kit } = await build(r, { fruit });
    const data = kit.data;
    const drive = (play, slider = null) => {
      const out = { parts: {} };
      r.drive(1, { play }, out, { time: 1, data, slider });
      return out;
    };
    const slice = (out) => Number(out.slider.id.split(" ")[1]);
    expect(slice(drive(0))).toBe(Math.round(0.5 * (data.S - 1)) + 1);
    // A sweep under way, then a drag: the drag takes over from the slice on show.
    drive(1);
    const mid = drive(0.5);
    const shown = slice(mid);
    r.drag.start([0, 0, 0]);
    expect(slice(drive(0.45))).toBe(shown);
    // One drag over the fruit's height runs through every slice.
    r.drag.move([0, -2 * data.across, 0]);
    expect(slice(drive(0.4))).toBe(1);
    r.drag.move([0, 2 * data.across, 0]);
    expect(slice(drive(0.35))).toBe(data.S);
    r.drag.end();
    // A new tap sweeps again; the slider then takes over.
    drive(1);
    expect(slice(drive(0.75))).not.toBe(data.S);
    const s = drive(0.7, { id: "slice 1", value: 0, n: 7 });
    expect(slice(s)).toBe(1);
    expect(slice(drive(0.6, { id: "slice 1", value: 0, n: 7 }))).toBe(1);
  }
});
