# Lane Baked engine: baked splat assets for the Kit (prefix `bkd`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01Mo8sLhAitbYjZiPgD8Hc4t). Repo: ryanjosephkamp/splashery. Your lane: Baked engine (id
`BakedEngine`, prefix `bkd`). Branch: `claude/lane-baked-engine` from main. PR title: "Engine: baked
splat assets for the Kit (compact format, converter, checker)". Handoff file:
docs/handoff/BakedEngine.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus
5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/OPERATING.md ("Engine changes"),
docs/handoff/ScienceR3.md ("How this lane runs"), docs/PACKS.md (the Kit, recipes, Real Objects and
Photoreal), docs/SCENE-SCHEMA.md, then src/kit.js, src/effects.js, src/stage.js, src/motion.js,
src/loaders.js, src/chunks.js, and the packs that load prepared samples (src/packs/real-objects.js,
photoreal-r3.js, photo-3d.js).

### Brief (written by the Operator on October 12, 2026; the owner asked for it before the weekly reset)

The owner's outside agents (his Codex agents and "the Dot", a ChatGPT agent that uses Blender very
well) build high-fidelity toys as asset-backed Kit recipes: Blender or Python bakes Gaussian samples
offline; the recipe loads them and emits them through the real Kit (`buildRecipe`, `k.part`,
`k.cloud`, `MotionDriver`). Their pilots use Splashery's own Kit files unchanged and the same
PlayCanvas 2.22.3. What stops their work from dropping into Splashery is one missing engine feature,
and that's your job:

1. **A compact baked-splat format.** Today a kit-backed scan uses `.splats` (about 14 bytes per
   splat, round discs, no rotation), and captures use SOG, which loads outside the Kit. The outside
   agents' files are standard 3DGS binary PLY (68 bytes per splat: position, normal, SH0 color,
   logit opacity, three log scales, a wxyz quaternion) with a `*.parts.json` sidecar (part ids bound
   to the PLY's sha256), chunked gzip under 20 MiB per file, in tiers (100k, 400k, 720k and more).
   Design a format that keeps rotation, three sizes, color, opacity and a part id per splat at
   roughly 16 to 24 bytes per splat (quantized against the asset's bounds; measure the error and
   keep it below what shows at phone size), chunkable, streamable, and fast to decode in the browser
   without a library. Reusing SOG is fine if you can feed it into the Kit cleanly; say which you
   chose and why, with numbers.
2. **Loading through the Kit.** A recipe can load a baked asset asynchronously (in `prepare()` or an
   equivalent hook) and emit it through `k.cloud` (or a new, small, additive Kit call) with its
   parts, so moving parts use the existing one-entity path (`uSpParts`, up to 15 parts) and
   MotionDriver, effects and the scene state work as for any kit toy. The host's splat budget (Auto,
   the budget menu) picks a tier and, below the smallest tier, thins the asset deterministically
   (same splats every time for the same budget and seed). Nothing about existing toys changes:
   additive and backwards compatible, the laptop locked (every other toy behaves exactly as before;
   old `#s=` links and saved scenes v2/v3 keep loading).
3. **The converter:** `tools/port-convert.mjs` turns a 3DGS PLY (plus an optional parts.json) into
   your format at each requested tier, writes a `manifest.json` (id, tiers with splat counts, bytes
   and hashes, parts, bounds, the source's hash, and credit and license fields to fill), and refuses
   a file that isn't a valid 3DGS PLY. Node only, no new runtime dependency (a pinned devDependency
   is allowed if you must; list it in LICENSES.md).
4. **The checker:** `tools/port-check.mjs <folder>` checks a toy package (a folder with recipe.mjs,
   manifest.json, assets/, record.md) against every rule a machine can check: no external URLs or
   CDN imports, PlayCanvas only through src/pc.js, no secrets (`hf_` tokens and the like), each
   asset listed with a license and source in the manifest, the license among CC0, CC BY, CC BY-SA,
   CC BY-NC, CC BY-NC-SA, public domain or NASA, file sizes reported (the owner wants size guidance
   as a recommendation, not a hard limit: warn above 15 MB for the default tier, never fail on
   size), and American English in public text (reuse tools/us-english.mjs). It prints what blocks a
   port and what only warns, and exits non-zero only on a block.
5. **Proof:** one small labs-only example toy that loads a baked asset through the new path, with a
   moving part, at two tiers. Use an asset already in the repo with its license recorded (for
   example the 3DGS PLY at assets/toys/video-3d/ or a capture), or a procedural one you bake in a
   test; no new third-party assets. Tests in tests/bkd\*.spec.mjs: format round trip (encode,
   decode, error within bounds), tier choice and deterministic thinning, parts move as solid pieces,
   the example renders at 390×844 and 1440×900, the converter rejects a bad PLY, and port-check
   passes a good package and blocks a bad one.
6. **Docs:** a short "Baked assets" section for docs/PACKS.md and the toy package spec (folder
   layout, manifest fields) written in your handoff under "For the Operator" (PACKS.md is the
   Operator's file), and a README in tools/ or a comment header in each tool.

Keep it small and additive. If the full design won't fit before the reset (Wednesday, October 14,
2026, 4 p.m. ET), deliver in this order and stop at a clean point: format and decoder with tests,
then the Kit path, then the converter, then the checker, then the example. Post a WORKING note with
the design (format layout, bytes per splat, measured error) before building the Kit path, so the
Operator can check it.

You own: new files under src/ for the format and loader (for example src/baked.js), small additive
hooks in src/kit.js (and anywhere else the Kit path truly needs, each with a comment),
tools/port-convert.mjs, tools/port-check.mjs, the example toy's pack file and assets folder, its
lines in the shared lists (labs only), tests/bkd\*.spec.mjs and your screenshots. Nothing else.

How this lane runs: as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the prefix and
lane record with yours). It's an additive engine PR behind labs: the Operator merges it once a full
test run passes; the example toy gets one card (a clip of the moving part at phone size) on Effect
review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), id bkd-…, naming Opus 5.5, as
docs/OPERATING.md, "Steps for a lane", says (no republish). Finish every working turn with "READY:",
"WORKING:" or "BLOCKED:" (the Operator reads it; never ask the owner). Splashery has no CI to wait
for; for a long job, schedule a check-in with send_later instead of going idle. Before READY, run
CLAUDE.md's "Before every push" steps and the specs smoke, kit, unit, taps, hta, help, and every
spec whose toys use src/kit.js paths you touched. When main moves, merge it into your branch (never
rebase). Usage is tight until the weekly reset: at most one helper at a time, only if you must. The
owner's own notes are private: never quote them; this brief is the Operator's summary.

## State

October 12, 2026 (Opus 5.5): built in the brief's order, all on `claude/lane-baked-engine`.

- **Format and decoder** (`src/baked.js`): done, with tests (`tests/bkd-format.spec.mjs`).
- **Kit path**: done with no change to `src/kit.js`. `addBaked(k, asset)` emits through the existing
  `k.cloud` (its trained-splat fields `scales` and `quat`); the one engine hook is in
  `src/player.js`: `prepare()`'s third argument now also carries the toy's splat budget (`count`),
  so a recipe picks its tier there.
- **Converter** (`tools/port-convert.mjs`), **checker** (`tools/port-check.mjs`): done, with tests.
  The checker reuses `tools/us-english.mjs`, which now exports `britishIn(text)` (its command line
  is unchanged).
- **Example**: "Baked chest" (labs, Lab shelf, `src/packs/baked-demo.js`), baked by
  `tools/bkd-bake-chest.mjs` into `assets/toys/baked-chest/` (tiers of 30,000 and 100,001 splats,
  1.8 MB gzipped together). A tap swings the lid open on its hinge.

## Notes

### The design (the WORKING note)

**Choice: a new format (BKD1), not SOG.** SOG keeps its numbers in lossless WebP pictures: writing
it needs a WebP encoder (a WebAssembly codec, not plain Node), reading it needs an image decode, it
has no part id per splat, and a file can't be read in part, so a tier can't be thinned by loading
less. BKD1 is plain typed arrays: the decoder is a header parse and five typed-array views (about 2
ms for 116,000 splats in Node), and the converter is plain Node with no dependency.

**Layout, 18 bytes a splat** (struct of arrays per chunk, little-endian; the full spec is the header
comment of `src/baked.js`):

| Field    | Bytes | Encoding                                                                 |
| -------- | ----- | ------------------------------------------------------------------------ |
| rotation | 4     | smallest three: 2 bits for the largest of x, y, z, w, then 3 × 10 bits   |
| position | 6     | 3 × u16 over the tier's bounds                                           |
| sizes    | 3     | 3 × u8 over the tier's log-size range (at most 16 wide)                  |
| color    | 3     | 3 × u8 of 0.5 + C0 · f_dc, clamped (degree 0 only; higher SH is dropped) |
| opacity  | 1     | u8 after the sigmoid                                                     |
| part     | 1     | u8 (0 is the body)                                                       |

A chunk is `"BKD1"`, a u32 header length, a JSON header (count, first, bounds, log-size range), then
the arrays. Each chunk decodes on its own. Default chunk: 65,536 splats (1.2 MB). A chunk may be
gzipped (about 12% smaller on trained splats, 25% on kit-baked ones); the loader inflates it with
`DecompressionStream`.

**Measured error** (the repository's two trained PLYs, `assets/toys/video-3d/`, 116,000 splats each,
68 bytes a splat in the PLY):

| Quantity | Worst error                      | At phone size                                      |
| -------- | -------------------------------- | -------------------------------------------------- |
| position | 7.6e-6 of the bounds' diagonal   | under 0.01 px with the toy 300 px across           |
| rotation | 0.23°                            | a 20 px long splat's tip moves under 0.1 px        |
| size     | 0.021 in log size (2.1%)         | under 0.1 px on a 4 px splat                       |
| color    | 0.0020 (half an 8-bit step)      | the screen's own 8-bit step                        |
| opacity  | 0.0020                           |                                                    |
| bytes    | 18.0 a splat (15.8 to 16.1 gzip) | 3.8 times smaller than the PLY (4.3 times gzipped) |

**Tiers and thinning.** The converter shuffles each tier's splats into an even random order (seeded
by the source's sha256), so any prefix of a tier is an even sample. `chooseTier(manifest, budget)`
takes the largest tier that fits the budget, whole; below the smallest tier, that tier's first
`budget` splats (at least 1,000), grown by the square root of the thinning so the surface stays
closed. The loader fetches only the chunks those splats are in. The same budget gives the same
splats every time (the seed is the source's hash, so it doesn't change with the toy's seed).

### How a recipe uses it

```js
import { loadBaked, addBaked } from "../baked.js";
const MANIFEST = new URL("../../assets/toys/<id>/manifest.json", import.meta.url);
let ASSET = null;
// in the recipe:
async prepare(_o, _help, ctx) { ASSET = await loadBaked(MANIFEST, { budget: ctx?.count }); },
build(k) { addBaked(k, ASSET); },          // the manifest's parts become kit parts
drive(t, c, out) { out.parts.lid = { angle: -1.85 * c.open }; },
```

`addBaked` options: `parts` ("auto", an array, or a function from the file's part id), `quat`, `pos`
and `scale` (place the asset), `sizeMul`, `color(c, i, filePart)`, and `kind`, `params` and
`pattern` as for `k.cloud`. The cloud item it returns has `start` and `end` after the build, and
`k.data.baked` lists them.

## Known issues

- Only degree-0 color is kept (the kit's splats have no view-dependent color). A trained asset's
  shine from higher harmonics is lost; the outside agents' files are SH0 already.
- The thinning order is uniform. An importance order (large, opaque splats first) might look better
  at low budgets; not measured.
- The parts sidecar format is my reading of the brief ("part ids bound to the PLY's sha256"). The
  converter accepts `ids`, `ids_b64`, `ids_file` or `ranges`, and a PLY property `part`, `part_id`
  or `segment`; if the outside agents' sidecar differs, it's a few lines in `readParts`.

## For the Operator

### "Baked assets" for docs/PACKS.md (a draft)

> **Baked assets** (lane Baked engine). A toy can carry splats trained or baked offline (Blender,
> Python, a 3DGS trainer) and still be a kit toy: parts, effects, MotionDriver and scene state work
> as for any recipe. Convert a 3DGS PLY (and its `*.parts.json`) with
> `node tools/port-convert.mjs <ply> --out assets/toys/<id> --tiers 100000,400000 --gzip`, fill in
> the manifest's credit, then in the recipe load it in `prepare()` with
> `loadBaked(manifestUrl, { budget: ctx?.count })` (the third argument of `prepare` carries the
> splat budget) and emit it in `build()` with `addBaked(k, asset)`. Each manifest part becomes a kit
> part with its pivot and axis (at most 15); `drive()` moves them by name. The budget picks the
> largest tier that fits and thins the smallest tier below it, the same splats every time. The
> format is 18 bytes a splat (src/baked.js). Before a package from an outside builder is ported,
> `node tools/port-check.mjs <folder>` checks it against builders/RULES.md. The example is the Baked
> chest (labs).

### The toy package spec (for builders/)

A package is one folder:

```
<id>/
  recipe.mjs       the kit recipe; imports Splashery's modules by relative path
                   (../../src/kit.js, ../../src/baked.js), never a URL or a bare name
  manifest.json    written by tools/port-convert.mjs, credit filled in by the builder
  assets/          the tier files (<id>-<splats>-<k>.bkd or .bkd.gz) and any extra assets
  record.md        what was made and how, the agent and model, what ran in a real browser, and
                   "Rule check: none" (or the rules it touches)
```

`manifest.json` fields:

| Field               | Meaning                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `format`, `version` | `"splashery-baked-manifest"`, `1`                                                                                   |
| `id`, `title`       | the asset's id (a-z, 0-9, -) and its name                                                                           |
| `source`            | `file`, `sha256`, `splats` of the PLY; `parts`, `partsSha256` of the sidecar; `up`; `more`                          |
| `bounds`            | `min`, `max` of the largest tier, in the asset's (recipe's) coordinates                                             |
| `parts`             | `[{ id, name, pivot?, axis? }]`, id 0 the body, at most 15 more                                                     |
| `defaultTier`       | the tier a page loads with no budget (optional)                                                                     |
| `tiers`             | `[{ splats, bytes, files: [{ path, splats, bytes, sha256 }] }]`                                                     |
| `credit`            | `title`, `author`, `source`, `license`, `licenseUrl`, `checked`, `changes` (Rules v1, B2)                           |
| `nc`, `aiMade`      | `true` for an NC asset (B2) or an AI-made one (A3)                                                                  |
| `extraAssets`       | other files under assets/: `[{ path, title, author, source, license, licenseUrl, checked, changes, sha256?, nc? }]` |

The parts sidecar (`<ply>.parts.json`):
`{ sha256 (of the PLY), parts: [{ id, name, pivot?, axis? }], ids | ids_b64 | ids_file | ranges }`.

### Engine hooks (for the merge)

- `src/player.js`, `buildKit`: `prepare()`'s third argument gains `count` (the toy's splat budget).
  Every existing `prepare` ignores it.
- `tools/us-english.mjs`: exports `britishIn(text)`; the command line runs only when it is the
  script (the same output as before).
