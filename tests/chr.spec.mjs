// Lane Character: the detailed person for Worlds (docs/handoff/Character.md,
// docs/WORLDS.md "The character"). Every part is rigid, the joints stay
// closed through a walk and a run, planted feet don't slide, a world
// file's colors apply, each tier's budget holds, and the renderer turns the
// joints the way the rig's math says.

import { test, expect } from "@playwright/test";
import { buildCharacter, pose, stepGait, solve, place, restPivots, JOINTS, BODY, CHARACTER_SPLATS } from "../src/worlds/character.js"; // prettier-ignore
import { WORLD_BUDGETS } from "../src/worlds/tiers.js";
import { normalizeWorld } from "../src/worlds/world-file.js";

const LOOK = normalizeWorld({}).character;
const rest = restPivots();
let parts = null;
const built = () => (parts ||= buildCharacter(LOOK, { count: CHARACTER_SPLATS.mid, seed: 5 }));

// A part's splat i in the character's rest space.
const restPoint = (buf, name, i) => [
  buf.pos[i * 3] + rest[name][0],
  buf.pos[i * 3 + 1] + rest[name][1],
  buf.pos[i * 3 + 2] + rest[name][2],
];

// Poses through a walk and a run (and standing), as the Worlds page steps
// them.
function cycle(speed, n = 24) {
  const st = { speed, phase: 0 };
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(pose({ ...st }, i * 0.4));
    stepGait(st, speed, 1 / n / (speed / 1.4 || 1));
  }
  return out;
}
const POSES = [...cycle(0, 6), ...cycle(1.9), ...cycle(4.6)];
POSES.forEach((p, i) => (p.speed = i < 6 ? 0 : i < 30 ? 1.9 : 4.6));

// The joints between two parts, and about how deep under the surface
// each pivot lies.
const SEAMS = [
  { joint: "torso", a: "hips", b: "torso", r: 0.1 },
  { joint: "chest", a: "torso", b: "chest", r: 0.1 },
  { joint: "neck", a: "chest", b: "neck", r: 0.042 },
  { joint: "head", a: "neck", b: "head", r: 0.042 },
  ...["L", "R"].flatMap((s) => [
    { joint: `arm${s}`, a: "chest", b: `arm${s}`, r: 0.03 },
    { joint: `fore${s}`, a: `arm${s}`, b: `fore${s}`, r: 0.035 },
    { joint: `hand${s}`, a: `fore${s}`, b: `hand${s}`, r: 0.017 },
    { joint: `thigh${s}`, a: "hips", b: `thigh${s}`, r: 0.07 },
    { joint: `shin${s}`, a: `thigh${s}`, b: `shin${s}`, r: 0.05 },
    { joint: `foot${s}`, a: `shin${s}`, b: `foot${s}`, r: 0.028 },
  ]),
];

test.describe("character", () => {
  test("the build has every joint's part, and it is sharp: opaque, flat splats", () => {
    const p = built();
    for (const j of JOINTS) {
      expect(p[j.name], j.name).toBeTruthy();
      expect(p[j.name].count, j.name).toBeGreaterThan(150);
      const b = p[j.name];
      let thin = 0;
      for (let i = 0; i < b.count; i++) {
        expect(b.color[i * 4 + 3]).toBe(1);
        const s = [b.scale[i * 3], b.scale[i * 3 + 1], b.scale[i * 3 + 2]].sort((x, y) => x - y);
        if (s[0] < s[2] * 0.45) thin++;
      }
      // Flat splats on the surfaces (the kit's `flat`).
      expect(thin / b.count, j.name).toBeGreaterThan(0.95);
    }
  });

  test("each part is rigid: its splats keep their distances as it moves", () => {
    const p = built();
    const a = solve(POSES[10]);
    const b = solve(POSES[40]);
    for (const j of JOINTS) {
      const buf = p[j.name];
      const idx = Array.from({ length: 30 }, (_, k) => Math.floor((k * buf.count) / 30));
      const pa = idx.map((i) => place(a, rest, j.name, restPoint(buf, j.name, i)));
      const pb = idx.map((i) => place(b, rest, j.name, restPoint(buf, j.name, i)));
      for (let m = 0; m < idx.length; m++)
        for (let n = m + 1; n < idx.length; n++) {
          const da = Math.hypot(pa[m][0] - pa[n][0], pa[m][1] - pa[n][1], pa[m][2] - pa[n][2]);
          const db = Math.hypot(pb[m][0] - pb[n][0], pb[m][1] - pb[n][1], pb[m][2] - pb[n][2]);
          expect(Math.abs(da - db)).toBeLessThan(1e-9);
        }
    }
  });

  test("the joints stay closed through a walk and a run: no gaps at the neck, elbows, wrists, hips, knees or ankles", () => {
    const p = built();
    // Every splat (a sample of each part), in rest space.
    const all = [];
    for (const j of JOINTS) {
      const buf = p[j.name];
      for (let i = 0; i < buf.count; i += 2) all.push([j.name, restPoint(buf, j.name, i)]);
    }
    // Directions round the pivot (a Fibonacci sphere).
    const dirs = Array.from({ length: 96 }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / 96;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996323;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
    // Looking at each joint from every side, a sight line must meet the
    // body's surface before it gets near the pivot: a gap between two parts
    // would let it through. (Poses: standing, a walk and a run.)
    const poses = [...POSES.slice(0, 2), ...POSES.slice(6).filter((_, i) => i % 3 === 0)];
    const centroid = {};
    for (const j of JOINTS) {
      const buf = p[j.name];
      const m = [0, 0, 0];
      for (let i = 0; i < buf.count; i++) restPoint(buf, j.name, i).forEach((x, k) => (m[k] += x / buf.count)); // prettier-ignore
      centroid[j.name] = m;
    }
    const gaps = [];
    for (const ps of poses) {
      const f = solve(ps);
      const posed = all.map(([name, q]) => place(f, rest, name, q));
      for (const s of SEAMS) {
        const c = f[s.joint].p;
        // Toward the two parts' bodies the line runs along a limb, not
        // across the joint: those directions are left out.
        const toward = [s.a, s.b].map((n) => {
          const q = place(f, rest, n, centroid[n]);
          const v = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
          const l = Math.hypot(...v);
          return v.map((x) => x / l);
        });
        const pts = [];
        for (const q of posed) {
          const v = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
          if (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] < 0.36) pts.push(v);
        }
        for (const d of dirs) {
          if (toward.some((o) => d[0] * o[0] + d[1] * o[1] + d[2] * o[2] > Math.cos((40 * Math.PI) / 180))) continue; // prettier-ignore
          let blocked = false;
          for (const v of pts) {
            const along = v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
            if (along < 0.003) continue;
            const ox = v[0] - d[0] * along;
            const oy = v[1] - d[1] * along;
            const oz = v[2] - d[2] * along;
            if (ox * ox + oy * oy + oz * oz < 0.013 * 0.013) {
              blocked = true;
              break;
            }
          }
          if (!blocked)
            gaps.push({ joint: s.joint, d: d.map((x) => +x.toFixed(2)), speed: ps.speed });
        }
      }
    }
    if (process.env.CHR_DEBUG)
      console.log(
        JSON.stringify(gaps.reduce((m, g) => ((m[g.joint] ||= []).push([g.speed, ...g.d]), m), {})),
      );
    expect(gaps.slice(0, 5)).toEqual([]);
  });

  test("planted feet don't slide", () => {
    const tip = [0, -0.035, 0.085];
    for (const v of [1.0, 1.9, 4.6]) {
      const st = { speed: v, phase: 0 };
      const dt = 1 / 240;
      let x = 0;
      let drift = 0;
      const start = { L: null, R: null };
      for (let i = 0; i < 480; i++) {
        const ps = pose(st, 0);
        const f = solve(ps);
        for (const side of ["L", "R"]) {
          const w = (name, v3) =>
            place(
              f,
              rest,
              name,
              [0, 1, 2].map((k) => rest[name][k] + v3[k]),
            );
          const pts = [w(`foot${side}`, BODY.heel), w(`toes${side}`, tip), w(`toes${side}`, [0, -0.035, 0])].map((q) => [q[0], q[1], q[2] + x]); // prettier-ignore
          if (!ps.feet[side].planted) {
            start[side] = null;
            continue;
          }
          if (!start[side]) start[side] = pts;
          pts.forEach((q, k) => {
            const s0 = start[side][k];
            if (s0[1] >= 0.01 && q[1] < 0.01) start[side][k] = q; // just touched down
            else if (q[1] < 0.01 && s0[1] < 0.01) drift = Math.max(drift, Math.hypot(q[0] - s0[0], q[2] - s0[2])); // prettier-ignore
          });
          // Nothing goes under the ground.
          for (const q of pts) expect(q[1]).toBeGreaterThan(-0.003);
        }
        stepGait(st, v, dt);
        x += v * dt;
      }
      expect(drift, `speed ${v}`).toBeLessThan(0.005);
    }
  });

  test("a world file's colors apply, and an old world file without them still builds", () => {
    const def = normalizeWorld({ character: { shirt: "#2f7d6d", trousers: "#c8b89a", skin: "#8a5a3c", hair: "#141010", shoes: "#f2f0ea" } }); // prettier-ignore
    const p = buildCharacter(def.character, { count: 20000, seed: 3 });
    const mean = (buf, keep = () => true) => {
      const m = [0, 0, 0];
      let n = 0;
      for (let i = 0; i < buf.count; i++) {
        if (!keep(i)) continue;
        for (let k = 0; k < 3; k++) m[k] += buf.color[i * 4 + k];
        n++;
      }
      return m.map((x) => x / n);
    };
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const close = (got, want, tol = 0.16) => {
      for (let k = 0; k < 3; k++) expect(Math.abs(got[k] - want[k])).toBeLessThan(tol);
    };
    // The lighting darkens a little on average: compare with a shade of it.
    const lit = (h) => hex(h).map((x) => x * 0.86);
    close(mean(p.chest), lit("#2f7d6d"));
    close(mean(p.thighL), lit("#c8b89a"));
    close(mean(p.handL), lit("#8a5a3c"));
    close(
      mean(p.head, (i) => p.head.pos[i * 3 + 1] > 0.17),
      lit("#141010"),
    );
    close(
      mean(p.footL, (i) => p.footL.pos[i * 3 + 1] > -0.03),
      lit("#f2f0ea"),
      0.26,
    );
    // No colors given: the defaults.
    const old = normalizeWorld({ version: 1, title: "Old" });
    expect(Object.keys(buildCharacter(old.character, { count: 8000 }))).toHaveLength(JOINTS.length);
  });

  test("the character's splats per tier fit each tier's budget", () => {
    for (const tier of Object.keys(WORLD_BUDGETS)) {
      const want = CHARACTER_SPLATS[tier];
      expect(want).toBeLessThanOrEqual(WORLD_BUDGETS[tier].splats * 0.15);
      const p = buildCharacter(LOOK, { count: want, seed: 1 });
      const n = Object.values(p).reduce((s, b) => s + b.count, 0);
      expect(n, tier).toBeLessThanOrEqual(want);
      expect(n, tier).toBeGreaterThan(want * 0.85);
    }
  });

  test("on the Test island: the renderer turns the joints as the rig says, each tier holds its budget, and screenshots", async ({
    browser,
  }) => {
    for (const [tier, w, h] of [
      ["low", 390, 844],
      ["mid", 390, 844],
      ["high", 1440, 900],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/worlds/?labs=1&renderer=webgl2&profile=${tier}&clock=manual`);
      await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 200_000 });
      await page.evaluate(() => window.__world.enter());
      await page.evaluate(() => window.__world.catchUp());
      // Walk a little, then stop mid-stride.
      for (let i = 0; i < 14; i++) await page.evaluate(() => window.__world.tick(1 / 15, { x: 0, y: 1, amount: 1 })); // prettier-ignore
      const got = await page.evaluate(() => {
        const w = window.__world.world;
        const j = w.joints;
        const out = { stats: w.stats(), charCount: w.charCount, gait: { ...w.char.gait }, time: w.time, facing: w.char.facing, pos: w.char.pos, joints: {} }; // prettier-ignore
        for (const name in j) out.joints[name] = j[name].getPosition().toArray();
        return out;
      });
      expect(got.charCount).toBeLessThanOrEqual(CHARACTER_SPLATS[tier]);
      expect(got.charCount).toBeGreaterThan(CHARACTER_SPLATS[tier] * 0.85);
      expect(got.stats.total).toBeLessThanOrEqual(WORLD_BUDGETS[tier].splats);
      // The joints where solve() puts them (turned by the facing).
      const f = solve(pose(got.gait, got.time));
      const c = Math.cos(got.facing);
      const s = Math.sin(got.facing);
      for (const name of ["head", "handL", "footR", "toesL", "fingersR"]) {
        const q = f[name].p;
        const want = [got.pos[0] + c * q[0] + s * q[2], got.pos[1] + q[1], got.pos[2] - s * q[0] + c * q[2]]; // prettier-ignore
        for (let k = 0; k < 3; k++) expect(Math.abs(got.joints[name][k] - want[k]), name).toBeLessThan(1e-3); // prettier-ignore
      }
      expect(errors).toEqual([]);
      if (tier !== "low") {
        // A closer look for the screenshot.
        await page.evaluate(() => Object.assign(window.__world.world.camera, { distance: 3.2, pitch: 0.12 })); // prettier-ignore
        for (let i = 0; i < 6; i++) await page.evaluate(() => window.__world.tick(1 / 15));
        await page.screenshot({ path: `tests/screenshots/chr-island-${w}x${h}.png` });
      }
      await ctx.close();
    }
  });
});
