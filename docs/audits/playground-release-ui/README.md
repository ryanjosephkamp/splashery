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
landscape, the shelf scrolls within its own space above the full tool row and the settings pane. All
existing 44-pixel control minimums remain.

## Pinning the first toy

Use `/?first-toy=cactus` to make the app start with a specific available toy. It can be combined
with `renderer=webgl2`, `profile=weak`, and `labs=0` or `labs=1`. An unknown ID or a labs-only ID
when labs is off is ignored; the app chooses a random visible Featured toy. The pin applies only to
the default app scene. A valid `#s=` scene takes precedence, loading scene JSON still restores that
scene, and iframe and custom-element defaults remain unchanged.

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

## Verification

The PR records the final command results. Playwright runs a real Chromium at `/usr/bin/chromium`
with the repository's SwiftShader launch flags. Browser control tools are unavailable in this
session; the task explicitly calls for Playwright. No renderer, scene, toy, or thumbnail is mocked
for the release checks or screenshots. The existing smoke checks include their existing fixtures.
The full repository suite remains for the Operator's merge PR, as the task directs.
