# Codex task 99: Photo to 3D, a better method beside the classic one (a 12-hour Goal run)

**Branch:** `codex/photo-3d-next`, cut from `main`. One draft PR against `main`. Clips, pictures,
and raw evidence go on `codex/photo-3d-next-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md's "Effect quality rules", `docs/studio/photo-3d-checkpoint.md`,
`docs/audits/photo-3d-failures-2026-10.md` (task 87's atlas), and
`docs/audits/photo-3d-r5-2026-10.md` (round 5's record).

## Why

Rounds 4 and 5 were two 12-hour runs whose pictures came out byte-identical to the checkpoint. The
Operator's reading of round 5, which the owner accepted on October 16, 2026: tuning today's method
has hit diminishing returns, for three reasons.

- **The method.** A hard cut at depth edges causes the boundary color error. Filling hidden areas
  with a copy of the nearest far-side pixel (`backgroundImage()` in `src/photo3d/background.js`)
  causes the ribbons. Fixing one worsens the other.
- **The gate.** Every metric on every input with zero tolerance.
- **The metrics.** The flat-depth cue flags 40.7% of junctions even on true depth.

So the toy we have is frozen as "classic," and this task builds a new method beside it, in labs,
with a better yardstick.

## Part 0: freeze classic (first, small, its own commit)

`tests/p3d-golden.spec.mjs` (new): build the six samples at two budgets and compare SHA-256 hashes
of the reconstruction buffers and two native Sharp frames against pinned values from the commit you
start from. `tools/cdx-p3d4-equivalence.mjs` already computes these. From then on, any change to the
classic path fails loudly, and re-pinning needs the owner's yes. Don't edit the classic files named
in the checkpoint doc.

## Part 1: fix the yardstick (2 hours at most)

Render true target views of the 12 truth scenes (task 56) at the finder's nine poses, with the
existing generator. Keep the outputs out of git. Score novel views against truth: masked SSIM, and
edge accuracy across the true depth boundaries. The old flat-depth and boundary scores stay as
diagnostics, never gates.

## Part 2: depth bake-off (3 hours at most, offline, no app change)

Candidates, each with its license checked on the live model card for code **and** weights:

- DA2-S int8, today's model and the baseline;
- Distill-Any-Depth Small;
- MoGe-2 Small (depth plus normals and the camera's field of view);
- Depth Anything 3 Small and Base;
- DA3 Mono-Large and MoGe-2 Large, as reference rows only (too big for a phone).

Run them on the truth scenes plus depth lab categories C, E, F, and J against their `expect` lines.
Deliver one table: size, license, WASM time, AbsRel, δ1, order error, and boundary accuracy. Only
Apache-2.0, MIT, or BSD models may ship (the owner's rule of October 12, 2026, for better depth
models).

## Part 3: the Goal (the rest of the 12 hours): a Layered labs variant

In `src/photo3d/next/`, behind the labs switch, as a "Classic / Layered" option on Photo to 3D:

1. **A soft boundary band:** 2 to 4 pixels of alpha at depth cuts, with the foreground color cleaned
   of background bleed. This targets the boundary error.
2. **A real background layer:** depth extended behind each cut, and color filled with
   **PatchMatch**, our own code that copies patches from the same photo. Mask the foreground out of
   the fill's context. This targets the ribbons.
3. **The best phone-sized depth model** from Part 2, as a switch.
4. **A "Show filled areas" view** that tints every pixel the fill made, so a person can always see
   what was filled.

**A neural inpainter (MI-GAN, MIT, 28 MB) may be compared offline in Part 2's tools, but it does not
ship.** It would be the first time a Splashery toy paints pixels that weren't in the input, and that
waits for the owner's yes.

Gates, all measurable:

1. **Truth views:** median novel-view error over 12 scenes, 9 poses, and 2 profiles improves by at
   least 10%, and no scene is more than 5% worse.
2. **Ribbons** on the 118 atlas inputs: median streak excess improves by at least 30%; median
   texture loss is no worse; at most 10% of inputs are more than 5% worse, each listed with a still.
3. **Boundaries:** truth-view boundary error improves by at least 15%; thin-line lost probes are no
   worse.
4. **The owner decides blind:** 20 paired phone clips (classic and Layered; the 10 worst ribbons, 5
   boundary cases, and 5 thin parts) go on the clips branch. The Operator puts them on a blind page;
   Layered must win at least 14 of 20.
5. **Cost:** phone-profile median time to the first 3D view at most 25% over classic, and peak
   memory at most 150 MiB over. Software-GL differences under 10% are noise. A page the owner can
   open on his phone records one real-device run.
6. **Classic is byte-identical** (the golden spec), every existing spec passes, and Moving photo and
   the Splat mirror are untouched.

**Done** means the Layered option merged behind labs with its report and the bake-off table, or a
clean negative result naming the top three blockers and what would remove them.

## Limits

- At most 8 candidates in total; drop a line of attack after 2 failed variants.
- The PR to `main`: at most 25 files and 4,000 added lines, with evidence limited to one summary
  JSON of at most 300 KB. Per-pose and rejected-candidate records go compressed on the clips branch
  only.
- The report: at most 300 lines, one table per part.
- Progress notes in the PR body at 4 and 8 hours ("WORKING: …").

## Rules

New files only, plus `src/toys.js` and the shared lists for the option's text. Any shared change
(the relief, the depth engine, the splat shader) goes in its own "Engine:" commit and must leave
Moving photo and the Splat mirror unchanged or better (run their specs). New vendored models are
listed in `LICENSES.md` with their size and loaded only when someone turns a photo into 3D. Images
in the PR at most 1 MB each. American English and the serial comma. Last, merge `main` and run
`node tools/preflight.mjs` (AGENTS.md). PR body with Summary, Verification, Deviations, Known
issues, and What was cut.
