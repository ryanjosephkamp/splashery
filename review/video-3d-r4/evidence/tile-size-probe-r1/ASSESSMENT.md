# Fixed-input raster tile diagnostic

Two predeclared frozen-model cases had exact raw output, fixed-point gradients, statistics, and unchanged parameters at tile16 and tile8. The15000-splat320x180case warm fused render/backward was2459.426GPUms at16 and1449.513GPUms at8 (1.697times); opposite variant order from the small case. These are individual shared-load GPU-stage observations, not optimizer/bake throughput or native acceptance.

Made by Ryan with Codex (GPT-6), MIT. Existing copied Splat.js source retains its MIT notices. The cached plant geometry/photos used all cached source frames; this is not independent novel-view evidence. Plant input and derivatives: Ventrovert, CC BY4.0, https://commons.wikimedia.org/wiki/File:Chameleon_on_flowers.webm . Original procedural controls are CC0. Native source/runtime/controllers were untouched.
