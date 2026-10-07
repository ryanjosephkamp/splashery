// Lane QR craft (docs/handoff/QRcraft.md): QR from real things. The layouts
// cover the code (every module under a domino; a marble on every dark module;
// every module a tile), and in the browser each material's build, played from
// a tap to its end, finishes on a code that jsQR reads, for the default text
// and for the person's own; halfway through, the pieces are really elsewhere
// (the code doesn't read yet).

import { test, expect } from "@playwright/test";
import { encodeQR } from "../src/qr/encode.js";
import { dominoLayout, marbleLayout, frameLayout, tileLayout, BUILD_SECS, FALL_SECS, ROLL_SECS, FLIP_SECS } from "../src/qr-craft/pieces.js"; // prettier-ignore

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

test("the pieces cover the code, and every piece finishes inside the build", () => {
  for (const text of ["https://ryanjosephkamp.github.io/splashery/", "Dominoes!"]) {
    const code = encodeQR(text, "M");
    const N = code.size;
    // Dominoes: each module under exactly one domino of its own color.
    const cover = new Uint8Array(N * N);
    for (const d of dominoLayout(code)) {
      expect(d.w === 1 || d.w === 2).toBe(true);
      for (let c = d.c; c < d.c + d.w; c++) {
        cover[d.r * N + c]++;
        expect(code.dark[d.r * N + c] === 1).toBe(d.dark);
      }
      expect(d.start + FALL_SECS).toBeLessThanOrEqual(BUILD_SECS);
    }
    expect(cover.every((n) => n === 1)).toBe(true);
    // Marbles: the frames (the eyes and alignment marks) and one marble on
    // every other dark module cover every dark module once, and nothing
    // else; in a row, the left marble starts first (so none passes another).
    const marbles = marbleLayout(code);
    const dark = new Uint8Array(N * N);
    for (const m of marbles) dark[m.r * N + m.c]++;
    for (const f of frameLayout(code))
      for (let r = f.row; r < f.row + f.n; r++) for (let c = f.col; c < f.col + f.n; c++) dark[r * N + c] += code.dark[r * N + c]; // prettier-ignore
    expect(Array.from(dark)).toEqual(Array.from(code.dark));
    for (let i = 1; i < marbles.length; i++)
      if (marbles[i].r === marbles[i - 1].r) expect(marbles[i].start).toBeGreaterThan(marbles[i - 1].start); // prettier-ignore
    expect(Math.max(...marbles.map((m) => m.start)) + ROLL_SECS).toBeLessThanOrEqual(BUILD_SECS);
    // Tiles: every module.
    const tiles = tileLayout(code);
    expect(tiles.length).toBe(N * N);
    expect(Math.max(...tiles.map((t) => t.start)) + FLIP_SECS).toBeLessThanOrEqual(BUILD_SECS);
  }
});

test("QR from real things: every build ends on a code that reads, the person's own text too", async ({
  page,
}) => {
  test.setTimeout(480_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-build"));
  await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "qr-build" && !window.__splashery.app.busy, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => (window.__splashery.qrCraft.autoCheck = false));
  const read = () => page.evaluate(() => window.__splashery.qrCraft.checkBuild().then((r) => r.sizes.map((s) => s.text))); // prettier-ignore
  for (const material of ["dominoes", "marbles", "tiles"])
    for (const text of ["https://ryanjosephkamp.github.io/splashery/", "Built from real things!"]) {
      await page.evaluate((o) => window.__splashery.app.player.switchTo({ options: o }), { material, text }); // prettier-ignore
      await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
      // Halfway, the pieces are on their way: the code doesn't read.
      await page.evaluate(() => window.__splashery.qrCraft.hold(0.3));
      const mid = await read();
      expect(
        mid.every((t) => t !== text),
        `${material} halfway`,
      ).toBe(true);
      // The last frame of the build.
      await page.evaluate(() => window.__splashery.qrCraft.hold(1));
      expect(await read(), `${material}: ${text}`).toEqual([text, text]);
      await page.evaluate(() => window.__splashery.qrCraft.hold(null));
    }
  // A real tap plays the build through to its end, which reads.
  await page.evaluate(() => {
    const p = window.__splashery.app.player;
    p.motion.act(p.time, null, { key: "build" });
  });
  // The toy's clock runs slower than the wall clock in the software
  // renderer: wait for the build itself to end.
  await page.waitForFunction(() => !(window.__splashery.app.player.motion.state.build > 0), null, { timeout: 120_000 }); // prettier-ignore
  await page.waitForTimeout(500);
  expect(await read()).toEqual(["Built from real things!", "Built from real things!"]);
  expect(errors).toEqual([]);
});
