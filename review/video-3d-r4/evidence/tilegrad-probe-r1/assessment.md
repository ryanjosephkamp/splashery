# Tile-gradient option diagnostic, October 15, 2026

One browser compared unchanged tileGrad=true and tileGrad=false on the exact same saved 1,000 real surface seeds and 96×54 training image. Raw fixed-point gradients, rendered float output, statistics, tile starts/cursors, and parameters were byte-identical. No optimizer step or parameter update ran.

One warmed fused render/backward measured 185.267 GPU ms with shared tile gradients and 187.634 GPU ms with direct global atomics. This is no substantial speed improvement. The observation occurred under ongoing host load, bitonic/shared first, and is not production or physical-phone throughput evidence. Do not change tileGrad or extrapolate this tiny comparison.

The isolated sort stage took 265.487/190.646 GPU ms in those two setup instances, motivating the separately authorized exact serial-sort diagnostic. No larger tileGrad probe ran. Raw bytes, fixed input/config hashes, actually served source hashes before/after, browser details, and timestamps remain in receipt.json and adjacent files.

Rule check: none.
