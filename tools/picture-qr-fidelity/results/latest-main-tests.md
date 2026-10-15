# Suite run

- 2 of 2 files, 14 tests: 14 passed, 0 failed, 0 skipped.
- Time in files (one after another): 32 s. Wall time of this run: 32 s (1 at once).

## Failed

None.

## Slowest files

| File               | Seconds | Tests |
| ------------------ | ------: | ----: |
| cdx-qr-tile-engine |      30 |     5 |
| cdx-three-bounds   |       2 |     9 |

## Slowest tests

| Test                                                                                                               | Seconds |
| ------------------------------------------------------------------------------------------------------------------ | ------: |
| `cdx-qr-tile-engine:53` Opt-in photo tiles keep opaque colors, rotate their patches, and clean up (webgpu, sharp)  |       8 |
| `cdx-qr-tile-engine:53` Opt-in photo tiles keep opaque colors, rotate their patches, and clean up (webgpu, gaussia |       7 |
| `cdx-qr-tile-engine:53` Opt-in photo tiles keep opaque colors, rotate their patches, and clean up (webgl2, gaussia |       5 |
| `cdx-qr-tile-engine:53` Opt-in photo tiles keep opaque colors, rotate their patches, and clean up (webgl2, sharp)  |       4 |
| `cdx-qr-tile-engine:2` A render-tail hold stops idle drawing while explicit captures and nested holds work         |       4 |
| `cdx-three-bounds:14` the token bounds cover translation and rotation around the origin                            |       0 |
| `cdx-three-bounds:54` one envelope contains multiple tokens and preserves earlier poses                            |       0 |
| `cdx-three-bounds:39` hidden tokens and empty uniforms do not expand or update the bounds                          |       0 |
| `cdx-three-bounds:45` a geometry upload starts a new envelope, and zero quaternions are identity                   |       0 |
| `cdx-three-bounds:68` different resources keep independent envelopes                                               |       0 |
| `cdx-three-bounds:79` Stage applies WebGPU kit token uniforms with the appropriate bounds                          |       0 |
| `cdx-three-bounds:79` Stage applies WebGL2 kit token uniforms with the appropriate bounds                          |       0 |
| `cdx-three-bounds:79` Stage applies WebGPU asset token uniforms with the appropriate bounds                        |       0 |
| `cdx-three-bounds:79` Stage applies WebGPU custom field token uniforms with the appropriate bounds                 |       0 |
