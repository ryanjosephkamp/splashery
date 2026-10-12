# The toy package

The folder a builder hands back for one toy, so that a lane can port it into a pack in a short job.
Everything the port needs is in the folder: the recipe, the facts about the toy, the files, the
record of how it was made, and the proof it works. A package that is missing a piece is not done.

A package is for a toy. A report (a task like T7 or T10) hands back a document instead; see
[HANDBACK.md](HANDBACK.md).

## The folder

```
<toy-id>/
  recipe.mjs        the Kit hooks (build, drive, controls, action) for the toy
  manifest.json     the facts: identity, tiers, parts, credits, who made it
  assets/           the files, one folder per tier (tier-low/, tier-mid/, …)
  record.md         how it was made and what was checked (the template is in HANDBACK.md)
  screenshots/      <toy-id>-390x844.png and <toy-id>-1440x900.png
  clips/            one clip per effect (a GIF or MP4), and optionally its filmstrip
```

The folder name is the toy's id: lower-case words joined by hyphens, unique on the shelf.

## `recipe.mjs`

The recipe is a module that exports the same shape a pack does:

```js
export const RECIPES = {
  "<toy-id>": { alive, options, controls, action, drive(t, c, out, info) {}, build(k, o) {} },
};
```

Write it the way [KIT-GUIDE.md](KIT-GUIDE.md) describes, importing from the kit as a pack does
(`../kit.js`; a port changes only the import path). The recipe is the contract with the Kit, so
state in `record.md`: the hooks you use, the units, the axes, each part's pivot, the part ids, the
quaternion order, and the host APIs the recipe calls. A recipe that loads files names them (see
`assets/`, below) and does so in a `prepare()` hook, as Real Objects does.

## `manifest.json`

```json
{
  "id": "gift-box",
  "title": "Gift box",
  "shelf": "objects",
  "labs": true,
  "kind": "kit",
  "tiers": [
    { "name": "low", "splats": 60000, "bytes": 0, "files": [] },
    { "name": "mid", "splats": 140000, "bytes": 0, "files": [] },
    { "name": "high", "splats": 200000, "bytes": 0, "files": [] }
  ],
  "parts": [{ "id": "lid", "pivot": [0, 0.35, -0.5], "axis": [1, 0, 0] }],
  "assets": [
    {
      "file": "assets/high/gift-box.bin",
      "sha256": "<64 hex characters>",
      "title": "Gift box (original)",
      "source": "original: made for Splashery",
      "author": "made by Ryan with <agent and model>",
      "license": "CC0 1.0",
      "dateChecked": "2026-10-12",
      "changes": "Modeled and baked with Blender 4.x; no outside assets."
    }
  ],
  "madeBy": { "agent": "<agent>", "model": "<model>", "date": "2026-10-12", "task": "T3" }
}
```

Fields:

- **id, title, shelf**: the id, the shelf name (a `category` in `src/toys.js`, such as `objects`,
  `science`, `tools`), and the label the visitor sees. Put `"labs": true` on anything new.
- **kind**: `"kit"` for a recipe that builds the toy from the kit alone, `"asset"` for a recipe
  backed by files.
- **tiers**: each splat count the toy supports, with its total `bytes` and the `files` it needs. The
  device's Auto budget picks the tier (low 60,000, mid 140,000, high 200,000, and max 280,000 splats
  are the default counts in `src/generators.js`, `PROFILES`). A kit-only toy lists the counts it was
  checked at and zero bytes. Size guidance is in Rules D4: aim for a default first load of 15 MB or
  less per toy, bigger tiers opt-in up to about 40 MB, and no single file over 20 MB. Say in
  `record.md` when you go over.
- **parts**: every part id the recipe uses, with its pivot and axis, in the recipe's units.
- **assets**: one entry per file or source, with the **source page, author, license, date checked,
  sha256, and what you changed** (Rules B2). An original asset you made gets the line "made by Ryan
  with <agent and model>" and the license CC0 (Rules B4). An NC asset carries `"nc": true`. See
  [CREDITS-GUIDE.md](CREDITS-GUIDE.md).
- **madeBy**: the agent and model that made the package, the date, and the task id.

Make the hashes with `shasum -a 256 <file>` (Mac) or `sha256sum <file>` (Linux).

## `assets/`

The files, one folder per tier, named for the tier. Keep file names plain and lower case.

**The asset format and its tools are coming with the Baked engine PR.** The owner's Baked engine
lane is building a compact baked-splat format (rotation, three sizes, color, opacity, part), a
converter, `tools/port-convert.mjs` (a 3D Gaussian splat `.ply` to the format), and a checker,
`tools/port-check.mjs` (the rules that a machine can check). Until that merges, hand back your
splats as a standard 3DGS `.ply` per tier, with a per-splat part id written to a side file
(`parts.json` or a `.bin` of one byte per splat) and say so in the record. The Operator will update
this section when the engine PR lands, and your package will be converted then.

## `record.md`

The record is the honest account of the package: who made it, how, with what, what was checked, and
how fast it is. The template is in [HANDBACK.md](HANDBACK.md), "The record". Copy it and fill in
every section; write "unmeasured" or "none" instead of leaving one empty.

## `screenshots/` and `clips/`

- Two screenshots at 390×844 and 1440×900, named `<toy-id>-390x844.png` and `<toy-id>-1440x900.png`.
  `node builders/screenshot.mjs <dir> <toy id>` makes them for a toy that is in the shelf; for a
  Workshop package, shoot the project's page at those sizes.
- One clip per effect (the tap, and any other effect), a looping GIF or MP4 at phone size, made with
  `tools/effect-clip.mjs` where the toy runs in the Playground. Effects are judged as motion (the
  bar in [KIT-GUIDE.md](KIT-GUIDE.md)); a still of a motion isn't proof.

## Checking a package

When `tools/port-check.mjs` exists, run it on the folder and put its output in the record. Until
then, check by hand and say that you did: the manifest is valid JSON; every file the manifest names
exists and its hash matches; every part id in the recipe is in `parts`; every asset has its full
record; `node tools/nc-assets.mjs --check` passes if you touched the asset lists.

## Where a package goes

- **A Workshop package** (tasks T3 and T8) goes under `workshop/<project>/` in a pull request, or in
  your sandbox repo. See [WORKSHOP.md](WORKSHOP.md).
- **A package for a pack** (a kit toy the owner already approved) goes in the pull request as the
  folder above, and the Operator starts a lane that ports it.

Either way, [HANDBACK.md](HANDBACK.md) says how to hand it back.
