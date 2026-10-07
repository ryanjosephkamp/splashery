# Lane Sound D: the walkthrough's sound fixes

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Sound D (id `SoundD`, prefix `sndd`).
Branch: `claude/lane-sound-d` (and `claude/lane-sound-d-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase Sound D: the walkthrough's
sound fixes". Handoff file: docs/handoff/SoundD.md (create it; start it with this brief, word for
word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the
Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026, from the owner's walkthrough review)

Read the owner's own words first: docs/reviews/2026-10-06-walkthrough/notes.md (dictated on his
phone; he praised the site and asked for these refinements), then the Operator's triage in
docs/reviews/2026-10-06-walkthrough/triage.md, section "Sound D". That section is your list.
Anything the owner didn't mention is approved: change nothing else, and keep the look and layout he
praised.

Notes on the list:

- The clicking "zipper" sound on the photoreal shelf: find where it comes from (likely one shared
  lift or reveal sound for the photoreal recipes) and remove it at the root, so no photoreal toy
  plays it. List every toy that loses it.
- Read docs/OPERATING.md, "The sound review", and the earlier sound notes in docs/reviews/ (the
  owner's taste: subtle, true to the object, no stray clicks, twinkles or wind unless they belong).
  Keep every sound the owner didn't mention.
- The periodic table's particle sound goes to the Real elements lane, and the game sounds
  (Shardball, Page Breaker) to Arcade r2. Not yours.
- For each changed toy, update its entry in tools/sound-review.json (a plan line and "new sound to
  hear"), so the Sound Board shows it. Post a short card per toy (or one card for the photoreal
  shelf) on Effect review page 2 with a clip that has sound (ids sndd-…).

You own: the named toys' entries in src/toy-sounds.js and tools/sound-review.json, and the shared
sound code the photoreal shelf uses (if it lives in a pack, only its sound lines), plus
tests/sndd\*.spec.mjs.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Your changes touch toys and pages the public sees,
so the Operator merges them after a full test run (the Integrators run it) and the owner's "good"
marks on your cards. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery
has no CI to wait for; for a long job, schedule a check-in with send_later instead of going idle.
Clips at phone size go on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK)
as docs/OPERATING.md, "Steps for a lane", says (no republish). Before READY, re-read CLAUDE.md's
"Effect quality rules" and check each clip against them at phone size. The push ends Wednesday,
October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first READY within about four to six hours, then
polish rounds on the owner's marks.

## State

October 7, 2026: every item on the list is in `src/toy-sounds.js`, marked `ready` (round
`2026-10-06`) in `tools/sound-review.json`, with `tests/sndd.spec.mjs`. No engine change, no pack
change (the toys' motion is untouched).

The zipper: it was the `rustle` voice (30 short noise grains over 0.6 to 1 s, at full level) that
ten Photoreal r2 captures used as their first or second layer. It isn't in any recipe or shared lift
sound: each toy's spec named it. It is gone from all ten; the voice itself stays for the toys that
use it on purpose (the trees, the croissant, the paper plane and the rest, all approved). A test now
checks that no toy on the photoreal shelf (`category: "scans"`) plays it.

Toys that lose the zipper (10): Stollen, Physalis, Monkey doll, Sunflower photo, White roses, Bonsai
photo, Mushroom photo, Golden maple (`maple-tree`), Peonies in a vase (`peony`), Money tree.

Per toy:

| Toy             | Before                         | Now                                                              |
| --------------- | ------------------------------ | ---------------------------------------------------------------- |
| Stollen         | rustle + two plucks (full)     | the two plucks at 0.35                                           |
| Orange photo    | pop + two drips                | one pop at 0.5                                                   |
| Physalis        | rustle + sparkle               | a soft papery pop and a light landing thud                       |
| Crystal         | glass (0.9 s) + sparkle        | one glass ring, 0.6 s, at 0.4                                    |
| Monkey doll     | boing + rustle                 | the boing                                                        |
| Sunflower photo | rustle + flutter               | a soft warm chord (F3+C4+F4, 0.3) and a light landing thud       |
| White roses     | glass + rustle                 | the glass ding                                                   |
| Bonsai photo    | rustle + wood                  | the wood knock                                                   |
| Mushroom photo  | pop + rustle                   | the pop                                                          |
| Crochet Earth   | boing + sparkle                | the boing                                                        |
| Golden maple    | rustle + whoosh (0.4)          | the whoosh at 0.22                                               |
| Peonies         | rustle + glass                 | the glass note                                                   |
| Money tree      | rustle + pock                  | the pock                                                         |
| Neon knot       | a recorded jelly, twice        | the torus knot's creak, bowstring thump and whoom, timed to it   |
| Popcorn         | 14 cuts of 2 pops, 120 ms each | 14 cuts of 10 clean single pops, 90 ms each, rumble and hiss out |
| Water bottle    | twists + roar + slosh          | twists + a real pour into a glass (CC0, ahamirikia)              |
| Point clouds    | whoosh 0.18, sparkle 0.12      | whoosh 0.09, sparkle 0.07                                        |

Recordings: `assets/sounds/popcorn-pops.mp3` recut from the same CC0 source (elricadavis), and the
new `assets/sounds/water-bottle-pour.mp3` (CC0, ahamirikia, "Pouring water into a glass"), both in
`tools/assets.json`, `CREDITS.md` and `src/sound-credits.js`. `knot-jelly.mp3` is deleted with its
credits (nothing plays it now; the sample test requires every file to be used).

## Notes

- Popcorn: the old cut started each kernel at one of two places in a 0.72 s file, and each 120 ms
  cut held two or three transients plus the pot's rumble; 14 of them in 0.6 s ran together into a
  hiss. The new file has ten isolated pops (picked by onset: quiet before and after), each 85 ms,
  high-passed at 140 Hz, 0.2 s apart.
- Water bottle: the stream runs from 1.6 s to about 2.9 s (`wbClock` in
  `src/packs/real-objects.js`), so the 1.6 s pour starts at 1.62 s and fades out by 3.2 s.

## Known issues

- None known yet.

## For the Operator

- The sound board on main will play the new sounds once this merges (status `ready`, round
  `2026-10-06`).
- `src/sound-credits.js` gained one entry (`water-bottle-pour.mp3`) and lost one (`knot-jelly.mp3`):
  credit lines only.
