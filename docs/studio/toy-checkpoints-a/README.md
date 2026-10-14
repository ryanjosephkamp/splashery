# Toy checkpoints, part a: browser evidence

Source checkpoint: `claude/checkpoint-toys-2026-10-14`, commit
`41b21e74e04ccca178b95ac02b4e5dc0e51b4b45`. This evidence branch is `codex/toy-checkpoints-a-clips`;
it must never be merged. The documentation is in the draft PR from `codex/toy-checkpoints-a`. These
are captures of existing toys, not new shipping assets.

## Clips

Each toy has Square and Circle GIFs at **390 × 844**, with the app in focus mode. The default
payload and other recipe settings are retained, except the shape and the damage scenario below.

- QR code: a center Knock loose at 0.5 seconds, followed by the return to its grid.
- QR damage lab: a `sticker:0.24:finder:1` lands at 0.5 seconds; Heal starts at 3 seconds and
  completes before the end. This uses the same recipe switch and healing APIs as the existing tests.
  It demonstrates the restoration of a known finder, not blind recovery of arbitrary data.
- Picture QR: the default Felt farm (AI-made), with a center ripple at 0.5 seconds.

GIFs are silent, 10 fps, and show time stepped by 0.1 seconds using the existing effect-clip method:
the normal stage update callbacks run with that delta, and two actual frames render before each
viewport screenshot. This keeps animation time independent of software-rendering speed. These are
not recordings at a measured 10 fps. Four labeled-by-filename source frames per clip allow checking
the initial, moving, and final states. `measurements.json` records clip sizes, frame numbers, and
jsQR results on those **actual viewport screenshots**, separately from each toy's internal
higher-resolution scan check.

## Measurements

`capture.mjs` uses fresh Chromium contexts, a 390 × 844 viewport, device pixel ratio 1, forced Low
profile, WebGL2, SwiftShader, and adaptation off. These are desktop Linux software-rendering
observations with a phone-sized viewport and the phone-oriented Low budget, not measurements on a
physical phone. The browser, Node version, timestamp, and query string are in `measurements.json`.
No other regression browser run was active while it measured frame rate.

The engine and initial gallery finish loading before selecting each toy. `chooseToyMs` measures that
selection call; `chooseToCheckCompleteMs` also waits for the automatic scan result and cover
release. This includes a first QR pack load in that fresh context, but excludes initial site
startup. There is one observation per toy; there is no statistically established latency or
frame-rate guarantee. Resource timing lists the selected QR pack's local requests and decoded body
bytes, excluding the already loaded engine, gallery, and unselected samples.

Frame rate counts actual `Stage.frames` over approximately 2.5 seconds while Alive, Move in time, or
the ripple is active, in the normal app layout **before focus mode**. Canvas dimensions, elapsed
time, frame count, median interval, and 95th percentile interval are recorded. This is separate from
the manually stepped GIFs. Splat counts are actual `proc.ctx.buf.count` values; allocated
splat-array bytes count distinct ArrayBuffers directly owned by that buffer. They exclude temporary
build arrays, other engine storage, browser memory, and GPU allocations.

`qrs-meter.json` is the existing fixed-set meter test's output. The testing record is in the three
checkpoint documents and the draft PR. Node array tests and browser screenshots are distinguished
there. No camera, microphone, physical print, or WebGPU performance measurement was made.

## Reproduce

Use a full normal checkout of the saved commit with the repository's pinned devDependencies already
installed. Copy this evidence script into that checkout or into its `.cache/` directory. Keep the
same viewport, profile, payload, and settings when comparing results.

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

In a second terminal, from the checkout root:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node docs/studio/toy-checkpoints-a/capture.mjs .cache/toy-checkpoints-a/evidence
```

If the script was copied to `.cache/`, use its actual copied path instead. Change the Chromium path
to the installed browser; do not install or update the shipping renderer or libraries. The script
reads the saved remote-tracking checkpoint ref for its source identity. Confirm that the checkout's
source matches that commit before capturing.
