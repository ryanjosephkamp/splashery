# Codex task 78b: Neuron specimen

October 14, 2026. Built by Codex (GPT-6) for Ryan.

## October 15 synchronization and verification

The branch was synchronized with `main` at `c13a9d3f` in merge commit `69a30eb6`. The source credit
conflict preserves all of main's credits and appends this specimen's credit. Main's versions of the
generated credits page and service worker were taken, then `tools/site-build.mjs` and
`tools/toy-plan.mjs` regenerated the derived files. The neuron recipe and its eight-test spec were
unchanged. This report remains on the clips branch, outside the implementation PR.

| Spec    | Passed | Failed |
| ------- | -----: | -----: |
| cdx-pfb |      8 |      0 |
| smoke   |     49 |      1 |
| taps    |     63 |      0 |
| kit     |     10 |      0 |
| unit    |     20 |      0 |
| site    |     11 |      0 |
| tpg     |     11 |      0 |

The fresh seven-file run had 173 tests: 172 passed, one failed, and none were skipped. The sole
failure was `generating a procedural toy changes canvas pixels`: the exported seed was 1 after the
test entered 4242. That test passed alone in 10.9 seconds. The generator, app, and smoke test are
unchanged from main; the initial failure remains in the full-run counts. The previous Picture QR kit
failure and rig smoke failure now pass with main's fixes.

Both WebGL2 and WebGPU neuron checks passed, as did all 63 tap checks and 20 unit tests. The embed
transfer check passed at 9.2 MB. Pack builds passed at 65,535 stored desktop splats in 377 ms and
16,383 phone splats in 108 ms. Site generation, Playground-link checks, Prettier, and American
English checks passed.

Separate real-browser checks opened the original public Neuron and clicked Bacterium without labs at
390×844 and 1440×900. The specimen's About panel displayed the stored and drawn counts at both sizes
without page errors. Its count screenshots were refreshed and inspected, as were the part b
screenshots. Bacterium still ranks ninth in the original Neuron page's eight-card related list.
Standard screenshots were restored; no engine or shared-test changes belong to part b.

## Delivered

`src/packs/neuron.js` grows a textbook-style multipolar neuron, with branching dendrites and spines,
cytoplasm and nucleus, five myelin sheaths and bare nodes, terminal branches, and boutons. The Tiny
world shelf entry is `specimen-neuron`, behind labs. The existing public `neuron` stays in the Tiny
pack, so its saved scenes and links keep their meaning.

The desktop high profile has 32,768 visible leaf splats; the phone low profile has 8,192. Nissl,
Golgi, and H&E recolor the same geometry. Focus selects exact binary-tree levels from the finest
view down to one Gaussian. Every pair is replaced by its weighted mean and full covariance,
including the covariance of the children's displacement from that mean. A Jacobi eigensolver turns
the full covariance into PlayCanvas scales and a quaternion.

A tap plays the concept's Hodgkin-Huxley waveform, with a 0.01 ms Euler step and 0.1 ms samples.
Each splat samples that waveform at its own arrival delay. The display shows seven model
milliseconds per second, making input, soma activation, axon propagation, and terminal activation
visible. Colors are illustrative, and the geometry is schematic, not a measured human cell. The
[Hodgkin-Huxley model source](https://en.wikipedia.org/wiki/Hodgkin%E2%80%93Huxley_model) was opened
on October 14, 2026.

## Port and scope

The reference was read from `claude/portfolio-ref`, commit
`5191138bdf91c29093af1c6b02a466c6b8ac6aa6`, under `ref/portfolio/specimen/`. The math and ideas were
ported; no reference file, page, font, worker, or renderer was copied into the site. Both GPU hooks
extend the existing Kit modifier, preserving the ordinary engine effects. No engine file changed.

All focus levels are prepared together: 65,535 stored splats on desktop and 16,383 on the phone
profile. Only the selected level is drawn. The existing status line reports the stored count; the
About text distinguishes the visible leaf count. This avoids rebuilding the tree while the person
uses Focus. PlayCanvas's ordinary alpha blending displays the stains; the reference's separate
optical-depth renderer is not shipped. Numerical mass, center, and covariance are conserved; pixel
brightness is not a conserved quantity.

The catalog, help, sound, plan, asset credit, site-page registry, and generated pages include only
this part's addition and its derived indexes. Original geometry and the thumbnail are made by Ryan
with Codex (GPT-6), CC0; code is offered under Splashery's MIT license. The synthesized sound is a
quiet illustrative cue, not the sound of a real nerve cell.

## October 14 verification

- `tests/cdx-pfb.spec.mjs`: eight passing tests. Every merge and every focus level conserve the
  moments, all covariances are positive definite, stain shares sum to one, and the GPU axes
  reconstruct rotated covariances. The membrane rests, has an all-or-none threshold, spikes, and
  undershoots. Phone and desktop browser frames show all three stains, the focus merge, a wave whose
  red center moves toward the terminals, and the return to rest. Public controls were exercised,
  including keyboard focus changes. WebGL2 and WebGPU both rendered the effect.
- `node tools/check-packs.mjs specimen-neuron`: passes. The follow-up high build took 758 ms, and
  the 21,000-splat phone budget built its 16,383 stored splats in 194 ms on this cloud worker.
- `tools/make-thumbs.mjs` and `tools/contact-sheet.mjs`: thumbnail generated and contact sheet
  visually inspected. Screenshots at 390×844 and 1440×900 were inspected.
- `tools/effect-clip.mjs`: a five-second, 390×390, 15 fps clip and nine-frame strip, with labs on,
  inspected. Review media live on `codex/portfolio-b-clips`, which must never be merged.
- The required suites ran again after synchronizing with main. Taps, unit, help, site, and toy-page
  checks passed. Smoke passed old version 2 links, version 3 saved scenes, and the embed transfer
  check (9.2 MB, under 30 MB). Its rig assertion and the existing kit failure are documented below.
- `node tools/sound-lint.mjs --toy specimen-neuron`: no clear violations; peak 0.07, loudness 0.011.

| Spec    | Passed | Failed |
| ------- | -----: | -----: |
| cdx-pfb |      8 |      0 |
| smoke   |     49 |      1 |
| taps    |     63 |      0 |
| unit    |     20 |      0 |
| kit     |      9 |      1 |
| help    |     14 |      0 |
| site    |     11 |      0 |
| tpg     |     11 |      0 |

After synchronizing with main: 187 tests, 185 passing, two failing, and no skips. The Strawberry rig
smoke test passed when rerun alone (43.8 seconds); the Picture QR kit failure remains. The earlier
build also passed the 15 Playground-link tests, which were not rerun for this follow-up.

Browser checks used the repository's Playwright setup, system Chromium, and SwiftShader. The Browser
plugin was unavailable. The viewports emulate a phone and desktop; physical phone hardware was not
tested. The clip tool steps the clock to preserve playback speed and does not measure hardware frame
rate.

An initial, pre-merge wall-clock sample measured 89 settled animation-frame intervals per viewport,
with no other browser tests running. On Chromium's SwiftShader software renderer, the phone low
profile had a 16.7 ms median interval (about 60 fps) and a 50.1 ms 95th percentile. The desktop high
profile had a 100 ms median interval (about 10 fps) and a 100.1 ms 95th percentile. The
software-rendered desktop view is slow; these measurements do not establish physical GPU
performance.

## Review

A fresh code reviewer independently checked the covariance axes and membrane trace against the
reference. The review found that the default long-pulse behavior could pause the invisible tail of a
finished wave. The pulse now opts out of pausing, and a regression test was observed failing before
the change and passing afterward. All eight toy tests passed after the fix.

The minimum geometry depth emits 8,191 stored splats in an artificial 8,000-splat build. The actual
low profile and the Detail slider start at a higher budget, and both supported profile budgets are
respected. This small test-budget floor is retained.

## October 14 regression failures

The generic kit determinism test fails before reaching this new toy: `qr-picture`, with
`shape: "circle"` and an 8,000-splat budget, throws "This code has too much detail for a circular
picture on this device." The same case was reproduced from unchanged `main` at `c044dc9d` in a
separate worktree. The QR source, engine, and kit test are unchanged by this part. The kit run
reported nine passing tests and this one failure. It was recorded as a known issue in the October 14
draft PR. Current results are above.

## Operator follow-up

The implementation was synchronized with `main` at `6c3764ff`. The only merge conflict was the
generated `site/sw.js`; main's version was taken, and `tools/site-build.mjs` regenerated the site.
`tools/toy-plan.mjs` regenerated `docs/TOY-PLAN.md`. This report was moved out of the implementation
PR and onto `codex/portfolio-b-clips`.

The existing public `neuron` catalog entry, recipe, and scene link are unchanged. Its generated page
launches `neuron` without labs at both 390×844 and 1440×900 in real Chromium WebGL2 rendering. The
related-toy generator selects eight neighbors; `specimen-neuron` ranks third, and `bacterium` now
ranks ninth. The Bacterium toy and page remain available.

The About panel now states both the drawn counts (32,768 desktop high, 8,192 phone low) and the
stored counts (65,535 desktop, 16,383 phone), and explains that only one focus level is drawn at a
time. Both viewport checks displayed this explanation without page errors; their screenshots were
visually inspected. No engine code or `tests/taps.spec.mjs` was changed by part b.

The concurrent smoke run timed out at the Strawberry seed-pop return-to-rest assertion: after 15
seconds, 82,287 pixels differed from rest, above the required 22,766.25. The same test passed alone
in 43.8 seconds. The rig, motion driver, and smoke test are unchanged from main; no production
change was made for this assertion. The initial failure remains in the recorded full-run counts.

Rule check: none.
