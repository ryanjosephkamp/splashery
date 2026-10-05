# Lane Sound and light lab: a sound lab with a recorder, and a light lab (prefix `sll`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Sound and light lab (id `SoundLightLab`,
prefix `sll`). Branches: `claude/lane-sound-light-lab` (and `-engine` if needed). PR title: "Phase
Sound and light lab: a sound lab with a recorder, and a light lab". Handoff file:
docs/handoff/SoundLightLab.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus
5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks S6 and S7 and his notes)

1. **Sound lab** (S7): a live spectrogram, an oscilloscope, a tone generator (sine, square, saw,
   noise; frequency and volume; two tones for beats), a sound level estimate (labeled uncalibrated)
   and a metronome, drawn as splats. The microphone is asked for only on a tap (CLAUDE.md, "Live
   input").
2. **The recorder** (the owner: "for me to be able to, like, play a song manually and record that
   and save it as some sort of file ... so that I can create a sound effect or record it and tell
   you I want something kind of like this"). Record from the microphone when the person taps Record,
   play it back, trim it, show its spectrogram, and save it to a file the person chooses (WAV, and a
   compressed format if the browser can). This is the one recording exception in CLAUDE.md: nothing
   is stored or sent. Add a short "Send this to the Operator" note in its About text: attach the
   file to a message in the chat.
3. **Light lab** (S6): element emission spectra from NIST's Atomic Spectra Database (public domain;
   cite the exact tables), drawn as real line spectra you can compare (hydrogen, helium, neon,
   sodium, mercury and more), with a prism or grating that splits white light; and a home
   spectrometer: with the camera (asked on a tap), a CD or DVD as a grating and a lamp, read a
   spectrum from the camera image and show it beside the reference lines, with a plain how-to.
   Everything technically right: say what is simplified, and write a docs/evidence/<toy id>.json for
   each new toy in the shape docs/evidence/README.md gives (sources you opened, tests for what can
   be computed).

Labs toys on the Lab or Studio shelf. Tests in `tests/sll*.spec.mjs` (generated audio and images, no
outside files): the spectrogram's peak lands at a known tone, the recorder's file round-trips, the
reference lines match the NIST wavelengths you ship. Clips at phone size on Effect review page 2
(lane record `SoundLightLab`). How-to and About texts.

You own: `src/packs/sound-lab.js`, `src/packs/light-lab.js` (new), any new `src/labs/` helpers you
add, `tools/sll-*.mjs`, `tests/sll*.spec.mjs`, the evidence files for your toys, your toys' lines in
the shared lists, and your handoff file. Reuse the existing live-input code (src/live/) and song
analysis by importing, not editing; if you need a change there, tell the Operator.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle.

## State

WORKING (October 5, 2026): started. Plan: three labs toys, `sound-lab` and `sound-recorder` on the
Studio shelf (`src/packs/sound-lab.js`) and `light-lab` on the Lab shelf (`src/packs/light-lab.js`),
with the NIST line lists built by `tools/sll-nist.mjs` into `src/labs/nist-lines.js`.

## Notes

## Known issues

## For the Operator
