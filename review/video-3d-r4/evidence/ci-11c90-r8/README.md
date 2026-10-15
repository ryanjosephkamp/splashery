# Original CI job logs, losslessly archived

MIT. Made by Ryan with Codex (GPT-6). Run 38733898151 at commit 11c90d51f266145cb88a52f795be1a91e5da7692 is incomplete: Suite 13 was canceled. The 15 reported original summaries retain every failure. Alone rechecks are supplementary.

Every `.log.gz` decompresses to the exact original UTF-8 tool-returned bytes. Restore with Python `gzip.decompress`, write the bytes to the mapping's `originalPath`, and verify `originalSha256`. The uncompressed originals remain outside the repository at `/workspace/v3d-r4-media/ci-11c90`. No log or test was rewritten. Compression keeps the existing English check within its unchanged process buffer limit.

Rule check: none.

The corrected partial-suite-summary-r2.json includes the original spg:138 timedOut assertion in its failure list. The first derived report listed seven names while retaining eight failures in its totals; both reports and every original raw byte remain visible. Counts and statuses did not change.
