# Credits

Every captured toy on Splashery's shelf (the Photoreal shelf) is either public domain (CC0) or
licensed under Creative Commons Attribution 4.0 (CC BY 4.0). Nothing with a stricter licence is
used. The same attributions appear in the app under **About & credits**.

## Captured toys

### The first four scans

The first four were changed the same way with `tools/prepare-assets.mjs` (the commands are in
[tools/assets.json](tools/assets.json) and the script): converted to SOG with
`@playcanvas/splat-transform`, spherical harmonics removed, rotated upright, recentred, scaled to a
common size, cropped to the object, decimated to at most 450,000 splats, and a lighter 120,000-splat
copy made for phones.

| Toy          | Work                                                                          | Author                                                                                | Licence                                                       | Changes                                                                                                             |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Cactus       | [3DGS PLY sample data: cactus](https://note.com/steam_studio/n/ne9736d94f162) | steam studio / 3D SCAN STUDIO iris (Lespace Vision Inc.), https://www.steam-studio.jp | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Converted to SOG, SH removed, recentred, scaled, cropped to the pot.                                                |
| Strawberry   | [Strawberry](https://superspl.at/scene/84df8849)                              | Dany Bittel ([patreon.com/DanyBittel](https://www.patreon.com/DanyBittel))            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | Decimated from 1.5M to 450k splats, SH removed, recentred, scaled.                                                  |
| Heart cookie | [Heart Cookie](https://superspl.at/scene/bd964899)                            | Dany Bittel                                                                           | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | SH removed, turned to face the camera, recentred, scaled.                                                           |
| Honeybee     | [Japanese Bee](https://superspl.at/scene/ae58ed2c)                            | YUMA Co., Ltd. (YUMA株式会社)                                                         | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     | Decimated from 978k to 450k splats, SH removed, faint haze and the specimen pin trimmed, turned upright, recentred. |

Where the files came from:

- **Cactus**: the Steam Studio sample pack linked from the note page above (a Box download of
  `3DGS_PLY_sample_data.zip`); Splashery uses `cactus_splat3_30kSteps_464k_splats.ply`. The pack's
  readme says: "These assets are provided under the Creative Commons CC0 license, meaning you're
  free to use them for commercial and non-commercial purposes without any copyright restrictions."
  The authors ask for a credit link to https://www.steam-studio.jp.
- **Strawberry, Heart cookie, Honeybee**: SuperSplat scenes with downloads enabled and the CC BY 4.0
  licence chosen by their authors (checked on each scene page on 22 September 2026). The source
  files are the SOG data the public SuperSplat viewer streams for each scene.

### More scans from SuperSplat

Twelve more SuperSplat scenes, each with downloads enabled and the CC BY 4.0 licence chosen by its
author (checked on 23 September 2026 through the scene data SuperSplat publishes for each page). The
source files are the SOG data the public viewer streams. Each was changed the same way by
`tools/prepare-assets.mjs`: spherical harmonics removed, rotated upright, recentred, scaled to the
common size, decimated to at most 300,000 splats, and a lighter 100,000-splat copy made for phones.
The Mandeltorus is a rendered fractal rather than a scan.

| Toy                  | Work                                                                                             | Author                                  | Licence                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------- |
| Cluster fly          | [Cluster Fly](https://superspl.at/scene/285082b2)                                                | Dany Bittel                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| May beetle           | [MAY-BEETLE-HIRES](https://superspl.at/scene/9d4c4442)                                           | trilithon                               | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Millipede            | [millipede spec.](https://superspl.at/scene/3d5482d4)                                            | scant3d (https://scant3d.com)           | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Carder bumblebee     | [Macroscan - Brown-banded carder bumblebee (Bombus humilis)](https://superspl.at/scene/65ff2330) | macroscans (https://www.macroscans.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Raspberry            | [Raspberry](https://superspl.at/scene/04bdd392)                                                  | Dany Bittel                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Blackberry           | [Blackberry](https://superspl.at/scene/827133e7)                                                 | Dany Bittel                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Blueberry            | [Blueberry](https://superspl.at/scene/fd8b85a7)                                                  | Dany Bittel                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Grape                | [Grape](https://superspl.at/scene/4ae563ac)                                                      | Dany Bittel                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Cinnamon star cookie | [Cinnamon Star Cookie](https://superspl.at/scene/6584b96e)                                       | Dany Bittel                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Tomatoes             | [Tomatoes - No Postshot!](https://superspl.at/scene/0101ad57)                                    | simonbethke                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Mandeltorus          | [MandelTorus 4,12,8,1.5 (Spirula Studio)](https://superspl.at/scene/e7088609)                    | harry7557558                            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Basket               | [Basket](https://superspl.at/scene/efa1fa80)                                                     | hollmar                                 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

### Models from Poly Haven, turned into splats

Fifteen textured 3D models from [Poly Haven](https://polyhaven.com), all CC0: Poly Haven publishes
every asset under CC0 ([polyhaven.com/license](https://polyhaven.com/license)), and each model's
name and authors were checked in the Poly Haven API on 23 September 2026. `tools/mesh-to-splats.mjs`
downloads each glTF, scatters splats over its surfaces by area, colours them from the model's
textures (glass materials are skipped so the insides show), and writes a 3DGS PLY file;
`tools/prepare-assets.mjs` then packs it like the scans (at most 200,000 splats, 80,000 for phones).
Poly Haven does not require credit, but it is given here anyway.

| Toy              | Model                                                                    | Author                       | Licence                                                       |
| ---------------- | ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------- |
| Real rubber duck | [Rubber Duck Toy](https://polyhaven.com/a/rubber_duck_toy)               | Plat251                      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Garden gnome     | [Garden Gnome](https://polyhaven.com/a/garden_gnome)                     | Bhargav Kubal                | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Wooden elephant  | [Carved Wooden Elephant](https://polyhaven.com/a/carved_wooden_elephant) | Greg Zaal                    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Marble bust      | [Marble Bust 01](https://polyhaven.com/a/marble_bust_01)                 | Rico Cilliers                | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Ukulele          | [Ukulele 01](https://polyhaven.com/a/Ukulele_01)                         | Joseph Burgan                | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Alarm clock      | [Alarm Clock 01](https://polyhaven.com/a/alarm_clock_01)                 | Yann Kervran, James Ray Cock | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Vintage camera   | [Camera 01](https://polyhaven.com/a/Camera_01)                           | Rajil Jose Macatangay        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Boombox          | [Boombox](https://polyhaven.com/a/boombox)                               | Thomas Paul Mouilleron       | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Real croissant   | [Croissant](https://polyhaven.com/a/croissant)                           | Greg Zaal, Dario Barresi     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Carrot cake      | [Carrot Cake](https://polyhaven.com/a/carrot_cake)                       | Greg Zaal, James Ray Cock    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Pomegranate      | [Food Pomegranate 01](https://polyhaven.com/a/food_pomegranate_01)       | Oliver Harries               | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Lantern          | [Lantern 01](https://polyhaven.com/a/Lantern_01)                         | Rajil Jose Macatangay        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Cat statue       | [Concrete Cat Statue](https://polyhaven.com/a/concrete_cat_statue)       | Rico Cilliers, Riley Queen   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Chess set        | [Chess Set](https://polyhaven.com/a/chess_set)                           | Riley Queen                  | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Horse statue     | [Horse Statue 01](https://polyhaven.com/a/horse_statue_01)               | Rico Cilliers                | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Procedural toys

The Jelly blob, Donut, Neon knot and Tiny planet (a tribute to Splashery v1) are generated in the
browser from a seed by `src/generators.js`. The toys from packs (`src/packs/*.js`, such as the
beating heart, the campfire and the treasure chest) are built in the browser by the toy kit
(`src/kit.js`) from recipes written for Splashery. None of them use external assets.

## National flags

The pattern layer can wrap a national flag around any toy. The flags are SVG files from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_flags_of_countries), fetched by
`tools/fetch-flags.mjs`, which reads each file's licence from the Commons API and keeps only public
domain and CC0 files. The files are unchanged. Each flag's source page, author line and licence are
listed in [assets/flags/flags.json](assets/flags/flags.json) (196 flags, checked on 23 September
2026). The flag of Oman is not included: its Commons file is under Oman's Open Government Licence
rather than a public-domain or Creative Commons licence (see [docs/BACKLOG.md](docs/BACKLOG.md)).

## Software

Splashery is built on the [PlayCanvas engine](https://github.com/playcanvas/engine) (MIT) and uses
[gifenc](https://github.com/mattdesl/gifenc) (MIT) for GIF export. See [LICENSES.md](LICENSES.md).
