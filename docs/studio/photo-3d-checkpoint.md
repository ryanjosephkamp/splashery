# Photo to 3D checkpoint, October 14, 2026

The owner called Photo to 3D "practically perfect" on October 13, 2026, after Codex tasks 39 and 53
(PR #566, merged through Ops #590) and the hard-case samples (task 57, #585). This page says how to
get exactly that version back if later work makes it worse.

## Where the checkpoint lives

| What                                   | Where                                                | Commit                                     |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| The whole repository at the checkpoint | branch `claude/checkpoint-photo-3d-2026-10-14`       | `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492` |
| 49 paired before-and-after clips       | branch `claude/checkpoint-photo-3d-2026-10-14-clips` | `004e10f3ae4003616fe3e1aea54189984b52f91e` |

Never push to, rebase, or delete these two branches. (A git tag would be the usual way; this cloud
environment can't push tags, so the owner may add a tag or a GitHub release at the same commit.)

## The files that make up Photo to 3D

- The toy: `src/packs/photo-3d.js`, `src/packs/photo-3d-core.js`, `src/packs/photo-sharp.js` (the
  Sharp view)
- Building the 3D: `src/photo3d/build-worker.js`, `src/photo3d/preview.js`, `src/photo-splats.js`
  (the splat shader and its photo fill)
- The relief surface: `src/live/relief-mesh.js`, `src/live/relief-height.js`, `src/live/relief.js`
  (shared with Moving photo to 3D and the Splat mirror)
- Depth: `src/depth/client.js`, `src/depth/engine.js`, `src/depth/clip.js`, and the vendored model
  and runtime under `vendor/` (task 37)
- Samples: `src/packs/dot-samples.js`, `src/packs/hard-case-samples.js`,
  `src/packs/hard-case-pictures.js`, their files under `assets/`, and their records in
  `tools/assets.json`
- The tests that define its behavior: `tests/cdx-p3d2-*.spec.mjs`, `tests/p3d*.spec.mjs`,
  `tests/phf*.spec.mjs`, `tests/psv*.spec.mjs`, `tests/pdp*.spec.mjs`, `tests/cdx-pics*.spec.mjs`
- The reports: `docs/audits/photo-3d-r2-2026-10.md` (and its "Round 3" section)

## How to restore it

To bring back only Photo to 3D on a branch:

```
git fetch origin claude/checkpoint-photo-3d-2026-10-14
git checkout -b restore-photo-3d origin/main
git checkout origin/claude/checkpoint-photo-3d-2026-10-14 -- src/packs/photo-3d.js src/packs/photo-3d-core.js src/packs/photo-sharp.js src/photo3d src/photo-splats.js src/live/relief-mesh.js src/live/relief-height.js src/live/relief.js src/depth
```

Then run the tests listed above, check Moving photo and the Splat mirror too (they share the relief
files), and open an Ops PR. Restoring `vendor/` is only needed if a later task changed the depth
model.

## Every later Photo to 3D task

Compares itself against this checkpoint, sample by sample, with clips side by side, and keeps a
change only if it is at least as good on every measure.
