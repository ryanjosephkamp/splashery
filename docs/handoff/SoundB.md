# Lane Sound B: Real sounds, part B

Prefix `sndb`. Branch `claude/lane-sound-b`. PR title "Phase Sound B: real sounds for the other
shelves". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on September 30, 2026, from the owner's sound review.

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
  existing event. The laptop is locked: change only the sounds the owner named for it, nothing else.

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

1. **Start with what synthesis can fix now**, on your shelves: nature, weather (his "weather and
   fire"), food, toys, objects (his "Open Me"), medieval, animals, maths, computing (his "AI and
   Computing"), holidays, vehicles and landmarks.
   - Remove the clicks, whistles, "vroom" rises, loud wind and robotic tones he named.
   - Sync sounds to what happens on screen: daisy petals landing, the gradient-descent ball's
     bounces, the starfish's arms, each menorah flame going out.
   - Swap instrument notes on non-instruments for real sound effects.
   - The volcano's flame is his reference for fire: use it for the campfire too.
2. **When Sound A's engine PR has merged** (the Operator tells you), merge main and use the `sample`
   voice where only a recording will do. From his notes:
   - rolling dice on a table; a real spinning top; a yo-yo; a real puzzle-cube twist;
   - a spring toy's boing (not a rubber band) and balloons popping;
   - chess pieces on a wooden board, with a good online-chess feel;
   - a book's pages turning; a real bite of an apple; popcorn popping dry; a hard taco shell
     cracking; stretching cheese on the pizza;
   - real fireworks (the fireworks and the Eiffel Tower); a crowd and horses' hooves for the
     Colosseum;
   - a steam train chugging; a sports car revving; real tractor, helicopter and propeller-plane
     engines;
   - a royal trumpet for the crown; bowstrings that aren't instruments;
   - an owl's hoot, a frog's croak and a real fly;
   - scissors cutting and branches growing for the bonsai; leaves falling; stones for the pebbles;
     ice cracking for the iceberg; water moving in the Klein bottle.
3. **Music where he asked for it**, played on a realistic instrument, never a robotic jingle and
   never with voices:
   - part of "Happy Birthday to You" on the birthday cake (public domain in the United States since
     2016);
   - a bit of a carol such as "Jingle Bells" on the decorated tree;
   - a calm, respectful melody for the cherry blossom (the traditional "Sakura Sakura" is public
     domain);
   - a gentle Hanukkah melody for the menorah, if it fits (the traditional "Maoz Tzur" is public
     domain), with each flame's sound in sync.
4. **The laptop** (locked): only what he named. Remove the thunk when it closes and the twinkle when
   it opens; keep the screen-on sound; make the keys sound like a real keyboard. Nothing else about
   the laptop changes.
5. **The Möbius strip:** a sound per rider (a real race car, a rolling beach ball, a bicycle with a
   rare, soft duck quack, and the ant's crawl, which he likes). Drop the xylophone-like tones.
6. **The newer toys on your shelves**, added after his notes: apply section 7e to fountain-pen,
   water-bottle, soda-can, running-shoe, hoodie, sunglasses, baseball-cap, splat-equation,
   gaussian-splatting, turing-machine, difference-engine, enigma-machine, bombe, fluid-lab,
   splat-field, picture-lab, your-book, photo-album, picture-frame, screen, song-landscape,
   chladni-plate, model-splats and photo-3d.
   - Many of these are labs toys whose sound comes from their own engines (the Fluids, Books and
     Studio code). Change only their entries in src/toy-sounds.js.
   - If a fix needs another lane's code, name it in your message instead.
   - The music shelf he called "pretty much perfect": leave it.

Use tools/sound-lint.mjs as soon as Sound A's engine PR lands. Until then, use your own offline
renders.

### You own

- your shelves' entries in src/toy-sounds.js and tools/sound-review.json;
- new synth voices in a marked "Sound B" block at the end of src/voices.js;
- your sample files in assets/sounds/, named `<toy id>-<what>.mp3`;
- the CREDITS.md and tools/assets.json lines for them;
- tests/sndb.spec.mjs and docs/handoff/SoundB.md.

Lane Sound A owns the sample voice and the rest of src/voices.js and src/sound.js. Keep to your own
lines, and if a conflict comes, keep both sides.

Lanes Fluids r4, Books r4, Science, UI r2, Video 3D, Fix4, Worlds r3, Sound A and the Integrator run
at the same time; leave their files alone.

## State

Model: Opus 5.5 (default effort), all of it.

- September 30, 2026: started. `tools/sound-review.json` reached main in #139 during the day and was
  merged in.
- **Synthesis done** for every toy on the lane's shelves that the owner asked to change (92 toys)
  and 16 of the newer toys (section 7e), each marked `"status": "site"` in `tools/sound-review.json`
  with a `plan` starting "Now:". Toys he said to keep, and toys he didn't mention, are unchanged
  (the water bottle, the fluid lab, the picture frame, the Chladni plate, the Screen and the Turing,
  Enigma and Bombe machines already fit 7e).
- **43 new voices** in the "Sound B" block at the end of `src/voices.js` (fire, leaves, pages, a
  bite, brittle cracks, popcorn, dice, steam chuffs, real engines, rotors, creaking wood, scissors,
  a natural trumpet, bowstrings, water in a bottle, a firework's launch and burst, hooves, a crowd,
  stones, a top, a yo-yo, a cube twist, a coil spring, a balloon, a fly, a frog, an owl, melting,
  stretching, peeling, gurgling, swimming, keys, a fan, a cinematic hit, a warm pad, an electric
  arc, a slow rush, an alarm bell, chess moves, clockwork and sleigh bells), each with a measured
  level.
- **Synced cues** (only the cue lines of the packs changed): the daisy's petals land one by one; the
  pebbles knock as stones; each Möbius rider has its own sound; the puzzle cube's turns, the bricks'
  landings, the chess moves, the laptop's keys, the banana's peels and the croissant's butter use
  the new sounds. Timed layers in `src/toy-sounds.js` follow the starfish's arms, the menorah's
  candles, the gradient-descent ball's 21 hops and the bonsai's growth, scissors and drop.
- **28 recorded samples ready** in `assets/sounds/` (CC0, credited in CREDITS.md and
  `tools/assets.json` `sounds`), waiting for Sound A's `sample` voice to be wired in.

## Notes

- Cues: many toys' later sounds are pushed from the pack's `drive()` (`out.cues.push(spec)`), not
  from `src/toy-sounds.js`. Syncing a sound to an on-screen event means editing only those cue lines
  in the pack, nothing that changes the look, motion or tap.
- Listening proxy: a scratch tool opened each toy in headless Chromium, recorded every sound the tap
  and its cues played (with times), rendered them offline through the app's master chain and
  measured sharp onsets (clicks), sustained narrow high tones (whistles), rising pitch (vroom), the
  share of noise energy and the peak and loudness, before and after. Headless frames run slower than
  real time, so cue times stretch in those renders; the numbers still compare.
- Samples: Freesound's public search with the CC0 filter works without an API key, and its HQ
  previews (128 kbps MP3) download without one; each sound's license was read on its own page.
  Kenney's Casino Audio (CC0, License.txt in the pack) gave the dice. The files were cut and encoded
  with a local ffmpeg (from the `imageio-ffmpeg` wheel, not a repo dependency), mono, faded,
  peak-normalized to -3 dBFS, 64 kbps.
- `hold` (the key's time down) keeps piano tunes (the cake, the tree, the diffusion model, the
  splatting toy) inside the 5 s limit; `decay` alone rings too long.

## Known issues

- The owner's ears are the real test: every new sound was judged from renders and numbers, not
  heard.
- The samples are not played yet: they wait for Sound A's `sample` voice.

## For the Operator

- The Klein bottle's tap is hard to hit (his note): that's the math pack's pick, not a sound.
- The balloon dog's pieces ignore the flag color when it pops (his note): the toys pack's code.
- The "Maoz Tzur" melody for the menorah was left out: the lane couldn't check the tune against a
  public-domain score, so the menorah has each candle's sound in sync instead. "Sakura Sakura",
  "Happy Birthday to You" and "Jingle Bells" are in.
