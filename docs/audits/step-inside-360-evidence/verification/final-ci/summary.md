<!-- splashery-ci -->

## ❌ Test suite on GitHub Actions (`f94345f`)

- 401 of 401 spec files, 3416 tests: 3412 passed, 3 failed, 1 skipped.
- 16 shards; the longest took 41 min; the whole run about 2 h 27 min so far.
  [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39019832991) has the reports
  and failure screenshots (kept 7 days).

### Failed

| Test                                                                                                | Alone            | Error                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `pages-r2:495` opaque tilted PDF faces cover their own paper backing (webgl2)                       | failed           | failed: Error: expect(received).toBeLessThan(expected)    |
| `phy:64` (known on main) Pebbles: stones pick up and stack into a new cairn; a careless one topples | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |
| `shp:131` with ?sharp=0 the renderer is exactly as before, labs on or off                           | **passed alone** | failed: Error: expect(received).toBeLessThan(expected)    |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed
alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files |   Time |
| ----- | ----: | -----: |
| 1/16  |    16 | 41 min |
| 2/16  |    25 | 15 min |
| 3/16  |    24 | 19 min |
| 4/16  |    25 | 13 min |
| 5/16  |    25 | 16 min |
| 6/16  |    26 | 24 min |
| 7/16  |    26 | 22 min |
| 8/16  |    26 | 19 min |
| 9/16  |    26 | 14 min |
| 10/16 |    26 | 20 min |
| 11/16 |    26 | 23 min |
| 12/16 |    26 | 22 min |
| 13/16 |    26 | 19 min |
| 14/16 |    26 | 18 min |
| 15/16 |    26 | 22 min |
| 16/16 |    26 | 19 min |

</details>

<details><summary>Slowest files</summary>

| File               | Seconds | Tests |
| ------------------ | ------: | ----: |
| cdx-pics           |    2035 |    51 |
| smoke              |     902 |    62 |
| cdx-qr-themes      |     852 |    59 |
| ui2                |     750 |    11 |
| qr                 |     568 |    12 |
| shp                |     563 |     8 |
| cdx-mp2-r4-raster  |     562 |     7 |
| kit                |     560 |    10 |
| img-engine         |     521 |     4 |
| cdx-mir            |     478 |    11 |
| scr2               |     459 |     6 |
| lv7                |     423 |    11 |
| cdx-mp2-r4         |     423 |    13 |
| wdr3               |     423 |     7 |
| phy                |     396 |     6 |
| qr5                |     395 |     5 |
| geo                |     365 |    16 |
| asc-repeat         |     365 |     1 |
| pages-r2-occlusion |     363 |     6 |
| qrs-toys           |     347 |     4 |

</details>
