# Codex task 102: crisper toys at phone size, measured (a Goal run, up to 12 hours)

**Start after** lanes PT1 (#686) and PT2 (#685) merge: they rebuild Your name in splats, Shape
morph, and One splat, which this task measures too. The Operator says when.

**Branch:** `codex/crisper-splats`, cut from `main`. One draft PR against `main`. Stills, clips, and
raw scores go on `codex/crisper-splats-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`,
`docs/PACKS.md` (above all `even: true` and the splat budget), and CLAUDE.md's "Effect quality
rules".

## Why

At phone size, many kit toys and the text toys read a little soft: letters and edges blur, and some
surfaces speckle where the far side shows through. The owner noticed it on the October 16 clips.
`even: true` closes the speckle (docs/PACKS.md), but only 40 packs use it. Turning it on everywhere
at once was never done, because it changes every toy and every thumbnail (docs/BACKLOG.md, "Even
splat placement for every kit toy"). This task does that pass with measurements and before/after
stills, and finds the other settings that make toys crisp.

## Part 1: the yardstick (2 hours at most)

A tool, `tools/crisp-score.mjs`, renders every kit toy at 390×844 on the phone profile, at rest and
mid-tap, from two fixed angles, and scores each still:

- **Sharpness:** gradient energy inside the toy's silhouette.
- **Speckle:** isolated dark or bright pixels inside solid surfaces.
- **Edge width:** the 10–90% rise across the silhouette.
- **Frame time:** the steady median.

Report every toy's scores in one JSON on the clips branch. Then rank them.

## Part 2: make them crisper

Start with the text toys: Your name in splats, Shape morph, One splat at its deeper levels, the
Splat equation, and the "Your words" choice in the maths pack. Then the 40 lowest-scoring kit toys.

Per toy, within its recipe only:

- `even: true` on its surfaces;
- its splat size and opacity per detail tier;
- its splat budget split between parts (`weight`);
- for text toys, the resolution the text is rasterized at, and splat size against stroke width.

An engine option that every toy could opt into goes in its own "Engine: …" commit, off by default,
with a test.

## Gates

1. On the text toys and the 40 chosen kit toys, median sharpness improves by at least 20% and edge
   width shrinks by at least 15%. No toy gets worse on either by more than 5%.
2. Speckle is no worse on any toy, and better on the median.
3. Phone-profile frame time is at most 10% slower on any changed toy. First-view time is unchanged
   within 10%.
4. Effects still read the same: the same motion, parts, and colors (CLAUDE.md, "Effect quality
   rules"). Nothing becomes see-through.
5. The owner judges. A before/after still pair at phone size for every changed toy goes on the clips
   branch, with a short clip for the text toys. The Operator puts them on a review page. Changes to
   public toys merge only after his "good" marks, so keep each toy's change in its own commit and
   able to be dropped alone.
6. Thumbnails re-rendered for changed toys (`tools/make-thumbs.mjs`); every existing spec passes;
   old `#s=` links and saved scenes load.

## Rules

Recipe settings in each pack, plus "Engine:" commits for any shared option. No new toys. Never edit
`tests/taps.spec.mjs` or loosen a test. Your tests go in `tests/cdx-crisp.spec.mjs`. Images in the
PR at most 1 MB each; scores JSON on the clips branch only. American English and the serial comma.
Last, merge `main` and run `node tools/preflight.mjs`. Progress notes at 4 and 8 hours. PR body:
Summary, Verification, Deviations, Known issues, and What was cut.
