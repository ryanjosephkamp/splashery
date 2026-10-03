# QR scan lab scorecard (October 2026)

**Status: measured, October 3, 2026,** against lane QR's toy at `f86e0880` (`origin/claude/lane-qr`,
draft PR #216). Rerun with `node tools/qr-scan-lab.mjs --source=toy` and
`node tools/qr-scan-lab/report.mjs toy` whenever the toy changes.

## Summary

- Method: the toy's seven styles rendered through its test hook, then 3,768 simulated captures
  decoded by two independent readers, jsQR 1.4.0 and zxing-js 0.21.3. A capture counts only when
  **both** return the exact text. Three texts (19, 43 and 104 characters: versions 2, 4 and 6 at M),
  levels L, M, Q and H, six color schemes, 2D phone captures (tilt, perspective, module size, blur,
  JPEG, uneven light) and the toy's own camera turned in 3D.
- Every style scores 87–97% pooled except Neon, which is light on dark: plain readers read it 0% of
  the time and readers that try inverted codes read it 90–98% of the time.
- On realistic phone captures with the preset colors, every style reads 100% at L and M. Q and H are
  where the failures are (Bricks, Gems and Neon on the dense 104-character code), so M is the right
  default for every style.
- The weakest spots are real depth viewed at an angle (Bricks 58–67% at 10–20° yaw at full size, 0%
  at 35°; Classic 58–100%) and low contrast (pastel at 2.5:1: Gems 48%, Bricks 63%).
- Smallest module size: 4 px per module reads 92–100% for every style; 3 px drops to 75–92%.
- Gradients and a separate eye color are safe (96–100%). Light-on-dark Bricks and Gems never read,
  even with inverted-aware readers.
- Not tested: real phone camera apps, glare, moiré from a screen, a damaged or covered code (error
  correction's own job). A pass here is evidence, not a guarantee.

## Recommended defaults and warnings for lane QR

- **Error correction:** default M for every style, including the fancy ones (L also passed every
  phone-like capture here, so M leaves a margin for damage the lab does not model). Do not raise it
  automatically: Q and H make the code denser, and dense depth codes fail first (Bricks at Q reads
  85% on phone-like captures and 56% for the 104-character text; Neon at H, 44% for that text).
- **Contrast:** warn below 4:1 between dark and light (gray at 4.0:1 read 96–98% in every style);
  strongly warn or refuse below 3:1 (pastel at 2.5:1 fell to 48% for Gems, 63% for Bricks, 85–90%
  for the flat styles).
- **Smallest module size:** warn when Scan view would give fewer than 4 px per module on the screen
  it is shown on (the lab's reliable floor). For Bricks, Gems and Neon warn below 6 px per module:
  on a 390 px wide phone that is a code wider than about 57 modules with its quiet zone (version 9
  or more).
- **Density:** warn when the code reaches version 8 or more in a depth style (Bricks, Gems, Neon,
  Bubbles): suggest a shorter text or a flatter style. The 104-character text pooled 77% for Bricks
  and Gems against 94–100% for the short text.
- **Light on dark:** warn on Neon and on any light-on-dark code: "most phone cameras read it, some
  scanner apps don't". Do not offer light-on-dark for Bricks or Gems (0% even for inverted-aware
  readers); Dots inverted reads only 46–77%; Classic, Rounded and Bubbles inverted read 88–100% with
  inverted-aware readers.
- **Angle:** Scan view, the PNG and the GIF's last frames should stay flat and front-on. In 3D, flat
  Classic is the only style that reads well past 20°; Bricks and Gems should show a "hold the phone
  flat" hint, and the idle turntable should not stop at an angle.
- **Safe to leave unwarned:** linear and radial gradients and a separate eye color.

## What the readers said

_3768 captures (2688 2D-warped, 1080 from the toy's own camera); texts: short, url, long._

### Decode rate per style, plain readers

Every error correction level, color scheme (not inverted), text and 2D capture condition pooled.

| Style   | Both readers | jsQR | zxing | Captures |
| ------- | ------------ | ---- | ----- | -------- |
| classic | 95%          | 96%  | 96%   | 336      |
| dots    | 97%          | 99%  | 98%   | 336      |
| rounded | 97%          | 98%  | 98%   | 336      |
| bricks  | 88%          | 93%  | 89%   | 336      |
| gems    | 87%          | 90%  | 88%   | 336      |
| bubbles | 96%          | 97%  | 96%   | 336      |
| neon    | 0%           | 0%   | 0%    | 336      |

### Light on dark: plain readers against inverted-aware readers

Neon is light on dark by design. An inverted-aware reader tries the code inverted when the plain
pass fails.

| Style / scheme   | Plain, both | Plain, jsQR | Plain, zxing | Inverted-aware, both | Inverted-aware, jsQR | Inverted-aware, zxing |
| ---------------- | ----------- | ----------- | ------------ | -------------------- | -------------------- | --------------------- |
| classic/inverted | 0%          | 0%          | 0%           | 100%                 | 100%                 | 100%                  |
| dots/inverted    | 0%          | 0%          | 0%           | 46%                  | 77%                  | 50%                   |
| rounded/inverted | 0%          | 0%          | 0%           | 88%                  | 100%                 | 88%                   |
| bricks/inverted  | 0%          | 0%          | 0%           | 0%                   | 21%                  | 0%                    |
| gems/inverted    | 0%          | 0%          | 0%           | 0%                   | 6%                   | 0%                    |
| neon/preset      | 0%          | 0%          | 0%           | 90%                  | 93%                  | 92%                   |
| bubbles/inverted | 0%          | 0%          | 0%           | 98%                  | 98%                  | 100%                  |
| neon/pastel      | 0%          | 0%          | 0%           | 98%                  | 100%                 | 98%                   |
| neon/gray        | 0%          | 0%          | 0%           | 96%                  | 96%                  | 96%                   |
| neon/gradient    | 0%          | 0%          | 0%           | 98%                  | 98%                  | 98%                   |
| neon/eyes        | 0%          | 0%          | 0%           | 98%                  | 100%                 | 98%                   |
| neon/inverted    | 0%          | 0%          | 0%           | 98%                  | 98%                  | 98%                   |

### Decode rate per 2D capture condition, worst first

Plain readers, every level, scheme (not inverted) and text pooled. Neon is read plain here.

| Condition | classic | dots | rounded | bricks | gems | bubbles | neon |
| --------- | ------- | ---- | ------- | ------ | ---- | ------- | ---- |
| hard      | 89%     | 82%  | 93%     | 46%    | 57%  | 100%    | 0%   |
| tilt35    | 75%     | 93%  | 96%     | 86%    | 79%  | 93%     | 0%   |
| mod3      | 82%     | 96%  | 89%     | 89%    | 86%  | 82%     | 0%   |
| tilt20    | 100%    | 100% | 89%     | 89%    | 93%  | 96%     | 0%   |
| mod4      | 93%     | 100% | 93%     | 96%    | 93%  | 93%     | 0%   |
| persp     | 100%    | 100% | 100%    | 89%    | 86%  | 96%     | 0%   |
| jpeg30    | 100%    | 96%  | 100%    | 93%    | 93%  | 89%     | 0%   |
| phone     | 96%     | 100% | 100%    | 93%    | 89%  | 100%    | 0%   |
| mod6      | 100%    | 100% | 100%    | 89%    | 93%  | 100%    | 0%   |
| front     | 100%    | 100% | 100%    | 96%    | 93%  | 100%    | 0%   |
| blur20    | 100%    | 100% | 100%    | 96%    | 93%  | 100%    | 0%   |
| light30   | 100%    | 100% | 100%    | 96%    | 93%  | 100%    | 0%   |

### Decode rate per color scheme (contrast of dark against light in brackets)

Plain readers. Contrast is the WCAG ratio of the style's dark and light colors.

| Scheme   | classic     | dots        | rounded    | bricks    | gems      | bubbles    | neon      |
| -------- | ----------- | ----------- | ---------- | --------- | --------- | ---------- | --------- |
| preset   | 94% (18.1)  | 98% (14.2)  | 97% (7.2)  | 90% (7.7) | 90% (9.5) | 96% (8.9)  | 0% (13.5) |
| pastel   | 85% (2.5)   | 90% (2.5)   | 88% (2.5)  | 63% (2.5) | 48% (2.5) | 85% (2.5)  | 0% (2.5)  |
| gray     | 96% (4.0)   | 98% (4.0)   | 98% (4.0)  | 96% (4.0) | 96% (4.0) | 98% (4.0)  | 0% (4.0)  |
| gradient | 100% (8.2)  | 100% (8.2)  | 100% (7.5) | 96% (7.7) | 98% (8.2) | 100% (7.8) | 0% (2.4)  |
| eyes     | 100% (18.1) | 100% (14.2) | 100% (7.2) | 96% (7.7) | 98% (9.5) | 100% (8.9) | 0% (13.5) |
| inverted | 0% (19.0)   | 0% (19.0)   | 0% (19.0)  | 0% (19.0) | 0% (19.0) | 0% (19.0)  | 0% (19.0) |

### Decode rate per error correction level

Plain readers, every scheme except inverted, text and condition pooled.

| Level | classic | dots | rounded | bricks | gems | bubbles | neon |
| ----- | ------- | ---- | ------- | ------ | ---- | ------- | ---- |
| L     | 96%     | 98%  | 96%     | 89%    | 80%  | 96%     | 0%   |
| M     | 95%     | 98%  | 98%     | 98%    | 83%  | 98%     | 0%   |
| Q     | 95%     | 98%  | 98%     | 93%    | 95%  | 95%     | 0%   |
| H     | 92%     | 96%  | 95%     | 74%    | 90%  | 94%     | 0%   |

### Decode rate per text

Plain readers. Short, 43-character and about-100-character texts give different code versions.

| Text  | Version at M | classic | dots | rounded | bricks | gems | bubbles | neon |
| ----- | ------------ | ------- | ---- | ------- | ------ | ---- | ------- | ---- |
| short | 2            | 94%     | 100% | 100%    | 96%    | 98%  | 100%    | 0%   |
| url   | 4            | 96%     | 98%  | 97%     | 89%    | 87%  | 97%     | 0%   |
| long  | 6            | 88%     | 94%  | 92%     | 77%    | 77%  | 88%     | 0%   |

### Phone-like captures, preset colors: error correction level against style

Plain readers for every style but neon (inverted-aware here). Conditions: front, tilt20, mod4, mod6,
blur20, jpeg30, light30, persp, phone; the three texts pooled, with the worst text in brackets.

| Level | classic                | dots                   | rounded                | bricks                 | gems                   | bubbles                | neon                   |
| ----- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| L     | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) |
| M     | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) |
| Q     | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 85% (worst text 56%)   | 93% (worst text 78%)   | 96% (worst text 89%)   | 100% (worst text 100%) |
| H     | 100% (worst text 100%) | 100% (worst text 100%) | 100% (worst text 100%) | 93% (worst text 78%)   | 96% (worst text 89%)   | 100% (worst text 100%) | 81% (worst text 44%)   |

### Module size, preset colors (px per module in the capture, front-on)

Neon is read by the inverted-aware readers here.

| Condition    | classic | dots | rounded | bricks | gems | bubbles | neon |
| ------------ | ------- | ---- | ------- | ------ | ---- | ------- | ---- |
| 3 px         | 75%     | 92%  | 83%     | 92%    | 83%  | 75%     | 75%  |
| 4 px         | 100%    | 100% | 100%    | 100%   | 100% | 100%    | 92%  |
| 6 px         | 100%    | 100% | 100%    | 83%    | 100% | 100%    | 92%  |
| 8 px (front) | 100%    | 100% | 100%    | 100%   | 100% | 100%    | 100% |

### The toy's own camera turned in 3D (real depth), preset colors

Plain readers; the camera's yaw or pitch turned 10°, 20° or 35° from Scan view. Compare with the
2D-warped tilt rows above.

| View (full size, or shrunk to 8 or 4 px per module) | classic | bricks | gems | bubbles | neon |
| --------------------------------------------------- | ------- | ------ | ---- | ------- | ---- |
| yaw10@full                                          | 100%    | 67%    | 92%  | 67%     | 0%   |
| yaw10@8                                             | 92%     | 83%    | 92%  | 83%     | 0%   |
| yaw10@4                                             | 92%     | 67%    | 83%  | 83%     | 0%   |
| yaw20@full                                          | 92%     | 58%    | 75%  | 33%     | 0%   |
| yaw20@8                                             | 75%     | 58%    | 75%  | 75%     | 0%   |
| yaw20@4                                             | 92%     | 33%    | 75%  | 83%     | 0%   |
| yaw35@full                                          | 58%     | 0%     | 8%   | 25%     | 0%   |
| yaw35@8                                             | 75%     | 0%     | 58%  | 75%     | 0%   |
| yaw35@4                                             | 75%     | 0%     | 0%   | 25%     | 0%   |
| pitch10@full                                        | 92%     | 67%    | 67%  | 42%     | 0%   |
| pitch10@8                                           | 100%    | 92%    | 83%  | 92%     | 0%   |
| pitch10@4                                           | 100%    | 100%   | 75%  | 92%     | 0%   |
| pitch20@full                                        | 83%     | 25%    | 58%  | 42%     | 0%   |
| pitch20@8                                           | 100%    | 0%     | 75%  | 75%     | 0%   |
| pitch20@4                                           | 100%    | 0%     | 0%   | 33%     | 0%   |
| pitch35@full                                        | 75%     | 0%     | 0%   | 0%      | 0%   |
| pitch35@8                                           | 50%     | 0%     | 0%   | 0%      | 0%   |
| pitch35@4                                           | 25%     | 0%     | 0%   | 0%      | 0%   |

## Why settings fail (likely causes; the lab measured the effects, not the causes)

- **Contrast** is the clearest driver: 4:1 and up read 96–100%; 2.5:1 does not. The depth styles
  lose most because their shading and shadows eat into the little contrast left.
- **Real depth:** Bricks and Gems build raised blocks. Viewed at an angle, a block's side face and
  shadow fill the light module beside it and the readers lose the modules; the 2D-warped tilt rows
  above (a flat picture, tilted) read far better than the toy's own camera at the same angle,
  because tilting a flat picture leaves the depth cues out. Read the 3D table for the real answer.
- **Density:** with fixed pixels per module, the version-6 and larger codes (the 104-character text,
  and Q or H levels) put more modules in the same area, and the depth styles fall first.
- **Light on dark:** plain readers only look for dark modules on a light ground. The inverted-aware
  readers read Neon (a thin glowing tube on a dark plate), but Bricks and Gems, whose light colored
  blocks carry dark side shading, do not survive being inverted.
- **Soft edges and glow** were not the main failure for the toy's styles: Neon's glow stays on its
  dark plate and reads at 90–98% once inverted codes are tried.

## Method notes and limits

- Capture conditions: `front`, `tilt20`, `tilt35` (yaw), `mod3`, `mod4`, `mod6` (px per module),
  `blur20` (a Gaussian blur of 0.2 module), `jpeg30` (quality 30 plus noise), `light30` (brightness
  falling 30% across the image), `persp` (8° yaw, 12° pitch, 5° roll), `phone` and `hard`
  (combinations). `tools/qr-scan-lab/sim.mjs` has the exact recipes. The sweep pooled these; the 2D
  sample is thinner than the reference run's full list of 22 conditions.
- 3D captures: the toy's own camera turned from Scan view by yaw or pitch of 10°, 20° and 35°
  (`player.renderAt`, 1024 px), read as shot and shrunk to 8 and 4 px per module. Each cell is 12
  captures (4 levels × 3 texts), so single cells swing by 8 points.
- Schemes: each style's own preset on all three texts; pastel, gray, a linear gradient, a separate
  eye color and an inverted (white on dark) scheme on the 43-character text only (the sweep was
  trimmed to fit the time). The inverted scheme and Neon are reported apart from the others.
- Stale renders: three renders (Classic Q at 104 characters, Bubbles Q at 43, Bubbles H at 19) came
  back showing the previous code while three browsers shared four cores; the lab now waits for
  `check()` and re-shoots when a render reads back as another text. Lane QR may want to check that
  `set()` always resolves after the rebuild. Those three jobs were rerun and are in the data.
- Raw rows: `tools/qr-scan-lab/data/toy-*-results.csv`. The reference-code run from the first
  version of the lab (`reference-*`) is kept as a control: the toy's styles read much better than
  those stand-ins did.
