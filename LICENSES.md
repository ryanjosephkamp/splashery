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

## Splat.js 0.1.0 (lane Video 3D)

- Source: https://github.com/arrival-space/splat.js, commit
  `88efe9aaf32279b0b9bcb781ea0deb4d60c49dff` (September 23, 2026; package version 0.1.0). Files in
  `vendor/splatjs/src/`: the 20 modules that `session.js` and its two workers reach (structure from
  motion, the WebGPU trainer, frame decoding and the PLY writer), all unmodified; the list and what
  was left out are in `vendor/splatjs/VERSION.md`. The library's own video reader
  (`src/io/video.js`, which loads Mediabunny, MPL-2.0) is not vendored: Splashery picks the frames
  itself.
- Loaded only when someone opens a video in the Video to 3D toy (a dynamic import in
  `src/video3d/run.js`); never on the shelf, in another toy or in an embed. Labs only.
- License: MIT (Copyright (c) 2026 Stratum1 GmbH; checked on the live repository page on September
  30, 2026; the full text is in `vendor/splatjs/LICENSE`).

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

## QR Code generator library (lane QR)

- Source: Project Nayuki, https://www.nayuki.io/page/qr-code-generator-library, from
  https://github.com/nayuki/QR-Code-generator at commit `3c6d0b3cefb4e049dc337e82237c9644399716a8`
  (`typescript-javascript/qrcodegen.ts`), compiled to JavaScript with TypeScript 5.6.3
  (`tsc --target ES2020 --module none`). File: `vendor/qrcodegen/qrcodegen.js`, the compiled library
  with a header comment and one `export default qrcodegen;` line added at the end, so it loads as an
  ES module. Nothing else was changed.
- Loaded only when the QR code toy opens (labs only).
- License: MIT (checked on the live project page on October 3, 2026; the notice is in
  `vendor/qrcodegen/LICENSE`):

```
Copyright (c) Project Nayuki. (MIT License)
https://www.nayuki.io/page/qr-code-generator-library

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:
- The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
- The Software is provided "as is", without warranty of any kind, express or
  implied, including but not limited to the warranties of merchantability,
  fitness for a particular purpose and noninfringement. In no event shall the
  authors or copyright holders be liable for any claim, damages or other
  liability, whether in an action of contract, tort or otherwise, arising from,
  out of or in connection with the Software or the use or other dealings in the
  Software.
```

## jsQR 1.4.0 (lane QR)

- Package: `jsqr@1.4.0` (file: `vendor/jsqr/jsQR.js`, the package's `dist/jsQR.js`, unchanged; the
  license is copied to `vendor/jsqr/LICENSE`).
- Source: https://github.com/cozmo/jsQR (Cosmo Wolfe).
- Loaded only when the QR code toy checks that a code scans, in a browser whose own
  `BarcodeDetector` doesn't read QR codes. The QR tests (`tests/qr.spec.mjs`) read the same copy.
- License: Apache License 2.0 (checked on the npm package and the live repository page on October 3,
  2026; the full text is in `vendor/jsqr/LICENSE`).

## Development tools (not shipped)

These are `devDependencies` used to prepare assets and run tests; nothing from them is served.

- `@playcanvas/splat-transform` 3.6.1 (MIT), https://github.com/playcanvas/splat-transform: converts
  the captured toys to SOG (`tools/prepare-assets.mjs`).
- `@playwright/test` 1.56.1 (Apache-2.0): the smoke test and the thumbnail tool.
- `prettier` 3.8.1 (MIT): formatting.
- grooph 0.2.5 (MIT), https://github.com/ryanjosephkamp/grooph: its two hook scripts in
  `.grooph/hooks/`, run by `.claude/settings.json` in the Claude Code sessions that work on this
  repository. They record each session's start, turns, subagents and tool names (never prompts,
  inputs or outputs) and push them to `grooph-events/*` branches. Nothing of it is served.
- `@gltf-transform/core` 4.5.0 (MIT), https://github.com/donmccurdy/glTF-Transform: reads the glTF
  models that `tools/mesh-to-splats.mjs` turns into splats.
- `jpeg-js` 0.4.4 (BSD-3-Clause), https://github.com/eugeneware/jpeg-js, and `pngjs` 7.0.0 (MIT),
  https://github.com/pngjs/pngjs: decode those models' textures in `tools/mesh-to-splats.mjs`, and
  put the before-and-after sharpness crops side by side in `tools/sharpness-pairs.mjs`.
- `jsqr` 1.4.0 (Apache-2.0), https://github.com/cozmo/jsQR, and `@zxing/library` 0.21.3
  (Apache-2.0), https://github.com/zxing-js/library: the two independent QR readers in the QR scan
  lab (`tools/qr-scan-lab.mjs`, `tests/qrl.spec.mjs`). `qrcode-generator` 2.0.4 (MIT),
  https://github.com/kazuhikoarase/qrcode-generator: draws its reference codes. Nothing of them is
  served.
- `three` 0.186.1 (MIT), https://github.com/mrdoob/three.js: its FBX loader and glTF exporter turn
  the Worlds mesh character (Kenney, CC0) into one GLB in `tools/world-character.mjs`, run in
  Chromium at build time. Nothing of three.js is served.
- `bpy` 5.0.1 (Blender as a Python module; GPL-3.0-or-later), https://pypi.org/project/bpy/, with
  `pillow` 12.3.0 (MIT-CMU), https://pypi.org/project/pillow/, in a virtual environment under
  `.cache/`: builds the Worlds realistic character (`tools/wd-character.py`) and model props
  (`tools/wd-props.py`) at build time. Nothing of Blender is served.
- MPFB 2.0.17 (GPL-3.0-or-later), https://extensions.blender.org/add-ons/mpfb/: the MakeHuman add-on
  for Blender, downloaded by `tools/wd-character.py` into `.cache/` to put the character together.
  Nothing of it is served; the character it makes is from CC0 assets (CREDITS.md).
- The TRELLIS Space on Hugging Face (not a package; `tools/image-to-3d.mjs` calls it over HTTPS with
  plain fetch): https://huggingface.co/spaces/trellis-community/TRELLIS (MIT), running the TRELLIS
  model https://huggingface.co/microsoft/TRELLIS-image-large (MIT) and rembg's u2net background
  cut-out (Apache-2.0). It made the Real pencil and Real tin can; their photos' licences are in
  CREDITS.md.
- `jsfive` 0.4.2 (public domain; based on pyfive, BSD-3-Clause, © 2016 Jonathan J. Helmus),
  https://github.com/usnistgov/jsfive, with its dependency `pako` 2.2.0 (MIT AND Zlib),
  https://github.com/nodeca/pako: reads the FIRE-2 simulation's HDF5 snapshot in
  `tools/sci-galaxy.mjs` (lane Science). The site never loads them. `pngjs` (above) also writes that
  tool's picture of the source data (`--map`).

## Build tools outside npm (not shipped)

Programs that run on a build machine to make splats for the Splat Fidelity Plan (lane Fidelity,
approved October 3, 2026). None of them is served; what they make (our renders and the splats
trained from them) is ours, and the models and textures they use keep their own credits
(CREDITS.md).

- Blender 4.5 LTS (GPL-3.0-or-later), https://www.blender.org/: builds and renders the brass orrery
  (`tools/fidelity/orrery.py`) and renders the boombox for Stage 1 (Codex task 08). Tested in the
  cloud sandbox with 4.5.14 LTS for Linux from https://download.blender.org/release/Blender4.5/; the
  owner's Mac runs the macOS build of the same series.
- Brush (Apache-2.0), https://github.com/ArthurBrussee/brush: trains a splat from the renders
  (`tools/fidelity/run-orrery.sh`). The version used is recorded in each run's report.
- msplat (Apache-2.0), https://github.com/rayanht/msplat: the second choice of trainer on Apple
  Silicon, if Brush can't run.

## PDF motion audit build tools (Codex task 21; not shipped)

`tools/pdf-motion/` uses these programs/libraries to build the sample PDFs under
`docs/audits/pdf-motion-2026-10/`. They do not become site runtime dependencies. License sources
were opened on October 4, 2026; installed package notices were also inspected where available.

- ReportLab 4.4.9 (BSD-3-Clause), https://www.reportlab.com/docs/reportlab-userguide.pdf: lays out
  the static sample pages. Existing bundled Python package; no ReportLab program is vendored.
- pypdf 6.10.0 (BSD-3-Clause), https://raw.githubusercontent.com/py-pdf/pypdf/main/LICENSE: writes
  annotations, document scripts and attachments, and checks the resulting objects.
- Pillow 12.3.0 (MIT-CMU), https://pillow.readthedocs.io/en/stable/about.html: reduces captured
  frames to grayscale and assembles verification images. Already listed above for Blender tools;
  this audit uses the existing bundled Python copy.
- TeX Live 2026 / pdfTeX 1.40.29 (TeX Live's component licenses; CTAN lists pdfTeX as GPL and the
  installed executable also reports LGPL component notices), https://ctan.org/pkg/texlive and
  https://ctan.org/pkg/pdftex, with `animate` dated October 14, 2024 (LPPL-1.3c),
  https://ctan.org/pkg/animate: builds the color widget and OCG flip books. The generated PDF
  animation scripts come from `animate`; both LaTeX sources are included. Existing installation.
- Asymptote 3.15 (core LGPL-3.0-or-later, with separately licensed dependencies including GPL
  GSL/Readline), https://raw.githubusercontent.com/vectorgraphics/asymptote/master/README: exports
  the sampled centers as colored PRC markers. Installed through Homebrew after the existing MacTeX
  3.09 binary crashed. The generated geometry and its `.asy` source are included; the exporter
  itself is not copied into the repository.
- FFmpeg / ffprobe 9.0.2 (this installed build reports GPL-3.0-or-later; FFmpeg's base license is
  LGPL-2.1-or-later, with optional GPL parts), https://ffmpeg.org/legal.html: encodes and inspects
  the H.264 clip using the existing build's libx264 encoder. No FFmpeg or x264 executable is
  shipped.
- Poppler `pdftoppm` 26.05.0 (GPL-2.0-or-later), https://poppler.freedesktop.org/ and
  https://raw.githubusercontent.com/tsdgeos/poppler_mirror/master/COPYING: renders static first-page
  posters for inspection, using the bundled runtime. It does not verify active playback.

The existing Playwright, qrcode-generator, jsQR and pngjs tools listed above capture the toy and
build/check its QR. No DoomPDF, PDF Tetris, Flash player or outside game asset is copied. All image,
video and point payloads in these samples come from Splashery's procedural grapes toy.
