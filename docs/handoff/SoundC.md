# Lane Sound C: The sound notes of October 2

Prefix `sndc`. Branches `claude/lane-sound-c-engine` (PR "Engine: sounds pause with their effect,
and a toy's first tap sounds on time") and `claude/lane-sound-c` (PR "Phase Sound C: the sound notes
of October 2"). How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 2, 2026, from the owner's review of that day.

On October 2 the owner went through every toy on the preview build and named the sounds he wants
changed. His review is in docs/reviews/2026-10-02-mega-review/review.md (word for word). The sound
parts, word for word by toy, are in docs/reviews/sounds-2026-10-02.md. The clean note and a plan per
toy are in tools/sound-review.json, round "2026-10-02": the 44 toys with status "change". Every toy
he called perfect or fine keeps its sound. Those files are on the branch
`claude/operator-mega-review` (Ops PR) until it merges; merge that branch or main into yours when it
lands.

What he wants, in general (PACKS.md section 7e still holds): subtle, realistic sounds, often a real
recording; no wind unless it belongs; no motor "vroom", no buzz or horn, no robotic tones, no tacky
xylophone runs. Sounds in sync with what you see.

### Part 1: the engine (branch claude/lane-sound-c-engine, do this first)

The Operator traced both problems in the code (paths as of main 2ba6455):

1. **A sound must pause and resume with its effect.** He tapped the DNA to pause it: the sound
   played on, and after he tapped again to resume, the sound didn't come back. Today a tap-to-pause
   (motion.js:116-141, 185-196) calls `sound.pauseHeld/resumeHeld("toy")` (app.js:762-766,
   sound.js:121-135). That stops only the notes the look-ahead scheduler (`playHeld`,
   sound.js:90-134) hasn't handed to WebAudio yet. Notes already sounding ring on, so a long single
   voice keeps playing, and recipe cue sounds (app.js:146-148) use plain `play`, so they aren't held
   at all. Make pause real: everything the toy is sounding (held notes, ringing voices and its cue
   sounds) pauses at the paused moment and resumes from there, in sync with the motion. One clean
   way is a per-toy output bus that you can suspend; another is suspending the AudioContext while a
   toy's effect is paused (only if nothing else needs to sound then). Choose, and explain why in the
   PR. Test it: pause mid-effect, check the toy's output goes silent within a frame or two, resume,
   and check it continues.
2. **The first tap's sound is late.** He noticed on many toys that the first tap's sound starts
   noticeably after the motion; later taps are in sync. Cause: sample voices are fetched and decoded
   on the first play (voices.js:1289-1325), and the first play waits up to `SAMPLE_WAIT` = 0.6 s
   (sound.js:12, 73-81). Fix it: start fetching and decoding a toy's samples when the toy opens (and
   its options' samples when they're chosen), and make sure the AudioContext is resumed by the first
   user gesture before the effect starts. Never delay the motion to wait for the sound. Test it: on
   a cold load, the first tap's first sample starts within about 30 ms of the motion.
3. While you're there: `"splat-field"` appears twice in src/toy-sounds.js (:2506 and :2509); the
   second wins. Keep one.

### Part 2: the toys (branch claude/lane-sound-c)

Work through every "change" entry of round 2026-10-02 in tools/sound-review.json (the 44 toys). Its
"note" says what he wants and its "plan" the Operator's idea; better ideas are welcome if they match
his words. Some need care:

- **mitochondrion**: no motor or buzz. He suggested a furnace ("the powerhouse of the cell"). Put
  two or three candidates on the Sound Board entry (OPERATING.md, "The sound review", step 3), put
  the best one in the site, and say which in your message.
- **lungs**: acceptable now; he wants to compare. Add two other real inhale and exhale recordings as
  board candidates, and leave the site's sound as it is.
- **atom**: use the periodic table's atom-appear sound, which he likes.
- **meteor**: end with the star's burst sound when it explodes.
- **rose**: add the daisies' soft petal-landing tap when its petal lands; **daisy**: time each
  petal's tap to its landing.
- **periodic-table**: the whoosh much quieter, plus a faint, soft tick in sync with each proton and
  neutron packing into the nucleus. The nucleons fade in one by one from the middle out
  (src/packs/chemistry.js:685; the nucleus builds at u 0.1 to 0.5, :452-455). Ticks, not bubbles or
  plastic blocks.
- **gaussian-splatting**: four views. Training: no opening chord; a soft, continuous falling tone as
  the loss curve draws. One splat: something subtle. Many splats: the twinkle quieter. Sorting: a
  pebble-like click for each splat placed, in sync, each slightly different (use the toy's own
  timing; a cue per placed splat or per batch, whatever stays in sync at phone frame rates).
- **spinning-top**: the spin sound follows the top's speed (quieter and lower as it slows), also
  when the person spins it by hand.
- **sports-car**: the engine sound ends when the exhaust fades.
- **ice-cream**: he said it can stay; leave it (status "keep").
- **your-book**: a page sound per book type (magazine glossier, paperback, hardcover).
- **splat-field**: no robotic pulse; a sound that suits each field.

Assets: every new recording must be CC0, CC BY or public domain, checked on its live source page
(Freesound CC0 is the usual source). Never BY-SA, NC, Sampling+, or "royalty-free" custom licenses
(Sonniss, BBC RemArc and the like are out). Record each in CREDITS.md, tools/assets.json and the
toy's in-app credit, as Sound A and Sound B did. Trim, fade and level-match with
tools/sound-check.mjs; run tools/sound-lint.mjs on every toy you change.

Since September 30 sounds go live: new sounds go straight into src/toy-sounds.js (and voices into
src/voices.js), and each toy's status becomes "site" in tools/sound-review.json (your toys' entries
are yours to edit). The Operator rebuilds the Sound Board after your PR merges, and the owner
listens there. List every changed toy and what it sounds like now in your PR, so he knows what he's
hearing.

No clips are needed for sound-only changes. If you change an effect's timing to sync a sound, post a
short clip as a card in your lane record "SoundC" on Effect review page 2.

### You own

- Part 1: src/sound.js, src/voices.js, the sound hooks in src/app.js and src/motion.js that pause
  and resume sound (keep changes small and additive; tell the Operator exactly which lines you
  touched).
- Part 2: the sound entries of the 44 toys in src/toy-sounds.js, new voices, new files under
  assets/sounds/, their credits, and those toys' entries in tools/sound-review.json and
  tools/sound-voices-next.js.
- A recipe's sound cues (the `cue`/`tine`/`blip` calls inside a pack) only where a sound must be
  timed to the motion; don't change the motion itself. If you must, say so.
- tests/sndc.spec.mjs, tests/sndc-engine.spec.mjs, your `sndc-*` screenshots and
  docs/handoff/SoundC.md.

Other lanes running now: Physics (the hands-on engine), Fix7 (toy bugs), Fluids r4, Video 3D, Live
input, Science and the Integrators. Leave their files alone. Fluids owns the Fluid lab's sounds
except the honey level, which is yours (one number). The laptop is locked.

### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks (since September 30, sound-only changes go live
  without waiting). Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes), and docs/handoff/SoundA.md and SoundB.md (how the last sound lanes worked).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Model: Opus 5.5 (default effort), all of it, and its one helper (it found and cut the recordings).

- October 2, 2026: the engine PR #183 merged. Started from main 2ba6455 and the Ops branch
  `claude/operator-mega-review` (merged to main as #170 during the day, then main merged in).
- **Engine** (`claude/lane-sound-c-engine`): done.
  - A tap that pauses a long effect suspends the AudioContext, so everything the toy is sounding
    stops at that moment and resumes from it (held tunes, ringing notes, cue sounds, a recipe's own
    audio). This works for a "quiet" tap too (one whose sound comes from cues). Opening another toy,
    or a tap on another control, carries on.
  - A toy's recorded samples load when it opens with the speaker on. That covers its tap sound, and
    any its recipe lists in a new optional `sounds` key (an array of specs, or `(options) => specs`,
    so a toy's options can bring their own). A rebuild for new options loads those too. They are
    decoded in a small offline context, so no AudioContext is created before a gesture.
  - The first press or key of a visit starts (or wakes) the audio before the tap it begins fires.
  - The About tab credits the samples a recipe's `sounds` lists, as it does the tap sound's.
  - A recipe's drive sees `info.view`, the camera's turn about the toy (for the spinning top's hum,
    which follows a drag's spin).
  - The duplicate `"splat-field"` entry was already gone on main 2ba6455: nothing to do.
  - Measured: the first tap's sample starts 7.6 ms after the motion takes the tap, with a slow (400
    ms) network for the samples. On main, the sample isn't loaded before the tap at all.
- **Toys** (`claude/lane-sound-c`): all 44 toys of the round are done. 42 are `"site"` and lungs is
  `"ready"`, with two candidates. Their sounds are listed in the PR, and each toy's "plan" in
  `tools/sound-review.json` says what it sounds like now.
  - 24 new CC0 recordings from Freesound, each checked on its live page and credited in CREDITS.md,
    tools/assets.json and src/sound-credits.js. Each is 32 or 64 kbps mono and under 16 KB.
  - Six recordings that my toys no longer use were removed, with their credits: the tin can's spin,
    the old owl, rotor, steam chug, popcorn and spring boing. The sports car's rev was cut to 1.8 s,
    and the top's spin was remade as a seamless loop. Both keep their names and credits.
  - Pack cues changed only where a sound is timed to the motion: the daisy's and rose's petals
    (nature), the nucleon ticks (chemistry), the splatting views and sorting clicks (splatting), the
    splat fields (lab), the book styles' pages (pictures), the top's hum and the bubbles' pops
    (playthings), and the bananas' peels (food). No motion changed.
  - A new voice, `glide` (a soft, warm, falling tone), is in a "Sound C" block at the end of
    src/voices.js, with its measured level of 0.9.

## Notes

- **Pause by suspending the AudioContext.** A per-toy bus can mute a toy but can't pause it: sounds
  already handed to WebAudio keep their clock and would play on (or be lost) under a muted bus.
  Suspending the context stops its clock, so every scheduled and ringing sound stops at the paused
  moment and carries on from it. That includes held tunes, cue sounds and a recipe's own audio
  through `sound.master`, such as the song landscape. Nothing else needs to sound while a toy's
  effect is paused; a UI sound played meanwhile waits for the resume.
- **Cues share one key**, so the site plays at most one cue per 60 ms (`gap`), and many cues in a
  row (one per frame) get dropped. Timed ticks (the nucleons, the sorting splats) come as one cue
  per batch, about every 0.2 s, and each tick has its own `at`.
- **Lead scheduling.** A cue for a known moment is handed over a little early and scheduled for the
  moment itself (`at`), so it lands in sync at any frame rate (the daisy's and rose's petals).
- **Headless frames are slow** (about 1 fps on heavy toys), so effects run in slow motion there. The
  lane's tests wait for a control to run out rather than for a fixed time.
- **Option sounds.** The book's style and the splat field's program can't change a toy's entry in
  src/toy-sounds.js (one spec per toy), so those toys make the tap `quiet` and push their own sound
  from drive. They list their files in the recipe's `sounds`, so they preload and get credited.
- Listening proxies: `tools/sound-lint.mjs` on every changed toy, and envelope checks on each
  recording (its onset, its length, where its peaks are) to choose the cuts. The owner's ears are
  the real test.

## Known issues

- The steam train's tap is still labeled "Blow the whistle", and its how-to line says so too. Now it
  chuffs with no whistle sound (his note). A text lane could relabel it ("Get up steam").
- The spinning top's hum follows a drag's spin through the camera's turn (`info.view`). If the
  Physics lane adds a real hand-spin of the top, its speed should feed `topHum` instead.
- `tools/sound-lint.mjs` flags three sounds as he asked for them. The atom's ping is the periodic
  table's sound he likes, now shorter. The bicycle's is a real bell. The sports car's rising pitch
  is the real rev, unchanged from Sound B.
- The slinky and soap-bubble recordings were the weakest of the finds (the helper said so). Worth a
  listen first.

## For the Operator

- **Lines touched in the engine** (on `claude/lane-sound-c-engine`):
  - src/sound.js: the constructor (the wake on first press), `audio()`, and the new `preload`,
    `pauseToy` and `resumeToy`.
  - src/voices.js: `loadSample` decodes with an offline context when no context is given.
  - src/app.js: the cue handler (it resumes when cues run), `onToy` (resume and preload),
    `renderCredits` (recipe sounds), `toggleSound` (preload), and `onAction`. In `onAction` the
    pause comes before the `quiet` check, and a resume happens before a new tap's sound. Two new
    methods, `preloadSounds` and `recipeSounds`.
  - src/motion.js: `info.view` in the drive's info.
- **Tests from finished lanes this lane changes** (please update; I didn't edit them):
  1. `tests/snda.spec.mjs` (the preload rule): done in #183, with the Operator's authorization.
  2. `tests/snda.spec.mjs` ("every sample is used …"): changed in #192 after Integrator 2's combo D.
     "Used" now counts every pack's recipe and cue files and the review's candidates, and the folder
     cap is 1.5 MB (the reasons are in #192).
- **Honey**: done once Fluids r4 merged. In `src/fluids/runtime.js` the honey's gloops are now
  `0.5 * v` (lava and syrup stay at `0.35 * v`), about 3 dB louder. The Fluid lab's review entry
  keeps the status Fluids gave it.
- **Mitochondrion**: the site plays candidate A, a gas furnace lighting (a soft whoomp, then a warm
  roar), with the ATP sparks' soft pops. B is a gas burner's steadier, breathier roar. A third find,
  a boiler, was dropped because its source title names a brand.
- **Lungs**: the site's breath is unchanged. Candidates B (a deep breath, in and out at the same
  strength) and C (a soft breath in, a long breath out) are on the board entry.
- A PACKS.md lesson: when a toy's option should change its sound, make the tap `quiet`, push the
  option's sound from drive, and list its files in the recipe's `sounds`, so they preload and get
  credited.
