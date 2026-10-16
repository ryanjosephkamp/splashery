| Profile | Toy / input          | First page, s (main → round 2) |     Frames/s |     Memory, MB | Edge preservation gain | SSIM gain | Checks    |
| ------- | -------------------- | -----------------------------: | -----------: | -------------: | ---------------------: | --------: | --------- |
| phone   | picture-lab / photo  |                    0.58 → 0.58 | 7.97 → 14.49 |  641.3 → 615.6 |                 339.2% |     0.039 | firstPage |
| phone   | picture-lab / chart  |                    0.71 → 0.44 | 5.99 → 25.14 |  712.8 → 624.1 |                 351.0% |     0.029 | pass      |
| phone   | picture-lab / text   |                    1.01 → 0.73 | 6.39 → 25.96 |  697.1 → 629.3 |                  73.8% |     0.049 | pass      |
| phone   | picture-lab / sample |                    6.33 → 3.29 | 5.76 → 12.15 |  721.5 → 637.0 |                 123.2% |     0.093 | pass      |
| phone   | your-book / sample   |                    6.42 → 5.51 |  5.50 → 5.69 |  854.1 → 778.3 |                 281.1% |     0.155 | pass      |
| phone   | your-book / text     |                    1.56 → 1.68 | 7.75 → 11.58 |  718.5 → 673.0 |                 230.6% |     0.126 | firstPage |
| phone   | your-book / photo    |                    2.34 → 1.81 | 6.48 → 12.69 |  744.3 → 697.5 |                 286.8% |     0.075 | pass      |
| phone   | your-book / chart    |                    2.78 → 1.52 | 6.76 → 11.82 |  738.9 → 710.3 |                 166.9% |     0.036 | pass      |
| phone   | photo-album / sample |                    3.55 → 2.67 |  1.94 → 7.04 | 1023.3 → 680.6 |                 104.3% |     0.109 | pass      |
| phone   | photo-album / text   |                    2.64 → 2.39 |  4.77 → 8.23 |  797.8 → 645.3 |                 142.4% |     0.113 | pass      |
| phone   | photo-album / photo  |                    2.83 → 2.74 |  2.24 → 7.98 |  843.7 → 630.0 |                  93.4% |     0.047 | pass      |
| phone   | photo-album / chart  |                    3.75 → 2.42 |  2.98 → 4.60 |  818.6 → 647.1 |                  65.1% |     0.045 | pass      |
| desktop | picture-lab / sample |                    8.28 → 6.35 |  6.99 → 9.18 |  832.8 → 749.8 |                 104.1% |     0.096 | pass      |
| desktop | picture-lab / text   |                    3.06 → 4.07 |  5.58 → 5.99 |  773.2 → 718.0 |                  82.7% |     0.119 | firstPage |
| desktop | picture-lab / photo  |                    3.66 → 3.59 |  2.28 → 8.50 |  908.1 → 792.0 |                 181.7% |     0.020 | pass      |
| desktop | picture-lab / chart  |                    1.85 → 1.19 | 3.39 → 17.57 |  876.5 → 748.3 |                 162.6% |     0.005 | pass      |
| desktop | your-book / sample   |                    7.92 → 5.96 |  3.99 → 5.39 |  967.2 → 969.2 |                  85.7% |     0.116 | memory    |
| desktop | your-book / text     |                    3.15 → 3.07 |  3.19 → 4.19 |  857.0 → 829.0 |                 173.5% |     0.090 | pass      |
| desktop | your-book / photo    |                    5.90 → 4.50 |  2.79 → 3.79 |  910.2 → 845.6 |                 146.2% |     0.057 | pass      |

Memory uses proportional resident size when both runs include it; otherwise it uses the same
JavaScript estimate plus renderer resource counters. Values are medians. Edge preservation is
rendered Laplacian variance divided by the source's variance at the displayed size. Phone text
inputs require at least 30% more edge preservation, at least 30% more raw Laplacian variance, and
0.03 more SSIM. Registration must match within 2% in both dimensions. Motion inspection and the
regression suite are separate requirements.
