# Build from pictures: motion and scoring evidence

October 17, 2026. Made by Ryan with Codex (GPT-6). This branch contains review evidence only. The
code, context packs, measured good builds, playbook, and audit are on
[`codex/build-from-pictures`](https://github.com/ryanjosephkamp/splashery/tree/codex/build-from-pictures).

The kit quality gates failed: good median silhouette IoU 0.834 (target 0.85), and lowest volume IoU
0.259 (target 0.6 for each object). Best median silhouette IoU is 0.891, while lowest volume IoU
remains 0.252. The pictures and clips expose coarse geometry and flat materials, not approved
finished effects.

## Five tap effects

All videos are 1080×1080 at 30 fps, 85 frames, 2.833 seconds including pre-roll. They were made with
`tools/effect-clip.mjs --mp4 --size=1080 --fps=30 --opt=object=<id> built-from-pictures:2.4` in
Chromium using the real Splashery renderer and Mesa llvmpipe on Xvfb. `clips.json` records FFprobe
results and SHA-256 hashes. The tests verify rigid group membership and return to rest.

- [Duck](reference-duck.mp4) · [comparison report](reports/reference-duck.html)
- [Croissant](reference-croissant.mp4) · [comparison report](reports/reference-croissant.html)
- [Pomegranate](reference-pomegranate.mp4) · [comparison report](reports/reference-pomegranate.html)
- [Cake](reference-cake.mp4) · [comparison report](reports/reference-cake.html)
- [Lantern](reference-lantern.mp4) · [comparison report](reports/reference-lantern.html)

Download a comparison HTML report and open it locally to see the reference, mask, camera-matched
render, and difference. Reports are self-contained and make no network requests. Full-resolution
start, middle, and end frames, phone/desktop About captures, and the shelf contact sheet are in
`stills/`. The repeat pomegranate report records a 0.405-point score difference; the known chair
versus box check is documented in the code branch's benchmark and audit.

All inputs are CC0 model derivatives from the five Poly Haven sources credited in the code branch's
`tools/refpack-samples/*/truth/truth.json`. Original kit geometry, generated backgrounds, and these
renderings are CC0. No private or store pictures are included. Code is MIT.

Rule check: none.
