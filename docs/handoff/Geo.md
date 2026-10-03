# Lane Earth and maps (prefix `geo`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Earth and maps (id `Geo`, prefix `geo`).
Your folder is a git worktree on `claude/lane-geo`. Your port: 4184. PR title: "Phase Earth and
maps: terrain, oceans, weather and cities as splats". Handoff file: docs/handoff/Geo.md (this file;
your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's notes that afternoon)

The owner, on October 3, 2026: "geospatial terrain ideas (maybe moving cities, dynamic landscapes,
oceans, real architecture, weather forecast meteorology maps, other kinds of maps, etc.)". A new
labs shelf, "Earth and maps", of about eight toys, each of which moves.

#### What to build

1. **A real landscape** from public-domain elevation (USGS 3DEP or NASA SRTM), colored from
   public-domain imagery (Landsat or USGS NAIP): the Grand Canyon or Yosemite Valley, say. A tap
   sweeps the sun from dawn to dusk, or floods the valley and drains it.
2. **Mount St. Helens** before and after May 18, 1980 (USGS elevation from both dates): a tap
   replays the change.
3. **The sea floor** (GEBCO or NOAA bathymetry): a ridge or a trench under an ocean surface that
   drains away on a tap and fills back.
4. **Waves and tides.** An ocean surface with real wave motion, and a harbor whose water rises and
   falls with a real tide curve (NOAA, public domain).
5. **Weather over land.** A snapshot of a real storm or hurricane (NOAA and GOES imagery and wind
   fields, public domain): clouds turn, rain bands sweep, wind lines flow; a tap plays its day.
6. **A living city.** Kit-built blocks with cars and trains moving along the streets and windows
   lighting up at night. Real buildings only from CC0 or CC BY captures (OpenStreetMap is ODbL, not
   on the license list: ask the Operator first).
7. **A relief map** with contour lines and layers (height, rivers, rainfall), from public-domain
   data.
8. **Earthquakes.** A year of the USGS catalog (public domain) as flashes under a relief, played as
   a timeline.

Data are snapshots turned into splats at build time (`tools/geo-*.mjs`). The page never calls a data
service: a live-data toy would need the owner's yes first, like the Wikipedia book. If
docs/audits/new-sources-2026-10.md (the owner's Dot is researching sources) has landed on main, use
it.

#### You own

`src/packs/geo.js`, `src/geo/` if needed, `tools/geo-*.mjs`, `assets/toys/<your toys>/`,
`tests/geo*.spec.mjs`, your toys' entries in the shared lists, your engine PR's module, and this
file.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4184), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-Geo`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-geo-engine`, merged first; toys not using it behave exactly as
  before.
- Every new toy is behind the labs switch (`labs: true`). Old `#s=` links and saved scenes keep
  loading.
- Every effect follows the effect quality rules in CLAUDE.md (real motion of solid pieces, separate
  things moving separately, break-apart into real pieces that come back), judged as phone-size
  clips, and works with the toy upright, on its side and upside down.
- Licenses, for every asset and dataset (CLAUDE.md, "Ground rules"): read the license on the live
  source page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's
  in-app credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A license
  not on that list (ODbL, CERN-OHL, government terms, "free with attribution") is a question for the
  Operator in "State", not a file in the repo. Nothing human (people, faces, human anatomy or human
  scans) without the owner's yes. No logos or brand names.
- A static site: data becomes splats at build time (your `tools/geo-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Earth and maps: …", five
  sections from CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and
  run long jobs (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/PACKS.md; docs/handoff/Fluids.md (water surfaces) and docs/handoff/Science.md;
  docs/BACKLOG.md (the earthquake idea); docs/audits/dot-jobs-2026-10.md (job J04, earthquake data).
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: not started yet (October 3, 2026).
