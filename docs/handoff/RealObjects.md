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
  "## State

Model: Opus 5.5 (default effort), for the whole lane.

September 29, 2026: all seven toys are built, in `src/packs/real-objects.js`, from real models baked
by a new lane tool (`tools/ro-bake.mjs`, sources and cuts in `tools/ro-sources.mjs`). Draft PR #97.

| Toy          | Source (license checked on the live page)                           | Kind of model                       | Moving pieces                                                                          |
| ------------ | ------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Fountain pen | Sketchfab "Pelikan M205 … Translucent Green", chemicalX (CC BY 4.0) | detailed photoreal model            | cap (its own pieces, moved onto the nib), pen; kit notepad and ink                     |
| Water bottle | Sketchfab "Water bottle", danny_p3d (CC BY 4.0)                     | detailed photoreal model            | cap (its own pieces, moved onto the neck), bottle; kit glass, water and 40 drops       |
| Soda can     | Sketchfab "Soda Can", RoutineStudio (CC BY 4.0)                     | detailed model, label painted by us | its own ring pull (cut as a solid piece), can; kit coaster, opening and 48 foam clumps |
| Running shoe | Sketchfab "PB158 Sneaker Low", SCANIMAT (CC BY 4.0)                 | photogrammetry scan                 | shoe (toe taps); its bow left out, two kit laces of 22 joints each                     |
| Hoodie       | Sketchfab "Hoodie", Virtual Pandora (CC BY 4.0)                     | detailed garment model              | hood (its own panels), sleeves (hard plane at the shoulder); kit drawstrings           |
| Sunglasses   | Poly Haven `round_spectacles`, Sean Buckley (CC0)                   | photoreal model                     | front, two arms (its own pieces); kit lenses that darken                               |
| Baseball cap | Sketchfab "Baseball Cap", Scott VanArsdale (CC BY 4.0)              | detailed photoreal model            | the whole cap; kit walnut stand                                                        |

## Notes

- Sources: Poly Haven had only the spectacles among these objects, and lane G's image-to-3D had
  already failed on a fountain pen and found no usable photos of a can, a shoe or a hoodie
  (docs/handoff/G.md). The Toy Ideas page names Sketchfab CC BY models as a source, so the rest come
  from Sketchfab, downloaded through Allen AI's Objaverse mirror on Hugging Face (Sketchfab's own
  downloads need an account). Each license was read from Sketchfab's API for the model on September
  29, 2026. The shoe is the only true photo scan; the others are photoreal models with photo-like
  textures, not cartoons. No image-to-3D runs were used (no GPU quota spent).
- Why a new tool rather than `tools/model-to-splats.mjs`: a toy with moving parts needs each splat
  tagged with its piece, and a kit recipe that loads it. `tools/ro-bake.mjs` uses the same converter
  (`sampleSurface` in `src/packs/studio-models-core.js`), then cuts parts by the mesh's own separate
  pieces (islands), its texture charts (a garment's panels come apart along their seams) or a hard
  plane, and writes a compact `.splats` file (14 bytes a splat, about 1.2 to 2.1 MB a toy, in a
  shuffled order so any first m splats are an even sample for the lower tiers). A painted color
  keeps the model's baked light (the tool samples twice, lit and flat, and uses the ratio).
- Every model piece is a kit part: turned and moved, never scaled or bent. Parts turned past a
  quarter turn are sorted again where they stand (`out.resortPose`, every 0.04 to 0.1 s while they
  move); tokens (drops, foam, lace joints) set `out.resort`.
- The pen's ink: a wet layer fades in behind the nib on channel 0 and a darker dry layer on channel
  1; to end at rest, both run back into the nib after the cap is on.
- The hoodie's sleeves are cut at the shoulder by a plane across the raglan sleeve panels, so the
  shoulder stays whole and only the sleeve's end opens.

## Known issues

- The fountain pen and the water bottle are CG models of real products, not photo scans; the pen's
  model is of a branded pen, with its marks painted out.
- The fountain pen at rest sits low in its frame: the frame holds the writing pose (the pen tilted
  up with its cap posted).
- The hoodie's cut shoulders show a ragged edge while the sleeves are crossed, and the sleeves pass
  a little into the chest (rigid sleeves cannot bend at the elbow).
- The running shoe is dark; its laces read best on a light background.
- The owner's word "grey" is kept in the brief above, as it is quoted word for word.

## For the Operator

- New tool files: `tools/ro-bake.mjs` and `tools/ro-sources.mjs` (the lane's own build tool; no new
  devDependency). The sources are recorded there and in CREDITS.md, not in `tools/models.json` or
  `tools/assets.json`: those feed `tools/mesh-to-splats.mjs` and `tools/prepare-assets.mjs`, which
  these kit toys don't use.
- New shelf: the brief puts four toys on a Clothing shelf, which didn't exist, so the lane added
  `{ id: "clothing", label: "Clothing" }` to `CATEGORIES` in `src/toys.js` (after "Open me").
- Kit-built pieces the brief asked to be cut from the scan and vice versa: the soda can's ring pull
  is the model's own (cut as a solid piece) rather than kit-built, since the model has one.
- PACKS.md lesson: a garment exported from a cloth tool keeps its panels as separate texture charts,
  so parts can be cut along its real seams (connectivity without welding by position).
