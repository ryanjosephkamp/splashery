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
  your branch didn't change.
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

Model: Opus 5.5 (default effort). Started September 29, 2026.

- Planning: a kit-built figure (no registered, layered full-body model under CC0/CC BY/PD was found;
  see Notes), with our heart, brain, lungs and kidney recipes placed inside it.

## Notes

- Sources checked: the Smithsonian open access 3D API answers but lists no human anatomy; its GLBs
  are Draco-compressed (the converter doesn't read Draco). NIH 3D answers. BodyParts3D and Z-Anatomy
  are CC BY-SA: not used.

## Known issues

## For the Operator
