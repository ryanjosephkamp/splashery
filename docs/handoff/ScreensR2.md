# Lane Screens r2: sharp sets and a real off switch

Prefix `scr2`. Branch `claude/lane-screens-r2`, PR "Phase Screens r2: sharp sets and a real off
switch". Engine PR on `claude/lane-screens-r2-engine`. How lanes work:
[OPERATING.md](../OPERATING.md). The first Screens lane: [Screens.md](Screens.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Screens r2, "Sharp sets and a real off switch" (prefix `scr2`).
Branch: claude/lane-screens-r2. PR title: "Phase Screens r2: sharp sets and a real off switch".
Handoff file: docs/handoff/ScreensR2.md.

### Brief (written by the Operator on September 29, 2026, from the owner's review of that day)

The Screen (`screen`, src/packs/screens.js, labs only) plays your own video or GIF on an old TV, a
flat TV, a cinema screen or a hologram. Lane Screens built it (#72; read docs/handoff/Screens.md).
The owner reviewed it on September 29, 2026 (docs/reviews/2026-09-29-new-toys/review.md). He said it
is "very close to perfect". His notes, word for word:

> - This is very close to perfect. Good job!
> - The old TV, flat TV, and cinema should all be less grainy; the actual videos and GIFs are
>   perfect resolution, but the splat toys that we've constructed around them need better
>   resolution. You could also try to make the hologram base less grainy or something, but it's
>   already pretty sharp.
> - I noticed something that might be an inherent limitation of Gaussian splats, but even if so, I'd
>   like to see if we can improve it enough to no longer be noticeable. I've attached some
>   screenshots of this, and the effect is happening for both videos and GIFs on all three of the
>   first styles for this toy (old TV, flat TV, and cinema). If you look closely at these
>   screenshots, you'll notice that you can actually see the GIF horse and the video frames when the
>   screens are off and when the cinema curtains are closed. For the video, only the current still
>   frame is present, but the GIF continues to move/play, so if you zoom in enough, you can actually
>   see the moving horse.
> - Oh, can we see if there's a way to allow the user to turn the screens off? Like if they click a
>   certain button or somewhere then the TV turns off, or if they click the curtains in the cinema
>   then the curtains close?

His screenshots (1440×900, at the desktop): the flat TV switched off with the GIF, and again with
the video at 0:00; the old TV switched off with the video, and again with the GIF; the cinema with
its curtains closed and the GIF. In each, faint streaks of the picture show through the dark glass
or the red curtains.

Build, in this order:

1. **Nothing of the picture while it's off.** The cause is in the recipe, not in splats as such:
   drive() always sets `out.sheets = { screen: { page: 0, visible: 1 } }`, and the "off" look is a
   separate layer drawn over the picture at opacity 0.99 (the flat TV's glossy panel, the old TV's
   glass, the closed curtains). The picture's splats still draw underneath and leak through the gaps
   and the soft edges. Hide the picture itself while off or closed (its sheet's visibility follows
   the switch-on, so it's 0 when off and when the curtains are closed), keep the off-look layers
   solid, and let the switch-on effects reveal the picture as they do now. A GIF must not keep
   advancing behind a switched-off screen, and a video pauses when you switch off (and remembers
   where it was). If this needs a change in the picture engine (for example, a way to pause a GIF),
   make it a small additive "Engine: …" PR on claude/lane-screens-r2-engine, merged first (as #74,
   #93 and #99 did). Check it zoomed in close at 1440×900 as well as at phone size: not a pixel of
   the picture shows when off.
2. **A real off switch.** Taps know where they land (`action.at(point, c)`, PACKS.md "Action").
   Today a tap switches the set on, then only plays or pauses, so it can never be switched off. Make
   it:
   - Old TV: tap the power knob (the `power` part; it turns with a click) to switch off or on. The
     picture shrinks to a bright dot and fades, as old sets did.
   - Flat TV: tap the power button by the red light (the light goes red when off, white or off when
     on) to switch off or on. The panel fades to glossy black.
   - Cinema: tap the curtains to close or open them. They close over the screen, and the picture
     pauses behind them.
   - Hologram: tap the base's button to switch off or on.
   - A tap on the picture itself, while on, plays or pauses, as now. A tap anywhere while off
     switches it on, as now.
   - The Toy tab gets a clear On/Off (or Open/Close curtains) button beside the play control, and
     the how-to line says where to tap.
3. **Sharp sets.** The old TV's wooden cabinet, knobs, speaker grille and legs; the flat TV's bezel,
   neck and base; the cinema's curtains (velvet pleats with real folds), gold trim, stage and seats;
   and a little on the hologram's base. Use Fidelity A's method (docs/handoff/history.md and
   PACKS.md "Effect quality"): even placement, full opacity, full density at each tier, flat splats
   on flat faces and thin ones along the edges, and clean colors with low noise. Wood should look
   like wood and velvet like velvet. The picture itself stays as it is ("perfect resolution"). Stay
   within the tier budgets and say what you measured.

Sounds: the old TV's off (a click and the fading whine), the flat TV's soft off tone, and the
curtains' swish closing. Add them in src/toy-sounds.js (your toy's entry). Update the how-to line
and About text in src/toy-help.js, the toy-plan entry, and the thumbnail if the look changes.

Clips and cards (390×844, each labeled "built by Opus 5.5", in the lane record `ScreensR2` on the
Effect review page, which the Operator made):

- `scr2-off`: each of the three styles switching off with the GIF sample playing, then held close
  for two seconds. Nothing of the horse shows.
- `scr2-power`: tapping the old TV's knob and the flat TV's button, off and on.
- `scr2-curtains`: tapping the cinema curtains closed and open.
- `scr2-sets`: a slow turn of each style, before and after.
- `scr2-stills`: a sharp still of each style, on.

Tests in tests/scr2.spec.mjs:

- With the set off (and with the curtains closed), the screen area's pixels are the same whichever
  sample is loaded. Compare the GIF and the video samples.
- A GIF's frame doesn't advance while off.
- A tap on the power part switches off, and a tap on the picture plays or pauses.
- Each style builds within its tier budget.
- Screenshots at 390×844 and 1440×900.

### You own

- `src/packs/screens.js`, `assets/toys/screen/`, the `screen` entries in the shared lists,
  `tests/scr2.spec.mjs`, your `scr2-*` screenshots and `docs/handoff/ScreensR2.md`.
- The Screens lane's `tests/scr.spec.mjs` is finished work. If your change breaks one of its checks
  on purpose (for example, the tap now switches off), don't edit it: tell the Operator which test
  and why.
- The Gaussian splatting toys in `src/packs/splatting.js` aren't part of this.

Lanes Worlds, the toy piano, Anatomy, Pianos, Sharpness, Books, Chemistry, Real objects, Photo to
3D, Machines A, Lab and the two Integrators run at the same time; leave their files alone. Books is
changing the other toys on the Pictures and pages shelf (src/packs/pictures.js). The Operator is
changing the web-address box in src/ui.js so it names only what each toy opens. The laptop is
locked.

### How this lane runs

(The Operator's standing rules for every lane, as given in the brief: the Operator runs the lanes
and the owner talks only to the Operator; Opus 5.5 only, at the default effort, one helper at most;
the merge tiers, and workers never merge; American English in new public text; read CLAUDE.md,
OPERATING.md, PACKS.md, WORKSTREAMS.md and history.md first; keep this file's sections current, the
model at the top of "State"; edit only this toy's entries in the shared lists and regenerate
TOY-PLAN.md; never edit tests/taps.spec.mjs; CC0, CC BY or public domain assets only; post clips and
cards to the Effect review page without republishing it or writing verdicts; push about hourly and
merge main before each push; follow "Before every push"; one draft PR with the five sections; check
the owner's marks about hourly and fix every "fix" as a "-r2" card; end every turn with "READY:",
"WORKING:" or "BLOCKED:".)

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

September 29, 2026: started. Engine PR #109 "Engine: hold a GIF on its frame" on
`claude/lane-screens-r2-engine` (`pics.hold(on)` and `pics.held`, with
`tests/scr2-engine.spec.mjs`); its full test run passed 403 of 406, and the three that failed
(timing checks, run while clips rendered on the same machine) passed on their own. Lane PR #111
(draft). Built: the off state, the switches, the sharp sets, sounds, help and plan. Clips recorded:
`scr2-power`, `scr2-off`, `scr2-curtains`. Still to do: `scr2-sets`, `scr2-stills`, the full test
run on the lane, thumbnail, contact sheet, screenshots, cards.

## Design

- **Off means off.** The set's state (on or off, since when) lives in the recipe (`SCR`), timed on
  the player's clock. `drive()` sets `out.sheets.screen = { page: 0, visible, ahead: 1 }`: the
  picture shows only while the set is on or switching (the old TV once its glass starts clearing,
  the flat TV while its panel fades, the cinema while the curtains are not fully closed). `ahead: 1`
  keeps the hidden sheet built, so it is there the moment the set comes on. The off-look layers (the
  old TV's glass, the flat TV's panel) are fully opaque now (they were 0.99).
- **A GIF stops, a video pauses.** The engine PR adds `pics.hold(on)`: the GIF's clock stops while
  held and goes on from the same frame. The Screen holds its GIF while off (or paused by a tap on
  the picture). A video pauses when switched off and plays on from there when switched back on
  (unless it was paused before).
- **The switch.** `action.at(point)` returns `{ key: "power", pick: 1 }` on the style's switch and
  `pick: 2` anywhere else; `drive()` reads `info.tap`. While off, any tap switches on. While on, the
  switch (or the Toy tab's button, which has no point) switches off and anywhere else plays and
  pauses. The Toy tab's button reads "Switch on or off" ("Open or close the curtains" for the
  cinema: `action.label` is a getter on the style).
  - Old TV: the power knob (within 0.18 of its center). Off: the knob turns back with a click, the
    picture (on a part now) shrinks to its middle while a white layer on the same part fades in
    (channel 2), leaving a bright dot (its own part, shrinking away), then the glass closes back
    over from the top and the bottom (channel 0 falling).
  - Flat TV: a small power button (with the power mark) beside the red standby light, in a deeper
    chin; the panel fades back to glossy black and the light comes back red.
  - Cinema: the curtains (any pleat, where it is, and the valance). They close over the screen; the
    picture hides once they meet.
  - Hologram: the projector's base; a small button on its rim glows cyan while on and red while off.
    The picture sinks into the beam (its part now pivots at its lower edge) and the beam falls back
    into the lens.
- **Sharp sets.** The kit spreads even points over the unit square, so a long thin surface gets them
  far apart one way and crowded the other: diagonal hatching on the pleats, the valance, thin rims
  and the rounded edges of a rounded box (one shape for all its faces and edges). `strip()` cuts a
  surface's long side into near-square tiles, each with its own square of the even points;
  `softBox()` builds a rounded box as 26 such pieces (its edges at twice the density, so thinner
  splats, and its faces' splats thinner near their borders); `band()` is a rim round a rounded
  rectangle; `thinEdges()` shrinks splats near a surface's border so its edge is crisp. Colors are
  functions with no per-splat noise: walnut with long soft stripes and a lacquer sheen, velvet (deep
  where it faces you, a pale sheen where the pile turns away), brass, gold, satin black. The old
  TV's bezel now slopes from the wood up to the glass (it floated in front before, so the dark tube
  showed round it from the side). Density 2 (was 0.8).

## Notes

## Known issues

## For the Operator

- **`tests/scr.spec.mjs` (lane Screens' finished tests) fails twice, because the Screen now starts
  with its picture hidden:** "the Screen switches on with a tap…" (line 107) and "lane Screens
  screenshots…" (line 146). Its `openToy()` waits for `pictures.splats() > 0`, and `splats()`
  counts only sheets on show, so it waits forever while the set is off. Line 126 also expects
  `splats() > 5000` right after the style changes to the cinema (which starts with the curtains
  closed). A fix that keeps what the tests mean: in `openToy()`, wait for
  `p.splats() > 0 || p.api.ready("screen")`, and at line 126 wait for `p.api.ready("screen")`
  instead of counting splats. The rest of that test (tap on, pause, play) passes as it is: the Toy
  tab's button now switches off, which pauses the video, and on again, which plays it.
- Engine PR #109 must be merged before #111. Its test now uses the Picture lab: the Screen holds and
  lets go of its GIF by itself every frame, so a test can't drive `hold` through it.
- New tool (not in this lane's files): `tools/scr2-clip.mjs`, this lane's clips.
- PACKS.md lesson (section 7c): the kit spreads even points over the unit square, so a long thin
  surface (a curtain pleat, a thin rim, a rounded box's edges as one shape) gets them far apart one
  way and crowded the other, which shows as diagonal hatching. Cut the long side into near-square
  tiles, each with its own square of the points (`strip()` in `src/packs/screens.js`), and build a
  rounded box as its 26 pieces (`softBox()`).
