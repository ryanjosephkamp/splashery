# Lane Physics: hands-on play and physics

## Brief

(Written by the Operator on October 2, 2026, word for word.)

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Physics, "Hands-on play and physics" (prefix `phy`). Branches:
`claude/lane-physics-engine` ("Engine: hands-on play and a small physics engine"), merged first,
then `claude/lane-physics` ("Phase Physics: hands-on showcase toys"). Handoff file:
docs/handoff/Physics.md.

This is step 7 of docs/ROADMAP.md, "Physics and hands-on play", which the owner approved earlier.
Read its "Hands-on play" and "Physics" sections first: they are the design. In his review of October
2 (docs/reviews/2026-10-02-mega-review/review.md, on branch `claude/operator-mega-review` until that
Ops PR merges) he said this is what he most wants finished in the next one to three days: "I really
do want to add all the interactivity and maybe, like, a little physics stuff to all the toys so that
they're interactive." Speed matters, and so does quality: everything you ship must pass the effect
quality rules in CLAUDE.md (real motion, solid pieces, things move like the real thing).

### Part 1: the engine (claude/lane-physics-engine)

As ROADMAP.md describes:

- **A small physics engine of our own** (position-based dynamics, XPBD; no library): rigid pieces,
  soft bodies (stiff and loose constraints), simple collision shapes, the floor, gravity, friction
  and sleep. CPU for a few dozen pieces and a few hundred points; the GPU still moves every splat.
  It must run smoothly on a mid-range phone.
- **Hands-on mode**: ▶ Play runs today's tap; ✋ Hands-on is a switch (off: everything works as
  today; on: a drag on the toy grabs what's under the finger, a drag beside it or with two fingers
  turns the view, a tap on a piece does that piece's action); ↺ Reset sends every piece home. Toys
  that are hands-on already (laptop, xylophone, chess, puzzle cube, Newton's cradle, gummy bear,
  bricks, pianos) keep their controls and start with the switch on. Keep the controls out of the way
  on a phone (390×844) and consistent with the top bar and the Toy tab.
- **Level 1 for every toy**: with Hands-on on, any toy, scans included, can be picked up and tossed.
  It lands, bounces and settles; soft ones squish. This is the "interactive for all toys" baseline.
- Links and saved scenes are unchanged: a link opens the toy as built, and old `#s=` links (schema
  v2 and v3) keep loading.

Merge this part as soon as it's solid, with its own tests (tests/phy-engine.spec.mjs). With the
switch off by default, public toys don't change, so the Operator merges it after the full test run.

### Part 2: the showcase toys (claude/lane-physics)

The owner asked for these in his review; do them in this order:

1. **rocks (Pebbles)**: pick up the pebbles one by one and stack them; a careless stack topples.
   Same sounds as today.
2. **jelly** and **amoeba**: pull and stretch them like the gummy bear; they wobble back. (Sound C
   is changing the amoeba's sound; leave sound entries to them.)
3. **cherries**: pull one cherry on its stem and let go: it swings and knocks the other, like
   Newton's cradle.
4. **bricks** and **macarons**: pick up and stack (the bricks already snap; make free stacking work
   too).
5. **spring-toy**: pull and stretch it; it springs back and wobbles like a real Slinky.
6. **sushi**: tap a piece and the chopsticks pick that one up and can put it back.
7. **bow-and-target**: pull the arrow back on the string, let go, and it flies (already in
   BACKLOG.md).

Then write **the hands-on plan for every toy**, docs/HANDS-ON-PLAN.md: one line per toy saying what
Hands-on does beyond Level 1 (or "Level 1 only"), grouped by shelf, so the owner can approve it and
category lanes can build it. You may start one helper (same model) for the plan's draft while you
build.

### Clips and marks

Post clips in your lane record "Physics" on Effect review page 2, at 390×844, "built by Opus 5.5":
the Hands-on controls; a scan picked up and tossed; a soft toy squished; and each showcase toy. Show
a person's drag in the clip (a dot where the finger is). Showcase toys are public, so part 2 merges
after the owner marks the cards good.

### You own

- New files under src/physics/ (or similar; say where), the Hands-on controls (small, additive
  changes to src/player.js, src/app.js, src/ui.js and styles.css; tell the Operator the exact
  lines), and the showcase toys' recipes for their hands-on parts.
- Those toys' entries in src/toy-help.js and tools/toy-plan.json (how-to lines change), but not
  their sounds (Sound C owns them).
- docs/HANDS-ON-PLAN.md, tests/phy*.spec.mjs, your `phy-*` screenshots and docs/handoff/Physics.md.

Lanes Sound C, Fix7 (taps and toy bugs; it will touch storm-cloud, shield, splat-field, fireworks,
paper-lantern, puzzle-cube and others), Fluids r4, Video 3D, Live input, Science and the Integrators
run at the same time; leave their files alone. If the Hands-on switch needs a change in a file
another lane is editing, keep yours small and say so. The laptop is locked.

### How this lane runs

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
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md, docs/ROADMAP.md (steps 7 and 8) and
  docs/handoff/history.md (lessons from earlier lanes).
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
  https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK (Effect review page 2), as OPERATING.md's "Steps
  for a lane" says. Judge every effect as motion at phone size against the effect quality rules
  before you post it. The Operator has made your lane's record. Don't republish the page, and never
  write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR per branch against main with the five sections (Summary, Verification,
  Deviations, Known issues, What was cut), and the model that built it in the Summary. When main
  moves, merge it into your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PRs are merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- October 2, 2026: lane started. Branch `claude/lane-physics-engine` from main.

## Notes

## Known issues

## For the Operator
