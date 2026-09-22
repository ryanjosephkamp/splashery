# Third-party notices

Splashery vendors two libraries so it runs with no bundler and no CDN. Both are MIT licensed. The
files under `vendor/` are unmodified copies of the published npm builds, except that the source-map
comment was removed from `gifenc.esm.js` because the map is not shipped.

The captured splat toys under `assets/toys/` have their own licences (CC0 and CC BY 4.0); see
[CREDITS.md](CREDITS.md).

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

## Development tools (not shipped)

These are `devDependencies` used to prepare assets and run tests; nothing from them is served.

- `@playcanvas/splat-transform` 3.6.1 (MIT), https://github.com/playcanvas/splat-transform: converts
  the captured toys to SOG (`tools/prepare-assets.mjs`).
- `@playwright/test` 1.56.1 (Apache-2.0): the smoke test and the thumbnail tool.
- `prettier` 3.8.1 (MIT): formatting.
