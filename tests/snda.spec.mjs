// Lane Sound A (docs/handoff/SoundA.md): real sounds for the first shelves
// (scans, shapes, balls, space, tiny, atoms, gems and the body), some of them
// recorded samples in assets/sounds/. Every changed toy's sound plays without
// errors, no sample loads on page load (since Sound C, October 2, 2026: a
// toy's samples load when it opens, so its first tap is on time, and only
// that toy's), each file is credited and small, and the sound lint passes
// them all.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { SOUND_CREDITS } from "../src/sound-credits.js";
import { samplesIn, specProblems } from "../src/voices.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const SHELVES = ["scans", "shapes", "balls", "space", "tiny", "atoms", "gems", "anatomy"];
const review = JSON.parse(fs.readFileSync("tools/sound-review.json", "utf8")).toys;
// A toy a later review reopened (its entry carries that review's "round") still counts as the lane's.
const CHANGED = TOYS.filter((t) => SHELVES.includes(t.category) && (review[t.id]?.status === "site" || review[t.id]?.round)).map((t) => t.id); // prettier-ignore
const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).soundSamples;
// Files a pack's recipe plays (its cues, and since Sound C its `sounds`), from
// every pack, and the Sound Board's candidates in the review (OPERATING.md,
// "The sound review", step 3) count as used too.
const cueFiles = fs.readdirSync("src/packs").flatMap((f) => [...fs.readFileSync(`src/packs/${f}`, "utf8").matchAll(/"([a-z0-9-]+\.mp3)"/g)].map((m) => m[1])); // prettier-ignore
const candidateFiles = samplesIn(Object.values(review).flatMap((t) => (t.candidates || []).map((c) => c.sound)), [], true); // prettier-ignore
const FILES = fs.readdirSync("assets/sounds");

test("the lane's toys are marked in the sound review, and their specs are sound", () => {
  expect(CHANGED.length).toBeGreaterThanOrEqual(60);
  for (const id of CHANGED) {
    expect(TOY_SOUNDS[id], id).toBeTruthy();
    expect(specProblems(TOY_SOUNDS[id], id)).toEqual([]);
    expect(review[id].plan, id).toBeTruthy();
  }
});

test("every sample is used, credited (assets.json, CREDITS.md, the About tab), CC0 and small", () => {
  const used = new Set([...samplesIn(Object.values(TOY_SOUNDS), [], true), ...cueFiles, ...candidateFiles]); // prettier-ignore
  const credits = fs.readFileSync("CREDITS.md", "utf8");
  for (const f of FILES) {
    expect(f, "an MP3 or M4A named <toy>-<what>").toMatch(/^[a-z0-9][a-z0-9-]*\.(mp3|m4a)$/);
    expect(used.has(f), `${f} is used`).toBe(true);
    const bytes = fs.statSync(`assets/sounds/${f}`).size;
    expect(bytes, `${f} size`).toBeLessThanOrEqual(40 * 1024);
    const a = assets.find((x) => x.file === `assets/sounds/${f}`);
    expect(a, `${f} in tools/assets.json`).toBeTruthy();
    expect(a.license).toBe("CC0 1.0");
    expect(a.page).toMatch(/^https:\/\/(freesound\.org|kenney\.nl)\//);
    expect(a.author && a.checked).toBeTruthy();
    const piano = f.startsWith("grand-piano-");
    // The piano's notes share one credit (their pack); the others each have their own.
    expect(SOUND_CREDITS[f]?.source, `${f} in src/sound-credits.js`).toBe(piano ? "https://freesound.org/people/TEDAgame/packs/25405/" : a.page); // prettier-ignore
    expect(credits, `${f} in CREDITS.md`).toContain(piano ? "`grand-piano-*.mp3`" : `\`${f}\``);
  }
  for (const f of used) expect(FILES, `${f} exists`).toContain(f);
  // The whole folder (each file loads only with its own toy): 1 MB until Sound
  // C (October 2, 2026) took it past that, with main alone at 987 KB.
  const total = FILES.reduce((s, f) => s + fs.statSync(`assets/sounds/${f}`).size, 0);
  expect(total).toBeLessThan(1.5 * 1024 * 1024);
});

test("every changed toy's sound plays in the app without errors or warnings", async ({ page }) => {
  const problems = [];
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(e.message));
  const failed = [];
  page.on(
    "response",
    (r) => r.url().includes("/assets/sounds/") && !r.ok() && failed.push(r.url()),
  );
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const played = await page.evaluate(async (ids) => {
    const { TOY_SOUNDS } = await import("/src/toy-sounds.js");
    const { specFor, samplesIn, samplesReady, loadSamples } = await import("/src/voices.js");
    const sound = window.__splashery.app.sound;
    sound.setEnabled(true);
    const ctx = sound.audio();
    let n = 0;
    for (const id of ids)
      for (const on of [true, false]) {
        const spec = specFor(TOY_SOUNDS[id], on);
        sound.play(spec, { key: `${id}-${on}` });
        await loadSamples(ctx, spec);
        if (!samplesReady(spec)) throw new Error(`${id}: samples not ready`);
        n += samplesIn(spec).length;
      }
    return n;
  }, CHANGED);
  expect(played).toBeGreaterThan(30);
  await page.waitForTimeout(500);
  expect(failed).toEqual([]);
  expect(problems).toEqual([]);
});

// Since Sound C, October 2, 2026: a toy's samples load when it opens, so its
// first tap is on time. Page load still fetches none, and opening a toy
// fetches only its own (its sound entry's and its recipe's for its options).
test("no sample loads on page load; opening a toy loads only its own", async ({ page }) => {
  const fetched = [];
  const names = () => fetched.map((u) => u.split("/").pop());
  page.on("request", (r) => r.url().includes("/assets/sounds/") && fetched.push(r.url()));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.sound.setEnabled(true));
  expect(fetched).toEqual([]);
  const seen = new Set();
  for (const id of ["cat-statue", "tennis-ball"]) {
    const before = fetched.length;
    await page.evaluate((toy) => window.__splashery.app.chooseToy(toy), id);
    await page.waitForFunction(() => window.__splashery.player.toyInfo?.recipe || window.__splashery.player.toyInfo?.rig, null, { timeout: 120_000 }); // prettier-ignore
    await page.waitForTimeout(1500);
    // The toy's own files: its sound entry's, and its recipe's `sounds`.
    const extra = await page.evaluate(() => window.__splashery.app.recipeSounds());
    const own = samplesIn([TOY_SOUNDS[id], ...extra], [], true);
    const now = names().slice(before);
    for (const f of now) expect(own, `opening ${id} fetched ${f}`).toContain(f);
    // Nothing fetched twice (the first toy's files stay cached).
    for (const f of now) expect(seen.has(f), `opening ${id} fetched ${f} again`).toBe(false);
    now.forEach((f) => seen.add(f));
  }
  // The tennis ball's slam loaded when it opened; its bounces load their own file on the tap.
  await page.evaluate(() => window.__splashery.player.act(null));
  await expect.poll(names, { timeout: 10_000 }).toContain("tennis-ball-slam.mp3");
  await expect.poll(names, { timeout: 10_000 }).toContain("tennis-ball-bounce.mp3");
  // The About tab credits the samples this toy's tap uses.
  await expect(page.locator('#credits [data-sample="tennis-ball-slam.mp3"]')).toHaveCount(1);
});

test("the sound lint passes every changed toy (PACKS.md 7e)", () => {
  const out = execFileSync("node", ["tools/sound-lint.mjs", "--toy", CHANGED.join(",")], {
    encoding: "utf8",
  });
  expect(out).toContain(`${CHANGED.length} toys, 0 with a clear violation`);
});

test("the grand piano plays recorded notes (the concert voice); the keyboard's PIANO keeps the synth", async ({
  page,
}) => {
  expect(TOY_SOUNDS["grand-piano"].voice).toBe("concert");
  const src = fs.readFileSync("src/packs/pianos.js", "utf8");
  expect(src).toMatch(/voice: "concert"/);
  expect(src).toMatch(/\{ voice: "grand", name: "PIANO"/);
  await page.goto("/tools/");
  const r = await page.evaluate(async () => {
    const { playSpec, loadSamples, SAMPLES } = await import("/src/voices.js");
    SAMPLES.base = "/assets/sounds/";
    const render = async (spec) => {
      const ctx = new OfflineAudioContext(1, 22050 * 2, 22050);
      await loadSamples(ctx, spec);
      playSpec(ctx, ctx.destination, 0.01, spec);
      const d = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      let after = 0;
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        if (i > 22050 * 0.9) after = Math.max(after, Math.abs(d[i]));
      }
      return { peak, after };
    };
    return {
      low: await render({ voice: "concert", f: "A0", hold: 0.5 }),
      mid: await render({ voice: "concert", f: "D4", hold: 0.5 }),
      high: await render({ voice: "concert", f: "B7", hold: 0.5 }),
    };
  });
  for (const k of ["low", "mid", "high"]) {
    expect(r[k].peak, k).toBeGreaterThan(0.05);
    // The damper stops the note soon after its key comes up (0.5 s).
    expect(r[k].after, k).toBeLessThan(r[k].peak * 0.05);
  }
});
