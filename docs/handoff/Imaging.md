# Lane Imaging (prefix `img`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State

WORKING: started October 5, 2026 (cloud session, Opus 5.5). The engine PR is open: #274, "Engine: a
cutting plane and a density window (the volume kit kind)", on `claude/lane-imaging-engine`, merged
into this branch. It should merge first. Items 1 to 5 are built; next: the thermal camera.

- [x] 1. Airport X-ray scanner (`airport-xray`)
- [x] 2. How CT works (`how-ct`): a kit-built nautilus shell
- [x] 3. A real CT scan (`walnut-ct`): the CWI walnut (Zenodo record 2686726, CC BY 4.0;
     docs/audits/new-sources-2026-10.md, B1)
- [x] 4. MRI of a fruit (`fruit-mri`): kit-built kiwi and orange slices
- [x] 5. Electron microscope (`electron-microscope`): pollen, diatoms, a rimed snowflake
- [ ] 6. Thermal camera
- [ ] 7. Ideas of my own (up to two)

## Notes

- The engine piece: kit kind `volume` (`params: [density]`), driven by
  `out.volume = { normal, at, slab, window, glow, glowWidth }` (recipe coordinates). The cut is
  measured at each splat's rest place. Test: `tests/img-engine.spec.mjs`.

## Known issues

None yet.

## For the Operator

- For PACKS.md (section 5, after the levers): the `volume` kind and `out.volume`, as in the Notes
  above.
