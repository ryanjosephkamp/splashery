# Lane Studio Models: 3D model files to splats (prefix `stm`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Studio Models, "3D model files to splats" (prefix `stm`).
Branch: claude/lane-studio-models. PR title: "Phase Studio Models: 3D model files to splats".
Handoff file: docs/handoff/StudioModels.md.

## Brief (written by the Operator on September 29, 2026, from the owner's answers on the Splashery Universe page)

The owner's answers: the Studio (splats from anything) goes in this order: "Sound and music (song
landscape, Chladni plate); 3D model files to splats; Photo to 3D", with the converters built by
Sonnet 5.5. On new sources: "CC0 3D models from the Smithsonian, Poly Haven, Kenney and Quaternius,
converted to splats; plus my own phone scans, which I'll send as files." On anatomy: "I wonder if we
could build the '3D model files to splats' and 'Photo to 3D' tools first, and then use those with 3D
organ models … and maybe get better quality than we would now." So this converter is the base for
later toys and the anatomy atlas: make it accurate and sharp.

Build two things.

1. **A labs toy, "Model to splats"** (`model-splats`), on the Studio shelf (category `studio`, which
   lane Studio Sound adds in #80; if #80 hasn't merged when you start, merge
   `origin/claude/lane-studio-sound` into your branch, or add the category the same way and keep
   both on merge).
   - You open a 3D model with the Toy tab's input panel: glTF 2.0 (`.gltf` with its files, or
     `.glb`), OBJ (with MTL colors where given) and STL (binary and ASCII). Use
     `input: { binary: true, … }` so `read("", fileName, file)` gets the File (engine PR #81,
     merged; docs/PACKS.md, "Your own input"). It is converted on the device and never uploaded.
     Keep the decoded model in the module, like the protein toy, and return small option values.
   - Conversion must look like the model, not like a cloud: sample the surface by area, with more
     splats where there is detail; flat splats lying on the surface (oriented by the face normal),
     sized to their neighbors so the surface closes with no holes and no see-through; colors from
     the base-color texture at each sample's UV (or vertex colors, or the material color), with
     simple lighting that matches the other kit toys; hard edges stay hard. Scale and center the
     model to the toy's size. Keep the splat count within the tier budgets (like `PICTURE_BUDGETS`),
     and show the count.
   - PlayCanvas (vendored, through `src/pc.js`) has a glTF container loader; you may use it to parse
     glTF/GLB, or write a small parser. OBJ and STL need small parsers of your own. No new libraries
     in the page. Say plainly what isn't supported (for example Draco- or meshopt-compressed glTF,
     skinned animation).
   - The tap: the splats lift off the surface into a loose cloud and settle back onto the model in
     about 3 s, each splat to its own place (real motion, not a warp). A "Show" option switches
     between the splats and a wireframe-style view made of thin edge splats, so people see how the
     mesh became splats.
   - Samples: two or three CC0 models checked on their live pages (Kenney, Quaternius, Poly Haven or
     Smithsonian Open Access CC0 3D), credited in CREDITS.md, tools/assets.json and the toy's
     credit. If the container can't reach those sites, make one sample model of your own with a
     script and say so.
2. **A build tool**, `tools/model-to-splats.mjs`: the same conversion in Node, turning a CC0 model
   file into a splat file the kit can load (use the format our scans and `tools/models.json` already
   use), so later lanes can make toys from CC0 models. Document it in docs/PACKS.md under a new
   short section (append only; lane Learn is auditing the Manual, not PACKS.md).

Tests in tests/stm.spec.mjs: each format loads (a small test model in tests/fixtures/stm/ of your
own making for glTF, OBJ and STL); the splat count stays within each tier's budget; a flat test quad
converts with no holes (coverage of its area) and no see-through (its splats' opacity); colors
follow a test texture; the tap builds and settles without errors. Screenshots at 390×844 and
1440×900.

Engine: the owner's split says Opus builds engine changes. If you need one, first check what the
input panel, kit, loaders and pictures code already allow. If it's truly needed, stop and tell the
Operator exactly what (the function, where, why); don't change engine files yourself.

Clips and cards (390×844), labeled "built by Sonnet 5.5": `stm-sample` (a CC0 model as splats,
turning, then the tap), `stm-open` (opening a model file of your own and seeing it convert),
`stm-compare` (a still pair: the model's own render next to the splats, to judge fidelity).

## You own

- src/packs/studio-models.js (new, or your own section appended to src/packs/studio.js if lane
  Studio Sound has merged; don't change its toys), assets/toys/model-splats/,
  tools/model-to-splats.mjs, your appended section in docs/PACKS.md, tests/stm.spec.mjs,
  tests/fixtures/stm/, your `stm-*` screenshots and docs/handoff/StudioModels.md, plus your toy's
  entries in the shared lists.

Lanes Books, Worlds, Fidelity A, Studio Sound, Learn, Lab and the Integrator run at the same time;
leave their files alone. The laptop is locked.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Sonnet 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
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

Model: Sonnet 5.5 (default effort). Started September 29, 2026.

- Merged `origin/main` and `origin/claude/lane-studio-sound` into the branch (for the `studio`
  category; #80 was not on main yet).
- Working out the design (see Notes). Nothing built yet.

## Notes

Design, so far:

- One pure module, `src/packs/studio-models-core.js` (no DOM), does everything the toy and the Node
  tool share: the glTF/GLB, OBJ+MTL and STL parsers, the mesh preparation (crease-smoothed normals,
  edge adjacency, detail weights), the surface sampler and the wireframe. Image decoding is passed
  in (the browser uses `createImageBitmap`; Node uses pngjs and jpeg-js).
- `src/packs/studio-models.js` is the toy (recipe, input panel, samples).
  `tools/model-to-splats.mjs` writes a PLY like `tools/mesh-to-splats.mjs` does.
- The tap uses the kit's morph channel: each splat has its own loose-cloud target and goes there and
  back in a straight line.

## Known issues

(none yet)

## For the Operator

(none yet)
