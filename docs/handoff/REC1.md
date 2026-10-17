# Lane REC1: the recorder, three fixes from the owner's phone

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane REC1 (prefix `rec1`), Opus 5.5 at
high effort, branch `claude/rec1`, PR "Phase REC1: recorder countdown, steady full-screen framing,
and full-length takes". Record (the Share tab, with its preview sheet) is public, so the owner
judges it on clips.

- A countdown before a take: 5 seconds by default, with Off, 3, 5, or 10 in the recorder's settings,
  remembered on the device, Cancel a tap away, and nothing recorded before it ends.
- Going full screen during a take must not move the toy in the video.
- Takes must be as long as the time recorded (within 0.5 s, up to the 60 s limit), for an idle Photo
  to 3D scene and for a moving kit toy.

## State

- PR #707 (READY October 17, 2026). It merges only after the owner marks the three clips "good".
  Clips on Effect review page 2, lane REC1: `rec1-countdown`, `rec1-fullscreen`, `rec1-photo20`.
- Preflight passed; `tests/rec1.spec.mjs` (8 tests) and the existing record and share specs
  (`ui5-engine`, `shr`, `cdx-a11y-layout`, `live3-engine`) pass.

## What changed

- `src/exports.js`, `startRecording`: the video is now a 2D canvas of a fixed size (the stage's size
  when the take starts). `frame()` copies each stage frame into it right after the render. After a
  resize the frame is scaled so its narrower side (the one the camera's field of view fits) keeps
  its length, centered; what is left bare gets the stage's background. A steady clock repeats the
  still picture at `stillFps` (10) when the stage doesn't draw; a moving stage gives every frame up
  to `fps` (30). The take begins at the stage's first frame (or after 500 ms), so the file's clock
  and the take's clock start together. Stop ends the picture at once and keeps handing over the last
  frame for 400 ms (`DRAIN`) before it stops the recorder, because a recorder drops what its encoder
  still holds when it stops. `done` now also gives `frames` (how many were handed over).
- `src/app.js`: `startRecord` runs the countdown first (`recordCountdown`, a soft tick each second
  when the sound is on), and each drawn frame now goes in on the stage's `postrender` (`frameend`
  also fires for updates that drew nothing, when a WebGL canvas is already blank). `stopRecord`
  cancels a countdown.
- `src/ui.js`, `index.html`, `styles.css`: the Countdown choice beside Record (stored as
  `splashery.recordCountdown`), the "count" state of `setRecord` (the pill says "Recording in N"
  with Cancel), and the big number (`#rec-count`) placed on the stage's box.

## How to test it

- `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/rec1.spec.mjs`.
- By hand: Share tab, Countdown 5 s, Record; go full screen during the countdown or the take; Stop.
  The preview shows the take's length. For the length fix, open Photo to 3D (labs), leave it still,
  and record 20 seconds or more.
- A test browser (`navigator.webdriver`) starts the countdown at Off unless one is stored, so other
  lanes' Record specs start at once; `tests/rec1.spec.mjs` checks the person's default of 5.

## The Safari risk

- The full-length fix is verified in Chromium only. Playwright's WebKit isn't installed in the cloud
  sandbox, so the iPhone Safari length is unchecked. The owner's phone is the check: a 20-second
  take of a still Photo to 3D scene should save 20 seconds.
- On Safari, `requestFrame()` on the recording canvas and the 1-pixel redraw that marks it changed
  are the parts that matter; if a take still comes out short there, look at those first.
- On a device whose video encoder falls behind (seen here on a CPU encoder under load), the saved
  file can freeze on its last frame for up to about 1.5 seconds before the end. The file's length is
  still right. A phone's hardware encoder should not show this; the owner's iPhone check confirms
  it.

## Notes

- This sandbox encodes video on the CPU (open-source Chromium has only software VP9). At 3x it can't
  keep up with a turning toy, and a recorder drops its encoder's backlog when it stops, so the
  moving-toy test checks that the recorder was handed frames to within 0.25 s of Stop (`lastFrame`
  from `startRecording`), not the file's last video frame; the file's own length still meets 0.5 s,
  and the idle takes check the file's last frame to 0.5 s. Frame rates in the tests are measured
  against the page's own 100 ms timer, so a busy runner slows both together. Real phones encode in
  hardware.
- Codex task 89 (export quality) will change `startRecording` and the Record row: the countdown sits
  before the row's "quality choice goes here" comment, and the fixed-size video canvas is where a
  quality tier would set its size.
- The clips were made with a script in the session's scratchpad (llvmpipe under Xvfb). The countdown
  clip is a screen capture scaled up from 390×844; the two take clips are the saved takes at 3x.
