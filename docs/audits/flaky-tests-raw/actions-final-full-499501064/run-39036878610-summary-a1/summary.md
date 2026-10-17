<!-- splashery-ci -->
## ❌ Test suite on GitHub Actions (`4995010`)

- 398 of 398 spec files, 3409 tests: 3404 passed, 4 failed, 1 skipped.
- 16 shards; the longest took 39 min; the whole run about 1 h 43 min so far. [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/39036878610) has the reports and failure screenshots (kept 7 days).

### Failed

| Test | Alone | Error |
| --- | --- | --- |
| `cdx-a11y:196` keyboard focus can keep help open during its dismissal fade | **passed alone** | failed: Error: expect(locator).toHaveAttribute(expected) failed |
| `chs-engine:11` a tap that returns options rebuilds the toy with them, then fires its key | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |
| `hh5-animals:182` pufferfish: puffs while held, any way up; deflates slowly once let go | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |
| `lv7:393` the Chladni plate › your audio: no bow ever, no new plate, the sand sets off for each new note at once and holds when it stops | **passed alone** | failed: Error: expect(received).toBeLessThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files | Time |
| --- | ---: | ---: |
| 1/16 | 15 | 35 min |
| 2/16 | 25 | 16 min |
| 3/16 | 25 | 20 min |
| 4/16 | 25 | 19 min |
| 5/16 | 25 | 18 min |
| 6/16 | 26 | 24 min |
| 7/16 | 26 | 20 min |
| 8/16 | 26 | 39 min |
| 9/16 | 26 | 23 min |
| 10/16 | 26 | 19 min |
| 11/16 | 26 | 17 min |
| 12/16 | 26 | 18 min |
| 13/16 | 26 | 25 min |
| 14/16 | 25 | 24 min |
| 15/16 | 25 | 19 min |
| 16/16 | 25 | 18 min |

</details>

<details><summary>Slowest files</summary>

| File | Seconds | Tests |
| --- | ---: | ---: |
| cdx-pics | 2102 | 51 |
| cdx-qr-themes | 1411 | 59 |
| smoke | 922 | 62 |
| ui2 | 738 | 11 |
| scr2 | 718 | 6 |
| shp | 574 | 8 |
| qr | 563 | 12 |
| cdx-mp2-r4-raster | 562 | 7 |
| kit | 549 | 10 |
| cdx-mp2-r4 | 512 | 13 |
| cdx-mir | 511 | 11 |
| qr5 | 495 | 5 |
| qrs-toys | 452 | 4 |
| lv7 | 445 | 11 |
| wdr3 | 424 | 7 |
| pages-r2-occlusion | 396 | 6 |
| geo | 390 | 16 |
| fx4-engine | 389 | 8 |
| img-engine | 369 | 8 |
| asc-repeat | 368 | 1 |

</details>
