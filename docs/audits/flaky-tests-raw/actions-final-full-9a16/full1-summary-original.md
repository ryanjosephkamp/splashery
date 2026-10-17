<!-- splashery-ci -->
## ❌ Test suite on GitHub Actions (`9a16ae2`)

- 398 of 398 spec files, 3409 tests: 3407 passed, 1 failed, 1 skipped.
- 16 shards; the longest took 25 min; the whole run about 46 min so far. [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39031193271) has the reports and failure screenshots (kept 7 days).

### Failed

| Test | Alone | Error |
| --- | --- | --- |
| `pages-r2:495` opaque tilted PDF faces cover their own paper backing (webgl2) | failed | failed: Error: expect(received).toBeLessThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files | Time |
| --- | ---: | ---: |
| 1/16 | 15 | 21 min |
| 2/16 | 25 | 12 min |
| 3/16 | 25 | 16 min |
| 4/16 | 25 | 18 min |
| 5/16 | 25 | 15 min |
| 6/16 | 26 | 25 min |
| 7/16 | 26 | 19 min |
| 8/16 | 26 | 24 min |
| 9/16 | 26 | 19 min |
| 10/16 | 26 | 19 min |
| 11/16 | 26 | 21 min |
| 12/16 | 26 | 18 min |
| 13/16 | 26 | 25 min |
| 14/16 | 25 | 23 min |
| 15/16 | 25 | 18 min |
| 16/16 | 25 | 18 min |

</details>

<details><summary>Slowest files</summary>

| File | Seconds | Tests |
| --- | ---: | ---: |
| cdx-pics | 1255 | 51 |
| cdx-qr-themes | 858 | 59 |
| ui2 | 776 | 11 |
| smoke | 769 | 62 |
| scr2 | 706 | 6 |
| kit | 600 | 10 |
| qrs-toys | 579 | 4 |
| cdx-mp2-r4-raster | 566 | 7 |
| qr | 564 | 12 |
| shp | 553 | 8 |
| cdx-mir | 522 | 11 |
| qr5 | 493 | 5 |
| psv3 | 423 | 20 |
| pages-r2-occlusion | 384 | 6 |
| geo | 383 | 16 |
| asc-repeat | 376 | 1 |
| lv7 | 372 | 11 |
| ui3 | 371 | 8 |
| img-engine | 367 | 8 |
| wd | 356 | 16 |

</details>
