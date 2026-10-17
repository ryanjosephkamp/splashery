# Photos to 3D: task 104 evidence

**Negative result. This branch must never be merged.** No production Photos to 3D tool is shipped.
The report and diagnostic code are on `codex/photos-to-3d`; the exact probe files used for the
primary measurements are preserved in public source snapshot
`1e7071d291b66eb6c05b5113aa0ec52dcc5e569b`. GitHub rejected the original local commits because of
private email metadata. Raw receipts retain their original local commit IDs;
`PUBLIC-SOURCE-MAP.json` verifies every recorded source hash against the public snapshot. The
original local history is retained, and measurements are not relabeled. Each primary row records its
actual commit, source SHA-256s, invocation, input order, omissions, and software adapter.

- `primary/`: nine completed camera probes, raw logs, two partial-scene PLY exports, environment,
  expected deadline/occupied-port failures, export checks, and the provenance audit.
- `exploratory/`: earlier probes and intermediate controls. Some predate the watchdog and complete
  source fingerprints. They are not the primary acceptance cohort. The initial hand-run controls
  have no full source receipt; use the committed-source replays instead.
- `dataset/`: frozen original-file hashes and source/author/license records. **No photographs are
  committed.** The 24 originals can be retrieved and verified with `tools/photos3d-fetch.mjs` on the
  code branch. This is one capture, not six independent photo sets.
- `checks/`: actual diagnostic, Video regression, formatting, English, and preflight logs.

The real source is AliceVision's Buddha dataset at commit
`9067f679eb5a772c3e818b7a12dc35882c071858`, by Simone Gasparini, Fabien Castan, and Yann Lanthony.
The source and its CC BY 4.0 license were opened on October 17, 2026:

- <https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/README.md>
- <https://github.com/alicevision/dataset_buddha/blob/9067f679eb5a772c3e818b7a12dc35882c071858/LICENSE.md>

The PLYs derive from those photos and retain CC BY 4.0. Changes: 24-file selection, browser
resampling, partial camera solve, Gaussian initialization, two/four optimizer steps, and existing
opacity-compensated export with dead-splat removal. They reconstruct only four placed photos each;
they are not accepted object reconstructions. File hashes verify exact bytes, not appearance
quality.

Numeric controls are original procedural data, made by Ryan with Codex (GPT-6), CC0-1.0; code is
MIT. They inject exact feature correspondences and bypass rendered images, feature detection,
occlusion, and texture. They do not count as the three rendered synthetic sets. All masked held-out
SSIM/PSNR and physical-phone/GPU-peak-memory acceptance measurements remain unmeasured.

To reproduce, check out the code branch (not this evidence branch), run the commands in
`docs/audits/photos-to-3d-2026-10.md`, and retain every partial/failure row.
`primary/provenance-audit.json` confirms that all nine primary rows' listed source hashes match
their committed source, every photo input hash matches the frozen selection, and returned/missing
camera identities account for every input. Red/blue sentinel controls preserve identical camera
arrays while changing sparse seed color.

`primary/deadline-decoding.json` was originally named `occupied-port.json`; its actual outcome is an
expected 1 ms browser-work timeout. `occupied-listener.json` is the separate successful check that
the runner refuses a port already owned by another server. Neither is a quality probe.

Software timing overlapped other verification work. No paired physical-phone clips were produced.
