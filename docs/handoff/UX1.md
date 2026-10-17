# Lane UX1: the Playground on a phone, an audit with proposals

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane UX1 (prefix `ux1`), Opus 5.5 at high
effort, branch `claude/ux1`, PR "Phase UX1: a phone UX audit and proposals". Report only: no product
code.

- Use the Playground at 390 × 844, 360 × 740, and 844 × 390 with touch, labs off and on, through
  every flow (the shelf, the tools, each tab, recording, full screen, the top bar, the sliders and
  the media panel, the Studio), and note what is hard and why.
- Compare with the desktop layout and with two or three well-made phone apps, in words.
- Rank proposals by value against effort; each says what changes, what it replaces, what stays
  reachable, where its code lives, and its risk. Mockups of the top five.
- Leave out what lane REC1 does (Record beside Play, the stage buttons in one row, Play to Pause,
  the media panel's close button).

## State

- READY: `docs/audits/ux-phone-2026-10.md` (15 proposals, top five with mockups) and
  `tools/pages/ux1/index.html` (the mockups beside captures of main).
- No product code, so no tests or clips; prettier and the American English check pass.

## How to look at it

- `node tools/cdx-mp2-server.mjs 4173`, then open http://localhost:4173/tools/pages/ux1/.
- The captures are from main `c36c4dcd` in headless Chromium with touch emulation; a real phone
  (Codex task 112) should confirm the measurements before lanes build on them.

## Next

The audit's "Suggested order": proposals 1 and 2 (the sheet and the top bar) first, in one lane; 3
(the tool tray); 4 and 11 after REC1 merges; 5 and 6; 7 with lane EXP1.
