// Lane Fix4 (docs/handoff/Fix4.md): the clock's hands and the marble's
// glass. tests/taps.spec.mjs already plays each tap through; these check
// what is particular to the fixes.

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

// Splats draw in the order of their centers' depth. The hands are built
// pointing at 12 and turned by drive(); the clock asks for them to be sorted
// where they stand (out.resortPose), so this reads each hand's splats where
// the hand points, and checks that no dial splat whose footprint covers a
// hand splat along the eye's ray sits nearer the eye than it.
test("the clock's hands draw in front of the dial at every hour, from the front and 30° to each side", async () => {
  const { r, kit } = await built("objects", "clock");
  const { findToy } = await import("../src/toys.js");
  const { FIT_RADIUS } = await import("../src/kit.js");
  const home = findToy("clock").camera;
  const buf = kit.buf;
  const partOf = (i) => Math.round(buf.anim[i * 4]) & 15;
  // The dial is the biggest flat disc of splats on the case.
  const flat = kit.items.filter((it) => {
    const zs = [];
    for (let i = it.start; i < it.end; i += 7) zs.push(buf.pos[i * 3 + 2]);
    return partOf(it.start) === 0 && Math.max(...zs) - Math.min(...zs) < 1e-4;
  });
  const dial = flat.sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  expect(dial.end - dial.start).toBeGreaterThan(2000);
  const hands = ["hour", "minute", "second"].map((n) => kit.partIndex.get(n));
  const pivot = kit.parts[hands[0]].pivot;
  const handSplats = [];
  for (let i = 0; i < buf.count; i++) if (hands.includes(partOf(i))) handSplats.push(i);
  expect(handSplats.length).toBeGreaterThan(200);
  const spread = (i) => Math.max(buf.scale[i * 3], buf.scale[i * 3 + 1]);
  let checked = 0;
  for (const dyaw of [0, -Math.PI / 6, Math.PI / 6]) {
    const yaw = home.yaw + dyaw;
    const pitch = home.pitch;
    const back = [
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
      Math.cos(pitch) * Math.cos(yaw),
    ];
    const eye = back.map((x) => x * home.distance * FIT_RADIUS);
    const depth = (p) => (p[0] - eye[0]) * -back[0] + (p[1] - eye[1]) * -back[1] + (p[2] - eye[2]) * -back[2]; // prettier-ignore
    for (let hour = 0; hour < 12; hour++) {
      const a = (-hour / 12) * 2 * Math.PI;
      const [ca, sa] = [Math.cos(a), Math.sin(a)];
      for (const i of handSplats) {
        const x = buf.pos[i * 3] - pivot[0];
        const y = buf.pos[i * 3 + 1] - pivot[1];
        const p = [pivot[0] + x * ca - y * sa, pivot[1] + x * sa + y * ca, buf.pos[i * 3 + 2]];
        const dp = depth(p);
        const ray = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
        for (let j = dial.start; j < dial.end; j++) {
          const q = [buf.pos[j * 3], buf.pos[j * 3 + 1], buf.pos[j * 3 + 2]];
          // Where the eye's ray through the hand splat meets the dial.
          const t = (q[2] - eye[2]) / ray[2];
          const hx = eye[0] + ray[0] * t;
          const hy = eye[1] + ray[1] * t;
          const reach = 2 * spread(j) + spread(i);
          if ((q[0] - hx) ** 2 + (q[1] - hy) ** 2 > reach * reach) continue;
          checked++;
          if (depth(q) < dp) throw new Error(`a dial splat sorts in front of a hand at ${hour || 12} o'clock (yaw ${yaw.toFixed(2)})`); // prettier-ignore
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(1000);
  // And it does ask for the hands to be sorted where they stand: on the
  // first frame, then once each time the second hand has ticked, not on
  // every frame.
  const data = {};
  const asks = [];
  const RealDate = globalThis.Date;
  try {
    for (let f = 0; f < 60; f++) {
      const now = new RealDate(2026, 8, 30, 1, 52, 20).getTime() + f * 50;
      globalThis.Date = class extends RealDate {
        constructor(...a) {
          super(...(a.length ? a : [now]));
        }
      };
      const out = { parts: {}, glow: [0, 0, 0, 0], cues: [], fx: {} };
      r.drive(f / 20, { ring: 0 }, out, { time: f / 20, R: 1, tap: null, data });
      asks.push(!!out.resortPose);
    }
  } finally {
    globalThis.Date = RealDate;
  }
  expect(asks.filter(Boolean).length).toBe(4);
});

// The glass reads as glass: a crisp rim brighter than the face inside it on
// a dark page, and a darker edge line on a light page, with the face itself
// nearly clear.
test("the marble's glass shows a rim on a dark page and on a light one", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("marble"));
  await expect(page.locator("#toy-status")).toHaveText(/^Marble/, { timeout: 180_000 });
  const profile = async (bg) =>
    page.evaluate(async (bg) => {
      const { app, player } = window.__splashery;
      app.setLook({ background: bg });
      player.opts.idleDelay = 1e9;
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      const c = await player.stage.captureFrame();
      const { width: w, height: h } = c;
      const px = c.getContext("2d").getImageData(0, 0, w, h).data;
      const lum = (x, y) => {
        const i = (Math.round(y) * w + Math.round(x)) * 4;
        return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      };
      const bgL = lum(2, 2);
      // The ball: every pixel that differs from the page.
      let [x0, x1, y0, y1] = [w, 0, h, 0];
      for (let y = 0; y < h; y += 2)
        for (let x = 0; x < w; x += 2)
          if (Math.abs(lum(x, y) - bgL) > 6) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const R = Math.min(x1 - x0, y1 - y0) / 2;
      // Mean brightness round a circle at a fraction of the radius, and
      // the brightest ring near the edge.
      const ring = (f) => {
        let s = 0;
        for (let k = 0; k < 360; k++)
          s += lum(cx + Math.cos(k * 0.01745) * R * f, cy + Math.sin(k * 0.01745) * R * f);
        return s / 360;
      };
      const rims = [];
      for (let f = 0.88; f <= 1.0; f += 0.01) rims.push(ring(f));
      return { bg: bgL, R, face: ring(0.84), hi: Math.max(...rims), lo: Math.min(...rims) };
    }, bg);
  const dark = await profile("#111111");
  expect(dark.R).toBeGreaterThan(60);
  // On a dark page: a bright rim, well above the face inside it.
  expect(dark.hi - dark.bg).toBeGreaterThan(2 * (dark.face - dark.bg));
  expect(dark.hi - dark.bg).toBeGreaterThan(40);
  const light = await profile("#f4f1ea");
  // On a light page: a darker line at the edge, darker than the face, and
  // the face stays close to the page (clear, not a cloud).
  expect(light.bg - light.lo).toBeGreaterThan(1.5 * (light.bg - light.face));
  expect(light.bg - light.face).toBeLessThan(40);
});

// The lane's screenshots (fx4-*.png): the clock at 1:52 (the time its hour
// hand used to vanish) and the marble, on a phone and on a desktop.
const SHOTS = path.resolve("tests/screenshots");
for (const [id, label] of [
  ["clock", "Alarm clock"],
  ["marble", "Marble"],
]) {
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
      const problems = [];
      page.on("pageerror", (e) => problems.push(e.message));
      // The clock's hands at 1:52 (only Date is fixed; the page's timers run).
      await page.addInitScript(() => {
        const RealDate = Date;
        const at = new RealDate(2026, 8, 30, 1, 52, 20).getTime() - RealDate.now();
        window.Date = class extends RealDate {
          constructor(...a) {
            super(...(a.length ? a : [RealDate.now() + at]));
          }
        };
      });
      await page.goto("/?renderer=webgl2&profile=weak");
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
      await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), { timeout: 180_000 }); // prettier-ignore
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `fx4-${id}-${w}x${h}.png`) });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
}
