# Prior module review

Reviewed `src/pano3d/prior.js` and its runtime call in `pipeline.js` read-only on October17,2026.
The reviewed floor-enabled module is preserved byte-for-byte as `reviewed-floor-prior-source.mjs`;
its hash is in `floor-degeneracy-review-results.json`.

The yaw shift/unroll signs agree: rotated input pixelu reads originalu+offset, and the output unroll
samplesu−offset. Integer-pixel rounding is reported to downstream calibration, including widths not
divisible by4. The four observations align in relative inverse depth before fusion; the harmonic
radial blend is consistent with averaging inverse radial distance. Cube/global scale calibration
uses input RGB confidence only. Cancellation checks bracket every actual inference, and the pure
module makes no network request or asynchronous state mutation.

The full-plane equation `q=n·ray+b` is appropriate if a model panorama output is affine in inverse
radial depth. Enough independent ray directions identifyb up to a global scale. The guarded model
abstains on insufficient support, singular systems, invalid refined normals, and weak
residual-relative signal. Consensus of model predictions remains a heuristic, not proof of a real
floor or globally affine model error.

One numerical issue was reported: `fitFloor`'s signal variance used subtractive second moments. A
constant384×192 inverse-depth field of100 with full texture is accepted asstable, with bias≈100 and
a normal containing only roundoff. The existing32×16 constant test abstains before fitting because
fewer than64 sample points survive. Reproduce with:

```sh
node .cache/pano3d/review-evidence/floor-degeneracy-review.mjs
```

A centered variance plus a scale-relative signal floor would address that numerical case, but would
not establish general physical validity. The parent rejected floor correction based on the
separately frozen independent assessment and is cutting it from runtime. The reviewer did not
inspect or tune against fresh-interior inputs or candidate scores. No other important implementation
issue was found in the reviewed pure module or ten-step runtime wiring.
