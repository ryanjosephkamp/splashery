# Lane Space r2: real planets, moons, galaxies and rockets (prefix `sp2`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Space r2 (id `SpaceR2`, prefix `sp2`).
Branches: `claude/lane-space-r2` (and `-engine` if needed). PR title: "Phase Space r2: real planets,
moons, galaxies and rockets". Handoff file: docs/handoff/SpaceR2.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's push notes)

The owner: the Space shelf stays open, but new work there should be photoreal, from real telescope
or NASA data ("I'd love to see planets, like photoreal, or data from, you know, NASA"; "more
galaxies, more stellar systems, more planets"; rockets).

1. **Real worlds as splats**: build the Moon, Mars and Earth first, then Mercury, Venus (radar), and
   the big moons you can find good data for, each from real color and elevation maps (for example
   NASA's CGI Moon Kit from LRO, MOLA and Viking for Mars, Blue Marble and ETOPO for Earth,
   MESSENGER for Mercury, Magellan for Venus; public domain or the allowed licenses, checked on their
   pages). Real relief, with an option to exaggerate it (labeled), turning at its real rate (scaled,
   labeled), lit by a sun you can move. A tap flies close to a named feature (Olympus Mons, Tycho,
   Valles Marineris) and back.
2. **More galaxies and star systems from data**: real nearby stars from an open catalog (ESA Gaia
   data is CC BY-SA 3.0 IGO: allowed per asset with its notice), and galaxies from open telescope
   images (ESA/Hubble and ESA/Webb images are CC BY 4.0) given depth honestly (say what is guessed).
3. **Rockets**: real launch vehicles and spacecraft from NASA's 3D resources (check each model's
   terms), as splats, with a tap that stages the rocket in the right order.

The Science r3 lane works on galaxies inside "Galaxy in a box" (src/packs/science.js): don't touch
that toy. The Arcade lane may use your worlds for its lander and snake games: export them cleanly so
another pack can import them.

New toys are labs. Tests in `tests/sp2*.spec.mjs` (each world loads with its relief; the feature a
tap flies to is where the map says). Clips at phone size on Effect review page 2 (lane record
`SpaceR2`). Credits for every dataset; how-to and About texts; a docs/evidence/<toy id>.json for
each new toy (docs/evidence/README.md).

You own: `src/packs/space-r2.js` (new), `src/space/` (new helpers), `tools/sp2-*.mjs`, the new
assets, `tests/sp2*.spec.mjs`, the evidence files for your toys, your toys' lines in the shared
lists, and your handoff file. Import from the existing Space pack (src/packs/space.js) without
editing it.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle.

## State

WORKING (October 5, 2026): lane started; reading the engine and gathering the planetary maps.

## Notes

## Known issues

## For the Operator
