# Credits

Every captured toy on Splashery's shelf is either public domain (CC0) or licensed under Creative
Commons Attribution 4.0 (CC BY 4.0). Nothing with a stricter licence is used. The same attributions
appear in the app under **About & credits**.

All four were changed the same way with `tools/prepare-assets.mjs` (the commands are in
[tools/assets.json](tools/assets.json) and the script): converted to SOG with
`@playcanvas/splat-transform`, spherical harmonics removed, rotated upright, recentred, scaled to a
common size, cropped to the object, decimated to at most 450,000 splats, and a lighter 120,000-splat
copy made for phones.

| Toy          | Work                                                                          | Author                                                                                | Licence                                                       | Changes                                                                                             |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cactus       | [3DGS PLY sample data: cactus](https://note.com/steam_studio/n/ne9736d94f162) | steam studio / 3D SCAN STUDIO iris (Lespace Vision Inc.), https://www.steam-studio.jp | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Converted to SOG, SH removed, recentred, scaled, cropped to the pot.                                |
| Strawberry   | [Strawberry](https://superspl.at/scene/84df8849)                              | Dany Bittel ([patreon.com/DanyBittel](https://www.patreon.com/DanyBittel))            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | Decimated from 1.5M to 450k splats, SH removed, recentred, scaled.                                  |
| Heart cookie | [Heart Cookie](https://superspl.at/scene/bd964899)                            | Dany Bittel                                                                           | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | SH removed, turned to face the camera, recentred, scaled.                                           |
| Honeybee     | [Japanese Bee](https://superspl.at/scene/ae58ed2c)                            | YUMA Co., Ltd. (YUMA株式会社)                                                         | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | Decimated from 978k to 450k splats, SH removed, faint haze and the specimen pin trimmed, recentred. |

Where the files came from:

- **Cactus**: the Steam Studio sample pack linked from the note page above (a Box download of
  `3DGS_PLY_sample_data.zip`); Splashery uses `cactus_splat3_30kSteps_464k_splats.ply`. The pack's
  readme says: "These assets are provided under the Creative Commons CC0 license, meaning you're
  free to use them for commercial and non-commercial purposes without any copyright restrictions."
  The authors ask for a credit link to https://www.steam-studio.jp.
- **Strawberry, Heart cookie, Honeybee**: SuperSplat scenes with downloads enabled and the CC BY 4.0
  licence chosen by their authors (checked on each scene page on 22 September 2026). The source
  files are the SOG data the public SuperSplat viewer streams for each scene.

## Procedural toys

The Jelly blob, Donut, Neon knot and Tiny planet (a tribute to Splashery v1) are generated in the
browser from a seed by `src/generators.js`. They have no external assets.

## Software

Splashery is built on the [PlayCanvas engine](https://github.com/playcanvas/engine) (MIT) and uses
[gifenc](https://github.com/mattdesl/gifenc) (MIT) for GIF export. See [LICENSES.md](LICENSES.md).
