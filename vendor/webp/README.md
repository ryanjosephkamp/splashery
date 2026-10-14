# WebP codec (libwebp compiled to WebAssembly)

`webp.mjs` and `webp.wasm`, copied unchanged from `@playcanvas/splat-transform` 3.6.1 (`lib/`),
https://github.com/playcanvas/splat-transform (MIT, PlayCanvas Ltd.). The WASM is libwebp
(BSD-3-Clause, Google Inc., with its patent grant). Both notices are in `LICENSE` beside this file.

The Splat toolkit (lane Viewers) loads it only when someone opens or saves a .sog file: SOG packs
splats into lossless WebP pictures whose bytes must come back exactly, which the browser's own
decoder (through a premultiplied canvas) does not guarantee.
