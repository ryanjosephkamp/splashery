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

Stood down (October 6, 2026, 21:46 UTC). Everything is merged; nothing is open.

- First round (October 5): eleven labs toys in `src/packs/space-r2.js`: `real-moon`, `real-mars`,
  `real-earth`, `real-mercury`, `real-venus` (real color and elevation maps; a tap flies to three
  named features each), `real-moons`, `real-small-worlds`, `nearby-stars`, `star-systems`,
  `real-galaxies` and `saturn-v`.
- Polish round (#337, October 5): the labs sharp kernel on every toy, twice the tier's splats for
  the worlds, galaxies and the Saturn V, and the Saturn V's view follows the flying stack.
- Rockets (#341, merged October 6 via Ops #362): `sls` and `space-shuttle` from NASA 3D Resources
  models, cut into their pieces and colored by `tools/sp2-rockets.mjs`; a tap stages each in a real
  flight's order. Round 3 added crisp markings (booster joints, tank ribs and welds, the Shuttle's
  cockpit windows and payload-bay seam). The owner marked `sp2-sls-r3` and `sp2-space-shuttle-r3`
  good, and the Saturn V r2 before them.

## Notes

- **How a real world is built.** `tools/sp2-maps.mjs` streams each world's color and elevation maps
  from NASA, USGS and NOAA (big uncompressed GeoTIFFs are read a block of rows at a time with HTTP
  range requests, `tools/sp2-tiff.mjs`; nothing big is stored) and writes small maps in
  `assets/toys/real-worlds/`: a 1536 × 768 color JPEG, a 1024 × 512 height file (SPH1: int16,
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
- **How a rocket is built** (`stackRecipe` in `src/packs/space-r2.js`): `tools/sp2-rockets.mjs`
  downloads the NASA model, cuts it into pieces (boosters, core or tank, orbiter, belly, windows)
  and writes a colored GLB. The recipe samples its surface (`sampleSurface`) with per-material
  weight and splat size, a `paint` hook for crisp markings, and an `out.view` that fits what still
  flies.
- **Sharpness**: `tools/shp-measure.mjs` gives the edge width at phone size (lower is sharper). At
  the home view: Saturn V 0.70, SLS 0.66–0.74, Space Shuttle 0.85–0.93. Markings, not smaller
  splats, are what made the rockets read sharp.

## Known issues

- The lighting shades every slope but casts no shadows.
- The splats sort in their built pose (WebGL2). The far side of each world is hidden, so a turned
  ball sorts acceptably. `out.resortPose` with the globe as kit part 1 (same turn) made the order
  worse close up (it hid names under the ground), so it was taken out. Why is not understood; the
  sorter's worker keeps the centers it was first sent, which may be it.
- The Saturn V model paints a band of its first stage navy; it is drawn white (said in About).
- The moons have no elevation maps; their map seams (different lighting between pictures) show.
- The Space Shuttle's tank looks dotted from the side, and its build is near the 1.5 s limit (about
  1.47 s at 200k).

## NASA 3D Resources models checked (October 6, 2026)

- Saturn V (https://science.nasa.gov/3d-resources/saturn-v/): "Source: NASA/Michael D. Carbajal"; no
  license or other holder named; the repository's README calls the collection "free and without
  copyright". Its eight textures carry only "UNITED STATES" and "USA" lettering and small U.S.
  flags.
- Space Launch System (https://science.nasa.gov/3d-resources/space-launch-system-sls/): a printable
  STL with a readme (printing advice only); no license or other holder named. One untextured solid,
  so no logo.
- Space Shuttle (A) (https://science.nasa.gov/3d-resources/space-shuttle-a/): "Source: NASA/Michael
  D. Carbajal"; no license or other holder named. A Draco-compressed GLB, all one gray, no texture,
  so no logo. (Space Shuttle (B), by NASA/Johnson Space Center, is an 11 KB model, too coarse.)

## For the Operator

- NASA 3D Resources models: the owner's call of October 6, 2026 allows them under NASA's media
  guidelines (any NASA insignia taken off, the source page credited). The Saturn V, the SLS and the
  Space Shuttle are credited "NASA 3D Resources, used under NASA's media guidelines" and stay labs
  until the owner moves them.
- Gaia's nearby stars (CC BY-SA 3.0 IGO) and HYG (CC BY-SA 4.0) make one star file, shared alike
  under CC BY-SA 4.0 (both licenses are share-alike; credited in the toy and CREDITS.md).
