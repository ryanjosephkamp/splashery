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
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State"
  current.
- Before every push: CLAUDE.md, "Before every push".

## State

Starting, October 3, 2026.
