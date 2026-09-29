# Lab: sharper kernels, measured

Lane Lab, September 29, 2026 (Opus 5.5). Background in [LITERATURE.md](LITERATURE.md).

## What was built

`src/kernels.js` swaps the splat falloff in the engine's fragment hook (`modifySplatColor`, the
`gsplatModifyPS` chunk), without touching the vendored engine. It is off by default: a toy shows
another kernel only while labs is on, from `?kernel=sharp` (for testing) or a recipe's
`kernel: "sharp"` field. Every other toy, and every toy with labs off, draws exactly as before (the
chunk is never touched).

Three candidates were tried; one is kept:

| Kernel     | Falloff (A = \|uv\|² over the quad)                                               | Kept?                                                                                          |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `gaussian` | `(exp(−4A) − e⁻⁴) / (1 − e⁻⁴)`, the engine's own                                  | Today's look                                                                                   |
| `sharp`    | `exp(−14.7·A²)`: a generalized exponential (GES-style, β = 4 in r), the same area | **Yes**, as a labs option                                                                      |
| `sharp3`   | `exp(−57.5·A³)`: steeper still, the same area                                     | No: each splat shows as a scale on smooth surfaces                                             |
| `disc`     | a flat disc of the same area, its edge one screen pixel wide (`fwidth`)           | No: a surface of discs looks like a pile of coins, and it shimmers twice as much while turning |

All of them blend back to the Gaussian as a splat shrinks to a pixel or two on screen (measured per
fragment with `fwidth`), because a sharper edge on a tiny splat can only alias.

## How it was measured

`node tools/lab-kernels.mjs <out> id[@zoom] …` renders each toy at 390×844 CSS pixels and a device
pixel ratio of 2 (the canvas a phone draws), in Chromium's software renderer (SwiftShader, WebGL2),
and measures:

- **Edge**: the median 10–90% rise, in pixels, across the strongest 1% of edges (text strokes,
  outlines, seams). Lower is sharper.
- **Speckle**: the mean difference from a 3×3 median over the flatter half of the toy. Lower is
  cleaner.
- **Shimmer**: the mean frame-to-frame change of the fine detail over 12 frames turning 0.4° each.
  Lower is steadier.
- **Frame**: milliseconds per frame in the software renderer. These are relative only and noisy
  (±20% between runs); the kernel adds a handful of instructions per fragment, and the owner's phone
  is the real test.

Zoom 1 is the toy's home view; 0.4 is about 2.5 times closer (a pinch).

## Results

| Toy (view)                   | Kernel   | Edge (px) | Speckle | Shimmer  | Frame (ms) | Splats                |
| ---------------------------- | -------- | --------- | ------- | -------- | ---------- | --------------------- |
| Picture lab, PDF page (home) | gaussian | 1.61      | 0.18    | 3.43     | 6.0        | 23,545 + 65,624 page  |
|                              | sharp    | 1.60      | 0.01    | 3.48     | 6.2        |                       |
|                              | disc     | 1.60      | 0.00    | 3.65     | 6.4        |                       |
| Picture lab, PDF page (0.45) | gaussian | 1.75\*    | 10.61   | 10.74    | 6.8        | 23,545 + 199,476 page |
|                              | sharp    | 1.75\*    | 11.12   | 10.91    | 6.7        |                       |
|                              | disc     | 1.75\*    | 11.31   | 10.95    | 7.3        |                       |
| Desk lamp (0.4)              | gaussian | 1.61      | 0.22    | 1.09     | 5.5        | 90,001                |
|                              | sharp    | 1.61      | 0.21    | 1.14     | 5.8        |                       |
|                              | disc     | 1.62      | 0.23    | 1.40     | 6.8        |                       |
| American football (0.4)      | gaussian | 1.56      | 0.41    | 1.02     | 6.1        | 300,000               |
|                              | sharp    | 1.56      | 0.49    | 1.22     | 6.9        |                       |
|                              | disc     | 1.55      | 0.45    | 2.07     | 5.8        |                       |
| Hockey puck (0.35)           | gaussian | 1.80      | 0.43    | 0.87     | 8.7        | 200,000               |
|                              | sharp    | 1.66      | 0.39    | 0.99     | 8.1        |                       |
|                              | sharp3   | 1.83      | 0.37    | 1.11     | 9.7        |                       |
|                              | disc     | 1.62      | 0.34    | 1.45     | 7.2        |                       |
| Splat equation, torus (home) | gaussian | 3.70      | 0.14    | 0.35     | 6.3        | 72,000                |
|                              | sharp    | **2.70**  | 0.11    | **0.31** | 6.7        |                       |
|                              | sharp3   | 2.10      | 0.09    | 0.29     | 7.3        |                       |
|                              | disc     | 1.59      | 0.01    | 0.71     | 6.1        |                       |

\* An earlier run of the edge measure, before it interpolated between samples. The page at 0.45 is
the close reading view; its "speckle" is the text itself (the flat half of a text block is still
mostly letters).

## What it means

- **Pages and the grainy toys: no clear win.** On a PDF page at phone size and on the desk lamp, the
  American football and the hockey puck, almost every splat is a pixel or two across on screen, so
  the kernel can't change much, and where it does (the puck up close: 1.80 → 1.66 px) the shimmer
  goes up a little. Their grain comes from the splats' colors and placement (noise baked into the
  colors, splats scattered at random), not from the kernel; that is lane Fidelity A's work. The page
  text is already about as sharp as the screen allows: its edges are 1.6 px wide at a device pixel
  ratio of 2, which is close to the limit for anti-aliased text.
- **Big, smooth splats: a real win for `sharp`.** Where splats are several pixels across (the splat
  equation toy's shapes, and any kit toy seen up close), `sharp` cuts the edge width by about a
  quarter (3.70 → 2.70 px), with a little less speckle and a little less shimmer, and keeps the
  surface smooth. The outline reads crisper, like a solid object instead of a soft glow. The steeper
  kernels (`sharp3`, `disc`) sharpen more but show each splat as a scale or a coin, which breaks the
  "no speckle" rule.
- **Cost:** a few instructions per fragment; no measurable change in the software renderer. The
  owner's phone is the real test.

## Recommendation

Keep `sharp` as a labs option in a small engine PR (off by default), and let the owner judge the
clips. Good candidates for `kernel: "sharp"` later are the toys drawn with big, smooth splats (the
splat equation toy, the math surfaces), not the pages and the grainy toys. Turning it on for a
public toy is the owner's call.
