# Lane Photoreal r2: more photoreal toys (prefix `pr2`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photoreal r2, "More photoreal toys" (prefix `pr2`). Branch:
`claude/lane-photoreal-r2`. PR title: "Phase Photoreal r2: more photoreal toys". Handoff file:
docs/handoff/PhotorealR2.md. Model: Sonnet 5.5 (converters).

### Brief (written by the Operator on October 3, 2026, from the owner's answers that day)

The owner rates the photoreal captures (the berries, the grape, the bee, the millipede) as the best
things on the site, on a level with superspl.at. He approved a second round on October 3, 2026, and
on the same day allowed NonCommercial assets on four conditions (CLAUDE.md, ground rules):

- CC BY-NC and CC BY-NC-SA are allowed per asset, with the license notice beside it;
- never a NoDerivatives ("ND") license, because thinning a capture for phones changes it;
- every NC asset carries `"nc": true` in `tools/assets.json`, so one command lists every NC asset to
  take out if the site ever earns money;
- anything made from it keeps its license, and an NC asset is never merged with a BY-SA asset into
  one asset.

Still never unlicensed, "personal use" or paid files.

The first Photoreal lane's research is in `docs/research/PHOTOREAL.md` (sources, licenses, and how
to fetch SuperSplat scenes). In that search SuperSplat had 546 downloadable CC BY scenes; the site
uses 12. The private comparison page (https://claude.ai/artifact/9cT8ieg8etXXRbXECeoPcK) shows 14
candidates.

#### What to deliver

1. **Pick the best 30 to 50 objects** (not whole environments): ones that look superb, read at phone
   size, and either match a toy we have (a photoreal version beside the kit one) or add something
   new and fun. Start from PHOTOREAL.md and SuperSplat's search; CC BY first, then CC BY-SA, then
   NC. Check each license on its live page and say so in your notes. Nothing of people, logos or
   brands, firearms or gore; no captures made from someone else's video without the owner's OK
   (PHOTOREAL.md lists three); anatomy items go to the owner first. Ask the Operator before you
   pass 50.
2. **Size them for phones** like the existing captures: a full SOG and a lite SOG per toy (look at
   how `boombox.sog` and `boombox-lite.sog` and the twelve CC BY scans were made, in
   `tools/prepare-assets.mjs` and `tools/assets.json`), cleaned of floaters, centered, upright and
   scaled. Keep the spherical-harmonic bands on the full file where they make a visible difference
   (shiny things) and the size allows; say what you kept. Keep the embedded-toy test ("embed
   transfer ≤ 30 MB") green.
3. **Toys** on the Photoreal shelf, **behind the labs switch** until the owner marks them good: each
   with a name, a credit (author, license, link) in the app, CREDITS.md and `tools/assets.json`, a
   how-to line and an About text, a sound, and a tap effect only where the capture can move a part
   cleanly (the effect rules: never bend a scan; a gentle turntable and a light sparkle are fine
   otherwise). Thumbnails with `tools/make-thumbs.mjs`.
4. **`tools/nc-assets.mjs`**: lists every asset with `"nc": true` (id, title, author, license,
   files, the toys that use it); with `--check`, exits non-zero if an asset whose license contains
   "NC" lacks the tag or an "ND" license appears anywhere. Add a test that runs the check.
5. Cards on the Effect review page (a still or a short turn per toy) so the owner can mark them.

#### You own

- `src/packs/photoreal-r2.js` (new), `assets/toys/<your toys>/`, your entries in
  `tools/assets.json`, CREDITS.md, the shared lists (`src/toys.js`, `src/toy-sounds.js`,
  `src/toy-help.js`, `tools/toy-plan.json`), `tools/nc-assets.mjs`, `tests/pr2.spec.mjs`, your
  screenshots and this handoff file.

Many lanes run at the same time (Fidelity, Books r5, Sharpness A and B, Physics, Live input, Fluids,
UI r5, Fix7 and the Integrators); you don't touch their files.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Sonnet 5.5 only, at the default effort (converters are Sonnet's, the owner's split of
  September 29, 2026). Any helper you start uses the same model. Use at most one helper at a time.
- Merging: the new toys are behind the labs switch, so the Operator merges them after a full test
  run; the owner decides when they go public. Never merge anything yourself.
- Language: every new text is in American English (color, center, gray, license, toward, -ize
  endings, dates like "October 3, 2026").
- Read first: CLAUDE.md, docs/OPERATING.md ("Steps for a lane"), docs/research/PHOTOREAL.md,
  docs/handoff/Photoreal.md and CREDITS.md.
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State

Model: Sonnet 5.5, default effort, no helper. Updated October 3, 2026.

### Done

- **30 toys** on the Photoreal shelf, all behind the labs switch (`labs: true`), in
  `src/packs/photoreal-r2.js` (metadata only; spread into `src/toys.js`). Each has a full and a lite
  SOG (`tools/pr2-prepare.mjs`, entries with `"pack": "pr2"` in `tools/assets.json`), a thumbnail, a
  credit (author, license, link) in the app, in CREDITS.md and in `tools/assets.json`, a how-to line
  and About text (`src/toy-help.js`), a sound (`src/toy-sounds.js`) and a plan entry
  (`tools/toy-plan.json`, `docs/TOY-PLAN.md` regenerated).
- **Licenses**: each read from the scene's live page on October 3, 2026 (`rel="license"` link). 27
  are CC BY 4.0. Three are NonCommercial and tagged `"nc": true`: dog plush (CC BY-NC), desk globe
  (CC BY-NC), cherry blossom (CC BY-NC-SA, also ShareAlike; never merged with another asset). No ND,
  no BY-SA.
- **`tools/nc-assets.mjs`** (list, `--json`, `--check`) and `tests/pr2.spec.mjs` (runs the check,
  and checks files, credits, help, sounds, thumbnails).
- Effect review cards: see the PR body.

### How the toys were picked

From the 77 scenes in docs/research/PHOTOREAL.md plus a few more found by search, every one rendered
from four sides first. Left out: scenes with no license on their page (lemon, jug, cake, mug and
others: all rights reserved, so private only), scenes that show a brand or a game character (the
Bedford trucks, a purple plush from a horror game, Vespa, KTM, VW, Eicher, Ferguson), whole places
and rooms (landmarks, terrain), anything with people, anatomy and skulls (they go to the owner
first), and ones that rendered badly (acorn, helicopter, owl on its wall, the stone, the penguin and
frogs). Three scenes made from someone else's video were not touched.

### Sizing

Like the first twelve scans, but denser: rotated upright, recentred, scaled to radius 0.9, decimated
to at most 1,000,000 splats on the full file and 300,000 on the lite file (sources with fewer keep
every splat), written as SOG with one band of spherical harmonics on the full file when the source
has any (28 of 30; the alum crystal and the monkey doll have none). The first round used 350,000 and
100,000 with no harmonics. The full files are 0.2 to 15 MB, the lite files 0.1 to 4 MB, and
`assets/` grew by about 140 MB. The lite file is used only on the low profile (`src/player.js`), so
the full file is what mid-tier phones load.

### Sharpness round (October 3, 2026)

- **Why the stollen was crisper:** its source has 308,000 splats, under the first round's 350,000
  cap, so it was the one capture kept whole (alongside others whose sources were small), and its
  source is itself sharp. The rest were cut from 450,000 up to 3 million splats down to 350,000,
  with the harmonics dropped.
- **What changed:** the caps above, harmonics kept on the full files, nothing else (the same
  rotation, scale and crop, so framing is unchanged).
- **Result, same framing, same viewer** (old file, new file and the source scene's own splats, all
  rendered by the app; `tools/splat-views.mjs` style): the new files are close to their sources.
  Visible gains where the source has fine detail: the cave lioness (whiskers and fur), the cactus
  (spines), the BMX bicycle (spokes and lettering), the murex shell (spines) and the bonsai (twigs).
  For most of the rest the first round was already near its source, so little changes.
- **Still soft, because the sources are:** the crystal and the elephant (blurry captures), the desk
  globe's printed map, the money tree's and maple's leaves, the white roses and the dog plush's
  edges. What is left is the viewer's own softness, which is not this lane's file.

### Known issues

- A tap only hops them: no capture here has a part that can move cleanly (effect rules), so there is
  no tap effect.
- A few frame small (sushi boat, cherry blossom trees, murex shell) because they are scaled by their
  longest side; the elephant faces away at the default camera.
- `tests/help.spec.mjs` "the line stays clear of the toy at 1440x900" failed once while clips were
  rendering in parallel (a timing flake; it does not touch these toys, and it passes alone).
- Full files up to 15 MB and 1,000,000 splats are heavier for mid-tier phones, which load the full
  file (only the low profile loads the lite one); `assets/` is about 140 MB larger. If phones
  struggle, the fix is a mid file between the two.
- SuperSplat scenes marked "streamed (LOD)" need `splat-transform -L 0 .../lod-meta.json`
  (`"lod": 0` on the entry); the research doc said they could not be used.

### Lessons

- `tools/splat-views.mjs` names its work files after the input's file name, so inputs that are all
  called `meta.json` overwrite each other when run in parallel: copy each to its own `.ply` first.
- A SuperSplat page with no `rel="license"` link has no license stated.
