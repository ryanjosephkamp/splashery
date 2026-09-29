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
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State" (the blog post compares the two models).
- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain only, checked on the live source page and credited
  (CREDITS.md, tools/assets.json and the toy's in-app credit). Never BY-SA or NC. No logos, brand
  names or insignia.
- Review: post clips and cards to the Effect review page,
  https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says.
  Judge every effect as motion at phone size against the effect quality rules before you post it.
  The Operator has made your lane's record. Don't republish the page, and never write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change. Container restarts can kill a long run: run the suite in three parts
  (`--shard=1/3`, `2/3`, `3/3`, each started with setsid nohup and logged to its own file) and note
  each part's result as it finishes, so a restart only repeats one part.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary. When main moves, merge it into
  your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: started. Reading the engine (stage, player, kit, effects, the Lab lane's
  `gpuField`) and planning the design.

## Notes

## Known issues

## For the Operator
