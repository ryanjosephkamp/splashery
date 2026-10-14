# Record: T2, open-shelf kit tiers

## Identity and status

- Task: Codex 66 / T2, Science, Space, and Math kit tiers.
- Project: 65 existing kit toys; seven task-44 worlds excluded. No prototype toys from other tasks.
- Branch: `codex/t2-open-shelves`;
  [draft PR 599](https://github.com/ryanjosephkamp/splashery/pull/599).
- Made by Ryan with Codex (GPT-6), October 14, 2026. Code is MIT.
- Status: implemented recipe repairs; engine tier recommendations proposed, awaiting review.
- Reconstruction baseline: `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`.
- Tested recipe checkpoint: `120ece84197178a44e5562c8c16d82f6b36af734`. Subsequent source-branch
  changes contain only this final record, audit, thumbnails, and owned screenshots.
- Immutable evidence checkpoint: `e6fab794836a1479124abe8a3b56657b93f02e5b` on
  `codex/t2-open-shelves-clips`, never merge.

## Completed review follow-up

The [main comparison and upper-tier review](kit-tiers-2026-10-review.md) records the complete
requested reruns and immutable High/Max before-and-after pairs. Main
`6c3764ff9a1aa3fbba202af12d6764ac23ed2d6e`: **170 passed, 38 failed, 1 skipped** across 209 unique
titles. Branch `4b920ee3cf37236d240de7bc61662f698e67ef7d`: **245 passed, 37 failed, 1 skipped**
across 283 titles. Each includes one timeout in the failed count; no interrupted or unrun titles
remain in the final valid totals. All shared branch failures also failed on main. The cat-rig case
also hit the same zero-pixel assertion in an unchanged isolated run on each tree; original full-run
failures remain recorded. Main alone failed the Kit circular-QR limit check. All 74 task checks, 92
Kit/tap/unit checks, 50 Math checks, and 3 HelpTextA checks passed on the branch. Embed transfer
passed at 9.2 MiB on both trees.

**Both equation-layout issues were already present on main**, confirmed in fresh High and Max pairs.
No new truncation or loss of legibility was found in the four changed toys' default High/Max home
renders. The Math helper is unchanged from the original tested repair.

The follow-up adds a per-test checkpoint reporter after an exec transport interruption and fixes the
task-local automatic server to serve the repository root. The invalid wrong-root attempt, its
failures, and its interrupted case are preserved separately. Its browser results are excluded from
the valid comparison, and the full branch run was repeated. No tests, timeouts, browser security, or
graphics restrictions were weakened. The earlier executed-evidence table below is historical
evidence for the original implementation; the linked review supersedes its unrun counts.

## The recipe contract

- Hooks: existing `build`, `prepare`, `drive`, controls, and actions. Only the Math pack's
  bitmap-text helper changes: complete sample allocation and cell-relative stroke radii, without
  extra Kit positional jitter.
- Units: existing recipe coordinates, +Y up, fitted by Kit to radius 0.95.
- Axes and pivots: unchanged. No new parts or joint axes. The proof's triangle labels retain their
  token ids; equation copies retain their fade channels.
- Parts: graph retains `body`, `curve`, `sweep0`–`sweep7`, `pen`, and `knob`; surface retains
  `body`, `surface`, `sweep0`–`sweep7`, and `knob`. Circle and proof retain `body` and their
  existing token/fade behavior. All 65 toys retain the same named parts across the four tested
  tiers.
- Quaternion order: unchanged, x, y, z, w.
- Host APIs: existing `k.cloud`, `buildRecipe`, `resolveOptions`, and `Player.splatBudget` behavior.
  Engine, profiles, recipe densities, shared catalog, controls, effects, bitmaps, and timings are
  unchanged.

## Generation

- Environment: selected Linux cloud only, Debian 13, x86_64. No Mac, remote desktop, or local
  browser.
- Versions: Node 24.19.0, Python 3.12.14, Playwright 1.56.1, installed Chromium 151.0.7922.173. No
  new source dependencies or shipped libraries.
- Browser: sandbox enabled, no added capture launch flags, no unsafe graphics opt-in, no GPU
  blocklist override. Its sandbox helper worked. The default renderer was ANGLE Vulkan SwiftShader.
- A negative normal-Mesa diagnostic used temporary Xvfb 2:21.1.16-1.3+deb13u4, already listed in
  `LICENSES.md`. It exposed no WebGL2 context. The runtime is not shipped; see the
  [probe result](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/failures/mesa-probe.json).
- Seeds: `recipe.seed` or `hash32(toy id)`, matching the player, recorded per browser row. The
  initial 66-check baseline used seed 1; final checks use player seeds.
- Options: recipe defaults, Auto Detail, adaptation off, forced Low, Mid, High, or Max. Metadata
  stores scene overrides as an empty object for defaults.
- Four-tier count study: source `130b9587a3e38fbd15f4981950784fae7676a786`, 260 rows with no build
  errors or nonfinite values. Stroke repair does not change these counts; all 16 replacement Math
  browser counts were checked against the study.
- Capture size: each toy has a 390×844 UI frame and an independent 390×844 stage frame, device scale
  factor 1. The four changed toys also have 1440×900 Low and High UI frames. These are desktop
  renders, not physical phone tests.
- Commands:
  [manifest](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/manifest.json)
  records the measurement, capture, clip, thumbnail, contact-sheet, pack-check, and selected-spec
  commands plus source-tool hashes. Run them sequentially with the cloud's installed Chromium.

The four Low clips used the repository's effect tool through `tools/cdx-t2-browser-tool.mjs`,
keeping the sandbox and removing unsafe shared launch flags. Each GIF is 320×320, 119 frames at 50
ms, 5.95 seconds total, with one tap. The command requested a 0.4-second lead-in and 5.5 seconds
after the tap; floating-point stepping emits 119 frames. Ordered frames and strips were inspected
for retained labels and rigid motion. No physical phone playback or measured real-time rendering
speed is claimed.

## Assets and licenses

No new source assets, outside datasets, or libraries. Original procedural Math renders are CC0, made
by Ryan with Codex (GPT-6). Existing toys' credits and source licenses remain intact. Other
screenshots retain the underlying assets' and data's existing license terms and in-app attribution;
this record does not relicense them. No asset lists or shared credits were edited.

The four regenerated thumbnails below use the existing High-tier tool, safe launch only. Source is
the procedural recipe in `src/packs/maths.js`; author is Ryan with Codex (GPT-6); license CC0;
checked October 14, 2026. Change: regenerated after the text repair.

| File                                      | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `assets/toys/graph-plotter/thumb.webp`    | `0b43f9332acad41f4e9be8f1ec231ae362ae434b8c7586f77f99dba889868169` |
| `assets/toys/surface-plotter/thumb.webp`  | `fa31f6973c250118b990e2989d3bcd98c41464e183d3e8361398d4db900be95a` |
| `assets/toys/unit-circle/thumb.webp`      | `f8b1685a71d9167eb2858274f450afa2dd96bbf69a91385a1ca79b2105d2c9d6` |
| `assets/toys/pythagoras-proof/thumb.webp` | `67c16ce3b5d6ae476e8179f4e85426c7f6fcfe787be3a2e462bca4be980f63d9` |

The
[evidence manifest](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/manifest.json)
records every review file's SHA-256 and byte count, media dimensions and timing, and source
screenshot/thumbnail hashes. Eight owned `tests/screenshots/cdx-t2-*.png` files retain Low UI frames
at both required viewport sizes. Borrowed standard test screenshots were restored after their
failure evidence was preserved. No large generated cache, trace archive, or private coordination
material is committed.

## Boundaries

- Reused: catalog, recipes, Kit, player, renderer, data, and existing review tools.
- New: task-local measurement/capture tooling, eight text regressions, four-tier inventory/build
  checks, reports, review renders, and the Math text helper repair.
- Engine changes: none. Per-toy minimum and ceiling recommendations are proposals only, limited to
  the tested counts and views.
- Excluded: all seven task-44 worlds, the other tasks' prototypes, protected PR files, and other
  owners' source files.
- Not simulated: no new simulation. Existing effects and data are retained; this study does not
  independently validate physical models.

## Original executed evidence (historical)

| Check                                                                       | Method                                                                                  | Result                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Final task inventory, full glyphs, stroke radii, and all-tier finite builds | Real recipes in Node, no renderer                                                       | 74 passed                                                              |
| Shared Kit, taps, and unit                                                  | Real Node recipes and sandboxed Chromium                                                | 92 passed                                                              |
| Math, Math-r2, and hands-on Math                                            | Sandboxed Chromium                                                                      | 22 + 19 + 9 passed                                                     |
| HelpTextA                                                                   | Real source checks and sandboxed Chromium                                               | 3 passed                                                               |
| Help                                                                        | Sandboxed Chromium                                                                      | 9 passed, 5 failed                                                     |
| Smoke                                                                       | Sandboxed Chromium                                                                      | 1 passed, 4 failed, 1 interrupted, 44 not run                          |
| Selected-spec total                                                         | Latest unique outcomes across three serialized invocations                              | 229 passed, 9 failed, 1 interrupted, 44 not run; 0 skipped             |
| Embed transfer                                                              | Unchanged browser network assertion                                                     | Passed; reported 9.2 MiB, limit 30 MiB                                 |
| Pack diagnostics for all four changed toys                                  | `node tools/check-packs.mjs graph-plotter surface-plotter unit-circle pythagoras-proof` | All four passed                                                        |
| Study captures                                                              | Sandboxed Chromium, defaults and home view                                              | 260 complete, no capture/page errors or blank frames                   |
| Final Math replacements and desktop frames                                  | Sandboxed Chromium                                                                      | 16 four-tier replacements and 8 desktop captures complete              |
| Changed effects and thumbnails                                              | Safely adapted repository tools, sandboxed Chromium                                     | Four Low GIFs and strips, four High thumbnails, contact sheet reviewed |
| Expected regressions before repairs                                         | Real recipes in Node                                                                    | Four count and four stroke failures preserved                          |
| Pre-push formatting, English, scope, and secret-pattern review              | Source/evidence text and staged paths                                                   | Clean                                                                  |

The first selected-spec invocation recorded 90 passed, 5 failed, 1 interrupted, and 187 not run in
9.3 minutes. A continuation recorded 56 passed, 4 failed, 1 interrupted, and 127 not run in 19.6
minutes. The last invocation completed 83 checks in 1.7 minutes, including all tap/unit checks and
embed transfer. Results above deduplicate resumed tests. One runner and one worker at a time;
captures did not overlap tests. No tests, console assertions, or browser security settings were
weakened.

Seven strict console checks failed on default Chromium's automatic software-fallback and readback
warnings. Two other Help guards failed: a missing bounding box at 390×844 and five Fourier-circle
toy pixels under the line at 1440×900. The warning-blocked Smoke group was stopped, preserving the
interrupted paint/poke case and all 44 unrun titles in the
[complete result JSON](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/failures/combined-results.json).
Public summaries and failure screenshots are retained; full traces stay in the ignored cloud cache.
The full repository suite was not run.

Pack diagnostics requested raw 200,000 splats: graph emitted 199,998 (486 ms), surface 194,478 (549
ms), circle 200,001 (212 ms), and proof 200,002 (204 ms). These are diagnostic Node times and raw
budgets, not profile counts or device benchmarks.

## Performance

- Counts: the [audit](kit-tiers-2026-10.md) has all 65 per-toy counts, minimum tested tiers, ceiling
  proposals, observations, and immutable image links. The
  [260-row data](kit-tiers-2026-10-counts.json) records requested and emitted counts separately.
- CPU attributes: 72 bytes per live base-kit splat; allocated capacity is separately recorded. This
  excludes chunks, GPU resources, textures, JavaScript objects, and other application memory.
- Powers of ten: 5,404 base splats are only the backdrop. The audit separately lists visible and
  all-ready streamed chunks. Base plus visible is used in its main tier row; ready neighbors also
  consume memory. No backdrop-only total or whole-journey cap is claimed.
- Phone load time, memory, and frame rate: unmeasured. Browser total memory, cold-load time, and
  frame rate: unmeasured. Node prepare/build times are diagnostic only, with warmed caches and
  machine variability. No performance improvement is claimed.
- Comparison: baseline main `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`. Main later advanced to
  `e404cf36b60e7509f2cabc21dcd0f9f076fa8ef4` with unrelated QR and documentation changes; that tree
  was inspected but not merged or tested with this branch.
- Limits: no counts below Low, arbitrary intermediate counts, every option, high-DPR devices, other
  camera views, whole-sky dates, or full streamed journey. Stateful warm-up and sky date can vary
  poses. The first unit-circle equation term still overlaps its panel, and the proof equation can
  touch its frame. Minimum “Low” refers to the recognizable default object/diagram and retained
  parts, with those layout caveats.

[Audit and proposals](kit-tiers-2026-10.md). Draft PR only; no merge or deployment. Rule check:
none.
