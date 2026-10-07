# Lane Space r3: sharper real planets, and a tap that zooms to a named place (prefix `sp3`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Space r3 (id `SpaceR3`, prefix `sp3`).
Branch: `claude/lane-space-r3` (and `claude/lane-space-r3-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase Space r3: sharper real planets,
and a tap that zooms to a named place". Handoff file: docs/handoff/SpaceR3.md (create it; start it
with this brief, word for word, under "## Brief", then keep "## State

READY for review (October 7, 2026, about 07:30 UTC). PR #380, all labs. Built on
`claude/lane-space-r3`, all seven world toys:

- **Sharper:** the globe now takes about 90% of the splats (the fixed feature patches took 42%
  before), and each splat's color is the mean of the map over its own footprint (five samples), so a
  map finer than the splats no longer speckles.
- **Tap to zoom and name:** a tap turns the spot to face the camera, rebuilds the toy with a dense
  patch round it (45% of the splats) from new 10° close-up tiles, and grows the world about the spot
  on the GPU (src/space/field.js), smoothly, as if the camera came closer. A label of up to four
  lines (the name, what it is or where, what it lies on, the source) shows over the view, and the
  site's message gives the full text. A second tap, or a pinch out, goes back out. The play button
  still flies to the named features.
- Names: Earth from Natural Earth 1:10m (states and provinces, countries, cities, peaks, seas,
  lakes, regions); the others from the IAU/USGS Gazetteer (all adopted features but the lettered
  satellite craters). Both public domain, checked on their live pages October 7, 2026.
- Tests (after merging main): `tests/sp3.spec.mjs` (9, including a tap on Paris, Everest, Tycho and
  Olympus Mons in the browser), `tests/sp2.spec.mjs` (26), help and hta: 52 passed. Prettier and the
  US English check are clean; thumbnails redone; screenshots `sp3-*`.
- Clips: 14 on Effect review page 2 (lane record `SpaceR3`): an after clip of each world's tap zoom
  and a before clip of main's fly, at phone size. Waiting on the owner's marks.

## Notes", "## Known

issues" and "## For the Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026)

Ryan's walkthrough review (docs/reviews/2026-10-06-walkthrough/notes.md and triage.md, "Elsewhere")
asks two things of the real planets and moons (real-earth, real-moon, real-mars, real-mercury,
real-venus, real-moons, real-small-worlds; src/packs/space-r2.js). Read docs/handoff/SpaceR2.md
first.

1. **Sharper, less grainy.** Raise their fidelity the way the Fidelity and Space r2 lanes sharpened
   others: finer splats where it shows, a better use of the color and elevation maps, no speckle.
   Keep them fast on a phone, and post before-and-after clips at 390×844.
2. **Tap to zoom and name the place.** A tap on the globe zooms smoothly in on that spot, as far as
   the data allows and still looking good. A label names what is there.
   - Earth: country, then state or province, then the nearest city. Use open boundary and place data
     that is public domain or CC BY: Natural Earth (public domain) for countries, states and
     populated places. Keep it small, load it lazily only on that toy, and credit it in CREDITS.md
     and tools/assets.json.
   - Moon and Mars: the named feature (crater, mare, mons) from the IAU Gazetteer of Planetary
     Nomenclature (USGS, public domain).
   - Mercury and Venus where the data allows.
   - The label shows the source. A second tap or a pinch goes back out. Real coordinates only: test
     that a tap on a known spot (Paris, Mount Everest, Tycho crater, Olympus Mons) names the right
     place.

Nothing is fetched at run time: the data ships with the site, trimmed to what the toy needs. Check
every dataset's license on its live source page first. You own: src/packs/space-r2.js (the
real-planet toys only; the rockets and the Saturn V stay as they are), new helpers under src/space/,
new data under assets/toys/real-\*/, tools/sp3-\*.mjs, tests/sp3\*.spec.mjs, the toys' lines in the
shared lists, and your handoff file. These toys are in labs; Ryan's marks decide.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run (the
Integrators run it); the owner decides when anything goes public. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a
check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against
them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first
READY within about four to six hours, then polish rounds on the owner's marks. A fresh Operator
session takes over from the current one on October 7; keep reporting the same way (READY, WORKING or
BLOCKED in your final message).

## State

WORKING (October 7, 2026). Built on `claude/lane-space-r3`, all seven world toys:

- **Sharper:** the globe now takes about 90% of the splats (the fixed feature patches took 42%
  before), and each splat's color is the mean of the map over its own footprint (five samples), so a
  map finer than the splats no longer speckles.
- **Tap to zoom and name:** a tap turns the spot to face the camera, rebuilds the toy with a dense
  patch round it (45% of the splats) from new 10° close-up tiles, and grows the world about the spot
  on the GPU (src/space/field.js), smoothly, as if the camera came closer. A label of three lines
  (name, where, source) shows over the view, and the site's message gives the full text. A second
  tap, or a pinch out, goes back out. The play button still flies to the named features.
- Names: Earth from Natural Earth 1:10m (states and provinces, countries, cities, peaks, seas,
  lakes, regions); the others from the IAU/USGS Gazetteer (all adopted features but the lettered
  satellite craters). Both public domain, checked on their live pages October 7, 2026.
- Tests: `tests/sp3.spec.mjs` (9 tests, including a tap on Paris, Everest, Tycho and Olympus Mons in
  the browser); `tests/sp2.spec.mjs` still passes (26).

## Notes

- `tools/sp3-places.mjs` writes `assets/toys/real-earth/places.bin` (run-length maps at 2
  arc-minutes, 1.4 MB) and `places.json` (names, cities, peaks; 450 KB), and
  `assets/toys/<toy>/names-<world>.json` from the Gazetteer.
- `tools/sp3-tiles.mjs` writes the close-up tiles (`assets/toys/<toy>/tiles/`), resolutions in
  `src/space/zoom.js` (TILES): Earth 48 px a degree (land only), the Moon, Mars and Mercury 24,
  Venus 16, the moons and small worlds 8 to 10. Sources are read from `.cache/sp3` when there.
- The zoom's state lives in `src/packs/space-r2.js` by world id (ZOOM), so it carries on across the
  rebuild; `zoomState(id)` is exported for the tests and `tools/sp3-clip.mjs`.
- The tap's spot is where the camera's ray meets the world's mean sphere (the pick can land on the
  thin air shell).
- The heavy splat work runs in `prepare` a little at a time, so the turn keeps running while the
  patch builds.
- Clips: `tools/sp3-clip.mjs` (the clock waits while the toy rebuilds).

## Known issues

- The tiles add about 75 MB to the repository (about 9,000 small files). Halving the Earth, Moon,
  Mars and Mercury tiles' resolution would cut it to about 30 MB, at half the zoom depth.
- On a phone the zoom starts after the rebuild (about 1 to 3 s); the turn to the spot runs
  meanwhile.
- A Gazetteer feature is treated as a circle of its listed size, so a long valley or a ridge is
  named a little beyond its real outline (Pluto's heart, near its edge, is named as Viking Terra).
- Io, Titan and the other moons have coarser maps, so their zoom is shallower (about 3 to 4 times).

## For the Operator

- The repository size above (75 MB of tiles) is a call for you or the owner.
