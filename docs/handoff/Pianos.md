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

Model: Opus 5.5 (default effort), for the whole lane.

- Engine PR (claude/lane-pianos-engine): written and tested. `src/songs.js` (MIDI and ABC readers,
  the song player, `songControls`), the lever kind (22) in `src/effects.js` (GLSL and WGSL),
  `src/kit.js` and `src/motion.js`, the song bar in `src/ui.js`, `index.html` and `styles.css`, six
  keyboard voices in `src/voices.js`, PACKS.md section 5d, tests/pno-engine.spec.mjs.
- Toy PR (claude/lane-pianos): in progress.

## Notes

- Why levers: a kit toy has at most 15 parts and 48 tokens, and a full grand needs 88 keys, 88
  hammers and about 70 dampers moving one by one. The lever kind moves up to 96 pieces per group, in
  up to 6 groups, each by its own amount from three channels (key, hammer, damper), with two new
  uniform arrays (42 vec4 in all).

## Known issues

## For the Operator
