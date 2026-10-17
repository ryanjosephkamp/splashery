<!-- splashery-ci -->
## ❌ Test suite on GitHub Actions (`9a16ae2`)

- 398 of 398 spec files, 3409 tests: 3407 passed, 1 failed, 1 skipped.
- 16 shards; the longest took 38 min; the whole run about 1 h 2 min so far. [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39031195607) has the reports and failure screenshots (kept 7 days).

### Failed

| Test | Alone | Error |
| --- | --- | --- |
| `pages-r2:495` opaque tilted PDF faces cover their own paper backing (webgl2) | failed | failed: Error: expect(received).toBeLessThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files | Time |
| --- | ---: | ---: |
| 1/16 | 15 | 35 min |
| 2/16 | 25 | 19 min |
| 3/16 | 25 | 20 min |
| 4/16 | 25 | 14 min |
| 5/16 | 25 | 18 min |
| 6/16 | 26 | 14 min |
| 7/16 | 26 | 20 min |
| 8/16 | 26 | 38 min |
| 9/16 | 26 | 14 min |
| 10/16 | 26 | 15 min |
| 11/16 | 26 | 21 min |
| 12/16 | 26 | 18 min |
| 13/16 | 26 | 21 min |
| 14/16 | 25 | 19 min |
| 15/16 | 25 | 12 min |
| 16/16 | 25 | 17 min |

</details>

<details><summary>Slowest files</summary>

| File | Seconds | Tests |
| --- | ---: | ---: |
| cdx-pics | 2121 | 51 |
| cdx-qr-themes | 1387 | 59 |
| smoke | 921 | 62 |
| qrs-toys | 576 | 4 |
| shp | 571 | 8 |
| cdx-mp2-r4-raster | 562 | 7 |
| scr2 | 514 | 6 |
| cdx-mp2-r4 | 478 | 13 |
| qr | 444 | 12 |
| psv3 | 429 | 20 |
| ui2 | 424 | 11 |
| wdr3 | 417 | 7 |
| cdx-mir | 417 | 11 |
| bk | 401 | 36 |
| qr5 | 390 | 5 |
| asc-repeat | 376 | 1 |
| psv2 | 353 | 6 |
| pages-r2-occlusion | 319 | 6 |
| lv7 | 311 | 11 |
| kit | 307 | 10 |

</details>
