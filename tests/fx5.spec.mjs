// Lane Fix5 (docs/handoff/Fix5.md): the balloon dog's flag colors, the real
// alarm clock's hand, the Klein bottle's tap, the kit clock's time zone and
// some help text. tests/taps.spec.mjs already plays each tap through; these
// check what is particular to the fixes.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function built(pack, id, options = {}) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import(`../src/packs/${pack}.js`);
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 60000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit };
}

async function open(page, id, extra = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?renderer=webgl2&profile=weak${extra}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
  await page.waitForTimeout(1500);
  return errors;
}

test("the balloon dog's scraps take the pattern layer, from the skin they came from", async () => {
  const { kit } = await built("playthings", "balloon-dog");
  const buf = kit.buf;
  const bits = kit.parts.map((p, i) => [p.name, i]).filter(([n]) => n.startsWith("bit"));
  expect(bits.length).toBe(6);
  const bitIdx = new Set(bits.map(([, i]) => i));
  let n = 0;
  for (let i = 0; i < buf.count; i++) {
    const pk = Math.round(buf.anim[i * 4]);
    if (!bitIdx.has(pk & 15)) continue;
    n++;
    // No "keep out of the pattern" flag: a flag theme colors them too.
    expect(pk & 16).toBe(0);
  }
  expect(n).toBeGreaterThan(50);
});

test("a flag theme colors the popped pieces like the balloon", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page, "balloon-dog");
  // A green balloon with Albania's flag on it (red, with a black eagle).
  const px = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.setToyOption("color", "#2e9e44");
    await app.setPattern({ id: "flag", flag: "al" });
    app.setLook({ background: "#111111" });
    await new Promise((r) => setTimeout(r, 1500));
    player.opts.idleDelay = 1e9;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    player.act(null);
    pending = 0.35;
    await stage.captureFrame();
    const c = await stage.captureFrame();
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let [red, green] = [0, 0];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > d[i + 1] + 60 && d[i] > d[i + 2] + 60) red++;
      if (d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 20) green++;
    }
    return { red, green };
  });
  // Mid-pop the scraps are flying: they read red, not the green setting.
  expect(px.red).toBeGreaterThan(200);
  expect(px.green).toBeLessThan(px.red / 10);
  expect(errors).toEqual([]);
});

test("the real alarm clock's hand turns as one kit-built piece, and its name is its own", async () => {
  const { TOYS } = await import("../src/toys.js");
  const labels = TOYS.filter((t) => /alarm clock/i.test(t.label)).map((t) => [t.id, t.label]);
  expect(labels).toEqual(
    expect.arrayContaining([
      ["alarm-clock", "Real alarm clock"],
      ["clock", "Alarm clock"],
    ]),
  );
  const { RIGS } = await import("../src/rigs.js");
  const rig = RIGS["alarm-clock"];
  const out = { parts: {}, glow: [0, 0, 0, 0], cues: [], fx: {}, addon: null };
  rig.drive(12.5, { ring: 0 }, out, { time: 12.5, data: null });
  // The scanned hand is hidden and stays put; the add-on's hand ticks.
  expect(out.parts.second).toEqual({ angle: 0, visible: 0 });
  expect(out.addon.parts.hand.angle).toBeCloseTo((13 / 60) * 2 * Math.PI, 2);
  // The add-on is one hand: every splat of it is on the part "hand".
  const { Kit } = await import("../src/kit.js");
  const k = new Kit(1, { count: rig.addon.count, fit: false });
  rig.addon.build(k);
  const it = k.emit();
  while (!it.next().done);
  expect(k.parts.map((p) => p.name)).toEqual(["body", "hand"]);
  for (let i = 0; i < k.buf.count; i++) expect(Math.round(k.buf.anim[i * 4]) & 15).toBe(1);
});

test("a tap on the Klein bottle's glass sets off its effect", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await open(page, "klein-bottle");
  const r = await page.evaluate(async () => {
    const { player } = window.__splashery;
    player.opts.idleDelay = 1e9;
    player.camera.cur = { ...player.camera.home };
    player.camera.tgt = { ...player.camera.home };
    await new Promise((res) => setTimeout(res, 500));
    const canvas = player.stage.canvas || document.querySelector("canvas");
    const box = { width: canvas.clientWidth, height: canvas.clientHeight };
    // Taps round the middle of the bottle, on the glass.
    const hits = [];
    for (const [fx, fy] of [
      [0.5, 0.45],
      [0.45, 0.5],
      [0.55, 0.4],
    ]) {
      player.pickDirty = true;
      const hit = await player.pickAt(box.width * fx, box.height * fy);
      hits.push(!!hit);
    }
    return { hits, pickAlpha: player.toyInfo?.recipe?.pickAlpha };
  });
  expect(r.pickAlpha).toBeLessThan(0.28);
  expect(r.hits.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("the help says what the torus knot and the CNN's pad do", async () => {
  const { TOY_HELP } = await import("../src/toy-help.js");
  expect(TOY_HELP["torus-knot"].howTo).toMatch(/^Tap it/);
  expect(TOY_HELP["torus-knot"].howTo).toMatch(/Drag to turn it/);
  expect(TOY_HELP.cnn.about).toMatch(/Each square on the drawing pad is one pixel/);
});

test("the kit clock shows the time in the zone picked, this device's by default", async () => {
  const { r, kit } = await built("objects", "clock");
  const zone = r.options.find((o) => o.key === "zone");
  expect(zone.default).toBe("local");
  expect(zone.choices.map((c) => c.id)).toEqual(expect.arrayContaining(["local", "UTC", "Asia/Tokyo"])); // prettier-ignore
  expect(kit.data.zone).toBe(null);
  const hourAt = (z, when) => {
    const RealDate = globalThis.Date;
    globalThis.Date = class extends RealDate {
      constructor(...a) {
        super(...(a.length ? a : [when]));
      }
    };
    try {
      const out = { parts: {}, glow: [0, 0, 0, 0], cues: [], fx: {} };
      r.drive(1, { ring: 0 }, out, { time: 1, data: { zone: z } });
      return ((((-out.parts.hour.angle / (2 * Math.PI)) * 12) % 12) + 12) % 12;
    } finally {
      globalThis.Date = RealDate;
    }
  };
  const when = Date.UTC(2026, 8, 30, 3, 0, 0); // 3:00 UTC
  expect(hourAt("UTC", when)).toBeCloseTo(3, 3);
  expect(hourAt("Asia/Tokyo", when)).toBeCloseTo(0, 3); // 12:00 in Tokyo
  expect(hourAt("America/New_York", when)).toBeCloseTo(11, 3); // 23:00 the day before
  // An unknown zone falls back to this device's time instead of failing.
  const local = new Date(when);
  expect(hourAt("Not/AZone", when)).toBeCloseTo((local.getHours() % 12) + local.getMinutes() / 60, 3); // prettier-ignore
  // Built with a zone picked, the build hands it to drive().
  const { kit: k2 } = await built("objects", "clock", { zone: "Asia/Tokyo" });
  expect(k2.data.zone).toBe("Asia/Tokyo");
});

// The lane's screenshots (fx5-*.png), on a phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const id of ["alarm-clock", "klein-bottle"]) {
  test(`${id} screenshots at 390x844 and 1440x900`, async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [w, h, mobile] of [
      [390, 844, true],
      [1440, 900, false],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        ...(mobile ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      const errors = await open(page, id);
      await page.screenshot({ path: path.join(SHOTS, `fx5-${id}-${w}x${h}.png`) });
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });
}
