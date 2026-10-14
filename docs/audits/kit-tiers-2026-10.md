# Task 66: open-shelf kit tiers

Reconstructed from main at `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`. Made by Ryan with Codex
(GPT-6), October 14, 2026. Status: recipe repairs implemented; tier recommendations proposed for
review.

The study covers 65 default-option kit toys on Science, Space, and Math. It contains all 260 Low,
Mid, High, and Max captures, plus replacement captures of the four repaired Math toys. The original
samples, intermediate repair, test failures, and final media are preserved on the never-merged
evidence branch at `e6fab794836a1479124abe8a3b56657b93f02e5b`.

## Completed main comparison

The [review follow-up](kit-tiers-2026-10-review.md) contains four High before/after pairs, four Max
pairs, and every named failure from complete requested reruns. Main: **170 passed, 38 failed, 1
skipped**. Branch: **245 passed, 37 failed, 1 skipped**. No interrupted or unrun titles remain in
those final valid unique totals. Every shared branch failure also failed on main; main alone failed
the Kit circular-QR detail-limit check. Both equation-layout issues were already present on main.
The earlier stopped-run counts below remain historical implementation evidence.

## Implemented recipe repairs

Only the Math pack's bitmap-text helper changes:

1. Reserve every bitmap sample with an absolute share. The old fixed count was multiplied by Kit's
   160,000-splat reference scale: the Low unit-circle equation emitted only 266 of 708 samples, and
   the graph slider label emitted 25 of 56.
2. Tie stroke radii to the bitmap cells, independently of the board's tier-dependent base size. This
   removes merged Low-tier letters and exponents. The character bitmaps, part ids, pivots, fade
   channels, controls, durations, and recipe densities stay intact.

Four count regressions and four stroke regressions failed before their respective repairs. All 74
final-source task checks passed. A real Low render confirms readable proof labels; the interaction
tests exercise the same moving triangles and circle controls.

The count study used source `130b9587a3e38fbd15f4981950784fae7676a786`; final Math renders use
`120ece84197178a44e5562c8c16d82f6b36af734`. No engine, shared catalog, shared tests, or protected
files were edited. The seven task-44 worlds and other tasks' prototypes remain excluded.

## Method and interpretation

- Selected Linux cloud environment only: Debian 13, x86_64, Node 24.19.0, Playwright 1.56.1, and
  installed Chromium 151.0.7922.173.
- Chromium sandbox enabled, no added launch flags, one browser/page per capture, and one test
  worker. Test runners and captures never overlap. No unsafe graphics opt-in or GPU blocklist
  override.
- Forced profile, Auto Detail, adaptation off, recipe defaults, player seeds, and the home camera.
  Each toy gets a full 390×844 UI screenshot and a 390×844 stage render at device scale factor 1.
  These are desktop Chromium renders, not physical phone tests.
- The capture tool waits for streamed chunks, rejects blank frames, and records page errors. It does
  not assert console cleanliness: the browser's default software-renderer warnings are preserved in
  the broader test results.
- The scene clock is stabilized after loading. Stateful animation warm-up and the Night sky's date
  can change poses; this is a readability study, not a pixel-identity claim for moving scenes.
- Minimum means the lowest of the four tested profiles. Counts below Low, arbitrary intermediate
  counts, every option, every view, and the full Powers of ten journey were not swept. A useful
  ceiling is a visual recommendation at this export resolution. It is not a measured
  phone-performance limit.
- Counts below are emitted main-kit buffer splats, including hidden effect copies. Powers of ten
  additionally includes its visible chunks; its resident chunk count is listed separately. Requested
  budgets, CPU attribute bytes, and diagnostic Node build times are in the
  [260-row data](kit-tiers-2026-10-counts.json). Those times are not cold-load or device benchmarks.

The count links open the full UI frames; each adjacent stage link opens the pure stage render. Final
Math links use the repaired source. Other rows retain the original four-tier study.

## Per-toy recommendations

| Toy                  | Low                                                                      | Mid                                                                      | High                                                                        | Max                                                                       | Minimum tested | Useful ceiling  | Observation                                                          |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------- | --------------- | -------------------------------------------------------------------- |
| `sun`                | [58,935][sun-low] ([stage][sun-low-stage])                               | [137,423][sun-mid] ([stage][sun-mid-stage])                              | [196,335][sun-high] ([stage][sun-high-stage])                               | [274,863][sun-max] ([stage][sun-max-stage])                               | Low            | High            | The disk survives Low; granules sharpen through High.                |
| `solar-system`       | [32,536][solar-system-low] ([stage][solar-system-low-stage])             | [75,917][solar-system-mid] ([stage][solar-system-mid-stage])             | [108,441][solar-system-high] ([stage][solar-system-high-stage])             | [151,803][solar-system-max] ([stage][solar-system-max-stage])             | Low            | Mid             | Planets and orbit paths remain distinct at Low.                      |
| `mercury`            | [60,000][mercury-low] ([stage][mercury-low-stage])                       | [139,999][mercury-mid] ([stage][mercury-mid-stage])                      | [199,999][mercury-high] ([stage][mercury-high-stage])                       | [279,999][mercury-max] ([stage][mercury-max-stage])                       | Low            | High            | Crater rims sharpen through High; the Low globe stays closed.        |
| `venus`              | [59,999][venus-low] ([stage][venus-low-stage])                           | [140,000][venus-mid] ([stage][venus-mid-stage])                          | [200,001][venus-high] ([stage][venus-high-stage])                           | [279,999][venus-max] ([stage][venus-max-stage])                           | Low            | Mid             | Cloud bands remain legible; higher tiers mainly reduce grain.        |
| `earth`              | [58,936][earth-low] ([stage][earth-low-stage])                           | [137,520][earth-mid] ([stage][earth-mid-stage])                          | [196,385][earth-high] ([stage][earth-high-stage])                           | [275,056][earth-max] ([stage][earth-max-stage])                           | Low            | High            | Low is recognizable; High separates cloud and land detail.           |
| `moon`               | [60,025][moon-low] ([stage][moon-low-stage])                             | [139,995][moon-mid] ([stage][moon-mid-stage])                            | [199,999][moon-high] ([stage][moon-high-stage])                             | [280,004][moon-max] ([stage][moon-max-stage])                             | Low            | High            | Low retains maria and craters; High cleans the small rims.           |
| `mars`               | [60,000][mars-low] ([stage][mars-low-stage])                             | [140,000][mars-mid] ([stage][mars-mid-stage])                            | [200,000][mars-high] ([stage][mars-high-stage])                             | [280,000][mars-max] ([stage][mars-max-stage])                             | Low            | Mid             | The cap and dark regions survive Low; Mid cleans the surface.        |
| `jupiter`            | [60,001][jupiter-low] ([stage][jupiter-low-stage])                       | [140,002][jupiter-mid] ([stage][jupiter-mid-stage])                      | [199,999][jupiter-high] ([stage][jupiter-high-stage])                       | [280,001][jupiter-max] ([stage][jupiter-max-stage])                       | Low            | High            | Mid reveals the storm more clearly; High sharpens the bands.         |
| `saturn`             | [58,545][saturn-low] ([stage][saturn-low-stage])                         | [136,606][saturn-mid] ([stage][saturn-mid-stage])                        | [195,152][saturn-high] ([stage][saturn-high-stage])                         | [273,212][saturn-max] ([stage][saturn-max-stage])                         | Low            | High            | The ring gap is present at Low; ring texture improves through High.  |
| `uranus`             | [52,652][uranus-low] ([stage][uranus-low-stage])                         | [122,903][uranus-mid] ([stage][uranus-mid-stage])                        | [175,588][uranus-high] ([stage][uranus-high-stage])                         | [245,808][uranus-max] ([stage][uranus-max-stage])                         | Low            | Mid             | The globe and separate rings survive Low; Mid smooths ring edges.    |
| `neptune`            | [60,000][neptune-low] ([stage][neptune-low-stage])                       | [140,000][neptune-mid] ([stage][neptune-mid-stage])                      | [200,000][neptune-high] ([stage][neptune-high-stage])                       | [279,999][neptune-max] ([stage][neptune-max-stage])                       | Low            | Mid             | The dark storm and pale bands remain identifiable at Low.            |
| `aurora-planet`      | [60,000][aurora-planet-low] ([stage][aurora-planet-low-stage])           | [140,000][aurora-planet-mid] ([stage][aurora-planet-mid-stage])          | [200,000][aurora-planet-high] ([stage][aurora-planet-high-stage])           | [280,000][aurora-planet-max] ([stage][aurora-planet-max-stage])           | Low            | Mid             | The aurora curtain remains distinct; later gains are fine grain.     |
| `asteroid`           | [59,816][asteroid-low] ([stage][asteroid-low-stage])                     | [139,549][asteroid-mid] ([stage][asteroid-mid-stage])                    | [199,329][asteroid-high] ([stage][asteroid-high-stage])                     | [279,176][asteroid-max] ([stage][asteroid-max-stage])                     | Low            | High            | The irregular body and craters survive Low; High cleans the rims.    |
| `comet`              | [41,640][comet-low] ([stage][comet-low-stage])                           | [97,160][comet-mid] ([stage][comet-mid-stage])                           | [138,800][comet-high] ([stage][comet-high-stage])                           | [194,320][comet-max] ([stage][comet-max-stage])                           | Low            | Mid             | Both tails remain distinct; extra density adds little new structure. |
| `meteor`             | [37,800][meteor-low] ([stage][meteor-low-stage])                         | [88,200][meteor-mid] ([stage][meteor-mid-stage])                         | [126,000][meteor-high] ([stage][meteor-high-stage])                         | [176,400][meteor-max] ([stage][meteor-max-stage])                         | Low            | Mid             | The head and particle trail read at Low; Mid fills the trail.        |
| `star`               | [60,000][star-low] ([stage][star-low-stage])                             | [140,000][star-mid] ([stage][star-mid-stage])                            | [200,000][star-high] ([stage][star-high-stage])                             | [280,000][star-max] ([stage][star-max-stage])                             | Low            | Mid             | The core and rays read at Low; Mid cleans the glow.                  |
| `pulsar`             | [42,720][pulsar-low] ([stage][pulsar-low-stage])                         | [99,680][pulsar-mid] ([stage][pulsar-mid-stage])                         | [142,400][pulsar-high] ([stage][pulsar-high-stage])                         | [199,360][pulsar-max] ([stage][pulsar-max-stage])                         | Low            | Mid             | Both beams and the ring survive Low; animated poses vary.            |
| `black-hole`         | [56,280][black-hole-low] ([stage][black-hole-low-stage])                 | [131,320][black-hole-mid] ([stage][black-hole-mid-stage])                | [187,600][black-hole-high] ([stage][black-hole-high-stage])                 | [262,640][black-hole-max] ([stage][black-hole-max-stage])                 | Low            | Mid             | The dark center and continuous bright disk survive Low.              |
| `star-cluster`       | [41,400][star-cluster-low] ([stage][star-cluster-low-stage])             | [96,600][star-cluster-mid] ([stage][star-cluster-mid-stage])             | [138,000][star-cluster-high] ([stage][star-cluster-high-stage])             | [193,200][star-cluster-max] ([stage][star-cluster-max-stage])             | Low            | Not reached     | More small stars remain visible through Max; no cap proposed.        |
| `planetary-nebula`   | [48,400][planetary-nebula-low] ([stage][planetary-nebula-low-stage])     | [112,927][planetary-nebula-mid] ([stage][planetary-nebula-mid-stage])    | [161,326][planetary-nebula-high] ([stage][planetary-nebula-high-stage])     | [225,838][planetary-nebula-max] ([stage][planetary-nebula-max-stage])     | Low            | High            | Low retains the colored shell; High sharpens its inner edge.         |
| `nebula`             | [53,618][nebula-low] ([stage][nebula-low-stage])                         | [124,858][nebula-mid] ([stage][nebula-mid-stage])                        | [178,330][nebula-high] ([stage][nebula-high-stage])                         | [249,735][nebula-max] ([stage][nebula-max-stage])                         | Low            | Mid             | All three pillars and the colored cloud remain readable at Low.      |
| `supernova`          | [34,740][supernova-low] ([stage][supernova-low-stage])                   | [81,049][supernova-mid] ([stage][supernova-mid-stage])                   | [115,780][supernova-high] ([stage][supernova-high-stage])                   | [162,090][supernova-max] ([stage][supernova-max-stage])                   | Low            | Not reached     | Max still resolves finer particles and shell structure.              |
| `spiral-galaxy`      | [52,800][spiral-galaxy-low] ([stage][spiral-galaxy-low-stage])           | [123,200][spiral-galaxy-mid] ([stage][spiral-galaxy-mid-stage])          | [176,000][spiral-galaxy-high] ([stage][spiral-galaxy-high-stage])           | [246,400][spiral-galaxy-max] ([stage][spiral-galaxy-max-stage])           | Low            | High            | Low retains the arms; High cleans the dark lanes.                    |
| `nearby-stars`       | [9,022][nearby-stars-low] ([stage][nearby-stars-low-stage])              | [9,022][nearby-stars-mid] ([stage][nearby-stars-mid-stage])              | [9,022][nearby-stars-high] ([stage][nearby-stars-high-stage])               | [9,022][nearby-stars-max] ([stage][nearby-stars-max-stage])               | Low            | Low             | Fixed 9,022-splat dataset; the tier-study PNGs are identical.        |
| `star-systems`       | [5,152][star-systems-low] ([stage][star-systems-low-stage])              | [5,152][star-systems-mid] ([stage][star-systems-mid-stage])              | [5,152][star-systems-high] ([stage][star-systems-high-stage])               | [5,152][star-systems-max] ([stage][star-systems-max-stage])               | Low            | Low             | Fixed 5,152-splat geometry; orbital poses vary with warm-up.         |
| `real-galaxies`      | [116,400][real-galaxies-low] ([stage][real-galaxies-low-stage])          | [232,800][real-galaxies-mid] ([stage][real-galaxies-mid-stage])          | [291,000][real-galaxies-high] ([stage][real-galaxies-high-stage])           | [388,000][real-galaxies-max] ([stage][real-galaxies-max-stage])           | Low            | High            | Low reads as a spiral; High retains the fine arm texture.            |
| `powers-of-ten`      | [125,269][powers-of-ten-low] ([stage][powers-of-ten-low-stage])          | [225,125][powers-of-ten-mid] ([stage][powers-of-ten-mid-stage])          | [305,032][powers-of-ten-high] ([stage][powers-of-ten-high-stage])           | [305,032][powers-of-ten-max] ([stage][powers-of-ten-max-stage])           | Low (home)     | High (home)     | Include visible chunks; other journey stops were not swept.          |
| `saturn-v`           | [115,538][saturn-v-low] ([stage][saturn-v-low-stage])                    | [230,833][saturn-v-mid] ([stage][saturn-v-mid-stage])                    | [288,361][saturn-v-high] ([stage][saturn-v-high-stage])                     | [384,611][saturn-v-max] ([stage][saturn-v-max-stage])                     | Low            | Mid             | The stages and dark bands survive Low; Mid cleans the narrow body.   |
| `sls`                | [115,283][sls-low] ([stage][sls-low-stage])                              | [230,504][sls-mid] ([stage][sls-mid-stage])                              | [288,142][sls-high] ([stage][sls-high-stage])                               | [384,136][sls-max] ([stage][sls-max-stage])                               | Low            | Mid             | The core and boosters stay distinct at Low.                          |
| `space-shuttle`      | [105,118][space-shuttle-low] ([stage][space-shuttle-low-stage])          | [210,178][space-shuttle-mid] ([stage][space-shuttle-mid-stage])          | [262,629][space-shuttle-high] ([stage][space-shuttle-high-stage])           | [350,199][space-shuttle-max] ([stage][space-shuttle-max-stage])           | Low            | Mid             | The orbiter, tank, and boosters remain separate at Low.              |
| `solar-orbits`       | [110,999][solar-orbits-low] ([stage][solar-orbits-low-stage])            | [110,999][solar-orbits-mid] ([stage][solar-orbits-mid-stage])            | [110,999][solar-orbits-high] ([stage][solar-orbits-high-stage])             | [110,999][solar-orbits-max] ([stage][solar-orbits-max-stage])             | Low            | Low             | Fixed 110,999-splat geometry; higher budgets add no samples.         |
| `lorenz`             | [60,000][lorenz-low] ([stage][lorenz-low-stage])                         | [140,000][lorenz-mid] ([stage][lorenz-mid-stage])                        | [200,000][lorenz-high] ([stage][lorenz-high-stage])                         | [280,000][lorenz-max] ([stage][lorenz-max-stage])                         | Low            | Mid             | Both lobes and the continuous trajectory survive Low.                |
| `mobius`             | [59,996][mobius-low] ([stage][mobius-low-stage])                         | [140,010][mobius-mid] ([stage][mobius-mid-stage])                        | [200,004][mobius-high] ([stage][mobius-high-stage])                         | [280,000][mobius-max] ([stage][mobius-max-stage])                         | Low            | Mid             | The twist survives Low; Mid fills the band more evenly.              |
| `klein-bottle`       | [48,000][klein-bottle-low] ([stage][klein-bottle-low-stage])             | [112,000][klein-bottle-mid] ([stage][klein-bottle-mid-stage])            | [160,000][klein-bottle-high] ([stage][klein-bottle-high-stage])             | [224,000][klein-bottle-max] ([stage][klein-bottle-max-stage])             | Low            | Mid             | The neck and translucent vessel survive Low; Mid reduces grain.      |
| `menger-sponge`      | [60,008][menger-sponge-low] ([stage][menger-sponge-low-stage])           | [139,996][menger-sponge-mid] ([stage][menger-sponge-mid-stage])          | [200,001][menger-sponge-high] ([stage][menger-sponge-high-stage])           | [280,007][menger-sponge-max] ([stage][menger-sponge-max-stage])           | Low            | High            | Low retains the holes; High sharpens the nested cavities.            |
| `hypercube`          | [95,996][hypercube-low] ([stage][hypercube-low-stage])                   | [224,012][hypercube-mid] ([stage][hypercube-mid-stage])                  | [299,996][hypercube-high] ([stage][hypercube-high-stage])                   | [399,992][hypercube-max] ([stage][hypercube-max-stage])                   | Low            | Mid             | Both colored cubes and all connecting edges survive Low.             |
| `torus-knot`         | [60,000][torus-knot-low] ([stage][torus-knot-low-stage])                 | [140,000][torus-knot-mid] ([stage][torus-knot-mid-stage])                | [200,000][torus-knot-high] ([stage][torus-knot-high-stage])                 | [280,000][torus-knot-max] ([stage][torus-knot-max-stage])                 | Low            | Mid             | The crossing tubes remain solid; Mid cleans the small creases.       |
| `gyroid`             | [60,000][gyroid-low] ([stage][gyroid-low-stage])                         | [140,000][gyroid-mid] ([stage][gyroid-mid-stage])                        | [200,000][gyroid-high] ([stage][gyroid-high-stage])                         | [280,000][gyroid-max] ([stage][gyroid-max-stage])                         | Low            | Mid             | The openings survive Low; Mid smooths their edges.                   |
| `mandelbulb`         | [60,000][mandelbulb-low] ([stage][mandelbulb-low-stage])                 | [140,000][mandelbulb-mid] ([stage][mandelbulb-mid-stage])                | [200,000][mandelbulb-high] ([stage][mandelbulb-high-stage])                 | [280,000][mandelbulb-max] ([stage][mandelbulb-max-stage])                 | Low            | High            | The lobed solid reads at Low; High resolves the small lobes.         |
| `sierpinski`         | [60,000][sierpinski-low] ([stage][sierpinski-low-stage])                 | [140,000][sierpinski-mid] ([stage][sierpinski-mid-stage])                | [200,000][sierpinski-high] ([stage][sierpinski-high-stage])                 | [280,000][sierpinski-max] ([stage][sierpinski-max-stage])                 | Low            | Mid             | The repeated triangular openings survive Low.                        |
| `platonic`           | [60,000][platonic-low] ([stage][platonic-low-stage])                     | [140,004][platonic-mid] ([stage][platonic-mid-stage])                    | [200,004][platonic-high] ([stage][platonic-high-stage])                     | [279,996][platonic-max] ([stage][platonic-max-stage])                     | Low            | Mid             | Faces and light edges survive Low; Mid fills the faces evenly.       |
| `seashell-spiral`    | [51,000][seashell-spiral-low] ([stage][seashell-spiral-low-stage])       | [119,000][seashell-spiral-mid] ([stage][seashell-spiral-mid-stage])      | [170,000][seashell-spiral-high] ([stage][seashell-spiral-high-stage])       | [238,000][seashell-spiral-max] ([stage][seashell-spiral-max-stage])       | Low            | Mid             | Low retains the spiral and stripes; Mid cleans the surface.          |
| `graph-plotter`      | [71,998][graph-plotter-low] ([stage][graph-plotter-low-stage])           | [168,001][graph-plotter-mid] ([stage][graph-plotter-mid-stage])          | [239,998][graph-plotter-high] ([stage][graph-plotter-high-stage])           | [335,999][graph-plotter-max] ([stage][graph-plotter-max-stage])           | Low (fixed)    | Mid             | Complete fixed-width slider label; Low retains the curve and grid.   |
| `surface-plotter`    | [72,926][surface-plotter-low] ([stage][surface-plotter-low-stage])       | [170,183][surface-plotter-mid] ([stage][surface-plotter-mid-stage])      | [243,038][surface-plotter-high] ([stage][surface-plotter-high-stage])       | [340,321][surface-plotter-max] ([stage][surface-plotter-max-stage])       | Low (fixed)    | Mid             | Complete fixed-width slider label; the Low surface remains closed.   |
| `unit-circle`        | [60,000][unit-circle-low] ([stage][unit-circle-low-stage])               | [139,999][unit-circle-mid] ([stage][unit-circle-mid-stage])              | [200,001][unit-circle-high] ([stage][unit-circle-high-stage])               | [280,000][unit-circle-max] ([stage][unit-circle-max-stage])               | Low (diagram)  | Mid             | Fixed text strokes; the first equation term still overlaps a panel.  |
| `fourier-circles`    | [60,067][fourier-circles-low] ([stage][fourier-circles-low-stage])       | [140,048][fourier-circles-mid] ([stage][fourier-circles-mid-stage])      | [200,049][fourier-circles-high] ([stage][fourier-circles-high-stage])       | [280,045][fourier-circles-max] ([stage][fourier-circles-max-stage])       | Low            | Mid             | The drawing and construction circles remain legible at Low.          |
| `pythagoras-proof`   | [60,000][pythagoras-proof-low] ([stage][pythagoras-proof-low-stage])     | [140,000][pythagoras-proof-mid] ([stage][pythagoras-proof-mid-stage])    | [200,002][pythagoras-proof-high] ([stage][pythagoras-proof-high-stage])     | [280,001][pythagoras-proof-max] ([stage][pythagoras-proof-max-stage])     | Low (fixed)    | Mid             | Fixed text strokes restore letters and exponents on moving pieces.   |
| `rossler-attractor`  | [96,000][rossler-attractor-low] ([stage][rossler-attractor-low-stage])   | [224,000][rossler-attractor-mid] ([stage][rossler-attractor-mid-stage])  | [300,000][rossler-attractor-high] ([stage][rossler-attractor-high-stage])   | [400,000][rossler-attractor-max] ([stage][rossler-attractor-max-stage])   | Low            | Mid             | The folded trajectory remains continuous at Low.                     |
| `thomas-attractor`   | [96,000][thomas-attractor-low] ([stage][thomas-attractor-low-stage])     | [224,000][thomas-attractor-mid] ([stage][thomas-attractor-mid-stage])    | [300,000][thomas-attractor-high] ([stage][thomas-attractor-high-stage])     | [400,000][thomas-attractor-max] ([stage][thomas-attractor-max-stage])     | Low            | Mid             | The threefold path remains continuous at Low.                        |
| `aizawa-attractor`   | [96,000][aizawa-attractor-low] ([stage][aizawa-attractor-low-stage])     | [224,000][aizawa-attractor-mid] ([stage][aizawa-attractor-mid-stage])    | [300,000][aizawa-attractor-high] ([stage][aizawa-attractor-high-stage])     | [400,000][aizawa-attractor-max] ([stage][aizawa-attractor-max-stage])     | Low            | Mid             | Low retains the stacked loops; Mid smooths the thin strands.         |
| `five-cell`          | [95,995][five-cell-low] ([stage][five-cell-low-stage])                   | [224,000][five-cell-mid] ([stage][five-cell-mid-stage])                  | [299,999][five-cell-high] ([stage][five-cell-high-stage])                   | [400,001][five-cell-max] ([stage][five-cell-max-stage])                   | Low            | Mid             | Every corner and connecting bar survives Low.                        |
| `sixteen-cell`       | [95,996][sixteen-cell-low] ([stage][sixteen-cell-low-stage])             | [224,008][sixteen-cell-mid] ([stage][sixteen-cell-mid-stage])            | [300,004][sixteen-cell-high] ([stage][sixteen-cell-high-stage])             | [400,008][sixteen-cell-max] ([stage][sixteen-cell-max-stage])             | Low            | Mid             | Low retains the distinct colored edges and vertices.                 |
| `twenty-four-cell`   | [96,000][twenty-four-cell-low] ([stage][twenty-four-cell-low-stage])     | [223,992][twenty-four-cell-mid] ([stage][twenty-four-cell-mid-stage])    | [299,988][twenty-four-cell-high] ([stage][twenty-four-cell-high-stage])     | [400,020][twenty-four-cell-max] ([stage][twenty-four-cell-max-stage])     | Low            | Mid             | Low retains the dense edge network; Mid smooths the bars.            |
| `duoprism`           | [95,997][duoprism-low] ([stage][duoprism-low-stage])                     | [223,998][duoprism-mid] ([stage][duoprism-mid-stage])                    | [299,991][duoprism-high] ([stage][duoprism-high-stage])                     | [400,005][duoprism-max] ([stage][duoprism-max-stage])                     | Low            | Mid             | Low retains both polygon families and their connections.             |
| `splat-equation`     | [71,280][splat-equation-low] ([stage][splat-equation-low-stage])         | [71,280][splat-equation-mid] ([stage][splat-equation-mid-stage])         | [71,280][splat-equation-high] ([stage][splat-equation-high-stage])          | [71,280][splat-equation-max] ([stage][splat-equation-max-stage])          | Low            | Low             | Fixed 71,280-splat default program; tier-study PNGs are identical.   |
| `thermal-ellipsoids` | [36,006][thermal-ellipsoids-low] ([stage][thermal-ellipsoids-low-stage]) | [84,002][thermal-ellipsoids-mid] ([stage][thermal-ellipsoids-mid-stage]) | [120,003][thermal-ellipsoids-high] ([stage][thermal-ellipsoids-high-stage]) | [167,998][thermal-ellipsoids-max] ([stage][thermal-ellipsoids-max-stage]) | Low            | Mid             | Ellipsoids and bonds remain distinct at 36,006 Low splats.           |
| `smlm-microscope`    | [84,000][smlm-microscope-low] ([stage][smlm-microscope-low-stage])       | [196,000][smlm-microscope-mid] ([stage][smlm-microscope-mid-stage])      | [280,000][smlm-microscope-high] ([stage][smlm-microscope-high-stage])       | [392,000][smlm-microscope-max] ([stage][smlm-microscope-max-stage])       | Low            | Not reached     | Max still adds visible localizations along the fine tracks.          |
| `galaxy-box`         | [58,507][galaxy-box-low] ([stage][galaxy-box-low-stage])                 | [136,498][galaxy-box-mid] ([stage][galaxy-box-mid-stage])                | [195,044][galaxy-box-high] ([stage][galaxy-box-high-stage])                 | [273,181][galaxy-box-max] ([stage][galaxy-box-max-stage])                 | Low            | Not reached     | Max still fills fine particle structure; no cap proposed.            |
| `cryoem-map`         | [117,600][cryoem-map-low] ([stage][cryoem-map-low-stage])                | [182,762][cryoem-map-mid] ([stage][cryoem-map-mid-stage])                | [182,762][cryoem-map-high] ([stage][cryoem-map-high-stage])                 | [182,762][cryoem-map-max] ([stage][cryoem-map-max-stage])                 | Low            | Mid             | The sample saturates at 182,762 splats; Mid through Max match.       |
| `contour-lab`        | [20,224][contour-lab-low] ([stage][contour-lab-low-stage])               | [83,478][contour-lab-mid] ([stage][contour-lab-mid-stage])               | [83,478][contour-lab-high] ([stage][contour-lab-high-stage])                | [83,478][contour-lab-max] ([stage][contour-lab-max-stage])                | Low            | Mid             | The default terrain saturates at 83,478 splats from Mid.             |
| `terrain-box`        | [60,000][terrain-box-low] ([stage][terrain-box-low-stage])               | [140,000][terrain-box-mid] ([stage][terrain-box-mid-stage])              | [200,000][terrain-box-high] ([stage][terrain-box-high-stage])               | [280,000][terrain-box-max] ([stage][terrain-box-max-stage])               | Low            | High            | Low retains the relief; High cleans the ridges and block edges.      |
| `ripple-tank`        | [54,000][ripple-tank-low] ([stage][ripple-tank-low-stage])               | [125,999][ripple-tank-mid] ([stage][ripple-tank-mid-stage])              | [179,998][ripple-tank-high] ([stage][ripple-tank-high-stage])               | [252,000][ripple-tank-max] ([stage][ripple-tank-max-stage])               | Low            | High            | Wave fronts survive Low; High smooths the diffraction pattern.       |
| `light-bench`        | [58,603][light-bench-low] ([stage][light-bench-low-stage])               | [132,048][light-bench-mid] ([stage][light-bench-mid-stage])              | [187,180][light-bench-high] ([stage][light-bench-high-stage])               | [261,032][light-bench-max] ([stage][light-bench-max-stage])               | Low            | Mid             | The prism and separate colored rays remain clear at Low.             |
| `night-sky`          | [68,085][night-sky-low] ([stage][night-sky-low-stage])                   | [126,990][night-sky-mid] ([stage][night-sky-mid-stage])                  | [166,383][night-sky-high] ([stage][night-sky-high-stage])                   | [217,965][night-sky-max] ([stage][night-sky-max-stage])                   | Low (home)     | Not established | Date-dependent view; no whole-sky cap inferred from one pose.        |
| `climate-records`    | [58,721][climate-records-low] ([stage][climate-records-low-stage])       | [119,921][climate-records-mid] ([stage][climate-records-mid-stage])      | [147,821][climate-records-high] ([stage][climate-records-high-stage])       | [152,821][climate-records-max] ([stage][climate-records-max-stage])       | Low            | High            | Labels read at Low; High fills the fine chart bands.                 |

The minimum refers to the recognizable diagram or object and its retained parts. The unit-circle
equation's first term can still sit behind the lower panel, and the proof's equation can touch its
frame; neither overlap is repaired by increasing the count. These layout limits remain for review.

### Fixed-output and saturated samples

SHA-256 checks confirm identical stage PNGs for Nearby stars and the default Splat equation at all
four profiles. Cryo-EM and the default Contour lab have identical Mid, High, and Max stage PNGs.
Star systems and Solar orbits also emit fixed counts, although their animated poses vary. No buffer
saving is claimed from capping a recipe that already emits a fixed dataset.

### Powers of ten: base and chunks

Its 5,404 base splats are the backdrop, not the scene. The home scene is streamed. The main table
includes base plus visible chunks; ready chunks also include prefetched, hidden neighbors.

| Tier | Requested base budget | Base  | Visible chunks | Base + visible | Ready chunks | Base + all ready |
| ---- | --------------------- | ----- | -------------- | -------------- | ------------ | ---------------- |
| Low  | 60,000                | 5,404 | 119,865        | 125,269        | 601,826      | 607,230          |
| Mid  | 140,000               | 5,404 | 219,721        | 225,125        | 1,269,671    | 1,275,075        |
| High | 200,000               | 5,404 | 299,628        | 305,032        | 1,442,378    | 1,447,782        |
| Max  | 280,000               | 5,404 | 299,628        | 305,032        | 1,442,378    | 1,447,782        |

## Effect and thumbnail evidence

The four changed effects were rendered at Low with the repository's effect-clip tool, adapted only
to keep the sandbox, remove its unsafe launch flags, force Low, and use a 390×844 desktop viewport.
Clips use a 320-pixel stage and 20 frames per second. The command requested a 0.4-second lead-in and
5.5 seconds after the tap; each GIF contains 119 frames at 50 ms, 5.95 seconds total. Ordered frames
and strips were inspected; no physical phone playback is claimed.

![Original Low, count repair, and final Low proof labels](https://raw.githubusercontent.com/ryanjosephkamp/splashery/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/text-repair-contact.png)

| Toy                | Low effect clip                                                                                                                                                      | Frame strip                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph-plotter`    | [GIF](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/graph-plotter.gif)    | [strip](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/graph-plotter-strip.png)    |
| `surface-plotter`  | [GIF](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/surface-plotter.gif)  | [strip](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/surface-plotter-strip.png)  |
| `unit-circle`      | [GIF](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/unit-circle.gif)      | [strip](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/unit-circle-strip.png)      |
| `pythagoras-proof` | [GIF](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/pythagoras-proof.gif) | [strip](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/pythagoras-proof-strip.png) |

The four thumbnails were regenerated with the standard High-tier tool through the same safe-launch
adapter. The
[thumbnail contact sheet](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/effects/thumb-contact.png),
1440×900 Low and High UI frames, image hashes, and media timing are in the
[evidence record](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/README.md).
Source assets retain their existing licenses and credits; procedural Math review renders are CC0.
Nothing on the evidence branch is intended to merge.

## Engine tier proposals — not implemented

- Keep the shared `PROFILES` table unchanged. The current Low profiles retain the recognizable
  default toys after the text repairs; no lower arbitrary counts were rendered.
- Consider optional per-recipe Auto ceilings only in a separate Engine PR, using the recommended
  tier's **requested** budget after density and profile caps. Preserve explicit Detail choices and
  old saved scenes and links. The table's emitted counts are observations, not values to multiply by
  density again.
- Fixed-output and already saturated recipes need no new engine cap for buffer savings. A cap
  inferred from the Powers of ten backdrop would be wrong; any streamed-toy policy needs visible and
  prefetched chunk accounting.
- Do not cap rows marked “Not reached” from this study. Do not infer a whole-sky or whole-journey
  cap from one home view. Physical phone, higher-DPR, memory, and frame-rate measurements remain
  necessary before changing Auto policy.

## Original implementation verification and limits (historical)

The final recipe source was checked across ten selected spec files with one worker in three
serialized invocations. The first stopped after the recorded Help failures for a normal Mesa probe.
The continuation completed the area checks, then stopped after repeated strict Smoke console
failures. A final invocation completed the tap, unit, and embed-transfer checks. The counts below
are the latest unique outcomes, including 44 unrun Smoke tests and one interrupted Smoke test. Tests
and console assertions were not weakened.

| Spec              | Passed  | Failed | Interrupted | Not run |
| ----------------- | ------- | ------ | ----------- | ------- |
| cdx-t2.spec.mjs   | 74      | 0      | 0           | 0       |
| help.spec.mjs     | 9       | 5      | 0           | 0       |
| hh5-math.spec.mjs | 9       | 0      | 0           | 0       |
| hta.spec.mjs      | 3       | 0      | 0           | 0       |
| kit.spec.mjs      | 10      | 0      | 0           | 0       |
| math.spec.mjs     | 22      | 0      | 0           | 0       |
| mt2.spec.mjs      | 19      | 0      | 0           | 0       |
| smoke.spec.mjs    | 1       | 4      | 1           | 44      |
| taps.spec.mjs     | 62      | 0      | 0           | 0       |
| unit.spec.mjs     | 20      | 0      | 0           | 0       |
| **Total**         | **229** | **9**  | **1**       | **44**  |

The unchanged embed-transfer test passed and reported **9.2 MiB**, under its 30 MiB limit. The 74
task checks, 92 shared kit/tap/unit checks, 22 Math checks, 19 Math-r2 checks, 9 hands-on Math
checks, and 3 HelpTextA checks passed. The Help file has 9 passes and 5 failures. Four Smoke cases
failed on renderer warnings; the in-flight paint/poke case was interrupted, and 44 other Smoke cases
were not run after the repeated warning-blocked failures. No tests were weakened or browser security
relaxed.

These are the latest unique outcomes across serialized runs, not a claim that the stopped 283-test
invocation completed. The public JSON retains every case, all nine failures, the interrupted case,
and the exact 44 unrun titles.

The three initial Help console assertions reject automatic software-WebGL fallback and readback
warnings. Its 390-pixel guard lost a bounding box; the 1440-pixel guard found five toy pixels under
the line. A normal Mesa OpenGL probe in the same cloud, using the already licensed temporary Xvfb
runtime, returned no WebGL2 context. No override was added. Full traces stay in the ignored cache;
public failure messages and screenshots remain in the
[failure record](https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/failures/).

The four changed recipes also passed
`node tools/check-packs.mjs graph-plotter surface-plotter unit-circle pythagoras-proof`. That
diagnostic uses a raw 200,000-splat request, independently of the profile and density calculations
in the tier table. Formatting, American English, scoped paths, and credential-pattern checks passed
before each published checkpoint.

The full repository suite was not run. Phone hardware, high-DPR output, load time, total memory,
frame rate, other options, other sky dates, and other streamed journey stops are unmeasured. The
equation layout limits described above remain. Main advanced to
`e404cf36b60e7509f2cabc21dcd0f9f076fa8ef4` with unrelated QR and documentation work during the
study; it was inspected but not merged. Results apply to the recorded task baseline and recipe
checkpoint, not that newer combined tree. Every implemented change is on the task branch, and the PR
remains a draft; no merge or deployment.

[Builder record](kit-tiers-2026-10-record.md). Rule check: none.

[sun-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-low-390x844.png
[sun-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-low-stage-390x844.png
[sun-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-mid-390x844.png
[sun-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-mid-stage-390x844.png
[sun-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-high-390x844.png
[sun-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-high-stage-390x844.png
[sun-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-max-390x844.png
[sun-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sun-max-stage-390x844.png
[solar-system-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-low-390x844.png
[solar-system-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-low-stage-390x844.png
[solar-system-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-mid-390x844.png
[solar-system-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-mid-stage-390x844.png
[solar-system-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-high-390x844.png
[solar-system-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-high-stage-390x844.png
[solar-system-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-max-390x844.png
[solar-system-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-system-max-stage-390x844.png
[mercury-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-low-390x844.png
[mercury-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-low-stage-390x844.png
[mercury-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-mid-390x844.png
[mercury-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-mid-stage-390x844.png
[mercury-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-high-390x844.png
[mercury-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-high-stage-390x844.png
[mercury-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-max-390x844.png
[mercury-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mercury-max-stage-390x844.png
[venus-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-low-390x844.png
[venus-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-low-stage-390x844.png
[venus-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-mid-390x844.png
[venus-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-mid-stage-390x844.png
[venus-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-high-390x844.png
[venus-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-high-stage-390x844.png
[venus-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-max-390x844.png
[venus-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/venus-max-stage-390x844.png
[earth-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-low-390x844.png
[earth-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-low-stage-390x844.png
[earth-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-mid-390x844.png
[earth-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-mid-stage-390x844.png
[earth-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-high-390x844.png
[earth-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-high-stage-390x844.png
[earth-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-max-390x844.png
[earth-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/earth-max-stage-390x844.png
[moon-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-low-390x844.png
[moon-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-low-stage-390x844.png
[moon-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-mid-390x844.png
[moon-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-mid-stage-390x844.png
[moon-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-high-390x844.png
[moon-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-high-stage-390x844.png
[moon-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-max-390x844.png
[moon-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/moon-max-stage-390x844.png
[mars-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-low-390x844.png
[mars-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-low-stage-390x844.png
[mars-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-mid-390x844.png
[mars-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-mid-stage-390x844.png
[mars-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-high-390x844.png
[mars-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-high-stage-390x844.png
[mars-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-max-390x844.png
[mars-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mars-max-stage-390x844.png
[jupiter-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-low-390x844.png
[jupiter-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-low-stage-390x844.png
[jupiter-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-mid-390x844.png
[jupiter-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-mid-stage-390x844.png
[jupiter-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-high-390x844.png
[jupiter-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-high-stage-390x844.png
[jupiter-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-max-390x844.png
[jupiter-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/jupiter-max-stage-390x844.png
[saturn-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-low-390x844.png
[saturn-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-low-stage-390x844.png
[saturn-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-mid-390x844.png
[saturn-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-mid-stage-390x844.png
[saturn-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-high-390x844.png
[saturn-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-high-stage-390x844.png
[saturn-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-max-390x844.png
[saturn-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-max-stage-390x844.png
[uranus-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-low-390x844.png
[uranus-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-low-stage-390x844.png
[uranus-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-mid-390x844.png
[uranus-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-mid-stage-390x844.png
[uranus-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-high-390x844.png
[uranus-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-high-stage-390x844.png
[uranus-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-max-390x844.png
[uranus-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/uranus-max-stage-390x844.png
[neptune-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-low-390x844.png
[neptune-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-low-stage-390x844.png
[neptune-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-mid-390x844.png
[neptune-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-mid-stage-390x844.png
[neptune-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-high-390x844.png
[neptune-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-high-stage-390x844.png
[neptune-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-max-390x844.png
[neptune-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/neptune-max-stage-390x844.png
[aurora-planet-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-low-390x844.png
[aurora-planet-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-low-stage-390x844.png
[aurora-planet-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-mid-390x844.png
[aurora-planet-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-mid-stage-390x844.png
[aurora-planet-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-high-390x844.png
[aurora-planet-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-high-stage-390x844.png
[aurora-planet-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-max-390x844.png
[aurora-planet-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aurora-planet-max-stage-390x844.png
[asteroid-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-low-390x844.png
[asteroid-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-low-stage-390x844.png
[asteroid-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-mid-390x844.png
[asteroid-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-mid-stage-390x844.png
[asteroid-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-high-390x844.png
[asteroid-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-high-stage-390x844.png
[asteroid-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-max-390x844.png
[asteroid-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/asteroid-max-stage-390x844.png
[comet-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-low-390x844.png
[comet-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-low-stage-390x844.png
[comet-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-mid-390x844.png
[comet-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-mid-stage-390x844.png
[comet-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-high-390x844.png
[comet-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-high-stage-390x844.png
[comet-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-max-390x844.png
[comet-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/comet-max-stage-390x844.png
[meteor-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-low-390x844.png
[meteor-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-low-stage-390x844.png
[meteor-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-mid-390x844.png
[meteor-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-mid-stage-390x844.png
[meteor-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-high-390x844.png
[meteor-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-high-stage-390x844.png
[meteor-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-max-390x844.png
[meteor-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/meteor-max-stage-390x844.png
[star-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-low-390x844.png
[star-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-low-stage-390x844.png
[star-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-mid-390x844.png
[star-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-mid-stage-390x844.png
[star-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-high-390x844.png
[star-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-high-stage-390x844.png
[star-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-max-390x844.png
[star-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-max-stage-390x844.png
[pulsar-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-low-390x844.png
[pulsar-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-low-stage-390x844.png
[pulsar-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-mid-390x844.png
[pulsar-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-mid-stage-390x844.png
[pulsar-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-high-390x844.png
[pulsar-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-high-stage-390x844.png
[pulsar-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-max-390x844.png
[pulsar-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/pulsar-max-stage-390x844.png
[black-hole-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-low-390x844.png
[black-hole-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-low-stage-390x844.png
[black-hole-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-mid-390x844.png
[black-hole-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-mid-stage-390x844.png
[black-hole-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-high-390x844.png
[black-hole-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-high-stage-390x844.png
[black-hole-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-max-390x844.png
[black-hole-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/black-hole-max-stage-390x844.png
[star-cluster-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-low-390x844.png
[star-cluster-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-low-stage-390x844.png
[star-cluster-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-mid-390x844.png
[star-cluster-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-mid-stage-390x844.png
[star-cluster-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-high-390x844.png
[star-cluster-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-high-stage-390x844.png
[star-cluster-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-max-390x844.png
[star-cluster-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-cluster-max-stage-390x844.png
[planetary-nebula-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-low-390x844.png
[planetary-nebula-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-low-stage-390x844.png
[planetary-nebula-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-mid-390x844.png
[planetary-nebula-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-mid-stage-390x844.png
[planetary-nebula-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-high-390x844.png
[planetary-nebula-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-high-stage-390x844.png
[planetary-nebula-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-max-390x844.png
[planetary-nebula-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/planetary-nebula-max-stage-390x844.png
[nebula-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-low-390x844.png
[nebula-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-low-stage-390x844.png
[nebula-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-mid-390x844.png
[nebula-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-mid-stage-390x844.png
[nebula-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-high-390x844.png
[nebula-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-high-stage-390x844.png
[nebula-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-max-390x844.png
[nebula-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nebula-max-stage-390x844.png
[supernova-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-low-390x844.png
[supernova-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-low-stage-390x844.png
[supernova-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-mid-390x844.png
[supernova-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-mid-stage-390x844.png
[supernova-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-high-390x844.png
[supernova-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-high-stage-390x844.png
[supernova-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-max-390x844.png
[supernova-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/supernova-max-stage-390x844.png
[spiral-galaxy-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-low-390x844.png
[spiral-galaxy-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-low-stage-390x844.png
[spiral-galaxy-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-mid-390x844.png
[spiral-galaxy-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-mid-stage-390x844.png
[spiral-galaxy-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-high-390x844.png
[spiral-galaxy-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-high-stage-390x844.png
[spiral-galaxy-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-max-390x844.png
[spiral-galaxy-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/spiral-galaxy-max-stage-390x844.png
[nearby-stars-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-low-390x844.png
[nearby-stars-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-low-stage-390x844.png
[nearby-stars-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-mid-390x844.png
[nearby-stars-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-mid-stage-390x844.png
[nearby-stars-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-high-390x844.png
[nearby-stars-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-high-stage-390x844.png
[nearby-stars-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-max-390x844.png
[nearby-stars-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/nearby-stars-max-stage-390x844.png
[star-systems-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-low-390x844.png
[star-systems-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-low-stage-390x844.png
[star-systems-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-mid-390x844.png
[star-systems-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-mid-stage-390x844.png
[star-systems-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-high-390x844.png
[star-systems-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-high-stage-390x844.png
[star-systems-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-max-390x844.png
[star-systems-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/star-systems-max-stage-390x844.png
[real-galaxies-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-low-390x844.png
[real-galaxies-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-low-stage-390x844.png
[real-galaxies-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-mid-390x844.png
[real-galaxies-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-mid-stage-390x844.png
[real-galaxies-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-high-390x844.png
[real-galaxies-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-high-stage-390x844.png
[real-galaxies-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-max-390x844.png
[real-galaxies-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/real-galaxies-max-stage-390x844.png
[powers-of-ten-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-low-390x844.png
[powers-of-ten-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-low-stage-390x844.png
[powers-of-ten-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-mid-390x844.png
[powers-of-ten-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-mid-stage-390x844.png
[powers-of-ten-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-high-390x844.png
[powers-of-ten-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-high-stage-390x844.png
[powers-of-ten-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-max-390x844.png
[powers-of-ten-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/powers-of-ten-max-stage-390x844.png
[saturn-v-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-low-390x844.png
[saturn-v-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-low-stage-390x844.png
[saturn-v-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-mid-390x844.png
[saturn-v-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-mid-stage-390x844.png
[saturn-v-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-high-390x844.png
[saturn-v-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-high-stage-390x844.png
[saturn-v-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-max-390x844.png
[saturn-v-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/saturn-v-max-stage-390x844.png
[sls-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-low-390x844.png
[sls-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-low-stage-390x844.png
[sls-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-mid-390x844.png
[sls-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-mid-stage-390x844.png
[sls-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-high-390x844.png
[sls-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-high-stage-390x844.png
[sls-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-max-390x844.png
[sls-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sls-max-stage-390x844.png
[space-shuttle-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-low-390x844.png
[space-shuttle-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-low-stage-390x844.png
[space-shuttle-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-mid-390x844.png
[space-shuttle-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-mid-stage-390x844.png
[space-shuttle-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-high-390x844.png
[space-shuttle-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-high-stage-390x844.png
[space-shuttle-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-max-390x844.png
[space-shuttle-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/space-shuttle-max-stage-390x844.png
[solar-orbits-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-low-390x844.png
[solar-orbits-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-low-stage-390x844.png
[solar-orbits-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-mid-390x844.png
[solar-orbits-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-mid-stage-390x844.png
[solar-orbits-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-high-390x844.png
[solar-orbits-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-high-stage-390x844.png
[solar-orbits-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-max-390x844.png
[solar-orbits-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/solar-orbits-max-stage-390x844.png
[lorenz-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-low-390x844.png
[lorenz-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-low-stage-390x844.png
[lorenz-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-mid-390x844.png
[lorenz-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-mid-stage-390x844.png
[lorenz-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-high-390x844.png
[lorenz-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-high-stage-390x844.png
[lorenz-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-max-390x844.png
[lorenz-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/lorenz-max-stage-390x844.png
[mobius-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-low-390x844.png
[mobius-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-low-stage-390x844.png
[mobius-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-mid-390x844.png
[mobius-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-mid-stage-390x844.png
[mobius-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-high-390x844.png
[mobius-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-high-stage-390x844.png
[mobius-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-max-390x844.png
[mobius-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mobius-max-stage-390x844.png
[klein-bottle-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-low-390x844.png
[klein-bottle-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-low-stage-390x844.png
[klein-bottle-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-mid-390x844.png
[klein-bottle-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-mid-stage-390x844.png
[klein-bottle-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-high-390x844.png
[klein-bottle-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-high-stage-390x844.png
[klein-bottle-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-max-390x844.png
[klein-bottle-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/klein-bottle-max-stage-390x844.png
[menger-sponge-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-low-390x844.png
[menger-sponge-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-low-stage-390x844.png
[menger-sponge-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-mid-390x844.png
[menger-sponge-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-mid-stage-390x844.png
[menger-sponge-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-high-390x844.png
[menger-sponge-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-high-stage-390x844.png
[menger-sponge-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-max-390x844.png
[menger-sponge-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/menger-sponge-max-stage-390x844.png
[hypercube-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-low-390x844.png
[hypercube-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-low-stage-390x844.png
[hypercube-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-mid-390x844.png
[hypercube-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-mid-stage-390x844.png
[hypercube-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-high-390x844.png
[hypercube-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-high-stage-390x844.png
[hypercube-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-max-390x844.png
[hypercube-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/hypercube-max-stage-390x844.png
[torus-knot-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-low-390x844.png
[torus-knot-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-low-stage-390x844.png
[torus-knot-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-mid-390x844.png
[torus-knot-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-mid-stage-390x844.png
[torus-knot-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-high-390x844.png
[torus-knot-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-high-stage-390x844.png
[torus-knot-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-max-390x844.png
[torus-knot-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/torus-knot-max-stage-390x844.png
[gyroid-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-low-390x844.png
[gyroid-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-low-stage-390x844.png
[gyroid-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-mid-390x844.png
[gyroid-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-mid-stage-390x844.png
[gyroid-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-high-390x844.png
[gyroid-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-high-stage-390x844.png
[gyroid-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-max-390x844.png
[gyroid-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/gyroid-max-stage-390x844.png
[mandelbulb-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-low-390x844.png
[mandelbulb-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-low-stage-390x844.png
[mandelbulb-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-mid-390x844.png
[mandelbulb-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-mid-stage-390x844.png
[mandelbulb-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-high-390x844.png
[mandelbulb-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-high-stage-390x844.png
[mandelbulb-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-max-390x844.png
[mandelbulb-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/mandelbulb-max-stage-390x844.png
[sierpinski-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-low-390x844.png
[sierpinski-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-low-stage-390x844.png
[sierpinski-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-mid-390x844.png
[sierpinski-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-mid-stage-390x844.png
[sierpinski-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-high-390x844.png
[sierpinski-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-high-stage-390x844.png
[sierpinski-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-max-390x844.png
[sierpinski-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sierpinski-max-stage-390x844.png
[platonic-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-low-390x844.png
[platonic-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-low-stage-390x844.png
[platonic-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-mid-390x844.png
[platonic-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-mid-stage-390x844.png
[platonic-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-high-390x844.png
[platonic-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-high-stage-390x844.png
[platonic-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-max-390x844.png
[platonic-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/platonic-max-stage-390x844.png
[seashell-spiral-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-low-390x844.png
[seashell-spiral-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-low-stage-390x844.png
[seashell-spiral-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-mid-390x844.png
[seashell-spiral-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-mid-stage-390x844.png
[seashell-spiral-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-high-390x844.png
[seashell-spiral-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-high-stage-390x844.png
[seashell-spiral-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-max-390x844.png
[seashell-spiral-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/seashell-spiral-max-stage-390x844.png
[graph-plotter-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-low-390x844.png
[graph-plotter-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-low-stage-390x844.png
[graph-plotter-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-mid-390x844.png
[graph-plotter-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-mid-stage-390x844.png
[graph-plotter-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-high-390x844.png
[graph-plotter-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-high-stage-390x844.png
[graph-plotter-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-max-390x844.png
[graph-plotter-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/graph-plotter-max-stage-390x844.png
[surface-plotter-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-low-390x844.png
[surface-plotter-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-low-stage-390x844.png
[surface-plotter-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-mid-390x844.png
[surface-plotter-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-mid-stage-390x844.png
[surface-plotter-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-high-390x844.png
[surface-plotter-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-high-stage-390x844.png
[surface-plotter-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-max-390x844.png
[surface-plotter-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/surface-plotter-max-stage-390x844.png
[unit-circle-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-low-390x844.png
[unit-circle-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-low-stage-390x844.png
[unit-circle-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-mid-390x844.png
[unit-circle-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-mid-stage-390x844.png
[unit-circle-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-high-390x844.png
[unit-circle-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-high-stage-390x844.png
[unit-circle-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-max-390x844.png
[unit-circle-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/unit-circle-max-stage-390x844.png
[fourier-circles-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-low-390x844.png
[fourier-circles-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-low-stage-390x844.png
[fourier-circles-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-mid-390x844.png
[fourier-circles-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-mid-stage-390x844.png
[fourier-circles-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-high-390x844.png
[fourier-circles-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-high-stage-390x844.png
[fourier-circles-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-max-390x844.png
[fourier-circles-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/fourier-circles-max-stage-390x844.png
[pythagoras-proof-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-low-390x844.png
[pythagoras-proof-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-low-stage-390x844.png
[pythagoras-proof-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-mid-390x844.png
[pythagoras-proof-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-mid-stage-390x844.png
[pythagoras-proof-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-high-390x844.png
[pythagoras-proof-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-high-stage-390x844.png
[pythagoras-proof-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-max-390x844.png
[pythagoras-proof-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/math-fixed/pythagoras-proof-max-stage-390x844.png
[rossler-attractor-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-low-390x844.png
[rossler-attractor-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-low-stage-390x844.png
[rossler-attractor-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-mid-390x844.png
[rossler-attractor-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-mid-stage-390x844.png
[rossler-attractor-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-high-390x844.png
[rossler-attractor-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-high-stage-390x844.png
[rossler-attractor-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-max-390x844.png
[rossler-attractor-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/rossler-attractor-max-stage-390x844.png
[thomas-attractor-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-low-390x844.png
[thomas-attractor-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-low-stage-390x844.png
[thomas-attractor-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-mid-390x844.png
[thomas-attractor-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-mid-stage-390x844.png
[thomas-attractor-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-high-390x844.png
[thomas-attractor-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-high-stage-390x844.png
[thomas-attractor-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-max-390x844.png
[thomas-attractor-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thomas-attractor-max-stage-390x844.png
[aizawa-attractor-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-low-390x844.png
[aizawa-attractor-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-low-stage-390x844.png
[aizawa-attractor-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-mid-390x844.png
[aizawa-attractor-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-mid-stage-390x844.png
[aizawa-attractor-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-high-390x844.png
[aizawa-attractor-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-high-stage-390x844.png
[aizawa-attractor-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-max-390x844.png
[aizawa-attractor-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/aizawa-attractor-max-stage-390x844.png
[five-cell-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-low-390x844.png
[five-cell-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-low-stage-390x844.png
[five-cell-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-mid-390x844.png
[five-cell-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-mid-stage-390x844.png
[five-cell-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-high-390x844.png
[five-cell-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-high-stage-390x844.png
[five-cell-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-max-390x844.png
[five-cell-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/five-cell-max-stage-390x844.png
[sixteen-cell-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-low-390x844.png
[sixteen-cell-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-low-stage-390x844.png
[sixteen-cell-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-mid-390x844.png
[sixteen-cell-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-mid-stage-390x844.png
[sixteen-cell-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-high-390x844.png
[sixteen-cell-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-high-stage-390x844.png
[sixteen-cell-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-max-390x844.png
[sixteen-cell-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/sixteen-cell-max-stage-390x844.png
[twenty-four-cell-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-low-390x844.png
[twenty-four-cell-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-low-stage-390x844.png
[twenty-four-cell-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-mid-390x844.png
[twenty-four-cell-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-mid-stage-390x844.png
[twenty-four-cell-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-high-390x844.png
[twenty-four-cell-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-high-stage-390x844.png
[twenty-four-cell-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-max-390x844.png
[twenty-four-cell-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/twenty-four-cell-max-stage-390x844.png
[duoprism-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-low-390x844.png
[duoprism-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-low-stage-390x844.png
[duoprism-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-mid-390x844.png
[duoprism-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-mid-stage-390x844.png
[duoprism-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-high-390x844.png
[duoprism-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-high-stage-390x844.png
[duoprism-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-max-390x844.png
[duoprism-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/duoprism-max-stage-390x844.png
[splat-equation-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-low-390x844.png
[splat-equation-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-low-stage-390x844.png
[splat-equation-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-mid-390x844.png
[splat-equation-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-mid-stage-390x844.png
[splat-equation-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-high-390x844.png
[splat-equation-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-high-stage-390x844.png
[splat-equation-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-max-390x844.png
[splat-equation-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/splat-equation-max-stage-390x844.png
[thermal-ellipsoids-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-low-390x844.png
[thermal-ellipsoids-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-low-stage-390x844.png
[thermal-ellipsoids-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-mid-390x844.png
[thermal-ellipsoids-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-mid-stage-390x844.png
[thermal-ellipsoids-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-high-390x844.png
[thermal-ellipsoids-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-high-stage-390x844.png
[thermal-ellipsoids-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-max-390x844.png
[thermal-ellipsoids-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/thermal-ellipsoids-max-stage-390x844.png
[smlm-microscope-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-low-390x844.png
[smlm-microscope-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-low-stage-390x844.png
[smlm-microscope-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-mid-390x844.png
[smlm-microscope-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-mid-stage-390x844.png
[smlm-microscope-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-high-390x844.png
[smlm-microscope-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-high-stage-390x844.png
[smlm-microscope-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-max-390x844.png
[smlm-microscope-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/smlm-microscope-max-stage-390x844.png
[galaxy-box-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-low-390x844.png
[galaxy-box-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-low-stage-390x844.png
[galaxy-box-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-mid-390x844.png
[galaxy-box-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-mid-stage-390x844.png
[galaxy-box-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-high-390x844.png
[galaxy-box-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-high-stage-390x844.png
[galaxy-box-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-max-390x844.png
[galaxy-box-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/galaxy-box-max-stage-390x844.png
[cryoem-map-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-low-390x844.png
[cryoem-map-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-low-stage-390x844.png
[cryoem-map-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-mid-390x844.png
[cryoem-map-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-mid-stage-390x844.png
[cryoem-map-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-high-390x844.png
[cryoem-map-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-high-stage-390x844.png
[cryoem-map-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-max-390x844.png
[cryoem-map-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/cryoem-map-max-stage-390x844.png
[contour-lab-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-low-390x844.png
[contour-lab-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-low-stage-390x844.png
[contour-lab-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-mid-390x844.png
[contour-lab-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-mid-stage-390x844.png
[contour-lab-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-high-390x844.png
[contour-lab-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-high-stage-390x844.png
[contour-lab-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-max-390x844.png
[contour-lab-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/contour-lab-max-stage-390x844.png
[terrain-box-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-low-390x844.png
[terrain-box-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-low-stage-390x844.png
[terrain-box-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-mid-390x844.png
[terrain-box-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-mid-stage-390x844.png
[terrain-box-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-high-390x844.png
[terrain-box-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-high-stage-390x844.png
[terrain-box-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-max-390x844.png
[terrain-box-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/terrain-box-max-stage-390x844.png
[ripple-tank-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-low-390x844.png
[ripple-tank-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-low-stage-390x844.png
[ripple-tank-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-mid-390x844.png
[ripple-tank-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-mid-stage-390x844.png
[ripple-tank-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-high-390x844.png
[ripple-tank-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-high-stage-390x844.png
[ripple-tank-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-max-390x844.png
[ripple-tank-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/ripple-tank-max-stage-390x844.png
[light-bench-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-low-390x844.png
[light-bench-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-low-stage-390x844.png
[light-bench-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-mid-390x844.png
[light-bench-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-mid-stage-390x844.png
[light-bench-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-high-390x844.png
[light-bench-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-high-stage-390x844.png
[light-bench-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-max-390x844.png
[light-bench-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/light-bench-max-stage-390x844.png
[night-sky-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-low-390x844.png
[night-sky-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-low-stage-390x844.png
[night-sky-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-mid-390x844.png
[night-sky-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-mid-stage-390x844.png
[night-sky-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-high-390x844.png
[night-sky-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-high-stage-390x844.png
[night-sky-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-max-390x844.png
[night-sky-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/night-sky-max-stage-390x844.png
[climate-records-low]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-low-390x844.png
[climate-records-low-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-low-stage-390x844.png
[climate-records-mid]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-mid-390x844.png
[climate-records-mid-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-mid-stage-390x844.png
[climate-records-high]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-high-390x844.png
[climate-records-high-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-high-stage-390x844.png
[climate-records-max]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-max-390x844.png
[climate-records-max-stage]:
  https://github.com/ryanjosephkamp/splashery/blob/e6fab794836a1479124abe8a3b56657b93f02e5b/docs/audits/kit-tiers-2026-10-evidence/tiers/climate-records-max-stage-390x844.png
