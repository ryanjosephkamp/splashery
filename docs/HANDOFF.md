# Handoff

The current state and the next phase. The session that finishes a phase updates this file. The
ground rules are in [CLAUDE.md](../CLAUDE.md).

## Current state (2026-09-24, after Phase B)

- Phase A is done: splashery PR #13 and homepage PR #33 in
  `ryanjosephkamp/ryanjosephkamp.github.io`, both merged.
- Phase B is done in the splashery PR from branch `claude/phase-b-handoff-lwxazn`. Check that it is
  merged before starting C1.
- **Phone shelf (B).**
  - The phone sheet has three states in `src/ui.js` ("Bottom sheet"): `row` (the dock only), `grid`
    (body class `shelf-grid`: the shelf fills the sheet as a grid of about 4 columns) and `panel`
    (body class `sheet-open`: the tabs). `setMode()` switches them.
  - Dragging the handle or the shelf row up opens the grid. Tapping a card folds it back at once and
    loads the toy. Swiping down (handle, or the top of the grid), Done, Escape or a tap on the toy
    goes back to the row. More still opens the panel.
  - `SHELF_GRID = false` in `src/ui.js` switches the grid off; the handle then opens the panel as
    before. The owner may want this if the grid feels less friendly than the row.
  - Phone card labels wrap onto two lines (10.5 px, clamped). All 283 names fit; only
    "Bacteriophage" and "Mitochondrion" hyphenate. No marquee.
  - The grid's first screen loads about 55 lazy thumbnails (about 58 KB).
- "Find your own splat" is a `<details id="byo-help">` in Make → Your own splat.
- The shelf still has **283 toys**. Scene schema is v3 (v2 still loads).
- **Sharpness (A1).**
  - Device tiers low / mid / high / max replace weak / strong (`TIERS`, `PIXEL_RATIO` and
    `detectProfile()` in `src/player.js`; splat counts in `PROFILES` in `src/generators.js`).
  - Phones are mid: 140k splats, pixel ratio 2, and full scan files. Desktops are high: 200k,
    ratio 2.
  - Detail: Auto / High / Max in the Look pane (`localStorage` key `splashery.detail`, never in
    links).
  - Adaptive resolution lives in `Stage.timeFrame()` / `setBusy()` in `src/stage.js`.
  - `?profile=low|mid|high|max` (weak and strong still work). `?adapt=off` is for tools and tests.
  - Kit splats: overlap factor 1.2 and default flatness 0.2 (`src/kit.js`).
- **Embeds (A1).**
  - Transparent embeds use `color-scheme: light` on both sides. `normal` is not enough on hosts that
    declare `light dark`.
  - The toy is framed at 80% of the shorter side. `?zoom=` or the `zoom` attribute scales it.
  - The plain wheel zooms after a click. There are + and − buttons (`?controls=0` or `controls="0"`
    hides them).
  - The snippet is responsive, with a size picker in Share.
- The honeybee is upright. Shelf thumbnails retry once, then show a plain tile.
- Tools:
  - `tools/check-packs.mjs`: builds and timing, at the high tier's count by default; `--count=`
    changes it.
  - `tools/contact-sheet.mjs`: review sheet.
  - `tools/make-thumbs.mjs`: thumbnails, by pack or id. Allow about 18 s per toy under SwiftShader.
    Run one process at a time: parallel runs are slower.
  - `tools/sharpness-crops.mjs` and `tools/sharpness-pairs.mjs`: before/after crops.
  - `tools/prepare-assets.mjs`: SOG packing.
  - `tools/mesh-to-splats.mjs`: glTF to PLY.
  - `tools/fetch-flags.mjs`: flags.
- All 49 Playwright tests pass, including the dark-mode transparent embed test and the new phone
  grid and help panel tests.
- `HF_TOKEN` has still not been checked by any session. Check it (without printing it) before Phase
  D. If it is missing or rejected, tell the owner exactly what to change: the cloud environment menu
  in the session's title bar, then Edit, then an environment variable named `HF_TOKEN`.
- This helper is not in the repo. Rewrite it if needed:
  - A pack screenshot script: a Playwright page opens the app, clicks `.chip[data-category=…]` then
    `.toy-card[data-toy=…]`, waits until `#toy-status` starts with the toy's label, and takes the
    screenshot.
- In the cloud sandbox, headless Chromium cannot reach github.io. To screenshot a host page that
  embeds the live site, route `https://ryanjosephkamp.github.io/splashery/**` to the local server
  (`context.route` plus `route.fetch`).

Known issues carried forward:

- Storybook: a faint red strip on the left page when open.
- The sports car is a little small in its frame.
- The tractor's exhaust smoke is heavy.
- Flags on vehicles were never checked (windows and lights should stay unpainted).
- Splats are depth-sorted in their built pose, so large moving parts can draw out of order.
- Only 3 music toys exist.
- New in A1:
  - The tier thresholds and the 24 ms and 40 ms adaptive limits are guesses, not tuned on real
    phones.
  - Phones now build 140k-splat toys and download full scans, so they load more slowly.
  - Old transparent snippets with `color-scheme:normal` still show a white box on hosts that support
    dark mode. Re-copying the snippet fixes it.
- New in B:
  - The phone grid is tried only in headless Chromium with emulated touch, not on a real phone.
  - Swiping the handle up now opens the grid, not the panel (the older phone test was updated to
    match).
  - The help panel's app list (Scaniverse, Polycam, Luma, KIRI Engine) was checked against the app
    stores on 2026-09-24. Luma's site now leads with other products; its capture app is still
    listed.

## Phases

Each phase is one session and one PR, or a small stack of PRs. The owner reviewed every toy on
2026-09-23 (raw notes and screenshots in [reviews/2026-09-23/](reviews/2026-09-23/review.md)). The
per-toy plan that came out of it is [TOY-PLAN.md](TOY-PLAN.md), generated from `tools/toy-plan.json`
by `node tools/toy-plan.mjs`. Keep that JSON current: when a phase finishes a toy, update its entry
(for example `"v": "keep"`) and regenerate.

**On 2026-09-24 the owner approved every proposal in the plan as written**, including the
sports-ball texture fixes added that day, and all toys are marked approved on the page below. Build
them as proposed; use judgement on details.

The owner can still mark a proposal Approve, Change or Skip (with notes) on a private page:
https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 ("Splashery Toy Plan"). Before starting a phase,
check the marks for its toys for any later change: with the `ArtifactData` tool, `list` the
collection `marks` (one document per toy id: `{mark: "yes" | "change" | "skip" | "", note, at}`). If
that tool is not available, ask the owner to press "Copy my marks and notes" on the page and paste
the text. A "change" note overrides the proposal in `tools/toy-plan.json`; update the JSON to match.
If the plan JSON changes, the page can be republished from it (`node tools/toy-plan.mjs --json`).

| Phase  | What                                                                                                                                                                       | Repo(s)   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A      | Done: sharpness, Detail setting, embeds, honeybee, thumbnail retry, homepage embed.                                                                                        | both      |
| B      | Done: mobile shelf grid (drag up into a full grid like desktop), thumbnail labels that don't cut off, and a "Find your own splat" help panel.                              | splashery |
| **C1** | Visual fixes from the review (26 toys: vintage camera, boombox, storybook, comet, Statue of Liberty crown, horse brightness, cookie orientation, sports-ball textures, …). | splashery |
| C2     | Make existing effects clearer or more dramatic (33 toys the owner found subtle or underwhelming: bacteriophage, Newton's cradle, Big Ben, bus, …).                         | splashery |
| D      | Effects and sound engine: a unique sound per toy, scan rigs (moving parts for captured toys), taps that know where they landed, drag-to-stretch.                           | splashery |
| E1–E6  | New tap effects for the 181 toys marked new (most only hop today), in six waves by category (see TOY-PLAN.md), each with its own sound.                                    | splashery |
| F      | Touch and drag interaction: a solvable puzzle cube, a chess set that plays a real game, a stretchy gummy bear, a draggable Newton's cradle, bricks.                        | splashery |
| G      | AI image-to-3D trial with `HF_TOKEN`.                                                                                                                                      | splashery |
| H      | Later: the gallery, multi-toy scenes, a liquid pour, the draw-order fix, more scans, more instruments, and the final homepage embed(s).                                    | both      |

What the owner asked for across the board (2026-09-23):

- **Every toy gets its own tap effect and its own sound.** Sounds can be similar within a category
  but should differ slightly. Toys with a twin (the two rubber ducks, the two croissants, the two
  alarm clocks, the cactus and the saguaro, the grape and the grapes) must act and sound different.
- Where the effect is already good, keep it (65 toys are marked keep in TOY-PLAN.md).
- Some effects should depend on where you touch or drag (puzzle cube, gummy bear, chess, Newton's
  cradle). Say so if something is not feasible; a good fallback is fine.
- Sharpness after A1 is "basically perfect"; the homepage embed works in light and dark mode.
- Later the homepage embed will change to a favourite maths toy (the Menger sponge or the hypercube;
  the voice transcript is ambiguous, ask) at the highest detail, maybe several embeds. That needs an
  owner-set embed option such as `?detail=high` (Detail is deliberately not in share links; an embed
  the site owner chooses is a different case). See BACKLOG.md.
- Stay respectful: nothing destructive or disrespectful on the White House or the Washington
  Monument, and no fighting or gore (the Colosseum gets a chariot race, not gladiators).

## Phase C1 in detail: visual fixes

The 26 toys with a Fix line in [TOY-PLAN.md](TOY-PLAN.md) (`"fix"` in `tools/toy-plan.json`). Before
starting, check the owner's marks for these toys (see above) for any later change.

1. **Converted meshes: vintage camera, boombox, wooden elephant.** Grainy, almost reverse-contrast
   (screenshot in the review folder). All came through `tools/mesh-to-splats.mjs`. Check which
   texture it samples (base colour vs. a packed metal/roughness or AO map), sRGB handling, and splat
   size. Re-run `prepare-assets` and `make-thumbs` for any rebuilt scan. If the elephant stays weak,
   look for a better CC0 model and record its licence.
2. **Captured toys.**
   - Horse statue: too bright. Add a per-toy exposure or tone setting for captured toys, or fix it
     in preparation.
   - Cinnamon star cookie: the bottom faces the camera. Flip it in `tools/assets.json` (like the
     bee) or set its camera preset.
3. **Sports balls** (basketball, soccer ball, American football, tennis ball, baseball, softball,
   rugby ball, volleyball, cricket ball, medicine ball). Several look grainy instead of like their
   material. Tennis ball: fuzzy felt with a clean white seam. American football: pebbled pigskin
   with darker seams and crisp white laces. Likely causes: colour noise and jitter too strong for
   their size, and discs too flat or too sparse for felt. Try per-material splat size, opacity and a
   fine bump pattern in the colour function. Keep the "ball in a country's colours keeps its seams"
   test green.
4. **Dark on dark: squash ball and hockey puck.** Hard to see on the dark background; try a faint
   rim light in dark mode.
5. **Kit toys.**
   - Storybook: text is grey smudges and the cover is soft. Try readable lines from a tiny bitmap
     font (the kit also builds in Node for `check-packs`, so no canvas), smaller splats on pages,
     and a crisper cover. Also the known faint red strip on the left page.
   - Comet: overhaul (bright icy nucleus, coma, straight blue ion tail and curved dust tail). The
     meteor is closer to what the owner wants.
   - Statue of Liberty: crown rays look squashed; raise them and give them clearer spikes.
   - Decorated tree: the star is a golden cloud; make it a clear star shape.
   - Lava lamp: where the glass meets the caps. Flying disc: plastic sheen. Diya: patterned clay and
     oil sheen.
   - Carried forward: the sports car is small in its frame; the tractor's smoke is heavy.
6. **For each touched pack:** `node tools/check-packs.mjs <pack>`, a contact sheet with
   `tools/contact-sheet.mjs` (review it), and `tools/make-thumbs.mjs` for the changed toys only
   (about 18 s each). Put before/after crops in `tests/screenshots/` (the sharpness tools can help).
7. **Plan file.** When a toy's fix is done, drop or mark its `fix` in `tools/toy-plan.json` and run
   `node tools/toy-plan.mjs`.

C1 is large. If it runs long, split it into stacked PRs (`-1`, `-2`: for example converted meshes
and captured toys first, then sports balls, then kit toys) and say in HANDOFF which parts are left.

**Done when:** every Fix line is either done or explained in the PR, thumbnails are re-rendered for
changed toys, all tests pass and prettier is clean.

## Phases C–H (outline)

- **C1, visual fixes.** In detail above (26 toys with a Fix line in TOY-PLAN.md).
- **C2, clearer effects.** The toys marked "more" in TOY-PLAN.md. Several "do nothing" reports are
  pulse actions that are simply too small or too short (the bacteriophage's sheath slides 0.5 units
  for about 3 s). Rule of thumb: an effect should last at least 1.5 s, move at least ~10% of the
  toy's size or change its light clearly, and be obvious in the first half second. Windmill: faster.
- **D, effects and sound engine.**
  - Sound: today there are 12 shared synthesized sounds (`src/sound.js`) and toys pick one by name.
    Build a larger voice library (plucked strings, bells, buzz, squeak and quack formants, crunch,
    splash, drum hits, a note sequencer for tunes), let each toy declare its own sound as a small
    spec with pitch and timbre, and add a test that every toy has one and no two share the exact
    same spec. CC0 samples (for example Kenney's CC0 packs) are allowed for the few sounds synthesis
    does badly; ask the owner first (see Decisions). Embeds stay silent.
  - Scan rigs: captured toys are one splat cloud with no parts. Options: (a) region parts, where a
    few boxes or spheres per toy in `src/toys.js` sort splats into parts at load (an instance stream
    like `paintColor`), so wings, heads, legs and tails can move; (b) small kit-built add-ons (a
    lantern flame, a camera flash) drawn as a second splat entity; (c) whole-body effects (squash,
    crumble, glow) through the modifier. Most scan ideas in TOY-PLAN.md need (a) or (b).
  - Taps that know where they landed: pass the picked point to the action so a recipe can choose
    what happens (turn this layer, move this piece).
  - Drag-to-stretch: the Magnet effect already pulls splats; add a grab mode with a springy release
    (gummy bear, then others).
  - An audit tool or test listing toys without their own action or sound.
- **E1–E6, new effects.** One wave per session (about 30–45 toys each), following TOY-PLAN.md. Run
  `check-packs`, a contact sheet and `make-thumbs` for touched packs as usual. Thumbnails take about
  18 s per toy under SwiftShader; render only the toys you changed.
- **F, touch and drag interaction.** Puzzle cube: 26 cubies as parts (the part limit is 48), cube
  state in JavaScript, swipe on a face to turn a layer, plus scramble and a solved check. Chess set:
  it is a scan, so either region parts per square or a kit-built set; first a scripted famous
  public-domain game, then maybe tap-to-move. Gummy bear: drag to stretch. Newton's cradle: drag a
  ball back and let go. Bricks: build a random model each tap.
- **G, AI image-to-3D.**
  - Check `HF_TOKEN` (whoami, printing only name and role).
  - Try a public Space through its API from a tool script in `tools/`. TRELLIS outputs Gaussians
    directly; Hunyuan3D is an alternative.
  - Inputs are our own CC0 images, such as renders. Check the model and output licences.
  - Set a quality bar against the procedural toys, and only ship results that beat them.
  - The free GPU quota is limited. If anything would cost money, stop and ask the owner.
- **H, later.** The gallery (plan in ROADMAP), multi-toy scenes, a scripted liquid pour, the
  draw-order fix for moving parts, more scans, more instruments (piano, trumpet, violin, maracas,
  harp), and the final homepage embed(s) in ryanjosephkamp.github.io.

## Decisions

Settled on 2026-09-24, when the owner approved every recommendation:

- Sounds: synthesize by default; CC0 audio samples are fine for the few that synthesis does badly (a
  real quack, an alarm bell, a crowd). Record each sample in CREDITS.md.
- Pine tree: it shakes off a dusting of snow (the decorated tree keeps the lights).
- An owner-set `?detail=high` embed option for the homepage is approved for Phase H, capped by
  device tier.

Still open (ask when it comes up, in Phase H):

- The favourite maths toy for the homepage: Menger sponge or hypercube? One embed or several?
