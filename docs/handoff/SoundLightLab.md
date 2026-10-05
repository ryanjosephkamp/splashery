# Lane Sound and light lab: a sound lab with a recorder, and a light lab (prefix `sll`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Sound and light lab (id `SoundLightLab`,
prefix `sll`). Branches: `claude/lane-sound-light-lab` (and `-engine` if needed). PR title: "Phase
Sound and light lab: a sound lab with a recorder, and a light lab". Handoff file:
docs/handoff/SoundLightLab.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State

WORKING (October 5, 2026): the three toys are built and their tests pass; clips, screenshots and the
full checks are next.

- `sound-lab` (Studio, labs): spectrogram, spectrum, oscilloscope, level (dBFS and an uncalibrated
  dB SPL estimate), tone generator (sine, square, saw, noise, 20 Hz to 20 kHz, a second tone for
  beats), metronome; the microphone on a tap.
- `sound-recorder` (Studio, labs): Record from the microphone on a tap, play back (tap the toy),
  trim (or "Trim the silence"), waveform and spectrogram, save as WAV or the browser's Opus or AAC.
- `light-lab` (Lab, labs): four views: NIST line spectra to compare, a prism bench (N-SF11 or N-BK7,
  Snell's law), a grating bench (CD, DVD or 1000 per mm slide, orders −2 to +2), and the home
  spectrometer (camera on a tap, or an opened photo, or a made-up sample).

## Notes

- Shared code lives in `src/labs/`: `sound-dsp.js` (tones, spectra, levels, metronome, WAV),
  `light-optics.js` (colors, glass, prism trace, grating, spectrometer), `nist-lines.js` (generated
  by `tools/sll-nist.mjs`; `--check` compares it with NIST again) and `splat-shapes.js` (cases built
  from exactly sized splats: a kit box sized by the budget left after a big screen gets oversized,
  soft splats).
- The screens are the toy's screen canvas (one splat per pixel). In the Light lab the rays are
  relief splats (axis 3, lift 0) whose mask alpha hides them, so a new lamp needs no rebuild.
- Reused without editing: `src/live/live.js` (start, release), `MicRecorder` and `clock` from
  `src/packs/song-record.js`, the FFT, window and spectrogram from `src/packs/studio-audio.js`.
- The tone and the recording play only while the site's sound is on (PACKS.md, "Playing its own
  audio"); a watchdog stops them when frames stop (another toy, a hidden tab).
- The owner's marks of October 5, 2026: the Sound lab "good"; the three Light lab clips "Please make
  sharper". r2: the Light lab uses the labs-only sharp kernel (`kernel: "sharp"`), its panels take
  more of the budget, and the text and lines are larger. A panel's columns are capped (420 for the
  bench's info panel): at the high tier smaller splats fall under the engine's two-pixel cull and
  the panel goes blank.
- Tone, tempo and the lamp are kept in the module, not in the scene (dragging a slider would
  otherwise rebuild the toy each step).

- r2 (the Operator's notes of October 5, 2026, 14:10 and 15:40 UTC; on
  `claude/lane-sound-light-lab-r2`, waiting for #286 to merge): every toy sharper. The Light lab:
  density 2, finer rays and beams, thinner prism edges, finer prism faces, disc and slide, larger
  panel caps. The Sound lab and the recorder: density 2, the sharp kernel, the speaker, metronome
  and microphone rebuilt from exactly sized splats (`surfSplats`, `cylinderSplats`, `sphereSplats`),
  the speaker's cone, surround and dust cap visible through a hole in the baffle, larger screen
  labels. All three (labs only) set `render: { cull: "low", dpr: "native" }`: the engine's two-pixel
  cull hid the finer splats at the high tier.

## Known issues

- In headless Chromium the player's clock runs slower than real time, so the spectrogram fills
  slowly in screenshots; on a device it scrolls at 25 columns a second.
- Not tried on a real phone: the camera spectrometer with a real CD and lamp, and the compressed
  save (Safari makes M4A, Chrome and Firefox WebM or Ogg).

## For the Operator

- Effect review page 2 has no `lanes/SoundLightLab` record yet; the cards are posted under that lane
  id. Please add the record.
- No clip of the Sound recorder: its tap plays the recording, which is silent in a clip; its
  screenshots (`tests/screenshots/sll-sound-recorder-*.png`) show the waveform and spectrogram.

- License: NIST's pages state that Standard Reference Data (the Handbook is SRD 108, the ASD SRD 78)
  are copyrighted compilations under 15 U.S.C. 290e, not plain public domain as the brief says. Like
  the Chemistry lane, the toy ships only measured values (facts) from 16 small tables, with NIST
  credited ("Measured values (facts), credited to NIST"). Please confirm this is acceptable.
- The metronome clicks at each end of its swing; a mechanical metronome's escapement ticks at a set
  angle that I could not pin down from a source, so the evidence file lists it as simplified.
