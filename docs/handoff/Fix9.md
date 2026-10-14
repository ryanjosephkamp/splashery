# Fix9: the walkthrough's toy fixes

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Fix9 (id `Fix9`, prefix `fx9`). Branch:
`claude/lane-fix9` (and `claude/lane-fix9-engine` for any change to the app outside your own files,
as an "Engine: …" PR merged first). PR title: "Phase Fix9: the walkthrough's toy fixes". Handoff
file: docs/handoff/Fix9.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State

- Started October 7, 2026 (about 00:00 UTC). None of the named packs (food, real-objects,
  data-climate, fluid-lab, photoreal-r2, tiny-r2) belongs to a lane running now: their lanes are
  merged and idle.
- Engine PR #368 ("Engine: a recipe's tap box takes a tap anywhere in it", branch
  `claude/lane-fix9-engine`) is open, and merged into this branch. It must merge first.
- Lane PR #370 ("Phase Fix9: the walkthrough's toy fixes") is open as a draft.
- Done:
  - **Cherries:** a small Newton's cradle at real speed, worked out once with the physics engine
    (`src/physics/world.js`).
  - **Soda can:** the suds spill over the rim and run down, then shrink away.
  - **Data in 3D:** a tap box over the plot.
  - **Fluid lab:** a slow-phone warning.
  - **Orange (photo):** a sphere crop of its floaters.
  - **Dog plush:** a hidden kit-built core fills the gaps.
  - **Cell division, apoptosis and phagocytosis:** sharper.
- Effect review page 2 (lane record `Fix9`) has nine cards, each before (left) and after (right):
  `fx9-cherries`, `fx9-soda-can`, `fx9-data-in-3d`, `fx9-fluid-lab`, `fx9-orange-photo`,
  `fx9-dog-plush`, `fx9-mitosis`, `fx9-apoptosis` and `fx9-phagocytosis`.
- First READY on October 7, 2026, about 01:50 UTC.
- The owner's marks (02:48 UTC): eight cards are "good". `fx9-dog-plush` was "fix": "Looks better,
  but still needs a bit more work." Round 2 (`fx9-dog-plush-r2`, posted at about 03:40 UTC) made
  three changes:
  - It removed the capture's silvery fringe in the crease (about 1,400 splats, through
    `.cache/fx9/dog-clean.ply` and the entry's new `"local"` field in `tools/pr2-prepare.mjs`).
  - It widened the core by one cell under the low rims of the paws and chin.
  - It colored the core a warm shadow brown toward the mat.
- Main was merged in at 02:50 UTC and again at 04:15 UTC (both clean; the engine branch too).
- 04:13 UTC: the owner marked `fx9-dog-plush-r2` "good". **All nine cards are good.** The lane waits
  for the Integrators' full run and the Operator's merges (#368 first, then #370).
- 15:46 UTC, the Operator: Integrator 1's full run N28 passed 1478 of 1484. The one failure that was
  #370's: `tests/unit.spec.mjs:213` (every rig needs an action and its control). The `dog-plush` rig
  now has them: a "Hop" pulse that copies the hop every capture without a rig has (src/motion.js,
  `hopAt`), so its tap is unchanged. Main (f1994db9) is merged into both branches. Unit, fx9,
  fx9-engine, kit and taps' whole-shelf checks pass. `taps -g dog-plush` matches no test: taps
  covers kit packs, and the dog plush is a capture.

## Notes

- **Cherries:** a cherry is about 2.2 cm across (0.37 units), so a unit is 3 cm. Each stem (1.5
  units, 4.5 cm) swings with a pendulum's period, 2π√(L/g), about 0.43 s. One shared pivot with
  plain gravity doesn't make a cradle: the two press together and swing as one. So each cherry is
  pulled back toward its own rest angle with g·sin of its swing (the stiff stem), through the
  World's `force` hook. The spheres collide with restitution 0.92. Hands-on is unchanged.
- **Soda can:** the suds are kit splats of the "fade" kind on morph channel 1, so a sharp flow front
  reveals them. Their part shrinks them away at the end (part visibility scales splat size, not
  opacity, so they stay opaque). The effect is now 4.0 s long instead of 3.5 s.
- **Data in 3D:** taps go through the pick buffer, which only finds splats. The engine PR adds
  `Player.tapBoxAt`, which `App.tapToy` uses when the pick misses. `src/datavis/plot.js` sets
  `k.data.tapBox`: the chart's box, padded by 0.25 for the axis labels.
- **Fluid lab:** on a phone (`isPhone()`), the recipe times its frames from 0.25 s to 1.25 s after
  it is built. If the median frame takes more than 50 ms, a box styled like the link box offers:
  - Lighter: the player's lowest tier, rebuilt in the same view. Detail has no "Low" choice, so this
    only lasts for the visit.
  - Leave the lab: the first toy.
  - Keep going: no more warnings this visit.

  `?slow=1` plays a phone at 8 frames a second, for tests.

- **Orange (photo):** the source is a single LOD of 82,539 splats, all of them already used. The
  grain was a haze of faint, large floaters round its edge and a smear under it. A new `"sphere"`
  field in `tools/assets.json` (supported by `tools/pr2-prepare.mjs`) crops them when the toy is
  prepared. The camera fits the toy itself, so it frames the same orange.
- **Dog plush:** the gaps come from the capture, not from our cut:
  - Our file has every one of the source's 478,072 splats (no decimation, and nothing cut by the
    crop box).
  - The camera never saw the mat under the plush, or the plush's underside.

  `tools/fx9-dog-fill.mjs` finds the grid cells where the plush stands over no captured mat and
  writes `src/packs/dog-plush-fill.js`. The new `dog-plush` rig's add-on fills those cells from the
  mat up to the plush's lowest fur, in that fur's color, darkened toward the mat. The source's frame
  maps to the toy's world as x → 0.28591x + 0.0093, y → -0.28591y - 0.30194 and z → -0.28591z -
  0.06063, fitted against the loaded toy's centers.

- **Tiny world:**
  - All three: `kernel: "sharp"` and `render: { cull: "low", dpr: "native" }` (labs only, like these
    toys).
  - Cell division: a membrane clear face on and solid at its edge (the rim kind), and a fainter
    nuclear envelope.
  - Apoptosis: a fainter membrane.
  - Phagocytosis: a fainter membrane, and fewer, solid granules.
- `tools/effect-clip.mjs` taps by calling `player.act` directly, which skips the pick. So the Data
  in 3D card was recorded in the real app (Playwright's `recordVideo`), with a real click in the
  empty box.
- `tools/effect-clip.mjs` doesn't turn labs on. To see labs-only render settings in a clip, use
  `SPLASHERY_URL="http://127.0.0.1:4173/?labs=1&renderer=webgl2&x="`.

## Known issues

- At the end of the soda can's effect, the suds shrink away over about 0.45 s. For those frames they
  look like foam popping.
- Seen from below, the dog plush's mat is still see-through (the capture). Nobody asked about that.
- During phagocytosis, the stretched membrane shows a fine line pattern while it wraps the bacterium
  (as before).

## For the Operator

- Every card is marked good. Merge #368 (Engine) first, then #370, after the full run.
