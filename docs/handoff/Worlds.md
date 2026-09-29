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

Model: Opus 5.5 (default effort).

- September 29, 2026: lane started. Handoff file and draft PR first; the engine next.

## Notes

## Known issues

## For the Operator
