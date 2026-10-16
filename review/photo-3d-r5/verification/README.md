# Numeric verification evidence

The fresh original-finder baseline is complete: 118 public inputs, both profiles, and 2,124 color
poses. All 10,620 native-artifact hashes were independently verified, and every color PNG was
decoded and checked against its recorded RGBA hash. Every native color hash and quality value also
matches the earlier atlas. Those application source fingerprints differ, so this stability
comparison is not counted as identical-source repeat noise.

The actual repeat studies cover 72 input/profile pairs across 36 inputs, with one repeat each. All
measured quality differences are zero. The remaining 164 profiles have zero tolerance. The three
bounded repeat records keep their incomplete-corpus flags; no missing capture is invented.

An [independent check of the initial repeats](initial-repeat-integrity.json) decoded all 648 native
color poses and rehashed all 3,240 artifacts across those 72 profiles. Every repeated native color
pixel and quality value matches the baseline. Each of the three original bounded capture records
retains its incomplete-corpus flag.

The gzip files preserve the exact original JSON bytes. Their compressed and decompressed hashes are
listed in [evidence.json](evidence.json). Relative image paths describe the original capture layout;
native PNGs are retained locally and are not included in this numeric mirror. Original source photos
and the earlier gallery remain on the existing failure-atlas review branch.

Timing and memory fields in these concurrent captures are excluded from cost acceptance. Independent
isolated cost studies and their rejections are linked from the code PR. This package establishes
preservation evidence; it does not establish any 25% quality improvement.

The baseline retains one interrupted browser attempt and its successful retry. Its 236 final saved
profiles have working Sharp views and no browser errors or external requests. Method snapshots
accompany the records. The integrity script is archived as text to preserve its exact recorded
bytes.

The synchronized-main [current atlas](current-atlas.json.gz) is also complete: 236 profiles and
2,124 color poses. Its [independent integrity check](current-integrity-verification.json) verifies
all 118 actual photo hashes, all 10,620 native-artifact hashes, and every decoded color PNG. There
are zero native pixel differences and zero quality-value differences from the baseline. The
[comparison](current-comparison.json) reports no regressions and exactly 0% reduction in each of the
three selected classes; none passes its 25% target. The
[complete input ranking](current-input-ranking.json) therefore contains 118 measured ties, resolved
by original manifest order for the 15 review slots.

The 49 checkpoint clips include 36 built-in inputs in that frozen corpus and 13 older review inputs
outside it. A [separate Sharp study](legacy-review-sharp-integrity.json) verifies those additional
13 inputs at both profiles: 26 profiles, 234 decoded native color poses, and all source photo and
depth hashes. All 131 distinct inputs have working Sharp views at both profiles. The extra study
does not alter the frozen 118-input target corpus, and it is not a before/after quality or cost
comparison.

The [checkpoint roster proof](checkpoint-roster-verification.json) matches the exact 49 input/view
pairs and 98 original photo/depth file hashes: 36 built-in pairs use the protected application
checkpoint, and 13 older review pairs use the protected original clips branch. Sharp, Depth 1, DPR
3, native buffer dimensions, and encoded dimensions match the original roster. Original clips were
four seconds: 48 used 6 fps, and the forest used 12 fps. The fresh recordings use six seconds and 12
fps throughout, with 72 actual frame pairs each. Timing differences are recorded explicitly; no
identical video timestamps are claimed.
