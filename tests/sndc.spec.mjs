// Lane Sound C: the owner's sound notes of October 2, 2026
// (docs/reviews/sounds-2026-10-02.md, tools/sound-review.json).
//
// - Every toy the lane changed is marked in the review, and its spec is sound.
// - Every recording it names exists, is credited and small, with a synth fallback.
// - The sounds timed to the motion come in sync: the daisy's and the rose's
//   petals as they land, a tick for each nucleon of the periodic table's atom,
//   a click for each splat of the splatting toy's sorting view; and each
//   splat field and each book style plays its own sound.
// - The spinning top's hum follows its speed.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { specProblems, samplesIn, specFor } from "../src/voices.js";

const REVIEW = JSON.parse(fs.readFileSync(new URL("../tools/sound-review.json", import.meta.url), "utf8")); // prettier-ignore
const ASSETS = JSON.parse(fs.readFileSync(new URL("../tools/assets.json", import.meta.url), "utf8")); // prettier-ignore
const CREDITS = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

// The toys of the October 2 review this lane changed.
const CHANGED = Object.entries(REVIEW.toys)
  .filter(([id, t]) => /Sound C/.test(t.plan || "") && id !== "fluid-lab")
  .map(([id]) => id);

const APP = "/?renderer=webgl2&profile=weak";

async function open(page) {
  await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => {
    window.__cues = [];
    window.__splashery.player.on("cue", (cues) => {
      const t = window.__splashery.app.sound.ctx?.currentTime ?? 0;
      for (const c of cues) window.__cues.push({ t, spec: c });
    });
  });
}

async function pick(page, id, options = null) {
  await page.evaluate(
    ([id, options]) => {
      const app = window.__splashery.app;
      return options ? app.chooseToy(id).then(() => app.setToyOptions(options)) : app.chooseToy(id);
    },
    [id, options],
  );
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
  await page.waitForTimeout(300);
}

// Waits for the toy's control `key` to run out (or reach `to`): headless
// frames are slow, so an effect can take far longer than its own seconds.
const until = (page, key, to = 0) =>
  page.waitForFunction(
    ([key, to]) => {
      const v = window.__splashery.player.motion.state[key];
      return to ? v >= to : v <= 0.001;
    },
    [key, to],
    { timeout: 180_000, polling: 250 },
  );

// Every single sound in the cues so far ({ voice, file, at }), with the
// time it was asked for.
const heard = (page) =>
  page.evaluate(
    () =>
    window.__cues.flatMap(({ t, spec }) => (Array.isArray(spec) ? spec : [spec]).map((s) => ({ t, ...s }))), // prettier-ignore
  );

test("the lane's toys are marked in the sound review, and their specs are sound", () => {
  expect(CHANGED.length).toBeGreaterThanOrEqual(40);
  for (const id of CHANGED) {
    expect(TOY_SOUNDS[id], id).toBeTruthy();
    expect(specProblems(TOY_SOUNDS[id], id)).toEqual([]);
    expect(["site", "ready"], id).toContain(REVIEW.toys[id].status);
    expect(REVIEW.toys[id].plan, id).toMatch(/^Now: /);
    for (const c of REVIEW.toys[id].candidates || []) expect(specProblems(c.sound, `${id} ${c.id}`)).toEqual([]); // prettier-ignore
  }
  // The toys the owner kept stay as they were.
  expect(REVIEW.toys["ice-cream"].status).toBe("keep");
});

test("every recording the lane's toys and recipes name exists, is credited and small, with a fallback", () => {
  const packs = fs.readdirSync(new URL("../src/packs/", import.meta.url));
  const cued = packs.flatMap((f) => [...fs.readFileSync(new URL(`../src/packs/${f}`, import.meta.url), "utf8").matchAll(/"([a-z0-9-]+\.mp3)"/g)].map((m) => m[1])); // prettier-ignore
  const files = new Set([...CHANGED.flatMap((id) => samplesIn(TOY_SOUNDS[id])), ...cued]);
  for (const id of CHANGED)
    for (const c of REVIEW.toys[id].candidates || []) for (const f of samplesIn(c.sound)) files.add(f); // prettier-ignore
  const credited = JSON.stringify(ASSETS);
  const missing = [];
  for (const f of files) {
    const at = new URL(`../assets/sounds/${f}`, import.meta.url);
    if (!fs.existsSync(at)) missing.push(`${f} missing`);
    else if (fs.statSync(at).size > 40 * 1024) missing.push(`${f} over 40 KB`);
    if (!credited.includes(`assets/sounds/${f}`)) missing.push(`${f} not in tools/assets.json`);
    if (!CREDITS.includes(`\`${f}\``) && !f.startsWith("grand-piano-")) missing.push(`${f} not in CREDITS.md`); // prettier-ignore
  }
  for (const id of CHANGED)
    for (const half of [true, false])
      for (const l of [].concat(specFor(TOY_SOUNDS[id], half)))
        if (l.voice === "sample" && !l.fallback) missing.push(`${id}: ${l.file} has no fallback`);
  expect(missing).toEqual([]);
});

test("the daisy's petals each tap as they land, and the rose's one does too", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await pick(page, "daisy");
  await page.evaluate(() => window.__splashery.app.act());
  await page.waitForTimeout(500);
  await until(page, "spin");
  const daisy = (await heard(page)).filter((c) => c.voice === "rustle");
  expect(daisy).toHaveLength(8);
  // Each is handed over a moment ahead and scheduled for its petal's landing.
  for (const c of daisy) expect(c.at).toBeLessThanOrEqual(0.13);
  await pick(page, "rose");
  await page.evaluate(() => (window.__cues = []) && window.__splashery.app.act());
  await page.waitForTimeout(500);
  await until(page, "bloom");
  expect((await heard(page)).filter((c) => c.voice === "rustle")).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("the periodic table's atom ticks once for each proton and neutron as it packs in", async ({
  page,
}) => {
  await open(page);
  await pick(page, "periodic-table", { element: "C" });
  const n = await page.evaluate(() => window.__splashery.player.motion.ctx?.kit?.data?.nucleons?.length); // prettier-ignore
  expect(n).toBeGreaterThanOrEqual(12);
  await page.evaluate(() => {
    const { app } = window.__splashery;
    window.__cues = [];
    app.setControl("up", 1);
  });
  await until(page, "up", 0.999);
  const ticks = (await heard(page)).filter((c) => c.voice === "clack");
  expect(ticks).toHaveLength(n);
  // In order, and spread over the nucleus's build (about 2 s), not bunched.
  const at = ticks.map((c) => c.t + c.at);
  for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThanOrEqual(at[i - 1] - 1e-6);
  expect(at.at(-1) - at[0]).toBeGreaterThan(1);
});

test("the splatting toy's sorting view clicks once for each splat placed; each view has its own sound", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await open(page);
  await pick(page, "gaussian-splatting", { view: "sorting" });
  await page.evaluate(() => (window.__cues = []) && window.__splashery.app.act());
  await page.waitForTimeout(500);
  await until(page, "play");
  const clicks = (await heard(page)).filter((c) => c.voice === "pebble");
  expect(clicks).toHaveLength(300);
  expect(new Set(clicks.map((c) => Math.round(c.f))).size).toBeGreaterThan(50); // each a little different
  for (const [view, voice] of [
    ["training", "glide"],
    ["one", "breath"],
    ["many", "sparkle"],
  ]) {
    await pick(page, "gaussian-splatting", { view });
    await page.evaluate(() => (window.__cues = []) && window.__splashery.app.act());
    await expect
      .poll(async () => (await heard(page)).map((c) => c.voice), { message: view, timeout: 30_000 })
      .toContain(voice);
  }
});

test("each splat field and each book style plays its own sound", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  for (const [program, voice] of [
    ["galaxy", "breath"],
    ["ocean", "drip"],
    ["knot", "glide"],
  ]) {
    await pick(page, "splat-field", { program });
    await page.evaluate(() => (window.__cues = []) && window.__splashery.app.act());
    await expect
      .poll(async () => (await heard(page)).map((c) => c.voice), {
        message: program,
        timeout: 30_000,
      })
      .toContain(voice);
  }
  for (const style of ["hardcover", "paperback", "magazine"]) {
    await pick(page, "your-book", { style });
    await page.evaluate(() => (window.__cues = []) && window.__splashery.app.act());
    await expect
      .poll(async () => (await heard(page)).map((c) => c.file), { message: style, timeout: 30_000 })
      .toContain(`your-book-${style}.mp3`);
  }
});

test("the spinning top's hum follows its speed: loud as it spins fast, gone as it slows", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__loops = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      if (this.loop && this.buffer?.duration > 1) window.__loops.push(this);
      return start.apply(this, a);
    };
  });
  await open(page);
  await pick(page, "spinning-top");
  await page.evaluate(() => window.__splashery.app.act());
  await page.waitForFunction(() => window.__loops.length > 0, null, { timeout: 30_000 });
  await page.waitForTimeout(300);
  const fast = await page.evaluate(() => window.__loops[0].playbackRate.value);
  await until(page, "whip");
  await page.waitForTimeout(1000);
  const slow = await page.evaluate(() => ({ rate: window.__loops[0].playbackRate.value, n: window.__loops.length })); // prettier-ignore
  expect(fast).toBeGreaterThan(slow.rate);
});

// The lane changes sounds only; its screenshots show the periodic table's
// atom built (its nucleons ticked in as they packed).
for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  test(`screenshot: the periodic table's built atom (${w}x${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await pick(page, "periodic-table", { element: "C" });
    await page.evaluate(() => window.__splashery.app.setControl("up", 1));
    await until(page, "up", 0.999);
    await page.waitForTimeout(500);
    await page.screenshot({ path: new URL(`./screenshots/sndc-periodic-table-${w}x${h}.png`, import.meta.url).pathname }); // prettier-ignore
  });
}
