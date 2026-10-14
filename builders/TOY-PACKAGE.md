# The toy package

The folder a builder hands back for one toy, so that a lane can port it into a pack in a short job.
Everything the port needs is in the folder: the recipe, the facts about the toy, the files, the
record of how it was made, and the proof it works. A package that is missing a piece is not done.

A package is for a toy. A report (a task like T7 or T10) hands back a document instead; see
[HANDBACK.md](HANDBACK.md).

## The folder

```
<toy-id>/
  recipe.mjs        the Kit recipe (build, drive, controls, action, prepare)
  manifest.json     the baked asset's facts: tiers, parts, bounds, the source, the credit
  assets/           the tier files (<id>-<splats>-<k>.bkd.gz) and any extra assets
  record.md         how it was made and what was checked (the template is in HANDBACK.md)
  screenshots/      <toy-id>-390x844.png and <toy-id>-1440x900.png
  clips/            one clip per effect (a GIF or MP4), and optionally its filmstrip
```

The folder name is the toy's id: lower-case letters, digits, and hyphens, unique on the shelf. The
first four entries are what `tools/port-check.mjs` checks (below); `screenshots/` and `clips/` are
the proof ([HANDBACK.md](HANDBACK.md)). A kit-only toy with no baked asset has no `manifest.json` or
`assets/`; hand back `recipe.mjs`, `record.md`, and the proof, and say so in the record.

## `recipe.mjs`

The recipe is a module that exports the same shape a pack does. This is the Baked chest's, the
repo's own example (`src/packs/baked-demo.js`), written as a package's recipe:

```js
import { loadBaked, addBaked } from "../../src/baked.js";

const MANIFEST = new URL("./manifest.json", import.meta.url);
let ASSET = null;

export const RECIPES = {
  "baked-chest": {
    alive: false,
    controls: [{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      out.parts.lid = { angle: -1.85 * c.open };
    },
    async prepare(_o, _help, ctx) {
      ASSET = await loadBaked(MANIFEST, { budget: ctx?.count });
    },
    build(k) {
      addBaked(k, ASSET);
    },
  },
};
```

- **Import Splashery's own modules by relative path** (`../../src/kit.js`, `../../src/baked.js`, and
  `src/pc.js` for PlayCanvas), never a URL, a CDN, or a bare package name. Count the `../` for where
  your folder will sit; a port fixes the path. The checker blocks the rest (D1, D2).
- **Load files in `prepare()`**, which runs once before `build()`. Its third argument carries the
  toy's splat budget as `ctx.count`, so the recipe loads the tier that fits. How the loading and
  adding work is in [KIT-GUIDE.md](KIT-GUIDE.md), "Baked splats".
- The recipe is the contract with the Kit, so state in `record.md` the hooks you use, the units, the
  axes, each part's pivot, the part ids, the quaternion order, and the host APIs the recipe calls.

## `manifest.json`

**Don't write it by hand.** `tools/port-convert.mjs` writes it when it converts your splats (below),
and you fill in the credit. The Baked chest's, shortened:

```json
{
  "format": "splashery-baked-manifest",
  "version": 1,
  "id": "baked-chest",
  "title": "Baked chest",
  "source": {
    "file": "baked-chest.ply",
    "sha256": "4048903b…",
    "splats": 100001,
    "parts": "baked-chest.parts.json",
    "partsSha256": "39a1d060…",
    "up": "y"
  },
  "bounds": { "min": [-0.8, -0.005, -0.512], "max": [0.8, 1.206, 0.518] },
  "parts": [
    { "id": 0, "name": "body" },
    { "id": 1, "name": "lid", "pivot": [0, 0.86, -0.5], "axis": [1, 0, 0] }
  ],
  "defaultTier": 30000,
  "tiers": [
    {
      "splats": 30000,
      "bytes": 423480,
      "files": [
        {
          "path": "assets/baked-chest-30000-0.bkd.gz",
          "splats": 30000,
          "bytes": 423480,
          "sha256": "31ecfe0e…"
        }
      ]
    }
  ],
  "credit": {
    "title": "…",
    "author": "…",
    "source": "…",
    "license": "CC0 1.0",
    "licenseUrl": "…",
    "checked": "2026-10-12",
    "changes": "…"
  }
}
```

| Field               | Meaning                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `version` | `"splashery-baked-manifest"` and `1`.                                                                                                       |
| `id`, `title`       | The asset's id (a to z, 0 to 9, hyphens) and its name.                                                                                      |
| `source`            | The PLY it came from: `file`, `sha256`, `splats`; the sidecar's `parts` and `partsSha256`; `up`.                                            |
| `bounds`            | `min` and `max` of the largest tier, in the recipe's coordinates.                                                                           |
| `parts`             | `[{ id, name, pivot?, axis? }]`: id 0 is the body, then at most 15 moving parts.                                                            |
| `defaultTier`       | The tier a page loads when it gives no budget (optional).                                                                                   |
| `tiers`             | Each tier's `splats` and `bytes`, and its `files` with each file's `path`, `splats`, `bytes`, and `sha256`.                                 |
| `credit`            | `title`, `author`, `source`, `license`, `licenseUrl`, `checked` (the date you checked the license), and `changes` (Rules B2).               |
| `nc`, `aiMade`      | `true` for an NC asset (B2) or an AI-made one (A3).                                                                                         |
| `extraAssets`       | Other files under `assets/` (a texture, a sound): `[{ path, title, author, source, license, licenseUrl, checked, changes, sha256?, nc? }]`. |

An original asset you made gets the author line "made by Ryan with <agent and model>" and the
license CC0 (Rules B4). Every other asset carries its source page, author, license, and the date you
checked it on the live page ([CREDITS-GUIDE.md](CREDITS-GUIDE.md)). Size guidance is Rules D4: aim
for a default first load of 15 MB or less, bigger tiers opt-in up to about 40 MB, and no single file
over 20 MB. The checker warns about sizes and never fails on them; say in `record.md` when you go
over.

## `assets/`: the baked format and the converter

Splats come back as a **baked file**, in tiers. The format (`src/baked.js`, "BKD1") keeps each
splat's rotation, three sizes, color, opacity, and part id in **18 bytes** (about 14 gzipped), in
chunks of 65,536 splats (about 1.2 MB). The decoder needs no library.

You don't write the format. Make a standard **3DGS binary PLY** (binary little-endian, one `vertex`
element with `x y z`, `f_dc_0..2`, `opacity`, `scale_0..2`, and `rot_0..3`; normals and `f_rest_*`
are allowed and dropped), plus an optional **parts sidecar**, `<ply>.parts.json`, and convert it:

```sh
node tools/port-convert.mjs <in.ply> --out <toy-id> --id <toy-id> --tiers 100000,400000 --gzip
```

- `--tiers` adds smaller tiers, each an even sample of the PLY (the full PLY is the top tier). Give
  separately trained files as several PLYs: each is its own tier.
- `--up y|-y|z` says which way is up in your PLY (default `y`; Blender's is `z`).
- `--default <n>` picks the tier a page loads with no budget, and `--chunk <n>` sets splats per
  file.
- It writes `<toy-id>/manifest.json` and `<toy-id>/assets/<id>-<splats>-<k>.bkd.gz`. It **refuses a
  file that isn't a valid 3DGS PLY** (wrong layout, a wrong byte count, a non-finite value, a zero
  rotation). A manifest already in the folder keeps its credit, title, and notes.
- The splat budget picks the largest tier that fits, whole, and below the smallest tier thins that
  tier, the same splats every time. That is how Auto chooses.

**The parts sidecar** says which splats move together:
`{ "sha256": "<the PLY's sha256>", "parts": [{ "id": 1, "name": "lid", "pivot": [x, y, z], "axis": [x, y, z] }], … }`,
plus the part id of every splat as one of `ids` (an array), `ids_b64` (base64 bytes), `ids_file` (a
file of bytes beside it), or `ranges` (`[[first, end, id], …]`; splats in no range are the body). A
PLY may carry the ids itself as a vertex property called `part`, `part_id`, or `segment`. Part ids
go from 1 to 255, and a kit toy moves at most 15. The full description is at the top of
`tools/port-convert.mjs`.

The repo's example, the Baked chest, shows every piece: `tools/bkd-bake-chest.mjs` bakes it (a PLY
and a sidecar), `tools/port-convert.mjs` converts it, and `assets/toys/baked-chest/` holds the
result.

## `record.md`

The record is the honest account of the package: who made it, how, with what, what was checked, and
how fast it is. The template is in [HANDBACK.md](HANDBACK.md), "The record". Copy it and fill in
every section; write "unmeasured" or "none" instead of leaving one empty. The checker looks for its
"Rule check" line.

## `screenshots/` and `clips/`

- Two screenshots at 390×844 and 1440×900, named `<toy-id>-390x844.png` and `<toy-id>-1440x900.png`.
  `node builders/screenshot.mjs <dir> <toy id>` makes them for a toy that is in the shelf; for a
  Workshop package, shoot the project's page at those sizes.
- One clip per effect (the tap, and any other effect), a looping GIF or MP4 at phone size, made with
  `tools/effect-clip.mjs` where the toy runs in the Playground. Effects are judged as motion (the
  bar in [KIT-GUIDE.md](KIT-GUIDE.md)); a still of a motion isn't proof.

## Checking a package

Run the checker on the folder, and put its output in the record:

```sh
node tools/port-check.mjs <toy-id> [--json]
```

It checks everything in [RULES.md](RULES.md) that a machine can check, prints what **blocks** a port
and what only **warns**, and exits 1 only on a block. Real output for the Baked chest's package with
an empty record:

```
warn   record.md has no "Rule check" line (none, or the rules it touches).
note   Tier of 30000 splats: 0.40 MB in 1 file(s).
note   Tier of 100001 splats: 1.34 MB in 2 file(s).

Nothing blocks the port (1 warning).
```

**Blocks:** a missing piece (`recipe.mjs`, `manifest.json`, `assets/`, `record.md`); an external URL
in an import or a fetch, or any CDN (D1); PlayCanvas reached any way but `src/pc.js`, or a bare
module name (D1, D2); a secret or token such as `hf_…` (C1, E3); a file under `assets/` that the
manifest doesn't list, a listed file that is missing or whose hash doesn't match, an asset with no
source or no license, or a license outside B1; an NC asset without `"nc": true` (B2); more than 15
moving parts; and a British spelling in the record or the manifest's text (E4). **Warns:** a default
tier over 15 MB, a largest tier over 40 MB, a file over 20 MB (D4: guidance, never a failure); a
British spelling in a string in the code (it may be a key that stays as it is); a URL in the code
outside an import; a recipe with no `prepare()`; an AI-made asset (A3: label it); and a record with
no "Rule check" line.

The checker can't judge motion, license pages, or taste. A clean run isn't acceptance: the checks in
[HANDBACK.md](HANDBACK.md) and the owner's review still apply. Also run
`node tools/nc-assets.mjs --check` if you touched the asset lists.

## Where a package goes

- **A Workshop package** (tasks T3 and T8) goes under `workshop/<project>/` in a pull request, or in
  your sandbox repo. See [WORKSHOP.md](WORKSHOP.md).
- **A package for a pack** (a kit toy the owner already approved) goes in the pull request as the
  folder above, and the Operator starts a lane that ports it.

Either way, [HANDBACK.md](HANDBACK.md) says how to hand it back.
