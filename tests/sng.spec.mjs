// Lane Song live: the song landscape's Live view (docs/handoff/Photo3D.md, "Song live"). The build is
// checked in Node through the kit; the browser tests play the sample and watch the landscape scroll.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { resolveOptions } from "../src/player.js";
import { KINDS } from "../src/effects.js";
import { RECIPES } from "../src/packs/studio.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const R = RECIPES["song-landscape"];

async function build(options, count = 60000) {
  const o = resolveOptions(R, options);
  await R.prepare(o);
  const it = buildRecipe(R, { seed: 1, count, options: o }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
const kinds = (ctx) => {
  const b = ctx.buf;
  const n = {};
  for (let i = 0; i < b.count; i++) n[b.anim[i * 4 + 1]] = (n[b.anim[i * 4 + 1]] || 0) + 1;
  return n;
};

test.describe("the Live view (no browser)", () => {
  // Lane Live input r3: Live is the default since the owner's review of October 2, 2026 ("I like
  // the live view much more than I like the full spectrum because the full spectrum doesn't
  // usually seem to move very much while the song is playing, whereas live it actually moves");
  // Whole song is one tap away.
  test("View is an option, Live is the default and Whole song one choice away", () => {
    const opt = R.options.find((x) => x.key === "view");
    expect(opt.default).toBe("live");
    expect(opt.choices.map((c) => c.id)).toEqual(["live", "whole"]);
    // a link or saved scene with no view opens in Live; one that saved Whole keeps it
    expect(resolveOptions(R, {}).view).toBe("live");
    expect(resolveOptions(R, { view: "whole" }).view).toBe("whole");
  });

  test("Whole song builds as before: no fading splats, no caps", async () => {
    const ctx = await build({ view: "whole" });
    const n = kinds(ctx);
    expect(n[KINDS.fade] || 0).toBe(0);
    expect(n[KINDS.token] || 0).toBe(0);
    expect(ctx.kit.data.song.live).toBe(false);
  });

  test("Live builds cells that fade as they are played, and 48 loudness caps", async () => {
    const ctx = await build({ view: "live" });
    const n = kinds(ctx);
    expect(n[KINDS.fade]).toBeGreaterThan(20000);
    expect(n[KINDS.token]).toBe(48 * 4);
    const g = ctx.kit.data.song;
    expect(g.live).toBe(true);
    expect(g.caps.length).toBe(48);
    let bad = 0;
    for (let i = 0; i < ctx.buf.count * 3; i++) if (!Number.isFinite(ctx.buf.pos[i])) bad++;
    expect(bad).toBe(0);
  });

  test("the drive scrolls the landscape as the song goes, and the caps follow the loudness", async () => {
    const ctx = await build({ view: "live" });
    const g = ctx.kit.data.song;
    const drive = (tapN) => {
      const out = { parts: {}, cues: [], morph: null, body: null, tokens: null };
      R.drive(1, {}, out, { data: ctx.kit.data, tap: tapN ? { n: tapN } : null, time: 0, R: 1, sound: null }); // prettier-ignore
      return out;
    };
    const rest = drive(0);
    expect(rest.body.offset[2]).toBeCloseTo(0, 6);
    expect(rest.morph[0]).toBe(0);
    expect(rest.tokens.length).toBe(48);
    // the caps at rest sit at the height the song has at its start
    let hs = Math.max(...rest.tokens.map((t) => t.offset[1]));
    expect(hs).toBeGreaterThan(0);
    // and the morph channel that clears what has played never runs backwards
    expect(rest.morph[0]).toBeGreaterThanOrEqual(0);
    expect(g.nt).toBeGreaterThan(10);
  });
});

test.describe("in the browser", () => {
  test("Live plays: the landscape moves while it plays and stops when paused", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song, null, { timeout: 90_000 }); // prettier-ignore
    // the default is Live (lane Live input r3)
    expect(await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.song.live)).toBe(true); // prettier-ignore
    // Live r7: the land grows as the song plays and what has played slides
    // back from the line at the front (the look part's offset falls).
    const z = () =>
      page.evaluate(() => window.__splashery.player.motion.out?.parts?.look?.offset?.[2] ?? 0);
    await page.waitForFunction(() => window.__splashery.player.motion.out?.parts?.look, null, { timeout: 90_000 }); // prettier-ignore
    const still = await z();
    await page.evaluate(() => window.__splashery.app.act()); // play
    await page.waitForFunction((s) => (window.__splashery.player.motion.out?.parts?.look?.offset?.[2] ?? s) < s - 0.02, still, { timeout: 90_000 }); // prettier-ignore
    const moved = await z();
    expect(moved).toBeLessThan(still);
    await page.evaluate(() => window.__splashery.app.act()); // pause
    await page.waitForTimeout(1500);
    const a = await z();
    await page.waitForTimeout(1500);
    expect(await z()).toBeCloseTo(a, 5); // paused: a still landscape
    // Whole song is one choice away, and builds without the Live view's fading cells
    await page.evaluate(() => window.__splashery.app.setToyOptions({ view: "whole" }));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song?.live === false, null, { timeout: 90_000 }); // prettier-ignore
    expect(errors).toEqual([]);
  });

  test("screenshots at phone and desktop size", async ({ browser }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("song-landscape"));
      await page.evaluate(() => window.__splashery.app.setToyOptions({ view: "live" }));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song?.live === true, null, { timeout: 90_000 }); // prettier-ignore
      await page.evaluate(() => window.__splashery.app.act());
      // (Live r7: the land grows as it plays; the look part slides back.)
      await page.waitForFunction(() => window.__splashery.player.motion.out?.parts?.look?.offset?.[2] < 2.6, null, { timeout: 120_000 }); // prettier-ignore
      await page.evaluate(() => window.__splashery.app.act());
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `tests/screenshots/sng-live-${w}x${h}.png` });
      await page.close();
    }
  });
});
