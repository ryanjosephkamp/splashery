<!-- splashery-ci -->
## ❌ Test suite on GitHub Actions (`b7099b1`)

- 323 of 323 spec files, 2789 tests: 2781 passed, 7 failed, 1 skipped.
- 16 shards; the longest took 37 min; the whole run about 45 min so far. [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/38710387799) has the reports and failure screenshots (kept 7 days).

### Failed

| Test | Alone | Error |
| --- | --- | --- |
| `cdx-mir:329` matched camera frames keep real feature contrast and improve held-pose stability | **passed alone** | failed: Error: expect(received).toBeLessThan(expected) |
| `cdx-v3d-bench:523` the independent decoder matches selected JPEGs and detects an actually repeated frame | **passed alone** | failed: Error: expect(received).toThrow(expected) |
| `hl1:92` Hands-on: lift, toss, land, settle and Reset | **passed alone** | failed: Error: Level 1 gaps; full receipts are attached |
| `live5:63` a video plays with its own sound: the frames follow its clock, pause and scrub take both | **passed alone** | failed: Error: Timed out waiting for async m => (await import(m)).MOVING.clip?.audio?.track?.playing |
| `man5:201` (known on main) the PDF › the same input and the same Chromium print the same bytes | failed | failed: Error: run tools/manual-pdf.mjs again: the shipped PDF is out of date |
| `sndc-engine:27` (known on main) a paused effect's sound stops at once (ringing notes too) and resumes from the same moment | failed | failed: Error: expect(received).toBeGreaterThan(expected) |
| `ui3:50` (known on main) pause and resume › the second tap freezes a long effect and its sound, the third resumes it, and a tap after the end starts it again | failed | failed: Error: expect(received).toBeGreaterThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files | Time |
| --- | ---: | ---: |
| 1/16 | 8 | 37 min |
| 2/16 | 19 | 17 min |
| 3/16 | 20 | 18 min |
| 4/16 | 20 | 18 min |
| 5/16 | 21 | 12 min |
| 6/16 | 22 | 13 min |
| 7/16 | 22 | 14 min |
| 8/16 | 21 | 21 min |
| 9/16 | 21 | 18 min |
| 10/16 | 21 | 22 min |
| 11/16 | 21 | 22 min |
| 12/16 | 21 | 17 min |
| 13/16 | 21 | 16 min |
| 14/16 | 21 | 13 min |
| 15/16 | 22 | 14 min |
| 16/16 | 22 | 19 min |

</details>

<details><summary>Slowest files</summary>

| File | Seconds | Tests |
| --- | ---: | ---: |
| cdx-pics | 2210 | 51 |
| cdx-qr-themes | 851 | 59 |
| smoke | 846 | 50 |
| scr2 | 673 | 6 |
| psv3 | 631 | 16 |
| kit | 570 | 10 |
| site | 559 | 11 |
| ui2 | 533 | 11 |
| bk | 463 | 35 |
| shp | 456 | 8 |
| qr | 447 | 12 |
| img-engine | 415 | 4 |
| wdh | 405 | 9 |
| bk5 | 387 | 9 |
| lv7 | 384 | 11 |
| fx4-engine | 372 | 4 |
| cdx-mir | 353 | 10 |
| qrs-toys | 339 | 4 |
| asc-repeat | 334 | 1 |
| wdr3 | 327 | 7 |

</details>
