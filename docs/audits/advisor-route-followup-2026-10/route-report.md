| Toy             | Observations across 1 run           | Findings / missing input                                 | Evidence                               |
| --------------- | ----------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| photo-3d        | 17 passed                           | No failed checks                                         | [Run 1](run-1-photo-3d-01.json)        |
| moving-photo-3d | 13 passed                           | No failed checks                                         | [Run 1](run-1-moving-photo-3d-01.json) |
| qr-code         | 6 passed, 1 inconclusive, 1 blocked | blocked, needs the owner: a second phone and camera scan | [Run 1](run-1-qr-code-01.json)         |
| qr-picture      | 7 passed, 1 blocked                 | blocked, needs the owner: a second phone and camera scan | [Run 1](run-1-qr-picture-01.json)      |
| qr-three        | 6 passed, 1 inconclusive, 1 blocked | blocked, needs the owner: a second phone and camera scan | [Run 1](run-1-qr-three-01.json)        |
| share-qr        | 7 passed, 1 blocked                 | blocked, needs the owner: a second phone and camera scan | [Run 1](run-1-share-qr-01.json)        |

# Advisor demo route evidence

Recorded October 15, 2026 at 10:56:35 AM EDT, build `7805082258dafdf0acd3e84b5f5c0170e2ce71af`,
Chromium 151.0.7922.173. Codex (GPT-6) built this harness. Rule check: none.

Graphics: WebGL2; ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)),
SwiftShader driver). 56 passed, 2 inconclusive, 4 blocked. Each independent route starts with empty
storage at 390 × 844 CSS pixels and DPR 1. The runs force `profile=mid&adapt=off`, labs on, and
scene seed 1. The initial storage, resolved options, browser, backend, numbered actions, errors,
expected results, and actual results are recorded in each step. Creation timestamps remain real and
can change exact share URLs across runs.

## Distinct findings and missing inputs

The 6 distinct observations below group repeated runs by cause. Photo Splats status failures in
steps 5–7 share one status-text finding owned by task 76 when present. Full-viewport reads are
supplementary, inconclusive diagnostics when readers fail; they have no toy owner and do not affect
the exit code. The visible code and real exported PNG have separate exact-payload checks with both
vendored readers. A second-phone scan stays **blocked, needs the owner**.

| Step(s)                        | Result       | Finding / smallest missing input                                            | Owner                                            | Reproduction records              |
| ------------------------------ | ------------ | --------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| qr-code: Full viewport decode  | inconclusive | Inconclusive: the full viewport includes other QR codes in shelf thumbnails | No toy owner: supplementary diagnostic           | [Run 1](run-1-qr-code-05.json)    |
| qr-code: Second-phone scan     | blocked      | blocked, needs the owner: a second phone and camera scan                    | QR lane (no owning task named in task 84)        | [Run 1](run-1-qr-code-07.json)    |
| qr-picture: Second-phone scan  | blocked      | blocked, needs the owner: a second phone and camera scan                    | tasks 79 and 80                                  | [Run 1](run-1-qr-picture-07.json) |
| qr-three: Full viewport decode | inconclusive | Inconclusive: the full viewport includes other QR codes in shelf thumbnails | No toy owner: supplementary diagnostic           | [Run 1](run-1-qr-three-05.json)   |
| qr-three: Second-phone scan    | blocked      | blocked, needs the owner: a second phone and camera scan                    | task 72                                          | [Run 1](run-1-qr-three-07.json)   |
| share-qr: Second-phone scan    | blocked      | blocked, needs the owner: a second phone and camera scan                    | QR share sheet (no owning task named in task 84) | [Run 1](run-1-share-qr-07.json)   |

A local-file link carries settings and file details, never the file bytes. Recipient records and
screenshots show exactly what a fresh recipient sees and whether the page clearly asks them to
reopen the file. A failure here belongs to the toy's owning task; this PR fixes no toys.

## Run it again

Start a static server with `npm run serve`, then run
`SPLASHERY_CHROMIUM=/path/to/chromium node tools/adv-route.mjs`. Output defaults to
`.cache/advisor-route/`, so a rerun cannot overwrite this committed report. `ADV_OUT` selects
another output directory, `SPLASHERY_URL` the server, `ADV_PAYLOAD` the QR toys' text, and
`ADV_RUNS` 1–3 repetitions (default 3). Pass counts use the actual number requested; a one-run
dispatch is not three-run evidence. Each result is saved as a per-step JSON file; `summary.json`
indexes those files without duplicating their contents.

The evidence workflow is **workflow_dispatch only**, one run per dispatch, with `ADV_RUNS=1` and
`ADV_FAIL_ON_FINDINGS=0`. Route findings are reported without making that job red; infrastructure
failures and regression failures still fail. Locally the runner exits 1 for failed checks unless
`ADV_FAIL_ON_FINDINGS=0`; inconclusive and blocked observations never trigger that exit. The
Operator controls manual evidence dispatches and the full-suite label. Check the latest Actions run
separately from these local results.

For the owner's Mac:
`ADV_OUT=.cache/advisor-route-mac ADV_REAL_GPU=1 ADV_HEADED=1 node tools/adv-route.mjs`. This
removes all software-renderer flags and allows the app's automatic backend choice. Request WebGPU
with `ADV_RENDERER=webgpu`, then inspect the actual recorded backend. Physical camera scans,
hardware smoothness, real-device load times, GPU presentation, and hardware WebGPU remain unmeasured
until an owner device run.

## Inputs and measurement method

Both local fixtures are **synthetic**: `tests/fixtures/p3d/scene.jpg` is a generated disc on a
striped wall, and `tests/fixtures/psv3/silent.webm` is a synthetic silent test clip. File hashes and
sizes are in every step's fixture metadata. Shipped samples are loaded unchanged; local depth
inference is real, with no media or model mocks. Photo depth is **estimated relative depth**, never
measured geometry.

These Moving photo to 3D measurements do not describe Video to 3D. First-frame timing records
navigation-to-frame and chooseToy-to-frame at the first PlayCanvas postrender for the nonbusy target
with Sharp picture visible. Two stage captures then settle the screenshot. Playback samples record
performance.now differences at postrender, source positions, and frame numbers. Min, median, p95,
and max are retained with raw samples. They describe CPU render completion, not GPU completion or
display presentation. Software rendering and automation overhead influence the values.
stageUpdateTicks counts updates, not rendered frames. Photo steps 3, 6, and 7 explicitly check view
and camera pose; Splats also checks status text.

PNG exports come from the real exporters, not regenerated matrices. Untouched exports and separately
saved copies scaled to at most 390 pixels are each decoded with vendor jsQR and ZXing. The visible
stage or share-dialog canvas is captured at its actual phone CSS size. Full unscaled viewport
screenshots include shelf QR thumbnails; failing reads are inconclusive about the target. Settings
marked `assumed` in QR metadata are not measurements; app-returned options and metrics are labeled
separately. Three QR uses the same payload in all three channels, which does not prove
distinct-channel separation.

For bounded Share exports only, ZXing samples the existing raster at module centers using the
exporter's declared version, after checking the square dimensions, quiet border, finders, and timing
pattern. Its general finder can mistake dense data for a finder, and its pure-image shortcut can
round fractional phone module widths to an invalid grid size. The vendored ZXing decoder still reads
and error-corrects the sampled data, and jsQR still reads the original raster independently. Export
records retain this explicit geometry in `decodeOptions` and the separate general finder result in
`generalDecoded`. On-screen and full-viewport checks retain the general finder; this export check
does not measure phone-camera detection.

## Share QR origin and size

The share QR holds the actual scene URL, including the captured origin: **http://127.0.0.1:4173**.
Another phone cannot reach this server through that loopback URL. Run 1 has a **759-character link
and 105 modules per side**. Sizes below are read from this capture and can vary with timestamps.
Exact URLs and both decoded strings are retained in the linked records.

| Run | Encoded origin        | Link characters | Modules per side | Evidence                                        |
| --- | --------------------- | --------------- | ---------------- | ----------------------------------------------- |
| 1   | http://127.0.0.1:4173 | 759             | 105              | [Exact URL and decodes](run-1-share-qr-02.json) |

## Moving photo timings

Milliseconds on the recorded backend; these do not predict performance on another device.

| Run | Choose toy to first frame | Navigation to first frame | Frame min | Median | p95   | Max   |
| --- | ------------------------- | ------------------------- | --------- | ------ | ----- | ----- |
| 1   | 7413.8                    | 9963.3                    | 6.9       | 148.7  | 187.2 | 345.1 |

## Every step

| Step                                              | Result       | Passed of requested runs | Evidence                                                                                                                                                          |
| ------------------------------------------------- | ------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| photo-3d: Fresh load                              | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-01.json), [1 file 1](run-1-photo-3d-01.png)                                                                                             |
| photo-3d: Sample front                            | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-02.json), [1 file 1](run-1-photo-3d-02.png)                                                                                             |
| photo-3d: Sample oblique                          | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-03.json), [1 file 1](run-1-photo-3d-03.png)                                                                                             |
| photo-3d: Orbit drag                              | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-04.json), [1 file 1](run-1-photo-3d-04.png)                                                                                             |
| photo-3d: Splats                                  | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-05.json), [1 file 1](run-1-photo-3d-05.png)                                                                                             |
| photo-3d: Splats front                            | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-06.json), [1 file 1](run-1-photo-3d-06.png)                                                                                             |
| photo-3d: Splats oblique                          | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-07.json), [1 file 1](run-1-photo-3d-07.png)                                                                                             |
| photo-3d: Sharp picture and depth slider          | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-08.json), [1 file 1](run-1-photo-3d-08.png)                                                                                             |
| photo-3d: Reset camera                            | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-09.json), [1 file 1](run-1-photo-3d-09.png)                                                                                             |
| photo-3d: Local still                             | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-10.json), [1 file 1](run-1-photo-3d-10.png)                                                                                             |
| photo-3d: Local front                             | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-11.json), [1 file 1](run-1-photo-3d-11.png)                                                                                             |
| photo-3d: Local oblique                           | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-12.json), [1 file 1](run-1-photo-3d-12.png)                                                                                             |
| photo-3d: Local-file recipient                    | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-13.json), [1 file 1](run-1-photo-3d-13-recipient.png), [1 file 2](run-1-photo-3d-13.png)                                                |
| photo-3d: Back to sample                          | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-14.json), [1 file 1](run-1-photo-3d-14.png)                                                                                             |
| photo-3d: Save scene and reopen                   | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-15.json), [1 file 1](run-1-photo-scene.json), [1 file 2](run-1-photo-3d-15.png)                                                         |
| photo-3d: Sample recipient                        | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-16.json), [1 file 1](run-1-photo-3d-16-recipient.png), [1 file 2](run-1-photo-3d-16.png)                                                |
| photo-3d: Route console and network health        | passed       | 1/1 (1 attempted)        | [1 record](run-1-photo-3d-17.json), [1 file 1](run-1-photo-3d-17.png)                                                                                             |
| moving-photo-3d: Fresh load                       | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-01.json), [1 file 1](run-1-moving-photo-3d-01.png)                                                                               |
| moving-photo-3d: Play and frame-time spread       | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-02.json), [1 file 1](run-1-moving-photo-3d-02.png)                                                                               |
| moving-photo-3d: Pause                            | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-03.json), [1 file 1](run-1-moving-photo-3d-03.png)                                                                               |
| moving-photo-3d: Seek                             | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-04.json), [1 file 1](run-1-moving-photo-3d-04.png)                                                                               |
| moving-photo-3d: End and loop                     | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-05.json), [1 file 1](run-1-moving-photo-3d-05.png)                                                                               |
| moving-photo-3d: Sample recipient                 | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-06.json), [1 file 1](run-1-moving-photo-3d-6-recipient.png), [1 file 2](run-1-moving-photo-3d-06.png)                            |
| moving-photo-3d: Local clip                       | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-07.json), [1 file 1](run-1-moving-photo-3d-07.png)                                                                               |
| moving-photo-3d: Local clip playback              | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-08.json), [1 file 1](run-1-moving-photo-3d-08.png)                                                                               |
| moving-photo-3d: Local-file recipient             | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-09.json), [1 file 1](run-1-moving-photo-3d-9-recipient.png), [1 file 2](run-1-moving-photo-3d-09.png)                            |
| moving-photo-3d: Switch sources five times        | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-10.json), [1 file 1](run-1-moving-photo-3d-10.png)                                                                               |
| moving-photo-3d: Back to still photo              | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-11.json), [1 file 1](run-1-moving-photo-3d-11.png)                                                                               |
| moving-photo-3d: Reload                           | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-12.json), [1 file 1](run-1-moving-photo-3d-12.png)                                                                               |
| moving-photo-3d: Route console and network health | passed       | 1/1 (1 attempted)        | [1 record](run-1-moving-photo-3d-13.json), [1 file 1](run-1-moving-photo-3d-13.png)                                                                               |
| qr-code: Fresh load                               | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-code-01.json), [1 file 1](run-1-qr-code-01.png)                                                                                               |
| qr-code: Export and decode PNG                    | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-code-02.json), [1 file 1](run-1-qr-code-export.png), [1 file 2](run-1-qr-code-export-phone.png), [1 file 3](run-1-qr-code-02.png)             |
| qr-code: Native-size exported decode              | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-code-03.json), [1 file 1](run-1-qr-code-03.png)                                                                                               |
| qr-code: On-screen decode at phone size           | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-code-04.json), [1 file 1](run-1-qr-code-target-screen.png), [1 file 2](run-1-qr-code-04.png)                                                  |
| qr-code: Full viewport decode                     | inconclusive | 0/1 (1 attempted)        | [1 record](run-1-qr-code-05.json), [1 file 1](run-1-qr-code-screen.png), [1 file 2](run-1-qr-code-05.png)                                                         |
| qr-code: Recipient link                           | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-code-06.json), [1 file 1](run-1-qr-code-6-recipient.png), [1 file 2](run-1-qr-code-06.png)                                                    |
| qr-code: Second-phone scan                        | blocked      | 0/1 (0 attempted)        | [1 record](run-1-qr-code-07.json), [1 file 1](run-1-qr-code-07.png)                                                                                               |
| qr-code: Route console and network health         | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-code-08.json), [1 file 1](run-1-qr-code-08.png)                                                                                               |
| qr-picture: Fresh load                            | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-01.json), [1 file 1](run-1-qr-picture-01.png)                                                                                         |
| qr-picture: Export and decode PNG                 | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-02.json), [1 file 1](run-1-qr-picture-export.png), [1 file 2](run-1-qr-picture-export-phone.png), [1 file 3](run-1-qr-picture-02.png) |
| qr-picture: Native-size exported decode           | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-03.json), [1 file 1](run-1-qr-picture-03.png)                                                                                         |
| qr-picture: On-screen decode at phone size        | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-04.json), [1 file 1](run-1-qr-picture-target-screen.png), [1 file 2](run-1-qr-picture-04.png)                                         |
| qr-picture: Full viewport decode                  | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-05.json), [1 file 1](run-1-qr-picture-screen.png), [1 file 2](run-1-qr-picture-05.png)                                                |
| qr-picture: Recipient link                        | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-06.json), [1 file 1](run-1-qr-picture-6-recipient.png), [1 file 2](run-1-qr-picture-06.png)                                           |
| qr-picture: Second-phone scan                     | blocked      | 0/1 (0 attempted)        | [1 record](run-1-qr-picture-07.json), [1 file 1](run-1-qr-picture-07.png)                                                                                         |
| qr-picture: Route console and network health      | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-picture-08.json), [1 file 1](run-1-qr-picture-08.png)                                                                                         |
| qr-three: Fresh load                              | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-three-01.json), [1 file 1](run-1-qr-three-01.png)                                                                                             |
| qr-three: Export and decode PNG                   | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-three-02.json), [1 file 1](run-1-qr-three-export.png), [1 file 2](run-1-qr-three-export-phone.png), [1 file 3](run-1-qr-three-02.png)         |
| qr-three: Native-size exported decode             | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-three-03.json), [1 file 1](run-1-qr-three-03.png)                                                                                             |
| qr-three: On-screen decode at phone size          | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-three-04.json), [1 file 1](run-1-qr-three-target-screen.png), [1 file 2](run-1-qr-three-04.png)                                               |
| qr-three: Full viewport decode                    | inconclusive | 0/1 (1 attempted)        | [1 record](run-1-qr-three-05.json), [1 file 1](run-1-qr-three-screen.png), [1 file 2](run-1-qr-three-05.png)                                                      |
| qr-three: Recipient link                          | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-three-06.json), [1 file 1](run-1-qr-three-6-recipient.png), [1 file 2](run-1-qr-three-06.png)                                                 |
| qr-three: Second-phone scan                       | blocked      | 0/1 (0 attempted)        | [1 record](run-1-qr-three-07.json), [1 file 1](run-1-qr-three-07.png)                                                                                             |
| qr-three: Route console and network health        | passed       | 1/1 (1 attempted)        | [1 record](run-1-qr-three-08.json), [1 file 1](run-1-qr-three-08.png)                                                                                             |
| share-qr: Fresh load                              | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-01.json), [1 file 1](run-1-share-qr-01.png)                                                                                             |
| share-qr: Export and decode PNG                   | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-02.json), [1 file 1](run-1-share-qr-export.png), [1 file 2](run-1-share-qr-export-phone.png), [1 file 3](run-1-share-qr-02.png)         |
| share-qr: Native-size exported decode             | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-03.json), [1 file 1](run-1-share-qr-03.png)                                                                                             |
| share-qr: On-screen decode at phone size          | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-04.json), [1 file 1](run-1-share-qr-target-screen.png), [1 file 2](run-1-share-qr-04.png)                                               |
| share-qr: Full viewport decode                    | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-05.json), [1 file 1](run-1-share-qr-screen.png), [1 file 2](run-1-share-qr-05.png)                                                      |
| share-qr: Recipient link                          | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-06.json), [1 file 1](run-1-share-qr-6-recipient.png), [1 file 2](run-1-share-qr-06.png)                                                 |
| share-qr: Second-phone scan                       | blocked      | 0/1 (0 attempted)        | [1 record](run-1-share-qr-07.json), [1 file 1](run-1-share-qr-07.png)                                                                                             |
| share-qr: Route console and network health        | passed       | 1/1 (1 attempted)        | [1 record](run-1-share-qr-08.json), [1 file 1](run-1-share-qr-08.png)                                                                                             |

Each numbered run links its JSON record and evidence files; file order matches the record's evidence
array. Every failure is retained. Images are at most 1 MB each. Runs stored on
`codex/advisor-route-evidence-clips` are evidence only and that branch must never be merged.
