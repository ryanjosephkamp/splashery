# Tinkerer’s Manual audit — October 11, 2026

Codex audited main at `897877d9572a1c3b5f9ec1ff028670227477cb2c` in an isolated checkout, leaving
the concurrent manual work untouched. The peak-one Gaussian, covariance construction, compositing
arithmetic, and most recipe mechanics agree with the cited math and implementation. The main
problems are the claim that Sharp view still draws splats, 60 gallery programs disappearing from the
PDF, stale field/moment/experiment limits, several incorrectly described gallery curves, and
incorrect demo readouts. All four live demos load and respond at both requested sizes, while nine
advertised demos are explicitly unfinished placeholders. All 75 toy links resolve to their intended
programs; all 29 distinct web anchors resolve; external GET checks returned 200 except one DOI
returning 403. The 67-page PDF includes the four demo stills, but its example download targets
localhost, and rebuilding with the provided newer Chromium changes the bytes, pagination, and one
mathematical glyph. No fixes were made.

## Scope and evidence

Read `CLAUDE.md` first, followed by `AGENTS.md`, the handoff, and operating rules. Read the complete
web manual, its demo math/drawing modules, the named implementation paths, and the PDF. All source
links below are pinned to the audited commit. Quotes are exact excerpts with whitespace and
typographic quotes normalized; ellipses indicate omitted words. Severity describes
teaching/reproduction impact: high affects a central architectural claim or removes a whole set of
usable examples, medium changes behavior or a mathematical conclusion, and low is a local
qualification or reading obstacle.

Served the pinned checkout with `python3 -m http.server 4173 --bind 127.0.0.1` and opened
`http://127.0.0.1:4173/manual/`. Used provided `/usr/bin/chromium` (151.0.7922.173) through the
already installed Playwright, without installing browsers. Phone context: 390×844 CSS pixels, touch
enabled, device scale factor 2. Desktop: 1440×900, device scale factor 1. Opened every fold, checked
all images loaded, exercised pointer/touch, sliders, select controls, keyboard input, and Play, and
checked page errors and console errors. Screenshot dimensions can exceed the viewport because each
demo element was captured in full.

## Findings, ordered by severity

| ID  | Section                              | Kind            | Severity | Exact text / observed text                                                                                              | Proposed fix                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------ | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Opening / Sharp view                 | Wrong           | high     | “Every toy … is made of Gaussian splats”; “They are still splats.”                                                      | Describe Splashery as primarily splat based. Sharp view renders a textured triangle relief and disables the splat entity; the same depth data can supply both views. Mention the hybrid fluid path too.                                                                           | [manual/index.html:34][manual/index.html:34]; [manual/index.html:44][manual/index.html:44]; [src/packs/photo-sharp.js:174][src/packs/photo-sharp.js:174] disables `entity.gsplat`; [src/live/relief-mesh.js:1][src/live/relief-mesh.js:1] implements the textured mesh; F17 covers fluids.                                                                                                                                                                                                                                                                                                                       |
| F02 | PDF / second gallery                 | Missing context | high     | “Each card has … the program (folded), and a Run it link”                                                               | Print the 60 programs and their Run links, or explicitly identify the web gallery as required and give a stable link. The PDF currently removes the instructions needed to reproduce these examples.                                                                              | [manual/index.html:2527][manual/index.html:2527]; [manual/manual.css:978][manual/manual.css:978] hides both program details and card links. Shipped PDF, pp. 39–46; [screenshot](34-pdf-gallery-page39.jpg) versus [screenshot](34-web-gallery-program.jpg).                                                                                                                                                                                                                                                                                                                                                     |
| F03 | Level 3 / field limit                | Wrong           | medium   | “Each field can be up to 120 characters long”; “240 characters is a planned experiment”                                 | Use 240 for Splat equation, including the quick reference and gallery introduction. Distinguish the 120-character limit retained by the graph/surface reader. Update the demo separately (F07).                                                                                   | [manual/index.html:1718][manual/index.html:1718]; [manual/index.html:1770][manual/index.html:1770]; [manual/index.html:2527][manual/index.html:2527]; [manual/index.html:5729][manual/index.html:5729]; [src/packs/splat-equation.js:30][src/packs/splat-equation.js:30] and [src/packs/splat-equation.js:170][src/packs/splat-equation.js:170] enforce 240; [src/equation.js:18][src/equation.js:18] retains default 120.                                                                                                                                                                                       |
| F04 | Level 3 / moments                    | Wrong           | medium   | “the toy builds your shape at 12 moments”; “15 moments is a planned experiment”                                         | Say 12 is the default, with a current 12–15 Moments of t choice. Make budget, part, dip, and packing discussions conditional on the chosen count. The 13 position samples at the default include the terminal target; color/size expressions are not all evaluated at 13 moments. | [manual/index.html:1868][manual/index.html:1868]; [manual/index.html:1881][manual/index.html:1881]; [manual/index.html:1887][manual/index.html:1887]; [manual/index.html:1770][manual/index.html:1770]; [src/packs/splat-equation.js:34][src/packs/splat-equation.js:34]; [src/packs/splat-equation.js:437][src/packs/splat-equation.js:437]; position/attribute loops at [src/packs/splat-equation.js:486][src/packs/splat-equation.js:486] and [src/packs/splat-equation.js:518][src/packs/splat-equation.js:518].                                                                                             |
| F05 | Level 3 / saved option keys          | Wrong           | medium   | “come to 15. One more key would fit; two would not.”                                                                    | Count the Moments of t option too: 12 fields plus preset, splats, shade, and moments total 16. There is no spare key when all are populated.                                                                                                                                      | [manual/index.html:1624][manual/index.html:1624]; [src/packs/splat-equation.js:413][src/packs/splat-equation.js:413] defines 16 options; [src/state.js:174][src/state.js:174] keeps only the first 16 keys. Direct module inspection returned 16.                                                                                                                                                                                                                                                                                                                                                                |
| F06 | Level 3 / grammar                    | Wrong           | medium   | “a run of numbers, names, and bracketed groups”; `bare = piece { piece }`                                               | Restrict repeated bare-input pieces to numbers/names after the first piece. A bracket can be the first piece, but a later bracket starts multiplication outside the function. Recommend explicit parentheses for function arguments.                                              | [manual/index.html:1707][manual/index.html:1707]; [manual/index.html:1827][manual/index.html:1827]; [src/equation.js:238][src/equation.js:238] and [manual/demo-math.js:222][manual/demo-math.js:222]. At u=1, `sin 2(u+1)` evaluates to `2 sin(2) = 1.818594854`, not `sin(4) = −0.756802495`. Both readers agree; the prose/grammar does not.                                                                                                                                                                                                                                                                  |
| F07 | Reader live demo                     | Misleading      | medium   | “It follows the real reader’s rules for powers, implied multiplication, and bare function inputs.”                      | Use the toy’s 240-character limit and its depth/node guards, or state precisely that this is a simplified preview. A successful tree currently does not guarantee the toy accepts the expression.                                                                                 | [manual/index.html:1727][manual/index.html:1727]; [manual/demo-math.js:92][manual/demo-math.js:92] / [manual/demo-math.js:167][manual/demo-math.js:167] versus [src/equation.js:19][src/equation.js:19] / [src/equation.js:164][src/equation.js:164]. Both viewports accept 34 nested pairs around u in the demo; `readExpr` rejects them. A 121-character product of u is rejected by the demo and accepted by the toy. [screenshot](34-reader-deep.jpg).                                                                                                                                                       |
| F08 | Covariance live demo                 | Wrong           | medium   | “Not valid: it is flat in one direction (a size of 0), so it can’t be inverted.”                                        | Separate positive definiteness from a numerical tolerance warning. Do not call a positive, invertible covariance flat. Use a tolerance relative to matrix scale if numerical stability is the concern.                                                                            | [manual/demo-math.js:28][manual/demo-math.js:28] uses fixed thresholds `a > 1e−6`, `det > 1e−8`; [manual/demos.js:89][manual/demos.js:89]. Sizes 0.01, 0.01 and turn 0° give diag(0.0001, 0.0001), determinant 1e−8, and two positive eigenvalues, yet this verdict appears. [screenshot](34-cov-positive.jpg).                                                                                                                                                                                                                                                                                                  |
| F09 | Moments live demo / time             | Wrong           | medium   | “on the wall clock: about 1.0 s of 4 s, if played” at t=π/2                                                             | Label this as linear cycle fraction, or invert the easing function when reporting elapsed time. Include the starting slider position; playback may start anywhere.                                                                                                                | [manual/demos.js:213][manual/demos.js:213] uses `4 × tf`, while [manual/demos.js:231][manual/demos.js:231] uses `glide(e)=e−sin(2πe)/(2π)`, also used by [src/packs/splat-equation.js:47][src/packs/splat-equation.js:47]. From zero, t=π/2 occurs at about 1.47 s, not 1.0 s. [screenshot](34-moments-one.jpg).                                                                                                                                                                                                                                                                                                 |
| F10 | Moments live demo / one moment       | Wrong           | medium   | “worst case for a turn: 200.0%”                                                                                         | Special-case one stored moment, or restrict this comparison to K≥2. Label counts outside 12–15 as hypothetical rather than settings the current toy offers.                                                                                                                       | [manual/demo-math.js:73][manual/demo-math.js:73] applies `1−cos(π/K)` at K=1. The endpoints at 0 and 2π coincide, so their chord has no radial dip; the demo simultaneously shows “largest dip right now: 0.0%.” Reproduced on both viewports; [screenshot](34-moments-one.jpg).                                                                                                                                                                                                                                                                                                                                 |
| F11 | Level 1 / projection                 | Missing context | medium   | “Then the splat’s covariance on the screen is Σ′ = J W Σ Wᵀ Jᵀ”                                                         | Keep the first-order formula, but distinguish it from the rendered footprint. Explain the added pixel-space blur of 0.3 px² per diagonal and the renderer’s minimum eigenvalue/clamps.                                                                                            | [manual/index.html:772][manual/index.html:772]; [vendor/playcanvas/playcanvas.min.mjs:14953][vendor/playcanvas/playcanvas.min.mjs:14953] adds 0.3 to each diagonal and clamps λ₂ to at least 0.1. [EWA paper](https://www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf) discusses the reconstruction/filter footprint; [3DGS paper](https://arxiv.org/pdf/2308.04079), §4, gives the ideal covariance transform.                                                                                                                                                                                |
| F12 | Gallery / Spun sphere                | Wrong           | medium   | “while its latitude stripes stay in place”                                                                              | Describe a longitude hue gradient that turns with the sphere. The program has neither latitude stripes nor colors fixed in world space.                                                                                                                                           | [manual/index.html:2548][manual/index.html:2548]; [manual/index.html:2554][manual/index.html:2554] uses `hue=u/(2pi)` and positions with `u+t`. Holding u fixed preserves the color while the point rotates; changing v changes latitude without changing hue.                                                                                                                                                                                                                                                                                                                                                   |
| F13 | Gallery / Rose curve                 | Wrong           | medium   | “A six-petal planar rose”                                                                                               | Call the x–z projection a 12-petal rose, with a vertical wave giving it height. If six petals are intended, change the example later.                                                                                                                                             | [manual/index.html:3028][manual/index.html:3028]; [manual/index.html:3031][manual/index.html:3031] uses radius `cos(6u)` over 0…2π and `y=0.15sin(3u)`. [Rose curves](<https://en.wikipedia.org/wiki/Rose_(mathematics)>) have 2k petals for even integer k, so k=6 gives 12.                                                                                                                                                                                                                                                                                                                                    |
| F14 | Gallery / Figure-eight knot          | Wrong           | medium   | “the simplest knot that is not a torus knot”                                                                            | Rename this example as a trefoil torus knot, or supply a verified figure-eight parameterization. Preserve the distinction between knot type and a suggestive image.                                                                                                               | [manual/index.html:3066][manual/index.html:3066]; [manual/index.html:3069][manual/index.html:3069] is `(2+cos(2u)) × (cos(3u+t), sin(3u+t))` with vertical `sin(2u)`: a (3,2) [torus knot](https://en.wikipedia.org/wiki/Torus_knot), equivalent to a [trefoil](https://en.wikipedia.org/wiki/Trefoil_knot), not the [figure-eight knot](https://en.wikipedia.org/wiki/Figure-eight_knot).                                                                                                                                                                                                                       |
| F15 | Gallery / Orbiting rings             | Wrong           | medium   | “Three circular bands revolve at different speeds”                                                                      | Describe one moving harmonic loop, or provide three distinct circular curves. Counting trigonometric frequencies does not count connected rings.                                                                                                                                  | [manual/index.html:3751][manual/index.html:3751]; [manual/index.html:3754][manual/index.html:3754] varies one parameter u, without v or separate branches. x/z combine first and second harmonics and y varies as `0.45sin(3u+t)`; these define one continuous closed, noncircular curve.                                                                                                                                                                                                                                                                                                                        |
| F16 | Gallery / Angle around a torus       | Wrong           | medium   | “while a second color band follows the tube”                                                                            | Describe only hue varying around the large ring, or add a tube-dependent color rule.                                                                                                                                                                                              | [manual/index.html:4045][manual/index.html:4045]; [manual/index.html:4048][manual/index.html:4048] uses only `hue=u/(2pi)`. At a fixed u, every v on the tube has the same base hue; there is no second color band.                                                                                                                                                                                                                                                                                                                                                                                              |
| F17 | What else / fluids                   | Wrong           | medium   | “drawn as its own splats, one per particle”                                                                             | Describe the CPU liquid’s multiple splats per particle and the WebGPU liquid surface path. Gas/flame rendering also has a grid path. Avoid promising one representation for every fluid.                                                                                          | [manual/index.html:5266][manual/index.html:5266]; [src/fluids/world.js:20][src/fluids/world.js:20] sets LIQUID_SUB=4; [src/fluids/world.js:96][src/fluids/world.js:96] allocates multiple liquid splats; [src/fluids/runtime.js:83][src/fluids/runtime.js:83] selects GPU liquids; [src/fluids/runtime.js:126][src/fluids/runtime.js:126] starts surface rendering; [src/fluids/gpu/surface.js:1][src/fluids/gpu/surface.js:1] describes the surface passes.                                                                                                                                                     |
| F18 | What else / live input               | Missing context | medium   | “nothing is recorded or sent”                                                                                           | State the explicit Record exception: a user can record locally and choose an exported file. Keep the permission-first and local-processing statements, with that qualification.                                                                                                   | [manual/index.html:5217][manual/index.html:5217]; [src/packs/live.js:401][src/packs/live.js:401] exposes recording; [src/packs/sound-lab.js:891][src/packs/sound-lab.js:891] implements microphone recording. [CLAUDE.md:55][CLAUDE.md:55] explicitly permits a recorder after the user taps Record. This is a documentation mismatch, not evidence of uploading live input.                                                                                                                                                                                                                                     |
| F19 | What else / Hands-on                 | Wrong           | medium   | “Every toy plays this way, scans included, as one rigid body”                                                           | Say eligible toys use the rigid-body path; recipes can disable it, and pictures/still toys require an explicit opt-in or joints.                                                                                                                                                  | [manual/index.html:5185][manual/index.html:5185]; [src/physics/hands-on.js:66][src/physics/hands-on.js:66] returns false for `handsOn:false`, and checks `pictures`, `turntable:false`, `handsLevel1`, and joints. The implementation has explicit exclusions.                                                                                                                                                                                                                                                                                                                                                   |
| F20 | Open questions / experiments         | Wrong           | medium   | “A Detail slider … Planned in the Kit lab”; “View-dependent color … Planned”; “A larger sweep is planned”               | Update the experiment table and the earlier notes. The Detail slider exists, the Glossy shader experiment exists in labs, and a larger software-renderer sweep has been reported. Keep real-phone validation open.                                                                | [manual/index.html:399][manual/index.html:399]; [manual/index.html:424][manual/index.html:424]; [manual/index.html:397][manual/index.html:397]; [manual/index.html:5363][manual/index.html:5363]; [src/player.js:85][src/player.js:85] implements 60k–400k Detail; [src/effects.js:1895][src/effects.js:1895] implements Glossy; [src/player.js:627][src/player.js:627] applies it; [docs/lab/BUDGETS.md:23][docs/lab/BUDGETS.md:23] reports five budgets and 22 toys / 24 views. F03/F04 cover the other already implemented choices.                                                                           |
| F21 | PDF / example download               | Wrong           | medium   | “manual/example-recipe.js”                                                                                              | Make this download an absolute public URL in the PDF, or rewrite relative links before printing. A distributed PDF must not depend on the reader running the author’s local server.                                                                                               | [manual/index.html:1344][manual/index.html:1344] is relative. Shipped and rebuilt PDFs, p. 19, encode the annotation URI `http://127.0.0.1:4173/manual/example-recipe.js`. [tools/manual-pdf.mjs:18][tools/manual-pdf.mjs:18] defaults to the local base and [tools/manual-pdf.mjs:31][tools/manual-pdf.mjs:31] loads it before printing.                                                                                                                                                                                                                                                                        |
| F22 | PDF / rebuilding                     | Missing context | medium   | “p ↦ Ap + b” in the Affine definition                                                                                   | Pin and document Chromium and required fonts, and check mathematical glyphs after rebuilding. The shipped file is readable, but this environment’s rebuild omits ↦ visually and extracts a null character in its place.                                                           | [manual/index.html:5498][manual/index.html:5498]; [tools/manual-pdf.mjs:25][tools/manual-pdf.mjs:25] accepts an unpinned Chromium path. Shipped Chrome 141 versus provided Chrome 151. [screenshot](34-pdf-affine-shipped.jpg) and [screenshot](34-pdf-affine-rebuilt.jpg) show p. 63. Hashes and build steps are below; this does not prove the source is stale.                                                                                                                                                                                                                                                |
| F23 | Level 1 / covariance tilt            | Wrong           | low      | “and not zero when they do not”                                                                                         | Qualify the statement: off-diagonal terms can signal a rotated anisotropic covariance, but rotations within equal-width axes do not change it.                                                                                                                                    | [manual/index.html:751][manual/index.html:751]; the preceding [manual/index.html:732][manual/index.html:732] formula `Σ=RSSᵀRᵀ` gives Σ=s²I for equal widths at every rotation. In 2D, b=(s₁²−s₂²)sinθcosθ=0 when s₁=s₂, even at θ=30°; [manual/demo-math.js:9][manual/demo-math.js:9].                                                                                                                                                                                                                                                                                                                          |
| F24 | Covariance live demo / widths        | Unclear         | low      | “so the sizes are NaN and 0.000”                                                                                        | Show the signed eigenvalues and explain that negative variance has no real standard deviation. Do not print NaN as an axis size or clamp one negative eigenvalue to a plausible zero.                                                                                             | [manual/demos.js:83][manual/demos.js:83] takes √λ₁ but clamps λ₂ before its square root. At a=c=−0.1, b=0, both eigenvalues are −0.1; both viewports show NaN and zero. [screenshot](34-cov-negative.jpg).                                                                                                                                                                                                                                                                                                                                                                                                       |
| F25 | Level 3 / packing                    | Wrong           | low      | “A moment’s target place … is stored as three whole numbers”                                                            | Say the displacement from the current position to its target is quantized. Explain that the half-step bound applies when the displacement is inside the range and rounding is the only error.                                                                                     | [manual/index.html:1934][manual/index.html:1934]; [src/kit.js:945][src/kit.js:945] explicitly packs morph offsets. Step size 4/4096=0.0009765625 toy units and the half-step bound are otherwise correct. [src/effects.js:788][src/effects.js:788] defines the ±2 range.                                                                                                                                                                                                                                                                                                                                         |
| F26 | Level 3 / invalid RGB                | Wrong           | low      | “a red, green, or blue that can’t becomes 0”                                                                            | Distinguish NaN from infinities: NaN becomes zero; +∞ is clamped to one, and −∞ to zero. Alternatively, describe only finite out-of-range values as clamped.                                                                                                                      | [manual/index.html:2123][manual/index.html:2123]; [src/packs/splat-equation.js:530][src/packs/splat-equation.js:530] uses `clamp01(value \|\| 0)`. The expression `r=1/0` becomes 1 because +∞ is truthy, unlike NaN.                                                                                                                                                                                                                                                                                                                                                                                            |
| F27 | Level 1 / color and blending         | Missing context | low      | “After the near one … = 0.37”; “[r, g, b] with each from 0 to 1”                                                        | State that 0.37 is an abstract channel calculation in one consistent blending space, and explain encoded RGB versus linear-light values. Do not imply that channel numbers alone specify a physical light intensity or final displayed pixel.                                     | [manual/index.html:911][manual/index.html:911]; [manual/index.html:1117][manual/index.html:1117]; [src/generators.js:165][src/generators.js:165] maps hex channels to /255 without linearization; [src/kit.js:116][src/kit.js:116] accepts array channels; [vendor/playcanvas/playcanvas.min.mjs:15010][vendor/playcanvas/playcanvas.min.mjs:15010] conditionally performs gamma decoding, tone mapping, and output correction. [W3C source-over specification](https://www.w3.org/TR/compositing-1/#porterduffcompositingoperators) confirms the algebra; output also depends on the renderer’s color pipeline. |
| F28 | Unique features / budgets            | Misleading      | low      | “becomes up to 200,000 splats”; “There is no multi-megabyte file to download.”                                          | Use the current tier-dependent budget, up to 400k for ordinary kit allocation. Scope the download claim to procedurally generated geometry; the engine and optional assets/models still download.                                                                                 | [manual/index.html:5305][manual/index.html:5305]; [src/generators.js:76][src/generators.js:76] caps Max at 400k; [src/pc.js:1][src/pc.js:1] imports the vendored engine. The manual itself identifies the optional depth model at [manual/index.html:5217][manual/index.html:5217]. Actual emitted counts can vary slightly with sampling.                                                                                                                                                                                                                                                                       |
| F29 | Unique features / scene codec        | Unclear         | low      | “deflate”; “the link carries the plain text instead”                                                                    | Specify raw DEFLATE and explain the two prefixes: d. + base64url(compressed UTF-8 JSON), or j. + base64url(uncompressed UTF-8 JSON). The fallback is still encoded, not literal readable JSON.                                                                                    | [manual/index.html:5328][manual/index.html:5328]; [src/codec.js:26][src/codec.js:26] and [src/codec.js:36][src/codec.js:36]. [Compression Streams specification](https://compression.spec.whatwg.org/) distinguishes deflate from deflate-raw.                                                                                                                                                                                                                                                                                                                                                                   |
| F30 | References / Porter and Duff         | Missing context | low      | “doi.org/10.1145/964965.808606”                                                                                         | Keep the DOI, but offer the accessible author-hosted paper as an alternate. Do not label the DOI permanently dead based on this environment’s response.                                                                                                                           | [manual/index.html:5648][manual/index.html:5648]; GET through the DOI redirect returned HTTP 403 here. The [author-hosted PDF](https://keithp.com/~keithp/porterduff/p253-porter.pdf) returned 200 and was opened to verify the source-over discussion.                                                                                                                                                                                                                                                                                                                                                          |
| F31 | Gallery / labs status                | Missing context | low      | “Run it”                                                                                                                | Label the gallery’s destination as a labs toy at its first introduction and beside the Run links. Explain that direct scene links still open with labs off, although the toy is absent from the ordinary shelf; the sharper kernel needs labs enabled.                            | [manual/index.html:2177][manual/index.html:2177]; [manual/index.html:2527][manual/index.html:2527]; [src/toys.js:2692][src/toys.js:2692] marks splat-equation labs:true. [src/toys.js:4368][src/toys.js:4368] describes direct-link behavior. [manual/index.html:5284][manual/index.html:5284] eventually identifies the toy as labs, but the card links lack that local cue. All 75 direct links worked with labs off.                                                                                                                                                                                          |
| R01 | Reading / program editing            | Unclear         | low      | “If left out: Needed” for x, y, z, and u                                                                                | Distinguish a complete new program from a partial edit that keeps existing fields. Show one example of each before the field table.                                                                                                                                               | [manual/index.html:1530][manual/index.html:1530] describes retained fields, while [manual/index.html:1554][manual/index.html:1554] says “Needed”; [src/packs/splat-equation.js:317][src/packs/splat-equation.js:317] merges statements with the current program.                                                                                                                                                                                                                                                                                                                                                 |
| R02 | Reading / units                      | Missing context | low      | `rot: [0, 0, (a * 180) / Math.PI]` and `out.parts.sails = { angle: t * (0.3 + 2 * c.wind) + extra }` in recipe examples | Put a short units note before the first recipe: Euler rot values use degrees, even in drive; trigonometry and leaf angles use radians, sizes/positions use recipe units, and fitting rescales them to toy units.                                                                  | [manual/index.html:1238][manual/index.html:1238] and [manual/index.html:1220][manual/index.html:1220] use different contexts; [src/kit.js:61][src/kit.js:61] converts Euler degrees to radians; [src/kit.js:1124][src/kit.js:1124] fits the toy. These units are explained piecemeal rather than together.                                                                                                                                                                                                                                                                                                       |
| R03 | Reading / authoring a recipe         | Missing context | low      | “A small, complete recipe”                                                                                              | Before the first long JavaScript block, name the prerequisites: edit an ES module, add the import/registration, and serve the repository. Point beginners to the exact registration steps before they try pasting code into the program toy.                                      | [manual/index.html:1197][manual/index.html:1197] introduces the complete recipe; [manual/index.html:1384][manual/index.html:1384] gives the file and registration steps later; the two input languages are easy to confuse.                                                                                                                                                                                                                                                                                                                                                                                      |
| R04 | Reading / dense projection paragraph | Missing context | low      | “Its eigenvectors … its eigenvalues”                                                                                    | Keep the existing immediate definitions, but add a small 2×2 worked example showing an axis direction and its squared width. The jump from covariance multiplication to eigenvectors is the steepest mathematical step for the stated newcomer.                                   | [manual/index.html:778][manual/index.html:778] defines both terms correctly, but supplies no numeric eigensystem example; [manual/demo-math.js:22][manual/demo-math.js:22] already computes the determinant/eigenvalues needed for one.                                                                                                                                                                                                                                                                                                                                                                          |

## Accuracy checks that passed

| Area                                        | Result / calculation                                                                                                                                                                                                                                                                                                                                                                                                                        | Source                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gaussian and units                          | The unnormalized bell peaks at 1. Weights at 1σ, 2σ, and 3σ are 0.60653066, 0.13533528, and 0.01110900. The shown quadratic form and σ interpretation are correct. Covariance entries have squared position units.                                                                                                                                                                                                                          | [manual/index.html:469][manual/index.html:469]; [manual/index.html:523][manual/index.html:523]; [3DGS, §4](https://arxiv.org/pdf/2308.04079).                                                                                                                                                                                                                                       |
| Covariance example                          | Widths 0.3, 0.1, 0.1 rotated 30° produce [[0.07, 0.0346410, 0], [0.0346410, 0.03, 0], [0, 0, 0.01]]. Rounding off-diagonals to 0.035 is correct. Positive widths ensure a full-rank positive-definite covariance.                                                                                                                                                                                                                           | [manual/index.html:732][manual/index.html:732]; [manual/demo-math.js:9][manual/demo-math.js:9]; [multivariate normal reference](https://en.wikipedia.org/wiki/Multivariate_normal_distribution). General covariance matrices may also be positive semidefinite; this manual’s inverse formula assumes full rank.                                                                    |
| Projection, footprint, and blending         | First-order JWΣWᵀJᵀ is correct before filtering. Back-to-front source-over and the equivalent front-to-back weighted sum agree. The worked background example gives 0.55, then 0.37, with transmittance 0.3. The stated center-depth sorting approximation and optional pose resort match the implementation.                                                                                                                               | [manual/index.html:772][manual/index.html:772]; [manual/index.html:800][manual/index.html:800]; [manual/index.html:911][manual/index.html:911]; [src/player.js:832][src/player.js:832]; [EWA](https://www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf); [Porter and Duff](https://keithp.com/~keithp/porterduff/p253-porter.pdf). See F11/F27 for qualifications. |
| Renderer cutoff                             | The normalized/truncated falloff (exp(−4A)−exp(−4))/(1−exp(−4)) agrees with the kernel source. exp(−4)=0.01831564 and √8=2.828427 justify the stated ~1.8% ideal weight / ~2.8σ cutoff distinction.                                                                                                                                                                                                                                         | [manual/index.html:559][manual/index.html:559]; [src/kernels.js:29][src/kernels.js:29].                                                                                                                                                                                                                                                                                             |
| Tier numbers and historical sharpness table | Usual budgets 60k/140k/200k/280k and maxima 120k/240k/300k/400k match PROFILES. Auto thresholds match detectProfile. The manual’s historical six-row measurement table agrees with SHARPNESS.md, including the stated 14-toy scope; this is source verification, not an independent rerun of the experiment.                                                                                                                                | [manual/index.html:306][manual/index.html:306]; [manual/index.html:327][manual/index.html:327]; [src/generators.js:76][src/generators.js:76]; [src/player.js:146][src/player.js:146]; [docs/lab/SHARPNESS.md:1][docs/lab/SHARPNESS.md:1].                                                                                                                                           |
| Recipe storage and fitting                  | Four animation floats, four-bit part index, body plus at most 15 named parts, 48 tokens, 96 levers, and six lever groups match source. Fit diameter is 1.9 toy units. Null colors omit splats; weights and area apportion surface samples. Packing two 12-bit coordinates in one float32 is exact because the combined integer is below 2²⁴.                                                                                                | [src/generators.js:91][src/generators.js:91]; [src/kit.js:630][src/kit.js:630]; [src/kit.js:778][src/kit.js:778]; [src/effects.js:849][src/effects.js:849]; [src/motion.js:544][src/motion.js:544]; [src/kit.js:1124][src/kit.js:1124]; [src/kit.js:945][src/kit.js:945]. F25 corrects target versus offset.                                                                        |
| Smoothstep and time sampling                | g²(3−2g) has values 0, 0.5, and 1 at g=0, 0.5, and 1, with zero endpoint slopes. For K≥2, turning-ring chord dip 1−cos(π/K) gives 3.4074% at 12, 2.1852% at 15, and 0.8555% at 24. With the 2% reserve, floor(0.98×120000/K) gives 9,800 / 7,840 / 4,900 points per copy; actual sampling can round lower.                                                                                                                                  | [manual/demo-math.js:44][manual/demo-math.js:44]; [manual/demo-math.js:73][manual/demo-math.js:73]; [src/packs/splat-equation.js:486][src/packs/splat-equation.js:486]; [smoothstep](https://en.wikipedia.org/wiki/Smoothstep).                                                                                                                                                     |
| All 75 gallery programs and scene hashes    | Decoded every d. scene hash, parsed all statements, compiled all programs with the actual reader, and compared printed fields with the decoded options/preset. All 75 compiled and matched. Every new-tab runtime reached splat-equation with the same options (one transient failure passed on retry). F12–F16 identify titles/descriptions that still disagree with their formulas.                                                       | [src/codec.js:36][src/codec.js:36]; [src/packs/splat-equation.js:170][src/packs/splat-equation.js:170]; gallery link inventory below.                                                                                                                                                                                                                                               |
| Four complete JavaScript examples           | Built windmill, bars, frame, and book with buildRecipe, seed 341441, and a requested count of 6,000, entirely in temporary scripts. Actual counts were 6,000 / 5,999 / 6,001 / 6,000; tokens, parts, and drive outputs were finite and consistent with the examples. Surface rounding explains ±1; exact target count is not guaranteed.                                                                                                    | [manual/example-recipe.js:1][manual/example-recipe.js:1]; [manual/index.html:4837][manual/index.html:4837]; [manual/index.html:4898][manual/index.html:4898]; [manual/index.html:4992][manual/index.html:4992]; [src/kit.js:1326][src/kit.js:1326].                                                                                                                                 |
| Remaining claims and references             | Read the folding explanations, shape helper/API descriptions, code registration steps, player controls, capture/file-format discussion, compression description, glossary, further reading, and quick reference against their named files. The mathematical research sources resolve except the DOI noted in F30. Claims of broad uniqueness are expressly scoped “to our knowledge”; they were not treated as an exhaustive market survey. | [src/loaders.js:1][src/loaders.js:1]; [src/motion.js:1][src/motion.js:1]; [src/pictures.js:1][src/pictures.js:1]; [src/state.js:174][src/state.js:174]; [manual/index.html:5296][manual/index.html:5296]. Limits of runtime and historical checks are below.                                                                                                                        |

## Demos

Every listed item was opened at both sizes. “Planned” means the page explicitly says “Demo coming ·
web only” and supplies no live canvas or controls; it is not a failed initialization. There were no
uncaught page errors or demo resource failures. A fresh Chromium navigation logs one HTTP 404 for
the browser’s automatic `/favicon.ico` request; therefore the page is not literally free of console
errors, although its demo modules load successfully. Subsequent cached navigation did not show that
error. All manual images loaded, and neither viewport had horizontal page overflow.

| Demo                | Source                                           | 390×844                                                                                                                      | 1440×900                                                                                         | Matches its text?                                                                                                       | Timing / errors                                                                                             |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| gaussian-3d         | [manual/index.html:202][manual/index.html:202]   | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| splat-numbers       | [manual/index.html:295][manual/index.html:295]   | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| bell-1d-to-3d       | [manual/index.html:539][manual/index.html:539]   | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| covariance-validity | [manual/index.html:597][manual/index.html:597]   | Loaded; touch sliders changed the verdict; matrix-mode switch works. [screenshot](34-phone-demo-covariance.jpg)              | Loaded; mouse drag changed values; switches work. [screenshot](34-desktop-demo-covariance.jpg)   | Shows ellipse, matrix, eigenvalues, and invalid examples. F08/F24 affect verdict/readout accuracy.                      | No animation loop. Largest observed input handler: 8.4 ms phone / 11.0 ms desktop; 12.6 ms at phone 4× CPU. |
| projection          | [manual/index.html:782][manual/index.html:782]   | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| sort-blend          | [manual/index.html:889][manual/index.html:889]   | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| windmill-parts      | [manual/index.html:1271][manual/index.html:1271] | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| smoothstep          | [manual/index.html:1279][manual/index.html:1279] | Loaded; touch drag on canvas and slider changed g; keyboard arrows and Play work. [screenshot](34-phone-demo-smoothstep.jpg) | Loaded; mouse drag, arrows, and Play work. [screenshot](34-desktop-demo-smoothstep.jpg)          | Straight ramp and eased turn agree with g²(3−2g); endpoint behavior agrees.                                             | See timing table: smooth at 1×; over 33 ms under phone 4× CPU.                                              |
| uv-torus            | [manual/index.html:1520][manual/index.html:1520] | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| program-fields      | [manual/index.html:1609][manual/index.html:1609] | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| order-of-operations | [manual/index.html:1723][manual/index.html:1723] | Loaded; typed expressions redraw the tree; variable sliders work. [screenshot](34-phone-demo-reader.jpg)                     | Loaded; typed expressions and variable changes work. [screenshot](34-desktop-demo-reader.jpg)    | Power associativity and minus precedence agree. Guard limits differ from the toy (F07).                                 | No continuous animation. Input-handler maximum about 0.6 ms in the observed edits.                          |
| grammar-railroad    | [manual/index.html:1833][manual/index.html:1833] | Planned; visible placeholder, no touch control.                                                                              | Planned; visible placeholder, no drag control.                                                   | The promised interaction is not implemented.                                                                            | N/A: no demo frames.                                                                                        |
| t-clock             | [manual/index.html:2031][manual/index.html:2031] | Loaded; touch scrubbing, equation select, moment count, and Play work. [screenshot](34-phone-demo-moments.jpg)               | Loaded; mouse scrubbing, select, count, and Play work. [screenshot](34-desktop-demo-moments.jpg) | Turning/breathing/wave, half-cycle discontinuity, and sawtooth loop jump are visible. F09/F10 affect time/dip readouts. | See timing table: smooth at 1×; over 33 ms under phone 4× CPU.                                              |

Timing measured consecutive requestAnimationFrame timestamps for each demo’s animation callback,
over one 2.4-second smoothstep run and one 4-second moments run, after gallery runtime checks ended.
These are short traces, not phone benchmarks. CPU throttling includes the browser’s
scheduling/rendering effects; callback duration alone is much shorter than the observed frame
intervals. Both animated demos exceed 33 ms in the 4× CPU proxy. Physical-phone performance remains
unchecked.

| Viewport | CPU | Demo       | Frames | Mean interval, ms | p95, ms | Maximum, ms | Intervals >33 ms | Max JS callback, ms |
| -------- | --- | ---------- | ------ | ----------------- | ------- | ----------- | ---------------- | ------------------- |
| phone    | 1×  | smoothstep | 145    | 16.67             | 16.80   | 16.80       | 0/144            | 1.70                |
| phone    | 1×  | t-clock    | 241    | 16.67             | 16.80   | 16.80       | 0/240            | 0.40                |
| phone    | 4×  | smoothstep | 43     | 58.33             | 66.80   | 100.00      | 42/42            | 1.90                |
| phone    | 4×  | t-clock    | 107    | 38.21             | 66.60   | 99.90       | 97/106           | 7.40                |
| desktop  | 1×  | smoothstep | 145    | 16.67             | 16.70   | 16.80       | 0/144            | 1.90                |
| desktop  | 1×  | t-clock    | 241    | 16.67             | 16.80   | 16.80       | 0/240            | 0.30                |

## Links and anchors

The HTML contains 206 anchor elements and 170 distinct hrefs: 29 fragments, 75 scene links, and 66
other destinations. The tables account for every distinct href and give source lines for repeated
instances. Checked fragments by navigating with folds initially closed; all targets existed and
their ancestor folds opened. Also checked the 14 glossary-popup triggers, their destinations, the
popup link, and Escape dismissal. Generated outline links use the same resolved heading IDs.

### Internal anchors

| Fragment     | HTML source lines | Result                                      |
| ------------ | ----------------- | ------------------------------------------- |
| #splat       | 56, 99            | Pass: target exists; containing folds open. |
| #toy         | 59, 100           | Pass: target exists; containing folds open. |
| #language    | 62, 101           | Pass: target exists; containing folds open. |
| #gallery     | 66, 102           | Pass: target exists; containing folds open. |
| #pictures    | 69, 103           | Pass: target exists; containing folds open. |
| #moving      | 73, 104           | Pass: target exists; containing folds open. |
| #data        | 77, 105           | Pass: target exists; containing folds open. |
| #photo3d     | 81, 106           | Pass: target exists; containing folds open. |
| #codes       | 85, 107           | Pass: target exists; containing folds open. |
| #make        | 89, 108           | Pass: target exists; containing folds open. |
| #level-map   | 98                | Pass: target exists; containing folds open. |
| #more        | 109               | Pass: target exists; containing folds open. |
| #unique      | 110               | Pass: target exists; containing folds open. |
| #experiments | 111               | Pass: target exists; containing folds open. |
| #later       | 112               | Pass: target exists; containing folds open. |
| #glossary    | 113               | Pass: target exists; containing folds open. |
| #reading     | 114               | Pass: target exists; containing folds open. |
| #references  | 115               | Pass: target exists; containing folds open. |
| #card        | 116               | Pass: target exists; containing folds open. |
| #ref-4       | 527               | Pass: target exists; containing folds open. |
| #ref-5       | 561, 5480         | Pass: target exists; containing folds open. |
| #ref-6       | 769, 5501         | Pass: target exists; containing folds open. |
| #ref-2       | 780               | Pass: target exists; containing folds open. |
| #ref-3       | 820               | Pass: target exists; containing folds open. |
| #ref-1       | 822               | Pass: target exists; containing folds open. |
| #ref-10      | 1023              | Pass: target exists; containing folds open. |
| #ref-7       | 1268, 5539        | Pass: target exists; containing folds open. |
| #ref-9       | 1418, 5552        | Pass: target exists; containing folds open. |
| #ref-8       | 1787, 5546        | Pass: target exists; containing folds open. |

### Toy links

All scene links target the public Playground, set `target="_blank"` and `rel="noopener"`, decode to
`splat-equation`, and carry the printed program or the matching built-in preset. The public
destination returned 200. For reproducible runtime checking, clicking each actual link opened its
public URL in a new tab while requests under that URL were served from the pinned local checkout. No
labs state or query was injected. This proves the pinned code’s loading behavior; it does not prove
the deployed site is the same commit. Long compressed hashes are identified by their card and source
line rather than copied into this report.

| #   | Card / preset               | Link source                                      | HTTP / target / program                          | Labs                                             | Runtime                                            |
| --- | --------------------------- | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------- |
| 1   | Sphere                      | [manual/index.html:2178][manual/index.html:2178] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 2   | Torus                       | [manual/index.html:2203][manual/index.html:2203] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 3   | Möbius strip                | [manual/index.html:2228][manual/index.html:2228] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 4   | Seashell                    | [manual/index.html:2253][manual/index.html:2253] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 5   | Trefoil knot                | [manual/index.html:2278][manual/index.html:2278] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 6   | Wave                        | [manual/index.html:2302][manual/index.html:2302] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 7   | Spiral galaxy               | [manual/index.html:2330][manual/index.html:2330] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 8   | Klein bottle (figure eight) | [manual/index.html:2355][manual/index.html:2355] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 9   | Hello, circle               | [manual/index.html:2376][manual/index.html:2376] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 10  | Bouncing spring             | [manual/index.html:2397][manual/index.html:2397] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 11  | Beating heart               | [manual/index.html:2421][manual/index.html:2421] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 12  | Rainbow ribbon              | [manual/index.html:2448][manual/index.html:2448] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 13  | Firework                    | [manual/index.html:2474][manual/index.html:2474] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 14  | Opening flower              | [manual/index.html:2496][manual/index.html:2496] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 15  | Vase (no t)                 | [manual/index.html:2521][manual/index.html:2521] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 16  | Spun sphere                 | [manual/index.html:2569][manual/index.html:2569] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 17  | Rainbow torus               | [manual/index.html:2604][manual/index.html:2604] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 18  | Möbius ribbon               | [manual/index.html:2639][manual/index.html:2639] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 19  | Figure-eight Klein bottle   | [manual/index.html:2679][manual/index.html:2679] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 20  | Pseudosphere                | [manual/index.html:2717][manual/index.html:2717] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 21  | Enneper surface             | [manual/index.html:2752][manual/index.html:2752] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 22  | Catenoid                    | [manual/index.html:2790][manual/index.html:2790] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 23  | Helicoid                    | [manual/index.html:2825][manual/index.html:2825] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 24  | Dini surface                | [manual/index.html:2860][manual/index.html:2860] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 25  | Shell growth                | [manual/index.html:2898][manual/index.html:2898] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 26  | Lissajous knot              | [manual/index.html:2938][manual/index.html:2938] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 27  | Trefoil tube                | [manual/index.html:2976][manual/index.html:2976] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 28  | Cinquefoil knot             | [manual/index.html:3011][manual/index.html:3011] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 29  | Rose curve beads            | [manual/index.html:3046][manual/index.html:3046] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 30  | Figure-eight knot           | [manual/index.html:3084][manual/index.html:3084] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 31  | Double helix                | [manual/index.html:3123][manual/index.html:3123] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 32  | Slinky coil                 | [manual/index.html:3158][manual/index.html:3158] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 33  | Lorenz-like look-alike      | [manual/index.html:3193][manual/index.html:3193] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 34  | Rössler-like look-alike     | [manual/index.html:3227][manual/index.html:3227] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 35  | Five-petal flower           | [manual/index.html:3259][manual/index.html:3259] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 36  | Sunflower-style spiral      | [manual/index.html:3304][manual/index.html:3304] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 37  | Nautilus coil               | [manual/index.html:3339][manual/index.html:3339] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 38  | Jellyfish bell              | [manual/index.html:3374][manual/index.html:3374] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 39  | Coral fan                   | [manual/index.html:3409][manual/index.html:3409] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 40  | Pinecone spiral             | [manual/index.html:3444][manual/index.html:3444] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 41  | Sea anemone                 | [manual/index.html:3479][manual/index.html:3479] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 42  | Fern frond                  | [manual/index.html:3514][manual/index.html:3514] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 43  | Dahlia bloom                | [manual/index.html:3549][manual/index.html:3549] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 44  | Sea fan branches            | [manual/index.html:3584][manual/index.html:3584] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 45  | Lily pad                    | [manual/index.html:3619][manual/index.html:3619] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 46  | Traveling wave              | [manual/index.html:3661][manual/index.html:3661] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 47  | Breathing torus             | [manual/index.html:3696][manual/index.html:3696] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 48  | Rotating saddle             | [manual/index.html:3731][manual/index.html:3731] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 49  | Orbiting rings              | [manual/index.html:3769][manual/index.html:3769] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 50  | Opening flower              | [manual/index.html:3807][manual/index.html:3807] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 51  | Breathing bumpy sphere      | [manual/index.html:3845][manual/index.html:3845] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 52  | Twisting ribbon             | [manual/index.html:3880][manual/index.html:3880] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Passed on retry after one ERR_FAILED/90 s timeout. |
| 53  | Pulsing star                | [manual/index.html:3918][manual/index.html:3918] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 54  | Wobbling helix              | [manual/index.html:3953][manual/index.html:3953] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 55  | Standing wave               | [manual/index.html:3988][manual/index.html:3988] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 56  | Height hue bands            | [manual/index.html:4028][manual/index.html:4028] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 57  | Angle around the torus      | [manual/index.html:4063][manual/index.html:4063] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 58  | Curvature-like bands        | [manual/index.html:4100][manual/index.html:4100] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 59  | RGB sunset gradient         | [manual/index.html:4140][manual/index.html:4140] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 60  | Rainbow shell               | [manual/index.html:4178][manual/index.html:4178] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 61  | Blue-green sphere           | [manual/index.html:4215][manual/index.html:4215] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 62  | Klein bottle color flow     | [manual/index.html:4252][manual/index.html:4252] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 63  | Plasma RGB sheet            | [manual/index.html:4289][manual/index.html:4289] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 64  | Longitude stripes           | [manual/index.html:4327][manual/index.html:4327] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 65  | Rainbow wave                | [manual/index.html:4362][manual/index.html:4362] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 66  | Thermal spiral              | [manual/index.html:4403][manual/index.html:4403] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 67  | Hopf link                   | [manual/index.html:4442][manual/index.html:4442] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 68  | Fourier epicycle curve      | [manual/index.html:4477][manual/index.html:4477] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 69  | Superquadric                | [manual/index.html:4515][manual/index.html:4515] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 70  | Riemann branch look         | [manual/index.html:4552][manual/index.html:4552] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 71  | Monkey saddle               | [manual/index.html:4590][manual/index.html:4590] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 72  | Spherical harmonic lobes    | [manual/index.html:4628][manual/index.html:4628] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 73  | Lemniscate tube             | [manual/index.html:4666][manual/index.html:4666] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 74  | Gyroid slice                | [manual/index.html:4707][manual/index.html:4707] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |
| 75  | Torus knot family           | [manual/index.html:4742][manual/index.html:4742] | 200; new tab; decoded and runtime options match. | Labs toy; direct link works with labs off (F31). | Pass.                                              |

### Other destinations

Used GET, followed redirects, and checked final HTTP status; this covers 60 distinct external URLs
after removing fragments. Fifty-nine returned 200, and the Porter–Duff DOI returned 403. A 200
response establishes reachability, not scientific correctness or continued future availability. Four
public manual demo fragments also resolve in the pinned local page. Relative PDF, homepage, and
recipe-file links returned 200 locally. The 75 gallery links target a labs-marked toy but still open
directly; their missing adjacent lab labels are recorded in F31. Other destinations do not require
labs.

| Href                                                                      | HTML source lines      | HTTP / anchor result                               | Target  | Labs               |
| ------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- | ------- | ------------------ |
| https://ryanjosephkamp.github.io/splashery/                               | 37, 5750               | 200                                                | New tab | No labs-only page. |
| tinkerers-manual.pdf                                                      | 121                    | 200 from local server.                             | New tab | No labs-only page. |
| ../                                                                       | 124                    | 200 from local server.                             | New tab | No labs-only page. |
| https://ryanjosephkamp.github.io/splashery/manual/#demo-covariance        | 692                    | 200; fragment target also exists in pinned manual. | New tab | No labs-only page. |
| https://github.com/ryanjosephkamp/splashery/blob/main/docs/PACKS.md       | 1021, 1045, 5702       | 200                                                | New tab | No labs-only page. |
| https://ryanjosephkamp.github.io/splashery/manual/#demo-smoothstep        | 1328                   | 200; fragment target also exists in pinned manual. | New tab | No labs-only page. |
| https://github.com/ryanjosephkamp/splashery                               | 1337, 5438             | 200                                                | New tab | No labs-only page. |
| example-recipe.js                                                         | 1344                   | 200 from local server.                             | New tab | No labs-only page. |
| https://ryanjosephkamp.github.io/splashery/manual/#demo-reader            | 1756                   | 200; fragment target also exists in pinned manual. | New tab | No labs-only page. |
| https://ryanjosephkamp.github.io/splashery/manual/#demo-moments           | 2086                   | 200; fragment target also exists in pinned manual. | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Sphere                                      | 2572, 3848, 4218, 4330 | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Torus                                       | 2607, 3699, 4066       | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/M%C3%B6bius_strip                           | 2645                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Klein_bottle                                | 2682, 4255             | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Pseudosphere                                | 2720                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Enneper_surface                             | 2758                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Catenoid                                    | 2793                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Helicoid                                    | 2828                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Dini%27s_surface                            | 2866                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Seashell                                    | 2901, 4181             | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Lissajous_curve                             | 2944                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Trefoil_knot                                | 2979                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Torus_knot                                  | 3014, 4745             | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Rose_(mathematics)                          | 3052                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Figure-eight_knot                           | 3090                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/DNA                                         | 3126                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Helix                                       | 3161, 3956             | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Flower                                      | 3262, 3552, 3810       | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Phyllotaxis                                 | 3307, 3447             | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Nautilus                                    | 3342                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Jellyfish                                   | 3377                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Coral                                       | 3412                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Sea_anemone                                 | 3482                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Fern                                        | 3517                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Sea_fan                                     | 3587                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Water_lily                                  | 3622                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Wave                                        | 3664, 4031, 4365       | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Saddle_surface                              | 3737                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Parametric_equation                         | 3775                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Ribbon_(mathematics)                        | 3886                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Star_polygon                                | 3921                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Standing_wave                               | 3991                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Curvature                                   | 4103                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/RGB_color_model                             | 4146, 4295             | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Spiral                                      | 4406                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Hopf_link                                   | 4445                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Fourier_series                              | 4483                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Superquadrics                               | 4518                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Riemann_surface                             | 4558                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Monkey_saddle                               | 4593                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Spherical_harmonics                         | 4634                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Lemniscate_of_Bernoulli                     | 4672                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Gyroid                                      | 4710                   | 200                                                | New tab | No labs-only page. |
| https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/                 | 5578                   | 200                                                | New tab | No labs-only page. |
| https://arxiv.org/pdf/2308.04079                                          | 5580, 5630             | 200                                                | New tab | No labs-only page. |
| https://www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf | 5590, 5640             | 200                                                | New tab | No labs-only page. |
| https://niujinshuchong.github.io/mip-splatting/                           | 5598                   | 200                                                | New tab | No labs-only page. |
| https://surfsplatting.github.io/                                          | 5604                   | 200                                                | New tab | No labs-only page. |
| https://anttwo.github.io/sugar/                                           | 5614                   | 200                                                | New tab | No labs-only page. |
| https://doi.org/10.1145/964965.808606                                     | 5647                   | 403; environment blocked access (F30).             | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Multivariate_normal_distribution            | 5656                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Quadratic_form                              | 5662                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Affine_transformation                       | 5671                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Smoothstep                                  | 5677                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Extended_Backus%E2%80%93Naur_form           | 5686                   | 200                                                | New tab | No labs-only page. |
| https://en.wikipedia.org/wiki/Parametric_surface                          | 5692                   | 200                                                | New tab | No labs-only page. |

### PDF annotations

Both PDFs contain 96 link annotations: 54 named internal destinations and 42 URI annotations. All 54
named destinations resolve to entries in the PDF destination tree and to in-range pages; 29
destination names exist. All URI targets except the relative example download correspond to checked
web destinations. The p. 19 example download expands to localhost (F21), so its local 200 does not
make it usable in a distributed PDF. The PDF omits the newer 60 cards’ Run/About links along with
their program text (F02).

## PDF comparison and rebuild

Compared all 67 shipped Letter pages as rendered page contact sheets, inspected the figures, tables,
code continuations, and mathematical blocks, extracted all page text, compared headings and
normalized content with the HTML, and inspected all link annotations. Automated whole-paragraph
searches were supplemented by visual inspection because page footers, hyphenation, and line wrapping
can interrupt otherwise matching text.

| Check              | Result                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sections           | All major sections and level headings, the planned Levels 6–10, glossary, references, further reading, and quick reference are present. No whole teaching section was found missing.                                                  |
| Live demos         | All four have stills and an “Interactive in the web version” note/link: covariance p. 9, smoothstep p. 19, reader p. 24, and moments p. 29. No implemented live demo is left without a still or note.                                 |
| Planned demos      | The nine “Demo coming” placeholders are hidden by print CSS. This removes future-work descriptions, not implemented interactive content.                                                                                              |
| New gallery        | All 60 pictures, titles, and descriptions appear on pp. 39–46; all 60 program blocks and Run/About links are absent, without a print-specific explanation (F02). The older 15 examples retain programs and Run links on pp. 31–38.    |
| Figures / formulas | No broken figure or clipped formula was found in the shipped PDF. Mathematical blocks stay together. The provided-browser rebuild drops the affine arrow on p. 63 (F22); the shipped arrow is present.                                |
| Tables             | No table cell was visibly cut off. The recipe-part table continues over pp. 14–15 without repeating its column headings; budget and field-table notes continue on following pages. Repeating headers would improve reading.           |
| Page breaks        | No individual typeset formula was found split across pages. Long code examples continue across pp. 17–18, 48–49, 50–51, and 52–53; these are code continuations, not broken mathematical equations.                                   |
| Web-only text      | Fold/outline controls, live controls/readouts, planned-demo placeholders, and the 60 new programs/card links are absent from the PDF. The latter omission is material; the other differences are intentional interface substitutions. |
| PDF-only text      | Page-number footers and four print-only still captions/links. No additional substantive teaching paragraph was found only in the PDF.                                                                                                 |
| Links              | The recipe download is localhost in both files (F21). All named PDF destinations resolve.                                                                                                                                             |

The builder is [tools/manual-pdf.mjs:1][tools/manual-pdf.mjs:1]. It loads the served manual with
Playwright, switches to print/light media, waits for images, opens every `<details>`, and calls
`page.pdf` with Letter size, backgrounds, CSS page size, tagged output, an outline, and numbered
footers. Print rules in [manual/manual.css:910][manual/manual.css:910] control the layout and still
substitutions. It writes the shipped path by default, so this audit supplied a temporary output
path.

Rebuild command used the identical tool from the existing checkout to resolve its already installed
dependencies; its content was confirmed identical to the pinned tool, and its HTTP input was the
isolated main checkout:

```bash
SPLASHERY_CHROMIUM=/usr/bin/chromium node /workspace/splashery/tools/manual-pdf.mjs /tmp/manual-audit-evidence/rebuilt.pdf
```

| File                                  | Bytes     | Pages | Producer                          | SHA-256                                                          |
| ------------------------------------- | --------- | ----- | --------------------------------- | ---------------------------------------------------------------- |
| Shipped `manual/tinkerers-manual.pdf` | 5,417,179 | 67    | HeadlessChrome 141 / SkiaPDF m141 | a0cc424c0423b2dae9f677ce9a9d2ee6a0958fec6293c61561189f4d45d12b49 |
| Temporary rebuild                     | 5,084,772 | 67    | HeadlessChrome 151 / SkiaPDF m151 | 341a94552bc5f8fa7464bc192c1ba94fa0bfddf91931bdb44a19faf90fa0eaaa |

Rebuilding did **not** produce the same file. Creation timestamps and Chromium versions differ, and
the build does not pin them. The extracted word sequence differs in six localized comparison blocks,
mostly footer/page-break placement and hyphenation, plus the affine glyph loss. Examples include the
“Parts” heading moving from p. 15 to p. 16 and a code continuation moving within pp. 48–49. This
provides no basis to call the shipped PDF generated from a different main revision. Exact
reproducibility with Chrome 141 and its font environment remains untested. Both PDFs retain the
gallery omission and localhost link.

## Reading: four most useful improvements

1. **R01:** Explain complete programs versus partial edits before the field table.
2. **R02:** Collect degree, radian, recipe-unit, and toy-unit conventions before the first recipe.
3. **R03:** Give the JavaScript authoring prerequisites and registration path before the long code
   block.
4. **R04:** Bridge projection to eigenvalues with one small numeric example. The existing terms are
   defined immediately; the issue is the size of the mathematical step.

## What could not be checked and why

- Physical phones, Safari/iOS, Firefox, and actual weak-device GPU behavior were unavailable.
  Touch/viewport emulation and 4× CPU throttling are proxies; the measured >33 ms traces are not
  claims about every phone. WebGPU fluid behavior was checked in source, not exercised on a
  supported hardware device.
- The 403 DOI could not be read through that endpoint in this environment; the author-hosted paper
  was opened instead. HTTP status checks do not validate every external page’s content or every
  remote fragment. The four external manual fragments were verified against the pinned page, not a
  separately authenticated deployment revision.
- The historical sharpness/budget experiments were checked against their reports and tools, not
  rerun across all toy/device combinations. No exhaustive market survey supports the qualified
  uniqueness claims.
- Every gallery link was compiled, decoded, and opened, but animated 3D output was not visually
  measured against every gallery still on physical hardware. Formula-based mismatches are documented
  separately. The four JavaScript examples were built in memory; registering new examples would
  violate the read-only scope. Live camera/microphone/model downloads and optional recording were
  checked in source rather than granted access to real inputs.
- Exact rebuilding in the original Chrome 141/font environment was unavailable. The newer Chromium’s
  rebuild was written only under `/tmp`; no PDF or build artifact in the repo was replaced. Rendered
  inspection may miss a small glyph defect outside the pages examined at full size; all shipped
  pages were also reviewed as contact sheets.
- The audit pins the main revision above. Changes by the concurrent manual session after that
  revision are outside these findings.

New screenshot evidence: 16 JPEG files, 847,841 bytes total. Including the screenshots already
present in this folder, image bytes total 2,894,820, below 3 MB. Only `REPORT.md` and new `34-*.jpg`
screenshots are added by this task. Browser scripts, downloaded research papers, extracted
JSON/text, and the rebuilt PDF stayed outside the repo.

## Source links

[manual/index.html:34]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L34
[manual/index.html:44]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L44
[src/packs/photo-sharp.js:174]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/photo-sharp.js#L174
[src/live/relief-mesh.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/live/relief-mesh.js#L1
[manual/index.html:2527]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2527
[manual/manual.css:978]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/manual.css#L978
[manual/index.html:1718]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1718
[manual/index.html:1770]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1770
[manual/index.html:5729]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5729
[src/packs/splat-equation.js:30]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L30
[src/packs/splat-equation.js:170]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L170
[src/equation.js:18]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/equation.js#L18
[manual/index.html:1868]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1868
[manual/index.html:1881]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1881
[manual/index.html:1887]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1887
[src/packs/splat-equation.js:34]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L34
[src/packs/splat-equation.js:437]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L437
[src/packs/splat-equation.js:486]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L486
[src/packs/splat-equation.js:518]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L518
[manual/index.html:1624]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1624
[src/packs/splat-equation.js:413]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L413
[src/state.js:174]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/state.js#L174
[manual/index.html:1707]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1707
[manual/index.html:1827]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1827
[src/equation.js:238]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/equation.js#L238
[manual/demo-math.js:222]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L222
[manual/index.html:1727]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1727
[manual/demo-math.js:92]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L92
[manual/demo-math.js:167]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L167
[src/equation.js:19]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/equation.js#L19
[src/equation.js:164]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/equation.js#L164
[manual/demo-math.js:28]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L28
[manual/demos.js:89]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demos.js#L89
[manual/demos.js:213]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demos.js#L213
[manual/demos.js:231]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demos.js#L231
[src/packs/splat-equation.js:47]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L47
[manual/demo-math.js:73]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L73
[manual/index.html:772]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L772
[vendor/playcanvas/playcanvas.min.mjs:14953]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/vendor/playcanvas/playcanvas.min.mjs#L14953
[manual/index.html:2548]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2548
[manual/index.html:2554]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2554
[manual/index.html:3028]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3028
[manual/index.html:3031]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3031
[manual/index.html:3066]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3066
[manual/index.html:3069]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3069
[manual/index.html:3751]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3751
[manual/index.html:3754]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3754
[manual/index.html:4045]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4045
[manual/index.html:4048]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4048
[manual/index.html:5266]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5266
[src/fluids/world.js:20]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/fluids/world.js#L20
[src/fluids/world.js:96]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/fluids/world.js#L96
[src/fluids/runtime.js:83]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/fluids/runtime.js#L83
[src/fluids/runtime.js:126]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/fluids/runtime.js#L126
[src/fluids/gpu/surface.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/fluids/gpu/surface.js#L1
[manual/index.html:5217]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5217
[src/packs/live.js:401]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/live.js#L401
[src/packs/sound-lab.js:891]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/sound-lab.js#L891
[CLAUDE.md:55]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/CLAUDE.md#L55
[manual/index.html:5185]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5185
[src/physics/hands-on.js:66]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/physics/hands-on.js#L66
[manual/index.html:399]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L399
[manual/index.html:424]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L424
[manual/index.html:397]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L397
[manual/index.html:5363]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5363
[src/player.js:85]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/player.js#L85
[src/effects.js:1895]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/effects.js#L1895
[src/player.js:627]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/player.js#L627
[docs/lab/BUDGETS.md:23]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/docs/lab/BUDGETS.md#L23
[manual/index.html:1344]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1344
[tools/manual-pdf.mjs:18]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/tools/manual-pdf.mjs#L18
[tools/manual-pdf.mjs:31]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/tools/manual-pdf.mjs#L31
[manual/index.html:5498]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5498
[tools/manual-pdf.mjs:25]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/tools/manual-pdf.mjs#L25
[manual/index.html:751]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L751
[manual/index.html:732]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L732
[manual/demo-math.js:9]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L9
[manual/demos.js:83]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demos.js#L83
[manual/index.html:1934]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1934
[src/kit.js:945]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L945
[src/effects.js:788]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/effects.js#L788
[manual/index.html:2123]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2123
[src/packs/splat-equation.js:530]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L530
[manual/index.html:911]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L911
[manual/index.html:1117]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1117
[src/generators.js:165]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/generators.js#L165
[src/kit.js:116]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L116
[vendor/playcanvas/playcanvas.min.mjs:15010]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/vendor/playcanvas/playcanvas.min.mjs#L15010
[manual/index.html:5305]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5305
[src/generators.js:76]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/generators.js#L76
[src/pc.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/pc.js#L1
[manual/index.html:5328]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5328
[src/codec.js:26]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/codec.js#L26
[src/codec.js:36]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/codec.js#L36
[manual/index.html:5648]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5648
[manual/index.html:2177]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2177
[src/toys.js:2692]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/toys.js#L2692
[src/toys.js:4368]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/toys.js#L4368
[manual/index.html:5284]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5284
[manual/index.html:1530]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1530
[manual/index.html:1554]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1554
[src/packs/splat-equation.js:317]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/packs/splat-equation.js#L317
[manual/index.html:1238]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1238
[manual/index.html:1220]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1220
[src/kit.js:61]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L61
[src/kit.js:1124]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L1124
[manual/index.html:1197]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1197
[manual/index.html:1384]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1384
[manual/index.html:778]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L778
[manual/demo-math.js:22]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L22
[manual/index.html:469]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L469
[manual/index.html:523]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L523
[manual/index.html:800]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L800
[src/player.js:832]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/player.js#L832
[manual/index.html:559]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L559
[src/kernels.js:29]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kernels.js#L29
[manual/index.html:306]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L306
[manual/index.html:327]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L327
[src/player.js:146]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/player.js#L146
[docs/lab/SHARPNESS.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/docs/lab/SHARPNESS.md#L1
[src/generators.js:91]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/generators.js#L91
[src/kit.js:630]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L630
[src/kit.js:778]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L778
[src/effects.js:849]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/effects.js#L849
[src/motion.js:544]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/motion.js#L544
[manual/demo-math.js:44]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/demo-math.js#L44
[manual/example-recipe.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/example-recipe.js#L1
[manual/index.html:4837]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4837
[manual/index.html:4898]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4898
[manual/index.html:4992]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4992
[src/kit.js:1326]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/kit.js#L1326
[src/loaders.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/loaders.js#L1
[src/motion.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/motion.js#L1
[src/pictures.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/src/pictures.js#L1
[manual/index.html:5296]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L5296
[manual/index.html:202]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L202
[manual/index.html:295]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L295
[manual/index.html:539]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L539
[manual/index.html:597]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L597
[manual/index.html:782]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L782
[manual/index.html:889]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L889
[manual/index.html:1271]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1271
[manual/index.html:1279]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1279
[manual/index.html:1520]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1520
[manual/index.html:1609]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1609
[manual/index.html:1723]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1723
[manual/index.html:1833]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L1833
[manual/index.html:2031]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2031
[manual/index.html:2178]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2178
[manual/index.html:2203]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2203
[manual/index.html:2228]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2228
[manual/index.html:2253]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2253
[manual/index.html:2278]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2278
[manual/index.html:2302]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2302
[manual/index.html:2330]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2330
[manual/index.html:2355]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2355
[manual/index.html:2376]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2376
[manual/index.html:2397]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2397
[manual/index.html:2421]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2421
[manual/index.html:2448]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2448
[manual/index.html:2474]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2474
[manual/index.html:2496]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2496
[manual/index.html:2521]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2521
[manual/index.html:2569]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2569
[manual/index.html:2604]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2604
[manual/index.html:2639]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2639
[manual/index.html:2679]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2679
[manual/index.html:2717]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2717
[manual/index.html:2752]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2752
[manual/index.html:2790]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2790
[manual/index.html:2825]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2825
[manual/index.html:2860]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2860
[manual/index.html:2898]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2898
[manual/index.html:2938]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2938
[manual/index.html:2976]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L2976
[manual/index.html:3011]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3011
[manual/index.html:3046]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3046
[manual/index.html:3084]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3084
[manual/index.html:3123]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3123
[manual/index.html:3158]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3158
[manual/index.html:3193]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3193
[manual/index.html:3227]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3227
[manual/index.html:3259]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3259
[manual/index.html:3304]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3304
[manual/index.html:3339]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3339
[manual/index.html:3374]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3374
[manual/index.html:3409]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3409
[manual/index.html:3444]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3444
[manual/index.html:3479]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3479
[manual/index.html:3514]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3514
[manual/index.html:3549]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3549
[manual/index.html:3584]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3584
[manual/index.html:3619]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3619
[manual/index.html:3661]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3661
[manual/index.html:3696]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3696
[manual/index.html:3731]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3731
[manual/index.html:3769]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3769
[manual/index.html:3807]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3807
[manual/index.html:3845]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3845
[manual/index.html:3880]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3880
[manual/index.html:3918]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3918
[manual/index.html:3953]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3953
[manual/index.html:3988]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L3988
[manual/index.html:4028]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4028
[manual/index.html:4063]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4063
[manual/index.html:4100]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4100
[manual/index.html:4140]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4140
[manual/index.html:4178]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4178
[manual/index.html:4215]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4215
[manual/index.html:4252]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4252
[manual/index.html:4289]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4289
[manual/index.html:4327]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4327
[manual/index.html:4362]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4362
[manual/index.html:4403]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4403
[manual/index.html:4442]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4442
[manual/index.html:4477]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4477
[manual/index.html:4515]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4515
[manual/index.html:4552]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4552
[manual/index.html:4590]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4590
[manual/index.html:4628]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4628
[manual/index.html:4666]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4666
[manual/index.html:4707]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4707
[manual/index.html:4742]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/index.html#L4742
[tools/manual-pdf.mjs:1]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/tools/manual-pdf.mjs#L1
[manual/manual.css:910]:
  https://github.com/ryanjosephkamp/splashery/blob/897877d9572a1c3b5f9ec1ff028670227477cb2c/manual/manual.css#L910
