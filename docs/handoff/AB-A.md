# Lane AB-A: the blind A/B toy (maker A)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: the blind A/B toy, **maker A** (prefix `aba`). Branch:
claude/lane-ab-a. PR title: "Phase A/B (maker A): the toy piano". Handoff file:
docs/handoff/AB-A.md.

### Brief (written by the Operator on September 29, 2026)

The owner accepted "one blind A/B toy, the same small toy built by each model, marked by the owner
without knowing which is which", for the blog post. Two sessions build the same toy from this same
brief, one on each model. You are maker A. The other maker works at the same time on its own branch;
don't look at its branch or cards, and don't coordinate. Only the better one of the two merges,
chosen by the owner's marks.

**Keep it blind.** The owner sees the cards, not the PRs. On your cards, your lane record and
anything else on the Effect review page, call yourself only "maker A": never name your model or say
anything that hints at it. Your PR body and handoff don't name the model either until the Operator
reveals it after the marks (commit trailers are fine).

**The toy: Toy piano** (`toy-piano`, Music shelf, public, kit-built). It's the owner's own idea from
the Toy Ideas page, word for word:

- Tap: "Tap a key: a tiny hammer strikes a metal rod inside the open back, and the rod shivers as it
  rings. Tap elsewhere: Twinkle, Twinkle, Little Star, the rods shimmering in turn."
- Sound: "The plinky, bell-like tone of a real toy piano (struck metal rods), made in the page."
- Why: "The smallest piano, with a sound nothing else on the shelf has."

What good looks like:

- A small upright toy piano, about 18 to 25 keys, painted wood (a bright lacquer), with the back
  open so you see the row of metal rods and the little hammers.
- Every key, hammer and rod is its own solid part.
- Tapping a key: the key dips and its hammer swings up and strikes its rod; the rod shivers (a
  small, fast, fading vibration) while the note rings.
- Tapping elsewhere: it plays the opening of "Twinkle, Twinkle, Little Star" (public domain; write
  the notes out yourself), each key, hammer and rod moving in time with the notes.
- The sound is struck metal rods: a bright, inharmonic, bell-like voice with a quick decay, made in
  the page. Add your own entry in src/toy-sounds.js, and a new voice in src/voices.js only if the
  existing voices can't make it. Each key plays its own pitch.
- Follow the effect quality rules in CLAUDE.md (instruments are played, parts move as solid pieces,
  materials look real, no speckle or see-through solids) and the sharpness the owner now expects:
  Fidelity A's method (even placement, full opacity, full density, clean colors) is the bar. Read
  docs/handoff/history.md for how the xylophone does per-key taps (`pick`).
- Add the toy's how-to line and About text in src/toy-help.js, its plan entry in
  tools/toy-plan.json, and a thumbnail.

Clips and cards (390×844), in the lane record "AB-A" on the Effect review page (the Operator made
it):

- `aba-toy-piano-keys`: three single keys tapped, close enough to see each hammer strike its rod;
- `aba-toy-piano-song`: the song;
- `aba-toy-piano-still`: a sharp full-resolution still.

### You own

- the toy's recipe in its pack (src/packs/ with the Music toys, only your toy),
  assets/toys/toy-piano/, your toy's entries in the shared lists, tests/aba.spec.mjs, your `aba-*`
  screenshots and docs/handoff/AB-A.md.
- Leave everything else alone. Lanes Books, Worlds, Fidelity A, Fidelity B, Studio Models, the
  Integrator and the other maker run at the same time. The laptop is locked.

### How this lane runs

The Operator session runs the lanes; the owner talks only to the Operator. Questions and blockers go
in the final message ("READY:", "WORKING:" or "BLOCKED:"). Never merge. American English for new
public text. Edit only your own entries in the shared lists. Never edit tests/taps.spec.mjs. Post
clips and cards to the Effect review page without republishing it. Push about hourly, merge main
before each push, never rebase. One draft PR with the five sections (the model is left out until the
Operator reveals it). After the cards are posted, check the owner's marks about hourly, fix every
"fix" in the same PR and post "-r2" cards.

## State

Built and posted (September 29, 2026). PR #89 (draft). Cards `aba-toy-piano-keys`,
`aba-toy-piano-song` and `aba-toy-piano-still` are on the Effect review page in lane AB-A.

- Toy: `toy-piano` (Music shelf), recipe in `src/packs/music.js` (constants `TP`, `TP_SONG`,
  `TP_LEAD`, `TP_NOTES`, `TP_VOICE` next to the xylophone's). Twenty keys (C to G, twelve white and
  eight black). Entries in `src/toys.js`, `src/toy-sounds.js`, `src/toy-help.js`,
  `tools/toy-plan.json`; thumbnail in `assets/toys/toy-piano/`; test `tests/aba.spec.mjs`;
  screenshots `tests/screenshots/aba-toy-piano-*.png`.
- Full test run, prettier, `us-english --diff`, `check-packs`, `sound-check`: see the PR body.

## Notes

- **Piece budget.** The kit allows 15 parts and 48 tokens, and 20 keys with a hammer and a rod each
  need 60 moving pieces. So every key (tokens 0 to 19) and hammer (tokens 20 to 39) is a token, the
  first twelve rods are parts (`rod0` to `rod11`) and the last eight rods are tokens 40 to 47. All
  of it is used; a 21st key would not fit.
- **Timing.** `drive` keeps a list of hit times per key (`mem(c).hits`), read from `info.tap` (a key
  tap adds one hit 0.11 s ahead; the song schedules 14 hits). Key press, hammer flight (hits the rod
  at the hit time), rebound and the rod's shiver (13 to 20 Hz, fading over about 1 s) are all
  functions of `info.time - hit`, so overlapping notes and quick taps on different keys ring
  independently.
- **Sound.** A key tap plays the `tine` voice (a clamped-rod mode: partials at 1, 6.27 and 17.55)
  through the spec in `src/toy-sounds.js` with `pickAt` timed to the hammer. The spec's twenty notes
  are the keys, so it cannot also hold the song. The song's notes are cues from `drive` (the action
  is `quiet: ["play"]`), sounding as each hammer lands. No new voice was needed.
- **Look.** Case pieces are boxes with their edges rounded over by thin tubes (a plain box gives
  ragged edges, and a rounded box at power 6 shows seams). The upper front of the case is open, not
  the back, so the works show from the default camera.

## Known issues

- Key tops show slight streaking from splat layering at very close zoom.
- The open side is the front of the upper case, not the back (see Notes).

## For the Operator

- `tests/taps.spec.mjs` plays the song tap as a pulse; see the PR for its result.
- Nothing else outside my files.
