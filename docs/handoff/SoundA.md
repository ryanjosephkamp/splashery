# Lane Sound A: real sounds, part A, and recorded samples

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Sound A, "Real sounds, part A, and recorded samples" (prefix
`snda`). Branches: claude/lane-sound-a-engine (the engine PR, first) and claude/lane-sound-a (the
lane PR). PR titles: "Engine: recorded sound samples and a sound lint" and "Phase Sound A: real
sounds for the first shelves". Handoff file: docs/handoff/SoundA.md. Lane Sound B runs beside you on
the other shelves.

### Brief (written by the Operator on September 30, 2026, from the owner's sound review)

The owner reviewed every toy's sound in a long voice-typed notes file (written September 28, 2026,
filed September 30). Read it word for word in docs/reviews/2026-09-28-sounds/review.md. The clean
version per toy is in tools/sound-review.json (`status` "change" or "keep", `said` = his words,
`note`, `plan`); the rules drawn from it are in docs/PACKS.md, section 7e, "Sound preferences". All
three are on branch claude/operator-sound-review until that Ops PR merges (merge it into your branch
if main doesn't have them yet). His summary, in his words: a lot of stuff "sounds robotic and
digital when it shouldn't"; there are "overwhelming, like wave or wind sounds, like sounds that
sound like sand"; "a lot of the whistles just don't need to be in it. A lot of the clicking doesn't
need to be in the sounds"; and "for any kind of, like, real-life object, I'd like for things to have
almost, like, ASMR, or just real SFX, right? Like real-life, realistic sound effects. And you are
absolutely allowed to find sound packs."

His new process (September 30, 2026): new sounds may go live on the site before he has heard them,
and he names any to fix. So you change `src/toy-sounds.js` directly, not as board candidates. Set
each toy you finish to `"status": "site"` in tools/sound-review.json, with a one-line `plan` saying
what it is now. Toys he said to keep stay exactly as they are. Toys he didn't mention stay as they
are too, except the newer toys your list names below: apply section 7e to those.

How to do it well:

- **Every toy he asked to change gets a real fix**, judged against his words. Remove what he
  disliked (clicks, whistles, the "vroom" rise, loud wind, robotic tones, instrument notes on
  non-instruments), and add what he asked for: the real sound of the thing, synced to what happens
  on screen.
- **Synthesis where it can sound real, recorded samples where it can't.** Animal calls, fire,
  explosions, dice, bowling pins, a pool break, an apple bite, pages turning, a real steam engine or
  sports car, crowds: these want short recorded samples.
  - **Licenses:** CC0 or public domain first; CC BY only when nothing CC0 fits. Never BY-SA, NC or
    custom "royalty-free" licenses (Pixabay, Mixkit, Zapsplat, Sonniss, BBC Sound Effects).
  - **Sources to try:** Freesound with the CC0 filter (check each sound's own page); Kenney's audio
    packs (CC0: Casino Audio has dice, Impact Sounds, RPG Audio); CC0 packs on OpenGameArt;
    public-domain recordings on Wikimedia Commons (U.S. government agencies' animal calls); NASA
    audio.
  - **Record each one** on its live page and in CREDITS.md and tools/assets.json (source URL,
    author, license, date checked), plus the toy's in-app credit where the toy lists credits.
  - **Keep samples small:** mono MP3 or M4A (plays on iPhone Safari), trimmed, normalized to the
    kit's levels, usually under 40 KB each, under assets/sounds/.
  - **Load only on tap**, never on page load. The "embed transfer ≤ 30 MB" test stays green.
  - **If a source blocks automated downloads** (for example, Freesound needing an API key), say so
    in your message with the exact steps the owner would take. Carry on with the other sources in
    the meantime.
- **Levels:** re-measure with `node tools/sound-check.mjs` (`--voices` for new voices). Nothing
  louder or harsher than today's quietest complaints-free toys; ambience under the tap's main sound.
- **Judge by listening proxies.** You can't hear, so render each changed sound offline
  (tools/sound-audit.mjs or your own OfflineAudioContext in Chromium). Check the numbers the rules
  imply: few sharp transients (clicks), no sustained narrow high tone (whistle), no rising pitch
  sweep (vroom), noise energy well under the main sound (wind), and a peak and loudness in range.
  Compare before and after. Say plainly in the PR that the owner's ears are the real test.
- Sound-only changes: don't change any toy's look, motion or tap, except to sync a sound to an
  existing event. The laptop is locked: change only the sounds the owner named for it (lane Sound
  B), nothing else.

Cards: no clips unless an effect changes. The owner reviews on the Sound Board (the Operator
rebuilds and republishes it after your PR merges). In your final message, list every toy you changed
with a one-line description of its new sound, so the Operator can tell him what to listen for.

Tests in tests/<your prefix>.spec.mjs: every changed toy's sound plays without errors or warnings;
no sample is fetched before a tap (watch the network on page load and on opening a toy); each sample
file is credited in tools/assets.json and within its size budget; screenshots at 390×844 and
1440×900 of any toy whose Toy tab changed (none expected).

Merging: sounds go live without the owner's marks (his call of September 30), so the Operator merges
your PR after the Integrator's full run. Keep it mergeable: main moves often, so merge it into your
branch before each push.

### Your part

1. **Engine PR first (small and additive, merged before anything uses it).**
   - A `sample` voice for toy sounds: a short recorded file from assets/sounds/, with gain, rate
     (pitch), start offset and an optional random choice between a few files.
   - It is fetched and decoded on the first play only, cached for the session, and falls back
     quietly to a synth voice if the file fails. Nothing loads before a tap.
   - It works with the existing specs in src/toy-sounds.js and with the Sound Board.
   - Add `tools/sound-lint.mjs`, which renders any toy's sound offline and reports on section 7e:
     clicks (transients), whistles (a narrow tone held above about 2 kHz), the rising "vroom", noise
     loudness against the main sound, instrument voices on a non-music toy, peak and loudness. Give
     it `--toy <id>`, `--shelf <category>` and `--changed` (toys changed against main), and make it
     exit nonzero on a clear violation. The sound patrol routine and lane Sound B will use it.
   - Document both in docs/PACKS.md next to the sound specs, and add tests.
   - Tell the Operator when the PR is READY, and tell lane Sound B through your final message (the
     Operator relays it).
2. **Then your shelves**, in this order: scans (the owner's "Photo real"), shapes, balls, space,
   tiny (his "Tiny World"), atoms, gems and anatomy (his "Body").
   - Fix every toy he asked to change on these shelves.
   - Apply section 7e to the newer toys on them: periodic-table and anatomy-atlas.
   - Sample ideas from his notes: an elephant trumpet for the wooden elephant, a cat's meow for the
     cat statue, a horse's whinny for the horse statue, a camera shutter and flash for the vintage
     camera, a real alarm-clock bell, a wooden bat for baseball and softball, a real tennis-ball
     hit, a bowling ball rolling and real pins, a pool cue's solid hit, glass rolling for the
     marble, fire for the comet and meteor, real explosions for the meteor, star and supernova
     bursts, a real heartbeat (lub-dub, pause), breathing for the lungs, and a soft click-like blink
     for the eye (one of the few clicks he wants).
   - Use the Mandelbulb's sound, which he loves, as the model for the Mandeltorus.

### You own

- src/voices.js (the sample voice and any new synth voices, in a marked block) and src/sound.js;
- tools/sound-lint.mjs, and the other sound tools only where the sample voice needs them;
- assets/sounds/ (the folder layout; Sound B adds files too, named `<toy id>-<what>.mp3`);
- your shelves' entries in src/toy-sounds.js and in tools/sound-review.json;
- the CREDITS.md and tools/assets.json lines for your samples;
- tests/snda.spec.mjs, docs/handoff/SoundA.md, and the sound part of docs/PACKS.md.

Lane Sound B edits the other shelves' entries in the same files. Keep to your own lines, and if a
conflict comes, keep both sides.

Lanes Fluids r4, Books r4, Science, UI r2, Video 3D, Fix4, Worlds r3, Sound B and the Integrator run
at the same time; leave their files alone. The laptop is locked.

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
  already sees wait for the owner's "good" marks, except sounds, which go live without them (his
  call of September 30). Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State" (the blog post compares the two models).
- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain only, checked on the live source page and credited
  (CREDITS.md, tools/assets.json and the toy's in-app credit). Never BY-SA or NC. No logos, brand
  names or insignia.
- Review: the owner reviews sounds on the Sound Board, not the Effect review page; post clips there
  only if an effect changes. Don't republish either page, and never write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, and your own screenshots only if a Toy tab changed. Then put
  back the standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's
  screenshots your branch didn't change.
- PR: a draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary. When main moves, merge it into
  your branch.
- While you work, keep a check-in scheduled about an hour out (send_later), so a container restart
  can't stall you. Stop the check-ins once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, test
  results, the list of changed toys, anything for the Operator), "WORKING:" (what's left), or
  "BLOCKED:" (exactly what you need).

## State

- Model: Opus 5.5 (claude-opus-5-5), default effort.
- September 30, 2026: engine PR (`claude/lane-sound-a-engine`) built: the `sample` voice in
  `src/voices.js` (marked block "Recorded samples (lane Sound A)"), the first-play wait in
  `src/sound.js`, samples carried inside the Sound Board page (`tools/sound-board.mjs`), preloading
  in `tools/sound-check.mjs`, `tools/sound-lint.mjs`, docs in PACKS.md (section 5, "Recorded
  samples" and "The sound lint") and `tests/snda-engine.spec.mjs`.
- Next: the lane PR (`claude/lane-sound-a`): samples and fixes, shelf by shelf.

## Notes

- `tools/sound-review.json` was empty on main and on the Operator's sound-review branch when this
  lane started, so the lane works from the review itself (docs/reviews/2026-09-28-sounds/review.md)
  and fills in its own shelves' entries.
- The lint's thresholds were set by running it over every toy (`--all --json`): the toys the owner
  complained about (the knot, pulsar, atom and mitochondrion "vroom"; the aurora's whistle; the
  Earth's and tiny planet's wind; the tin can's and camera's clicks; the tooth's whistle; the
  crystal lattice's xylophone) fail, and the ones he likes mostly pass. Clicks only fail with a
  clicking voice in the spec, since crunches and taps have sharp transients too.
- Audio tools in this container: no ffmpeg was installed; `pip install imageio-ffmpeg` brings a
  static ffmpeg binary (a scratch tool only, nothing in the repo depends on it).

## Known issues

- The lint's whistle check also catches long glassy rings (the quartz cluster, which the owner
  likes); marking such toys `keep` in `tools/sound-review.json` turns them into warnings.

## For the Operator

- The Sound Board page now carries the sample files as data URLs (`SAMPLES.data`), so the page grows
  by the size of the samples it uses (about 40 KB each, a few hundred KB in all).
- `tools/sound-board.mjs` got a small change for that (it is on the Operator's list); nothing else
  in the page template changed.
