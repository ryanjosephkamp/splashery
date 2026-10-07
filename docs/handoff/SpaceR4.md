# Lane Space r4: the solar system on real orbits (prefix `sp4`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Space r4 (prefix `sp4`). Branch: `claude/lane-space-r4` (and
`claude/lane-space-r4-engine` for any change to the app outside your own files, as an "Engine: …" PR
merged first). PR title: "Phase Space r4: the solar system on real orbits". Handoff file:
docs/handoff/SpaceR4.md (create it; start it with this brief, word for word, under "## Brief", then
keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus 5.5,
at the default effort.

### Brief (written by the Operator on October 7, 2026)

Read docs/handoff/SpaceR2.md and docs/handoff/SpaceR3.md first (SpaceR3 "Known issues" and "For the
Operator" too). Build a labs toy: **the solar system on real orbits**. The planets (and the larger
moons where they read) move on their real Keplerian orbits from JPL's published mean elements
(public domain; cite them in docs/evidence/ with a test that a few positions match JPL Horizons
values you record in the test for fixed dates within a stated tolerance). A date slider and a speed
control (from paused to a year a second), a tap that flies the camera to the next planet, and a
toggle between true scale (tiny planets) and a readable scale, labeled clearly. Add the asteroid
belt and a few famous comets from the JPL Small-Body Database orbital elements (a few thousand
asteroids as splats, sampled honestly from the real catalog, shipped as a small dated snapshot; no
live fetch). Reuse the Space r2 and r3 planet looks where it helps; keep their toys untouched. Keep
the repository growth small (state the MB added in the PR).

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). New toys go behind the labs switch (`labs: true`);
the Operator merges labs work after a full test run (the Integrators run it). Finish every working
turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job,
schedule a check-in with send_later instead of going idle. Clips at phone size go on Effect review
page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane",
says (no republish), ids sp4-…. New sounds go in tools/sound-review.json as "ready" (the owner hears
them on the Sound Board), not as cards. Evidence that the science or math is right goes in
docs/evidence/ (see the existing files). Before READY, re-read CLAUDE.md's "Effect quality rules"
and check each clip against them at phone size. Aim for a first READY within about six hours, then
polish rounds on the owner's marks. The push pace ends at the weekly reset (20:00 UTC today); after
it about six workers run, so keep going at an even pace. Your Operator is
session_012GmKRUMZLir2nb27Bo8Cu2.

## State

READY, all clips approved (October 7, 2026). PR #394. One new labs toy, `solar-orbits` ("The solar
system on real orbits"), in a new pack `src/packs/space-r4.js`:

- The Sun, the eight planets (JPL Table 1, through `src/sky/astro.js`), the Moon, Io, Europa,
  Ganymede, Callisto and Titan (JPL satellite elements; Titan from Horizons), comets Halley, Encke,
  Tempel 1 and 67P, and 4,004 asteroids (a seeded random sample of the SBDB's numbered asteroids
  with a < 5.6 au, plus the largest four), each on its orbit for the date.
- A date slider over the stage (1800 to 2050), Speed (paused, then an hour a second to a year a
  second), Scale (readable, labeled "not to scale", or true), Names. The legend shows the date, the
  speed, the scale and the planet visited.
- A tap flies to the next planet: the system grows about it on the GPU (up to about ×1000 on the
  true scale) and turns so its sunlit side shows; after Neptune, back to the whole system.
- Tests: `tests/sp4.spec.mjs` (9): planets, moons, asteroids and comets against recorded Horizons
  values; the GPU Kepler step's twin; the sample; the build and drive; the browser. Also run: help,
  hta, snda-engine, sky, e5 (all pass). Prettier and US English clean; thumbnail and
  `sp4-solar-orbits-*` screenshots done.
- Clips: 6 on Effect review page 2 (lane record `SpaceR4`): overview at a year a second, flies to
  Earth, Jupiter and Saturn, the true scale, Halley in 1986. The owner marked all six "Just sharper"
  (October 7, 2026, 21:18 UTC); round 2 (`-r2` cards): about 2.5 times the splats (35k to 103k),
  finer splats on the Sun, planets, moons, rings and comet tails, letters of four small splats each,
  less glow round the Sun, and a random (not patterned) granulation on it.
- Round 3: the owner marked the overview r2 good and asked "Make text sharper please" on the other
  five. The `-r3` cards: names half again as large, each letter dot nine small splats, a tighter
  shadow, and the clip's date caption bold on a dark band. He marked all five r3 good (October 7,
  2026, 23:10 UTC): every current sp4 clip is approved. Ready for the Operator's merge after a full
  test run.

## Notes

- **Data**: `node tools/sp4-orbits.mjs` writes `assets/toys/solar-orbits/orbits.json` (237 KB) and
  `maps/*.jpg` (8 maps, 128 × 64, 28 KB, shrunk from the Space r2 color maps). The SBDB download
  (140 MB) is cached in `.cache/sp4/`. `--horizons` prints the reference positions the test records.
- **The math**: `src/space/kepler.js` (planets through the night sky's `heliocentric`, two-body
  orbits, moons, the GPU step's twin `propagateStored`, the scales).
- **The GPU program**: `src/space/orbit-field.js` (labs only, through `gpuField`). Planets, moons
  and comets are kit tokens (`kind: "token"`, params `[token, what]`), so without labs they still
  move with the kit's own program. Asteroids store their epoch place, a, and a 12-bit velocity
  direction; the program solves Kepler's equation every frame. The fly is a zoom about the visited
  body in the program (uSpMorph = days, focus; uSpGlowC = zoom, names, visited token, turn).
- Shader compile errors are silent in the console: a failed program shows the previous toy. The
  browser test looks at the legend and a screenshot; check by eye after any shader change.
- Moons: JPL's table is not uniform. The Moon's period is sidereal; the Galileans' periods are their
  mean anomalies'; Io's and Europa's periapses regress (so their apsis periods are negative in the
  data). The table's Titan row disagrees with Horizons even at its epoch, so Titan uses its Horizons
  osculating elements; Triton is left out (no way stays within a few degrees).

## Known issues

- The orbit lines are drawn for the snapshot's date (2026); far from it a planet sits a hair off its
  line.
- WebGL2 sorts the splats in their built places, refreshed every half second for the tokens; the
  asteroids are sorted where they were built (small, nearly opaque specks; it doesn't show).
- The giant planets are colored bands, not maps; Venus is one cloud color.
- Names are sized for a phone; on a computer (wider view) they show about twice as large.
- A comet's name sits on its tail near the Sun.
- `tools/sp4-clip.mjs` writes the date over each clip (the page's legend isn't in the canvas).

## For the Operator

- Licenses: JPL's orbital elements are public-domain NASA/JPL scientific data (the same call as the
  night sky's Table 1). No new library.
- Repository growth: about 0.27 MB (orbits.json 237 KB, maps 28 KB, code).
