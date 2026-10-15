<!-- splashery-ci -->
## ❌ Test suite on GitHub Actions (`c0c9244`)

- 308 of 308 spec files, 2538 tests: 2525 passed, 12 failed, 1 skipped.
- 16 shards; the longest took 36 min; the whole run about 1 h 43 min so far. [The run](https://github.com/ryanjosephkamp/splashery/actions/runs/38694998728) has the reports and failure screenshots (kept 7 days).

### Failed

| Test | Alone | Error |
| --- | --- | --- |
| `cdx-mir:294` real depth worker with a fake camera › still: measured drift stays below the baseline | **passed alone** | failed: Error: expect(received).toBeLessThan(expected) |
| `cdx-mir:329` matched camera frames keep real feature contrast and improve held-pose stability | **passed alone** | failed: Error: expect(received).toBeLessThan(expected) |
| `cdx-v3d:551` a real decoded blank clip is rejected quickly without requiring WebGPU | **passed alone** | failed: Error: {"checked":false,"verdict":"unknown","message":"Could not check this video quickly. Try an MP4 or WebM, or a shorter stretch. Training may still work."," |
| `hh3-engine2:122` strings: a drag across the guitar's strings plucks each one, in turn | **passed alone** | failed: Error: expect(received).toEqual(expected) // deep equality |
| `hh4-tiny:206` chromosome: the chromatids pulled apart at the waist spring back together | failed | failed: Error: expect(received).toBeCloseTo(expected, precision) |
| `man5:201` (known on main) the PDF › the same input and the same Chromium print the same bytes | failed | failed: Error: run tools/manual-pdf.mjs again: the shipped PDF is out of date |
| `ops-text:41` a PDF's words in the Toy tab › your book: the words of the page on show, following the pages, copied and found | failed | failed: Error: expect(locator).toHaveAttribute(expected) failed |
| `sndc-engine:27` (known on main) a paused effect's sound stops at once (ringing notes too) and resumes from the same moment | **passed alone** | failed: Error: expect(received).toBeGreaterThan(expected) |
| `spg:46` site pages › the credits page lists every entry in CREDITS.md and every library in LICENSES.md | failed | failed: Error: expect(received).toEqual(expected) // deep equality |
| `spg:138` (known on main) site pages › the embed guide builds the snippets and shows a live toy | failed | timedOut: Tearing down "context" exceeded the test timeout of 240000ms. |
| `ui2:361` (known on main) computer › the pad inks by distance, not by events, and the eraser clears | **passed alone** | failed: Error: expect(received).toBeLessThan(expected) |
| `ui3:50` (known on main) pause and resume › the second tap freezes a long effect and its sound, the third resumes it, and a tap after the end starts it again | failed | failed: Error: expect(received).toBeGreaterThan(expected) |

A failure that passed alone is likely a flake (a busy runner); it still counts. One that failed alone too is real.

<details><summary>Time per shard</summary>

| Shard | Files | Time |
| --- | ---: | ---: |
| 1/16 | 4 | 36 min |
| 2/16 | 18 | 15 min |
| 3/16 | 19 | 16 min |
| 4/16 | 20 | 14 min |
| 5/16 | 20 | 15 min |
| 6/16 | 21 | 11 min |
| 7/16 | 21 | 11 min |
| 8/16 | 21 | 18 min |
| 9/16 | 21 | 15 min |
| 10/16 | 21 | 17 min |
| 11/16 | 21 | 24 min |
| 12/16 | 20 | 23 min |
| 13/16 | 20 | 22 min |
| 14/16 | 21 | 20 min |
| 15/16 | 20 | 19 min |
| 16/16 | 20 | 22 min |

</details>

<details><summary>Slowest files</summary>

| File | Seconds | Tests |
| --- | ---: | ---: |
| cdx-pics | 2135 | 51 |
| ui2 | 786 | 11 |
| smoke | 756 | 50 |
| lv7 | 599 | 11 |
| qrs-toys | 569 | 4 |
| scr2 | 550 | 6 |
| psv3 | 539 | 16 |
| cdx-mir | 527 | 10 |
| img-engine | 520 | 4 |
| fx4-engine | 512 | 4 |
| kit | 482 | 10 |
| qr5 | 462 | 5 |
| bk | 434 | 35 |
| asc-repeat | 421 | 1 |
| wdr3 | 413 | 7 |
| site | 410 | 11 |
| geo | 396 | 16 |
| qr | 395 | 12 |
| ui3 | 394 | 8 |
| wd | 382 | 16 |

</details>
