# Task 66: open-shelf kit tiers

Status: reconstructed recipe fix; visual recommendations are pending.

Made by Ryan with Codex (GPT-6), October 14, 2026. Code is MIT. No new assets.

This audit starts from main at `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`. It measures 65
default-option kit toys on Science, Space, and Math. Task 44's seven photoreal worlds are excluded.
No files owned by the protected PRs, no prototype toys from tasks 49, 61, 62, or 63, and no engine
files are changed.

The measurement command applies each recipe's density and the Auto profile cap, then records
requested and emitted splats separately. Attribute bytes are CPU buffer sizes, not transfer size,
GPU memory, or total browser memory. Node build times do not measure phone performance.

```sh
node tools/cdx-t2-measure.mjs /tmp/cdx-t2-counts.json
npx playwright test -c tools/cdx-t2.playwright.config.mjs tests/cdx-t2.spec.mjs --workers=1
```

The task-local Playwright configuration launches installed Chromium with `chromiumSandbox: true` and
no added browser flags. Every test runner and capture is run sequentially with one worker. The
shared configuration and capture tools have unsafe graphics flags, so they are not used unchanged.

No previous capture or test result is treated as evidence for this reconstruction.

## Recipe fix

The Math pack's bitmap-text helper supplied a fixed `count` to Kit, which scales that count from a
160,000-splat reference. At Low, it sampled only the beginning of each label. For example, the
unit-circle equation emitted 266 of its 708 samples, and the graph plotter's slider label emitted 25
of 56 samples.

The helper now reserves an absolute share for every bitmap sample. This repairs the graph plotter,
surface plotter, unit circle, and Pythagoras proof at Low and Mid, and avoids reserving unused text
samples at higher tiers. No glyph design, part, pivot, control, effect duration, density, or engine
profile changes.

The four new glyph-completeness tests failed on the original helper and pass after the fix. The
post-fix inventory, glyph, and four-tier build run passed 70 checks (2.1 minutes). The initial
inventory and four-tier build run passed 66 checks. Further regression results, per-tier pictures,
effect clips, and the completed record will be added after this source checkpoint. Engine tier
changes remain proposals for separate review.

Rule check: none.
