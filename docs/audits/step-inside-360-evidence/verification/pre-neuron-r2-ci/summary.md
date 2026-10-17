<!-- splashery-ci -->

## ❌ Test suite on GitHub Actions (`652fe94`)

- 401 of 401 spec files, 3416 tests: 3413 passed, 2 failed, 1 skipped.
- 16 shards; the longest took 40 min; the whole run about 46 min so far.
  [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39007527856) has the reports
  and failure screenshots (kept 7 days).

### Failed

| Test                                                                                                 | Alone            | Error                                                     |
| ---------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `hh5-gems:154` quartz cluster: a big point snaps off the rock, rests, and clicks back into its place | **passed alone** | failed: Error: expect(received).toBeLessThan(expected)    |
| `phy:64` (known on main) Pebbles: stones pick up and stack into a new cairn; a careless one topples  | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed
alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files |   Time |
| ----- | ----: | -----: |
| 1/16  |    16 | 40 min |
| 2/16  |    25 | 18 min |
| 3/16  |    24 | 16 min |
| 4/16  |    25 | 19 min |
| 5/16  |    25 | 16 min |
| 6/16  |    26 | 15 min |
| 7/16  |    26 | 22 min |
| 8/16  |    26 | 17 min |
| 9/16  |    26 | 13 min |
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
| cdx-pics          |    2020 |    51 |
| cdx-qr-themes     |    1437 |    59 |
| smoke             |     758 |    62 |
| scr2              |     687 |     6 |
| cdx-mir           |     576 |    11 |
| cdx-mp2-r4-raster |     566 |     7 |
| qrs-toys          |     566 |     4 |
| qr                |     565 |    12 |
| shp               |     560 |     8 |
| img-engine        |     527 |     4 |
| qr5               |     501 |     5 |
| ui2               |     438 |    11 |
| wdr3              |     429 |     7 |
| psv3              |     419 |    20 |
| bk                |     404 |    36 |
| cdx-mp2-r4        |     395 |    13 |
| lv7               |     394 |    11 |
| geo               |     375 |    16 |
| phy               |     375 |     6 |
| wd                |     369 |    16 |

</details>
