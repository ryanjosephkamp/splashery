# Lane Fix5: the balloon dog's flag colors, the real alarm clock, and small fixes

Prefix `fx5`. Owns, for these fixes only: the balloon dog's recipe (`balloon-dog` in
`src/packs/playthings.js`), the scanned alarm clock's rig (`alarm-clock` in `src/rigs.js`), the
Klein bottle's and the torus knot's recipes (`src/packs/maths.js`), the kit clock (`clock` in
`src/packs/objects.js`, shared with lane Fix4), those toys' entries in the shared lists,
`tests/fx5.spec.mjs`, the `fx5-*` screenshots and this file. How lanes work:
[OPERATING.md](../OPERATING.md).

## Brief

From the Operator, September 30, 2026, 6:47 p.m. UTC, word for word:

More work for this session, after the rim engine PR (#136) and the marble. The owner's notes of
September 28 (filed today in docs/reviews/2026-09-28-sounds/review.md on branch
claude/operator-sound-review) have a few non-sound fixes. Do them as a second lane, Fix5: branch
claude/lane-fix5 from main, PR "Phase Fix5: the balloon dog's flag colors, the real alarm clock, and
small fixes", handoff docs/handoff/Fix5.md, prefix `fx5`.

1. **Balloon dog:** with a flag theme on, the balloon takes the flag's colors, but the popped pieces
   keep the "Balloon color" setting. His example: Albania's flag on a green balloon pops into green
   pieces. The pieces should match what you see.
2. **The scanned alarm clock (`alarm-clock`):** "There's something weird about that red or orange
   hand that's moving. It's like some of it is stuck and some of it isn't." (He had a screenshot; we
   don't.) Reproduce it and fix it within the effect quality rules: the whole hand moves as one
   solid piece, cut with hard edges or rebuilt as a kit part.
3. **Two toys named "Alarm clock":** he wants the same kind of object on different shelves to have
   different names. Rename the scanned one's label to "Real alarm clock", like "Real tin can" and
   "Real pencil". Keep its id so links still work, and update its help and plan text if they use the
   name.
4. **Klein bottle:** he tapped all over the bottle and couldn't set off its effect; only the button
   worked. Check on main (Fidelity A changed it since), and fix the tap target if it still fails.
5. **Torus knot:** its help says "pull and let go", but dragging only turns it. Make the help line
   match what it does, unless a pull exists that just doesn't work, in which case fix the pull.
6. **CNN:** add one sentence to its About text in src/toy-help.js saying what the gray squares on
   the drawing pad mean. Coordinate the wording with UI r2's pad (PR #131); don't touch the pad's
   code.
7. **A live clock (the kit `clock`, which you already own):** a "Live time" option that shows the
   real time in a chosen time zone. The default is this device's own zone, read with
   `Intl.DateTimeFormat().resolvedOptions().timeZone` (no permission needed); offer UTC and a list
   of common zones. Keep the tap effect. It's off by default unless it clearly looks right on.

Cards (390×844, "built by Opus 5.5", lane record `Fix5`; ask me if it's missing): fx5-balloon-flag,
fx5-real-alarm-clock, fx5-klein-tap, fx5-torus-knot, fx5-live-clock. Tests in tests/fx5.spec.mjs.
These are public toys: they merge after the owner's good marks. You own, for Fix5 only: the balloon
dog's, the scanned alarm clock's, the Klein bottle's and the torus knot's recipes; the kit clock
(already yours); and those toys' entries in the shared lists.

## State

Model: Opus 5.5 (default effort).

September 30, 2026: all seven fixes are built on `claude/lane-fix5`, which stacks on
`claude/lane-fix4` (both change the kit clock), so it merges after #134. `tests/fx5.spec.mjs` passes
(8 of 8). Clips and cards follow.

## Notes

- **Balloon dog** (`balloon-dog`): the popped scraps were a cloud built with `pattern: false`, so a
  flag theme skipped them and they kept `shade(o.color)`. They now take the pattern layer, and each
  scrap is built on the skin of one of the balloon's own pieces (the pattern layer colors a splat by
  its rest position), so it has the color the rubber had there: the balloon color, or the flag's.
  They also burst from where that rubber was.
- **Real alarm clock** (`alarm-clock`, rig in src/rigs.js): the second hand was a rig region keyed
  to its red. The rig moves each splat by its weight (`mix(p, moved, w)` in the rig shader), and the
  hand is so thin that most of its splats are partly dial-colored, so they got weights between 0 and
  1 and turned only part of the way: the "stuck" part. It also sat at z = 0.21 (behind the bezel),
  while its region was centered at 0.4, so its tip fell outside the region. Now:
  - The region is centered on the dial (`at` z 0.21, radius 0.75, tolerance 0.55; the dial's beige
    stays out) and is hidden (`visible: 0`). The dial is whole under it (checked: no gap).
  - A kit-built hand (a rig add-on, parts turn with `out.addon.parts.hand`) turns in its place as
    one solid piece: a thin red needle with a short tail and a round boss, 3 cm off the dial so the
    dial's big splats never sort in front of it. It shares the toy's body, so it rattles with the
    clock on a tap. Where it lies at rest (`CLOCK_HAND`) was read from a face-on render and a sweep
    of depths from the side.
  - Its label is now "Real alarm clock" (id unchanged). Its help and plan text don't use the name.
- **Klein bottle**: still failed on main. Its glass is at opacity 0.28, just under the pick pass's
  alpha clip (0.3), so a tap on it found nothing and nothing fired. The recipe now sets
  `pickAlpha: 0.1` (the Lab's splat field does the same). The test fails without it (0 of 3 taps
  hit) and passes with it.
- **Torus knot**: it has no pull you can drag (the tap plays a scripted pull). The help now says
  "Tap it: the knot pulls loose and springs back. Drag to turn it. …"
- **CNN**: About text gains "Each square on the drawing pad is one pixel of the small 8-by-8 picture
  the network reads: the lighter its gray, the more ink it holds, and the pad starts with the sample
  7." This matches UI r2's pad (PR #131: a cell inks by how much of it the pen covers).
- **Kit clock**: it already showed this device's real time, so "Live time" is a **Time zone**
  option: "This device" (the default, the old behavior), UTC and 14 cities (IANA names, read with
  `Intl.DateTimeFormat` and `formatToParts`; an unknown zone falls back to this device's time). The
  build hands the zone to `drive()` in `k.data.zone`. Its color option's label is now "Color".

## Known issues

- None known.

## For the Operator

- Fix5 stacks on Fix4 (`claude/lane-fix4` merged into it): merge #134 first.
- The live clock was already live; the new option is the time zone, on by default as "This device"
  (unchanged behavior).
