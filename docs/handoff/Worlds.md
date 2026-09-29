# Lane Worlds: the world engine and a sandbox island

Prefix `wd`. Branch `claude/lane-worlds-engine`, PR "Engine: Worlds, the world engine and a sandbox
island". How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief

(Written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and
his answers on the Splashery Universe page the same night)

The owner's words: "I kind of want to make something that's like an actual universe, or like an open
world kind of game that runs in the browser using Gaussian splats. You know, somebody can actually
view it on their phone." "Somebody could make a personal website … the whole site is basically like
a Gaussian splat … they enter it as like … some character in like an open world, and the character
runs around … different landmarks or milestones … will be different parts of their portfolio."
"Maybe investing in the sandbox and the method and stuff like that before we try any really specific
templates or games would make more sense."

His answers (September 29, 2026): Worlds are built in this order: "The engine as a sandbox first
(Opus), then a small pilot game (Sonnet), then the first portfolio template (Sonnet), then more
templates two at a time." The pilot game will be "Toy Hunt Island: twelve toys have escaped the
shelf onto a small island; find them all." The first template will be "Forest trail (walk between
clearings)." On rendering: "Everything you see is splats. Only menus and text are page text, and
collision uses invisible simple shapes. The toy shelf stays pure splats." He added: "if that fails
and we really can't find a way to make it work, then I'd be willing to resort to one of the other
options" (meshes where splats look worse). If you reach that point, tell the Operator with evidence
(clips) before using any mesh you can see. On the site layout: "Add Studio, Worlds, Lab and Learn as
sections behind the labs switch. I decide when each goes public."

You build the engine that the Sonnet lanes will build the pilot game and the templates on, so design
it for them: clear modules, a documented world file, and a sandbox that shows every feature.

Build:

1. **A Worlds page**: `worlds/index.html` with its own small app (ES modules in `src/worlds/`),
   using PlayCanvas only through `src/pc.js` and our kit (`src/kit.js`) to build splats from
   recipes. It is a separate page; the toy app's behavior doesn't change. The toy app gets one
   labs-only link to it (a marked block in index.html: shown only with `?labs=1`).
2. **Worlds from recipes.** A world is a seed plus recipes, built on the device: terrain (a height
   field covered in splats: sand, grass, rock, snow by height and slope), water, a sky, and props.
   Props should reuse existing toy recipes where they fit (the palm, pine, oak, rocks, mushroom and
   more), placed and scaled by the world file. Draw everything as splats.
3. **Scale and detail.** Our vendored PlayCanvas 2.22.3 has level of detail and a splat budget for
   large scenes (look for `lodDistances`, `splatBudget` and the unified gsplat mode). Use them, or
   build chunked level of detail yourself, so near things are sharp and far things cost little. Set
   a splat budget per device tier (like `PICTURE_BUDGETS`) and measure the counts at each tier.
4. **A character**, kit-built, whose parts move as solid pieces (legs, arms and head swing on
   hinges; no warped shapes): idle, walk and run. A third-person camera follows it smoothly and
   never goes into the ground.
5. **Controls.** On a phone: a thumb stick on the left, drag to look on the right, tap a landmark to
   open it. On a computer: WASD or arrow keys, mouse drag to look, click a landmark. Both work with
   the page's own text menus. Honor prefers-reduced-motion for camera sway.
6. **Collision** with invisible simple shapes: the ground height, plus boxes, spheres and capsules
   around props. The character walks up gentle slopes, stops at steep ones and at water, and can't
   pass through props.
7. **Landmarks.** Places in the world with a sign. Walking near one (or tapping it) opens a card, as
   page text, with a title, words, an optional picture and a link. A **plain list view** (a button)
   shows every landmark as an ordinary list, for people in a hurry, screen readers and search
   engines. A **start screen** shows the world's title and welcome text with an "Enter" button.
8. **A world file** (`worlds/<id>/world.json`) holds the title, welcome text, colors, seed, terrain
   settings, props, landmarks (title, words, link, picture, position) and the spawn point. Document
   it in a new `docs/WORLDS.md`: the file format, the modules, how to add a prop or a landmark, and
   the budgets. The Sonnet lanes build on that page.
9. **The sandbox: "Test island"**, a small island with a beach, grass, a few trees and rocks, water
   around it, and four or five landmarks that show each feature. It opens behind the labs switch.

Honesty the owner asked for: our test browser renders in software, so you can't measure real frame
rates. Measure splat counts and frame times as relative numbers, keep within the budgets, and say
plainly in the PR that the owner's phone is the real test.

Clips and cards (390×844):

- `wd-walk`: walking around the island;
- `wd-landmark`: approaching a landmark and opening its card;
- `wd-touch`: the phone controls in use;
- `wd-list`: the list view and the start screen.

Show both a near view and a wide view somewhere in the clips.

Tests in `tests/wd.spec.mjs`:

- the world loads without console errors;
- keys move the character, and it stays on the ground;
- collision stops it at a prop and at water;
- a landmark opens its card;
- the list view lists every landmark;
- the budgets per tier;
- screenshots at 390×844 and 1440×900.

### You own

- worlds/ (new), src/worlds/ (new), docs/WORLDS.md (new), tests/wd.spec.mjs, your `wd-*` screenshots
  and docs/handoff/Worlds.md;
- the labs-only Worlds link in index.html (a clearly marked block);
- small, additive, tested changes in shared engine files (src/kit.js, src/stage.js, src/pc.js) only
  where the world truly needs them. Leave the toy player's behavior unchanged, and say what you
  changed and why in the PR.

The laptop is locked: its look and behavior stay exactly as they are. Lanes Books, Screens and
Viewer (Viewer changes the toy app's header, camera and index.html) run at the same time. Keep your
index.html change to the one marked block.

### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time. CLAUDE.md still says "Opus 5.5 only" until the Operator's rules PR
  merges; this brief is the owner's newer word.
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

Model: Opus 5.5 (default effort).

- September 29, 2026: lane started; draft PR #78 opened with this file.
- The engine is built: `worlds/index.html` with its app in `src/worlds/` (13 modules, listed in
  [WORLDS.md](../WORLDS.md)), the world file format, the Test island (`worlds/test-island/`), the
  labs-only link in the toy box (one marked block in `index.html`), `docs/WORLDS.md`,
  `tools/world-clip.mjs` (review clips) and `tests/wd.spec.mjs`.
- No shared engine file changed (`src/kit.js`, `src/stage.js`, `src/pc.js` untouched): the world has
  its own small PlayCanvas setup (`src/worlds/render.js`) and reuses the kit, the noise, the font
  and the pack recipes as they are.

- Full suite: 318 passed after merging main (then the bush fix and the touch clip's script changed;
  `tests/wd.spec.mjs` passed again, 14 of 14).
- Cards on the Effect review page (September 29, 2026): `wd-walk`, `wd-landmark`, `wd-touch`,
  `wd-list`. The owner marked `wd-landmark` and `wd-touch` good, `wd-walk` good with a note ("looks
  extremely grainy and basic. This must be an impeccable and high-fidelity game") and `wd-list` fix
  ("Needs better resolution and precision. Better character design").
- Fidelity pass: 8 m chunks with five levels, a much denser near ground and about three times the
  grass blades, less color noise, more detail per prop, raised budgets, the character redesigned
  (eleven joints, elbows, hands, a face, hair, collar, belt, shoes), the aerial view planned around
  the island, clips drawn at 2x. Posted `wd-walk-r2` and `wd-list-r2` (the old cards replaced).
- Full suite after merging main again: 361 passed, 2 failed; both pass on a rerun and neither
  touches worlds (a SwiftShader GL warning in `smoke.spec.mjs:1589`, a timing check in
  `sts.spec.mjs:189`). Splats drawn: low 254,719 / 281,578 of 300k; mid 456,801 / 527,797 of 550k;
  high 872,752 / 894,676 of 900k; max 1,318,315 / 1,214,354 of 1.4M.

- The Operator's fidelity notes (September 29, 2026): applied Fidelity A's lessons (limbs as lathes,
  since even spreading draws a lattice on cones; fully opaque solids, props included; clean colors),
  looked at Lab's sharp kernel (a small measured gain that would need wiring into the toy stage: not
  used). Posted `wd-character` (a close-up), `wd-walk-r3` and `wd-list-r3` (replacing the r2 cards,
  whose character was older).
- Full suite after merging main (#86): 391 passed. Splats drawn: low 254,719 / 281,578 of 300k; mid
  456,797 / 527,793 of 550k; high 872,752 / 894,676 of 900k; max 1,318,306 / 1,214,345 of 1.4M.

## Notes

- PlayCanvas 2.22.3's `lodDistances` and per-component `splatBudget` are no-ops now; the scene's
  `gsplat.splatBudget` and LOD work only on streamed octree (SOG with LOD) resources. A world is
  built on the device, so it has its own chunked levels (`lod.js`) and budgets (`tiers.js`), and
  uses the engine's unified splat mode (the default) so chunks, props and the character's parts all
  sort together.
- Props reuse toy recipes baked into their rest pose (`props.js`): parts and tokens where the toy's
  drive puts them at rest, looping particles and hidden pieces left out, and the toy's own ground
  (the grass mound, the lighthouse's patch of sea) found and dropped. Copies share splats.
- The character is nine joints, each a rigid kit-built part on its own entity; walking and running
  only turn joints (no bending). The knees fold on the forward swing.
- Clips and tests run the world on a manual clock (`?clock=manual`) and step it by hand.

## Known issues

- The water is still (no waves): moving water needs a work-buffer modifier on its own entities; left
  for a later engine step.
- Frame times in the test browser are software rendering (about 0.3 s a frame at 390×844, 1.3 s at
  1440×900) and mean nothing for a phone; the owner's phone is the real test.
- Building the Test island takes about 12 s in the test browser (most of it baking the toy recipes);
  on a phone it should be a few seconds.

## For the Operator

- ROADMAP/README: Worlds lives at `worlds/?labs=1`; `docs/WORLDS.md` is the guide for the Sonnet
  world lanes (Toy Hunt Island, the Forest trail template).
- The site layout the owner asked for (Studio, Worlds, Lab and Learn sections behind the labs
  switch) is not in this lane: the toy box only gets a labs-only link to Worlds in its About tab.
