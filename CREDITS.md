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
| `popcorn-popping.mp3`        | [popcorn.wav](https://freesound.org/s/488722/)                                                   | Mike888                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `taco-crack.mp3`             | [chips crunch sound](https://freesound.org/s/705360/)                                            | TomatoHater                                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `fireworks-burst.mp3`        | [Firework Explosion 3](https://freesound.org/s/212683/)                                          | a deleted Freesound account (deleted_user_3544904) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `colosseum-crowd.mp3`        | [cheering and clapping crowd 1](https://freesound.org/s/221568/)                                 | AlaskaRobotics                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `colosseum-hooves.mp3`       | [Horse and Carriage.mp3](https://freesound.org/s/388391/)                                        | maadmacs                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `steam-train-chug.mp3`       | [Steam Train In Motion 1.wav](https://freesound.org/s/179349/)                                   | lolamadeus                                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `sports-car-rev.mp3`         | [Car Engine Revving.WAV](https://freesound.org/s/558844/)                                        | DigPro120                                          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tractor-engine.mp3`         | [Tractor whirring](https://freesound.org/s/339167/)                                              | vonis22                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `helicopter-rotor.mp3`       | [Helicopter.wav](https://freesound.org/s/488089/)                                                | Mike_Leister                                       | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `propeller-plane-engine.mp3` | [Aeroplane Passing Close.wav](https://freesound.org/s/507446/)                                   | paulprit                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bow-and-target-release.mp3` | [Bow Release (Bow and Arrow) 3](https://freesound.org/s/384918/)                                 | Ali_6868                                           | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `owl-hoot.mp3`               | [Owl Hoot](https://freesound.org/s/465697/)                                                      | Breviceps                                          | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `frog-croak.mp3`             | [Frog croaking sound effect](https://freesound.org/s/354132/)                                    | betterchinese                                      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `frog-fly.mp3`               | [Fly_Buzzing_Edited.wav](https://freesound.org/s/443059/)                                        | AmberdeMeillon                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bonsai-snip.mp3`            | [scissors cut.wav](https://freesound.org/s/175522/)                                              | mywhats                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `oak-leaves.mp3`             | [FallingLeaves](https://freesound.org/s/489911/)                                                 | falcospizaetus                                     | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `rocks-pebbles.mp3`          | [Slow Pebble Tumble.wav](https://freesound.org/s/398698/)                                        | bbrocer                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `iceberg-crack.mp3`          | [Ice Crack 1](https://freesound.org/s/262635/)                                                   | j_p_higgins                                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `klein-bottle-slosh.mp3`     | [Bottle Slosh 2](https://freesound.org/s/667273/)                                                | alegemaate                                         | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `spinning-top-spin.mp3`      | [Metallic Spinning Top (Dry Sound).wav](https://freesound.org/s/334970/)                         | Uzbazur                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `spring-toy-boing.mp3`       | [battery compartment spring 01.wav](https://freesound.org/s/472478/)                             | denalwa                                            | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
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
| `tin-can-spin.mp3`                       | tin-can-real                                          | [Spinning Coin](https://freesound.org/people/CassieTee/sounds/209462/)                                     | CassieTee        |
| `vintage-camera-flash.mp3`               | vintage-camera                                        | [Vintage Camera Flash Powder and Shutter](https://freesound.org/people/Werra/sounds/232130/)               | Werra            |
| `wooden-elephant-trumpet.mp3`            | wooden-elephant                                       | [Elephant Trumpets Growls.flac](https://freesound.org/people/D.jones/sounds/527845/)                       | D.jones          |

## Software

Splashery is built on the [PlayCanvas engine](https://github.com/playcanvas/engine) (MIT) and uses
[gifenc](https://github.com/mattdesl/gifenc) (MIT) for GIF export. See [LICENSES.md](LICENSES.md).
Pictures and pages use [PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0) and
[omggif](https://github.com/deanm/omggif) (MIT), loaded only when someone opens a PDF or a GIF.
Photo to 3D uses [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT) and Depth
Anything V2 Small (Apache 2.0), loaded only when someone opens a photo in that toy (or, in lane Live
input's Splat mirror and Photo to 3D's live view, only after someone taps "Use my camera").
