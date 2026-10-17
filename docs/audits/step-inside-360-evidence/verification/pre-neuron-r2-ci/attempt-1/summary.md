<!-- splashery-ci -->

## ❌ Test suite on GitHub Actions (`652fe94`)

- 401 of 401 spec files, 3416 tests: 3412 passed, 3 failed, 1 skipped.
- 16 shards; the longest took 40 min; the whole run about 2 h 23 min so far.
  [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39007527856) has the reports
  and failure screenshots (kept 7 days).

### Failed

| Test                                                                                                | Alone            | Error                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `fx4-engine:79` toys without the rim kind draw as before (webgpu)                                   | **passed alone** | timedOut: Test timeout of 240000ms exceeded.              |
| `hl1:92` Hands-on: lift, toss, land, settle and Reset                                               | **passed alone** | failed: Error: Level 1 gaps; full receipts are attached   |
| `phy:64` (known on main) Pebbles: stones pick up and stack into a new cairn; a careless one topples | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed
alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files |   Time |
| ----- | ----: | -----: |
| 1/16  |    16 | 40 min |
| 2/16  |    25 | 18 min |
| 3/16  |    24 | 16 min |
| 4/16  |    25 | 19 min |
| 5/16  |    25 | 10 min |
| 6/16  |    26 | 15 min |
| 7/16  |    26 | 22 min |
| 8/16  |    26 | 17 min |
| 9/16  |    26 | 20 min |
| 10/16 |    26 | 20 min |
| 11/16 |    26 | 37 min |
| 12/16 |    26 | 22 min |
| 13/16 |    26 | 23 min |
| 14/16 |    26 | 21 min |
| 15/16 |    26 | 22 min |
| 16/16 |    26 | 18 min |

</details>

<details><summary>Slowest files</summary>

| File              | Seconds | Tests |
| ----------------- | ------: | ----: |
| cdx-pics          |    1987 |    51 |
| cdx-qr-themes     |    1437 |    59 |
| smoke             |     758 |    62 |
| scr2              |     687 |     6 |
| lv7               |     579 |    11 |
| cdx-mir           |     576 |    11 |
| cdx-mp2-r4-raster |     566 |     7 |
| qrs-toys          |     566 |     4 |
| qr                |     565 |    12 |
| shp               |     560 |     8 |
| fx4-engine        |     541 |     4 |
| img-engine        |     527 |     4 |
| qr5               |     501 |     5 |
| ui2               |     438 |    11 |
| psv3              |     419 |    20 |
| bk                |     404 |    36 |
| cdx-mp2-r4        |     395 |    13 |
| phy               |     387 |     6 |
| geo               |     375 |    16 |
| wd                |     369 |    16 |

</details>
