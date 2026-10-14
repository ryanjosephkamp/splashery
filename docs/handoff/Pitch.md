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

First READY (October 14, 2026). The page is at `site/about/splashery/`: a hero (the grape, live),
then six numbered sections: one splat (a 2D Gaussian drawn in the page, with sliders), recipes (the
toy piano with sound), photo to 3D (photo-3d's sample), real data (the walnut CT scan), a QR code
that scans, and the claims list with the end buttons. Each live toy is `site/play/` in an iframe,
started by an IntersectionObserver near the viewport and unloaded a screen away, so one or two run
at once. Where WebGL2 and WebGPU are both missing, each toy keeps its still with a note.

## Notes

- Built through a new page type, `pitch`, in tools/site-build.mjs (calls tools/site-pitch.mjs). The
  only other change to the build: `ogImage()` takes an optional `imageWidth`, `imageHeight` and
  `imageCard`, so a page can carry a wide preview card. Additive; no other page changes.
- The preview card is rendered by `node tools/pit-og.mjs` from the toys' thumbnails.
- The "Photo to 3D", "Walnut CT scan" and "QR code" toys are behind the labs switch; the page links
  to them anyway (it is not linked from anywhere public yet). Their toy pages exist.
- The link length in the claims list (the grape's whole scene) is computed at build time.

## Known issues

- Photo to 3D: the page shows the toy's sample photo; to drop your own the visitor goes to the
  Playground (the embed player has no file input).
- The stills are the toys' 480 px thumbnails; the walnut's thumbnail is cropped at the top.

## For the Operator

- The owner's call: whether `about/splashery/` is the right slug, and when to link it.
- Labs toys on a public-facing pitch page: photo-3d, walnut-ct and qr-code are still in labs.
