# Operator review follow-up

[Review instructions](https://github.com/ryanjosephkamp/splashery/pull/700#issuecomment-6232459351)
were applied to `ec3dee4cf57016d1429017eea9671f418a901fb6`. Current main
`c36c4dcd91f505ccb94cb5abe0d16cc2c626c395` was merged normally. The only conflict, site/sw.js, took
main's version before the site and toy plan were rebuilt.

The room labels are now Sunlit room and Lamplit room. Panorama credits follow the last Codex task
section. A one-line standard pack re-export, its own list header, and the owner entry are included.
No original Classic, existing pack, renderer, or test was edited. All 1,653 frozen main files have
identical Git blobs.

Fresh local verification: 96/96 related tests (19 panorama and 77 Classic golden), 272/272 preflight
checks, formatting, American English, and standard pack build passed. The two current browser
screenshots are retained here.

[Full hosted matrix](https://github.com/ryanjosephkamp/splashery/actions/runs/39057702542):
**402/402 files, 3,424 tests: 3,421 passed, two failed, and one existing private-fixture skip.**
Both unlisted failures, pages-r2:495 and shr:202, passed isolated rechecks. Every shard finished.
The GitHub combined-summary job was queued when this checkpoint was recorded. combined-matrix.json
sums all 16 raw hosted logs, and times.json contains all 402 file rows. This is a complete test
matrix, with no claim that its two failures passed originally.

Main advanced with documentation and research demos during this matrix. This checkpoint is retained
separately while the final reviewed head receives fresh verification.

The 24-scene mean depth gain remains 25.63%, with every group above 20%. The three regressions
remain in the main report: arches 15.46%, still-life 17.03%, and fresh-room-03 7.42%. The inference
pipeline, viewer, model, and sample image/depth bytes are unchanged. The eight recordings retain
their original labels and source identity at f94345f3f; review-source-identity.json identifies the
sole changed recorded source file, samples.js, and both its old and corrected hashes. Physical-phone
performance remains unmeasured.
