# Blender cloud implementation plan

**Goal:** Install a pinned, hash-checked headless Blender, render the existing truth scenes, and
render reproducible CC0 model views, depth, masks, and 360-degree panoramas.

**Spec:** The user's GOAL. `docs/codex/105-blender-cloud.md` is absent from the checkout and from
`origin/main` fetched on October 17, 2026. Keep this implementation in build tools, tests, and docs.
No site code or shipped assets change. Execute in this session.

- [x] Add a Linux x86-64 Blender 4.5.3 installer with a committed archive SHA-256, safe extraction,
      cached-file integrity checks, and a headless launcher. Test corrupt archives and caches.
- [x] Add a self-contained GLB renderer with required CC0 provenance and input SHA-256, calibrated
      orbit cameras, pixel-center geometric depth/masks, and an equirectangular panorama. Fix seed,
      CPU threads, samples, color settings, compression metadata, and manifest ordering.
- [x] Verify known geometry and panorama directions, render a CC0 model in two fresh processes, and
      compare every artifact hash. Reject stale output directories and mismatched model hashes.
- [x] Render all twelve existing truth stills with the installed Blender. Measure cold/warm setup,
      render and depth time, and explicit GPU backend failures. Keep full output in ignored cache.
- [x] Record commands, measured results, limitations, sources actually opened, and license details
      in the audit and tool documentation. Run required checks, merge main, and open one draft PR.
