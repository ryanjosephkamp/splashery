# Triage of the October 10 evening walkthrough

The owner walked through the labs toys on October 10, 2026, at about 4:20 p.m. ET (20:20 UTC), and
wrote notes with other questions. His notes stay private at his request. This file is the Operator's
summary of the walkthrough items, in the Operator's words, with the lane that owns each. Anything
merged after 20:20 UTC (batch 6, #500, merged at 20:50 UTC) wasn't on the site he saw.

What he praised: the QR family is stable now (no size flash), the barcodes are "basically perfect",
Picture QR's pictures (and his own uploaded picture) look great, and Photo to 3D and Moving photo to
3D (the depth slider, his own sound, the video options) are among the best things on the site.

## QR r5 (`qr5`, Opus)

1. **Picture QR: the tap ripple turns the picture black.** Inside the wave, every module shows as
   plain black, then returns to the picture. The ripple should carry each module's own picture
   color, so the picture stays whole while the wave passes.
2. **QR damage lab: damage goes where you tap.**
   - Sticker: lands where the person taps.
   - Tear: starts from the corner (or edge) nearest the tap, not always the bottom right.
   - Burn: spreads from the corner nearest the tap.
   - Smudge: lands where the person taps.
   - Blur, shrink, grow, jitter, fade and color drift are whole-code effects and stay as they are.
     Clearing the damage and healing work well.
   - The meter must keep agreeing with jsQR (`tests/qrs-toys.spec.mjs:78`).
3. **Three QR codes in one: white streaks.** As the red, green and blue codes split apart, and while
   they're apart, white horizontal streaks flicker across the top rows of all three codes. It shows
   best as motion; the two screenshots catch it at the top of each code
   ([1](qr-three-streaks-1.jpg), [2](qr-three-streaks-2.jpg)). Find the cause and fix it. The
   owner's idea, if it's simple: let people choose the three colors.
4. **Sounds.**
   - How a QR code works: the wind is too loud; make it quieter.
   - Three QR codes in one: the whoosh when the codes separate is too loud; make it quieter.
   - Other barcodes: drop the note that plays at the end.
   - QR code and Picture QR: fine as they are.

## Live r9 part 2 (`lv9`, Opus)

5. **Sound in a box with music.** The owner asked for it to move live with uploaded audio and the
   microphone, as the Chladni plate does. That's Live r9 (#488), merged with batch 6 after his
   walkthrough. Part 2 adds built-in multi-note tunes to choose from, synthesized by the toy.

## Later

- **The splat-budget table** (docs/lab/SHARPNESS.md and docs/lab/BUDGETS.md): the owner wants a
  table like it on the site, in the Tinkerer's Manual or elsewhere. For the next manual round.
- **Video to 3D:** the owner sees a lot of potential there and wants to return to it soon.
- **Photo and video stability:** Codex task 32 (#479) is that work; it waits for the owner's
  in-depth review.
