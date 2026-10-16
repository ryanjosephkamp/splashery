# Playground release UI: task 91

Made by Ryan with Codex (GPT-6), on October 16, 2026. Status: implemented for review on
`codex/playground-release-ui`. Rule check: none.

The shelf uses content-sized grid rows, and search counts only toys available in the current labs
mode. Featured is a virtual chip immediately after All, backed by the owner's exact 64 IDs in
`src/featured.js`. It shows 25 toys with labs off and all 64 with labs on. Category IDs and labels
stay unchanged; the exported category order also drives All and the regenerated site catalog.

Play and zoom have separate positions. The phone canvas starts below the visible caption and
controls, which hide while the drawer is expanded. At 320 × 568, the tools wrap without shrinking
their targets, and the compact settings drawer leaves the shelf to the row and grid views. In
landscape, the shelf scrolls within its own space above the full tool row and the settings pane.
Search opens from its chip in short landscape, reserving at least 160 pixels for the settings
section. All existing 44-pixel control minimums remain.

## Pinning the first toy

Use `/?first-toy=cactus` to make the app start with a specific available toy. It can be combined
with `renderer=webgl2`, `profile=weak`, and `labs=0` or `labs=1`. An unknown ID or a labs-only ID
when labs is off is ignored. Real visitors then receive a random visible Featured toy. Automated
browsers (`navigator.webdriver`) default to the first catalog toy, Cactus, so unpinned specs and
clip tools remain deterministic. Use `?first-toy=featured` to exercise the visitor's random Featured
selection in an automated browser. The pin applies only to the default app scene. A valid `#s=`
scene takes precedence, loading scene JSON still restores that scene, and iframe and custom-element
defaults remain unchanged.

## Smoke coverage

The existing smoke helper pins `first-toy=cactus`; its `labs=1` setting retains the original
full-catalog card counts and search assertions after hidden cards stop counting as results. The
explicit Detail and WebGPU app URLs also pin the default. The initial thumbnail check scrolls each
checked image into view before its existing completion assertion, because Shapes now sits farther
down the shelf and thumbnails load lazily. The pull-to-close gesture test scrolls to the list top
before the existing swipe: reopening the grid now reveals Strawberry farther down. It also asserts
that the scroll position is zero. No existing assertion was loosened. The original cactus
assumptions remain in these checks:

- Initial renderer, shelf, thumbnails, selected card, and console health.
- Category filtering, search, and Surprise me.
- Procedural generation and canvas changes.
- Importing PLY, SPLAT, SPZ, and SOG files.
- Desktop screenshots.
- Motion and returning to the captured cactus.
- Detail preference persistence.
- Responsive embed snippets.
- Phone overflow, drawer opening, tabs, and search.
- Dragging the shelf into a grid and selecting a toy.
- Opening settings while a selected toy is still loading.
- Overflow at 360 pixels.

The new release checks cover public QR search's empty state, exact chip and All ordering, exact
Featured membership and ordering, Surprise me within Featured, and fresh visits in both labs modes.
They also cover shared-scene precedence and error fallback, the default iframe toy, card contents
and neighboring rows, control boundaries and 44-pixel targets, caption separation, and expanded
phone drawers at the four requested sizes plus 1280 × 742. `tests/taps.spec.mjs` is untouched.

## Screenshot evidence

Real Chromium at `http://127.0.0.1:4173/`, using WebGL2, the weak profile, reduced motion, a pinned
cactus, and labs off. Before images are from main `5a55f5cc`; after images show this branch. The
phone All and Featured images use the expanded shelf grid. Desktop images use the panel's scrollable
grid. Featured did not exist before this change, so the before All image is its baseline. The
screenshots are PNG files; each is below 1 MB.

| Viewport   | Stage before                                    | Stage after                                   | All before                                    | All after                                   | Featured after                                      |
| ---------- | ----------------------------------------------- | --------------------------------------------- | --------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| 390 × 844  | [Before](screenshots/before-stage-390x844.png)  | [After](screenshots/after-stage-390x844.png)  | [Before](screenshots/before-all-390x844.png)  | [After](screenshots/after-all-390x844.png)  | [Featured](screenshots/after-featured-390x844.png)  |
| 1440 × 900 | [Before](screenshots/before-stage-1440x900.png) | [After](screenshots/after-stage-1440x900.png) | [Before](screenshots/before-all-1440x900.png) | [After](screenshots/after-all-1440x900.png) | [Featured](screenshots/after-featured-1440x900.png) |
| 320 × 568  | [Before](screenshots/before-stage-320x568.png)  | [After](screenshots/after-stage-320x568.png)  | [Before](screenshots/before-all-320x568.png)  | [After](screenshots/after-all-320x568.png)  | [Featured](screenshots/after-featured-320x568.png)  |
| 844 × 390  | [Before](screenshots/before-stage-844x390.png)  | [After](screenshots/after-stage-844x390.png)  | [Before](screenshots/before-all-844x390.png)  | [After](screenshots/after-all-844x390.png)  | [Featured](screenshots/after-featured-844x390.png)  |
| 1280 × 742 | [Before](screenshots/before-stage-1280x742.png) | [After](screenshots/after-stage-1280x742.png) | [Before](screenshots/before-all-1280x742.png) | [After](screenshots/after-all-1280x742.png) | [Featured](screenshots/after-featured-1280x742.png) |

Expanded settings: [390 × 844 before](screenshots/before-panel-390x844.png),
[390 × 844 after](screenshots/after-panel-390x844.png),
[320 × 568 before](screenshots/before-panel-320x568.png), and
[320 × 568 after](screenshots/after-panel-320x568.png).

Short-landscape search and settings after the follow-up:
[844 × 390](screenshots/after-search-844x390.png) and
[932 × 430](screenshots/after-search-932x430.png). The settings pane remains 112 pixels tall with
search open at both sizes.

## Verification

The final per-file results verify **363 tests across 20 files, with zero unresolved failures or
skips**. The complete run had 362 passes and one desktop `ui4` capture failure. After adding its
headless driver selection, the same full-list command reused the 19 unaffected passing reports and
verified all four `ui4` checks with a competing headed window repeatedly taking focus. The final
summary is 363 passed, zero failed, and zero skipped. Automatic retries remain disabled.

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/suite.mjs --gl=llvmpipe --jobs=2 --files=dcl,shb,mol,sts,img,ai,cdx-playground-links,scr2,ui4,ui2,lab-engine,hl1,cdx-a11y-layout,smoke,kit,taps,help,hta,unit,cdx-a11y --out=/tmp/playground-671-suite-final
```

| Spec                   | Passed |
| ---------------------- | -----: |
| `dcl`                  |     18 |
| `shb`                  |      5 |
| `mol`                  |     27 |
| `sts`                  |     18 |
| `img`                  |      9 |
| `ai`                   |     47 |
| `cdx-playground-links` |     15 |
| `scr2`                 |      6 |
| `ui4`                  |      4 |
| `ui2`                  |     11 |
| `lab-engine`           |      7 |
| `hl1`                  |      2 |
| `cdx-a11y-layout`      |     11 |
| `smoke`                |     62 |
| `kit`                  |     10 |
| `taps`                 |     62 |
| `help`                 |     14 |
| `hta`                  |      3 |
| `unit`                 |     20 |
| `cdx-a11y`             |     12 |

Playwright runs a real Chromium at `/usr/bin/chromium` with the repository's SwiftShader launch
flags. Browser control tools are unavailable in this session; the task explicitly calls for
Playwright. No renderer, scene, toy, or thumbnail is mocked for the release checks or screenshots.
The existing smoke checks include their existing fixtures. The release checks are followed by the
Operator's requested layout regression list and five-repeat load checks. The PR records their
counts.

The final load run uses the suite runner with `--repeat-each=5 --jobs=2`: 25 passed, zero failed,
zero skipped, and zero retries. It covers the four requested checks (Molecule viewer lazy loading,
recording and flag-dialog focus, focus-mode Escape restoration, and wide-screen panel and shelf
resizing), plus the immediate post-swipe phone tap. Earlier runs exposed the Molecule thumbnail
assumption, the native handle fling, and the competing headed windows described below. The final run
includes their corrections and the existing headless-renderer exception mechanism.

## Operator follow-up

The three commits from `claude/operator-fixes-671` were merged with merge commit `5eae3501`. They
retain module and data lazy-load assertions while excluding shelf thumbnails, convert the Hands-on
drag's canvas coordinates to page coordinates, and give automated browsers a deterministic default
toy. Featured-start smoke checks explicitly request `first-toy=featured`.

- `sts`, `img`, and `ai`: update the old shelf-order assumptions, asserting the exact new neighbors
  as well as the original membership, labs, sound, help, and plan checks.
- `cdx-playground-links`: fix the production settings layout in short landscape, test opening,
  filtering, and closing search, and assert the approved stage's exact top and height after
  rotation. The minimum pane height, every control's reachability, and settings persistence stay
  checked.
- `scr2` and `ui4`: add the canvas bounding rectangle to projected points before real mouse input.
  Hit counts, playback state, crossed keys, and their order remain unchanged.
- `mol`: the first load run requested only the viewer's shelf thumbnail, with no viewer module or
  structure data. Exclude that thumbnail path from the lazy-load check, matching the Operator's
  `dcl` fix; module and data requests must still be absent before the toy opens.
- `ui2` and `lab-engine`: the Operator's default-toy fix alone clears the reported checks; neither
  spec is changed.
- `hl1`: current main `5a55f5cc` passes the 40-toy regression sample in a separate worktree before
  any changes to this spec. On this branch, the Eiffel Tower's bounds center lands between lattice
  struts in the smaller phone canvas: that pixel misses, while neighboring pixels hit. Target the
  solid second-floor deck at recipe `[0, 1.15, 0]` instead. A missing GPU pick still fails, and all
  lift, throw, collision, settling, and Reset assertions remain. The Hands-on engine is unchanged.
- Phone smoke: the broad run exposed a lost More tap immediately after a handle swipe. Native
  tracing showed `GestureFlingStart` followed by `FilterTapSuppression`, with touch-down and
  touch-up on the button but no click. Consume native `touchstart` on the custom handle, which
  already uses pointer events for its own swipes and taps. Three fast-tap probes then open the
  settings, with zero native flings and zero suppressed taps. The smoke regression now sends the
  immediate real touch directly, asserts its 44-pixel target, and keeps every existing assertion. No
  delay or retry is added. Chromium's
  [tap suppression controller](https://raw.githubusercontent.com/chromium/chromium/main/components/input/tap_suppression_controller.cc)
  documents the native behavior seen in the trace.
- Panel and shelf resize: a controlled two-browser probe reproduces 511 pixels when the second
  headed window takes focus after the fifth of six mouse moves. The first page loses pointer capture
  and receives neither the last move nor pointer-up. Single-window probes reach 544 pixels. The same
  competing-window probe with the first browser headless reaches 544 pixels and finishes the drag
  normally. Add smoke to the suite's existing headless SwiftShader exceptions, so concurrent headed
  windows cannot interrupt its input on Actions. All resize assertions and the production resize
  handler remain unchanged. The initial release-point hypothesis was ruled out by this probe.
- `ui4` also uses captured pointer input. The full run's desktop glissando stopped after its upward
  segment (`[39, 41, 43, 44, 46, 48]`) when the competing headed window interrupted capture. Add it
  to the same headless exceptions. A controlled glissando reproduces those six notes with
  interrupted capture; headless completes all 15 notes up and back. All four checks pass with a
  competing headed window repeatedly taking focus, using the original key-count, key-order, and
  camera assertions. The full run's other 19 passing file reports remain valid: this harness change
  affects only the driver selected for `ui4`.

The initial focused validation overlapped a run that owned its temporary web server; when that run
ended, subsequent navigations failed with `ERR_CONNECTION_REFUSED`. Validation now uses a persistent
server. No assertion was relaxed, no automatic retry was enabled, and `tests/taps.spec.mjs` remains
unchanged.
