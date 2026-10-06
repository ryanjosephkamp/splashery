// Lane Fix8 (docs/handoff/Fix8.md): the real alarm clock tells the time. Its
// scanned hands are hidden and kit-built hour, minute and second hands show
// this device's time. tests/taps.spec.mjs already plays its tap through;
// these check the hands.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const TAU = Math.PI * 2;
// 3:40:45.6 in the afternoon, on a page in Chicago (CDT, UTC-5): far from
// where the scanned hands lie (the hour hand near 5, the minute hand near
// 10, the second hand near 1), so the dial shows whether they are gone.
const ZONE = "America/Chicago";
const WHEN = new Date("2026-10-05T20:40:45.600Z");
const HOUR = ((3 + 40.75 / 60) / 12) * TAU;
const MINUTE = (40.75 / 60) * TAU;
const SECOND = (45 / 60) * TAU;

async function openClock(page, extra = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { encodeSceneHash } = await import("../src/codec.js");
  const { createScene } = await import("../src/state.js");
  const scene = createScene();
  scene.toy = { kind: "builtin", id: "alarm-clock" };
  await page.goto(`/?renderer=webgl2&profile=weak${extra}#s=${await encodeSceneHash(scene)}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await expect(page.locator("#toy-status")).toHaveText(/^Real alarm clock/, { timeout: 180_000 });
  return errors;
}

test("the hands' angles come from this device's clock, a step a second", async () => {
  const { RIGS, clockHands } = await import("../src/rigs.js");
  const at = (h, m, s, ms) => clockHands(new Date(2026, 9, 5, h, m, s, ms));
  const a = at(15, 40, 45, 600);
  expect(a.hour.angle).toBeCloseTo(HOUR, 4);
  expect(a.minute.angle).toBeCloseTo(MINUTE, 4);
  expect(a.second.angle).toBeCloseTo(SECOND, 4);
  // The second hand rests on its mark all through the second, then steps
  // to the next one within a tenth of a second (a quartz-style tick).
  expect(at(15, 40, 45, 300).second.angle).toBeCloseTo(SECOND, 3);
  expect(at(15, 40, 45, 999).second.angle).toBeCloseTo(SECOND, 3);
  expect(at(15, 40, 46, 0).second.angle).toBeCloseTo(SECOND, 3);
  expect(at(15, 40, 46, 150).second.angle).toBeCloseTo((46 / 60) * TAU, 2);
  // Twelve and midnight are straight up; half past six is straight down.
  expect(at(0, 0, 0, 500).hour.angle).toBeCloseTo(0, 6);
  expect(at(12, 0, 0, 500).hour.angle).toBeCloseTo(0, 6);
  expect(at(18, 30, 0, 500).minute.angle).toBeCloseTo(Math.PI, 6);
  // drive() hides the scanned hands and turns the kit ones, ringing or not.
  for (const ring of [0, 0.5]) {
    const out = { parts: {}, glow: [0, 0, 0, 0], cues: [], fx: {}, addon: null };
    RIGS["alarm-clock"].drive(3, { ring }, out, { time: 3, data: null });
    expect(out.parts.second).toEqual({ angle: 0, visible: 0 });
    expect(Object.keys(out.addon.parts)).toEqual(["hour", "minute", "second"]);
  }
});

test("each kit-built hand is one solid piece", async () => {
  const { RIGS } = await import("../src/rigs.js");
  const { Kit } = await import("../src/kit.js");
  const rig = RIGS["alarm-clock"];
  const k = new Kit(1, { count: rig.addon.count, fit: false });
  rig.addon.build(k);
  const it = k.emit();
  while (!it.next().done);
  expect(k.parts.map((p) => p.name)).toEqual(["body", "hour", "minute", "second"]);
  // Every splat is on a hand (none left on the body), each hand turns
  // about the center of the dial, and the hands stack hour, minute, second.
  const z = [[], [], [], []];
  for (let i = 0; i < k.buf.count; i++) {
    const part = Math.round(k.buf.anim[i * 4]) & 15;
    expect(part).toBeGreaterThan(0);
    z[part].push(k.buf.pos[i * 3 + 2]);
  }
  for (const p of k.parts.slice(1)) expect(p.pivot).toEqual([0, -0.186, 0.21]);
  expect(Math.max(...z[1])).toBeLessThan(Math.min(...z[2]));
  expect(Math.max(...z[2])).toBeLessThan(Math.min(...z[3]));
});

test("on the page, the hands show the page's time, upright, on its side and upside down", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: ZONE }); // prettier-ignore
  const page = await ctx.newPage();
  await page.clock.setFixedTime(WHEN);
  const errors = await openClock(page);
  const r = await page.evaluate(
    async ({ HOUR, MINUTE, SECOND }) => {
      const { player } = window.__splashery;
      const pc = await import("/src/pc.js");
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      player.camera.tiltLock = false;
      const stage = player.stage;
      const cam = stage.cameraEntity.camera;
      // A point on the dial at an angle clockwise from twelve, a share of
      // the way out (the dial's face is at z = 0.193; the hands just above).
      const on = (angle, r, z = 0.23) => [Math.sin(angle) * r, -0.186 + Math.cos(angle) * r, z];
      const look = async (roll) => {
        player.camera.setState({ yaw: 0, pitch: 0, roll, distance: 2.6 }, { snap: true });
        await new Promise((res) => setTimeout(res, 300));
        await stage.captureFrame();
        const c = await stage.captureFrame();
        const g = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const sx = c.width / stage.app.graphicsDevice.canvas.clientWidth;
        const sy = c.height / stage.app.graphicsDevice.canvas.clientHeight;
        const px = (p) => {
          const s = cam.worldToScreen(new pc.Vec3(...p));
          const x = Math.round(s.x * sx);
          const y = Math.round(s.y * sy);
          const i = (y * c.width + x) * 4;
          return [g[i], g[i + 1], g[i + 2]];
        };
        const lum = (p) => {
          const [r, gg, b] = px(p);
          return (r + gg + b) / 3;
        };
        const red = (p) => {
          const [r, gg] = px(p);
          return r - gg;
        };
        return {
          // The kit hands where the time puts them.
          hour: [0.15, 0.22].map((f) => lum(on(HOUR, f))),
          minute: [0.2, 0.3, 0.5].map((f) => lum(on(MINUTE, f))),
          second: [0.25, 0.45].map((f) => red(on(SECOND, f))),
          // Where the scanned hands were: bare dial now.
          oldHour: [0.15, 0.22, 0.31].map((f) => lum(on((158.4 / 180) * Math.PI, f, 0.2))),
          oldMinute: [0.2, 0.3, 0.4].map((f) => lum(on((-59.5 / 180) * Math.PI, f, 0.2))),
          oldSecond: [0.25, 0.45].map((f) => red(on((24 / 180) * Math.PI, f, 0.2))),
          angles: Object.fromEntries(
            Object.entries(player.motion.out.addon.parts).map(([k, v]) => [k, v.angle]),
          ),
          hidden: player.motion.out.parts.second,
        };
      };
      return { upright: await look(0), side: await look(Math.PI / 2), down: await look(Math.PI) };
    },
    { HOUR, MINUTE, SECOND },
  );
  for (const [pose, v] of Object.entries(r)) {
    const where = `${pose}: ${JSON.stringify(v)}`;
    expect(v.angles.hour, where).toBeCloseTo(HOUR, 3);
    expect(v.angles.minute, where).toBeCloseTo(MINUTE, 3);
    expect(v.angles.second, where).toBeCloseTo(SECOND, 3);
    expect(v.hidden).toEqual({ angle: 0, visible: 0 });
    for (const l of [...v.hour, ...v.minute]) expect(l, where).toBeLessThan(90);
    for (const d of v.second) expect(d, where).toBeGreaterThan(80);
    for (const l of [...v.oldHour, ...v.oldMinute]) expect(l, where).toBeGreaterThan(120);
    for (const d of v.oldSecond) expect(d, where).toBeLessThan(60);
  }
  expect(errors).toEqual([]);
  await ctx.close();
});

test("an old version 2 link to the real alarm clock still opens", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { encodeSceneHash } = await import("../src/codec.js");
  const hash = await encodeSceneHash({
    app: "splashery",
    version: 2,
    seed: 7,
    toy: { kind: "builtin", id: "alarm-clock" },
    autoplay: { turntable: false, effect: "none" },
  });
  await page.goto(`/?renderer=webgl2&profile=weak#s=${hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await expect(page.locator("#toy-status")).toHaveText(/^Real alarm clock/, { timeout: 180_000 });
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(window.__splashery.player.motion.out?.addon?.parts || {})),
    ) // prettier-ignore
    .toEqual(["hour", "minute", "second"]);
  const s = await page.evaluate(() => window.__splashery.exportScene());
  expect(s.version).toBe(3);
  expect(s.toy).toMatchObject({ kind: "builtin", id: "alarm-clock" });
  expect(errors).toEqual([]);
});

// The lane's screenshots (fx8-*.png), on a phone and on a desktop, with the
// page clock at 3:40:45.
const SHOTS = path.resolve("tests/screenshots");
test("alarm-clock screenshots at 390x844 and 1440x900", async ({ browser }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h, mobile] of [
    [390, 844, true],
    [1440, 900, false],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      timezoneId: ZONE,
      ...(mobile ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(WHEN);
    const errors = await openClock(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, `fx8-alarm-clock-${w}x${h}.png`) });
    expect(errors).toEqual([]);
    await ctx.close();
  }
});
