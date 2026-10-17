# Codex task 99b: Photo to 3D, Layered fill with Classic's hard edges (a Goal run, up to 8 hours)

**Branch:** `codex/photo-3d-hard-edge`, cut from `main`. One draft PR against `main`. Clips,
pictures, and raw evidence go on `codex/photo-3d-hard-edge-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md's "Effect quality rules", `docs/studio/photo-3d-checkpoint.md`, and
task 99's record, `docs/audits/photo-3d-next-2026-10.md` (merged in #690).

## Why

Task 99 built a sound yardstick (true views of the 12 truth scenes, rendered with 16 samples and
denoised) and two Layered variants. Neither met the truth or boundary gates, but Layered A cut the
ribbons (the stretched streaks behind objects) by about 80% on 20 phone inputs.

The owner then voted blind on 20 pairs, Classic against Layered A (October 17, 2026): Layered A won
9, Classic won 5, and 6 were ties.

| Kind of pair   | Layered A | Classic | Tie |
| -------------- | --------: | ------: | --: |
| Ribbons (10)   |         5 |       1 |   4 |
| Edges (5)      |         1 |       2 |   2 |
| Thin parts (5) |         3 |       2 |   0 |

So A's fill is what he prefers, and its soft edge band is what loses: the truth scores said the same
(A's band raised boundary error by 1.68% and lost thin probes). This round keeps A's fill and gives
it Classic's hard cut at depth edges.

## Before you start

Classic stays frozen. Run `tests/p3d-golden.spec.mjs` first and keep it passing; never edit the
classic files or re-pin. Everything new goes in `src/photo3d/next/`, beside task 99's code.

## The variant: Layered H

- Layered A's PatchMatch background fill, its foreground masking, and its passes and patch radius
  (`--passes=3 --radius=2`).
- Classic's hard cut at depth edges: no soft band (`--band=0`), so foreground pixels keep Classic's
  exact coverage and color.
- If a hard cut leaves a one-pixel seam or halo against the fill, fix that at the seam (dilate the
  fill under the cut, or unmix one pixel), and say which you chose and why.

## Measure it (the task 99 yardstick, unchanged)

1. Truth views: median masked-SSIM error, boundary MAE in the two-pixel band, edge F1, and every
   thin probe, against Classic and Layered A.
2. Ribbons: the full 118-input atlas gate this time, not the 20-input scout.
3. Cost: time and memory on the phone profile, five fresh-browser trials.

## Gates

1. Boundaries: boundary MAE no worse than Classic's by more than 1%, and no thin probe lost that
   Classic keeps.
2. Ribbons: at least 60% fewer ribbon streaks than Classic on the 118-input atlas, with no input
   more than 5% worse.
3. Truth: median error no worse than Classic's.
4. Cost: at most 25% more time and at most 150 MiB more memory than Classic on the phone profile.
5. The owner's blind vote: 20 new pairs, Layered H against Classic, on the same 20 inputs as task
   99's vote. They are 72-frame camera arcs at 12 fps, 390×844, positions balanced, and identities
   hidden. The key goes in `raw/operator-key.json.gz` on the clips branch. The Operator hosts the
   vote. H passes if it wins at least twice as many pairs as Classic and Classic wins at most 3.
6. Classic is byte-identical (the golden test), and every existing spec passes.

## If it passes

Add Layered H to Photo to 3D as a labs option, Fill: Classic or Layered. Classic stays the default
until the owner chooses. Old links and saved scenes open exactly as before.

**Done** means the labs option merged with its report, or a clean negative result naming the top
three blockers you actually hit and what would remove them.

## Stay out of the way of open work

Don't touch Moving photo to 3D or Video to 3D (lane MP1 is working there), the recorder, or the
shared lists outside Photo to 3D's own entries.

## Hand back

`node tools/preflight.mjs`. Post progress notes on the PR at 4 hours. PR body: Summary,
Verification, Deviations, Known issues, What was cut. Put the 20 blind pairs on the clips branch
with a `review/photo-3d-hard-edge/index.html` like task 99's. Credit lines read "Codex (GPT-6)".
