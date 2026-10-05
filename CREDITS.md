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

### More scans from SuperSplat, round 2 (lane Photoreal r2)

Thirty more SuperSplat scenes of single objects, added October 3, 2026 behind the labs switch. Each
scene's license was read from its live page (the `rel="license"` link, checked October 3, 2026), and
downloads are enabled on every one. Twenty-seven are CC BY 4.0. Three are NonCommercial, allowed per
asset since the owner's call of October 3, 2026 (Dog plush, Desk globe, Cherry blossom (photo));
each carries `"nc": true` in `tools/assets.json`, and `node tools/nc-assets.mjs` lists them so they
can all come out if the site ever earns money. The cherry blossom is also ShareAlike (CC BY-NC-SA),
so what is made from it keeps that license, and it is never merged with another asset. Scenes with
no license shown on their page, and ones that show a brand name or a character from a game, were
left out. Each file was changed by `tools/pr2-prepare.mjs`: rotated upright, recentred, scaled to a
radius of about 0.9, cleaned of strays and decimated (at most 1,000,000 splats, 300,000 for the lite
files). One band of spherical harmonics is kept on the full files (the lite files have none; the
sources of the alum crystal and the monkey doll have none).

| Toy                    | Scene                                                                                     | Author            | License                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Heart donut            | [Heart Shaped Donut](https://superspl.at/scene/d2a622ec)                                  | John Splat        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Sushi boat             | [SUSHI](https://superspl.at/scene/43ddc643)                                               | leo esteves       | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Seeded bread loaf      | [Seeded Bread Loaf](https://superspl.at/scene/e1beac1a)                                   | John Splat        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Cowboy steak           | [Cowboy Steak](https://superspl.at/scene/6e60e106)                                        | Eric Cornwell     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Stollen                | [Stollen Confectionery](https://superspl.at/scene/070d50b8)                               | Dany Bittel       | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Orange (photo)         | [Fresh Orange](https://superspl.at/scene/633ea98d)                                        | Storm Geerling    | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Physalis               | [Physalis](https://superspl.at/scene/908ed1a1)                                            | Alfred Duemlein   | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Crystal                | [Homemade Crystal Gem](https://superspl.at/scene/6cca7765)                                | Eric Cornwell     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Alum crystal           | [alum-stone](https://superspl.at/scene/9b0c8534)                                          | Arshad            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Puffin                 | [Puffin](https://superspl.at/scene/d44e63ab)                                              | Dan Zeitman       | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Toy T. rex             | [Tyrannosaurus Rex](https://superspl.at/scene/d281a49d)                                   | Alfred Duemlein   | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Monkey doll            | [Monkey Doll](https://superspl.at/scene/726c5f45)                                         | Ethan             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Souvenir elephant      | [Thai souvenir elephant toy](https://superspl.at/scene/b01bfc43)                          | Aung Sann Thit    | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Souvenir turtle        | [Turtle Souvenir](https://superspl.at/scene/c2051d75)                                     | Tony Rose         | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Cave lioness           | [Lioness (Panthera Spelaea)](https://superspl.at/scene/7e4e9bcb)                          | Spenser DIckerson | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Dog plush              | [Dog Plush - Revopoint POP4 with additional Pictures](https://superspl.at/scene/55d00502) | PrintedForFun     | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)       |
| BMX bicycle            | [BMX Bicycle - Enhanced](https://superspl.at/scene/e95011f3)                              | Eric Cornwell     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Murex shell            | [Murex Shell](https://superspl.at/scene/d55ecb52)                                         | Rigsters          | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Sunflower (photo)      | [Sunflower ](https://superspl.at/scene/d8c22218)                                          | Natural Ai        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| White roses            | [White Rose 2](https://superspl.at/scene/e34ad55d)                                        | Natural Ai        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Bonsai tree (photo)    | [Bonsai Tree](https://superspl.at/scene/4c461e7c)                                         | Garrett Nelli     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Mushroom (photo)       | [Rugiboletus extremiorientalis mushroom](https://superspl.at/scene/737cf53c)              | Alexander Omelko  | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Cactus (photo 2)       | [Cactus 1](https://superspl.at/scene/4e095e21)                                            | Natural Ai        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Crochet Earth          | [Earth Crochet from Project Hail Mary](https://superspl.at/scene/8d1a69d2)                | Wan Xi            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Desk globe             | [Cheap globe](https://superspl.at/scene/9e8174d2)                                         | ilk               | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)       |
| Cherry blossom (photo) | [CHERRY BLOSSOM - HIGH PARK](https://superspl.at/scene/4eec644f)                          | Todd Smith        | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| Golden maple           | [Golden Fullmoon Maple](https://superspl.at/scene/f233b115)                               | Joshua Trapani    | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Peonies in a vase      | [Pink Peonies](https://superspl.at/scene/50c8ccf7)                                        | Sergiu Zboras     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Money tree             | [Money Tree (Pachira)](https://superspl.at/scene/45d3761b)                                | Natural Ai        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |
| Knight on a horse      | [A knight with a sword and shield on a black horse](https://superspl.at/scene/2d074d8a)   | Alfred Duemlein   | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)             |

### Models from Poly Haven, turned into splats

Fifteen textured 3D models from [Poly Haven](https://polyhaven.com), all CC0: Poly Haven publishes
every asset under CC0 ([polyhaven.com/license](https://polyhaven.com/license)), and each model's
name and authors were checked in the Poly Haven API on 23 September 2026. `tools/mesh-to-splats.mjs`
downloads each glTF, scatters splats over its surfaces by area, colours them from the model's
textures (glass materials are skipped so the insides show), and writes a 3DGS PLY file;
`tools/prepare-assets.mjs` then packs it like the scans (at most 200,000 splats, 80,000 for phones).
Poly Haven does not require credit, but it is given here anyway. Since Phase C1 the vintage camera,
boombox, wooden elephant and horse statue also have soft studio light baked into their colours (with
the models' own normal and occlusion maps), and the printed maker's names on the camera, its lens
and the boombox are painted out (see `tools/models.json`).

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

### Made from one photo with an image-to-3D model (lane G)

Each of these started as a single photo (CC0 or CC BY, the licence checked on its Wikimedia Commons
page on 27 September 2026, with no brands or logos). `tools/image-to-3d.mjs` sent the photo, shrunk
to 1024 px, to the public [TRELLIS Space](https://huggingface.co/spaces/trellis-community/TRELLIS)
on Hugging Face, which cut out the background (rembg with the u2net model, Apache-2.0) and generated
3D Gaussians with [TRELLIS](https://github.com/microsoft/TRELLIS) (model
[microsoft/TRELLIS-image-large](https://huggingface.co/microsoft/TRELLIS-image-large), MIT). The MIT
licence puts no terms on what the model makes, so each toy keeps its photo's licence and credit.
`tools/prepare-assets.mjs` then packs it like the scans. The sides the photo does not show are the
model's guess.

| Toy          | Photo                                                                                                  | Photographer | Licence                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------- |
| Real pencil  | [Kleiner Bleistift](<https://commons.wikimedia.org/wiki/File:Kleiner_Bleistift_(40045317711).jpg>)     | Tim Reckmann | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)     |
| Real tin can | [Can opened with side opener](https://commons.wikimedia.org/wiki/File:Can_opened_with_side_opener.jpg) | Ll1324       | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

The Real pencil's paints (yellow and the other colors in its Look choice) and the Real tin can's
peaches and tomatoes labels are painted over each scan's own shading by `tools/g-looks.mjs`. The
labels are original designs drawn by that tool for Splashery, released as CC0; they copy no
product's label.

### Real objects: models baked into splats with moving parts (lane Real objects)

Seven everyday objects made from real 3D models: a photogrammetry scan (the running shoe), detailed
photoreal models (CC BY, from Sketchfab, downloaded through the Objaverse mirror on Hugging Face)
and a Poly Haven model (CC0). Each license was checked on the model's live Sketchfab or Poly Haven
page on September 29, 2026. `tools/ro-bake.mjs` samples each model into flat splats with the same
converter as the Model to splats toy, and cuts it into the pieces its tap moves (the cap, the hood,
the sleeves) with hard edges; `tools/ro-sources.mjs` lists each source and its cuts. Changes: the
fountain pen's maker's marks are painted out and its cap moved onto the nib, the water bottle's cap
moved onto its neck, the soda can wears an original plain label painted by the tool (released as
CC0; no brand), the shoe's own bow and the hoodie's drawstrings and inside label are left out, and
the spectacles' lenses are left out. The glass, the notepad, the coaster, the cap's stand, the
laces, the drawstrings, the lenses, the ink, the water and the foam are kit-built.

| Toy          | Model                                                                                                   | Author           | License                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| Fountain pen | [Fountain pen in translucent green](https://sketchfab.com/3d-models/af3606f31c4343859d887049a1908fb0)   | chemicalX        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |
| Water bottle | [Water bottle](https://sketchfab.com/3d-models/water-bottle-42827e2ce39145eda296e6d6524f4c3d)           | danny_p3d        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |
| Soda can     | [Soda Can](https://sketchfab.com/3d-models/soda-can-f3560f1b73a1498d9313a0f10fd11ef6)                   | RoutineStudio    | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |
| Running shoe | [PB158 Sneaker Low](https://sketchfab.com/3d-models/pb158-sneaker-low-d1bb68aebb1b4532b026d8eb824d4c15) | SCANIMAT         | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |
| Hoodie       | [Hoodie](https://sketchfab.com/3d-models/hoodie-97611a53e3b846f69e0655b210f72b2f)                       | Virtual Pandora  | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |
| Sunglasses   | [Round Spectacles](https://polyhaven.com/a/round_spectacles)                                            | Sean Buckley     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Baseball cap | [Baseball Cap](https://sketchfab.com/3d-models/baseball-cap-1c1d34d73fd94e6b9e8f82b1eb7194a0)           | Scott VanArsdale | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |

## Procedural toys

The Jelly blob, Donut, Neon knot and Tiny planet (a tribute to Splashery v1) are generated in the
browser from a seed by `src/generators.js`. The toys from packs (`src/packs/*.js`, such as the
beating heart, the campfire and the treasure chest) are built in the browser by the toy kit
(`src/kit.js`) from recipes written for Splashery. None of them use external assets.

## Protein structures

The protein toy shows real structures from the [RCSB Protein Data Bank](https://www.rcsb.org/). PDB
data files are in the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (wwPDB usage policy). The files in
[assets/proteins](assets/proteins) are unchanged downloads from `https://files.rcsb.org/download/`:

| Entry                                       | Structure                                                 | Authors                                                             |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| [1UBQ](https://www.rcsb.org/structure/1UBQ) | Ubiquitin, refined at 1.8 Å (1987)                        | S. Vijay-Kumar, C. E. Bugg, W. J. Cook                              |
| [4INS](https://www.rcsb.org/structure/4INS) | 2Zn pig insulin crystals at 1.5 Å (1990)                  | G. G. Dodson, E. J. Dodson, D. C. Hodgkin, N. W. Isaacs, M. Vijayan |
| [1EMA](https://www.rcsb.org/structure/1EMA) | Green fluorescent protein from _Aequorea victoria_ (1996) | M. Ormö, S. J. Remington                                            |
| [4HHB](https://www.rcsb.org/structure/4HHB) | Human deoxyhaemoglobin at 1.74 Å (1984)                   | G. Fermi, M. F. Perutz                                              |

### DNA to protein (lane Tiny world r2)

The DNA to protein toy carries four real genes and the alpha carbons of their proteins' structures
in `src/tiny/genes.js`, written by `tools/tw2-genes.mjs`. NCBI sequence records are in the public
domain ([NCBI policies](https://www.ncbi.nlm.nih.gov/home/about/policies/)); PDB entries are
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

| Source                                                          | What                                                 | Authors                                     |
| --------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| [NM_000518.5](https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5) | Human hemoglobin subunit beta (HBB) mRNA             | NCBI RefSeq                                 |
| [NM_000207.3](https://www.ncbi.nlm.nih.gov/nuccore/NM_000207.3) | Human insulin (INS) mRNA, transcript variant 1       | NCBI RefSeq                                 |
| [NM_000239.3](https://www.ncbi.nlm.nih.gov/nuccore/NM_000239.3) | Human lysozyme (LYZ) mRNA                            | NCBI RefSeq                                 |
| [M62653.1](https://www.ncbi.nlm.nih.gov/nuccore/M62653.1)       | _Aequorea victoria_ green fluorescent protein mRNA   | D. C. Prasher and others (1992)             |
| [4HHB](https://www.rcsb.org/structure/4HHB)                     | Human deoxyhemoglobin at 1.74 Å (1984), a beta chain | G. Fermi, M. F. Perutz                      |
| [1MSO](https://www.rcsb.org/structure/1MSO)                     | T6 human insulin at 1.0 Å (2003)                     | G. D. Smith, W. A. Pangborn, R. H. Blessing |
| [1LZ1](https://www.rcsb.org/structure/1LZ1)                     | Human lysozyme at 1.5 Å (1981)                       | P. J. Artymiuk, C. C. F. Blake              |
| [1GFL](https://www.rcsb.org/structure/1GFL)                     | Green fluorescent protein (1996)                     | F. Yang, L. G. Moss, G. N. Phillips Jr.     |

## Chemistry data (lane Chemistry)

The periodic table, the atom toy's 118 elements, the molecule gallery and the DNA come from
published data. Facts and numbers are not copyrightable; the sources are credited here and in each
toy's About tab. `tools/chs-data.mjs` and `tools/chs-molecules.mjs` fetch them again.

- Mass numbers (the most abundant isotope, or the longest-lived one in brackets): NIST,
  [Atomic Weights and Isotopic Compositions](https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses)
  (Coursey, Schwab, Tsai and Dragoset), for elements 1 to 94; PubChem's
  [Periodic Table](https://pubchem.ncbi.nlm.nih.gov/periodic-table/) for 95 to 108; the IUPAC
  [Periodic Table of the Elements](https://iupac.org/what-we-do/periodic-table-of-elements/) (May
  4, 2022) for 109 to 118.
- Ground-state electron configurations: the
  [NIST Atomic Spectra Database](https://physics.nist.gov/asd) (Kramida, Ralchenko, Reader and the
  NIST ASD Team), ionization energies and ground levels, for 1 to 108; PubChem's predicted
  configurations for 109 to 118.
- Emission lines (the photon's color): the strongest visible line (380 to 750 nm) of each element's
  neutral atom, or of its ion when the atom has none there, from the NIST
  [Handbook of Basic Atomic Spectroscopic Data](https://www.nist.gov/pml/handbook-basic-atomic-spectroscopic-data)
  (Sansonetti and Martin), elements 1 to 99. The color of a wavelength follows Dan Bruton's
  approximation of the visible spectrum.
- Element families: PubChem's Periodic Table (NCBI, public domain).
- Molecule gallery: PubChem 3D conformers (public domain) of CIDs 5793 (glucose), 5988 (sucrose),
  2244 (aspirin), 1983 (paracetamol), 3672 (ibuprofen), 5904 (penicillin G), 54670067 (vitamin C),
  681 (dopamine), 5202 (serotonin), 5816 (adrenaline), 896 (melatonin), 6305 (tryptophan), 1548943
  (capsaicin), 1183 (vanillin), 1254 (menthol), 311 (citric acid), 5997 (cholesterol), 6013
  (testosterone) and 5957 (ATP).
- DNA: base pairs 3 to 6 of [1BNA](https://www.rcsb.org/structure/1BNA), the B-DNA dodecamer (1981;
  H. R. Drew, R. M. Wing, T. Takano, C. Broka, S. Tanaka, K. Itakura, R. E. Dickerson), wwPDB,
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); its hydrogens are added at the
  usual bond lengths.
- Crystals: lattice constants at room temperature; alpha quartz's positions after Le Page and Donnay
  (1976).

<!-- Real elements: written by tools/rel-credits.mjs -->

## Real elements (lane Elements)

The Real elements toy (a labs toy) shows 91 elements as photos of real samples, each cut out of its
background and given depth by Depth Anything V2 Small (Apache 2.0) at build time
(`tools/rel-samples.mjs`), in `assets/toys/real-elements/`. Each license was checked on the live
page on October 5, 2026.

- 80 photos from [Images of Elements](https://images-of-elements.com/) (Jumk.de Webprojects),
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) ("The images are licensed under a
  Creative Commons Attribution 3.0 Unported License, unless otherwise noted."; none of these is
  otherwise noted), each credited by a link to its element's page:
  [Hydrogen](https://images-of-elements.com/hydrogen.php),
  [Helium](https://images-of-elements.com/helium.php),
  [Lithium](https://images-of-elements.com/lithium.php),
  [Beryllium](https://images-of-elements.com/beryllium.php),
  [Boron](https://images-of-elements.com/boron.php),
  [Carbon](https://images-of-elements.com/carbon.php),
  [Nitrogen](https://images-of-elements.com/nitrogen.php),
  [Oxygen](https://images-of-elements.com/oxygen.php),
  [Neon](https://images-of-elements.com/neon.php),
  [Sodium](https://images-of-elements.com/sodium.php),
  [Magnesium](https://images-of-elements.com/magnesium.php),
  [Aluminum](https://images-of-elements.com/aluminium.php),
  [Silicon](https://images-of-elements.com/silicon.php),
  [Phosphorus](https://images-of-elements.com/phosphorus.php),
  [Sulfur](https://images-of-elements.com/sulfur.php),
  [Chlorine](https://images-of-elements.com/chlorine.php),
  [Argon](https://images-of-elements.com/argon.php),
  [Potassium](https://images-of-elements.com/potassium.php),
  [Calcium](https://images-of-elements.com/calcium.php),
  [Scandium](https://images-of-elements.com/scandium.php),
  [Titanium](https://images-of-elements.com/titanium.php),
  [Vanadium](https://images-of-elements.com/vanadium.php),
  [Chromium](https://images-of-elements.com/chromium.php),
  [Manganese](https://images-of-elements.com/manganese.php),
  [Iron](https://images-of-elements.com/iron.php),
  [Cobalt](https://images-of-elements.com/cobalt.php),
  [Nickel](https://images-of-elements.com/nickel.php),
  [Copper](https://images-of-elements.com/copper.php),
  [Zinc](https://images-of-elements.com/zinc.php),
  [Gallium](https://images-of-elements.com/gallium.php),
  [Germanium](https://images-of-elements.com/germanium.php),
  [Arsenic](https://images-of-elements.com/arsenic.php),
  [Selenium](https://images-of-elements.com/selenium.php),
  [Bromine](https://images-of-elements.com/bromine.php),
  [Krypton](https://images-of-elements.com/krypton.php),
  [Rubidium](https://images-of-elements.com/rubidium.php),
  [Strontium](https://images-of-elements.com/strontium.php),
  [Yttrium](https://images-of-elements.com/yttrium.php),
  [Zirconium](https://images-of-elements.com/zirconium.php),
  [Niobium](https://images-of-elements.com/niobium.php),
  [Molybdenum](https://images-of-elements.com/molybdenum.php),
  [Ruthenium](https://images-of-elements.com/ruthenium.php),
  [Rhodium](https://images-of-elements.com/rhodium.php),
  [Palladium](https://images-of-elements.com/palladium.php),
  [Silver](https://images-of-elements.com/silver.php),
  [Cadmium](https://images-of-elements.com/cadmium.php),
  [Indium](https://images-of-elements.com/indium.php),
  [Tin](https://images-of-elements.com/tin.php),
  [Antimony](https://images-of-elements.com/antimony.php),
  [Tellurium](https://images-of-elements.com/tellurium.php),
  [Iodine](https://images-of-elements.com/iodine.php),
  [Xenon](https://images-of-elements.com/xenon.php),
  [Cesium](https://images-of-elements.com/caesium.php),
  [Barium](https://images-of-elements.com/barium.php),
  [Lanthanum](https://images-of-elements.com/lanthanum.php),
  [Cerium](https://images-of-elements.com/cerium.php),
  [Praseodymium](https://images-of-elements.com/praseodymium.php),
  [Neodymium](https://images-of-elements.com/neodymium.php),
  [Samarium](https://images-of-elements.com/samarium.php),
  [Europium](https://images-of-elements.com/europium.php),
  [Gadolinium](https://images-of-elements.com/gadolinium.php),
  [Terbium](https://images-of-elements.com/terbium.php),
  [Dysprosium](https://images-of-elements.com/dysprosium.php),
  [Holmium](https://images-of-elements.com/holmium.php),
  [Erbium](https://images-of-elements.com/erbium.php),
  [Thulium](https://images-of-elements.com/thulium.php),
  [Ytterbium](https://images-of-elements.com/ytterbium.php),
  [Lutetium](https://images-of-elements.com/lutetium.php),
  [Hafnium](https://images-of-elements.com/hafnium.php),
  [Tantalum](https://images-of-elements.com/tantalum.php),
  [Tungsten](https://images-of-elements.com/tungsten.php),
  [Rhenium](https://images-of-elements.com/rhenium.php),
  [Osmium](https://images-of-elements.com/osmium.php),
  [Iridium](https://images-of-elements.com/iridium.php),
  [Platinum](https://images-of-elements.com/platinum.php),
  [Gold](https://images-of-elements.com/gold.php),
  [Mercury](https://images-of-elements.com/mercury.php),
  [Thallium](https://images-of-elements.com/thallium.php),
  [Lead](https://images-of-elements.com/lead.php),
  [Bismuth](https://images-of-elements.com/bismuth.php).
- Fluorine: "Liquid fluorine.jpg" by Prof B. G. Mueller,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Liquid_fluorine.jpg). The cut-out sample made
  from it is shared under the same license, shown beside the sample in the toy.
- Technetium: "Technetium-sample.jpg" by Marco Cardin,
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Technetium-sample.jpg). The cut-out sample made
  from it is shared under the same license, shown beside the sample in the toy.
- Radium: "Radium226.jpg" by grenadier, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  on [Commons](https://commons.wikimedia.org/wiki/File:Radium226.jpg).
- Protactinium: "Protactinium-233.jpg" by U.S. Department of Energy,
  [Public domain](https://creativecommons.org/publicdomain/mark/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Protactinium-233.jpg).
- Uranium: "Depleted Uranium.jpg" by 范皓程,
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Depleted_Uranium.jpg).
- Neptunium: "Neptunium2.jpg" by Los Alamos National Laboratory,
  [Public domain](https://creativecommons.org/publicdomain/mark/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Neptunium2.jpg).
- Plutonium: "Plutonium3.jpg" by U.S. Department of Energy,
  [Public domain](https://creativecommons.org/publicdomain/mark/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Plutonium3.jpg).
- Americium: "Americium microscope.jpg" by Bionerd,
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Americium_microscope.jpg).
- Berkelium: "Berkelium metal.jpg" by Oak Ridge National Laboratory, U.S. Department of Energy,
  [Public domain](https://creativecommons.org/publicdomain/mark/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Berkelium_metal.jpg).
- Californium: "Californium.jpg" by U.S. Department of Energy,
  [Public domain](https://creativecommons.org/publicdomain/mark/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Californium.jpg).
- Einsteinium: "EinsteiniumGlow.JPG" by R. G. Haire, U.S. Department of Energy,
  [Public domain](https://creativecommons.org/publicdomain/mark/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:EinsteiniumGlow.JPG).

The facts come from PubChem's periodic table and element pages (NCBI; public domain U.S. government
data); the uses are our own short sentences, each backed by words PubChem quotes from Jefferson Lab
and Los Alamos National Laboratory (U.S. Department of Energy). See `tools/rel-facts.mjs` and
`docs/evidence/real-elements.json`.

<!-- End of Real elements -->

## Word vectors

The word vectors toy uses [GloVe](https://nlp.stanford.edu/projects/glove/) word vectors (Wikipedia
2014 + Gigaword 5, 50 dimensions) by Jeffrey Pennington, Richard Socher and Christopher D. Manning,
Stanford NLP, released under the
[ODC Public Domain Dedication and License 1.0](https://opendatacommons.org/licenses/pddl/1.0/).
`tools/word-vectors.mjs` keeps the 24,000 most common plain words (leaving out words about violence,
weapons and sex), scales each vector to unit length and packs it into
[assets/toys/word-vectors/words.txt](assets/toys/word-vectors/words.txt).

## Handwritten digits

The convolutional network toy's "3D, draw a digit" view uses a small CNN trained by
`tools/cnn-train.mjs` on the
[Optical Recognition of Handwritten Digits](https://archive.ics.uci.edu/dataset/80/optical+recognition+of+handwritten+digits)
set from the UCI Machine Learning Repository (E. Alpaydin and C. Kaynak, 1998;
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). The trained weights and ten sample
digits from the set's test part are in [src/packs/computing-cnn.js](src/packs/computing-cnn.js). The
idea of a 3D network that reads your drawing comes from okdalto's CNN-visualization (LGPL-3.0); no
code or weights were taken from it.

The molecule toy's built-in list and the structures you open yourself are read in your browser
(`src/chem/`); nothing is fetched from anywhere else.

## Pictures and pages

The Picture lab (a labs toy) opens with two samples:

- The article "Pictures Made of Splats" (`assets/toys/picture-lab/article.pdf`): our own text,
  written for Splashery and printed with Chromium by `tools/pic-samples.mjs`. The same tool makes
  the test fixtures in `tests/fixtures/pic/` from our own drawings.
- The photo "Tulip field" (`assets/toys/picture-lab/photo.jpg`) by
  [DennisM2](https://www.flickr.com/photos/14674348@N04/13825345834) on Flickr,
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (checked on the live page on
  September 28, 2026). Unchanged (Flickr's 1024 by 768 copy).

Files and web addresses people open in the Picture lab are read in their browser and never uploaded.

Your book opens with the Tinkerer's Manual (`manual/tinkerers-manual.pdf`, lane Manual). The photo
album and the picture frame (labs toys, lane Books) open with these photos, each
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) on Flickr (checked on the live pages
on September 28, 2026), made smaller (900 pixels on the long side):

- `assets/toys/photo-album/lighthouse.jpg`: "The lighthouse" by
  [-anna--](https://www.flickr.com/photos/77532212@N07/16563630874).
- `assets/toys/photo-album/sailboat.jpg`: "Sailboat" by
  [leex6221](https://www.flickr.com/photos/135788700@N05/35295085365).
- `assets/toys/photo-album/tulips.jpg`: "Tulips" by
  [Lucía Quiñónez](https://www.flickr.com/photos/133590734@N04/17935969728).
- `assets/toys/photo-album/daffodils.jpg`: "CRW_2034.jpg" (daffodils and tulips) by
  [patrick jourdheuille](https://www.flickr.com/photos/128176757@N06/16361600725).
- `assets/toys/photo-album/red-barn.jpg`: "Barn A Glow" by
  [Alan Levine](https://www.flickr.com/photos/37996646802@N01/51912951761).
- `assets/toys/photo-album/seashell.jpg`: "Seashell by the Seashore" by
  [samsonites89](https://www.flickr.com/photos/116158494@N02/20532087302).
- `assets/toys/picture-frame/islands.jpg`: "Sailboat in the Kornati Isalnds" by
  [Camilla K](https://www.flickr.com/photos/148372846@N03/37778143022) (the digital frame also steps
  through the album's photos).

Photos and PDFs people open in these toys are read in their browser and never uploaded.

The Screen (a labs toy, lane Screens) opens with two samples:

- A six-second scene from [Big Buck Bunny](https://peach.blender.org/) (the bunny and the butterfly,
  1:44.5 to 1:50.5, with no title card or logo), © Blender Foundation,
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (checked on peach.blender.org's "About"
  page on September 28, 2026). Cut from the 640 by 360 download at download.blender.org/peach and
  saved as `assets/toys/screen/bunny.mp4` (H.264) and `bunny.webm` (VP9).
- A race horse galloping (`assets/toys/screen/horse.gif`), from Eadweard Muybridge's photographs of
  1887, public domain
  ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif),
  checked on September 28, 2026). Unchanged.

Moving photo to 3D (a labs toy, lane Live input r3) opens with the same Big Buck Bunny scene (©
Blender Foundation, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), checked on
peach.blender.org on October 2, 2026): 48 frames of it at 640 by 360, tiled into
`assets/toys/moving-photo-3d/bunny-sheet-1.jpg` to `-4.jpg`, with each frame's depth worked out by
the vendored depth model (`bunny.depth`, made by `tools/live3-depth.mjs`). GIFs and videos people
open in it are read in their browser and never uploaded.

The Gaussian splatting toy (a labs toy, lane Screens) learns the photo "Strawberry on white
background" by Joselodos
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Strawberry_on_white_background.jpg)),
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (checked on the live page on September
28, 2026), cropped and scaled to 800 by 600 (`assets/toys/gaussian-splatting/strawberry.jpg`).

## Studio

The song landscape (a labs toy) opens with a 20 second tune of our own, made by
`tools/make-song-sample.mjs` (`assets/toys/song-landscape/sample.wav`) and released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Songs people open are decoded in
their browser and never uploaded. The Chladni plate uses the classic square-plate model; no data or
code was taken from anywhere.

The Model to splats toy (a labs toy, lane Studio Models) ships two CC0 sample models, each a single
GLB in `assets/toys/model-splats/` that the toy converts to splats in the browser:

- "Burger" from the [Food Kit](https://kenney.nl/assets/food-kit) by Kenney,
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (checked on the live page and in the
  kit's own license file on September 29, 2026). The color map is embedded in the GLB.
- "Antique Ceramic Vase 01" by James Ray Cock on
  [Poly Haven](https://polyhaven.com/a/antique_ceramic_vase_01),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (checked on the live page on
  September 29, 2026). Its 1k glTF with only the color texture kept.

`tools/stm-samples.mjs` fetches and packs them. The test models in `tests/fixtures/stm/` are made
from numbers by `tools/stm-fixtures.mjs` and released under CC0 1.0. Models people open are
converted in their browser and never uploaded.

The Photo to 3D toy (a labs toy, lane Photo to 3D) ships three CC0 sample photos in
`assets/toys/photo-3d/`, each with a depth map made by `tools/p3d-depth.mjs`. Each license was
checked on its live Wikimedia Commons page on September 29, 2026:

- "Forest Away Path" by Seaq68 (from Pixabay, 2017),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Forest_Away_Path.jpg).
- "Carleton Street off Leeman Road, York" by Malcolmxl5,
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Carleton_Street_off_Leeman_Road_York_Jul25.jpg).
- "Still Life with Cheese" by Antoine Vollon, from the Metropolitan Museum of Art's Open Access
  program, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Still_Life_with_Cheese_MET_DT1989.jpg).

The depth is worked out on the device by
[Depth Anything V2 Small](https://huggingface.co/depth-anything/Depth-Anything-V2-Small) (Lihe Yang
and others, Apache 2.0; the quantized ONNX build is by
[onnx-community](https://huggingface.co/onnx-community/depth-anything-v2-small)), run by
[ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT). Photos people open are processed
in their browser and never uploaded.

The Splat mirror (a labs toy, lane Live input) shows the same "Still Life with Cheese" (CC0 1.0)
with its depth map until someone turns the camera on, and uses the same depth model, in a worker,
for the camera's live depth. The live toys' test signals (claps, sung notes) are made by our own
code; nothing from the microphone, the camera or a shared screen is recorded, stored or sent.

## Sound effects (lane Sound B)

Recorded sound effects for some toys on the nature, weather, food, toys, Open me, medieval, animals,
math, holidays, vehicles and landmarks shelves, in `assets/sounds/`. Every one is CC0 1.0 (public
domain), checked on its live page on September 30, 2026. Each was cut, faded, made mono,
peak-normalized and saved as a small MP3; it loads only when its toy is tapped. The details are in
[tools/assets.json](tools/assets.json) (`sounds`).

| File                         | Work                                                                                             | Author                                             | License                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| `puzzle-cube-turn.mp3`       | [Cube Turn - 9 (a puzzle cube turning)](https://freesound.org/s/486585/)                         | SpaceJoe                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `balloon-dog-pop.mp3`        | [Balloon-Burst-07.wav](https://freesound.org/s/82121/)                                           | Gniffelbaf                                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `book-page.mp3`              | [Book Turn Page 2.wav](https://freesound.org/s/119127/)                                          | esperri                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `apple-bite.mp3`             | [Bite (Apple)](https://freesound.org/s/275015/)                                                  | wadaltmon                                          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `taco-crack.mp3`             | [chips crunch sound](https://freesound.org/s/705360/)                                            | TomatoHater                                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `fireworks-burst.mp3`        | [Firework Explosion 3](https://freesound.org/s/212683/)                                          | a deleted Freesound account (deleted_user_3544904) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `colosseum-crowd.mp3`        | [cheering and clapping crowd 1](https://freesound.org/s/221568/)                                 | AlaskaRobotics                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `colosseum-hooves.mp3`       | [Horse and Carriage.mp3](https://freesound.org/s/388391/)                                        | maadmacs                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `sports-car-rev.mp3`         | [Car Engine Revving.WAV](https://freesound.org/s/558844/)                                        | DigPro120                                          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tractor-engine.mp3`         | [Tractor whirring](https://freesound.org/s/339167/)                                              | vonis22                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `propeller-plane-engine.mp3` | [Aeroplane Passing Close.wav](https://freesound.org/s/507446/)                                   | paulprit                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bow-and-target-release.mp3` | [Bow Release (Bow and Arrow) 3](https://freesound.org/s/384918/)                                 | Ali_6868                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `frog-croak.mp3`             | [Frog croaking sound effect](https://freesound.org/s/354132/)                                    | betterchinese                                      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `frog-fly.mp3`               | [Fly_Buzzing_Edited.wav](https://freesound.org/s/443059/)                                        | AmberdeMeillon                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bonsai-snip.mp3`            | [scissors cut.wav](https://freesound.org/s/175522/)                                              | mywhats                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `oak-leaves.mp3`             | [FallingLeaves](https://freesound.org/s/489911/)                                                 | falcospizaetus                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `rocks-pebbles.mp3`          | [Slow Pebble Tumble.wav](https://freesound.org/s/398698/)                                        | bbrocer                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `iceberg-crack.mp3`          | [Ice Crack 1](https://freesound.org/s/262635/)                                                   | j_p_higgins                                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `klein-bottle-slosh.mp3`     | [Bottle Slosh 2](https://freesound.org/s/667273/)                                                | alegemaate                                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `spinning-top-spin.mp3`      | [Metallic Spinning Top (Dry Sound).wav](https://freesound.org/s/334970/)                         | Uzbazur                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `chess-set-move.mp3`         | [Piece Placement.mp3](https://freesound.org/s/546119/)                                           | el_boss                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `robot-wind.mp3`             | [Wind-up sound](https://freesound.org/s/445966/)                                                 | Breviceps                                          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `dice-throw.mp3`             | [Casino Audio 1.1: dice-throw-1.ogg and dice-throw-3.ogg](https://kenney.nl/assets/casino-audio) | Kenney (kenney.nl)                                 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

The Video to 3D toy (a labs toy, lane Video 3D) ships two sample scenes in `assets/toys/video-3d/`,
each trained by `tools/v3d-sample.mjs` from a stretch of a video on Wikimedia Commons (the splats
and the solved camera path only; the videos are not shipped). Each license was checked on its live
Commons page on September 30, 2026:

- "Statue Of Liberty 4k Drone" by the Dronalist (14 seconds from 3:24),
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), on
  [Commons](https://commons.wikimedia.org/wiki/File:Statue_Of_Liberty_4k_Drone.webm).
- "Walking in EDINBURGH - Scotland (UK) - 4K 60fps (UHD)" by POPtravel (10 seconds from 7:32),
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), on
  [Commons](<https://commons.wikimedia.org/wiki/File:Walking_in_EDINBURGH_-_Scotland_(UK)_-_4K_60fps_(UHD).webm>).

The camera path and the splats are worked out on the device by
[Splat.js](https://github.com/arrival-space/splat.js) (Stratum1 GmbH, MIT). Videos people open are
read in their browser and never uploaded.

## Sound effects (lane Sound C)

Recorded sound effects for the owner's sound notes of October 2, 2026, in `assets/sounds/`. Every
one is CC0 1.0 (public domain), checked on its live Freesound page on October 2, 2026. Each was cut,
faded, made mono, peak-normalized and saved as a small MP3; a toy's recordings load when it opens
with the speaker on. `mitochondrion-fire.mp3`, `lungs-breath-b.mp3` and `lungs-breath-c.mp3` are
Sound Board candidates only. The details are in [tools/assets.json](tools/assets.json)
(`soundSamples`).

| File                        | Work                                                                                                        | Author          | License                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `tin-can-real-roll.mp3`     | [Rolling Can Sound 2](https://freesound.org/people/cower/sounds/185370/)                                    | cower           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `knot-jelly.mp3`            | [Jelly Wobbling in Egg Cup 2.wav](https://freesound.org/people/lolamadeus/sounds/181915/)                   | lolamadeus      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `mitochondrion-furnace.mp3` | [Gas furnace - Ignition happy](https://freesound.org/people/ldezem/sounds/386166/)                          | ldezem          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `mitochondrion-fire.mp3`    | [Gas burner 01.wav](https://freesound.org/people/PegasusCZ/sounds/569332/)                                  | PegasusCZ       | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `paramecium-swim.mp3`       | [Water, Gentle Movement.wav](https://freesound.org/people/Daen23/sounds/431627/)                            | Daen23          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `banana-peel.mp3`           | [Banana Peel](https://freesound.org/people/spanrucker/sounds/272219/)                                       | spanrucker      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `spring-toy-slinky.mp3`     | [slinky Copy.wav](https://freesound.org/people/foxraid/sounds/449261/)                                      | foxraid         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `soap-bubbles-blow.mp3`     | [Blow air short](https://freesound.org/people/yehdawgo/sounds/720066/)                                      | yehdawgo        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `owl-hoot-short.mp3`        | [owl_hooting_000102_0145S3 002-070 000-002 068-074.wav](https://freesound.org/people/Gerent/sounds/558396/) | Gerent          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `decorated-tree-bell.mp3`   | [Glockenspiel - C5 (glock_medium_C5.wav)](https://freesound.org/people/sgossner/sounds/373364/)             | sgossner        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `decorated-tree-sleigh.mp3` | [Sleigh bells hit](https://freesound.org/people/Selector/sounds/369506/)                                    | Selector        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `helicopter-chop.mp3`       | [Helicopter Flyby / Pass](https://freesound.org/people/mil0001/sounds/241190/)                              | mil0001         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `steam-train-chuff.mp3`     | [d_s478_underbridge.wav](https://freesound.org/people/relwin/sounds/686061/)                                | relwin          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `popcorn-pops.mp3`          | [Popcorn](https://freesound.org/people/elricadavis/sounds/764604/)                                          | elricadavis     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `lungs-breath-b.mp3`        | [- Deep Breath](https://freesound.org/people/rrehl/sounds/717167/)                                          | rrehl           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `lungs-breath-c.mp3`        | [Sigh1.wav](https://freesound.org/people/elle-trudgett/sounds/146769/)                                      | elle-trudgett   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bicycle-bell.mp3`          | [Bicycle Bell.wav](https://freesound.org/people/PanosA/sounds/546371/)                                      | PanosA          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `your-book-magazine.mp3`    | [Turn Page](https://freesound.org/people/KikeVilaplana/sounds/511402/)                                      | KikeVilaplana   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `your-book-paperback.mp3`   | [Turning pages in a book](https://freesound.org/people/Mateusz_Chenc/sounds/519102/)                        | Mateusz_Chenc   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `your-book-hardcover.mp3`   | [Hardback 1](https://freesound.org/people/magnuswaker/sounds/697733/)                                       | magnuswaker     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `donut-tear.mp3`            | [bread slice serrated knife cut and rip](https://freesound.org/people/spanrucker/sounds/272223/)            | spanrucker      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `teddy-bear-plush.mp3`      | [08. Relleno de oso.wav](https://freesound.org/people/lemigoga/sounds/427719/)                              | lemigoga        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `splat-field-ocean.mp3`     | [Gentle Ocean Waves Loop](https://freesound.org/people/kkenny101/sounds/852826/)                            | kkenny101       | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `soap-bubbles-pops.mp3`     | [mutliple bubbles bursting](https://freesound.org/people/florianreichelt/sounds/683100/)                    | florianreichelt | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Science (lane Science)

The Science toys (labs, lane Science) show published science data as splats. Each license was
checked on the live source page on September 30, 2026.

- Thermal ellipsoids: aspirin (form II) at 300 K,
  [COD 2104857](https://www.crystallography.net/cod/2104857.html), deposited by E. J. Chan, T. R.
  Welberry, A. P. Heerdegen and D. J. Goossens (Acta Crystallographica B 66, 696–707, 2010), in the
  public domain (the [Crystallography Open Database](https://www.crystallography.net/cod/): "All
  data on this site have been placed in the public domain by the contributors"). The file is
  unchanged.
- Thermal ellipsoids: crambin at 0.54 Å, [PDB 1EJG](https://www.rcsb.org/structure/1EJG), by C.
  Jelsch, M. M. Teeter, V. Lamzin, V. Pichon-Pesme, R. H. Blessing and C. Lecomte (PNAS 97,
  3171–3176, 2000), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy). The PDB file with its header, atom
  and ANISOU records kept and the water left out.
- The test fixtures `tests/fixtures/sci/paracetamol-cod-2104364.cif` and
  `tests/fixtures/sci/sucrose-cod-2300557.cif` are
  [COD 2104364](https://www.crystallography.net/cod/2104364.html) (paracetamol at 100 K) and
  [COD 2300557](https://www.crystallography.net/cod/2300557.html) (sucrose at 298 K, by A. O.
  Dmitrienko and I. S. Bushmarinov, Journal of Applied Crystallography 48, 2015), public domain,
  unchanged.
- Super-resolution microscope: "Microtubules and clathrin in a Cos cell" by Christophe Leterrier
  (Aix Marseille Université, CNRS, NeuroCyto) on ShareLoc.XYZ,
  [10.5281/zenodo.5507427](https://doi.org/10.5281/zenodo.5507427),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A subset: the 170,401 localizations in
  a 12 µm square of the cell, cut by `tools/sci-samples.mjs` into the same .smlm format.
- Super-resolution microscope: "Zola-3D NUP full nucleus" (nuclear pores over a whole nucleus, in
  3D) by Andrey Aristov (Institut Pasteur), uploaded by Benoit Lelandais, on ShareLoc.XYZ,
  [10.5281/zenodo.7233696](https://doi.org/10.5281/zenodo.7233696),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A subset: a random half of the
  localizations (149,633), cut by `tools/sci-samples.mjs` into the same .smlm format.
- Galaxy in a box: the FIRE-2 cosmological zoom-in simulation m12i, snapshot 600 (z = 0), from the
  [FIRE-2 public data release](https://flathub.flatironinstitute.org/fire) on FlatHUB,
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). As the release asks: "We use the
  publicly-available FIRE-2 cosmological zoom-in simulations (Wetzel et al. 2023, 2025), from the
  Feedback In Realistic Environments (FIRE) project, generated using the Gizmo code (Hopkins 2015)
  and the FIRE-2 physics model (Hopkins et al. 2018)." m12i was introduced by Wetzel et al. (2016).
  A subset: 300,000 of the 2.37 million gas particles in a 40 × 12 × 40 kpc box round the galaxy,
  cut by `tools/sci-galaxy.mjs`.

### Science r3 (lane Science r3)

More structures for the Thermal ellipsoids toy (labs), each checked on its live page on October
5, 2026. The Crystallography Open Database dedicates all its data to the public domain under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/) ("All data in the COD and the database
itself are dedicated to the public domain and licensed under the CC0 License"); the PDB's data are
CC0 under the [wwPDB data policy](https://www.rcsb.org/pages/usage-policy). The CIFs are kept with
their embedded refinement files (reflections, SHELX .res and .hkl) left out; the PDB files keep
their HEADER, TITLE, CRYST1, atom and ANISOU records without waters, and the B-DNA file's second
strand is added from its biological assembly (`tools/sci3-structures.mjs`).

- Thermal ellipsoids: Table sugar (sucrose),
  [COD 2300557](https://www.crystallography.net/cod/2300557.html), by A. O. Dmitrienko and I. S.
  Bushmarinov (Journal of Applied Crystallography 48, 2015),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Urea, [COD 1566505](https://www.crystallography.net/cod/1566505.html), by P.
  N. Ruth, R. Herbst-Irmer and D. Stalke (IUCrJ 9 286, 2022),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Vitamin C (ascorbic acid),
  [COD 2300646](https://www.crystallography.net/cod/2300646.html), by C. J. McMonagle and M. R.
  Probert (Journal of Applied Crystallography 52 445, 2019),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Glycine (neutron),
  [COD 2103308](https://www.crystallography.net/cod/2103308.html), by P. Langan, S. A. Mason, D.
  Myles and B. P. Schoenborn (Acta Crystallographica Section B 58 728, 2002),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Acetaminophen (paracetamol),
  [COD 7232757](https://www.crystallography.net/cod/7232757.html), by M. R. Ward and I. D. H. Oswald
  (CrystEngComm 21 4437, 2019), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the
  Crystallography Open Database).
- Thermal ellipsoids: Ibuprofen (neutron),
  [COD 2006278](https://www.crystallography.net/cod/2006278.html), by N. Shankland, C. C. Wilson, A.
  J. Florence and P. J. Cox (Acta Crystallographica Section C 53 951, 1997),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Vitamin B3 (nicotinamide, neutron),
  [COD 2003053](https://www.crystallography.net/cod/2003053.html), by Y. Miwa, T. Mizuno, K.
  Tsuchida et al. (Acta Crystallographica, Section B 55 78, 1999),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Quartz, [COD 9000775](https://www.crystallography.net/cod/9000775.html), by L.
  Levien, C. T. Prewitt and D. J. Weidner (American Mineralogist 65 920, 1980),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Calcite, [COD 9000965](https://www.crystallography.net/cod/9000965.html), by
  S. A. Markgraf and R. J. Reeder (American Mineralogist 70 590, 1985),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Corundum (ruby and sapphire),
  [COD 1000032](https://www.crystallography.net/cod/1000032.html), by L. Lutterotti and P. Scardi
  (Journal of Applied Crystallography 23 246, 1990),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Beryl (emerald),
  [COD 9000992](https://www.crystallography.net/cod/9000992.html), by G. E. Brown and B. A. Mills
  (American Mineralogist 71 547, 1986),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Zircon, [COD 9000684](https://www.crystallography.net/cod/9000684.html), by R.
  M. Hazen and L. W. Finger (American Mineralogist 64 196, 1979),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Garnet (pyrope),
  [COD 2108142](https://www.crystallography.net/cod/2108142.html), by R. Destro, R. Ruffo, P.
  Roversi et al. (Acta Crystallographica Section B 73 722, 2017),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Pyrite (fool's gold),
  [COD 1564890](https://www.crystallography.net/cod/1564890.html), by K. Ma, R. Lefèvre, Q. Li et
  al. (Chemical Science, 2021), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the
  Crystallography Open Database).
- Thermal ellipsoids: Ice from Antarctica (neutron),
  [COD 9015208](https://www.crystallography.net/cod/9015208.html), by A. D. Fortes, I. G. Wood, D.
  Grigoriev et al. (Journal of Chemical Physics 120 11376, 2004),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Rock salt, [COD 7132177](https://www.crystallography.net/cod/7132177.html), by
  M. Mettler, A. Dewandre, N. Tumanov et al. (Chemical communications, 2023),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Gypsum (neutron),
  [COD 2300258](https://www.crystallography.net/cod/2300258.html), by P. F. Henry, M. T. Weller and
  C. C. Wilson (Journal of Applied Crystallography 42 1176, 2009),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Blue vitriol (chalcanthite, neutron),
  [COD 9008253](https://www.crystallography.net/cod/9008253.html), by G. E. Bacon and D. H.
  Titterton (Zeitschrift fur Kristallographie 141 330, 1975),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Lysozyme, 0.65 Å, [PDB 2VB1](https://www.rcsb.org/structure/2VB1), by J. Wang,
  M. Dauter, R. Alkire et al. (Acta Crystallogr.,Sect.D 63 1254, 2007),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: An iron-sulfur protein (HiPIP), 0.48 Å,
  [PDB 5D8V](https://www.rcsb.org/structure/5D8V), by Y. Hirano, K. Takeda and K. Miki (Nature 534
  281, 2016), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: Rubredoxin, 0.68 Å, [PDB 2DSX](https://www.rcsb.org/structure/2DSX), by C.
  Chen, Y. Lin, Y. Huang and M. Liu (Biochem.Biophys.Res.Commun. 349 79, 2006),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: Z-DNA, 0.55 Å, [PDB 3P4J](https://www.rcsb.org/structure/3P4J), by K.
  Brzezinski, A. Brzuszkiewicz, M. Dauter et al. (Nucleic Acids Res. 39 6238, 2011),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: B-DNA, 0.74 Å, [PDB 1D8G](https://www.rcsb.org/structure/1D8G), by C.
  Kielkopf, S. Ding, P. Kuhn and D. Rees (J.Mol.Biol. 296 787, 2000),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).

Files people open in these toys are read in their browser and never uploaded.

Thirteen more structures (the owner's "could you add even more molecules?", October 5, 2026), each
checked on its live page that day:

- Thermal ellipsoids: Vanillin (the taste of vanilla),
  [COD 7242089](https://www.crystallography.net/cod/7242089.html), by S. Sundareswaran and S.
  Karuppannan (CrystEngComm 23 1634, 2021),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Capsaicin (the heat of chili peppers),
  [COD 2312782](https://www.crystallography.net/cod/2312782.html), by M. Lozin&#x161;ek (Acta
  crystallographica. Section C, Structural chemistry 81 188, 2025),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Salicylic acid (from willow bark),
  [COD 2100548](https://www.crystallography.net/cod/2100548.html), by P. Munshi and T. N. Guru Row
  (Acta Crystallographica Section B 62 612, 2006),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Morphine, [COD 2237167](https://www.crystallography.net/cod/2237167.html), by
  T. Gelbrich, D. E. Braun and U. J. Griesser (Acta Crystallographica Section E 69 o2, 2013),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Cytosine, a letter of DNA,
  [COD 2019803](https://www.crystallography.net/cod/2019803.html), by B. Sridhar, J. B. Nanubolu and
  K. Ravikumar (Acta Crystallographica Section C 71, 2015),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Guanine, a letter of DNA,
  [COD 2015488](https://www.crystallography.net/cod/2015488.html), by K. Guille and W. Clegg (Acta
  Crystallographica Section C 62 o515, 2006),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: Serotonin, a messenger in the brain,
  [COD 2244048](https://www.crystallography.net/cod/2244048.html), by M. Naeem, A. R. Chadeayne, J.
  A. Golen and D. R. Manke (Acta Crystallographica Section E 78, 2022),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: NAD+, a helper molecule in every cell,
  [COD 1507221](https://www.crystallography.net/cod/1507221.html), by B. Guillot, N. Muzet, E.
  Artacho et al. (The Journal of Physical Chemistry B 107 9109, 2003),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the Crystallography Open Database).
- Thermal ellipsoids: A-DNA, 0.83 Å, [PDB 1DPL](https://www.rcsb.org/structure/1DPL), by M. Egli, V.
  Tereshko, M. Teplova et al. (Biopolymers 48 234, 1998),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: A four-stranded RNA, 0.61 Å, [PDB 1J8G](https://www.rcsb.org/structure/1J8G),
  by J. Deng, Y. Xiong and M. Sundaralingam (Proc.Natl.Acad.Sci.USA 98 13665, 2001),
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: A loop of ribosomal RNA, 0.85 Å,
  [PDB 5NQI](https://www.rcsb.org/structure/5NQI), by C. Riml, A. Lusser, E. Ennifar and R. Micura
  (J. Org. Chem. 82 7939, 2017), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under
  the [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: DNA with a drug in its groove, 0.95 Å,
  [PDB 3OMJ](https://www.rcsb.org/structure/3OMJ), by D. Chenoweth and P. Dervan (J.Am.Chem.Soc. 132
  14521, 2010), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).
- Thermal ellipsoids: DNA with a light-switch metal complex, 0.92 Å,
  [PDB 4E1U](https://www.rcsb.org/structure/4E1U), by H. Song, J. Kaiser and J. Barton (Nat Chem 4
  615, 2012), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
  [wwPDB data policy](https://www.rcsb.org/pages/usage-policy).

Four more super-resolution microscopy sets from ShareLoc.XYZ on Zenodo (each record's CC BY 4.0 read
on its live page on October 5, 2026). Three records give no localization precision; theirs is
estimated from the data by NeNA (Endesfelder et al., Histochemistry and Cell Biology 141, 629–638,
2014).

- Super-resolution microscope: "Xenopus laevis nuclear pore complex stained with WGA-ATTO520" by
  Anna Löschberger, on ShareLoc.XYZ,
  [10.5281/zenodo.7182237](https://doi.org/10.5281/zenodo.7182237),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). An 8 µm square cut from the record (a
  subset), cut by `tools/sci3-samples.mjs`. The record gives no precision; NeNA estimates 11.5 nm
  for the whole set.
- Super-resolution microscope: "Actin with PhalloidinAF647 in COS7" by Sarah Aufmkolk, on
  ShareLoc.XYZ, [10.5281/zenodo.5510661](https://doi.org/10.5281/zenodo.5510661),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A 10 µm square of one cell, 174,903 of
  its localizations (a subset), cut by `tools/sci3-samples.mjs`. The record gives no precision; NeNA
  estimates 9.9 nm for the whole set.
- Super-resolution microscope: "Mitochondrial protein TOM22 in COS7 cells" by Wei Ouyang, on
  ShareLoc.XYZ, [10.5281/zenodo.5512636](https://doi.org/10.5281/zenodo.5512636),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A 15 µm square of one field, 219,846 of
  its localizations (a subset), cut by `tools/sci3-samples.mjs`. The record gives no precision; NeNA
  estimates 12.4 nm for the whole set.
- Super-resolution microscope: "ZOLA-3D microtubules" by Andrey Aristov, Benoit Lelandais and
  Christophe Zimmer (Institut Pasteur), on ShareLoc.XYZ,
  [10.5281/zenodo.6861446](https://doi.org/10.5281/zenodo.6861446),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A 12 µm square, 159,785 of its
  localizations (a subset), cut by `tools/sci3-samples.mjs`.

More of the FIRE-2 public data release for Galaxy in a box
([FlatHUB](https://flathub.flatironinstitute.org/fire),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), read on the release's README on October
5, 2026), with the citation it asks for: "We use the publicly-available FIRE-2 cosmological zoom-in
simulations (Wetzel et al. 2023, 2025), from the Feedback In Realistic Environments (FIRE) project,
generated using the Gizmo code (Hopkins 2015) and the FIRE-2 physics model (Hopkins et al. 2018)."
Subsets cut by `tools/sci3-galaxy.mjs`:

- FIRE-2 m12i (res7100), snapshot 600 (z = 0), stars (m12i: Wetzel et al. (2016)): 250,000 of the
  11.4 million star particles in the 40 × 12 × 40 kpc box, with their ages.
- FIRE-2 m12i (res7100), snapshot 172 (z = 2), gas (m12i: Wetzel et al. (2016)): 300,000 of the 1.36
  million gas particles in a 24 kpc box.
- FIRE-2 m12i (res7100), snapshot 172 (z = 2), stars (m12i: Wetzel et al. (2016)): 250,000 of the
  640,318 star particles in a 24 kpc box.
- FIRE-2 m11h (res7100), snapshot 600 (z = 0), gas (m11h: El-Badry et al. (2018)): 300,000 of the
  351,956 gas particles in a 16 kpc box.
- FIRE-2 m11h (res7100), snapshot 600 (z = 0), stars (m11h: El-Badry et al. (2018)): 250,000 of the
  640,445 star particles in a 16 kpc box.

The land for Terrain in a box and the Contour lab: the U.S. Geological Survey's 3D Elevation
Program, 1/3 arc-second (about 10 m) seamless elevation tiles from The National Map, public domain
(each tile's metadata, read on October 5, 2026: "All 3DEP products are public domain."), cut by
`tools/sci3-terrain.mjs`:

- Mount St. Helens, Washington: a 9 km square of
  [USGS_13_n47w123.tif](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n47w123/USGS_13_n47w123.tif)
  ([metadata](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n47w123/USGS_13_n47w123.xml)),
  averaged to 256 × 256 samples.
- The Grand Canyon near Grand Canyon Village, Arizona: a 12 km square of
  [USGS_13_n37w113.tif](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n37w113/USGS_13_n37w113.tif)
  ([metadata](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n37w113/USGS_13_n37w113.xml)),
  averaged to 256 × 256 samples.
- Yosemite Valley and Half Dome, California: a 10 km square of
  [USGS_13_n38w120.tif](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n38w120/USGS_13_n38w120.tif)
  ([metadata](https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n38w120/USGS_13_n38w120.xml)),
  averaged to 256 × 256 samples.

Three cryo-EM maps from the Electron Microscopy Data Bank, each with the atomic model fitted into it
from the PDB (checked on the live pages on October 5, 2026).

- Cryo-EM map: Mouse heavy-chain apoferritin by cryo-EM at 100 keV, 2.6 Å,
  [EMD-17961](https://www.ebi.ac.uk/emdb/EMD-17961) and its fitted model
  [PDB 8PVC](https://www.rcsb.org/structure/8PVC), by G. McMullan, K. Naydenova, D. Mihaylov et al.
  (PNAS 120, e2312905120, 2023). The map: EMDB's data are "free of all copyright restrictions and
  made fully and freely available for both non-commercial and commercial use" (the
  [EMDB FAQ](https://www.ebi.ac.uk/emdb/faq)); cropped, blurred against aliasing and resampled by
  `tools/sci3-cryoem.mjs`. The model: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
  (the wwPDB data policy); its backbone only.
- Cryo-EM map: Arbekacin-bound E. coli 70S ribosome, 3.2 Å,
  [EMD-48329](https://www.ebi.ac.uk/emdb/EMD-48329) and its fitted model
  [PDB 9MKK](https://www.rcsb.org/structure/9MKK), by S. Majumdar, N. P. Parajuli, X. Ge, A.
  Emmerich and S. Sanyal (Scientific Reports 15, 18271, 2025). The map: EMDB's data are "free of all
  copyright restrictions and made fully and freely available for both non-commercial and commercial
  use" (the [EMDB FAQ](https://www.ebi.ac.uk/emdb/faq)); cropped, blurred against aliasing and
  resampled by `tools/sci3-cryoem.mjs`. The model:
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the wwPDB data policy); its
  backbone only.
- Cryo-EM map: AAV2 virus-like particle, 3.02 Å, [EMD-20610](https://www.ebi.ac.uk/emdb/EMD-20610)
  and its fitted model [PDB 6U0V](https://www.rcsb.org/structure/6U0V), by M. Agbandje-McKenna and
  A. Bennett (deposited 2019). The map: EMDB's data are "free of all copyright restrictions and made
  fully and freely available for both non-commercial and commercial use" (the
  [EMDB FAQ](https://www.ebi.ac.uk/emdb/faq)); cropped, blurred against aliasing and resampled by
  `tools/sci3-cryoem.mjs`. The model: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
  (the wwPDB data policy); its backbone only.

## Night sky (lane Night sky)

The catalog snapshot `assets/toys/night-sky/sky.json` (made by `tools/sky-catalog.mjs`) joins two CC
BY-SA sources, so it is [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) too, and the
toy's About tab says so.

- Stars: the [HYG database](https://github.com/astronexus/HYG-Database) v4.1 by David Nash
  (astronexus.com), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (its live
  LICENSE file, checked October 5, 2026). Every star to magnitude 6.0 and the fainter stars a
  constellation line needs (5,071), with position, magnitude, B−V color, distance, spectral type and
  names.
- Constellation lines: the Stellarium team's
  [Western sky culture](https://github.com/Stellarium/stellarium-skycultures/tree/master/western)
  (commit 014fbb5e59, May 26, 2026). Its description's license section reads "Text and data: CC
  BY-SA" (no version given; credited here as 4.0) and "Illustrations: Free Art License"; only the
  line data (pairs of Hipparcos numbers, 674 segments in the 88 constellations) is used, never the
  illustrations.
- Planet, Sun and Moon positions are computed in the browser from published formulas: E. M.
  Standish's
  [Keplerian Elements for Approximate Positions of the Major Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
  (JPL Solar System Dynamics, Table 1), the Astronomical Almanac's low-precision lunar series, and
  Jean Meeus, _Astronomical Algorithms_ (2nd ed., 1998) for sidereal time, precession and planet
  magnitudes. The tests compare them with values recorded from
  [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (`tools/sky-horizons.mjs`, build time only).

The place the toy shows is never saved or sent: a city's coordinates are built in, and "Use my
location" keeps the browser's answer in memory only.

## Data and climate (lane Data and climate)

The Data in 3D toy (Studio) and the Climate records toy (Science) ship dated snapshots and never
fetch anything live. Each license was checked on the live source page on October 5, 2026.

- Climate records and a Data in 3D sample: monthly mean CO2 at Mauna Loa from the
  [NOAA Global Monitoring Laboratory](https://gml.noaa.gov/ccgg/trends/data.html) (Xin Lan, Pieter
  Tans and Kirk W. Thoning), NOAA's file of September 5, 2026, in the public domain under
  [NOAA's terms](https://gml.noaa.gov/about/disclaimer.html) ("in the public domain, unless
  specifically annotated otherwise"). NOAA does not endorse Splashery. Only NOAA's own measurements,
  from May 1974, are kept: the file's months from March 1958 to April 1974 come from the Scripps
  Institution of Oceanography, whose site carries no data license and whose site terms forbid
  republishing without permission, so they are left out.
- Climate records: the GISS Surface Temperature Analysis
  ([GISTEMP v4](https://data.giss.nasa.gov/gistemp/)), Land-Ocean Temperature Index, by the GISTEMP
  Team, NASA Goddard Institute for Space Studies (2026), accessed October 5, 2026; and Lenssen, N.,
  G. A. Schmidt, M. Hendrickson, P. Jacobs, M. Menne and R. Ruedy (2024), "A GISTEMPv4 observational
  uncertainty ensemble", Journal of Geophysical Research: Atmospheres 129, e2023JD040179. A U.S.
  government work, in the public domain.
- Data in 3D sample: earthquakes of magnitude 4.5 and up in the 30 days to October 5, 2026, from the
  [U.S. Geological Survey](https://earthquake.usgs.gov/earthquakes/feed/v1.0/csv.php), a U.S.
  government work in the public domain. Seven of the feed's columns are kept.
- Data in 3D sample: the Iris data of R. A. Fisher (1936), Bezdek's corrected copy from the
  [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/53/iris),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A header row was added and "Iris-"
  written as "Iris ".

Tables people open in Data in 3D are read in their browser and never uploaded.

## Sound and light lab

The Sound lab, the Sound recorder and the Light lab (labs) use no recorded assets: their sounds and
the spectrometer's sample picture are made by the page. Their data:

- Emission lines: the visible lines (380 to 750 nm, in air) of sixteen neutral atoms, from the NIST
  [Handbook of Basic Atomic Spectroscopic Data](https://www.nist.gov/pml/handbook-basic-atomic-spectroscopic-data)
  (Sansonetti and Martin, J. Phys. Chem. Ref. Data 34, 1559 (2005); NIST SRD 108, drawn from the
  Atomic Spectra Database), its "Strong Lines" tables for H, He, Li, Na, K, Ca, Sr, Ba, Cu, Zn, Cd,
  Hg, Ne, Ar, Kr and Xe (for example
  [hydrogentable2.htm](https://physics.nist.gov/PhysRefData/Handbook/Tables/hydrogentable2.htm)).
  Measured values, credited to NIST; `tools/sll-nist.mjs` fetches them again.
- Glass: SCHOTT's Sellmeier coefficients for N-SF11 and N-BK7, as listed on
  [RefractiveIndex.INFO](https://refractiveindex.info/?shelf=specs&book=SCHOTT-optical&page=N-SF11)
  (from the SCHOTT catalog).
- Wavelength colors: Dan Bruton's approximation of the visible spectrum.

## Imaging (lane Imaging)

- Walnut CT scan: Walnut 1 of the "Cone-Beam X-Ray CT Data Collection Designed for Machine Learning:
  Samples 1-8" by Henri Der Sarkissian, Felix Lucka, Maureen van Eijnatten, Giulia Colacicco, Sophia
  Bethany Coban and K. Joost Batenburg (CWI, Amsterdam; Scientific Data 6, 215, 2019),
  [10.5281/zenodo.2686726](https://doi.org/10.5281/zenodo.2686726),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its high-quality reconstruction (100 µm
  voxels), every second slice, averaged to 0.3 mm, cropped and stored as 8-bit densities by
  `tools/img-walnut.mjs`.
- The airport X-ray scanner, How CT works and their bags, shell and scanners are built by the toys'
  recipes.

## Molecule viewer (lane Molecule viewer)

The Molecule viewer (labs) ships a snapshot of five entries from the Protein Data Bank, fetched from
files.rcsb.org on October 5, 2026, unchanged. PDB data are
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) under the
[wwPDB usage policy](https://www.wwpdb.org/about/usage-policies) (checked on the live page October
5, 2026: "Data files contained in the PDB archive are available under the CC0 1.0 Universal (CC0
1.0) Public Domain Dedication"); as it encourages, each entry and its authors are cited:

- Crambin, [PDB 1CRN](https://www.rcsb.org/structure/1CRN), deposited by W. A. Hendrickson and M. M.
  Teeter; M. M. Teeter, "Water structure of a hydrophobic protein at atomic resolution", PNAS 81,
  6014 (1984).
- Green fluorescent protein, [PDB 1EMA](https://www.rcsb.org/structure/1EMA), deposited by M. Ormö
  and S. J. Remington; M. Ormö, A. B. Cubitt, K. Kallio, L. A. Gross, R. Y. Tsien and S. J.
  Remington, Science 273, 1392 (1996).
- Hen egg-white lysozyme, [PDB 1LYZ](https://www.rcsb.org/structure/1LYZ), deposited by R. Diamond,
  D. C. Phillips, C. C. F. Blake and A. C. T. North; R. Diamond, J. Mol. Biol. 82, 371 (1974).
- B-DNA dodecamer, [PDB 1BNA](https://www.rcsb.org/structure/1BNA): H. R. Drew, R. M. Wing, T.
  Takano, C. Broka, S. Tanaka, K. Itakura and R. E. Dickerson, PNAS 78, 2179 (1981).
- Caffeine, [Chemical Component CFF](https://www.rcsb.org/ligand/CFF): the ideal coordinates of the
  wwPDB Chemical Component Dictionary (part of the PDB archive, CC0).

An entry fetched by its code is read from RCSB when the person asks and is never stored; its title,
authors and the time of the fetch show beside it, with the CC0 notice. Files people open are read in
their browser and never uploaded.

## Worlds

Hybrid mode in Worlds (a labs page) lights its ground with four texture sets and its sky with one
HDRI, all from [Poly Haven](https://polyhaven.com) under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (Poly Haven publishes every asset
under CC0, [polyhaven.com/license](https://polyhaven.com/license); checked on the live pages on
September 29, 2026). `tools/world-assets.mjs` fetches them and packs them into
`assets/worlds/ground/` and `assets/worlds/sky/`; the Worlds page credits them in its list of
places.

| Used as           | Asset                                                                                                   | Authors                | License                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Sky and its light | [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | Greg Zaal, Jarod Guest | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Sand              | [Sand 01](https://polyhaven.com/a/sand_01)                                                              | Rob Tuytel             | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Grass             | [Rocky Terrain 02](https://polyhaven.com/a/rocky_terrain_02)                                            | Amal Kumar             | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Rock              | [Rock Ground](https://polyhaven.com/a/rock_ground)                                                      | Rob Tuytel             | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Wet sand          | [Damp Beach Sand](https://polyhaven.com/a/damp_beach_sand)                                              | Dimitrios Savva        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Its mesh character (to compare with the splat character; `?character=mesh`) is from
[Animated Characters: Protagonists](https://kenney.nl/assets/animated-characters-protagonists) by
Kenney, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (checked on the live page and
in the pack's own license file on September 29, 2026): the model, the "skaterMaleA" skin and the
idle and run animations. The walk is made from the run. `tools/world-character.mjs` builds
`assets/worlds/character/character.glb`.

Round 3 (September 30, 2026) made a realistic person the hybrid mode's character
(`tools/wd-character.py` builds `assets/worlds/character/human-high.glb` and `human-low.glb`), and
the Kenney character moved to `?character=kenney`:

- The body, face, skin ("middleage caucasian male"), eyes ("brown"), eyebrows ("eyebrow001"),
  eyelashes ("eyelashes01"), hair ("short02"), T-shirt and jeans ("male_casualsuit06") and shoes
  ("shoes06") are from
  [MakeHuman's system assets](http://files.makehumancommunity.org/asset_packs/makehuman_system_assets/)
  by the MakeHuman team, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (each asset
  marked CC0 on that page and in its own files, checked on September 30, 2026), put together with
  MPFB 2.0.17 in Blender. The face is MakeHuman's average of its macro settings (no scan, no real
  person). The T-shirt's printed logo, the jeans' label text and the site address in the texture
  were painted out.
- The idle, walk and run are motion capture from the
  [100STYLE dataset](https://zenodo.org/records/8127870) by Ian Mason, Sebastian Starke and Taku
  Komura (2022), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (checked on its Zenodo
  record on September 30, 2026): the takes Neutral_ID (idle), Neutral_FW (walk) and Proud_FR (run),
  retargeted onto the character, cut to one loop each and played in place.

Its model props (hybrid mode; `tools/wd-props.py` builds `assets/worlds/props/`) are scanned models
from [Poly Haven](https://polyhaven.com), all
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (checked on each live page on
September 30, 2026), decimated into three levels of detail each:

| Used as            | Asset                                                                    | Authors                            | License                                                       |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| Boulders           | [Rock Moss Set 02](https://polyhaven.com/a/rock_moss_set_02)             | Kless Gyzen                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Boulders           | [Namaqualand Boulder 05](https://polyhaven.com/a/namaqualand_boulder_05) | Dario Barresi, Jenelle van Heerden | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Stones and pebbles | [Namaqualand Stones 01](https://polyhaven.com/a/namaqualand_stones_01)   | Greg Zaal, Jenelle van Heerden     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Stones and pebbles | [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01)             | Kless Gyzen                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Shells             | [Lambis Shell](https://polyhaven.com/a/lambis_shell)                     | Kuutti Siitonen                    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Driftwood          | [Dead Tree Trunk 02](https://polyhaven.com/a/dead_tree_trunk_02)         | Jenelle van Heerden, Rico Cilliers | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Stumps             | [Tree Stump 01](https://polyhaven.com/a/tree_stump_01)                   | Rob Tuytel                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## National flags

The pattern layer can wrap a national flag around any toy. The flags are SVG files from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_flags_of_countries), fetched by
`tools/fetch-flags.mjs`, which reads each file's licence from the Commons API and keeps only public
domain and CC0 files. The files are unchanged. Each flag's source page, author line and licence are
listed in [assets/flags/flags.json](assets/flags/flags.json) (196 flags, checked on 23 September
2026). The flag of Oman is not included: its Commons file is under Oman's Open Government Licence
rather than a public-domain or Creative Commons licence (see [docs/BACKLOG.md](docs/BACKLOG.md)).

## Sounds

Most tap sounds are synthesized in the browser (`src/voices.js`). Some use short recordings in
`assets/sounds/`, fetched only when a toy that uses one is tapped. All are CC0 1.0 (public domain
dedication), from [Freesound](https://freesound.org) and Kenney's
[Impact Sounds](https://kenney.nl/assets/impact-sounds), checked on their live pages on September
30, 2026. Each was cut, trimmed, faded, normalized and saved as a small mono MP3; the cut is
recorded in `tools/assets.json` ("soundSamples"), and the About tab credits the ones the current toy
uses.

| File                                     | Toys                                                  | Source                                                                                                     | Author           |
| ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| `alarm-clock-bell.mp3`                   | alarm-clock                                           | [old alarm clock ringing](https://freesound.org/people/tuberatanka/sounds/102435/)                         | tuberatanka      |
| `asteroid-crumble.mp3`                   | asteroid                                              | [Rocks.wav](https://freesound.org/people/adamgryu/sounds/336023/)                                          | adamgryu         |
| `baseball-bat.mp3`                       | baseball                                              | [Bat Hit 9 FF095.aif](https://freesound.org/people/martinimeniscus/sounds/162886/)                         | martinimeniscus  |
| `beach-ball-bounce.mp3`                  | beach-ball                                            | [fotballPlast.wav](https://freesound.org/people/blindmanonacid/sounds/117111/)                             | blindmanonacid   |
| `bowling-ball-pins.mp3`                  | bowling-ball                                          | [B_2 Bowling ball striking pins.wav](https://freesound.org/people/Yarmonics/sounds/441856/)                | Yarmonics        |
| `bowling-ball-roll.mp3`                  | bowling-ball                                          | [Bowling Ball.wav](https://freesound.org/people/driftworks/sounds/128969/)                                 | driftworks       |
| `cat-statue-meow.mp3`                    | cat-statue                                            | [cat meow short](https://freesound.org/people/skymary/sounds/412017/)                                      | skymary          |
| `comet-fire.mp3`                         | comet, meteor                                         | [Torch.wav](https://freesound.org/people/DanielVega/sounds/479338/)                                        | DanielVega       |
| `crystal-ball-ring.mp3`                  | crystal-ball                                          | [Wine glass clink deeper.wav](https://freesound.org/people/lmr9/sounds/178178/)                            | lmr9             |
| `crystal-lattice-chain.mp3`              | crystal-lattice                                       | [Steel chain soft drop](https://freesound.org/people/ani_music/sounds/167913/)                             | ani_music        |
| `diamond-tap.mp3`                        | diamond, ruby, emerald, sapphire, opal                | [Glass Tap.wav](https://freesound.org/people/Unicornaphobist/sounds/262958/)                               | Unicornaphobist  |
| `dna-zipper.mp3`                         | dna                                                   | [Zipper Unzip 3 (Slow) .wav](https://freesound.org/people/RutgerMuller/sounds/51176/)                      | RutgerMuller     |
| `grand-piano-*.mp3` (23 notes, A0 to C8) | grand-piano                                           | [88 piano keys, long reverb](https://freesound.org/people/TEDAgame/packs/25405/)                           | TEDAgame         |
| `heart-beat.mp3`                         | heart                                                 | [Human Heartbeat (60 BPM)](https://freesound.org/people/FenrirFangs/sounds/213181/)                        | FenrirFangs      |
| `horse-statue-whinny.mp3`                | horse-statue                                          | [Renill de cavall / Horse Neigh](https://freesound.org/people/Salsero_classic/sounds/826753/)              | Salsero_classic  |
| `lantern-blow.mp3`                       | lantern                                               | [blowing out candle.wav](https://freesound.org/people/Reitanna/sounds/242867/)                             | Reitanna         |
| `lantern-match.mp3`                      | garden-gnome, lantern                                 | [Match Lighting Candle](https://freesound.org/people/devilqube/sounds/370362/)                             | devilqube        |
| `lungs-breath.mp3`                       | lungs                                                 | [Male breathing](https://freesound.org/people/zogmachine/sounds/202606/)                                   | zogmachine       |
| `marble-roll.mp3`                        | marble                                                | [Marble (single) rolling on wooden floor.wav](https://freesound.org/people/LiezelDippenaar/sounds/707545/) | LiezelDippenaar  |
| `meteor-boom.mp3`                        | asteroid, meteor, star, planetary-nebula, brain       | [Muffled Distant Explosion](https://freesound.org/people/NenadSimic/sounds/149966/)                        | NenadSimic       |
| `meteor-fire.mp3`                        | meteor, nebula                                        | [Waving Torch.wav](https://freesound.org/people/spookymodem/sounds/249809/)                                | spookymodem      |
| `neuron-arc.mp3`                         | knot, neuron, orbital                                 | [highvoltagearc.wav](https://freesound.org/people/Sclolex/sounds/210878/)                                  | Sclolex          |
| `pool-ball-cue.mp3`                      | pool-ball                                             | [pool_break.wav](https://freesound.org/people/reg7783/sounds/204187/)                                      | reg7783          |
| `protein-velcro.mp3`                     | chromosome, protein                                   | [Velcro](https://freesound.org/people/paulocorona/sounds/334991/)                                          | paulocorona      |
| `raspberry-land-1.mp3`                   | raspberry, blackberry                                 | [Impact Sounds (impactSoft_medium_000.ogg)](https://kenney.nl/assets/impact-sounds)                        | Kenney           |
| `raspberry-land-2.mp3`                   | raspberry, blackberry                                 | [Impact Sounds (impactSoft_medium_002.ogg)](https://kenney.nl/assets/impact-sounds)                        | Kenney           |
| `raspberry-squish.mp3`                   | raspberry, blackberry, donut                          | [Squish impact](https://freesound.org/people/Bertsz/sounds/500912/)                                        | Bertsz           |
| `star-cookie-crumble.mp3`                | star-cookie                                           | [Crisp Crunch.m4a](https://freesound.org/people/Yin_Yang_Jake007/sounds/443469/)                           | Yin_Yang_Jake007 |
| `star-cookie-snap.mp3`                   | star-cookie                                           | [Crisp Crunch.m4a](https://freesound.org/people/Yin_Yang_Jake007/sounds/443469/)                           | Yin_Yang_Jake007 |
| `supernova-boom.mp3`                     | star, pulsar, black-hole, planetary-nebula, supernova | [Deep Boom](https://freesound.org/people/Za-Games/sounds/539968/)                                          | Za-Games         |
| `tennis-ball-bounce.mp3`                 | tennis-ball                                           | [bola de tenis caindo.wav](https://freesound.org/people/Negraovictor/sounds/394355/)                       | Negraovictor     |
| `tennis-ball-slam.mp3`                   | tennis-ball, softball                                 | [ball_hit_ground.wav](https://freesound.org/people/Kyanite_/sounds/432912/)                                | Kyanite\_        |
| `vintage-camera-flash.mp3`               | vintage-camera                                        | [Vintage Camera Flash Powder and Shutter](https://freesound.org/people/Werra/sounds/232130/)               | Werra            |
| `wooden-elephant-trumpet.mp3`            | wooden-elephant                                       | [Elephant Trumpets Growls.flac](https://freesound.org/people/D.jones/sounds/527845/)                       | D.jones          |

## Software

Splashery is built on the [PlayCanvas engine](https://github.com/playcanvas/engine) (MIT) and uses
[gifenc](https://github.com/mattdesl/gifenc) (MIT) for GIF export. See [LICENSES.md](LICENSES.md).
Pictures and pages use [PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0) and
[omggif](https://github.com/deanm/omggif) (MIT), loaded only when someone opens a PDF or a GIF.
Photo to 3D uses [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT) and Depth
Anything V2 Small (Apache 2.0), loaded only when someone opens a photo in that toy (or, in lane Live
input's Splat mirror and Photo to 3D's live view, only after someone taps "Use my camera"). The
Science shelf's galaxy sample was cut with [jsfive](https://github.com/usnistgov/jsfive) (public
domain), a build tool only. The QR code toy (lane QR) uses Project Nayuki's
[QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) (MIT) to encode
its codes and [jsQR](https://github.com/cozmo/jsQR) (Apache 2.0) to check that they scan, both
loaded only when that toy opens (jsQR only when a check runs in a browser without its own QR
reader). "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
