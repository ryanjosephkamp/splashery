# Walk inside review evidence

Made by Ryan with Codex (GPT-6), October 17, 2026.

Implementation: [codex/walk-inside](https://github.com/ryanjosephkamp/splashery/tree/codex/walk-inside).
This evidence branch is never merged. It contains only original procedural room media and test
results, with no private user capture.

## Review media

- [Sunlit gallery, 20 seconds](cdx-walk-gallery-20s-1080p30.mp4)
- [Garden courtyard, 20 seconds](cdx-walk-courtyard-20s-1080p30.mp4)
- [Gallery, phone](cdx-walk-gallery-390x844.png) and [desktop](cdx-walk-gallery-1440x900.png)
- [Courtyard, phone](cdx-walk-courtyard-390x844.png) and [desktop](cdx-walk-courtyard-1440x900.png)
- [Capture boundary, phone](cdx-walk-capture-edge-390x844.png)
- [Leveling error with settings open, phone](cdx-walk-level-error-390x844.png)

Clips are 608×1080, 600 actual rendered frames, H.264, and 30 fps. The simulation advances by
1/30 second for each frame. They are full resolution review exports, not real-time frame-rate
measurements. Keyboard movement, look rotation, and the actual Character button drive the capture.
Screenshots likewise use the tool's Full resolution setting. `clip-capture.json` records the
clips' per-room revisions and page errors. The clips precede the later status-banner refinement;
`capture.json` records the latest stills' revision and settings. The captured walking, rendering,
and character paths are unchanged. `ffprobe.json` verifies the encoded dimensions, duration,
frame count, and rate. Contact sheets sample the motion across each clip.

Both rooms are original procedural CC0 places. Their collision comes from their emitted splats.
The character and renderer are imported from Splashery Worlds. No photoreal place capture is
substituted: the repository's captured asset list contains objects and isolated plants.

## Measurements

`feature-tests.log` records all 29 Walk inside checks, including ten browser key scripts per room.
`cadence.json` extracts the raw summaries from that run. Cadence tests disable Playwright tracing
and screenshots, warm up for four seconds, then sample for 2.5 seconds per condition. The phone
profile is 390×844, DPR 3, Low, with CDP CPU rate 4. Desktop is 1440×900, DPR 1, High.
Each summary uses up to 120 retained recent frame intervals; the JSON includes the actual count.

| Profile / room / camera            | Standing mean | Walking mean | Auto drawing buffer |
| ---------------------------------- | ------------- | ------------ | ------------------- |
| Phone / gallery / first person     | 21.3 ms       | 20.8 ms      | 167×274             |
| Phone / gallery / character        | 29.5 ms       | 30.8 ms      | 136×222             |
| Phone / courtyard / first person   | 16.6 ms       | 16.7 ms      | 136×222             |
| Phone / courtyard / character      | 23.1 ms       | 23.6 ms      | 136×222             |
| Desktop / gallery / first person   | 74.4 ms       | 79.2 ms      | 936×489             |
| Desktop / gallery / character      | 90.5 ms       | 100.4 ms     | 936×489             |
| Desktop / courtyard / first person | 65.3 ms       | 70.5 ms      | 936×489             |
| Desktop / courtyard / character    | 87.7 ms       | 91.1 ms      | 936×489             |

Phone means are about 32.5–60 fps; slower individual frames are reported in the p95 values.
Desktop SwiftShader averages about 10–15 fps. Auto reduces splat-layer resolution to meet the
phone gate; controls keep their native resolution. Full resolution favors clarity over cadence.
Auto retains the reduced buffer across camera/place changes until the detail selector resets it.

`large-place.json` and `large-place.log` measure a synthetic densification of the actual courtyard
to one and two million splats, with file decoding excluded. The phone harness's one-million grid
took 677 ms. At two million, the grid took 1,324 ms, preparation took 3,840 ms, and the request took
4,338 ms. Two million source arrays contain 112,000,000 bytes; the grid contains 3,228,750 bytes.
Those are payloads, not a measured peak heap. Decode tables, copies, leveling, previews, and GPU
resources add memory. Preview budgets are 60,000 on Low and 200,000 on High.
Leveling can hold three full buffers, totaling 336,000,000 bytes at two million samples before
the other allocations. That is an allocation calculation, not a measured peak heap.

Chromium 151 uses WebGL2 through SwiftShader on an AMD EPYC 9V74 cloud CPU. No physical phone,
iOS/Android browser, or hardware GPU is measured. CDP throttling does not establish phone worker
speed. These size tests do not establish performance or collision quality on a real two-million
splat capture.

## Repository gates

All 72 smoke/kit tests passed, including old share links, scene round trips, WebGPU, phone layouts,
and the embed transfer check (9.2 MB). Full preflight passed all 272 shelf-wide tests and every
static check after merging current main. See `smoke-kit.log`, `preflight.log`, and
`preflight-summary.txt`. The final tested local revision is `97430aa6e`. GitHub email-privacy protection required a new
public Codex publishing identity. The published commit has the identical tested file tree;
`source-provenance.json` records the matching tree hashes. Local revision IDs in capture metadata
are execution records, not public GitHub revisions. The original local history is preserved in the
workspace. Runtime feature evidence matches the published `src/walk/` tree.

## Reproduce

Run the normal local server on port 4173. Use Chromium and the repository's installed Playwright:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-walk*.spec.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/walk-benchmark.mjs /tmp/walk-cost.json
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/walk-evidence.mjs /tmp/walk-evidence --clips
```

Rule check: none.
