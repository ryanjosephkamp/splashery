# Lane Photoreal r3 (prefix `pr3`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Photoreal r3 (id `PhotorealR3`, prefix
`pr3`). Your folder is a git worktree on `claude/lane-photoreal-r3`. Your port: 4181. PR title:
"Phase Photoreal r3: bases, effects, sounds and scientific captures". Handoff file:
docs/handoff/PhotorealR3.md (this file; your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's notes that afternoon)

The owner, on October 3, 2026: "The sounds for the new photoreal toys can be improved, and we can
give some of those toys better animations/effects. For example, the crochet earth could spin like
the other planets or earths do, etc. We will need to do a little audit on the bottoms of the bases
of the new photoreal toys like we did recently" and "Are there other photoreal toys we could use?
They don't have to be versions of toys we already have. Anything scientific?" Photoreal r2 (#212)
added 30 captured toys, behind labs; a tap only hops them (docs/handoff/PhotorealR2.md).

#### What to build

1. **Bases.** Turn each of the 30 Photoreal r2 toys over and render it from below at 390×844, the
   way lane Sharpness B did in docs/audits/bases-2026-10.md: close a hollow or see-through underside
   with hard-edged, kit-built rig add-ons (`src/rigs.js`), never by smearing the capture. Add a
   "Photoreal r2 toys" section to that audit with each toy's verdict, and before-and-after cards
   from below for each toy you fix.
2. **Effects.** Give each toy the best effect it can carry under the effect rules. A whole object
   can move as one solid piece (the crochet Earth spins on its axis like the other Earths and
   planets); a part you can cut out with hard edges can move on its own (a wheel, a propeller, a
   lid); or a kit-built part can be swapped in. If a toy has nothing that can move cleanly, give it
   a fitting whole-object motion (a sway, a roll, a real landing) rather than a bend, and list it in
   a table in your handoff. Check the owner's marks and notes for these toys on the Toy Plan page
   first (OPERATING.md, "A lane's start").
3. **Sounds.** A better sound for every r2 toy, matched to the object and its new effect: made in
   code in `src/toy-sounds.js` (your toys' entries), or a CC0 sample recorded in CREDITS.md. Run
   `node tools/sound-check.mjs` on them.
4. **Framing.** The sushi boat, the cherry blossom trees and the murex shell frame small, and the
   elephant faces away at the default camera (PhotorealR2.md, "Known issues").
5. **New photoreal toys, scientific first.** Up to 10 new captures or photogrammetry models from
   open collections: Smithsonian Open Access 3D (CC0), NASA 3D Resources, museums' open-access 3D,
   Sketchfab models under CC0 or CC BY. Fossils, meteorites, minerals and crystals, shells, animal
   skeletons, historical scientific instruments. If docs/audits/new-sources-2026-10.md (the owner's
   Dot is researching sources) has landed on main, start from it. Size them like Photoreal r2
   (`tools/pr2-prepare.mjs`, or your own `tools/pr3-*.mjs`). Each one gets an effect, a sound, a
   how-to line and About text, a credit and `labs: true`. Nothing from people (no human bones or
   skulls).
6. **Any pose.** Every effect also works with the toy on its side or upside down. Lane Any pose
   fixes the engine side; test your toys in three poses.

#### The owner's review of October 3, 2026 (evening): do these first

His words are in docs/reviews/2026-10-03-labs-review/review.md. They come before items 1 to 5 above
and replace the general wording there where they are more specific.

**Sounds.** His rule for all of them: if a toy just bounces, give it a subtle bounce sound; no wind,
stretching, twinkle or clicking layers, and nothing loud or overwhelming.

| Toy                                         | Sound                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Heart donut, souvenir turtle                | Fine as they are.                                                                  |
| Knight on a horse                           | "Basically perfect": keep it.                                                      |
| Sushi boat                                  | Keep the first sound; remove the second little beat.                               |
| Seated bread loaf                           | It sounds like a zipper: something very subtle instead.                            |
| Cowboy steak                                | Not the right sound; something fitting and not overwhelming.                       |
| Stollen                                     | Replace it completely: realistic and quiet.                                        |
| Orange                                      | Too loud and the wrong sound: pick a different one.                                |
| Physalis                                    | Subtler and different; no twinkle, no stretching.                                  |
| Crystal                                     | Far too loud; a new, gentle sound.                                                 |
| Alum crystal                                | Better, but remove the ding.                                                       |
| Puffin                                      | Use a real puffin's call (a CC0 or CC BY recording, credited).                     |
| Toy T-Rex, souvenir elephant                | They sound like wind: a subtle bounce sound instead.                               |
| Monkey doll                                 | Keep the first sound; remove the clicking; a little bounce.                        |
| Cave lioness                                | Wind and far too loud: replace it, and a better animation if one can move cleanly. |
| Dog plush                                   | Sounds like a rubber band: replace it.                                             |
| BMX bicycle                                 | Remove the bell; a softer opening sound.                                           |
| Murex shell                                 | Remove the clicking; keep the ding, more subtle.                                   |
| Sunflower, golden maple, money tree, bonsai | Remove the stretching and the wind.                                                |
| White roses, mushroom                       | No stretching or clicking; a subtler ding is fine.                                 |
| Cactus photo 2                              | No clicking; softer notes, like the first cactus.                                  |
| Crochet Earth                               | No twinkle; the bounce should match the sound it makes when picked up and dropped. |
| Desk globe                                  | Spin it, with no wind or suction sound.                                            |
| Cherry blossom                              | The bounce is fine; no twinkle.                                                    |
| Peonies in a vase                           | No stretching or wind; the vase's sound softer.                                    |

**Bases**, from below (item 1 above), his verdicts:

- **Fine:** heart donut, seated bread loaf, souvenir turtle, murex shell, and the cave lioness's
  underside.
- **Fix:**
  - the sushi boat (its bottom looks painted in, cartoonish);
  - the cowboy steak ("terrible");
  - the stollen (still see-through, though not badly);
  - the orange (a hole through the middle where the core is);
  - the physalis (a little see-through);
  - the crystal, the alum crystal, the puffin, the toy T-Rex, the monkey doll and the souvenir
    elephant;
  - the dog plush (hollow from below);
  - the BMX bicycle;
  - the sunflower, the white roses' vase and the bonsai's base (see-through);
  - the mushroom, cactus photo 2, crochet Earth and desk globe;
  - the cherry blossom ("kind of close");
  - the golden maple, peonies in a vase, money tree and knight on a horse.
- **Also:** the cave lioness where the scan cuts off at the neck.

**Also from his review:**

- The **dog plush** looks broken (gaps in it): patch it with kit-built pieces, never by smearing.
- ~~The **real alarm clock** shows the current time.~~ Done by lane Fix8 (#273, merged October 5,
  2026): its kit-built hands show this device's local time.

#### You own

`src/packs/photoreal-r2.js` and a new `src/packs/photoreal-r3.js`, your toys' rig add-ons in
`src/rigs.js`, `tools/pr3-*.mjs`, `assets/toys/<your new toys>/`, `tests/pr3*.spec.mjs`, your toys'
entries in the shared lists, the "Photoreal r2 toys" section of docs/audits/bases-2026-10.md, and
this file.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4181), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "### Brief, October 8, 2026 (cloud)

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photoreal r3 (prefix `pr3`). Branch: `claude/lane-photoreal-r3`
(engine changes on `claude/lane-photoreal-r3-engine`, as a small additive "Engine: …" PR merged
first). PR title: "Phase Photoreal r3: bases, effects, sounds and scientific captures". Handoff
file: docs/handoff/PhotorealR3.md. Model: Opus 5.5, at high effort (CLAUDE.md).

Your full brief is already in docs/handoff/PhotorealR3.md (written October 3, 2026, for a local lane
on the owner's Mac). The owner started it in the cloud instead on October 8, 2026: you run here, not
on his Mac, so ignore the parts about his Mac, his second account and port 4181 (use
`python3 -m http.server 4173 --bind 127.0.0.1` as CLAUDE.md says). Everything else in it stands, in
its order: close the Photoreal r2 toys' bases, give them real effects and better sounds, fix their
framing, then up to 10 new photoreal toys, scientific first, under CLAUDE.md's license rules (never
ND; NC per asset with `"nc": true`). CLAUDE.md's "Shelves" rule applies: no new animals unless a
photoreal capture, nothing human without the owner's yes. Main has moved a lot since October 3 (read
docs/HANDOFF.md "Now" and the Photoreal r2 files on main first). Update the handoff's "## State",
"## Notes", "## Known issues" and "## For the Operator" as you go; leave its brief as it is and add
this one under it as "### Brief, October 8, 2026 (cloud)".

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). New toys and views go behind the labs switch
(`labs: true`); the Operator merges labs work after the tests pass (with tools/op-merge.mjs) and
after the owner marks your cards; changes to toys the public already sees wait for his "good" marks.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Clips at phone size
(390x844, device scale 3) go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). New sounds go in tools/sound-review.json as "ready" (the owner hears them on the
Sound Board), not as cards. Before READY, re-read CLAUDE.md's "Effect quality rules" and check each
clip against them at phone size. About six workers run at once; keep an even pace. Your Operator is
session_012GmKRUMZLir2nb27Bo8Cu2. Card ids pr3-…. Aim for a first READY with the bases and their
clips within about six hours.

## State

WORKING (October 8, 2026, cloud session, Opus 5.5 at high effort): item 1, the bases. Every r2 toy
rendered from below at 390×844 (`tools/pr3-shot.mjs`); fixes next.

What main already did for these toys since October 3 (so this lane does not redo it):

- Sound D (October 6) rewrote 13 of the sounds in the owner's table (stollen, orange, physalis,
  crystal, monkey doll, sunflower, white roses, bonsai, mushroom, crochet Earth, golden maple,
  peonies, money tree); the owner marked all of them good on October 7.
- Fix9 (October 7) cropped the orange's floaters and filled the dog plush's gaps with a hidden
  kit-built core (its `dog-plush` rig); both marked good.

## Notes

## Known issues

## For the Operator
