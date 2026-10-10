// Lane Live r9 part 2: Sound in a box's built-in tunes. Each is made in the
// page and plays through the same path as your own file (the Song
// landscape's worker, the live mix of the cell's modes).

import { test, expect } from "@playwright/test";
import {
  TUNES,
  noteHz,
  tuneSamples,
  wavBytes,
  cellDrive,
  ladder,
} from "../src/packs/chladni-3d.js";

const APP = "/?renderer=webgl2&adapt=off&profile=low&labs=1";
const BOX = "/src/packs/chladni-3d.js";

// Polls an async check in the page until it holds (page.waitForFunction
// does not wait for a promise's result: an async check passes at once).
async function until(page, fn, arg, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${fn}`);
    await page.waitForTimeout(150);
  }
}

// The mode a note rings most in the cube. A chord (the tunes' are fifths)
// is heard an octave below its lower note.
const leadOf = (n) => {
  const hz = Array.isArray(n) ? noteHz(n[0]) / 2 : noteHz(n);
  return cellDrive(hz, 1, "cube").modes.reduce((b, d) => (!b || d.a > b.a ? d : b)).mode.id;
};

test("the tunes: real notes, named and credited, and each moves the beads through several figures", () => {
  expect(TUNES.map((t) => t.id)).toEqual(["scale", "arpeggio", "two-voices", "ode", "twinkle"]);
  expect(noteHz("A4")).toBe(440);
  expect(noteHz("C#5")).toBeCloseTo(554.37, 2);
  expect(noteHz("D4")).toBeCloseTo(293.66, 2);
  for (const t of TUNES) {
    expect(t.name, t.id).toMatch(/\S/);
    expect(t.credit, t.id).toMatch(/\S/);
    const leads = new Set(t.notes.map(([n]) => leadOf(n)));
    expect(leads.size, t.id).toBeGreaterThanOrEqual(3);
    // Short, and never clipped.
    const s = tuneSamples(t);
    expect(s.length / 44100, t.id).toBeLessThan(16);
    let peak = 0;
    for (const v of s) peak = Math.max(peak, Math.abs(v));
    expect(peak, t.id).toBeLessThan(0.9);
    expect(peak, t.id).toBeGreaterThan(0.2);
  }
  // The melodies say where they come from.
  expect(TUNES.find((t) => t.id === "ode").credit).toMatch(/Beethoven.*1824/);
  expect(TUNES.find((t) => t.id === "twinkle").credit).toMatch(/traditional/);
  // The scale climbs through every mode of the cube.
  expect(new Set(TUNES[0].notes.map(([n]) => leadOf(n)))).toEqual(new Set(ladder("cube").map((m) => m.id))); // prettier-ignore
});

test("a tune's WAV holds its samples at 16 bits", () => {
  const t = TUNES[0];
  const s = tuneSamples(t, 8000);
  const b = wavBytes(s, 8000);
  const v = new DataView(b.buffer);
  expect(String.fromCharCode(...b.slice(0, 4))).toBe("RIFF");
  expect(v.getUint32(24, true)).toBe(8000);
  expect(v.getUint32(40, true)).toBe(s.length * 2);
  const i = 4000;
  expect(v.getInt16(44 + i * 2, true)).toBe(Math.round(s[i] * 32767));
});

test.describe("in the browser", () => {
  test.describe.configure({ timeout: 400_000 });
  test.use({ viewport: { width: 390, height: 844 } });

  test("each tune plays through the live path: its notes ring their modes and the beads settle on held notes", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
    await until(page, async (m) => window.__splashery.player.scene.toy.id === "chladni-cell" && document.getElementById("progress").hidden && (await import(m)).cellState().n > 0, BOX, 120_000); // prettier-ignore
    // Today's toy is still the default: nothing plays until asked.
    expect((await page.evaluate(async (m) => (await import(m)).cellAudioState(), BOX)).name).toBe(null); // prettier-ignore
    for (const t of TUNES) {
      await page.evaluate((id) => document.getElementById(`cell-tune-${id}`).click(), t.id);
      await until(page, async ([m, name]) => (await import(m)).cellAudioState().name === name, [BOX, t.name], 60_000); // prettier-ignore
      // The Toy tab names the tune and where it comes from.
      await expect(page.locator(".input-shown")).toContainText(t.name);
      await expect(page.locator(".input-shown")).toContainText(t.credit.slice(0, 20));
      const seen = new Set();
      let best = 0;
      let done = false;
      for (let k = 0; k < 200 && !done; k++) {
        await page.waitForTimeout(150);
        const a = await page.evaluate(async (m) => { const s = (await import(m)).cellAudioState(); return { lead: s.lead, p: s.p, pos: s.pos, playing: s.playing }; }, BOX); // prettier-ignore
        if (a.lead && a.playing) seen.add(a.lead);
        best = Math.max(best, a.p);
        done = !a.playing && a.pos > 1;
      }
      const want = new Set(t.notes.map(([n]) => leadOf(n)));
      const hit = [...want].filter((id) => seen.has(id));
      // Almost every mode its notes name rings as it plays (the worker may
      // miss a very short note), and the beads form a figure.
      expect(hit.length, `${t.id}: wanted ${[...want]}, saw ${[...seen]}`).toBeGreaterThanOrEqual(Math.min(want.size, Math.max(3, want.size - 1))); // prettier-ignore
      expect(best, t.id).toBeGreaterThan(0.6);
    }
    // The tap on the cell plays or pauses the tune, never the cell's own tone.
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(300);
    expect(await page.evaluate(async (m) => (await import(m)).cellState().ringing, BOX)).toBe(0);
    // Closing the audio brings back "Switch on the sound".
    await page.evaluate(() => document.getElementById("cell-close").click());
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(300);
    expect(await page.evaluate(async (m) => (await import(m)).cellState().ringing, BOX)).toBeGreaterThan(0); // prettier-ignore
    expect(errors).toEqual([]);
  });
});

// ---- Screenshots (lv9-2-*.png): the Toy tab with the tunes, while one plays ---------------

test.describe("screenshots", () => {
  test.describe.configure({ timeout: 300_000 });
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ])
    test(`the tunes in the Toy tab at ${w}×${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(APP);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("chladni-cell"));
      await until(page, async (m) => document.getElementById("progress").hidden && (await import(m)).cellState().n > 0, BOX, 120_000); // prettier-ignore
      await page.evaluate(() => document.getElementById("cell-tune-twinkle").click());
      await until(page, async (m) => (await import(m)).cellAudioState().p > 0.6, BOX, 60_000); // prettier-ignore
      // On a laptop the Toy tab shows the tunes beside the stage; on a phone
      // the stage (the figure) is the picture, as the other phone shots.
      if (w > 900)
        await page.evaluate(() => {
          window.__splashery.app.ui.showTab("play");
          document.getElementById("cell-tunes").scrollIntoView({ block: "center" });
        });
      // A held note's figure: the tune's last note (A4, 1.8 s).
      await until(page, async (m) => { const a = (await import(m)).cellAudioState(); return a.pos > 9.6 && a.p > 0.6; }, BOX, 60_000); // prettier-ignore
      await page.screenshot({ path: `tests/screenshots/lv9-2-tunes-${w}x${h}.png` });
    });
});
