# Codex task 27: keyboard and screen-reader check of the site pages

**Branch:** `codex/site-a11y`, cut from `main`. **Output:** `docs/audits/site-a11y-2026-10.md`, its
screenshots in `docs/audits/site-a11y-2026-10/`, and `tests/site-a11y.spec.mjs` (one new test file
that checks what you can automate). Change nothing else: a Site lane makes the fixes.

Task 04 audited the toy app (`index.html`). This one covers the pages around it: the static site
under `site/` (home, play, learn, science, studio, tools, new, share, search, about, 404, and the
per-toy pages in `site/toys/`), the Tinkerer's Manual (`manual/`), the PDF lab (`pdf-lab/`), the
embed page (`embed/`) and the Ascii pages (`ascii-lab.html`). Serve the repository with
`python3 -m http.server 4173 --bind 127.0.0.1` and drive it with Playwright, at 390×844 (touch) and
at 1440×900. Read `docs/audits/phone-a11y-2026-10.md` first, so you don't repeat its findings.

## Steps

1. **List every page** (give the count). Sample the per-toy pages (30, across shelves, and say
   which); check every other page.
2. **Per page, automatically in the test file:** one `<h1>`; heading levels that don't skip; a
   `<title>` and a `lang`; a landmark for the main content and the navigation; every image has `alt`
   (or `alt=""` on purpose); every link and button has an accessible name; no two elements share an
   `id`; every form control has a label; the skip link (if any) works; no horizontal scroll at 390
   wide; the page has a visible `:focus-visible` style (compare screenshots with and without focus).
   Use Playwright's accessibility snapshot, not a new library. The tests must pass on `main`: for a
   finding, record it in the report and use `test.fail()` with a comment, so the file stays green.
3. **Keyboard, by hand in Playwright, on 10 representative pages:** Tab order matches the reading
   order, no keyboard trap, Escape closes menus and dialogs, the search page works without a mouse,
   the live toy on a toy page can be focused and left again, and the PDF viewer's controls work.
4. **Contrast:** measure text and icon contrast on the 10 pages, in light and dark if the site has
   both (WCAG 2.2 AA: 4.5:1 text, 3:1 large text and UI). Give the measured ratios of everything
   that fails.
5. **Motion and sound:** `prefers-reduced-motion` honored on the pages with animation? Any sound
   before a tap?
6. **Say what you couldn't check** without a real screen reader (VoiceOver, TalkBack).
7. **The report:** a summary of at most ten lines, worst first; then one line per problem (page,
   what is wrong, the WCAG criterion, the screenshot, the file and line a fix would touch).

Keep screenshots small (PNG, under 300 KB). Don't edit `site/` (the files there are built by tools:
name the generator, such as `tools/site-toy-pages.mjs`, in each fix location). No web needed. Before
you push: `SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test tests/site-a11y.spec.mjs`,
`npx prettier --check .`, `node tools/us-english.mjs --diff`. Open a draft PR titled "Codex task 27:
keyboard and screen-reader check of the site pages".
