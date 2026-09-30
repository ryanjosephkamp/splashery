# Sound sources for the sound lanes (September 30, 2026)

Model: Sonnet 5.5 (worker for the Operator). No code or sound files changed. The catalog is
[tools/sound-sources.json](../../tools/sound-sources.json):
`{ "<toy id>": [ { page, file, author, license, checked, duration, format, desc, why } ] }`, with 1
to 4 candidates per toy.

## Coverage

Of the 158 toys with `"status": "change"` in `tools/sound-review.json`:

- **102 toys have at least one CC0 candidate** (252 entries; 245 from Freesound, 7 from Kenney
  packs). Every Freesound license was read on the sound's own page (the CC0 1.0 link), not on the
  search list, on September 30, 2026.
- **0 toys have only CC BY.** CC BY was never needed, so none is listed.
- **56 toys have nothing**, for two different reasons:
  - **Recording wanted, none found (9):** `carrot-cake` (knife into cake), `donut` (dough tear),
    `ice-cream` (creamy melt), `jelly` (wet jiggle), `pretzel` (elastic dough), `pizza` (cheese
    stretch), `croissant` (flaky tear), `molecule` (molecular vibration), `mandeltorus` (a drone
    like the Mandelbulb's). Plain Freesound queries for these returned nothing CC0 that fits. Worth
    a second pass with other words.
  - **No recording needed (47):** the notes only ask to drop or soften a sound (wind, whistle,
    clicking, a hum, a chime) or to shape a synthesized swell: `planet`, `earth`, `mars`, `saturn`,
    `uranus`, `aurora-planet`, `solar-system`, `star-cluster`, `nebula`, `planetary-nebula`,
    `virus`, `astrocyte`, `white-blood-cell`, `tooth`, `maple`, `willow`, `sunflower`, `daisy`,
    `lava-lamp`, `snow-globe`, `ice-statue`, `watermelon`, `pancakes`, `lollipop`, `candy-cane`,
    `gummy-bear`, `burger`, `cherries`, `bricks`, `teddy-bear`, `kite`, `paper-plane`, `shield`,
    `starfish`, `lorenz`, `gyroid`, `surface-plotter`, `unit-circle`, `neural-network`, `rnn`,
    `transformer`, `diffusion-model`, `gradient-descent`, `half-adder`, `washington-monument`,
    `statue-of-liberty`, `white-house`.

### Weak matches (use with care)

I could not listen to audio in this session. Fit is judged from the page title, tags, description
and duration, so audition every pick before use.

- **No exact recording exists in CC0 (closest stand-ins):** `star-cookie` (cookie crunch, no snap),
  `pickleball` (ping-pong hit), `taco` (tortilla-chip crunch, not a hard-shell crack), the four gems
  `ruby`, `diamond`, `emerald`, `sapphire` (glass taps), `birthday-cake` (only a music-box wind-up;
  no CC0 "Happy Birthday" on a real instrument), `decorated-tree` (the Jingle Bells clips may be
  synth or voice; check first), `torus-knot`, `paramecium`, `jellyfish`, `octopus` (generic rope,
  underwater or bubbling sounds).
- **Needs trimming:** many Freesound clips are long recordings (for example `yo-yo`, `campfire`,
  `black-hole`). The `desc` and `why` say which slice to cut. Durations are the full file.
- **Wood or metal bat:** `baseball` and `softball` clips are titled "baseball bat" and "hit"; I
  could not confirm they are wood.
- The 7 Kenney entries give a file name pattern inside the pack zip, not a measured duration.

## Sources that block automated downloads

- **Freesound originals (wav, aiff, flac) need a login.** Their download links answer `302` to the
  login page, so a script can't fetch them. The API needs a token too.
  - **Previews work with no login.** The `file` field is the public preview
    (`cdn.freesound.org/previews/...-lq.mp3`; an `.ogg` with the same name also exists). All 207
    Freesound preview URLs returned `200` on September 30, 2026. Previews are low-bitrate MP3 and
    are fine for auditioning but lower quality than we'd ship.
- **Kenney** packs download with no login (direct zip links in the `file` field, 0.8 to 1 MB each).
- **Wikimedia Commons** answered `429` (rate limited) to the API from this container, so I did not
  use it. **NASA, the Internet Archive and OpenGameArt** were not searched; Freesound and Kenney
  covered the list, so they are a second pass for the nothing-found toys above.

### What the owner could do to unblock Freesound originals

1. Go to freesound.org and tap "Join" to make a free account, then confirm the email.
2. Open a candidate's `page` link while signed in and tap "Download" to get the original file. (Only
   needed for the picks the lanes choose, roughly 100 files.)
3. Or, for a script: signed in, open freesound.org/apiv2/apply, create an API key, and give it to
   the Operator as an environment secret (for example `FREESOUND_TOKEN`). It is for build-time tools
   only, never committed. A token still can't download originals without OAuth2, so step 2 may be
   simpler.
4. Put each chosen file in the repo only with its credit in `CREDITS.md` (author, page link, CC0 and
   the date checked), as the rules require, even though CC0 does not require attribution.

## How this was done

Freesound search pages with the "Creative Commons 0" license filter (no login), then a fetch of each
candidate's own page to confirm the CC0 link, type, duration and tags, then a `HEAD` and `GET` check
on each preview URL. Kenney's Impact Sounds, Casino Audio and RPG Audio pack pages were read for the
CC0 statement and each zip's `License.txt` was read.
