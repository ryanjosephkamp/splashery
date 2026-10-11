# Lane Live r10: Sound in a box explained, responsive, and in color (prefix `lv10`)

## Brief

You are a Splashery worker session, started by the Operator (session_01A4ChKuJQqgoCrWAzQMpD4R).
Repo: ryanjosephkamp/splashery. Your lane: Live r10 (id `LiveR10`, prefix `lv10`). Branch:
`claude/lane-live-r10` (and `claude/lane-live-r10-engine` for any change outside your own files, as
a small, additive "Engine: …" PR merged first). PR title: "Phase Live r10: Sound in a box explained,
responsive, and in color". Handoff file: docs/handoff/LiveR10.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State

October 11, 2026 (Opus 5.5, high effort): first round built, all three items. Draft PR #526. Clips:
see "For the Operator".

1. **Responsiveness**: measured, found to be over-slow (not a lag in the audio path), and fixed. See
   Notes for the numbers.
   - Music and the microphone now move the beads on a 0.35 s time scale (`LIVE.secs`; a tap's ring
     keeps its own 1.1 s settle, unchanged).
   - The loudness sets the energy in the cell (the force grows with it; it went with the loudness
     squared, so 60% loudness gave a third of the force).
   - While music plays, a gentle drift along the leading mode's still surface stands in for the
     water's acoustic streaming, so the beads spread over each new figure instead of thinning into
     the lines several notes share. It never pushes a bead off its surface, so held figures stay
     crisp.
2. **The modes explained**: a "What are these modes? The physics, plain words first" panel in the
   Toy tab (`modesInfo()`, `MODE_NOTES` in `chladni-3d.js`): plain words, then the Helmholtz
   equation, the rigid-wall (Neumann) condition, each of the eight modes with its formula, its real
   pitch, its heard pitch, and its still surfaces in words, how a pitch picks a mode, why this is
   Chladni in 3D (with six references, all opened and read), and what is measured and what is a
   model. The About text (`src/toy-help.js`) names the formulas and points to the panel (the help
   test caps About at 180 words).
3. **Colors, both toys** (`src/packs/chladni-colors.js`, new): "Bead colors" / "Sand colors": as
   made (the default, unchanged), one color, a few colors (six palettes), a flag's colors, and for
   the box by height or by distance from the center (a palette as a gradient, following each bead as
   it moves). A flag's colors are read from the site's own flag images (`assets/flags/`, 196
   public-domain or CC0 flags, the existing `loadFlags()`), each color in its share of the flag,
   colors only. Only the options a choice uses show. A change of colors only keeps the beads and the
   sand where they are. Scenes and links with no color setting resolve to the default.

## Notes

### Responsiveness: the numbers

Measured with `tools/lv10-measure.mjs` (Node, the toys' own physics and the Song landscape's own
analysis, 30 toy frames a second) on the test song `tools/lv10-song.mjs` (made here: "Ode to Joy",
public domain, all four phrases at about two notes a second, with a bass, a hi-hat and dynamics,
27.5 s). "Before" is main at ff53efd6.

The audio path is not the lag:

- A file's analysis is worked out ahead and read by the playing time: frames 40 ms apart, each a 93
  ms window centered on its moment, so no delay (a smear of about ±46 ms). The microphone's analyser
  has an 85 ms window (4096 samples at 48 kHz) behind the moment, about 40 ms late on average.
- The modes' strengths ease over 80 ms (as the plate's).
- One frame's physics step (17 to 33 ms).
- So a new note starts moving the beads within about 0.1 s: a tenth of them moved 1% of the cell
  (about 2 px at phone size) within 0.03 to 0.13 s before, 0.03 to 0.07 s after.

How often the music asks for a new figure (the leading mode after the 80 ms easing): 3.75 changes a
second in the cube (median hold 0.13 s; the bass shows through in the gaps between melody notes),
2.3 in the flask, 2.7 on the plate. 30 figures were held 0.4 s or more in the cube, 21 in the flask.

How fast the beads move to a new figure (settled on figure A, then a note for figure B; time until
"settled on B" passes 0.5 and 0.8; settled is the share of beads within 4% of the swing of φ = 0):

| Change                | Loudness | t50 before     | t80 before     | t50 after   | t80 after |
| --------------------- | -------- | -------------- | -------------- | ----------- | --------- |
| cube 0,1,2 → 1,1,1    | 1        | 1.23 s         | 2.20 s         | 0.50 s      | 0.73 s    |
| cube 1,1,0 → 1,2,2    | 1        | 1.40 s         | 2.03 s         | 0.53 s      | 0.70 s    |
| cube 1,1,1 → 1,1,2    | 1        | 2.23 s         | 3.17 s         | 0.77 s      | 0.97 s    |
| cube 0,1,0 → 0,1,2    | 1        | 1.17 s         | 1.53 s         | 0.47 s      | 0.60 s    |
| cube 0,1,2 → 1,1,1    | 0.6      | 3.17 s         | over 5 s       | 0.70 s      | 1.13 s    |
| cube 1,1,0 → 1,2,2    | 0.6      | 3.77 s         | over 5 s       | 0.77 s      | 1.03 s    |
| cube 1,1,1 → 1,1,2    | 0.6      | over 5 s       | over 5 s       | 1.13 s      | 1.43 s    |
| cube 0,1,0 → 0,1,2    | 0.6      | 2.93 s         | 3.80 s         | 0.67 s      | 0.87 s    |
| plate (three changes) | 1        | 0.40 to 0.87 s | 0.80 to 1.07 s | (unchanged) |           |
| plate (three changes) | 0.6      | 0.53 to 1.20 s | 1.07 to 1.47 s | (unchanged) |           |

Over the whole song:

| Measure                                                 | Cube before | Cube after | Flask before | Flask after | Plate    |
| ------------------------------------------------------- | ----------- | ---------- | ------------ | ----------- | -------- |
| Held figures (0.4 s+) the beads visibly went toward¹    | 10 of 30    | 24 of 30   | 4 of 21      | 19 of 21    | 9 of 24  |
| Median time for that                                    | never²      | 0.20 s     | never²       | 0.17 s      | never²   |
| Held figures formed by their end (settled ≥ 0.5)        | 24 of 30    | 26 of 30   | 11 of 21     | 13 of 21    | 17 of 24 |
| Mean settled on the figure asked for                    | 0.64        | 0.68       | 0.43         | 0.57        | 0.56     |
| Share of the cell's 12³ blocks holding beads at the end | 5%          | 23%        | 1%           | 4%          |          |

¹ settled on it rose by 0.2 while it was held. ² fewer than half did. Many held figures start
largely formed already (the song's modes share still surfaces), so these undercount the motion; the
step table is the cleaner measure.

The verdict: the audio path was quick, but the beads were over-slow for music. A song's notes last
about 0.4 s and the beads took 1.2 to 2.2 s to get halfway to a new figure at full loudness (the
plate's sand 0.4 to 0.9 s), and never at 60%, because the force went with the loudness squared. So
the beads stayed near the common still surfaces of the song's modes and "barely followed". The slide
is now on the plate's pace (the force law and the figures unchanged; only the toy's clock, already
sped up, runs faster with music), the loudness sets the energy, and the streaming stand-in keeps
beads spread over each figure. On "physically right": the end states of held notes are as crisp as
before (settled 1.0 after 5 s on every pair above), and the tap's own ring is unchanged (a test
checks the beads move exactly as before).

What I tried and dropped: the faster slide alone made the beads thin into lines sooner (2% of the
blocks held beads at the end); a random drift in every direction blurred held figures at strengths
that helped (settled fell to 0.6 to 0.8); the drift along the leading mode's surface keeps them at
1.0.

### The references (each opened and read)

- H. Bruus, "Acoustofluidics 7: The acoustic radiation force on small particles", Lab Chip 12, 1014
  (2012): the Gor'kov potential, f1 and f2 (eq. 27). PDF from the Bruus group's page at DTU.
- P. B. Muller and others, "Ultrasound-induced acoustophoretic motion of microparticles in three
  dimensions", Phys. Rev. E 88, 023006 (2013): measured 3D bead motion; up to about 1 mm/s for 5 µm
  polystyrene; streaming of about 60 µm/s; 0.5 µm beads follow the streaming.
- M. A. Ghanem and others, "Phase holograms for the three-dimensional patterning of unconstrained
  microparticles", Sci. Rep. 13, 9160 (2023): 3D patterns at pressure nodes; the Gor'kov potential's
  minima coincide with the nodes.
- M. A. B. Andrade, A. Marzo, and J. C. Adamowski, "Acoustic levitation in mid-air: Recent advances,
  challenges, and future perspectives", Appl. Phys. Lett. 116, 250501 (2020): objects trapped at
  pressure nodes of standing waves since 1933; most models use Gor'kov.
- M. Skrodzki, U. Reitebuch, and K. Polthier, "Chladni Figures Revisited: A Peek Into The Third
  Dimension" (FU Berlin, 2016): 3D Chladni figures as zero sets of sums of permuted cosine products
  (Neumann conditions); "could be experimentally reproduced ... by placing some light particles in
  viscose fluid which is stimulated by a speaker".
- J. B. Mehl, "Acoustic Eigenvalues of a Quasispherical Resonator", J. Res. NIST 112, 163 (2007):
  the rigid sphere's modes j_l(kr)·Y_lm.
- Wikipedia, "Room modes": the rigid rectangular room's f = (c/2)·√((l/L)² + (m/W)² + (n/H)²),
  pressure antinodes at the walls (used for the notes only, not cited in the toy).
- S. R. Jain and R. Samajdar, "Nodal portraits of quantum billiards" (arXiv:1709.03650): Chladni's
  1787 work (notes only).

### Other notes

- The brief says "three flask modes ... a cylinder": the toy's flask is a sphere (a round-bottomed
  flask, j_l(kr)·P_l(cos θ)), and the panel says so.
- The figures' descriptions in the panel were checked against the math: the flask's shells at 41%
  and 81% of the radius (π and 2π over 7.7253), the cone at 54.7° (P2 = 0), the ball at 79% (5.7635
  / 7.2899); every mixed cube mode passes through the center.
- Tools: `tools/lv10-song.mjs` (the test song), `tools/lv10-measure.mjs` (the numbers; `--root` for
  another checkout, `--shape=flask`), `tools/lv10-clip.mjs` (MP4 clips with the song's sound, or
  `--tour` with each mode's ring).

## Known issues" and "##

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

- PR #526 (`claude/lane-live-r10`), labs only. No engine PR: everything is in this lane's files,
  plus its new `src/packs/chladni-colors.js` and `tools/lv10-*.mjs`. The flag colors come from the
  site's own flag images through the existing `loadFlags()`, so no other lane's file changes.
- Cards on Effect review page 2 (lane record `LiveR10`, MP4s at 390×844 with sound, each naming Opus
  5.5):
  - "1. Following the music": `lv10-follow` (before and after side by side, the same song and
    seconds) and `lv10-plate-song` (the plate with the same song, for comparison).
  - "2. The modes explained": `lv10-modes-tour` (each of the eight modes, rung by a tap, with its
    description).
  - "3. Colors": `lv10-cell-height`, `lv10-cell-center`, `lv10-cell-flag`, `lv10-plate-flag`, and
    `lv10-plate-few`.
- No sound changes (the toys' sounds are as before), so nothing goes in `tools/sound-review.json`.
- Thumbnails and the contact sheet are unchanged: the default look of both toys is unchanged.
