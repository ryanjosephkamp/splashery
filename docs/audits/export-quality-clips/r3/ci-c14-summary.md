<!-- splashery-ci -->

## ❌ Test suite on GitHub Actions (`c14ddf3`)

- 314 of 314 spec files, 2756 tests: 2748 passed, 7 failed, 1 skipped.
- 16 shards; the longest took 36 min; the whole run about 1 h 15 min so far.
  [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/38777190217) has the reports
  and failure screenshots (kept 7 days).

### Failed

| Test                                                                                                                                                            | Alone            | Error                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `man5:201` (known on main) the PDF › the same input and the same Chromium print the same bytes                                                                  | failed           | failed: Error: run tools/manual-pdf.mjs again: the shipped PDF is out of date |
| `man5:252` the two new chapters › the library table lists every folder of vendor/, and LICENSES.md has each                                                     | failed           | failed: Error: mp4-muxer                                                      |
| `man7a:67` Chapter 3: the grid-to-torus figure moves › a live canvas walks a ring across the grid; reduced motion keeps it still                                | **passed alone** | failed: Error: expect(received).not.toBe(expected) // Object.is equality      |
| `math:368` the surface plotter plots a typed surface                                                                                                            | **passed alone** | failed: Error: expect(locator).toHaveText(expected) failed                    |
| `shr:135` 1440x900 › the Share tab: Record first, then a clip and a picture, the link and the scene file, PDF, and the web page; nothing cut off or overlapping | failed           | failed: Error: expect(received).toEqual(expected) // deep equality            |
| `spg:46` site pages › the credits page lists every entry in CREDITS.md and every library in LICENSES.md                                                         | failed           | failed: Error: expect(received).toEqual(expected) // deep equality            |
| `ui3:76` pause and resume › the second tap freezes a long effect and its sound, the third resumes it, and a tap after the end starts it again                   | **passed alone** | failed: Error: expect(received).toBe(expected) // Object.is equality          |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed
alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files |   Time |
| ----- | ----: | -----: |
| 1/16  |     7 | 36 min |
| 2/16  |    19 | 12 min |
| 3/16  |    20 | 17 min |
| 4/16  |    20 | 18 min |
| 5/16  |    20 | 12 min |
| 6/16  |    20 | 31 min |
| 7/16  |    21 | 17 min |
| 8/16  |    21 | 19 min |
| 9/16  |    20 | 21 min |
| 10/16 |    20 | 22 min |
| 11/16 |    21 | 15 min |
| 12/16 |    21 | 14 min |
| 13/16 |    21 | 29 min |
| 14/16 |    21 | 22 min |
| 15/16 |    21 | 15 min |
| 16/16 |    21 | 11 min |

</details>

<details><summary>Slowest files</summary>

| File          | Seconds | Tests |
| ------------- | ------: | ----: |
| cdx-pics      |    2178 |    51 |
| cdx-qr-themes |    1354 |    59 |
| ui2           |     897 |    11 |
| smoke         |     820 |    50 |
| cdx-export    |     701 |    21 |
| scr2          |     694 |     6 |
| psv3          |     628 |    20 |
| qrs-toys      |     582 |     4 |
| shp           |     577 |     8 |
| lv7           |     577 |    11 |
| kit           |     565 |    10 |
| site          |     488 |    11 |
| qr            |     452 |    12 |
| qr5           |     446 |     5 |
| geo           |     381 |    16 |
| st4           |     370 |    22 |
| ui3           |     366 |     8 |
| wdh           |     366 |     9 |
| pg6           |     348 |    16 |
| cdx-mir       |     335 |    11 |

</details>
