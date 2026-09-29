# Lane Learn: the Manual audit and the lab notebook

Prefix `ln`. Branch `claude/lane-learn`, PR "Phase Learn: the Manual audit and the lab notebook".
How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Learn, "The Manual audit and the lab notebook" (prefix `ln`).
Branch: claude/lane-learn. PR title: "Phase Learn: the Manual audit and the lab notebook". Handoff
file: docs/handoff/Learn.md.

(Written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and
his answers on the Splashery Universe page the same night)

The owner's words: "We can, you know, continue to build the Tinker's operator manual, make it very
comprehensive and complete, you know, run some audits on it." His answers: Learn is built by Sonnet
5.5: "an audit of the Tinkerer's Manual, and a running lab notebook"; and for the blog: "Keep it
last, but start a running lab notebook now (what each model built, numbers, lessons), so nothing is
lost."

Do two things.

1. **Audit the Tinkerer's Manual** (`manual/index.html`, its figures in `manual/img/`,
   `manual/example-recipe.js`, and the 25-page PDF printed by `tools/manual-pdf.mjs`; lane Manual
   built it, see docs/handoff/Manual.md and history.md). It is public, linked from the About tab.
   - Check every claim against today's code: the math (the Gaussian, Σ = R S Sᵀ Rᵀ, the projection),
     the recipe API (compare with docs/PACKS.md and src/kit.js), the controls, the scene format
     (docs/SCENE-SCHEMA.md), and each splat equation program (it must run in the toy and match its
     picture).
   - Check that every link works, every code sample runs as written, the page reads well at 390×844
     and 1440×900, and it follows the rules (American English in new text, no brand names).
   - Write the audit into your handoff under "## Audit": one line per finding, with its fix or why
     it stays.
   - Fix what's wrong. Then make the Manual complete for what has merged since it was written:
     picture sheets and page turning (Pictures, Books if merged), the Screen and the Gaussian
     splatting toy (Screens), the tilt lock and the top-bar buttons (Viewer, #75), and input panels
     (typing, drawing, opening a file). Add a chapter only for what has merged into main; note in
     your handoff the chapters to add when Worlds and Studio merge.
   - Regenerate the PDF with `tools/manual-pdf.mjs` and check its pages.
2. **The lab notebook** (`docs/NOTEBOOK.md`): the Operator adds one row per lane when it merges. You
   own everything else in the file: keep the rows, and don't reorder or rewrite the ones the
   Operator adds.
   - Backfill the lanes before Manual from docs/handoff/history.md and the handoff files: Phases A
     to E4, E4-finish, E5, E6a, E6b, F, G, Math, Fix3, AI, Help, HelpTextA, HelpTextB and Pictures.
     Give each one row: date, lane, model (Opus 5.5 for every lane before September 29, 2026), what
     it built, and the numbers that matter (toys, tests, clips, review rounds, how long it ran where
     the record says).
   - Add a "## Lessons" section: the lessons from history.md and the handoffs, grouped (engine,
     effects, review, parallel lanes, tools), each with the lane it came from.
   - Add a "## The two models" section: what the notebook will record for the Opus 5.5 and Sonnet
     5.5 comparison (per lane: time, rounds of fixes, first-time "good" marks, test failures before
     READY) and the plan for the blind A/B toy. Record only what the records show; never invent
     numbers.

Clips and cards (390×844): `ln-manual-phone` (scrolling the audited Manual, a still or a clip) and
`ln-manual-pdf` (a few pages of the new PDF as stills). The Manual is public, so the owner's "good"
marks decide the merge. Label both cards and your PR "built by Sonnet 5.5".

### You own

- manual/ (all of it), tools/manual-pdf.mjs, docs/NOTEBOOK.md (except the Operator's rows),
  tests/ln.spec.mjs, your `ln-*` screenshots and docs/handoff/Learn.md.
- Don't change toys, engine files or other docs; if the Manual finds a bug in the code or in
  docs/PACKS.md, write it under "## For the Operator".

Lanes Books, Worlds, Fidelity A, Studio Sound, Lab and the Integrator run at the same time; leave
their files alone. The laptop is locked.

### How this lane runs

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

Model: **Sonnet 5.5** (default effort). One helper (Sonnet 5.5) extracted the notebook's facts from
the records; every number in the notebook was checked against history.md and the handoff files.

Started September 29, 2026. Branch `claude/lane-learn`.

- **The Manual audit**: done (see "Audit"). The Manual has a new Level 5 (picture sheets, turning a
  page, input panels, the Screen and the Gaussian splatting toy, the top bar and the tilt lock),
  with three new example recipes in `manual/example-pictures.js` and `manual/example-input.js`, 8
  new pictures, and the fixes below. The PDF is regenerated: 34 letter pages (it was 25).
- **The lab notebook** (`docs/NOTEBOOK.md`): rows backfilled for Phase A to Phase E4, E4-finish, E5,
  E6a, E6b, F, G, Math, Fix3, AI, Help, HelpTextA and HelpTextB (the Operator's Pictures row was
  already there, so Pictures got no second row); "Lessons" (5 groups, each item with its lane) and
  "The two models". The Operator's three rows (Manual, Pictures, Screens) are untouched.
- Tests: `tests/ln.spec.mjs` (19 tests).
- Cards: `ln-manual-phone` and `ln-manual-pdf`, both labeled "built by Sonnet 5.5" (posting status
  in "Notes").

## Audit

Claims that were checked and are right (no change):

- The math: the bell values (1, 0.61, 0.14, 0.01 at 0 to 3 σ), Σ = R S Sᵀ Rᵀ, the worked example
  (0.070, 0.035, 0.030, 0.010; checked by a test), the projection Σ′ = J W Σ Wᵀ Jᵀ with the top-left
  2-by-2 block, the back-to-front blending formula, and "14 numbers per splat" (3 + 3 + 4 + 3 + 1).
- The equation language: every operator, function and constant listed exists and behaves as written
  (`2^3^2` = 512, `-u^2` = −4, `sin 2u`, `(u + 1)(v − 1)`, `|x|`, `**`, `·`, `²`, `³`, `√`), the
  fields and their defaults (v 0 .. 1, size 0.05, count 4000, gray r/g/b 0.5, spread grid), the
  count limits (100 to 10,000) and the 120-character cap. Tests read every claim from the page.
- All 15 gallery cards: the code on each card is exactly the program its link opens, and each builds
  finite splats at the low (120,000) and the max (400,000) tier.
- The windmill sample is identical to `manual/example-recipe.js` and builds.
- The recipe API in Level 2 against PACKS.md and `src/kit.js`: every `k.` call the page names exists
  (a test checks), every behavior kind and channel exists, the 15-part limit, control types, and the
  catalog entry fields.
- Links: every local link, anchor and picture works (a test loads the page and checks each image and
  its alt text); the 5 web links answer 200 (PACKS.md on GitHub, the repository, the live site, the
  live PDF).
- Layout: no sideways scroll at 390, 320 and 1440 wide; the tables and code scroll inside their
  boxes. No brand names on the page.

Findings, each with its fix or why it stays:

1. **Splat counts were loose.** "Between about 60,000 and 400,000 depending on your device" hid the
   tiers. Fixed: about 60,000 on a small phone, up to 280,000 on a strong computer and up to 400,000
   on the strongest (`PROFILES` in `src/generators.js`; a test checks the numbers).
2. **The sorting tip was vague and partly wrong.** It said Splashery "may keep the order it worked
   out for the piece's resting pose". PACKS.md says splats are sorted in the pose they were built
   in, and a body turned more than a quarter turn draws its far side over its near side. Fixed to
   say that.
3. **The kit's shapes were incomplete.** `k.ellipsoid`, `k.roundedBox`, `k.radial`, `k.cloud` and
   `share` were missing, and `k.param`'s u and v (0 to 1) were not said. Fixed.
4. **Colors.** The page said only "#hex" or a function. A recipe color is also `[r, g, b]` with each
   from 0 to 1, and there are no color names or `hsl(...)` (a string that is not a hex color comes
   out wrong; found when this lane's own example used one). Fixed in the text and the example.
5. **"A recipe has up to six parts" was out of date.** `pictures`, `input`, `tiltLock`, `turntable`,
   `grab` and `drag` exist. Fixed: "six basic parts", with a pointer to Level 5 and PACKS.md.
6. **Splat equation aliases and range spellings were undocumented.** `red`, `green`, `blue`,
   `splats`, `x(u,v,t)` and the ranges `0 to 2pi` and `0, 2pi` all work. Fixed (added to the fields
   table's note). The aliases `n` and `colour` also work and stay unlisted (`colour` is British
   spelling, `n` is unclear).
7. **The date.** The cover and footer said September 28, 2026 only. Fixed: "first published
   September 28, 2026 and updated September 29, 2026".
8. **Nothing about what merged since.** Fixed with Level 5: picture sheets (`k.sheet`, `pictures`,
   `out.sheets`, `info.data.pictures`), turning a page (`k.spine`, `leaf`, `out.leaves`), input
   panels (typing, drawing on a pad, opening a file), the Screen, the Gaussian splatting toy, the
   tilt lock and the three top-bar buttons, and the pinch rules. Every sample in it is a file in
   `manual/` that a test builds. The Screen's video frame is credited (CC BY 3.0) and so are the
   strawberry and tulip photos (CC0).
9. **Level 5's first book sample was wrong.** The two-sheet page in PACKS.md 5b (a back sheet with a
   reversed normal) showed paper and no ink in main's engine (see "For the Operator"), and a hidden
   sheet is not built until it shows, so the first turn waited. Fixed: the little book builds the
   next and the left pages ahead (visible, or hidden by a part), and its leaf is one sheet whose far
   side reads in mirror image.
10. **The PDF wrapped code lines** (88 columns at print size). Fixed: code prints at 7.8 pt in the
    PDF (`manual.css`, print block). The PDF is 34 pages. `tools/manual-pdf.mjs` gained `--which=`
    to render any pages to pictures, and prints the page count.
11. **Gallery links open the live site.** They work only where the live site has the Splat equation
    toy (it does since #65). They stay as they are. A test decodes each link and builds it.
12. **"Code a toy" is still future.** The Toy Workshop is ROADMAP step 8, so the chapter stays as
    "What comes later".
13. **Not in the Manual, and correct not to be**: Books (#73, not merged), Worlds and Studio (not
    merged). See "Chapters to add".

## Notes

- **The little book's design** (Level 5): pages are built ahead. A sheet that is not `visible` is
  not built, so the page under the turning one is always on show (covered by the leaf at rest), the
  left page rides a part that hides it during the turn, and the page number moves on when the turn
  ends. The leaf is a single sheet, so its far side shows in mirror image until it lands (the built
  order in the pose drawn at rest; see "For the Operator").
- **The figures** (`manual/img/toy-*`, `ui-*`) were rendered from the site with a scratch Playwright
  script (not committed, like lane Manual's). The little book's turning figure holds the pulse at
  0.4 by setting `player.motion.state.turn` and waiting for the sheets to build.
- The notebook's facts came from a helper's extract of history.md and the handoff files; its own
  conflicts (E1b "19 toys" against "13 of them redone", E4-finish "four fixes" against "five clips",
  the ocean wave's 38 against "28 and 10" tokens) are shown as the record has them.
- `pkill -f "<pattern>"` where the pattern is in the same command line kills that shell (Screens.md
  says so; it happened here once).
- Chapters to add when they merge: **Books** (Your book, photo album, picture frame: a real book
  with two-sided pages, pages built ahead with `ahead: true` and `pics.ready(id)`, several photos as
  one set with `input.media.multiple`, the page shape at build with `k.media`; then update the
  little book to use them); **Worlds** (a world file, terrain, water, sky and props from recipes,
  levels of detail, landmarks, controls; docs/WORLDS.md is its source); **Studio** (a song as a
  landscape and the Chladni plate, 3D model converters and their limits, photo to 3D); **Lab**
  (kernels and fields, if they change how toys are made).

## Known issues

- The Manual's own toys (the little frame, book and bars) are examples, not toys on the shelf; a
  reader who wants to run one has to paste it into a pack. The Manual says they are complete recipes
  and the tests build them.
- The little book's leaf shows the page in mirror image while it is over (see Notes). Books is
  expected to do better with its own engine work.
- The PDF has no table of contents page numbers (the contents are links, which the PDF keeps).

## For the Operator

- **PACKS.md 5b, the leaf's back.** It says "the back of a turning page is a second sheet with the
  same spine, `normal` reversed and its own page". In main's engine that sheet showed white paper
  and no ink: splats are sorted in the pose they were built in, so the back's paper draws over its
  own ink. It is worth a line in PACKS.md (or a fix in the Books engine PR). The Manual avoids it.
- **PACKS.md 5b, hidden sheets.** A sheet whose `visible` is 0 is not built (`want` is empty), so a
  page that first shows halfway through a turn waits for its build. A line saying "keep the pages
  you will need visible, or hidden by a part" would help; the Books engine's `ahead` flag (its
  handoff) addresses it.
- **The engine, idle stage after a page change** (low priority). After a sheet changes page, the old
  page's splats stay until the retiring frames tick; in Chromium with software rendering, with
  nothing else drawing, the old page's lower half stayed on show beside the new page until
  `stage.requestRender()` was called again. Not seen at 60 frames a second; `requestRender(200)` may
  be shorter than six slow frames.
- **README**: the manual's folder has three example recipes and `tests/ln.spec.mjs` checks the page
  against the code.
- **WORKSTREAMS.md, HANDOFF.md, history.md and Manual.md say "25 pages"** for the PDF; it is 34
  pages now.
- **NOTEBOOK.md**: add each merged lane as a row below the last one (the file says so). The Learn
  row is yours to add when this merges.
- No tests of other lanes are broken by this lane (the full suite passes, below).
