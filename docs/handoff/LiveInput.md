# Lane Live input (prefix `live`)

The microphone, the camera and the screen, live, as splats. Branches `claude/lane-live-input-engine`
(the engine PR, #144) and `claude/lane-live-input` (the lane PR, #150). Round 2 (prefix `live2`):
`claude/lane-live-input-r2-engine` (its engine PR) and `claude/lane-live-input-r2` (its lane PR),
stacked on #144 and #150. Everything is behind the labs switch.

## Brief (written by the Operator on September 30, 2026, from the owner's approval that day)

The owner asked whether the microphone, the camera and screen sharing could feed the splats. He
approved this lane (alignment call 20, September 30, 2026) and wrote "live input go" at 3:25 p.m.
ET. His rule, now in CLAUDE.md: "a toy asks for the microphone, the camera or screen capture only
when the person taps to start it. Nothing is requested or loaded before that, and nothing is
recorded, stored or sent anywhere."

The plan he approved, in order:

1. **Engine PR (small, additive, merged first):** `src/live/`, a live-input module.
   - A person taps a clear button ("Use my microphone", "Use my camera", "Share a screen") and only
     then does the page call `getUserMedia` or `getDisplayMedia`. Nothing is requested, and no model
     or file is loaded, before that tap.
   - While a source is on, a small visible "live" indicator shows, with a Stop button. Stopping ends
     every track.
   - Denied permission or missing hardware shows a plain message, never a crash.
   - Microphone: an AnalyserNode with level, spectrum, pitch (a robust detector, for singing) and
     onset detection (for claps), about 60 times a second.
   - Camera: frames to a canvas at a modest size.
   - Screen capture: computers only; hide the button where `getDisplayMedia` is missing (phones).
   - One short line beside each button: "Stays on this device. Nothing is recorded or sent."
   - UI r2 (PR #131) is finishing the input panel and asked that its API stay as it is. Merge main
     after #131 lands, and add your buttons through that panel's existing API, not by rewriting it.
2. **The microphone toys:**
   - **Song landscape, live:** the Studio toy's Live view, fed by the microphone instead of a file.
   - **Sing to the Chladni plate:** the note you sing sets the plate's frequency, and the sand
     settles into that mode's real figure.
   - **Room echo meter (a new toy):** clap once and the page measures the reverberation time (RT60,
     from the decay of the clap's energy; say plainly when the room is too noisy to measure), drawn
     as rings spreading through a splat room. Show the number.
   - **Voice tuner on the pianos (labs-only option):** sing or play a note, and the matching key
     lights and moves.
   - **Clap to tap (a labs-only setting):** a sharp sound taps whatever toy is open.
3. **The camera toys:**
   - **Splat mirror (a new toy):** your live camera as splats. With live depth from the Depth
     Anything V2 Small model already vendored for Photo to 3D (loaded only after the camera tap), it
     becomes a 3D "hologram" you can turn. Smooth on a computer, lighter on a phone by tier.
   - **Photo to 3D, live:** point the camera at something and see it in depth before taking the
     picture.
4. **Screen capture (computers):** the shared tab, window or screen plays live on the Screen toy's
   TV or cinema, as splats. It's view only: clicks on the splat screen don't reach the real window.

Not in this lane:

- the MIDI keyboard (the Pianos lane's next round);
- tilt to steer and the live earthquake globe (backlog);
- hand tracking (a later experiment);
- the web screen and the Wikipedia book (a later small lane).

The effect quality rules apply to everything you show, and PACKS.md section 7e ("Sound preferences")
to any sound you add.

Testing without a real microphone or camera: launch Chromium with
`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, and feed known files with
`--use-file-for-fake-audio-capture=<wav>` and `--use-file-for-fake-video-capture=<y4m or mjpeg>`.
Make your own test signals (sine notes, a synthetic clap with a known decay) or use CC0 recordings,
credited.

Cards (clips at 390×844 unless noted, each labeled "built by Opus 5.5", in the lane record
`LiveInput` on the Effect review page; ask the Operator in your message if the record is missing),
one per toy, as each is done:

- `live-landscape`, `live-chladni`, `live-echo`, `live-tuner`, `live-clap`, `live-mirror`,
  `live-photo3d`;
- `live-screen` (1440×900);
- `live-permission`: the tap, the browser's prompt (as far as it can be shown), the indicator and
  Stop.

Tests in tests/live.spec.mjs:

- nothing is requested or fetched before a tap: no getUserMedia or getDisplayMedia call, and no
  model download, on page load or on opening any toy;
- Stop ends every track;
- a denied permission shows the message;
- the pitch detector names a known sine note;
- the echo meter measures a synthetic decay within 10%;
- clap to tap fires on a synthetic clap and not on steady noise;
- the screen button is hidden where `getDisplayMedia` is missing;
- the "embed transfer ≤ 30 MB" test stays green;
- screenshots at 390×844 and 1440×900 (`live-*`).

## You own

- `src/live/` (new) and your new toys' pack file `src/packs/live.js`;
- the live options you add to the Song landscape, Chladni plate, Photo to 3D, Screen and piano toys
  (marked blocks; their lanes have finished);
- your buttons through the input panel's API (UI r2's src/ui.js changes merge first; if you need
  more than the API gives, say so in your message);
- `tests/live.spec.mjs`, your `live-*` screenshots, docs/handoff/LiveInput.md, your toys' entries in
  the shared lists, and CREDITS.md and tools/assets.json lines for anything you add.

If you need another engine change, put it in the engine PR.

Lanes Fluids r4, Science, Video 3D, Worlds r3, Sound A and B, Fix5, Shelves and the Integrators run
at the same time; leave their files alone. The laptop is locked.

## Round 2 (from the Operator, October 1, 2026; a summary of the brief)

Opus 5.5. The lane owns `src/packs/studio.js`, `src/packs/studio-audio.js` and new files; it stays
labs. One PR, "Phase Live input r2: …", tests in `tests/live2.spec.mjs`, cards `live2-*` in the
LiveInput record on page 2.

1. **Start fast.** Measure 3-, 6- and 10-minute MP3s and a 50 MB file at 4× and 6× CPU throttle.
   Play as soon as the audio can play, with no resampling or re-encoding; analyze in a module worker
   in chunks, with a progress line; the landscape fills in and the page never freezes. Target: a
   10-minute song plays within about 3 s at 4×.
2. **The looks** (the owner's reference images, for the idea only; none of their art, names or
   logo): Ribbons (six bands, teal to orange, fine strands, out of a "now" gate), Tube (loudness is
   the radius, pitch tilts the ring, colored by brightness), Lines (a spectrum waterfall, a thin
   line per 40 ms frame), Mesh (a wireframe landscape); Coil only if beat tracking is reliable.
   Every shape a measured feature, in sync on the audio clock (a click-track test: each peak at the
   now mark within 50 ms). Pitch and Loudness stay; Whole and Live both work; thin, crisp, elongated
   splats; a light paper background with a still of each; a "What you're seeing" text per look.
3. **Clips:** music (CC0) and speech (CC0 or synthesized), 10 to 15 s at phone size, MP4, the audio
   clock on screen; a before-and-after start-time clip with a timer.

## State

Model: **Opus 5.5** (default effort), no helpers.

October 1, 2026, morning (UTC): **round 2 ready for the Operator.**

- The Operator's overnight notes (07:22 and 08:35 UTC: hold r2 until the morning's go, no self
  check-ins; merge main with UI r2 into #144 and #150) reached this session only at 10:10 UTC, after
  r2 was built and posted. The self check-in is deleted. #144 and #150 now have main through #142
  (UI r2's conflicts in `src/ui.js` and `styles.css` kept both sides).
- Round 1: engine PR #144 and lane PR #150, drafts. Cards marked good: `live-permission`,
  `live-echo`, `live-landscape`, `live-chladni`, `live-tuner`, `live-clap`, `live-screen`. The
  mirror and Photo to 3D live got a second "fix" (still moving): `live-mirror-r3` and
  `live-photo3d-r3` hold the view still (no turn, a still test camera, no tap at the end).
- Round 2 is built, tested and posted: cards `live2-*` on page 2, engine PR #162 and lane PR #163
  open as drafts (stacked on #144 and #150).
- Start time (Chromium, SwiftShader, this container; the software renderer itself takes about two of
  the four cores, so runs vary). Before: file chosen to the landscape built (it could play only
  after that, on a tap). After: file chosen to playing (a long song plays as it opens).

  | Song                 | Before, 4×          | After, 4×                    | Before, 6× | After, 6× |
  | -------------------- | ------------------- | ---------------------------- | ---------- | --------- |
  | 3 min MP3 (4.3 MB)   | 6.1 s               | 2.3 s                        | 8.3 s      | 1.4 s     |
  | 6 min MP3 (8.6 MB)   | 6.2 s               | 3.1 s                        | 10.3 s     | 1.8 s     |
  | 10 min MP3 (14 MB)   | 8.9 s               | 1.2 s (1.2 to 1.8 over runs) | 12.2 s     | 3.6 s     |
  | 50 MB MP3 (21.5 min) | refused (40 MB cap) | 1.1 s                        | refused    | 1.5 s     |

  Before, the page froze for the whole load. After, the longest frame gap is 0.5 to 1.7 s (the
  renderer's own frame here is 0.2 to 0.4 s at 4×). The whole song is measured 7 s (3 min) to 29 s
  (50 MB) after it opens, at 4×. An MP3 is decoded for measuring in pieces cut between its frames
  (`src/packs/song-mp3.js`), so the page never waits on one long decode.

- The click track (tests/live2.spec.mjs): all 12 clicks cross the now mark 3 to 36 ms from when an
  analyser on the output hears them (the output latency reported is 42 ms).

## Notes

- **How live toys work.** `src/live/live.js` is the only place that calls `getUserMedia` or
  `getDisplayMedia`, and only the input panel's live buttons call it (`input.live`, rendered by
  `src/live/panel.js`). A toy reads `live.on(kind)`, `live.mic` (the analyser) and `live.camera`
  from its drive or build. After a source starts or stops the toy is rebuilt (unless the entry says
  `rebuild: false`), so a build can switch to its live view.
- **Relief splats** (kind 24; lane Fix4 took 23 first) are how a live picture moves without a
  rebuild: the recipe builds a grid once (`reliefGrid` in `src/live/relief.js`) and draws its screen
  canvas every frame, colors on the left half and heights on the right. The live song landscape, the
  mirror and Photo to 3D's live view use it.
- **The depth model in a worker** (`src/live/depth-worker.js`): one frame at a time, at 140 to 308
  pixels on the long side by tier. Here (one CPU thread, SwiftShader) it takes about 0.5 s a frame;
  a laptop should do several a second. Heights ease toward each answer and the depth range is eased
  too, so the picture doesn't flicker.
- **The Chladni plate, sung to.** A plate a quarter as thick (a plate's frequencies go with its
  thickness) has its modes at 75, 150, 195, 255 and 375 Hz, where voices are. The nearest mode
  rings, with a resonance curve (half strength about 60 cents off) times loudness; a different mode
  held for 0.4 s rebuilds the plate with scattered sand.
- **The echo meter** measures from every 5 ms hop of samples (an AudioWorklet), not the analyser's
  frames: RT60 by Schroeder's backward integral with the background taken away, T20 when the clap
  stands 35 dB above the background, T10 from 25 dB, and "too noisy" below that.
- **The tuner's glow** is added to a key's color, so it takes blue away (`[0.25, 0, -0.65]`): ivory
  turns gold. A positive glow can't show on a white key.
- **Clips.** `tools/effect-clip.mjs` steps the clock by hand; a live source runs in real time.
  `tools/live-clip.mjs` feeds a WAV into the page's own analyser in step with the clip's clock
  (`--audio`), plays a Y4M through Chromium's fake camera (`--video`, and `--depth` waits for the
  depth model each frame), or draws a plain window for "Share a screen" (`--screen-demo`).

- **Round 2's song player** (`src/packs/song-stream.js`): `Track` plays the file through an
  `<audio>` element routed to the site's sound; its clock is the element's time, smoothed between
  its steps, less the output latency. `SongAnalysis` decodes a copy (32 kHz past 12 minutes; an MP3
  in 30-second pieces placed by their frame offsets, the first piece giving the decoder's start
  trim) and hands the mono samples to `song-worker.js` as they come; it measures the 2-second chunks
  whose samples are in, nearest the playhead first (`song-analysis.js`: bands, six bands, loudness,
  centroid, YIN pitch, flux, every 40 ms). Songs of 30 s or less keep the old decode-and-build path.
- **The looks** (`src/packs/song-looks.js`) are relief splats with axis 3 (a 3D offset per splat
  from the screen canvas, from the r2 engine PR). A needle's sigmas are a third of its thickness and
  a 2.6th of its length, with no jitter: longer ones smear into their neighbors. In Live, slot 0
  sits on the gate and a frame's line crosses it as the frame's middle is heard (`liveFrame`).
- **Song clips:** `tools/live-clip.mjs --song=<file> --clock` opens a song, waits until it is
  measured, steps its audio clock with the clip's and shows it; `<out>.json` gives the second of the
  song at the first frame, for adding the sound to the MP4.

## Known issues

- The Screen toy's picture panel shows its seek bar for a shared screen (a live stream has no
  length); it does nothing.
- The depth is relative (a guess from one camera), so a relief's depth scale changes as the scene
  changes; it is eased, not fixed.
- Safari without AudioWorklet hears claps from the analyser's frames only (less precise).

## For the Operator

- `tools/live-clip.mjs` is new (a lane tool for live clips); it could be listed in PACKS.md section
  8 and README's tools.
- A PACKS.md section on live input (`input.live`, `live.on`, relief splats) is drafted in this
  file's Notes, for you to move after the merge.
