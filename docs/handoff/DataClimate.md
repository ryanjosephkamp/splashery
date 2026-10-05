# Lane Data and climate: your spreadsheet in 3D, and the climate records (prefix `dcl`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Data and climate (id `DataClimate`, prefix
`dcl`). Branch: `claude/lane-data-climate` (and `claude/lane-data-climate-engine` for any change to
the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Data and
climate: your spreadsheet in 3D, and the climate records". Handoff file: docs/handoff/DataClimate.md
(create it; start it with this brief, word for word, under "## Brief", then keep "## State", "##
Notes", "## Known issues" and "## For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

Push Plan S5 and S16 (yes).

1. **Data in 3D** (S5): open a CSV (or TSV) from the device (nothing is uploaded), see its columns,
   pick X, Y, Z, color and size, and get a 3D scatter, 3D bars or a surface to spin, with axes,
   ticks and labels that are readable at phone size. Handle real files: headers, quoted fields,
   missing values, dates, a few hundred thousand rows (sample down with a plain message). Save a
   picture (PNG) or a short turning video (WebM through MediaRecorder) to a file the person chooses.
   Two or three small sample tables under allowed licenses, credited.
2. **Climate records** (S16): atmospheric CO2 since the start of the record and global temperature
   anomalies, as 3D charts you can turn: for example the CO2 record as a rising spiral with its
   yearly cycle, and yearly temperature anomalies as a ridge or a field of bars. Read
   docs/audits/open-science-data-2026-10.md first: use NASA GISTEMP (public domain) for temperature,
   and NOAA's CO2 data within the license limits that report found (it says to keep the early
   Scripps segment out of a NOAA-only sample until it is cleared; check the live terms yourself, and
   if you can't clear it, start where the cleared data starts and say why). Ship dated snapshots,
   with the source and the date shown beside each chart; no live fetching (the owner's live-data
   rule doesn't cover these feeds).
3. **Evidence**: docs/evidence/<toy id>.json for the climate toy, with tests that check the shipped
   numbers against the source files (a few known values, the record's first and last points).

New labs toys: Data in 3D in the Studio (category `studio`), Climate records on the Science shelf.
Tests in `tests/dcl*.spec.mjs`; clips at phone size on Effect review page 2 (lane record
`DataClimate`); credits; how-to and About texts.

You own: `src/datavis/` (new), `src/packs/data-climate.js` (new), `tools/dcl-*.mjs`, the data
snapshots, `tests/dcl*.spec.mjs`, your toys' evidence files, their lines in the shared lists, and
your handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Before READY, re-read
CLAUDE.md's "Effect quality rules" and check each clip against them at phone size.

## State

WORKING: started October 5, 2026. Reading the code; the licenses are checked (see Notes).

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

None yet.

## For the Operator

Nothing yet.
