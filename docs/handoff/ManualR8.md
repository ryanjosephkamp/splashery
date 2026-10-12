# Lane Manual r8 (prefix `man8`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_011WeiHJ3ygHhoTrrJiThHzX). Repo: ryanjosephkamp/splashery. Your lane: Manual r8 (id
`ManualR8`, prefix `man8`). Branch: `claude/lane-manual-r8` from main. PR title: "Phase Manual r8:
the third audit's fixes". Handoff file: docs/handoff/ManualR8.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/handoff/ScienceR3.md ("How this lane runs"),
docs/handoff/ManualR6.md, ManualR7a.md, ManualR7b.md and ManualR7c.md, then the report:
docs/audits/manual-audit-2026-10-r3/REPORT.md (Codex task 36, merged October 12, 2026). If the
report is not on main yet when you start, `git fetch origin main` until it is (the Operator is
merging it now).

### Brief (written by the Operator on October 12, 2026)

The third audit found 48 problems: none high, 18 medium, 30 low. Fix every finding that is a factual
or functional error, changing as little as possible. The owner holds all rewording for his own pass
after this round, so:

- **Correct, don't rewrite.** Change only the words a fix needs. List every sentence you change
  (page, old, new) in the handoff under "Changed sentences", so the owner can see them in his pass.
- **Phrasing-only findings go to the owner, not to you:** F18, F20, F22, F32 and F36 (as far as they
  are about wording rather than a wrong fact), and the gallery's "pass with qualification" notes.
  List them in the handoff under "For the owner's rewording pass", one line each in your own words.
  If one of them also contains a factual error, fix only the fact.
- **Code inside manual/:** F05, F41 and F42 (demo-math.js, railroad.js, fold.js, redirect.js,
  build-pages.mjs). F41 (every manual link opens in a new tab) is the owner's own requirement from
  the task: do it. F42 (old `#level-N` style anchors): check git history for which anchors ever
  existed and were linked; add aliases only for those, and say which you found.
- **Stills:** F09 and F24 to F27 need regenerated stills (tools/manual-stills.mjs, manual/img/).
  Regenerate only those.
- **The Learn pages (F33 to F40):** their sources are tools/site-hubs.mjs, docs/SCENE-SCHEMA.md and
  docs/FLUIDS.md; site/ is generated from them. You may edit those sources for these findings only
  (no Site lane is running), then rebuild with `node tools/site-build.mjs`,
  `npx prettier --write site` and `node tools/site-build.mjs --check`. Fix facts only, as above.
- **References 12 and 17** have no link: add the right one if a stable one exists.
- **The PDF:** rebuild it last with `tools/manual-pdf.mjs` (Chromium 141 is pinned;
  `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium`), so man5's byte-for-byte test stays green and
  ln:333 stays under its bound.

You own the manual's pages, demos, stills and print styles as these fixes need,
`manual/tinkerers-manual.pdf`, the three Learn-page sources above (these findings only) and the
site/ files they generate, `tests/man8*.spec.mjs` if you add tests, and your handoff file. Don't
edit other lanes' tests; if a manual test must change because a fact changed, say which and why. No
engine changes.

Specs to run before READY: ln, man, man2, man3, man3-2, man4, man4-pages, man5, man6, man7a, man7b,
st2, site, spg, tpg, plus any man8 spec. Run them one Playwright run at a time (two runs share port
4173 and test each other's trees).

Cards: one before-and-after card per visibly changed still or Learn page section, at phone size, on
Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids man8-…, naming Sonnet
5.5, as docs/OPERATING.md, "Steps for a lane", says (no republish). The manual is public, so the
Operator merges after your specs pass and the owner's "good" marks on your cards.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). Finish every working turn with "READY:", "WORKING:" or
"BLOCKED:" (the Operator reads it; never ask the owner). Before READY, run CLAUDE.md's "Before every
push" steps for your files. When main moves, merge it into your branch (never rebase). Usage is
tight until the weekly reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers; aim for READY
within about three hours. The owner's own notes are private: never quote them in the repo, a PR or a
card.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. October 12, 2026. Work in progress: the fixes
are in; the specs, the PDF, the cards and the PR text are being finished.

Fixed (facts only): F01 to F17, F19, F21, F23 to F31, F33 to F35, F37 to F48. F05 (demo-math.js:
`flat` is now only rounding-level, so `diag(1e-13, 1)` is valid and thin). F41 (build-pages.mjs adds
`target="_blank" rel="noopener"` to every link, including the contents button, the pager, citations,
the railroad boxes in railroad.js and the glossary pop-up in fold.js; on all.html a link to a place
on the same page stays as it is). F42 (see Notes). F43: links added for references 12 (the
author-hosted XPBD paper) and 17 (the Open Library record of the 2nd edition). Stills: F09
(pic-uq-anything.webp, photo panel with `view: "splats"`; the night-sky panel kept from the old
picture, since the sky follows the clock), F24 (walnut cut open) and F25 (book open) regenerated
with tools/manual-stills.mjs (new `tap`, `tapWait`, `zoom` keys), F26 and F27 by alt text (the toy
shows splats or wireframe, not both, and the toolkit's numbers are a panel, not the stage).

## Notes

- F42: the git history has `#splat`, `#toy`, `#language`, `#gallery`, `#pictures`, `#moving`,
  `#data` (already redirected), `#level-map` (the old cover's level map, gone on purpose; tests/man3
  and man4-pages say so, so no alias) and the grammar demo's `#rr-<rule>` ids (twelve rules, drawn
  at runtime on language.html; now in redirect.js). No `#level-1` to `#level-10` ever existed, so
  there are no aliases for them.
- F30: only the claim was corrected ("The main terms"); the eleven missing entries are for the
  owner.
- F40: the About page (tools/site-hubs.mjs, "Everything is open licensed") says the same thing as
  the Learn page; left alone, since the report names only the Learn page.
- F08: hands-on physics was taken out of the lazy box; it is not drawn in the program layer.
- Tests changed: tests/ln.spec.mjs (the allowed-link list gets the two new reference links);
  tests/man4-pages.spec.mjs (the contents button's links now open in a new tab, as the owner's rule
  says, so the test follows the popup).
- src/equation-gallery.json (descriptions only, no app code) is the source of the gallery cards for
  F07 and F44 to F48; the cards are rebuilt with manual/build-gallery.mjs.

## Known issues

- Judgment call: same-page `#x` links in chapter pages also open in a new tab (F41, "every link").
  One line in `newTab` (build-pages.mjs) changes it.

## For the Operator

Not READY yet.

## Changed sentences

| Finding | Page                                                            | Old                                                                                                                           | New                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01     | manual/language.html                                            | Each field can be up to 240 characters long.                                                                                  | Each expression can be up to 240 characters long (each end of a range counts on its own).                                                                                                                                                                                    |
| F01     | manual/language.html                                            | (a field may be 240 characters,                                                                                               | (an expression may be 240 characters,                                                                                                                                                                                                                                        |
| F01     | manual/language.html                                            | the longest possible link grows                                                                                               | a link with every field at the limit grows                                                                                                                                                                                                                                   |
| F01     | manual/gallery.html                                             | 12 fields, 240 characters each (these                                                                                         | 12 fields, 240 characters to an expression (each end of a range counts on its own; these                                                                                                                                                                                     |
| F01     | manual/card.html                                                | At most 240 characters a field.                                                                                               | At most 240 characters an expression (each end of a range counts on its own).                                                                                                                                                                                                |
| F02     | manual/built.html                                               | The Wikipedia book, the earthquakes toy, and the molecule viewer's fetch                                                      | The earthquakes toy and the molecule viewer's fetch                                                                                                                                                                                                                          |
| F02     | manual/built.html                                               | they fetch data (an article, a feed, a structure)                                                                             | they fetch data (a feed, a structure)                                                                                                                                                                                                                                        |
| F03     | manual/splat.html                                               | and it is how Splashery draws every toy.                                                                                      | and it is how Splashery blends its splats (the cover lists the exceptions).                                                                                                                                                                                                  |
| F04     | manual/splat.html                                               | Today: 140,000 splats, 2x phone                                                                                               | Mid base budget 140,000 splats, 2x phone (September 29, 2026)                                                                                                                                                                                                                |
| F04     | manual/splat.html                                               | High tier: 200,000 splats                                                                                                     | High base budget 200,000 splats, 2x phone                                                                                                                                                                                                                                    |
| F04     | manual/splat.html                                               | measured; the rest are in <code>docs/lab/SHARPNESS.md</code>.                                                                 | measured; the rest are in <code>docs/lab/SHARPNESS.md</code>. The splat counts are base budgets, not counts of splats drawn, and the cap on the screen's pixel ratio was 2 on Mid and High that day; it is 3 now.                                                            |
| F06     | manual/splat.html                                               | Auto also steps down while you play: when frames                                                                              | Auto also steps down while you drag or paint (an animation alone does not trigger it, by default since September 29, 2026): when frames                                                                                                                                      |
| F08     | manual/built-data.js                                            | "games, liquids, physics, live input"                                                                                         | "games, liquids, live input"                                                                                                                                                                                                                                                 |
| F10     | manual/pictures.html                                            | and this device remembers it. A recipe can opt out                                                                            | and this device remembers it (on a toy that holds still, such as an object or an instrument, your choice lasts only for that toy during your visit). A recipe can opt out                                                                                                    |
| F11     | manual/photo3d.html                                             | It takes the first 8 seconds of a video, or a GIF's frames, at up to 12, 15, or 24                                            | For a GIF (its first 8 seconds) or a video of 8 seconds or less, it takes the frames at up to 12, 15, or 24                                                                                                                                                                  |
| F11     | manual/photo3d.html                                             | are cut clean. It has the Sharp view too.                                                                                     | are cut clean. A video longer than 8 seconds plays whole instead: its depth is worked out a few times a second, in order, while it plays, with the frames between blending the stored depth pictures, and its colors come from the playing video. It has the Sharp view too. |
| F11     | manual/card.html                                                | <td>First 8 seconds</td>                                                                                                      | <td>8 seconds for a GIF or a short clip (a longer video plays whole)</td>                                                                                                                                                                                                    |
| F12     | manual/photo3d.html                                             | the videos themselves are not shipped, only the trained splats and the camera path.                                           | the full videos are not shipped, only the trained splats, the camera path, and a short cropped clip of each (for Show the original).                                                                                                                                         |
| F13     | manual/moving.html                                              | and is capped at 4 toy radii per second.                                                                                      | and its base speed is capped at 4 toy radii per second (the toy's material then scales it, so a baseball or a paper plane can reach 5).                                                                                                                                      |
| F13     | manual/moving.html                                              | The fastest throw. Slower than 0.4                                                                                            | The base cap on a throw, before the material scales it (up to 5 radii/s). Slower than 0.4                                                                                                                                                                                    |
| F13     | manual/card.html                                                | <td>26 and 4 toy radii per second (squared for gravity)</td>                                                                  | <td>26 and 4 toy radii per second (squared for gravity); 4 is the base cap, and a material can scale a throw to 5</td>                                                                                                                                                       |
| F13     | manual/card.html                                                | Hands-on: gravity, fastest throw                                                                                              | Hands-on: gravity, throw cap                                                                                                                                                                                                                                                 |
| F14     | manual/moving.html                                              | before it counts as a pick-up, and a drag shorter than 24 pixels only <i>nudges</i> the toy, so a tap                         | before it counts as a drag. On a whole toy, a drag shorter than 24 pixels only <i>nudges</i> it (a toy made of pieces, joints, or soft parts is picked up at 7 pixels), and a throw needs at least 24 pixels of travel, so a tap                                             |
| F14     | manual/moving.html                                              | A drag shorter than this pushes the toy and never picks it up.                                                                | A drag shorter than this only pushes a whole toy (pieces, joints, and soft parts are picked up at 7 px). A throw needs at least this much travel.                                                                                                                            |
| F15     | manual/moving.html                                              | instead of computing forces and integrating them, each step moves the bodies                                                  | each step first predicts where the bodies go from their velocities and gravity, then moves them                                                                                                                                                                              |
| F16     | manual/data.html                                                | so the viewer never keeps more than about 32 MB.                                                                              | so the density grid it keeps is never more than about 32 MB (16 MB on a phone-sized device). Reading the file and drawing the splats use more memory besides.                                                                                                                |
| F17     | manual/make.html                                                | does its work in a worker, and shows                                                                                          | does its work on your device (some tools in a worker), and shows                                                                                                                                                                                                             |
| F19     | manual/codes.html                                               | and the alive wave keeps the gray values a reader sees unchanged, so every frame of it still scans.                           | and the alive hue waves keep the gray values a reader sees unchanged (the electric patterns brighten dark modules by a bounded amount), so every frame of it still scans.                                                                                                    |
| F21     | manual/codes.html                                               | JSON, compressed with raw deflate and written with                                                                            | JSON, compressed with raw deflate (a <code>d.</code> link; a browser that cannot compress writes an uncompressed <code>j.</code> link instead) and written with                                                                                                              |
| F23     | manual/data.html                                                | One splat each, sized by brightness and colored by temperature.                                                               | Each displayed star gets a main splat, sized by brightness and colored by temperature, and the brightest also get a larger halo splat.                                                                                                                                       |
| F24     | manual/data.html                                                | alt="A walnut, drawn from a CT scan, with its wrinkled shell and a cut face"                                                  | alt="A walnut, drawn from a CT scan and cut open, showing the folded kernel inside its shell"                                                                                                                                                                                |
| F25     | manual/codes.html                                               | alt="An open book whose pages show text, standing on a table"                                                                 | alt="An open book: the inside of the cover on the left and a page of text on the right"                                                                                                                                                                                      |
| F26     | manual/make.html                                                | alt="A 3D model turned into splats, shown with a wire mesh beside it"                                                         | alt="A 3D model of a burger turned into splats"                                                                                                                                                                                                                              |
| F27     | manual/make.html                                                | alt="The Splat toolkit showing a splat file with its numbers"                                                                 | alt="Two views of a cactus splat scene on the Splat toolkit's stage"                                                                                                                                                                                                         |
| F28     | manual/photo3d.html                                             | 30,000 splats, within 8 minutes.                                                                                              | 30,000 splats, with at most 8 minutes of training (it keeps what it has by then; preparing the frames and cameras takes extra time).                                                                                                                                         |
| F29     | manual/glossary.html                                            | <b>SOG</b> is the smallest and keeps base colors only.                                                                        | <b>SOG</b> is the smallest and can keep view-dependent color (Splashery's Splat toolkit writes it with base colors only).                                                                                                                                                    |
| F31     | manual/glossary.html                                            | The level (L, M, Q, or H) sets how many: about 7, 15, 25, or 30 percent of the codewords.                                     | The level (L, M, Q, or H) sets how much damage it can repair: about 7, 15, 25, or 30 percent of the codewords lost.                                                                                                                                                          |
| F30     | manual/glossary.html                                            | Every term a newcomer meets in Chapters 1 to 10, in                                                                           | The main terms a newcomer meets in Chapters 1 to 10, in                                                                                                                                                                                                                      |
| F34     | Learn page (tools/site-hubs.mjs)                                | is the smallest piece of every toy here.                                                                                      | is the smallest piece of nearly every toy here.                                                                                                                                                                                                                              |
| F33     | Learn page (tools/site-hubs.mjs)                                | First it <strong>sorts</strong> them by distance from you, farthest first.                                                    | First it <strong>sorts</strong> them by depth along the way you are looking (one depth for each splat's center), farthest first.                                                                                                                                             |
| F34     | Learn page (tools/site-hubs.mjs)                                | no hard polygons, no textures, just blended color. It also                                                                    | for the splats themselves there are no hard polygons and no textures, just blended color (a few toys add a textured picture view, a liquid surface, or a solid mesh, which the Tinkerer's Manual lists). It also                                                             |
| F35     | Learn page (tools/site-hubs.mjs)                                | loads well under 30 MB in all; even the heaviest scan is about 8 MB (the engine plus one file).                               | loads under 30 MB in all (the engine plus one file).                                                                                                                                                                                                                         |
| F37     | Learn: Scene format (docs/SCENE-SCHEMA.md)                      | `#rrggbb` colours or short lower-case words.                                                                                  | `#rrggbb` colours, short lower-case words, or printable text of up to 24,000 characters, kept as typed (the equation and QR toys' input).                                                                                                                                    |
| F38     | Learn: Scene format (docs/SCENE-SCHEMA.md)                      | splats, 2,000 to 300,000 (clamped to 120,000 on weak devices).                                                                | splats, 2,000 up to the tier's ceiling (clamped to 120,000 on Low, 240,000 on Mid, 300,000 on High, and 400,000 on Max).                                                                                                                                                     |
| F39     | Learn: Fluids in toys (docs/FLUIDS.md)                          | draws them as one extra splat layer, one splat per particle, sorted with the toy.                                             | draws them as one extra splat layer (four small splats for each liquid particle, one for each other particle; with WebGPU a liquid can also be drawn as a surface and a gas as a grid), sorted with the toy.                                                                 |
| F39     | Learn: Fluids in toys (docs/FLUIDS.md)                          | One splat per particle, in a layer with its own                                                                               | One splat per particle (four for a liquid, below), in a layer with its own                                                                                                                                                                                                   |
| F40     | Learn page (tools/site-hubs.mjs)                                | every picture, scan and sound is public domain or under a Creative Commons license that allows it here, and each is credited; | every picture, scan and sound is public domain, under a Creative Commons license that allows it here, or one of the owner's labeled AI-made samples, and each is credited;                                                                                                   |
| F44     | Gallery card (src/equation-gallery.json, shown on gallery.html) | This immersed Klein bottle crosses itself where its neck passes through the body.                                             | This immersed Klein bottle is a figure-eight tube that crosses itself along a ring.                                                                                                                                                                                          |
| F46     | Gallery card (src/equation-gallery.json, shown on gallery.html) | A simple polynomial surface curls into three spreading lobes.                                                                 | A simple polynomial surface curls into spreading lobes.                                                                                                                                                                                                                      |
| F48     | Gallery card (src/equation-gallery.json, shown on gallery.html) | A ruled helicoid spirals upward like a ramp with no outer rim.                                                                | A finite ruled helicoid patch winds like a ramp around the Z axis, with a helical edge on its outer rim.                                                                                                                                                                     |
| F47     | Gallery card (src/equation-gallery.json, shown on gallery.html) | Three harmonics trace a closed, crossing space curve with a fine bead tube.                                                   | Four frequencies (2, 3, 4, and 7) trace a closed space curve that crosses itself, with a fine bead tube.                                                                                                                                                                     |
| F45     | Gallery card (src/equation-gallery.json, shown on gallery.html) | A spring winds upward in eight turns with a narrow tube around its wire.                                                      | A spring winds upward in eight turns as a narrow ribbon.                                                                                                                                                                                                                     |
| F07     | Gallery card (src/equation-gallery.json, shown on gallery.html) | One loop circles the center while a smaller wave on it turns the other way three times as fast.                               | One loop circles the center while a smaller wave on it, with three times as many crests around the loop, turns the other way.                                                                                                                                                |
| F47     | Gallery card (src/equation-gallery.json, shown on gallery.html) | "title": "Lissajous knot"                                                                                                     | "title": "Lissajous curve"                                                                                                                                                                                                                                                   |
| F43     | manual/references.html                                          | 2016, pp. 49–54.                                                                                                              | 2016, pp. 49–54. <a href="https://matthias-research.github.io/pages/publications/XPBD.pdf" target="_blank" rel="noopener">matthias-research.github.io/pages/publications/XPBD.pdf</a>                                                                                        |
| F43     | manual/references.html                                          | Willmann-Bell, 1998. (A book; no link.)                                                                                       | Willmann-Bell, 1998. (A book; the link is its catalog record.) <a href="https://openlibrary.org/isbn/9780943396613" target="_blank" rel="noopener">openlibrary.org/isbn/9780943396613</a>                                                                                    |

Also changed without a sentence: the Further reading (none), the alt text of the five stills above
(F09, F24 to F27 are in the table), the references' link lines (F43).

## For the owner's rewording pass

- F18: the Studio table also lists the Molecule viewer (Atoms) and Your book (Pictures), so "a
  shelf" is loose.
- F20: the QR toy requests level M but raises it when more fits the same size; "uses level M" could
  say so.
- F22: the 60 and 200 MB file warnings are binary megabytes (MiB).
- F32: the Quick reference rows "Splats a device is asked for", "Splats of an equation toy" and
  "Moments of t" are a base budget and ceiling, a programmed count and a default (12 to 15 on
  offer).
- F36: "about 12 KB" for a long link is 12,288 characters of encoded scene (manual and the Learn
  pages).
- The gallery's "pass with qualification" notes (programs 14, 20, 29, 30, 35, 36, 39 to 44, 48, 58,
  62, 68, 70, 72): captions that are true but loose; see the report's gallery table.
- F30: eleven terms with no glossary entry (matrix inverse, positive definite, eigenvector,
  eigenvalue, determinant, anti-aliasing, lever, substep, CT, MRI, spectrogram), plus parametric
  surface and radian.
