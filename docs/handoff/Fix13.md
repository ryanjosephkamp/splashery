# Fix13: Pop out with Pop-up layers, two flaky tests, and the scene-file wording

## Brief

You are a Splashery worker session (lane "Fix13", prefix `fx13`), started by the Operator
(session_01R85mwsFf138ohESofkyPJu) for the owner, Ryan. Model: Opus 5.5, high effort. Repo:
ryanjosephkamp/splashery. Branch: `claude/lane-fix13` (and `claude/lane-fix13-engine` for a small,
additive "Engine: …" PR if a fix belongs in the engine; it merges first). PR title: "Phase Fix13:
Pop out with pop-up layers, two flaky tests, and the scene-file wording". Handoff file:
docs/handoff/Fix13.md (this brief word for word under "## Brief", then "## State", "## Notes", "##
Known issues", "## For the Operator").

Read CLAUDE.md, docs/HANDOFF.md "Now", docs/OPERATOR.md ("Local test runs", "Known flaky tests"),
docs/CI.md, docs/handoff/Fix12.md (the last lane that did this kind of job, and how), and
docs/handoff/Share.md ("For the Operator").

### The job (Ryan's "Fix13 go", October 15, 2026)

1. **Pop out doesn't work when Pop-up layers is on.** In the Picture lab, the photo album, and Your
   book, turning on Pop-up layers and then tapping Pop out does nothing (or not the right thing).
   Reproduce it at 390×844 and 1440×900, find the cause, and fix it so Pop out works the same with
   Pop-up layers on as with it off, without changing anything else about those toys (they are public
   and Ryan has marked them good). Add a test in `tests/fx13.spec.mjs` that fails before and passes
   after. Post a clip of each of the three toys (Pop-up layers on, then Pop out) at phone size on
   Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids `fx13-<toy id>`,
   naming Opus 5.5, as docs/OPERATING.md "Steps for a lane" says (no republish). These are public
   toys: they merge only after Ryan marks the clips good.
2. **`tests/math.spec.mjs:368`** ("the surface plotter plots a typed surface"): it failed alone on
   GitHub Actions on main (cb8a8315) and on #662's run, passed on #663's run, and passes in the
   cloud container on SwiftShader and llvmpipe. Intermittent, on Actions only. Find the cause (a
   race, a wall-clock check, a slow first compile under load; try `--repeat-each` and a CPU throttle
   through CDP `Emulation.setCPUThrottlingRate`) and fix it at the cause: in the toy if the toy is
   wrong, in the test only if it waits on the wrong signal.
3. **`tests/hh5-gems.spec.mjs:119`** (the crystal ball rolls off the stand's base and settles back
   in its cup): it fails under load and passes alone. Same approach: reproduce under load, fix the
   cause, keep the motion Ryan approved exactly as it is.
4. **The scene-file wording** (the Share lane's leftover): "Save JSON" becomes "Save scene" and
   "Load JSON" becomes "Open a scene" everywhere a visitor still sees them: at least
   `src/qr/share.js` (lines 113, 119, 121) and `src/exports.js` (297, 310), and the site pages that
   mention them (`site/share/`, `site/learn/scene-format/`; regenerate site/ with
   `node tools/site-build.mjs`, never by hand). Match the buttons' real labels in the app. Change
   words only; keep ids and anything stored in links or saved scenes. Update any test that reads the
   old words.

Rules: never skip, disable, quarantine or `test.fixme` a test, never add retries, never loosen a
threshold without showing the measured value is right, never edit `tests/taps.spec.mjs`. Don't touch
the Photo to 3D checkpoint files (docs/studio/photo-3d-checkpoint.md lists them). Codex PRs are open
on Picture QR (#641, #656) and exports (#654): keep your changes small and say exactly which lines
you touch.

How this lane runs: finish every working turn with "READY:", "WORKING:" or "BLOCKED:" (the Operator
reads it; never ask Ryan directly). For a long job, schedule a check-in with send_later instead of
going idle. Run CLAUDE.md's "Before every push" steps (the targeted specs plus your own; the full
suite runs on GitHub Actions once the Operator adds the `full-suite` label or batches your PR). When
main moves, merge it into your branch (never rebase). Open your draft PR early. In the PR's Summary,
give each item's root cause, the fix, and the run that shows it green. Aim for a first READY within
about four hours.

## State

Model: Opus 5.5 (claude-opus-5-5), high effort. Branch `claude/lane-fix13` from main at `c13a9d3f`
(#663). No engine change, so no `-engine` branch.

1. **Pop out with Pop-up layers: the toy (`src/packs/pictures.js`, `pgSheets`).** With layers on, a
   figure uses the pop sheets of its layers. A graphic (a chart, a diagram, text) has two layers
   (the card and its shapes), so the drive leaves the third sheet unasked (`{ page: -1 }`). The
   engine never calls a sheet with no page ready (`src/pictures.js`, `ready`: `want` is null), and
   `pgSheets` listed all three for a figure in layers, so the figure waited in "prep" for the third
   sheet forever and never rose. The Picture lab's sample (a chart) and Your book's charts and
   diagrams did nothing. Fix: `pgSheets` lists only the layers the figure has (`pgLayer` is null for
   an unused one). A photo (always three layers) and every figure with layers off are unchanged. The
   album's photos rose with layers on in every repro here (390×844 and 1440×900; `profile=mid`,
   `weak` and the default), before and after the fix; see "For the Operator". Test:
   `tests/fx13.spec.mjs` (Node, the lab and the book with a chart, with stand-in pictures whose
   `ready` follows the engine; and the app, the lab's own sample at 390×844, screenshots at both
   sizes). On plain main: the 3 fail (Node: phase "prep", expected "up"; app: the same). With the
   fix: 3 pass.
2. **`math:368`: the test waited on the wrong signal.** After the first "Plot it", the scene's
   options change at once, but the toy rebuilds for 10 to 25 s here (measured), and only then is the
   Toy panel drawn again, with a new, empty input box. The test typed "z = t" into whichever box was
   up: on a slow runner the rebuild landed between the typing and the click, so "Plot it" read the
   new, empty box: "there is nothing to draw", the Actions error word for word. Typing into the old
   box and letting the rebuild replace it reproduces that error every time. Fix: the test waits
   until the typed surface is plotted (`.input-shown` says "Your surface: z = sin(x)*cos(y)*a"), as
   the graph plotter's test already does, then types the bad one. The check is as strict as before,
   and it now also checks the surface was plotted.
3. **`hh5-gems:119`: the test read one state across two frames.** It read the parts and the ball's
   place in two `page.evaluate` calls. The app's own frames keep running while the ball rolls; under
   load one lands between the two reads (dt 0.1 s, the ball moves about 0.33), so the mist looked
   0.33 off the ball (Actions: 0.3285). Instrumented here at a 6× CPU throttle: after every frame
   the mist and the ball agree exactly (gap 0), and the one failing run had a frame between the
   reads that moved the ball 0.3254, which was the gap. The toy and its motion are unchanged; the
   test reads both in one evaluate, with the same 1e-6 bound.
4. **The scene-file wording.** "Save JSON" is now "Save scene" and "Load JSON" "Open a scene" (the
   real labels of `#export-json` and `#import-json` in index.html) in `src/qr/share.js` (the "didn't
   read back" line, the too-long line, and the `#sqr-json` button's text), `src/exports.js` (the
   three link notes, the clay one included), `tools/site-hubs.mjs` (site/share/),
   `docs/SCENE-SCHEMA.md` (site/learn/scene-format/), and `README.md`; site/ rebuilt with
   `node tools/site-build.mjs`. Ids, links and saved scenes are untouched.
   `tests/qr4-2.spec.mjs:123` has the new words in its title and now checks the button's text and
   the "Open a scene" line.

## Notes

- Lines touched: `src/packs/pictures.js` `pgSheets` and its comment (about lines 1267 to 1276);
  `src/qr/share.js` 113, 119, 121; `src/exports.js` 297, 303, 310; `tools/site-hubs.mjs` 693;
  `tests/math.spec.mjs` (one wait added in the 368 test); `tests/hh5-gems.spec.mjs` (the first read
  in the 119 test); `tests/qr4-2.spec.mjs` (the 123 test's title and two checks).
- Runs (cloud container, SwiftShader, one worker): fx13, pg6, bk5 and pg6-engine together, 36 of 36
  passed (21.9 min). `math:368` `--repeat-each=4`: 4 of 4. `hh5-gems:119` at a 6× CPU throttle,
  `--repeat-each=6`: 6 of 6 (the old test also passed 6 of 6 there; the interleaving is rare, and it
  showed in 1 of 4 instrumented runs).

## Known issues

- Typing into a toy's input box while that toy rebuilds still loses the text: the whole Toy panel is
  drawn again when the build ends (`src/ui.js`, `renderToyPanel`). The test no longer depends on it;
  the app's behavior is unchanged (see "For the Operator").

## For the Operator

- The album: its photos rose with Pop-up layers on in every repro here, before and after the fix. If
  Ryan saw it fail there, his exact steps would help (a PDF opened in the album? a second photo
  tapped while one stood up?).
- The manual still says "Save JSON" (`manual/share.html` 276 and 284, `manual/all.html` 9842 and
  9850, `manual/demos3.js` 115). Left alone: changing it makes the shipped manual PDF stale
  (man5:201). It can ride with the next manual edition.
- An engine follow-up, if wanted: keep the input box's text (and its message) when the Toy panel is
  drawn again after a rebuild.
