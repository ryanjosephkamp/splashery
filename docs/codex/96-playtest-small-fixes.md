# Codex task 96: Small fixes from the October 15 playtest and walkthrough

**Branch:** `codex/playtest-small-fixes`, cut from `main`. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, and CLAUDE.md. Task 91 changes the shelf, the toolbar, and the
search list; stay out of those, and merge `main` again if it lands first.

## Why

An outside playtest on October 15, 2026, and the owner's walkthrough found small rough edges. Each
is checked against `main` already; fix each at its cause, with a test where one can catch it.

## The list

1. **A bad file's error.** Opening a broken `.ply` toasts the raw engine message ("Invalid ply
   header") with no file name (`src/app.js` around 1572, `src/loaders.js` around 78). Say, in plain
   words, which file couldn't be opened and why, for every loader that can fail this way.
2. **A stale status message.** The toast's text stays in the `role="status"` element after it fades
   (`src/ui.js` around 3671). Clear it when the toast hides, so screen readers don't reread it.
3. **The Seed field** silently wraps values below 0 or above 4294967295, and decimals (`src/ui.js`
   around 2186). Clamp to the range, round, and show the value it used.
4. **Save PDF** waits on the browser's save picker with no feedback (`src/pdf-export/index.js`
   around 150 and 277). Show that it is waiting for the save dialog, and a clear message if the
   picker fails or is dismissed.
5. **QR "Show as splats" at a low Splats budget** leaves the QR cover up with "did not scan" (a
   deliberate guard, `src/packs/qr.js` around 285 and 331). Say that the budget is too low for the
   code to scan and what to set it to.
6. **Auto detail on a very slow renderer** never steps down, because frames more than 100 ms apart
   are ignored (`src/stage.js` around 289, `src/player.js` around 315). Let a sustained slow frame
   rate step Auto down too, without changing anything on a normal phone or desktop (measure both).
7. **Keyboard order.** Each of the 31 shelf chips and every toy card is its own Tab stop, so the
   shelf takes 40 or more Tabs to reach. Make the chip row and the card grid one Tab stop each with
   arrow keys inside (a roving tabindex), and give the skip link a target for the shelf.
8. **The manual's contents.** In the printed PDF the contents' page numbers aren't aligned to one
   right edge: chapter rows' numbers end about 58 px further right than section rows'. The cause is
   the injected print CSS in `tools/manual-pdf.mjs` (about lines 283 and 284): section entries are
   `position: relative` too, so their absolutely positioned numbers anchor to the section's edge,
   which `p, li { max-width: 68ch }` in `manual/manual.css` keeps short. Making the nested section
   entries `position: static` (and dropping `top: 0` on `.pdf-page-number`) puts all 108 numbers on
   one edge with no reflow; check it in the `node tools/manual-pdf.mjs` output. While there, the
   manual still says "Save JSON" and "Load JSON" where the app now says "Save scene" and "Open a
   scene" (`manual/share.html`, `manual/all.html`, `manual/demos3.js`): match the app. The Operator
   prints and commits the new PDF edition after this merges (docs/CI.md); don't commit a PDF
   yourself.

## Rules

Only the files named above and their tests; engine changes in their own "Engine:" commit. No toy's
look or behavior changes. American English and the serial comma. Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. The full suite runs on
the Operator's merge PR. PR body with Summary, Verification, Deviations, Known issues, and What was
cut, with one line per item: the cause, the fix, and the test.
