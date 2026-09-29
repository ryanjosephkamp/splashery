// Lane Real objects: everyday things made from real 3D models (docs/handoff/RealObjects.md).
// Each toy builds within its tier's budget from its baked model, every tap moves the model's
// pieces as solid parts (turned and moved, never scaled or bent), and it ends where it rests.

import { test, expect } from "@playwright/test";
import { RECIPES, decodeSplats } from "../src/packs/real-objects.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { TOYS } from "../src/toys.js";
import { KINDS } from "../src/effects.js";
import fs from "node:fs";

const IDS = ["fountain-pen", "water-bottle", "soda-can", "running-shoe", "hoodie", "sunglasses", "baseball-cap"]; // prettier-ignore
const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function build(id, count) {
  const recipe = RECIPES[id];
  const options = resolveOptions(recipe, {});
  await recipe.prepare?.(options);
  const it = buildRecipe(recipe, { seed: 1, count, options }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// The tap's pulse: its control goes from 1 back to 0 over `ease` seconds.
function driveAt(recipe, ctx, value) {
  const key = recipe.action.key;
  const c = {};
  for (const ctl of recipe.controls) c[ctl.key] = ctl.key === key ? value : 0;
  const out = { parts: {} };
  recipe.drive(0, c, out, { data: ctx.kit.data });
  return out;
}

test.describe("Real objects", () => {
  test("each toy is on its shelf, with its baked model in place", () => {
    for (const id of IDS) {
      const def = TOYS.find((t) => t.id === id);
      expect(def, id).toBeTruthy();
      expect(def.pack).toBe("real-objects");
      expect(["objects", "clothing"]).toContain(def.category);
      const scan = decodeSplats(new Uint8Array(fs.readFileSync(`assets/toys/${id}/${id}.splats`)));
      expect(scan.n).toBeGreaterThan(80000);
      let bad = 0;
      for (let i = 0; i < scan.n * 3; i++) if (!Number.isFinite(scan.pos[i])) bad++;
      expect(bad).toBe(0);
    }
  });

  test("each toy builds within every tier's budget", async () => {
    for (const id of IDS) {
      for (const tier of ["low", "mid", "high", "max"]) {
        const P = PROFILES[tier];
        const count = Math.round(Math.min(P.maxCount, P.defaultCount * (RECIPES[id].density ?? 1)));
        const ctx = await build(id, count);
        expect(ctx.buf.count, `${id} at ${tier}`).toBeLessThanOrEqual(count * 1.02);
        expect(ctx.buf.count, `${id} at ${tier}`).toBeGreaterThan(Math.min(count * 0.5, 100000));
        let bad = 0;
        for (let i = 0; i < ctx.buf.count * 3; i++) if (!Number.isFinite(ctx.buf.pos[i])) bad++;
        expect(bad).toBe(0);
      }
    }
  });

  test("taps move the model's pieces as solid parts and end at rest", async () => {
    for (const id of IDS) {
      const recipe = RECIPES[id];
      const ctx = await build(id, PROFILES.mid.defaultCount);
      // The model's splats: no behaviour that bends or moves them one by one.
      const item = ctx.kit.data.scanItem;
      expect(item.end - item.start).toBeGreaterThan(40000);
      const partsUsed = new Set();
      let moving = 0;
      for (let i = item.start; i < item.end; i++) {
        if (ctx.buf.anim[i * 4 + 1] !== (KINDS.none ?? 0)) moving++;
        partsUsed.add(Math.round(ctx.buf.anim[i * 4]) & 15);
      }
      expect(moving, `${id}: model splats with a behaviour`).toBe(0);
      // Every part the model's splats ride on is only turned and moved, never scaled or hidden.
      const ease = recipe.controls.find((c) => c.key === recipe.action.key).ease;
      let moved = 0;
      for (let f = 0; f <= 1.0001; f += 1 / 120) {
        const out = driveAt(recipe, ctx, 1 - f);
        for (const [name, pd] of Object.entries(out.parts)) {
          const idx = ctx.parts.findIndex((p) => p.name === name);
          expect(idx, `${id}: ${name}`).toBeGreaterThanOrEqual(0);
          if (!partsUsed.has(idx)) continue;
          expect(pd.scale ?? 1, `${id}: ${name} scale`).toBe(1);
          expect(pd.visible ?? 1, `${id}: ${name} visible`).toBe(1);
          if (pd.quat) expect(Math.hypot(...pd.quat)).toBeCloseTo(1, 5);
          const off = pd.offset ? Math.hypot(...pd.offset) : 0;
          const ang = pd.quat ? 2 * Math.acos(Math.min(1, Math.abs(pd.quat[3]))) : Math.abs(pd.angle ?? 0); // prettier-ignore
          if (off > 0.02 || ang > 0.05) moved++;
          for (const v of [...(pd.quat || []), ...(pd.offset || []), pd.angle ?? 0])
            expect(Number.isFinite(v)).toBe(true);
        }
      }
      expect(moved, `${id} moves a part`).toBeGreaterThan(10);
      // The last moment of the tap is the rest pose (and the channels are back at 0).
      const end = driveAt(recipe, ctx, 1e-6);
      const rest = driveAt(recipe, ctx, 0);
      for (const [name, pd] of Object.entries(end.parts)) {
        const r = rest.parts[name] || {};
        for (const k of ["offset", "quat"])
          if (pd[k]) pd[k].forEach((v, j) => expect(v, `${id} ${name}`).toBeCloseTo(r[k]?.[j] ?? (k === "quat" && j === 3 ? 1 : 0), 2)); // prettier-ignore
        if (pd.angle !== undefined) expect(pd.angle).toBeCloseTo(r.angle ?? 0, 2);
      }
      for (const m of end.morph || []) expect(Math.abs(m)).toBeLessThan(0.01);
      for (const t of end.tokens || []) expect(t.visible ?? 0).toBeLessThan(0.01);
    }
  });

  test("each toy opens and plays its tap in the app, with screenshots", async ({ browser }) => {
    test.setTimeout(300_000);
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      for (const id of IDS) {
        await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
        await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id && window.__splashery.player.proc?.ctx?.buf?.count > 50000, id, { timeout: 90_000 }); // prettier-ignore
        await page.waitForTimeout(700);
        await page.screenshot({ path: `tests/screenshots/ro-${id}-${w}x${h}.png` });
        await page.evaluate(() => window.__splashery.player.act(null));
        await page.waitForTimeout(400);
      }
      expect(errors).toEqual([]);
      await page.close();
    }
  });
});
