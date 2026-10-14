# One splat, many splats: review clip

Codex task 78a, October 14, 2026. Made by Ryan with Codex (GPT-6), from a concept by Ryan Kamp.
Procedural splats, GIF, and strip: CC0. This branch is for review only and must never be merged.

[Play the split](one-splat.gif). [View the eight-frame strip](one-splat-strip.png).

The level starts at one Gaussian. Tapping it replaces it with its two pixel-tree children, which
separate over 1.8 seconds. Captured at phone size with the shared renderer:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/effect-clip.mjs clips \
  --opt=level=0 --at=0,0,0 --strip=8 --secs=2.4 --fps=12 one-splat
```

The implementation and verification report are on `codex/portfolio-a`.
