# Test health: October 2026

- Codex audited `bc1fc54` with installed Chrome 154: 812 tests, one worker.
- Full runs: 797/812 and 796/812 passed; wall times 1:27:42.369 and 1:34:32.977.
- 17 tests failed across the runs; each had three fresh isolated attempts.
- Classification: 12 always fail, 3 flaky, 2 full-run only.
- Proposed patches, 25 timing entries and two coverage consolidations follow.
- Source and tests are unchanged; proposals need owning-lane validation.

## 2. Failed tests and three isolated reruns

### Method and receipts

The unchanged baseline is `bc1fc5405b8eba3cc73da10e6400e2dbff1670e6`, fetched from `origin/main`
before creating `codex/test-health`. The discovered suite has **812 tests in 79 files**, rather than
the task's approximate 750/76 (`docs/codex/03-test-health.md:6`). Both full runs used **one worker,
zero retries**, as configured at `playwright.config.mjs:16` and `playwright.config.mjs:17`.

Environment observed locally: macOS 26.3.1 (a), 12 logical CPUs, 18 GiB RAM, Node 25.2.1, Playwright
1.56.1, and the already-installed **Google Chrome 154.0.8037.95** at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. No browser or dependency was
installed. The browser arguments are the repository's SwiftShader/Vulkan settings at
`playwright.config.mjs:23`; the separate renderer probe in §3 is a later observation, not a
measurement from every test.

An existing `python3 -m http.server 4173 --bind 127.0.0.1` server was reused after confirming that
its process served this checkout. This follows the configuration's reuse setting at
`playwright.config.mjs:41`; it differs from launching a second server in
`docs/codex/03-test-health.md:10`. The server stayed running. The runs were serial, with no
additional audit-launched browser, rendering probe or isolated Playwright test competing with them:

```sh
SPLASHERY_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  PLAYWRIGHT_JSON_OUTPUT_NAME='<receipt directory>/runN.json' \
  npx --no-install playwright test --reporter=line,json \
  --output='<receipt directory>/runN-artifacts'
```

The added JSON reporter supplies per-test durations and exact outcomes; line reporting was retained
as requested at `docs/codex/03-test-health.md:12`. Command wall time includes startup, reporting and
shutdown. Test durations in §4 are Playwright's reported durations, not the command wall time. The
worker count stayed one; failures caused successive worker replacements, not parallel execution.

Each test that failed in either full run was then selected by its file and anchored, escaped
suite/title grep in **three separate serial Playwright invocations**. Each invocation selected
exactly one test and started a fresh browser. The configuration's zero retries stayed in force. The
51 isolated commands took 903.799 seconds of serial wall time (15:03.799), including command startup
and shutdown. The screen debug hook and all style overrides stayed unset for these required reruns.
A later additional screen invocation used the existing debug output hook at
`tests/scr2.spec.mjs:147`, writing raw comparison images outside the repository with all three
styles retained. Extra cause probes described in §3 are excluded from the five outcomes and §4's
timing ranking.

Local receipts (not committed):

```text
/var/folders/pv/m1k13gmn189d64ndtxdbzrjc0000gn/T/splashery-test-health-wcbs9pke/
  timings.json                 monotonic command wall times and UTC timestamps
  run1.json / run2.json         full-suite results and durations
  run1.log / run2.log           line reporter output
  runN-artifacts/               retained failure traces, screenshots and contexts
  failures.json                 isolated commands, results and wall times
  alone-NNN-R.json / .log       each fresh isolated invocation
  alone-NNN-R-artifacts/        its retained failure artifacts
  screen-probe-debug/           additional screen comparison PNGs
  classified.json               five-outcome classifications
  diagnostics.json              supplementary phone/audio/renderer measurements
  audio-rich.json               sound-call arguments and decoded readiness
  audio-resolved.json           resolved-boolean wait and first-click timing
  mirror-diagnostics.json       original/frame-end capture comparison
  embed-diagnostics.json        bounded adapter-path diagnostic
  pixel-diagnostics.json        independent raw screen-pair measurements
```

These temporary receipts are local and may be removed by the operating system. The report carries
the outcomes and timing table needed to review the audit; it does not depend on access to the
temporary directory. Source references below are actual baseline repository lines, checked against
the files. Some printed Playwright registration locations did not match those lines, so they were
not used as source locations.

`P` means passed; `F` means failed, including a timed-out assertion. Each row is **full run 1 / full
run 2 / alone 1 / alone 2 / alone 3**. "Always fails" means all five observed attempts failed, not
proof of a universal product defect. "Flaky" means mixed outcomes with at least one isolated
failure. "Full-run only" means all three isolated attempts passed and at least one full run failed;
load/order dependence is a hypothesis until identified. With zero retries, Playwright's own
`flaky: 0` statistic cannot establish absence of flakiness.

### Full-run results

| Run  | UTC start → end, October 3, 2026 | Wall time (s; h:mm:ss) | Workers | Passed | Failed | Skipped | Exit |
| ---- | -------------------------------- | ---------------------- | ------: | -----: | -----: | ------: | ---: |
| run1 | 02:45:50 → 04:13:32              | 5262.369; 1:27:42.369  |       1 |    797 |     15 |       0 |    1 |
| run2 | 04:13:32 → 05:48:05              | 5672.977; 1:34:32.977  |       1 |    796 |     16 |       0 |    1 |

SHA-256 of the full JSON receipts:

```text
run1.json  978060662f7696d1f61b670c77d633d131d3e286e2998b9acc9bc3dffa894523
run2.json  f83462bc930cecfd11a082cfb73b34ebfd311f75930f9ad2e3952daf85ea3315
```

### Always fails: all five attempts

| Test and actual source                                                                                                         | Full 1 / 2; alone 1 / 2 / 3 | First error line                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------- |
| `tests/smoke.spec.mjs:415` — `bring-your-own PLY, SPLAT, SPZ and SOG files load in the browser`                                | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:438` — `PNG, GIF and WebM exports produce files`                                                         | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:470` — `desktop screenshot at 1440x900`                                                                  | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:516` — `a kit toy loads from its pack, and its action and a tap open and close it`                       | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:542` — `a kit toy can change shape: the red blood cell curls into a sickle (morph)`                      | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:559` — `toys move by themselves once motion is on, and any toy can bounce`                               | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:587` — `patterns and flags recolour any toy and travel in the link`                                      | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:619` — `an old version 2 share link still opens`                                                         | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:1500` — `dragging the shelf up opens a grid, and picking a toy folds it back`                            | F / F; F / F / F            | `Error: expect(received).toBe(expected) // Object.is equality` |
| `tests/smoke.spec.mjs:1595` — `a panel opened while a toy from the grid is still loading stays open`                           | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |
| `tests/smoke.spec.mjs:1688` — `auto picks WebGPU when an adapter exists and effects render`                                    | F / F; F / F / F            | `Error: page.goto: Download is starting`                       |
| `tests/snda-engine.spec.mjs:43` — `a sample is fetched on its first play only, then cached; a missing file falls back quietly` | F / F; F / F / F            | `Error: expect(received).toEqual(expected) // deep equality`   |

### Flaky: mixed outcomes, with isolated failures

| Test and actual source                                                                                                     | Full 1 / 2; alone 1 / 2 / 3 | First error line                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/scr2.spec.mjs:122` — `switched off (or the curtains closed), the screen looks the same whichever sample it holds`   | F / P; P / P / F            | `Error: flat: {"worst":6,"count":36,"pixels":811080,"size":[1080,751],"box":[896,18,923,45]}` |
| `tests/sndc-engine.spec.mjs:73` — `a toy's samples load when it opens, and its first tap's sample starts with the motion`  | F / F; P / P / F            | `Error: expect(received).toBeLessThan(expected)`                                              |
| `tests/live3.spec.mjs:372` — `the still picture holds still face on: nudging the view a hair doesn't reshuffle its splats` | P / F; F / F / F            | `Error: expect(received).toBeLessThan(expected)`                                              |

### Full-run only: three isolated passes

| Test and actual source                                                               | Full 1 / 2; alone 1 / 2 / 3 | First error line                                                 |
| ------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| `tests/smoke.spec.mjs:401` — `the <splashery-toy> element renders without an iframe` | F / F; P / P / P            | `TimeoutError: page.waitForSelector: Timeout 180000ms exceeded.` |
| `tests/math.spec.mjs:366` — `the surface plotter plots a typed surface`              | P / F; P / P / P            | `Error: expect(locator).toHaveText(expected) failed`             |

## 3. Causes and proposed patches

All patches below are proposals for the owning lanes. No source or test file was edited.
Observations identify a failure mode only to the stated extent; unresolved causes remain explicit.
Supplemental probes are outside the two full runs and three required isolated reruns.

### Screen comparison capture

The first failed assertion is at `tests/scr2.spec.mjs:154`. The comparator at
`tests/scr2.spec.mjs:102` counts RGB channels with differences above 3, not distinct pixels. Run 1
found 36 such channels, worst difference 6, only inside `[896,18,923,45]` in the flat-style 1080×751
crop. The third required isolated run reproduced the exact same 36-channel, worst-6 difference and
bounding box after two isolated passes. A later debug invocation also failed there. Independent
decoding of its raw PNG pair found exactly 12 changed pixels: 15 RGB channels changed by 5 and 21 by
6, with no alpha differences; the TV pair was byte-identical. The test aborted at flat, so that
diagnostic did not reach cinema. The retained full-run trace places that box inside the Tilt lock
control (`index.html:247`, `styles.css:1992`, `styles.css:2014`). The sheet's
`{enabled:false, hidden:true}` assertion at `tests/scr2.spec.mjs:141` passed before the screenshot
failure.

`screenPixels()` computes a picture-sheet crop but takes `page.screenshot()` at
`tests/scr2.spec.mjs:91`; it hides only the splat-count label at `tests/scr2.spec.mjs:90`. This
includes unrelated DOM controls over the canvas. The 400 ms sleep at `tests/scr2.spec.mjs:88` is a
wall-clock delay, not a render/sort completion signal. The switching waits at
`tests/scr2.spec.mjs:38` do use the player's clock. The observed difference location supports
capture contamination; it does not establish a leaking hidden picture. The precise
browser/compositor reason for changing button pixels is unconfirmed.

Proposed patch for the owner of `tests/scr2.spec.mjs:91`:

```diff
 const shot = await page.screenshot({
+  // Keep the full scene region, with controls out of the comparison.
+  style: "body > :not(#stage) { visibility: hidden !important; }",
   clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.x1 - box.x), height: Math.round(box.y1 - box.y) }, // prettier-ignore
 });
```

The canvas is a direct body child (`index.html:39`); visibility preserves the existing layout and
crop while exposing scene pixels beneath controls. Keep all three styles, both media samples, the
sheet-state assertion and the existing pixel threshold. This proposal has not been applied or
tested. Revalidate it with three isolated invocations and both full-suite contexts; a scene
difference revealed beneath a control must still fail.

For separate wait optimizations, `src/stage.js:780` promises only the next rendered frame, while
sorting finishes later (`src/stage.js:102`, `src/pictures.js:635`). A reliable sort-ready signal or
measured stable-frame check is required before replacing fixed visual warmups; one `captureFrame()`
is insufficient.

### Readback warnings treated as functional errors

The console collector at `tests/smoke.spec.mjs:20` puts every warning into the same failing array as
errors and page exceptions. Run 1's file-import case completed its format, scene and pixel
assertions (`tests/smoke.spec.mjs:415`) before failing the final `problems` assertion at
`tests/smoke.spec.mjs:435`. Its four array entries were driver performance warnings ending in
`GPU stall due to ReadPixels`, including the last-message suffix. Later smoke failures have the same
signature; verify the per-test outcomes above rather than treating them as independent product
defects.

The same untyped warning collector is present at `tests/snda-engine.spec.mjs:48`; that case also
fails on these diagnostics after its sound assertions. Apply the narrow warning-type guard to both
collectors, retaining the explicit missing-sample exception at `tests/snda-engine.spec.mjs:93`.

A narrow proposed patch at `tests/smoke.spec.mjs:22` preserves the diagnostic and keeps other
warnings, errors and page exceptions failing:

```diff
 page.on("console", (m) => {
+  if (m.type() === "warning" && /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/.test(m.text())) {
+    test.info().annotations.push({ type: "driver performance", description: m.text() });
+    return;
+  }
   if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
 });
```

Do not suppress all warnings or context-loss messages. This recognizes only the observed performance
diagnostic; its cost remains visible as an annotation. Validate the same cases in a fresh browser
and after prior rendering tests. Fresh isolated import, export and screenshot cases also collected
the same four warnings. Their collector failures do not require earlier tests. The different worker
histories can explain where warnings appeared in a full run only as a hypothesis; their internal
rate limiting was not established.

### Custom-element readiness and leaked browser pages

All three required fresh isolated attempts passed in about 14 seconds each, while both full runs
timed out. The custom-element assertion waits 180 seconds at `tests/smoke.spec.mjs:404`. Run 1's
main page had loaded `/embed/demo.html`, its local modules returned 200, no toy assets were
requested, and both demo canvases remained blank. The retained trace also includes two older,
still-live contexts at device scale factor 3, one showing Penguin. These match the sharpness tests
that create unmanaged pages at `tests/shp.spec.mjs:150` and `tests/shp.spec.mjs:207`, finish without
closing them at `tests/shp.spec.mjs:158` and `tests/shp.spec.mjs:229`, and switch the second page to
Penguin at `tests/shp.spec.mjs:215`. These pages can continue rendering across later tests in the
same worker.

A separate four-browser diagnostic opened the same demo fresh, after reproducing the two sharpness
pages, after creating then closing those pages, and with an explicitly forced-null adapter probe.
Fresh automatic WebGPU initialized Cactus. With both old Penguin pages retained, each 2736×2160, the
element remained unready at the diagnostic's 40-second bound: both the element and iframe had
entered `navigator.gpu.requestAdapter()` but neither promise had resolved, and the element had no
Stage. Closing those pages before the demo restored successful automatic WebGPU initialization. The
forced-null diagnostic also initialized Cactus in WebGL2. These probes are excluded from the five
required outcomes and did not change files.

The retained-page/closed-page comparison reproduces an adapter-probe stall tied to those live pages
in this setup. It supplies stronger evidence for closing them than the baseline trace alone. It does
not explain the browser's internal scheduling, establish a general WebGPU defect, or validate a
patched full suite.

Fix that confirmed leak at both creation sites. Proposed lifecycle pattern for each existing body:

```js
const page = await browser.newPage({ deviceScaleFactor: 3 });
try {
  // Existing assertions and actions stay here.
} finally {
  await page.close();
}
```

The element starts on intersection (`src/element.js:100`) and sets readiness after `Viewer.start()`
succeeds or throws (`src/element.js:143`). `Viewer.start()` awaits player initialization before
loading its toy (`src/viewer.js:41`, `src/viewer.js:87`); initialization awaits the device
(`src/player.js:158`). Automatic adapter probing (`src/stage.js:15`) and graphics-device creation
(`src/stage.js:38`) have no explicit time bound. The historical full-run traces did not instrument
the native adapter promises, so their exact pending await remains unconfirmed. The later
reproduction does identify that phase. Revalidate the lifecycle patch against the original full-run
ordering; add adapter/device/load timing if anything still stalls. Raising the 180-second wait is
not a demonstrated fix.

### Surface input races a rebuild

The surface case at `tests/math.spec.mjs:366` passed run 1, but run 2 failed its second submission
at `tests/math.spec.mjs:381`: it expected the forbidden `t` variable message and received the
empty-input message instead. The first submission waits only for `scene.toy.options` at
`tests/math.spec.mjs:376`. That state changes synchronously at `src/app.js:905`, before the awaited
rebuild at `src/app.js:908`. Completion later calls `ui.setToyPanel()` at `src/app.js:319`; a new
input panel creates an empty field at `src/ui.js:1518` and submits that field's value at
`src/ui.js:1533`.

Run 2's trace shows the second fill starting at 1773922.581 ms. Its `after@call@523` snapshot at
1774256.334 ms has a new empty input and the updated “Your surface” display; the click follows at
1774257.478 ms. The parser's empty-string branch at `src/equation.js:432` explains the received
message. This is evidence of a DOM replacement race, not a changed parser rule or an inadequate
60-second error wait. A separate direct Node call to `readSurface("z = t")` returned the expected
forbidden-variable message through `src/equation.js:438`.

Proposed test-owner patch after `tests/math.spec.mjs:378`:

```diff
 .toMatchObject({ surface: "custom", eq: "z = sin(x)*cos(y)*a" });
+await expect(page.locator("#toy-input .input-shown"))
+  .toHaveText("Your surface: z = sin(x)*cos(y)*a");
 await page.locator("#toy-input-text").fill("z = t");
```

The displayed label uses the normalized equation (`src/packs/maths.js:2973`). This waits for the
rebuilt panel before typing the next equation, while retaining both real submissions and the exact
invalid-variable assertion. The same file already waits for displayed input state for its graph-link
cases (`tests/math.spec.mjs:355`, `tests/math.spec.mjs:362`). The proposal is unapplied and needs
isolated/full-run validation. Separately, the UI owner should decide whether to preserve a newly
typed draft or prevent editing during rebuild; the current replacement can discard fast user input
too (`src/ui.js:1518`).

### Mirror reads a canvas between rendered frames

The still-mirror case at `tests/live3.spec.mjs:372` passed run 1 with 177 changed pixels, then
failed run 2 with 247,281 (`tests/live3.spec.mjs:413`). The bound is fewer than 2,500 pixels whose
maximum adjacent-sample red-plus-green difference exceeds 40 (`tests/live3.spec.mjs:407`,
`tests/live3.spec.mjs:410`, `tests/live3.spec.mjs:414`). Its 16 nudges are alternating 0.02
CSS-pixel camera inputs, not 0.02-degree angles (`tests/live3.spec.mjs:403`, `src/camera.js:116`).

The capture at `tests/live3.spec.mjs:387` waits for two animation callbacks and copies the canvas,
but requests no render for its first sample after a three-second quiet period
(`tests/live3.spec.mjs:380`, `tests/live3.spec.mjs:400`). Automatic rendering is off at
`src/stage.js:81`; the keep-alive window is controlled at `src/stage.js:105`, `src/stage.js:220`.
Later samples follow a render request and 120 ms delay (`tests/live3.spec.mjs:404`). This makes a
stale or empty initial sample a concrete capture hypothesis. The run 2 trace has no browser pixel
snapshots for this manually owned browser, which closes before the assertion
(`tests/live3.spec.mjs:412`); it does not prove that hypothesis by itself.

A separate, serial four-browser probe alternated the original helper and frame-end capture with the
same URL, viewport, fake-device flags, quiet period and 16 nudges (`tests/live3.spec.mjs:11`,
`tests/live3.spec.mjs:72`, `tests/live3.spec.mjs:82`). The original runs reported 247,277 and
247,268 changed pixels; each initial 390×645 image had **all 251,550 pixels at zero alpha and zero
RGB**, followed by fully opaque scene images. The frame-end runs began with valid opaque images and
reported only **122 and 118** changes. Each context reported `preserveDrawingBuffer:false`. This
directly reproduces an empty initial capture rather than a 247,000-pixel geometry reshuffle. The
exact historic run 2 buffers remain unavailable. The probe used the proposed capture helper but did
not patch or run the original test file.

Proposed replacement for the `grab` helper at `tests/live3.spec.mjs:387`:

```js
const grab = async () => {
  const t = await pl.stage.captureFrame();
  return t.getContext("2d").getImageData(0, 0, t.width, t.height).data;
};
```

The engine queues a render at `src/stage.js:780` and copies at frame end (`src/stage.js:122`,
`src/stage.js:790`). Keep the same full-size RGBA data, all 16 real camera inputs, 120 ms waits,
40-level metric and 2,500-pixel bound. This changes capture synchronization, not the geometry or
oracle. It still needs validation in the original isolated test and full ordering, and does not
prove initial splat-sort readiness by itself.

### Phone shelf label is clipped

The grid gesture case at `tests/smoke.spec.mjs:1500` reached its final name-overflow assertion at
`tests/smoke.spec.mjs:1591` and received one clipped span in all five required attempts. It measures
**every** shelf label, including cards scrolled out of view (`tests/smoke.spec.mjs:1586`), not only
the selected Strawberry.

A later browser probe repeated the same 390×844 touch/mobile/reduced-motion setup
(`tests/smoke.spec.mjs:1413`) and the real six-move swipes, Strawberry selection, handle toggles and
More/Done sequence (`tests/smoke.spec.mjs:1505`, `tests/smoke.spec.mjs:1551`,
`tests/smoke.spec.mjs:1574`). The sole overflowing label before and after that sequence was
**Leaning Tower of Pisa** (`src/toys.js:3077`): `clientWidth=scrollWidth=64`, `clientHeight=24`,
`scrollHeight=36`, line height 12.075 px. The expanded grid had no clipped names. In the folded row,
the two-line clamp at `styles.css:1794` cuts a third required line. Runtime `hyphens:none` left it
clipped; changing both clamp properties to 3 removed every measured overflow.

Proposed layout patch at `styles.css:1794`:

```diff
- -webkit-line-clamp: 2;
- line-clamp: 2;
+ -webkit-line-clamp: 3;
+ line-clamp: 3;
```

Update the two-line comment at `styles.css:1790` to describe up to three lines. This preserves the
complete name and the test's zero-overflow assertion rather than excluding a card. It intentionally
allows an extra line in the product layout. The runtime metric probe supports that choice but is not
validation of the patched test or all shelf heights/gestures. The owner of the layout must recheck
row/grid geometry and screenshots at both sizes, and decide whether the product should instead
require a shorter two-line display label while retaining its full accessible name. Keep the
full-name source unless that alternate product choice is approved.

This case also uses the common console collector (`tests/smoke.spec.mjs:1501`,
`tests/smoke.spec.mjs:1592`), so the narrow ReadPixels guard remains relevant after fixing the
earlier layout assertion.

The probe's WebGL2 renderer reported
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`.
This is a later observation from this Mac, not a measurement of every baseline browser or a physical
phone.

### WebGPU probe navigates to a download

The WebGPU smoke case fails at `tests/smoke.spec.mjs:1690`, before reaching its adapter probe or
conditional skip at `tests/smoke.spec.mjs:1699`. Its first error is
`Error: page.goto: Download is starting`; the navigation target is `/LICENSES.md`. The retained
network trace records HTTP 200 with `Content-type: application/octet-stream` and `net::ERR_ABORTED`
for that target. This test therefore provides no WebGPU effect coverage in that failed attempt.

Serve a minimal HTML document at a same-origin URL with a test route, preserving the secure-context
adapter probe and all later renderer/effect assertions. Proposed replacement at
`tests/smoke.spec.mjs:1690`:

```diff
- await page.goto("/LICENSES.md");
+ await page.route("**/__webgpu_probe.html", (route) =>
+   route.fulfill({ contentType: "text/html", body: "<!doctype html><title>WebGPU probe</title>" }),
+ );
+ await page.goto("/__webgpu_probe.html");
+ await page.unroute("**/__webgpu_probe.html");
```

The routed document is deliberately inert, so probing does not start a competing renderer. Do not
force WebGL2 or skip the test solely because its old navigation downloaded a file. The patch still
needs validation; the adapter/effect checks were not reached in the failing baseline attempt.

### Audio's async predicate is not a decoded-readiness fence

The sample-start case at `tests/sndc-engine.spec.mjs:73` measured 222.0 ms in full run 1 and 279.9
ms in full run 2 against its 30 ms bound (`tests/sndc-engine.spec.mjs:118`). Its three required
isolated measurements were 12.3, 9.3 and 53.4 ms. The 400 ms routed sample latency is deliberate
(`tests/sndc-engine.spec.mjs:79`). The test intends to wait for decoded readiness before its first
real click, but uses an **async** predicate at `tests/sndc-engine.spec.mjs:97`.

In installed Playwright 1.56.1, the waiter tests the predicate's immediate return, then fulfills
with it (`node_modules/playwright-core/lib/server/frames.js:1248`). An async predicate returns a
truthy Promise even when its eventual boolean is false. That implementation matches the opened
[Playwright 1.56.1 source](https://github.com/microsoft/playwright/blob/v1.56.1/packages/playwright-core/src/server/frames.ts).
A separate minimal browser reproduction,
`waitForFunction(async () => false, null, { timeout: 500 })`, returned a handle resolving to **false
in 11 ms**, rather than continuing to poll.

Supplemental phase probes observed delays of 60.8, 146.2 and 5.5 ms. The slow calls returned from
`Sound.play()` before source creation. Three further fresh-browser probes recorded the actual Dice
spec at the sound call: `samplesReady(spec)` was **false** in all three, with delays of 101.8, 98.8
and 35.0 ms. This identifies entry into the sample-load branch at `src/sound.js:119`, not slow
buffer/gain setup or a render-frame queue. Cache readiness is defined at `src/voices.js:1363`; the
sample promise fills the buffer at `src/voices.js:1335`. The readiness assumption in the original
test had never been enforced.

Proposed test-owner patch at `tests/sndc-engine.spec.mjs:97`:

```diff
- await page.waitForFunction(async () => {
+ await expect.poll(() => page.evaluate(async () => {
    const { samplesReady } = await import("/src/voices.js");
    const { toySound } = await import("/src/toy-sounds.js");
    return samplesReady(toySound("dice"));
- });
+ }), { timeout: 10_000 }).toBe(true);
```

A separate three-browser probe explicitly polled the resolved boolean before the same first real
click, retaining the slow asset route. Readiness was true at each sound call and its measured delays
were **5.4, 5.5 and 5.5 ms**. That supports the proposed fence; the original test file and a patched
full suite remain unvalidated. Keep the single-fetch assertion, first real tap and 30 ms bound.
There was no hidden warm-up tap. This establishes the intended decoded-ready test condition, not a
guarantee that a production tap before decoding will avoid waiting.

The metric at `tests/sndc-engine.spec.mjs:114` combines elapsed time from `motion.act()` to the
first `AudioBufferSourceNode.start()` call and any positive future audio-context scheduling delay.
It does not measure physical speaker output. The ready path is synchronous with a 5 ms lead
(`src/sound.js:107`), through the action listener (`src/player.js:1229`, `src/app.js:863`); sample
creation/start is at `src/voices.js:1398` and `src/voices.js:1412`.

## 4. The 25 slowest tests

Ranked by the arithmetic mean of the two full-run test durations, in seconds; both individual
durations are shown so one slow attempt stays visible. These are measured elapsed test durations,
including fixture work, not CPU profiles or predictions of cloud-run wall time. Failed attempts
remain in the ranking. In particular, the custom-element readiness timeout and any screen comparison
that aborts before its last style are failure costs, not timings of completed coverage
(`tests/smoke.spec.mjs:404`, `tests/scr2.spec.mjs:126`).

The top 25 sum to 1440.132 seconds of mean test duration, 27.6% of the 5213.954-second sum across
all tests. This is a distribution of observed test time, not a prediction of saved wall time.

Every candidate below is **unimplemented and unbenchmarked**. "Candidate" means the source supports
a way to reduce work while retaining the specified assertions; the owning lane must verify
state/pixel equivalence and measure the resulting duration. Numeric checks can sometimes draw at a
smaller viewport while keeping all geometry, tiers and frames; the repository already uses that
approach for a DPR check at `tests/wd.spec.mjs:247`. Keep camera and LOD choices identical
(`src/worlds/lod.js:13`, `src/worlds/lod.js:36`). Do not replace a whole island or high-tier model
in a test whose budget/model is its oracle.

Replacing a visual sleep requires an actual build/upload/sort completion signal. Awaiting a toy load
(`src/app.js:524`) or one frame (`src/stage.js:780`) does not prove that its splat sort has finished
(`src/stage.js:102`, `src/pictures.js:635`). A shared page must explicitly reset toy/options, seed,
media, clock, camera, effects and handler overrides; preserve fresh-context tests where isolation is
itself the coverage. None of these proposals lower a pixel threshold, reduce a tested
toy/option/tier, cut animation samples, or edit `tests/taps.spec.mjs:84`.

| Rank | Test and actual source                                                                                                                      | Run 1 (s) | Run 2 (s) | Mean (s) | Faster without less coverage?                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------: | --------: | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `tests/smoke.spec.mjs:401` — `the <splashery-toy> element renders without an iframe`                                                        |   183.033 |   182.862 |  182.947 | Fix the timeout cause first (§3). Closing the leaked sharpness pages is warranted, but a faster passing replacement has not been demonstrated. Keep the demo iframe and custom element, ready event, selected toy, link and console checks; do not raise the timeout.                                                                                                                                                |
| 2    | `tests/shp.spec.mjs:231` — `adapt drag (the default) drops the resolution only during a drag`                                               |    86.828 |    88.215 |   87.522 | Candidate: a 200×200 viewport with the same DPR 2 and forced mid profile. These are adaptive-state assertions driven by 20 synthetic slow frames at `tests/shp.spec.mjs:246` through `tests/shp.spec.mjs:248`; keep all three URL cases and both playing/dragging states.                                                                                                                                            |
| 3    | `tests/fx4-engine.spec.mjs:79` — `toys without the rim kind draw as before (webgpu)`                                                        |    69.304 |    69.874 |   69.589 | Candidate: replace the 1,316,640-number RGBA transfer per image at `tests/fx4-engine.spec.mjs:36` with browser PNG encoding and Node decoding, verifying byte-for-byte RGBA round-trip identity. Keep all three toys, three independent loads, both current-load noise samples, capture size, profile and thresholds. A sort-ready signal could replace the nine 1.5-second waits at `tests/fx4-engine.spec.mjs:71`. |
| 4    | `tests/wd.spec.mjs:187` — `each tier stays within its splat budget`                                                                         |    67.903 |    68.877 |   68.390 | Candidate: a smaller logic viewport with tiers explicitly fixed. Keep the complete island, both locations at `tests/wd.spec.mjs:194` through `tests/wd.spec.mjs:198`, all three budgets and low < mid < high. Verify identical camera and LOD totals first; the planner uses distance/counts (`src/worlds/lod.js:13`, `src/worlds/lod.js:36`), but setup must remain equivalent.                                     |
| 5    | `tests/wdr3.spec.mjs:133` — `idle, walk and run play, and the standing foot stays planted while it walks and runs`                          |    69.065 |    66.457 |   67.761 | Candidate: a smaller logic viewport with identical camera, tier and world state. Keep both walk/run phases, all 20 warmup and 45 measured 1/30-second steps per phase at `tests/wdr3.spec.mjs:147` through `tests/wdr3.spec.mjs:149`, and every planted-foot assertion.                                                                                                                                              |
| 6    | `tests/chr.spec.mjs:249` — `on the Test island: the renderer turns the joints as the rig says, each tier holds its budget, and screenshots` |    65.663 |    67.258 |   66.460 | Candidate: perform numeric tier/joint setup at a smaller viewport, then resize before each required screenshot. Keep every tier, joint, DPR, 14 walking steps and six final frames; preserve both final viewport sizes.                                                                                                                                                                                              |
| 7    | `tests/smoke.spec.mjs:339` — `the embed page loads a scene from the hash`                                                                   |    62.368 |    65.484 |   63.926 | Candidate: after extracting and checking both embed snippets, navigate the parent app to inert same-origin HTML while the embed renders. Keep the 400×300 embed, scene/hash, link and pixel assertions; the second viewer at `tests/smoke.spec.mjs:359` must remain a real embed.                                                                                                                                    |
| 8    | `tests/scr2.spec.mjs:265` — `lane Screens r2 screenshots at 390x844 and 1440x900`                                                           |    60.525 |    59.727 |   60.126 | Candidate: one app load per viewport, resetting style, media, player clock, camera and hidden state between captures. The helper at `tests/scr2.spec.mjs:15` currently reloads for every style. Keep all four styles, both samples and eight final views; retain fresh-load coverage elsewhere.                                                                                                                      |
| 9    | `tests/wdr3.spec.mjs:96` — `the realistic character is hybrid mode's default and loads its level in each tier, within budget`               |    59.573 |    58.203 |   58.888 | Candidate: a smaller logic viewport with identical camera/LOD plan. Keep every low/mid/high mesh level, texture/shadow/counter assertion and the final splats-mode load; a lighter character would remove coverage.                                                                                                                                                                                                  |
| 10   | `tests/smoke.spec.mjs:223` — `clay adds and erases blobs on a generated toy and survives a JSON round trip`                                 |    56.762 |    56.804 |   56.783 | Candidate: replace post-drag and rebuild sleeps at `tests/smoke.spec.mjs:244`, `tests/smoke.spec.mjs:249` and the helper at `tests/smoke.spec.mjs:40` with actual clay/load/render completion. Keep both six-move gestures, their cadence if brush sampling depends on time, add/erase pixels/counts and the real JSON round trip.                                                                                   |
| 11   | `tests/f.spec.mjs:302` — `lane F screenshots at 1440x900 and 390x844`                                                                       |    56.286 |    56.384 |   56.335 | Candidate: replace the eight 2.5-second warmups at `tests/f.spec.mjs:344` with sort readiness. The test already shares one page within each viewport. Keep all four toys, both sizes, exact cube/cradle/chess/bricks player-clock poses and every intervening animation step.                                                                                                                                        |
| 12   | `tests/scr2.spec.mjs:122` — `switched off (or the curtains closed), the screen looks the same whichever sample it holds`                    |    43.686 |    65.907 |   54.796 | Fix capture contamination first (§3); its failed duration omits later styles. Candidate: share app startup only with explicit style/media/clock/camera reset. Keep all three styles, both samples, hidden-state checks and the original scene-pixel threshold.                                                                                                                                                       |
| 13   | `tests/fx4-engine.spec.mjs:79` — `toys without the rim kind draw as before (webgl2)`                                                        |    54.646 |    54.545 |   54.596 | Candidate: replace the 1,316,640-number RGBA transfer per image at `tests/fx4-engine.spec.mjs:36` with browser PNG encoding and Node decoding, verifying byte-for-byte RGBA round-trip identity. Keep all three toys, three independent loads, both current-load noise samples, capture size, profile and thresholds. A sort-ready signal could replace the nine 1.5-second waits at `tests/fx4-engine.spec.mjs:71`. |
| 14   | `tests/chr.spec.mjs:56` — `the build has every joint's part, and it is sharp: opaque, flat splats`                                          |    42.123 |    59.147 |   50.635 | Yes: collect all offending joint/splat indices in a plain loop and assert once instead of expect per alpha at `tests/chr.spec.mjs:64`. Keep every alpha comparison, joint count and thin-splat ratio at `tests/chr.spec.mjs:69`; no smaller build or subsampling.                                                                                                                                                    |
| 15   | `tests/smoke.spec.mjs:196` — `paint and poke tools change the toy where it is touched`                                                      |    45.016 |    49.687 |   47.352 | Candidate: replace the post-stroke 1.5-second tail at `tests/smoke.spec.mjs:214` and helper warmups with paint rebuild/render completion. Keep all eight pointer moves, their cadence, paint/poke actions and the pixel-change thresholds.                                                                                                                                                                           |
| 16   | `tests/wdr3.spec.mjs:235` — `screenshots at 390x844 and 1440x900`                                                                           |    45.214 |    44.631 |   44.922 | Candidate: do world setup at a smaller viewport and resize before the final shot; retain the camera/LOD plan, four settle steps, all 12 walking steps at `tests/wdr3.spec.mjs:250` and both final images. Replace the 500 ms tail at `tests/wdr3.spec.mjs:253` only with demonstrated render readiness.                                                                                                              |
| 17   | `tests/smoke.spec.mjs:172` — `toggling an effect changes canvas pixels`                                                                     |    39.451 |    40.992 |   40.221 | Candidate: replace the two effect sleeps at `tests/smoke.spec.mjs:184`, `tests/smoke.spec.mjs:190` with shader-state plus render completion. Keep both effects, current viewport/profile and the 3,000 changed-pixel floor; a lighter scene changes that oracle.                                                                                                                                                     |
| 18   | `tests/shv.spec.mjs:214` — `the torus and the Shapes shelf at 1440×900`                                                                     |    36.517 |    42.431 |   39.474 | Candidate: replace the four 1.2-second toy/option warmups at `tests/shv.spec.mjs:25` with sort readiness. Already shared page and weak profile; keep both Torus/planet images, donut/Jupiter choices, visible chips and this exact viewport.                                                                                                                                                                         |
| 19   | `tests/shv.spec.mjs:90` — `its tap runs on the page in each dressing`                                                                       |    39.643 |    39.138 |   39.391 | Candidate: replace the 1.2-second helper warmup at `tests/shv.spec.mjs:25` with build/render readiness and the 700 ms action delay at `tests/shv.spec.mjs:104` with a confirmed advanced roll frame. Already one page load; keep all four dressings, option/button checks and a real click.                                                                                                                          |
| 20   | `tests/shv.spec.mjs:214` — `the torus and the Shapes shelf at 390×844`                                                                      |    36.894 |    40.912 |   38.903 | Candidate: replace the four 1.2-second toy/option warmups at `tests/shv.spec.mjs:25` with sort readiness. Already shared page and weak profile; keep both Torus/planet images, donut/Jupiter choices, visible chips and this exact viewport.                                                                                                                                                                         |
| 21   | `tests/shv.spec.mjs:142` — `the Toy tab picks a planet, and the choice is saved in the scene`                                               |    39.143 |    38.540 |   38.841 | Candidate: a smaller logic viewport and awaited build completion instead of the 1.2-second helper delay at `tests/shv.spec.mjs:25`. Already one page load; keep all five choices, metadata, palette, rig and action text checks.                                                                                                                                                                                     |
| 22   | `tests/e6a.spec.mjs:215` — `e6a screenshots at 1440x900 and 390x844`                                                                        |    38.601 |    38.796 |   38.698 | Candidate: share a context/app per viewport and restore the update handlers/clock between toys (currently replaced at `tests/e6a.spec.mjs:188` through `tests/e6a.spec.mjs:193`). Keep mobile flags, both toys/poses and every 1/30-second effect step. Replace only the warmup at `tests/e6a.spec.mjs:180`, `tests/e6a.spec.mjs:196` through `tests/e6a.spec.mjs:200` with genuine sort readiness.                  |
| 23   | `tests/live2.spec.mjs:207` — `the click track: each click is at the now mark within 50 ms of when it is heard`                              |    29.379 |    46.791 |   38.085 | No demonstrated safe clock/audio-duration cut: this measures real audiovisual click synchronization. Keep real playback, timestamps, click coverage and the 50 ms bound; a fake clock would test something else.                                                                                                                                                                                                     |
| 24   | `tests/smoke.spec.mjs:285` — `JSON export then import round-trips the scene`                                                                |    36.615 |    39.010 |   37.812 | Candidate: await paint-stamp, export and imported-scene completion instead of visual helper delays and the 800 ms tail at `tests/smoke.spec.mjs:300`. Keep real download/file input, changed toy/settings, every serialized field and camera comparison.                                                                                                                                                             |
| 25   | `tests/wdh.spec.mjs:271` — `screenshots at 390x844 and 1440x900`                                                                            |    38.273 |    37.082 |   37.678 | Candidate: do setup at a smaller viewport, then resize for the required final image, preserving camera/LOD, placement and all settle frames. Keep both sizes; replace the 500 ms tail at `tests/wdh.spec.mjs:285` only with verified readiness.                                                                                                                                                                      |

## 5. Duplicated coverage

These are consolidation proposals, not deletions made by this audit. Move the unique assertions
first, then measure the resulting runtime; removing a startup does not establish a net speedup by
itself.

| Overlap and source                                                                                                                                                                                                       | Which cases could go, with coverage retained                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio song build/play smoke: `tests/sts.spec.mjs:147`; deeper Live movement/pause and Whole view checks: `tests/sng.spec.mjs:86`. Both use the same mid-profile URL (`tests/sts.spec.mjs:11`, `tests/sng.spec.mjs:11`). | Move the splat-count bounds at `tests/sts.spec.mjs:154` into the song test after readiness at `tests/sng.spec.mjs:93`. Then remove only the `song-landscape` instance of the Studio browser smoke. Keep the Chladni instance and shelf metadata at `tests/sts.spec.mjs:136`.                                                                                                                                                                                                                  |
| About text displayed at the same phone and desktop sizes: `tests/hta.spec.mjs:49` and `tests/help.spec.mjs:303`. Both use the same weak-profile/help URL (`tests/hta.spec.mjs:12`, `tests/help.spec.mjs:17`).            | Add the Saguaro long-text, all-paragraph, how-to and existing screenshot checks at `tests/hta.spec.mjs:54` to the already-open help pages, then remove the two standalone long-About browser cases. Keep the fallback module route at `tests/help.spec.mjs:308` and its missing-entry assertions. Keep the stricter missing-entry, 95-character, two-paragraph and word-count validation at `tests/hta.spec.mjs:26`; general help validation at `tests/help.spec.mjs:59` does not replace it. |

Partial overlaps worth recognizing, but not whole-test deletions:

- Default chess playback appears in `tests/f.spec.mjs:187`, `tests/smoke.spec.mjs:792` and
  `tests/smoke.spec.mjs:1072`. Keep the touch test's play **after resetting a user-created game**
  (`tests/f.spec.mjs:184`), legal/illegal pointer moves and user history (`tests/f.spec.mjs:162`).
  The smoke case contributes rendered-pixel movement (`tests/smoke.spec.mjs:798`), pasted/file PGN
  and invalid moves (`tests/smoke.spec.mjs:801`); the transport case adds stepping, seeking and
  end/restart. No safe whole-case cut is established by their shared default-game label.
- Chess bar visible/title/hidden-for-unrelated-toy checks repeat at `tests/pno-engine.spec.mjs:425`
  and `tests/smoke.spec.mjs:1083`. Keep the engine case: it first opens the synthetic song recipe
  (`tests/pno-engine.spec.mjs:257`, `tests/pno-engine.spec.mjs:421`) and then verifies that song
  controls disappear when chess opens (`tests/pno-engine.spec.mjs:429`). The transition is
  additional coverage, so deleting the case would lose it.
- Default AI tap finiteness and return-to-rest checks overlap between `tests/ai.spec.mjs:79` and the
  computing-pack instance of `tests/taps.spec.mjs:84`. Keep AI's option variants, part/token limits,
  grow assertion and its fixed-clock input contract (`tests/ai.spec.mjs:73`, `tests/ai.spec.mjs:81`,
  `tests/ai.spec.mjs:85`, `tests/ai.spec.mjs:109`, `tests/ai.spec.mjs:43`). The global harness
  advances time and taps twice (`tests/taps.spec.mjs:104`); the two fixtures are not
  interchangeable. Any future trimming belongs in the AI file after reconciling those inputs. Never
  edit `tests/taps.spec.mjs`.
- `tests/pic.spec.mjs:213` stresses a 200-page PDF, sampled pages, byte limits and cache eviction;
  `tests/bk.spec.mjs:744` stresses a 300-page book's lazy sheets, rendered slots and a far jump.
  Keep both: they exercise different subsystems and bounds.
- `tests/ui3.spec.mjs:50` checks motion, labels and sound scheduling during pause/resume/restart;
  `tests/sndc-engine.spec.mjs:27` checks actual AudioContext suspension and ringing samples. Keep
  their different audio semantics.
- The laptop typing/pixel portion at `tests/smoke.spec.mjs:828`, focus-shortcut case at
  `tests/ui2.spec.mjs:493`, and picture-sheet leakage case at `tests/pic.spec.mjs:338` protect
  different regressions. Keep them.
