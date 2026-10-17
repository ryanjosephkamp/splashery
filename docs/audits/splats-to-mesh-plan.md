# Splats to mesh implementation plan

**Goal:** Implement [task 106](../codex/106-splats-to-mesh.md), including measured quality,
printability, performance, and a draft PR. Codex implements this plan in the current session.

**Architecture:** Engine-independent modules consume the existing splat table convention (positions,
log scales, quaternion, opacity logits, and spherical-harmonic DC color). Sparse Gaussian samples
feed a bounded volume and an indexed isosurface. Print mode fills enclosed cavities, thickens thin
features at the chosen physical size, and checks topology. The Studio entry loads the existing
readers and runs conversion and serialization in a worker.

**Constraints:** Static ES modules, local files, no engine dependency in reconstruction, no
unrelated shared-file edits, MIT code, CC0 original samples, and inherited asset licenses. New tests
are `tests/cdx-mesh*.spec.mjs`; tools are `tools/mesh-export-*.mjs`.

## Review focus

- Empty, invalid, nonfinite, or excessively large input must fail with a readable message.
- Canceling or leaving the tool must stop work and discard stale messages and download URLs.
- Thin/open/disconnected inputs must never receive an unsupported printability claim.
- A low triangle budget must preserve topology or explicitly report that it cannot be met.
- Mesh metadata and save notices must preserve source attribution, including BY-SA and NC.

## Tasks

1. Add failing mathematical and serialization tests. Implement
   `reconstruct(table, options, onProgress)` returning
   `{ positions, normals, colors, indices, report }`, topology validation, and
   `encodeMesh(mesh, format, metadata)` returning named files. Validate sphere dimensions,
   anisotropy, winding, manifold edges and vertices, print units, colors, invalid input, and
   budgets.
2. Add a failing browser flow test. Implement source adapters, a worker client, preview, and a
   labs-only Studio entry. Exercise all four file readers, built-in toy IDs, progress, cancel,
   download formats, input changes, teardown, and license notices at phone and desktop sizes.
3. Fetch the 14 Poly Haven source meshes outside git. Score symmetric surface Chamfer normalized by
   the source diagonal, normal consistency, and watertight/manifold print exports. Validate GLB with
   an identified open-source validator. Export six kit toys and three photo samples. Measure the
   450,000-splat desktop case and the bounded phone profile. Keep bulky evidence on
   `codex/splats-to-mesh-clips`, never in the implementation branch.
4. Explain non-splat output and reconstruction limits in the Manual and About. Run relevant and
   existing tests, formatting, and English checks; merge current `main`; run preflight; create the
   draft PR with Summary, Verification, Deviations, Known issues, and What was cut.

Each implementation task follows a failing-test, implementation, passing-test cycle. Record actual
measurements and any unmet gates in the final audit and PR; do not substitute source meshes for
reconstruction or describe emulation as a physical-phone measurement.
