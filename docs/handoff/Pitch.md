# Lane Pitch: one page that shows what Splashery is

Prefix `pit`. Model: Opus 5.5. Branch `claude/lane-pitch`. Owns `tools/site-pitch.mjs`,
`tools/pit-og.mjs`, `site/assets/pitch.css`, `site/assets/pitch.js`, `site/assets/pitch-og.png`, the
page's entry in `tools/site-pages.mjs` and its page type in `tools/site-build.mjs`,
`site/about/splashery/`, `tests/pit.spec.mjs`, the `pit-*` screenshots and this file. How lanes
work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 14, 2026 (in short; the full text is in the lane's first
message).

Time box: 30 minutes of work to a first READY. Build one page that captures Splashery in about two
minutes of scrolling, so the owner can share a single link: what it is, what it does that nobody
else does, and why it's remarkable and useful. A living demo, not a brochure. Tone: not marketing,
not cringe; a serious, beautiful real-time 3D Gaussian-splat engine and studio that happens to be
playful. No hype words, no exclamation marks, no emoji.

- Interactive from the first screen: real Splashery splats through the existing engine and embed
  path, a hero someone can spin or tap within a second, then a handful of short sections, each with
  one live moment, each linking to its toy in the Playground and its page on the site.
- What nobody else does: one tight section, each claim backed by a demo or a number and checked
  against the manual and the code.
- Short: five to seven sections, none longer than a phone screen of text.
- Design: built on the site's look and type; excellent at 390×844 and 1440×900, light and dark;
  demos load only near the viewport and pause off it; within the 30 MB embed budget; reduced motion
  respected; keyboard and screen-reader friendly; a static fallback per demo.
- Where: `site/about/splashery/`, built by tools/site-build.mjs, with its own Open Graph card. Not
  linked from the homepage or the front door.
- Tests in tests/pit.spec.mjs plus the site, spg and tpg specs; prettier and us-english clean;
  `pit-*` screenshots. Public site content: merges only after the owner's "good".

## State

PR #633 is open (draft). First READY on October 14, 2026; the Operator then extended the time box by
two hours for polish. The Operator's review of October 14 (eight fixes) is applied: the claims list
is now the manual's own six, the hero carries the grape's credit, and an unloaded toy's frame goes
to about:blank.

The page is at `site/about/splashery/`: a hero (the grape, live), then six numbered sections: one
splat (a 2D Gaussian drawn in the page, with sliders), recipes (the toy piano with sound), photo to
3D (with "Use your own photo" and drop), real data (the walnut CT scan), a QR code that scans (a
test decodes it), and the claims list (the manual's six) with the end buttons. Each live toy is
`site/play/` in an iframe, started by an IntersectionObserver near the viewport and unloaded a
screen away, so one or two run at once. Each shows its own still (rendered to match its live
framing) until it is drawn, and keeps it with a note where WebGL2 and WebGPU are both missing.

## Notes

- Built through a new page type, `pitch`, in tools/site-build.mjs (calls tools/site-pitch.mjs). The
  only other change to the build: `ogImage()` takes an optional `imageWidth`, `imageHeight` and
  `imageCard`, so a page can carry a wide preview card. Additive; no other page changes.
- Tools: `node tools/pit-og.mjs` (the preview card), `node tools/pit-stills.mjs [toy …]` (the stills
  in site/assets/pitch/, see-through so one serves both themes; rerun after changing a toy's framing
  in PITCH_DEMOS) and `node tools/pit-clip.mjs [--desktop]` (a clip, for a computer with a real
  graphics chip). Each needs the local server.
- Your own photo: pitch.js imports `src/packs/photo-3d.js` inside the player's own page (same
  origin, so the same module instance) and calls the toy's own `input.read`, then reloads the toy
  with the new options, as the Playground's Toy tab does. No engine or embed change. A toy showing
  someone's photo isn't unloaded when scrolled away.
- The player's "Open in Splashery" link is set to open a new tab, as the site's links to the app do.
- The page's `?renderer=` passes on to the players (the tests force WebGL2, as the other specs do).
- The "Photo to 3D", "Walnut CT scan" and "QR code" toys are behind the labs switch; the page links
  to them anyway (it is not linked from anywhere public yet). Their toy pages exist.
- The link length in the claims list (the grape's whole scene) is computed at build time.
- First screen on a phone (local, uncompressed): the still paints at about 0.2 s and the grape is
  live at about 2.6 s; 3.6 MB, 2.5 MB of it the PlayCanvas engine (gzipped on GitHub Pages).

## Known issues

- The clip has to be recorded on a computer with a real graphics chip (`tools/pit-clip.mjs`); the
  cloud's software renderer is too slow for a fair one.
- WebGPU isn't checked here (the tests use WebGL2); a check on a real device is needed.

## For the Operator

- The owner's call: whether `about/splashery/` is the right slug, and when to link it.
- Labs toys on a public-facing pitch page: photo-3d, walnut-ct and qr-code are still in labs.
