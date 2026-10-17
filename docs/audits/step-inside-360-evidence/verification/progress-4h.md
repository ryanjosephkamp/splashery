# Four-hour progress

Recorded at 2026-10-17T06:03:19.483808+00:00. Started about 02:03 UTC on October 17, 2026.

The labs tool and eight complete native recordings are published in draft PR #700. Final code is
652fe9449839bce3ce2ed9f305ef058f3a7e1a62, including main aedbe4433. Mean AbsRel improves 25.63%
across all twenty-four scenes, with three regressions retained. All twenty-three measurable seam
medians are below 2%; coast has no valid pairs. First look takes 1.423–2.359 seconds in desktop
phone emulation. Quiet panorama memory is 1001–1009 MiB PSS, below the matched Classic reference.
Physical-phone latency, sensors, RAM, and GPU memory remain unmeasured.

The fresh panorama plus Classic run passed all 96 tests, including all 77 Classic golden tests. The
latest-main preflight passed all 272 checks. All 1,646 frozen-file Git blobs match main. Evidence
revision 1e8d360dd publishes the recordings, truth, scores, and hashes.

Full-suite verification is still underway: all 401 files are running locally with two isolated
workers, and the final sixteen-shard CI run is queued with the Checks job started. The existing
Pebbles stacking failure was independently reproduced on untouched main; no old test, physics code,
or pack was changed. The PR stays a draft, and the clips branch stays unmerged.
