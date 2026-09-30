# Lane UI r2: focus mode, panel sizes, drawing pad and pan

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: UI r2, "Focus, sizes, a better pad and pan" (prefix `ui2`).
Branch: claude/lane-ui-r2. PR title: "Phase UI r2: focus mode, panel sizes, drawing pad and pan".
Handoff file: docs/handoff/UIr2.md. This is an engine lane: it changes the site's layout and
gestures for every toy.

## Brief (written by the Operator on September 30, 2026, from the owner's requests and his answers that morning)

The owner wrote, word for word: "On desktop, the toy gallery and models are reasonably easy to
navigate. But on mobile, the settings panel and gallery are difficult to use. I oftentimes want to
be able to hide the settings entirely, and other times, I want the gallery to be full-screen or for
the full setting panel to be maximized. It would be nice to be able to view the toy in a focused
full-screen mode, without the settings panel getting in the way. We should improve that on mobile,
and I'd like to improve it on desktop as well. For some toys, like the convolutional network,
settings are almost impossible to use well on mobile. For the convolutional network specifically,
the number drawing box (which is super cool and perfect otherwise, although I suppose it would be
nice if the drawn lines were a bit less thick, i.e., if it weren't so easy to accidentally activate
so many pixels when drawing, especially by hand on mobile) doesn't fit on my mobile screen entirely
right now; allowing me to maximize the settings would fix that, I presume." And: "Is it possible to
allow the user to hold a key like option or shift or alt or something and then drag to move a toy
around (actual translation, not just rotation) on desktop, and maybe enable the same feature if the
user does a 2-finger drag on mobile? And it would be nice to allow them to easily reset to the
default view/orientation, if we aren't already enabling that."

He approved this plan on September 30, 2026 (calls 15 and 16). Build it behind the labs switch first
(`?labs=1`); he tries it on his phone, and it becomes the default for everyone after his "good"
marks (then a small follow-up commit in this PR flips the default). The laptop toy is locked: don't
change its look or behavior.

What the site does today (check the code; this is the Operator's reading): on a phone the bottom
sheet (src/ui.js, modes "row", "grid" and "panel"; `SHELF_GRID`; the 760px breakpoint) has three
stops, the toy row, the gallery (`body.shelf-grid .panel`, at most 80dvh) and the settings
(`body.sheet-open .panel`, at most 62dvh), and the toy row never hides. On a computer the panel is
fixed on the right. In `bindGestures` (src/app.js, and again in src/viewer.js), a one-finger drag
turns the toy, a pinch zooms, two fingers moving together turn it (the pinch's "drag" mode), and
only picture toys pan (`player.panBy`, `player.pansHere` in src/player.js). A double-tap, the ↺
button and the R key reset the view. `camera.getState` saves yaw, pitch, roll and distance, not the
target.

Build, in this order, posting each part's cards as soon as it's done:

1. **Focus mode.** A button in the top bar and the F key hide everything but the toy (the top bar
   collapses to one small "show" button in a corner). Escape, that button, or a swipe up from the
   bottom edge on a phone bring everything back. Use the browser's Fullscreen API too where it
   exists (computers and Android), never required.
2. **Sheet stops on a phone.** Two more stops: **hidden** (swipe the toy row down; a small handle
   stays to pull it back) and **full** (drag the handle to the top, or a maximize button): the
   settings or the gallery fill the screen, with a strip of the toy still showing at the top so you
   see what a setting changes. Toys with big inputs (the CNN's drawing pad, the plotters, anything
   whose input panel doesn't fit) open their settings at the full stop on a phone, so the pad fits
   whole.
3. **Desktop panel.** Collapse the panel to a thin edge (a button and a key, say `[`), widen or
   narrow it by dragging its edge (remembered in localStorage, wrapped in try/catch), and open the
   gallery as a full page (a grid of every shelf that covers the stage; Escape closes it).
4. **The drawing pad** (renderInputPad in src/ui.js; the CNN toy uses it). Today every pointermove
   adds ink to the cell under the finger and all its neighbors within distance 1.1 at 0.3 of the
   maximum, so lines get thick fast. Instead: a smaller, harder pen that inks by the distance drawn
   (interpolate along the stroke; ink per unit length, not per event), a **Pen size** choice (fine,
   medium, bold; fine by default on phones, medium on computers) and an **eraser**. The CNN must
   still read a hand-drawn digit correctly: check with a test that draws a "3" and a "7" as strokes
   and gets the right class.
5. **Home Screen app.** A web-app manifest (`manifest.webmanifest`, name "Splashery",
   `display: "standalone"`, the site's own icon at 192 and 512 px made from an existing thumbnail or
   a kit render, no logos), the Apple meta tags, and `theme-color`, so Splashery opens full screen
   from an iPhone's Home Screen. No service worker.
6. **Pan (moving the toy).** On a computer, Shift or Option/Alt plus a drag moves the toy across the
   screen instead of turning it. On a phone, a two-finger drag moves it (instead of turning it); a
   pinch still zooms and a twist still tilts; one finger still turns. The move stays within reach of
   the toy (clamp the target near its bounds, as `panBy` does now), and Reset (↺, R, and a
   double-tap where the toy doesn't use it) puts it back in the middle. Shared links and saved
   scenes store the move in a new optional field (for example `camera.pan: [x, y, z]`, documented in
   docs/SCENE-SCHEMA.md): old `#s=` links and saved scenes of schema v2 and v3 load exactly as
   before, and a link without the field shows the toy centered. Check every toy whose own drag or
   two-finger gesture might clash (the puzzle cube, the bricks, stretchy toys with `grab`, chess,
   Newton's cradle, the picture and book toys): each still has a way to turn and to use its own
   drag. Books r4 (PR #126, lane Books) is changing the double-tap on book and picture toys to focus
   a page; if #126 hasn't merged when you reach the gestures, read its diff, keep your change
   compatible with it, and merge main as soon as it lands.

Every change works at 390×844 and at 1440×900, with a mouse, a trackpad, a keyboard and touch. Help:
add the new gestures and keys to the site's help (the About tab's "How to use" text or wherever the
controls are listed) and to the Tinkerer's Manual only if it lists controls (a line or two).

Cards (clips at 390×844 unless noted, each labeled "built by Opus 5.5", in the lane record `UIr2` on
the Effect review page; ask the Operator in your message if the record is missing):

- `ui2-focus`: focus mode on and off on a phone, and at 1440×900.
- `ui2-sheet`: the hidden and full stops, the gallery full.
- `ui2-cnn-pad`: the CNN's pad at the full stop, drawing a digit with the fine pen, erasing, and the
  network's answer.
- `ui2-desktop`: the panel collapsed, widened, and the gallery page (1440×900).
- `ui2-pan`: moving a toy with two fingers, then Reset; and Shift-drag at 1440×900.
- `ui2-homescreen`: a still of the manifest's icon and the standalone launch if you can emulate it;
  otherwise say so.

Tests in tests/ui2.spec.mjs: focus mode hides the panel and top bar and Escape restores them; the
sheet's five stops; the pad inks by distance (a slow and a fast stroke of the same length ink about
the same number of cells) and the eraser clears; the CNN classifies the drawn digits; the pan clamps
near the toy, Reset clears it, and a link with the pan field restores it; an old `#s=` link from
before the change loads unchanged (take one from the existing tests); the manifest is valid JSON
with the icons present; the laptop's smoke test stays green. Screenshots at 390×844 and 1440×900
(`ui2-*`).

## You own

For this lane's duration (engine code; keep every change marked and as small as it can be):
`src/ui.js`, `styles.css`, `index.html`, the gesture and key handling in `src/app.js` and
`src/viewer.js`, `src/camera.js`, `panBy`/`pansHere` and camera reset in `src/player.js`, the scene
read and write for the new field (wherever `#s=` links are built and read) and docs/SCENE-SCHEMA.md,
`manifest.webmanifest` and its icons (new), `tests/ui2.spec.mjs`, your `ui2-*` screenshots and
docs/handoff/UIr2.md. Other lanes' toys and packs are theirs. If a finished lane's test breaks
because the layout changed (a selector, a panel height), don't edit it: name the test and why in
your message, and the Operator fixes it.

Lanes Books r4, Fluids, Worlds, Science, Sound A and B, Fix4, Video to 3D, Live input and the
Integrators may run at the same time; leave their files alone. Lane Live input will add a "Use my
microphone" control to the input panel after you; keep the input panel's API as it is.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State" (the blog post compares the two models).
- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain only, checked on the live source page and credited
  (CREDITS.md, tools/assets.json and the toy's in-app credit). Never BY-SA or NC. No logos, brand
  names or insignia.
- Review: post clips and cards to the Effect review page,
  https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says.
  Judge every effect as motion at phone size against the effect quality rules before you post it.
  The Operator has made your lane's record. Don't republish the page, and never write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary. When main moves, merge it into
  your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

- Model: Opus 5.5 (claude-opus-5-5), default effort.
- September 30, 2026: branch `claude/lane-ui-r2` started from main; handoff file and draft PR
  opened. Building part 1 (focus mode).

## Notes

- Everything new sits behind the labs switch (`?labs=1`) through one flag, `ui2On()` in `src/ui.js`;
  flipping it to true makes it the default.

## Known issues

- None yet.

## For the Operator

- Nothing yet.
