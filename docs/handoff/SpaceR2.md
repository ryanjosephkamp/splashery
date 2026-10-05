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
   MESSENGER for Mercury, Magellan for Venus; public domain or the allowed licenses, checked on
   their pages). Real relief, with an option to exaggerate it (labeled), turning at its real rate
   (scaled, labeled), lit by a sun you can move. A tap flies close to a named feature (Olympus Mons,
   Tycho, Valles Marineris) and back.
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

WORKING (October 5, 2026): item 1, the real worlds. Built: the Moon, Mars, Mercury and Venus as labs
toys (`real-moon`, `real-mars`, `real-mercury`, `real-venus`); Earth's maps are being cut. Next:
Earth, clips on Effect review page 2, then the big moons (Io, Europa, Ganymede, Callisto, Titan) and
the small worlds (Pluto, Ceres, Vesta), then items 2 (stars and galaxies) and 3 (rockets).

## Notes

- **How a real world is built.** `tools/sp2-maps.mjs` streams each world's color and elevation maps
  from NASA, USGS and NOAA (big uncompressed GeoTIFFs are read a block of rows at a time with HTTP
  range requests, `tools/sp2-tiff.mjs`; nothing big is stored) and writes small maps in
  `assets/toys/real-worlds/`: a 2048 × 1024 color JPEG, a 1024 × 512 height file (SPH1: int16,
  plane-predicted, deflated; `src/space/maps.js` reads it with `DecompressionStream`), and a sharper
  512² patch of both round each named feature. The recipe (`src/packs/space-r2.js`) lays splats on a
  golden spiral over the globe and denser on each patch, at true height, each a disc lying on its
  ground with its ground's normal packed in its anim values.
- **The GPU program** (`src/space/field.js`, labs only, through `gpuField`): turns the world (spin,
  then a tilt that brings a feature to the middle), lifts each splat by the relief's exaggeration,
  tips its normal to match, stretches its disc up the slope, and lights it from a sun the Sun slider
  moves. The far side is hidden. The globe is also kit part 1 with the same turn, and the drive asks
  for `out.resortPose` whenever the turn moves 1.5°, so WebGL2's CPU sort stays right.
- **The fly**: a tap turns the next feature to face the viewer and glides the camera to it with
  `out.view` (the recipe has a `focus` that takes no double-tap, which is what lets `out.view`
  work), shows its name lying on the ground, and comes back. Close up, the exaggeration eases to at
  most ×2 (×10 hides the ground round a tall crater wall).
- **For the Arcade lane** (lander, snake): `import { loadWorld } from "../space/maps.js"`;
  `await loadWorld("moon")` gives `height(lat, lon)` in meters, `color(lat, lon)` (0..1),
  `night(lat, lon)` and `def` (radius, day, features, credits) from `src/space/worlds.js`. Credit
  the maps with `def.credits`.
- **Splats with opacity 1** decode to infinite colors in the work buffer: the recipe caps opacity at
  0.99.
- `tools/sp2-clip.mjs` is `tools/effect-clip.mjs` with labs on and the camera left free after the
  tap (effect-clip puts it home every frame, which hides the fly).

## Known issues

- The lighting shades every slope but casts no shadows.

## For the Operator

Nothing yet.
