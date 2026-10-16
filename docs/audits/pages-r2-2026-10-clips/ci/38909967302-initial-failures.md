# First final-source shard failures

Production source: `f5f8cef9099f953f9acdad1ecd612a9b33afd8d3`. Both initial shard failures remain
failures even when their isolated rechecks pass. The new lifecycle setup now selects and validates
its current face atomically, with the same visibility and depth condition; the correction passed
locally.

```text
2026-10-16T13:53:59.3409633Z - 21 of 21 files, 169 tests: 168 passed, 1 failed, 0 skipped.
2026-10-16T13:53:59.3411791Z - `pages-r2:284` sharp pages in the real renderer › still pages own continuous faces, moving media and the neighboring frame retain their splats: failed. Error: expect(received).toBe(expected) // Object.is equality
2026-10-16T13:54:08.2327773Z pages-r2:284 still pages own continuous faces, moving media and the neighboring frame retain their splats: passed alone
2026-10-16T13:54:08.2328713Z 1 failed in this shard; 1 rechecked.
2026-10-16T14:03:36.8071479Z - 21 of 21 files, 224 tests: 222 passed, 1 failed, 1 skipped.
2026-10-16T14:03:36.8075620Z - `smoke:1053` Settings panel (WebGL2) › the panel and the shelf can be made bigger on a wide screen: failed. Error: expect(received).toBeGreaterThan(expected)
2026-10-16T14:03:49.2633787Z smoke:1053 the panel and the shelf can be made bigger on a wide screen: passed alone
2026-10-16T14:03:49.2637475Z 1 failed in this shard; 1 rechecked.
```
