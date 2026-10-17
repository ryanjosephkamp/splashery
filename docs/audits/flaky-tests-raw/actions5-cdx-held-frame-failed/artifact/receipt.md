<!-- splashery-flaky-cdx-mir-after -->
### cdx-mir: after stress receipt

Source: `cf10f12f6fd15913059124a40391f3b2df8db5c4`; 30 repetitions, 4 workers, 2 CPU burners, llvmpipe, v22.23.3, Chromium 141.0.7390.37. [Run](https://github.com/ryanjosephkamp/splashery/actions/runs/39013302972).

| Variant | Passed | Failed | Skipped/interrupted |
| --- | ---: | ---: | ---: |
| cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline | 27 | 3 | 0 |
| cdx-mir.spec.mjs › real depth worker with a fake camera › low-light: measured drift stays below the baseline | 30 | 0 | 0 |

<details><summary>Exact failure evidence</summary>

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-b754d4219daafca871ae (chromium, 2026-10-17T08:23:53.792Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.00055
Received:   0.0006253623793757445

  309 |         const m = await measure(page, { answers: 6 });
  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
> 311 |         expect(m.heightJitter).toBeLessThan(height);
      |                                ^
  312 |         expect(m.shownJitter).toBeLessThan(shown);
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:311:32
```

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-8edde657eb9799acf56a (chromium, 2026-10-17T08:35:45.896Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.00055
Received:   0.0005780562775226327

  309 |         const m = await measure(page, { answers: 6 });
  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
> 311 |         expect(m.heightJitter).toBeLessThan(height);
      |                                ^
  312 |         expect(m.shownJitter).toBeLessThan(shown);
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:311:32
```

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-b9bf6f1ff9db50625323 (chromium, 2026-10-17T09:15:38.807Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.00055
Received:   0.0005951547928087347

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
