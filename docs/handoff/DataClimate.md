# Lane Data and climate: your spreadsheet in 3D, and the climate records (prefix `dcl`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Data and climate (id `DataClimate`, prefix
`dcl`). Branch: `claude/lane-data-climate` (and `claude/lane-data-climate-engine` for any change to
the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Data and
climate: your spreadsheet in 3D, and the climate records". Handoff file: docs/handoff/DataClimate.md
(create it; start it with this brief, word for word, under "## Brief", then keep "## State

WORKING (October 5, 2026): both toys build and run, with tests, credits, how-to and About texts, and
the evidence file. Next: clips on Effect review page 2, sound lint, check-packs, thumbnails.

- **Data in 3D** (`data-in-3d`, Studio, labs): `src/datavis/csv.js` reads the table,
  `src/datavis/plot.js` builds a scatter, bars or a surface inside `src/datavis/chart.js`'s frame
  (floor grid, walls, axes, ticks, legend). Labels are tokens that turn to face the camera
  (`src/datavis/text.js`). The panel (an `input.live` render, as the QR toy does) picks the table,
  the chart and the columns, and saves a PNG or a turning WebM through `showSaveFilePicker` where
  the browser has it (the browser's download elsewhere). Samples: USGS earthquakes, Fisher's iris
  (CC BY 4.0), NOAA CO2 by month. A tap drops the marks to the floor and lets them rise back.
- **Climate records** (`climate-records`, Science, labs): `src/datavis/climate.js`. Views: the CO2
  spiral (height is time, distance from the middle is ppm; a tap redraws the record behind a bead),
  monthly temperature bars and a yearly temperature wall (a tap lets the bars sink to zero and grow
  back). Snapshots in `assets/toys/climate-records/`, made by `tools/dcl-snapshots.mjs`.
- No engine changes.

## Notes

- **CO2 starts in May 1974.** NOAA GML's monthly Mauna Loa file (`co2_mm_mlo.csv`) says its data
  from March 1958 through April 1974 were obtained by C. David Keeling of Scripps and downloaded
  from scrippsco2.ucsd.edu. NOAA's terms (gml.noaa.gov/about/disclaimer.html, read October 5, 2026)
  put "the information on government servers" in the public domain. The Scripps CO2 pages carry no
  data license of their own; their only "Terms of Use" link goes to UC San Diego's site terms, which
  say "No material from any official UC San Diego website may be copied, reproduced, republished ...
  without explicit permission". So the early segment can't be cleared, and the record shown starts
  with NOAA's own measurements in May 1974.
- **GISTEMP v4** (data.giss.nasa.gov/gistemp/): NASA, a U.S. government work (public domain). The
  page asks that the webpage (with the date of access) and Lenssen et al. (2024) be cited.

## Known issues

- The CO2 coil's yearly lean is small at phone size (the true size of the cycle: about ±3 ppm on a
  rise of 94 ppm); it shows when you zoom in.
- Labels face the camera only about the vertical: seen from high above they foreshorten.
- Reading a file of a few hundred thousand rows takes a few seconds on the main thread (about 2 s
  for 300,000 rows on this machine).

## For the Operator

Nothing yet.
