# Rejected exact-output performance research

Neither candidate is included in the application. The canvas fallback preserved the two-profile,
18-pose forest render but increased median and worst first-view time and worst PSS. The scratch
gradient cache preserved every builder output across all 236 input/profile combinations, 1,296
direct refiner fixtures, and the 18-pose forest render, but increased all four cost statistics.

Each cost screen used five fresh browsers per build with competing local captures and audits closed.
Every observation is retained, including its native dimensions, completion fence, errors, and actual
PSS samples. Both candidates were cut without benchmark retries. These are one-input, software-phone
observations, not complete-corpus or physical-phone results, and they do not establish a causal
slowdown.

[evidence.json](evidence.json) lists every compressed, decompressed, and exact source hash. Gzip
files preserve original JSON bytes. Source and method text snapshots preserve the exact local
research bytes and reference their original workspace paths. The separate 32 fixtures in the builder
record exercise the unchanged upsampler; the 1,296 direct fixtures exercise the new gradient cache
and both fallback paths. Native scout images remain in the local capture workspace.

The
[code report](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-r5/docs/audits/photo-3d-r5-2026-10.md)
contains the summarized measurements and links the complete numeric reports. These files are
separate from the 54 retained-runtime review videos and the three rejected mask videos.
