# Lane Studio Sound: Sound you can see

Prefix `sts`. Branch `claude/lane-studio-sound`. PR title "Phase Studio Sound: the song landscape
and the Chladni plate". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and
his answers on the Splashery Universe page the same night.

The owner's words: "Maybe they could upload a song or some audio and we'll be able to see, like, the
wavelengths and frequency or something like the audio sounds and it will actually be accurate. But,
like, some 2D or 3D visualization." His answer: the Studio (splats from anything) starts with "Sound
and music (song landscape, Chladni plate)", built by Sonnet 5.5, behind the labs switch, on a new
Studio section.

Build two labs toys (`labs: true`) on a new shelf, **Studio** (category id `studio`, label
"Studio"). Add the shelf to the categories in src/toys.js, placed after "Pictures and pages".

1. **Song landscape** (`song-landscape`).
   - You open a sound file (MP3, WAV, OGG, M4A, FLAC, whatever the browser decodes) with the Toy
     tab's input panel. It is decoded on the device with Web Audio and never uploaded.
   - The toy turns it into a 3D spectrogram made of splats: time runs away from you, pitch runs
     across on a log scale (about 40 Hz to 16 kHz, in musical bands), and loudness is height, in dB.
   - It must be accurate: a real short-time Fourier transform with windowing, from the decoded
     samples. Tests prove it with synthetic sounds (a 440 Hz sine puts one ridge in the 440 Hz band;
     a chirp makes a diagonal; silence is flat).
   - Color follows pitch or loudness (a Look option).
   - The tap plays the song through the site's speaker button (sound must be on). A glowing marker
     line and the camera glide along the time axis in sync with the music; tap again to pause.
   - Keep the splat count within the tier budgets: resample time and frequency to fit, and show a
     long song as a longer landscape at lower detail.
   - Sample: a short music clip (15 to 30 s) under CC0 or public domain (for example a public-domain
     recording on Wikimedia Commons), checked on its live page and credited.
2. **Chladni plate** (`chladni-plate`).
   - A square metal plate on a stand, dusted with sand. Every grain is its own splat and moves
     separately.
   - A "Mode" option (or a pitch slider that snaps to modes) picks a vibration mode, shown with its
     frequency.
   - The tap bows the plate: it hums at that mode's frequency, the sand jumps where the plate moves
     and slides toward the still lines, and in about 3 to 4 seconds it settles into that mode's
     figure.
   - Use a real model: the classic square-plate pattern cos(nπx/L)·cos(mπy/L) ±
     cos(mπx/L)·cos(nπy/L) = 0 for the nodal lines, with the plate's displacement driving each
     grain's hops. Say in the About text which model it is.
   - A test checks that the settled grains lie near the chosen mode's nodal lines.

Sounds: the landscape plays the song itself. The plate hums a steady tone at the mode's frequency
(existing voices in src/voices.js).

Engine: the owner's split says Opus builds engine changes. If a toy needs one (opening an audio file
in the input panel, playing a decoded sound through src/sound.js and the speaker button, or reading
the song's playback time), first check whether the existing input panel, sound and media code
already allow it. If they don't, stop and tell the Operator exactly what you need (the function,
where, and why). Don't change engine files yourself.

Clips and cards (390×844):

- `sts-song`: a song landscape playing, with the marker gliding, while the clip shows the song's
  waveform or title;
- `sts-chladni`: the tap, sand settling into a figure, shown for two different modes.

Label both cards and your PR "built by Sonnet 5.5".

You own: src/packs/studio.js (new), assets/toys/song-landscape/ and assets/toys/chladni-plate/; your
entries in the shared lists, plus the new Studio category in src/toys.js; tests/sts.spec.mjs, your
`sts-*` screenshots and docs/handoff/StudioSound.md.

(The rest of the brief, "How this lane runs", is the standing lane rules in OPERATING.md: final
messages start with READY, WORKING or BLOCKED; Sonnet 5.5 only; American English; never merge; post
clips to the Effect review page; check the owner's marks hourly.)

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), default effort.

Started September 29, 2026.

- Done: the Studio shelf (`studio`, after "Pictures and pages"); the Chladni plate (`chladni-plate`,
  complete: eight modes, a bow, twelve sand copies morphing into each other, the hum as a cue whose
  pitch follows the mode); the spectrogram (`src/packs/studio-audio.js`: Hann-windowed FFT, musical
  bands, dB, pooling for long songs) with tests on synthetic sounds; the song landscape
  (`song-landscape`) on its sample tune, with a waveform along the left edge and a gliding marker;
  help texts, sounds, plan entries; `tests/sts.spec.mjs`.
- Waiting on an engine PR (see "For the Operator"): opening your own sound file, and playing the
  song through the speaker button. The toy is written against that interface; until it lands the
  sample plays silently (the marker still glides) and "Open a song" cannot read a file.
- Also done: thumbnails, contact sheet, credits, `sts-*` screenshots, the full suite (305 of 307
  passed; the two failures were the missing thumbnails, now added), prettier and us-english clean.
  Cards on the Effect review page (lane StudioSound): `sts-chladni`, `sts-chladni-mode2`, `sts-song`
  (all labeled built by Sonnet 5.5).
- Not done yet: camera glide (the marker glides; the view does not follow), sound and file opening
  (engine PR).

## Notes

- Chladni: the sand's journey is a small simulation in `settle()` (each small move a grain jumps by
  an amount growing with the plate's swing |w| there, and slides toward the nearest still line by
  one Newton step on w). Twelve snapshots become twelve copies of the sand (parts `sand0`..`sand11`,
  one visible at a time), each grain morphing into its next place on morph channel 0, as the splat
  equation toy does. The hop height in each snapshot is the local swing, so the sand jumps where the
  plate moves and lies still where it does not. The toggle's progress (3.6 s) picks the copy; the
  second tap plays it backwards (the sand is stirred up again).
- The tap sound is `quiet` (toy-sounds.js keeps a sample for the Sound Board); the real hum is a cue
  from `drive()` with the mode's frequency: 60 Hz × (n² + m²).
- Song landscape: heights are dB below the song's own loudest point (45 dB range), so a quiet
  recording still fills the height. Twelve bands to the octave (104 bands) from 40 Hz to 16 kHz; a
  budget check drops to six a octave on a tiny budget. Frames: 24 a second up to the budget; a long
  song keeps its peaks (windows in between are pooled by their maximum).
- The sample tune is our own (`tools/make-song-sample.mjs`, CC0): the Wikimedia Commons API refused
  requests from the container (rate limit), so no public-domain recording was fetched. The Operator
  may ask for a real recording later.

## Known issues

- The camera does not glide with the marker yet.
- After the song ends the toggle stays on: one extra tap is needed before it plays again.

## For the Operator

**Engine request (Opus), small and additive.** Two things the song landscape needs, and nothing else
in `src/` changes for it:

1. **Opening a binary file in the input panel** (`src/ui.js`, `renderInputPanel`, the `file`
   `change` handler, about line 1000). Now it always does `apply(await f.text(), f.name)`, which
   mangles audio. Wanted: when the recipe's `input.binary` is true, skip `f.text()` and call
   `input.read("", f.name, f)`, so `read(text, fileName, file)` gets the `File` (the same handler
   otherwise; `accept` already sets the picker's filter). The toy decodes it itself with
   `OfflineAudioContext.decodeAudioData` and keeps the samples in its module (like the protein toy),
   returning small option values (`{ song: "custom", songName }`), which rebuilds the toy. Keep the
   40 MB limit. Test: a recipe with `input.binary` receives the File.
2. **The site's sound in the recipe's drive info** (`src/motion.js`, where `about` is built, about
   line 222: `const about = { time, R, tap: this.tap, data: ... }`). Wanted: `sound` in it, the
   app's `Sound` object (`src/sound.js`), so `drive` can read `info.sound.enabled` (the speaker
   button) and use `info.sound.audio()` and `info.sound.master` to start a decoded
   `AudioBufferSourceNode` through the site's limiter. Embeds already keep `enabled` off. Plumbing:
   `Player` needs a `setSound(sound)` (like `setMediaSound`) that `App` calls once. The toy already
   codes against `info.sound?.enabled`, `.audio()` and `.master`, and falls back to silence. Test:
   `info.sound` is the same object as `app.sound`.

Nothing else: the playback time is read from `AudioContext.currentTime` inside the toy.

The Chladni plate needs no engine change and is complete.
