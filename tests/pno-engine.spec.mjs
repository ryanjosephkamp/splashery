// Lane Pianos' engine addition (docs/handoff/Pianos.md): songs for the
// keyboard toys. A MIDI reader and an ABC reader of our own (src/songs.js),
// the song player a recipe drives, the lever kind (many keys, hammers and
// dampers, each moved by its own amount), the song bar (the chess game bar
// made general) and its panel in the Toy tab. The chess bar stays as it was.

import { test, expect } from "@playwright/test";
import {
  readMidi,
  readAbc,
  fitNotes,
  writeMidi,
  songFromText,
  SongPlayer,
  songControls,
  ringEnd,
  midiOf,
  noteName,
} from "../src/songs.js";
import { buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { specProblems } from "../src/voices.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// A MIDI file written byte by byte: format 1, 96 ticks per quarter, a
// tempo track (120, then 60 per minute from beat 2) and a note track with
// running status, a note-on of velocity 0 as a note-off, a chord and the
// sustain pedal.
function handMadeMidi() {
  const trk = (bytes) => [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, bytes.length, ...bytes];
  const tempo = [
    0x00, 0xff, 0x03, 0x04, ...[..."Test"].map((c) => c.charCodeAt(0)), // the title
    0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // 500000 µs per quarter (120)
    0x81, 0x40, 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40, // at tick 192: 1000000 (60)
    0x00, 0xff, 0x2f, 0x00,
  ]; // prettier-ignore
  const notes = [
    0x00, 0x90, 60, 100, // C4 on at 0
    0x60, 60, 0, // running status: C4 off (velocity 0) at 96 (0.5 s)
    0x00, 64, 80, // E4 on at 96
    0x00, 0xb0, 64, 127, // pedal down at 96
    0x60, 0x80, 64, 0, // E4 off at 192 (1 s)
    0x00, 0x90, 67, 90, // G4 + C5 at 192
    0x00, 72, 90,
    0x60, 67, 0, // at 288 (2 s: 60 per minute now)
    0x00, 72, 0,
    0x00, 0xb0, 64, 0, // pedal up at 288
    0x00, 0xff, 0x2f, 0x00,
  ]; // prettier-ignore
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 0, 96];
  return new Uint8Array([...head, ...trk(tempo), ...trk(notes)]);
}

test.describe("songs (no browser)", () => {
  test("a MIDI file: notes, velocities, tempo changes, running status and the pedal", () => {
    const s = readMidi(handMadeMidi(), "test.mid");
    expect(s.title).toBe("Test");
    const got = s.notes.map((x) => [noteName(x.n), +x.t.toFixed(3), +x.d.toFixed(3)]);
    expect(got).toEqual([
      ["C4", 0, 0.5],
      ["E4", 0.5, 0.5],
      ["G4", 1, 1],
      ["C5", 1, 1],
    ]);
    expect(s.notes[0].v).toBeCloseTo(100 / 127, 3);
    expect(s.pedal.length).toBe(1);
    expect(s.pedal[0][0]).toBeCloseTo(0.5, 3);
    expect(s.pedal[0][1]).toBeCloseTo(2, 3);
    // E4 is let go under the pedal, so it rings until the pedal lifts; so
    // does C4, let go just as the pedal goes down. G4 ends as it lifts.
    expect(ringEnd(s, s.notes[1])).toBeCloseTo(2, 3);
    expect(ringEnd(s, s.notes[0])).toBeCloseTo(2, 3);
    expect(ringEnd(s, s.notes[2])).toBeCloseTo(2, 3);
  });

  test("our own MIDI writer and the reader agree, chords and drums too", () => {
    const song = songFromText({
      title: "Round trip",
      bpm: 90,
      text: "C4/4 E4/8 G4/8 P C5+E5/2 p r/4 && C3/1 G2/2",
    });
    song.notes.push({ t: 0.5, d: 0.1, n: 38, v: 0.8, ch: 9, drum: true });
    const back = readMidi(writeMidi(song));
    expect(back.title).toBe("Round trip");
    const sig = (s) => s.notes.map((x) => `${x.n}@${x.t.toFixed(2)}+${x.d.toFixed(2)}${x.drum ? "d" : ""}`).sort(); // prettier-ignore
    expect(sig(back)).toEqual(sig(song));
    expect(back.pedal.length).toBe(1);
  });

  test("a file that isn't MIDI, or a broken one, gives a plain message", () => {
    expect(() => readMidi(new TextEncoder().encode("hello there"))).toThrow(/isn't a MIDI file/);
    const cut = handMadeMidi().slice(0, 30);
    expect(() => readMidi(cut)).toThrow(/no notes/);
  });

  test("ABC: key signature, repeats and endings, broken rhythm, triplets, chords and ties", () => {
    const s = readAbc(`X:1
T:A test tune
C:Trad.
M:4/4
L:1/8
Q:1/4=120
K:D
|:DF A2 d>c (3BAG|1 [DFA]4 z4:|2 A6- A2|]`);
    expect(s.title).toBe("A test tune");
    expect(s.composer).toBe("Trad.");
    const names = s.notes.map((x) => noteName(x.n));
    // D major: F and C are sharp. The repeat plays twice, each with its ending.
    expect(names.slice(0, 7)).toEqual(["D4", "F#4", "A4", "D5", "C#5", "B4", "A4"]);
    expect(names.slice(8, 11)).toEqual(["D4", "F#4", "A4"]); // the chord
    expect(names.length).toBe(8 + 3 + 8 + 1);
    // An eighth is 0.25 s at 120 quarters per minute; d> makes 3/16 + 1/16.
    const d = s.notes[3];
    const c = s.notes[4];
    expect(c.t - d.t).toBeCloseTo(0.375, 3);
    // The triplet's three notes fit in two eighths.
    expect(s.notes[7].t - s.notes[5].t).toBeCloseTo((2 * 0.5) / 3, 3);
    // The tie joins A6- A2 into one note of a whole bar.
    expect(s.notes[s.notes.length - 1].d).toBeGreaterThan(1.8);
  });

  test("ABC without a header still plays, and junk says so", () => {
    expect(readAbc("CDEF GABc").notes.length).toBe(8);
    expect(() => readAbc("")).toThrow(/Paste a tune/);
    expect(() => readAbc("X:1\nT:Nothing\nK:C\n")).toThrow(/no notes/);
  });

  test("notes beyond the keyboard move in by octaves; drums stay", () => {
    const s = { notes: [{ n: 20, t: 0, d: 1 }, { n: 110, t: 0, d: 1 }, { n: 60, t: 0, d: 1 }, { n: 36, t: 0, d: 1, drum: true }] }; // prettier-ignore
    expect(fitNotes(s, 48, 84).notes.map((x) => x.n)).toEqual([56, 74, 60, 36]);
    expect(midiOf("A0")).toBe(21);
    expect(midiOf("C8")).toBe(108);
    expect(midiOf("Bb3")).toBe(58);
  });

  test("the song player: keys down, struck and coming, and notes scheduled once, in order", () => {
    const song = songFromText({ title: "Steps", bpm: 120, text: "C4/4 D4/4 E4/4 F4/4" });
    const p = new SongPlayer({ low: 48, high: 72, ahead: 0.6 });
    p.load(song);
    const k = p.keys(0.3);
    expect(k.down[60 - 48]).toBe(1);
    expect(k.since[60 - 48]).toBeCloseTo(0.3, 3);
    expect(k.next[62 - 48]).toBeCloseTo(0.2, 3);
    expect(k.down[62 - 48]).toBe(0);
    // Play with a fake sound: each note is scheduled once, in order.
    let now = 10;
    const sound = { enabled: true, audio: () => ({ currentTime: now }) };
    const heard = [];
    p.play();
    for (let t = 0; t <= 2.5; t += 1 / 60) {
      now = 10 + t;
      p.update(t, sound, (note, when) => heard.push([note.n, when]));
    }
    expect(heard.map((x) => x[0])).toEqual([60, 62, 64, 65]);
    for (let i = 1; i < heard.length; i++)
      expect(heard[i][1] - heard[i - 1][1]).toBeCloseTo(0.5, 1);
    expect(p.playing).toBe(false);
    // The opening: play until a time, then stop.
    p.toStart();
    p.play({ until: 0.6 });
    for (let t = 3; t <= 4; t += 1 / 60) p.update(t);
    expect(p.playing).toBe(false);
    expect(p.pos).toBeCloseTo(0.6, 1);
    // Loop: back to the start at the end.
    p.setLoop(true);
    p.seek(song.length - 0.1);
    p.play();
    for (let t = 5; t <= 5.3; t += 1 / 60) p.update(t);
    expect(p.playing).toBe(true);
    expect(p.pos).toBeLessThan(0.4);
    // Speed doubles how fast the song moves.
    p.pause();
    p.setLoop(false);
    p.toStart();
    p.setSpeed(2);
    p.play();
    for (let t = 6; t <= 6.5 + 1e-9; t += 0.05) p.update(t);
    expect(p.pos).toBeCloseTo(1, 1);
  });

  test("a recipe's song: built-in songs, your own file, and the bar's buttons", async () => {
    const p = new SongPlayer({ low: 60, high: 84 });
    const song = songControls(p, {
      songs: [
        { id: "a", title: "Song A", make: () => songFromText({ title: "Song A", composer: "Us", text: "C4/4 G4/4" }) }, // prettier-ignore
        { id: "b", title: "Song B", make: () => songFromText({ title: "Song B", text: "E5/2" }) },
      ],
    });
    expect(song.title()).toBe("Song A");
    // C4 is below the keyboard (60 is its lowest, so C4 stays; G4 fits).
    expect(song.state().notes).toBe(2);
    song.choose("b");
    expect(song.title()).toBe("Song B");
    song.setTitle("My name for it");
    expect(song.title()).toBe("My name for it");
    const r = await song.load(writeMidi(songFromText({ title: "Low", text: "C2/4 C7/4 E4/4" })), "low.mid"); // prettier-ignore
    expect(r.moved).toBe(2);
    expect(song.current()).toBe("own");
    expect(song.list().map((x) => x.id)).toEqual(["a", "b", "own"]);
    expect(song.song().notes.map((x) => noteName(x.n))).toEqual(["C4", "C6", "E4"]);
  });

  test("the keyboard voices and their key-held time are valid sound specs", () => {
    for (const voice of ["grand", "upright", "harpsichord", "organ", "synth", "vibes"])
      expect(specProblems({ voice, f: "C4", hold: 0.5 }), voice).toEqual([]);
  });

  test("levers: groups fitted with the toy, and lever splats keep their index", () => {
    const recipe = {
      build(k) {
        const g = k.lever({ pivot: [0, 0, -1], axis: [1, 0, 0], angle: 0.1 });
        const d = k.lever({ dir: [0, 1, 0], move: 0.5, channel: 2, glow: "#ff0000" });
        k.add(k.box(0.2, 0.1, 1), { pos: [0, 0, 0], kind: "lever", params: [k.leverParam(g, 5), 0] }); // prettier-ignore
        k.add(k.box(0.2, 0.1, 0.2), { pos: [0, 1, 0], kind: "lever", params: [k.leverParam(d, 5), 0] }); // prettier-ignore
        k.add(k.box(2, 0.1, 2), { pos: [0, -1, 0] });
      },
    };
    const it = buildRecipe(recipe, { seed: 1, count: 3000 }, () => {});
    let r = it.next();
    while (!r.done) r = it.next();
    const k = r.value.kit;
    expect(k.levers.length).toBe(2);
    const s = k.transform.scale;
    expect(k.levers[1].amount).toBeCloseTo(0.5 * s, 5);
    expect(k.levers[0].pivot[2]).toBeCloseTo((-1 - k.transform.center[2]) * s, 5);
    const { anim, count } = k.buf;
    const idx = new Set();
    for (let i = 0; i < count; i++) if (anim[i * 4 + 1] === KINDS.lever) idx.add(anim[i * 4 + 2]);
    expect([...idx].sort((a, b) => a - b)).toEqual([5, 128 + 5]);
    expect(() => k.leverParam(0, 96)).toThrow(/0 to 95/);
  });
});

// A stand-in song toy: the xylophone's recipe is swapped (in this page
// only) for a row of lever keys with a song, so the engine is tested
// without the piano pack.
async function songToy(page, { withSong = true } = {}) {
  await page.evaluate(async (withSong) => {
    const music = await import("/src/packs/music.js");
    const { SongPlayer, songControls, songFromText } = await import("/src/songs.js");
    const player = new SongPlayer({ low: 60, high: 71 });
    const song = songControls(player, {
      songs: [
        {
          id: "steps",
          title: "Steps",
          make: () => songFromText({ title: "Steps", composer: "A test", bpm: 120, text: "C4/4 D4/4 E4/4 F4/4 G4/4 A4/4 B4/4 C4+E4+G4/2" }), // prettier-ignore
        },
      ],
    });
    window.__testSong = { player, song };
    const keys = new Float32Array(12);
    const lights = new Float32Array(12);
    const lift = new Float32Array(12);
    window.__testLevers = { keys, lights, lift };
    music.RECIPES.xylophone = {
      alive: true,
      controls: [{ key: "strike", label: "Strike", type: "pulse", ease: 1 }],
      action: { key: "strike", label: "Strike" },
      ...(withSong ? { song } : {}),
      drive(t, c, out, info) {
        player.update(info.time);
        const k = player.keys();
        for (let i = 0; i < 12; i++) keys[i] = Math.max(window.__testLevers.force ?? 0, k.down[i]);
        out.levers = [keys, window.__testLevers.lights, window.__testLevers.lift];
      },
      build(k) {
        const tip = k.lever({ pivot: [0, 0, -1], axis: [1, 0, 0], angle: 0.35 });
        const lift = k.lever({ dir: [0, 1, 0], move: 0.8, channel: 2, glow: "#ff2020", glowChannel: 1 }); // prettier-ignore
        for (let i = 0; i < 12; i++) {
          const x = -1.1 + i * 0.2;
          k.add(k.box(0.17, 0.12, 1.6), { pos: [x, 0, 0], color: "#f4efe4", kind: "lever", params: [k.leverParam(tip, i), 0] }); // prettier-ignore
          k.add(k.box(0.12, 0.12, 0.12), { pos: [x, 0.5, -0.9], color: "#3060d0", kind: "lever", params: [k.leverParam(lift, i), 0] }); // prettier-ignore
        }
        k.add(k.box(2.6, 0.1, 2.2), { pos: [0, -0.3, 0], color: "#303030" });
      },
    };
  }, withSong);
}

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

async function pixels(page) {
  return page.evaluate(async () => {
    const { player } = window.__splashery;
    const cam = player.camera;
    player.camera.setTurntable(false);
    cam.cur = { ...cam.home };
    cam.tgt = { ...cam.home };
    for (let i = 0; i < 6; i++) await player.stage.captureFrame();
    const c = await player.stage.captureFrame();
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    // Every fourth pixel, all four channels.
    return Array.from(d.filter((_, i) => (i >> 2) % 4 === 0));
  });
}
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
// Pixels that glow: red well above green (the blue block tinted red).
const glowing = (a) => {
  let n = 0;
  for (let i = 0; i + 3 < a.length; i += 4) if (a[i] - a[i + 1] > 80) n++;
  return n;
};

test("levers move and light their own pieces, and come back", async ({ page }) => {
  const errors = await open(page);
  await songToy(page, { withSong: false });
  await page.evaluate(() => window.__splashery.app.chooseToy("xylophone"));
  await page.evaluate(() => window.__splashery.app.setMotion({ move: "still" }));
  const rest = await pixels(page);
  const again = await pixels(page);
  expect(diff(rest, again)).toBeLessThan(0.5);
  // Every key tips down; then one block lifts and glows.
  await page.evaluate(() => (window.__testLevers.force = 1));
  const tipped = await pixels(page);
  expect(diff(rest, tipped)).toBeGreaterThan(1);
  await page.evaluate(() => {
    window.__testLevers.force = 0;
    window.__testLevers.lift[3] = 1;
    window.__testLevers.lights[3] = 1;
  });
  const lifted = await pixels(page);
  expect(diff(rest, lifted)).toBeGreaterThan(0.1);
  expect(glowing(rest)).toBeLessThan(5);
  expect(glowing(lifted)).toBeGreaterThan(20);
  await page.evaluate(() => {
    window.__testLevers.lift[3] = 0;
    window.__testLevers.lights[3] = 0;
  });
  const back = await pixels(page);
  expect(diff(rest, back)).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});

test("the song bar: title, play and pause, back to the start, loop, speed and where it is", async ({
  page,
}) => {
  const errors = await open(page);
  await songToy(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("xylophone"));
  const bar = page.locator("#game-bar");
  await expect(bar).toBeVisible();
  await expect(page.locator("#song-bar-title")).toHaveValue("Steps");
  await expect(page.locator("#game-bar-info")).toHaveText("A test");
  await expect(page.locator("#game-bar-move")).toHaveText("0:00 / 0:04");
  // The chess buttons are hidden; the song's are shown.
  for (const id of ["#game-back", "#game-next", "#game-end", "#game-bar-title"])
    await expect(page.locator(id)).toBeHidden();
  for (const id of ["#game-start", "#game-play", "#song-loop", "#song-speed", "#song-seek"])
    await expect(page.locator(id)).toBeVisible();
  await page.click("#game-play");
  await expect(page.locator("#game-play")).toHaveAttribute("data-playing", "true");
  await page.waitForFunction(() => window.__testSong.player.pos > 1.2);
  await page.click("#game-play");
  await expect(page.locator("#game-play")).toHaveAttribute("data-playing", "false");
  await expect(page.locator("#game-bar-move")).toHaveText(/^0:0[1-4] \/ 0:04$/);
  await page.click("#game-start");
  expect(await page.evaluate(() => window.__testSong.player.pos)).toBe(0);
  await page.click("#song-loop");
  await expect(page.locator("#song-loop")).toHaveAttribute("aria-pressed", "true");
  await page.selectOption("#song-speed", "1.5");
  expect(await page.evaluate(() => window.__testSong.player.speed)).toBe(1.5);
  await page.locator("#song-seek").fill("500");
  expect(
    await page.evaluate(
      () => window.__testSong.player.pos * 2 - window.__testSong.player.song.length,
    ),
  ).toBeCloseTo(0, 1);
  // The title can be edited.
  await page.fill("#song-bar-title", "Up the steps");
  await page.press("#song-bar-title", "Enter");
  expect(await page.evaluate(() => window.__testSong.song.title())).toBe("Up the steps");
  await expect(page.locator("#toy-song .game-title")).toHaveText("Playing: Up the steps");
  expect(errors).toEqual([]);
});

test("the song panel opens a MIDI file and takes ABC pasted as text", async ({ page }) => {
  const errors = await open(page);
  await songToy(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("xylophone"));
  await page.evaluate(() => window.__splashery.ui?.showTab?.("toy"));
  const midi = await page.evaluate(async () => {
    const { writeMidi, songFromText } = await import("/src/songs.js");
    return Array.from(writeMidi(songFromText({ title: "From a file", text: "C5/8 D5/8 E5/4 C2/4" }))); // prettier-ignore
  });
  await page.setInputFiles("#song-file", {
    name: "from-a-file.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from(midi),
  });
  await expect(page.locator("#song-bar-title")).toHaveValue("From a file");
  await expect(page.locator("#song-choice")).toHaveValue("own");
  await expect(page.locator("#toast")).toContainText("4 notes");
  await expect(page.locator("#toast")).toContainText("4 notes moved by octaves");
  // A file that isn't a song says so.
  await page.setInputFiles("#song-file", { name: "x.mid", mimeType: "audio/midi", buffer: Buffer.from("MThd nonsense") }); // prettier-ignore
  await expect(page.locator("#toy-song .warning")).toBeVisible();
  // ABC pasted as text.
  await page.evaluate(() => {
    document.getElementById("song-paste").click();
  });
  await page.fill("#song-text", "X:1\nT:Pasted tune\nM:3/4\nL:1/4\nK:G\nGAB|c2B|");
  await page.evaluate(() => document.getElementById("song-play-text").click());
  await expect(page.locator("#song-bar-title")).toHaveValue("Pasted tune");
  expect(await page.evaluate(() => window.__testSong.song.state().notes)).toBe(5);
  // Back to the toy's own song.
  await page.selectOption("#song-choice", "steps");
  await expect(page.locator("#song-bar-title")).toHaveValue("Steps");
  expect(errors).toEqual([]);
});

test("the chess bar is unchanged next to the song bar", async ({ page }) => {
  const errors = await open(page);
  await songToy(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("xylophone"));
  await expect(page.locator("#song-bar-title")).toBeVisible();
  await page.evaluate(() => window.__splashery.app.chooseToy("chess-set"));
  await expect(page.locator("#game-bar")).toBeVisible();
  await expect(page.locator("#game-bar-title")).toContainText("Opera Game");
  for (const id of ["#game-back", "#game-next", "#game-end", "#game-bar-title"])
    await expect(page.locator(id)).toBeVisible();
  for (const id of ["#song-bar-title", "#song-loop", "#song-speed", "#song-seek"])
    await expect(page.locator(id)).toBeHidden();
  await expect(page.locator("#game-bar-move")).toHaveText("17 moves");
  // A toy with neither hides the bar.
  await page.evaluate(() => window.__splashery.app.chooseToy("hockey-puck"));
  await expect(page.locator("#game-bar")).toBeHidden();
  expect(errors).toEqual([]);
});
