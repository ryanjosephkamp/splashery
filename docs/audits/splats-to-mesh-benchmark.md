# Splats to mesh: independent benchmark

Measured on October 17, 2026, on an AMD EPYC 9V74 host, using Node 24.19.0 and Chromium
151.0.7922.173. Codex (GPT-6) built the benchmark. Rule check: none.

The fixed quality preset is desktop, resolution 160, density level 1, 100,000 triangles, three
smoothing iterations, floater share 0.002, and Ready to print at 100 mm. Across the fourteen
original Poly Haven models, median normalized Chamfer is **1.4235%**, median normal consistency is
**0.9003**, and **14 of 14** exports pass independent closed manifold checks. There are no topology
failures. These are aggregate gates; individual models can have larger errors. The initial
resolution-112, level-0.15 print comparison had a 2.4819% median Chamfer. The quality result is
specific to the stated preset.

The triangle budget uses scalar-grid resampling rather than a topology-preserving edge-collapse
decimator. A coarser grid can remove small components; the tool reports this explicitly when it
resamples. Independent final topology checks still run, but they cannot establish preservation of
the source's connected components.

The sampled thickness check passes on **7 of 14** at that preset: rubber duck, garden gnome, wooden
elephant, croissant, carrot cake, pomegranate, and cat statue. Marble bust, ukulele, alarm clock,
vintage camera, boombox, lantern, and chess set have sampled walls below 1 mm. The tool explicitly
reports these seven as **not ready to print**. All fourteen remain closed manifold meshes. No
sampled ray misses its opposite surface.

## Inputs, alignment, and scoring

The benchmark takes the first fourteen entries of [tools/models.json](../../tools/models.json), from
rubber duck through chess set. It fetches their actual source glTFs outside git and records SHA-256
hashes, source-page snapshots, and live license-page snapshots under `.cache/mesh-export/sources/`.
[Poly Haven's license page](https://polyhaven.com/license) and all fourteen model pages were opened
and checked for CC0. Reconstruction reads the actual shipped `assets/toys/<id>/<id>.sog` files with
the existing SOG parser and WebP codec. Source meshes are used only for scoring.

Both surfaces receive 100,000 deterministic samples, distributed by triangle area. Chamfer is the
arithmetic mean of the two directed nearest-sample Euclidean distances, divided by the complete
source mesh's bounding diagonal. Normal consistency is the mean absolute face-normal dot product at
those symmetric nearest samples. This is a sampled surface measure with a nonzero sampling floor.
The report also retains signed normal consistency and each directed distance.

Source coordinates use the bake's 1.5% trimmed area-sample bounds. The output's exact
`printTransform` is inverted to recover source units. No ICP, shape fitting, per-model tuning, or
source geometry enters reconstruction. Complete source geometry is scored, including glass that the
original mesh-to-splat bake omitted. Independent topology checks cover edge incidence, opposite edge
directions, degeneracy, vertex-link connectivity, and signed volume. Closed, open, and
vertex-touching tetrahedron checks exercised the checker itself.

## Files and visual evidence

The six kit examples are torus, soccer ball, rubber duck, apple, diamond, and chess set. The three
Photo to 3D examples use the actual cached photo/depth samples for
[Still Life with Cheese](https://commons.wikimedia.org/wiki/File:Still_Life_with_Cheese_MET_DT1989.jpg),
[Forest Away Path](https://commons.wikimedia.org/wiki/File:Forest_Away_Path.jpg), and
[Spiral Staircase](<https://commons.wikimedia.org/wiki/File:Spiral_Staircase,_Keck_Center_(U.S._National_Academies).jpg>).
These three live source pages were opened and checked for CC0. Every example was exported as GLB,
OBJ with MTL, and STL, and all nine independently pass the topology checks.

Kit exports bake the default rigid token, part, and body poses, hide invisible pieces, and apply
supported packed morphs. The photo examples explicitly use `controls: { flat: 0 }` for their
depth-relief state; the built-in ID's default flat state remains available. The final examples were
regenerated after this fix, removing the apple's hidden worm and the chess set's promotion spares.
An unsupported active surface deformation fails with a message to save and reopen the toy's splats.

The nine PNGs under `.cache/mesh-export/evidence/` render the actual exported GLB geometry and
vertex colors with the tool's Canvas triangle preview in real Chromium. All nine were inspected. The
toys remain recognizable, with softened small features and visible triangulation. The diamond
becomes an opaque colored surface. The chess board keeps its pieces but loses fine piece detail at
the 100,000-triangle budget. The photo outputs remain colored relief slabs; they do not recover
unseen backsides. Inspection found gray patches where print thickening extended beyond the color
field; the color fallback was fixed, and the exports and stills were regenerated and inspected
again.

GLBs are checked with
[Khronos glTF Validator 2.0.0-dev.3.10](https://github.com/KhronosGroup/glTF-Validator), installed
outside the repository. Its
[Apache-2.0 license](https://raw.githubusercontent.com/KhronosGroup/glTF-Validator/main/LICENSE) was
opened and confirmed. The per-file validator reports and their summary remain outside git. The final
25 primary, example, and runtime GLBs have **zero errors and zero warnings**.

## Performance and limits

The runtime input is the actual 450,000-splat Cactus SOG, without duplicate splats or a synthetic
mesh substitute. Its [live source page](https://note.com/steam_studio/n/ne9736d94f162) was opened
and confirms CC0. The phone profile receives that same full file and internally samples 112,500
splats under its 120,000-splat budget. Node timing covers conversion and GLB encoding; the real
browser worker timing additionally covers input decoding and transfer of the bounded preview. Full
timing and memory records are `runtime-*.json` and `browser-runtime-*.json` in the cache.

| Run                                  | Conversion through GLB |        Process peak RSS |
| ------------------------------------ | ---------------------: | ----------------------: |
| Node, desktop Fine preset            |                3.572 s |              582.86 MiB |
| Node, phone profile                  |                0.961 s |              212.22 MiB |
| Chromium worker, desktop Fine preset |                3.652 s | See sampled browser RSS |
| Chromium worker, phone profile       |                1.312 s | See sampled browser RSS |

These final runs include the sampled thickness checker. Observed worker heap maxima were 217,558,268
bytes used and 101,493,947 bytes of backing storage on desktop, compared with 39,892,196 and
41,506,034 bytes on the phone profile. The fields are reported individually; these snapshots do not
establish the transient peak or a physical phone's memory footprint.

The phone browser run uses a 390 × 844 touch viewport and sets page CDP CPU throttling to 4×. CDP
rejects the corresponding command for a worker: “Operation is only supported for pages, not
workers.” Worker CPU throttling is therefore unverified. This is not a physical phone measurement
and does not prove the physical-phone performance gate.

Memory evidence distinguishes Node process peak RSS, sampled Chromium process RSS, and CDP
`Runtime.getHeapUsage` fields from the actual conversion worker. Chromium RSS sums can count shared
pages more than once. Heap snapshots may miss a transient peak. The module's `bufferBytesEstimate`
counts typed buffers and excludes transient maps, V8, and the decoder; it is not a total memory
measurement.

Voxel thickening is followed by up to 2,048 inward face-center rays against a triangle BVH. This is
a sampled thickness check, not a slicer-certified minimum over every surface point. Topology checks
do not detect triangle self-intersections, printer support needs, or material strength. These
limitations remain visible in the tool. Passing the sampled quality and topology gates does not
certify every input as printable.

## Reproduction and evidence locations

Run from the repository root. The source assets, generated meshes, stills, and score JSON stay under
the ignored `.cache/mesh-export/` directory; they belong on the separate
`codex/splats-to-mesh-clips` evidence branch, never the implementation branch.

```sh
node tools/mesh-export-benchmark.mjs --fetch
node tools/mesh-export-benchmark.mjs --run --resolution=160 --level=1 --tag=desktop-print160-level1
node tools/mesh-export-benchmark.mjs --samples
node tools/mesh-export-benchmark.mjs --runtime --resolution=160 --level=1
node tools/mesh-export-benchmark.mjs --runtime --phone --level=0.5
python3 -m http.server 4174 --bind 127.0.0.1
```

With that local server running, use another terminal:

```sh
node tools/mesh-export-benchmark.mjs --stills
node tools/mesh-export-benchmark.mjs --browser-runtime
node tools/mesh-export-benchmark.mjs --browser-runtime --phone
GLTF_VALIDATOR_MODULE=/tmp/splashery-mesh-validator/node_modules/gltf-validator/module.mjs node tools/mesh-export-benchmark.mjs --validate --tag=desktop-print160-level1,examples,runtime-desktop,runtime-phone
```

Install the optional validator outside git first:

```sh
npm install --prefix /tmp/splashery-mesh-validator --ignore-scripts --no-audit --no-fund gltf-validator@2.0.0-dev.3.10
```

Primary records are `benchmark-desktop-print160-level1.json`, `examples.json`,
`validation-summary.json`, `runtime-desktop-450000.json`, `runtime-phone-450000.json`,
`browser-runtime-desktop.json`, and `browser-runtime-phone.json`. Exact input hashes, parameters,
coordinate transforms, signed volume, topology diagnostics, and module reports are preserved beside
each exported mesh.

Publication targets on the evidence branch:

- [Primary scores](https://github.com/ryanjosephkamp/splashery/blob/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/scores.json)
- [Nine examples](https://github.com/ryanjosephkamp/splashery/blob/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/examples.json)
- [Node desktop runtime](https://github.com/ryanjosephkamp/splashery/blob/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/runtime-desktop-450000.json)
- [Node phone runtime](https://github.com/ryanjosephkamp/splashery/blob/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/runtime-phone-450000.json)
- [Browser desktop runtime](https://github.com/ryanjosephkamp/splashery/blob/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/browser-runtime-desktop.json)
- [Browser phone runtime](https://github.com/ryanjosephkamp/splashery/blob/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/browser-runtime-phone.json)
- [Inspected stills](https://github.com/ryanjosephkamp/splashery/tree/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/stills)
- [Exported meshes](https://github.com/ryanjosephkamp/splashery/tree/codex/splats-to-mesh-clips/docs/audits/splats-to-mesh-2026-10/meshes)
