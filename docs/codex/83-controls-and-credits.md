# Codex task 83: The keyboard help, a stale comment, and two broken credit links

**Branch:** `codex/controls-and-credits`, cut from `main`. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, and CLAUDE.md.

## Why

A source review on October 14, 2026 found four small things; the Operator checked each one on main
(`c00e1cb8`). They are public (the README and the credits page), so the PR waits on the owner's
look.

## The work

1. **The README's Controls table misses three keys.** `bindKeys()` in `src/app.js` (about lines 1330
   to 1376) also handles **F** (focus mode, `ui.toggleFocus()`), **[** (fold the panel,
   `ui.togglePanel()`), and **G** (the gallery, `ui.toggleGallery()`). Add them to the table in
   `README.md` ("## Controls") in words a newcomer understands (read `src/ui.js` for what each one
   does). Keep the code's exclusions as they are: keys go to a toy that takes typing first, and no
   shortcut fires while typing in a field or with Command, Control, or Option held.
2. **"Arrows, + and −: canvas focused".** In the code only the arrows check that the 3D view has
   focus; **+** and **−** zoom from anywhere outside a text field. Write a test first
   (`tests/cdx-keys.spec.mjs`) that presses each key with focus on the 3D view, on a button, and in
   a text field, and records what happens. Then make the README say what the code does. Change the
   behavior only if the test shows a real problem (for example, + zooming the toy while a slider has
   focus), and say why in the PR.
3. **A stale comment.** `src/ui.js` (about line 32) still says "UI r2 (the labs switch)" though UI
   r2 has been on for everyone since October 1, 2026 (`ui2On()` in `src/player.js`). Reword the
   comment only.
4. **Two broken links on the credits page.** `CREDITS.md` writes two Wikimedia Commons links with
   angle brackets, as CommonMark allows for addresses that contain parentheses: the Real pencil
   ("Kleiner Bleistift") and the Keck Center spiral staircase. `tools/site-md.mjs` (the link pattern
   at about line 64) doesn't read `[text](<address>)`, so `site/about/credits/index.html` ends up
   with a GitHub "tree/main" address around an escaped `&lt;https:/commons…&gt;` (lines about 1792
   and 3586). Fix the Markdown reader so an angle-bracket address becomes a plain absolute link (and
   an address with balanced parentheses still works), rebuild with `node tools/site-build.mjs`, and
   add a regression test: every `href` on the built credits page is an absolute `http(s)` address,
   an in-site path that exists, or an in-page anchor, and none contains `&lt;` or `&amp;lt;`. Check
   the other pages built from Markdown for the same pattern and fix any you find through the reader,
   not by editing generated HTML.

## Rules

No change to how any toy looks or plays. American English and the serial comma. Before you push:
`node tools/site-build.mjs --check`, `npx prettier --check .`, and
`node tools/us-english.mjs --diff` are clean, and your new tests pass. The test suite on GitHub
Actions runs the quick checks on your PR; the full suite runs on the Operator's merge PR (or on
yours when the Operator adds the `full-suite` label) and posts its result as a comment; any failure
that isn't marked "(known on main)" is yours to fix. PR body with Summary, Verification, Deviations,
Known issues, and What was cut.
