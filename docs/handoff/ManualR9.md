# Lane Manual r9 (prefix `man9`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session, session_011WeiHJ3ygHhoTrrJiThHzX). Repo: ryanjosephkamp/splashery. Your lane: Manual r9 (id `ManualR9`, prefix `man9`). Branch: `claude/lane-manual-r9` from main. PR title: "Phase Manual r9: the owner's walkthrough and the last demos". Handoff file: docs/handoff/ManualR9.md (create it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/handoff/ScienceR3.md ("How this lane runs"), docs/handoff/ManualR7a.md, ManualR7b.md and ManualR8.md (their demos, print styles and the PDF build).

### Brief (written by the Operator on October 12, 2026, from the owner's walkthrough of the Tinkerer's Manual that evening; his notes are private, this is the Operator's summary)

The owner walked the whole manual (web and PDF) after Manual r8. He found the figures and demos sharp and the wording nearly final. Do exactly these, and change nothing else:

**Links**
1. **Links inside the manual open in the same tab.** Manual r8 made every link open a new tab (F41); the owner does not want that. A link to another manual page or a place in a page (the contents, the chapter list, the pager, citations, glossary links, `#x` anchors) opens in the same tab. Only links that leave the manual (other sites, the Playground, GitHub, papers) open a new tab. One rule in `newTab` in `manual/build-pages.mjs` and its tests; update the tests that check it (ln, man5, st2 if they assert new tabs) to the new rule, just as strictly.

**Demos (fill every placeholder)**
2. The manual still shows five "A demo goes here later" boxes (`.demo-placeholder`): `moving.html` (grab a hinge, a slider and a dial), `photo3d.html` (a photo turned into depth layers with a slider), `data.html` (an editable table of numbers, each row a splat), `codes.html` (a small QR code with a damage brush and a meter) and `make.html` (a tiny splat file with a crop box and a floater filter). Build each demo as its box describes, in the same style as the manual's other demos (`manual/demo*.js`, `manual/crisp.js`: sharp at the device pixel ratio, works by touch at 390×844, respects reduced motion, small, no network). The QR one (Chapter 9) matters most. Each demo needs a still for the PDF, like the others. If one truly can't be built well, say why and leave its box; don't ship a weak demo.

**Layout**
3. **Chapter 9's two QR codes side by side** are different sizes. Make them the same size, in one row, aligned (and stacked cleanly at phone width).
4. **"What else Splashery does now"** (the "more" page): the owner would like a few more pictures there, like the ones r7a added. Use real captures of the toys it names (the stills tool, as r7a did), with alt text.

**The PDF**
5. **The table of contents is not clickable** in Chrome's or Brave's PDF viewer. Make every contents entry an internal link to its chapter, and give the PDF an outline (bookmarks) of its chapters if Chromium's printer can (`tools/manual-pdf.mjs`; for example `page.pdf({ outline: true, tagged: true })` with headings it can read, or internal `#id` links that Chromium turns into PDF links). Check the result opens with working links in Chromium's PDF viewer.
6. The owner saw fewer pages in Brave's viewer than in Chrome's for the same file. Check the PDF is well formed (a validator such as `qpdf --check` if available, or pdf.js from vendor/ loading every page) and say what you find; it may be Brave loading pages lazily.

**Wording (the owner's own)**
7. The opening (index.html, "primarily splat based, but not only. Two honest exceptions.", and its copies in all.html): "but not only" becomes **"but not entirely"**, and "Two honest exceptions" takes a **colon** and leads into the two exceptions as a list (keep their sentences; just set them out after the colon). Make the same "not only" → "not entirely" change where the same phrase recurs (built.html, photo3d.html) if it reads naturally; list where you did.
8. Chapter 1 (splat.html): delete "Do not mix them up" (keep the sentence before it, ending with a period or colon as fits).

Then rebuild `all.html` and the PDF (`tools/manual-pdf.mjs`, Chromium 141 pinned, `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium`) so man5's byte-for-byte test stays green and ln's PDF size bound holds.

A Codex audit of Manual r8's fixes (task 47) is running now; the Operator may send its findings to you as a follow-up in this same lane.

You own the manual's pages, demos, stills, print styles, `manual/build-pages.mjs`, `tools/manual-pdf.mjs`, `manual/tinkerers-manual.pdf`, `tests/man9*.spec.mjs` (add tests for the new demos and the link rule), and your handoff file; and the manual tests that assert the link rule. No engine changes.

Specs before READY: ln, man, man2, man3, man3-2, man4, man4-pages, man5, man6, man7a, man7b, st2, site, spg, tpg, and your man9 specs, one Playwright run at a time.

Cards: one card per new demo (a short phone-size clip of it in use), one for the Chapter 9 QR row, one for the "more" page's new pictures, and one for the PDF's clickable contents (a short clip or stills), on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids man9-…, naming Sonnet 5.5, as docs/OPERATING.md, "Steps for a lane", says (no republish). The manual is public: the Operator merges after your specs and the owner's "good" marks.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the prefix and lane record with yours). Finish every working turn with "READY:", "WORKING:" or "BLOCKED:" (the Operator reads it; never ask the owner). Before READY, run CLAUDE.md's "Before every push" steps for your files. When main moves, merge it into your branch (never rebase). Usage is tight until the weekly reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers. The owner's own notes are private: never quote them in the repo, a PR or a card.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. October 12 to 13, 2026. Branch `claude/lane-manual-r9`.

1. **Link rule: done.** `newTab` in `manual/build-pages.mjs` now works both ways: `#x`, `chapter.html` and
   `chapter.html#x` (the contents, the pager, citations, glossary links, the railroad boxes, the
   glossary pop-up) have no `target`; anything else (another site, the Playground, `../`, a toy link,
   the PDF, `example-recipe.js`) gets `target="_blank" rel="noopener"`. `fold.js`, `railroad.js` and
   `glossary-data.js` no longer write targets for in-manual links. Tests changed: man3 (the rule,
   both ways), man4-pages and st2 (the contents' links now navigate the same tab), st2 (the all.html
   check), man5 (a comment). ln needed no change (it never asserted new tabs).
2. **Five demos: done**, all in one new file, `manual/demos6.js` (loaded by a script tag inside each
   demo's section; modules run once):
   - Chapter 6 (`moving.html`, `#demo-joints`): a chest lid (hinge, 0 to 90 degrees, falls by its
     weight and bounces at 0.2), a blade in a stone (slider, 0 to 0.5, held by friction) and a dial
     (round and round, coasts at 0.8 a second). Drag on the canvas or use the three sliders; the one
     number of each shows on the canvas and beside its slider.
   - Chapter 8 (`photo3d.html`, `#demo-depth`, moved up to follow "The Sharp view"): a picture
     painted in the file with a made-up depth for every dot, drawn as eight depth layers (left) and as
     the Sharp view's continuous relief (right); Depth and Turn sliders, drag to turn.
   - Chapter 7 (`data.html`, `#demo-table`): an editable table (x, y, z, size, hue; add or remove
     rows), one splat per row, turning box.
   - Chapter 9 (`codes.html`, `#demo-qr`): a real QR code (the Playground's address) built by the
     QR lab's own `encodeSteps` and read back by its own `analyze` (Reed-Solomon, block by block).
     Brush scratches the ink off dark modules (touch, mouse, pen); a meter per block shows codewords
     lost against the ones that can be repaired; levels L, M, Q, H; Scatter, Repair (the lab's healed
     modules), Clear. It reads modules, not a camera, and the text says so.
   - Chapter 10 (`make.html`, `#demo-file`): 420 splats (a ring and 60 strays) in the Splat
     toolkit's own `cropIndex` and `floaterFilter`; drag the crop box (or arrow keys), box size,
     tolerance, floaters on or off; counts and the `.splat` size (32 bytes a splat).
   All draw through `crisp.js`, use pointer events with `touch-action: none`, have slider or keyboard
   equivalents, redraw on theme change, load nothing from the network, and with reduced motion the lid
   and the dial do not fall or coast. Stills: `manual/img/demo-{joints,depth,table,qr,file}.png`
   (entries added to `manual/make-stills.mjs`).
3. **Chapter 9's QR row: done.** `.shots.even` (aspect 1:1, `object-fit: cover`, aligned to the top);
   one column, 300 px, centered, below 480 px.
4. **"more" page: done.** Four new real stills with alt text (`pic-more-bonsai`, `-damage`, `-flames`,
   `-body`: bonsai and sunflower, the QR damage lab and Picture QR, a campfire and a candle, the
   anatomy atlas and the potion bottle), each as a second picture in its section. A fifth, the song
   landscape, came out blank as it opens (it needs a song), so it is not shipped.
   tests/man7a.spec.mjs: "each h3 section has a picture" now says at least one.
5. **PDF contents and bookmarks: done** (`tools/manual-pdf.mjs`, `fixLinksAndBookmarks`, using the
   vendored pdf-lib). What the old file had: 144 internal links, each `/Dest /name` (a name looked up
   in the catalog's `/Dests`, the PDF 1.1 way), and a bookmark tree under one root with doubled
   titles ("GlossaryGlossary", "CHAPTER 1CHAPTER 1What a splat is"; Chromium prints some headings'
   text twice after a page break). Now: each link carries its page and position, a name tree is
   added, `PageMode` is `UseOutlines`, the bookmarks are "Cover and contents" then the ten chapters
   then the other chapters, closed, each with its sections, with titles made from the headings as
   written. Checked in Chromium 141's own PDF viewer (headless, new mode): a click on a contents
   entry lands on that chapter's page, and the outline pane lists the chapters.
6. **Brave's page count: checked, not reproduced.** The PDF is well formed: pdf-lib and pypdf load
   all 153 pages, `pdfinfo` reports 153, `pdftoppm` renders every page without a warning, the page
   tree and the 131 destinations all resolve, and two builds are byte-identical. No `qpdf` here. The
   likeliest cause is Brave counting pages as it loads them: the file is 7.6 MB and not linearized, so
   a viewer that reads it from the network can show a smaller count at first. The number in the
   toolbar settles at 153 once the file has loaded.
7. **Wording: done.** index.html (and all.html): "primarily splat based, but not entirely. Two honest
   exceptions:" and the two exceptions as a two-item list (sentences unchanged). "not only" became "not
   entirely" in built.html ("primarily splat based, not entirely:") and photo3d.html ("not entirely
   splat-based"). 8. splat.html: "Do not mix them up" deleted; the sentence now ends "(Figure 1):".

Specs: see "For the Operator". Screenshots: `tests/screenshots/man9-*.png` (390x844 and 1440x900).

## Notes

- Demo file: one file for five demos (`demos6.js`) keeps one import to remember. The QR and file demos
  load their lab code with `import()` only on a page that has the demo.
- The depth demo's picture and depth are made by hand in the file; the text says so. It is not a
  model's output and nothing in it claims to be.
- `src/viewers/splat-ops.js` and `src/qr-lab/*.js` are used as they are (no engine changes).
- The PDF is 7.6 MB (ln's bound is 8 MB), 153 pages. The build prints a count of the links it fixed
  and stops if a link points at a place that is not there.

## Known issues

- The links to `example-recipe.js` and `../site/learn/can-do/` open a new tab (they leave the manual).
  The PDF link too.
- The QR demo counts codewords on the modules; "it scans" means they can be repaired, not that a phone
  camera read it (the text says so).
- Brave's page count: see item 6 (not reproduced).

## For the Operator

READY after the owner's "good" marks on the man9 cards. Cards (Effect review page 2, lane
`ManualR9`, built by Sonnet 5.5): man9-moving, man9-depth, man9-table, man9-qr, man9-file,
man9-qr-row, man9-more-pics, man9-pdf-contents.
