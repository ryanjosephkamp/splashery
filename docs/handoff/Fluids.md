# Lane Fluids: liquids, smoke and flames made of splats

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fluids, "Liquids, smoke and flames made of splats" (prefix
`fl`). Branch: claude/lane-fluids. PR title: "Engine: Fluids, liquids, smoke and flames made of
splats". Handoff file: docs/handoff/Fluids.md.

### Brief (written by the Operator on September 29, 2026, from the owner's note of that day)

On the Real objects lane's water bottle card the owner wrote, word for word: "The water also pours
out in circles, not like actual liquid would. Perhaps we should create a realistic fluid splat
simulator (liquid fluids, gases, flames, etc.; different viscosities, etc.) and use that here?" On
the soda can: "the soda bubbles don't look realistic; they look like marshmallows or popcorn here,
and the soda should come out as a liquid splash or splat (no pun intended)." Later that evening, on
the second round of both cards: "We can defer completing this until after the liquid/fluid engine is
built and perfected." Today, liquids in Splashery are hand-animated clouds and sheets (the ocean
wave, the waterfall, the coffee, the lava lamp), and the Lab lane's GPU splat fields (`gpuField`,
docs/lab/FIELDS.md) move splats by formula, with no state from frame to frame.

Build a fluid engine for splats, labs first:

1. **Liquids** with a viscosity you can set, from water to syrup to honey to lava. Particle-based
   (SPH or position-based fluids, or MPM if you can make it fast enough), in a Web Worker or on the
   GPU (WebGL2 float textures, ping-pong), whichever runs better on a phone. Drawn as splats that
   read as liquid, not beads: stretched along their velocity, overlapping into a continuous surface,
   full opacity, clean color, a bright rim where the surface faces the light, and a thin sheet or
   stream where the flow thins. Pours, streams, splashes that break into droplets and fall back, a
   surface that settles in a container, foam and fizz for soda.
2. **Gases and smoke**: soft, rising, spreading and fading plumes that swirl (curl noise or a coarse
   grid), steam from a cup, smoke from a candle.
3. **Flames**: emissive, flickering tongues that rise and cool through a real color ramp (blue base,
   yellow, orange, dull red), with sparks.
4. **Colliders**: simple shapes a recipe declares (boxes, cylinders, spheres, a glass, a bowl, the
   floor), so liquid pours into a glass and stays in it.
5. **A recipe API** for kit toys: for example
   `k.fluid({ kind: "liquid", viscosity, color, emitter, colliders, budget })` at build and
   `out.fluid` in `drive()` to start, stop or aim an emitter. It must work alongside the existing
   parts and tokens. Write it up in docs/PACKS.md (a new section) and docs/FLUIDS.md.
6. **A labs sandbox toy**, "Fluid lab" (on the Lab shelf): pour water, soda, honey or lava into a
   glass (a Liquid choice, with a tap to pour), a candle with its flame and smoke, and a steaming
   cup. Give it sounds, a how-to line and an About text. Its About text says honestly that this is
   graphics physics (plausible motion), not a validated scientific solver.

Budgets: phones first. Measure the particles and splats you can simulate and draw at 30 fps or
better on the mid tier, and scale by tier (src/stage.js tiers). Nothing may run on the shelf or in
embeds until a fluid toy is opened. Keep the "embed transfer ≤ 30 MB" test green. No new vendored
library unless you ask the Operator first (it would need the owner's approval); write it yourself if
you can.

This is an engine lane. Keep changes to shared engine files (src/player.js, src/stage.js,
src/kit.js) small, additive and marked, and list each one in the PR. Every other toy, old link and
saved scene must behave exactly as before. The Real objects lane moves the water bottle and soda can
onto your engine in a later round; don't change their toys.

Cards (390×844, rendered at the phone's real density, device scale 3, each labeled "built by Opus
5.5", in the lane record `Fluids` on the Effect review page, which the Operator made):

- `fl-pour`: water, then honey, pouring into a glass (you should see the difference in viscosity).
- `fl-splash`: a splash that breaks into droplets and settles.
- `fl-soda`: soda with fizz and foam.
- `fl-smoke`: the candle's smoke and the cup's steam.
- `fl-flame`: the candle flame, close up.
- `fl-phone`: the measured frame times and budgets on each tier, as a card.

Tests in tests/fl.spec.mjs: the simulation is stable (no particles escape a closed glass, the volume
stays within a few percent), viscosity changes how fast a pour spreads, nothing fluid loads until a
fluid toy opens, the sandbox builds within its tier budget, and screenshots at 390×844 and 1440×900.

### You own

`src/fluids/` (new), `src/packs/fluid-lab.js` (new), `assets/toys/fluid-lab/`, docs/FLUIDS.md (new),
your new section of docs/PACKS.md, `tests/fl.spec.mjs`, your `fl-*` screenshots,
docs/handoff/Fluids.md, your toy's entries in the shared lists, and small, marked, additive hooks in
src/player.js, src/stage.js and src/kit.js.

Lanes Worlds (the hybrid round), Pianos, Chemistry, Real objects, Photo to 3D (and Song live),
Machines A, Books, Screens r2, Lab r2 and the Integrators run at the same time, and a Science lane
starts soon; leave their files alone. The Operator's PR #118 (not merged yet) changes the renderer's
pixel-ratio and adaptive blocks in src/stage.js, src/player.js and src/sharpness.js (the cap 3 on
mid and high tiers, adapt on drag): don't touch those blocks. The laptop is locked.

### HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 30, 2026 (r2): from the Operator's pre-review notes (and the owner's "fix" mark on
  `fl-pour`), the liquids were redrawn: four splats per particle, glassy streams with a rim and a
  highlight, discs on smoothed normals, a level sheet for a calm thin liquid in a glass, a soda head
  colored onto the sheet, clean glass rims, and cola that keeps its color. Cards `fl-pour-r2`,
  `fl-splash-r2` and `fl-soda-r2` replace the first three (rendered at 3× density, the mid tier's
  cap once PR #118 lands), and `fl-phone-r2` replaces `fl-phone` with the budgets measured again
  after r2 (every scene still fits a 30 fps frame on mid; soda is tightest at 31 ms). `fl-flame` and
  `fl-smoke` stand.
- September 30, 2026: the fluid engine and the Fluid lab are on the branch (draft PR #121), the full
  suite passes, and six cards are on the Effect review page in the lane record `Fluids`: `fl-pour`,
  `fl-splash`, `fl-soda`, `fl-smoke`, `fl-flame`, `fl-phone` (clips by `tools/fl-clip.mjs` at
  390×844, device scale 3, mid tier; the card by `tools/fl-measure.mjs`). Waiting on the owner's
  marks; checking them hourly.
- Engine (`src/fluids/`, docs/FLUIDS.md): position-based fluids with a wall density term, cohesion
  and XSPH viscosity (water, soda, syrup, honey, lava), diffuse spray, foam and bubbles (soda fizz
  and a foam head), curl-field smoke and steam, flames with a real color ramp, sparks and a smoke
  hand-off, SDF colliders (floor, box, sphere, cylinder, glass, bowl), and a glass drawn with the
  view (`kind: "vessel"`). Liquids are drawn as anisotropic splats (Yu and Turk 2013) in a fluid
  layer with its own work-buffer program. The solver runs in a Web Worker on people's devices and on
  the page for the tools and tests (automated browsers); `?fluids=worker|sync` picks.
- Recipe API: `k.fluid(spec)` in build, `out.fluid[name]` in drive; docs/PACKS.md "5d. Fluids".
- Toy: Fluid lab (labs, Lab shelf) with a Scene choice (Glass, Splash, Candle, Hot cup) and a Liquid
  choice (Water, Soda, Honey, Lava); sounds through cues, a how-to and an About text, a plan entry,
  a thumbnail.
- Tests: `tests/fl.spec.mjs` (8 tests).

## Notes

- Engine hooks (small, additive, marked "Fluids"): `src/stage.js` (`addLayer`, `setLayerUniforms`,
  `removeLayer`, `destroyLayer`, layers in `setUniforms`, `clearToy` and `buryToys`),
  `src/player.js` (`startFluids`, a line in the frame loop, two lines in `disposeProcedural`),
  `src/kit.js` (`k.fluid`). No change to any other toy's path: without `k.fluid` nothing runs.
- The solver costs about 4.4 µs per particle per 1/120 s step on this container's CPU. Budgets are
  per tier (low 0.35, mid 0.45, high 1, max 1.35 of the recipe's budget); a liquid on a lower tier
  gets fewer, larger particles so the same volume pours. `tools/fl-measure.mjs` measures it with
  Chromium's CPU throttling as the phone stand-in.
- Lessons: a kit-built glass shows its wall as grain or moiré (kit splats can't depend on the view),
  so the engine draws glass itself with a Fresnel falloff. Without a wall density term, particles
  pack against a wall a third tighter and the level drops. Emitting in flat layers draws a stream as
  a stack of pancakes; staggering along the flow and drawing fast particles along their velocity
  fixes it. Soda foam must float above the liquid's top layer or the opaque surface hides it. Smoke
  wants the Gaussian kernel, liquids the sharp one (the toy picks per scene).
- Lessons from r2: one big splat per particle leaves a feathered edge; four smaller ones are crisp.
  Flat surface discs seen from a low camera leave gaps; discs along a smoothed normal, plus a level
  sheet once calm, read as one surface. A fast-falling ball must not be drawn as a stream (only thin
  flows with few neighbors are). The Fresnel whitening that makes water glassy makes cola pink;
  scale it by the liquid's brightness. Water's "noise" was velocity, not position: judge by the
  drawn surface, not the speed metric.

## Known issues

- Colliders don't move with parts yet (no tipping jug, no stirring spoon).
- Every scene fits a 30 fps frame on the mid tier's stand-in (4× CPU throttling; the soda pour is
  the tightest at 31 ms after r2, and 34 ms on max at 1×, from its dense foam). The high tier's 2×
  stand-in is over for the pours (34 to 48 ms), but it is pessimistic for the desktops it covers; at
  1× the high budget takes about 17 ms.
- The level sheet is for thin liquids in a `glass` collider only; a pool in a bowl, or on a floor,
  is drawn from its particles alone.
- A soda's head thins into patches as it fades (as a real one does), and the very start of a pour
  can look ragged for a frame or two.

## For the Operator

- PACKS.md: I added my own section "5d. Fluids" (the brief assigns it to this lane).
- New tools: `tools/fl-clip.mjs` (the cards' clips) and `tools/fl-measure.mjs` (the phone budget
  card). Neither needs a new dependency.
- README line (for you to add): "Fluids: liquids, smoke and flames simulated as particles and drawn
  as splats (`src/fluids/`, docs/FLUIDS.md)."
