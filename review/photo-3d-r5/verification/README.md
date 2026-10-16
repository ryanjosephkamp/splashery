# Numeric verification evidence

The fresh original-finder baseline is complete: 118 public inputs, both profiles, and 2,124 color
poses. All 10,620 native-artifact hashes were independently verified, and every color PNG was
decoded and checked against its recorded RGBA hash. Every native color hash and quality value also
matches the earlier atlas. Those application source fingerprints differ, so this stability
comparison is not counted as identical-source repeat noise.

The [expanded identical-source repeat record](noise-expanded.json) covers **236 of 236 input/profile
cases across 118 of 118 inputs**, with one actual repeat per covered case. All observed differences
are zero in every supported quality metric. Every original input/profile case has one actual repeat.
The four source capture records retain their original bounded-corpus flags; aggregate coverage is
complete because all 236 distinct pairs were actually observed.

The initial [72-profile integrity record](initial-repeat-integrity.json) verifies 648 decoded color
poses and 3,240 artifact hashes. The [additional integrity record](additional-repeat-integrity.json)
verifies 1476 further color poses and 7380 artifact hashes across 164 actual completed profiles.
Combined verification covers 2124 decoded native color poses and 10620 artifact hashes. Every
repeated native color pixel matches the baseline.

Coverage refers to the exact additional-atlas snapshot pinned by the integrity record, as of
2026-10-16T13:13:38.115Z. The [expanded-noise current comparison](current-comparison-expanded.json)
still reports zero quality regressions and 0% reduction in every selected class; none reaches 25%.
Repeat noise uses the original baseline's identical source fingerprint. The separate current-source
preservation study has a different application fingerprint and is not counted as repeat noise.

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
