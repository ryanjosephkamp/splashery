# Lane Fidelity: trained splats on our rigs (prefix `fid`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fidelity, "Trained splats on our rigs" (prefix `fid`).
Branches: `claude/lane-fidelity` (and `claude/lane-fidelity-engine` if the engine needs a change).
PR title: "Phase Fidelity: trained splats on our rigs". Handoff file: docs/handoff/Fidelity.md.
Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's "go" that day)

The owner compared our toys with the scenes on superspl.at and found ours look like cartoons beside
them. The reason: most of our toys are _placed_ (a recipe scatters splats on simple shapes and
colors them by rule), while those scenes are _trained_ (an optimizer fits splats to hundreds of
path-traced or photographed views, so light, shadow, texture and shine are baked in). Same renderer
(PlayCanvas), same phones. The owner approved the Operator's plan, the "Splat Fidelity Plan", on
October 3, 2026:

- **Stage 1, the boombox two ways.** Our boombox toy comes from the CC0 Poly Haven model `boombox`
  (`tools/models.json`), sampled into splats with painted-on light. Codex task 08
  (`docs/codex/08-fidelity-stage1.md`) runs on the owner's Mac (Apple Silicon; an M5 Pro with 64 GB
  or an M3 Pro): Blender renders the same model from about 200 angles with exact cameras, Brush (or
  msplat) trains a splat from those renders, and splat-transform compresses it. Codex pushes the
  trained files, its scripts and a report to `codex/fidelity-stage1`. Same source, two methods, so
  any difference comes from the method.
- **Stage 2, a hero object trained part by part.** A brass orrery: polished brass arms and gears,
  planets of stone and enamel around a glowing sun. A tap sets it turning with a soft ticking. Every
  moving piece turns on an axis as a solid part. Built in Blender from scratch (ours, CC0), each
  part rendered on its own and trained on its own, then put on a kit rig so taps, sound and physics
  work as on any toy. This is what SuperSplat can't do: its splats never move, only its camera.
- **What we measure**: the match against held-out renders (PSNR and SSIM), splats, megabytes and
  frame rate on a phone, a clip beside a SuperSplat object of the same kind, the owner's mark, and a
  log of which parts of Splashery's own work helped (recipes, part names and rigs, the effect rules,
  clip tools, phone budgets, compression) and what each did. Report honestly if nothing of ours
  helped.
- No new Sharpness rounds start until Stage 1 reports (the owner's call of October 3, 2026).

#### What to deliver

1. **Read Codex's Stage 1 work** when it lands on `codex/fidelity-stage1` (fetch with
   `git fetch origin '+refs/heads/*:refs/remotes/origin/*'`; never push to a `codex/` branch). Check
   its numbers. Until it lands, do steps 2 and 3.
2. **The Splashery side.** A labs toy, "Boombox, trained", on the Photoreal shelf, that loads the
   trained SOG (full and lite by device tier, like the other captures) and keeps the boombox's tap
   effect working. Then the general piece: a recipe can load **several trained files as named
   parts** and hand them to the kit's rig, so each part moves as a solid piece. Read how
   `src/packs/real-objects.js` (`addScan`), `src/rigs.js` and `src/kit.js` handle scans and parts
   first. If loading parts needs an engine change, make it a small additive "Engine: …" PR on
   `claude/lane-fidelity-engine`, merged first. Check whether our loaders and the SOG path keep the
   spherical-harmonic bands (the shine that changes as you turn) and whether the streamed levels of
   detail in PlayCanvas 2.22.3 can be used; say what you find.
3. **Stage 2 scripts.** In `tools/fidelity/`: a Blender Python script that builds the orrery from
   scratch (procedural geometry; CC0 materials and an HDRI from Poly Haven, each license checked on
   its live page), a camera rig that renders each part on its own and the whole object together
   (NeRF-synthetic `transforms_train.json` and `transforms_test.json`, RGBA PNGs, held-out test
   views), and a runner the owner's Mac can use. Blender can run here on the CPU at low resolution
   to test the scripts (`blender -b --python ...`); the real renders and the training run on the Mac
   through Codex task 10, which the Operator writes from your scripts. Put the steps a Mac needs in
   `tools/fidelity/README.md`.
4. **The orrery toy** once task 10's trained parts land: a labs toy on the Science shelf with its
   tap (the planets turn on their arms, each at its own speed), its sound, its how-to and About
   texts, credits, clips at phone size, and a card on the Effect review page.
5. **The report** in `docs/audits/fidelity-2026-10.md`: Stage 1 and Stage 2 numbers, clips, what
   helped and what didn't, and what you'd do next (more toys this way, SH bands, streaming).

#### You own

- `tools/fidelity/`, `src/packs/fidelity.js` (new), `assets/toys/<your toys>/`, your toys' entries
  in the shared lists (`src/toys.js`, `src/toy-sounds.js`, `src/toy-help.js`, `tools/toy-plan.json`,
  credits), `tests/fid*.spec.mjs`, `docs/audits/fidelity-2026-10.md` and this handoff file. Engine
  changes only through the engine PR.
- Blender, Brush and other programs that run outside npm are build tools, not shipped: list each
  with its version, license and where it came from in `LICENSES.md` under a heading for build tools
  outside npm. Their output (our renders and splats) is ours; the boombox stays credited to its Poly
  Haven author.

Many lanes run at the same time (Books r5, Photoreal r2, Sharpness A and B, Physics, Live input,
Fluids, UI r5, Fix7 and the Integrators); you don't touch their files.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model. Use at most
  one helper at a time.
- Merging: everything in this lane is behind the labs switch, so the Operator merges it after a full
  test run. Never merge anything yourself.
- Language: every new text is in American English (color, center, gray, license, toward, -ize
  endings, dates like "October 3, 2026").
- Read first: CLAUDE.md, docs/OPERATING.md ("Steps for a lane"), docs/PACKS.md ("Effect quality"),
  `tools/models.json`, `tools/mesh-to-splats.mjs` and `tools/model-to-splats.mjs`.
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State"
  current.
- Before every push: CLAUDE.md, "Before every push".

## State

October 3, 2026 (Opus 5.5): started. Codex task 08 has not pushed `codex/fidelity-stage1` yet, so
the lane does steps 2 and 3 first: the parts loader (`src/packs/fidelity.js`), the "Boombox,
trained" toy wiring (waits on Codex's SOG files), and the Stage 2 orrery scripts in
`tools/fidelity/` (tested here with Blender 4.5 LTS on the CPU at low resolution).
