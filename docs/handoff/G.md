# Lane G: AI image-to-3D trial

Prefix `g`. Owns the new tool scripts it adds in `tools/`, new `assets/toys/<id>/` folders, the new
toys' rows in `src/toys.js`, `tools/assets.json`, `CREDITS.md` and `LICENSES.md`, `tests/g.spec.mjs`
and this file (docs/WORKSTREAMS.md). How lanes work: [OPERATING.md](../OPERATING.md). Earlier
phases' notes and lessons: [history.md](history.md).

## Brief

Written by the Operator on 2026-09-26 from the G outline in the old HANDOFF.md:

- Check `HF_TOKEN` (whoami, printing only name and role). Never print the token or put it in files,
  logs or PRs (CLAUDE.md). It was checked on 2026-09-24 (account `ryanjosephkamp`, role `read`). If
  it is ever missing or rejected, tell the owner exactly what to change: the cloud environment menu
  in the session's title bar, then Edit, then an environment variable named `HF_TOKEN`.
- Try a public Space through its API from a tool script in `tools/`. TRELLIS outputs Gaussians
  directly; Hunyuan3D is an alternative.
- Inputs are our own CC0 images, such as renders (`tools/toy-shots.mjs` renders toys to PNG). Check
  the model and output licences.
- Set a quality bar against the procedural toys, and only ship results that beat them.
- The free GPU quota is limited. If anything would cost money, stop and ask the owner.

Anything shipped is a new scan toy: packed with `tools/prepare-assets.mjs` (SOG), listed in
`src/toys.js` and `tools/assets.json`, credited in `CREDITS.md` and the toy's in-app credit, its
licence in `LICENSES.md` (CC0, CC BY or public domain only; never BY-SA or NC). Build tools may use
pinned devDependencies listed in `LICENSES.md`, but a new devDependency changes `package.json`,
which the Operator keeps: ask it first. Keep "embed transfer ≤ 30 MB" green.

Show the owner what was tried on a short report page with side-by-side pictures, post clips of any
new toys on the Effect review page, and keep notes here.

PR title: "Phase G: AI image-to-3D trial".

## State

PR #43 (the two scans and their default looks) merged on 2026-09-27. Now: looks for the two scans,
in the engine PR #47 ("Engine: looks for captured toys", branch `claude/lane-g-looks-engine`, merge
first) and the lane PR "Phase G: pencil colors and can labels" (branch `claude/lane-g-looks`, built
on the engine branch). Report page: https://claude.ai/artifact/GFHZX3NF5DA4Vs39s8BGbY. Clips: cards
`g-pencil-real` and `g-tin-can-real` on the Effect review page.

- `HF_TOKEN` checked with whoami: account `ryanjosephkamp`, role `read`.
- Space: `trellis-community/TRELLIS` (ZeroGPU, MIT; runs `microsoft/TRELLIS-image-large`, MIT;
  background removal is `rembg` with `u2net`, Apache-2.0). `microsoft/TRELLIS` itself is down
  (config error). `tencent/Hunyuan3D-2` and `-2.1` run too, but their Tencent community licence
  excludes some regions and outputs a mesh, so they were not used.
- `tools/image-to-3d.mjs` runs one photo through the Space with plain fetch (no new devDependency)
  and saves the cut-out, the Space's turntable and the Gaussians (PLY) to `.cache/g/out/<name>/`.
  One run takes about 30 s of wall time and asks for 120 s of GPU quota.
- `tools/splat-views.mjs` renders a PLY from several sides in the real app. TRELLIS PLYs need
  `rotate: [180, 0, 0]`, like the SuperSplat scans.
- Shipped: **Real pencil** (`pencil-real`, CC BY 2.0 photo by Tim Reckmann; tap: a flick spins it
  flat, two turns) and **Real tin can** (`tin-can-real`, CC0 photo by Ll1324; tap: knocked onto its
  rim, spins round like a settling coin and drops flat).
- Failed: fountain pen (the thin nib broke into spikes).
- Owner's review (2026-09-27): both "look great", but the defaults should look like the real thing,
  not blank. `tools/g-looks.mjs` now paints them over the scan's own shading (each splat's colour
  scaled by its brightness against its region's median): the pencil is a classic yellow pencil
  (yellow body, silver ferrule, pink eraser, bare wood cone, graphite point, a plain "HB" mark); the
  can wears an original vintage-style "Peaches" label (CC0, drawn by the tool in Chromium's canvas)
  on its side only, with the rims and lid left metal. Cards `g-pencil-real-r2` and
  `g-tin-can-real-r2`; the old cards are marked replaced.
- Real labels: every real can label found (Commons, label archives) carries a brand name, so none is
  used. Commons' API rate-limited this container (HTTP 429), so the search there was short.
- Looks (owner: "Yes to looks", "Peaches is good"): a captured toy lists `looks` in `src/toys.js`,
  and the Toy tab's Look choice loads that look's files; only the look's id goes into links. Pencil:
  Yellow (default), Red, Blue, Green, Black, Plain wood, Original (the bare scan). Can: Peaches
  label (default), Tomatoes label, Plain metal, Original. The files are `<id>-<look>.sog` and
  `-lite.sog`, from `node tools/g-looks.mjs pencil-real tin-can-real --all`. Clips: cards
  `g-pencil-looks` and `g-can-looks`, rendered with `tools/g-looks-clip.mjs`.
- Separate files, not a load-time recolor: the labels are pictures, which a region recolor cannot
  paint without a new texture pass; files keep the engine change small, and only the chosen look is
  downloaded. About 1 MB per extra pencil look and 2 MB per extra can look (each with its lite
  file).
- Waiting on quota: the clear water bottle (CC0 photo ready). The free ZeroGPU quota ran out after
  four runs.
- Report only: the red water bottle and the running shoe are rawpixel previews with a watermark, and
  their licence pages block automated checks, so they cannot ship.
- No usable photo: soda can (all branded or cropped) and hoodie (worn, branded or tiny).

## Notes

- Inputs: shrink photos to 1024 px first (the Space works at 518 px). The Space cuts out the
  background itself unless the PNG has alpha.
- The side the photo cannot see is a guess: the pencil's underside came out dark, so a roll showed
  it. Taps that keep the photographed side towards the camera work better (the spin).
- Painting a scan: paint every splat of a region, not only the outer layer. Unpainted splats just
  under the surface showed through as pale speckle under dark paints (black, blue). Under dark
  colors, shade by brightness averaged over about 1 cm, so fine grain does not turn into speckle.
- The lite SOG at 80,000 splats made the can's wall see-through on the weak profile; it uses 160,000
  (1.9 MB).
- Our own kit renders come back as faithful copies of the cartoon toy, so photos are the way to get
  a real look.

## Known issues

- The tin can's photo glare is softened under the label but still shows faintly on the metal and on
  the label's cream bands.
- The pencil's unseen underside (the model's guess) is a darker yellow; the spin shows it briefly.
- The pencil is short (the photo is of a stubby pencil).

## For the Operator

- PACKS.md lesson: a captured toy can offer looks (`looks` in `src/toys.js`, engine PR #47); each
  look is a finished pair of files, checked from several sides before it ships.

- A full test run also rewrites lanes' own screenshots (`e5-*`, `e6a-*`), which
  `node tools/upkeep.mjs --restore-shots` does not put back; lanes need
  `git checkout -- tests/screenshots/` too. Maybe restore every screenshot the branch did not
  change.
- PACKS.md lesson: an image-to-3D scan's unseen side is a guess; pick taps that do not show it.
- Backlog: owner's own phone photos (released as CC0) would unlock the soda can, running shoe and
  hoodie; Poly Haven also has `russian_food_cans_01` and `stationery_supplies` (CC0) for
  mesh-to-splats.
