<!-- splashery-flaky-cdx-mir-after -->
### cdx-mir: after stress receipt

Source: `b87f6132c9764cf616fe2afa41c77d73799975ab`; 30 repetitions, 4 workers, 2 CPU burners, llvmpipe, v22.23.3, Chromium 141.0.7390.37. [Run](https://github.com/ryanjosephkamp/splashery/actions/runs/39008834947).

| Variant | Passed | Failed | Skipped/interrupted |
| --- | ---: | ---: | ---: |
| cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline | 28 | 2 | 0 |
| cdx-mir.spec.mjs › real depth worker with a fake camera › low-light: measured drift stays below the baseline | 30 | 0 | 0 |

<details><summary>Exact failure evidence</summary>

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-134a0d3c403f988d20b5 (chromium, 2026-10-17T06:21:27.395Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.00055
Received:   0.000649774326682762

  309 |         const m = await measure(page, { answers: 6 });
  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
> 311 |         expect(m.heightJitter).toBeLessThan(height);
      |                                ^
  312 |         expect(m.shownJitter).toBeLessThan(shown);
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:311:32
```

**cdx-mir.spec.mjs › real depth worker with a fake camera › still: measured drift stays below the baseline, case 8a768c30aa2ede5b178b-61d1a6da7188067255bb (chromium, 2026-10-17T06:52:26.751Z, failed)**

```text
Error: expect(received).toBeLessThan(expected)

Expected: < 0.95
Received:   0.9698412698412698

  310 |         console.log(`cdx mirror ${clip}: ${JSON.stringify(m)}`);
  311 |         expect(m.heightJitter).toBeLessThan(height);
> 312 |         expect(m.shownJitter).toBeLessThan(shown);
      |                               ^
  313 |         // Record live timing, but guard cost with the identical-input
  314 |         // relative benchmark below instead of a host-dependent ceiling.
  315 |         expect(m.grid).toBe("423x317");
    at /home/runner/work/splashery/splashery/subject/tests/cdx-mir.spec.mjs:312:31
```

</details>
