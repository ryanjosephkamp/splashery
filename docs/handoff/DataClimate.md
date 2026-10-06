# Lane Data and climate: your spreadsheet in 3D, and the climate records (prefix `dcl`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Data and climate (id `DataClimate`, prefix
`dcl`). Branch: `claude/lane-data-climate` (and `claude/lane-data-climate-engine` for any change to
the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Data and
climate: your spreadsheet in 3D, and the climate records". Handoff file: docs/handoff/DataClimate.md
(create it; start it with this brief, word for word, under "## Brief", then keep "## State

READY (October 5, 2026, 21:30 UTC): PR #294 merged (Integrator 5, combo N8). The polish round (the
owner's "the toys could still be sharper") is on `claude/lane-data-climate-polish`, PR "Phase Data
and climate polish: sharper labels, solid points, charts that fill the phone". Five new clips sit
beside the old ones on Effect review page 2 (cards `dcl-*-p1`).

### Polish round (October 5, 2026)

Measured with `tools/lab-kernels.mjs` (390×844 at 2×, Data in 3D at home and 0.5 zoom):

- Labels: four splats per font pixel (2 × 2) and a bridging splat on diagonal steps. Edge rise 1.88
  → 1.65 px at home, 2.78 → 2.13 px zoomed.
- Scatter points up to 4,000: a shaded ball of splats each (35 after round 2), with a crisp edge,
  instead of one soft splat. Floor shadows smaller and fainter.
- `density: 1.4` on both toys (a phone builds 84,000 splats, under its 120,000 cap); the CO2 coil
  may use up to 100,000.
- Finer axis and grid lines.
- Framing: titles shortened (the old ones were wider than the charts, so the fit shrank everything),
  long axis titles wrap onto two lines, the vertical axis title sits above the axis, Data in 3D's
  depth axis is on the right, the temperature charts are narrower and taller, and the cameras sit a
  little farther back. Every chart now fills a phone screen.
- The labs' sharp kernel was measured and left off: on these charts it added speckle and shimmer
  without sharper edges.

### Polish round 2 (October 5, 2026, the owner's marks)

All ten cards were marked "fix": "Please make sharper." and, on the polish clips, "Text / numbers
too big, could still be a little sharper."

- Text about 25% smaller (a font pixel 0.0135 units on Data in 3D, 0.015 on Climate records). Titles
  use 3 × 3 tiny splats per font pixel, other labels 2 × 2: splats much under 0.003 units fall below
  a pixel on a phone (worse at the back of a chart) and vanish, which hid the back-wall ticks on a
  first try. Rims are tighter.
- Thinner axis, grid and pole lines; balls of 35 finer splats.
- `density: 1.7` (a phone builds 102,000 splats, under its 120,000 cap); bars and the surface use
  splats 20% smaller; the CO2 coil is thinner (sigma 0.0062) with up to 140,000 splats, so every
  yearly turn is its own line.
- Measured: Data in 3D's edge rise at 0.5 zoom 2.13 → 1.74 px. Climate records' "speckle" number
  rose (0.16 → 1.21) because the coil's turns are now separate lines with gaps between them; a close
  crop shows clean lines, no grain.
- Clips `dcl-*-p2` on Effect review page 2; the first and `-p1` cards point to them (`replacedBy`).

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
- `tests/smoke.spec.mjs` "rigs pick splats by colour …" failed twice on this branch (the strawberry
  had not settled within its 15 s poll) and then passed on the same commit; it passed on main too.
  It looks timing-dependent, not tied to this lane (the lane doesn't touch rigs or the strawberry).
- Reading a file of a few hundred thousand rows takes a few seconds on the main thread (about 2 s
  for 300,000 rows on this machine).

## For the Operator

- The CO2 record starts in May 1974 (Notes says why). If the Scripps segment is ever cleared, rerun
  `tools/dcl-snapshots.mjs` without its cut and update the evidence file.
- Saving to "a file the person chooses" uses `showSaveFilePicker` where the browser has it (Chrome
  and Edge on a computer); elsewhere it is the browser's own download or save sheet.
- No engine PR was needed: the Toy tab panel uses `input.live` with a `render`, as the QR toy does.
