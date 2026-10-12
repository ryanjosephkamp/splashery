# Credits guide

Every asset carries its record (Rules B2), and every piece of agent-made work carries the maker's
line (Rules B4). This guide shows where each goes, with a real example from the repo. The rules
behind it are in [RULES.md](RULES.md), section B.

## The records, in order

For each asset you bring in (a scan, a model, a texture, a sound, a dataset):

1. **Check the license on the live source page**, today, and write down the date. Never go by a
   mirror, a search result, or memory. Allowed: CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, public
   domain, and NASA 3D Resources (insignia removed). Never NoDerivatives (ND), unlicensed, "personal
   use", paid, or scraped (Rules B1). If you can't open the page, you can't use the asset.
2. **Record it in four places**: `CREDITS.md`, `tools/assets.json` or `tools/models.json`, the toy's
   catalog entry (or recipe), and the toy's in-app credit. Each is below.
3. **Hash the file** (`sha256`) and record what you changed. Your handback's record has a table for
   this ([HANDBACK.md](HANDBACK.md)); the toy package's manifest has the same fields
   ([TOY-PACKAGE.md](TOY-PACKAGE.md)).

## 1. A `CREDITS.md` entry

`CREDITS.md` has a table per group of toys. Add a row in the right table (or start a table), with
the toy, the work as a link to its source page, the author, and the license as a link to its deed. A
row in the shape of the real one for the rubber duck:

```md
| Toy | Model | Author | License | | Real rubber duck |
[Rubber Duck Toy](https://polyhaven.com/a/rubber_duck_toy) | Plat251 |
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
```

Where a table has a "Changes" column, say what was done to the asset (converted, decimated,
recentered, scaled, painted out). Add a line below the table if the asset's own page asks for
something more.

## 2. `tools/assets.json` and `tools/models.json`

- `tools/models.json` lists 3D models that a tool turns into splats. Its fields: `id`, `name`,
  `source` (how the tool finds it, for example `polyhaven:rubber_duck_toy`), `page` (the live source
  page), `author`, `license`, and `splats`.

  ```json
  {
    "id": "rubber-duck-real",
    "name": "Rubber Duck Toy",
    "source": "polyhaven:rubber_duck_toy",
    "page": "https://polyhaven.com/a/rubber_duck_toy",
    "author": "Plat251",
    "license": "CC0 1.0",
    "splats": 200000
  }
  ```

- `tools/assets.json` lists the files a toy loads and where they came from. Its fields: `id`,
  `label`, `source` (a URL or a local path), `sourceNote` (the page, the license, the date you
  checked it), `rotate`, `splats`, `lite`, and for a license that needs it, `license`, `author`, and
  `nc`. The same duck's record there:

  ```json
  {
    "id": "rubber-duck-real",
    "label": "Rubber Duck Toy",
    "source": ".cache/models/rubber-duck-real/rubber-duck-real.ply",
    "sourceNote": "Made by tools/mesh-to-splats.mjs (see tools/models.json) from the CC0 model https://polyhaven.com/a/rubber_duck_toy",
    "rotate": [0, 0, 0],
    "splats": 200000,
    "lite": 80000
  }
  ```

Add only your own lines (see [REPO-MAP.md](REPO-MAP.md)). If your task has no splat files yet (a
sourcing task, or a Workshop package), keep these records in your package's manifest and hand them
back for the Operator to enter.

## 3. The `nc` flag

An asset under CC BY-NC or CC BY-NC-SA carries `"nc": true` in `tools/assets.json` or
`tools/models.json`, so one command lists every NC asset to take out if the site ever earns money:

```sh
node tools/nc-assets.mjs            # lists them
node tools/nc-assets.mjs --check    # exits 1 if an NC license lacks "nc": true, or any ND license appears
```

A real example (the dog plush, CC BY-NC 4.0):

```json
{
  "id": "dog-plush",
  "license": "CC BY-NC 4.0",
  "author": "PrintedForFun",
  "nc": true,
  "sourceNote": "… (downloads enabled, CC BY-NC 4.0, by PrintedForFun). Checked on its live page October 3, 2026."
}
```

Run `--check` before you hand anything back. Anything made from an NC asset keeps its license. Never
merge an NC asset and a BY-SA asset into one asset (side by side in a scene is fine). BY-SA assets
(and anything made from one) stay BY-SA, with the notice beside them.

## 4. The in-app credit line

The credit the visitor sees comes from the toy's catalog entry in `src/toys.js` (a captured toy's
`credit`) or from the recipe (a kit toy built on an asset has a `credits: […]` array). A real
`credit`, from the rubber duck:

```js
credit: {
  title: "Rubber Duck Toy",
  author: "Plat251",
  source: "https://polyhaven.com/a/rubber_duck_toy",
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  changes:
    "Turned into splats from the textured 3D model (tools/mesh-to-splats.mjs), recentred and scaled.",
},
```

A recipe's `credits` entries have the same fields plus a `label` (see the water bottle in
`src/packs/real-objects.js`). The license notice must show beside the asset for BY-SA and NC assets.
New public text in this credit is American English with the serial comma (Rules E4).

## 5. Your own work: "made by Ryan with <agent and model>" (Rules B4)

Code an agent writes for Splashery is offered under Splashery's MIT license. Original assets an
agent makes (procedural models, baked splats, sounds) are CC0. Both are credited as:

> made by Ryan with <agent and model>

For example, "made by Ryan with Codex (GPT-6.1 Sol)" or "made by Ryan with the Dot (ChatGPT agent)".
Put the line in four places:

1. **`CREDITS.md`**: an entry for the toy or asset, with the line and the license (CC0 for assets;
   MIT for code, which needs no row of its own beyond the toy's).
2. **The asset lists**: for an original asset, a `tools/assets.json` or `tools/models.json` entry
   with `author` set to the line and `license` set to `CC0 1.0`, and a `sourceNote` that names the
   tool and version that made it.
3. **The toy's in-app credit**: `author: "Ryan, with <agent and model>"` and `license: "CC0 1.0"`
   (the Dot samples' credit in `src/packs/dot-samples.js` shows the shape for owner-made work).
4. **Your handback's record** (identity and generation sections).

Name the model you actually ran on. If you don't know it, say so; don't guess.
