# Numeric verification evidence

The fresh original-finder baseline is complete: 118 public inputs, both profiles, and 2,124 color
poses. All 10,620 native-artifact hashes were independently verified, and every color PNG was
decoded and checked against its recorded RGBA hash. Every native color hash and quality value also
matches the earlier atlas. Those application source fingerprints differ, so this stability
comparison is not counted as identical-source repeat noise.

The actual repeat studies cover 72 input/profile pairs across 36 inputs, with one repeat each. All
measured quality differences are zero. The remaining 164 profiles have zero tolerance. The three
bounded repeat records keep their incomplete-corpus flags; no missing capture is invented.

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
bytes. Current-source full-corpus verification is still running separately.
