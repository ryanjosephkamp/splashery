<!-- splashery-ci -->

## ❌ Test suite on GitHub Actions (`c36c4dc`)

- 399 of 399 spec files, 3404 tests: 3400 passed, 3 failed, 1 skipped.
- 16 shards; the longest took 36 min; the whole run about 43 min so far.
  [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39055412385) has the reports
  and failure screenshots (kept 7 days).

### Failed

| Test                                                                                                | Alone            | Error                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `cdx-mir:329` matched camera frames keep real feature contrast and improve held-pose stability      | **passed alone** | failed: Error: expect(received).toBeLessThan(expected)    |
| `fx4-engine:79` toys without the rim kind draw as before (webgpu)                                   | **passed alone** | timedOut: Test timeout of 240000ms exceeded.              |
| `phy:64` (known on main) Pebbles: stones pick up and stack into a new cairn; a careless one topples | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed
alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files |   Time |
| ----- | ----: | -----: |
| 1/16  |    16 | 36 min |
| 2/16  |    25 | 16 min |
| 3/16  |    24 | 21 min |
| 4/16  |    24 | 15 min |
| 5/16  |    24 | 12 min |
| 6/16  |    26 | 29 min |
| 7/16  |    26 | 17 min |
| 8/16  |    26 | 24 min |
| 9/16  |    26 | 21 min |
| 10/16 |    26 | 18 min |
| 11/16 |    26 | 20 min |
| 12/16 |    26 | 17 min |
| 13/16 |    26 | 21 min |
| 14/16 |    26 | 21 min |
| 15/16 |    26 | 20 min |
| 16/16 |    26 | 18 min |

</details>

<details><summary>Slowest files</summary>

| File              | Seconds | Tests |
| ----------------- | ------: | ----: |
| cdx-pics          |    2138 |    51 |
| smoke             |     906 |    62 |
| cdx-qr-themes     |     852 |    59 |
| ui2               |     780 |    11 |
| lv7               |     592 |    11 |
| qrs-toys          |     578 |     4 |
| qr                |     566 |    12 |
| scr2              |     565 |     6 |
| cdx-mp2-r4-raster |     553 |     7 |
| fx4-engine        |     536 |     4 |
| kit               |     536 |    10 |
| img-engine        |     525 |     4 |
| cdx-mir           |     473 |    11 |
| shp               |     470 |     8 |
| psv3              |     429 |    20 |
| qr5               |     395 |     5 |
| phy               |     375 |     6 |
| asc-repeat        |     369 |     1 |
| geo               |     361 |    16 |
| wdh               |     340 |     9 |

</details>
