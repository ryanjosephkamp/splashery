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
- The **real alarm clock** on the Photoreal shelf doesn't show the current time, while the kit alarm
  clock does: make it show the current time the same way.

#### You own

`src/packs/photoreal-r2.js` and a new `src/packs/photoreal-r3.js`, your toys' rig add-ons in
`src/rigs.js`, `tools/pr3-*.mjs`, `assets/toys/<your new toys>/`, `tests/pr3*.spec.mjs`, your toys'
entries in the shared lists, the "Photoreal r2 toys" section of docs/audits/bases-2026-10.md, and
this file.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4181), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-PhotorealR3`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-photoreal-r3-engine`, merged first; toys not using it behave
  exactly as before.
- Every new toy is behind the labs switch (`labs: true`). Old `#s=` links and saved scenes keep
  loading.
- Every effect follows the effect quality rules in CLAUDE.md (real motion of solid pieces, separate
  things moving separately, break-apart into real pieces that come back), judged as phone-size
  clips, and works with the toy upright, on its side and upside down.
- Licenses, for every asset and dataset (CLAUDE.md, "Ground rules"): read the license on the live
  source page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's
  in-app credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A license
  not on that list (ODbL, CERN-OHL, government terms, "free with attribution") is a question for the
  Operator in "State", not a file in the repo. Nothing human (people, faces, human anatomy or human
  scans) without the owner's yes. No logos or brand names.
- A static site: data becomes splats at build time (your `tools/pr3-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Photoreal r3: …", five sections
  from CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and run long
  jobs (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/PACKS.md; docs/handoff/PhotorealR2.md, docs/handoff/Photoreal.md and docs/handoff/SharpB.md;
  docs/audits/bases-2026-10.md; docs/research/PHOTOREAL.md.
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: not started yet (October 3, 2026).
