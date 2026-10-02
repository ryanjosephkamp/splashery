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

## Brief r3 (from the Operator, October 2, 2026, 09:36 UTC)

Live input r3 (Opus 5.5, prefix `live3`). Branches: `claude/lane-live-input-r3-engine` (only if you
need player/ui/app/kit changes: small, additive "Engine: …" PR, merged first) and
`claude/lane-live-input-r3` ("Phase Live input r3: …"), both from main once #163 has merged. Keep
your handoff file current (add an "## Brief r3" section with this text). These toys are behind the
labs switch, so the Operator merges after the full test run; still post clips for the owner.

The owner reviewed your toys on October 2 (docs/reviews/2026-10-02-mega-review/review.md, lines 686
to 770 and 870 to 892: read his words first). He loved them ("might also be one of the coolest
things that we've made so far"). He accepted this round:

**Song landscape**

1. Tilt: let the view tilt up and down (vertical rotation, within sensible limits) so you can see
   the notes better.
2. Keep the microphone's audio: when someone records live, keep the audio (in memory only, never
   uploaded or stored without their action) so they can play it back with the landscape and export a
   clip. The live-input rule still holds: the mic is asked for only on the tap that starts it.
3. Restart, pause and scrub: a way to restart the song, pause it and scrub back and forth, without a
   hover play bar that gets in the way of the toy (he doesn't want a bar like the other music toys'
   that covers the stage; a small, out-of-the-way control or a drag along the landscape itself are
   both fine; your call, say why).
4. Mesh lines slightly thicker (the "lines"/"mesh" looks; the ribbons are fine).
5. Live (scrolling) view as the default instead of the whole song (he's on the fence; make it the
   default and keep the whole-song view one tap away).
6. Explain what each look and color mode shows (loudness, pitch, brightness; tube, lines, ribbons,
   mesh) in the toy's About text and how-to line (src/toy-help.js), plainly.

**Chladni plate**

7. Tilt to see the plate more from the side.
8. Bug: with the live microphone the sand doesn't move in real time; it moves only after he stops
   the mic. Find the cause and fix it, with a test.

**Room echo meter**

9. The text on its screen is blurry: make it crisp at phone size.
10. A clap or snap shows the loading animation and then "Too noisy". Today any failure shows "Too
    noisy" (it needs about a 25 dB range). Show the real reason (too quiet, too noisy, no clear
    decay, clipped, and so on) with a hint of what to do, and check whether a clap in an ordinary
    room can work (a lower threshold, a fit over a shorter range, or T20/T30 from what's
    measurable). Say what you found.

**Splat mirror**

11. Bug: with the default paintings it jitters and flashes in the default view (turning it a little
    stops it; the camera mode doesn't do it). Fix it; don't make the camera mode worse ("It works
    really, really well with my actual camera").
12. Make the camera the main feature: a big "Start camera" button (the camera is still asked for
    only on that tap).
13. A switch to the rear camera (facingMode), where the device has one.
14. Save the footage as a video (and a GIF if it's simple). Lane UI r5's engine PR #177 adds a
    Record button (src/exports.js) that records the stage and its sound; if it merges first, use it
    rather than a second recorder; if not, keep yours small and tell me.
15. Optional, if time allows: a more hologram-like look as an option (scanlines or a soft edge
    glow), never replacing the plain look.

**Everywhere**

16. On a phone, the Live camera / Live microphone / Stop pill covers the buttons. Move it so it
    never covers a control at 390×844 (screenshots before and after).

**New toy (his idea, N1): Moving photo to 3D**

17. Like the live camera to 3D, but for a GIF or video the person opens (or a sample we ship): run
    the depth model on every frame (or every few frames), at the depth they choose, and play it back
    in 3D like the live camera. Use the vendored Depth Anything V2 Small and omggif already in
    vendor/; loaded only when someone opens a file for it; nothing leaves the device. Keep frame
    count and resolution modest so it runs on a phone (say what you chose). Behind labs, in the same
    shelf as Photo to 3D and the live camera toy. A small sample clip must be CC0/CC BY/public
    domain (BY-SA is now allowed with its notice beside it); credit it as usual.

Clips: post cards in a lane record "Live input r3" on Effect review page 2 (I'll make the record; if
it isn't there when you post, add your cards under "Live input" and tell me), 390×844, "built by
Opus 5.5", with a dot where the finger is. You don't have the mic or camera in the container: use
the fake media streams Chromium offers (--use-fake-device-for-media-stream,
--use-file-for-fake-audio-capture / video) as in r2.

Other lanes running: Sound C (sounds; your toys' sounds are yours unless the owner named one; he
didn't this round), Physics, Fix7, UI r5, Fluids, Video 3D, Science, Sharpness A, Photoreal,
Integrators. Leave their files alone. The laptop is locked.

Finish each working turn with READY:/WORKING:/BLOCKED: as before.

## State

Model: **Opus 5.5** (default effort), no helpers.

October 2, 2026 (UTC): **round 3 built and tested** (prefix `live3`). #144, #150, #162 and #163 are
all merged. Engine PR #187 (`claude/lane-live-input-r3-engine`): a toy's own tilt range
(`recipe.pitchRange`), a recipe's `tiltLock: false` winning over holding still, and the Live pill
moved below the header. Lane PR: `claude/lane-live-input-r3`, "Phase Live input r3", stacked on
#187.

- **Song landscape.** It tilts between a level look and one from above (`pitchRange [0.05, 1.35]`,
  unlocked; the turntable stays off). Live is the default view. While the microphone is on, what it
  hears is kept in memory (`src/packs/song-record.js`, up to ten minutes, copied from the analyser's
  ring); when it stops, the recording becomes the song on show, to play back, scrub and save as a
  WAV (only on a tap). The transport (Start over, Play/Pause, Whole song/Live view, a scrub slider
  with the time) sits in the Toy tab's panel, not over the picture: a drag on the picture already
  turns and tilts it, and a tap plays or pauses. A view switch keeps the song's place. Lines are
  0.0068 thick (were 0.0046), the mesh 0.005 (was 0.0034). The help text explains each view, look
  and color in plain words.
- **Chladni plate.** It tilts (same range). The sand didn't move with the voice: the resonance was
  only 60 cents wide, so an ordinary voice between modes rang nothing, and stopping the microphone
  dropped the sand back to the bow's state. Now the plate on show rings by its own response (150
  cents wide); it switches mode only when another is clearly nearer, held a second, at most once
  every two seconds; the sand stays where the voice left it. Two tests fail on the old code.
- **Echo meter.** The panel is one splat per canvas pixel (416 by 130), so its letters are sharp.
  `measureDecay` gives real reasons (`quiet`, `noisy`, `clipped`, `interrupted`, `short`, `uneven`),
  each with a hint (`DECAY_HINTS`), and fits T30 at 45 dB above the background, T20 at 35 and T10
  from 20 (was 25). Simulated claps (RT60 0.25 to 1 s) measure within 7% from about 20 dB above the
  background. An ordinary clap in a quiet room stands 40 dB or more above it, so the old "too noisy"
  most likely came from the phone's own processing or a clap the onset detector caught late; the new
  reasons will say which.
- **Splat mirror.** The still picture's flashing face on was its sort: every splat rested at z = 0
  and was lifted only on the GPU, so they sorted as ties. The still picture's splats now rest at
  their depth and a signed offset brings them back as it flattens. Hair-width nudges of the view:
  15,635 pixels flashed by over 40 levels before, 262 after (390 by 844). Camera mode is unchanged.
  A big "Start camera" shows over the picture until the camera is on; "Use the back camera" appears
  on a device with two cameras (`switchCamera`, not mirrored); "Record a video" records the stage
  (MediaRecorder, MP4 or WebM, 30 s at most) and "Save the video" saves it. #177 (UI r5's recorder)
  hadn't merged, so this is a small one of the mirror's own (`src/live/record.js`). Look: Hologram
  (cyan, drifting scanlines, glowing depth edges) beside Plain.
- **The Live pill** sat over the header's buttons at 390 by 844; it now sits below them
  (`live3-pill-before-*` and `live3-pill-*` screenshots).
- October 2, 17:00 UTC: main (`ced2a55`: Sound C, Physics, UI r5) merged into both branches. In
  `src/app.js` UI r5's `tilt: "free"` and the r3 recipe `tiltLock` both stay. At 390 by 844 the Live
  pill (top), UI r5's Record pill (bottom left) and the Physics hands bar (bottom right) don't meet;
  on a computer the Record pill sits at the top of the stage too, so the Live pill drops below it
  while it shows (#187's pill test checks all three at both sizes). The Operator's list (`live`,
  `live2`, `live3` and their engine specs, `phy-engine`, `ui5-engine`, `sndc-engine`, `help`,
  `smoke`): 137 passed.
- **Moving photo to 3D** (new, labs, Studio shelf beside Photo to 3D): a GIF or video, its first 8
  s, up to 48 frames, 256 px on the long side; each frame's depth from the vendored model in its
  worker (196 px long side). Each splat rests at its average depth over the clip, so it sorts right.
  The sample is the Screen toy's Big Buck Bunny scene (CC BY 3.0), 48 frames tiled in a JPEG with
  precomputed depth (`tools/live3-depth.mjs`), so it needs no model.

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
- The owner's marks of October 1 (via the Operator): the r3 mirror and Photo to 3D live, and
  `live2-tube-whole`, good; every other `live2` card "Good, but could look even better. Keep going."
  So the looks got a second pass (finer strands, smoother curves, deeper color), posted as
  `live2-*-r2` cards.
- October 1, 15:30 UTC: the owner marked all 13 `live2-*-r2` cards and `live2-start` good, so round
  2 is done pending tests. Merge order: #144, #150, #162, #163. #144 is in Integrator 1's run with
  #138; once both merge, the Operator asks for main in #150 (CREDITS, TOY-PLAN and toy-sounds
  conflict with #138), then #162 and #163 follow.
- Evening of October 1: the owner marked `live-echo` and `live-permission` "fix" ("a bit
  blurry/grainy") and `live-landscape` good but "a bit grainy". Most of it was the clips (drawn at
  0.75 scale and squeezed into a 256-color GIF); the rest was the toys' own random splat size and
  color. `tools/live-clip.mjs` now takes `--dpr=2` and `--frames=<dir>` (PNG frames straight into
  the MP4), the room, the relief grids and the Studio floor use exact splats (`jitter: 0`), the
  floorboards have seams, and the live landscape has 128 bands and three layers. Posted as
  `live-echo-r2`, `live-permission-r2`, `live-landscape-r2` and a before-and-after still.
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
  rings, with a resonance curve (half strength about 150 cents off since r3) times loudness; another
  mode clearly nearer, held a second, rebuilds the plate with scattered sand (at most every 2 s).
- **The echo meter** measures from every 5 ms hop of samples (an AudioWorklet), not the analyser's
  frames: RT60 by Schroeder's backward integral with the background taken away, T20 when the clap
  stands 35 dB above the background, T30 from 45 dB and T10 from 20 dB (r3), and a reason with a
  hint below that.
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
  from the screen canvas, from the r2 engine PR). Two needles per slot along time (`SUB`) and per
  band across pitch (`SUBF`), the in-between ones taking the values between measured neighbors;
  colors come from tables built once. A needle's sigmas are a third of its thickness and a 2.6th of
  its length, with no jitter: longer ones smear into their neighbors. In Live, slot 0 sits on the
  gate and a frame's line crosses it as the frame's middle is heard (`liveFrame`).
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
