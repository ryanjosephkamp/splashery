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
  "## State

Built by Opus 5.5 (default effort).

- September 29, 2026: lane started; draft PR #110 open.
- The new character is in: 21 rigid joints, a sculpted person, a foot-led gait, per-tier budgets.
  The Worlds tests (`tests/wd.spec.mjs`) pass with it; `tests/chr.spec.mjs` is new.
- Next: the review cards (`chr-closeup`, `chr-walk`, `chr-run`, `chr-idle`, `chr-before-after`,
  `chr-colors`), the full test run, then READY.

## Notes

- **Source: (a), sculpted with the kit.** Why: every color must come from the world file's five
  colors, which is simple when each surface is ours (a scanned or converted mesh would need its
  texture split and recolored by region); the joints have to be designed to hide (a cap centered on
  each pivot, sleeves and trouser legs over the next part), which a mesh cut at the bones doesn't
  give without its own fills; the sculpt costs no download, keeps the page small and has no license
  to track. I also checked (b): this container can't reach MakeHuman's pages or GitHub (the proxy
  answers 403/404), so its license couldn't be checked on the live page as the rules require.
- **Modules.** `character.js` (the API and the build), `character-rig.js` (sizes, joints, rotation
  math, `solve()`), `character-body.js` (the sculpt), `character-motion.js` (the gait). The public
  API is unchanged; `pose()` adds `hips` (a sideways sway) and `feet`; `CHARACTER_SPLATS` is new.
- **world.js** (two marked, additive changes in the character block): `buildCharacter()` takes the
  count from `CHARACTER_SPLATS[tier]`, and `placeCharacter()` applies `pose().hips` as the hips'
  sideways shift.
- **Budget measured** (`buildCharacter` at each tier, the Test island's seed): low 37,942 of 40,000;
  mid 60,682 of 64,000; high 85,337 of 90,000; max 113,784 of 120,000. The Worlds lane's budget test
  still passes on every tier. The old character was 60,000 times the tier's prop factor (about
  54,000 on mid).
- **Build time.** About 1 s in Node on this container (the head's distance field is sampled once on
  a grid; the first version took 15 s).
- **Lessons** (for PACKS.md, see below): hidden surfaces of another color show through a dark
  surface as speckle; rings of a loft must go one way along its axis (a ring that doubles back makes
  loops that speckle); fine ribbing or folds shorter than about two splats speckle, so keep folds
  broad.
- Tools: `tools/chr-view.mjs` (stills from named views, or a strip through a stride),
  `tools/chr-clip.mjs` (the review clips), `tools/chr-page.mjs` (the page both load).

## Known issues

- The hair is a smooth sculpted shape with strand shading, not loose strands; at a close-up it reads
  as a neat short cut, a little helmet-like at the back.
- Baked light turns with a part (an arm swung forward keeps its light), as for every kit toy.
- The fingers curl as one group (the brief's minimum); the thumb doesn't move.

## For the Operator

- PACKS.md lessons (section 7c): "Hidden surfaces of another color inside a solid show through as
  speckle: leave them out (return null) or give them the outer color. Loft rings must go one way
  along the axis. Folds and ribs finer than two splat widths speckle."
- No change needed in `tiers.js`: the character's counts live in `character.js`
  (`CHARACTER_SPLATS`).
