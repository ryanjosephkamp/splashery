// Lane Sound D (docs/handoff/SoundD.md): the sound fixes from the owner's walkthrough of
// October 6, 2026 (docs/reviews/2026-10-06-walkthrough/notes.md and triage.md, "Sound D").
//
// - The clicking "zipper" on the photoreal shelf was the rustle voice (a run of short noise
//   grains) that ten Photoreal r2 captures shared. No photoreal toy plays it any more.
// - Each named toy's fix holds, and the sounds he kept stay.
// - Every changed toy is marked in the sound review with its plan, and its spec is sound.
// - The new recording (the water bottle's pour) and the recut popcorn pops are credited and
//   small, with a fallback.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { SOUND_CREDITS } from "../src/sound-credits.js";
import { specProblems, samplesIn } from "../src/voices.js";

const REVIEW = JSON.parse(fs.readFileSync("tools/sound-review.json", "utf8")).toys;
const ASSETS = JSON.parse(fs.readFileSync("tools/assets.json", "utf8")).soundSamples;
const CREDITS = fs.readFileSync("CREDITS.md", "utf8");

const LOST_ZIPPER = "stollen physalis monkey-doll sunflower-photo white-roses bonsai-photo mushroom-photo maple-tree peony money-tree".split(" "); // prettier-ignore
const CHANGED = [...LOST_ZIPPER, "orange-photo", "crystal-gem", "crochet-earth", "knot", "popcorn", "water-bottle", "point-clouds"]; // prettier-ignore

// Every layer of a spec (both halves of a toggle, and fallbacks).
const layers = (spec) => {
  if (!spec) return [];
  if (Array.isArray(spec)) return spec.flatMap(layers);
  if (spec.on || spec.off) return [...layers(spec.on), ...layers(spec.off)];
  return [spec, ...layers(spec.fallback)];
};
const voices = (id) => layers(TOY_SOUNDS[id]).map((l) => l.voice);

test("no photoreal toy plays the clicking rustle (the zipper)", () => {
  const photoreal = TOYS.filter((t) => t.category === "scans").map((t) => t.id);
  expect(photoreal.length).toBeGreaterThan(30);
  for (const id of photoreal) expect(voices(id), id).not.toContain("rustle");
});

test("each fix in the walkthrough holds, and what he kept stays", () => {
  // No twinkles where he said so.
  for (const id of ["physalis", "crystal-gem", "crochet-earth"]) expect(voices(id), id).not.toContain("sparkle"); // prettier-ignore
  // The Stollen's note, quieter.
  expect(TOY_SOUNDS.stollen).toMatchObject({ voice: "pluck", notes: "G5 C6" });
  expect(TOY_SOUNDS.stollen.vol).toBeLessThanOrEqual(0.4);
  // The orange: one bubble.
  expect(layers(TOY_SOUNDS["orange-photo"])).toHaveLength(1);
  expect(TOY_SOUNDS["orange-photo"].vol).toBeLessThan(1);
  // The crystal: one quieter ring.
  expect(voices("crystal-gem")).toEqual(["glass"]);
  expect(TOY_SOUNDS["crystal-gem"].vol).toBeLessThanOrEqual(0.5);
  // Kept: the monkey doll's rubber band, the white roses' glass ding, the crochet Earth's boing.
  expect(voices("monkey-doll")).toEqual(["boing"]);
  expect(voices("white-roses")).toEqual(["glass"]);
  expect(voices("crochet-earth")).toEqual(["boing"]);
  // The sunflower photo: no clicking, stretch or wind.
  for (const v of ["rustle", "stretch", "flutter", "wind", "whoosh"]) expect(voices("sunflower-photo")).not.toContain(v); // prettier-ignore
  // The golden maple: a subtler wind.
  expect(voices("maple-tree")).toEqual(["whoosh"]);
  expect(TOY_SOUNDS["maple-tree"].vol).toBeLessThanOrEqual(0.25);
  // The neon knot: the torus knot's sound, no jelly.
  expect(samplesIn(TOY_SOUNDS.knot)).toEqual([]);
  for (const v of ["creak", "bowstring", "whoom"]) {
    expect(voices("knot")).toContain(v);
    expect(voices("torus-knot")).toContain(v);
  }
  // The popcorn: short clean pops (no long tails that blur into a sizzle).
  expect(TOY_SOUNDS.popcorn).toHaveLength(14);
  for (const l of TOY_SOUNDS.popcorn) expect(l.len).toBeLessThanOrEqual(0.1);
  expect(new Set(TOY_SOUNDS.popcorn.map((l) => l.from)).size).toBe(10);
  // The water bottle: a real pour, no rushing roar.
  expect(voices("water-bottle")).not.toContain("roar");
  expect(samplesIn(TOY_SOUNDS["water-bottle"])).toEqual(["water-bottle-pour.mp3"]);
  // Point clouds: the wind and the twinkle both subtler.
  const pc = Object.fromEntries(TOY_SOUNDS["point-clouds"].map((l) => [l.voice, l.vol]));
  expect(pc.whoosh).toBeLessThanOrEqual(0.1);
  expect(pc.sparkle).toBeLessThanOrEqual(0.08);
});

test("every changed toy is in the sound review, ready to hear or approved, and its spec is sound", () => {
  for (const id of CHANGED) {
    expect(specProblems(TOY_SOUNDS[id], id)).toEqual([]);
    // "ready" until the owner hears it, "site" once he approves it (October 7, 2026).
    expect(["ready", "site"], id).toContain(REVIEW[id].status);
    expect(REVIEW[id], id).toMatchObject({ round: "2026-10-06" });
    expect(REVIEW[id].plan, id).toMatch(/^Now: .*\(Sound D\)\.$/);
    expect(REVIEW[id].said, id).toMatch(/^\(October 6, 2026, walkthrough\) /);
  }
});

test("the lane's recordings are credited, small and have a fallback", () => {
  for (const f of ["water-bottle-pour.mp3", "popcorn-pops.mp3"]) {
    expect(fs.statSync(`assets/sounds/${f}`).size, f).toBeLessThanOrEqual(12 * 1024);
    const a = ASSETS.find((x) => x.file === `assets/sounds/${f}`);
    expect(a, f).toMatchObject({ license: "CC0 1.0", checked: "October 6, 2026" });
    expect(SOUND_CREDITS[f]?.source).toBe(a.page);
    expect(CREDITS).toContain(`\`${f}\``);
  }
  for (const id of ["water-bottle", "popcorn"])
    for (const l of layers(TOY_SOUNDS[id]).filter((l) => l.voice === "sample")) expect(l.fallback, id).toBeTruthy(); // prettier-ignore
  // The neon knot's old jelly recording is gone with its sound.
  expect(fs.existsSync("assets/sounds/knot-jelly.mp3")).toBe(false);
});
