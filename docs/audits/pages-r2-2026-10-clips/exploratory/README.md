# Earlier rendering trials

These records are exploratory and excluded from the final comparison. Every completed pair from
these trials is retained, including strict misses. The final matrix remeasures both revisions after
rendering-source changes.

- [before-settled-detail/main](before-settled-detail-main.json): 31 records; candidate
  `36edbeb30b0d55f27a7f44a75ec6961d8674e002`.
- [before-settled-detail/round2](before-settled-detail-round2.json): 32 records; candidate
  `36edbeb30b0d55f27a7f44a75ec6961d8674e002`.

The album text crop missed the raw sharpness target, and book chart loading missed by9ms. Settled
native detail and typed color uploads changed afterward.

- [three-pass-paper/main](three-pass-paper-main.json): 11 records; candidate
  `bd2b0d735d795032135220f1c7742d08b3412b2d`.
- [three-pass-paper/round2](three-pass-paper-round2.json): 11 records; candidate
  `bd2b0d735d795032135220f1c7742d08b3412b2d`.

The separate Gaussian paper pass missed chart loading and text loading/memory. It was replaced by a
connected white reverse and disabled hidden paper rendering.

A short post-install resolution debounce experiment did not establish a loading benefit and was
reverted before any commit. Its records were not substituted for final pairs.

All source fixture credits remain in the fixture manifest and CREDITS.md. Never merge this evidence
branch.
