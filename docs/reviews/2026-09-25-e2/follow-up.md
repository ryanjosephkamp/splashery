# Splashery Review 2026-09-25, follow-up (the E2 fixes and PRs #30–#31)

The owner's marks on the Effect review page after the fixes for the first E2 review, word for word.
15 of the 16 new items were marked "Looks right": the Moon landing, the sapphire, the quartz cluster
and the solar system (PR #29); the settings panel on desktop and phone, the turntable switch, Detail
and Reset everything, chess on a phone, and the laptop keys before and after (PR #30); your own
molecule, a formula that fits more than one molecule, the protein toy, GFP and the protein toy on a
phone (PR #31).

"Needs work" (1):

- **Chess: the game bar and flag colours (ui-chess-bar):** Game bar looks perfect. Flag colors need
  to be improved a bit. For a given player (white/dark), piece colors should all be consistent and
  not different colors of the flag. For example, the white-pieces player's pieces should all be
  light/white, not red white blue or different colors. We need one player's pieces to be light and
  the other player's to be dark. The board should also clearly show light vs. dark squares, and the
  flag colors make those too hard to distinguish. To solve these problems, you could keep the flag
  color effects that are on the board itself, but just make the color changes much more subtle, and
  then for the pieces, you can have the flag colors NOT apply, and we'll use the same consistent
  dark and white piece colors for all flag color themes. Importantly, the pieces shouldn't blend in
  and be hard to distinguish, and the board's light vs. dark squares shouldn't be hard to discern.

## Chat message

> Thank you for your help. These changes are almost all perfect.
>
> I've updated the artifact: https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi
>
> While the PRs are still open, I'd like to fix the chess board's flag colors, which is the only
> thing that needs work from what you just did.
>
> Please proceed to fix that for me.
>
> Thank you.

The fix is in PR #30: the pieces never take flag colours, and the board takes them at 30% with each
square's own light and dark kept.
