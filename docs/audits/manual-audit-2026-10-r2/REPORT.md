# Tinkerer's Manual audit 2 — October 11, 2026

Codex audited main at `e1d548c48a76d690868a9582d5598dfd24f09fef`, the latest main fetched at the
start of this task. Of the requested task 34 findings F01–F16, **13 are fixed, three are partly
fixed, and none are wholly unchanged**. Both original high-severity findings are fixed: the opening
explains the non-splat renderers, and the PDF prints the second gallery's programs. This audit
records **14 remaining or newly identified findings: zero high, six medium, and eight low**. The
main remaining problems are conflicting option counts, incorrect covariance and projection
explanations, stale claims on the linked capabilities page, nominal budgets presented as actual
counts, and an incorrect QR version range.

All 14 inline demos load and respond at 390×844 and 1440×900. All 75 gallery links decode, compile,
and load their intended programs at both sizes with labs initially off. Every checked manual link
destination and fragment resolves; external GET checks returned 200 except the Porter and Duff DOI,
which still returns 403 here and now has a working author-hosted alternative. The shipped 95-page
PDF and the rebuilt 94-page PDF contain every chapter, figure, demo still, and gallery program, with
no localhost link targets. The rebuild used the provided Chromium 151 override; the normal builder
requires Chromium 141. No fixes were made, and the tracked PDF was not replaced.

## Scope and evidence

Read `CLAUDE.md` first, then `AGENTS.md`, [task 34's
report][docs/audits/manual-audit-2026-10/REPORT.md:1], [ManualR5's
handoff][docs/handoff/ManualR5.md:1], `docs/HANDOFF.md`, and the operating rules. Read all 17 manual
pages, `manual/all.html`, the demo modules, the printed programs, the capabilities page, the named
implementation paths, and the PDF builder. All repository evidence below is pinned to the audited
commit. Quotes are exact excerpts with HTML tags and whitespace normalized; ellipses mark omissions.
Severity follows task 34: high affects a central architectural claim or removes a whole set of
examples, medium changes reproduction or a mathematical conclusion, and low is a local qualification
or reading obstacle.

Served the checkout with `python3 -m http.server 4173 --bind 127.0.0.1`. Used the installed
Playwright and `/usr/bin/chromium` **151.0.7922.173**, without installing a browser. Manual phone
context: 390×844 CSS pixels, touch enabled, device scale factor 2. Desktop: 1440×900, device scale
factor 1. The dedicated counterexample screenshots and gallery runtime checks use scale factor 1 at
both sizes. Screenshot crops can be taller than a viewport because the complete demo element was
captured. Gallery rendering used WebGL2 through SwiftShader, not a physical phone GPU.

Opened every fold, checked image loading and page overflow, exercised controls with touch, mouse,
and keyboard input, tried slider endpoints, selected every offered menu value, and used Play, reset,
and editing controls. Checked fragments with ancestor folds initially closed. For gallery runtime
checks, navigated to each actual public scene URL in a fresh page load, serving its requests from
the pinned checkout; no labs or profile query was injected. All 150 runs produced nonempty splat
buffers and matching scene options, with no uncaught page errors. This checks the audited code, not
whether GitHub Pages currently serves exactly that commit.

Additional page-layout screenshots:

| Page                     | 390×844                     | 1440×900                       |
| ------------------------ | --------------------------- | ------------------------------ |
| Cover and contents       | [Phone](index-390x844.jpg)  | [Desktop](index-1440x900.jpg)  |
| How Splashery is built   | [Phone](built-390x844.jpg)  | [Desktop](built-1440x900.jpg)  |
| Share links and QR codes | [Phone](share-390x844.jpg)  | [Desktop](share-1440x900.jpg)  |
| Unique features          | [Phone](unique-390x844.jpg) | [Desktop](unique-1440x900.jpg) |

Ran the existing manual suites:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  tests/man3.spec.mjs tests/man3-2.spec.mjs tests/man4.spec.mjs \
  tests/man4-pages.spec.mjs tests/man5.spec.mjs
```

**90 passed.** These include generated-table comparisons, reader comparisons, navigation order,
touch layouts, gallery structure, PDF program inclusion, and two builds producing identical bytes in
the same Chromium. Passing these tests does not cover the counterexamples below. Test-generated
tracked screenshots were restored; only this report and its screenshots are proposed changes.

## Task 34 findings F01–F16

“Partly fixed” means the reported example or some of its text was corrected, but the same underlying
claim still has an evidenced counterexample. “Fixed” is limited to the cited issue; it is not an
endorsement of every sentence on that page.

| ID  | Task 34 issue                                         | Status       | Current text / result                                                                                                                                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Every toy and Sharp view described as splats          | Fixed        | “Almost every toy”; “Splashery is primarily splat based, but not only.” The opening describes the textured mesh and hybrid fluids.                                                                           | [manual/index.html:95][manual/index.html:95]; [manual/index.html:105][manual/index.html:105]; [src/packs/photo-sharp.js:178][src/packs/photo-sharp.js:178] disables the splat entity; [src/live/relief-mesh.js:1][src/live/relief-mesh.js:1] implements the mesh. The capabilities page has a separate stale blanket claim, R2-F04.                                                                            |
| F02 | 60 gallery programs omitted from PDF                  | Fixed        | Both PDFs contain all 75 printed programs, every line checked, and 75 distinct scene-link annotations.                                                                                                       | [manual/manual.css:962][manual/manual.css:962]; [manual/gallery.html:479][manual/gallery.html:479]; [shipped gallery](pdf-shipped-52.png), [rebuilt gallery](pdf-rebuilt-51.png). PDF inventory below.                                                                                                                                                                                                         |
| F03 | 120-character limit and 240 called planned            | Fixed        | “Each field can be up to 240 characters long.” Gallery and quick reference agree. The graph/surface reader still defaults to 120.                                                                            | [manual/language.html:522][manual/language.html:522]; [manual/gallery.html:477][manual/gallery.html:477]; [manual/card.html:108][manual/card.html:108]; [src/packs/splat-equation.js:30][src/packs/splat-equation.js:30] and [src/packs/splat-equation.js:170][src/packs/splat-equation.js:170]; [src/equation.js:18][src/equation.js:18].                                                                     |
| F04 | 12 moments stated as the only choice                  | Fixed        | “Moments of t … sets 13, 14, or 15 moments instead; 12 stays the default.” The 13 position evaluations are explicitly the default 12 plus the closing target.                                                | [manual/language.html:581][manual/language.html:581]; [manual/language.html:711][manual/language.html:711]; [manual/language.html:809][manual/language.html:809]; [src/packs/splat-equation.js:34][src/packs/splat-equation.js:34]; position and attribute loops at [src/packs/splat-equation.js:484][src/packs/splat-equation.js:484] and [src/packs/splat-equation.js:518][src/packs/splat-equation.js:518]. |
| F05 | Saved option count omitted moments                    | Partly fixed | One paragraph now totals 16; another still says “uses 15 today,” and the supposed spare key “without labs” is not supported by the option definitions.                                                       | [manual/language.html:425][manual/language.html:425]; [manual/language.html:445][manual/language.html:445]; [src/packs/splat-equation.js:413][src/packs/splat-equation.js:413]; [src/state.js:174][src/state.js:174]. R2-F01.                                                                                                                                                                                  |
| F06 | Bare-function grammar swallowed a later bracket       | Fixed        | The grammar now stops at a later bracket. At u=1, `sin 2(u+1)` is printed as `sin(2) × (u + 1)` and evaluates to 1.81859 in the demo, agreeing with the production reader.                                   | [manual/language.html:510][manual/language.html:510]; [manual/language.html:638][manual/language.html:638]; [src/equation.js:238][src/equation.js:238]; [phone reader](demo-reader-390x844.jpg), [desktop reader](demo-reader-1440x900.jpg).                                                                                                                                                                   |
| F07 | Demo reader accepted expressions rejected by toy      | Fixed        | The tree is explicitly simplified; acceptance is checked with the real `readExpr`. A 141-character expression passes; 40 nested bracket pairs are rejected by the toy check; over 240 characters is refused. | [manual/language.html:530][manual/language.html:530]; [manual/demos.js:155][manual/demos.js:155]; [src/equation.js:19][src/equation.js:19] guards depth 32 and 400 nodes; [tests/man5.spec.mjs:93][tests/man5.spec.mjs:93].                                                                                                                                                                                    |
| F08 | Small positive covariance called flat                 | Partly fixed | The original sizes 0.01, 0.01, turn 0° now show “Valid.” However, trace-zero indefinite matrices are called singular, and sufficiently thin positive matrices are still called invalid.                      | [manual/demo-math.js:22][manual/demo-math.js:22]; [manual/demos.js:88][manual/demos.js:88]; [small positive example](demo-covariance-390x844.jpg), [new counterexample](covariance-trace-zero-390x844.jpg). R2-F02.                                                                                                                                                                                            |
| F09 | Eased animation given linear wall-clock time          | Fixed        | “Play runs the cycle in 4 s from wherever the slider is, easing in and out.” The incorrect elapsed-time estimate is gone.                                                                                    | [manual/demos.js:222][manual/demos.js:222] and [manual/demos.js:241][manual/demos.js:241]; [src/packs/splat-equation.js:47][src/packs/splat-equation.js:47]; [src/packs/splat-equation.js:440][src/packs/splat-equation.js:440]; [moments](demo-moments-1440x900.jpg).                                                                                                                                         |
| F10 | One moment given a 200% worst dip                     | Fixed        | One moment says “worst case for a turn: none.” Counts outside 12–15 are explicitly “only for trying.”                                                                                                        | [manual/demos.js:225][manual/demos.js:225]; [manual/language.html:878][manual/language.html:878]; [phone](demo-moments-390x844.jpg), [desktop](demo-moments-1440x900.jpg). The dip formula is applied only when K>1.                                                                                                                                                                                           |
| F11 | Ideal projection presented without renderer filtering | Partly fixed | A new paragraph distinguishes the first-order footprint and mentions 0.3 px², but it misattributes the fixed blur to an option, and the demo still labels the unfiltered ellipse “the renderer's.”           | [manual/splat.html:1039][manual/splat.html:1039]; [manual/demos2.js:626][manual/demos2.js:626]; [vendor/playcanvas/playcanvas.min.mjs:14948][vendor/playcanvas/playcanvas.min.mjs:14948]. R2-F03.                                                                                                                                                                                                              |
| F12 | Spun sphere stripes said to stay still                | Fixed        | “longitude … so the colors turn with it.” Hue depends on u; x and z use u+t.                                                                                                                                 | [manual/gallery.html:492][manual/gallery.html:492]; [src/equation-gallery.json:6][src/equation-gallery.json:6]; [shipped card](pdf-shipped-49.png), [rebuilt card](pdf-rebuilt-48.png).                                                                                                                                                                                                                        |
| F13 | Rose curve described as six-petaled and planar        | Fixed        | “a rose of 12 petals”; “a gentle vertical wave.” x/z use cos(6u), and y is 0.15sin(3u).                                                                                                                      | [manual/gallery.html:987][manual/gallery.html:987]; [src/equation-gallery.json:123][src/equation-gallery.json:123]; [printed card](pdf-shipped-52.png).                                                                                                                                                                                                                                                        |
| F14 | Trefoil mislabeled figure-eight knot                  | Fixed        | “Trefoil knot beads”; “wraps three times one way and twice the other.” The (3,2) torus-knot program is unchanged and now correctly described.                                                                | [manual/gallery.html:1028][manual/gallery.html:1028]; [manual/gallery.html:1035][manual/gallery.html:1035]; [src/equation-gallery.json:130][src/equation-gallery.json:130]; [printed card](pdf-shipped-52.png). The historical filename/id remains, but the visible title and description are corrected.                                                                                                       |
| F15 | Single orbit described as three separate rings        | Fixed        | “Orbit with a fast wave.” One connected orbit has a fast threefold vertical oscillation.                                                                                                                     | [manual/gallery.html:1732][manual/gallery.html:1732]; [src/equation-gallery.json:301][src/equation-gallery.json:301]; runtime and printed program match.                                                                                                                                                                                                                                                       |
| F16 | Torus hue described as varying across tube            | Fixed        | “Hue runs once around the large ring, so each slice across the tube has one color.” Hue depends only on u.                                                                                                   | [manual/gallery.html:2039][manual/gallery.html:2039]; [src/equation-gallery.json:375][src/equation-gallery.json:375]; runtime and printed program match.                                                                                                                                                                                                                                                       |

## Findings, ordered by severity

New identifiers use R2-F to avoid overwriting task 34's identifiers. Proposed fixes are
recommendations only.

| ID     | Section                                      | Kind                    | Severity | Exact text / observed text                                                                                                                                                               | Proposed fix                                                                                                                                                                                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------------------------------------------- | ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-F01 | Language / option-key budget                 | Wrong                   | medium   | “uses 15 today”; “without labs it has one.”                                                                                                                                              | Make both paragraphs agree on 16 definitions. Explain that labs hides the toy from the shelf; it does not remove the moments definition from a directly loaded equation toy. There is no spare key when all options are saved. | [manual/language.html:425][manual/language.html:425] and [manual/language.html:445][manual/language.html:445] conflict. [src/packs/splat-equation.js:413][src/packs/splat-equation.js:413] defines preset, splats, shade, moments, and 12 fields with no per-option labs gate; [src/ui.js:598][src/ui.js:598] renders these definitions; [src/state.js:177][src/state.js:177] keeps only the first 16 keys. Residual F05.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R2-F02 | Covariance demo / validity verdict           | Wrong                   | medium   | “Not valid: its determinant is 0, so it has no inverse (it is flat in one direction).”                                                                                                   | Separate mathematical positive definiteness, exact singularity, and numerical stability. A zero trace alone does not mean zero determinant. Keep a thin-matrix warning from invalidating a positive covariance.                | At a=0.1, b=0, c=−0.1, det=−0.01 and the matrix is invertible but indefinite. Both sizes display eigenvalues +0.1 and −0.1, alongside this contradictory verdict: [phone](covariance-trace-zero-390x844.jpg), [desktop](covariance-trace-zero-1440x900.jpg). [manual/demo-math.js:31][manual/demo-math.js:31] treats every zero trace as flat and includes a relative tolerance in `valid`; [manual/demos.js:93][manual/demos.js:93] then says the determinant is zero. The positive matrix diag(1e−10,1) also returns invalid/flat in a direct helper call. Residual F08.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R2-F03 | Projection / actual rendered footprint       | Misleading              | medium   | “its anti-aliasing option”; “dashed: the ellipse from Σ′ (the renderer's)”                                                                                                               | Label the demo ellipse as the unfiltered first-order geometry. State the vendored renderer's unconditional +0.3 px² diagonal blur and λ₂ minimum of 0.1, separately from the optional determinant-based opacity compensation.  | [manual/splat.html:1043][manual/splat.html:1043]; [manual/demos2.js:626][manual/demos2.js:626]; [manual/demo-math3.js:167][manual/demo-math3.js:167] returns only J W Σ Wᵀ Jᵀ. [vendor/playcanvas/playcanvas.min.mjs:14948][vendor/playcanvas/playcanvas.min.mjs:14948] gates `aaFactor`, while lines 14953–14959 add the blur and clamp λ₂ outside that gate. [Phone](demo-projection-390x844.jpg), [desktop](demo-projection-1440x900.jpg). Residual F11.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R2-F04 | Linked “What Splashery can do” page          | Wrong / missing context | medium   | “Every toy plays this way”; “one per particle”; “nothing is recorded or sent”; “everything is splats … holds for the toys”; “there is no multi-megabyte file to download.”               | Carry the manual's eligibility, fluid-rendering, explicit Record, mesh, and optional-download qualifications into this page and its generator. Otherwise regenerating the page preserves the contradictions.                   | [site/learn/can-do/index.html:168][site/learn/can-do/index.html:168], [site/learn/can-do/index.html:178][site/learn/can-do/index.html:178], [site/learn/can-do/index.html:272][site/learn/can-do/index.html:272], [site/learn/can-do/index.html:287][site/learn/can-do/index.html:287], and [site/learn/can-do/index.html:201][site/learn/can-do/index.html:201]. [tools/site-hubs.mjs:298][tools/site-hubs.mjs:298]–331 generates them. Counterexamples: [src/physics/hands-on.js:66][src/physics/hands-on.js:66] exclusions; [src/fluids/world.js:20][src/fluids/world.js:20] four liquid splats per particle and [src/fluids/runtime.js:126][src/fluids/runtime.js:126] surface rendering; [src/packs/live.js:401][src/packs/live.js:401] and [src/packs/sound-lab.js:891][src/packs/sound-lab.js:891] local Record; [src/packs/photo-sharp.js:178][src/packs/photo-sharp.js:178] mesh; [src/packs/photo-3d-depth.js:59][src/packs/photo-3d-depth.js:59] loads the 27,258,801-byte model. [Phone](can-do-390x844.jpg), [desktop](can-do-1440x900.jpg). The recording mismatch does not indicate uploading. |
| R2-F05 | Budget table / what the counts denote        | Misleading              | medium   | “Same toy, same view, same phone: 140,000 splats → 200,000 splats.”                                                                                                                      | Call these nominal base budgets and retain or link actual per-toy counts. Qualify the 60k/140k/400k area labels the same way.                                                                                                  | [manual/toy.html:250][manual/toy.html:250] and [manual/toy.html:243][manual/toy.html:243] imply emitted counts. [tools/shp-measure.mjs:72][tools/shp-measure.mjs:72] varies the base budget, with different maxima at [tools/shp-measure.mjs:83][tools/shp-measure.mjs:83]; [src/player.js:282][src/player.js:282] multiplies by recipe density and caps at the maximum. For the American football's density 2 at [src/packs/balls.js:1639][src/packs/balls.js:1639], the two requested allocations are 240,000 and 300,000, before sampling, not 140,000 and 200,000. [docs/lab/BUDGETS.md:50][docs/lab/BUDGETS.md:50] explicitly documents this and retains actual counts. The displayed metric values themselves match that document. [Table](budget-1440x900.jpg).                                                                                                                                                                                                                                                                                                                                        |
| R2-F06 | Share chapter / QR capacity range            | Wrong                   | medium   | “692 to 714 characters (version 21 at level M)”                                                                                                                                          | Correct the range to versions 21–22 at M, or identify and remeasure the historical example URLs. QR capacity must count the entire byte-mode URL.                                                                              | [manual/share.html:262][manual/share.html:262]; [src/qr/share-code.js:14][src/qr/share-code.js:14]; [src/qr/encode.js:7][src/qr/encode.js:7]. In the browser, `shareCode` on the public base `https://ryanjosephkamp.github.io/splashery/#s=` plus lowercase `x` padding returns version 21/M at 711 total ASCII bytes and version 22/M at 712–714. The URL's lowercase characters force byte mode; a 714-byte URL cannot fit version 21/M. The approximately 700-character claim remains sound.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R2-F07 | Built chapter / vendored-library table       | Missing context         | low      | “copied in unchanged”; “Only when the QR code toy, or the Share tab's scene code, opens”; “Only when a QR toy checks a code in a browser whose own barcode reader cannot read QR codes.” | Describe the documented module adaptations and include the other QR consumers, notably Save PDF. Distinguish using the native reader from consumers deliberately requesting jsQR.                                              | [manual/built.html:208][manual/built.html:208], [manual/built.html:410][manual/built.html:410], and [manual/built.html:417][manual/built.html:417]. [LICENSES.md:136][LICENSES.md:136] adds ES-module exports to omggif; [LICENSES.md:169][LICENSES.md:169] describes the compiled QR generator and export wrapper. [src/app.js:1781][src/app.js:1781], [src/pdf-export/index.js:20][src/pdf-export/index.js:20], and [src/pdf-export/pdf.js:21][src/pdf-export/pdf.js:21] load the QR encoder for Save PDF; [src/pdf-export/index.js:98][src/pdf-export/index.js:98] requests `native: false`. [src/packs/qr-craft.js:75][src/packs/qr-craft.js:75] loads jsQR directly rather than checking `BarcodeDetector`. Versions and licenses are otherwise correct.                                                                                                                                                                                                                                                                                                                                                 |
| R2-F08 | Budget table / generator after chapter split | Wrong                   | low      | “The BUDGET markers are not in index.html yet.”                                                                                                                                          | Point the generator and its usage instructions at `manual/toy.html`, which now contains the table.                                                                                                                             | Running `node manual/build-budget.mjs` exits 1 before writing. [manual/build-budget.mjs:12][manual/build-budget.mjs:12] still reads index.html; [manual/build-budget.mjs:149][manual/build-budget.mjs:149] throws because the markers moved to [manual/toy.html:248][manual/toy.html:248]. The checked-in table is currently correct, but its documented regeneration path is broken.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R2-F09 | Windmill demo / selected code line           | Wrong                   | low      | “the four sails (four boxes) … These splats stay where they are when the sails turn.”                                                                                                    | Say the selected hub and blades belong to the moving sails part; use stationary text only for the tower and cap.                                                                                                               | Select the four-box line and turn the slider to 90°. The highlighted sails rotate while the readout says they stay put: [phone](windmill-blades-390x844.jpg), [desktop](windmill-blades-1440x900.jpg). [manual/demos2.js:956][manual/demos2.js:956] tests only the whole `sails` group, so selected `blades` and `hub` fall through to the stationary message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R2-F10 | Share demo / invalid JSON                    | Misleading              | low      | “Fix the JSON to get a link.” while a QR code remains visible                                                                                                                            | Hide or clearly mark the previous QR code when the current JSON cannot be encoded, and reset stale recovery state consistently.                                                                                                | Replace the JSON with `{`. The hash becomes empty and the QR note clears, but the old valid QR remains: [phone](share-invalid-390x844.jpg), [desktop](share-invalid-1440x900.jpg). [manual/demos3.js:88][manual/demos3.js:88] returns without hiding the canvas or clearing `good`. This is distinct from the handoff's deliberate choice to keep the good QR while demonstrating a damaged hash.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R2-F11 | Share chapter / error-correction percentage  | Missing context         | low      | “The code can lose some of its squares … level M (15 percent can be lost) … level L (7 percent)”                                                                                         | Say these are approximate recovery rates for codewords, not guaranteed percentages of arbitrary missing squares. Mention that damage to locating patterns or distribution across blocks can defeat a code.                     | [manual/share.html:257][manual/share.html:257] connects square loss to the percentages. The opened [DENSO WAVE explanation](https://www.qrcode.com/en/about/error_correction.html) specifies “Data restoration rate for total codewords” and eight bits per codeword. The encoder uses Reed–Solomon blocks, not a promise about arbitrary modules: [vendor/qrcodegen/qrcodegen.js:290][vendor/qrcodegen/qrcodegen.js:290].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R2-F12 | Share chapter / readback timing              | Wrong                   | low      | “reads the code back before it shows it”                                                                                                                                                 | Say the dialog shows the code with “Checking that it scans…” and updates the result after asynchronous readback.                                                                                                               | [manual/share.html:268][manual/share.html:268]; [src/qr/share.js:84][src/qr/share.js:84] creates the checking message, [src/qr/share.js:106][src/qr/share.js:106] starts a promise chain without awaiting it, and [src/qr/share.js:142][src/qr/share.js:142] calls `showModal()`. Only the successful result is gated; displaying the code is not.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| R2-F13 | Built chapter / static hosting availability  | Misleading              | low      | “cannot go down because a server did”                                                                                                                                                    | Describe the absence of an application backend while acknowledging the static host and network dependency.                                                                                                                     | [manual/built.html:131][manual/built.html:131] gives an absolute availability claim. [manual/built.html:119][manual/built.html:119] itself requires GitHub Pages or a file server; [index.html:35][index.html:35] starts a network-loaded module graph. The repository's Pages API reports a legacy build serving `main` at `/`. Removing the application backend does not remove the hosting server. No availability test was performed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R2-F14 | Built chapter / external data                | Wrong                   | low      | “the earthquakes, migration, and protein toys do read from outside the site … only when you ask”                                                                                         | Separate runtime external-data requests from data downloaded when building assets. Stork migration reads its shipped data from this site.                                                                                      | [manual/built.html:455][manual/built.html:455]; [src/packs/geo.js:1363][src/packs/geo.js:1363] sets the migration data and picture to `assets/toys/stork-migration/`; [src/packs/geo.js:1404][src/packs/geo.js:1404] prepares those assets through [src/geo/data.js:12][src/geo/data.js:12], whose URL is relative to this site. The outside Movebank download is in [tools/geo-migration.mjs:23][tools/geo-migration.mjs:23], a build script. Earthquake live feeds and a requested PDB entry do have external runtime paths: [src/packs/geo.js:1575][src/packs/geo.js:1575] and [src/molview/load.js:73][src/molview/load.js:73].                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Claims checked against the implementation

The tables below cover the two new chapters, both capabilities pages, and the budget section,
including the numbers and implementation paths. “Verified” means the source supports the stated
behavior; it does not mean every optional device/input path was run. Historical measurements are
checked against their recorded document and measuring tool rather than rerun on physical hardware.

### How Splashery is built

| Claim group                                                                                                                                                 | Check / result                                                                                                                                                                                                                                                                                                                                                                                                                                         | Pinned evidence                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static files, ES modules, import map, main served by Pages, local file server, no application backend/database/key, and no runtime installation or bundling | Verified: `index.html` starts `src/app.js`; the browser loads ordinary module imports. `package.json` has asset/test/format scripts and no application build script. The Pages API reports source branch main, path `/`, legacy build. The local server command served the audit. Static hosting availability is overstated, R2-F13. “A bundler would make … smaller and faster” is a hypothetical design argument, not a measured performance result. | [manual/built.html:112][manual/built.html:112]; [index.html:27][index.html:27]; [index.html:35][index.html:35]; [package.json:1][package.json:1]; [playwright.config.mjs:1][playwright.config.mjs:1]; [CLAUDE.md:1][CLAUDE.md:1].                                                                                                                                                                                                                       |
| Readable source, local scene/file processing, and small embed                                                                                               | The ordinary app modules are source files; the engine is the explicitly vendored minified exception. Scene serialization contains settings rather than file bytes. The under-30-MB embed test exists and measures network response sizes; that separate smoke suite was not run here. Free public hosting is the deployment choice, not a guarantee against outages.                                                                                   | [manual/built.html:137][manual/built.html:137]; [src/state.js:233][src/state.js:233]; [src/element.js:1][src/element.js:1]; [src/viewer.js:1][src/viewer.js:1]; [tests/smoke.spec.mjs:385][tests/smoke.spec.mjs:385].                                                                                                                                                                                                                                   |
| Folder map and “about a hundred” recipe files                                                                                                               | Verified all named paths exist, and their described responsibilities agree with their modules. There are 99 files in `src/packs/`. The tests/tools distinction is correct: Node prepares assets/pages/PDF; the browser loads the generated files. The literal “unchanged” vendor claim needs R2-F07.                                                                                                                                                   | [manual/built.html:160][manual/built.html:160]; [src/app.js:1][src/app.js:1]; [src/ui.js:1][src/ui.js:1]; [src/player.js:1][src/player.js:1]; [src/state.js:1][src/state.js:1]; [src/toys.js:49][src/toys.js:49]; [src/kit.js:1][src/kit.js:1]; [tools/site-build.mjs:1][tools/site-build.mjs:1]; [tools/manual-pdf.mjs:1][tools/manual-pdf.mjs:1]; [tools/toy-plan.json:1][tools/toy-plan.json:1]; [tests/man5.spec.mjs:234][tests/man5.spec.mjs:234]. |
| PlayCanvas 2.22.3, MIT, one direct import, “about two dozen” importers                                                                                      | Verified vendored version and license. `src/pc.js` is the only direct engine re-export; 24 distinct source files import that wrapper. Ordinary recipe construction uses the kit, while exceptional engine consumers include fluids, Worlds, and relief meshes, as described.                                                                                                                                                                           | [manual/built.html:248][manual/built.html:248]; [src/pc.js:5][src/pc.js:5]; [vendor/playcanvas/LICENSE:1][vendor/playcanvas/LICENSE:1]; [LICENSES.md:1][LICENSES.md:1].                                                                                                                                                                                                                                                                                 |
| WebGPU probe then WebGL2; no-GPU message/poster; textures/quads/projection/blending; worker sort and continued frames                                       | Verified the device order and no-GPU exception, on-demand frame extension while sorting, and the renderer shader paths. A “few frames” is a scheduling description, not a fixed deadline. Filtering details need R2-F03.                                                                                                                                                                                                                               | [src/stage.js:18][src/stage.js:18]; [src/stage.js:40][src/stage.js:40]; [src/stage.js:120][src/stage.js:120]; [vendor/playcanvas/playcanvas.min.mjs:14945][vendor/playcanvas/playcanvas.min.mjs:14945]; [vendor/playcanvas/playcanvas.min.mjs:15010][vendor/playcanvas/playcanvas.min.mjs:15010].                                                                                                                                                       |
| Engine file readers, modifiers, scene graph, camera, and loop versus our recipe/effects/parts/paint/picking/sound/UI                                        | Verified the PlayCanvas `.ply`/`.sog` path and Splashery's `.splat`/`.spz` readers, two shader-language implementations, camera, sound, scene state, and kit mechanics. The “one place” description refers to stage setup, not every import of the engine wrapper; the chapter lists exceptions.                                                                                                                                                       | [manual/built.html:273][manual/built.html:273]; [src/stage.js:383][src/stage.js:383]; [src/loaders.js:1][src/loaders.js:1]; [src/effects.js:1][src/effects.js:1]; [src/kernels.js:1][src/kernels.js:1]; [src/camera.js:1][src/camera.js:1]; [src/paint.js:1][src/paint.js:1]; [src/sound.js:1][src/sound.js:1].                                                                                                                                         |
| Sharp textured mesh, WebGPU liquid surface, gas grid, and JavaScript physics/game rules                                                                     | Verified; these are explicit hybrid paths.                                                                                                                                                                                                                                                                                                                                                                                                             | [manual/built.html:315][manual/built.html:315]; [src/live/relief-mesh.js:1][src/live/relief-mesh.js:1]; [src/fluids/runtime.js:83][src/fluids/runtime.js:83]; [src/fluids/gpu/surface.js:1][src/fluids/gpu/surface.js:1]; [src/fluids/gpu/gas.js:1][src/fluids/gpu/gas.js:1]; [src/physics/hands-on.js:66][src/physics/hands-on.js:66]; [src/arcade/runtime.js:1][src/arcade/runtime.js:1].                                                             |
| All vendor folders, versions, jobs, licenses, and loading boundaries                                                                                        | All 15 folders are represented; versions/licenses agree with the notices and files. See the complete library table below. QR loading boundaries and module adaptations need R2-F07.                                                                                                                                                                                                                                                                    | [manual/built.html:331][manual/built.html:331]; [LICENSES.md:1][LICENSES.md:1]; [tests/man5.spec.mjs:251][tests/man5.spec.mjs:251].                                                                                                                                                                                                                                                                                                                     |
| Outside requests are data rather than code, with shipped examples/fallbacks                                                                                 | Source verifies the earthquake feed and requested PDB fetch. Migration is a shipped asset, not an outside runtime request, R2-F14. The claim is not a runtime network inventory of every toy.                                                                                                                                                                                                                                                          | [manual/built.html:455][manual/built.html:455]; [src/packs/geo.js:1575][src/packs/geo.js:1575]; [src/molview/load.js:73][src/molview/load.js:73]; [src/geo/data.js:12][src/geo/data.js:12].                                                                                                                                                                                                                                                             |
| Development tools stay off the runtime import path; a new toy needs recipe, catalog, sounds, help, and plan entries                                         | Verified pinned dev dependencies and documented external build tools. Player imports the pack named by the catalog; tests discover catalog entries, rather than a compiled registration file. Sound/help/plan entries provide metadata; they are not a second runtime compilation step.                                                                                                                                                                | [manual/built.html:459][manual/built.html:459]; [manual/built.html:475][manual/built.html:475]; [package.json:1][package.json:1]; [LICENSES.md:284][LICENSES.md:284]; [src/player.js:581][src/player.js:581]; [src/toys.js:49][src/toys.js:49]; [src/toy-sounds.js:1][src/toy-sounds.js:1]; [src/toy-help.js:1][src/toy-help.js:1]; [tests/taps.spec.mjs:1][tests/taps.spec.mjs:1].                                                                     |

All library sizes below are on-disk decimal byte counts, not compressed transfer sizes. The full
source notices are in [LICENSES.md:1][LICENSES.md:1]. The cited files implement the loading
boundary; optional camera, neural-network, medical-scan, and barcode paths were not all exercised in
this audit.

| Library / model               | Version / size and license verified                         | Runtime loading path / result                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PlayCanvas                    | 2.22.3; MIT                                                 | [src/pc.js:5][src/pc.js:5]; drawing pages import it through the wrapper.                                                                                                                                                                                                |
| gifenc                        | 1.0.3; MIT                                                  | [src/exports.js:5][src/exports.js:5] and [index.html:27][index.html:27]; eager app import, as the chapter expressly says.                                                                                                                                               |
| PDF.js                        | 6.3.289; Apache-2.0, decoder BSD/MIT notices                | [src/media.js:319][src/media.js:319]; dynamically loaded for PDF input, with its worker.                                                                                                                                                                                |
| omggif                        | 1.0.10; MIT                                                 | [src/media.js:632][src/media.js:632]; fallback GIF decoding. Module adaptation is documented, R2-F07.                                                                                                                                                                   |
| ONNX Runtime Web              | 1.30.0; MIT                                                 | [src/packs/photo-3d-depth.js:59][src/packs/photo-3d-depth.js:59] and [src/packs/arcade-listen.js:50][src/packs/arcade-listen.js:50]; depth and Note Rider model sessions.                                                                                               |
| Depth Anything V2 Small, int8 | 27,258,801 bytes, consistent with “about 27 MB”; Apache-2.0 | [src/packs/photo-3d-depth.js:14][src/packs/photo-3d-depth.js:14] and [src/packs/photo-3d-depth.js:63][src/packs/photo-3d-depth.js:63]; model bytes loaded when depth is needed.                                                                                         |
| Basic Pitch                   | 230,444 bytes, consistent with “about 230 KB”; Apache-2.0   | [src/packs/arcade-listen.js:34][src/packs/arcade-listen.js:34] and [src/packs/arcade-listen.js:53][src/packs/arcade-listen.js:53]; own-song analysis.                                                                                                                   |
| Splat.js                      | 0.1.0; MIT                                                  | [src/video3d/run.js:137][src/video3d/run.js:137]; Video to 3D training session.                                                                                                                                                                                         |
| Nayuki QR generator           | Project Nayuki; MIT                                         | [src/qr/encode.js:7][src/qr/encode.js:7]; QR tools, Share QR, and Save PDF. The table omits the last consumer, R2-F07.                                                                                                                                                  |
| jsQR                          | 1.4.0; Apache-2.0                                           | [src/qr/scan.js:40][src/qr/scan.js:40] prefers a supported native reader but falls back when native detection fails too. [src/packs/qr-craft.js:75][src/packs/qr-craft.js:75] and [src/pdf-export/index.js:98][src/pdf-export/index.js:98] use jsQR explicitly, R2-F07. |
| ZXing for JavaScript          | 0.21.3; Apache-2.0                                          | [src/packs/qr-craft.js:728][src/packs/qr-craft.js:728]; Other barcodes loads its writer/reader.                                                                                                                                                                         |
| pdf-lib                       | 1.17.1; MIT                                                 | [src/pdf-export/pdf.js:24][src/pdf-export/pdf.js:24]; loaded while making a PDF.                                                                                                                                                                                        |
| laz-perf                      | 0.0.7; Apache-2.0                                           | [src/viewers/engine.js:69][src/viewers/engine.js:69]; worker-only LAZ decoder.                                                                                                                                                                                          |
| dicom-parser                  | 1.8.21; MIT                                                 | [src/volume/read.js:618][src/volume/read.js:618]; DICOM input.                                                                                                                                                                                                          |
| libwebp from splat-transform  | 3.6.1 package; MIT and BSD-3-Clause                         | [src/viewers/engine.js:19][src/viewers/engine.js:19]; Splat toolkit SOG encode/decode.                                                                                                                                                                                  |

### Share links and QR codes

| Claim / number                                                                                                       | Check / result                                                                                                                                                                                                                                                                                                                                                                                                                                              | Pinned evidence                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Address, `#s=`, `d.` / `j.`, UTF-8 JSON, raw deflate, and base64url alphabet                                         | Verified: `encodeSceneHash`, `decodeSceneHash`, and `parseHash` implement this path. The scene fragment is read by script rather than sent as part of the HTTP resource address. `j.` is encoded JSON, not readable plain text.                                                                                                                                                                                                                             | [manual/share.html:112][manual/share.html:112]; [src/codec.js:8][src/codec.js:8]; [src/codec.js:29][src/codec.js:29]; [src/codec.js:38][src/codec.js:38]; [src/codec.js:46][src/codec.js:46]; [src/codec.js:62][src/codec.js:62].                               |
| Compression fallback and changed-character failures                                                                  | Verified compressed round trips, uncompressed decoding, malformed JSON/streams, and unsupported prefixes in the manual suites and demo edits. The fallback tests availability of `CompressionStream`; the chapter's “every current browser” is a compatibility assertion, not proven by a Chromium-only run. A changed character can sometimes preserve a valid scene; the text explicitly qualifies this.                                                  | [manual/share.html:141][manual/share.html:141]; [manual/share.html:200][manual/share.html:200]; [src/codec.js:38][src/codec.js:38]; [tests/man5.spec.mjs:316][tests/man5.spec.mjs:316]; [share demo](demo-share-1440x900.jpg).                                  |
| Link is the scene, no lookup, no site recovery of an unsaved scene, settings rather than original file bytes         | Verified the app exports and codec have no scene-service write/read path. Local browser preferences and an explicitly saved JSON file are separate from automatic scene recovery. File metadata/settings normalize into the scene; media bytes remain on the original device.                                                                                                                                                                               | [manual/share.html:149][manual/share.html:149]; [src/exports.js:281][src/exports.js:281]; [src/state.js:233][src/state.js:233]; [docs/SCENE-SCHEMA.md:1][docs/SCENE-SCHEMA.md:1].                                                                               |
| Normalization drops unknown keys, clamps values, and fills defaults; malformed scene refused                         | Verified known-key output and numeric guards. The demo presents raw decoded JSON and then normalizes separately, so successfully decoding JSON does not necessarily mean the app accepts the scene.                                                                                                                                                                                                                                                         | [manual/share.html:216][manual/share.html:216]; [src/state.js:303][src/state.js:303]; [manual/demos3.js:49][manual/demos3.js:49].                                                                                                                               |
| Schema 3 current; schema 2 loads with added defaults; schema 1 and future schema refused; saves write current schema | Verified direct normalization of versions 1, 2, 3, and 9: 1/9 throw, 2/3 normalize to 3. Embed and custom element use the same codec and normalizer. The future-loading promise is a maintenance rule, not a guarantee this audit can test in the future.                                                                                                                                                                                                   | [manual/share.html:224][manual/share.html:224]; [src/state.js:13][src/state.js:13]; [src/state.js:303][src/state.js:303]; [src/viewer.js:1][src/viewer.js:1]; [src/element.js:1][src/element.js:1].                                                             |
| About 700 characters at defaults                                                                                     | Consistent with an illustrative current-catalog sweep: full normalized scenes using fixed seed 7 and creation time, with each of 461 builtin ids but no recipe-specific option overrides, gave 690–706 characters, all version 21/M. This is not a reproduction of every historical UI default. Seed, time, options, and paint coordinates change compressed lengths.                                                                                       | [manual/share.html:241][manual/share.html:241]; [src/state.js:65][src/state.js:65]; [src/codec.js:38][src/codec.js:38]; [src/toys.js:49][src/toys.js:49].                                                                                                       |
| 12,288-character link limit; omit paint, then clay, then offer JSON                                                  | Verified `LINK_LIMIT = 12 * 1024` applies to the encoded scene hash, not the complete URL. Branch order is paint, clay, failure. Notices explain omitted details.                                                                                                                                                                                                                                                                                           | [manual/share.html:243][manual/share.html:243]; [src/exports.js:274][src/exports.js:274]; [src/exports.js:290][src/exports.js:290]; [src/exports.js:297][src/exports.js:297]; [src/exports.js:303][src/exports.js:303].                                         |
| QR button in labs, same share hash/base, link only, no uploads, own files reopen, PNG save                           | Verified app's lazy dialog import and `buildShareHash`/`shareURL` use. Save PNG redraws at an integer 10 pixels per module; quiet zone remains four modules. Readback is asynchronous, R2-F12.                                                                                                                                                                                                                                                              | [manual/share.html:253][manual/share.html:253]; [src/app.js:1768][src/app.js:1768]; [src/qr/share.js:62][src/qr/share.js:62]; [src/qr/share.js:95][src/qr/share.js:95]; [src/qr/share.js:128][src/qr/share.js:128]; [src/qr/encode.js:22][src/qr/encode.js:22]. |
| Version 40/L holds 2,953 bytes; M through version 30, L after; too long offers JSON, no multi-code split             | Verified entire-URL byte count and boundary calls: 2,953 bytes gives version 40/L; 2,954 and 3,671 are refused. Preference threshold is explicitly 30, with boost disabled.                                                                                                                                                                                                                                                                                 | [manual/share.html:257][manual/share.html:257]; [src/qr/share-code.js:7][src/qr/share-code.js:7]; [src/qr/share-code.js:14][src/qr/share-code.js:14]; [src/qr/share.js:118][src/qr/share.js:118].                                                               |
| 692–714 → version 21/M; paint examples 20/60/150 → about 1,170/2,000/3,671                                           | The version claim at the upper end is wrong, R2-F06: 711 bytes fits version 21/M, 712 needs version 22/M. The other QR mappings verify independently: 1,170 bytes gives 28/M, 2,000 gives 33/L, and 3,671 is too long. The documented historical paint lengths are example measurements, not universal lengths for a number of dabs. An illustrative seeded paint sweep gave 1,124/1,847/3,407 characters, with the same qualitative fit/overflow behavior. | [manual/share.html:262][manual/share.html:262]; [docs/handoff/QRr4.md:147][docs/handoff/QRr4.md:147]; [src/qr/share-code.js:14][src/qr/share-code.js:14].                                                                                                       |
| 15% / 7% recovery and “It scans”                                                                                     | M/L are correctly chosen, but the percentage concerns codewords rather than arbitrary squares, R2-F11. “It scans” is set only after readback text equals the URL; it is not a guarantee for every physical camera, and it appears after the dialog opens, R2-F12.                                                                                                                                                                                           | [manual/share.html:259][manual/share.html:259]; [src/qr/share.js:112][src/qr/share.js:112]; [src/qr/scan.js:40][src/qr/scan.js:40]; opened [DENSO WAVE explanation](https://www.qrcode.com/en/about/error_correction.html).                                     |
| Real codec/normalizer/QR sizing in the inline demo and all named paths                                               | Verified imports, round trip, changed-character failure/recovery, and sizing. Invalid JSON leaves a stale QR, R2-F10. Every named source, documentation, and test path exists.                                                                                                                                                                                                                                                                              | [manual/share.html:160][manual/share.html:160]; [manual/demos3.js:1][manual/demos3.js:1]; [manual/share.html:276][manual/share.html:276]; [tests/man5.spec.mjs:234][tests/man5.spec.mjs:234].                                                                   |

### Budget tables

| Claim / number                                                                  | Check / result                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Pinned evidence                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five budgets, 390×844 simulated phone, 24 views of 22 toys, Mid/High comparison | Verified the historical method: 60k, 140k, 200k, 280k, and 400k base budgets at DPR 3, mid profile, WebGL2/SwiftShader; bicycle and chess have extra close views. The table's count labels need R2-F05. This audit did not rerun the historical sweep.                                                                                                                                                                                                             | [manual/toy.html:219][manual/toy.html:219]; [docs/lab/BUDGETS.md:23][docs/lab/BUDGETS.md:23]; [docs/lab/BUDGETS.md:48][docs/lab/BUDGETS.md:48]; [tools/shp-measure.mjs:72][tools/shp-measure.mjs:72].                                                             |
| Current tiers and Detail slider                                                 | Verified low/mid/high/max default counts 60,000/140,000/200,000/280,000 and maxima 120,000/240,000/300,000/400,000. Slider range 60,000–400,000 is a base-budget input, not a guarantee of that many emitted splats.                                                                                                                                                                                                                                               | [src/generators.js:76][src/generators.js:76]; [src/player.js:85][src/player.js:85]; [src/player.js:282][src/player.js:282].                                                                                                                                       |
| Edge, speckle, shimmer, and silhouette-area definitions                         | The prose agrees with the measuring tool and recorded method: 10–90% edge rise in CSS pixels, deviation from a 3×3 median on flatter regions, fine-detail differences over rotating frames, and silhouette area relative to the same view's b400 result. The 400k reference is another rendering, not independent geometric ground truth; white/background masking and software-renderer limitations remain in the source document.                                | [manual/toy.html:227][manual/toy.html:227]; [docs/lab/BUDGETS.md:30][docs/lab/BUDGETS.md:30]; [tools/shp-measure.mjs:110][tools/shp-measure.mjs:110]; [tools/shp-measure.mjs:496][tools/shp-measure.mjs:496].                                                     |
| All 24 row values and better/same/worse colors                                  | Compared every displayed edge/speckle/shimmer pair and both area percentages with the recorded values and the generator's rounding. All agree. Counts: edge better/same/worse 20/2/2; speckle worse/better/same 21/1/2; shimmer worse/better/same 21/3/0. The generator's CLI target is broken after the split, R2-F08.                                                                                                                                            | [manual/toy.html:275][manual/toy.html:275]; [docs/lab/BUDGETS.md:59][docs/lab/BUDGETS.md:59]; [manual/build-budget.mjs:16][manual/build-budget.mjs:16]; [manual/build-budget.mjs:47][manual/build-budget.mjs:47]; [tests/man4.spec.mjs:1][tests/man4.spec.mjs:1]. |
| Five summary rows and narrative conclusions                                     | All displayed summary values match the generator/document: relative to b140, b60 is +11%/−23%/−36%/+1.2%; b200 −2%/+14%/+18%/−0.8%; b280 −6%/+31%/+39%/−0.8%; b400 −9%/+52%/+61%/−1.2%, in edge/speckle/shimmer/area order. b140 is the reference. The 21/24 speckle and shimmer increases, 14% and 18% medians, maximum 0.06-pixel edge gain, and bicycle's 18% low-budget area excess match the table. These are image metrics, not hardware frame-rate results. | [manual/toy.html:446][manual/toy.html:446]; [manual/toy.html:512][manual/toy.html:512]; [manual/toy.html:523][manual/toy.html:523]; [docs/lab/BUDGETS.md:92][docs/lab/BUDGETS.md:92]; [manual/build-budget.mjs:47][manual/build-budget.mjs:47].                   |
| Phone and desktop usability                                                     | The wide table scrolls inside its own region at 390 px, and the page itself does not overflow. At 1440 px the table fits. Keyboard-focusable region and the caption are present.                                                                                                                                                                                                                                                                                   | [manual/toy.html:255][manual/toy.html:255]; [phone](budget-390x844.jpg), [desktop](budget-1440x900.jpg).                                                                                                                                                          |

### What Splashery can do

Checked both [the manual chapter][manual/unique.html:86] and [the linked Learn
page][site/learn/can-do/index.html:142], plus the latter's generator. The manual's corrected
download/codec qualifications agree with the source. The Learn page still contains the
contradictions in R2-F04.

| Claim group                                                                                     | Check / result                                                                                                                                                                                                                     | Pinned evidence                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 319 public toys, 142 labs toys, remembered `?labs=1`, `?labs=0`, and labs badges                | Verified 461 catalog entries with shelf categories: 319 public and 142 labs. The query switch and browser preference are implemented, and the linked labs toys have labs flags. Direct scene links can still open a hidden toy.    | [site/learn/can-do/index.html:146][site/learn/can-do/index.html:146]; [src/toys.js:49][src/toys.js:49]; [src/toys.js:4368][src/toys.js:4368]; [tools/site-hubs.mjs:288][tools/site-hubs.mjs:288].                                                                                                                                                                                                                                          |
| Static browser program, no account, no automatic upload                                         | Verified the static/module architecture and local file-reading path. This does not mean every toy's data comes from a bundled file: optional outside data requests are separately described.                                       | [site/learn/can-do/index.html:158][site/learn/can-do/index.html:158]; [src/media.js:132][src/media.js:132]; [src/state.js:233][src/state.js:233]; [src/codec.js:38][src/codec.js:38].                                                                                                                                                                                                                                                      |
| Hands-on toss/bounce/soft bodies and recipe-defined separate bodies                             | Implemented, but eligible toys are limited by explicit exclusions/opt-ins. “Every toy” is wrong, R2-F04.                                                                                                                           | [site/learn/can-do/index.html:166][site/learn/can-do/index.html:166]; [src/physics/hands-on.js:66][src/physics/hands-on.js:66]; [manual/more.html:124][manual/more.html:124].                                                                                                                                                                                                                                                              |
| Hinges, pivots, sliders, morphs, GPU per-splat effects, chest/windmill                          | Verified kit motion data and shader modifier paths; the inline windmill calls the real kit. Its selected-line readout has R2-F09.                                                                                                  | [site/learn/can-do/index.html:173][site/learn/can-do/index.html:173]; [src/kit.js:1][src/kit.js:1]; [src/effects.js:1][src/effects.js:1]; [manual/demos2.js:945][manual/demos2.js:945].                                                                                                                                                                                                                                                    |
| Liquids, gases, flames                                                                          | Implemented multiple rendering paths; the one-splat-per-particle claim is wrong, R2-F04.                                                                                                                                           | [site/learn/can-do/index.html:177][site/learn/can-do/index.html:177]; [src/fluids/world.js:20][src/fluids/world.js:20]; [src/fluids/runtime.js:83][src/fluids/runtime.js:83]; [manual/more.html:211][manual/more.html:211].                                                                                                                                                                                                                |
| Keyboard instruments, own songs, MIDI, ABC, moving keys/hammers/strings                         | Verified song readers and instrument recipes/drives. Not every instrument's hardware imitation was visually audited.                                                                                                               | [site/learn/can-do/index.html:182][site/learn/can-do/index.html:182]; [src/songs.js:29][src/songs.js:29]; [src/songs.js:256][src/songs.js:256]; [src/packs/pianos.js:1][src/packs/pianos.js:1].                                                                                                                                                                                                                                            |
| Focus, Escape, F, [, G; Auto/High/Max; local Detail slider 60k–400k                             | Verified keyboard branches, profile/slider preference persistence, and absence of Detail from the normalized scene. Count wording is nominal, R2-F05.                                                                              | [site/learn/can-do/index.html:187][site/learn/can-do/index.html:187]; [src/app.js:1356][src/app.js:1356]; [src/player.js:85][src/player.js:85]; [src/state.js:303][src/state.js:303].                                                                                                                                                                                                                                                      |
| Recipes rather than captured geometry; equation u/v/t and Solid/Fine/Dots                       | Verified procedural builds and equation modes. The no-multi-megabyte-download sentence needs the manual's engine/model/capture qualification, R2-F04. Budget ranges are nominal allocations, not a minimum count for every recipe. | [manual/unique.html:95][manual/unique.html:95]; [site/learn/can-do/index.html:199][site/learn/can-do/index.html:199]; [src/player.js:581][src/player.js:581]; [src/packs/splat-equation.js:425][src/packs/splat-equation.js:425].                                                                                                                                                                                                          |
| Full scene in a link, camera/options, compression, no lookup, original files reopen             | Verified codec/export/normalization paths, as in the share chapter.                                                                                                                                                                | [manual/unique.html:118][manual/unique.html:118]; [site/learn/can-do/index.html:213][site/learn/can-do/index.html:213]; [src/codec.js:38][src/codec.js:38]; [src/exports.js:281][src/exports.js:281].                                                                                                                                                                                                                                      |
| `.ply`, `.sog`, `.splat`, `.spz`; SPZ 4 refused; licensed captures                              | Verified dispatch and SPZ version refusal. Credits live with catalog/capture metadata and the asset notices.                                                                                                                       | [site/learn/can-do/index.html:232][site/learn/can-do/index.html:232]; [src/loaders.js:12][src/loaders.js:12]; [src/loaders.js:173][src/loaders.js:173]; [src/toys.js:49][src/toys.js:49]; [CREDITS.md:1][CREDITS.md:1].                                                                                                                                                                                                                    |
| Photos and moving photos use local depth; model about 27 MB                                     | Verified same-site model/runtime imports and rebuild path. Splat mirror starts depth after its camera action; no permission prompt is requested on page load.                                                                      | [site/learn/can-do/index.html:239][site/learn/can-do/index.html:239]; [site/learn/can-do/index.html:276][site/learn/can-do/index.html:276]; [src/packs/photo-3d.js:1][src/packs/photo-3d.js:1]; [src/packs/moving-photo.js:1][src/packs/moving-photo.js:1]; [src/packs/photo-3d-depth.js:59][src/packs/photo-3d-depth.js:59]; [src/packs/live.js:401][src/packs/live.js:401].                                                              |
| glTF/GLB, OBJ/MTL, STL → surface discs; texture/vertex/material color; more samples for detail  | Verified supported model parsers and mesh-to-splat sampling/color inputs; no arbitrary model file was opened in this audit.                                                                                                        | [site/learn/can-do/index.html:244][site/learn/can-do/index.html:244]; [src/packs/studio-models-core.js:1][src/packs/studio-models-core.js:1]; [src/packs/studio-models.js:1][src/packs/studio-models.js:1].                                                                                                                                                                                                                                |
| PDF book, multiple-photo album, ordered picture-frame list                                      | Verified media PDF decoding and picture recipes/controls.                                                                                                                                                                          | [site/learn/can-do/index.html:249][site/learn/can-do/index.html:249]; [src/media.js:319][src/media.js:319]; [src/packs/pictures.js:21][src/packs/pictures.js:21].                                                                                                                                                                                                                                                                          |
| Song landscape spectrogram and Chladni plate                                                    | Verified song analysis and plate/sand recipe paths. Scientific accuracy beyond the descriptions here was not independently re-audited.                                                                                             | [site/learn/can-do/index.html:254][site/learn/can-do/index.html:254]; [src/packs/song-analysis.js:1][src/packs/song-analysis.js:1]; [src/packs/studio.js:1][src/packs/studio.js:1]; [src/packs/chladni-sand.js:1][src/packs/chladni-sand.js:1].                                                                                                                                                                                            |
| QR input formats, readback, and omitted Wi-Fi password                                          | Verified QR formatting and ephemeral password handling in the QR pack; readback has native/fallback paths.                                                                                                                         | [site/learn/can-do/index.html:259][site/learn/can-do/index.html:259]; [src/packs/qr.js:1][src/packs/qr.js:1]; [src/qr/scan.js:40][src/qr/scan.js:40].                                                                                                                                                                                                                                                                                      |
| Camera/microphone/screen require a button; Live indicator and Stop; local input                 | Verified live manager start/stop and permission calls. Explicit local recording exists, so “nothing is recorded” is wrong, R2-F04.                                                                                                 | [site/learn/can-do/index.html:269][site/learn/can-do/index.html:269]; [src/live/live.js:9][src/live/live.js:9]; [src/live/live.js:156][src/live/live.js:156]; [src/live/panel.js:1][src/live/panel.js:1]; [src/live/record.js:1][src/live/record.js:1].                                                                                                                                                                                    |
| Labs Worlds: generated places, collision, character/camera; splat and hybrid representations    | Verified World runtime and hybrid mesh paths. The conclusion that every toy remains all splats conflicts with Sharp view, R2-F04.                                                                                                  | [site/learn/can-do/index.html:283][site/learn/can-do/index.html:283]; [src/worlds/hybrid.js:1][src/worlds/hybrid.js:1]; [src/worlds/world-file.js:1][src/worlds/world-file.js:1]; [src/live/relief-mesh.js:1][src/live/relief-mesh.js:1].                                                                                                                                                                                                  |
| “Other tools … to our knowledge”; SuperSplat contrast; photos/videos/science/sky/medical inputs | The named capabilities have source modules. The SuperSplat documentation and project links were opened and respond. Both pages qualify the market comparison; this audit did not perform an exhaustive survey of competing tools.  | [manual/unique.html:88][manual/unique.html:88]; [site/learn/can-do/index.html:300][site/learn/can-do/index.html:300]; [src/packs/video3d.js:1][src/packs/video3d.js:1]; [src/packs/science.js:1][src/packs/science.js:1]; [src/packs/night-sky.js:1][src/packs/night-sky.js:1]; [src/packs/volume-viewer.js:1][src/packs/volume-viewer.js:1]; opened [SuperSplat documentation](https://developer.playcanvas.com/user-manual/supersplat/). |

## Demos

All 14 demos initialize at both requested sizes, including the nine that were placeholders in task
34 and the new share-link demo. Every manual image loads, and there is no horizontal page overflow
at either size. Long tables and code regions can scroll inside their own boxes. No uncaught page
errors or failed demo resources were observed. One fresh visit to the cover logs a 404 for the
browser's automatic `/favicon.ico` request; it is not a demo failure.

The table distinguishes interaction success from accuracy. Play was exercised where present; these
are short interaction checks, not animation benchmarks. Existing reader tests compare 60 expressions
with the production reader, and the source comparisons check the math rather than treating a
plausible picture as proof.

| Demo                | Controls / source checked                                                                                                      | 390×844                                          | 1440×900                                          | Matches its explanation?                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| gaussian-3d         | Shell weight, cloud/shell view, spin, reset, and camera drag. [manual/splat.html:176][manual/splat.html:176]                   | Pass: [screenshot](demo-gaussian-390x844.jpg).   | Pass: [screenshot](demo-gaussian-1440x900.jpg).   | Peak-one shell weights and −2 log(weight) radius agree.                           |
| splat-numbers       | Center/size/rotation/color controls, values, and reset. [manual/splat.html:311][manual/splat.html:311]                         | Pass: [screenshot](demo-numbers-390x844.jpg).    | Pass: [screenshot](demo-numbers-1440x900.jpg).    | Numeric splat attributes and rotated shell respond.                               |
| bell-1d-to-3d       | Width and point controls; axis views and 3D bell. [manual/splat.html:713][manual/splat.html:713]                               | Pass: [screenshot](demo-bell-390x844.jpg).       | Pass: [screenshot](demo-bell-1440x900.jpg).       | Quadratic exponent and weight agree; example G=0.803.                             |
| covariance-validity | Sizes/turn and typed-matrix modes, sliders, and verdict. [manual/splat.html:851][manual/splat.html:851]                        | Pass: [screenshot](demo-covariance-390x844.jpg). | Pass: [screenshot](demo-covariance-1440x900.jpg). | Original small-positive example fixed; R2-F02 remains.                            |
| projection          | Camera distance/turn/lift, splat tilt/turn/size, and view panels. [manual/splat.html:1047][manual/splat.html:1047]             | Pass: [screenshot](demo-projection-390x844.jpg). | Pass: [screenshot](demo-projection-1440x900.jpg). | First-order geometry agrees; renderer label/filter explanation has R2-F03.        |
| sort-blend          | Order and step controls; correct/wrong ordering and reset. [manual/splat.html:1239][manual/splat.html:1239]                    | Pass: [screenshot](demo-blend-390x844.jpg).      | Pass: [screenshot](demo-blend-1440x900.jpg).      | Source-over arithmetic responds; final four-splat example leaves 2.7% background. |
| windmill-parts      | Real kit build, selectable/hovered code lines, and sails slider. [manual/toy.html:708][manual/toy.html:708]                    | Pass: [screenshot](demo-windmill-390x844.jpg).   | Pass: [screenshot](demo-windmill-1440x900.jpg).   | Geometry moves correctly; selected blades/hub readout has R2-F09.                 |
| smoothstep          | Canvas touch/mouse, slider endpoints, arrows, and Play. [manual/toy.html:773][manual/toy.html:773]                             | Pass: [screenshot](demo-smoothstep-390x844.jpg). | Pass: [screenshot](demo-smoothstep-1440x900.jpg). | 3x²−2x³ values and eased turn agree.                                              |
| uv-torus            | Marked dot, u/v movement, folding, and Play. [manual/language.html:224][manual/language.html:224]                              | Pass: [screenshot](demo-uvtorus-390x844.jpg).    | Pass: [screenshot](demo-uvtorus-1440x900.jpg).    | Sheet-to-torus mapping and periodic coordinates respond.                          |
| program-fields      | All eight presets, field highlighting, editable values, build, and reset. [manual/language.html:361][manual/language.html:361] | Pass: [screenshot](demo-fields-390x844.jpg).     | Pass: [screenshot](demo-fields-1440x900.jpg).     | Uses the real compiler; geometry and highlighted field groups respond.            |
| order-of-operations | Typed expressions, u/v/t, grouping, and guard counterexamples. [manual/language.html:524][manual/language.html:524]            | Pass: [screenshot](demo-reader-390x844.jpg).     | Pass: [screenshot](demo-reader-1440x900.jpg).     | Production acceptance check and displayed grouping agree; F06/F07 fixed.          |
| grammar-railroad    | Every start-field choice, diagram links, and example navigation. [manual/language.html:644][manual/language.html:644]          | Pass: [screenshot](demo-railroad-390x844.jpg).   | Pass: [screenshot](demo-railroad-1440x900.jpg).   | Tokens/grammar diagram works; generated anchor destinations resolve.              |
| t-clock             | Five equations, counts, time scrubbing, arrows, and Play. [manual/language.html:880][manual/language.html:880]                 | Pass: [screenshot](demo-moments-390x844.jpg).    | Pass: [screenshot](demo-moments-1440x900.jpg).    | Four-second eased cycle; one-moment and hypothetical-count qualifiers fixed.      |
| share-link          | JSON edit, reset/pretty, hash edit, break/undo, normalization, and QR sizing. [manual/share.html:147][manual/share.html:147]   | Pass: [screenshot](demo-share-390x844.jpg).      | Pass: [screenshot](demo-share-1440x900.jpg).      | Real codec and QR sizing agree; invalid JSON retains a stale QR, R2-F10.          |

## Links and anchors

The rendered 18 manual documents (17 pages plus `all.html`) contain **1,011 anchor elements and 337
distinct absolute URLs**, including the dynamically generated railroad links. Checked **179 manual
fragment URLs**, all with existing targets and open ancestor folds after navigation; checked **22
distinct local file/directory targets** and **75 distinct scene links**. These category counts
overlap public/local aliases and file/fragment destinations and are not a sum of the URL total. The
capabilities page adds **61 anchor elements and 43 distinct URLs**; all same-site destinations and
fragments returned 200 and resolved. No missing destination was found.

Checked both top and bottom Previous/Next pairs against the complete order in
[manual/pages.mjs:9][manual/pages.mjs:9], including the new built/share pages and first/last-page
boundaries. Contents includes all 17 pages and all five coming chapters; touch opening, keyboard
dismissal, glossary popups, old single-page redirects, and folded fragment navigation passed the
existing suites and the browser checks. Public demo fragments resolve in the pinned local pages;
public GET checks below verify their deployed page, not a commit comparison.

### Manual fragments

The table lists every distinct file/fragment destination checked. Public and local aliases of the
same target are shown once here.

| Target page                                 | Fragments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Result                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| [all.html][manual/all.html:1]               | `#a-changed-character`, `#a-picture-toy`, `#a-scene-as-a-qr-code`, `#a-small-complete-recipe`, `#a-splat-program`, `#behaviors`, `#books-albums-and-frames`, `#built`, `#camera-microphone-and-screen`, `#captures-and-file-formats`, `#card`, `#codes`, `#colors-from-functions`, `#data`, `#experiments`, `#expressions`, `#fluids-songs-and-smooth-bodies`, `#from-3d-to-the-screen`, `#gallery`, `#gallery-60`, `#glossary`, `#hands-on-physics`, `#how-a-toy-gets-on-the-shelf`, `#how-long-a-link-can-be`, `#language`, `#later`, `#make`, `#models-to-splats`, `#more`, `#moving`, `#old-links-keep-loading`, `#one-splat`, `#outside-libraries`, `#parts-that-hinge-spin-or-slide`, `#photo3d`, `#picture-sheets-a-page-a-photo-a-gif-a-video`, `#pictures`, `#reading`, `#ref-1`, `#ref-10`, `#ref-2`, `#ref-3`, `#ref-4`, `#ref-5`, `#ref-6`, `#ref-7`, `#ref-8`, `#ref-9`, `#references`, `#rr-atom`, `#rr-bare`, `#rr-bracket`, `#rr-field`, `#rr-function`, `#rr-power`, `#rr-product`, `#rr-signed`, `#rr-simple`, `#rr-sum`, `#rr-value`, `#run-it`, `#shapes-from-the-kit`, `#share`, `#solid-fine-and-dots-and-the-detail-you-see`, `#sorting-and-blending-back-to-front`, `#splat`, `#splat-count`, `#static-files-and-modules`, `#steering-the-view-the-top-bar-and-the-tilt-lock`, `#studio-sound-and-photos`, `#the-covariance-built-from-sizes-and-a-rotation`, `#the-fields`, `#the-gaussian-a-bell-in-three-dimensions`, `#the-idea-every-splat-gets-its-own-u-and-v`, `#the-numbers-in-one-splat`, `#the-qr-code-toy`, `#the-screen-and-the-gaussian-splatting-toy`, `#the-viewer-s-controls`, `#time`, `#toy`, `#turning-a-page`, `#two-places-a-toy-lives`, `#unique`, `#what-is-in-a-link`, `#what-playcanvas-does`, `#what-the-toy-does-for-you`, `#where-the-files-are`, `#why-it-is-safe`, `#worlds`, `#your-own-input-typing-drawing-opening-a-file` | All exist; ancestor folds open. |
| [built.html][manual/built.html:1]           | `#how-a-toy-gets-on-the-shelf`, `#outside-libraries`, `#static-files-and-modules`, `#what-playcanvas-does`, `#where-the-files-are`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | All exist; ancestor folds open. |
| [card.html][manual/card.html:1]             | `#a-picture-toy`, `#a-splat-program`, `#one-splat`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | All exist; ancestor folds open. |
| [coming.html][manual/coming.html:1]         | `#codes`, `#data`, `#make`, `#moving`, `#photo3d`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | All exist; ancestor folds open. |
| [gallery.html][manual/gallery.html:1]       | `#gallery-60`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | All exist; ancestor folds open. |
| [language.html][manual/language.html:1]     | `#demo-fields`, `#demo-moments`, `#demo-railroad`, `#demo-reader`, `#demo-uvtorus`, `#expressions`, `#rr-atom`, `#rr-bare`, `#rr-bracket`, `#rr-field`, `#rr-function`, `#rr-power`, `#rr-product`, `#rr-signed`, `#rr-simple`, `#rr-sum`, `#rr-value`, `#the-fields`, `#the-idea-every-splat-gets-its-own-u-and-v`, `#time`, `#what-the-toy-does-for-you`, `#why-it-is-safe`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | All exist; ancestor folds open. |
| [more.html][manual/more.html:1]             | `#books-albums-and-frames`, `#camera-microphone-and-screen`, `#captures-and-file-formats`, `#fluids-songs-and-smooth-bodies`, `#hands-on-physics`, `#models-to-splats`, `#solid-fine-and-dots-and-the-detail-you-see`, `#studio-sound-and-photos`, `#the-qr-code-toy`, `#the-viewer-s-controls`, `#worlds`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | All exist; ancestor folds open. |
| [pictures.html][manual/pictures.html:1]     | `#picture-sheets-a-page-a-photo-a-gif-a-video`, `#steering-the-view-the-top-bar-and-the-tilt-lock`, `#the-screen-and-the-gaussian-splatting-toy`, `#turning-a-page`, `#your-own-input-typing-drawing-opening-a-file`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | All exist; ancestor folds open. |
| [references.html][manual/references.html:1] | `#ref-1`, `#ref-10`, `#ref-2`, `#ref-3`, `#ref-4`, `#ref-5`, `#ref-6`, `#ref-7`, `#ref-8`, `#ref-9`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | All exist; ancestor folds open. |
| [share.html][manual/share.html:1]           | `#a-changed-character`, `#a-scene-as-a-qr-code`, `#demo-share`, `#how-long-a-link-can-be`, `#old-links-keep-loading`, `#what-is-in-a-link`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | All exist; ancestor folds open. |
| [splat.html][manual/splat.html:1]           | `#demo-bell`, `#demo-blend`, `#demo-covariance`, `#demo-gaussian`, `#demo-numbers`, `#demo-projection`, `#from-3d-to-the-screen`, `#sorting-and-blending-back-to-front`, `#the-covariance-built-from-sizes-and-a-rotation`, `#the-gaussian-a-bell-in-three-dimensions`, `#the-numbers-in-one-splat`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | All exist; ancestor folds open. |
| [toy.html][manual/toy.html:1]               | `#a-small-complete-recipe`, `#behaviors`, `#colors-from-functions`, `#demo-smoothstep`, `#demo-windmill`, `#parts-that-hinge-spin-or-slide`, `#run-it`, `#shapes-from-the-kit`, `#splat-count`, `#two-places-a-toy-lives`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | All exist; ancestor folds open. |

### File and directory destinations

The following same-site targets exist in the pinned checkout. The capabilities page's toy-page
destinations were also requested over HTTP and returned 200. Links into repository documents are
additionally covered by the external GET table.

`/`, `/manual/all.html`, `/manual/built.html`, `/manual/card.html`, `/manual/coming.html`,
`/manual/example-recipe.js`, `/manual/experiments.html`, `/manual/gallery.html`,
`/manual/glossary.html`, `/manual/index.html`, `/manual/language.html`, `/manual/later.html`,
`/manual/more.html`, `/manual/pictures.html`, `/manual/reading.html`, `/manual/references.html`,
`/manual/share.html`, `/manual/splat.html`, `/manual/tinkerers-manual.pdf`, `/manual/toy.html`,
`/manual/unique.html`, `/site/learn/can-do/`.

### Gallery links and programs

All 75 links target the public Playground in a new tab with `rel="noopener"`, decode to
`splat-equation`, and carry the printed custom program or the effective built-in preset. Compared
every printed field with decoded/effective options, compiled with the production reader, and loaded
all 75 at each viewport. Labs started off: direct links work, while the ordinary shelf hides the
labs toy. Every card now carries a labs note. Each run had matching options, a nonempty buffer
(minimum observed count 200), and no uncaught page error.

This proves program identity, parsing, and initialization; it is not a proof of every named curve's
topology. The five task 34 gallery-description corrections are checked algebraically above. The PDF
column means every line of that card's program and its scene-link annotation are present in both
PDFs.

| #   | Card / preset               | Pinned link source                                   | 390×844 | 1440×900 | Program / PDF    |
| --- | --------------------------- | ---------------------------------------------------- | ------- | -------- | ---------------- |
| 1   | Sphere                      | [manual/gallery.html:117][manual/gallery.html:117]   | Pass.   | Pass.    | Match; complete. |
| 2   | Torus                       | [manual/gallery.html:142][manual/gallery.html:142]   | Pass.   | Pass.    | Match; complete. |
| 3   | Möbius strip                | [manual/gallery.html:167][manual/gallery.html:167]   | Pass.   | Pass.    | Match; complete. |
| 4   | Seashell                    | [manual/gallery.html:192][manual/gallery.html:192]   | Pass.   | Pass.    | Match; complete. |
| 5   | Trefoil knot                | [manual/gallery.html:217][manual/gallery.html:217]   | Pass.   | Pass.    | Match; complete. |
| 6   | Wave                        | [manual/gallery.html:241][manual/gallery.html:241]   | Pass.   | Pass.    | Match; complete. |
| 7   | Spiral galaxy               | [manual/gallery.html:269][manual/gallery.html:269]   | Pass.   | Pass.    | Match; complete. |
| 8   | Klein bottle (figure eight) | [manual/gallery.html:294][manual/gallery.html:294]   | Pass.   | Pass.    | Match; complete. |
| 9   | Hello, circle               | [manual/gallery.html:315][manual/gallery.html:315]   | Pass.   | Pass.    | Match; complete. |
| 10  | Bouncing spring             | [manual/gallery.html:336][manual/gallery.html:336]   | Pass.   | Pass.    | Match; complete. |
| 11  | Beating heart               | [manual/gallery.html:360][manual/gallery.html:360]   | Pass.   | Pass.    | Match; complete. |
| 12  | Rainbow ribbon              | [manual/gallery.html:387][manual/gallery.html:387]   | Pass.   | Pass.    | Match; complete. |
| 13  | Firework                    | [manual/gallery.html:413][manual/gallery.html:413]   | Pass.   | Pass.    | Match; complete. |
| 14  | Opening flower              | [manual/gallery.html:435][manual/gallery.html:435]   | Pass.   | Pass.    | Match; complete. |
| 15  | Vase (no t)                 | [manual/gallery.html:460][manual/gallery.html:460]   | Pass.   | Pass.    | Match; complete. |
| 16  | Spun sphere                 | [manual/gallery.html:511][manual/gallery.html:511]   | Pass.   | Pass.    | Match; complete. |
| 17  | Rainbow torus               | [manual/gallery.html:547][manual/gallery.html:547]   | Pass.   | Pass.    | Match; complete. |
| 18  | Möbius ribbon               | [manual/gallery.html:583][manual/gallery.html:583]   | Pass.   | Pass.    | Match; complete. |
| 19  | Figure-eight Klein bottle   | [manual/gallery.html:624][manual/gallery.html:624]   | Pass.   | Pass.    | Match; complete. |
| 20  | Pseudosphere                | [manual/gallery.html:663][manual/gallery.html:663]   | Pass.   | Pass.    | Match; complete. |
| 21  | Enneper surface             | [manual/gallery.html:699][manual/gallery.html:699]   | Pass.   | Pass.    | Match; complete. |
| 22  | Catenoid                    | [manual/gallery.html:738][manual/gallery.html:738]   | Pass.   | Pass.    | Match; complete. |
| 23  | Helicoid                    | [manual/gallery.html:774][manual/gallery.html:774]   | Pass.   | Pass.    | Match; complete. |
| 24  | Dini surface                | [manual/gallery.html:810][manual/gallery.html:810]   | Pass.   | Pass.    | Match; complete. |
| 25  | Shell growth                | [manual/gallery.html:849][manual/gallery.html:849]   | Pass.   | Pass.    | Match; complete. |
| 26  | Lissajous knot              | [manual/gallery.html:890][manual/gallery.html:890]   | Pass.   | Pass.    | Match; complete. |
| 27  | Trefoil tube                | [manual/gallery.html:929][manual/gallery.html:929]   | Pass.   | Pass.    | Match; complete. |
| 28  | Cinquefoil knot             | [manual/gallery.html:965][manual/gallery.html:965]   | Pass.   | Pass.    | Match; complete. |
| 29  | Rose curve beads            | [manual/gallery.html:1005][manual/gallery.html:1005] | Pass.   | Pass.    | Match; complete. |
| 30  | Trefoil knot beads          | [manual/gallery.html:1047][manual/gallery.html:1047] | Pass.   | Pass.    | Match; complete. |
| 31  | Double helix                | [manual/gallery.html:1084][manual/gallery.html:1084] | Pass.   | Pass.    | Match; complete. |
| 32  | Slinky coil                 | [manual/gallery.html:1120][manual/gallery.html:1120] | Pass.   | Pass.    | Match; complete. |
| 33  | Lorenz-like look-alike      | [manual/gallery.html:1156][manual/gallery.html:1156] | Pass.   | Pass.    | Match; complete. |
| 34  | Rössler-like look-alike     | [manual/gallery.html:1191][manual/gallery.html:1191] | Pass.   | Pass.    | Match; complete. |
| 35  | Five-petal flower           | [manual/gallery.html:1224][manual/gallery.html:1224] | Pass.   | Pass.    | Match; complete. |
| 36  | Sunflower-style spiral      | [manual/gallery.html:1270][manual/gallery.html:1270] | Pass.   | Pass.    | Match; complete. |
| 37  | Nautilus coil               | [manual/gallery.html:1306][manual/gallery.html:1306] | Pass.   | Pass.    | Match; complete. |
| 38  | Jellyfish bell              | [manual/gallery.html:1342][manual/gallery.html:1342] | Pass.   | Pass.    | Match; complete. |
| 39  | Coral fan                   | [manual/gallery.html:1378][manual/gallery.html:1378] | Pass.   | Pass.    | Match; complete. |
| 40  | Pinecone spiral             | [manual/gallery.html:1414][manual/gallery.html:1414] | Pass.   | Pass.    | Match; complete. |
| 41  | Sea anemone                 | [manual/gallery.html:1450][manual/gallery.html:1450] | Pass.   | Pass.    | Match; complete. |
| 42  | Fern frond                  | [manual/gallery.html:1486][manual/gallery.html:1486] | Pass.   | Pass.    | Match; complete. |
| 43  | Dahlia bloom                | [manual/gallery.html:1522][manual/gallery.html:1522] | Pass.   | Pass.    | Match; complete. |
| 44  | Sea fan branches            | [manual/gallery.html:1558][manual/gallery.html:1558] | Pass.   | Pass.    | Match; complete. |
| 45  | Lily pad                    | [manual/gallery.html:1594][manual/gallery.html:1594] | Pass.   | Pass.    | Match; complete. |
| 46  | Traveling wave              | [manual/gallery.html:1637][manual/gallery.html:1637] | Pass.   | Pass.    | Match; complete. |
| 47  | Breathing torus             | [manual/gallery.html:1673][manual/gallery.html:1673] | Pass.   | Pass.    | Match; complete. |
| 48  | Rotating saddle             | [manual/gallery.html:1709][manual/gallery.html:1709] | Pass.   | Pass.    | Match; complete. |
| 49  | Orbit with a fast wave      | [manual/gallery.html:1751][manual/gallery.html:1751] | Pass.   | Pass.    | Match; complete. |
| 50  | Opening flower              | [manual/gallery.html:1790][manual/gallery.html:1790] | Pass.   | Pass.    | Match; complete. |
| 51  | Breathing bumpy sphere      | [manual/gallery.html:1829][manual/gallery.html:1829] | Pass.   | Pass.    | Match; complete. |
| 52  | Twisting ribbon             | [manual/gallery.html:1865][manual/gallery.html:1865] | Pass.   | Pass.    | Match; complete. |
| 53  | Pulsing star                | [manual/gallery.html:1904][manual/gallery.html:1904] | Pass.   | Pass.    | Match; complete. |
| 54  | Wobbling helix              | [manual/gallery.html:1940][manual/gallery.html:1940] | Pass.   | Pass.    | Match; complete. |
| 55  | Standing wave               | [manual/gallery.html:1976][manual/gallery.html:1976] | Pass.   | Pass.    | Match; complete. |
| 56  | Height hue bands            | [manual/gallery.html:2017][manual/gallery.html:2017] | Pass.   | Pass.    | Match; complete. |
| 57  | Angle around the torus      | [manual/gallery.html:2055][manual/gallery.html:2055] | Pass.   | Pass.    | Match; complete. |
| 58  | Curvature-like bands        | [manual/gallery.html:2093][manual/gallery.html:2093] | Pass.   | Pass.    | Match; complete. |
| 59  | RGB sunset gradient         | [manual/gallery.html:2134][manual/gallery.html:2134] | Pass.   | Pass.    | Match; complete. |
| 60  | Rainbow shell               | [manual/gallery.html:2173][manual/gallery.html:2173] | Pass.   | Pass.    | Match; complete. |
| 61  | Blue-green sphere           | [manual/gallery.html:2211][manual/gallery.html:2211] | Pass.   | Pass.    | Match; complete. |
| 62  | Klein bottle color flow     | [manual/gallery.html:2249][manual/gallery.html:2249] | Pass.   | Pass.    | Match; complete. |
| 63  | Plasma RGB sheet            | [manual/gallery.html:2287][manual/gallery.html:2287] | Pass.   | Pass.    | Match; complete. |
| 64  | Longitude stripes           | [manual/gallery.html:2326][manual/gallery.html:2326] | Pass.   | Pass.    | Match; complete. |
| 65  | Rainbow wave                | [manual/gallery.html:2362][manual/gallery.html:2362] | Pass.   | Pass.    | Match; complete. |
| 66  | Thermal spiral              | [manual/gallery.html:2404][manual/gallery.html:2404] | Pass.   | Pass.    | Match; complete. |
| 67  | Hopf link                   | [manual/gallery.html:2444][manual/gallery.html:2444] | Pass.   | Pass.    | Match; complete. |
| 68  | Fourier epicycle curve      | [manual/gallery.html:2480][manual/gallery.html:2480] | Pass.   | Pass.    | Match; complete. |
| 69  | Superquadric                | [manual/gallery.html:2519][manual/gallery.html:2519] | Pass.   | Pass.    | Match; complete. |
| 70  | Riemann branch look         | [manual/gallery.html:2557][manual/gallery.html:2557] | Pass.   | Pass.    | Match; complete. |
| 71  | Monkey saddle               | [manual/gallery.html:2596][manual/gallery.html:2596] | Pass.   | Pass.    | Match; complete. |
| 72  | Spherical harmonic lobes    | [manual/gallery.html:2635][manual/gallery.html:2635] | Pass.   | Pass.    | Match; complete. |
| 73  | Lemniscate tube             | [manual/gallery.html:2674][manual/gallery.html:2674] | Pass.   | Pass.    | Match; complete. |
| 74  | Gyroid slice                | [manual/gallery.html:2716][manual/gallery.html:2716] | Pass.   | Pass.    | Match; complete. |
| 75  | Torus knot family           | [manual/gallery.html:2752][manual/gallery.html:2752] | Pass.   | Pass.    | Match; complete. |

### External GET checks

After removing fragments, there are **65 distinct external HTTP(S) resource URLs** in the manual.
Every one was opened with GET; **64 returned 200 and one returned 403**. Redirects were followed.
The root Playground GET covers the 75 scene URLs as an HTTP resource, while decoding and runtime
behavior were checked separately above. The four chapter URLs cover the 14 absolute demo fragments.
Outside facts used additionally in this report were opened too, including DENSO WAVE's
error-correction explanation and PlayCanvas's
[SuperSplat documentation](https://developer.playcanvas.com/user-manual/supersplat/).

The DOI response is environment-specific, not proof of a permanently dead link. The adjacent
author-hosted Porter and Duff paper returned 200, so the reference is accessible without the DOI.
External pages can change after the audit.

| Destination                                                                                                                                    | GET result                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [anttwo.github.io/sugar/](https://anttwo.github.io/sugar/)                                                                                     | 200.                                   |
| [arxiv.org/pdf/2308.04079](https://arxiv.org/pdf/2308.04079)                                                                                   | 200.                                   |
| [doi.org/10.1145/964965.808606](https://doi.org/10.1145/964965.808606)                                                                         | 403; author-hosted alternative is 200. |
| [en.wikipedia.org/wiki/Affine_transformation](https://en.wikipedia.org/wiki/Affine_transformation)                                             | 200.                                   |
| [en.wikipedia.org/wiki/Catenoid](https://en.wikipedia.org/wiki/Catenoid)                                                                       | 200.                                   |
| [en.wikipedia.org/wiki/Coral](https://en.wikipedia.org/wiki/Coral)                                                                             | 200.                                   |
| [en.wikipedia.org/wiki/Curvature](https://en.wikipedia.org/wiki/Curvature)                                                                     | 200.                                   |
| [en.wikipedia.org/wiki/DNA](https://en.wikipedia.org/wiki/DNA)                                                                                 | 200.                                   |
| [en.wikipedia.org/wiki/Dini's_surface](https://en.wikipedia.org/wiki/Dini%27s_surface)                                                         | 200.                                   |
| [en.wikipedia.org/wiki/Enneper_surface](https://en.wikipedia.org/wiki/Enneper_surface)                                                         | 200.                                   |
| [en.wikipedia.org/wiki/Extended_Backus–Naur_form](https://en.wikipedia.org/wiki/Extended_Backus%E2%80%93Naur_form)                             | 200.                                   |
| [en.wikipedia.org/wiki/Fern](https://en.wikipedia.org/wiki/Fern)                                                                               | 200.                                   |
| [en.wikipedia.org/wiki/Flower](https://en.wikipedia.org/wiki/Flower)                                                                           | 200.                                   |
| [en.wikipedia.org/wiki/Fourier_series](https://en.wikipedia.org/wiki/Fourier_series)                                                           | 200.                                   |
| [en.wikipedia.org/wiki/Gyroid](https://en.wikipedia.org/wiki/Gyroid)                                                                           | 200.                                   |
| [en.wikipedia.org/wiki/Helicoid](https://en.wikipedia.org/wiki/Helicoid)                                                                       | 200.                                   |
| [en.wikipedia.org/wiki/Helix](https://en.wikipedia.org/wiki/Helix)                                                                             | 200.                                   |
| [en.wikipedia.org/wiki/Hopf_link](https://en.wikipedia.org/wiki/Hopf_link)                                                                     | 200.                                   |
| [en.wikipedia.org/wiki/Jellyfish](https://en.wikipedia.org/wiki/Jellyfish)                                                                     | 200.                                   |
| [en.wikipedia.org/wiki/Klein_bottle](https://en.wikipedia.org/wiki/Klein_bottle)                                                               | 200.                                   |
| [en.wikipedia.org/wiki/Lemniscate_of_Bernoulli](https://en.wikipedia.org/wiki/Lemniscate_of_Bernoulli)                                         | 200.                                   |
| [en.wikipedia.org/wiki/Lissajous_curve](https://en.wikipedia.org/wiki/Lissajous_curve)                                                         | 200.                                   |
| [en.wikipedia.org/wiki/Möbius_strip](https://en.wikipedia.org/wiki/M%C3%B6bius_strip)                                                          | 200.                                   |
| [en.wikipedia.org/wiki/Monkey_saddle](https://en.wikipedia.org/wiki/Monkey_saddle)                                                             | 200.                                   |
| [en.wikipedia.org/wiki/Multivariate_normal_distribution](https://en.wikipedia.org/wiki/Multivariate_normal_distribution)                       | 200.                                   |
| [en.wikipedia.org/wiki/Nautilus](https://en.wikipedia.org/wiki/Nautilus)                                                                       | 200.                                   |
| [en.wikipedia.org/wiki/Parametric_equation](https://en.wikipedia.org/wiki/Parametric_equation)                                                 | 200.                                   |
| [en.wikipedia.org/wiki/Parametric_surface](https://en.wikipedia.org/wiki/Parametric_surface)                                                   | 200.                                   |
| [en.wikipedia.org/wiki/Phyllotaxis](https://en.wikipedia.org/wiki/Phyllotaxis)                                                                 | 200.                                   |
| [en.wikipedia.org/wiki/Pseudosphere](https://en.wikipedia.org/wiki/Pseudosphere)                                                               | 200.                                   |
| [en.wikipedia.org/wiki/Quadratic_form](https://en.wikipedia.org/wiki/Quadratic_form)                                                           | 200.                                   |
| [en.wikipedia.org/wiki/RGB_color_model](https://en.wikipedia.org/wiki/RGB_color_model)                                                         | 200.                                   |
| [en.wikipedia.org/wiki/Ribbon\_(mathematics)](<https://en.wikipedia.org/wiki/Ribbon_(mathematics)>)                                            | 200.                                   |
| [en.wikipedia.org/wiki/Riemann_surface](https://en.wikipedia.org/wiki/Riemann_surface)                                                         | 200.                                   |
| [en.wikipedia.org/wiki/Rose\_(mathematics)](<https://en.wikipedia.org/wiki/Rose_(mathematics)>)                                                | 200.                                   |
| [en.wikipedia.org/wiki/Saddle_surface](https://en.wikipedia.org/wiki/Saddle_surface)                                                           | 200.                                   |
| [en.wikipedia.org/wiki/Sea_anemone](https://en.wikipedia.org/wiki/Sea_anemone)                                                                 | 200.                                   |
| [en.wikipedia.org/wiki/Sea_fan](https://en.wikipedia.org/wiki/Sea_fan)                                                                         | 200.                                   |
| [en.wikipedia.org/wiki/Seashell](https://en.wikipedia.org/wiki/Seashell)                                                                       | 200.                                   |
| [en.wikipedia.org/wiki/Smoothstep](https://en.wikipedia.org/wiki/Smoothstep)                                                                   | 200.                                   |
| [en.wikipedia.org/wiki/Sphere](https://en.wikipedia.org/wiki/Sphere)                                                                           | 200.                                   |
| [en.wikipedia.org/wiki/Spherical_harmonics](https://en.wikipedia.org/wiki/Spherical_harmonics)                                                 | 200.                                   |
| [en.wikipedia.org/wiki/Spiral](https://en.wikipedia.org/wiki/Spiral)                                                                           | 200.                                   |
| [en.wikipedia.org/wiki/Standing_wave](https://en.wikipedia.org/wiki/Standing_wave)                                                             | 200.                                   |
| [en.wikipedia.org/wiki/Star_polygon](https://en.wikipedia.org/wiki/Star_polygon)                                                               | 200.                                   |
| [en.wikipedia.org/wiki/Superquadrics](https://en.wikipedia.org/wiki/Superquadrics)                                                             | 200.                                   |
| [en.wikipedia.org/wiki/Torus](https://en.wikipedia.org/wiki/Torus)                                                                             | 200.                                   |
| [en.wikipedia.org/wiki/Torus_knot](https://en.wikipedia.org/wiki/Torus_knot)                                                                   | 200.                                   |
| [en.wikipedia.org/wiki/Trefoil_knot](https://en.wikipedia.org/wiki/Trefoil_knot)                                                               | 200.                                   |
| [en.wikipedia.org/wiki/Water_lily](https://en.wikipedia.org/wiki/Water_lily)                                                                   | 200.                                   |
| [en.wikipedia.org/wiki/Wave](https://en.wikipedia.org/wiki/Wave)                                                                               | 200.                                   |
| [github.com/ryanjosephkamp/splashery](https://github.com/ryanjosephkamp/splashery)                                                             | 200.                                   |
| [github.com/ryanjosephkamp/splashery/blob/main/docs/PACKS.md](https://github.com/ryanjosephkamp/splashery/blob/main/docs/PACKS.md)             | 200.                                   |
| [github.com/ryanjosephkamp/splashery/blob/main/docs/lab/BUDGETS.md](https://github.com/ryanjosephkamp/splashery/blob/main/docs/lab/BUDGETS.md) | 200.                                   |
| [keithp.com/~keithp/porterduff/p253-porter.pdf](https://keithp.com/~keithp/porterduff/p253-porter.pdf)                                         | 200.                                   |
| [niujinshuchong.github.io/mip-splatting/](https://niujinshuchong.github.io/mip-splatting/)                                                     | 200.                                   |
| [playcanvas.com/](https://playcanvas.com/)                                                                                                     | 200.                                   |
| [repo-sam.inria.fr/fungraph/3d-gaussian-splatting/](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)                                 | 200.                                   |
| [ryanjosephkamp.github.io/splashery/](https://ryanjosephkamp.github.io/splashery/)                                                             | 200.                                   |
| [ryanjosephkamp.github.io/splashery/manual/language.html](https://ryanjosephkamp.github.io/splashery/manual/language.html)                     | 200.                                   |
| [ryanjosephkamp.github.io/splashery/manual/share.html](https://ryanjosephkamp.github.io/splashery/manual/share.html)                           | 200.                                   |
| [ryanjosephkamp.github.io/splashery/manual/splat.html](https://ryanjosephkamp.github.io/splashery/manual/splat.html)                           | 200.                                   |
| [ryanjosephkamp.github.io/splashery/manual/toy.html](https://ryanjosephkamp.github.io/splashery/manual/toy.html)                               | 200.                                   |
| [surfsplatting.github.io/](https://surfsplatting.github.io/)                                                                                   | 200.                                   |
| [www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf](https://www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf) | 200.                                   |

## PDF rebuild and contents

Rebuilt into an ignored audit workspace, keeping `manual/tinkerers-manual.pdf` unchanged:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium \
  node tools/manual-pdf.mjs .cache/audit35/rebuilt.pdf --allow-other-browser
```

The builder pins Chromium major **141** and refuses 151 without that override
([tools/manual-pdf.mjs:34][tools/manual-pdf.mjs:34]). No Chromium 141 binary is available in this
environment. The 90-test run includes two override builds with identical bytes; comparison against
the shipped PDF is conditional on Chromium 141, so that comparison did not run here
([tests/man5.spec.mjs:201][tests/man5.spec.mjs:201]).

| File                                  | Pages | Bytes     | SHA-256                                                            |
| ------------------------------------- | ----- | --------- | ------------------------------------------------------------------ |
| Shipped `manual/tinkerers-manual.pdf` | 95    | 7,659,812 | `f4b25f3e4f3bab03ae33cf52ba648773c42a7dfac5e6362153947bc5bff82be2` |
| Rebuilt with Chromium 151 override    | 94    | 7,155,965 | `db83ec00d4ef57eed6c3b5d6c72c54fc50ae85503a4a833546f7e757fbfa99d5` |

Extracted text and link annotations with PyMuPDF, compared every line of all 75 printed programs,
matched the 104 distinct HTML raster images to all 104 PDF raster-image objects using their image
data/composited thumbnails, and inspected rendered contact sheets covering every page of both files.
Transparent WebP thumbnails are composited in the PDF, so their raw hashes do not equal the source
file hashes; all 60 have separate matching PDF objects. All 27 figure captions are present in each
file. Figures 1–3 are visible, as are all 14 demo stills, all 75 gallery images/programs, and the
remaining illustrative photos and screenshots.

| Chapter / section                                               | Shipped start page | Rebuilt start page | Contents                                                                                                                   |
| --------------------------------------------------------------- | ------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Cover and contents                                              | 1                  | 1                  | Both complete.                                                                                                             |
| Chapter 1: What a splat is                                      | 4                  | 4                  | Both complete.                                                                                                             |
| Chapter 2: How a toy is built                                   | 19                 | 18                 | Both complete, including both budget tables.                                                                               |
| Chapter 3: The splat equation language                          | 29                 | 28                 | Both complete.                                                                                                             |
| Chapter 4: A gallery of programs                                | 41                 | 40                 | All 75 programs and Run links in both.                                                                                     |
| Chapter 5: Pictures, screens, and your own input                | 64                 | 63                 | Both complete.                                                                                                             |
| Chapters 6–7: Moving things; Real data as splats                | 72                 | 71                 | Both contain the explicitly unfinished headings/notes.                                                                     |
| Chapters 8–10: Photos and video; Codes and pages; Make your own | 73                 | 72                 | Both contain the explicitly unfinished headings/notes.                                                                     |
| What else Splashery does now                                    | 74                 | 73                 | Both complete.                                                                                                             |
| What Splashery can do that other splat tools can't              | 78                 | 77                 | Both complete.                                                                                                             |
| How Splashery is built                                          | 79                 | 78                 | Both complete, including all 15 library rows. [Shipped](pdf-shipped-79.png), [rebuilt](pdf-rebuilt-78.png).                |
| Share links and QR codes                                        | 85                 | 84                 | Both complete, including the QR still on the following page. [Shipped](pdf-shipped-85.png), [rebuilt](pdf-rebuilt-84.png). |
| Open questions                                                  | 89                 | 88                 | Both complete.                                                                                                             |
| What comes later: Code a toy                                    | 90                 | 89                 | Both complete.                                                                                                             |
| Glossary                                                        | 91                 | 90                 | Both present; override drops the affine arrow as described below.                                                          |
| Further reading                                                 | 93                 | 92                 | Both complete.                                                                                                             |
| References                                                      | 94                 | 93                 | Both complete.                                                                                                             |
| Quick reference                                                 | 95                 | 94                 | Both complete.                                                                                                             |

Figures 1, 2, and 3 start on shipped pages 6, 18, and 38, and rebuilt pages 6, 17, and 37. The
shipped gallery is readable at the builder's small printed program size;
[page 52](pdf-shipped-52.png) shows the corrected rose and trefoil descriptions alongside the full
programs and Run links. [Rebuilt page 51](pdf-rebuilt-51.png) retains them.

**No annotation URI contains `localhost` or `127.0.0.1` in either PDF.** The example download
targets `https://ryanjosephkamp.github.io/splashery/manual/example-recipe.js`. Both PDFs have the
same set of **152 distinct external URI targets**, including **75 distinct scene links**. The
annotation rectangle counts differ (186 shipped, 176 rebuilt) because pagination/line wrapping
changes; no unique URI target is lost. All 87 internal-link annotations resolve to named
destinations in both PDFs; all 79 named destinations point to valid pages. The local-server address
in the tutorial is intentional plain text, not a distributed localhost link.

The shipped glossary's “p ↦ Ap + b” is intact. In the Chromium 151 override, ↦ is absent visually
and extracts as a null character: [shipped page 91](pdf-shipped-91.png),
[rebuilt page 90](pdf-rebuilt-90.png). This is the already documented unsupported-browser difference
behind the 141 pin, not evidence that the shipped PDF is stale. Cross-machine fonts and an exact
Chromium 141 rebuild remain unverified. The builder normalizes PDF dates and structure-element
counters ([tools/manual-pdf.mjs:84][tools/manual-pdf.mjs:84]).

## Other task 34 findings

Task 34 actually has F01–F31. The requested F01–F16 disposition is above; these additional rows
cover its remaining findings so they are not silently omitted. Status includes the newly requested
linked capabilities page where it repeats a manual claim. These rows do not add to the 14 R2
findings.

| ID  | Status       | Evidence / qualification                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F17 | Partly fixed | [manual/more.html:211][manual/more.html:211] now explains four CPU splats per liquid particle, WebGPU surfaces, and the gas grid. The capabilities page still says one per particle, R2-F04.                                                                                                                                                                                                                                         |
| F18 | Partly fixed | [manual/more.html:164][manual/more.html:164] now permits recording after Record, kept locally. The capabilities page still says nothing is recorded, R2-F04.                                                                                                                                                                                                                                                                         |
| F19 | Partly fixed | [manual/more.html:128][manual/more.html:128] says most toys and lists exclusions/opt-ins. The capabilities page still says every toy, R2-F04.                                                                                                                                                                                                                                                                                        |
| F20 | Fixed        | [manual/experiments.html:110][manual/experiments.html:110] marks Detail, Glossy, 12–15 moments, and 240-character fields as built. Real-phone sweeps remain open. [src/player.js:85][src/player.js:85], [src/effects.js:1895][src/effects.js:1895], and [docs/lab/BUDGETS.md:23][docs/lab/BUDGETS.md:23] agree.                                                                                                                      |
| F21 | Fixed        | [tools/manual-pdf.mjs:58][tools/manual-pdf.mjs:58] rewrites file links to the public base; neither PDF has a localhost URI. The example download is public.                                                                                                                                                                                                                                                                          |
| F22 | Partly fixed | Chromium major 141 is now enforced and two same-browser builds have identical bytes, [tools/manual-pdf.mjs:34][tools/manual-pdf.mjs:34] and [tests/man5.spec.mjs:201][tests/man5.spec.mjs:201]. The shipped glyph is intact. Exact browser/font reproduction on this machine is unavailable, and the permitted 151 override still drops ↦. Required fonts and exact cross-machine reproduction are not established by the major pin. |
| F23 | Fixed        | [manual/splat.html:1009][manual/splat.html:1009] now says “usually” and explains equal-width axes. Covariance construction agrees with [manual/demo-math.js:9][manual/demo-math.js:9].                                                                                                                                                                                                                                               |
| F24 | Fixed        | [manual/demos.js:83][manual/demos.js:83] shows signed eigenvalues and explains why a negative squared size has no real size, rather than printing NaN. The new trace-zero example demonstrates this corrected readout even though its validity verdict has R2-F02.                                                                                                                                                                   |
| F25 | Fixed        | [manual/language.html:781][manual/language.html:781] correctly describes target displacement, 12-bit components, ±2 range, and the half-step bound only within range. [src/kit.js:945][src/kit.js:945] and [src/effects.js:788][src/effects.js:788] agree.                                                                                                                                                                           |
| F26 | Fixed        | [manual/language.html:976][manual/language.html:976] distinguishes NaN→0, +∞→1, and −∞→0, matching [src/packs/splat-equation.js:530][src/packs/splat-equation.js:530].                                                                                                                                                                                                                                                               |
| F27 | Fixed        | [manual/splat.html:1366][manual/splat.html:1366] qualifies abstract channel blending and encoded versus linear-light values. The 0.37 source-over calculation remains correct in a consistent blending space.                                                                                                                                                                                                                        |
| F28 | Partly fixed | [manual/unique.html:95][manual/unique.html:95] updates the tier range and qualifies engine/model/capture downloads. The capabilities copy lacks that qualification, R2-F04; exact count labels also have R2-F05.                                                                                                                                                                                                                     |
| F29 | Fixed        | [manual/unique.html:122][manual/unique.html:122] and the share chapter say raw deflate, `d.`, and base64url `j.` fallback, matching [src/codec.js:29][src/codec.js:29] and [src/codec.js:38][src/codec.js:38].                                                                                                                                                                                                                       |
| F30 | Fixed        | [manual/references.html:110][manual/references.html:110] adds the author-hosted paper. DOI GET still returns 403 here; the adjacent alternative returns 200.                                                                                                                                                                                                                                                                         |
| F31 | Fixed        | [manual/gallery.html:95][manual/gallery.html:95] introduces the labs status, and all 75 cards carry a labs note. Actual direct links work with labs off at both sizes; [src/toys.js:4368][src/toys.js:4368] documents this behavior.                                                                                                                                                                                                 |

## Limits of this audit

- The requested viewports are browser contexts, not physical phones. No real-phone performance
  conclusion, Safari/Firefox run, WebGPU hardware comparison, camera permission test, neural-model
  execution, medical-file conversion, or exhaustive competing-tool survey is claimed.
- The historical budget metrics and paint/clay link lengths are checked against their documents,
  generator, and code. The budget sweep was not rerun; small illustrative link/QR calculations use
  fixed inputs and are identified as such.
- All gallery programs were decoded, compiled, and initialized, but not exhaustively sampled through
  every animation phase for self-intersections, numerical conditioning, or topology.
- External GET results and the Pages API are time-specific. A 200 response proves access, not that
  an outside source will remain unchanged. Public demo fragment identity was checked against the
  pinned checkout; deployed content was not compared byte for byte.
- Chromium 141 and its font environment are unavailable here. The override rebuild verifies
  completeness and links, while its pagination/glyph differences prevent claiming a bit-for-bit
  reproduction of the shipped PDF.
- The existing 90 manual tests passed. The full application suite and the separate 30-MB embed smoke
  test were not run for this report-only change. Audit scripts, logs, and the rebuilt PDF stayed in
  the ignored workspace; the reviewable evidence is this report, its reproducible commands/inputs,
  pinned sources, and adjacent screenshots.

[CLAUDE.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/CLAUDE.md#L1
[CREDITS.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/CREDITS.md#L1
[LICENSES.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/LICENSES.md#L1
[LICENSES.md:136]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/LICENSES.md#L136
[LICENSES.md:169]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/LICENSES.md#L169
[LICENSES.md:284]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/LICENSES.md#L284
[docs/SCENE-SCHEMA.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/SCENE-SCHEMA.md#L1
[docs/audits/manual-audit-2026-10/REPORT.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/audits/manual-audit-2026-10/REPORT.md#L1
[docs/handoff/ManualR5.md:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/handoff/ManualR5.md#L1
[docs/handoff/QRr4.md:147]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/handoff/QRr4.md#L147
[docs/lab/BUDGETS.md:23]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/lab/BUDGETS.md#L23
[docs/lab/BUDGETS.md:30]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/lab/BUDGETS.md#L30
[docs/lab/BUDGETS.md:48]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/lab/BUDGETS.md#L48
[docs/lab/BUDGETS.md:50]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/lab/BUDGETS.md#L50
[docs/lab/BUDGETS.md:59]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/lab/BUDGETS.md#L59
[docs/lab/BUDGETS.md:92]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/docs/lab/BUDGETS.md#L92
[index.html:27]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/index.html#L27
[index.html:35]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/index.html#L35
[manual/all.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/all.html#L1
[manual/build-budget.mjs:12]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/build-budget.mjs#L12
[manual/build-budget.mjs:149]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/build-budget.mjs#L149
[manual/build-budget.mjs:16]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/build-budget.mjs#L16
[manual/build-budget.mjs:47]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/build-budget.mjs#L47
[manual/built.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L1
[manual/built.html:112]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L112
[manual/built.html:119]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L119
[manual/built.html:131]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L131
[manual/built.html:137]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L137
[manual/built.html:160]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L160
[manual/built.html:208]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L208
[manual/built.html:248]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L248
[manual/built.html:273]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L273
[manual/built.html:315]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L315
[manual/built.html:331]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L331
[manual/built.html:410]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L410
[manual/built.html:417]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L417
[manual/built.html:455]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L455
[manual/built.html:459]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L459
[manual/built.html:475]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/built.html#L475
[manual/card.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/card.html#L1
[manual/card.html:108]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/card.html#L108
[manual/coming.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/coming.html#L1
[manual/demo-math.js:22]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demo-math.js#L22
[manual/demo-math.js:31]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demo-math.js#L31
[manual/demo-math.js:9]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demo-math.js#L9
[manual/demo-math3.js:167]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demo-math3.js#L167
[manual/demos.js:155]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L155
[manual/demos.js:222]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L222
[manual/demos.js:225]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L225
[manual/demos.js:241]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L241
[manual/demos.js:83]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L83
[manual/demos.js:88]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L88
[manual/demos.js:93]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos.js#L93
[manual/demos2.js:626]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos2.js#L626
[manual/demos2.js:945]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos2.js#L945
[manual/demos2.js:956]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos2.js#L956
[manual/demos3.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos3.js#L1
[manual/demos3.js:49]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos3.js#L49
[manual/demos3.js:88]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/demos3.js#L88
[manual/experiments.html:110]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/experiments.html#L110
[manual/gallery.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1
[manual/gallery.html:1005]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1005
[manual/gallery.html:1028]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1028
[manual/gallery.html:1035]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1035
[manual/gallery.html:1047]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1047
[manual/gallery.html:1084]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1084
[manual/gallery.html:1120]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1120
[manual/gallery.html:1156]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1156
[manual/gallery.html:117]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L117
[manual/gallery.html:1191]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1191
[manual/gallery.html:1224]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1224
[manual/gallery.html:1270]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1270
[manual/gallery.html:1306]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1306
[manual/gallery.html:1342]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1342
[manual/gallery.html:1378]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1378
[manual/gallery.html:1414]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1414
[manual/gallery.html:142]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L142
[manual/gallery.html:1450]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1450
[manual/gallery.html:1486]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1486
[manual/gallery.html:1522]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1522
[manual/gallery.html:1558]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1558
[manual/gallery.html:1594]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1594
[manual/gallery.html:1637]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1637
[manual/gallery.html:167]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L167
[manual/gallery.html:1673]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1673
[manual/gallery.html:1709]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1709
[manual/gallery.html:1732]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1732
[manual/gallery.html:1751]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1751
[manual/gallery.html:1790]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1790
[manual/gallery.html:1829]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1829
[manual/gallery.html:1865]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1865
[manual/gallery.html:1904]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1904
[manual/gallery.html:192]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L192
[manual/gallery.html:1940]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1940
[manual/gallery.html:1976]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L1976
[manual/gallery.html:2017]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2017
[manual/gallery.html:2039]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2039
[manual/gallery.html:2055]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2055
[manual/gallery.html:2093]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2093
[manual/gallery.html:2134]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2134
[manual/gallery.html:217]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L217
[manual/gallery.html:2173]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2173
[manual/gallery.html:2211]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2211
[manual/gallery.html:2249]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2249
[manual/gallery.html:2287]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2287
[manual/gallery.html:2326]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2326
[manual/gallery.html:2362]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2362
[manual/gallery.html:2404]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2404
[manual/gallery.html:241]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L241
[manual/gallery.html:2444]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2444
[manual/gallery.html:2480]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2480
[manual/gallery.html:2519]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2519
[manual/gallery.html:2557]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2557
[manual/gallery.html:2596]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2596
[manual/gallery.html:2635]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2635
[manual/gallery.html:2674]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2674
[manual/gallery.html:269]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L269
[manual/gallery.html:2716]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2716
[manual/gallery.html:2752]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L2752
[manual/gallery.html:294]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L294
[manual/gallery.html:315]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L315
[manual/gallery.html:336]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L336
[manual/gallery.html:360]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L360
[manual/gallery.html:387]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L387
[manual/gallery.html:413]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L413
[manual/gallery.html:435]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L435
[manual/gallery.html:460]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L460
[manual/gallery.html:477]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L477
[manual/gallery.html:479]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L479
[manual/gallery.html:492]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L492
[manual/gallery.html:511]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L511
[manual/gallery.html:547]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L547
[manual/gallery.html:583]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L583
[manual/gallery.html:624]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L624
[manual/gallery.html:663]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L663
[manual/gallery.html:699]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L699
[manual/gallery.html:738]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L738
[manual/gallery.html:774]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L774
[manual/gallery.html:810]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L810
[manual/gallery.html:849]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L849
[manual/gallery.html:890]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L890
[manual/gallery.html:929]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L929
[manual/gallery.html:95]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L95
[manual/gallery.html:965]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L965
[manual/gallery.html:987]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/gallery.html#L987
[manual/index.html:105]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/index.html#L105
[manual/index.html:95]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/index.html#L95
[manual/language.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L1
[manual/language.html:224]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L224
[manual/language.html:361]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L361
[manual/language.html:425]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L425
[manual/language.html:445]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L445
[manual/language.html:510]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L510
[manual/language.html:522]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L522
[manual/language.html:524]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L524
[manual/language.html:530]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L530
[manual/language.html:581]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L581
[manual/language.html:638]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L638
[manual/language.html:644]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L644
[manual/language.html:711]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L711
[manual/language.html:781]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L781
[manual/language.html:809]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L809
[manual/language.html:878]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L878
[manual/language.html:880]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L880
[manual/language.html:976]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/language.html#L976
[manual/manual.css:962]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/manual.css#L962
[manual/more.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/more.html#L1
[manual/more.html:124]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/more.html#L124
[manual/more.html:128]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/more.html#L128
[manual/more.html:164]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/more.html#L164
[manual/more.html:211]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/more.html#L211
[manual/pages.mjs:9]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/pages.mjs#L9
[manual/pictures.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/pictures.html#L1
[manual/references.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/references.html#L1
[manual/references.html:110]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/references.html#L110
[manual/share.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L1
[manual/share.html:112]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L112
[manual/share.html:141]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L141
[manual/share.html:147]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L147
[manual/share.html:149]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L149
[manual/share.html:160]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L160
[manual/share.html:200]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L200
[manual/share.html:216]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L216
[manual/share.html:224]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L224
[manual/share.html:241]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L241
[manual/share.html:243]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L243
[manual/share.html:253]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L253
[manual/share.html:257]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L257
[manual/share.html:259]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L259
[manual/share.html:262]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L262
[manual/share.html:268]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L268
[manual/share.html:276]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/share.html#L276
[manual/splat.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1
[manual/splat.html:1009]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1009
[manual/splat.html:1039]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1039
[manual/splat.html:1043]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1043
[manual/splat.html:1047]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1047
[manual/splat.html:1239]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1239
[manual/splat.html:1366]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L1366
[manual/splat.html:176]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L176
[manual/splat.html:311]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L311
[manual/splat.html:713]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L713
[manual/splat.html:851]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/splat.html#L851
[manual/toy.html:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L1
[manual/toy.html:219]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L219
[manual/toy.html:227]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L227
[manual/toy.html:243]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L243
[manual/toy.html:248]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L248
[manual/toy.html:250]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L250
[manual/toy.html:255]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L255
[manual/toy.html:275]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L275
[manual/toy.html:446]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L446
[manual/toy.html:512]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L512
[manual/toy.html:523]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L523
[manual/toy.html:708]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L708
[manual/toy.html:773]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/toy.html#L773
[manual/unique.html:118]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/unique.html#L118
[manual/unique.html:122]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/unique.html#L122
[manual/unique.html:86]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/unique.html#L86
[manual/unique.html:88]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/unique.html#L88
[manual/unique.html:95]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/manual/unique.html#L95
[package.json:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/package.json#L1
[playwright.config.mjs:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/playwright.config.mjs#L1
[site/learn/can-do/index.html:142]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L142
[site/learn/can-do/index.html:146]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L146
[site/learn/can-do/index.html:158]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L158
[site/learn/can-do/index.html:166]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L166
[site/learn/can-do/index.html:168]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L168
[site/learn/can-do/index.html:173]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L173
[site/learn/can-do/index.html:177]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L177
[site/learn/can-do/index.html:178]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L178
[site/learn/can-do/index.html:182]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L182
[site/learn/can-do/index.html:187]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L187
[site/learn/can-do/index.html:199]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L199
[site/learn/can-do/index.html:201]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L201
[site/learn/can-do/index.html:213]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L213
[site/learn/can-do/index.html:232]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L232
[site/learn/can-do/index.html:239]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L239
[site/learn/can-do/index.html:244]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L244
[site/learn/can-do/index.html:249]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L249
[site/learn/can-do/index.html:254]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L254
[site/learn/can-do/index.html:259]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L259
[site/learn/can-do/index.html:269]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L269
[site/learn/can-do/index.html:272]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L272
[site/learn/can-do/index.html:276]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L276
[site/learn/can-do/index.html:283]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L283
[site/learn/can-do/index.html:287]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L287
[site/learn/can-do/index.html:300]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/site/learn/can-do/index.html#L300
[src/app.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/app.js#L1
[src/app.js:1356]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/app.js#L1356
[src/app.js:1768]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/app.js#L1768
[src/app.js:1781]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/app.js#L1781
[src/arcade/runtime.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/arcade/runtime.js#L1
[src/camera.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/camera.js#L1
[src/codec.js:29]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/codec.js#L29
[src/codec.js:38]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/codec.js#L38
[src/codec.js:46]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/codec.js#L46
[src/codec.js:62]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/codec.js#L62
[src/codec.js:8]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/codec.js#L8
[src/effects.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/effects.js#L1
[src/effects.js:1895]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/effects.js#L1895
[src/effects.js:788]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/effects.js#L788
[src/element.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/element.js#L1
[src/equation-gallery.json:123]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation-gallery.json#L123
[src/equation-gallery.json:130]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation-gallery.json#L130
[src/equation-gallery.json:301]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation-gallery.json#L301
[src/equation-gallery.json:375]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation-gallery.json#L375
[src/equation-gallery.json:6]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation-gallery.json#L6
[src/equation.js:18]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation.js#L18
[src/equation.js:19]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation.js#L19
[src/equation.js:238]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/equation.js#L238
[src/exports.js:274]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/exports.js#L274
[src/exports.js:281]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/exports.js#L281
[src/exports.js:290]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/exports.js#L290
[src/exports.js:297]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/exports.js#L297
[src/exports.js:303]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/exports.js#L303
[src/exports.js:5]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/exports.js#L5
[src/fluids/gpu/gas.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/fluids/gpu/gas.js#L1
[src/fluids/gpu/surface.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/fluids/gpu/surface.js#L1
[src/fluids/runtime.js:126]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/fluids/runtime.js#L126
[src/fluids/runtime.js:83]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/fluids/runtime.js#L83
[src/fluids/world.js:20]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/fluids/world.js#L20
[src/generators.js:76]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/generators.js#L76
[src/geo/data.js:12]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/geo/data.js#L12
[src/kernels.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/kernels.js#L1
[src/kit.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/kit.js#L1
[src/kit.js:945]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/kit.js#L945
[src/live/live.js:156]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/live/live.js#L156
[src/live/live.js:9]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/live/live.js#L9
[src/live/panel.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/live/panel.js#L1
[src/live/record.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/live/record.js#L1
[src/live/relief-mesh.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/live/relief-mesh.js#L1
[src/loaders.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/loaders.js#L1
[src/loaders.js:12]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/loaders.js#L12
[src/loaders.js:173]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/loaders.js#L173
[src/media.js:132]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/media.js#L132
[src/media.js:319]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/media.js#L319
[src/media.js:632]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/media.js#L632
[src/molview/load.js:73]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/molview/load.js#L73
[src/packs/arcade-listen.js:34]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/arcade-listen.js#L34
[src/packs/arcade-listen.js:50]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/arcade-listen.js#L50
[src/packs/arcade-listen.js:53]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/arcade-listen.js#L53
[src/packs/balls.js:1639]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/balls.js#L1639
[src/packs/chladni-sand.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/chladni-sand.js#L1
[src/packs/geo.js:1363]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/geo.js#L1363
[src/packs/geo.js:1404]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/geo.js#L1404
[src/packs/geo.js:1575]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/geo.js#L1575
[src/packs/live.js:401]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/live.js#L401
[src/packs/moving-photo.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/moving-photo.js#L1
[src/packs/night-sky.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/night-sky.js#L1
[src/packs/photo-3d-depth.js:14]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/photo-3d-depth.js#L14
[src/packs/photo-3d-depth.js:59]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/photo-3d-depth.js#L59
[src/packs/photo-3d-depth.js:63]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/photo-3d-depth.js#L63
[src/packs/photo-3d.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/photo-3d.js#L1
[src/packs/photo-sharp.js:178]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/photo-sharp.js#L178
[src/packs/pianos.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/pianos.js#L1
[src/packs/pictures.js:21]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/pictures.js#L21
[src/packs/qr-craft.js:728]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/qr-craft.js#L728
[src/packs/qr-craft.js:75]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/qr-craft.js#L75
[src/packs/qr.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/qr.js#L1
[src/packs/science.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/science.js#L1
[src/packs/song-analysis.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/song-analysis.js#L1
[src/packs/sound-lab.js:891]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/sound-lab.js#L891
[src/packs/splat-equation.js:170]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L170
[src/packs/splat-equation.js:30]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L30
[src/packs/splat-equation.js:34]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L34
[src/packs/splat-equation.js:413]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L413
[src/packs/splat-equation.js:425]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L425
[src/packs/splat-equation.js:440]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L440
[src/packs/splat-equation.js:47]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L47
[src/packs/splat-equation.js:484]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L484
[src/packs/splat-equation.js:518]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L518
[src/packs/splat-equation.js:530]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/splat-equation.js#L530
[src/packs/studio-models-core.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/studio-models-core.js#L1
[src/packs/studio-models.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/studio-models.js#L1
[src/packs/studio.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/studio.js#L1
[src/packs/video3d.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/video3d.js#L1
[src/packs/volume-viewer.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/packs/volume-viewer.js#L1
[src/paint.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/paint.js#L1
[src/pc.js:5]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/pc.js#L5
[src/pdf-export/index.js:20]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/pdf-export/index.js#L20
[src/pdf-export/index.js:98]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/pdf-export/index.js#L98
[src/pdf-export/pdf.js:21]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/pdf-export/pdf.js#L21
[src/pdf-export/pdf.js:24]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/pdf-export/pdf.js#L24
[src/physics/hands-on.js:66]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/physics/hands-on.js#L66
[src/player.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/player.js#L1
[src/player.js:282]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/player.js#L282
[src/player.js:581]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/player.js#L581
[src/player.js:85]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/player.js#L85
[src/qr/encode.js:22]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/encode.js#L22
[src/qr/encode.js:7]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/encode.js#L7
[src/qr/scan.js:40]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/scan.js#L40
[src/qr/share-code.js:14]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share-code.js#L14
[src/qr/share-code.js:7]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share-code.js#L7
[src/qr/share.js:106]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L106
[src/qr/share.js:112]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L112
[src/qr/share.js:118]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L118
[src/qr/share.js:128]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L128
[src/qr/share.js:142]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L142
[src/qr/share.js:62]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L62
[src/qr/share.js:84]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L84
[src/qr/share.js:95]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/qr/share.js#L95
[src/songs.js:256]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/songs.js#L256
[src/songs.js:29]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/songs.js#L29
[src/sound.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/sound.js#L1
[src/stage.js:120]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/stage.js#L120
[src/stage.js:18]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/stage.js#L18
[src/stage.js:383]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/stage.js#L383
[src/stage.js:40]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/stage.js#L40
[src/state.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L1
[src/state.js:13]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L13
[src/state.js:174]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L174
[src/state.js:177]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L177
[src/state.js:233]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L233
[src/state.js:303]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L303
[src/state.js:65]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/state.js#L65
[src/toy-help.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/toy-help.js#L1
[src/toy-sounds.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/toy-sounds.js#L1
[src/toys.js:4368]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/toys.js#L4368
[src/toys.js:49]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/toys.js#L49
[src/ui.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/ui.js#L1
[src/ui.js:598]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/ui.js#L598
[src/video3d/run.js:137]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/video3d/run.js#L137
[src/viewer.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/viewer.js#L1
[src/viewers/engine.js:19]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/viewers/engine.js#L19
[src/viewers/engine.js:69]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/viewers/engine.js#L69
[src/volume/read.js:618]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/volume/read.js#L618
[src/worlds/hybrid.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/worlds/hybrid.js#L1
[src/worlds/world-file.js:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/src/worlds/world-file.js#L1
[tests/man4.spec.mjs:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/man4.spec.mjs#L1
[tests/man5.spec.mjs:201]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/man5.spec.mjs#L201
[tests/man5.spec.mjs:234]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/man5.spec.mjs#L234
[tests/man5.spec.mjs:251]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/man5.spec.mjs#L251
[tests/man5.spec.mjs:316]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/man5.spec.mjs#L316
[tests/man5.spec.mjs:93]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/man5.spec.mjs#L93
[tests/smoke.spec.mjs:385]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/smoke.spec.mjs#L385
[tests/taps.spec.mjs:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tests/taps.spec.mjs#L1
[tools/geo-migration.mjs:23]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/geo-migration.mjs#L23
[tools/manual-pdf.mjs:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/manual-pdf.mjs#L1
[tools/manual-pdf.mjs:34]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/manual-pdf.mjs#L34
[tools/manual-pdf.mjs:58]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/manual-pdf.mjs#L58
[tools/manual-pdf.mjs:84]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/manual-pdf.mjs#L84
[tools/shp-measure.mjs:110]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/shp-measure.mjs#L110
[tools/shp-measure.mjs:496]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/shp-measure.mjs#L496
[tools/shp-measure.mjs:72]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/shp-measure.mjs#L72
[tools/shp-measure.mjs:83]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/shp-measure.mjs#L83
[tools/site-build.mjs:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/site-build.mjs#L1
[tools/site-hubs.mjs:288]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/site-hubs.mjs#L288
[tools/site-hubs.mjs:298]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/site-hubs.mjs#L298
[tools/toy-plan.json:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/tools/toy-plan.json#L1
[vendor/playcanvas/LICENSE:1]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/vendor/playcanvas/LICENSE#L1
[vendor/playcanvas/playcanvas.min.mjs:14945]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/vendor/playcanvas/playcanvas.min.mjs#L14945
[vendor/playcanvas/playcanvas.min.mjs:14948]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/vendor/playcanvas/playcanvas.min.mjs#L14948
[vendor/playcanvas/playcanvas.min.mjs:15010]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/vendor/playcanvas/playcanvas.min.mjs#L15010
[vendor/qrcodegen/qrcodegen.js:290]:
  https://github.com/ryanjosephkamp/splashery/blob/e1d548c48a76d690868a9582d5598dfd24f09fef/vendor/qrcodegen/qrcodegen.js#L290
