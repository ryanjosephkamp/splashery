| Profile | Toy / input          | First page, s (main → round 2) |      Frames/s |     Memory, MB | Edge preservation gain | SSIM gain | Checks    |
| ------- | -------------------- | -----------------------------: | ------------: | -------------: | ---------------------: | --------: | --------- |
| phone   | your-book / sample   |                    5.28 → 4.05 |   3.90 → 7.14 |  841.8 → 828.1 |                  97.5% |     0.066 | pass      |
| phone   | photo-album / sample |                    3.56 → 2.43 |   1.77 → 6.92 | 1021.8 → 726.1 |                 107.2% |     0.102 | pass      |
| phone   | picture-lab / text   |                    0.76 → 0.56 | 14.51 → 25.95 |  675.0 → 632.3 |                 183.6% |     0.065 | pass      |
| phone   | picture-lab / sample |                    2.73 → 1.80 | 12.56 → 26.30 |  692.9 → 651.4 |                 321.8% |     0.047 | pass      |
| phone   | picture-lab / photo  |                    0.53 → 0.39 |  8.30 → 30.23 |  684.3 → 619.1 |                 343.0% |     0.022 | pass      |
| phone   | picture-lab / chart  |                    0.57 → 0.31 |  6.36 → 25.83 |  688.3 → 621.8 |                 373.0% |     0.010 | pass      |
| phone   | your-book / text     |                    1.89 → 1.62 |  7.70 → 13.30 |  717.3 → 660.1 |                 171.2% |     0.083 | pass      |
| phone   | your-book / photo    |                    2.87 → 1.73 |  6.42 → 11.95 |  725.8 → 699.1 |                 164.3% |     0.052 | pass      |
| phone   | your-book / chart    |                    4.95 → 2.92 |   5.36 → 6.87 |  686.4 → 696.2 |                 204.9% |     0.031 | memory    |
| phone   | photo-album / text   |                    3.11 → 3.17 |   2.87 → 6.62 |  798.5 → 649.9 |                 148.3% |     0.081 | firstPage |
| phone   | photo-album / photo  |                    3.21 → 2.24 |   3.80 → 7.97 |  872.8 → 647.9 |                  94.4% |     0.026 | pass      |
| phone   | photo-album / chart  |                    5.07 → 2.31 |   2.99 → 7.59 |  798.2 → 663.8 |                  64.2% |     0.045 | pass      |

Memory uses proportional resident size when both runs include it; otherwise it uses the same
JavaScript estimate plus renderer resource counters. Values are medians. Edge preservation is
rendered Laplacian variance divided by the source's variance at the displayed size. Phone text
inputs require at least 30% more edge preservation, at least 30% more raw Laplacian variance, and
0.03 more SSIM. Registration must match within 2% in both dimensions. Motion inspection and the
regression suite are separate requirements.
