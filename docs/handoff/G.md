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

In progress on `claude/lane-g-image-to-3d` (2026-09-27).

- `HF_TOKEN` checked with whoami: account `ryanjosephkamp`, role `read`.
- Space: `trellis-community/TRELLIS` (ZeroGPU, MIT; runs `microsoft/TRELLIS-image-large`, MIT;
  background removal is `rembg` with `u2net`, Apache-2.0). `microsoft/TRELLIS` itself is down
  (config error). `tencent/Hunyuan3D-2` and `-2.1` run too, but their Tencent community licence
  excludes some regions and outputs a mesh, so they were not used.
- `tools/image-to-3d.mjs` runs one photo through the Space with plain fetch (no new devDependency)
  and saves the cut-out, the Space's turntable and the Gaussians (PLY) to `.cache/g/out/<name>/`.
  One run takes about 30 s of wall time.
- `tools/splat-views.mjs` renders a PLY from four sides in the real app. TRELLIS PLYs need
  `rotate: [180, 0, 0]`, like the SuperSplat scans.

## Notes

## Known issues

## For the Operator

Lessons for PACKS.md, backlog items and README lines, to move after the merge.
