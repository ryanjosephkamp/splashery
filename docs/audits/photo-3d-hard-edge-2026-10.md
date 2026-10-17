# Photo to 3D: Layered H with Classic depth cuts

**Working: the acceptance run is in progress.** Codex (GPT-6) built this follow-up to the
[Layered study](photo-3d-next-2026-10.md). Classic remains the default, its files and golden pins
are unchanged, and no Fill option is enabled.

The dispatched `docs/codex/undefined.md` does not exist. Fetching current main revealed the actual
[task 99b](../codex/99b-photo-3d-hard-edge.md), which supplies the scope. Acceptance requires a 60%
corpus-median ribbon reduction, no input more than 5% worse, boundary MAE within 1% of Classic, no
added thin-probe losses, no median truth-error regression, and phone-profile cost within 25% time
and 150 MiB memory. Every individual ribbon result is also reported.

## Method

Layered H (`fill` in the capture records) applies Layered A's deterministic PatchMatch background to
Classic's build: three passes, radius-two patches, seed 99, and no synthesized-context coherence. It
retains the same foreground colors, geometry, depth, surface cuts, backing geometry, and shader. The
research browser adapter replaces only the build worker's background operation. It rejects a
foreground cleanup request and requires evidence of worker execution without a shader overlay.

The first phone screen found an additional thin-line loss on Spiral staircase at −30° pitch. An
isolated second screen tests retaining Classic's background within four background pixels of a depth
cut exceeding 0.08. This is a separate, explicitly routed research candidate; the original H run
continues unchanged. The guard did not recover the lost Spiral staircase probe, and it reduced the
ribbon gains in its screen. Neither method is connected to the app.

## Evaluation

The inventory contains the original 118 photos: 76 built-in samples, 12 truth scenes, and 30
additional public photos. The setup tool restores the pinned evidence branches and verifies Git blob
hashes and additional-photo SHA-256 hashes. It does not read the previous blind identity key. Each
method uses the original source probes, nine actual camera poses, depth 0.5, the Sharp view, and
both profiles. Every source-depth field must match the frozen probes byte for byte.

Phone captures are native 585×1266; desktop captures are 1440×900. Both methods use the same
Chromium/Mesa renderer. The runs are paired by photo, profile, probe hash, camera, and pose, with
hashed native artifacts. Rendering and scoring use the existing atlas definitions. Source-cue
boundary scores remain diagnostics. The comparison rejects duplicate poses, incomplete pairs, lost
support, soft shader overlays, and extra thin-probe losses.

Three original phone inputs and ten original desktop inputs have no supported ribbon score.
Unsupported values remain absent, are listed individually, and cannot become zero or a claimed
individual improvement. The corpus statistic requires matching baseline/candidate support.

The task 99 scene generator, fixed cameras, source-median calibration, footprint, 16 samples, and
guided OpenImageDenoise protocol are retained. Target rasters were deliberately absent from Git, so
the tool restores them from the archived calibration with the verified official Blender 4.3.2 build.
The preinstalled Debian build lacks that denoiser and is excluded. No new camera fit or yardstick is
introduced. Target rasters stay outside Git.

Quality captures run concurrently; their startup observations cannot grant the cost gate. The cost
tool runs separately with five fresh-browser trials for each method and each of the 118 inputs,
alternating method order, and explicit first-completed-frame timing. Chromium's phone profile is not
a physical phone run.

| Gate                                              | Current result                                          | Status                              |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------------------------- |
| Classic remains byte-identical                    | 77 golden tests passed                                  | Initial check passed                |
| At least 60% fewer ribbons across the full atlas  | Phone and desktop captures running                      | Pending                             |
| True boundary MAE within 1%; no added thin losses | Truth restoration and thin checks running               | Thin gate fails on Spiral staircase |
| Median truth error no worse                       | Truth restoration running                               | Pending                             |
| At most 25% slower                                | Isolated all-input cost run follows quality capture     | Pending                             |
| Twenty new blind pairs on the same 20 inputs      | Original 72-frame, 12 fps phone arcs; no votes inferred | Pending                             |
| Labs Fill option                                  | Remains disconnected until the gates pass               | Not enabled                         |

## Verification and reproduction

Initial Classic golden: 77 passed. Fill invariants and the existing method/metric tests: 19 passed.
Additional regression checks and final preflight are pending. The invariant test checks the entire
Classic build is unmodified and every foreground/geometry field is retained by reference. The gate
fixtures verify that incomplete coverage, duplicate poses, support loss, shader changes, and a
single added thin-probe loss cannot pass.

Use an Xvfb display and Mesa as described in [CI.md](../CI.md). Restore inputs, then run the two
profiles in separate folders, optionally concurrently:

```sh
python3 tools/p3d-fill-setup.py
DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/p3d-fill-atlas.mjs --profiles=phone --out=.cache/photo-3d-fill/phone
DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/p3d-fill-atlas.mjs --profiles=desktop --out=.cache/photo-3d-fill/desktop
python3 tools/p3d-next-setup.py --blender-only
.cache/photo-3d-next/blender-4.3.2-linux-x64/blender -b --factory-startup --threads 1 --python-exit-code 1 --python tools/p3d-fill-truth.py -- --calibration .cache/photo-3d-fill/truth-calibration.json.gz --out .cache/photo-3d-fill/targets-official
```

After closing competing audits, run `tools/p3d-fill-cost.mjs` with the same display, renderer, and
browser environment. A changed source, input, or setting requires a fresh output folder. Raw
evidence and rejected-candidate records belong on `codex/photo-3d-hard-edge-clips`, never merged.

Rule check: none.
