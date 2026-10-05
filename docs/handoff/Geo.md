# Lane Earth and maps (prefix `geo`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State

WORKING (October 5, 2026): all nine toys are built and pushed on `claude/lane-geo` (draft PR #268),
with help, sounds, plan entries, credits, thumbnails and `tests/geo.spec.mjs`. Left: the shared
specs run, the clips on Effect review page 2, the screenshots, then READY. Model: Opus 5.5
throughout. No engine PR was needed.

### The toys (Earth and maps shelf, `geo`, all labs)

| Toy               | Data (all public domain unless noted)                              | Tap                                                  |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `grand-canyon`    | USGS 3DEP heights, The National Map imagery (NAIP, Landsat)        | Floods from the river to half depth and drains (8 s) |
| `st-helens`       | USGS pre-1980 DEM (doi:10.5066/P91W7C1L), 3DEP and imagery today   | Toggle: May 18, 1980 (collapse, blast, ash) / back   |
| `sea-floor`       | NOAA NCEI ETOPO1 (Mariana Trench)                                  | Drains the ocean and fills it back (9 s)             |
| `tide-harbor`     | NOAA NCEI coastal DEM, CO-OPS predictions (8413320), imagery       | Plays the October 28, 2026 spring tide (12 s)        |
| `hurricane`       | GOES-East band 13 (through NASA GIBS), NHC best track, Blue Marble | Toggle: Polo's day of rapid intensification / back   |
| `relief-map`      | 3DEP, NHD streams, NLCD 2021 land cover, imagery (Yosemite Valley) | A contour climbs, light runs down the streams (7 s)  |
| `living-city`     | Kit-built (no data)                                                | Toggle: night (windows light one by one) / day       |
| `stork-migration` | Rotics et al. 2016 white storks, Movebank (CC0 1.0); ETOPO1        | Plays July to October 2013 (14 s)                    |
| `earthquakes`     | USGS feed, live (snapshot when it can't be reached); ETOPO1        | Quakes flash in time order; the plaque refreshes     |

Tools: `tools/geo-lib.mjs` (TIFF and LZW reader, cached fetches, the snapshot writer),
`tools/geo-terrain.mjs` (the terrain blocks), `tools/geo-quakes.mjs`, `tools/geo-storm.mjs`,
`tools/geo-migration.mjs`. Toy code: `src/packs/geo.js`, `src/geo/data.js`, `src/geo/terrain.js`.

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
- Snapshots total about 3 MB, each loaded only when its toy opens (largest 645 KB, relief map).
- Rainfall on the relief map was cut: PRISM's terms are non-commercial and Daymet's were unclear;
  land cover (NLCD) took its place.

### For the Operator

- ODbL (OpenStreetMap) was not needed: the city is kit-built.
- Licenses outside the list: GEBCO's extra terms and the UN migrant stock's terms (not used).
- A PACKS.md lesson: tokens and parts that travel far must ask for a sort while they move
  (`out.resort` for tokens, `out.resortPose` for parts), or nearer splats paint over them; morph
  targets are never re-sorted.

### Plan (done)

1. Data tools and the terrain block; 2. the Grand Canyon and the live earthquakes; 3. Mount St.
   Helens, sea floor, tides, storm, relief map, city, migration; 4. shared lists, tests, thumbs.
