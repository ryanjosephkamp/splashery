# Lane Night sky: the stars and planets over you (prefix `sky`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Night sky (id `NightSky`, prefix `sky`).
Branch: `claude/lane-night-sky` (and `claude/lane-night-sky-engine` for any change to the app
outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Night sky: the stars
and planets over you". Handoff file: docs/handoff/NightSky.md (create it; start it with this brief,
word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the
Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

Push Plan S15 (yes) and the owner's rule of October 4, 2026 (CLAUDE.md, "Live data"): the Night sky
may ask for the person's location only when they tap for it, and never stores or sends it.

1. **The sky for a time and place**: bright stars (to about magnitude 6) from an open catalog, as
   splats sized by brightness and colored by temperature (from B−V), on the sky dome for any date,
   time and place. Places: tap "Use my location" (the browser asks), or pick a city from a short
   built-in list, or type latitude and longitude; the default is a named city. Planets, the Sun and
   the Moon placed by published formulas (for example JPL's "Approximate Positions of the Planets"
   and a standard lunar series), with the Moon's phase. Time controls: now, faster, a date picker.
   Drag to look around; a tap on a star or planet names it with a few facts.
2. **Sources and licenses**: check each catalog's live license page. The HYG database is CC BY-SA
   4.0 (allowed per asset with its notice beside it; what you make from it stays BY-SA;
   docs/audits/open-science-data-2026-10.md). Constellation line sets differ in license
   (Stellarium's data is GPL, a copyleft license that goes to the owner first): find a public-domain
   or CC set, or ship the toy without lines and say so. Never send the location anywhere; keep it in
   memory only.
3. **Evidence**: docs/evidence/<toy id>.json with tests: planet positions for known dates against
   JPL Horizons values you record in the test (within a stated tolerance), local sidereal time, a
   star's altitude for a known place and time.

A new labs toy on the Space shelf. The Space r2 lane works on planets, galaxies and Gaia stars in
`src/packs/space-r2.js`: this toy is the view from the ground; don't edit their files. Tests in
`tests/sky*.spec.mjs` (the location prompt is mocked); clips at phone size on Effect review page 2
(lane record `NightSky`); credits; how-to and About texts.

You own: `src/sky/` (new), `src/packs/night-sky.js` (new), `tools/sky-*.mjs`, the catalog snapshot,
`tests/sky*.spec.mjs`, your toy's evidence file, its lines in the shared lists, and your handoff
file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Before READY, re-read
CLAUDE.md's "Effect quality rules" and check each clip against them at phone size.

## State

WORKING (October 5, 2026): started. Plan: an engine PR that lets a toy be seen from inside (the
camera at the dome's center), then the toy: the HYG catalog snapshot, the sky math in `src/sky/`,
the pack and its panel, tests and evidence, clips.

## Notes

## Known issues

## For the Operator
