# Codex task 78b: Neuron specimen

October 14, 2026. Built by Codex (GPT-6) for Ryan.

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

## Verification

- `tests/cdx-pfb.spec.mjs`: eight passing tests. Every merge and every focus level conserve the
  moments, all covariances are positive definite, stain shares sum to one, and the GPU axes
  reconstruct rotated covariances. The membrane rests, has an all-or-none threshold, spikes, and
  undershoots. Phone and desktop browser frames show all three stains, the focus merge, a wave whose
  red center moves toward the terminals, and the return to rest. Public controls were exercised,
  including keyboard focus changes. WebGL2 and WebGPU both rendered the effect.
- `node tools/check-packs.mjs specimen-neuron`: passes. The high build took 898 ms, and the
  21,000-splat phone budget built its 16,383 stored splats in 596 ms on this cloud worker.
- `tools/make-thumbs.mjs` and `tools/contact-sheet.mjs`: thumbnail generated and contact sheet
  visually inspected. Screenshots at 390×844 and 1440×900 were inspected.
- `tools/effect-clip.mjs`: a five-second, 390×390, 15 fps clip and nine-frame strip, with labs on,
  inspected. Review media live on `codex/portfolio-b-clips`, which must never be merged.
- The required smoke, taps, and unit suites passed, including old version 2 links, version 3 saved
  scenes, and the embed transfer check (9.2 MB, under 30 MB). Help, Playground links, site, and
  toy-page checks also passed. The kit failure is documented below.
- `node tools/sound-lint.mjs --toy specimen-neuron`: no clear violations; peak 0.07, loudness 0.011.

| Spec                 | Passed | Failed |
| -------------------- | -----: | -----: |
| cdx-pfb              |      8 |      0 |
| smoke                |     50 |      0 |
| taps                 |     63 |      0 |
| unit                 |     20 |      0 |
| kit                  |      9 |      1 |
| help                 |     14 |      0 |
| cdx-playground-links |     15 |      0 |
| site                 |     11 |      0 |
| tpg                  |     11 |      0 |

Total: 201 passing tests and one confirmed baseline failure. No tests were skipped.

Browser checks used the repository's Playwright setup, system Chromium, and SwiftShader. The Browser
plugin was unavailable. The viewports emulate a phone and desktop; physical phone hardware was not
tested. The clip tool steps the clock to preserve playback speed and does not measure hardware frame
rate.

A separate wall-clock sample measured 89 settled animation-frame intervals per viewport, with no
other browser tests running. On Chromium's SwiftShader software renderer, the phone low profile had
a 16.7 ms median interval (about 60 fps) and a 50.1 ms 95th percentile. The desktop high profile had
a 100 ms median interval (about 10 fps) and a 100.1 ms 95th percentile. The software-rendered
desktop view is slow; these measurements do not establish physical GPU performance.

## Review

A fresh code reviewer independently checked the covariance axes and membrane trace against the
reference. The review found that the default long-pulse behavior could pause the invisible tail of a
finished wave. The pulse now opts out of pausing, and a regression test was observed failing before
the change and passing afterward. All eight toy tests passed after the fix.

The minimum geometry depth emits 8,191 stored splats in an artificial 8,000-splat build. The actual
low profile and the Detail slider start at a higher budget, and both supported profile budgets are
respected. This small test-budget floor is retained.

## Existing regression failure

The generic kit determinism test fails before reaching this new toy: `qr-picture`, with
`shape: "circle"` and an 8,000-splat budget, throws "This code has too much detail for a circular
picture on this device." The same case was reproduced from unchanged `main` at `c044dc9d` in a
separate worktree. The QR source, engine, and kit test are unchanged by this part. The kit run
reported nine passing tests and this one failure. It is retained as a known issue in the draft PR.

Rule check: none.
