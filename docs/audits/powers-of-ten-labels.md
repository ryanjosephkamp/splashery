# Powers of ten: two distance labels

Checked October 14, 2026. Made by Ryan with Codex (GPT-6). Task 81, branch `codex/powers-labels`.
Status: implemented, awaiting owner review.

## Findings and wording

| Stop | Old wording                                                               | New wording                                                                                                              |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| City | Washington, D.C., on the Potomac River, about 16 km across.               | Washington, D.C., on the Potomac River: the original District was a square about 16 km on each side.                     |
| Mall | The National Mall, about 3.2 km from the Capitol to the Lincoln Memorial. | The National Mall, about 3.6 km in a straight line from the center of the Capitol to the center of the Lincoln Memorial. |

Both labels needed a correction. The City label keeps 16,000 meters but specifies the historical
side length. The Mall label and its size change from 3,200 to 3,600 meters. Stop ids, zoom powers,
imagery, geometry, saved-link fields, and scene formats stay the same.

### Original District side

I read D.C. OCTO's
[historic boundary layer description](https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Administrative_Other_Boundaries/MapServer/13).
It describes a ten-mile square and four surveyed ten-mile boundary lines. It also cautions that the
historic stones do not form a perfect square and do not define the modern administrative boundary.
The
[NPS Jones Point interpretation](https://home.nps.gov/places/information-panel-the-nation-s-capital-begins-here.htm)
independently describes the original ten-mile square and the subsequent return of land to Virginia.

Using the international-mile conversion in
[NIST's unit tables](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8),
ten miles × 1.609344 = 16.09344 km, or about 16 km on each side. The survey-mile conversion in the
same table gives 16.09347 km; that distinction does not affect the label's rounding. The ideal
square's diagonal would be 16.09344 × √2 = 22.759 km, or about 22.8 km. These are calculations from
the historical layout, not a new survey of the present District. Specifying the original side avoids
giving a directionless width for the current boundary.

### Capitol to Lincoln Memorial

I retrieved OpenStreetMap building polygons through this
[Overpass API query](https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A15%5D%3Bway%5B%22building%22%5D%2838.888%2C-77.011%2C38.891%2C-77.007%29%3Bout+geom%3Bway%5B%22building%22%5D%2838.888%2C-77.052%2C38.890%2C-77.049%29%3Bout+geom%3B).
Data: OpenStreetMap contributors, ODbL 1.0. Response data timestamp: `2026-10-14T19:24:21Z`. The
query returned these named building ways:

| Building              | Way id    | Area-centroid latitude | Area-centroid longitude |
| --------------------- | --------- | ---------------------- | ----------------------- |
| United States Capitol | 66418809  | 38.889813424           | -77.009001432           |
| Lincoln Memorial      | 398769543 | 38.889272115           | -77.050171895           |

Method: for each closed footprint, subtract its first vertex and project longitude by
`cos(first latitude)`. Compute the polygon's area centroid with the shoelace formula, then undo the
projection. For projected consecutive vertices `(x, y)` and `(X, Y)`, let `q = x*Y - X*y`; the
centroid is `sum((x+X)*q)/(3*sum(q))`, and likewise for y. This weights by polygon area, rather than
averaging the vertices. The projection is an approximation over each building.

With the resulting latitudes φ and longitudes λ in radians, compute
`a = sin²((φ2-φ1)/2) + cos(φ1)*cos(φ2)*sin²((λ2-λ1)/2)` and
`d = 2*6371008.8*atan2(sqrt(a), sqrt(1-a))`. This gives **3,563.8 meters**, rounded to **about 3.6
km**. Python 3's standard `json` and `math` modules performed the calculation; no new dependency or
map asset ships. The coordinates above let a reviewer reproduce the distance without querying
mutable map data again.

This is an approximate straight-line ground distance between footprint centers. It is not a walking
distance, an ellipsoidal survey, or a measurement of the Mall's administrative extent. The API
supplies polygons; the centroid and distance are my calculations. The
[NPS home page](https://www.nps.gov/nama/index.htm) does contain the previous two-mile photo
caption, but it does not define building-center endpoints. That caption is insufficient support for
the old, more specific label.

## The other three labels

- **Haupt Garden, 130 m:** I would clarify this in a separate change. The
  [Smithsonian Archives](https://siarchives.si.edu/blog/enid-haupt-garden) confirms 4.2 acres. The
  existing evidence converts that area to the side of an equal-area square:
  `sqrt(4.2 * 4046.873) = 130.37 m`, using NIST's survey-acre factor above. That supports a
  characteristic scale, not an actual measured width of an irregular garden. Saying "about" does not
  resolve that distinction. I would name the equal-area square or measure a specified axis before
  replacing the width.
- **Chloroplast, 3.5 µm:** keep for this task. The
  [Wellcome source](https://wellcomecollection.org/works/bx3dctp2) confirms that the image spans 4.5
  µm. The existing evidence's approximate 620-of-800-column span gives
  `620 / 800 * 4.5 = 3.4875 µm`, consistent with 3.5 µm. I checked that calculation and source
  scale, but did not independently trace the organelle's endpoints.
- **Ribosome, 20 nm:** keep as an approximate scale. The existing
  [general size reference](https://en.wikipedia.org/wiki/Ribosome) describes bacterial ribosomes as
  around 20 nm. The [EMDB entry](https://www.ebi.ac.uk/emdb/EMD-48329) confirms that this is an E.
  coli 70S structure. I did not remeasure its density surface; the 3.2 Å value on EMDB is
  resolution, not the object's diameter. A future tighter size should specify an axis and contour.

## Changes and verification

Both `stops` and `claims` in the evidence JSON carry the corrected wording, methods, and sources.
Only these two entries were newly checked; their individual `checked` dates record that, while the
file's original overall date is retained. `src/toy-help.js` does not repeat either distance. The
site page and service-worker version were regenerated with `node tools/site-build.mjs`.

The required run used real Chromium at `/usr/bin/chromium`:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test \
  tests/pot.spec.mjs tests/site.spec.mjs tests/help.spec.mjs tests/hta.spec.mjs
```

The first run finished with 36 passing tests and one failure: all nine `pot`, all eleven `site`, all
three `hta`, and thirteen of fourteen `help` tests passed. The failed desktop help check found the
default Cactus hint hidden. Its trace shows the Cactus selection taking 5.9 seconds, followed by the
test's 1.2-second wait; the existing hint hides after seven seconds and does not restart when
selecting the same toy. Screenshot capture was running concurrently during that check. This concerns
the timed Cactus hint, not a Powers of ten label.

The entire help file was rerun without concurrent browser work:
`SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/help.spec.mjs`. All fourteen tests
passed, including the desktop check. No help behavior or assertion was changed. The completed
verification therefore covers all four required files, with this initial timing failure disclosed.
Standard screenshots were restored with `node tools/upkeep.mjs --restore-shots`.

`node tools/site-build.mjs --check`, `node tools/us-english.mjs --diff`, and
`npx prettier --check .` passed. The full suite was not run; these are task 81's named specs.

The labels were also opened in real Chromium at 390×844 and 1440×900, with the zoom slider
positioned at each stop. No responses or data were mocked. I reviewed all four screenshots; the
labels wrap within their panels, and neither viewport has horizontal page overflow:

- [City, phone](../../tests/screenshots/pot-labels-city-390x844.png)
- [City, desktop](../../tests/screenshots/pot-labels-city-1440x900.png)
- [Mall, phone](../../tests/screenshots/pot-labels-mall-390x844.png)
- [Mall, desktop](../../tests/screenshots/pot-labels-mall-1440x900.png)

No effect, asset, tier, or runtime API changed. Performance was not benchmarked. Owner approval is
still required before this public toy's change is merged. Rule check: none.
