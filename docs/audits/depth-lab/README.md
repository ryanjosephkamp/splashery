## J. Hard real-world cases (Part E)

Task 75e, October 14, 2026. Made by Ryan with Codex (GPT-6) and **ChatGPT Images** (the OpenAI
native image tool). These are **AI-made by the owner**, fictional Studio Photo to 3D test inputs,
not real captures, real places, or measured depth references. Original assets are CC0 under Rules
B4; the asset registry keeps the project's `AI-made by the owner` label. Nothing here is wired into
a science, math, or engineering toy, or into a public sample picker.

The `depthLabSamples` records intentionally omit `toy`: these are test inputs, so the site builder
must not list them as Photo to 3D samples or add their internal record links to a public toy page.

There are **160 committed 1,280 × 1,280 JPEGs** in `assets/depth-lab/j/`: ten source pictures and
150 controlled variants, totaling **26,251,380 bytes (26.25 MB)** against the 30 MB limit. The
[manifest](../../../tools/depth-lab/j.json) uses `file` paths relative to `assets/depth-lab/`.
`variables.role` distinguishes `source` from `variant`; use variants for comparisons. The
[contact sheet](j.jpg) shows all 160 pictures, one scene per row.

| Scene id   | Hard case and fixed subject                                         |
| ---------- | ------------------------------------------------------------------- |
| `glass`    | Refraction through a water glass, with terracotta spheres behind it |
| `mirror`   | A tabletop mirror, teapot, and reflected objects                    |
| `hair`     | A detached hair sample over a wooden cylinder; no person or face    |
| `fur`      | Long-pile faux fur over a wooden cube; no animal                    |
| `thin`     | Delicate cage wires, with open gaps and objects behind them         |
| `night`    | A glowing lantern, pot, ball, and dark foliage                      |
| `painting` | A painted still life with visible brushwork                         |
| `line-art` | An ink still life with crosshatching                                |
| `graphic`  | A graphic still life with broad fills and overlapping silhouettes   |
| `clutter`  | Overlapping pots, a watering can, twine, and fern fronds            |

Within **each** scene, seven exposure levels vary `exposureStops` through -1.5, -1, -0.5, 0, +0.5,
+1, and +1.5, holding `blurSigmaPx` at zero. Five blur levels vary `blurSigmaPx` through 0, 1, 2, 3,
and 4, holding exposure at zero. The neutral variant is shared by both sweeps, so they use 11 unique
pictures. Four more pictures form the two-variable grid: exposure {-1, +1} × blur {1, 4}. Every
variant starts from the same decoded source JPEG; composition, crop, geometry, size, JPEG quality
(0.78), and JPEG generation count stay fixed. Contact-sheet columns are source; seven exposure
levels; four nonzero blur levels; then four grid cells. Its EV/blur labels identify each cell. An id
such as `j-glass-ev-m15-b00` means -1.5 stops and zero blur.

Exposure multiplies linearized sRGB channels by `2 ** exposureStops`, clips at one, and encodes back
to sRGB. Blur follows exposure, using Chromium Canvas 2D's `blur(sigma px)` filter with replicated
edge padding. These are digital perturbations, not new lighting, optical defocus, sensor noise, or
multiple independent scene samples. JPEG artifacts can change with content even at fixed quality.
Compare within a scene; differences between the ten AI generations are not controlled material or
style comparisons. The graphic source also contains slight tonal variation, so it is not a perfectly
uniform-fill reference.

The tool returned 1,254 × 1,254 PNGs despite the requested larger square size. Each was resampled
once to 1,280 × 1,280 and saved as a source JPEG; this adds no captured detail. Full prompts are
`PROMPT_PREFIX + SCENES[i].prompt` in [gen-j.mjs](../../../tools/depth-lab/gen-j.mjs) and in the ten
source records under `depthLabSamples` in [assets.json](../../../tools/assets.json). Every source
and variant has a file hash, byte count, credit, and transformation record there. Source records
also preserve the native PNG hash and dimensions. The image tool exposed neither its model identity
nor a seed: `seed: null` is intentional, and rerunning prompts will not reproduce them.

Rebuild the manifest, contact sheet, and variants from the committed source JPEGs without calling
the image model:

```sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-j.mjs
# Independent output tree, leaving committed files untouched:
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-j.mjs --out /tmp/depth-lab-j
```

This uses the existing pinned `@playwright/test` 1.56.1 and Prettier 3.8.1, with Chromium
151.0.7922.173 on Linux and Node 24.19.0. No new dependency is needed. Use that Chromium version for
byte-identical exports; browser encoders and system fonts may change the results elsewhere. The ten
source JPEGs are immutable inputs to a rebuild. The optional `--import <directory>` ingests native
PNGs named after scene ids; it is only for replacing the sources intentionally.

All ten native scenes were visually inspected: no people, faces, text, logos, or identifiable
landmarks were seen. Manifest expectations are qualitative hypotheses, not depth ground truth;
mirrors, refraction, and depicted versus physical art have ambiguous interpretations. No depth
inference, Photo to 3D quality scoring, or checkpoint comparison was run: this task prepares
pictures only.

Verification: all 160 JPEGs decoded at 1,280 × 1,280 in real Chromium. All manifest/registry ids,
dimensions, bytes, and SHA-256s matched, including the native source hashes. Every scene's 15
variants had distinct hashes; mean luminance increased across its exposure sweep, and edge energy
decreased across its blur sweep. The separate `--out` rebuild matched all 160 JPEGs, the manifest,
and the contact sheet byte for byte. The browser smoke test
`tests/smoke.spec.mjs --grep 'an embedded captured toy stays under 30 MB of transfer'` passed (one
test, 9.2 MB transfer). Full application and depth tests were not run. Rule check: none.
