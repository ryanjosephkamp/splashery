# Lane Volume viewer: open a CT, MRI or microscope volume in 3D (prefix `vol`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Volume viewer (Push Plan S4, prefix `vol`). Branch:
`claude/lane-volume-viewer` (engine changes on `claude/lane-volume-viewer-engine`, as a small
additive "Engine: …" PR merged first). PR title: "Phase Volume viewer: open a CT, MRI or microscope
volume in 3D". Handoff file: docs/handoff/VolumeViewer.md (create it; start it with this brief, word
for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the
Operator" current). Model: Opus 5.5, at high effort (CLAUDE.md).

### Brief (written by the Operator on October 8, 2026)

The owner approved the volume viewer (Push Plan S4) and a DICOM reader on October 4, 2026
(docs/reviews/2026-10-04-push-alignment/notes.md, "For the volume viewer, absolutely"). Build a labs
Studio tool, next to the Molecule viewer and the Point cloud viewer, that opens a person's own
volume file and shows it as splats:

1. Formats: a DICOM series (a folder or a .zip of .dcm slices, or a single multi-frame file), NIfTI
   (.nii and .nii.gz), a TIFF stack, and raw volumes with a small header form (size, type, spacing).
   Spacing is honored (anisotropic scans look right). Files stay on the device; nothing is sent
   anywhere. Bad or unsupported files say plainly what went wrong.
2. Libraries: vendor a DICOM reader (the owner approved one) and a NIfTI reader if you need one,
   open-source, in `vendor/`, loaded only when the tool opens, listed in LICENSES.md and named in
   the PR. A copyleft license, a library that calls a server, or one over 2 MB goes to the Operator
   first.
3. The view: splats sampled from the volume to the device's budget (the tiers the Imaging lane
   uses), with window and level (presets: bone, soft tissue, full range), a transfer function from
   value to color and opacity, a moving cut plane on each axis (reuse the `volume` kit kind and
   `out.volume` from the Imaging lane, #274: read docs/handoff/Imaging.md first), a
   maximum-intensity view, and a tap that steps through the presets. Materials look real: no
   speckle, no see-through solids.
4. Samples: only real, non-human scans under CLAUDE.md's licenses (the walnut CT already on main,
   and one or two more such as the gar fish or the ant from Imaging's sources report). Nothing human
   ships as a sample without the owner's yes (a person may open their own scans; Splashery doesn't
   inspect what people open).
5. Tests in `tests/vol*.spec.mjs`: each format loads from small test files you make by script (in
   `tools/`), spacing is honored, a truncated or wrong file gives a clear message, and the sample
   loads within the phone budget. Big data loads only when the tool opens.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). New toys and views go behind the labs switch
(`labs: true`); the Operator merges labs work after the tests pass (with tools/op-merge.mjs) and
after the owner marks your cards; changes to toys the public already sees wait for his "good" marks.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Clips at phone size
(390x844, device scale 3) go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). New sounds go in tools/sound-review.json as "ready" (the owner hears them on the
Sound Board), not as cards. Before READY, re-read CLAUDE.md's "Effect quality rules" and check each
clip against them at phone size. About six workers run at once; keep an even pace. Your Operator is
session_012GmKRUMZLir2nb27Bo8Cu2. Card ids vol-…. Aim for a first READY with DICOM and NIfTI working
and clips within about six hours.

## State

WORKING (October 8, 2026, Opus 5.5): readers and the viewer under construction.

## Notes

## Known issues

## For the Operator
