# Lane Pitch2: the one-link page, version 2

Prefix `pit`. Model: Opus 5.5. Branch `claude/lane-pitch2`, cut from `claude/lane-pitch` (version 1,
#633), run locally on the owner's Mac on October 14, 2026, in a one-hour time box. It replaces #633.
Owns `site/about/splashery/`, `site/assets/pitch*`, `tools/site-pitch.mjs`, `tools/pit-*.mjs`,
`tests/pit*.spec.mjs`, the `pit-*` screenshots, and this file.

## What changed from version 1, and why

Version 1's structure held up (the `pitch` page type, players that load near the viewport and unload
a screen away, stills that paint first, the no-3D fallback, and the tests), so it stays. What
changed is how the page reads.

- **A figure plate, not a card.** Each live toy sits on a plate with a hairline frame and corner
  ticks, a mono label line above it ("Fig. 2 · Toy piano, built from a recipe"), and a tag in its
  corner that says what is showing: Still, Loading, or Live. The tag turns pink only when the toy is
  really drawn by the engine, so the page is honest about the still it paints first.
- **One splat, as the math.** The one-splat figure now draws the Gaussian's 1σ, 2σ, and 3σ rings and
  its mean, and prints its covariance Σ and opacity α as the sliders move (Σ = R diag(σx², σy²) Rᵀ,
  with y up). Under the paragraph, "one frame" in three steps: the worker sorts, the graphics chip
  projects each 3D Gaussian to a 2D ellipse, and the ellipses blend back to front. This is the part
  that reads as people who know splats.
- **Phone first.** On a phone the grape comes right under the headline, so the first screen holds
  the headline and the live toy; the lead and the numbers follow.
- **Credits.** The Photo to 3D sample ("Forest Away Path" by Seaq68, CC0 1.0) now has its credit
  beside it; version 1 had none. The walnut's credit moved under its figure.
- **The end.** A closing line ("Everything above ran in this tab.") and the three buttons.
- Every correction in the Operator's review of #633 still holds: the lead's wording, the manual's
  six claims with "As far as we know. We have not tried every splat tool.", the 97-character link
  sentence, the grape's credit, the video and WebGPU sentence, "Change its shape and opacity here",
  "Some of the science toys use measured data", and `about:blank` on unload. Labs toys have no "Its
  page" link and there is no `tools/#qr` link.

## Design decisions

- **Type.** Headlines in Instrument Serif (regular and italic), every label and number in JetBrains
  Mono at weight 500, and the system sans for reading. Both fonts are OFL, subset to the page's
  characters, 35 KB in all, loaded only by `pitch.css`, with system fallbacks and
  `font-display: swap`. The headline is 2.7rem on a phone and up to 4.7rem on a desktop.
- **Color.** The site's own tokens (ink, muted, line, raised) in light and dark. The only accent is
  the logo's pink, used for the Gaussian and the Live dot. No gradients and no shadows.
- **Spacing.** Hairlines between sections, 52 px of section padding on a phone and 80 px on a
  desktop, a 16 px gutter on a phone and 40 px on a desktop. Sections alternate sides on a desktop
  (5:7 and 7:5).
- **Motion.** Each figure rises 18 px and fades in once, the first time it scrolls into view; the
  claims follow in a 60 ms stagger. None of it runs with reduced motion, which also keeps the
  turntables off, as before.

## Measured

- Local server, the in-app Chromium on the Mac at phone size: the hero's still arrived 17 ms after
  the page started loading. Version 1 measured the grape live at about 2.6 s; this round did not
  re-time it (see Known issues).

## Known issues and what was not done

- **Not checked in this round (time box):** Safari, WebGPU timing, memory while scrolling, the
  Android phone, and the clips (`tools/pit-clip.mjs`; the branch `claude/lane-pitch2-clips` was not
  pushed).
- The full suite was not run; only the specs listed in the PR.

## For Codex to audit

- The covariance readout's convention (y up, counterclockwise turn, units of a sixth of the plate's
  height) in `site/assets/pitch.js`.
- That the Live tag never shows while the still is up (it follows `data-state`).

## Questions for the owner

- The two web fonts (Instrument Serif and JetBrains Mono, OFL), within the owner's "fonts OK": keep
  them, or go back to system fonts.
- No new library and no engine change.
