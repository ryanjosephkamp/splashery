# Codex task 78a: One splat, many splats

Built by Codex (GPT-6), October 14, 2026, on `codex/portfolio-a`, from `origin/main` `c044dc9d`.
Part A only. Rule check: none.

The labs-only math toy fits a word (default “Splashery”) or an opened picture to Ryan Kamp's
principal-axis median tree. Each node stores exact raster-pixel mass, mean, and covariance,
including a square pixel's 1/12 variance. The level dial picks 1 through 16,384 Gaussians. Tapping a
node replaces it with its children, which separate over 1.8 seconds. Holding shows its center,
standard deviations, angle, and covariance. The play button replays the last split.

The pack uses existing Kit clouds, absolute scales, quaternions, morphs, options, and drag hooks. No
engine changes, new dependencies, reference renderers, or reference fonts. Text uses the system font
in the browser and the existing bitmap font in Node tools. A bounded word cache avoids fitting again
on each level change. Pictures are resized to a 512-pixel longest side; transparent borders are
cropped, and sparse rasters are enlarged with nearest-neighbor pixels so all dial levels have
nonempty nodes. Picture colors are the nodes' mean pixel colors.

The display uses the reference's 0.3 px² reconstruction filter; stored moments and the readout
remain exact. Alpha below 128 is outside the raster mask. Picture bytes remain local; a reopened
scene without the picture falls back to its saved word. Word, level, and refinements save through
the existing scene options. Existing v2/v3 links passed the regression checks.

## Verification

Commands used `/usr/bin/chromium`, the installed browser, with WebGL2/SwiftShader. The local server
was on port 4174 (`SPLASHERY_PORT=4174` for Playwright).

- `node tools/check-packs.mjs one-splat`: passed; 8,192 nodes, 71 ms in the final check.
- `node tools/check-packs.mjs --count=60000 one-splat`: passed; 8,192 nodes on the low budget.
- `tests/cdx-pfa.spec.mjs`: all eight tests passed. The reference checks cover 256 trees over bars,
  rings, diagonals, dust, islands, lines, grids, and coincident points, up to 50,000 pixels. Every
  node matches brute-force moments; every split conserves mass, mean, and covariance; median
  partitions, full level coverage, worst-residual reporting, eigen round trips, and 1,400 additional
  straight/random divisions are checked (residual below 1e-9).
- Real browser pointer holds and taps passed at 390×844/low and 1440×900/high, including 1 → 2
  nodes, all 16,384 nodes at the finest level, color picture input, local-file fallback, and a
  sparse transparent picture. No page errors in the interaction tests.
- The requested `smoke`, `taps`, `kit`, and `unit` files ran: 141 passed, two failed initially. The
  new sound's long decay was fixed; the complete all-toy sound check then passed. The remaining Kit
  failure is the existing `qr-picture` circular variant at count 8,000. A copy of `origin/main`'s
  source reproduced the same error for `{ shape: "circle" }`: “This code has too much detail for a
  circular picture on this device.” That failure prevents claiming the requested regression set is
  wholly green. No unrelated QR changes were made.
- The embed transfer check passed: 9.2 MB, under 30 MB. Every tap and unit check passed.
- `tools/make-thumbs.mjs one-splat` generated the thumbnail, and the contact sheet was reviewed.
  Screenshots are `tests/screenshots/cdx-pfa-one-splat-390x844.png` and
  `tests/screenshots/cdx-pfa-one-splat-1440x900.png`. Standard screenshots were restored.
- `tools/effect-clip.mjs` generated a phone-size split GIF and eight-frame strip; reviewed as motion
  and as a strip. They are on
  [codex/portfolio-a-clips](https://github.com/ryanjosephkamp/splashery/tree/codex/portfolio-a-clips/docs/audits/portfolio-a-clips),
  a review branch that must never be merged.
- A 30-frame low-profile software capture measured 36.4 ms median and 118.4 ms p95, including GPU
  readback. This is a headless capture measurement, not a physical phone GPU benchmark.

## Limits and scope

Words accept up to 32 characters. An opened picture is an alpha-masked raster approximation, not a
3D reconstruction. Node-tool text uses the existing bitmap fallback; browser text uses the system
font. There are no additional outside assets to license. Code is MIT; the procedural splats and
thumbnail are CC0, credited in the About text, CREDITS.md, and tools/assets.json. Parts B, C, and D
are untouched.

## Operator follow-up, October 14, 2026

The Operator's [review comment](https://github.com/ryanjosephkamp/splashery/pull/616#issuecomment-6163591761)
was addressed on `codex/portfolio-a`:

- Merged `origin/main` at `6c3764ff`, resolving the generated `site/sw.js` conflict with main's
  version before running `node tools/site-build.mjs`.
- Restored `tools/toy-plan.mjs` byte for byte from main, then regenerated `docs/TOY-PLAN.md`
  with `node tools/toy-plan.mjs` and Prettier. No generated output was hand-merged.
- Removed this report from the implementation branch. It remains on `codex/portfolio-a-clips`.

Fresh checks on the merged branch passed: all eight Part A tests, all 83 tests in `taps` and
`unit`, and three focused `kit`/`smoke` checks for v2/v3 scene compatibility, an old share link,
and the embed transfer limit. The full `smoke` and all-toy `kit` files were not repeated for this
scope cleanup; their earlier results and the Picture QR baseline failure are recorded above.
`node tools/check-packs.mjs one-splat` and `npx prettier --check .` passed. The two Part A
screenshots were refreshed by its browser tests.

`node tools/us-english.mjs --diff` reports one inherited generated heading, `Maths`, whose count
changes when Part A is added. The requested restoration retains main's heading; the Operator
reserved the heading decision for a separate change. No new prose introduces that spelling.

## Operator follow-up: short help text, October 14, 2026

Addressed the Operator's [help-text review](https://github.com/ryanjosephkamp/splashery/pull/616#issuecomment-6173339732).
The how-to line is 89 characters and ends with a period. Word/picture input instructions are in
About, which is two paragraphs and 122 words, preserving the concept credit and licenses. The
original 143-character line failed both `help` and `hta` length checks before the fix.

Merged main at `4907a003` and regenerated the toy page. The requested full run of
`tests/help.spec.mjs`, `tests/hta.spec.mjs`, `tests/cdx-pfa.spec.mjs`, and
`tests/taps.spec.mjs` passed: **88 tests** in 6.0 minutes.

Main advanced during the test run. Merged `915e6793`, whose source changes are confined to
Video3D, and regenerated the site after resolving its generated service-worker conflict.
All three focused help/About metadata checks passed again after this merge.
`node tools/site-build.mjs --check`, `node tools/check-packs.mjs one-splat`, and
`npx prettier --check .` passed. The English diff still reports only the inherited generated
heading documented above. Test-generated screenshot changes were restored for this text fix.
