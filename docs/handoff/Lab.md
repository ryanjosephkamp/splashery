# Lane Lab: sharper kernels and splat fields

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Lab, "Sharper kernels and splat fields" (prefix `lab`). Branch:
claude/lane-lab (and claude/lane-lab-engine for its engine PR). PR titles: "Engine: Lab, sharper
splat kernels (off by default)" and, if you get to it, "Phase Lab: splat fields on the GPU". Handoff
file: docs/handoff/Lab.md.

## Brief (written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and his answers on the Splashery Universe page the same night)

The owner's words: "What if we found something that's, like, totally unique that nobody's ever done
that's actually valuable … Could we use a different kernel for some parts of this? Could we use
splats that are not Gaussian? … could we use 4D Gaussians?" And: "I almost want to make things so
incredible with this that people won't even realize that they're looking at Gaussian splats." His
answer: "The Lab? One Opus lane: a short literature check, then the sharper-kernel test on pages and
grainy toys, then splat fields on the GPU. Keep only what beats today's clips."

Work in this order, and stop a step early rather than ship something that doesn't clearly win.

1. **A short literature check** (about an hour): kernels other than the Gaussian for splatting (for
   example compact or higher-order kernels, "sharper" falloffs, generalized exponential or Student-t
   splats, beta kernels, 2D surfels), anti-aliasing for splats (Mip-Splatting and similar), and 4D
   or time-varying Gaussians. For each: what it changes in the renderer, what it costs, and whether
   it fits our engine (PlayCanvas 2.22.3's unified gsplat renderer, vendored, with our work-buffer
   modifiers in src/stage.js) and our kit-built toys (splats we place ourselves, not trained). Write
   it as docs/lab/LITERATURE.md with links to the papers (read their abstracts on arXiv or the
   project pages; cite, don't copy).
2. **Sharper kernels, measured.** Build the best one or two candidates as an option that is off by
   default: a per-recipe flag (for example `kernel: "sharp"`) and a URL switch for testing (for
   example `?kernel=sharp`), both behind the labs switch. Don't change how any toy looks by default.
   - Test on what the owner called grainy or blurry: PDF pages in the Picture lab (text and figures
     at phone size) and the grainy toys on lane Fidelity A's audit list (docs/handoff/FidelityA.md,
     "## Audit"; the desk lamp, the American football and the hockey puck first). Fidelity A may
     also list kernel requests under "For the Operator".
   - For each, make a before-and-after pair at 390×844 (stills, and a clip where motion matters) and
     measure: sharpness (edge width in pixels on a text line or a seam), speckle, frame time (as
     relative numbers in our software renderer; say plainly that the owner's phone is the real
     test), and splat counts.
   - Keep only what clearly beats today's clips. Put the kernel in a small, additive engine PR
     ("Engine: Lab, sharper splat kernels (off by default)", with tests in
     tests/lab-engine.spec.mjs) that merges first. Turning it on for a public toy is a later step
     for the owner to approve from your cards.
3. **Splat fields on the GPU**, if time allows: splats whose positions and colors come from a field
   computed on the GPU every frame (for example the splat equation toy's u, v, t programs, or a flow
   field), so a toy can move hundreds of thousands of splats smoothly. Prototype it behind labs as
   one test toy on a new "Lab" shelf (category id `lab`, label "Lab", after "Studio"), measure it,
   and write up what it would take to use it in Worlds and the Studio.

Engine files are shared: lane Worlds may make small additive changes in src/kit.js, src/stage.js and
src/pc.js at the same time, and lane Studio Sound's engine PR #81 touches src/motion.js and
src/ui.js. Keep your changes small, additive and off by default, and merge main into your branches
often.

Clips and cards (390×844), ids `lab-<topic>` (for example `lab-kernel-pdf`, `lab-kernel-lamp`,
`lab-field`): each a before-and-after pair with the numbers in the card's note. Everything stays
behind labs, so the Operator merges once the full suite passes; the owner decides from the cards
whether any kernel goes onto public toys.

## You own

- docs/lab/ (new), the kernel code in the engine PR (the gsplat shader hooks in src/stage.js or a
  new src/kernels.js, with the flag read in src/player.js or src/kit.js), src/packs/lab.js (new) and
  its toys' entries in the shared lists, the Lab category in src/toys.js, tests/lab.spec.mjs and
  tests/lab-engine.spec.mjs, your `lab-*` screenshots and docs/handoff/Lab.md.

Lanes Books, Worlds, Fidelity A, Studio Sound, Learn and the Integrator run at the same time; leave
their files alone. The laptop is locked.

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

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: lane started. Handoff file written; the literature check is under way.

## Notes

## Known issues

## For the Operator
