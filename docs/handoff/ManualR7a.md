# Lane Manual r7a (prefix `man7a`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01Mo8sLhAitbYjZiPgD8Hc4t). Repo: ryanjosephkamp/splashery. Your lane: Manual r7a (id
`ManualR7a`, prefix `man7a`). Branch: `claude/lane-manual-r7a` from main. PR title: "Phase Manual
r7a: crisp demos and pictures for every page". Model: Sonnet 5.5, at high effort. Brief written by
the Operator on October 11, 2026, from the owner's manual walkthrough: (1) every demo crisp on a
phone (a shared devicePixelRatio helper, used in every demo, tested at DPR 3); (2) Chapter 1's size
sliders s1 to s3 run 0 to 1.60 and start at 0.80; (3) Chapter 3's "Each dot on the grid is one splat
with its own (u, v)" figure moves on the web page (a still in the PDF, respects
prefers-reduced-motion); (4) Chapter 3's last demo's text is soft (check); (5) a picture for each
item of manual/more.html; (6) a visual companion for every item of manual/unique.html, easy to add
to; (7) one clear diagram for manual/built.html, an inline SVG drawn from a small data list, correct
to the code. Keep images small (webp), alt text on each, light and dark themes, no PDF rebuild (the
Operator does it after both r7 lanes merge). Owned files: manual/demos*.js, demo-math*.js,
railroad.js, fold.js, img/, make-stills.mjs, splat.html, language.html, more.html, unique.html,
built.html, an "r7a" block at the end of manual.css, tests/man7a*.spec.mjs. Specs before READY:
man*, site, spg, smoke. (The full brief is in the Operator's first message of the session; the
owner's own notes are private and not quoted.)

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Started October 11, 2026. Branch
`claude/lane-manual-r7a`.

1. **Crisp demos: done.** New `manual/crisp.js`: `crisp(canvas, redraw)` sizes the backing store to
   CSS size times `devicePixelRatio` (capped at 3 and 2400 px), scales the context so each demo
   keeps drawing in its 400-unit space, and redraws on resize and on a pixel-ratio change. A
   canvas's `width` and `height` still read the logical size inside a demo (instance getters), so
   the demos' math is unchanged. Heat maps and splat images (meant to be soft) go through
   `putSoft()`. Changed: all 14 demo canvases (g3, sn, bl, cov, pj, pj-top, bd, ut, pf, t, ss,
   ss-turn, wm, and the QR code, which is now `image-rendering: pixelated`). Tested at DPR 3 on
   splat, language, toy, and share.
2. **Chapter 1 sliders: done.** s1 to s3 run 0 to 1.60, start at 0.80; the demo's focal length went
   from 440 to 360 so the one-size shell fits the view at 1.60. At 0 the splat vanishes (singular
   covariance; the code already guards it).
3. **Chapter 3 figure: done.** `manual/demos4.js` runs a live canvas torus (the chapter's program
   through the toy's own reader) and walks a red ring across the 8-by-8 grid in step with a ringed
   splat on the torus; the grid dots take the torus colors. Reduced motion: one frame, ring still.
   Print: the photo still (`gallery-torus.jpg`) shows, the canvas hides.
4. **Chapter 3's last demo: fixed by item 1** (checked at DPR 3).
5. **more.html: done.** 11 real stills (`manual/img/pic-more-*.webp`), made by the new
   `manual/make-pictures.mjs` from the app itself.
6. **unique.html: done.** 5 stills (`pic-uq-*.webp`) and a live "link steps" figure (the real codec
   on a tiny scene). To add a picture: one entry in `PICTURES` in make-pictures.mjs, then a
   `<figure class="item-pic">` in the page (comments at the top of both).
7. **built.html: done.** `manual/built-data.js` (the data list) and `manual/demos5.js` (draws the
   SVG). The test checks every named file exists and 13 claims about the code (imports, the pack
   loader, the device order).

## Notes

- New files outside the owned list but in manual/: `crisp.js`, `demos4.js`, `demos5.js`,
  `built-data.js`, `make-pictures.mjs` (all match `demos*.js` or are new helpers).
- The page head blocks are written by build-pages.mjs (Manual r7b's), so the new scripts are loaded
  by tags in the figures' own markup, not in the head. I ran `node manual/build-pages.mjs` to
  refresh all.html and redirect.js.
- Screenshots: `tests/screenshots/man7a-*.png`.

## Known issues

- With all three sizes at 0.80 the splat starts as a sphere, so the rotation sliders show nothing
  until the sizes differ (the brief asked for equal starts).
- The Fluid lab, the piano, and the splat mirror in the pictures are stills of the toys as they open
  (the mirror has no camera).

## For the Operator

- Rebuild the PDF after both r7 lanes merge (all.html has the new figures; the torus and diagram
  print as a still and a drawn SVG).
- Cards posted on Effect review page 2 (lane `ManualR7a`): man7a-crisp, man7a-sizes, man7a-torus, man7a-built, man7a-pics-more, man7a-pics-unique. Waiting for the owner's marks.
- Expected failure until the PDF is rebuilt: tests/man5.spec.mjs "the same input and the same Chromium print the same bytes" (the shipped PDF no longer matches a fresh print, because the manual changed). Two prints of the new pages are byte-identical (the live figures stop on their first frame when printing). Everything else in man*, site, spg, and smoke passed (206 tests) before the final fixes; man5 and man7a passed again after them.
- Pictures carry no `loading="lazy"`: tools/manual-pdf.mjs waits for every image to load and would hang on a lazy one.
