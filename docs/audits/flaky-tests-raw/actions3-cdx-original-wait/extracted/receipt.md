<!-- splashery-flaky-cdx-mir-after -->
### cdx-mir: after stress receipt

Source: `23664b6dc4e289b50ea3035346f4a8846379ff13`; 30 repetitions, 4 workers, 2 CPU burners, llvmpipe, v22.23.3, Chromium 141.0.7390.37. [Run](https://github.com/ryanjosephkamp/splashery/actions/runs/39004136389).

| Variant | Passed | Failed | Skipped/interrupted |
| --- | ---: | ---: | ---: |
| cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline | 27 | 3 | 0 |
| cdx-mir.spec.mjs › real depth worker with a fake camera › low-light: measured drift stays below the baseline | 29 | 1 | 0 |

<details><summary>Exact failure evidence</summary>

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-a0a8b2d8df8d178efbb4 (chromium, 2026-10-17T05:42:03.300Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.95
Received:   0.9746031746031746

  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
  311 |         expect(m.heightJitter).toBeLessThan(height);
> 312 |         expect(m.shownJitter).toBeLessThan(shown);
      |                               ^
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
  315 |         expect(m.grid).toBe("423x317");
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:312:31
```

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-e0cf35f8d79a2953eaf4 (chromium, 2026-10-17T05:54:02.701Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.95
Received:   0.9712632275132275

  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
  311 |         expect(m.heightJitter).toBeLessThan(height);
> 312 |         expect(m.shownJitter).toBeLessThan(shown);
      |                               ^
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
  315 |         expect(m.grid).toBe("423x317");
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:312:31
```

**cdx-mir.spec.mjs › real depth worker with a fake camera › low-light: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-09a1d800f8fca86bf65d (chromium, 2026-10-17T06:00:08.921Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.0135
Received:   0.013697027806444346

  309 |         const m = await measure(page, { answers: 6 });
  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
> 311 |         expect(m.heightJitter).toBeLessThan(height);
      |                                ^
  312 |         expect(m.shownJitter).toBeLessThan(shown);
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:311:32
```

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-ac371e14f54b3ec2da29 (chromium, 2026-10-17T06:55:53.475Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.00055
Received:   0.0006261616953657017

  309 |         const m = await measure(page, { answers: 6 });
  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
> 311 |         expect(m.heightJitter).toBeLessThan(height);
      |                                ^
  312 |         expect(m.shownJitter).toBeLessThan(shown);
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:311:32
```

</details>
