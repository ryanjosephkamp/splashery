# Verification: hard-case samples

October 13, 2026. Chromium 151.0.7922.173, Playwright 1.56.1, SwiftShader WebGL2, Linux.
Task-specific rendering uses the real toy and the real depth worker/model; no scored pixels or model
outputs are mocked. Native generation was nondeterministic, and its model identity was not returned.

## Required regressions

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/p3d.spec.mjs tests/smoke.spec.mjs tests/help.spec.mjs tests/unit.spec.mjs tests/taps.spec.mjs
```

156 cases executed: 155 passed and one phone-sheet case failed. No cases were skipped. The existing
Photo to 3D, help, unit, and tap tests all passed. The smoke embed transfer check passed at 9.1 MB,
below 30 MB.

| Spec             | Initial result      |
| ---------------- | ------------------- |
| `help.spec.mjs`  | 14 passed           |
| `p3d.spec.mjs`   | 10 passed           |
| `smoke.spec.mjs` | 49 passed, 1 failed |
| `taps.spec.mjs`  | 62 passed           |
| `unit.spec.mjs`  | 20 passed           |

The existing phone test, **has no horizontal overflow at 390px and the sheet opens**, timed out at
its second attempt to open the settings after swiping the shelf handle up and down
(`tests/smoke.spec.mjs:1482`): `#panel-body` remained hidden. Its earlier overflow assertions
passed. The failed trace contained zero requests for any new hard-case module or asset; this test
was displaying the existing Cactus.

The exact unchanged case then passed on unchanged `main` commit `a2189958` in an isolated detached
worktree served on port 4174 (1 passed), and passed on this branch without a code or test change (1
passed). The intermittent touch/sheet failure remains unresolved; no assertion was weakened, no
retry setting changed, and no unrelated sheet fix added.

```sh
# Unchanged main, from the isolated worktree:
SPLASHERY_PORT=4174 SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/smoke.spec.mjs --grep 'has no horizontal overflow at 390px'
# This branch, unchanged between the initial failure and this rerun:
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/smoke.spec.mjs --grep 'has no horizontal overflow at 390px'
```

## New sample verification

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-pics-hard-cases.spec.mjs tests/kit.spec.mjs tests/hta.spec.mjs tests/dsm-samples.spec.mjs
```

All 22 cases passed against the selected 20, their completed registry entries, and the unchanged
original sample files. No cases were skipped. The new spec checks native file records, exact
JPEG/depth hashes and byte sizes, 1,280-pixel width, all seven categories, AI-made labels, the
actual 20-option picker group, default preservation, idempotent registration, lazy requests, and
flat-versus-raised rendering for every sample. It saves phone and desktop screenshots at 390×844 and
1440×900. Original AI sample and kit checks also run.

| Spec                           | Final result                                                         |
| ------------------------------ | -------------------------------------------------------------------- |
| `cdx-pics-hard-cases.spec.mjs` | 3 passed; all 20 new choices loaded and raised                       |
| `dsm-samples.spec.mjs`         | 6 passed; original AI records and browser loading preserved          |
| `hta.spec.mjs`                 | 3 passed                                                             |
| `kit.spec.mjs`                 | 10 passed; deterministic builds, bounds, and legacy scenes preserved |

178 distinct cases passed across the scoped branch runs, including the phone case's successful
rerun. The first aggregate run still has its single failed attempt recorded above.

## Other evidence

- Independently verified all 40 native files, source SHA-256 hashes, 1,536×1,024 dimensions,
  screening notes, unique IDs, and portable manifests.
- All 40 real depth maps came from the unchanged `tools/dsm-depth.mjs`; every candidate has eight
  measured Sharp-view poses and source/depth hashes.
- Selection verified the measured file hashes before moving any files; only 20 JPEG/depth pairs
  ship, and no temporary hard-case file remains in the original `ai/` directory.
- Parsed the shared asset registry before and after addition: every existing property and every
  original sample entry remains equal. The original `CREDITS.md` is an exact prefix of the updated
  file.
- Three contact sheets show all candidates, the kept source pictures, and the kept worst-pose views.
  Large-angle holes and border losses remain visible.
- A 320-pixel bicycle-spokes tap clip and its eight-frame strip show the existing relief rise and
  sway. Captured with the unchanged `tools/effect-clip.mjs` at eight frames per second, inspected as
  an eight-frame strip, and encoded with the existing FFmpeg build; both artifacts are included in
  this folder.

## Pre-push checks

- `npx prettier --check .`: passed across the repository.
- `node tools/us-english.mjs --diff`: no British spellings found.
- `node tools/nc-assets.mjs --check`: passed; four existing NC assets tagged, no ND license.
- `node tools/check-packs.mjs photo-3d`: passed, 196,935 splats.
- `git diff --cached --check`: passed.
- Report folder: about 2.9 MB, below 8 MB. The 20 shipped image/depth pairs total 12,361,259 bytes
  and remain lazy.
- Standard and other existing test screenshots restored; only this task's two new screenshots are
  included.

## Limits

No actual phone hardware, ground-truth depth, physical camera, or print measurement was performed.
Proxy scores omit border loss and can include source texture in the halo measure; they do not
certify perfect reconstruction. The repository-wide suite was not run. Private Effect review
publishing is unavailable through this environment's tools. No new rendering effect was added; the
existing Photo to 3D controls and tap motion are reused.
