# Lane Pianos: pianos and songs

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Pianos, "Pianos and songs" (prefix `pno`). Branches:
claude/lane-pianos-engine (the engine PR, "Engine: songs, a song bar and a MIDI reader") and
claude/lane-pianos (the toys, "Phase Pianos: pianos and songs"). Handoff file:
docs/handoff/Pianos.md.

## Brief (written by the Operator on September 29, 2026, from the owner's own "Pianos" ideas on the Toy Ideas page and step 5 of ROADMAP.md, "Pianos and songs")

The owner approved five pianos of his own on the Toy Ideas page. The toy piano is being built
separately (a blind A/B lane); leave it alone. You build the other four, and the song engine they
share. The owner's words for the set: "Each piano works like the xylophone: tap a key to play that
note, tap anywhere else for its song. Each can also play a song file of your own."

### Part 1: the engine PR (first, on claude/lane-pianos-engine)

The owner's note on the grand piano, word for word: "Your own songs: MIDI (.mid) is the natural
match for the chess toy's PGN or the protein's PDB. It is the standard file of notes and timings,
and it maps key for key onto a piano, so the right keys go down. The toy would read the file in the
page (a small reader, no library), use its notes and its sustain pedal, move any note outside the
keyboard up or down by octaves, and show a song bar like the chess game bar: a title you can edit,
play and pause, back to the start, speed and loop. It could also take ABC notation pasted as text (a
plain-text tune format; thousands of folk tunes are online). The built-in songs are public-domain
compositions we write out ourselves, so no recording rights are involved. It needs a small engine
change first (the chess game bar made general for songs, plus the file reader), as its own "Engine:"
PR."

- A MIDI reader in the page (our own code, no library): Standard MIDI Files, format 0 and 1, notes
  on and off, velocity, tempo changes and the sustain pedal (controller 64); the notes come out as a
  plain list a recipe can play. Notes outside a toy's keyboard move by octaves into its range.
- The song bar: the chess game bar (`src/ui.js`, "The game bar") made general, so a song toy shows
  it too: an editable title, play and pause, back to the start, speed and loop, and where the song
  has got to. The chess bar keeps working exactly as now.
- Opening a song file through the Toy tab's input panel (`input.binary` exists since #81); ABC
  notation pasted as text if it fits in the time, otherwise cut it and say so.
- A small recipe API for songs (you design it; the piano recipes use it), documented in
  docs/PACKS.md, and tests in tests/pno-engine.spec.mjs (the reader on small MIDI files you make,
  the bar, the chess bar unchanged).
- Keep it additive and small, as every "Engine: …" PR. Say READY for it on its own; the Operator
  runs the full suite through the Integrator and merges it before your toy PR.

### Part 2: the four pianos (on claude/lane-pianos, a new pack `src/packs/pianos.js` on the Music shelf)

The owner's ideas, word for word:

1. **Grand piano** (`grand-piano`). Tap: "Tap a key: it dips, its hammer flies up under the open lid
   and strikes the strings, and the damper lifts while the note rings. Tap anywhere else: it plays
   the opening of its song, every key and hammer moving with the notes and the sustain pedal going
   down with the phrases (about 5 s; the whole song plays from the song bar)." Sound: "A warm
   concert-grand voice made in the page (felt thump, ringing partials, the damper's soft stop).
   Built-in songs are public-domain pieces: Für Elise, Clair de lune, Gymnopédie No. 1, Ode to Joy."
   Why: "Instruments are played: you see the key, the hammer and the damper move for every note."
2. **Upright piano** (`upright-piano`). Tap: "Tap a key to play it: the front panel is off, so you
   see the row of hammers swing forward onto the upright strings. Tap elsewhere for its song, a
   ragtime (The Entertainer), the hammers rippling along the row." Sound: "A brighter, slightly
   honky-tonk upright voice, so it sounds different from the grand." Why: "A twin of the grand that
   looks and sounds different: hammers in view, a bar-room tone."
3. **Harpsichord** (`harpsichord`). Tap: "Tap a key: its jack rises and the quill plucks the string,
   which you see quiver. Tap elsewhere: the Minuet in G from Bach's notebook, the jacks bobbing like
   a row of dancers." Sound: "A bright, plucked harpsichord voice, made in the page." Why: "A
   keyboard that plucks instead of striking: a different motion and a different sound."
4. **Electronic keyboard** (`electronic-keyboard`). Tap: "Tap a key to play it. Tap elsewhere and
   the keys light up just ahead of each note, like a learning keyboard, while the little screen
   scrolls the song's title and a beat starts on the drum pads. Panel buttons switch the voice:
   piano, organ, synth, vibes." Sound: "Four synth voices and a simple drum beat, all made in the
   page." Why: "Lit keys show the song before it plays: a toy you can learn a tune from." (No brand
   names or logos on the panel.)

What good looks like:

- Kit-built, public toys (not labs). Every key, hammer, damper, jack and string that moves is its
  own solid part; a tap on a key plays that key (per-key taps, as the xylophone does with `pick`;
  docs/handoff/history.md).
- As many keys as the budgets allow, up to a full 88 on the grand and upright; measure the splats
  and parts, and say what you chose and why.
- Songs play from the song bar, and each piano opens a MIDI file of your own. Write the built-in
  songs out yourself from the public-domain scores (compositions only, never recordings); keep each
  built-in song short enough to load fast. If you ship sample .mid files, make them yourself from
  those notes (CC0, ours).
- New voices in src/voices.js (a concert grand, an upright, a harpsichord, organ, synth, vibes and a
  small drum kit) where the existing voices can't make them; add them, don't change existing voices.
  Each toy's entry in src/toy-sounds.js.
- Follow the effect quality rules in CLAUDE.md (instruments are played: keys, hammers and strings
  visibly move with each note; parts move as solid pieces; real materials: black lacquer, ivory and
  ebony keys, felt, brass, bright strings; no speckle, no see-through solids) and Fidelity A's
  method (even placement, full opacity, full density, clean colors).
- A how-to line and an About text per toy in src/toy-help.js, a toy-plan entry each, and a thumbnail
  each.

If time runs short, build in this order (engine, grand, upright, harpsichord, electronic keyboard)
and cut from the end; say what was cut.

Clips and cards (390×844), each labeled "built by Opus 5.5", in the lane record "Pianos" on the
Effect review page (the Operator made it):

- `pno-song-bar`: the song bar on a phone, with a MIDI file opened;
- `pno-grand-keys` (three keys, close enough to see hammer and damper), `pno-grand-song`;
- `pno-upright`, `pno-harpsichord`, `pno-keyboard` (each: a key, then the song);
- `pno-stills`: a sharp still of each piano.

Tests: tests/pno-engine.spec.mjs (the engine PR) and tests/pno.spec.mjs (each piano builds, a key
tap moves only that key's parts as solid pieces, the song plays notes in order, a MIDI file opens,
screenshots at 390×844 and 1440×900).

## You own

- The engine PR: a new `src/midi.js` (or `src/songs.js`), the game bar's block in `src/ui.js` and
  its markup and styles in `index.html` and `styles.css`, additive voices in `src/voices.js`, your
  section in docs/PACKS.md, tests/pno-engine.spec.mjs.
- The toy PR: `src/packs/pianos.js` (new), `assets/toys/grand-piano/`, `assets/toys/upright-piano/`,
  `assets/toys/harpsichord/`, `assets/toys/electronic-keyboard/`, your toys' entries in the shared
  lists, tests/pno.spec.mjs, your `pno-*` screenshots and docs/handoff/Pianos.md.
- `src/packs/music.js` is frozen: don't edit it (read the xylophone there to learn `pick`). Leave
  the toy piano to the A/B lane.

Lanes Worlds, Fidelity A, Fidelity B, the two A/B makers, Anatomy and the Integrator run at the same
time; leave their files alone. Two sound lanes may start while you run (they edit src/toy-sounds.js
entries of existing toys); keep to your own entries. The laptop is locked.

## State

Model: Opus 5.5 (default effort), for the whole lane. No helpers used.

- Engine PR (claude/lane-pianos-engine): `src/songs.js` (MIDI and ABC readers, the song player,
  `songControls`), the lever kind (22) in `src/effects.js` (GLSL and WGSL), `src/kit.js` and
  `src/motion.js`, the song bar in `src/ui.js`, `index.html` and `styles.css`, six keyboard voices
  in `src/voices.js` (grand, upright, harpsichord, organ, synth, vibes; the drum pads reuse kick,
  snare, hat and tom), PACKS.md section 5d, tests/pno-engine.spec.mjs (14 tests).
- Toy PR (claude/lane-pianos): `src/packs/pianos.js` with the four toys, their shared-list entries,
  thumbnails, tests/pno.spec.mjs, `tools/pno-clip.mjs` (phone-sized clips with the song bar).
- Keys: the grand and the upright have the full 88 (A0 to C8), the harpsichord 61 (F1 to F6), the
  electronic keyboard 61 (C2 to C7). Every key, hammer, damper, jack and string that moves is its
  own lever. Builds: about 190,000 splats at the high tier (density 1.4 for the pianos, 1.2 for the
  keyboard), 0.5 to 1.4 s in `node tools/check-packs.mjs pianos`.
- Built-in songs (written out from the public-domain scores, checked against the Mutopia Project's
  public-domain editions): Für Elise (the A section twice with both endings, the middle part and the
  theme again), Clair de lune (the first eight bars), Gymnopédie No. 1 (the first 26 bars), Ode to
  Joy (the theme with a simple left hand, written by hand), The Entertainer (the introduction and
  the first strain), the Minuet in G (both halves, each twice), Twinkle, Twinkle, Little Star and
  Frère Jacques (by hand).

## Notes

- Why levers: a kit toy has at most 15 parts and 48 tokens, and a full grand needs 88 keys, 88
  hammers and about 70 dampers moving one by one. The lever kind moves up to 96 pieces per group, in
  up to 6 groups, each by its own amount from three channels (key, hammer, damper), with two new
  uniform arrays (42 vec4 in all).
- Song audio is scheduled by the recipe a quarter second ahead on the audio clock (the song player),
  not through `out.cues` (cues play on the frame, 60 ms apart at best, which drops chord notes).
  `src/voices.js` is imported only once the speaker is on, so embeds never load it.
- A tapped key plays through the app with `pick` (the toy-sounds spec lists every key); the
  electronic keyboard plays its keys from the recipe instead, in the voice chosen on its panel.
- The drum beat: a MIDI file's own drums (channel 10) when it has them, else kick, snare, hi-hat and
  a tom fill every four bars.
- Built-in songs start after a half-second lead-in, so the first key can light (and the first hammer
  rise) before it sounds.
- Build time: straight tubes need `{ samples: 4, grid: 12 }` and big curved surfaces an explicit
  `normal`, or a toy with hundreds of pieces is slow to build.

- Review (September 29, 2026): the owner marked pno-grand-keys, pno-grand-song and pno-song-bar
  "fix": mechanics perfect, needs more detail and sharpness. Fixed in the same PR with lanes
  Fidelity A and B's method (PACKS.md 7c): even shapes from `src/packs/even.js` for every box,
  cylinder, cone and rounded box, color jitter at most 0.01, density 1.7 (1.5 for the keyboard), and
  the strings as continuous thin lines. All seven clips redone as `-r2` cards (the old ones marked
  replaced).
- Full suite (claude/lane-pianos with main 60b775d, in 12 shards): about 430 passed, 2 failed: this
  lane's MIDI test (fixed) and `tests/bk.spec.mjs` "a video's time, length and seek", which fails
  the same way on plain main 456e890.
- The container is reclaimed while the session is idle, which kills background runs: a long run has
  to be watched from an active turn (or run in shards that can resume).

## Known issues

- Clair de lune and Gymnopédie are openings, not the whole pieces, to keep the pack small.
- The strings are one wire per key (a real grand has about 230), laid straight rather than
  cross-strung.

## For the Operator

- The brief suggested opening songs through the Toy tab's input panel; the song panel (like the
  chess game panel) does it instead, with the built-in songs, "Open a MIDI file…" and "Paste ABC" (a
  multi-line box, which the input panel doesn't have).
- PACKS.md section 5d is written in the engine PR (the brief listed it as mine).
- `tools/pno-clip.mjs` is new (phone-sized clips with the page's song bar).
