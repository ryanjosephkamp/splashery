// Lane Worlds, round 4 (docs/handoff/Worlds.md, "Brief (r4)"; docs/WORLDS.md,
// "The character lab"): the measured gait reference is built and credited,
// the character's walk and run follow it joint by joint, its arms hang at
// its sides when it stands and walks and swing opposite its legs, it runs
// with bent, pumping elbows and little side-to-side sway, and the lab page
// opens behind the labs switch with its views, speeds and chart.
//
// The lab runs with ?clock=manual: window.__lab.tick(dt) advances it.

import { test, expect } from "@playwright/test";
import fs from "node:fs";

const LAB = (extra = "") => `/worlds/lab/?labs=1&renderer=webgl2&level=low&clock=manual${extra}`;
const REF = JSON.parse(fs.readFileSync("assets/worlds/lab/gait-reference.json", "utf8"));
const META = JSON.parse(fs.readFileSync("assets/worlds/character/human.json", "utf8"));

async function open(page, extra = "") {
  await page.goto(LAB(extra));
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 300_000 });
  expect(await page.evaluate(() => document.body.dataset.ready)).toBe("true");
}

// Root-mean-square difference between a curve (any length) and a reference
// mean resampled to it, skipping gaps.
function rms(curve, mean) {
  let s = 0;
  let n = 0;
  curve.forEach((v, i) => {
    if (v === null || v === undefined) return;
    const x = (i / (curve.length - 1)) * (mean.length - 1);
    const j = Math.floor(x);
    const m =
      j >= mean.length - 1 ? mean[mean.length - 1] : mean[j] + (mean[j + 1] - mean[j]) * (x - j);
    s += (v - m) ** 2;
    n++;
  });
  return Math.sqrt(s / Math.max(1, n));
}

const span = (a) =>
  Math.max(...a.filter((v) => v !== null)) - Math.min(...a.filter((v) => v !== null));

function corr(a, b) {
  const p = a.map((v, i) => [v, b[i]]).filter(([x, y]) => x !== null && y !== null);
  const ma = p.reduce((s, [x]) => s + x, 0) / p.length;
  const mb = p.reduce((s, [, y]) => s + y, 0) / p.length;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (const [x, y] of p) {
    sab += (x - ma) * (y - mb);
    saa += (x - ma) ** 2;
    sbb += (y - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

test.describe("worlds r4 (files)", () => {
  test("the gait reference is measured human data, cited and credited", () => {
    for (const g of ["walk", "run"]) {
      const r = REF[g];
      expect(r.subjects).toBeGreaterThanOrEqual(8);
      expect(r.source).toContain("Fukuchi");
      for (const j of ["hip", "knee", "ankle"]) {
        expect(r.joints[j].mean).toHaveLength(51);
        expect(r.joints[j].sd).toHaveLength(51);
      }
    }
    // Walking knee: about 60 degrees in swing; running knee: more.
    expect(Math.max(...REF.walk.joints.knee.mean)).toBeGreaterThan(50);
    expect(Math.max(...REF.run.joints.knee.mean)).toBeGreaterThan(
      Math.max(...REF.walk.joints.knee.mean),
    );
    const credits = fs.readFileSync("CREDITS.md", "utf8");
    const listed = JSON.stringify(JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).worlds);
    const lab = fs.readFileSync("worlds/lab/index.html", "utf8");
    for (const doi of ["10.6084/m9.figshare.5722711", "10.6084/m9.figshare.4543435"]) {
      expect(credits).toContain(doi);
      expect(listed).toContain(doi);
    }
    expect(lab).toContain("CC BY 4.0");
    expect(lab).toContain("Fukuchi");
  });

  test("the built walk and run follow the reference joint by joint", () => {
    for (const g of ["walk", "run"]) {
      const m = META.clips[g].measured;
      for (const j of ["hip", "knee", "ankle"]) expect(rms(m[j], REF[g].joints[j].mean), `${g} ${j}`).toBeLessThan(8); // prettier-ignore
    }
    // Arms: the walking shoulder swings about as far as people's, and the
    // running elbow stays bent near a right angle.
    const w = META.clips.walk.measured;
    expect(span(w.shoulder)).toBeGreaterThan(
      REF.walk.arms.shoulderRange[0] - 2 * REF.walk.arms.shoulderRange[1],
    );
    expect(span(w.shoulder)).toBeLessThan(
      REF.walk.arms.shoulderRange[0] + 2 * REF.walk.arms.shoulderRange[1],
    );
    const r = META.clips.run.measured;
    const mean = r.elbow.reduce((a, b) => a + b, 0) / r.elbow.length;
    expect(mean).toBeGreaterThan(70);
    expect(mean).toBeLessThan(105);
    // The arms swing opposite the legs: the left arm comes forward while the
    // left leg goes back.
    for (const g of ["walk", "run"]) expect(corr(META.clips[g].measured.shoulder, META.clips[g].measured.hip), g).toBeLessThan(-0.6); // prettier-ignore
  });
});

test.describe("worlds r4 (the character lab)", () => {
  test.describe.configure({ timeout: 600_000 });

  test("the lab waits for the labs switch", async ({ page }) => {
    await page.goto("/worlds/lab/?labs=0");
    await page.waitForFunction(() => document.body.dataset.ready);
    expect(await page.evaluate(() => document.body.dataset.ready)).toBe("labs-off");
    await expect(page.locator("#labs-off")).toBeVisible();
  });

  test("walking and running in the lab follow the reference, with the arms opposite the legs", async ({
    page,
  }) => {
    await open(page);
    for (const g of ["walk", "run"]) {
      await page.evaluate((gait) => window.__lab.set({ gait }), g);
      // Two full cycles at 60 frames a second, so every bin is filled.
      for (let i = 0; i < 140; i++) await page.evaluate(() => window.__lab.tick(1 / 60));
      const c = await page.evaluate(() => window.__lab.curves());
      expect(c.hip.filter((v) => v === null).length, g).toBeLessThan(3);
      for (const j of ["hip", "knee", "ankle"]) expect(rms(c[j], REF[g].joints[j].mean), `${g} ${j}`).toBeLessThan(10); // prettier-ignore
      expect(corr(c.shoulder, c.hip), g).toBeLessThan(-0.5);
      // Little side-to-side sway (a few centimeters), more bob when running.
      expect(span(c.sway), g).toBeLessThan(7);
      if (g === "run") {
        expect(span(c.bob)).toBeGreaterThan(5);
        const el = c.elbow.filter((v) => v !== null);
        expect(Math.min(...el)).toBeGreaterThan(55);
      }
      // The chart's notes give the published values beside the character's.
      await expect(page.locator("#lab-note")).toContainText("published");
    }
  });

  test("standing and walking, the hands stay by the thighs, never in front of the body", async ({
    page,
  }) => {
    await open(page, "&gait=stand");
    const handAhead = () =>
      page.evaluate(() => {
        const { lab } = window.__lab;
        const m = lab.model;
        const F = m.forward.clone().mulScalar(-1);
        const P = (n) => lab.model.findByName(n).getPosition();
        // How far each hand is ahead of the hip joint on its side (m).
        return ["l", "r"].map((s) =>
          P(`hand_${s}`)
            .clone()
            .sub(P(`thigh_${s}`))
            .dot(F),
        );
      });
    for (let i = 0; i < 30; i++) await page.evaluate(() => window.__lab.tick(1 / 30));
    for (const d of await handAhead()) expect(Math.abs(d)).toBeLessThan(0.12);
    const a = await page.evaluate(() => window.__lab.angles());
    expect(a.elbow).toBeGreaterThan(3);
    expect(a.elbow).toBeLessThan(30);
    await page.evaluate(() => window.__lab.set({ gait: "walk" }));
    let most = 0;
    for (let i = 0; i < 70; i++) {
      await page.evaluate(() => window.__lab.tick(1 / 60));
      for (const d of await handAhead()) most = Math.max(most, d);
    }
    // At the front of its swing a walking hand is about a forearm ahead of
    // the hip (a 44° shoulder swing, the elbow bent up to 37°), never up in
    // front of the chest.
    expect(most).toBeLessThan(0.4);
  });

  test("views, slow motion and the speed control", async ({ page }) => {
    await open(page);
    for (const view of ["front", "three", "side"]) {
      await page.locator(`[data-view="${view}"]`).click();
      await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute("aria-pressed", "true");
    }
    // Walking first (it starts from standing).
    for (let i = 0; i < 20; i++) await page.evaluate(() => window.__lab.tick(1 / 30));
    await page.locator('[data-slow="0.25"]').click();
    const before = await page.evaluate(() => window.__lab.state().phase);
    await page.evaluate(() => window.__lab.tick(0.2));
    const after = await page.evaluate(() => window.__lab.state().phase);
    // A quarter speed: 0.2 s moves the cycle about 0.05 (at about one cycle a
    // second).
    const moved = (after - before + 1) % 1;
    expect(moved).toBeGreaterThan(0.02);
    expect(moved).toBeLessThan(0.1);
    await page.locator("#speed").fill("2.5");
    await expect(page.locator('[data-gait="run"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-gait="stand"]').click();
    for (let i = 0; i < 20; i++) await page.evaluate(() => window.__lab.tick(1 / 30));
    expect(await page.evaluate(() => window.__lab.state().anim)).toBe("Idle");
  });

  test("the tuning controls change the gait, keep the feet down, and export and load back", async ({
    page,
  }) => {
    await open(page, "&gait=walk&tuning=default");
    const ticks = async (n) => {
      for (let i = 0; i < n; i++) await page.evaluate(() => window.__lab.tick(1 / 60));
    };
    const lowest = () =>
      page.evaluate(() => {
        const m = window.__lab.lab.model;
        return Math.min(...["foot_l", "foot_r", "ball_l", "ball_r"].map((n) => m.findByName(n).getPosition().dot(m.up))); // prettier-ignore
      });
    const trunk = () =>
      page.evaluate(() => {
        const m = window.__lab.lab.model;
        const d = m.findByName("spine_03").getWorldTransform().getY().normalize();
        return (Math.atan2(d.dot(m.forward.clone().mulScalar(-1)), d.dot(m.up)) * 180) / Math.PI;
      });
    await ticks(70);
    // The defaults are the measured gait: the tuner does nothing.
    expect(await page.evaluate(() => window.__lab.lab.tuner.idle)).toBe(true);
    const before = await trunk();
    const knee0 = await page.evaluate(() => window.__lab.curves().knee);
    // The controls: one per setting, for the gait on show, and the look.
    await page.locator("#tune-toggle").click();
    await expect(page.locator("#tune")).toBeVisible();
    expect(await page.locator("#tune-fields input[type=range]").count()).toBe(16);
    expect(await page.locator("#tune-look input").count()).toBe(4);
    // A slider: the torso leans further.
    await page.locator("#t-walk-lean").fill("13");
    await ticks(2);
    expect((await trunk()) - before).toBeGreaterThan(8);
    // Bigger knee swing: a bigger knee range, and the feet stay on the ground.
    await page.evaluate(() => {
      const t = window.__lab.tuning();
      t.walk.knee.scale = 1.3;
      window.__lab.setTuning(t);
    });
    let low = [Infinity, -Infinity];
    for (let i = 0; i < 70; i++) {
      await ticks(1);
      const y = await lowest();
      low = [Math.min(low[0], y), Math.max(low[1], y)];
    }
    expect(low[0]).toBeGreaterThan(-0.02);
    expect(low[1]).toBeLessThan(0.09);
    const knee1 = await page.evaluate(() => window.__lab.curves().knee);
    expect(span(knee1)).toBeGreaterThan(span(knee0) * 1.15);
    // Export, then load back: the same settings; out-of-range values are
    // clamped; Reset all goes back to the measured gait.
    const text = await page.evaluate(() => window.__lab.exportText());
    const json = JSON.parse(text);
    expect(json.format).toBe("splashery-gait");
    expect(json.version).toBe(1);
    expect(json.walk.lean).toBe(13);
    expect(json.walk.knee.scale).toBe(1.3);
    await page.locator("#tune-reset-all").click();
    expect(await page.evaluate(() => window.__lab.tuning().walk.lean)).toBe(3);
    await page.locator("#tune-text").fill(JSON.stringify({ ...json, run: { lean: 99 } }));
    await page.locator("#tune-load").click();
    const back = await page.evaluate(() => window.__lab.tuning());
    expect(back.walk.lean).toBe(13);
    expect(back.run.lean).toBe(25);
    await expect(page.locator("#tune-msg")).toContainText("Loaded");
  });

  test("Worlds' tuning file is the measured gait, in the lab's format", () => {
    const t = JSON.parse(fs.readFileSync("assets/worlds/character/tuning.json", "utf8"));
    expect(t.format).toBe("splashery-gait");
    expect(t.version).toBe(1);
    const base = META.gait.base;
    for (const [g, b] of [
      ["stand", base.idle],
      ["walk", base.walk],
      ["run", base.run],
    ]) {
      expect(t[g].lean).toBe(b.lean);
      expect(t[g].shoulder.center).toBe(b.shoulder[0]);
      expect(t[g].elbow.center).toBe(b.elbow[0]);
      expect(t[g].armOut).toBe(b.abduct);
    }
    for (const g of ["walk", "run"])
      for (const k of ["bob", "sway", "stride"]) expect(t[g][k]).toBe(1);
    expect(t.look.height).toBe(1.74);
  });

  test("screenshots at 390x844 and 1440x900", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await open(page, "&gait=walk");
      for (let i = 0; i < 40; i++) await page.evaluate(() => window.__lab.tick(1 / 60));
      await page.screenshot({ path: `tests/screenshots/wdr4-lab-${w}x${h}.png`, timeout: 180_000 });
      // With the tuning controls open.
      await page.locator("#tune-toggle").click();
      await page.evaluate(() => window.__lab.tick(1 / 60));
      await page.screenshot({ path: `tests/screenshots/wdr4-lab-tune-${w}x${h}.png`, timeout: 180_000 }); // prettier-ignore
      await page.close();
    }
  });
});
