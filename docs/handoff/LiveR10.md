# Lane Live r10: Sound in a box explained, responsive, and in color (prefix `lv10`)

## Brief

You are a Splashery worker session, started by the Operator (session_01A4ChKuJQqgoCrWAzQMpD4R).
Repo: ryanjosephkamp/splashery. Your lane: Live r10 (id `LiveR10`, prefix `lv10`). Branch:
`claude/lane-live-r10` (and `claude/lane-live-r10-engine` for any change outside your own files, as
a small, additive "Engine: …" PR merged first). PR title: "Phase Live r10: Sound in a box explained,
responsive, and in color". Handoff file: docs/handoff/LiveR10.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Opus 5.5, high effort.

Read CLAUDE.md (especially the Effect quality rules and "Live input"), docs/HANDOFF.md,
docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this lane runs", with your prefix and lane
record), and the Live lanes' handoffs: docs/handoff/LiveR8.md (the 3D Chladni cell,
src/packs/chladni-3d.js) and LiveR9.md (audio upload, the microphone, and part 2's built-in tunes,
all merged).

### Brief (written by the Operator on October 11, 2026, from the owner's walkthrough of October 10)

The toys: "Sound in a box" (`chladni-cell`, src/packs/chladni-3d.js) and the "Chladni plate"
(`chladni-plate`, src/packs/studio.js). Both are labs. The owner's notes, in the Operator's words:

1. **Responsiveness audit.** With his own audio and the microphone, Sound in a box works, but the
   beads seem to settle into a shape and then barely follow the music, while the Chladni plate
   visibly follows a changing song. Find out why, with measurements: the latency from audio to
   motion (analysis window, smoothing, the physics step), how often the target pattern changes with
   the music, and how fast the beads can move toward a new pattern. Decide whether this is correct
   behavior for the model or lag. If it's lag or over-smoothing, fix it, so the beads visibly follow
   pitch and loudness changes the way the plate does, while each pattern stays physically right. Put
   the numbers in the handoff (before and after), and post before-and-after clips at phone size with
   the same song.
2. **Explain the modes in the toy.** The five cube modes and three flask modes need a clear
   explanation in the toy's About text and an in-toy info panel: what each mode is (which
   standing-wave modes of a box or a cylinder, which equation, which boundary conditions), how a
   frequency in the music picks a mode, and why the 3D mapping is a legitimate extension of
   Chladni's 2D plates. Give a short defense with references you actually opened (acoustics texts or
   papers on 3D acoustic standing waves, acoustic levitation, and Chladni figures). Be honest about
   what is a model and what is measured physics. The owner is new to sound visualization, so plain
   words first, then the math.
3. **Particle colors, in both toys.** Let people choose the particle colors:
   - one color;
   - several colors (a small palette);
   - a flag's colors (respectful, using the existing flag data if the site has one, otherwise a
     short list of public-domain national flag palettes);
   - color by position in 3D for Sound in a box (for example, height or distance from the center
     mapped to a gradient).

   The default stays as it is now. Saved scenes and #s= links keep their old look when they carry no
   color setting.

Clips at phone size with sound for each item on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), as docs/OPERATING.md, "Steps for a lane", says
(no republish), ids lv10-…, naming Opus 5.5. Sound changes go in tools/sound-review.json ("new sound
to hear").

You own: src/packs/chladni-3d.js and the Chladni plate's code in src/packs/studio.js (only those
toys' parts), their lines in the shared lists, tests/lv10\*.spec.mjs, and your handoff file. The
Live r8 and r9 tests (tests/lv8\*.spec.mjs, tests/lv9\*.spec.mjs) must stay green; update them only
where an approved change of yours requires it, and say why.

How this lane runs: labs, so the Operator merges after a full suite and the owner's marks. Finish
every working turn with "READY:", "WORKING:" or "BLOCKED:". For a long job, schedule a check-in with
send_later instead of going idle. Before READY, run CLAUDE.md's "Before every push" steps and
re-read the Effect quality rules. When main moves, merge it into your branch (never rebase). Aim for
a first READY within about five hours.

## State

October 11, 2026 (Opus 5.5, high effort): started. Item 1 (responsiveness) measured and fixed; item
3 (colors) built in both toys; item 2 (the modes explained) next, then tests and clips.

## Notes

## Known issues

- None yet.

## For the Operator

- No engine PR so far: the new colors module (`src/packs/chladni-colors.js`) is this lane's own
  file, and the flag colors are read from the site's flag images (`assets/flags/`) with the existing
  `loadFlags()`, so no other lane's file changes.
