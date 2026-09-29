# Lane Anatomy: the anatomy atlas (prefix `an`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Anatomy, "The anatomy atlas" (prefix `an`). Branch:
claude/lane-anatomy. PR title: "Phase Anatomy: the anatomy atlas". Handoff file:
docs/handoff/Anatomy.md.

## Brief (written by the Operator on September 29, 2026, from the owner's answers on the Splashery Universe page)

The owner's answer: "Human anatomy? Yes: a clinical atlas I peel layer by layer (skin, muscle,
skeleton, organs). The skin layer is smooth like an anatomical mannequin; the organs look as they do
in a textbook. Build it first from our own organ toys; ask me before using CC BY-SA sources." And:
"I wonder if we could build the '3D model files to splats' and 'Photo to 3D' tools first, and then
use those with 3D organ models or photos to build the anatomy, and maybe get better quality than we
would now while avoiding CC BY-SA?" The 3D model converter is now merged (lane Studio Models, #86:
`tools/model-to-splats.mjs`, docs/PACKS.md section 9).

Build **the anatomy atlas** (`anatomy-atlas`), a labs toy (`labs: true`) on the Body shelf (category
`anatomy`).

The body:

- A standing adult figure, about 1.8 m tall in scale, in a neutral anatomical pose (arms slightly
  away from the body, palms forward).
- Clinical and respectful: the skin layer is a smooth, neutral mannequin surface with no genital
  detail, no hair and no face beyond a simple, calm mannequin face. No gore: the layers are clean,
  textbook-style surfaces, never wounds.

Four layers, each its own set of solid parts:

1. **Skin**: the mannequin shell.
2. **Muscles**: the major superficial muscles in textbook reds with lighter tendons, each muscle
   group its own part (pectorals, deltoids, biceps and triceps, abdominals, quadriceps and so on).
3. **Skeleton**: the skull, spine, rib cage, pelvis and limb bones in bone ivory, each bone or bone
   group its own part.
4. **Organs**: the brain, heart, lungs, liver, stomach, intestines and kidneys, in textbook colors,
   in their true places.

The tap peels the next layer:

- The outer layer lifts off in solid pieces (the skin opens along clean seams, the muscles lift off
  group by group), and the layer below shows.
- Tapping again peels the next layer. After the organs, the tap puts all the layers back in order.
- Real motion with solid pieces, never a warp or a dissolve. About 3 s per peel.

Also:

- A "Layer" option lets people pick the layer directly.
- A "Labels" option shows each part's name as page text beside the toy (a list that highlights as
  you tap), not as splat text.

Sources, in this order of preference:

1. **CC0, CC BY or public-domain 3D models**, converted with `tools/model-to-splats.mjs` (or its
   core), for example from NIH 3D (check each model's license on its live page; many are public
   domain or CC BY), the Smithsonian's CC0 open access 3D, or other CC0 sources. Check each license
   on the live page; record it in CREDITS.md, tools/models.json and the toy's in-app credit.
2. **Our own organ toys** (the heart, brain, lungs, kidney and tooth recipes) and kit-built parts,
   where no good free model exists.
3. **Never CC BY-SA or NC**, even if it looks better (for example Z-Anatomy and BodyParts3D are CC
   BY-SA). If only a CC BY-SA source would do a part well, don't use it: build that part from the
   kit, and write under "For the Operator" which part and which source, so the owner can decide.

If the container can't reach a source site, say so and build from the kit and our organ toys.

Quality: Fidelity A's method (even placement, full opacity for solids, full density, clean colors)
is the bar. The owner wants toys "so incredible … that people won't even realize that they're
looking at Gaussian splats." Keep the toy within the tier budgets (a big toy may use the higher
budgets that picture toys use; measure and say so).

Sound: a soft, clean "peel" (a gentle paper-and-cloth slide) for each layer, and a low chime when
all layers return. Add your entry in src/toy-sounds.js.

Clips and cards (390×844), labeled "built by Opus 5.5", in lane record "Anatomy" on the Effect
review page (the Operator made it):

- `an-peel`: all four peels and the return, turning slowly;
- `an-layers`: a still of each layer;
- `an-labels`: the labels list with the heart highlighted.

Tests in tests/an.spec.mjs: each layer builds; a tap peels exactly one layer and parts move as solid
pieces (no part changes shape); four taps return to skin; the splat count per tier; labels list
every part; screenshots at 390×844 and 1440×900.

## You own

- src/packs/anatomy-atlas.js (new), assets/toys/anatomy-atlas/ and any converted model files it
  needs, your entries in the shared lists (src/toys.js, src/toy-sounds.js, src/toy-help.js,
  tools/toy-plan.json, tools/models.json, tools/assets.json, CREDITS.md), tests/an.spec.mjs, your
  `an-*` screenshots and docs/handoff/Anatomy.md.
- Don't change the existing organ toys; reuse their recipes (import and call them) where they fit.

Lanes Books, Worlds, Fidelity A, Fidelity B, the A/B makers and the Integrator run at the same time;
leave their files alone. The laptop is locked.

HOW THIS LANE RUNS

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

Model: Opus 5.5 (default effort). Started September 29, 2026. Draft PR #92; engine PR #93 (merge it
first).

- Built: `anatomy-atlas` (labs, Body shelf) in `src/packs/anatomy-atlas.js`, with its sound, help
  text, plan entry, thumbnail and `tests/an.spec.mjs` (7 tests, all pass).
- Engine PR #93: `out.legend`, a list of names beside the stage (the Labels switch). The lane branch
  carries it until it merges.
- Cards on the Effect review page (lane Anatomy): `an-peel`, `an-layers`, `an-labels`.
- Still to do: read the owner's marks (ids starting `an`) about hourly and fix any "fix".

## Notes

- Sources checked: the Smithsonian open access 3D API answers but lists no human anatomy, and its
  GLBs are Draco-compressed (the converter doesn't read Draco). NIH 3D answers, but I found no full,
  layered body (skin, muscles, bones and organs registered together) under CC0, CC BY or public
  domain; separate organ models from different sources wouldn't line up in one body without hand
  fitting. BodyParts3D and Z-Anatomy are CC BY-SA: not used. So the atlas is kit-built, with our own
  brain, lungs, heart and kidney recipes placed inside it (no converted model files, no new
  credits).
- The body: about 55 primitives (ellipsoids and round cones) joined by a smooth minimum. The join is
  order-independent (the nearest primitive's distance, less the largest fillet any neighbor makes
  with it), so the surface is smooth where the nearest primitive changes; a chained smin left steps
  that made dark specks.
- Each primitive's surface is sampled evenly, pushed onto the joined surface, and kept only where
  that primitive is the nearest, so overlaps don't double up. Points are made all at once, and each
  splat is sized from its four nearest neighbors, so a primitive whose visible part is stretched by
  the join still closes (this removed the last cracks). The muscles reuse the skin's points, 4.5 mm
  in.
- Muscle groups, tendons, fibers and the grooves between groups are colored by rules on position
  (`muscleAt`); the skin's seams by `skinPiece`.
- Pieces are tokens (48 at most: 13 skin, 19 muscle, 16 bone). Each layer is a part, so the inner
  layers are hidden while covered. Skin pieces swing open on hinges at their seams, then fly off
  sideways, up or back (never toward the viewer); muscles and bones tilt and lift, then fly off, one
  group after another. `out.resort` is set eight times per peel (PACKS.md 7b, rules 12 and 13).
- The organ recipes are built through a placement proxy (`placed()`): it moves, turns and scales
  their shapes, gives their color functions their own coordinates, drops their moving effects and
  lowers their shapes' grids.
- The tap count (`info.tap.n`) and the Layer option decide the layer, so drive() keeps no state but
  the resort step, the chime and the highlight.
- Budget: `density: 1.5` (like the model converter), so 90k, 210k, 300k and 400k splats on the four
  tiers. At 200k: skin about 55k, muscles 55k, bones 67k, organs 24k.
- Clips were made with a phone-shaped copy of `tools/effect-clip.mjs` (288×624, a slow turn) kept
  outside the repo.

## Known issues

- Build time: `node tools/check-packs.mjs anatomy-atlas` reports 1.3 to 1.5 s at 200,000 splats in
  this container, sometimes just over the 1.5 s line when the machine is busy. The atlas builds four
  organ recipes plus a body; the heart, lungs and brain toys alone take 0.5 to 0.9 s each here.
- The organs are small when the whole figure is framed; zoom in to see them.
- The knee-cap tendons are small squares on the muscle layer.
- A few bones sit within a millimeter or two of the muscle surface (the cheekbones, the hands); it
  only matters while the muscles fly off.

## For the Operator

- Merge engine PR #93 before #92.
- The Effect review lane note says the atlas is made from converted models; it is kit-built (see
  Notes). Please correct the note if you like; I only wrote the cards.
- A lesson for PACKS.md: a smooth body from primitives (`bodyShape()`, `fieldAt()`): sample each
  primitive, project onto an order-independent smooth union, keep only the owner's points, size each
  splat from its neighbors.
- A lesson for PACKS.md: another recipe can be placed inside a toy through a proxy kit (`placed()`),
  which keeps its colors right by giving its color functions their own coordinates.
- If the owner wants converted anatomy later: a registered, layered body under CC0 or CC BY would be
  needed (none found); organs from different sources would need fitting by hand.
