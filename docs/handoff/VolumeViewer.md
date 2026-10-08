# Lane Volume viewer: open a CT, MRI or microscope volume in 3D (prefix `vol`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Volume viewer (Push Plan S4, prefix `vol`). Branch:
`claude/lane-volume-viewer` (engine changes on `claude/lane-volume-viewer-engine`, as a small
additive "Engine: …" PR merged first). PR title: "Phase Volume viewer: open a CT, MRI or microscope
volume in 3D". Handoff file: docs/handoff/VolumeViewer.md (create it; start it with this brief, word
for word, under "## Brief", then keep "## State

READY (October 8, 2026, about 18:45 UTC, Opus 5.5, high effort): the tool, readers, samples, tests
and clips are done on `claude/lane-volume-viewer`, draft PR #423. No engine changes were needed (no
`-engine` branch). Five cards are on Effect review page 2 (lane record `VolumeViewer`), waiting for
the owner's marks: `vol-walnut-cut`, `vol-walnut-presets`, `vol-gar-sweep`, `vol-gar-slice`,
`vol-gar-mip`.

- [x] 1. Formats: DICOM (a series picked together, a folder with "Open a folder of slices…", a .zip,
     or one multi-frame file; uncompressed and RLE Lossless; implicit, explicit and big-endian VR),
     NIfTI-1 and NIfTI-2 (.nii, .nii.gz), TIFF stacks (one multi-page file or many files; 8, 16, 32
     bits; none, LZW, Deflate, PackBits; ImageJ spacing) and raw volumes with a form (size, type,
     byte order, voxel size, header). Spacing from the files (DICOM: the slices' places), or typed
     in. Clear messages for cut-short, wrong and unsupported files (JPEG DICOM is named and
     refused).
- [x] 2. dicom-parser 1.8.21 (MIT, 32 KB), vendored in `vendor/dicom-parser/`, loaded only when a
     DICOM file is opened. NIfTI, TIFF and zip are read by `src/volume/read.js` (no library).
- [x] 3. The view: volume splats to the device's budget (`density: 2`, as Imaging), baked shading
     from the volume's gradient, window presets (bone, soft tissue, full range; Hounsfield units for
     CT, the histogram otherwise) and sliders, five color maps, two opacity curves, a cut plane on
     each axis (a drag, or the Sweep control), a thin-slice view, the maximum-intensity picture, and
     a tap that steps the presets.
- [x] 4. Samples: the CWI walnut (Imaging's file) and a 12.8 mm gar larva (Metscher, Zenodo
     19021581, CC BY 4.0), 1.36 MB as NIfTI.
- [x] 5. Tests: `tests/vol.spec.mjs` (24), fixtures from `tools/vol-fixtures.mjs`.
- [x] Clips on Effect review page 2 (lane record `VolumeViewer`), screenshots.

## Notes

- Files: `src/volume/read.js` (readers), `src/volume/view.js` (window, colors, sampling, MIP),
  `src/packs/volume-viewer.js` (the toy, its panel: the folder button and the raw form),
  `tools/vol-fixtures.mjs`, `tools/vol-gar.mjs`, `tools/vol-shot.mjs` (screenshots with options),
  `tools/vol-clip.mjs` (phone-size clips).
- Orientation: DICOM (LPS) and NIfTI (RAS) are turned so the patient's left is on the right,
  superior up and anterior toward the viewer; files without orientation stack their slices upward.
- A volume is averaged down while it is read (at most 8 million voxels, 4 million on a phone), so a
  big series fits in memory; its true size and spacing are kept.
- The tap rebuilds the toy with the next preset (the colors are baked per window); the cut place is
  kept across presets of the same volume.

## Known issues

- Compressed DICOM (JPEG, JPEG-LS, JPEG 2000, HTJ2K, Deflate) is refused with a message saying how
  to convert it; decoding them would need more libraries.
- The shading is baked (lit from above and in front), so it turns with the volume.
- The ant scan from the sources report (3.5 GB) is not a sample yet.

## For the Operator

- Specs run on the branch: `vol` (24), `help`, `taps` (60), `unit`, `smoke`, `img`, `vwr`, `snda`,
  `sndd`. One smoke test ("dragging the shelf up opens a grid, and picking a toy folds it back")
  fails, and fails the same way on a clean checkout of main (a toy name cut on the shelf grid).
- For PACKS.md: pulse controls are not shown in the Toy tab, so a pulse must be the action (Play) or
  fired by a tap to be reachable.
- No engine PR: the Imaging lane's `volume` kind and `out.volume` did everything.
