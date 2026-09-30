// Lane Pianos: the grand piano, the upright, the harpsichord and the
// electronic keyboard (docs/handoff/Pianos.md). Each builds; a tap on a key
// plays that key and moves only its own pieces; a tap elsewhere plays the
// song's opening, its notes in order; a MIDI file of your own opens.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { RECIPES, keyPoint, panelPoint } from "../src/packs/pianos.js";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { specProblems } from "../src/voices.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const IDS = ["grand-piano", "upright-piano", "harpsichord", "electronic-keyboard"];
const KEYS = { "grand-piano": 88, "upright-piano": 88, harpsichord: 61, "electronic-keyboard": 61 };

function build(id) {
  const it = buildRecipe(RECIPES[id], { seed: 1, count: 60000, options: {} }, () => {});
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Plays a recipe's drive from a fresh control state; `frames` is a list of
// { time, tap } (a tap as the app gives it).
function player(id) {
  const r = RECIPES[id];
  const data = build(id).kit.data;
  const c = Object.fromEntries(r.controls.map((x) => [x.key, x.default ?? 0]));
  let tap = null;
  return {
    r,
    c,
    frame(time, newTap = null) {
      if (newTap) tap = { ...newTap, time, n: (tap?.n ?? 0) + 1 };
      const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null }; // prettier-ignore
      r.drive(time, c, out, { time, R: 1, tap, data, sound: null });
      return out;
    },
  };
}

test.describe("pianos (no browser)", () => {
  test("each piano is on the Music shelf, builds, and has its sound", () => {
    for (const id of IDS) {
      const toy = TOYS.find((t) => t.id === id);
      expect(toy?.category, id).toBe("music");
      expect(toy?.pack, id).toBe("pianos");
      const b = build(id);
      expect(b.buf.count, id).toBeGreaterThan(40000);
      expect(b.kit.levers.length, id).toBeGreaterThanOrEqual(3);
      expect(specProblems(TOY_SOUNDS[id], id)).toEqual([]);
    }
  });

  test("every key has its own lever, and a tap on a key picks that key", () => {
    for (const id of IDS) {
      const b = build(id);
      const { anim, count } = b.kit.buf;
      const keysGroup = 0; // the keys are each toy's first lever group
      const seen = new Set();
      for (let i = 0; i < count; i++)
        if (anim[i * 4 + 1] === KINDS.lever && Math.floor(anim[i * 4 + 2] / 128) === keysGroup)
          seen.add(anim[i * 4 + 2] % 128);
      expect(seen.size, id).toBe(KEYS[id]);
      const at = RECIPES[id].action.at;
      for (let i = 0; i < KEYS[id]; i++)
        expect(at(keyPoint(id, i), {}), `${id} key ${i}`).toEqual({ key: "strike", pick: i });
      // Beside the keys: the usual action (the song's opening).
      expect(at([0, 2, 2], {}), id).toBe(null);
    }
  });

  test("a tapped key moves only its own key, hammer and damper, and comes back", () => {
    for (const id of IDS) {
      const p = player(id);
      p.frame(1);
      p.frame(1.01, { key: "strike", pick: 30, point: keyPoint(id, 30) });
      let hit = 0;
      let moved = new Set();
      for (let t = 1.02; t < 1.5; t += 0.01) {
        const out = p.frame(t);
        for (const ch of [0, 1, 2])
          out.levers[ch].forEach((v, i) => {
            if (v > 0.001 && i < KEYS[id]) moved.add(i);
          });
        hit = Math.max(hit, out.levers[0][30]);
      }
      expect(hit, id).toBeGreaterThan(0.95);
      expect([...moved], id).toEqual([30]);
      // After it comes up, every lever is back at rest.
      let out;
      for (let t = 1.5; t < 3.5; t += 0.02) out = p.frame(t);
      for (const ch of [0, 1, 2])
        expect(Math.max(...out.levers[ch].slice(0, KEYS[id])), `${id} channel ${ch}`).toBeLessThan(0.01); // prettier-ignore
    }
  });

  test("a hammer strikes the string as the note sounds, and the damper lifts", () => {
    const p = player("grand-piano");
    p.frame(1);
    p.frame(1.001, { key: "strike", pick: 39 });
    const at = (t) => p.frame(t).levers;
    expect(at(1.04)[1][39]).toBeGreaterThan(0.9); // the hammer at the string
    const later = at(1.5);
    expect(later[1][39]).toBeLessThan(0.05); // back down
    expect(later[0][39]).toBeGreaterThan(0.95); // the key still held
    expect(later[2][39]).toBeGreaterThan(0.95); // the damper still up
  });

  test("a tap elsewhere plays the opening: the keys go down in the song's order", () => {
    for (const id of IDS) {
      const p = player(id);
      const song = p.r.song;
      const notes = song.song().notes.filter((x) => !x.drum);
      const low = { "grand-piano": 21, "upright-piano": 21, harpsichord: 29, "electronic-keyboard": 36 }[id]; // prettier-ignore
      p.frame(0);
      // The opening pulse, as the app fires it.
      p.c.song = 1;
      const firstDown = new Map();
      for (let t = 0.02; t < 4; t += 1 / 60) {
        p.c.song = Math.max(0, 1 - t / 6.5);
        const out = p.frame(t);
        out.levers[0].forEach((v, i) => {
          if (v > 0.9 && i < KEYS[id] && !firstDown.has(i)) firstDown.set(i, t);
        });
      }
      // The first notes' keys go down in the song's order, at its times.
      const opening = notes.filter((x) => x.t < 3.5);
      expect(opening.length, id).toBeGreaterThan(3);
      const order = [...new Set(opening.map((x) => x.n - low))];
      const got = [...firstDown.entries()].sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      expect(got.slice(0, 4), id).toEqual(order.slice(0, 4));
      const first = opening[0];
      expect(firstDown.get(first.n - low), id).toBeCloseTo(first.t, 1);
    }
  });

  test("the electronic keyboard lights each key just before its note, and a button changes the voice", () => {
    const id = "electronic-keyboard";
    const p = player(id);
    const at = p.r.action.at;
    expect(at(panelPoint(id, 2), {})).toEqual({ key: "voice", pick: 2 });
    p.frame(0);
    p.frame(0.01, { key: "voice", pick: 2 });
    const song = p.r.song;
    song.toStart();
    song.play();
    const first = song.song().notes.find((x) => !x.drum);
    const k = first.n - 36;
    let lit = 0;
    let before = 0;
    for (let t = 0.02; t < first.t + 0.2; t += 1 / 60) {
      const out = p.frame(t);
      if (t < first.t - 0.05) before = Math.max(before, out.levers[1][k]);
      lit = Math.max(lit, out.levers[1][k]);
      // The chosen button stays lit.
      expect(out.levers[1][61 + 2]).toBeGreaterThan(0.3);
    }
    expect(before).toBeGreaterThan(0.2);
    expect(lit).toBeGreaterThan(0.8);
    song.pause();
  });
});

test.describe("pianos (in the app)", () => {
  async function open(page, id, size) {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(size);
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate((x) => window.__splashery.app.chooseToy(x), id);
    return errors;
  }

  test("a MIDI file opens on the grand piano and the song bar plays it", async ({ page }) => {
    const errors = await open(page, "grand-piano", { width: 1440, height: 900 });
    await expect(page.locator("#song-bar-title")).toHaveValue("Für Elise");
    const midi = await page.evaluate(async () => {
      const { writeMidi, songFromText } = await import("/src/songs.js");
      return Array.from(writeMidi(songFromText({ title: "Scale", text: "C4/8 D4/8 E4/8 F4/8 G4/8 A4/8 B4/8 C5/4 C9/4" }))); // prettier-ignore
    });
    await page.setInputFiles("#song-file", { name: "scale.mid", mimeType: "audio/midi", buffer: Buffer.from(midi) }); // prettier-ignore
    await expect(page.locator("#song-bar-title")).toHaveValue("Scale");
    await expect(page.locator("#toast")).toContainText("1 note moved by octaves");
    // Opening a file starts it playing; the bar's button then shows pause.
    await expect(page.locator("#game-play")).toHaveAttribute("data-playing", "true");
    await page.waitForFunction(() => window.__splashery.player.toyInfo.recipe.song.state().pos > 0.5); // prettier-ignore
    expect(errors).toEqual([]);
  });

  for (const id of IDS)
    test(`${id}: screenshots at 390x844 and 1440x900`, async ({ page }) => {
      for (const size of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ]) {
        const errors = await open(page, id, size);
        await expect(page.locator("#game-bar")).toBeVisible();
        await page.evaluate(async () => {
          const { player } = window.__splashery;
          player.camera.setTurntable(false);
          for (let i = 0; i < 4; i++) await player.stage.captureFrame();
        });
        await page.screenshot({ path: `tests/screenshots/pno-${id}-${size.width}x${size.height}.png` }); // prettier-ignore
        expect(errors).toEqual([]);
      }
    });
});
