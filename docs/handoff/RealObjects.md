# Lane Real objects: everyday things, for real

Prefix `ro`. Branch `claude/lane-real-objects`. PR title "Phase Real objects: everyday things, for
real". Built by Opus 5.5.

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Real objects, "Everyday things, for real" (prefix `ro`).
Branch: claude/lane-real-objects. PR title: "Phase Real objects: everyday things, for real". Handoff
file: docs/handoff/RealObjects.md.

### Brief (written by the Operator on September 29, 2026, from the owner's approved ideas on the Toy Ideas page and the "Real objects" lane in ROADMAP.md)

The owner approved these everyday objects on the Toy Ideas page
(https://claude.ai/artifact/5TukiuV3mCt3G3zk6Arx9S; read collection `ideas` and `marks` with
ArtifactData for the full text, and never write to them). His note on each of them, word for word:
"This should be a real life splat if you can find it. I do not want this to be a cartoon or an
illustration. If we cannot find a suitable real life splat for this object, only then can you make
it a cartoon."

The toys, with his approved taps (the ideas' ids are the toy ids):

1. **Fountain pen** (`fountain-pen`, Objects): "The cap (cut out of the scan as a solid piece)
   slides off and clicks onto the end, and the nib writes a swirl in wet blue ink that glistens,
   then dries darker; the cap goes back on (4 s)."
2. **Water bottle** (`water-bottle`, Objects): "Its cap (cut out of the scan as a solid piece) spins
   off in two turns and hops up. The bottle tips and water glugs out as a stream of drops into a
   glass beside it; then it all runs back and the cap screws on (4.5 s)."
3. **Soda can** (`soda-can`, Objects): "It shakes in place, then the ring pull (a kit-built piece
   matched to the scan) levers up with a crack, and a jet of foam and bubbles sprays up and spatters
   down around it; the tab folds back and the foam fades (3.5 s)." A plain label, no brand.
4. **Running shoe** (`running-shoe`, Clothing): "Its laces (kit-built jointed cords over the scan's
   own laces) come undone, cross back through the eyelets and tie themselves into a bow, and the
   shoe taps its toe twice (4 s)." No logos.
5. **Hoodie** (`hoodie`, Clothing): "The hood (cut out of the scan as a solid piece) flips up and
   its drawstrings swing, then the sleeves (cut at the shoulders) swing in and cross, and it all
   settles back (4.5 s)." No logos.
6. **Sunglasses** (`sunglasses`, Clothing): "The arms fold in on their hinges one after the other,
   the glasses flip to face you and the lenses darken from clear to deep grey like light-changing
   lenses; then they unfold (3.5 s)."
7. **Baseball cap** (`baseball-cap`, Clothing): "It flips up off its stand, spins flat like a flying
   disc and lands brim-backwards; then a second flip turns it round the right way (3 s)." No logos.

Sounds are on each idea (read them there); add each toy's entry in src/toy-sounds.js.

Where the real objects come from, in this order:

1. **CC0 3D models made from photos** (Poly Haven's models are CC0 and photo-based; for example
   `round_spectacles` for the sunglasses, and look for a bottle, a can, a cap or a shoe), converted
   with `tools/model-to-splats.mjs` (docs/PACKS.md, section 9). Check each license on the live page.
2. **Lane G's image-to-3D tool** (`tools/image-to-3d.mjs`, the TRELLIS Space through `HF_TOKEN`;
   docs/handoff/G.md) on CC0 or public-domain photos (Wikimedia Commons, checked on the live page;
   no brand, no person, no watermark). The free GPU quota allows about four runs at a time: plan
   your runs, and stop and say so if anything would cost money.
3. **Kit-built**, only when neither gives a clean, real-looking object; say which and why under "For
   the Operator".

`HF_TOKEN` is a Hugging Face read token for build-time tools only. Never print it, commit it, or put
it in logs, PRs or files. To check it, test that it is set (`[ -n "$HF_TOKEN" ]`), or call the
whoami API and print only the account name and token role.

The effect rules bind hard here: parts move as solid pieces cut from the scan with hard edges or
swapped for kit-built parts; never bend a scan with soft regions. Fidelity A's method (even
placement, full opacity, full density, clean colors) is the bar for anything kit-built. Paint out
any maker's mark. Record every source in CREDITS.md, tools/models.json or tools/assets.json, and the
toy's in-app credit.

If time runs short, build in the order above and cut from the end; say what was cut.

Clips and cards (390×844), each labeled "built by Opus 5.5", in the lane record `RealObjects` on the
Effect review page (the Operator made it): `ro-<toy-id>` for each toy (the tap, close enough to read
the motion) and `ro-stills` (a sharp still of each). These are new public toys: the owner's "good"
marks decide the merge.

Tests in tests/ro.spec.mjs: each toy builds within its tier budget, each tap moves its parts as
solid pieces (no part changes shape), and screenshots at 390×844 and 1440×900. Each toy gets a
how-to line and an About text in src/toy-help.js, a toy-plan entry and a thumbnail.

### You own

- a new pack `src/packs/real-objects.js`, `assets/toys/<id>/` for your toys, your entries in the
  shared lists (src/toys.js, src/toy-sounds.js, src/toy-help.js, tools/toy-plan.json,
  tools/models.json, tools/assets.json, CREDITS.md), tests/ro.spec.mjs, your `ro-*` screenshots and
  docs/handoff/RealObjects.md. Use the existing tools (`tools/model-to-splats.mjs`,
  `tools/image-to-3d.mjs`) without changing them; if one needs a change, say so.

Lanes Worlds, Fidelity B, the toy piano (maker B), Anatomy, Pianos, Sharpness, Books, Chemistry,
Photo to 3D and the Integrator run at the same time; leave their files alone. The laptop is locked.

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

Model: Opus 5.5 (default effort).

Started September 29, 2026. Choosing the source models; nothing built yet.

## Notes

## Known issues

## For the Operator
