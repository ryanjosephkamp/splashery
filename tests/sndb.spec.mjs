// Lane Sound B: the owner's sound review of September 28, 2026 (docs/PACKS.md
// 7e) on the nature, weather, food, toys, Open me, medieval, animals, maths,
// AI and computing, holidays, vehicles and landmarks shelves, and the newer
// toys it names.
//
// - Every toy the lane changed follows the rules it can check from the spec:
//   no electronic clicks or blips, no zipper-like tear, no crackle of ticks,
//   no whistle or theremin (the steam train's whistle is real), and no
//   rising "vroom" sweep on a hum, drone, engine or pad.
// - Every Sound B voice renders audibly without clipping and has a level.
// - The toys whose recipes cue their own sounds (the daisy's petals, the
//   pebbles, the Möbius riders, the puzzle cube, the bricks, the chess set,
//   the laptop's keys, the banana, the croissant) play them when tapped,
//   with no errors or warnings, and every cued spec is valid.
// - No sound file is fetched on page load or when a toy opens.
// - Each sample the lane adds under assets/sounds/ is credited in
//   tools/assets.json and stays within its size budget.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { specFor, specProblems, samplesIn } from "../src/voices.js";

const REVIEW = JSON.parse(fs.readFileSync(new URL("../tools/sound-review.json", import.meta.url), "utf8")); // prettier-ignore
const ASSETS = JSON.parse(fs.readFileSync(new URL("../tools/assets.json", import.meta.url), "utf8")); // prettier-ignore

// The toys this lane changed (their review entries say who changed them in
// the plan; the newer toys carry the lane's note).
const CHANGED = "oak pine cherry-blossom maple bonsai willow sunflower daisy fern rocks campfire lava-lamp snow-globe ice-statue iceberg ice-cream watermelon birthday-cake popcorn jelly pancakes lollipop candy-cane gummy-bear pretzel croissant pizza burger taco apple banana cherries bricks spinning-top dice teddy-bear yo-yo puzzle-cube spring-toy kite paper-plane balloon-dog soap-bubbles robot chess-set book laptop clock desk-fan shield bow-and-target trebuchet crossbow crown wizards-orb jellyfish ladybug snail octopus starfish frog owl lorenz mobius klein-bottle hypercube torus-knot gyroid surface-plotter unit-circle neural-network rnn transformer diffusion-model gradient-descent half-adder fireworks decorated-tree menorah rocket helicopter steam-train sports-car propeller-plane jet tractor ufo eiffel-tower washington-monument statue-of-liberty white-house colosseum soda-can sunglasses baseball-cap splat-equation gaussian-splatting picture-lab your-book photo-album photo-3d splat-field bombe chladni-plate coffee screen supertall water-bottle".split(" "); // prettier-ignore

const SOUND_B_VOICES = "flame rustle pageflip bite shellcrack kernel dice chug motor rotor creak snip trumpet bowstring slosh launch bang hooves crowd pebble spintop yoyo twist sproing balloonpop flybuzz croak owlhoot melt stretch peel gurgle swim keytap fan hit glow arc whoom alarmbell chessmove clockwork jingle".split(" "); // prettier-ignore

// Each layer of a spec, both halves of a toggle.
const layers = (spec) =>
  [specFor(spec, true), specFor(spec, false)].flatMap((s) => (Array.isArray(s) ? s : [s]));

test("every changed toy has a sound and a review entry marked as in the site", () => {
  for (const id of CHANGED) {
    expect(TOY_SOUNDS[id], id).toBeTruthy();
    // A later review may reopen a toy (its entry then carries that review's "round" and a new plan).
    if (REVIEW.toys[id]?.round) {
      expect(REVIEW.toys[id].plan, id).toBeTruthy();
      continue;
    }
    expect(REVIEW.toys[id]?.status, id).toBe("site");
    expect(REVIEW.toys[id]?.plan, id).toMatch(/^Now: /);
  }
});

test("the changed toys keep to the rules a spec can show (PACKS.md 7e)", () => {
  const bad = [];
  const BANNED = new Set(["click", "blip", "tear", "crackle", "theremin"]);
  const SWEEPS = new Set(["hum", "drone", "engine", "pad", "tone", "shimmer", "theremin"]);
  for (const id of CHANGED) {
    for (const l of layers(TOY_SOUNDS[id])) {
      if (BANNED.has(l.voice)) bad.push(`${id}: ${l.voice}`);
      if (l.voice === "whistle" && id !== "steam-train") bad.push(`${id}: whistle`);
      if (SWEEPS.has(l.voice) && (l.to ?? 1) > 1.05)
        bad.push(`${id}: ${l.voice} rises (to ${l.to})`);
      if (l.voice === "wind" && (l.vol ?? 1) > 0.5) bad.push(`${id}: loud wind`);
    }
  }
  expect(bad).toEqual([]);
});

test("every Sound B voice renders audibly, without clipping, and has a level", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
  });
  await page.goto("/tools/");
  const bad = await page.evaluate(async (names) => {
    const { playSpec, VOICES, VOICE_NAMES } = await import("/src/voices.js");
    const { masterChain } = await import("/src/sound.js");
    const out = [];
    for (const voice of names) {
      if (!VOICES[voice] || !VOICE_NAMES.includes(voice)) {
        out.push(`${voice}: missing`);
        continue;
      }
      const rate = 44100; // as in the app (16 kHz would clamp high filters)
      const ctx = new OfflineAudioContext(1, rate * 6, rate);
      const len = playSpec(ctx, masterChain(ctx), 0.01, { voice });
      const d = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      let finite = true;
      for (let i = 0; i < d.length; i++) {
        if (!Number.isFinite(d[i])) finite = false;
        peak = Math.max(peak, Math.abs(d[i]));
      }
      if (!finite || !(peak > 0.02 && peak < 0.99) || !(len > 0 && len < 5))
        out.push(`${voice}: peak ${peak.toFixed(3)}, ${len} s`);
    }
    return out;
  }, SOUND_B_VOICES);
  expect(bad).toEqual([]);
  // The tools page has no favicon (a 404): not a sound problem.
  errors.splice(
    0,
    errors.length,
    ...errors.filter((e) => !e.startsWith("Failed to load resource")),
  );
  const src = fs.readFileSync(new URL("../src/voices.js", import.meta.url), "utf8");
  const levels = src.slice(src.indexOf("Object.assign(LEVEL, {"));
  for (const v of SOUND_B_VOICES) expect(levels, v).toMatch(new RegExp(`\\b${v}: \\d`));
  expect(errors).toEqual([]);
});

// Toys whose recipes cue sounds this lane changed, with the voices a tap
// should cue (the chess set plays the Opera Game).
const CUED = [
  { id: "daisy", voice: "rustle", wait: 14 },
  { id: "rocks", voice: "pebble", wait: 6 },
  { id: "mobius", voice: "motor", wait: 4 },
  { id: "puzzle-cube", voice: "twist", wait: 6 },
  { id: "bricks", voice: "clack", wait: 10 },
  { id: "chess-set", voice: "chessmove", wait: 8 },
  { id: "banana", voice: "peel", wait: 6 },
  { id: "croissant", voice: "hiss", wait: 6 },
];

test("toys that cue their own sounds play the new ones, with no errors", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
  });
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => {
    const s = window.__splashery.app.sound;
    s.enabled = true;
    window.__played = [];
    // Record what would play instead of playing it (headless has no speakers).
    s.play = (spec) => spec && window.__played.push(spec);
  });
  const missing = [];
  const invalid = [];
  for (const { id, voice, wait } of CUED) {
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
    await page.waitForFunction((id) => window.__splashery.player.scene?.toy?.id === id && window.__splashery.player.toyInfo, id, { timeout: 120_000 }); // prettier-ignore
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      window.__played = [];
      window.__splashery.app.act();
    });
    const got = await page
      .waitForFunction(
        (voice) => window.__played.some((s) => JSON.stringify(s).includes(`"voice":"${voice}"`)),
        voice,
        { timeout: wait * 1000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!got) missing.push(`${id}: no ${voice}`);
    const played = await page.evaluate(() => window.__played);
    for (const s of played) invalid.push(...specProblems(s, id));
  }
  expect(missing).toEqual([]);
  expect(invalid).toEqual([]);
  expect(errors).toEqual([]);
});

test("the laptop's keys cue a real key sound", async () => {
  const src = fs.readFileSync(new URL("../src/packs/objects.js", import.meta.url), "utf8");
  expect(src).toContain('voice: "keytap"');
  expect(JSON.stringify(TOY_SOUNDS.laptop)).not.toContain('"clatter"');
});

test("no sound file is fetched on page load or when a toy opens", async ({ page }) => {
  test.setTimeout(300_000);
  const fetched = [];
  page.on("request", (r) => {
    if (/\/assets\/sounds\//.test(r.url())) fetched.push(r.url());
  });
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const id of ["campfire", "dice", "owl", "colosseum", "steam-train", "book"]) {
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
    await page.waitForFunction((id) => window.__splashery.player.scene?.toy?.id === id && window.__splashery.player.toyInfo, id, { timeout: 120_000 }); // prettier-ignore
  }
  expect(fetched).toEqual([]);
});

test("each of the lane's sound files is credited and small", () => {
  const dir = new URL("../assets/sounds/", import.meta.url);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const mine = files.filter((f) => CHANGED.some((id) => f.startsWith(`${id}-`)));
  const credited = JSON.stringify(ASSETS);
  for (const f of mine) {
    expect(credited, f).toContain(`assets/sounds/${f}`);
    expect(fs.statSync(new URL(f, dir)).size, f).toBeLessThanOrEqual(60 * 1024);
  }
});

test("every recording the lane's toys name exists, is credited, and has a synth fallback", () => {
  const credited = JSON.stringify(ASSETS);
  const missing = [];
  for (const id of CHANGED) {
    for (const f of samplesIn(TOY_SOUNDS[id])) {
      if (!fs.existsSync(new URL(`../assets/sounds/${f}`, import.meta.url)))
        missing.push(`${id}: ${f}`);
      if (!credited.includes(`assets/sounds/${f}`)) missing.push(`${id}: ${f} not credited`);
    }
    for (const l of layers(TOY_SOUNDS[id]))
      if (l.voice === "sample" && !l.fallback) missing.push(`${id}: ${l.file} has no fallback`);
  }
  expect(missing).toEqual([]);
});

test("a tap fetches its recording, and only then", async ({ page }) => {
  test.setTimeout(300_000);
  const fetched = [];
  page.on("request", (r) => {
    if (/\/assets\/sounds\//.test(r.url())) fetched.push(r.url().split("/").pop());
  });
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("dice"));
  await page.waitForFunction(() => window.__splashery.player.scene?.toy?.id === "dice" && window.__splashery.player.toyInfo, null, { timeout: 120_000 }); // prettier-ignore
  expect(fetched).toEqual([]);
  await page.evaluate(() => {
    const s = window.__splashery.app.sound;
    s.setEnabled(true);
    window.__splashery.app.act();
  });
  await expect.poll(() => fetched, { timeout: 30_000 }).toContain("dice-throw.mp3");
});
