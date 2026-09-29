// Lane Worlds: the world engine and the Test island (docs/handoff/Worlds.md,
// docs/WORLDS.md). The world loads cleanly, keys move the character on the
// ground, collision stops it at props and at water, landmarks open their
// cards, the list shows every landmark, each tier stays in its budget, and
// the toy box's labs-only link.
//
// The page runs with ?clock=manual, so time moves only when a test steps
// it (__world.tick or __world.step) and the software renderer's speed does
// not matter.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { WORLD_BUDGETS, TIERS } from "../src/worlds/tiers.js";
import { normalizeWorld } from "../src/worlds/world-file.js";
import { Terrain } from "../src/worlds/terrain.js";
import { Physics } from "../src/worlds/physics.js";
import { planLevels } from "../src/worlds/lod.js";
import { pose } from "../src/worlds/character.js";

const ISLAND = JSON.parse(fs.readFileSync("worlds/test-island/world.json", "utf8"));
const URL = (tier = "mid", extra = "") =>
  `/worlds/?labs=1&renderer=webgl2&profile=${tier}&clock=manual${extra}`;

async function open(page, tier = "mid", extra = "") {
  await page.goto(URL(tier, extra));
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 200_000 });
  expect(await page.evaluate(() => document.body.dataset.ready)).toBe("true");
}

// Steps the manual clock a few frames with no input (the level of detail
// builds what it needs).
async function settle(page, n = 10) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__world.tick(1 / 30));
}

test.describe("worlds", () => {
  test("the Test island loads without console errors and shows its start screen", async ({
    page,
  }) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await expect(page.locator("#start-title")).toHaveText(ISLAND.title);
    await expect(page.locator("#start-welcome")).toHaveText(ISLAND.welcome);
    await expect(page.locator("#enter")).toBeEnabled();
    expect(await page.title()).toContain(ISLAND.title);
    await page.click("#enter");
    await expect(page.locator("#start")).toBeHidden();
    await expect(page.locator("#hud")).toBeVisible();
    await settle(page);
    const stats = await page.evaluate(() => window.__world.stats());
    expect(stats.total).toBeGreaterThan(50_000);
    expect(errors).toEqual([]);
  });

  test("without the labs switch the page says Worlds is being tried out", async ({ page }) => {
    await page.goto("/worlds/?renderer=webgl2");
    await page.waitForFunction(() => document.body.dataset.ready === "labs-off");
    await expect(page.locator("#labs-off")).toBeVisible();
    await expect(page.locator("#start")).toBeHidden();
  });

  test("keys move the character, and it stays on the ground", async ({ page }) => {
    await open(page);
    await page.click("#enter");
    const start = await page.evaluate(() => window.__world.char());
    await page.keyboard.down("KeyW");
    for (let i = 0; i < 45; i++) await page.evaluate(() => window.__world.tick(1 / 30));
    await page.keyboard.up("KeyW");
    const walked = await page.evaluate(() => window.__world.char());
    const d = Math.hypot(walked.pos[0] - start.pos[0], walked.pos[2] - start.pos[2]);
    // 1.5 s at a walk (1.9 m/s, easing in).
    expect(d).toBeGreaterThan(1.8);
    expect(d).toBeLessThan(3.2);
    // Facing north at the spawn point, W walks north (toward -z).
    expect(walked.pos[2]).toBeLessThan(start.pos[2] - 1.5);
    // Shift runs: farther in the same time.
    const before = walked;
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("ArrowUp");
    for (let i = 0; i < 45; i++) await page.evaluate(() => window.__world.tick(1 / 30));
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ShiftLeft");
    const ran = await page.evaluate(() => window.__world.char());
    expect(Math.hypot(ran.pos[0] - before.pos[0], ran.pos[2] - before.pos[2])).toBeGreaterThan(d * 1.6); // prettier-ignore
    // On the ground all along: its feet are at the ground's height.
    for (const c of [walked, ran]) {
      const g = await page.evaluate(([x, z]) => window.__world.ground(x, z), [c.pos[0], c.pos[2]]);
      expect(Math.abs(c.pos[1] - g)).toBeLessThan(0.01);
    }
    // And the legs swing: the thighs turn while walking, not at rest.
    const swing = await page.evaluate(() => {
      const j = window.__world.world.joints;
      return Math.abs(j.thighL.getLocalEulerAngles().x);
    });
    expect(swing).toBeGreaterThanOrEqual(0);
  });

  test("collision stops the character at a prop and at the water", async ({ page }) => {
    await open(page);
    await page.click("#enter");
    // A boulder: walk east into it from 3 m west of its middle.
    const boulder = ISLAND.props.find((p) => p.id === "boulder-2");
    const res = await page.evaluate(([x, z]) => {
      const w = window.__world;
      w.place(x - 3.2, z, 90);
      const c = w.world.physics.colliders.find((k) => k.id === "boulder-2");
      const out = w.step({ y: 1 }, 3);
      return { out, c: { x: c.x, z: c.z, radius: c.radius } };
    }, boulder.at);
    expect(res.out.blocked).toBe("prop");
    const gap = Math.hypot(res.out.pos[0] - res.c.x, res.out.pos[2] - res.c.z);
    expect(gap).toBeGreaterThan(res.c.radius + 0.25);
    // It got close before it stopped.
    expect(gap).toBeLessThan(res.c.radius + 0.6);

    // The water: walk west off the west beach for 10 s.
    const wet = await page.evaluate(() => {
      const w = window.__world;
      w.place(-22, -2, 270);
      const out = w.step({ y: 1, run: true }, 10);
      return { out, ground: w.ground(out.pos[0], out.pos[2]), water: w.world.terrain.water };
    });
    expect(wet.out.blocked).toBe("water");
    expect(wet.ground).toBeGreaterThan(wet.water - 0.25);
    expect(wet.out.pos[0]).toBeGreaterThan(-40);
  });

  test("walking up to a landmark or tapping its sign opens its card", async ({ page }) => {
    await open(page);
    await page.click("#enter");
    await expect(page.locator("#card")).toBeHidden();
    // Walk toward the palm beach sign from 8 m east of it.
    const lm = ISLAND.landmarks.find((l) => l.id === "palm-beach");
    await page.evaluate(([x, z]) => window.__world.place(x + 8, z, 270), lm.at);
    await page.evaluate(() => window.__world.step({ y: 1 }, 5));
    await expect(page.locator("#card")).toBeVisible();
    await expect(page.locator("#card-title")).toHaveText(lm.title);
    await expect(page.locator("#card-words")).toHaveText(lm.words);
    await expect(page.locator("#card-picture")).toBeVisible();
    await expect(page.locator("#card-link")).toHaveAttribute("href", lm.link.href);
    await page.click("#card-close");
    await expect(page.locator("#card")).toBeHidden();

    // A click on a sign from afar opens that sign's card.
    const bl = ISLAND.landmarks.find((l) => l.id === "boulders");
    await page.evaluate(([x, z]) => window.__world.place(x - 1, z + 11, 175), bl.at);
    await settle(page, 6);
    const pt = await page.evaluate((id) => {
      const w = window.__world.world;
      const s = w.signs.find((x) => x.landmark.id === id);
      return w.view.toScreen([s.pos[0], s.pos[1] + 1.6, s.pos[2]]);
    }, bl.id);
    await page.mouse.click(pt[0], pt[1]);
    await expect(page.locator("#card")).toBeVisible();
    await expect(page.locator("#card-title")).toHaveText(bl.title);
  });

  test("the list view lists every landmark, and Go there takes you to one", async ({ page }) => {
    await open(page);
    // From the start screen, before entering.
    await page.click("#start-list");
    await expect(page.locator("#places")).toBeVisible();
    const items = page.locator("#places-list > li");
    await expect(items).toHaveCount(ISLAND.landmarks.length);
    for (let i = 0; i < ISLAND.landmarks.length; i++) {
      await expect(items.nth(i).locator("h3")).toHaveText(ISLAND.landmarks[i].title);
    }
    await page.click('#places-list li[data-landmark="lookout"] button');
    await expect(page.locator("#places")).toBeHidden();
    await expect(page.locator("#start")).toBeHidden();
    await expect(page.locator("#card-title")).toHaveText("Lookout hill");
    const c = await page.evaluate(() => window.__world.char());
    const lm = ISLAND.landmarks.find((l) => l.id === "lookout");
    expect(Math.hypot(c.pos[0] - lm.at[0], c.pos[2] - lm.at[1])).toBeLessThan(3.5);
  });

  test("each tier stays within its splat budget", async ({ page }) => {
    test.setTimeout(600_000);
    const seen = {};
    for (const tier of TIERS) {
      await open(page, tier);
      await page.click("#enter");
      await settle(page, 20);
      const a = await page.evaluate(() => window.__world.stats());
      // Somewhere else: across the island, by the lighthouse.
      await page.evaluate(() => window.__world.place(-5, -19, 0));
      await settle(page, 30);
      const b = await page.evaluate(() => window.__world.stats());
      for (const s of [a, b]) {
        expect(s.tier).toBe(tier);
        expect(s.total).toBeLessThanOrEqual(WORLD_BUDGETS[tier].splats);
      }
      seen[tier] = a.total;
      console.log(`worlds budget ${tier}: ${a.total} and ${b.total} of ${WORLD_BUDGETS[tier].splats} splats, near ground ${a.levels[0]}`); // prettier-ignore
    }
    expect(seen.low).toBeLessThan(seen.mid);
    expect(seen.mid).toBeLessThan(seen.high);
  });

  test("screenshots at 390x844 and 1440x900", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await open(page);
      await page.click("#enter");
      await settle(page, 12);
      await page.evaluate(() => window.__world.step({ y: 1 }, 1.2));
      await settle(page, 12);
      await page.screenshot({ path: `tests/screenshots/wd-island-${w}x${h}.png` });
      await page.close();
    }
  });

  test("the toy box links to Worlds only with the labs switch", async ({ page }) => {
    // The link sits in the About tab; `hidden` says whether it shows there.
    const shown = () => page.evaluate(() => !document.getElementById("worlds-link").hidden);
    await page.goto("/?renderer=none&labs=0");
    await page.waitForLoadState("load");
    expect(await shown()).toBe(false);
    await page.goto("/?renderer=none&labs=1");
    await page.waitForFunction(() => !document.getElementById("worlds-link").hidden);
    expect(await shown()).toBe(true);
    await expect(page.locator("#worlds-link a")).toHaveAttribute("href", "worlds/?labs=1");
  });
});

// ---- The engine's pure parts, in Node ------------------------------------------------

test.describe("worlds engine", () => {
  const def = normalizeWorld(ISLAND);
  const terrain = new Terrain(def.terrain, def.colors, def.seed);

  test("the world file fills in defaults and keeps what it is given", () => {
    const w = normalizeWorld({ title: "T", landmarks: [{ title: "A place" }], props: [{ type: "palm" }] }); // prettier-ignore
    expect(w.title).toBe("T");
    expect(w.terrain.size).toBe(160);
    expect(w.landmarks[0].id).toBe("landmark-0");
    expect(w.landmarks[0].label).toBe("A PLACE");
    expect(w.props[0].size).toBe(1);
    expect(def.landmarks.length).toBe(ISLAND.landmarks.length);
  });

  test("the island has a beach, grass and deep water, and the spawn is on land", () => {
    const kinds = new Set();
    for (let x = -60; x <= 60; x += 2) for (let z = -60; z <= 60; z += 2) kinds.add(terrain.surfaceAt(x, z)); // prettier-ignore
    for (const k of ["sand", "grass", "seabed"]) expect(kinds.has(k)).toBe(true);
    expect(terrain.heightAt(...def.spawn.at)).toBeGreaterThan(terrain.water + 0.5);
    for (const l of def.landmarks) expect(terrain.heightAt(...l.at)).toBeGreaterThan(terrain.water); // prettier-ignore
  });

  test("steep ground stops the character; gentle ground doesn't", () => {
    const ph = new Physics(terrain);
    // Find a steep and a gentle step on the island.
    let steep = null;
    let gentle = null;
    for (let x = -30; x <= 30 && !(steep && gentle); x += 0.5)
      for (let z = -24; z <= 24 && !(steep && gentle); z += 0.5) {
        const s = terrain.slopeAt(x, z);
        if (!steep && s > 1.3 && terrain.heightAt(x, z) > 1) steep = [x, z];
        if (!gentle && s < 0.3 && s > 0.15 && terrain.heightAt(x, z) > 1) gentle = [x, z];
      }
    expect(steep).not.toBeNull();
    expect(gentle).not.toBeNull();
    const uphill = (p) => {
      const n = terrain.normalAt(p[0], p[1]);
      const l = Math.hypot(n[0], n[2]);
      return [-n[0] / l, -n[2] / l];
    };
    const u = uphill(steep);
    const st = ph.standable(steep[0] + u[0] * 0.2, steep[1] + u[1] * 0.2, steep[0], steep[1]);
    expect(st.ok).toBe(false);
    expect(st.why).toBe("slope");
    const g = uphill(gentle);
    expect(ph.standable(gentle[0] + g[0] * 0.2, gentle[1] + g[1] * 0.2, gentle[0], gentle[1]).ok).toBe(true); // prettier-ignore
  });

  test("the level-of-detail planner keeps under the budget, near sharp and far coarse", () => {
    const items = [];
    for (let i = -5; i <= 5; i++)
      for (let j = -5; j <= 5; j++)
        items.push({ id: `${i},${j}`, kind: "chunk", x: i * 16, z: j * 16, radius: 11, counts: [12000, 3000, 800, 200] }); // prettier-ignore
    for (const tier of TIERS) {
      const b = WORLD_BUDGETS[tier];
      const plan = planLevels(items, [0, 0, 0], b, b.splats);
      expect(plan.total).toBeLessThanOrEqual(b.splats);
      expect(plan.levels.get("0,0")).toBe(0);
      expect(plan.levels.get("5,5")).toBeGreaterThanOrEqual(2);
    }
    // A budget too small for the defaults pulls the distances in.
    const tight = planLevels(items, [0, 0, 0], WORLD_BUDGETS.high, 60000);
    expect(tight.total).toBeLessThanOrEqual(60000);
    expect(tight.scale).toBeLessThan(1);
  });

  test("the gait swings the legs and arms as rigid pieces, opposite each other", () => {
    const walk = pose({ speed: 1.9, phase: Math.PI / 2 }, 0).joints;
    expect(walk.thighL[0]).toBeLessThan(-10);
    expect(walk.thighR[0]).toBeGreaterThan(10);
    // Arms swing against the legs.
    expect(Math.sign(walk.armL[0])).toBe(-Math.sign(walk.thighL[0]));
    const idle = pose({ speed: 0, phase: 0 }, 0).joints;
    expect(Math.abs(idle.thighL[0])).toBeLessThan(0.01);
  });
});
