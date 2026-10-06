# Lane Earth and maps (prefix `geo`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State

READY (October 6, 2026, round 3 on `claude/lane-geo-r2`, a draft PR stacked on #268): the owner's
marks of 22:48 UTC. Good: Grand Canyon r3, hurricane r2, relief map r2, sea floor r2. Fixed in round
3 (below) and posted as cards `geo-living-city-r3`, `geo-earthquakes-r4`, `geo-st-helens-r4`,
`geo-stork-migration-r4` and `geo-tide-harbor-r4` on Effect review page 2. Once #268 merges: merge
main into the branch and point the PR at main. Model: Opus 5.5.

### Round 3: what changed (the owner's marks of October 5, 2026)

- **Living city** ("too much like a cartoon"; "I'm fine with the Helsinki open reality mesh"): a
  real 550 m block of central Helsinki (Senate Square and the Cathedral, the Market Square, the
  South Harbor, the Uspenski Cathedral) from the City of Helsinki's 2017 reality mesh (CC BY 4.0,
  checked on the HRI record and hel.fi, October 5, 2026). `tools/geo-city.mjs` reads only the 144
  level-18 pieces it needs (about 25 MB) out of the 2 GB zip with HTTP range requests, crops the
  block, and samples it into about 590,000 splats with the Studio's converter
  (`src/packs/studio-models-core.js`). The snapshot is 5.2 MB (`city.bin.gz`), loaded only when the
  toy opens. The tap still turns day to night: the city dims under a blue sky (a quarter-density
  night copy) while the street lamps and windows come on, each lamp lighting a warm pool of street.
  The kit-built cars and train are gone (they would look cartoonish on a real city).
- **Earthquakes** ("still needs to be sharper"; "the text below the planet"): the globe has about
  one point per picture pixel, a thin layer of air at the limb (kind "rim"), a slightly bluer deep
  ocean, crisp quake dots with no glow at rest, and the plaque is a grid of square pixels (two to
  each pixel of the letters).
- **St. Helens** ("smoke isn't realistic"): the ash column is ten stacked parts of cauliflower
  billows (balls of lumpy balls, surfaces only), each rising from the vent and swelling as it rises,
  dark and dense low down and paler above, lit by the sun on one side, spreading at the top and
  drifting east on the wind, which carries it off at the end. The blast's clouds race out at their
  own reach and moment and settle as ash. No part is shown half-visible (that draws as a speckle).
- **Storks** ("too cartoonish"): like a real tracking map: thin tracks on the ground (one small
  splat every 2.5 thousandths; gaps over two days in the fixes left blank), each bird a small white
  dot with a dark rim, crisp month labels and a time bar that lights as the season plays.
- **Tide harbor** ("sharper, especially the tide meter"): the meter is a chart of square pixels that
  leans toward the viewer, the water under the curve filled, lines every six hours and at mean sea
  level, the hours written under it, and a crisp dot riding the curve (re-sorted while it moves).
- A helper for all of these: `pixelPanel` and `dot` in `src/packs/geo.js`. The clips are rendered at
  780 × 1040 (a phone's real pixels) instead of 390 × 520.

### Round 2: what changed

- **Why round 1 looked soft.** Random (even) surface placement with the kit's base splat size, a
  192-sample height grid and 320-pixel imagery, clips rendered without labs (so without the sharp
  kernel), and GIF's 256 colors.
- **The land as a grid** (`addGrid` in `src/geo/terrain.js`, after Science r3's terrain box, whose
  clips the owner marked good): one flat splat per grid sample facing up its slope, sized to the
  grid spacing, no random placement, steep drops filled down to the lower neighbor (the Grand
  Canyon's walls now show their rock layers); the cut sides and the water sheets are grids too.
- **Finer data:** 512 × 512 heights (delta-coded and gzipped, `.bin.gz`), the aerial imagery as
  1024-pixel JPEGs, the hurricane's infrared at 384 pixels (one cloud splat per pixel).
- **Photoreal imagery:** the earthquakes' globe, the storks' map and the hurricane's map use NASA's
  Blue Marble Next Generation (true color, public domain).
- Every toy has `kernel: "sharp"` and `density: 2` (1.6 for the globe), and the clips come from
  `tools/geo-clip.mjs` (labs on, phone width, lossless frames to MP4).

### Photoreal sources (the Operator's ask: say what's possible before building anything big)

- **A photoreal city: Helsinki's reality mesh** (City of Helsinki, CC BY 4.0, checked on the HRI
  CKAN record `helsingin-3d-kaupunkimalli`, October 5, 2026): a textured photogrammetric mesh of the
  whole city from aerial photographs, as OBJ in 2 km tiles (0.1 to 1.8 GB each, at
  https://3d.hel.ninja/data/mesh/Helsinki3D-MESH_2017_OBJ_2km-250m_ZIP/), each with coarser levels
  of detail inside. One tile's coarse level run through `tools/model-to-splats.mjs` would give a
  real, photoreal city block (Senate Square or the harbor) as splats; the traffic, train and night
  could ride on it as tokens and a light layer. Cost: a download of about 0.5 to 2 GB at build time
  and a converted file of perhaps 5 to 15 MB (budget it like the photoreal toys). Credit: "City of
  Helsinki, CC BY 4.0". Also: Kalasatama in more detail (CC BY 4.0, a 6 GB Zenodo record,
  doi:10.5281/zenodo.7599228, Aalto University), too big to start with.
- **A CC0 city: Zürich's 3D city model** (Open Data Zürich, CC0 per its search listing; not yet
  checked on the live page): about 50,000 buildings as LOD2 OBJ with photogrammetric roofs, but
  untextured, so a cleaner kit-like city rather than a photoreal one.
- **Lidar point clouds: USGS 3DEP** (public domain): colored point clouds of US cities (where a
  project carries RGB), which become splats directly; the owner approved a LAZ reader on October
  4, 2026. Walls are sparse from the air, so it reads best from above.
- **Photoreal terrain:** the terrain toys already use USGS NAIP imagery at about 20 m a pixel (Grand
  Canyon) to 1 m (Bar Harbor); finer imagery is possible (NAIP is 1 m everywhere in the US) at a
  larger file size.
- My suggestion: a "Helsinki" photoreal city toy from one reality-mesh tile, as its own small item
  once the Operator says go.

### The toys (Earth and maps shelf, `geo`, all labs)

| Toy               | Data (all public domain unless noted)                              | Tap                                                  |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `grand-canyon`    | USGS 3DEP heights, The National Map imagery (NAIP, Landsat)        | Floods from the river to half depth and drains (8 s) |
| `st-helens`       | USGS pre-1980 DEM (doi:10.5066/P91W7C1L), 3DEP and imagery today   | Toggle: May 18, 1980 (collapse, blast, ash) / back   |
| `sea-floor`       | NOAA NCEI ETOPO1 (Mariana Trench)                                  | Drains the ocean and fills it back (9 s)             |
| `tide-harbor`     | NOAA NCEI coastal DEM, CO-OPS predictions (8413320), imagery       | Plays the October 28, 2026 spring tide (12 s)        |
| `hurricane`       | GOES-East band 13 (through NASA GIBS), NHC best track, Blue Marble | Toggle: Polo's day of rapid intensification / back   |
| `relief-map`      | 3DEP, NHD streams, NLCD 2021 land cover, imagery (Yosemite Valley) | A contour climbs, light runs down the streams (7 s)  |
| `living-city`     | City of Helsinki reality mesh (2017), CC BY 4.0                    | Toggle: night (lamps and windows come on) / day      |
| `stork-migration` | Rotics et al. 2016 white storks, Movebank (CC0 1.0); ETOPO1        | Plays July to October 2013 (14 s)                    |
| `earthquakes`     | USGS feed, live (snapshot when it can't be reached); ETOPO1        | Quakes flash in time order; the plaque refreshes     |

Tools: `tools/geo-lib.mjs` (TIFF and LZW reader, cached fetches, the snapshot writer),
`tools/geo-terrain.mjs` (the terrain blocks), `tools/geo-quakes.mjs`, `tools/geo-storm.mjs`,
`tools/geo-migration.mjs`, `tools/geo-city.mjs`. Toy code: `src/packs/geo.js`, `src/geo/data.js`,
`src/geo/terrain.js`.

### The live feed (CLAUDE.md, "Live data")

- The earthquakes toy fetches `2.5_week.geojson` or `4.5_month.geojson` from USGS only in its
  `prepare()` (when it opens, its feed option changes, or the plaque is tapped, which rebuilds it
  with a new `refresh` option). Nothing is requested before it opens (checked in
  `tests/geo.spec.mjs`), and nothing is stored or sent.
- The plaque under the globe and the About tab show the source, the feed and the fetch time ("USGS
  LIVE FEED ... FETCHED OCT 5 2026 AT 1234 UTC"), or "USGS FEED SNAPSHOT ... AS OF" when it fell
  back.
- The shipped snapshot (`assets/toys/earthquakes/snapshot.json`, October 5, 2026) keeps only records
  of networks us, hv, at and pt (USGS and NOAA authored), per the audit's C8 caution. The live view
  shows every network's records, credited "U.S. Geological Survey and its contributing networks".
- A browser driven by a tool (`navigator.webdriver`) uses the snapshot, so tests and clips never
  depend on the network; `?geofeed=live` overrides that (the spec mocks the feed with `page.route`).

### Migration sources (the owner's notes of October 4, 2026)

- **Movebank Data Repository** (datarepository.movebank.org): every published data package is CC0
  1.0, downloadable without a login, with a DOI. Used: Rotics et al. 2016 white storks
  (doi:10.5441/001/1.hn1bd23k). Others ready to use: LifeTrack White Stork Bavaria and Vorarlberg
  (2014–2023), wood storks of the southeastern US, ospreys and gulls. Movebank's live studies
  (movebank.org, not the repository) each carry their own terms and most need a login: use only the
  repository.
- Not verified from the container (eBird, OpenSky, UNHCR and the UN pages answered 403 or a bot
  check on October 5, 2026), so these are leads to check on the live pages before any use:
  - **eBird**: the brief notes its terms restrict reuse; assume not usable.
  - **Monarch butterflies**: Journey North's sightings carry no open license that I could confirm;
    GBIF records of _Danaus plexippus_ carry per-record licenses (CC0, CC BY, CC BY-NC), so a toy
    could keep only the CC0 and CC BY records.
  - **Flights**: the brief notes OpenSky allows non-commercial research only (not on our list), and
    most other flight feeds are paid; assume not usable.
  - **Human migration**: the UN International Migrant Stock page links only to the UN's general
    terms of use and copyright pages (a custom license, a question for the Operator); UNHCR's
    refugee statistics are said to be CC BY 4.0, unconfirmed. I did not build a human-migration toy.

### Notes and known issues

- Draw order: splats sort where they were built. Parts that move far ask for `out.resortPose` (the
  rising water, the hurricane's turning rings); tokens that travel ask for `out.resort` (the storks,
  the ash, the cars). The St. Helens 1979 surface morphs under today's and is then hidden, because
  morphs are not re-sorted.
- The hurricane's two infrared pictures cross-fade (a blend between real snapshots, said so in its
  About text). GIBS keeps GOES imagery only from about June 2026, so the storm is from this season.
- Bar Harbor's DEM is NAVD88, taken as mean sea level (they differ by about a decimeter there).
- The pre-1980 DEM covers 196 km² round the mountain; beyond it the 1979 surface is today's.
- Snapshots total about 8 MB, each loaded only when its toy opens (largest: the city, 5.2 MB).
- Rainfall on the relief map was cut: PRISM's terms are non-commercial and Daymet's were unclear;
  land cover (NLCD) took its place.

### For the Operator

- ODbL (OpenStreetMap) was not needed: the city is Helsinki's own mesh (CC BY 4.0).
- Licenses outside the list: GEBCO's extra terms and the UN migrant stock's terms (not used).
- A PACKS.md lesson: tokens and parts that travel far must ask for a sort while they move
  (`out.resort` for tokens, `out.resortPose` for parts), or nearer splats paint over them; morph
  targets are never re-sorted.

### Plan (done)

1. Data tools and the terrain block; 2. the Grand Canyon and the live earthquakes; 3. Mount St.
   Helens, sea floor, tides, storm, relief map, city, migration; 4. shared lists, tests, thumbs.
