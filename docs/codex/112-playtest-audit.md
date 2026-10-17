# Codex task 112: a real-browser playtest of the whole Playground (local, computer use, up to 6 hours)

**Where:** the Codex app on the owner's Mac, with computer use in Chrome. It plays the live site
(https://ryanjosephkamp.github.io/splashery/), so start only after the Operator says the recorder
hotfix (lane REC1 r2) is live. **Branch:** `codex/playtest-audit`, cut from `main`, for the report
only. Screenshots and short screen recordings go on `codex/playtest-audit-clips`, never merged. Read
`AGENTS.md`, `builders/RULES.md`, and `docs/reviews/2026-10-17-walkthrough/triage.md` (what the
owner already found; don't re-report those, but say if one is worse or fixed).

## Why

The specs run in a software renderer and can't see what a person sees: a black recording, an embed
that never loads, a tap that does nothing. The owner wants every feature checked by hand in a real
browser before the release, on desktop and at phone size.

## What to play

Do every check twice: at 1440×900 with a mouse, and at 390×844 using Chrome's device toolbar (touch,
a phone user agent). Do both with labs off and with labs on (`?labs=1`).

1. **Every toy on the shelf:** it opens, it draws (not blank, not stuck loading), a tap does its
   effect, Play does its effect, the sound plays, the About and How-to texts show, and switching to
   the next toy leaves nothing behind. Note any toy that takes over 5 seconds to open or feels laggy
   (say how: drag, tap, or idle).
2. **The top bar:** every button (the shelf, flags, full screen, reset, lock, the turntable, help,
   sound), in and out of full screen.
3. **The tabs:** Toy, Share, Tools, Look, and Make. Every control does what its label says, and
   every option has a visible effect.
4. **Share** (open each saved file and check its picture, length, and sound):
   - Record (with each countdown), saving a picture, a GIF, a clip, and the PDF;
   - the QR code and "show as splats";
   - a link: open it in a fresh tab and compare;
   - a saved scene, opened again;
   - the iframe and element embeds, pasted into a local HTML file.
5. **Studio tools,** with their built-in samples: Photo to 3D, Moving photo to 3D, Video to 3D, the
   Splat mirror (allow the camera), and the Picture lab.
6. **Stage controls:** zoom, Play, the hand, and Reset, plus the depth and level sliders and the
   media panel.

## What to hand back

- `docs/audits/playtest-2026-10.md`: a short summary first, then every problem found. Each one gets
  the toy or feature, the steps, what you expected, what happened, the viewport and labs setting, a
  severity, and a screenshot or recording path on the clips branch.
  - P0: broken or blank.
  - P1: wrong.
  - P2: rough or slow.
  - P3: wording.
- `docs/audits/playtest-2026-10.json`: the same problems as data, one object each, with a stable id.
- No code changes in this task. The Operator turns the report into fixes.

Stop when everything above has been played on both sizes, or after 6 hours. Then say what you didn't
reach. PR body: Summary, Verification, Deviations, Known issues, What was cut. Credit lines read
"Codex (GPT-6)".
