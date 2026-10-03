# QR scan lab scorecard (October 2026)

**Status: provisional, October 3, 2026.** Lane QR has not pushed its toy yet, so every number below
comes from reference codes the lab draws itself (five stand-in styles, from a pinned encoder). They
show how the readers react to each look. They are not scores for the toy. The tables are rebuilt
from the toy with `node tools/qr-scan-lab.mjs --source=toy` and
`node tools/qr-scan-lab/report.mjs toy`.

## Summary

- Method: 5 styles × 4 error correction levels × 6 color schemes × 22 capture conditions = 2,640
  captures of one 43-character URL (version 4, 5, or 6 depending on the level).
- A capture counts only when **both** jsQR 1.4.0 and zxing-js 0.21.3 return the exact text.
- Solid square cells (classic) scored 91% pooled; every look that changes the cell shape scored
  lower, and glowing tubes scored lowest (38%).
- Pale colors fail: pastel (contrast 3.0:1) and mid gray (3.9:1) drop bricks to 27–36% and glow to
  9–14%. Classic still scores 85–92% on them.
- Inverted codes (light on dark) decoded 0% of the time in both readers.
- Module size 2 px never decodes; 3 px and up does for the plain styles. Big modules (12 px) hurt
  the shaped styles; the cause is not isolated yet.
- jsQR and zxing disagree a lot on round styles (dots: jsQR 61%, zxing 94%), so a code that one
  reader takes is not proof for the other. The toy's own check should not stand in for both.
- Results swing with the exact code (version, mask, alignment pattern). One passing render is not
  enough; the test must cover a few texts.

## Provisional safe defaults for lane QR

Subject to change once the toy is measured.

- Dark on light only. Warn on inverted: "many readers won't scan light-on-dark codes".
- Minimum contrast between dark and light modules: 4.5:1 for crisp styles; 7:1 for bricks, bubbles,
  gems and neon (pastel and gray failed these at 3.0 to 3.9:1).
- Error correction: H for every shaped style (dots went from 37–55% at L, M and Q to 92% at H); M is
  enough for classic.
- Keep finder patterns and alignment patterns solid squares, with no glow, shadow or round corners.
- Keep depth shadows and glow out of the light modules next to dark ones.
- Show a warning when the code would render under about 4 px per module in Scan view.

## Findings

### Decode rate per style (all colors except inverted; both readers must decode the exact text)

| Style   | Both | jsQR | zxing |
| ------- | ---- | ---- | ----- |
| glow    | 38%  | 44%  | 69%   |
| rounded | 52%  | 60%  | 83%   |
| dots    | 58%  | 61%  | 94%   |
| bricks  | 60%  | 65%  | 69%   |
| classic | 91%  | 97%  | 91%   |

### Decode rate per condition, worst first (every error correction level and color scheme pooled)

| Condition | classic | dots | rounded | bricks | glow |
| --------- | ------- | ---- | ------- | ------ | ---- |
| mod2      | 0%      | 0%   | 0%      | 0%     | 0%   |
| mod12     | 90%     | 40%  | 10%     | 0%     | 0%   |
| jpeg30    | 100%    | 40%  | 10%     | 25%    | 10%  |
| jpeg15    | 95%     | 55%  | 5%      | 25%    | 5%   |
| jpeg60    | 100%    | 35%  | 35%     | 15%    | 10%  |
| blur35    | 60%     | 80%  | 0%      | 100%   | 25%  |
| light60   | 100%    | 35%  | 35%     | 55%    | 40%  |
| light30   | 100%    | 35%  | 35%     | 55%    | 45%  |
| persp     | 100%    | 65%  | 10%     | 60%    | 35%  |
| front     | 100%    | 35%  | 35%     | 55%    | 55%  |
| tilt10    | 100%    | 25%  | 60%     | 60%    | 40%  |
| tilt20    | 100%    | 30%  | 90%     | 40%    | 30%  |
| tilt35    | 100%    | 85%  | 55%     | 60%    | 10%  |
| hard      | 100%    | 100% | 10%     | 90%    | 50%  |
| tilt28    | 100%    | 75%  | 90%     | 60%    | 30%  |
| blur10    | 100%    | 50%  | 85%     | 85%    | 50%  |
| phone     | 70%     | 85%  | 85%     | 95%    | 60%  |
| mod4      | 100%    | 50%  | 100%    | 80%    | 70%  |
| blur20    | 80%     | 80%  | 100%    | 95%    | 50%  |
| mod6      | 100%    | 75%  | 95%     | 85%    | 70%  |
| mod3      | 100%    | 100% | 100%    | 80%    | 70%  |
| mod5      | 100%    | 100% | 100%    | 100%   | 85%  |

### Decode rate per color scheme

| Scheme   | classic | dots | rounded | bricks | glow |
| -------- | ------- | ---- | ------- | ------ | ---- |
| bw       | 92%     | 56%  | 60%     | 80%    | 61%  |
| navy     | 92%     | 58%  | 56%     | 75%    | 59%  |
| red      | 92%     | 60%  | 49%     | 82%    | 48%  |
| pastel   | 85%     | 56%  | 51%     | 27%    | 9%   |
| gray     | 92%     | 60%  | 44%     | 36%    | 14%  |
| inverted | 0%      | 0%   | 0%      | 0%     | 0%   |

### Decode rate per error correction level

| Level | classic | dots | rounded | bricks | glow |
| ----- | ------- | ---- | ------- | ------ | ---- |
| L     | 93%     | 48%  | 66%     | 56%    | 49%  |
| M     | 82%     | 55%  | 52%     | 60%    | 25%  |
| Q     | 94%     | 37%  | 48%     | 58%    | 30%  |
| H     | 95%     | 92%  | 42%     | 65%    | 48%  |

## Why settings fail (likely causes; not yet isolated with single-factor runs)

- **Soft edges and glow** (glow, 38%): the halo raises the light modules' darkness, so the
  binarizers pick a wrong threshold. It fails worst under JPEG noise and uneven light.
- **Depth shadows** (bricks): a drop shadow beside each brick darkens the light modules; low
  contrast colors then merge them with the dark ones (27–36% on pastel and gray).
- **Round and merged cells** (dots, rounded): the readers sample the center of each module, which
  round cells leave smaller, so noise and blur flip bits. Higher error correction compensates.
- **Contrast**: below about 4:1 every non-classic style loses most captures.

## Files

- Harness: `tools/qr-scan-lab.mjs`, `tools/qr-scan-lab/` (`sim.mjs` the capture simulator,
  `readers.mjs`, `reference.mjs`, `report.mjs`).
- Raw results: `tools/qr-scan-lab/data/reference-results.csv` (one row per capture) and
  `reference-summary.json`; grid images per style show every condition (green = both readers
  decode).
