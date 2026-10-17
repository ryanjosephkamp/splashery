# Eight-hour progress

Recorded at 2026-10-17T10:03:34.143153+00:00. Started about 02:03 UTC on October 17, 2026.

Draft PR #700 and the eight complete native clips are published. The final twenty-four-scene
benchmark improves mean AbsRel by 25.63%, with three regressions retained. All twenty-three
measurable seam medians are below 2%; coast has no valid pairs. First look is 1.423–2.359 seconds in
desktop phone emulation. Physical-phone speed, sensors, RAM, and GPU memory remain unmeasured.

The required final main merge includes the approved Neuron r2 update (ea9a9d193). Published code is
f94345f3fab560a61c424ab6297cabbd247a79f0. The fresh merged-head run passed all 111 tests (19
panorama, 77 Classic golden, and 15 related Neuron checks), and preflight passed all 272 checks.
Every captured runtime/model/cache byte still matches; pipeline hash
5440df1c83e025a282de0d1edd4966d9929981235702114f1de348e5594da4be is unchanged. All 1,646 frozen-file
Git blobs match main.

The earlier complete matrix on 652fe9449 covered all 401 files. After one bounded failed-shard
rerun, it ended with 3,413 passing tests, two failures (Pebbles stacking and quartz snap-back), and
one pre-existing private-fixture skip. Both remaining failures passed isolated rechecks; they still
count. Original and rerun reports and failure receipts remain archived. No test, physics code, or
existing pack was changed to hide them.

The new merged-head matrix is workflow 39019832991. At this note, Checks and three suite shards have
passed, including Classic's hosted golden shard; one more shard is active, and the rest are queued.
The full-suite outcome remains unresolved. No further retry-until-green campaign is planned.
Continue within the up-to-twelve-hour limit, ending about 14:03 UTC. The PR remains a draft, and the
evidence branch remains unmerged.
