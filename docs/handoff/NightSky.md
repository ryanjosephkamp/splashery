# Lane Night sky: the stars and planets over you (prefix `sky`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Night sky (id `NightSky`, prefix `sky`).
Branch: `claude/lane-night-sky` (and `claude/lane-night-sky-engine` for any change to the app
outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Night sky: the stars
and planets over you". Handoff file: docs/handoff/NightSky.md (create it; start it with this brief,
word for word, under "## Brief", then keep "## State

READY (October 5, 2026): the Night sky toy is built (labs, Space shelf), with tests (sky,
sky-engine, help, unit, kit, taps: all pass), evidence, credits and four clips on Effect review
page 2. It needs the engine PR #297 merged first.

- Engine PR #297 (`claude/lane-night-sky-engine`): `recipe.inside` (the camera at the toy's center,
  looking out, with its own field of view) and `cull: "below"` (a part's splats hidden under the
  level plane through its center). Tests: `tests/sky-engine.spec.mjs`.
- Toy PR #293: `src/packs/night-sky.js`, `src/sky/astro.js` (the sky math), `src/sky/places.js` (18
  cities, time zones), `assets/toys/night-sky/sky.json` (5,071 HYG stars, 674 Stellarium line
  segments; CC BY-SA 4.0), `tools/sky-catalog.mjs`, `tools/sky-horizons.mjs`, `tools/sky-clip.mjs`,
  `tests/sky.spec.mjs`, `docs/evidence/night-sky.json`.
- Clips (page 2, lane `NightSky`): `sky-night-sky-turn`, `sky-night-sky-tap`,
  `sky-night-sky-sunrise`, `sky-night-sky-moon`.

## Notes

- Splats sort in their built pose, not where a part has turned them. So the backdrop (night and day
  sky) sits far out (radius 8 and 7), the stars at 0.96, the ground at 0.9, and the Sun, the Moon,
  the planets and the ring are built near the center and moved out by their parts' offsets; the
  stars, lines and twilight glow are culled below the horizon (`cull: "below"`); the Moon and the
  Sun use the old cull (a ball's back never draws over its front). `k.reach` keeps the fit centered
  on the viewer.
- Daylight is channel 0 (0 at the Sun 18° down, 1 at 4° up) and twilight glow channel 1. Each star
  fades out at a level set by its magnitude (`fadeAt`), so the faint ones go first.
- The Moon is a ball lit on its +X half; its part turns +X toward the Sun, so the phase is the real
  geometry seen from the center. The Sun and the Moon are drawn three times their real size.
- The sky's time runs on the toy's clock (`t`), so clips stepped by hand move at the named speed.
  Headless frames are slow (about one a second at 1280×720), so the tests wait for
  `sky.state().drawn` to show the time they set.
- The test hook is `window.__splashery.sky` (`set`, `state`, `dirOf`, `look`, `pick`).
- The place: a city id, or typed coordinates, or "Use my location", kept only in the module's memory
  (never in options, links, scenes or requests; a test checks this). Typed places and "my location"
  use the device's own time zone.
- Reference values: Horizons (recorded in the test by `tools/sky-horizons.mjs`) and Astropy 8.0.1
  (run once in a scratch virtualenv for four stars; not a dependency).

## Known issues

- The Sun's and the Moon's discs are hidden whole once their center is 0.9° under the horizon, and
  near the horizon they draw over the low hills (no half-set Sun).
- Stars between the horizon and the top of the hills (up to about 1.5°) can show over a hill.
- Twilight and day sky colors are drawn, not computed; moonlight doesn't brighten the sky.
- Thumbnails show the sky at the moment they were made (the toy opens at "now").
- In the GIF clips the day sky shows bands (the GIF palette); the MP4s and the app are smooth.

## For the Operator

- Merge #297 (engine) before #293. #297 also had the lane's files committed by mistake and taken out
  again in its next commit; its final diff is engine only.
- PACKS.md (section 5): `inside: { fov }` on a recipe shows the toy from its center (a drag looks
  around, a pinch narrows the field of view); `out.parts.<name>.cull = "below"` hides a part's
  splats under the level plane through its center. A lesson: splats sort in their built pose, so a
  part that turns far (a sky) needs its neighbors placed where the order can't flip.
- Page 2 needs a `lanes/NightSky` record (I added only cards).
- CC BY-SA: the snapshot `sky.json` and anything made from it stay BY-SA; the Stellarium license
  names no version (credited as 4.0).
