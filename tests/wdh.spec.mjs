// Lane Worlds, the hybrid round (docs/handoff/Worlds.md, "Hybrid";
// docs/WORLDS.md, "Rendering"): the render switch, both modes load, hybrid
// mode draws models and splats together, splats hide behind the models'
// depth, the props and the character cast shadows, frames per second are
// sampled, and the hybrid assets stay small and credited.
//
// Like tests/wd.spec.mjs, the page runs with ?clock=manual.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { normalizeWorld, RENDER_MODES } from "../src/worlds/world-file.js";
import { sunVector } from "../src/worlds/lighting.js";

const URL = (extra = "", tier = "mid") =>
  `/worlds/?labs=1&renderer=webgl2&profile=${tier}&clock=manual${extra}`;

async function open(page, extra = "", tier = "mid") {
  await page.goto(URL(extra, tier));
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 240_000 });
  expect(await page.evaluate(() => document.body.dataset.ready)).toBe("true");
}

async function settle(page, n = 3) {
  await page.evaluate(() => window.__world.catchUp());
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__world.tick(1 / 30));
}

// A small patch of the canvas around a point, as bytes.
async function patch(page, [x, y], r = 6) {
  const shot = await page.screenshot({ clip: { x: x - r, y: y - r, width: r * 2, height: r * 2 } }); // prettier-ignore
  return shot.toString("base64");
}

test.describe("worlds hybrid (file)", () => {
  test("the world file's render field and light default sensibly", () => {
    expect(RENDER_MODES).toEqual(["splats", "hybrid"]);
    expect(normalizeWorld({}).render).toBe("splats");
    expect(normalizeWorld({ render: "hybrid" }).render).toBe("hybrid");
    expect(normalizeWorld({ render: "photo" }).render).toBe("splats");
    const L = normalizeWorld({ light: { sun: { azimuth: 90, elevation: 30 }, haze: 0.01 } }).light;
    expect(L.sun).toEqual({ azimuth: 90, elevation: 30 });
    expect(L.haze).toBe(0.01);
    // Azimuth 90 is east (+x); elevation 30 puts the sun half way up.
    const v = sunVector(L.sun);
    expect(v[0]).toBeCloseTo(Math.cos(Math.PI / 6), 5);
    expect(v[1]).toBeCloseTo(0.5, 5);
    expect(Math.abs(v[2])).toBeLessThan(1e-9);
    // The Test island keeps the mode it had on main until the owner picks.
    const island = JSON.parse(fs.readFileSync("worlds/test-island/world.json", "utf8"));
    expect(normalizeWorld(island).render).toBe("splats");
  });

  test("the hybrid assets are small, CC0 and credited", () => {
    const files = [
      ...fs.readdirSync("assets/worlds/ground").map((f) => `assets/worlds/ground/${f}`),
      ...fs.readdirSync("assets/worlds/sky").map((f) => `assets/worlds/sky/${f}`),
      ...fs.readdirSync("assets/worlds/character").map((f) => `assets/worlds/character/${f}`),
    ];
    const bytes = files.reduce((t, f) => t + fs.statSync(f).size, 0);
    expect(bytes).toBeLessThan(10e6);
    const ground = JSON.parse(fs.readFileSync("assets/worlds/ground/ground.json", "utf8"));
    const sky = JSON.parse(fs.readFileSync("assets/worlds/sky/sky.json", "utf8"));
    const credits = fs.readFileSync("CREDITS.md", "utf8");
    const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
    const listed = JSON.stringify(assets.worlds || []);
    const character = JSON.parse(fs.readFileSync("assets/worlds/character/character.json", "utf8")); // prettier-ignore
    for (const a of [...ground.cells, sky, character]) {
      expect(a.license).toBe("CC0 1.0");
      expect(credits).toContain(a.page);
      expect(listed).toContain(a.page);
    }
    const page = fs.readFileSync("worlds/index.html", "utf8");
    expect(page).toContain("polyhaven.com");
    expect(page).toContain("kenney.nl");
  });
});

test.describe("worlds hybrid", () => {
  test.setTimeout(420_000);

  test("?render= picks the mode; both modes load without errors and draw what they should", async ({
    page,
  }) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    const seen = {};
    for (const mode of ["splats", "hybrid"]) {
      await open(page, `&render=${mode}`);
      await page.click("#enter");
      await settle(page);
      const s = await page.evaluate(() => {
        const w = window.__world.world;
        const app = window.__world.view.app;
        const names = app.root.findComponents("render").filter((r) => r.enabled && r.entity.enabled).map((r) => r.entity.name); // prettier-ignore
        const casters = app.root.findComponents("gsplat").filter((g) => g.castShadows && g.entity.enabled).map((g) => g.entity.name); // prettier-ignore
        const sun = app.root.findByName("sun").light;
        return { mode: window.__world.mode, stats: w.stats(), names, casters, sunShadows: sun.castShadows, envAtlas: !!app.scene.envAtlas, fog: app.scene.fog.type, tone: window.__world.view.camera.camera.toneMapping }; // prettier-ignore
      });
      seen[mode] = s;
      expect(s.mode).toBe(mode);
      expect(s.stats.mode).toBe(mode);
      expect(s.sunShadows).toBe(true);
      expect(s.fog).toBe("exp2");
      // A tone map for hybrid mode's lit models; splats keep their colors.
      if (mode === "hybrid") expect(s.tone).toBeGreaterThan(0);
      else expect(s.tone).toBe(0);
      // The character casts shadows in both modes, and so do near props.
      expect(s.casters.filter((n) => n.startsWith("part-")).length).toBeGreaterThan(5);
      expect(s.casters.some((n) => n.startsWith("prop-"))).toBe(true);
      // Splats are drawn in both modes (props and the character).
      expect(s.stats.props).toBeGreaterThan(20_000);
      expect(s.stats.total).toBeLessThanOrEqual(s.stats.budget);
    }
    // Hybrid: the ground, water, sky and signs are models; the ground's
    // splats are only the near grass.
    const h = seen.hybrid;
    expect(h.names).toContain("ground-tile");
    expect(h.names).toContain("water");
    expect(h.names).toContain("sky-dome");
    expect(h.names).toContain("board");
    expect(h.envAtlas).toBe(true);
    expect(h.stats.chunks).toBeLessThan(seen.splats.stats.chunks / 2);
    // Splats: the ground's depth and the shadow catcher, no other models.
    const sp = seen.splats;
    expect(sp.names.filter((n) => !["ground-depth", "shadow-catcher"].includes(n))).toEqual([]);
    expect(sp.names).toContain("shadow-catcher");
    expect(errors).toEqual([]);
  });

  for (const mode of ["hybrid", "splats"])
    test(`splats hide behind the models' depth (${mode} mode): a bush behind a hill leaves the frame as it is`, async ({
      page,
    }) => {
      await open(page, `&render=${mode}`);
      await page.click("#enter");
      // North of the rocky hill, looking south; a bush stands behind it.
      await page.evaluate(() => {
        const w = window.__world;
        document.getElementById("hint").hidden = true;
        Object.assign(w.world.camera, { distance: 3.2, pitch: 0.05 });
        w.place(-17.2, 0.8, 180);
      });
      await settle(page, 4);
      const probe = await page.evaluate(() => {
        const w = window.__world.world;
        document.getElementById("card").hidden = true;
        const bush = w.props.find((p) => p.prop.type === "bush" && Math.hypot(p.x + 19.5, p.z + 17.4) < 1); // prettier-ignore
        const e = bush.entities[bush.shown];
        const [x, y, front] = w.view.toScreen([bush.x, bush.y + bush.size * 0.4, bush.z]);
        const c = w.char.pos;
        const me = w.view.toScreen([c[0], c[1] + 1.1, c[2]]);
        return {
          shown: bush.shown,
          bush: [x, y],
          front,
          me: [me[0], me[1]],
          id: bush.id,
          has: !!e,
        };
      });
      expect(probe.shown).toBeGreaterThanOrEqual(0);
      expect(probe.front).toBe(true);
      const toggle = async (what, on) => {
        await page.evaluate(
          ({ what, on, id }) => {
            const w = window.__world.world;
            if (what === "bush") {
              const b = w.itemById.get(id);
              b.entities[b.shown].enabled = on;
            } else w.joints.root.enabled = on;
          },
          { what, on, id: probe.id },
        );
        await page.evaluate(() => window.__world.tick(0));
        await page.evaluate(() => window.__world.tick(0));
      };
      // Hidden behind the hill: taking the bush away changes nothing.
      const withBush = await patch(page, probe.bush);
      await toggle("bush", false);
      const without = await patch(page, probe.bush);
      await toggle("bush", true);
      expect(without, `${mode}: the bush shows through the hill`).toBe(withBush);
      // In front: taking the character away does change the frame.
      const withMe = await patch(page, probe.me);
      await toggle("me", false);
      const noMe = await patch(page, probe.me);
      await toggle("me", true);
      expect(noMe).not.toBe(withMe);
    });

  test("?character=mesh swaps in the lit, skinned character: it casts shadows, stands on the ground and its clips follow the world's clock", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "&render=hybrid&character=mesh");
    await page.click("#enter");
    await settle(page);
    const pose = () =>
      page.evaluate(() => {
        const m = window.__world.world.meshCharacter;
        const bone = (n) => m.findByName(n).getPosition();
        const l = bone("LeftFoot");
        const r = bone("RightFoot");
        return { gap: l.clone().sub(r).length(), head: bone("Head_end").y, foot: Math.min(l.y, r.y) }; // prettier-ignore
      });
    const s = await page.evaluate(() => {
      const w = window.__world.world;
      const m = w.meshCharacter;
      const renders = m.findComponents("render");
      return {
        has: !!m,
        shadows: renders.every((r) => r.castShadows),
        splats: w.stats().fixed - (w.skyCount || 0),
        state: m.anim.baseLayer.activeState,
        y: w.char.pos[1],
      };
    });
    expect(s.has).toBe(true);
    expect(s.shadows).toBe(true);
    expect(s.splats).toBe(0);
    expect(s.state).toBe("Move");
    // As tall as the splat character, feet on the ground.
    const still = await pose();
    expect(still.head - s.y).toBeGreaterThan(1.5);
    expect(still.head - s.y).toBeLessThan(1.95);
    expect(Math.abs(still.foot - s.y)).toBeLessThan(0.2);
    // A paused clock leaves the pose as it is; walking swings the feet apart.
    await page.evaluate(() => window.__world.tick(0));
    expect((await pose()).gap).toBeCloseTo(still.gap, 3);
    const gaps = [];
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.__world.tick(1 / 30, { y: 1 }));
      gaps.push((await pose()).gap);
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.05);
    expect(errors).toEqual([]);
  });

  test("frames per second, sampled in both modes", async ({ page }) => {
    const out = {};
    for (const mode of ["splats", "hybrid"]) {
      await open(page, `&render=${mode}`);
      await page.click("#enter");
      await settle(page);
      // Real frames (the manual clock still draws every frame).
      const ms = await page.evaluate(async () => {
        const v = window.__world.view;
        v.frameMs.length = 0;
        for (let i = 0; i < 8; i++) await window.__world.tick(1 / 30);
        const f = v.frameMs.slice().sort((a, b) => a - b);
        return f[Math.floor(f.length / 2)];
      });
      expect(ms).toBeGreaterThan(0);
      out[mode] = { frameMs: Math.round(ms), fps: +(1000 / ms).toFixed(1) };
    }
    // Software rendering here: the numbers compare the modes; phones are
    // measured on the device (docs/handoff/Worlds.md, "Hybrid").
    console.log(`fps (software renderer, mid tier): ${JSON.stringify(out)}`);
  });

  test("screenshots at 390x844 and 1440x900", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await open(page, "&render=hybrid");
      await page.click("#enter");
      await page.evaluate(() => {
        document.getElementById("hint").hidden = true;
        window.__world.place(-23, -9, 0);
      });
      await settle(page, 4);
      await page.evaluate(() => (document.getElementById("card").hidden = true));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `tests/screenshots/wdh-island-${w}x${h}.png` });
      await page.close();
    }
  });
});
