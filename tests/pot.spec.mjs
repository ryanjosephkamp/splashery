// Lane Powers of ten (docs/handoff/Powers.md): the zoom's stops against
// their evidence (docs/evidence/powers-of-ten.json), the sky at the zoom's
// moment against known values, and the toy in the app: it opens with only
// the scenes near home, the zoom gestures move through the stops, and the
// label and scale bar follow.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { STOPS, Z_MIN, Z_MAX, Z_HOME, stopAt } from "../src/powers/stops.js";
import * as SKY from "../src/powers/sky.js";

const evidence = JSON.parse(
  fs.readFileSync(new URL("../docs/evidence/powers-of-ten.json", import.meta.url), "utf8"),
);

// A size as the labels write it ("12,700 km", "One light-year", "25 nm") in meters.
const UNITS = {
  "light-years": SKY.LY,
  "light-year": SKY.LY,
  AU: SKY.AU,
  km: 1e3,
  m: 1,
  cm: 1e-2,
  mm: 1e-3,
  µm: 1e-6,
  nm: 1e-9,
};
function meters(text) {
  const m = text.match(/^(one|[\d,.]+)\s+(light-years?|AU|km|m|cm|mm|µm|nm)$/i);
  if (!m) return NaN;
  const v = m[1].toLowerCase() === "one" ? 1 : Number(m[1].replace(/,/g, ""));
  return v * UNITS[m[2]];
}

test.describe("the stops and their evidence (no browser)", () => {
  test("every stop has its evidence, with the same label and size", () => {
    const byId = new Map(evidence.stops.map((s) => [s.id, s]));
    expect(evidence.stops.length).toBe(STOPS.length);
    for (const s of STOPS) {
      const ev = byId.get(s.id);
      expect(ev, s.id).toBeTruthy();
      expect(ev.label, s.id).toBe(s.label);
      expect(ev.size_m, s.id).toBeCloseTo(s.size, -Math.floor(Math.log10(s.size)) + 3);
      expect(ev.sources.length, s.id).toBeGreaterThan(0);
      for (const src of ev.sources) expect(src.url, s.id).toMatch(/^https:\/\//);
    }
  });

  test("the size each label names is the stop's size, within its rounding", () => {
    for (const s of STOPS) {
      const ev = evidence.stops.find((e) => e.id === s.id);
      expect(s.label, s.id).toContain(ev.sizeInLabel);
      const m = meters(ev.sizeInLabel);
      expect(Number.isFinite(m), `${s.id}: ${ev.sizeInLabel}`).toBe(true);
      // Within 5 percent (labels say "about").
      expect(Math.abs(m / s.size - 1), s.id).toBeLessThan(0.05);
      // And the stop's own power of ten is near its size.
      expect(Math.abs(Math.log10(s.size) - s.e), s.id).toBeLessThan(1.2);
    }
  });

  test("the stops run from the largest to the smallest and cover the zoom", () => {
    for (let i = 1; i < STOPS.length; i++) expect(STOPS[i].e).toBeLessThan(STOPS[i - 1].e);
    expect(Z_MAX).toBeGreaterThanOrEqual(21);
    expect(Z_MIN).toBeLessThanOrEqual(-7.5);
    expect(Z_HOME).toBeGreaterThan(Z_MIN);
    expect(stopAt(Z_MAX).id).toBe("galaxy");
    expect(stopAt(Z_MIN).id).toBe(STOPS[STOPS.length - 1].id);
    expect(stopAt(7.1).id).toBe("earth");
  });

  test("the sky at the zoom's moment: the Sun, the Moon and the planets where they belong", () => {
    const len = (v) => Math.hypot(v[0], v[1], v[2]);
    const alt = (v) => 90 - (Math.acos(v[2] / len(v)) * 180) / Math.PI;
    expect(new Date(SKY.MOMENT).toISOString()).toBe("2026-10-07T16:54:00.000Z");
    // Local noon in Washington in early October: the Sun about 45 degrees up
    // (90 - 38.9 latitude - 5.6 declination), 1 AU away.
    expect(alt(SKY.SUN)).toBeGreaterThan(44);
    expect(alt(SKY.SUN)).toBeLessThan(47);
    expect(len(SKY.SUN) / SKY.AU).toBeCloseTo(1.0, 1);
    // The Moon 356,000 to 407,000 km from the Earth's center.
    const moon = len(SKY.MOON.map((x, i) => x - SKY.EARTH[i]));
    expect(moon).toBeGreaterThan(3.56e8);
    expect(moon).toBeLessThan(4.07e8);
    // The galactic pole is within 15 degrees of straight up (the galaxy lies nearly flat).
    expect(alt(SKY.GALACTIC.z)).toBeGreaterThan(75);
    // Each planet's distance from the Sun within its orbit's perihelion and aphelion.
    for (const p of SKY.PLANETS) {
      const d = len(SKY.planetAt(p).map((x, i) => x - SKY.SUN[i])) / SKY.AU;
      const [a, e] = p.el;
      expect(d, p.id).toBeGreaterThan(a * (1 - e) * 0.999);
      expect(d, p.id).toBeLessThan(a * (1 + e) * 1.001);
    }
  });
});

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";

async function open(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("powers-of-ten"));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.id === "powers-of-ten" && !window.__splashery.player.loading); // prettier-ignore
}

async function settle(page) {
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player;
      p.stage.requestRender();
      const it = [...(p.chunks?.items.values() || [])];
      return it.length > 1 && it.every((x) => x.state !== "loading");
    },
    null,
    { timeout: 180_000 },
  );
}

test.describe("Powers of ten in the app", () => {
  test("opens light: only the files of the scenes near home (under 8 MB)", async ({ page }) => {
    const sizes = new Map();
    page.on("response", async (res) => {
      if (!/\/assets\//.test(res.url())) return;
      try {
        sizes.set(res.url(), (await res.body()).length);
      } catch {
        // redirects have no body
      }
    });
    await page.goto("/?renderer=webgl2&adapt=off&profile=high&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    sizes.clear();
    await page.evaluate(() => window.__splashery.app.chooseToy("powers-of-ten"));
    await settle(page);
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    const names = [...sizes.keys()].map((u) => u.split("/").pop());
    expect(names.some((n) => n.startsWith("micro-") || n.includes("stars") || n === "m83.jpg")).toBe(false); // prettier-ignore
    expect(total).toBeLessThan(8e6);
  });

  test("opens at the garden with only the scenes near it, and labels them", async ({ page }) => {
    await open(page);
    await settle(page);
    const s = await page.evaluate(() => {
      const p = window.__splashery.player;
      return {
        ids: [...p.chunks.items.keys()],
        legend: document.querySelector("#toy-legend")?.innerText || "",
        ruler: document.querySelector("#toy-legend .toy-legend-ruler")?.getBoundingClientRect().width || 0, // prettier-ignore
        camera: p.camera.tgt.distance,
      };
    });
    // Near home: the garden bed and the aerial pictures round it, nothing of space or cells.
    expect(s.ids).toContain("bed");
    expect(s.ids).toContain("aerial-1.5");
    expect(s.ids.some((id) => ["galaxy", "earth", "ribosome", "stars-local"].includes(id))).toBe(false); // prettier-ignore
    expect(s.legend).toContain("10⁰ m");
    expect(s.legend).toContain("garden bed");
    expect(s.ruler).toBeGreaterThan(8);
  });

  test("the wheel zooms through the stops; the camera never moves", async ({ page }) => {
    await open(page);
    await settle(page);
    const d0 = await page.evaluate(() => window.__splashery.player.camera.tgt.distance);
    const box = await page.locator("canvas").first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    // Out: a few decades (four decades per e-fold of the wheel's zoom).
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 120);
    await page.waitForFunction(() => /10[²³⁴⁵] m/.test(document.querySelector("#toy-legend")?.innerText || "")); // prettier-ignore
    await settle(page);
    const s = await page.evaluate(() => ({
      legend: document.querySelector("#toy-legend").innerText,
      ids: [...window.__splashery.player.chunks.items.keys()],
      d: window.__splashery.player.camera.tgt.distance,
    }));
    expect(s.d).toBeCloseTo(d0, 6);
    expect(s.legend).toMatch(/Haupt Garden|National Mall|Washington/);
    expect(s.ids.some((id) => /^aerial-[345]/.test(id))).toBe(true);
    // And back in: the garden again.
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -120);
    await page.waitForFunction(() => (document.querySelector("#toy-legend")?.innerText || "").includes("garden bed")); // prettier-ignore
  });

  test("the slider goes to the galaxy and to the ribosome", async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.__splashery.player.sliderInput("zoom", 0));
    await page.waitForFunction(() => (document.querySelector("#toy-legend")?.innerText || "").includes("10²¹ m")); // prettier-ignore
    await settle(page);
    expect(await page.evaluate(() => document.querySelector("#toy-legend").innerText)).toContain("Milky Way"); // prettier-ignore
    await page.evaluate(() => window.__splashery.player.sliderInput("zoom", 1));
    await page.waitForFunction(() => (document.querySelector("#toy-legend")?.innerText || "").includes("ribosome")); // prettier-ignore
    await settle(page);
    // The far scenes were freed on the way.
    const ids = await page.evaluate(() => [...window.__splashery.player.chunks.items.keys()]);
    expect(ids).not.toContain("galaxy");
    expect(ids).toContain("ribosome");
  });

  test("a tap plays the journey: out from the garden first", async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForFunction(
      () => /10(⁴|⁵|⁶|⁷) m/.test(document.querySelector("#toy-legend")?.innerText || ""),
      null,
      { timeout: 120_000 },
    );
  });
});
