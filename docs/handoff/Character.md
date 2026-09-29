# Lane Character: a detailed person for Worlds

Prefix `chr`. Branch `claude/lane-character`, PR "Phase Character: a detailed person for Worlds".
How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief

(Written by the Operator on September 29, 2026, from the owner's words that morning)

Worlds (#78, merged September 29, 2026; docs/WORLDS.md) lets you walk a character around the Test
island (`worlds/?labs=1`). The owner, word for word: "My main criticism is about the worlds: still
just a bit too grainy, and the player/character looks way too low-poly and simplistic. But, the
mechanics are solid! So it primarily seems like design problems and sharpness, not physics and
mechanics." Earlier, on the `wd-list` card: "Needs better resolution and precision. Better character
design." On `wd-walk`: "looks extremely grainy and basic. This must be an impeccable and
high-fidelity game." And on the Sharpness lane's Test island card this afternoon
(`shp-test-island`): "This is getting better and better! The person, however, doesn't look right. I
don't know if you can make this person look like a polished video game character, but perhaps you
could try?"

So: aim for the look of a polished video game character. Build a detailed, well-proportioned, sharp
person who walks, runs and stands like a real one. The mechanics stay: the speeds, the controls, the
camera and the collision radius are the Worlds lane's, and the owner likes them.

1. **Design.** Real human proportions (about 7.5 heads tall). A sculpted head with a real face: eyes
   with whites and irises, lids and brows, a nose with nostrils, lips, ears and a hairstyle with
   volume. A neck. A torso with shoulders, chest and waist. Hands with a thumb and fingers (at least
   grouped fingers that curl), and shoes with soles and laces. Clothes with a clear cut: a T-shirt
   or jacket with sleeves and a hem, trousers with a waistband and cuffs, a few folds where cloth
   gathers. It should read as a person, not a jointed wooden figure, from the follow camera at phone
   size and in a close-up.
2. **Source.** Choose what gives the best result, and say why:
   - (a) Sculpt it with the kit, as now, with many more parts and far more care.
   - (b) Start from a realistic human base mesh whose license is CC0 or CC BY. For example, check
     whether MakeHuman's exported models are CC0 on its live license page, or look for a CC BY
     character from an open film studio. Never CC BY-SA or NC, and nothing from a game or a brand.
     Turn it into splats with the Studio's model converter (src/packs/studio-models-core.js, used as
     a library; don't change it). Then cut it into rigid parts, one per bone, with hard edges.
   - Record any asset in CREDITS.md, tools/models.json and the in-app credit, with the license
     checked on the live source page.
3. **Motion as solid parts** (CLAUDE.md, "Effect quality rules"). Every part is rigid and turns on
   its joint; nothing bends or stretches. Hide the joints the way real bodies and clothes do:
   sleeves overlap the elbows, a rounded shoulder cap, trousers over the knees. Add the joints a
   person needs, as rigid pieces:
   - neck, chest and abdomen;
   - wrists and hands, with a curl of the fingers;
   - ankles and feet, with the toe rolling off the ground. Walking and running should look real:
     heel strike and toe off, the hips turning against the shoulders, the arms swinging opposite
     with bent elbows, a slight lean when running, and the head steady. Standing still should look
     alive: breathing, a small weight shift, and now and then a glance around.
4. **Sharpness.** Use Fidelity A's method (docs/handoff/history.md and PACKS.md "Effect quality"):
   even placement, full opacity, full density, flat splats on flat faces and thin ones along the
   edges, and clean colors (skin, cloth, hair, rubber soles). No speckle and no see-through. The
   character is always drawn in full, so set its budget per tier (src/worlds/tiers.js is the Worlds
   lane's file; ask the Operator for any change) and say what you measured at each tier.
5. **Compatibility.** The world file's `character` colors (`shirt`, `trousers`, `skin`, `hair`,
   `shoes`) keep working, and old world files still load. The public API stays: `JOINTS`, `BODY`
   (with `radius` for collision), `buildCharacter(look, { count, seed })`, `pose(gait, time)` and
   `stepGait(gait, speed, dt)` (docs/WORLDS.md, and the Worlds handoff's "For the Character lane").
   You may add fields.

Cards (390×844, each labeled "built by Opus 5.5", in the lane record `Character` on the Effect
review page, which the Operator made):

- `chr-closeup`: a slow turn around the standing person (the face, the hands and the shoes, sharp).
- `chr-walk` and `chr-run`: the follow camera on the Test island, and one side view each.
- `chr-idle`: 6 s standing.
- `chr-before-after`: the old and new character side by side.
- `chr-colors`: three color sets from a world file.

Tests in tests/chr.spec.mjs:

- Each part is rigid: its splats keep their distances as it moves.
- The joints stay connected through a walk cycle: no gaps open at the elbows, knees or neck.
- The feet don't slide while planted.
- The colors from a world file apply.
- The budget holds at each tier.
- Screenshots at 390×844 and 1440×900.

### You own

- `src/worlds/character.js`, and new `src/worlds/character-*.js` modules if you want them.
- `assets/worlds/character/` (new), `tests/chr.spec.mjs`, your `chr-*` screenshots,
  `docs/handoff/Character.md`, and the character section of `docs/WORLDS.md`.
- In `src/worlds/world.js`, only small, marked, additive changes to its character block
  (`buildCharacter()`, `placeCharacter()`). The Worlds lane is working on the rest of `src/worlds/`
  at the same time (its round 2: grain out of the ground, water, sky and props), so tell the
  Operator before touching anything else there.

Lanes Worlds r2, Pianos, Sharpness, Books, Chemistry, Real objects, Photo to 3D, Machines A, Screens
r2, Lab r2 and the two Integrators run at the same time; leave their files alone. The laptop is
locked.

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

Built by Opus 5.5 (default effort).

- September 29, 2026: lane started. Reading the Worlds code; the draft PR is open.

## Notes

## Known issues

## For the Operator
