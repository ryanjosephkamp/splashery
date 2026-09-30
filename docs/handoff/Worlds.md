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

### For the Character lane

- The rig lives in `src/worlds/character.js`: `JOINTS` (eleven joints: hips, torso, head, armL/R,
  foreL/R, thighL/R, shinL/R, each with its parent and its pivot in meters, facing +z, feet at y 0)
  and `BODY` (sizes, and `radius` for collision). `buildCharacter(look, { count, seed })` returns
  one `SplatBuffer` per part name, each around its own pivot; `world.js` (`buildCharacter()`) makes
  one entity per joint and one splat entity per part under it. A new joint needs a line in `JOINTS`
  and a part of the same name.
- The animation hooks: `pose(gait, time)` returns `{ joints: { name: [x, y, z] degrees }, bob }`
  (positive x swings a hanging limb backward), and `stepGait(gait, speed, dt)` moves the phase with
  the distance walked. `world.placeCharacter()` applies them every frame. Walk is 1.9 m/s, run 4.6.
- The look comes from the world file's `character` colors (`shirt`, `trousers`, `skin`, `hair`,
  `shoes`).
- Budget: the character is always drawn in full, outside the level of detail. Today it is 60,000
  splats times the tier's `props` factor (0.6 to 1.25), about 54,000 on mid. It counts against the
  tier's budget (`fixedCount()` in `world.js`), so a bigger character leaves less for the ground.
- Lessons: build limbs as lathes (even spreading draws a lattice on `k.cone`), keep solids at
  opacity 1 and color noise low, and judge it with `tools/world-clip.mjs … character` (a close-up at
  2x).

## r2: a sharper island

Branch `claude/lane-worlds-r2`, PR "Phase Worlds r2: a sharper island". Built by Opus 5.5.

The owner's words (September 29, 2026), word for word: "My main criticism is about the worlds: still
just a bit too grainy, and the player/character looks way too low-poly and simplistic. But, the
mechanics are solid! So it primarily seems like design problems and sharpness, not physics and
mechanics."

The Operator's plan: the character goes to a new Character lane (it owns `src/worlds/character.js`
and the character section of docs/WORLDS.md). This round takes the grain out of everything else:

1. The ground, the grass, the sand and rocks, the water's surface, the sky and the signs, with
   Fidelity A's method (even placement, full opacity, full density at each tier, flat splats on flat
   ground, thin blades, clean colors with low noise).
2. The props rebaked from the 97 toys Fidelity A and B sharpened, checked at walking distance.
3. The render settings lane Sharpness measured (#107): the pixel-ratio cap, the resolution drop and
   the sharp kernel, applied in `src/worlds/render.js` where they help.
4. Within the tier budgets, measured.

Cards: `wd-island-r2`, `wd-ground-r2`, `wd-props-r2`, `wd-sky-r2`.

### r2 state

- September 29, 2026: branch restarted from main after #78 merged.
- The grain, measured (`tools/world-grain.mjs`, 390×844 at 2x, mid): speckle on the ground view 0.07
  → 0.03, the shore 0.09 → 0.05, the props 0.09 → 0.05 (lower is cleaner). Lab's sharp kernel alone
  halved it; the ground, water and sign changes make the rest visible as cleaner texture (see the
  before and after in `wd-island-r2`).
- Changes: an even, flat, nearly uniform ground carpet (sizes within ±7%, nearly round, fully
  opaque, color noise ±1%); grass blades in the ground's own color; round, even water splats with a
  soft, isotropic sheen; sign boards with a flat front face and letters placed exactly (nine splats
  per font pixel), kept at full detail to about 80 m; bushes as solid shells; the sharp kernel on
  every tier; the pixel ratio capped per tier (1.5, 2, 3, 3), with `?dpr=` and `?kernel=` to
  override.
- Cards: `wd-island-r2` (before and after), `wd-ground-r2`, `wd-props-r2`, `wd-sky-r2`.
- The props rebake from the packs on main, so they carry Fidelity A and B's fixes.

### r2 known issues

- A bush seen from very close reads as a smooth green shape (solid, but plain).
- The far sea under the aerial view is soft (large far-level splats), without grain.

## Hybrid: model ground, water and sky with splat props

Branch `claude/lane-worlds-hybrid` (from the r2 head; it merges after #108), PR "Phase Worlds
hybrid: model ground, water and sky with splat props (Opus 5.5)". Built by Opus 5.5. Labs only.

The owner's words on the r2 cards (September 29, 2026), word for word: "This continues to get
better, but the quality is still not at the level of a real video game. Is that an unrealistic
expectation for Gaussian splats? Are there other tools that we could integrate (i.e., by upgrading
your tech stack, etc.) to make the graphics better while maintaining Gaussian splat functionality?
Eventually, I do want to see how a hybrid approach would look, where we use Gaussian splats
strategically and use better game tools for other parts, and then integrate these together to build
games that can do things that are almost impossible without Gaussian splats. We can certainly
continue to build out the splat-only world, but if it can't achieve ~AAA graphics and gameplay, then
we can see if there's a way to do that with other tools." After the Operator's report, his answer:
"Hybrid yes." and "I am very interested in making a hyper-realistic hybrid game or simulation
world."

The Operator's brief (the report's steps 1 and 2):

1. Light, shadows and atmosphere in both modes: one sun, soft shadows from the character and the
   props (a shadow catcher over the ground in splats mode), shared haze and a color grade.
2. Hybrid mode: the ground as a lit, textured model of the same height field (near grass stays
   splats), depth-aware water, an HDRI sky that also lights the models, sign boards as models, and
   splats that hide correctly behind and in front of the models.
3. Frames per second and counts per tier in both modes; textures small (under about 10 MB).
4. Side-by-side clips (splats left, hybrid right): `wd-hybrid-walk`, `wd-hybrid-shore`,
   `wd-hybrid-shadows`, `wd-hybrid-sky`.

A world file's `render` (`"splats"` or `"hybrid"`) picks the mode and `?render=` overrides it; the
Test island stays in splats mode until the owner picks. How it works is in docs/WORLDS.md,
"Rendering".

### Hybrid state

- September 29, 2026: built. New modules `src/worlds/lighting.js` (sun, shadows, haze, grade, the
  shadow catcher) and `src/worlds/hybrid.js` (ground tiles and their atlas shader, water, sky dome,
  sign boards); `render.js` gained the mesh and light systems and three layers (`WdSky`, `WdGround`,
  `WdSurface`). No engine files changed (`src/pc.js`, `src/kit.js`, `src/stage.js` are untouched),
  so the toy box looks the same.
- Assets: four Poly Haven texture sets and one HDRI, all CC0, packed by `tools/world-assets.mjs`
  into `assets/worlds/` (about 5 MB); credited in CREDITS.md, `tools/assets.json` and the Worlds
  page's list of places.
- Depth: splats test against the models' depth. In splats mode an invisible depth-only ground model
  keeps a hill in front of the props behind it now that the ground's splats draw in their own layer.
  `tests/wdh.spec.mjs` checks it in both modes (taking away a bush behind the hill changes no
  pixel).
- The character A/B (the Operator's addendum of September 29, 2026, after the owner's marks on the
  Character cards: "Better, but still looks too low-poly. We can stop trying to perfect this for
  now. The hybrid simulation will hopefully enable better characters."): `?character=mesh` swaps in
  a lit, skinned character, Kenney's "Animated Characters: Protagonists" (CC0, checked on the live
  page and in the pack's license file), with idle, walk and run blended by speed and driven by the
  world's clock. The pack has no walk; `tools/world-character.mjs` makes one from the run.
  Quaternius packs were the first choice, but Google Drive refused the downloads here ("Quota
  exceeded") and the one Quaternius pack on OpenGameArt is the older chibi style. My pick for hybrid
  worlds: the mesh character (it reads as a finished game character at phone size), though it is
  stylized, not realistic. The owner decides from `wd-hybrid-character`.
- Cards (390×844, splats left, hybrid right, the same walk): `wd-hybrid-walk`, `wd-hybrid-shore`,
  `wd-hybrid-shadows`, `wd-hybrid-sky`, plus `wd-hybrid-depth` (the depth close-up) and
  `wd-hybrid-character` (splats and mesh characters in the hybrid island).
- Frames, in our software renderer at 390×844, 2x, mid tier (relative only): splats mode about 1.9 s
  a frame, hybrid about 1.8 s. Hybrid draws fewer splats (the ground is a model; only the near grass
  stays splats) and adds about 90 models (64 ground tiles, the water, the sky dome, the signs). The
  owner's phone is the real test.

### Hybrid known issues

- `tests/chr.spec.mjs:249` (the Character lane's island test, three tiers in one 240 s test) times
  out on this branch: splats mode's shadows and haze cost more per frame in the software renderer,
  and #108 alone already needs 3.9 of its 4 minutes. A proposed patch (`test.setTimeout(480_000)` in
  that test) is on the PR for the Operator to decide. Splats mode's light was made cheaper first: no
  tone map there, the catcher only within the shadows' reach, PCF3, only level-0 props cast, and no
  shadows on the low tier.
- Where the shore is steep, the hybrid sand picks up the gravel (rock) texture.
- A thin gray band can show at the horizon, where the sky photo's haze meets the far water.
- The grass texture (a meadow photo) shows small pale pebbles close up; its strength is lowered.
- The depth clip's bush is wholly behind the hill (the test checks it pixel by pixel); a bush only
  half hidden was not found on the island.
- The splat character is unchanged from main (#110 merges separately).
- Not in this round (the brief): time of day, a PlayCanvas upgrade, photos or scans as places, the
  pilot game.
