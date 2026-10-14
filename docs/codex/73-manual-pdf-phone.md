# Codex task 73: the Tinkerer's Manual PDF on phones

**Branch:** `codex/manual-pdf-phone`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `manual/build-pages.mjs` and whatever builds
`manual/tinkerers-manual.pdf`, and the manual pages that link to the PDF.

## Why

The owner opened the manual's PDF on an Android phone (October 13, 2026):

- **Brave showed an old copy** (about 44 pages, still with the old "levels"), while Chrome showed
  the new 150-page edition. The PDF keeps the same address between editions, so a browser can keep
  serving a cached old copy.
- **The table of contents links don't jump** to their chapters in Chrome on Android, in Brave, or in
  Google Drive's viewer. The file does have about 330 internal links and bookmarks, which work in
  desktop viewers; most Android viewers ignore internal links.

## Goal

1. **No stale copies:** give every edition its own address (for example
   `tinkerers-manual-2026-10-13.pdf`, or a content hash in the name) and update every link to it,
   keeping the old address working as a redirect page or a copy so old links don't break.
2. **A contents page that works anywhere:** keep the clickable links and bookmarks, and also print
   each chapter's page number beside its entry, so a reader whose viewer ignores links can still
   find it. Check the page numbers match the built PDF.
3. **Verify the links:** a build check that every internal link points to a real page and every
   bookmark lands on its heading, using pdf.js (vendored already) or a pinned build-time tool listed
   in `LICENSES.md`. Report which viewers you could test and how.
4. Say in the PR what Android viewers can and can't do with internal links, honestly.

## Don't touch

The manual's text and demos (no wording changes), and the files of the other open PRs.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
