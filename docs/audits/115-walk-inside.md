# Walk inside: implementation and evidence

Made by Ryan with Codex (GPT-6), October 17, 2026. Implementation branch: `codex/walk-inside`. The
tool is behind labs. It is submitted for review, not merged by its builder.

## What is implemented

Studio’s Walk inside opens a separate first-person view. Files are read locally in a module worker.
PLY, SPZ, and SOG reuse the existing readers; KSPLAT v0.1 has a new reader confined to this
subsystem. Zipped SOG and an unzipped `meta.json` selected with its WebP pictures work through the
existing codec. Base colors are drawn; view-dependent spherical harmonics are not retained in the
preview.

A deterministic robust plane fit estimates the floor, with flip, tilt, automatic leveling, manual
leveling, and meters-per-file-unit controls. Weighted opacity and size form a bounded 10 cm
collision grid. Faint isolated samples do not stop the body; dense low-opacity walls still
contribute. Spherical floor splats can use the fitted floor’s direction. Missing floor cells remain
unsupported.

Rasterization respects the splats’ rotated anisotropic footprints, so a long axis cannot fill a gap
across the short axis. File declarations are checked before column allocation, with a five-million
sample cap and bounded compressed expansion. Entering a form control, losing window focus, or hiding
the page stops both direct input and tap walking.

The capsule runs at 120 fixed steps per second, walks at 1.35 meters per second, uses gravity, steps
up to 25 cm, stops above 35 degrees, and slides along walls. The camera has no head bob. The
optional character, its rig, and its gait are imported from Worlds; its preparation runs in a
separate worker. Nothing under `src/worlds/` is edited.

Phones have a left thumb stick, drag-to-look, and floor taps. Desktops have WASD, drag-to-look,
pointer lock, and floor clicks. A straight tap path stops when blocked; this is not a route planner
around obstacles. Amber splats mark the observed floor’s boundary, with a soft screen cue near an
unsupported edge.

Spatial tiles are culled behind the camera and use a second, thinner level beyond 7 meters. The
preview follows the existing device profile’s default splat budget: 60,000 on Low, 140,000 on Mid,
200,000 on High, and 280,000 on Max, plus the character and boundary cue. Collision always uses the
full source. Auto drawing detail reduces the splat layer’s pixel count when frames are slow;
controls keep their native resolution. Full resolution can be selected separately.

The Studio recipe loads lazily through the existing pack mechanism. No engine hook was needed. The
restricted engine files and the other Studio converters are unchanged. Generated site lists/pages
are rebuilt for this tool’s entry.

## Places and licenses

`tools/assets.json` contains 65 captured toy records. None is a captured room, street, or other
walkable place: they are objects or isolated plants. The shipped place-capture list for this tool is
therefore empty. The forest/street photo samples are 2D images, and some other samples are AI-made;
none is represented as a real captured splat place here.

The Sunlit gallery and Garden courtyard are original kit-built test places, CC0, with hashes in
`tools/assets.json` under `walkPlaces`. Their collision is derived from emitted splats, not from
their authored surfaces or invisible test boxes. No new outside art or runtime library was added.
The KSPLAT layout was checked against the opened upstream
[SplatBuffer format definition](https://github.com/mkkellogg/GaussianSplats3D/blob/main/src/loaders/SplatBuffer.js)
and
[KSPLAT loader](https://github.com/mkkellogg/GaussianSplats3D/blob/main/src/loaders/ksplat/KSplatLoader.js).
No upstream renderer code is shipped.

## Verification method

`tests/cdx-walk*.spec.mjs` contains the feature’s geometry, file, browser, and cadence checks. Ten
fixed key scripts per place run through actual browser key events and the production controller.
Every simulated frame checks floor support, wall bounds, capsule overlap, and minimum height; end
points must agree within 10 cm. Separate pure geometry walks repeat the same yardstick.

Regression cases cover a tilted floor with faint outliers, floor holes, steps, the 35 degree
boundary, spherical and millimeter-sized floor splats, dense faint walls, malformed geometry,
off-origin captures, partial KSPLAT buckets, cancellation, and collision independence from preview
LOD. Review regressions cover thin-axis floor gaps at three rotations, invalid PLY/SOG/SPZ counts
without large allocations, loose SOG companions, held keys entering settings, and interrupted tap
walking. Browser cases cover mouse lock and walking together, phone stick/drag, tap movement,
character preparation without blocking the page, reduced motion, close/reopen, and switching the
host toy.

The browser is Chromium 151.0.7922.173, WebGL2 through SwiftShader, in the cloud. The phone profile
is 390×844, DPR 3, with CDP CPU rate 4; the desktop is 1440×900, DPR 1. This is not a physical phone
or a hardware GPU measurement. CDP throttling does not establish ARM worker performance. Cadence
tests disable Playwright’s screencast so its GPU readbacks and JPEG work do not become part of frame
times; review captures run separately. Both standing and walking costs are recorded. The 30 fps
requirement applies to the phone profile; the brief asks for desktop frame-time reporting without a
desktop minimum.

The final feature run passed all 29 tests. Mean frame times below are steady-state samples after
four seconds of warmup; measured summaries and sample counts are in the evidence log. The view
retains up to 120 recent frame intervals, sampled after 2.5 seconds in each condition. Auto keeps
the phone mean above 30 fps, with occasional slower frames visible in the 95th percentile.

| Profile / place / camera           | Standing mean / p95 | Walking mean / p95 | Drawing buffer |
| ---------------------------------- | ------------------- | ------------------ | -------------- |
| Phone / gallery / first person     | 21.3 / 43.1 ms      | 20.8 / 44.6 ms     | 167×274        |
| Phone / gallery / character        | 29.5 / 49.9 ms      | 30.8 / 61.0 ms     | 136×222        |
| Phone / courtyard / first person   | 16.6 / 23.6 ms      | 16.7 / 22.0 ms     | 136×222        |
| Phone / courtyard / character      | 23.1 / 43.2 ms      | 23.6 / 42.6 ms     | 136×222        |
| Desktop / gallery / first person   | 74.4 / 85.5 ms      | 79.2 / 98.5 ms     | 936×489        |
| Desktop / gallery / character      | 90.5 / 102.4 ms     | 100.4 / 110.6 ms   | 936×489        |
| Desktop / courtyard / first person | 65.3 / 88.7 ms      | 70.5 / 87.9 ms     | 936×489        |
| Desktop / courtyard / character    | 87.7 / 112.2 ms     | 91.1 / 100.5 ms    | 936×489        |

The phone means correspond to about 32.5–60 fps in both camera modes. Desktop SwiftShader averages
about 10–15 fps. These are Auto results, with substantial resolution reduction on this software
renderer. Auto retains its reduced buffer across place/camera changes until reset with the detail
selector or reopening. Full resolution review exports are separate, stepped captures and do not
demonstrate real-time cadence.

## Large-place cost

`tools/walk-benchmark.mjs` measures one and two million samples made by densifying the courtyard.
This is a synthetic size test of real worker code, not a real two-million-splat photoreal capture.
File decoding is outside that timing.

| Profile         | Samples   | Grid construction | Worker preparation | End-to-end request | Preview budget |
| --------------- | --------- | ----------------- | ------------------ | ------------------ | -------------- |
| Phone harness   | 1 million | 677 ms            | 1,955 ms           | 2,233 ms           | 60,000         |
| Phone harness   | 2 million | 1,324 ms          | 3,840 ms           | 4,338 ms           | 60,000         |
| Desktop harness | 1 million | 667 ms            | 2,071 ms           | 2,217 ms           | 200,000        |
| Desktop harness | 2 million | 1,305 ms          | 3,750 ms           | 3,913 ms           | 200,000        |

The CPU is an AMD EPYC 9V74. Workers on this Chromium instance are not demonstrated to run at the
same speed as physical phone cores, even with the page's CDP throttle. The million-splat grid gate
passed in this harness; physical-device confirmation is outstanding.

Two million source samples occupy 112,000,000 bytes in the four retained Float32 arrays (positions,
scales, rotations, and colors). The test grid occupies 3,228,750 bytes at 105×41×125 cells. Those
are counted payload bytes, not a measured peak heap: decoding, message copies, leveling buffers,
previews, engine textures, and the second drawing level add memory. Larger spatial extents increase
grid cost; the tool rejects an allocation above eight million cells rather than coarsen the 10 cm
grid silently.

Leveling transiently holds the source and two full transformed buffers. At two million samples,
those worker arrays alone can total 336,000,000 bytes. This is calculated from the allocations in
the code, not a measured peak. A large file can therefore cost much more memory than its preview
budget suggests.

Exact timings, drawing resolutions, screenshots, clips, and final check results are recorded in the
[evidence branch](https://github.com/ryanjosephkamp/splashery/tree/codex/walk-inside-clips) and
summarized in the draft PR. That branch is never merged.

## Implementation record

Task 115, toy id `walk-inside`, status **implemented**, behind labs on `codex/walk-inside`. The
owner and Operator decide acceptance and merging. No external toy package is produced.

The recipe uses `build`, `drive`, `controls`, `action.onAct`, and `input.live`. The host Kit fits
the shelf preview to its unit sphere; walking places use meters, +Y up, and +Z forward at yaw zero.
Quaternions use x, y, z, w. The preview has one moving part, `door`, pivot `[1.1, -0.6, 0.8]`, axis
`[0, 1, 0]`. It uses Kit boxes and a part; the walking view imports Worlds' rendering, joint rig,
character builder, pose, and gait. The existing main Stage is held while the dialog renders.

Generation is deterministic, seed 115. `buildRoom()` in `src/walk/rooms.js` samples original Kit
surfaces at 0.16 meter spacing, with no downloaded asset. The two source buffers have 17,405 and
10,800 splats, with 974,680 and 604,800 bytes of active sample data. The Kit reserves extra
capacity: the actual four source arrays allocate 1,814,680 and 1,444,800 bytes before working
copies. All profiles retain those room samples before culling. Larger sources follow the profile
budgets listed above; preview and GPU overhead and physical-device peak memory remain unmeasured.

The workspace is Debian 13, Node 24.19.0, Chromium 151.0.7922.173, repository Playwright, and
FFmpeg/ffprobe 7.1.5-0+deb13u1 with libx264. These existing test tools are recorded in
`LICENSES.md`; no executable or new library is served. Reproduction commands:

```sh
node tools/check-packs.mjs walk-inside
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/make-thumbs.mjs walk-inside
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-walk*.spec.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/walk-benchmark.mjs /tmp/walk-cost.json
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/walk-evidence.mjs /tmp/walk-evidence --clips
```

| Original source / file                    | SHA-256                                                            | Author / license / date                                | Changes                        |
| ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------ |
| Gallery buffer from `src/walk/rooms.js`   | `9c42c7e96eba86ddce9cf0f1df134840357ff8b1e6d00b8bf7747cf39c4aef9b` | Made by Ryan with Codex (GPT-6), CC0, October 17, 2026 | Original Kit surface sampling  |
| Courtyard buffer from `src/walk/rooms.js` | `0117ddce7e4913ca59f3370017ef8267da4643851af9b09f3a28a3c4a905877a` | Made by Ryan with Codex (GPT-6), CC0, October 17, 2026 | Original Kit surface sampling  |
| `assets/toys/walk-inside/thumb.webp`      | `5b32ae7ff0f3ade1a3f74c6bd9c46d0ae1ad141634ea8b779c30bd03f1a80cb9` | Made by Ryan with Codex (GPT-6), CC0, October 17, 2026 | Rendered from original preview |

Source records and hash definitions are also in `tools/assets.json`. New code is MIT. Floor recovery
and collision run from actual splat data; no authored invisible boxes or infinite ground stand in
for that work. The review clips use stepped simulation time. The large-place test repeats known room
samples; neither is represented as a real capture or hardware timing.

## Limits and cuts

- Floor and wall recovery are coarse estimates. Unseen floor, walls, and gaps smaller than a cell
  cannot be reconstructed. Conservative unsupported regions stop the walk. A manually corrected up
  direction/scale may be needed.
- Physical iOS/Android devices and hardware GPU browsers have not been measured. Slow software
  rendering needs a substantially smaller drawing buffer; desktop SwiftShader remains slow. Full
  resolution favors clarity over cadence.
- No shipped photoreal place is available in the current asset manifest. No new external capture is
  substituted. Real user captures have not received the same ten-walk validation as the two known
  test places.
- KSPLAT support is v0.1, compression levels 0–2 and SH record degrees 0–2. Other versions fail with
  a conversion message. SPZ/SOG support follows the existing readers. Preview shading uses base
  colors.
- There is no navigation mesh, obstacle-routing planner, jumping, multiplayer, capture upload, or
  serialization of a visitor’s private file into scene JSON.

Rule check: none.
