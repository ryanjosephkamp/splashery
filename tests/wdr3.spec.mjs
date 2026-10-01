// Lane Worlds, round 3 (docs/handoff/Worlds.md, "Brief (r3)"; docs/WORLDS.md,
// "The mesh character" and "Model props"): the realistic character loads in
// each tier within its triangle and texture budgets, its idle, walk and run
// play and its feet stay planted while it walks, the model props switch
// levels by distance, the assets are credited and small enough, the stats
// overlay shows, and screenshots at 390x844 and 1440x900.
//
// Like tests/wd.spec.mjs, the page runs with ?clock=manual.

import { test, expect } from "@playwright/test";
import fs from "node:fs";

const URL = (extra = "", tier = "mid") =>
  `/worlds/?labs=1&renderer=webgl2&profile=${tier}&clock=manual&render=hybrid${extra}`;

async function open(page, extra = "", tier = "mid") {
  await page.goto(URL(extra, tier));
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 300_000 });
  expect(await page.evaluate(() => document.body.dataset.ready)).toBe("true");
}

async function settle(page, n = 3) {
  await page.evaluate(() => window.__world.catchUp());
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__world.tick(1 / 30));
}

const CHAR = "assets/worlds/character";
const PROPS = "assets/worlds/props";
const size = (f) => fs.statSync(f).size;

test.describe("worlds r3 (files)", () => {
  test("the character's levels keep to their triangle, texture and size budgets, and it is credited", () => {
    const meta = JSON.parse(fs.readFileSync(`${CHAR}/human.json`, "utf8"));
    const { high, low } = meta.levels;
    // Roughly 15-30k triangles on high, a lighter body for low and mid.
    expect(high.triangles).toBeGreaterThan(15_000);
    expect(high.triangles).toBeLessThanOrEqual(32_000);
    expect(low.triangles).toBeLessThan(high.triangles * 0.7);
    for (const lv of [high, low]) for (const px of Object.values(lv.textures)) expect(px).toBeLessThanOrEqual(2048); // prettier-ignore
    expect(size(`${CHAR}/human-high.glb`)).toBeLessThan(3e6);
    expect(size(`${CHAR}/human-low.glb`)).toBeLessThan(1.6e6);
    // A walk and a run, one cycle each, a second long, with their strides.
    for (const c of ["walk", "run"]) {
      expect(meta.clips[c].duration).toBe(1);
      expect(meta.clips[c].stride).toBeGreaterThan(0.8);
    }
    expect(meta.clips.run.stride).toBeGreaterThan(meta.clips.walk.stride);
    expect(meta.clips.idle.duration).toBeGreaterThan(2);
    // Credited: CC0 and CC BY only, in CREDITS.md, tools/assets.json and
    // the page's list of places.
    const credits = fs.readFileSync("CREDITS.md", "utf8");
    const listed = JSON.stringify(JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).worlds);
    const page = fs.readFileSync("worlds/index.html", "utf8");
    expect(meta.credits.length).toBeGreaterThanOrEqual(2);
    for (const c of meta.credits) {
      expect(["CC0 1.0", "CC BY 4.0"]).toContain(c.license);
      expect(credits).toContain(c.page);
      expect(listed).toContain(c.page);
    }
    expect(page).toContain("100STYLE");
    expect(page).toContain("MakeHuman");
  });

  test("the model props have three levels each, are CC0 and credited, and hybrid mode's download stays small", () => {
    const meta = JSON.parse(fs.readFileSync(`${PROPS}/props.json`, "utf8"));
    for (const [kind, k] of Object.entries(meta.kinds)) {
      expect(k.variants.length, kind).toBeGreaterThan(0);
      for (const v of k.variants) {
        expect(v.tris.length).toBe(3);
        expect(v.tris[0]).toBeGreaterThan(v.tris[1]);
        expect(v.tris[1]).toBeGreaterThan(v.tris[2]);
        expect(v.tris[0]).toBeLessThanOrEqual(4000);
      }
    }
    const credits = fs.readFileSync("CREDITS.md", "utf8");
    const listed = JSON.stringify(JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).worlds);
    for (const c of meta.credits) {
      expect(c.license).toBe("CC0 1.0");
      expect(credits).toContain(c.page);
      expect(listed).toContain(c.page);
    }
    // What hybrid mode downloads: the ground, the sky, the props and the
    // character's level for the tier.
    const dir = (d) => fs.readdirSync(d).reduce((t, f) => t + size(`${d}/${f}`), 0);
    const shared = dir("assets/worlds/ground") + dir("assets/worlds/sky") + dir(PROPS) + size(`${CHAR}/human.json`); // prettier-ignore
    const lowMid = shared + size(`${CHAR}/human-low.glb`);
    const highMax = shared + size(`${CHAR}/human-high.glb`);
    expect(lowMid).toBeLessThan(10e6);
    console.log(`hybrid download: low and mid ${(lowMid / 1e6).toFixed(2)} MB, high and max ${(highMax / 1e6).toFixed(2)} MB`); // prettier-ignore
  });
});

test.describe("worlds r3", () => {
  test.setTimeout(600_000);

  test("the realistic character is hybrid mode's default and loads its level in each tier, within budget", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [tier, level] of [
      ["low", "low"],
      ["mid", "low"],
      ["high", "high"],
    ]) {
      await open(page, "", tier);
      const s = await page.evaluate(() => {
        const w = window.__world.world;
        const m = w.meshCharacter;
        let tris = 0;
        let tex = 0;
        for (const r of m.findComponents("render"))
          for (const mi of r.meshInstances) {
            tris += mi.mesh.primitive[0].count / 3;
            for (const t of [mi.material.diffuseMap, mi.material.normalMap]) if (t) tex = Math.max(tex, t.width); // prettier-ignore
          }
        return { model: w.characterModel, level: m.wdCharacter.level, tris, tex, shadows: m.findComponents("render").every((r) => r.castShadows), splats: w.stats().fixed - (w.skyCount || 0) }; // prettier-ignore
      });
      expect(s.model).toBe("mesh");
      expect(s.level).toBe(level);
      expect(s.shadows).toBe(true);
      expect(s.splats).toBe(0);
      expect(s.tris).toBeLessThanOrEqual(level === "high" ? 32_000 : 20_000);
      expect(s.tex).toBeLessThanOrEqual(level === "high" ? 2048 : 1024);
    }
    // Splats mode keeps the splat character.
    await page.goto(URL("", "mid").replace("&render=hybrid", "&render=splats"));
    await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 300_000 });
    expect(await page.evaluate(() => window.__world.world.characterModel)).toBe("splats");
    expect(errors).toEqual([]);
  });

  test("idle, walk and run play, and the standing foot stays planted while it walks and runs", async ({
    page,
  }) => {
    await open(page);
    await page.click("#enter");
    await settle(page);
    // The measure: each foot's speed over the ground while it stands (its
    // lowest 3 cm), against the body's speed.
    const measure = (input) =>
      page.evaluate(async (input) => {
        const W = window.__world;
        const w = W.world;
        const m = w.meshCharacter;
        W.place(-26, -12, 10);
        for (let i = 0; i < 20; i++) await W.tick(1 / 30, input);
        const rec = [];
        for (let i = 0; i < 45; i++) {
          await W.tick(1 / 30, input);
          rec.push(["ball_l", "ball_r"].map((n) => { const p = m.findByName(n).getPosition(); return [p.x, p.y - w.terrain.heightAt(p.x, p.z), p.z]; })); // prettier-ignore
        }
        const slides = [];
        const lifts = [];
        for (let k = 0; k < 2; k++) {
          const hs = rec.map((r) => r[k][1]);
          const lo = Math.min(...hs);
          lifts.push(Math.max(...hs) - lo);
          for (let i = 1; i < rec.length; i++)
            if (hs[i] < lo + 0.03 && hs[i - 1] < lo + 0.03)
              slides.push(Math.hypot(rec[i][k][0] - rec[i - 1][k][0], rec[i][k][2] - rec[i - 1][k][2]) * 30); // prettier-ignore
        }
        slides.sort((a, b) => a - b);
        return { speed: w.char.gait.speed, slide: slides[Math.floor(slides.length / 2)], lift: Math.min(...lifts), state: m.anim.baseLayer.activeState }; // prettier-ignore
      }, input);
    const idle = await page.evaluate(() => window.__world.world.meshCharacter.anim.baseLayer.activeState); // prettier-ignore
    expect(idle).toBe("Idle");
    const walk = await measure({ y: 1 });
    const run = await measure({ y: 1, run: true });
    console.log(`feet: walk ${JSON.stringify(walk)}, run ${JSON.stringify(run)}`);
    expect(walk.state).toBe("Move");
    expect(walk.speed).toBeGreaterThan(1);
    expect(run.speed).toBeGreaterThan(walk.speed * 1.6);
    // The feet lift off the ground and come down again...
    expect(walk.lift).toBeGreaterThan(0.08);
    expect(run.lift).toBeGreaterThan(0.12);
    // ... and while one stands, it barely slides (under a tenth of the
    // body's speed walking, under a sixth running).
    expect(walk.slide).toBeLessThan(walk.speed * 0.1);
    expect(run.slide).toBeLessThan(run.speed * 0.17);
    // Stopping goes back to idle.
    const back = await page.evaluate(async () => {
      for (let i = 0; i < 20; i++) await window.__world.tick(1 / 30);
      return window.__world.world.meshCharacter.anim.baseLayer.activeState;
    });
    expect(back).toBe("Idle");
  });

  test("the model props switch levels of detail by distance, and scattered stones and shells are drawn", async ({
    page,
  }) => {
    await open(page);
    await page.click("#enter");
    const at = async (dx) =>
      page.evaluate(async (dx) => {
        const W = window.__world;
        const mp = W.world.meshProps;
        const b = mp.items.find((i) => i.type === "boulder");
        W.place(b.x + dx, b.z, 0);
        await W.tick(1 / 30);
        return { shown: b.shown, enabled: b.levels.map((l) => l.enabled), stats: W.stats().meshProps }; // prettier-ignore
      }, dx);
    const near = await at(3);
    const mid = await at(30);
    const far = await at(70);
    expect(near.shown).toBe(0);
    expect(mid.shown).toBe(1);
    expect(far.shown).toBe(2);
    expect(near.enabled).toEqual([true, false, false]);
    expect(far.enabled).toEqual([false, false, true]);
    expect(near.stats.props).toBeGreaterThan(8);
    expect(near.stats.scattered).toBeGreaterThan(100);
    const kinds = await page.evaluate(() => [...new Set(window.__world.world.meshProps.items.map((i) => i.type))].sort()); // prettier-ignore
    expect(kinds).toEqual(["boulder", "driftwood", "pebbles", "stump"]);
  });

  test("?stats=1 shows frames per second, the tier, the mode, splats and draw calls", async ({
    page,
  }) => {
    await open(page, "&stats=1");
    await page.click("#enter");
    await settle(page, 4);
    await page.waitForTimeout(700);
    const text = await page.locator("#stats").textContent();
    expect(text).toMatch(/\d+ fps/);
    expect(text).toContain("mid tier · hybrid");
    expect(text).toContain("person (low)");
    expect(text).toMatch(/\d+k splats · \d+ draws/);
    expect(await page.locator("#stats").isVisible()).toBe(true);
    // Not without the switch.
    await open(page);
    expect(await page.locator("#stats").count()).toBe(0);
  });

  test("screenshots at 390x844 and 1440x900", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await open(page);
      await page.click("#enter");
      await page.evaluate(() => {
        document.getElementById("hint").hidden = true;
        window.__world.page.openCard = () => {};
        window.__world.place(-26, -12, 10);
      });
      await settle(page, 4);
      await page.evaluate(async () => {
        for (let i = 0; i < 12; i++) await window.__world.tick(1 / 30, { y: 1 });
      });
      await page.evaluate(() => (document.getElementById("card").hidden = true));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `tests/screenshots/wdr3-beach-${w}x${h}.png` });
      await page.close();
    }
  });
});
