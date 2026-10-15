# Serial tile heapsort diagnostic, October 15, 2026

Production SORT_SRC, trainer, renderer, and benchmark protocol were unchanged. The prototype is outside the worktree and is not integrated. One SwiftShader browser completed the authorized fixed-input comparison; no optimization iterations or model bake ran. No further browser work was launched.

## Exactness evidence

The serial WGSL uses one invocation per disjoint tile at workgroup size 1. It builds a max heap over every real pair, extracts ascending unsigned (depthbits,id) order, and fills the entire padded tail with (0xffffffff,0xffffffff). Empty/one-entry segments cannot underflow the heap loops. It truncates no input and preserves the segment inventory produced by the original scan/scatter.

The CPU mirror passed 1,016 independently-oracled cases involving 2,078,860 real pairs: random full-u32 keys/IDs, reverse order, ties, duplicate pairs, signed-boundary keys, empty/singleton segments, count 2048/2049/4097, sentinel tails, and prefix/suffix/neighbor canaries. The independent oracle is native JavaScript Array.sort with unsigned numeric lexicographic comparison. CPU mirror tests alone do not prove WGSL execution; the GPU checks below supply separate evidence.

GPU actual cached real input: 1,000 unchanged surface seeds, one 96×54 area-resampled training image, 24 tiles, 1,446 entries, maximum 380 entries per tile. Camera, seeds, source image, tileGrad=true, shader options, and the unchanged fused render/backward pipeline matched between variants. Before each sort repetition, original scan/scatter regenerated the input outside the isolated sort timer. No Adam/chain/refine dispatch or parameter update ran.

Both cold and final warm sorted entry buffers matched byte-for-byte across variants, including every byte of the full 1,048,576-byte allocated buffer. Each independently matched JavaScript sorting of its saved unsorted input. Raw fixed-point gradients (64,000 bytes), float output (82,944 bytes), statistics, camera tile starts/cursors, and parameters were also byte-exact. Statistics were [57407,211045520,5184,0], so every target pixel was counted and no entries were dropped.

The real input had no >2048 tile and hence no scan padding. A separate tiny GPU integer fixture used tile counts [0,1,2,17,2048,2049], unsigned-boundary and duplicate keys, 2,047 sentinel padding pairs for its final tile, and 13 untouched suffix-canary pairs. Old GPU sorter, prototype GPU sorter, and independent JavaScript sorting matched over the entire fixture buffer, including the padded tail and canary. This fixture is numerical sorting coverage, not additional training footage.

## Measured isolated sort dispatches

| Variant | First GPU ms | Warm GPU ms (3 dispatches) | First wall ms | Warm wall ms (3 dispatches) |
| --- | ---: | --- | ---: | --- |
| Unchanged bitonic | 212.364 | 173.105, 154.575, 144.879 | 222.6 | 177.2, 155.3, 147.1 |
| Serial heap prototype | 1.882 | 24.223, 1.866, 1.909 | 18.0 | 31.8, 4.2, 4.2 |

Warm median GPU sort time was 154.575 versus 1.909 ms (81.0× for this kernel and this input). The 24.223 ms heap outlier remains in the raw results. The unchanged renderer/backward measured 143.400 and 128.758 GPU ms; those measurements are subject to contention/order variation and do not demonstrate a renderer change.

The integer fixture's first sort measured 62.060 versus 15.517 GPU ms, with much larger wall times (4905.7 versus 126.8 ms) that include pipeline/backend cold overhead. First-dispatch times are labeled as such; they do not establish a clean cold-process compile cost because browser/driver caches can persist across probes.

These are one-process, bitonic-first, tiny-input observations on a contended five-CPU host, not isolated end-to-end throughput, physical-phone speed, quality evidence, or a native-resolution prediction. Fixed-point accumulation equivalence was measured only for this input. Full accepted input-range exactness beyond the tests remains a proof obligation. A hardware GPU may favor the parallel bitonic path; no hardware-device policy is proposed or installed.

The large tiny-input signal supports proposing one separately coordinated realistic-size fixed-input followup. It does not justify runtime integration or a full corpus bake. Future followup should preserve the same seed inventory/options and compare the complete sorted entries and raw renderer/gradient outputs again before interpreting a sort speed result. No followup was launched.

## Bound bytes

Prototype WGSL SHA-256: 031b884f377252a411581fef554168b2df79895cdccd2e1848b97b7e6ed048af.
Source cache and the original 1k/96 input bytes remain bound through the prior probe receipts and this probe's input hashes. Four actually served source modules were verified against local bytes before/after; they stayed unchanged. Config, JS harness, source hashes, browser version/arguments, adapter description, raw binary gradients/output/entries/stats, and per-dispatch timestamp/wall measurements are in gpu-r1/receipt.json and its adjacent files. freeze.json binds this report, source files, CPU proof, GPU receipts, and every saved raw artifact.

Rule check: none.
