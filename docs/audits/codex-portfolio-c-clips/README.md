# Codex task 78c: Shape morph review clips

Feature commit: `ed6aac0c08ccde616d7d17063cfd64b2c905abc7`.

Review artifacts for `codex/portfolio-c`. This clips branch is never merged. Made by Ryan with Codex
(GPT-6), October 14, 2026. Original captures: CC0 1.0.

- [Six forms](shape-morph-forms.mp4): Word → Lorenz attractor → Klein bottle → gyroid → loop → QR
  code → Word, with teal and orange inks. Every splat flies from its current position.
- [Scatter and re-form](shape-morph.mp4): the tap effect, generated with `tools/effect-clip.mjs`.
- [Push and settle](shape-morph-push.mp4): the drag effect, generated with `tools/drag-clip.mjs`.

All three run in real Chromium through Playwright with the labs switch on, the low profile (7,200
splats), and a 390×844 viewport. The stage is captured as 390×390 frames. Their clocks are stepped
at 10 frames per second, as the stock clip tools do; this is not a frame-rate measurement. FFmpeg
encodes the GIF captures as H.264 MP4s. The adjacent strips show sampled frames for review.

The temporary launcher for the stock tools adds `labs=1` and `profile=low` to their navigation; the
tools themselves are unchanged. The six-form clip follows the same capture loop and selects each
form in sequence, allowing 2.4 seconds per form. The drag follows
`[-0.45, 0, 0] → [-0.1, 0.2, 0] → [0.15, 0.3, 0]`, takes 0.8 seconds, holds for 0.2 seconds, and
then settles for 1.9 seconds.

Clips were checked from their extracted frames. These are proposed effects, awaiting the owner's
review. No owner approval is claimed. `cards.json` is the handoff for the Operator's review page.

## Software frame timing

`software-frame-times.json` records real frame-end intervals in Chromium's SwiftShader WebGPU
renderer, with no stepped clock. Each form has a three-second warmup followed by a three-second
sample; the camera holds still and the toy's idle effects are disabled. The phone viewport uses
device pixel ratio 2 and the low profile; desktop uses pixel ratio 1 and high. The shared regression
suite was running concurrently, so these measurements include contention and do not represent a
physical phone or desktop GPU.

Phone-profile medians were 47–134 ms; desktop-profile medians were 183–397 ms. Hardware frame-rate
steadiness is unverified. `software-frame-times.mjs` is the measurement script; run it from a
feature checkout with the app served on `127.0.0.1:4173`, Playwright installed, and this workspace's
`/usr/bin/chromium` available.
