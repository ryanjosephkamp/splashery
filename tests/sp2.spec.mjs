// Lane Space r2: the real worlds. The maps are checked against what they
// should show (each named feature is where the USGS Gazetteer of Planetary
// Nomenclature, or for Earth a survey, puts it, and as high or as deep as
// the literature says), the build against its map, the fly against the
// feature it flies to, and the browser for loading only when a world opens.

import { test, expect } from "@playwright/test";
import { WORLDS } from "../src/space/worlds.js";
import { loadWorld } from "../src/space/maps.js";
import {
  packNormal,
  unpackNormal,
  packExtra,
  unpackExtra,
  worldQuat,
  worldModifier,
} from "../src/space/field.js";
import { RECIPES, dirOf } from "../src/packs/space-r2.js";
import { buildRecipe, quatRotate } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { TOY_HELP } from "../src/toy-help.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const DEG = Math.PI / 180;

async function build(id, count, options = {}) {
  const recipe = RECIPES[id];
  const o = resolveOptions(recipe, options);
  if (recipe.prepare) await recipe.prepare(o);
  const it = buildRecipe(recipe, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Great-circle distance in km.
function km(world, lat1, lon1, lat2, lon2) {
  const a = dirOf(lat1, lon1);
  const b = dirOf(lat2, lon2);
  const d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  return d * world.radiusKm;
}

// The highest (or lowest) point of the map within r km of a feature.
function extreme(W, f, rKm, sign) {
  const def = W.def;
  const step = (0.02 * (rKm / def.radiusKm)) / DEG;
  let best = { v: -Infinity };
  const span = rKm / def.radiusKm / DEG;
  for (let la = f.lat - span; la <= f.lat + span; la += step)
    for (
      let lo = f.lon - span / Math.cos(f.lat * DEG);
      lo <= f.lon + span / Math.cos(f.lat * DEG);
      lo += step / Math.cos(f.lat * DEG)
    ) {
      if (km(def, la, lo, f.lat, f.lon) > rKm) continue;
      const v = sign * W.height(la, lo);
      if (v > best.v) best = { v, lat: la, lon: lo };
    }
  return { h: sign * best.v, lat: best.lat, lon: best.lon };
}

// What each feature should look like on its world's map. A peak: its
// highest point within `near` km of the listed center, at least `min`
// meters up (sources in docs/evidence/real-<world>.json). A bowl: its
// floor at least `depth` meters below its rim (the ring at 0.9 to 1.1 of
// its radius).
const EXPECT = {
  "moon/tycho": { bowl: 3500 },
  "moon/copernicus": { bowl: 3000 },
  // MOLA: 21,287 m; the map averages the summit over cells about 1.6 km wide.
  "mars/olympus-mons": { peak: 20500, near: 60 },
  "mars/valles-marineris": { below: -4000 },
  // Gale's central mound (Aeolis Mons) rises from its floor.
  "mars/gale": { mound: 4000, near: 40 },
  "mercury/caloris": { below: 0 },
  "mercury/rachmaninoff": { bowl: 2000 },
  "venus/maxwell-montes": { peak: 10000, near: 300 },
  "venus/maat-mons": { peak: 7500, near: 120 },
  // 8,849 m; ETOPO 2022 at 15 arc-seconds averages the summit over cells about 450 m wide.
  "earth/everest": { peak: 8000, near: 15 },
  // "A depth of over a mile": from the river to the highest rim within 14 km.
  "earth/grand-canyon": { mound: 1400, near: 14 },
  "earth/hawaii": { peak: 4000, near: 50 },
};

test.describe("lane Space r2: real worlds", () => {
  test("the toys are labs kit toys of the space shelf, with sounds and help", () => {
    for (const id of Object.keys(RECIPES)) {
      const t = TOYS.find((x) => x.id === id);
      expect(t, id).toBeTruthy();
      expect(t.labs).toBe(true);
      expect(t.pack).toBe("space-r2");
      expect(t.category).toBe("space");
      expect(TOY_SOUNDS[id], id).toBeTruthy();
      expect(TOY_HELP[id]?.howTo, id).toBeTruthy();
    }
  });

  test("normals, heights and the turn pack and unpack", () => {
    for (const n of [
      [0, 0, 1],
      [0, 0, -1],
      [1, 0, 0],
      [0.3, -0.8, 0.52],
      [-0.6, 0.1, -0.79],
    ]) {
      // prettier-ignore
      const l = Math.hypot(...n);
      const u = n.map((v) => v / l);
      const back = unpackNormal(packNormal(u));
      expect(Math.acos(Math.min(1, u[0] * back[0] + u[1] * back[1] + u[2] * back[2]))).toBeLessThan(0.003); // prettier-ignore
    }
    for (const [h, e] of [
      [0, 0],
      [-32000, 255],
      [31999, 17],
      [-5, 1],
    ]) {
      // prettier-ignore
      const w = packExtra(h, e);
      expect(Math.fround(w)).toBe(w); // exact in a float32
      expect(unpackExtra(w)).toEqual({ steps: h, extra: e });
    }
    // The turn that a fly sets brings the feature to face the viewer (+z).
    for (const [lat, lon] of [
      [18.65, -133.8],
      [-43.3, -11.22],
      [65.2, 3.3],
    ]) {
      // prettier-ignore
      const q = worldQuat(-lon * DEG, lat * DEG);
      const v = quatRotate(q, dirOf(lat, lon));
      expect(v[2]).toBeGreaterThan(0.99999);
    }
    const m = worldModifier({ hstep: 1e-5 });
    expect(m.glsl).toContain("modifySplatColor");
    expect(m.wgsl).toContain("modifySplatColor");
  });

  for (const world of WORLDS) {
    test(`${world.name}: the maps load and each feature is where the map says`, async () => {
      const W = await loadWorld(world.id);
      expect(W.patches.length).toBe(world.features.filter((f) => f.patch).length);
      for (const f of world.features) {
        const e = EXPECT[`${world.id}/${f.id}`];
        if (!e) continue;
        const at = W.height(f.lat, f.lon);
        if (e.peak) {
          const p = extreme(W, f, e.near, 1);
          expect(p.h, `${f.id} height`).toBeGreaterThan(e.peak);
          expect(km(world, p.lat, p.lon, f.lat, f.lon), `${f.id} place`).toBeLessThan(e.near);
        }
        if (e.mound) {
          const top = extreme(W, f, e.near, 1);
          const floor = extreme(W, f, f.km / 2, -1);
          expect(top.h - floor.h, `${f.id} mound`).toBeGreaterThan(e.mound);
        }
        if (e.bowl) {
          const rim = ring(W, f, 1);
          const rimMean = rim.reduce((a, b) => a + b, 0) / rim.length;
          expect(rimMean - at, `${f.id} depth`).toBeGreaterThan(e.bowl);
        }
        if (e.below !== undefined) expect(at, `${f.id} below`).toBeLessThan(e.below);
      }
    });
  }

  test("each world builds with its relief, and a tap flies to the feature on the map", async () => {
    test.setTimeout(240_000);
    for (const id of Object.keys(RECIPES)) {
      const ctx = await build(id, 60000, { relief: "1" });
      const buf = ctx.buf;
      const s = ctx.transform.scale;
      // Splats of ground lie at the map's height: the radius varies.
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < buf.count; i++) {
        if (Math.round(buf.anim[i * 4] / 16) !== 0) continue;
        const r = Math.hypot(buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]) / s;
        lo = Math.min(lo, r);
        hi = Math.max(hi, r);
      }
      const def = RECIPES[id];
      expect(hi - lo, id).toBeGreaterThan(0.001);
      // The drive's fly: each tap the next feature, turned to face the viewer.
      const features = ctx.kit.data.features;
      expect(features.length).toBeGreaterThan(0);
      const c = { sun: 0.33, fly: 0 };
      const info = { data: ctx.kit.data };
      const frame = (t) => {
        const out = { parts: {}, cues: [], glow: [0, 0, 0, 0], amount: 1 };
        def.drive(t, c, out, info);
        return out;
      };
      frame(0);
      for (let k = 0; k < features.length; k++) {
        const f = features[k];
        c.fly = 1;
        frame(0.1 + k * 20);
        // Halfway through the fly (the pulse falls from 1 to 0).
        c.fly = 0.5;
        const out = frame(5 + k * 20);
        const [spin, tilt] = out.morph;
        const v = quatRotate(worldQuat(spin, tilt), dirOf(f.lat, f.lon));
        expect(v[2], `${id} ${f.id}`).toBeGreaterThan(Math.cos(0.5 * DEG));
        expect(out.view.center).toEqual([0, 0, f.r]);
        expect(out.press).toBeGreaterThanOrEqual(k);
        c.fly = 0;
        frame(10 + k * 20);
      }
    }
  });

  test("nothing of the real worlds loads before one opens; each then builds", async ({ page }) => {
    test.setTimeout(400_000);
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const ours = (u) => /real-worlds|space-r2|src\/space\//.test(u) && !/thumb/.test(u);
    expect(requests.filter(ours)).toEqual([]);
    for (const id of Object.keys(RECIPES)) {
      await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
      await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id && window.__splashery.player.proc?.ctx?.kit?.data?.features?.length > 0, id, { timeout: 120_000 }); // prettier-ignore
      const world = id.replace(/^real-/, "");
      expect(requests.some((u) => u.includes(`real-worlds/${world}-color.jpg`))).toBe(true);
      // The colors decoded in the browser are real colors, not gaps.
      const ok = await page.evaluate(() => {
        const b = window.__splashery.player.proc.ctx.buf;
        let bad = 0;
        for (let i = 0; i < b.count * 4; i++) if (!Number.isFinite(b.color[i])) bad++;
        return bad;
      });
      expect(ok).toBe(0);
      // The tap starts a fly.
      await page.evaluate(() => window.__splashery.app.act());
      await page.waitForFunction(() => window.__splashery.player.motion.out?.view?.center, null, { timeout: 30_000 }); // prettier-ignore
    }
    expect(errors).toEqual([]);
  });

  for (const [id, name] of [
    ["real-mars", "mars"],
    ["real-moon", "moon"],
  ])
    test(`screenshots of ${id} at phone and desktop size`, async ({ browser }) => {
      test.setTimeout(360_000);
      for (const [w, h] of [
        [390, 844],
        [1440, 900],
      ]) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(APP);
        await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
        await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
        await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id && window.__splashery.player.proc?.ctx?.kit?.data, id, { timeout: 120_000 }); // prettier-ignore
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `tests/screenshots/sp2-${name}-${w}x${h}.png` });
        await page.close();
      }
    });
});

// The heights round a feature at `f` times its radius (its listed size).
function ring(W, f, frac) {
  const def = W.def;
  const r = ((f.km / 2) * frac) / def.radiusKm;
  const out = [];
  const c = dirOf(f.lat, f.lon);
  const east = [Math.cos(f.lon * DEG), 0, -Math.sin(f.lon * DEG)];
  const north = [c[1] * east[2] - c[2] * east[1], c[2] * east[0] - c[0] * east[2], c[0] * east[1] - c[1] * east[0]]; // prettier-ignore
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const v = [0, 1, 2].map((i) => c[i] * Math.cos(r) + Math.sin(r) * (Math.cos(a) * east[i] + Math.sin(a) * north[i])); // prettier-ignore
    out.push(W.height(Math.asin(v[1]) / DEG, Math.atan2(v[0], v[2]) / DEG));
  }
  return out;
}
