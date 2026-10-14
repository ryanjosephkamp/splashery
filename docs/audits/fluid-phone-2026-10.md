# Fluid Lab phone audit — October 3, 2026

## Summary

- Codex built this report. Application code is unchanged by this audit.
- No real phone was used; these are measurements on a Mac.
- Typical phones start at `mid`; remembered High/Max detail can override that.
- Baseline phone-tier rendered p95 was 18.1–20.2 ms across the Fluid Lab.
- Phone-sized Max Splash water reached 149.2 ms p95 on WebGPU.
- The 6× CPU solver reached 24.6 ms p95 on `mid`, versus 90.7 ms on `high`.
- Propose smaller phone allocations and a step-down that rebuilds current fluids.
- Reject coarse CPU splash presets that remove the starting pool.
- WebGPU scene changes retained two more buffers per four-scene cycle.

## Scope and method

The measured baseline is `aba77089cd935f20358302a8ba8c7b39215b7f2d`, fetched from `main` before
creating `codex/fluid-phone`. Source links pin that commit. Later main changes are recorded
separately when the branch is synchronized, without mixing new source into these measurements. The
source inventory finds exactly one recipe using `k.fluid()`: `src/packs/fluid-lab.js`. All four
liquids are measured in Glass and Splash, plus Candle and Hot cup: ten distinct scenes. Liquid
selection does not change the two gas scenes. Fourteen related toys are also compared: the water
bottle, soda can, lava lamp, waterfall, ocean wave, candle, coffee, birthday cake, campfire,
volcano, geyser, storm cloud, tornado, and fireworks. They use their own animation, rather than this
fluid engine. Their results cover their default options and the ordinary Play/tap action.

The method follows [the performance audit](perf-2026-10.md), with an explicit visitor worker path
and additional CPU, budget, and grid comparisons. Chrome 154.0.8037.95 runs headlessly on an Apple
M3 Pro with ANGLE Metal for WebGL2 and native WebGPU available. Only one rendering context runs at a
time. Each cell uses a fresh context, localhost without network throttling, disabled HTTP cache,
sound off, light theme, and no reduced motion or turntable. Scene seed is 424242; the recipe itself
uses its deterministic toy seed, 3456224641. The phone viewport is 390×844 with device scale 3,
touch and mobile enabled. Desktop is 1440×900 at scale 1. The actual canvas dimensions are saved;
the phone's open sheet means the canvas is shorter than the viewport.

`mid4` and `mid6` mean the `mid` phone tier at 4× and 6× page CPU throttling. `low6` is the lower
tier at 6×. `desktop` is `high` at 1×. `high6phone` and `max6phone` apply those detail tiers at
phone size with 6× throttling. Automatic-profile probes also leave normal adaptation enabled. Other
cells set `adapt=off`; the fluid engine's separate watcher remains active. Every requested
WebGL2/WebGPU result records its actual renderer, profile, runtime mode, and watcher state.

An important measurement limit was tested, rather than assumed: page CPU throttling does not
throttle the dedicated fluid worker in this Chrome build. The calibration workload's page median
rose from 36.4 to 229.4 ms at 6×, while the worker rose from 36.4 to 39.2 ms. Applying the same
protocol command directly to the worker was rejected. See
[worker-throttle.json](fluid-phone-2026-10/worker-throttle.json). Accordingly, the rendered worker
matrix checks submission cadence, drawing, uploads, and page work; it does not certify a phone CPU's
solver throughput. A separate solver-only sweep throttles the same `FluidWorld.step()` and packing
work on the page. It advances 180 synthetic 1/30-second steps, discards the first 30, and retains
all 150 measured costs. This is a workload benchmark, not 150 real-time displayed frames. Gas grids
are excluded from that CPU sweep and are measured in the rendering matrix instead.

After readiness and a 1.5-second settling period, each rendered cell records five seconds idle and
six seconds after a tap. Frame time is the wall-clock interval between PlayCanvas `postrender`
callbacks, with `frameend` vectors also retained. It is submission cadence, not a GPU fence,
isolated shader duration, or confirmed presentation. The first interval can cross a window boundary.
An on-demand toy's gap between draws is not by itself a lockup. Median averages the two middle
values; p95 uses nearest rank. First frame is navigation to the first submitted frame after the
requested toy is ready; asynchronous fluid setup or paint can finish later. Main-thread long tasks
use the browser's over-50-ms observations; opening tasks and each window's durations are retained.
See [the long-task API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming).

Heap is CDP `Runtime.getHeapUsage.usedSize`, without forced collection in the timing matrix.
Separate page and worker heaps, backing storage, and before/after snapshots are retained. GPU
figures are PlayCanvas's tracked texture and buffer byte allocations, including base-toy rendering
resources; they are not full device or GPU-process memory. Emulation does not replace the Mac GPU or
its API limits with a phone GPU. Driver allocations, native framebuffer storage, energy, thermal
limits, and OS memory pressure are unknown. The raw data represents unknown total GPU memory as
`null`. Heap, backing storage, and GPU accounting must not be added into a claimed process
footprint. See
[Chrome's memory documentation](https://developer.chrome.com/docs/devtools/memory-problems).

Lower-budget trials alter only intercepted module responses. Their CPU liquid spacing increases by
the cube root of the budget reduction, intending to retain volume with fewer particles. The
experiment exposed a shallow-pool initialization failure, described below; visual quality and volume
preservation are not established by faster timings. No application, asset, test, or configuration
file was edited.

## What is expensive and why recovery can fail

The high GPU tiers are much larger than the phone tiers. At
[src/fluids/gpu/liquid.js:19](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/liquid.js#L19),
`mid` allocates up to 14,000 liquid particles at cell size 0.04 and up to 12 substeps; `high`
permits 120,000 at 0.022 and 36 substeps, and `max` permits 200,000 at 0.018 and 44 substeps. Gas
grids also rise from 28 cells across to 44/56, with more pressure iterations and a higher smoke
update rate
([src/fluids/gpu/gas.js:334](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/gas.js#L334)).
The candle has separate flame and smoke grids; the runtime's `gasCells` reports only the first, so
this audit sums both.

Phones normally select `mid` through the coarse pointer and small-screen check, but remembered
High/Max detail is checked first
([src/player.js:94](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L94)).
`mid` also draws at a pixel-ratio cap of 3
([src/player.js:50](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L50));
the lab's props use 105,000 base splats because its density is 0.75
([src/packs/fluid-lab.js:325](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/packs/fluid-lab.js#L325)).
Shrinking traced props inside their traced geometry preserves picking, but still retains and
processes their splats.

There are three separate recovery limits:

1. The fluid watcher ignores frame gaps above 250 ms, only acts for a world created at `low` or
   `mid`, and stops after three reductions. It lowers substeps, surface resolution, and ray-march
   length, but leaves particle capacities and grid allocations in place
   ([src/fluids/gpu/index.js:115](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/index.js#L115)).
2. The stage watcher ignores gaps above 100 ms and requires a busy view
   ([src/stage.js:195](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/stage.js#L195)).
   Normal adaptation treats only dragging/painting as busy
   ([src/stage.js:169](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/stage.js#L169)),
   even while fluids animate.
3. A player tier reduction changes pixel ratio immediately, while counts wait for the next toy
   ([src/player.js:204](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L204)).
   The existing `FluidRuntime` retains the profile it received at construction
   ([src/player.js:742](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L742)).

These are inspected mechanisms and experimentally checked limits, not proof of what happened on the
owner's phone. The phone's model, browser, current Detail preference, memory pressure, and thermal
state are unknown. The normal `mid` scenes did not freeze or crash on this Mac.

### Observed phone-sized slowdowns

These selected WebGPU action windows all use the phone viewport and 6× page CPU throttling. All
corresponding High/Max fluid watchers recorded zero reductions.

| Scene / detail      | Action median / p95 ms | Main long tasks: count / total ms | Tracked GPU MiB |
| ------------------- | ---------------------: | --------------------------------: | --------------: |
| Glass soda / High   |            44.8 / 88.1 |                             0 / 0 |            97.1 |
| Splash water / High |           62.3 / 127.2 |                        17 / 1,091 |           106.0 |
| Splash water / Max  |          129.8 / 149.2 |                           7 / 875 |           145.1 |
| Candle / Max        |            16.7 / 19.0 |                             0 / 0 |           160.0 |

The Max Splash-water window had one 260.7-ms interval and kept submitting frames afterward. No
permanent freeze, crash, device loss, or unbounded particle growth was reproduced. The Max candle
remained smooth while allocating roughly 160 MiB in tracked graphics resources and 1,078,784
combined gas cells. Smooth rendering does not rule out memory pressure on a smaller device.
Conversely, Glass soda was slow without main-thread long tasks: the long-task count alone cannot
rule out expensive GPU work. Neither observation identifies which limit the owner's phone reached.

## Proposed phone envelope

`safe` is the name of an experimental cell, not a claim that these settings are safe on a real
phone. All twenty candidate cells submitted action frames at 18.4–19.0 ms p95, with zero main-thread
long tasks in their measured windows. First submitted frame was 800–920 ms, compared with
1,013–1,295 ms for `mid6`. These are single runs without network throttling, not startup service
guarantees. The candidate bundles resolution, props, and simulation changes; its total gain cannot
be assigned to one component.

| Component      | Current `mid`                          | Candidate phone default                              | Measured implication                                                               |
| -------------- | -------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Canvas / props | DPR cap 3; about 105,000 base splats   | DPR cap 1.5; 35,000 base splats                      | Canvas 1170×1935 → 585×967: about 75% fewer pixels and 67% fewer base splats       |
| WebGPU liquid  | Cap 14,000; cell 0.04; max 12 substeps | Cap 6,000; cell 0.05; keep 12 substeps initially     | Glass-water grid 45,472 → 24,863 cells; splash grid 98,838 → 54,684                |
| CPU Glass      | Cap 540; spacing scaled by tier        | Cap 270; spacing multiplied by cube root of 2        | Worst Glass solver p95 24.6 → 13.1 ms at 6×; appearance and volume need acceptance |
| CPU Splash     | Cap 585; 282 starting liquid particles | Keep the liquid cap and spacing; halve vessel budget | Candidate retains the 282-particle starting pool and 348 particles after the tap   |
| Candle gas     | Flame 28×81×28, smoke 28×91×28         | Flame 20×58×20, smoke 20×65×20                       | Combined cells 134,848 → 49,200, a 64% reduction                                   |
| Hot cup gas    | 28×47×28                               | 20×33×20                                             | Cells 36,848 → 13,200, a 64% reduction                                             |

Keep the tested gas pressure/update settings initially: mid smoke uses 12 pressure iterations at 30
Hz, while the flame overrides those with 10 iterations at 120 Hz and at most six steps. The
candidate did not change those settings, the surface scale 0.4, or the mid ray-march length 28.
Additional reductions may help, but this experiment does not validate their fidelity or timing gain.

For the combined candidate, tracked GPU allocations fell from 63.8 to 41.6 MiB for Glass water and
65.4 to 42.5 MiB for Splash water on WebGPU. Candle fell from 69.7 to 43.5 MiB on WebGPU and 61.0 to
40.2 MiB on WebGL2. A particle/grid-only Glass-water reduction saved just 1.7 MiB on WebGPU, versus
22.2 MiB for the combined candidate. That comparison favors reducing the canvas and props alongside
the solver budget. It does not establish full device memory savings. Page heap was 16.0–30.1 MiB
across candidate cells, overlapping the default range; garbage collection makes these uncollected
snapshots unsuitable for claiming a heap improvement.

### Largest tested settings below 33 ms

The criterion here is **p95**, not merely median. It is a boundary in this Mac experiment; there is
no established largest safe setting for an actual phone. The CPU fallback's separate 6× solver sweep
keeps every `mid` liquid scene below 33 ms, with the worst at 24.6 ms, while every `high6phone`
liquid solver exceeds it (47.5–90.7 ms). In the real-time worker matrix, smooth WebGL2 submission at
High does not contradict that result: the worker was unthrottled.

| Workload / path                          | Largest tested tier meeting p95 <33 ms                        | Limit on that finding                                                    |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| All CPU liquid scenes, solver only at 6× | Mid: Glass cap 540, Splash cap 585                            | Does not include drawing; High fails all eight scenes                    |
| WebGPU Glass water/soda/honey            | Mid: cap 14,000, cell 0.04                                    | High fails; Max was tested only for water/soda                           |
| WebGPU Glass lava                        | High: cap 120,000, cell 0.022; observed 33,124 live particles | p95 30.5 ms, little headroom; shallower starting pool; Max untested      |
| All WebGPU Splash liquids                | Mid: cap 14,000, cell 0.04                                    | High fails all four; Max tested only for water                           |
| Candle gas, both APIs                    | Max: grid base n=56                                           | Smooth on the Mac; large allocation does not establish phone suitability |
| Hot cup gas, both APIs                   | High: grid base n=44                                          | Max untested; native phone GPU throughput unknown                        |

The High/Max gas rows establish only the tested Mac boundary. For an actual phone, use the smaller
candidate grids and verify them on the device before raising budgets. For CPU liquids, the proposed
Glass reduction adds solver headroom; Splash's largest verified nonempty Mid pool is retained. No
interpolation establishes an exact particle cap between tested tiers.

### A faster empty pool is a failed comparison

The `half` and `quarter` CPU Splash trials had **zero starting liquid particles**, compared with the
default Mid pool's 282. Their post-tap counts were just 32 and 19. `eighth` started with 62 and
ended with 69, changing the pool again. All three are marked † and excluded from recommended CPU
Splash defaults. The GPU trials have separate initialization and retained a pool; this rejection
applies to the CPU path.

The fill lattice begins at `loY + spacing / 2` and rejects a point closer to a collider than its
radius
([src/fluids/sim.js:395](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/sim.js#L395)).
Coarser spacing interacts with the thin 0.13-high pool and its floor
([src/packs/fluid-lab.js:154](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/packs/fluid-lab.js#L154)).
Thus cube-root spacing compensation alone is insufficient. Retain the existing CPU Splash liquid
until Lane Fluids can verify a replacement's initial volume, visible pool, tap, and mass behavior.
These measurements do not establish volume preservation for the reduced Glass preset either.

## Proposals, ranked by gain for effort

1. **Put the computer hint beside Scene/Liquid and point to Auto detail. Small effort.** Suggested
   text: “This lab runs best on a computer. On a phone, choose Auto detail.” Show it above the
   Scene/Liquid choices for phone Glass/Splash, and after the first sustained-slow reduction for any
   scene. Render it through
   [src/ui.js:557](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/ui.js#L557)
   in the existing
   [index.html:719](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/index.html#L719)
   options area; repeat the sentence in
   [src/toy-help.js:1732](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/toy-help.js#L1732).
   The Detail buttons are at
   [index.html:770](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/index.html#L770).
   The text alone saves **0 ms**. If it gets a phone user from High to Auto/Mid, the matched 6×
   solver's worst p95 falls 90.7 → 24.6 ms, and phone-sized WebGPU Glass soda falls 88.1 → 19.4 ms
   p95. The user's current preference is unknown; this gain is conditional on a heavy tier being
   selected.
2. **Give the lab a smaller phone default for allocations and drawing. Medium effort.** Apply the
   envelope above to phone detection independently of remembered Detail. Keep a deliberate
   higher-detail choice available with the hint; do not silently rewrite the saved device
   preference. The relevant choice is
   [src/player.js:92](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L92);
   the recipe already supports scoped render settings through
   [src/player.js:371](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L371).
   Use that path for a lab DPR cap instead of lowering every toy globally at
   [src/player.js:51](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L51).
   Props are at
   [src/packs/fluid-lab.js:325](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/packs/fluid-lab.js#L325),
   liquid budgets at
   [src/packs/fluid-lab.js:113](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/packs/fluid-lab.js#L113)
   and
   [src/fluids/gpu/liquid.js:19](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/liquid.js#L19),
   and gas grids at
   [src/fluids/gpu/gas.js:334](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/gas.js#L334).
   Expected gain is the tested bundle's **22.2 MiB** tracked allocation saving for GPU Glass water,
   **22.9 MiB** for GPU Splash water, and **26.1 MiB** for GPU Candle, plus about **11.5 ms** less
   worst-case Glass CPU solver p95. Default Mid was already near display cadence on this Mac, so a
   large additional fps gain at Mid is not demonstrated. Lower resolution and particle counts
   require motion and volume review on a phone.
3. **Make sustained-slow recovery cover the current scene and visible stalls. Medium effort.** Use a
   phone predicate independent of tier at
   [src/fluids/gpu/index.js:68](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/index.js#L68).
   Start with an EMA above **33 ms for 1.5 seconds**, observe visible long gaps instead of
   discarding everything over 250 ms, and exclude hidden-page/loading periods explicitly. At
   [src/fluids/gpu/index.js:114](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/index.js#L114),
   lower drawing cost first; if still slow, rebuild current fluid allocations into the phone
   envelope, with a clear scene restart, rather than only lowering substeps. Wire that to
   [src/player.js:207](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L207)
   and runtime creation at
   [src/player.js:742](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/player.js#L742).
   The stage's busy/gap guards at
   [src/stage.js:169](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/stage.js#L169)
   and
   [src/stage.js:195](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/stage.js#L195)
   also need to account for fluid animation. Rebuilding has the measured lower allocation target
   above; reducing CPU High to Mid has up to **66.1 ms** less solver p95. The proposed controller
   itself was not implemented or timed, so recovery latency and frame gains are unverified. At the
   lowest envelope, if the EMA remains above 33 ms for another two seconds, offer a pause and the
   computer hint.
4. **Close the retained projector Compute objects when their cache is cleared. Small code change;
   owning engine review and regression checks needed.** The likely disposal gap is in
   [vendor/playcanvas/playcanvas.min.mjs:14351](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/vendor/playcanvas/playcanvas.min.mjs#L14351):
   `_destroyProjectorComputes()` destroys each cached shader and clears the map, but omits the
   Compute object's own `destroy()`. Its WebGPU implementation releases persistent uniform buffers
   only through that method
   ([vendor/playcanvas/playcanvas.min.mjs:426](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/vendor/playcanvas/playcanvas.min.mjs#L426)).
   Material changes call this cache cleanup; the application boundary is
   [src/stage.js:317](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/stage.js#L317).
   Preserve source excerpts and offsets in
   [vendor-disposal-source.json](fluid-phone-2026-10/vendor-disposal-source.json). The observed
   continuing growth is **two buffers and 448 uniform bytes per four-scene cycle**, beyond a larger
   first-cycle allocation. Closing the old Computes should stop that small recurring graphics
   allocation and release their JavaScript references. The 8.0 MiB after-GC page-heap rise has not
   been attributed entirely to this gap, and no measured frame-time gain is claimed. Do not treat
   shader destruction alone as equivalent to Compute destruction. This audit proposes an engine fix;
   it does not patch the vendored dependency.
5. **Reuse liquid readback arrays and remove per-particle temporary views. Medium effort; timing
   gain unmeasured.**
   [src/fluids/gpu/mpm.js:528](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/mpm.js#L528)
   reads 80 bytes per particle and allocates a 24-byte-per-particle output. Its two `subarray()`
   calls also create two temporary views per particle. Production diffuse work calls it at nominal
   10 Hz for Glass and about 30 Hz for Splash, with one read in flight
   ([src/fluids/gpu/diffuse.js:74](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/gpu/diffuse.js#L74));
   it is not limited to tests despite its comment. At the observed High Glass-water count of 73,141,
   the two byte arrays represent **7.3 MiB per read**, or **72.5 MiB/s at nominal 10 Hz**, plus
   146,282 temporary views per read. A per-instance reusable destination/output and direct six-value
   copies could avoid that recurring allocation after warmup. Actual read frequency can be lower
   because of the pending gate. This is allocation churn, not evidence of a retained-memory leak; no
   frame-time gain is claimed without measuring the proposed change.

## Repeated-use findings

Each API ran twelve taps over one minute, then six cycles of Candle → Hot cup → Splash → Glass, with
one second settling after each of the 24 rebuilds. Main-page heap was collected before and after
those cycles. Both runs captured 36 observations without page/console errors. The soak opens the
default toy first, so its retained rendering capacity differs from the direct-open timing cells;
compare allocations within the soak, not their absolute totals across methods.

| Same Glass scene before / after 24 rebuilds |            WebGL2 |              WebGPU |
| ------------------------------------------- | ----------------: | ------------------: |
| Live device buffer count                    |             4 → 4 |             62 → 74 |
| Tracked texture bytes                       | 40,424,304 → same |   53,459,620 → same |
| Tracked storage-buffer bytes                |          0 → same |   31,295,012 → same |
| Tracked uniform-buffer bytes                |      3,456 → same | 514,624 → 1,029,312 |
| Page heap after GC, MiB                     |       11.8 → 13.0 |         13.7 → 21.7 |
| Array-buffer backing storage after GC, MiB  |       22.3 → 26.9 |         22.3 → 22.4 |

WebGPU's six returns to Glass had buffer counts **64, 66, 68, 70, 72, 74**. Uniform bytes were
1,027,072, 1,027,520, 1,027,968, 1,028,416, 1,028,864, and 1,029,312: **448 more per cycle**. The
first cycle also added 512,000 bytes beyond that slope; that one-time rise is kept separate from
recurring growth. Textures and storage buffers returned to the same allocation each cycle. This
points to retained uniform objects rather than a growing liquid grid. The source cleanup gap above
is supported by the follow-up identity probe: persistent 224-byte buffers with the projector uniform
layout numbered 2 → 4 → 6 → 8 → 10 → 12 → 14 across six cycles. The original buffer identities
remained live throughout and after leaving the lab for the default toy, when there were 15 such
buffers. Every cycle had an empty deferred-deletion queue, and collection ran after each cycle. Thus
this is retained old allocation, not simply newly active buffers awaiting disposal. Other uniform
arena allocations varied in larger blocks and are kept separate from this 224-byte-per-buffer slope.
See [growth.json](fluid-phone-2026-10/growth.json).

During the twelve pours, WebGPU liquid count never exceeded its 14,000 cap; clearing/draining
reduced it again. Device buffers stayed at 62 throughout the pours. WebGL2 buffers stayed at four,
with zero pending time at the sampled points and zero or one spare transfer bundle. Uncollected heap
rose and fell in both runs, then decreased after collection. This is consistent with allocation
churn and does not establish a leak-free page: after-GC heap/backing growth, worker heap outside
these sampled timing cells, native GPU memory, and longer sessions remain unresolved.

The CPU particle arrays have fixed capacities. Its neighbor grid is grow-only, but each axis is
capped at 64; the two dense `Int32Array` tables are bounded at roughly 2 MiB plus one entry
([src/fluids/sim.js:201](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/sim.js#L201),
[src/fluids/sim.js:229](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/sim.js#L229)).
Splash recycles high particles when full
([src/fluids/sim.js:485](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/sim.js#L485)).
The worker permits only one step message in flight
([src/fluids/runtime.js:200](https://github.com/ryanjosephkamp/splashery/blob/aba77089cd935f20358302a8ba8c7b39215b7f2d/src/fluids/runtime.js#L200));
it coalesces time and commands instead of growing a message queue. Those are source bounds, not full
process-memory measurements.

The controlled player `stepDown()` call changed Mid to Low while retaining 105,001 base splats on
both APIs; WebGPU also retained cap 14,000 and grid 28×58×28. The synthetic fluid-watcher probe
ignored a 500-ms gap with a primed slow accumulator, but reduced once for a 50-ms gap. That checks
the guard behavior. It does not demonstrate recovery from a real stall. See
[soak.json](fluid-phone-2026-10/soak.json).

## Per-scene tables

GL means WebGL2; GPU means WebGPU. All values are rounded for display; raw JSON retains precision.
Heap is end-of-run used page/worker heap, without forced collection in these timing cells. Liquid
live/cap and grid counts are end-of-action snapshots. The CSV repeats these end-of-run values on the
two phase rows; its `end*` column names identify that scope. CPU grids show the active neighbor-grid
dimensions' product; GPU liquid grids are fixed, and gas counts sum both grids where present. Fluid
slots, diffuse/vessel counts, grid capacity, and backing storage remain in raw JSON. These are
counts and tracked resources, not a complete memory sum.

A dash in idle cadence for an on-demand toy means no submitted frames in that window. A dash in
worker heap means there was no measured worker for that path; a dash in liquid/grid counts means
that engine metric does not apply. Long-task columns are counts; all individual durations and totals
are in JSON/CSV. First frame is the submitted readiness frame described in the method. † marks the
rejected CPU Splash trials whose starting pool changed or disappeared. Gas scenes' `water` label is
only the unused default Liquid selector.

The fourteen visual peers all use other animation. At Mid/6×, water bottle's GL p95 was 33.9 ms;
every other peer/API was below 33 ms. Low/6× reduced the bottle's scan from 198,766 to 85,396 splats
and its GL p95 to 24.9 ms. Soda can went from 206,534 to 88,868 splats and 32.1 to 23.3 ms GL p95.
Those comparisons combine smaller scans and a lower pixel cap. One 58-ms long task occurred in the
Mid/6× WebGPU bottle action window. Long maximum draw gaps near 5.6 seconds in these on-demand toys
include the idle pause before the first action draw; they do not represent a 5.6-second busy frame.

### glass/water

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.6/18.5 |         16.7/18.5 |                    0/0 |             14.8/2.5 |            38.6 |         474/540 |        100 |            727 |
| mid4 / GPU       |       16.6/18.4 |         16.7/18.6 |                    0/0 |               20.8/— |            63.6 |     13099/14000 |      45472 |            737 |
| mid6 / GL        |       16.8/18.8 |         16.6/18.8 |                    0/0 |             17.2/3.5 |            38.6 |         474/540 |        100 |           1031 |
| mid6 / GPU       |       17.0/20.0 |         16.7/19.6 |                    0/0 |               28.0/— |            63.8 |     13099/14000 |      45472 |           1295 |
| low6 / GL        |       16.6/19.2 |         16.7/19.2 |                    0/0 |             16.0/3.2 |            50.0 |         384/420 |         75 |            851 |
| low6 / GPU       |       16.6/18.9 |         16.6/19.0 |                    0/0 |               25.4/— |            57.5 |       6000/6000 |      24863 |            896 |
| desktop / GL     |       16.7/17.9 |         16.7/18.2 |                    0/0 |             11.6/5.5 |            42.4 |       1135/1200 |        245 |            267 |
| desktop / GPU    |       39.3/45.9 |         44.1/52.5 |                    0/0 |               12.6/— |            81.4 |    73691/120000 |     223109 |            251 |
| half / GL        |       16.7/18.9 |         16.7/18.6 |                    0/0 |             17.0/2.7 |            38.3 |         270/270 |         48 |           1167 |
| half / GPU       |       16.7/18.6 |         16.6/18.8 |                    0/0 |               16.6/— |            62.1 |       6000/6000 |      24863 |           1091 |
| quarter / GL     |       16.7/18.8 |         16.6/18.9 |                    0/0 |             14.4/2.5 |            38.1 |         121/135 |         18 |           1044 |
| quarter / GPU    |       16.7/18.7 |         16.6/19.1 |                    0/0 |               17.6/— |            61.5 |       3000/3000 |      16000 |           1099 |
| eighth / GL      |       16.7/18.7 |         16.7/18.8 |                    0/0 |             17.0/3.8 |            38.1 |           56/68 |         18 |           1152 |
| eighth / GPU     |       16.6/19.0 |         16.7/18.9 |                    0/0 |               15.4/— |            61.1 |       1500/1500 |       7936 |           1097 |
| safe / GL        |       16.8/18.7 |         16.7/18.8 |                    0/0 |             18.7/2.5 |            33.9 |         270/270 |         48 |            849 |
| safe / GPU       |       16.7/19.1 |         16.6/19.0 |                    0/0 |               30.1/— |            41.6 |       6000/6000 |      24863 |            892 |
| high6phone / GL  |       16.6/18.8 |         16.8/18.9 |                    0/0 |             17.1/4.1 |            42.4 |       1135/1200 |        245 |           1221 |
| high6phone / GPU |       41.8/50.1 |         45.3/57.9 |                    0/3 |               14.5/— |            97.0 |    73141/120000 |     223109 |           1282 |
| max6phone / GL   |       16.6/18.4 |         16.6/18.7 |                    0/0 |             15.4/4.3 |            46.9 |       1497/1620 |        384 |           1397 |
| max6phone / GPU  |      87.5/118.7 |         92.9/96.2 |                   9/12 |               19.9/— |           128.7 |   123911/200000 |     399627 |           1445 |
| auto6 / GL       |       16.7/19.0 |         16.6/18.8 |                    0/0 |             16.7/3.4 |            38.6 |         474/540 |        100 |           1057 |
| auto6 / GPU      |       16.8/19.3 |         16.6/19.8 |                    0/0 |               17.9/— |            63.6 |     13099/14000 |      45472 |           1148 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |  10.1/11.3 |         411/540 |  6634 |
| mid6               |  15.1/16.9 |         411/540 |  6634 |
| low6               |    6.2/7.7 |         286/420 |  5170 |
| desktop            |    9.3/9.7 |       1135/1200 | 14806 |
| high6phone         |  55.3/60.7 |       1135/1200 | 14806 |
| half               |   8.5/10.0 |         240/270 |  3336 |
| quarter            |    3.5/4.6 |         106/135 |  1678 |
| eighth             |    1.5/2.4 |           48/68 |   843 |

### glass/soda

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.7/18.4 |         16.7/18.4 |                    0/0 |             14.8/3.0 |            38.7 |         474/540 |        100 |            704 |
| mid4 / GPU       |       16.6/18.8 |         16.7/18.7 |                    0/0 |               22.1/— |            63.6 |     13099/14000 |      45472 |            787 |
| mid6 / GL        |       16.7/19.0 |         16.7/18.5 |                    0/0 |             14.9/4.2 |            38.7 |         474/540 |        100 |           1059 |
| mid6 / GPU       |       16.7/19.9 |         16.7/19.4 |                    0/0 |               28.0/— |            63.6 |     13099/14000 |      45472 |           1088 |
| low6 / GL        |       16.6/18.6 |         16.7/18.7 |                    0/0 |             17.0/3.1 |            50.1 |         384/420 |         75 |            875 |
| low6 / GPU       |       16.6/19.2 |         16.7/18.8 |                    0/0 |               22.6/— |            57.5 |       6000/6000 |      24863 |            884 |
| desktop / GL     |       16.7/18.4 |         16.7/18.3 |                    0/0 |             11.8/4.8 |            42.7 |       1135/1200 |        245 |            259 |
| desktop / GPU    |       40.4/47.0 |         44.3/52.7 |                    0/0 |               12.2/— |            81.7 |    73691/120000 |     223109 |            249 |
| half / GL        |       16.7/18.4 |         16.7/18.6 |                    0/0 |             17.2/4.2 |            38.3 |         270/270 |         48 |           1041 |
| half / GPU       |       16.7/18.9 |         16.6/19.3 |                    0/0 |               14.8/— |            62.1 |       6000/6000 |      24863 |           1089 |
| quarter / GL     |       16.6/18.6 |         16.7/19.0 |                    0/0 |             17.0/3.6 |            38.2 |         121/135 |         18 |           1072 |
| quarter / GPU    |       16.6/19.0 |         16.6/19.3 |                    0/0 |               22.9/— |            61.5 |       3000/3000 |      16000 |           1097 |
| eighth / GL      |       16.7/18.8 |         16.6/18.9 |                    0/0 |             16.5/3.0 |            38.1 |           55/68 |         18 |           1061 |
| eighth / GPU     |       16.6/19.0 |         16.7/19.2 |                    0/0 |               14.6/— |            61.1 |       1500/1500 |       7936 |           1102 |
| safe / GL        |       16.7/19.0 |         16.6/18.8 |                    0/0 |             16.6/2.9 |            34.0 |         270/270 |         48 |            836 |
| safe / GPU       |       16.6/18.6 |         16.6/18.8 |                    0/0 |               22.2/— |            41.6 |       6000/6000 |      24863 |            920 |
| high6phone / GL  |       16.5/18.9 |         16.7/18.7 |                    0/0 |             15.2/5.8 |            42.7 |       1135/1200 |        245 |           1228 |
| high6phone / GPU |       40.2/51.2 |         44.8/88.1 |                    0/0 |               30.2/— |            97.1 |    73306/120000 |     223109 |           1288 |
| max6phone / GL   |       16.7/18.7 |         16.7/18.7 |                    0/0 |             15.1/4.0 |            47.3 |       1497/1620 |        320 |           1417 |
| max6phone / GPU  |      91.0/164.8 |         92.5/96.1 |                    9/9 |               17.2/— |           128.9 |   123911/200000 |     399627 |           1460 |
| auto6 / GL       |       16.7/18.8 |         16.7/18.7 |                    0/0 |             14.5/4.1 |            38.7 |         474/540 |        100 |           1044 |
| auto6 / GPU      |       16.8/19.2 |         16.8/19.2 |                    0/0 |               20.2/— |            63.6 |     13099/14000 |      45472 |           1087 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |  14.5/16.4 |         411/540 |  7787 |
| mid6               |  22.1/24.6 |         411/540 |  7787 |
| low6               |   8.3/10.1 |         286/420 |  6067 |
| desktop            |  13.8/15.5 |       1135/1200 | 18466 |
| high6phone         |  81.5/90.7 |       1135/1200 | 18466 |
| half               |  11.7/13.1 |         240/270 |  3913 |
| quarter            |    4.7/6.3 |         106/135 |  1966 |
| eighth             |    1.7/2.8 |           48/68 |   989 |

### glass/honey

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.7/18.8 |         16.7/18.4 |                    0/0 |             17.3/2.8 |            38.5 |         467/540 |        100 |            777 |
| mid4 / GPU       |       16.7/18.6 |         16.6/18.7 |                    0/0 |               19.9/— |            63.6 |     12206/14000 |      46256 |            733 |
| mid6 / GL        |       16.6/18.7 |         16.7/18.7 |                    0/0 |             17.1/2.5 |            38.5 |         467/540 |        100 |           1113 |
| mid6 / GPU       |       16.6/19.0 |         16.7/19.1 |                    0/0 |               22.2/— |            63.6 |     12206/14000 |      46256 |           1115 |
| low6 / GL        |       16.7/18.6 |         16.6/18.8 |                    0/0 |             18.6/2.2 |            50.0 |         377/420 |         75 |            862 |
| low6 / GPU       |       16.6/19.2 |         16.5/19.1 |                    0/0 |               21.3/— |            57.5 |       6000/6000 |      25392 |            896 |
| desktop / GL     |       16.7/18.3 |         16.7/18.1 |                    0/0 |             14.6/2.3 |            42.3 |       1122/1200 |        245 |            243 |
| desktop / GPU    |       40.6/47.9 |         44.5/52.0 |                    0/0 |               22.7/— |            81.6 |    69676/120000 |     227527 |            253 |
| half / GL        |       16.6/18.8 |         16.6/18.6 |                    0/0 |             17.1/2.5 |            38.3 |         267/270 |         48 |           1068 |
| half / GPU       |       16.6/18.7 |         16.6/19.0 |                    0/0 |               26.3/— |            62.1 |       6000/6000 |      25392 |           1106 |
| quarter / GL     |       16.8/18.6 |         16.6/18.8 |                    0/0 |             17.0/2.0 |            38.1 |         120/135 |         18 |           1044 |
| quarter / GPU    |       16.6/18.7 |         16.7/19.1 |                    0/0 |               25.6/— |            61.5 |       3000/3000 |      16400 |           1104 |
| eighth / GL      |       16.7/18.8 |         16.7/18.7 |                    0/0 |             17.3/3.0 |            38.1 |           55/68 |         18 |           1064 |
| eighth / GPU     |       16.7/18.9 |         16.6/19.1 |                    0/0 |               19.0/— |            61.1 |       1500/1500 |       8192 |           1089 |
| safe / GL        |       16.6/18.8 |         16.8/18.4 |                    0/0 |             18.7/2.5 |            33.9 |         267/270 |         48 |            822 |
| safe / GPU       |       16.7/18.7 |         16.6/19.0 |                    0/0 |               28.9/— |            41.6 |       6000/6000 |      25392 |            883 |
| high6phone / GL  |       16.7/18.8 |         16.7/18.5 |                    0/0 |             15.8/3.2 |            42.3 |       1122/1200 |        245 |           1224 |
| high6phone / GPU |       41.4/48.9 |         45.0/83.5 |                    0/0 |               23.2/— |            97.1 |    69621/120000 |     227527 |           1297 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |   8.8/10.7 |         404/540 |  6255 |
| mid6               |  13.2/15.8 |         404/540 |  6255 |
| low6               |    5.3/6.9 |         286/420 |  4865 |
| desktop            |    8.3/9.6 |       1122/1200 | 13944 |
| high6phone         |  50.1/58.0 |       1122/1200 | 13944 |
| half               |    7.2/8.9 |         232/270 |  3128 |
| quarter            |    3.1/4.4 |         105/135 |  1564 |
| eighth             |    1.3/2.2 |           47/68 |   784 |

### glass/lava

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.8/18.5 |         16.7/18.4 |                    0/0 |             14.7/2.7 |            38.5 |         467/540 |        100 |            715 |
| mid4 / GPU       |       16.6/18.7 |         16.6/18.6 |                    0/0 |               18.0/— |            63.6 |      5675/14000 |      46256 |            728 |
| mid6 / GL        |       16.6/18.6 |         16.7/18.7 |                    0/0 |             17.2/3.4 |            38.5 |         467/540 |        100 |           1103 |
| mid6 / GPU       |       16.6/19.0 |         16.7/19.0 |                    0/0 |               17.4/— |            63.6 |      5675/14000 |      46256 |           1115 |
| low6 / GL        |       16.7/18.5 |         16.7/18.7 |                    0/0 |             18.4/3.3 |            50.0 |         377/420 |         75 |            863 |
| low6 / GPU       |       16.7/18.9 |         16.6/19.1 |                    0/0 |               29.2/— |            57.5 |       2799/6000 |      25392 |            895 |
| desktop / GL     |       16.7/18.3 |         16.7/18.1 |                    0/0 |             11.5/3.8 |            42.3 |       1122/1200 |        245 |            257 |
| desktop / GPU    |       16.7/20.5 |         20.1/29.5 |                    0/0 |               14.3/— |            81.5 |    33215/120000 |     227527 |            253 |
| half / GL        |       16.7/18.7 |         16.7/18.7 |                    0/0 |             17.1/2.0 |            38.3 |         267/270 |         48 |           1063 |
| half / GPU       |       16.7/18.9 |         16.7/19.2 |                    0/0 |               17.3/— |            62.1 |       2799/6000 |      25392 |           1094 |
| quarter / GL     |       16.8/18.6 |         16.7/18.6 |                    0/0 |             17.2/1.9 |            38.1 |         120/135 |         18 |           1061 |
| quarter / GPU    |       16.7/18.7 |         16.6/18.9 |                    0/0 |               17.2/— |            61.5 |       1780/3000 |      16400 |           1098 |
| eighth / GL      |       16.7/18.8 |         16.6/18.7 |                    0/0 |             17.1/2.0 |            38.1 |           55/68 |         18 |           1063 |
| eighth / GPU     |       16.7/18.7 |         16.7/19.2 |                    0/0 |               16.7/— |            61.1 |        704/1500 |       8192 |           1116 |
| safe / GL        |       16.6/18.7 |         16.6/18.8 |                    0/0 |             18.5/3.5 |            33.9 |         267/270 |         48 |            834 |
| safe / GPU       |       16.6/19.0 |         16.8/18.7 |                    0/0 |               25.1/— |            41.6 |       2799/6000 |      25392 |            852 |
| high6phone / GL  |       16.6/19.4 |         16.7/18.9 |                    0/0 |             15.5/4.2 |            42.3 |       1122/1200 |        245 |           1237 |
| high6phone / GPU |       16.4/30.1 |         22.0/30.5 |                    0/0 |               26.0/— |            96.9 |    33124/120000 |     227527 |           1287 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |   8.8/10.3 |         404/540 |  6255 |
| mid6               |  13.1/15.8 |         404/540 |  6255 |
| low6               |    5.2/6.6 |         286/420 |  4865 |
| desktop            |    8.2/9.6 |       1122/1200 | 13944 |
| high6phone         |  49.3/58.4 |       1122/1200 | 13944 |
| half               |    7.3/8.7 |         232/270 |  3128 |
| quarter            |    3.1/4.3 |         105/135 |  1564 |
| eighth             |    1.4/2.3 |           47/68 |   784 |

### splash/water

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.7/18.5 |         16.6/18.4 |                    0/0 |             14.6/3.8 |            38.8 |         348/585 |        110 |            693 |
| mid4 / GPU       |       16.7/18.3 |         16.7/18.7 |                    0/0 |               20.6/— |            65.2 |     13177/14000 |      98838 |            714 |
| mid6 / GL        |       16.7/18.8 |         16.7/19.0 |                    0/0 |             14.4/3.7 |            38.8 |         348/585 |        110 |           1057 |
| mid6 / GPU       |       16.8/19.5 |         16.8/20.2 |                    0/0 |               25.4/— |            65.4 |     13175/14000 |      98838 |           1080 |
| low6 / GL        |       16.7/18.7 |         16.6/18.8 |                    0/0 |             17.7/2.6 |            50.2 |         282/455 |        100 |            860 |
| low6 / GPU       |       16.7/19.1 |         16.7/19.1 |                    0/0 |               30.0/— |            58.4 |       5698/6000 |      54684 |            890 |
| desktop / GL     |       16.7/18.2 |         16.7/18.3 |                    0/0 |             11.8/3.4 |            42.8 |       1119/1300 |        196 |            271 |
| desktop / GPU    |       60.7/70.8 |         62.1/73.7 |                    0/0 |               11.9/— |            90.7 |    93421/120000 |     522786 |            288 |
| half† / GL       |       16.6/18.5 |         16.6/18.5 |                    0/0 |             17.0/3.7 |            38.4 |          32/293 |         24 |           1033 |
| half / GPU       |       16.5/18.9 |         16.6/18.7 |                    0/0 |               15.1/— |            63.0 |       5700/6000 |      54684 |           1072 |
| quarter† / GL    |       16.7/18.8 |         16.7/18.9 |                    0/0 |             17.2/3.2 |            38.2 |          19/146 |         25 |           1035 |
| quarter / GPU    |       16.6/18.9 |         16.6/19.3 |                    0/0 |               13.8/— |            62.1 |       2871/3000 |      34992 |           1102 |
| eighth† / GL     |       16.6/18.6 |         16.6/18.9 |                    0/0 |             17.1/3.8 |            38.1 |           69/73 |         25 |           1046 |
| eighth / GPU     |       16.5/19.2 |         16.7/19.1 |                    0/0 |               16.8/— |            61.4 |       1417/1500 |      16464 |           1084 |
| safe / GL        |       16.6/18.8 |         16.6/18.9 |                    0/0 |             17.1/3.4 |            34.2 |         348/585 |        121 |            821 |
| safe / GPU       |       16.7/19.1 |         16.6/18.9 |                    0/0 |               29.5/— |            42.5 |       5700/6000 |      54684 |            861 |
| high6phone / GL  |       16.6/18.4 |         16.6/18.8 |                    0/0 |             15.0/3.4 |            42.8 |       1122/1300 |        392 |           1203 |
| high6phone / GPU |      58.9/124.3 |        62.3/127.2 |                  15/17 |               15.1/— |           106.0 |    93419/120000 |     522786 |           1293 |
| max6phone / GL   |       16.7/19.1 |         16.6/18.5 |                    0/0 |             15.9/3.1 |            47.5 |        787/1755 |        256 |           1420 |
| max6phone / GPU  |     125.7/233.2 |       129.8/149.2 |                    6/7 |               20.6/— |           145.1 |   163152/200000 |     933120 |           1468 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |    6.8/7.9 |         348/585 |  9263 |
| mid6               |  10.1/11.9 |         348/585 |  9263 |
| low6               |    5.8/6.7 |         282/455 |  7281 |
| desktop            |    7.7/7.9 |       1121/1300 | 20143 |
| high6phone         |  46.0/48.9 |       1121/1300 | 20143 |
| half†              |    1.2/1.9 |          32/293 |  4777 |
| quarter†           |    0.5/1.6 |          19/146 |  2466 |
| eighth†            |    1.8/2.9 |           69/73 |  1277 |

### splash/soda

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.6/18.5 |         16.6/18.5 |                    0/0 |             17.3/4.0 |            38.9 |         348/585 |        121 |            746 |
| mid4 / GPU       |       16.7/18.2 |         16.6/18.9 |                    0/0 |               13.1/— |            65.2 |     13176/14000 |      98838 |            714 |
| mid6 / GL        |       16.7/19.0 |         16.7/18.8 |                    0/0 |             17.3/3.2 |            38.9 |         348/585 |        110 |           1040 |
| mid6 / GPU       |       16.8/19.3 |         17.0/20.1 |                    0/0 |               18.1/— |            65.4 |     13174/14000 |      98838 |           1098 |
| low6 / GL        |       16.8/18.7 |         16.7/18.9 |                    0/0 |             18.7/2.8 |            50.3 |         282/455 |        100 |            858 |
| low6 / GPU       |       16.7/18.9 |         16.6/18.7 |                    0/0 |               22.7/— |            58.4 |       5700/6000 |      54684 |            910 |
| desktop / GL     |       16.7/18.1 |         16.7/18.1 |                    0/0 |             13.3/4.9 |            43.1 |       1126/1300 |        392 |            284 |
| desktop / GPU    |       59.8/70.3 |         61.8/73.6 |                    0/0 |               12.3/— |            90.6 |    93416/120000 |     522786 |            296 |
| half† / GL       |       16.7/18.6 |         16.7/18.9 |                    0/0 |             17.0/2.7 |            38.5 |          32/293 |         42 |           1053 |
| half / GPU       |       16.6/18.4 |         16.6/18.5 |                    0/0 |               24.6/— |            63.0 |       5701/6000 |      54684 |           1084 |
| quarter† / GL    |       16.8/18.7 |         16.6/18.9 |                    0/0 |             16.7/3.6 |            38.2 |          19/146 |         10 |           1023 |
| quarter / GPU    |       16.5/18.8 |         16.6/19.1 |                    0/0 |               21.9/— |            62.1 |       2873/3000 |      34992 |           1091 |
| eighth† / GL     |       16.8/18.9 |         16.6/19.0 |                    0/0 |             17.0/3.7 |            38.1 |           69/73 |         25 |           1062 |
| eighth / GPU     |       16.6/18.9 |         16.6/18.9 |                    0/0 |               16.5/— |            61.6 |       1417/1500 |      16464 |           1103 |
| safe / GL        |       16.6/18.4 |         16.6/18.7 |                    0/0 |             17.2/3.9 |            34.3 |         348/585 |        121 |            805 |
| safe / GPU       |       16.6/18.8 |         16.7/19.0 |                    0/0 |               24.7/— |            42.5 |       5701/6000 |      54684 |            850 |
| high6phone / GL  |       16.6/18.6 |         16.6/18.7 |                    0/0 |             15.2/4.9 |            43.1 |       1122/1300 |        392 |           1240 |
| high6phone / GPU |       59.7/81.1 |         62.6/88.4 |                  15/16 |               12.1/— |           106.3 |    93417/120000 |     522786 |           1267 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |  10.3/13.1 |         348/585 | 10512 |
| mid6               |  15.3/18.3 |         348/585 | 10512 |
| low6               |    8.3/9.5 |         282/455 |  8253 |
| desktop            |  13.0/14.0 |       1121/1300 | 24108 |
| high6phone         |  76.3/83.3 |       1121/1300 | 24108 |
| half†              |    1.3/2.2 |          32/293 |  5403 |
| quarter†           |    1.0/1.6 |          19/146 |  2778 |
| eighth†            |    2.0/2.9 |           69/73 |  1433 |

### splash/honey

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.7/18.5 |         16.7/18.4 |                    0/0 |             14.4/2.2 |            38.7 |         348/585 |        121 |            711 |
| mid4 / GPU       |       16.7/18.8 |         16.7/19.0 |                    0/0 |               24.9/— |            65.2 |     13177/14000 |      98838 |            722 |
| mid6 / GL        |       16.7/18.7 |         16.7/18.6 |                    0/0 |             17.2/4.2 |            38.7 |         348/585 |        121 |           1061 |
| mid6 / GPU       |       16.7/18.9 |         16.8/19.5 |                    0/0 |               20.1/— |            65.4 |     13175/14000 |      98838 |           1087 |
| low6 / GL        |       16.7/18.8 |         16.7/18.6 |                    0/0 |             18.6/2.8 |            50.1 |         282/455 |        100 |            853 |
| low6 / GPU       |       16.5/19.2 |         16.7/19.0 |                    0/0 |               27.8/— |            58.4 |       5698/6000 |      54684 |            890 |
| desktop / GL     |       16.7/18.1 |         16.7/18.3 |                    0/0 |             11.7/2.9 |            42.6 |       1121/1300 |        196 |            280 |
| desktop / GPU    |       61.9/71.4 |         63.0/72.9 |                    0/0 |               11.9/— |            90.6 |    93419/120000 |     522786 |            281 |
| half† / GL       |       16.6/18.6 |         16.7/18.6 |                    0/0 |             17.0/3.2 |            38.3 |          32/293 |          9 |           1018 |
| half / GPU       |       16.7/19.0 |         16.7/19.0 |                    0/0 |               17.3/— |            63.0 |       5698/6000 |      54684 |           1076 |
| quarter† / GL    |       16.7/18.7 |         16.7/18.9 |                    0/0 |             16.7/2.4 |            38.2 |          19/146 |          4 |           1044 |
| quarter / GPU    |       16.6/18.8 |         16.6/19.0 |                    0/0 |               23.9/— |            62.1 |       2871/3000 |      34992 |           1111 |
| eighth† / GL     |       16.7/18.4 |         16.6/18.4 |                    0/0 |             17.0/2.7 |            38.1 |           69/73 |         20 |           1032 |
| eighth / GPU     |       16.7/19.0 |         16.6/18.7 |                    0/0 |               16.9/— |            61.4 |       1418/1500 |      16464 |           1081 |
| safe / GL        |       16.7/18.5 |         16.6/18.7 |                    0/0 |             16.3/2.3 |            34.1 |         348/585 |        110 |            820 |
| safe / GPU       |       16.7/18.9 |         16.6/18.8 |                    0/0 |               21.9/— |            42.5 |       5700/6000 |      54684 |            857 |
| high6phone / GL  |       16.7/19.1 |         16.7/18.8 |                    0/0 |             15.0/2.9 |            42.6 |       1121/1300 |        196 |           1212 |
| high6phone / GPU |       59.9/70.2 |         61.3/78.5 |                  14/17 |               12.5/— |           106.0 |    93415/120000 |     522786 |           1273 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |    6.9/7.7 |         348/585 |  7789 |
| mid6               |  10.3/11.4 |         348/585 |  7789 |
| low6               |    5.2/6.1 |         282/455 |  6058 |
| desktop            |    7.5/7.8 |       1121/1300 | 17356 |
| high6phone         |  45.8/48.2 |       1121/1300 | 17356 |
| half†              |    1.2/2.1 |          32/293 |  3897 |
| quarter†           |    0.5/1.7 |          19/146 |  1946 |
| eighth†            |    1.7/2.8 |           69/73 |   973 |

### splash/lava

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.6/18.5 |         16.7/18.4 |                    0/0 |             17.0/3.3 |            38.7 |         348/585 |        110 |            700 |
| mid4 / GPU       |       16.6/19.0 |         16.7/18.8 |                    0/0 |               25.0/— |            65.2 |     13174/14000 |      98838 |            736 |
| mid6 / GL        |       16.6/18.8 |         16.6/18.8 |                    0/0 |             17.2/2.3 |            38.7 |         348/585 |        121 |           1085 |
| mid6 / GPU       |       16.7/19.2 |         16.6/19.2 |                    0/0 |               25.6/— |            65.4 |     13175/14000 |      98838 |           1084 |
| low6 / GL        |       16.7/18.7 |         16.6/18.7 |                    0/0 |             18.3/2.2 |            50.1 |         282/455 |         90 |            867 |
| low6 / GPU       |       16.7/18.8 |         16.8/18.6 |                    0/0 |               18.4/— |            58.4 |       5698/6000 |      54684 |            898 |
| desktop / GL     |       16.6/18.3 |         16.7/18.0 |                    0/0 |             13.3/3.0 |            42.6 |       1121/1300 |        196 |            367 |
| desktop / GPU    |       60.8/70.5 |         62.3/72.8 |                    0/0 |               12.2/— |            90.7 |    93413/120000 |     522786 |            275 |
| half† / GL       |       16.7/18.5 |         16.7/18.7 |                    0/0 |             16.9/2.4 |            38.3 |          32/293 |          9 |           1034 |
| half / GPU       |       16.7/18.6 |         16.7/19.4 |                    0/0 |               24.4/— |            63.0 |       5698/6000 |      54684 |           1107 |
| quarter† / GL    |       16.7/18.4 |         16.7/18.7 |                    0/0 |             16.9/2.6 |            38.2 |          19/146 |          6 |           1024 |
| quarter / GPU    |       16.7/18.8 |         16.6/19.0 |                    0/0 |               17.4/— |            62.1 |       2873/3000 |      34992 |           1112 |
| eighth† / GL     |       16.5/18.8 |         16.7/18.8 |                    0/0 |             16.8/2.5 |            38.1 |           69/73 |         20 |           1049 |
| eighth / GPU     |       16.7/19.1 |         16.6/19.1 |                    0/0 |               17.8/— |            61.4 |       1418/1500 |      16464 |           1085 |
| safe / GL        |       16.6/18.7 |         16.7/18.6 |                    0/0 |             16.8/3.2 |            34.1 |         348/585 |        110 |            800 |
| safe / GPU       |       16.7/18.8 |         16.6/19.0 |                    0/0 |               25.1/— |            42.5 |       5700/6000 |      54684 |            847 |
| high6phone / GL  |       16.6/19.0 |         16.7/18.7 |                    0/0 |             15.1/3.3 |            42.6 |       1121/1300 |        196 |           1233 |
| high6phone / GPU |      60.2/117.7 |         61.7/74.9 |                  14/17 |               12.5/— |           106.0 |    93415/120000 |     522786 |           1273 |

| CPU solver setting | Med/p95 ms | Liquid live/cap | Slots |
| ------------------ | ---------: | --------------: | ----: |
| mid4               |    7.1/7.8 |         348/585 |  7789 |
| mid6               |  10.7/11.7 |         348/585 |  7789 |
| low6               |    5.4/6.3 |         282/455 |  6058 |
| desktop            |    7.5/7.8 |       1121/1300 | 17356 |
| high6phone         |  45.1/47.5 |       1121/1300 | 17356 |
| half†              |    1.1/2.0 |          32/293 |  3897 |
| quarter†           |    0.7/1.5 |          19/146 |  1946 |
| eighth†            |    1.7/2.7 |           69/73 |   973 |

### candle/water

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.7/18.5 |         16.7/18.4 |                    0/0 |             16.2/1.1 |            61.0 |               — |     134848 |            700 |
| mid4 / GPU       |       16.6/18.8 |         16.7/18.9 |                    0/0 |             13.8/1.1 |            69.7 |               — |     134848 |            714 |
| mid6 / GL        |       16.6/19.0 |         16.7/18.8 |                    0/0 |             15.8/1.1 |            61.0 |               — |     134848 |           1013 |
| mid6 / GPU       |       16.7/18.9 |         16.6/19.1 |                    0/0 |             15.3/1.1 |            69.7 |               — |     134848 |           1090 |
| low6 / GL        |       16.7/18.6 |         16.7/18.3 |                    0/0 |             18.2/1.1 |            55.8 |               — |      49200 |            894 |
| low6 / GPU       |       16.7/19.0 |         16.6/19.0 |                    0/0 |             21.6/1.1 |            59.3 |               — |      49200 |            905 |
| desktop / GL     |       16.7/18.6 |         16.6/18.6 |                    0/0 |             14.4/1.1 |            85.6 |               — |     522720 |            286 |
| desktop / GPU    |       16.6/19.2 |         16.7/19.1 |                    0/0 |             22.9/1.1 |            96.4 |               — |     522720 |            263 |
| half / GL        |       16.6/18.8 |         16.7/18.8 |                    0/0 |             16.1/1.1 |            55.2 |               — |      49200 |           1026 |
| half / GPU       |       16.6/19.1 |         16.7/19.0 |                    0/0 |             14.7/1.1 |            63.8 |               — |      49200 |           1069 |
| quarter / GL     |       16.7/18.9 |         16.8/18.5 |                    0/0 |             15.8/1.1 |            53.7 |               — |      25088 |           1038 |
| quarter / GPU    |       16.6/18.9 |         16.6/18.9 |                    0/0 |             14.3/1.1 |            62.4 |               — |      25088 |           1049 |
| eighth / GL      |       16.6/18.7 |         16.7/18.7 |                    0/0 |             15.2/1.0 |            52.8 |               — |      10656 |            994 |
| eighth / GPU     |       16.6/18.9 |         16.7/18.9 |                    0/0 |             19.3/1.1 |            61.5 |               — |      10656 |           1061 |
| safe / GL        |       16.6/18.6 |         16.6/18.8 |                    0/0 |             16.0/1.1 |            40.2 |               — |      49200 |            801 |
| safe / GPU       |       16.7/18.9 |         16.6/19.0 |                    0/0 |             21.8/1.1 |            43.5 |               — |      49200 |            838 |
| high6phone / GL  |       16.7/18.6 |         16.7/18.7 |                    0/0 |             15.9/1.1 |            97.7 |               — |     522720 |           1148 |
| high6phone / GPU |       16.7/18.8 |         16.7/19.3 |                    0/0 |             15.3/1.1 |           112.1 |               — |     522720 |           1279 |
| max6phone / GL   |       16.8/19.0 |         16.7/18.8 |                    0/0 |             15.1/1.1 |           139.1 |               — |    1078784 |           1314 |
| max6phone / GPU  |       16.7/19.3 |         16.7/19.0 |                    0/0 |             14.2/1.1 |           160.0 |               — |    1078784 |           1384 |
| auto6 / GL       |       16.6/18.7 |         16.7/18.6 |                    0/0 |             15.4/1.1 |            61.0 |               — |     134848 |            995 |
| auto6 / GPU      |       16.7/19.1 |         16.7/19.1 |                    0/0 |             14.6/1.1 |            69.7 |               — |     134848 |           1067 |

The solver-only probe excludes gas grids. Its zero-work rows do not measure this scene's gas
simulation.

### cup/water

| Setting / API    | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ---------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL        |       16.7/18.6 |         16.7/18.1 |                    0/0 |             15.6/1.0 |            54.6 |               — |      36848 |            714 |
| mid4 / GPU       |       16.7/18.8 |         16.6/18.8 |                    0/0 |             21.8/1.0 |            63.2 |               — |      36848 |            737 |
| mid6 / GL        |       16.6/18.5 |         16.7/18.6 |                    0/0 |             15.7/0.9 |            54.6 |               — |      36848 |           1086 |
| mid6 / GPU       |       16.7/19.2 |         16.7/19.3 |                    0/0 |             21.9/1.0 |            63.2 |               — |      36848 |           1109 |
| low6 / GL        |       16.6/19.0 |         16.7/18.9 |                    0/0 |             18.3/0.9 |            53.6 |               — |      13200 |            881 |
| low6 / GPU       |       16.6/19.2 |         16.6/19.1 |                    0/0 |             22.9/1.0 |            57.0 |               — |      13200 |            939 |
| desktop / GL     |       16.7/18.3 |         16.6/19.0 |                    0/0 |             20.6/1.0 |            59.7 |               — |     141328 |            290 |
| desktop / GPU    |       16.6/18.9 |         16.6/18.6 |                    0/0 |             22.1/0.9 |            70.3 |               — |     141328 |            275 |
| half / GL        |       16.6/18.7 |         16.7/18.8 |                    0/0 |             15.6/0.9 |            53.0 |               — |      13200 |           1063 |
| half / GPU       |       16.7/18.9 |         16.7/18.6 |                    0/0 |             15.4/0.9 |            61.7 |               — |      13200 |           1214 |
| quarter / GL     |       16.7/18.6 |         16.6/18.6 |                    0/0 |             15.3/0.9 |            52.6 |               — |       6912 |           1067 |
| quarter / GPU    |       16.7/19.0 |         16.7/18.9 |                    0/0 |             21.8/1.0 |            61.3 |               — |       6912 |           1108 |
| eighth / GL      |       16.7/18.5 |         16.7/18.7 |                    0/0 |             15.6/0.9 |            52.3 |               — |       2880 |           1070 |
| eighth / GPU     |       16.7/19.5 |         16.8/19.3 |                    0/0 |             22.0/0.9 |            60.8 |               — |       2880 |           1093 |
| safe / GL        |       16.7/18.7 |         16.6/18.5 |                    0/0 |             18.0/0.9 |            38.0 |               — |      13200 |            841 |
| safe / GPU       |       16.7/19.1 |         16.7/18.8 |                    0/0 |             19.9/1.0 |            41.0 |               — |      13200 |            888 |
| high6phone / GL  |       16.6/18.7 |         16.7/18.5 |                    0/0 |             15.4/0.9 |            71.8 |               — |     141328 |           1225 |
| high6phone / GPU |       16.7/19.0 |         16.7/19.1 |                    0/0 |             19.0/0.9 |            86.1 |               — |     141328 |           1285 |
| auto6 / GL       |       16.7/18.7 |         16.8/18.8 |                    0/0 |             14.8/0.9 |            54.6 |               — |      36848 |           1041 |
| auto6 / GPU      |       16.7/18.9 |         16.7/19.0 |                    0/0 |             18.0/1.0 |            63.1 |               — |      36848 |           1106 |

The solver-only probe excludes gas grids. Its zero-work rows do not measure this scene's gas
simulation.

### Fluid visual peers

#### water-bottle

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |             —/— |         16.8/27.9 |                    0/0 |               14.6/— |            44.4 |               — |          — |            807 |
| mid4 / GPU    |             —/— |         16.7/27.4 |                    0/0 |               16.0/— |            54.7 |               — |          — |            883 |
| mid6 / GL     |             —/— |         16.1/33.9 |                    0/0 |               15.1/— |            44.4 |               — |          — |           1232 |
| mid6 / GPU    |             —/— |         16.3/32.5 |                    0/1 |               15.7/— |            55.0 |               — |          — |           1297 |
| desktop / GL  |             —/— |         16.7/23.4 |                    0/0 |               15.5/— |            50.3 |               — |          — |            316 |
| desktop / GPU |             —/— |         16.9/26.8 |                    0/0 |               18.6/— |            64.8 |               — |          — |            295 |
| low6 / GL     |             —/— |         16.6/24.9 |                    0/0 |               13.2/— |            52.0 |               — |          — |           1027 |
| low6 / GPU    |             —/— |         16.5/23.9 |                    0/0 |               19.0/— |            56.7 |               — |          — |           1087 |

#### soda-can

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |             —/— |         16.6/26.5 |                    0/0 |               13.9/— |            45.0 |               — |          — |            826 |
| mid4 / GPU    |             —/— |         16.7/24.9 |                    0/0 |               18.6/— |            55.6 |               — |          — |            887 |
| mid6 / GL     |             —/— |         16.2/32.1 |                    0/0 |               16.0/— |            45.0 |               — |          — |           1262 |
| mid6 / GPU    |             —/— |         16.6/28.3 |                    0/0 |               14.5/— |            55.7 |               — |          — |           1293 |
| desktop / GL  |             —/— |         16.6/24.6 |                    0/0 |               18.9/— |            51.1 |               — |          — |            343 |
| desktop / GPU |             —/— |         16.8/24.6 |                    0/0 |               18.0/— |            66.1 |               — |          — |            324 |
| low6 / GL     |             —/— |         16.6/23.3 |                    0/0 |               15.0/— |            52.3 |               — |          — |           1010 |
| low6 / GPU    |             —/— |         16.7/22.4 |                    0/0 |               18.2/— |            57.1 |               — |          — |           1061 |

#### lava-lamp

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.4 |         16.7/18.7 |                    0/0 |               16.3/— |            40.4 |               — |          — |            907 |
| mid4 / GPU    |       16.7/18.7 |         16.6/18.7 |                    0/0 |               19.5/— |            47.8 |               — |          — |            958 |
| mid6 / GL     |       16.7/18.9 |         16.7/18.6 |                    0/0 |               16.3/— |            40.4 |               — |          — |           1390 |
| mid6 / GPU    |       16.7/19.0 |         16.6/18.9 |                    0/0 |               14.9/— |            47.8 |               — |          — |           1432 |
| desktop / GL  |       16.6/18.8 |         16.6/18.6 |                    0/0 |               13.7/— |            44.5 |               — |          — |            350 |
| desktop / GPU |       16.6/18.2 |         16.7/18.2 |                    0/0 |               24.6/— |            54.8 |               — |          — |            364 |

#### waterfall

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.4 |         16.7/18.6 |                    0/0 |               14.6/— |            40.4 |               — |          — |            949 |
| mid4 / GPU    |       16.6/18.6 |         16.7/18.6 |                    0/0 |               18.3/— |            47.5 |               — |          — |            926 |
| mid6 / GL     |       16.6/18.6 |         16.7/18.8 |                    0/0 |               14.0/— |            40.4 |               — |          — |           1334 |
| mid6 / GPU    |       16.6/18.9 |         16.6/19.1 |                    0/0 |               19.3/— |            47.5 |               — |          — |           1415 |
| desktop / GL  |       16.6/18.6 |         16.7/18.4 |                    0/0 |               16.0/— |            44.5 |               — |          — |            362 |
| desktop / GPU |       16.6/18.1 |         16.6/18.3 |                    0/0 |               21.2/— |            54.6 |               — |          — |            359 |

#### ocean-wave

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.7/18.6 |         16.8/18.8 |                    0/0 |               15.6/— |            40.4 |               — |          — |            984 |
| mid4 / GPU    |       16.7/18.5 |         16.6/18.8 |                    0/0 |               17.6/— |            46.3 |               — |          — |            979 |
| mid6 / GL     |       16.7/18.9 |         16.7/18.7 |                    0/0 |               14.8/— |            40.4 |               — |          — |           1446 |
| mid6 / GPU    |       16.6/18.8 |         16.6/18.9 |                    0/0 |               18.5/— |            46.3 |               — |          — |           1479 |
| desktop / GL  |       16.6/18.8 |         16.7/18.6 |                    0/0 |               14.1/— |            44.5 |               — |          — |            360 |
| desktop / GPU |       16.7/18.5 |         16.7/18.2 |                    0/0 |               19.0/— |            52.8 |               — |          — |            359 |

#### candle

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.9 |         16.7/18.8 |                    0/0 |               13.8/— |            40.4 |               — |          — |            964 |
| mid4 / GPU    |       16.6/18.7 |         16.7/18.7 |                    0/0 |               20.8/— |            47.8 |               — |          — |            943 |
| mid6 / GL     |       16.7/18.7 |         16.7/18.5 |                    0/0 |               16.1/— |            40.4 |               — |          — |           1369 |
| mid6 / GPU    |       16.6/18.9 |         16.7/19.1 |                    0/0 |               15.7/— |            47.8 |               — |          — |           1479 |
| desktop / GL  |       16.6/18.4 |         16.6/18.7 |                    0/0 |               14.9/— |            44.5 |               — |          — |            342 |
| desktop / GPU |       16.7/18.0 |         16.6/18.1 |                    0/0 |               17.5/— |            55.0 |               — |          — |            361 |

#### coffee

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.7/18.5 |         16.7/18.4 |                    0/0 |               14.7/— |            40.4 |               — |          — |            998 |
| mid4 / GPU    |       16.7/18.8 |         16.6/18.6 |                    0/0 |               20.7/— |            47.7 |               — |          — |           1019 |
| mid6 / GL     |       16.7/18.5 |         16.7/18.9 |                    0/0 |               14.5/— |            40.4 |               — |          — |           1499 |
| mid6 / GPU    |       16.7/18.8 |         16.7/18.7 |                    0/0 |               23.5/— |            47.7 |               — |          — |           1541 |
| desktop / GL  |       16.6/18.5 |         16.6/18.8 |                    0/0 |               13.7/— |            44.5 |               — |          — |            376 |
| desktop / GPU |       16.7/18.2 |         16.7/18.5 |                    0/0 |               18.8/— |            54.8 |               — |          — |            378 |

#### birthday-cake

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.7 |         16.6/18.6 |                    0/0 |               16.4/— |            40.4 |               — |          — |            902 |
| mid4 / GPU    |       16.6/18.8 |         16.6/18.6 |                    0/0 |               19.0/— |            47.8 |               — |          — |            919 |
| mid6 / GL     |       16.7/18.9 |         16.7/18.8 |                    0/0 |               14.1/— |            40.4 |               — |          — |           1337 |
| mid6 / GPU    |       16.8/19.0 |         16.7/18.9 |                    0/0 |               21.3/— |            47.8 |               — |          — |           1387 |
| desktop / GL  |       16.6/18.4 |         16.6/18.3 |                    0/0 |               15.4/— |            44.5 |               — |          — |            358 |
| desktop / GPU |       16.6/18.3 |         16.7/18.4 |                    0/0 |               22.7/— |            54.9 |               — |          — |            363 |

#### campfire

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.3 |         16.7/18.7 |                    0/0 |               14.6/— |            40.4 |               — |          — |            826 |
| mid4 / GPU    |       16.6/18.8 |         16.7/18.7 |                    0/0 |               21.1/— |            47.8 |               — |          — |            825 |
| mid6 / GL     |       16.7/18.7 |         16.7/18.8 |                    0/0 |               14.4/— |            40.4 |               — |          — |           1196 |
| mid6 / GPU    |       16.6/19.2 |         16.8/19.0 |                    0/0 |               14.0/— |            47.8 |               — |          — |           1290 |
| desktop / GL  |       16.6/18.7 |         16.6/18.8 |                    0/0 |               15.6/— |            44.5 |               — |          — |            278 |
| desktop / GPU |       16.7/18.0 |         16.7/18.1 |                    0/0 |               25.0/— |            54.9 |               — |          — |            321 |

#### volcano

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.6 |         16.7/18.4 |                    0/0 |               14.8/— |            40.4 |               — |          — |            851 |
| mid4 / GPU    |       16.6/18.6 |         16.6/18.4 |                    0/0 |               22.9/— |            47.8 |               — |          — |            836 |
| mid6 / GL     |       16.6/18.6 |         16.6/18.8 |                    0/0 |               14.5/— |            40.4 |               — |          — |           1216 |
| mid6 / GPU    |       16.7/18.8 |         16.7/19.0 |                    0/0 |               14.9/— |            47.8 |               — |          — |           1283 |
| desktop / GL  |       16.6/18.6 |         16.6/18.4 |                    0/0 |               14.7/— |            44.5 |               — |          — |            327 |
| desktop / GPU |       16.6/18.2 |         16.7/18.3 |                    0/0 |               22.7/— |            54.8 |               — |          — |            321 |

#### geyser

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.6/18.6 |         16.7/18.6 |                    0/0 |               14.1/— |            40.4 |               — |          — |            875 |
| mid4 / GPU    |       16.7/18.5 |         16.7/18.5 |                    0/0 |               21.5/— |            47.8 |               — |          — |            907 |
| mid6 / GL     |       16.7/18.6 |         16.6/18.7 |                    0/0 |               13.8/— |            40.4 |               — |          — |           1315 |
| mid6 / GPU    |       16.8/18.8 |         16.7/18.7 |                    0/0 |               12.9/— |            47.8 |               — |          — |           1363 |
| desktop / GL  |       16.6/18.7 |         16.7/18.8 |                    0/0 |               14.8/— |            44.5 |               — |          — |            336 |
| desktop / GPU |       16.7/18.0 |         16.7/18.3 |                    0/0 |               22.7/— |            54.9 |               — |          — |            335 |

#### storm-cloud

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.7/18.6 |         16.7/18.5 |                    0/0 |               15.0/— |            40.4 |               — |          — |            853 |
| mid4 / GPU    |       16.7/18.3 |         16.7/18.1 |                    0/0 |               19.3/— |            47.9 |               — |          — |            878 |
| mid6 / GL     |       16.7/18.9 |         16.7/18.9 |                    0/0 |               14.9/— |            40.4 |               — |          — |           1302 |
| mid6 / GPU    |       16.6/18.8 |         16.7/18.8 |                    0/0 |               21.9/— |            47.8 |               — |          — |           1386 |
| desktop / GL  |       16.6/18.5 |         16.6/18.3 |                    0/0 |               13.6/— |            44.5 |               — |          — |            286 |
| desktop / GPU |       16.6/18.5 |         16.7/18.4 |                    0/0 |               19.8/— |            55.0 |               — |          — |            304 |

#### tornado

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.7/18.7 |         16.6/18.6 |                    0/0 |               14.5/— |            40.4 |               — |          — |            858 |
| mid4 / GPU    |       16.7/18.5 |         16.7/18.6 |                    0/0 |               20.0/— |            46.7 |               — |          — |            892 |
| mid6 / GL     |       16.7/18.7 |         16.6/18.6 |                    0/0 |               15.0/— |            40.4 |               — |          — |           1301 |
| mid6 / GPU    |       16.7/18.6 |         16.7/18.9 |                    0/0 |               22.2/— |            46.7 |               — |          — |           1343 |
| desktop / GL  |       16.7/18.2 |         16.7/17.8 |                    0/0 |               14.6/— |            44.5 |               — |          — |            321 |
| desktop / GPU |       16.7/18.5 |         16.7/18.9 |                    0/0 |               18.0/— |            53.4 |               — |          — |            311 |

#### fireworks

| Setting / API | Idle ms med/p95 | Action ms med/p95 | Long tasks idle/action | Heap MiB page/worker | Tracked GPU MiB | Liquid live/cap | Grid cells | First frame ms |
| ------------- | --------------: | ----------------: | ---------------------: | -------------------: | --------------: | --------------: | ---------: | -------------: |
| mid4 / GL     |       16.7/18.4 |         16.6/18.5 |                    0/0 |               14.2/— |            40.4 |               — |          — |            797 |
| mid4 / GPU    |       16.7/18.5 |         16.7/18.4 |                    0/0 |               14.7/— |            47.8 |               — |          — |            838 |
| mid6 / GL     |       16.7/18.3 |         16.7/17.9 |                    0/0 |               14.4/— |            40.4 |               — |          — |           1203 |
| mid6 / GPU    |       16.6/18.2 |         16.7/19.8 |                    0/0 |               14.1/— |            47.8 |               — |          — |           1310 |
| desktop / GL  |       16.7/17.6 |         16.7/17.5 |                    0/0 |               15.6/— |            44.5 |               — |          — |            402 |
| desktop / GPU |       16.6/17.2 |         16.6/17.4 |                    0/0 |               15.7/— |            54.9 |               — |          — |            321 |

## Evidence and reproduction

The raw cell files retain every interval vector, long-task duration, before/after heap reading,
runtime count, watcher state, and opening timestamp. Per-batch `*-method.json` files retain the
exact cell configurations, browser flags, device dimensions, machine information, and commit. The
GPU inventory is in the available `*-gpu.json` files. The initial baseline and pilot ran before that
extra inventory capture was added; their WebGL renderer strings and device/API checks remain in
their cell data. The pilot independently repeats three default Mid scenes on both APIs. One
incorrect-hash preflight opened the wrong toy and timed out; it is retained as
[preflight-hash-error.json](fluid-phone-2026-10/preflight-hash-error.json) and excluded from the
successful rendering matrix. Corrected hashes include the `j.` prefix.

[metrics.csv](fluid-phone-2026-10/metrics.csv) is one row per measured phase.
[comparisons.json](fluid-phone-2026-10/comparisons.json) pairs the candidate against Mid and
phone-sized High. [tables.md](fluid-phone-2026-10/tables.md) is generated from those raw cells; the
interpretation and proposals above are editorial conclusions. A cell is one run with one idle/action
window pair, not a confidence interval or independent physical-device replication.

To remeasure, use a separate checkout of the pinned measurement commit, installed repository
dependencies, and an already installed Chrome. Copy these collector scripts into the matching data
directory without the recorded JSON results. They resume existing JSON by cell key, so using the
preserved evidence as the destination would skip old cells. Keep the original evidence unchanged and
run only one renderer context at a time. Serve the baseline repository:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

In another terminal, run the collectors sequentially:

```sh
node docs/audits/fluid-phone-2026-10/worker-throttle.mjs
node docs/audits/fluid-phone-2026-10/solver.mjs
for batch in pilot lab lower safe stress auto peers peerslow; do
  node docs/audits/fluid-phone-2026-10/collect.mjs --batch="$batch"
done
node docs/audits/fluid-phone-2026-10/soak.mjs
node docs/audits/fluid-phone-2026-10/growth.mjs
node docs/audits/fluid-phone-2026-10/finalize.mjs
```

Also copy `source-inventory.json`, which the finalizer checks against the pinned Git objects. The
scripts default to the installed macOS Chrome path. `collect.mjs` accepts `SPLASHERY_CHROMIUM` and
`SPLASHERY_URL`; the other browser probes accept the Chrome override but use localhost port 4173. No
browser was installed. The collector modules are audit tooling, not proposed production code. Their
intercepted lower-budget responses are experiments only.

[validation.json](fluid-phone-2026-10/validation.json) passed exact coverage and raw-vector checks
for 284 rendering cells / 568 windows, 80 solver rows (64 liquid rows with 9,600 timed steps; 16
excluded gas rows), two 36-observation soaks, and six identity-probe cycles. It checked 30 pinned
source hashes and 353,278 combined frame-end/render intervals, with zero measured page/console
errors and no requested renderer or fluid-runtime fallback. The six successful pilot cells are
separate from the 284-cell count.

The branch was synchronized to main `9b548b3456ee2da47826e31acec0be3f58c46199` after all browser
measurements. Upstream changed the player and kit among the inspected files; the Fluid Lab, fluid
engine, profile detection, and vendored renderer discussed here were unchanged. This report does not
claim timings for the newer main. See
[synchronization.json](fluid-phone-2026-10/synchronization.json).

Before pushing, `npx prettier --check .`, `node tools/us-english.mjs --diff`, and
`git diff --cached --check` passed; staged paths were limited to this report and its data directory.
The full application Playwright suite was not run; this report uses the task's benchmark collectors
and two named pre-push checks. No source or test file was changed, and no actual phone, native
mobile browser, screen reader, battery test, or visual/volume acceptance was used.
