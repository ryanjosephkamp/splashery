# Lane Fidelity B: the rest of the grainy toys made sharp

Prefix `fb`. Branch `claude/lane-fidelity-b`. PR title "Phase Fidelity B: the rest of the grainy
toys made sharp". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fidelity B, "The rest of the grainy toys made sharp" (prefix
`fb`). Branch: claude/lane-fidelity-b. PR title: "Phase Fidelity B: the rest of the grainy toys made
sharp". Handoff file: docs/handoff/FidelityB.md.

### Brief (written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas", his answers on the Splashery Universe page, and his marks on lane Fidelity A)

The owner's words: "I almost want to make things so incredible with this that people won't even
realize that they're looking at Gaussian splats … some of the stuff, just, like, the resolution
isn't great. It just looks grainy." His answer: "two fidelity lanes (Fidelity A audits every toy at
phone size and fixes the worst …; Fidelity B fixes the rest of its list)."

Lane Fidelity A (PR #77, claude/lane-fidelity-a) audited every toy and fixed 24. The owner marked 23
of its before-and-after cards "good" on September 29 (the Klein bottle is being redone there). So
its method is approved. Read its handoff first (docs/handoff/FidelityA.md on that branch): the
ranked "## Audit" list, the five causes of grain (random placement → `even: true`, low density,
mirror chrome on thin parts, see-through `rim()` shells, faint clouds), and its notes.

Start by merging `origin/claude/lane-fidelity-a` into your branch (a merge commit), so you build on
its fixes; #77 merges into main soon, and then your PR shows only your own changes. Merge main again
when it moves.

Then fix the toys on the audit list that Fidelity A didn't: every toy graded 3, 4 or 5 that isn't
marked "Fixed in this lane", in list order (about 55 toys: the white blood cell, the ocean liner,
the marble, the butterfly, the soap bubbles and so on), then the grade-2 toys where a fix is clearly
better and doesn't change a look that's there by design (glows, fur, sparks, glass).

- Use the same tools as Fidelity A: even placement, full opacity for solids, the tier's full
  density, flat splats on flat surfaces and thin ones along edges, softly lit metal instead of
  mirror chrome on thin parts, solid shells instead of faint rims, and clean colors from functions
  with low noise.
- A fix must not change what the toy is or how its tap moves. The owner approved those effects.
- Keep each toy within its tier's splat budget and its load time.
- Scans: only what their recipe allows; list any that need a better capture.
- Skip the toys other open lanes own: the picture, screen, splatting, splat-equation, studio and lab
  toys.
- If a fix truly needs an engine change (Fidelity A suggested a lower `minPixelSize` for kit toys),
  don't make it; describe it in "For the Operator". Lane Lab owns kernels and culling experiments.

Clips and cards: one before-and-after card per changed toy at 390×844, grouped by shelf, ids
`fb-<toy-id>`. Include a still pair of the rest view, plus the tap clip where the tap's look
changed. These toys are public, so the owner's "good" marks decide the merge. Keep unrelated changes
out of the same toy's card. Label the lane and cards "built by Opus 5.5".

### You own

- the toy packs of the toys you change (src/packs/\*.js, only those toys' recipes), their
  assets/toys/<id>/ thumbnails, and their entries in the shared lists if any change;
- tests/fb.spec.mjs, your `fb-*` screenshots and docs/handoff/FidelityB.md.

Keep sounds as they are: two sound lanes may edit src/toy-sounds.js. Lanes Books, Worlds, Fidelity
A, Learn, Lab, Studio Models and the Integrator run at the same time; leave their files alone. The
laptop is locked.

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

- September 29, 2026: merged Fidelity A's branch, then fixed the 56 kit toys graded 3 to 5 on its
  audit that it hadn't (all but the Mandeltorus scan), plus the medicine ball (grade 2, the same rim
  haze as the squash ball). Every toy's tap is unchanged. New shared helpers in `src/packs/even.js`.
  Lane tests in `tests/fb.spec.mjs`.
- Draft PR #90. The 57 cards are on the Effect review page (`fb-<toy id>`, lane FidelityB, grouped
  by shelf), stills only: no tap's look changed (clips of seven taps were checked against the old
  ones).
- Second batch: 16 grade-2 toys where a fix is clearly better (below), with their own cards.
- Next: the owner's marks (checked about hourly); fix every "fix" as a `-r2` card.

### Toys changed (all kit toys; the fix in a few words)

- Tiny: white blood cell (even membrane, a little more solid; even nucleus), paramecium and amoeba
  (even bodies of larger, fainter splats: smooth jelly instead of speckle), animal cell,
  mitochondrion (its capsule helper takes `even`), diatom.
- Vehicles: ocean liner (even hull, decks, boxes and funnels; a smooth sea), bus and sports car
  (even rounded boxes, cabin and tyres), rocket (even body and fins).
- Balls: marble (even glass with a calmer glint and one soft window highlight instead of white
  speckle; solid vanes), squash ball and medicine ball (a thin, crisp rim shell instead of the gray
  haze).
- Animals: butterfly (even, solid wings), nautilus, ladybug (even shell).
- Playthings: soap bubbles (full density; even films and wand; the highlights as soft, even spots),
  dice and robot (the pack's `roundBox` takes `even`).
- Objects: storybook (even page blocks, slightly larger page splats), umbrella (full density, even
  canopy), music box (even box and lid; the mirror is smooth).
- Computing: word vectors (even, solid floor).
- Space: Saturn (rings as even spirals of splats, a calmer glint).
- Food: candy cane (an even capped tube), avocado, croissant, gummy bear (even body; its highlights
  merge into soft gloss), apple, boiled egg.
- Medieval: bow and target, wizard's orb, knight's helmet (even steel, a calmer glint), shield (even
  painted face), crown.
- Nature: acorns (even nuts, cups and leaf; no core splats poking out of the tips).
- Landmarks: Big Ben, windmill (solid sails), lighthouse (smooth sea), supertall (even glass; 30
  bolder floor lines instead of 44 that broke into dashes), White House, Colosseum, Leaning Tower.
- Elements: rainbow (even bands), geyser (even sinter mound).
- Games: chess set (solid pieces, slightly larger splats).
- Holidays: patterned egg.
- Gems: crystal ball (calmer glint on the glass, even stand), pearl (even valves), emerald and
  sapphire (solid facets of larger splats, calmer glints).
- Math: seashell spiral, platonic solids (the pack's `polyShape` takes `even`).
- Music: xylophone, snare drum (even shell with finer sparkle).
- Anatomy: brain, tooth.

### Grade-2 toys changed (the second batch)

Spinning top, puzzle cube (even bodies), octopus, biplane, helicopter, tractor and submarine (even
rounded boxes and bodies), Statue of Liberty (a smooth sea), birthday cake, watermelon and sushi
(clean plates, rind and board), eye (a clean white), paper lantern (smooth paper), Pythagoras proof
(even polygons), lotus (smooth water), Uranus (even rings). Left as they are, grain by design or no
clear gain: the Lorenz attractor, bicycle, cherry blossom, kelp, palm, rugby ball, Taj Mahal,
Parthenon, pyramids, telescope and the glows, fur, sparks, glass and foliage.

## Notes

- `src/packs/even.js` has even versions of the kit's shapes that `even: true` hatches or ignores:
  `evenBox`, `evenCylinder` (a cylinder or cone frustum with caps true, false, "top" or "bottom"),
  `evenTorus`, `evenDisc`, `evenEllipsoid`, `evenTube` (capped tubes too), `evenRoundBox` (the
  vehicles and landmarks packs' `roundBox`), and `capPoint` (points spread evenly over a spherical
  cap, for highlights). Each gives a `sampleEven(a, b)`, so the kit spreads the splats with a 2D
  sequence, and returns the same fields as the kit's shape (`face`, `side`, `cap`, `radial`, `u`,
  `v`), so color functions work unchanged. Swap `k.box(…)` for `evenBox(…)` and add `even: true`.
- The packs' own shapes: the playthings and objects packs' `roundBox` (objects: `even2d: true`), the
  math pack's `polyShape`, and the tiny pack's `capsuleSurface` now have `sampleEven`. A shape
  without one falls back to a 3D sequence under `even: true` (the lattice Fidelity A saw).
- Water and rings drawn as clouds (`water()` in vehicles and landmarks, `rings()` in space) take
  `even: true`: a sunflower spiral instead of random points, with less color noise.
- Translucent bodies (the amoeba, the paramecium): even placement alone makes a see-through body
  look like a screen. Fewer, larger, fainter splats (`size` 1.8 to 2.4, `opacity` 0.28 to 0.3) read
  as smooth jelly.
- Highlights made of a few splats on a smooth body (the gummy bear, the bubbles) show as dots once
  the body is even; more, larger and fainter splats merge into one soft gloss.
- Tools (not committed; in the scratchpad): `shots.mjs` renders a toy at the phone tier in a
  780×1040 frame (a 390×844 phone's toy area at 2x) on black and on white and measures see-through
  and speckle; `evenify.py` adds `even`/`opacity`/`jitter` to a toy's `k.add` calls and swaps in the
  even shapes; `pair.mjs` makes the before-and-after cards.

## Known issues

- The Mandeltorus is a scan; its fractal detail reads as blue noise at phone size and needs a
  smoother capture (Fidelity A's note stands).
- The brain keeps its twinkling sparks (its design); the crystal ball and wizard's orb keep their
  sparkling mist (by design).

## For the Operator

- No engine change was needed. The two-pixel cull Fidelity A described still limits how dense a toy
  can be before its thumbnail thins out.
- A PACKS.md lesson (for the docs lane): the even shapes in `src/packs/even.js` and the notes above
  (translucent bodies, merged highlights).
