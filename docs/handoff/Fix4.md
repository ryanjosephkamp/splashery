# Lane Fix4: the clock's hands and the marble's glass

Prefix `fx4`. Owns the `clock` recipe in `src/packs/objects.js` and the `marble` recipe in
`src/packs/balls.js` (those two recipes only, plus constants only they use), their thumbnails, their
entries in the shared lists, `tests/fx4.spec.mjs`, the `fx4-*` screenshots and this file. How lanes
work: [OPERATING.md](../OPERATING.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fix4, "The clock's hands and the marble's glass" (prefix
`fx4`). Branch: claude/lane-fix4. PR title: "Phase Fix4: the clock's hands and the marble's glass".
Handoff file: docs/handoff/Fix4.md. A small lane: two public toys, one fix each.

## Brief (written by the Operator on September 30, 2026, from the owner's marks of September 29)

The owner marked two of lane Sharpness's cards "fix", word for word:

1. `shp-clock`: "The minute and hour hands on the clock aren't fully visible here for some
   reason..." Lane Sharpness found why (docs/handoff/Sharpness.md, item 8): the hands sit only 1 to
   3 cm above the dial (`hand()` in src/packs/objects.js: `zf + 0.01`, `0.02`, `0.03`), so from the
   home view the dial's big, flat splats sort in front of a hand pointing up and to the right.
   Lifting them to about `0.04`, `0.055` and `0.07` showed the hand in its test. Fix it so both
   hands (and the second hand, if there is one) are fully visible at every time of day and from
   every normal viewing angle: check 12 hand positions around the dial, from the home view and from
   30° to either side, at 390×844 and 1440×900. Keep the hands looking attached to the center (a
   real clock's hands sit a few millimeters apart on the arbor, so if lifting makes them float, use
   a visible arbor and a small hub), and keep the tap effect as it is.
2. `shp-marble`: "Overall, this looks really good, but I can barely see the marble's glass spherical
   shape, only the glass thing inside of it." The glass shell is a faint, nearly white cloud on a
   white background. Make the glass sphere read clearly as clear glass: a visible rim where the
   shell turns away (brighter and more opaque at grazing angles, the way real glass shows a bright
   edge and a thin dark line), a highlight and its small reflection, and a faint tint, while the
   colored swirl inside stays fully visible and sharp. Check it on both the light and the dark
   background, at phone size. The effect quality rules apply: no see-through solids, but this one is
   glass, so it must look like glass (clear, with a crisp edge), never like a cloud.

Both are public toys: they merge only after the owner marks your new cards good.

Cards (clips at 390×844, each labeled "built by Opus 5.5", in the lane record `Fix4` on the Effect
review page, which the Operator made): `fx4-clock` (the hands moving through a full turn, the view
swinging 30° each way), `fx4-clock-still` (a still at 1:52 and at 10:10, side by side if you can),
`fx4-marble` (the marble turning on the light background, then the dark one), `fx4-marble-tap` (its
tap). Set `replacedBy` on `shp-clock` and `shp-marble` to your new card ids.

Tests in tests/fx4.spec.mjs: the hands' splats are in front of the dial's splats along the view ray
at the 12 positions (read the built parts' positions), the marble's rim is brighter than its center
in a rendered frame, and screenshots at 390×844 and 1440×900.

## You own

For this lane only: the clock's recipe in `src/packs/objects.js` and the marble's recipe in
`src/packs/balls.js` (both frozen packs, opened for these two toys only: change nothing else in
them), their thumbnails, `tests/fx4.spec.mjs`, your `fx4-*` screenshots, docs/handoff/Fix4.md, and
the two toys' entries in the shared lists if their help or plan text needs a word changed.

Lanes Fluids, Worlds, Books r4, Science, UI r2, Video 3D and the Integrators run at the same time;
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

Model: Opus 5.5 (default effort).

September 30, 2026: both fixes are built on `claude/lane-fix4`. Tests, clips, cards and the draft PR
follow in this session.

## Notes

- **Clock** (`clock` in `src/packs/objects.js`). Two causes, not one:
  - The hands were `roundBox(w, len, 0.008, w * 0.45)`: objects.js's `roundBox` doesn't clamp the
    corner radius to half the thickness, so each "thin" hand was a pill about 5 cm thick (the hour
    hand's splats ran from 1 cm below the dial's face to 2 cm above it). Part of every hand sat
    inside the dial.
  - Splats sort in the pose they were built in (PACKS.md; `Player.resortPose`). The hands are built
    pointing at 12, so a hand turned to 2 o'clock sorted as if it still pointed up, and from any
    angle but face on the dial's splats beside it sorted in front of it. Lifting alone can't fix
    that (at 30° to the side the lift would have to be about half the hand's length).
  - Now each hand is a thin, flat, tapered blade (a `k.param` face) with a round boss, stacked on a
    visible brass arbor with a cap nut: hour 4 cm, minute 5.5 cm, second 7 cm above the dial
    (`HAND_Z`; recipe units, the clock is 1.6 across). `drive()` sets `out.resortPose` on the first
    frame and once each time the second hand has ticked (0.2 s after each whole second, keyed in
    `k.data.handsSorted`), so the hands always sort where they point. The tap (the bells) is as it
    was.
- **Marble** (`marble` in `src/packs/balls.js`, `GLASS`). The old glass was a sphere of splats at
  opacity 0.16: a milky film over the swirl face on, and too faint at the edge to show on a light
  page. A splat can't see the camera, so the edge now comes from geometry: "fins", thin splats
  standing on edge across the surface, each in a plane through the center (a `k.cloud` whose normal
  is a tangent direction). Face on, the eye sees every fin edge on, as a hairline, so the glass is
  nearly clear; at the rim it sees them side on, stacked along its line of sight, so they add up to
  a solid edge from any side. Two fin layers: a dark one outside (the thin dark line that shows on a
  light page) and a bright one just inside (the bright edge on a dark page). A very faint flat shell
  gives the tint. The highlight is a crisp disc up and to the left, with a small reflection low on
  the right. The fins are scattered a little off the Fibonacci points so their rows never show as
  rings. The swirl is unchanged, and now shows at full color (the milky film was what washed it
  out).
  - Flat shells can't do this: face on and at the rim they add up about equally (tried at several
    opacities before the fins).

## Known issues

- The marble's highlights are built into the glass, so they turn with the view when the camera
  orbits (as before).

## For the Operator

Nothing yet.
