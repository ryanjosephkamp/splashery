# Third-party notices

Splashery vendors two libraries so it runs with no bundler and no CDN. Both are MIT licensed. The
files under `vendor/` are unmodified copies of the published npm builds, except that the source-map
comment was removed from `gifenc.esm.js` because the map is not shipped.

The captured splat toys under `assets/toys/` (scans, and CC0 models turned into splats) have their
own licences (CC0 and CC BY 4.0); see [CREDITS.md](CREDITS.md).

## PlayCanvas Engine 2.22.3

- Package: `playcanvas@2.22.3` (file: `vendor/playcanvas/playcanvas.min.mjs`, the package's
  single-file ESM build `build/playcanvas.min.mjs`; licence copied to `vendor/playcanvas/LICENSE`)
- Source: https://github.com/playcanvas/engine
- License: MIT

```
Copyright (c) 2011-2026 PlayCanvas Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## gifenc 1.0.3

- Package: `gifenc@1.0.3` (file: `vendor/gifenc/gifenc.esm.js`)
- Source: https://github.com/mattdesl/gifenc
- License: MIT

```
The MIT License (MIT)
Copyright (c) 2017 Matt DesLauriers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
OR OTHER DEALINGS IN THE SOFTWARE.
```

## PDF.js 6.3.289 (lane Pictures)

- Package: `pdfjs-dist@6.3.289`. Files in `vendor/pdfjs/`: the legacy build's `pdf.min.mjs` and
  `pdf.worker.min.mjs` (`legacy/build/`; the modern build needs JavaScript features many phones
  lack), and the package's `standard_fonts/`, `cmaps/`, `iccs/` and three decoders from `wasm/`
  (`openjpeg.wasm`, `jbig2.wasm`, `qcms_bg.wasm`, with their license files), all unmodified. The
  license is copied to `vendor/pdfjs/LICENSE`.
- Loaded only when someone opens a PDF (a dynamic import in `src/media.js`).
- Source: https://github.com/mozilla/pdf.js
- License: Apache License 2.0 (the full text is in `vendor/pdfjs/LICENSE`). The wasm decoders are
  under their own licenses, in `vendor/pdfjs/wasm/LICENSE_*` (OpenJPEG: BSD 2-clause; jbig2 from
  PDFium: BSD 3-clause and Apache 2.0; qcms: MIT).

## ONNX Runtime Web 1.30.0 (lane Photo to 3D)

- Package: `onnxruntime-web@1.30.0`. Files in `vendor/onnxruntime-web/`: `ort.wasm.min.mjs`,
  `ort-wasm-simd-threaded.mjs` and `ort-wasm-simd-threaded.wasm` (the WebAssembly build, without
  WebGPU), all unmodified. The license is copied to `vendor/onnxruntime-web/LICENSE`.
- Loaded only when someone opens a photo in the Photo to 3D toy (a dynamic import in
  `src/packs/photo-3d-depth.js`); never on the shelf or in an embed.
- Source: https://github.com/microsoft/onnxruntime
- License: MIT (Copyright (c) Microsoft Corporation; the full text is in
  `vendor/onnxruntime-web/LICENSE`).

## Depth Anything V2 Small, quantized ONNX (lane Photo to 3D)

- File: `vendor/depth-anything-v2-small/model_quantized.onnx` (27,258,801 bytes), the int8 build
  from https://huggingface.co/onnx-community/depth-anything-v2-small, downloaded at build time,
  unmodified. Its model card is copied to `vendor/depth-anything-v2-small/MODEL-CARD.md` and the
  Apache License 2.0 text (from the project's repository) to
  `vendor/depth-anything-v2-small/LICENSE`.
- Loaded only when someone opens a photo in the Photo to 3D toy.
- Source: https://github.com/DepthAnything/Depth-Anything-V2 (Lihe Yang, Bingyi Kang, Zilong Huang,
  Zhen Zhao, Xiaogang Xu, Jiashi Feng, Hengshuang Zhao: "Depth Anything V2", 2024).
- License: Apache License 2.0 for the Small model, checked on the live model cards on September
  29, 2026. The Base, Large and Giant sizes are CC BY-NC and are not used.

## omggif 1.0.10 (lane Pictures)

- Package: `omggif@1.0.10` (file: `vendor/omggif/omggif.js`, the package's `omggif.js` with two
  comment lines added at the top and one `export { GifWriter, GifReader };` line at the end, so it
  loads as an ES module; the license notice is copied to `vendor/omggif/LICENSE`).
- Loaded only when someone opens a GIF in a browser without ImageDecoder (Safari).
- Source: https://github.com/deanm/omggif
- License: MIT

```
(c) Dean McNamee <dean@gmail.com>, 2013.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

## Development tools (not shipped)

These are `devDependencies` used to prepare assets and run tests; nothing from them is served.

- `@playcanvas/splat-transform` 3.6.1 (MIT), https://github.com/playcanvas/splat-transform: converts
  the captured toys to SOG (`tools/prepare-assets.mjs`).
- `@playwright/test` 1.56.1 (Apache-2.0): the smoke test and the thumbnail tool.
- `prettier` 3.8.1 (MIT): formatting.
- `@gltf-transform/core` 4.5.0 (MIT), https://github.com/donmccurdy/glTF-Transform: reads the glTF
  models that `tools/mesh-to-splats.mjs` turns into splats.
- `jpeg-js` 0.4.4 (BSD-3-Clause), https://github.com/eugeneware/jpeg-js, and `pngjs` 7.0.0 (MIT),
  https://github.com/pngjs/pngjs: decode those models' textures in `tools/mesh-to-splats.mjs`, and
  put the before-and-after sharpness crops side by side in `tools/sharpness-pairs.mjs`.
- The TRELLIS Space on Hugging Face (not a package; `tools/image-to-3d.mjs` calls it over HTTPS with
  plain fetch): https://huggingface.co/spaces/trellis-community/TRELLIS (MIT), running the TRELLIS
  model https://huggingface.co/microsoft/TRELLIS-image-large (MIT) and rembg's u2net background
  cut-out (Apache-2.0). It made the Real pencil and Real tin can; their photos' licences are in
  CREDITS.md.
- `jsfive` 0.4.2 (public domain; based on pyfive, BSD-3-Clause, © 2016 Jonathan J. Helmus),
  https://github.com/usnistgov/jsfive, with its dependency `pako` 2.2.0 (MIT AND Zlib),
  https://github.com/nodeca/pako: reads the FIRE-2 simulation's HDF5 snapshot in
  `tools/sci-galaxy.mjs` (lane Science). The site never loads them.
