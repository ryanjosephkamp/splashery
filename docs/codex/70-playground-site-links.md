# Codex task 70: the Playground links to the site, and landscape phones reach the settings

**Branch:** `codex/playground-links`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `index.html` and the app's UI code under `src/` (the
Playground: the toy view, its info panel, the gallery, and the settings), `site/` (the main site;
every toy has its own page at `site/toys/<toy id>/`), and `tools/site*.mjs` (how the site is built).

## Part 1: links from the Playground to the site

1. A clear link from the Playground to the main site's home page (in the header or menu, where the
   other top-level links are).
2. In each toy's info panel (the About part), a link "More about this toy" to that toy's own site
   page, `site/toys/<toy id>/`, opened in the same tab, built from the toy id so every toy gets it
   with no per-toy list. Labs-only toys that have no site page yet get no link (check that the page
   exists at build time; don't link to a 404).
3. Works for toys in a saved scene and from an old `#s=` link (D3).

## Part 2: settings on a phone held sideways

On a phone in landscape (try 844×390 and 932×430), the owner can see only the toy and the gallery;
the toggles and settings can't be reached. Make every control the portrait layout offers reachable
in landscape too: for example a settings button that opens a sheet or side panel, or a layout that
moves the gallery aside. Keep the toy as large as it can be. Check the safe areas (the notch side
changes with rotation) and that rotating back and forth keeps the state.

## Tests and proof

`tests/cdx-playground-links.spec.mjs`: the site link and a toy's "More about this toy" link point to
real pages, labs-only toys without a page show no link, and at 844×390 and 932×430 every settings
control can be opened and used. Plus `smoke`, `help`, `ui*`, `taps`, and `unit` (never edit
`tests/taps.spec.mjs`). Screenshots at 390×844, 844×390, and 1440×900 in the PR body.

## Don't touch

The files of the open PRs (#560, #562, #566, #581, and #582), the engine's rendering code, and
`vendor/`. The app's UI files are fine to change; keep changes to what these two parts need.

## Report

In the PR body: what changed, the screenshots, and the test results. Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
