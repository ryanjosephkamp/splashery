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

### Brief, October 8, 2026 (cloud)

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

READY (October 8, 2026, about 22:00 UTC; cloud session, Opus 5.5 at high effort). PR #419 (draft).
Effect review page 2, lane record `PhotorealR3`: 19 "Closed bases" cards, 28 effect cards and 10
new-toy cards. Every clip was watched at phone size against CLAUDE.md's effect quality rules.

- Item 1, bases: done. 19 of the 30 r2 toys are visibly closed (cards `pr3-base-…`). Five more got a
  core inside that makes no visible change at phone size (no card); the crystal and the lioness's
  neck are not closed (see "Known issues"); the other five were fine. The "Photoreal r2 toys"
  section of docs/audits/bases-2026-10.md has every verdict.
- Item 2, effects: every r2 toy but the dog plush (its hop is Fix9's, approved) has a new effect
  (table in "Notes"; cards `pr3-fx-…`). Watching the first clips led to these fixes: the BMX leans
  on its kickstand instead of rolling (wheels cut by color left faint ghosts), the heart donut
  twirls instead of flipping (its underside was never captured), the orange rolls less far, the
  physalis sways as one plant (its lanterns would not cut cleanly), the alum crystal's cut sits
  higher, and the sunflower nod and turtle crawl are clearer.
- Item 3, sounds: the 14 the owner's table names that Sound D had not done are changed, checked with
  `node tools/sound-check.mjs`, and marked "ready" in tools/sound-review.json.
- Item 4, framing: home views for the sushi boat, cherry blossom and murex shell (closer), the
  elephant (it faces you) and the cave lioness (whole in frame).
- Item 5, new toys: ten scientific toys (labs), with credits, help, sounds, plan entries and
  thumbnails (cards `pr3-new-…`): a Triceratops skull and a cone shell (real splat captures), and
  eight museum scans baked by `tools/pr3-bake.mjs` (a celestial globe whose ball turns, an armillary
  sphere whose inner rings turn, five Stannern meteorite stones that fall one by one, fluorite under
  an ultraviolet lamp, an ammonite, the Morasko iron, pyrite and a megalodon tooth).

What main already did for these toys since October 3 (so this lane does not redo it):

- Sound D (October 6) rewrote 13 of the sounds in the owner's table (stollen, orange, physalis,
  crystal, monkey doll, sunflower, white roses, bonsai, mushroom, crochet Earth, golden maple,
  peonies, money tree); the owner marked all of them good on October 7. They stay as they are.
- Fix9 (October 7) cropped the orange's floaters and filled the dog plush's gaps with a hidden
  kit-built core (its `dog-plush` rig); both marked good. This lane adds only the mat's underside to
  that rig.

## Notes

- Code: `src/packs/photoreal-r3-rigs.js` holds every r2 toy's rig (spread into `RIGS` at the end of
  `src/rigs.js`; the dog plush's rig stays in `src/rigs.js` and calls `dogMat`). Outlines come from
  `src/packs/photoreal-r3-bases.js`, generated by `node tools/pr3-under.mjs --all` from
  `tools/pr3-bases.json`.
- Tools: `tools/pr3-shot.mjs` (phone stills: home, below, side, back, top, east),
  `tools/pr3-measure.mjs` (a toy's splats in world coordinates, from its SOG converted to PLY with
  `npx splat-transform`), `tools/pr3-under.mjs` (an underside's outline, plane, rectangle and top
  colors), `tools/pr3-clip.mjs` (phone-size MP4 clips).
- Picking a part by color in a hard rig: a splat whose color only partly matches an "over" region is
  still won by it, then rounded to "unmoved", so it stays behind (the BMX's ghost wheels). A part
  cut by color should not move far.
- A still from below must wait for the sort: render a few frames after moving the camera, or the
  splats are still sorted for the old view and the toy shows through any floor.
- `kit.cloud({ count })` is scaled by the kit's budget over 160,000; use `share` for an exact number
  of splats in a rig add-on.
- Closing a base: a two-layer kit floor (`floor()`), and a flat region that hides the capture's
  smear under it (`below()`: a wide, flat slab plus a deep one, so the slab's top stays within a
  hair of the floor across it). Materials are procedural (earth, gravel, planks, sawn log rings,
  woven linen, glaze, glass, stone, pewter, orange peel); the steak's underside takes the colors of
  its own top at each point (`MATERIALS.mirror`, from `tools/pr3-under.mjs --top`).
- Effects (all rigid; nothing bends a capture):

  | Toy                         | Tap                                                                                                                      |
  | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | Heart donut                 | Tossed: twirls round once and lands (its underside was never captured).                                                  |
  | Sushi boat                  | Rocks side to side, as on water.                                                                                         |
  | Seeded loaf, stollen        | Lifted and dropped; lands and rocks to rest.                                                                             |
  | Cowboy steak                | Flipped over onto its (new) seared underside and back.                                                                   |
  | Orange                      | Rolls along the table and back, turning as far as it travels.                                                            |
  | Physalis                    | The stem sways from its foot (a lantern cut by color did not tag cleanly).                                               |
  | Crystal, murex shell        | Turns once round.                                                                                                        |
  | Alum crystal                | The crystal lifts off its block, turns a quarter turn and sets back down.                                                |
  | Puffin                      | Hops round to look at you and back.                                                                                      |
  | Toy T. rex, monkey doll     | The figure rocks round on its base (cut from its disc or cloth, hard-edged).                                             |
  | Souvenir elephant           | Turns to look at you with two heavy steps.                                                                               |
  | Souvenir turtle             | Crawls a little way forward, swaying, and back.                                                                          |
  | Cave lioness                | Looks one way, then the other.                                                                                           |
  | Dog plush                   | The hop (lane Fix9's, approved).                                                                                         |
  | BMX bicycle                 | Nudged, it leans over on its kickstand and rocks back up (rolling on turning wheels left faint ghost wheels: see Notes). |
  | Sunflower                   | Nods and settles.                                                                                                        |
  | White roses, peonies, money | The vase or pot tips onto its rim, rolls round on it and settles (the tin can's wobble).                                 |
  | Crochet Earth               | Spins round twice.                                                                                                       |
  | Desk globe                  | The ball spins in its stand (the ring and stand stay), slowing.                                                          |
  | Mushroom, cactus, maple,    | Lifted a little and set down with a bump (a patch of ground has nothing that can move                                    |
  | bonsai, cherry blossom      | cleanly on its own).                                                                                                     |
  | Knight on a horse           | The figure rocks back on its base as the horse rears.                                                                    |

## Known issues

- The crystal's base is not closed: clear quartz is see-through by nature, and a kit-built base
  inside it would show through as a blob.
- The cave lioness's neck, where the capture ends, is not closed: the cut is not a clean plane in
  the capture, and a flat cap looked pasted on.
- The puffin's real call (a CC0 or CC BY recording) is still to come; soft landings for now.
- The BMX bicycle's frame and handlebar pad show decal lettering that looks like a brand name (from
  Photoreal r2): see "For the Operator".
- The Triceratops skull's museum mounting rod is mostly hidden; a short stub stays under the jaw (it
  can't be told from the jaw's dark shadows by position or color).
- The cone shell's far side was captured poorly (a white smear), so it rocks one way and the other
  rather than turning all the way round.
- The celestial globe's painted sky is soft: the museum scan's texture is low-resolution.
- Four toys' cores (stollen, puffin, elephant, sunflower) change nothing visible at phone size; they
  stay, as they cost little and fill the thin places at other angles.

## For the Operator

- The BMX bicycle (Photoreal r2, labs) shows decal lettering on its frame and handlebar pad that
  looks like a brand name. CLAUDE.md says no logos or brand names; painting it out (a kit-built
  cover in the frame's chrome) is easy if you want it. Not done yet.
