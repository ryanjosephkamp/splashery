// Lane QR r5 (docs/handoff/QRr5.md): the October 10, 2026 walkthrough's QR
// notes. Picture QR's ripple keeps the picture's colors; the Damage lab puts a
// tapped sticker, smudge, tear or burn where the tap says, and its meter still
// agrees with jsQR; Three codes in one reads each code pulled apart, in the
// colors the person picks, with each white card a clear layer behind its
// modules (the white streaks); and the sound changes.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { parseDamage, formatDamage } from "../src/packs/qr-lab.js";
import { tearFrom, burnFrom } from "../src/qr-lab/damage.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const read = (rgba, w, h) =>
  jsQR(new Uint8ClampedArray(rgba), w, h, { inversionAttempts: "dontInvert" })?.data ?? null;

async function open(page, id) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.app.player.toyInfo?.id === id && !window.__splashery.app.busy, id, { timeout: 60_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.qrLab && (window.__splashery.qrLab.autoCheck = false)); // prettier-ignore
  return errors;
}

// Takes the stage's clock: frames then step by hand (as tools/effect-clip.mjs
// does), at a fixed drawing size, so a test sees the same moment of a motion
// however slow the renderer is.
async function holdClock(page, size) {
  await page.evaluate(async (size) => {
    const { player } = window.__splashery;
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    const box = { pending: 0 };
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = box.pending;
      box.pending = 0;
      for (const h of handlers) h(d);
    });
    stage.setFixedSize(size);
    const home = { ...player.camera.home };
    window.__qr5 = {
      // Moves the clock on by secs, in steps, and returns the last frame's pixels.
      async step(secs, fps = 10) {
        let c;
        for (let t = 0; t < secs - 1e-6; t += 1 / fps) {
          box.pending = 1 / fps;
          player.camera.cur = { ...home };
          player.camera.tgt = { ...home };
          await stage.captureFrame();
          box.pending = 0;
          c = await stage.captureFrame();
        }
        if (!c) c = await stage.captureFrame();
        const g = c.getContext("2d");
        return { w: c.width, h: c.height, data: Array.from(g.getImageData(0, 0, c.width, c.height).data) }; // prettier-ignore
      },
      toWorld(p) {
        const tf = player.motion.ctx.transform;
        return [p[0], p[1], p[2] ?? 0].map((v, i) => (v - tf.center[i]) * tf.scale);
      },
    };
  }, size);
}

// The share of clearly colored pixels (saturation over 0.3 and not dark) in
// the middle of a frame.
function colorful(img) {
  let n = 0;
  let all = 0;
  for (let y = Math.round(img.h * 0.3); y < img.h * 0.7; y++)
    for (let x = Math.round(img.w * 0.3); x < img.w * 0.7; x++) {
      const i = (y * img.w + x) * 4;
      const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      all++;
      if (mx > 60 && (mx - mn) / mx > 0.3) n++;
    }
  return n / all;
}

test("Picture QR: the ripple keeps every module's picture colors", async ({ page }) => {
  test.setTimeout(400_000);
  const errors = await open(page, "qr-picture");
  // The automatic scan check finishes first (its cover is up until then).
  await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
  await page.waitForTimeout(3000);
  await holdClock(page, [390, 844]);
  const rest = await page.evaluate(() => window.__qr5.step(0.5));
  await page.evaluate(() => window.__splashery.app.player.act(window.__qr5.toWorld([0, 0])));
  // Mid-ripple: the wave is out over the middle of the code.
  const shares = [];
  for (let k = 0; k < 4; k++) shares.push(colorful(await page.evaluate(() => window.__qr5.step(0.4)))); // prettier-ignore
  const r0 = colorful(rest);
  expect(r0).toBeGreaterThan(0.2);
  // Before lane QR r5 the tiles inside the wave showed the plain code (black
  // and white), and the share of colored pixels fell to about a third.
  for (const s of shares) expect(s, `rest ${r0.toFixed(3)}, ripple ${shares.map((x) => x.toFixed(3))}`).toBeGreaterThan(r0 * 0.75); // prettier-ignore
  expect(errors).toEqual([]);
});

test("the Damage lab's damage string keeps tapped places and reads old links", () => {
  expect(parseDamage("tear:0.4:corner:1;smudge:0.5:center:2")).toEqual([
    { kind: "tear", amount: 0.4, region: "corner", seed: 1 },
    { kind: "smudge", amount: 0.5, region: "center", seed: 2 },
  ]);
  const list = parseDamage("sticker:0.12:all:1:7,-6;blur:0.24:all:2:3,3");
  expect(list[0].at).toEqual([7, -6]);
  expect(list[1].at).toBeUndefined(); // blur is a whole-code damage
  expect(formatDamage(list)).toBe("sticker:0.12:all:1:7,-6;blur:0.24:all:2");
  // A tear starts from the corner near a tap there, else from the nearest edge.
  expect(tearFrom([-12, 12], 29)).toEqual({ corner: [-14.5, 14.5] });
  expect(tearFrom([13, 1], 29)).toEqual({ edge: [1, 0], along: 1 });
  expect(tearFrom([2, -13], 29)).toEqual({ edge: [0, -1], along: 2 });
  expect(burnFrom([2, -13], 29)).toEqual([14.5, -14.5]);
});

// Taps the code at recipe points with a tool, then checks where the wrong
// modules are and that the meter agrees with jsQR in Node.
async function tapDamage(page, tool, points) {
  await page.evaluate((tool) => window.__splashery.app.player.switchTo({ options: { tool, damage: "", level: "M", show: "damaged" }, key: "drop", value: 1 }), tool); // prettier-ignore
  await page.waitForTimeout(2500);
  for (const p of points) {
    await page.evaluate((p) => {
      const tf = window.__splashery.app.player.motion.ctx.transform;
      window.__splashery.app.player.act([p[0], p[1], 0].map((v, i) => (v - tf.center[i]) * tf.scale)); // prettier-ignore
    }, p);
    await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 60_000 });
    await page.waitForTimeout(3500); // the damage lands
  }
  const r = await page.evaluate(async () => {
    const q = window.__splashery.qrLab;
    const c = await q.checkDamage();
    const img = q.lastShot();
    const { codes, options } = q.damage();
    return { damage: options.damage, size: codes[0].size, scans: c.codes[0].scans, wrong: c.codes[0].analysis.wrong, w: img.width, h: img.height, data: Array.from(img.data) }; // prettier-ignore
  });
  expect(r.scans, r.damage).toBe(read(r.data, r.w, r.h) === "https://ryanjosephkamp.github.io/splashery/"); // prettier-ignore
  // The wrong modules in code units (x right, y up, from the center).
  const N = r.size;
  r.at = r.wrong.map((i) => [(i % N) - N / 2 + 0.5, N / 2 - 0.5 - Math.floor(i / N)]);
  r.mean = r.at.reduce((m, p) => [m[0] + p[0] / r.at.length, m[1] + p[1] / r.at.length], [0, 0]); // prettier-ignore
  return r;
}

test("the Damage lab: tapped damage lands where the tap says", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await open(page, "qr-damage");
  // A sticker where you tap (lower right of the middle).
  let r = await tapDamage(page, "sticker", [
    [6, -5],
    [6, -5],
  ]);
  expect(r.damage).toMatch(/^sticker:0\.24:all:1:6,-5$/);
  expect(r.wrong.length).toBeGreaterThan(0);
  expect(Math.hypot(r.mean[0] - 6, r.mean[1] + 5), JSON.stringify(r.mean)).toBeLessThan(2.5);
  // A smudge where you tap (upper left of the middle).
  r = await tapDamage(page, "smudge", [
    [-6, 5],
    [-6, 5],
    [-6, 5],
  ]);
  expect(r.damage).toMatch(/^smudge:0\.36:all:1:-6,5$/);
  if (r.wrong.length) expect(Math.hypot(r.mean[0] + 6, r.mean[1] - 5), JSON.stringify(r.mean)).toBeLessThan(3); // prettier-ignore
  // A tear from the upper left corner, the one nearest the tap.
  r = await tapDamage(page, "tear", [
    [-11, 11],
    [-11, 11],
    [-11, 11],
  ]);
  expect(r.wrong.length).toBeGreaterThan(0);
  for (const p of r.at) expect(p[0] < 0 && p[1] > 0, JSON.stringify(p)).toBe(true);
  // A tear from the right edge, at the height of the tap.
  r = await tapDamage(page, "tear", [
    [13, 2],
    [13, 2],
    [13, 2],
  ]);
  expect(r.wrong.length).toBeGreaterThan(0);
  for (const p of r.at) expect(p[0] > 0, JSON.stringify(p)).toBe(true);
  expect(Math.abs(r.mean[1] - 2), JSON.stringify(r.mean)).toBeLessThan(3);
  // A burn from the lower right corner, the one nearest the tap.
  r = await tapDamage(page, "burn", [
    [9, -4],
    [9, -4],
    [9, -4],
  ]);
  expect(r.wrong.length).toBeGreaterThan(0);
  for (const p of r.at) expect(p[0] > 0 && p[1] < 0, JSON.stringify(p)).toBe(true);
  expect(errors).toEqual([]);
});

test("three codes in one: each code reads pulled apart, in the colors picked", async ({ page }) => {
  test.setTimeout(400_000);
  const errors = await open(page, "qr-three");
  // A light yellow is darkened enough to read on the white card.
  await page.evaluate(() => window.__splashery.app.player.switchTo({ options: { c1: "#7a2bd6", c2: "#ffee00", c3: "#ff8c1a" } })); // prettier-ignore
  await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  // Every card lies at least a layer behind its own modules.
  const gaps = await page.evaluate(() => {
    const { buf } = window.__splashery.app.player.proc.ctx;
    const by = {};
    for (let i = 0; i < buf.count; i++) {
      const tok = Math.round(buf.anim[i * 4 + 2]);
      if (tok < 1 || tok > 3) continue;
      const z = buf.pos[i * 3 + 2];
      (by[tok] ||= []).push(z);
    }
    const tf = window.__splashery.app.player.motion.ctx.transform;
    return Object.values(by).map((zs) => {
      const s = [...new Set(zs.map((z) => Math.round((z / tf.scale) * 100) / 100))].sort((a, b) => a - b); // prettier-ignore
      return s;
    });
  });
  expect(gaps.length).toBe(3);
  for (const zs of gaps) {
    expect(zs.length, JSON.stringify(zs)).toBe(2); // the card and the modules
    expect(zs[1] - zs[0]).toBeGreaterThanOrEqual(0.49);
  }
  await holdClock(page, [1500, 640]);
  await page.evaluate(() => window.__splashery.app.player.act());
  const img = await page.evaluate(() => window.__qr5.step(2.1)); // apart, holding
  const want = ["https://ryanjosephkamp.github.io/splashery/", "Three codes in one square", "Red, green and blue"]; // prettier-ignore
  // Each code's columns (its colored pixels), with a white margin around it.
  const inked = [];
  for (let x = 0; x < img.w; x++) {
    let on = false;
    for (let y = 0; y < img.h && !on; y += 2) {
      const i = (y * img.w + x) * 4;
      const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      on = Math.max(r, g, b) - Math.min(r, g, b) > 60;
    }
    inked.push(on);
  }
  const runs = [];
  for (let x = 0; x < img.w; x++)
    if (inked[x] && (x === 0 || !inked[x - 1])) runs.push([x, x]);
    else if (inked[x]) runs[runs.length - 1][1] = x;
  const codes = runs.filter(([a, b]) => b - a > 40);
  expect(codes.length).toBe(3);
  const got = codes.map(([a, b]) => {
    const m = Math.round((b - a) * 0.15);
    const x0 = Math.max(0, a - m);
    const w = Math.min(img.w, b + m) - x0;
    const data = new Uint8ClampedArray(w * img.h * 4);
    for (let y = 0; y < img.h; y++)
      data.set(img.data.slice((y * img.w + x0) * 4, (y * img.w + x0 + w) * 4), y * w * 4);
    return read(data, w, img.h);
  });
  if (process.env.QR5_DUMP) fs.writeFileSync(process.env.QR5_DUMP, JSON.stringify({ w: img.w, h: img.h, data: img.data })); // prettier-ignore
  expect(got).toEqual(want);
  expect(errors).toEqual([]);
});

test("the QR family's sounds: quieter wind and whoosh, no note on the barcodes", () => {
  const breath = (id) => TOY_SOUNDS[id].find((s) => s.voice === "breath").vol;
  expect(breath("qr-anatomy")).toBeLessThanOrEqual(0.03);
  expect(breath("qr-three")).toBeLessThanOrEqual(0.05);
  expect(TOY_SOUNDS.barcodes.some((s) => s.voice === "bell")).toBe(false);
  const review = JSON.parse(fs.readFileSync("tools/sound-review.json", "utf8"));
  for (const id of ["qr-anatomy", "qr-three", "barcodes"]) expect(review.toys[id].status).toBe("ready"); // prettier-ignore
});
