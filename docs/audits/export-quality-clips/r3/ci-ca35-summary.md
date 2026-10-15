<!-- splashery-ci -->

## ❌ Test suite on GitHub Actions (`ca35cab`)

- 319 of 319 spec files, 2806 tests: 2802 passed, 3 failed, 1 skipped.
- 16 shards; the longest took 36 min; the whole run about 41 min so far.
  [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/38816580752) has the reports
  and failure screenshots (kept 7 days).

### Failed

| Test                                                                                                | Alone            | Error                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `cdx-mir:294` real depth worker with a fake camera › still: measured drift stays below the baseline | **passed alone** | failed: Error: expect(received).toBeLessThan(expected)    |
| `hl1:92` Hands-on: lift, toss, land, settle and Reset                                               | **passed alone** | failed: Error: Level 1 gaps; full receipts are attached   |
| `smoke:1054` Settings panel (WebGL2) › the panel and the shelf can be made bigger on a wide screen  | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed
alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files |   Time |
| ----- | ----: | -----: |
| 1/16  |     8 | 32 min |
| 2/16  |    19 | 17 min |
| 3/16  |    20 | 21 min |
| 4/16  |    20 | 16 min |
| 5/16  |    20 | 16 min |
| 6/16  |    21 | 24 min |
| 7/16  |    21 | 17 min |
| 8/16  |    21 | 19 min |
| 9/16  |    22 | 19 min |
| 10/16 |    21 | 36 min |
| 11/16 |    21 | 15 min |
| 12/16 |    21 | 19 min |
| 13/16 |    21 | 25 min |
| 14/16 |    21 | 21 min |
| 15/16 |    21 | 19 min |
| 16/16 |    21 | 18 min |

</details>

<details><summary>Slowest files</summary>

| File          | Seconds | Tests |
| ------------- | ------: | ----: |
| cdx-pics      |    1895 |    51 |
| cdx-qr-themes |    1543 |    59 |
| smoke         |     952 |    50 |
| ui2           |     781 |    11 |
| psv3          |     605 |    20 |
| cdx-export    |     597 |    21 |
| scr2          |     581 |     6 |
| lv7           |     570 |    11 |
| qrs-toys      |     568 |     4 |
| kit           |     564 |    10 |
| shp           |     529 |     8 |
| cdx-mir       |     522 |    11 |
| img-engine    |     504 |     4 |
| fx4-engine    |     501 |     4 |
| qr5           |     499 |     5 |
| bk            |     462 |    36 |
| qr            |     460 |    12 |
| asc-repeat    |     450 |     1 |
| wdr3          |     420 |     7 |
| wdh           |     409 |     9 |

</details>
