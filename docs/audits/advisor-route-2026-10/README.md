# Advisor demo route evidence

Recorded October 15, 2026, at 02:13:31 UTC, build `4cc7d635bd641cbac436e3f4a20b2c3e8e46f199`,
Chromium 151.0.7922.173. Rule check: none. Codex built this evidence harness.

Graphics: WebGL2; ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)),
SwiftShader driver). 159 passed, 15 failed, and 12 blocked step records. Failures make the runner
exit with status 1 and remain findings for the owning tasks.

Run a static server with `npm run serve`, then
`SPLASHERY_CHROMIUM=/path/to/chromium node tools/adv-route.mjs`. The default is three independent
runs, each route in a fresh browser context with empty cookies, local storage, and session storage.
Each route uses scene seed 1 to keep scene generation and settings repeatable. Share URLs also carry
their creation timestamp, so each exact URL is recorded verbatim and may differ across runs.
`ADV_PAYLOAD` overrides the QR toys' payload, `ADV_OUT` selects an output directory, `SPLASHERY_URL`
selects the server, and `ADV_RUNS=1` is a development smoke run, never three-run evidence.

For the owner's Mac, use
`ADV_OUT=.cache/advisor-route-mac ADV_REAL_GPU=1 ADV_HEADED=1 node tools/adv-route.mjs`; this
removes all software-renderer flags and permits the app's automatic backend choice. Use
`ADV_RENDERER=webgpu` to request WebGPU explicitly, and check the recorded actual backend and
renderer. Real-device smoothness, real load times, GPU presentation, and hardware WebGPU remain
blocked until that run. No software result proves them.

Photo depth is estimated from pictures, never measured geometry. The local JPEG and silent WebM are
existing repository fixtures; hashes are in results.json. The moving measurements belong to Moving
photo to 3D, not Video to 3D. First-frame timing records navigation-to-frame and chooseToy-to-frame
at the first PlayCanvas postrender event for the nonbusy target (with Sharp picture visible for
photo routes). Two stage captures then settle the screenshot. It is not the moment pixels reach a
display. Playback intervals are performance.now differences at PlayCanvas postrender, with source
positions and frame numbers, and min, median, p95, and max recorded. These events mark CPU render
completion, not GPU completion or display presentation. The software renderer and automation
overhead influence all timings. stageUpdateTicks is a diagnostic update count, not a rendered-frame
count. No mocked media or depth model is used.

All screenshots use a 390 × 844 CSS-pixel viewport at DPR 1. PNG exports use the real exporters: 390
pixels for QR code and Picture QR, the current phone canvas for Three QR, and the share sheet's
native PNG size. Each untouched export is saved and decoded, and a separately saved copy is scaled
to a maximum dimension of 390 pixels for the required phone-size decode. Native-size failures remain
findings even when the phone-size copy decodes. The screen decoder reads a screenshot of the visible
stage (or the share dialog canvas), cropped only to that element at its actual CSS size. The full
unscaled viewport is also decoded separately; it includes QR thumbnails in the shelf, which can
interfere with detection. Both checks retain failures. No on-screen screenshot is replaced by an
offscreen render. Each step records options, camera, actual backend, renderer string, labs state,
initial and final storage, expected and actual results, duration, evidence, and route logs. Logs are
also separate per route. Steps use the public app hooks for deterministic controls and actual file
inputs and exporters; this is browser integration evidence, not a test of every pointer target.

The QR toys use the same exact payload throughout. Three QR uses that payload in all three channels;
this does not establish distinct-channel separation. The share QR holds the actual scene URL
(recorded exactly), which cannot be replaced by ADV_PAYLOAD without changing the feature. Themes,
contrast, and quiet zones are in the QR step records. A generated code or a successful software
decode is not a phone scan: **scanned with a second phone: blocked, needs the owner**, with a second
phone and camera as the missing input.

Only Photo to 3D's checkpoint file existed on main at this build. The requested Moving photo, QR
code, and Picture QR checkpoint files were not yet present. No changes were made to src/, assets/,
vendor/, or existing toy tests.

## Findings to hand back

Both local-file links preserve the custom source settings and file names, but the fresh recipient
shows a shipped sample without a clear prompt to reopen the missing file. See the
[Photo recipient](run-1-photo-3d-13-recipient.png) and
[Moving photo recipient](run-1-moving-photo-3d-9-recipient.png); tasks 76 and 48 own these findings.
The file bytes are absent from the links.

All four QR routes pass both readers on their native exports, phone-size exports, and visible-code
screenshots in all three runs. Full-viewport decoding fails with jsQR in all three runs for QR code,
Three QR, and the share sheet. ZXing also fails on the share sheet in run 1, but returns the exact
share URL in runs 2 and 3. These supplementary failures are retained separately from the required
visible-code checks.

## Moving photo timings

Milliseconds, measured in this browser with the method above. These observations describe the
recorded backend and do not predict performance on other devices.

| Run | Choose toy to first frame | Navigation to first frame | Frame min | Median | p95   | Max   |
| --- | ------------------------- | ------------------------- | --------- | ------ | ----- | ----- |
| 1   | 6751.8                    | 9793.1                    | 4.7       | 132.9  | 159.0 | 273.6 |
| 2   | 6526.8                    | 9159.2                    | 10.3      | 135.4  | 173.2 | 272.9 |
| 3   | 6397.4                    | 9342.9                    | 126.3     | 149.6  | 176.2 | 197.1 |

## Results

| Step                                              | Result  | Passed of three   | Evidence records                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| photo-3d: Fresh load                              | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-01.json), [1 file 1](run-1-photo-3d-01.png); [2 record](run-2-photo-3d-01.json), [2 file 1](run-2-photo-3d-01.png); [3 record](run-3-photo-3d-01.json), [3 file 1](run-3-photo-3d-01.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Sample front                            | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-02.json), [1 file 1](run-1-photo-3d-02.png); [2 record](run-2-photo-3d-02.json), [2 file 1](run-2-photo-3d-02.png); [3 record](run-3-photo-3d-02.json), [3 file 1](run-3-photo-3d-02.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Sample oblique                          | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-03.json), [1 file 1](run-1-photo-3d-03.png); [2 record](run-2-photo-3d-03.json), [2 file 1](run-2-photo-3d-03.png); [3 record](run-3-photo-3d-03.json), [3 file 1](run-3-photo-3d-03.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Orbit drag                              | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-04.json), [1 file 1](run-1-photo-3d-04.png); [2 record](run-2-photo-3d-04.json), [2 file 1](run-2-photo-3d-04.png); [3 record](run-3-photo-3d-04.json), [3 file 1](run-3-photo-3d-04.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Splats                                  | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-05.json), [1 file 1](run-1-photo-3d-05.png); [2 record](run-2-photo-3d-05.json), [2 file 1](run-2-photo-3d-05.png); [3 record](run-3-photo-3d-05.json), [3 file 1](run-3-photo-3d-05.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Splats front                            | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-06.json), [1 file 1](run-1-photo-3d-06.png); [2 record](run-2-photo-3d-06.json), [2 file 1](run-2-photo-3d-06.png); [3 record](run-3-photo-3d-06.json), [3 file 1](run-3-photo-3d-06.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Splats oblique                          | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-07.json), [1 file 1](run-1-photo-3d-07.png); [2 record](run-2-photo-3d-07.json), [2 file 1](run-2-photo-3d-07.png); [3 record](run-3-photo-3d-07.json), [3 file 1](run-3-photo-3d-07.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Sharp picture and depth slider          | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-08.json), [1 file 1](run-1-photo-3d-08.png); [2 record](run-2-photo-3d-08.json), [2 file 1](run-2-photo-3d-08.png); [3 record](run-3-photo-3d-08.json), [3 file 1](run-3-photo-3d-08.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Reset camera                            | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-09.json), [1 file 1](run-1-photo-3d-09.png); [2 record](run-2-photo-3d-09.json), [2 file 1](run-2-photo-3d-09.png); [3 record](run-3-photo-3d-09.json), [3 file 1](run-3-photo-3d-09.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Local still                             | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-10.json), [1 file 1](run-1-photo-3d-10.png); [2 record](run-2-photo-3d-10.json), [2 file 1](run-2-photo-3d-10.png); [3 record](run-3-photo-3d-10.json), [3 file 1](run-3-photo-3d-10.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Local front                             | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-11.json), [1 file 1](run-1-photo-3d-11.png); [2 record](run-2-photo-3d-11.json), [2 file 1](run-2-photo-3d-11.png); [3 record](run-3-photo-3d-11.json), [3 file 1](run-3-photo-3d-11.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Local oblique                           | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-12.json), [1 file 1](run-1-photo-3d-12.png); [2 record](run-2-photo-3d-12.json), [2 file 1](run-2-photo-3d-12.png); [3 record](run-3-photo-3d-12.json), [3 file 1](run-3-photo-3d-12.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Local-file recipient                    | failed  | 0/3 (3 attempted) | [1 record](run-1-photo-3d-13.json), [1 file 1](run-1-photo-3d-13-recipient.png), [1 file 2](run-1-photo-3d-13.png); [2 record](run-2-photo-3d-13.json), [2 file 1](run-2-photo-3d-13-recipient.png), [2 file 2](run-2-photo-3d-13.png); [3 record](run-3-photo-3d-13.json), [3 file 1](run-3-photo-3d-13-recipient.png), [3 file 2](run-3-photo-3d-13.png)                                                                                                                                              |
| photo-3d: Back to sample                          | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-14.json), [1 file 1](run-1-photo-3d-14.png); [2 record](run-2-photo-3d-14.json), [2 file 1](run-2-photo-3d-14.png); [3 record](run-3-photo-3d-14.json), [3 file 1](run-3-photo-3d-14.png)                                                                                                                                                                                                                                                                                     |
| photo-3d: Save scene and reopen                   | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-15.json), [1 file 1](run-1-photo-scene.json), [1 file 2](run-1-photo-3d-15.png); [2 record](run-2-photo-3d-15.json), [2 file 1](run-2-photo-scene.json), [2 file 2](run-2-photo-3d-15.png); [3 record](run-3-photo-3d-15.json), [3 file 1](run-3-photo-scene.json), [3 file 2](run-3-photo-3d-15.png)                                                                                                                                                                         |
| photo-3d: Sample recipient                        | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-16.json), [1 file 1](run-1-photo-3d-16-recipient.png), [1 file 2](run-1-photo-3d-16.png); [2 record](run-2-photo-3d-16.json), [2 file 1](run-2-photo-3d-16-recipient.png), [2 file 2](run-2-photo-3d-16.png); [3 record](run-3-photo-3d-16.json), [3 file 1](run-3-photo-3d-16-recipient.png), [3 file 2](run-3-photo-3d-16.png)                                                                                                                                              |
| photo-3d: Route console and network health        | passed  | 3/3 (3 attempted) | [1 record](run-1-photo-3d-17.json), [1 file 1](run-1-photo-3d-17.png); [2 record](run-2-photo-3d-17.json), [2 file 1](run-2-photo-3d-17.png); [3 record](run-3-photo-3d-17.json), [3 file 1](run-3-photo-3d-17.png)                                                                                                                                                                                                                                                                                     |
| moving-photo-3d: Fresh load                       | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-01.json), [1 file 1](run-1-moving-photo-3d-01.png); [2 record](run-2-moving-photo-3d-01.json), [2 file 1](run-2-moving-photo-3d-01.png); [3 record](run-3-moving-photo-3d-01.json), [3 file 1](run-3-moving-photo-3d-01.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Play and frame-time spread       | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-02.json), [1 file 1](run-1-moving-photo-3d-02.png); [2 record](run-2-moving-photo-3d-02.json), [2 file 1](run-2-moving-photo-3d-02.png); [3 record](run-3-moving-photo-3d-02.json), [3 file 1](run-3-moving-photo-3d-02.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Pause                            | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-03.json), [1 file 1](run-1-moving-photo-3d-03.png); [2 record](run-2-moving-photo-3d-03.json), [2 file 1](run-2-moving-photo-3d-03.png); [3 record](run-3-moving-photo-3d-03.json), [3 file 1](run-3-moving-photo-3d-03.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Seek                             | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-04.json), [1 file 1](run-1-moving-photo-3d-04.png); [2 record](run-2-moving-photo-3d-04.json), [2 file 1](run-2-moving-photo-3d-04.png); [3 record](run-3-moving-photo-3d-04.json), [3 file 1](run-3-moving-photo-3d-04.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: End and loop                     | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-05.json), [1 file 1](run-1-moving-photo-3d-05.png); [2 record](run-2-moving-photo-3d-05.json), [2 file 1](run-2-moving-photo-3d-05.png); [3 record](run-3-moving-photo-3d-05.json), [3 file 1](run-3-moving-photo-3d-05.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Sample recipient                 | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-06.json), [1 file 1](run-1-moving-photo-3d-6-recipient.png), [1 file 2](run-1-moving-photo-3d-06.png); [2 record](run-2-moving-photo-3d-06.json), [2 file 1](run-2-moving-photo-3d-6-recipient.png), [2 file 2](run-2-moving-photo-3d-06.png); [3 record](run-3-moving-photo-3d-06.json), [3 file 1](run-3-moving-photo-3d-6-recipient.png), [3 file 2](run-3-moving-photo-3d-06.png)                                                                                  |
| moving-photo-3d: Local clip                       | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-07.json), [1 file 1](run-1-moving-photo-3d-07.png); [2 record](run-2-moving-photo-3d-07.json), [2 file 1](run-2-moving-photo-3d-07.png); [3 record](run-3-moving-photo-3d-07.json), [3 file 1](run-3-moving-photo-3d-07.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Local clip playback              | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-08.json), [1 file 1](run-1-moving-photo-3d-08.png); [2 record](run-2-moving-photo-3d-08.json), [2 file 1](run-2-moving-photo-3d-08.png); [3 record](run-3-moving-photo-3d-08.json), [3 file 1](run-3-moving-photo-3d-08.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Local-file recipient             | failed  | 0/3 (3 attempted) | [1 record](run-1-moving-photo-3d-09.json), [1 file 1](run-1-moving-photo-3d-9-recipient.png), [1 file 2](run-1-moving-photo-3d-09.png); [2 record](run-2-moving-photo-3d-09.json), [2 file 1](run-2-moving-photo-3d-9-recipient.png), [2 file 2](run-2-moving-photo-3d-09.png); [3 record](run-3-moving-photo-3d-09.json), [3 file 1](run-3-moving-photo-3d-9-recipient.png), [3 file 2](run-3-moving-photo-3d-09.png)                                                                                  |
| moving-photo-3d: Switch sources five times        | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-10.json), [1 file 1](run-1-moving-photo-3d-10.png); [2 record](run-2-moving-photo-3d-10.json), [2 file 1](run-2-moving-photo-3d-10.png); [3 record](run-3-moving-photo-3d-10.json), [3 file 1](run-3-moving-photo-3d-10.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Back to still photo              | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-11.json), [1 file 1](run-1-moving-photo-3d-11.png); [2 record](run-2-moving-photo-3d-11.json), [2 file 1](run-2-moving-photo-3d-11.png); [3 record](run-3-moving-photo-3d-11.json), [3 file 1](run-3-moving-photo-3d-11.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Reload                           | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-12.json), [1 file 1](run-1-moving-photo-3d-12.png); [2 record](run-2-moving-photo-3d-12.json), [2 file 1](run-2-moving-photo-3d-12.png); [3 record](run-3-moving-photo-3d-12.json), [3 file 1](run-3-moving-photo-3d-12.png)                                                                                                                                                                                                                                           |
| moving-photo-3d: Route console and network health | passed  | 3/3 (3 attempted) | [1 record](run-1-moving-photo-3d-13.json), [1 file 1](run-1-moving-photo-3d-13.png); [2 record](run-2-moving-photo-3d-13.json), [2 file 1](run-2-moving-photo-3d-13.png); [3 record](run-3-moving-photo-3d-13.json), [3 file 1](run-3-moving-photo-3d-13.png)                                                                                                                                                                                                                                           |
| qr-code: Fresh load                               | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-code-01.json), [1 file 1](run-1-qr-code-01.png); [2 record](run-2-qr-code-01.json), [2 file 1](run-2-qr-code-01.png); [3 record](run-3-qr-code-01.json), [3 file 1](run-3-qr-code-01.png)                                                                                                                                                                                                                                                                                           |
| qr-code: Export and decode PNG                    | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-code-02.json), [1 file 1](run-1-qr-code-export.png), [1 file 2](run-1-qr-code-export-phone.png), [1 file 3](run-1-qr-code-02.png); [2 record](run-2-qr-code-02.json), [2 file 1](run-2-qr-code-export.png), [2 file 2](run-2-qr-code-export-phone.png), [2 file 3](run-2-qr-code-02.png); [3 record](run-3-qr-code-02.json), [3 file 1](run-3-qr-code-export.png), [3 file 2](run-3-qr-code-export-phone.png), [3 file 3](run-3-qr-code-02.png)                                     |
| qr-code: Native-size exported decode              | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-code-03.json), [1 file 1](run-1-qr-code-03.png); [2 record](run-2-qr-code-03.json), [2 file 1](run-2-qr-code-03.png); [3 record](run-3-qr-code-03.json), [3 file 1](run-3-qr-code-03.png)                                                                                                                                                                                                                                                                                           |
| qr-code: On-screen decode at phone size           | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-code-04.json), [1 file 1](run-1-qr-code-target-screen.png), [1 file 2](run-1-qr-code-04.png); [2 record](run-2-qr-code-04.json), [2 file 1](run-2-qr-code-target-screen.png), [2 file 2](run-2-qr-code-04.png); [3 record](run-3-qr-code-04.json), [3 file 1](run-3-qr-code-target-screen.png), [3 file 2](run-3-qr-code-04.png)                                                                                                                                                    |
| qr-code: Full viewport decode                     | failed  | 0/3 (3 attempted) | [1 record](run-1-qr-code-05.json), [1 file 1](run-1-qr-code-screen.png), [1 file 2](run-1-qr-code-05.png); [2 record](run-2-qr-code-05.json), [2 file 1](run-2-qr-code-screen.png), [2 file 2](run-2-qr-code-05.png); [3 record](run-3-qr-code-05.json), [3 file 1](run-3-qr-code-screen.png), [3 file 2](run-3-qr-code-05.png)                                                                                                                                                                         |
| qr-code: Recipient link                           | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-code-06.json), [1 file 1](run-1-qr-code-6-recipient.png), [1 file 2](run-1-qr-code-06.png); [2 record](run-2-qr-code-06.json), [2 file 1](run-2-qr-code-6-recipient.png), [2 file 2](run-2-qr-code-06.png); [3 record](run-3-qr-code-06.json), [3 file 1](run-3-qr-code-6-recipient.png), [3 file 2](run-3-qr-code-06.png)                                                                                                                                                          |
| qr-code: Second-phone scan                        | blocked | 0/3 (0 attempted) | [1 record](run-1-qr-code-07.json), [1 file 1](run-1-qr-code-07.png); [2 record](run-2-qr-code-07.json), [2 file 1](run-2-qr-code-07.png); [3 record](run-3-qr-code-07.json), [3 file 1](run-3-qr-code-07.png)                                                                                                                                                                                                                                                                                           |
| qr-code: Route console and network health         | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-code-08.json), [1 file 1](run-1-qr-code-08.png); [2 record](run-2-qr-code-08.json), [2 file 1](run-2-qr-code-08.png); [3 record](run-3-qr-code-08.json), [3 file 1](run-3-qr-code-08.png)                                                                                                                                                                                                                                                                                           |
| qr-picture: Fresh load                            | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-01.json), [1 file 1](run-1-qr-picture-01.png); [2 record](run-2-qr-picture-01.json), [2 file 1](run-2-qr-picture-01.png); [3 record](run-3-qr-picture-01.json), [3 file 1](run-3-qr-picture-01.png)                                                                                                                                                                                                                                                                         |
| qr-picture: Export and decode PNG                 | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-02.json), [1 file 1](run-1-qr-picture-export.png), [1 file 2](run-1-qr-picture-export-phone.png), [1 file 3](run-1-qr-picture-02.png); [2 record](run-2-qr-picture-02.json), [2 file 1](run-2-qr-picture-export.png), [2 file 2](run-2-qr-picture-export-phone.png), [2 file 3](run-2-qr-picture-02.png); [3 record](run-3-qr-picture-02.json), [3 file 1](run-3-qr-picture-export.png), [3 file 2](run-3-qr-picture-export-phone.png), [3 file 3](run-3-qr-picture-02.png) |
| qr-picture: Native-size exported decode           | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-03.json), [1 file 1](run-1-qr-picture-03.png); [2 record](run-2-qr-picture-03.json), [2 file 1](run-2-qr-picture-03.png); [3 record](run-3-qr-picture-03.json), [3 file 1](run-3-qr-picture-03.png)                                                                                                                                                                                                                                                                         |
| qr-picture: On-screen decode at phone size        | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-04.json), [1 file 1](run-1-qr-picture-target-screen.png), [1 file 2](run-1-qr-picture-04.png); [2 record](run-2-qr-picture-04.json), [2 file 1](run-2-qr-picture-target-screen.png), [2 file 2](run-2-qr-picture-04.png); [3 record](run-3-qr-picture-04.json), [3 file 1](run-3-qr-picture-target-screen.png), [3 file 2](run-3-qr-picture-04.png)                                                                                                                         |
| qr-picture: Full viewport decode                  | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-05.json), [1 file 1](run-1-qr-picture-screen.png), [1 file 2](run-1-qr-picture-05.png); [2 record](run-2-qr-picture-05.json), [2 file 1](run-2-qr-picture-screen.png), [2 file 2](run-2-qr-picture-05.png); [3 record](run-3-qr-picture-05.json), [3 file 1](run-3-qr-picture-screen.png), [3 file 2](run-3-qr-picture-05.png)                                                                                                                                              |
| qr-picture: Recipient link                        | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-06.json), [1 file 1](run-1-qr-picture-6-recipient.png), [1 file 2](run-1-qr-picture-06.png); [2 record](run-2-qr-picture-06.json), [2 file 1](run-2-qr-picture-6-recipient.png), [2 file 2](run-2-qr-picture-06.png); [3 record](run-3-qr-picture-06.json), [3 file 1](run-3-qr-picture-6-recipient.png), [3 file 2](run-3-qr-picture-06.png)                                                                                                                               |
| qr-picture: Second-phone scan                     | blocked | 0/3 (0 attempted) | [1 record](run-1-qr-picture-07.json), [1 file 1](run-1-qr-picture-07.png); [2 record](run-2-qr-picture-07.json), [2 file 1](run-2-qr-picture-07.png); [3 record](run-3-qr-picture-07.json), [3 file 1](run-3-qr-picture-07.png)                                                                                                                                                                                                                                                                         |
| qr-picture: Route console and network health      | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-picture-08.json), [1 file 1](run-1-qr-picture-08.png); [2 record](run-2-qr-picture-08.json), [2 file 1](run-2-qr-picture-08.png); [3 record](run-3-qr-picture-08.json), [3 file 1](run-3-qr-picture-08.png)                                                                                                                                                                                                                                                                         |
| qr-three: Fresh load                              | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-three-01.json), [1 file 1](run-1-qr-three-01.png); [2 record](run-2-qr-three-01.json), [2 file 1](run-2-qr-three-01.png); [3 record](run-3-qr-three-01.json), [3 file 1](run-3-qr-three-01.png)                                                                                                                                                                                                                                                                                     |
| qr-three: Export and decode PNG                   | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-three-02.json), [1 file 1](run-1-qr-three-export.png), [1 file 2](run-1-qr-three-export-phone.png), [1 file 3](run-1-qr-three-02.png); [2 record](run-2-qr-three-02.json), [2 file 1](run-2-qr-three-export.png), [2 file 2](run-2-qr-three-export-phone.png), [2 file 3](run-2-qr-three-02.png); [3 record](run-3-qr-three-02.json), [3 file 1](run-3-qr-three-export.png), [3 file 2](run-3-qr-three-export-phone.png), [3 file 3](run-3-qr-three-02.png)                         |
| qr-three: Native-size exported decode             | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-three-03.json), [1 file 1](run-1-qr-three-03.png); [2 record](run-2-qr-three-03.json), [2 file 1](run-2-qr-three-03.png); [3 record](run-3-qr-three-03.json), [3 file 1](run-3-qr-three-03.png)                                                                                                                                                                                                                                                                                     |
| qr-three: On-screen decode at phone size          | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-three-04.json), [1 file 1](run-1-qr-three-target-screen.png), [1 file 2](run-1-qr-three-04.png); [2 record](run-2-qr-three-04.json), [2 file 1](run-2-qr-three-target-screen.png), [2 file 2](run-2-qr-three-04.png); [3 record](run-3-qr-three-04.json), [3 file 1](run-3-qr-three-target-screen.png), [3 file 2](run-3-qr-three-04.png)                                                                                                                                           |
| qr-three: Full viewport decode                    | failed  | 0/3 (3 attempted) | [1 record](run-1-qr-three-05.json), [1 file 1](run-1-qr-three-screen.png), [1 file 2](run-1-qr-three-05.png); [2 record](run-2-qr-three-05.json), [2 file 1](run-2-qr-three-screen.png), [2 file 2](run-2-qr-three-05.png); [3 record](run-3-qr-three-05.json), [3 file 1](run-3-qr-three-screen.png), [3 file 2](run-3-qr-three-05.png)                                                                                                                                                                |
| qr-three: Recipient link                          | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-three-06.json), [1 file 1](run-1-qr-three-6-recipient.png), [1 file 2](run-1-qr-three-06.png); [2 record](run-2-qr-three-06.json), [2 file 1](run-2-qr-three-6-recipient.png), [2 file 2](run-2-qr-three-06.png); [3 record](run-3-qr-three-06.json), [3 file 1](run-3-qr-three-6-recipient.png), [3 file 2](run-3-qr-three-06.png)                                                                                                                                                 |
| qr-three: Second-phone scan                       | blocked | 0/3 (0 attempted) | [1 record](run-1-qr-three-07.json), [1 file 1](run-1-qr-three-07.png); [2 record](run-2-qr-three-07.json), [2 file 1](run-2-qr-three-07.png); [3 record](run-3-qr-three-07.json), [3 file 1](run-3-qr-three-07.png)                                                                                                                                                                                                                                                                                     |
| qr-three: Route console and network health        | passed  | 3/3 (3 attempted) | [1 record](run-1-qr-three-08.json), [1 file 1](run-1-qr-three-08.png); [2 record](run-2-qr-three-08.json), [2 file 1](run-2-qr-three-08.png); [3 record](run-3-qr-three-08.json), [3 file 1](run-3-qr-three-08.png)                                                                                                                                                                                                                                                                                     |
| share-qr: Fresh load                              | passed  | 3/3 (3 attempted) | [1 record](run-1-share-qr-01.json), [1 file 1](run-1-share-qr-01.png); [2 record](run-2-share-qr-01.json), [2 file 1](run-2-share-qr-01.png); [3 record](run-3-share-qr-01.json), [3 file 1](run-3-share-qr-01.png)                                                                                                                                                                                                                                                                                     |
| share-qr: Export and decode PNG                   | passed  | 3/3 (3 attempted) | [1 record](run-1-share-qr-02.json), [1 file 1](run-1-share-qr-export.png), [1 file 2](run-1-share-qr-export-phone.png), [1 file 3](run-1-share-qr-02.png); [2 record](run-2-share-qr-02.json), [2 file 1](run-2-share-qr-export.png), [2 file 2](run-2-share-qr-export-phone.png), [2 file 3](run-2-share-qr-02.png); [3 record](run-3-share-qr-02.json), [3 file 1](run-3-share-qr-export.png), [3 file 2](run-3-share-qr-export-phone.png), [3 file 3](run-3-share-qr-02.png)                         |
| share-qr: Native-size exported decode             | passed  | 3/3 (3 attempted) | [1 record](run-1-share-qr-03.json), [1 file 1](run-1-share-qr-03.png); [2 record](run-2-share-qr-03.json), [2 file 1](run-2-share-qr-03.png); [3 record](run-3-share-qr-03.json), [3 file 1](run-3-share-qr-03.png)                                                                                                                                                                                                                                                                                     |
| share-qr: On-screen decode at phone size          | passed  | 3/3 (3 attempted) | [1 record](run-1-share-qr-04.json), [1 file 1](run-1-share-qr-target-screen.png), [1 file 2](run-1-share-qr-04.png); [2 record](run-2-share-qr-04.json), [2 file 1](run-2-share-qr-target-screen.png), [2 file 2](run-2-share-qr-04.png); [3 record](run-3-share-qr-04.json), [3 file 1](run-3-share-qr-target-screen.png), [3 file 2](run-3-share-qr-04.png)                                                                                                                                           |
| share-qr: Full viewport decode                    | failed  | 0/3 (3 attempted) | [1 record](run-1-share-qr-05.json), [1 file 1](run-1-share-qr-screen.png), [1 file 2](run-1-share-qr-05.png); [2 record](run-2-share-qr-05.json), [2 file 1](run-2-share-qr-screen.png), [2 file 2](run-2-share-qr-05.png); [3 record](run-3-share-qr-05.json), [3 file 1](run-3-share-qr-screen.png), [3 file 2](run-3-share-qr-05.png)                                                                                                                                                                |
| share-qr: Recipient link                          | passed  | 3/3 (3 attempted) | [1 record](run-1-share-qr-06.json), [1 file 1](run-1-share-qr-6-recipient.png), [1 file 2](run-1-share-qr-06.png); [2 record](run-2-share-qr-06.json), [2 file 1](run-2-share-qr-6-recipient.png), [2 file 2](run-2-share-qr-06.png); [3 record](run-3-share-qr-06.json), [3 file 1](run-3-share-qr-6-recipient.png), [3 file 2](run-3-share-qr-06.png)                                                                                                                                                 |
| share-qr: Second-phone scan                       | blocked | 0/3 (0 attempted) | [1 record](run-1-share-qr-07.json), [1 file 1](run-1-share-qr-07.png); [2 record](run-2-share-qr-07.json), [2 file 1](run-2-share-qr-07.png); [3 record](run-3-share-qr-07.json), [3 file 1](run-3-share-qr-07.png)                                                                                                                                                                                                                                                                                     |
| share-qr: Route console and network health        | passed  | 3/3 (3 attempted) | [1 record](run-1-share-qr-08.json), [1 file 1](run-1-share-qr-08.png); [2 record](run-2-share-qr-08.json), [2 file 1](run-2-share-qr-08.png); [3 record](run-3-share-qr-08.json), [3 file 1](run-3-share-qr-08.png)                                                                                                                                                                                                                                                                                     |

## Reproduction records and missing inputs

- Run 1, photo-3d, step 13 (Local-file recipient): Recipient is not clearly asked to open the
  missing local file. Owner: task 76, PR #622. Reproduce with the fixture and exact options in
  [record](run-1-photo-3d-13.json).
- Run 1, moving-photo-3d, step 9 (Local-file recipient): Recipient is not clearly asked to open the
  missing local file. Owner: task 48, PR #560. Reproduce with the fixture and exact options in
  [record](run-1-moving-photo-3d-09.json).
- Run 1, qr-code, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner: QR
  lane (no owning task named in task 84). Reproduce with the fixture and exact options in
  [record](run-1-qr-code-05.json).
- Run 1, qr-code, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: QR lane (no owning task named in task 84). Reproduce with the fixture and exact
  options in [record](run-1-qr-code-07.json).
- Run 1, qr-picture, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: tasks 79 and 80. Reproduce with the fixture and exact options in
  [record](run-1-qr-picture-07.json).
- Run 1, qr-three, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner:
  task 72. Reproduce with the fixture and exact options in [record](run-1-qr-three-05.json).
- Run 1, qr-three, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: task 72. Reproduce with the fixture and exact options in
  [record](run-1-qr-three-07.json).
- Run 1, share-qr, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner: QR
  share sheet (no owning task named in task 84). Reproduce with the fixture and exact options in
  [record](run-1-share-qr-05.json).
- Run 1, share-qr, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: QR share sheet (no owning task named in task 84). Reproduce with the fixture and
  exact options in [record](run-1-share-qr-07.json).
- Run 2, photo-3d, step 13 (Local-file recipient): Recipient is not clearly asked to open the
  missing local file. Owner: task 76, PR #622. Reproduce with the fixture and exact options in
  [record](run-2-photo-3d-13.json).
- Run 2, moving-photo-3d, step 9 (Local-file recipient): Recipient is not clearly asked to open the
  missing local file. Owner: task 48, PR #560. Reproduce with the fixture and exact options in
  [record](run-2-moving-photo-3d-09.json).
- Run 2, qr-code, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner: QR
  lane (no owning task named in task 84). Reproduce with the fixture and exact options in
  [record](run-2-qr-code-05.json).
- Run 2, qr-code, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: QR lane (no owning task named in task 84). Reproduce with the fixture and exact
  options in [record](run-2-qr-code-07.json).
- Run 2, qr-picture, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: tasks 79 and 80. Reproduce with the fixture and exact options in
  [record](run-2-qr-picture-07.json).
- Run 2, qr-three, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner:
  task 72. Reproduce with the fixture and exact options in [record](run-2-qr-three-05.json).
- Run 2, qr-three, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: task 72. Reproduce with the fixture and exact options in
  [record](run-2-qr-three-07.json).
- Run 2, share-qr, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner: QR
  share sheet (no owning task named in task 84). Reproduce with the fixture and exact options in
  [record](run-2-share-qr-05.json).
- Run 2, share-qr, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: QR share sheet (no owning task named in task 84). Reproduce with the fixture and
  exact options in [record](run-2-share-qr-07.json).
- Run 3, photo-3d, step 13 (Local-file recipient): Recipient is not clearly asked to open the
  missing local file. Owner: task 76, PR #622. Reproduce with the fixture and exact options in
  [record](run-3-photo-3d-13.json).
- Run 3, moving-photo-3d, step 9 (Local-file recipient): Recipient is not clearly asked to open the
  missing local file. Owner: task 48, PR #560. Reproduce with the fixture and exact options in
  [record](run-3-moving-photo-3d-09.json).
- Run 3, qr-code, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner: QR
  lane (no owning task named in task 84). Reproduce with the fixture and exact options in
  [record](run-3-qr-code-05.json).
- Run 3, qr-code, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: QR lane (no owning task named in task 84). Reproduce with the fixture and exact
  options in [record](run-3-qr-code-07.json).
- Run 3, qr-picture, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: tasks 79 and 80. Reproduce with the fixture and exact options in
  [record](run-3-qr-picture-07.json).
- Run 3, qr-three, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner:
  task 72. Reproduce with the fixture and exact options in [record](run-3-qr-three-05.json).
- Run 3, qr-three, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: task 72. Reproduce with the fixture and exact options in
  [record](run-3-qr-three-07.json).
- Run 3, share-qr, step 5 (Full viewport decode): On-screen code did not decode exactly. Owner: QR
  share sheet (no owning task named in task 84). Reproduce with the fixture and exact options in
  [record](run-3-share-qr-05.json).
- Run 3, share-qr, step 7 (Second-phone scan): blocked, needs the owner: a second phone and camera
  scan. Owner: QR share sheet (no owning task named in task 84). Reproduce with the fixture and
  exact options in [record](run-3-share-qr-07.json).

Each numbered run links its JSON record and evidence files directly; file order matches the record’s
evidence array. Every failure is retained for the owning task; no checks are relaxed and no toy
fixes are included. Images larger than 1 MB and any large clips belong on
codex/advisor-route-evidence-clips, which must never be merged.

## Capture provenance

The original capture commit was local. GitHub’s commit-email privacy restriction prevented
publishing that history. Public commit `15087858a65c479428a4f98745c53880d6644312` contains the
identical source tree (`6757cb266888a580b4bf20086848b454ba1ec146`);
[provenance.json](provenance.json) records both commit IDs and the main parent. Original
observations retain the local capture ID, and the original local history is preserved. The published
branch starts from main with this new commit; no published history was replaced.

## Harness verification

The new regression spec [passed 9/9 tests](regression.txt) on the recorded capture build. Artifact
validation checked all 186 records, 62 summary rows, 258 PNGs, individual JSON copies, and report
links. Every PNG is below 1,000,000 bytes. The full suite was not run locally; task 84 assigns it to
the Operator’s merge PR or an Operator-applied `full-suite` label. Report-only link formatting was
added after capture; measurements remain pinned to the build above.
