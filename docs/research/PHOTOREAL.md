# Photoreal captures: where they can come from

Research for lane Photoreal, October 2, 2026 (Sonnet 5.5). Links and facts only: no files from any
source are in this repository. The owner's question (the October 2 review): are there photoreal
Gaussian splats, or real scans we could turn into splats, of what we already have, and of new
subjects such as real terrain, real weather, anatomy and samples of each chemical element?

Short answer:

- **Plenty of real splats exist for everyday objects, food, animals, vehicles, landmarks and
  terrain**, almost all on SuperSplat under CC BY 4.0. They fit today. Only a few of them are
  decimated well; most need a size cut for a phone (the source files run 5 to 70 MB).
- **Real gem and mineral splats are the weak spot.** The good ones are paid or NonCommercial
  (private only). CC BY mineral meshes exist on Sketchfab (they need a login to download and a Model
  to splats step).
- **Real weather does not exist as a capture.** The one real item is a lab-made vortex of unclear
  data license. Weather has to stay procedural.
- **Real terrain** comes best from public-domain USGS height data turned into splats, not from
  existing splats.
- **No 3D capture of element samples exists.** Wikimedia Commons has CC BY, CC BY-SA and public
  domain photographs for many elements; they would need Photo to 3D.
- **Anatomy**: a few CC0 and CC BY items (skulls, a brain model). Every one of them waits for the
  owner's OK.
- **Depth models**: Depth Anything V2 Base and Large are NonCommercial and cannot ship. Depth
  Anything 3 Small and Base are Apache-2.0 and have ONNX builds.

## How to read this

Every license below was read from the source's live page, or from the source's own API for that item
(the SuperSplat scene page's `rel="license"` link, the Sketchfab API's `license.label`, the Hugging
Face API's `cardData.license`, the Wikimedia Commons file page). If a page could not be opened, the
entry says "unclear" or "unverified" and sits in "private only".

The three groups the owner set on October 2, 2026:

- **Fits today**: CC0, CC BY, public domain, and now CC BY-SA (per asset, with its notice; anything
  made from it stays BY-SA). Anatomy sources still go to the owner first.
- **Private only**: NonCommercial (any "NC" license), no license stated, "personal use" and paid.
  Never in the repository or on the site.
- **No good capture found**.

Four things apply to many entries:

1. **BY-ND (NoDerivatives) is private only** too: we decimate, crop, recolor and rotate every
   capture, and that makes a derivative. None of the BY-ND scenes below is listed as fitting.
2. **SuperSplat has no CC0 choice.** Its scenes carry CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, CC
   BY-ND or CC BY-NC-ND (plus scenes with downloads switched off, which we skip).
3. **A capture made from someone else's video** (a YouTube or Pexels clip, for example) carries the
   splat author's CC BY, but that license cannot clear rights in the underlying footage. The notes
   mark these (the Stonehenge, Preikestolen and Mud Volcanoes scenes). Treat them as "ask the owner"
   before they go on the site.
4. **Brands and people.** The site's rules forbid logos, brand names and captures of people. Several
   candidates show a brand (a bottle, a cereal box, a tractor badge) or a person (the scan lists
   have many portrait scenes, which are left out here). Check each capture for a logo before it is
   used.

## What "format" means here

- **Splat formats**: `.sog` (what the SuperSplat viewer streams and what our toys use), `.ply`,
  `.spz`, `.splat`. SuperSplat labels some scenes `ssog`, a streamed multi-level SOG that
  `splat-transform` does not write back out as one file; those are marked "SOG, streamed (LOD)" and
  need the highest level extracted first.
- **Mesh formats** (`.glb`, `.obj`): photogrammetry scans. Model to splats (Studio) turns a mesh
  into splats by sampling its surface, which keeps the baked texture but not view-dependent shine.
- A SuperSplat download is the SOG data its public viewer streams from
  `https://d28zzqy0iyovbz.cloudfront.net/<scene id>/v<version>/meta.json`, the same route
  `tools/assets.json` already uses for our captured toys.
- Sizes are the source's own: SuperSplat's reported scene size, or a Sketchfab face count (a face
  count is not a file size; Sketchfab shows download sizes only after sign-in).

## 1. Where real splats live: SuperSplat

SuperSplat (superspl.at, run by PlayCanvas) is by far the richest source. Each scene's page names
the license its author chose; scenes with downloads off are left out. The tables below come from a
search of about 190 subject words (639 downloadable scenes), then a check of each listed scene's
page. The titles and author notes were read; only a few dozen scenes have been looked at as renders
(the ones on the private comparison page), so a listed scene may still turn out to be poor, upside
down or cluttered with background. The Caveats section lists which ones were rendered.

SuperSplat's license mix in that search (downloadable scenes): CC BY 546, CC BY-NC 41, CC BY-NC-SA
39, CC BY-NC-ND 6, CC BY-SA 5, CC BY-ND 2.

### Food and fruit

Fits today:

| Capture                                                                              | Author              | License (scene page) | Format              | Size  | Splats    |
| ------------------------------------------------------------------------------------ | ------------------- | -------------------- | ------------------- | ----- | --------- |
| [Heart Shaped Donut](https://superspl.at/scene/d2a622ec)                             | John Splat          | CC BY 4.0            | SOG                 | 4 MB  | 157,886   |
| [SUSHI](https://superspl.at/scene/43ddc643)                                          | leo esteves         | CC BY 4.0            | SOG                 | 5 MB  | 170,556   |
| [Pancakes](https://superspl.at/scene/03b7342e)                                       | Ryuto Haga          | CC BY 4.0            | unclear             | 6 MB  | unclear   |
| [Seeded Bread Loaf](https://superspl.at/scene/e1beac1a)                              | John Splat          | CC BY 4.0            | SOG                 | 8 MB  | 432,118   |
| [Cowboy Steak](https://superspl.at/scene/6e60e106)                                   | Eric Cornwell       | CC BY 4.0            | SOG                 | 4 MB  | 139,001   |
| [Stollen Confectionery](https://superspl.at/scene/070d50b8)                          | Dany Bittel         | CC BY 4.0            | SOG                 | 7 MB  | 308,466   |
| [Bowl of Tomatoes - Reconstructed with Seeget3D](https://superspl.at/scene/11a34fdc) | Seeget3D            | CC BY 4.0            | SOG, streamed (LOD) | 18 MB | 981,083   |
| [Vegetables HQ - LichtFeld Studio](https://superspl.at/scene/f592397a)               | Simon Bethke        | CC BY 4.0            | SOG                 | 33 MB | 2,550,850 |
| [Physalis](https://superspl.at/scene/908ed1a1)                                       | Alfred Duemlein     | CC BY 4.0            | SOG                 | 9 MB  | 486,314   |
| [Fresh Orange](https://superspl.at/scene/633ea98d)                                   | Storm Geerling      | CC BY 4.0            | SOG, streamed (LOD) | 4 MB  | 82,539    |
| [Baconburger with detailed info](https://superspl.at/scene/c8cc8b8e)                 | Jonas T.W Blindheim | CC BY 4.0            | SOG, streamed (LOD) | 46 MB | 1,525,660 |

### Gems and minerals

Fits today:

| Capture                                                         | Author            | License (scene page) | Format              | Size  | Splats    |
| --------------------------------------------------------------- | ----------------- | -------------------- | ------------------- | ----- | --------- |
| [Homemade Crystal Gem](https://superspl.at/scene/6cca7765)      | Eric Cornwell     | CC BY 4.0            | SOG                 | 3 MB  | 68,388    |
| [alum-stone](https://superspl.at/scene/9b0c8534)                | Arshad            | CC BY 4.0            | SOG                 | 6 MB  | 451,287   |
| [interesting stained rocks](https://superspl.at/scene/f4f9c5ec) | adv               | CC BY 4.0            | SOG, streamed (LOD) | 49 MB | 1,600,573 |
| [pink & green stone](https://superspl.at/scene/98aec799)        | Nicolas Barradeau | CC BY 4.0            | SOG                 | 6 MB  | 235,900   |

### Animals and figurines

Fits today:

| Capture                                                                        | Author            | License (scene page) | Format              | Size  | Splats    |
| ------------------------------------------------------------------------------ | ----------------- | -------------------- | ------------------- | ----- | --------- |
| [Fallen owl](https://superspl.at/scene/8a8cb6ee)                               | Giacomo Magnoni   | CC BY 4.0            | SOG                 | 10 MB | 611,259   |
| [penguin_v1](https://superspl.at/scene/685f2bea)                               | Xuan-Huong Nguyen | CC BY 4.0            | SOG                 | 8 MB  | 423,827   |
| [Puffin](https://superspl.at/scene/d44e63ab)                                   | Dan Zeitman       | CC BY 4.0            | SOG                 | 4 MB  | 262,381   |
| [Frogs](https://superspl.at/scene/8c5be68a)                                    | Parker Reed       | CC BY 4.0            | SOG                 | 2 MB  | 125,086   |
| [Lioness (Panthera Spelaea)](https://superspl.at/scene/7e4e9bcb)               | Spenser DIckerson | CC BY 4.0            | SOG, streamed (LOD) | 52 MB | 1,855,777 |
| [BunnySplat](https://superspl.at/scene/3e9a61e0)                               | SteveB            | CC BY 4.0            | SOG                 | 2 MB  | 38,124    |
| [Tyrannosaurus Rex](https://superspl.at/scene/d281a49d)                        | Alfred Duemlein   | CC BY 4.0            | SOG                 | 12 MB | 684,274   |
| [Chinese Guardian Lion](https://superspl.at/scene/704f4953)                    | Natural Ai        | CC BY 4.0            | SOG, streamed (LOD) | 15 MB | 747,894   |
| [Maneki-neko](https://superspl.at/scene/1dddadd6)                              | Mykhailo Moroz    | CC BY 4.0            | SOG, streamed (LOD) | 42 MB | 1,499,449 |
| [Turtle Souvenir](https://superspl.at/scene/c2051d75)                          | Tony Rose         | CC BY 4.0            | SOG                 | 14 MB | 1,090,479 |
| [Thai souvenir elephant toy](https://superspl.at/scene/b01bfc43)               | Aung Sann Thit    | CC BY 4.0            | SOG                 | 1 MB  | 30,184    |
| [Monkey Doll](https://superspl.at/scene/726c5f45)                              | Ethan             | CC BY 4.0            | SOG                 | 5 MB  | 430,038   |
| [Longhorn beetle](https://superspl.at/scene/105dac18)                          | Ethan             | CC BY 4.0            | SOG                 | 33 MB | 2,871,257 |
| [唐代三彩陶马｜Tang Dynasty Ceramic Horse](https://superspl.at/scene/4ce87b73) | Liu               | CC BY 4.0            | SOG                 | 15 MB | 874,557   |

Private only:

| Capture                                                                                   | Author        | License (scene page) | Format | Size  | Splats  |
| ----------------------------------------------------------------------------------------- | ------------- | -------------------- | ------ | ----- | ------- |
| [Dog Plush - Revopoint POP4 with additional Pictures](https://superspl.at/scene/55d00502) | PrintedForFun | CC BY-NC 4.0         | SOG    | 10 MB | 478,072 |

### Vehicles

Fits today:

| Capture                                                                         | Author           | License (scene page) | Format              | Size  | Splats    |
| ------------------------------------------------------------------------------- | ---------------- | -------------------- | ------------------- | ----- | --------- |
| [Eicher 3145 Turbo tractor](https://superspl.at/scene/d2258148)                 | Alfred Duemlein  | CC BY 4.0            | SOG                 | 4 MB  | 125,954   |
| [Tractor - Ferguson 35](https://superspl.at/scene/71550828)                     | Simon Bethke     | CC BY 4.0            | SOG                 | 49 MB | 3,321,735 |
| [BMX Bicycle - Enhanced](https://superspl.at/scene/e95011f3)                    | Eric Cornwell    | CC BY 4.0            | SOG                 | 9 MB  | 495,006   |
| [Marin MTB](https://superspl.at/scene/e00ca382)                                 | Natural Ai       | CC BY 4.0            | SOG, streamed (LOD) | 15 MB | 906,307   |
| [Vespa GS](https://superspl.at/scene/1174d2ef)                                  | Chu              | CC BY 4.0            | SOG                 | 4 MB  | 317,838   |
| [KTM Duke 390](https://superspl.at/scene/b2fa42c2)                              | Elias Tuzar      | CC BY 4.0            | SOG                 | 5 MB  | 177,248   |
| [Skip Truck Toy](https://superspl.at/scene/7d94ef7d)                            | Alfred Duemlein  | CC BY 4.0            | SOG                 | 12 MB | 733,995   |
| [VW Beetle](https://superspl.at/scene/0df0379f)                                 | Alfred Duemlein  | CC BY 4.0            | SOG                 | 5 MB  | 187,293   |
| [Bedford Concrete Mixer Toy Car](https://superspl.at/scene/522fdad3)            | Alfred Duemlein  | CC BY 4.0            | SOG                 | 4 MB  | 101,316   |
| [Gibb & Hogg Locomotive - Summerlee Museum](https://superspl.at/scene/bdfdff58) | Christopher Kerr | CC BY 4.0            | SOG, streamed (LOD) | 29 MB | 1,021,634 |
| [Aérospatiale SA 316B Alouette III](https://superspl.at/scene/de71e169)         | Sai Kiran        | CC BY 4.0            | SOG, streamed (LOD) | 10 MB | 517,892   |

Private only:

| Capture                                                                                         | Author   | License (scene page) | Format              | Size | Splats  |
| ----------------------------------------------------------------------------------------------- | -------- | -------------------- | ------------------- | ---- | ------- |
| [Prussian T3 Train 1901 German Museum of Technology Berlin](https://superspl.at/scene/e1975e1c) | Vinn Lab | CC BY-NC-SA 4.0      | SOG, streamed (LOD) | 7 MB | 294,703 |

### Landmarks

Fits today:

| Capture                                                                                       | Author          | License (scene page) | Format              | Size  | Splats    |
| --------------------------------------------------------------------------------------------- | --------------- | -------------------- | ------------------- | ----- | --------- |
| [Stonehenge (Lichtfeld MRNF)](https://superspl.at/scene/7348d54f)                             | Muhammad Ichsan | CC BY 4.0            | SOG                 | 29 MB | 1,998,761 |
| [The Pantheon Interior](https://superspl.at/scene/dac6e508)                                   | David Fletcher  | CC BY 4.0            | SOG                 | 59 MB | 3,999,998 |
| [Eiffel Tower seen from the Trocadero Cannons at sunrise](https://superspl.at/scene/5862ba74) | REBECCA WHELAN  | CC BY 4.0            | SOG                 | 36 MB | 2,620,778 |
| [Bell Tower of Vilnius Cathedral](https://superspl.at/scene/ea9c356f)                         | Artem Sh        | CC BY 4.0            | SOG                 | 36 MB | 2,411,047 |
| [Point Lowly Lighthouse, South Australia](https://superspl.at/scene/1dd6f546)                 | Fadilah A       | CC BY 4.0            | SOG                 | 7 MB  | 331,520   |
| [Bradwell Windmill](https://superspl.at/scene/e502f6ce)                                       | Natural Ai      | CC BY 4.0            | SOG, streamed (LOD) | 17 MB | 677,174   |
| [Egglestone Abbey, County Durham](https://superspl.at/scene/67ba224d)                         | Dok11           | CC BY 4.0            | SOG                 | 31 MB | 2,614,633 |
| [Avoncroft Museum - Postmill](https://superspl.at/scene/ac397573)                             | Ian Jenkins     | CC BY 4.0            | SOG                 | 42 MB | 3,870,782 |
| [The Kelpies](https://superspl.at/scene/da59aa50)                                             | Ethan           | CC BY 4.0            | SOG                 | 40 MB | 3,431,321 |

Private only:

| Capture                                                   | Author          | License (scene page) | Format | Size  | Splats    |
| --------------------------------------------------------- | --------------- | -------------------- | ------ | ----- | --------- |
| [Stonehenge (gsplat)](https://superspl.at/scene/8aa40bd3) | Muhammad Ichsan | CC BY-NC-SA 4.0      | SOG    | 30 MB | 1,986,413 |

### Anatomy

Fits today:

| Capture                                                                 | Author     | License (scene page) | Format | Size  | Splats    |
| ----------------------------------------------------------------------- | ---------- | -------------------- | ------ | ----- | --------- |
| [Burke Museum Triceratops Skull](https://superspl.at/scene/811dd9ed)    | Luke Shea  | CC BY 4.0            | SOG    | 10 MB | 543,949   |
| [Rabbit Skull](https://superspl.at/scene/1fe1ff96)                      | Rigsters   | CC BY 4.0            | SOG    | 41 MB | 2,756,816 |
| [chicken skeleton (Spirula Studio)](https://superspl.at/scene/9dd8696b) | Harry Chen | CC BY 4.0            | SOG    | 8 MB  | 375,838   |
| [tractography](https://superspl.at/scene/bb00bc6c)                      | balevato   | CC BY 4.0            | SOG    | 32 MB | 1,994,810 |

Private only:

| Capture                                         | Author      | License (scene page) | Format | Size  | Splats    |
| ----------------------------------------------- | ----------- | -------------------- | ------ | ----- | --------- |
| [Skull Fog](https://superspl.at/scene/4afca2df) | Andrew Wood | CC BY-NC 4.0         | SOG    | 18 MB | 1,779,761 |

### Nature

Fits today:

| Capture                                                                      | Author            | License (scene page) | Format              | Size  | Splats    |
| ---------------------------------------------------------------------------- | ----------------- | -------------------- | ------------------- | ----- | --------- |
| [Bonsai Tree](https://superspl.at/scene/4c461e7c)                            | Garrett Nelli     | CC BY 4.0            | SOG                 | 5 MB  | 251,470   |
| [Sunflower ](https://superspl.at/scene/d8c22218)                             | Natural Ai        | CC BY 4.0            | SOG, streamed (LOD) | 12 MB | 698,905   |
| [White Rose 2](https://superspl.at/scene/e34ad55d)                           | Natural Ai        | CC BY 4.0            | SOG                 | 1 MB  | 12,181    |
| [Rugiboletus extremiorientalis mushroom](https://superspl.at/scene/737cf53c) | Alexander Omelko  | CC BY 4.0            | SOG                 | 12 MB | 601,475   |
| [Cactus 1](https://superspl.at/scene/4e095e21)                               | Natural Ai        | CC BY 4.0            | SOG, streamed (LOD) | 6 MB  | 260,429   |
| [acorn](https://superspl.at/scene/fe937af4)                                  | Nicolas Barradeau | CC BY 4.0            | SOG                 | 6 MB  | 260,414   |
| [Murex Shell](https://superspl.at/scene/d55ecb52)                            | Rigsters          | CC BY 4.0            | SOG                 | 43 MB | 2,977,039 |
| [Cherry Blossom](https://superspl.at/scene/722a5496)                         | Garrett Nelli     | CC BY 4.0            | SOG                 | 14 MB | 813,396   |
| [Golden Fullmoon Maple](https://superspl.at/scene/f233b115)                  | Joshua Trapani    | CC BY 4.0            | SOG, streamed (LOD) | 31 MB | 1,094,309 |
| [Pink Peonies](https://superspl.at/scene/50c8ccf7)                           | Sergiu Zboras     | CC BY 4.0            | SOG                 | 28 MB | 1,768,592 |

Private only:

| Capture                                                          | Author     | License (scene page) | Format | Size  | Splats    |
| ---------------------------------------------------------------- | ---------- | -------------------- | ------ | ----- | --------- |
| [CHERRY BLOSSOM - HIGH PARK](https://superspl.at/scene/4eec644f) | Todd Smith | CC BY-NC-SA 4.0      | SOG    | 36 MB | 2,466,608 |

### Space

Fits today:

| Capture                                                                          | Author         | License (scene page) | Format | Size  | Splats    |
| -------------------------------------------------------------------------------- | -------------- | -------------------- | ------ | ----- | --------- |
| [The Moon 3D Gaussian Splat Artemis II Data](https://superspl.at/scene/2ac8f423) | Nicolas Diolez | CC BY 4.0            | SOG    | 67 MB | 4,929,011 |
| [Earth Crochet from Project Hail Mary](https://superspl.at/scene/8d1a69d2)       | Wan Xi         | CC BY 4.0            | SOG    | 9 MB  | 452,440   |

Private only:

| Capture                                           | Author | License (scene page) | Format | Size | Splats  |
| ------------------------------------------------- | ------ | -------------------- | ------ | ---- | ------- |
| [Cheap globe](https://superspl.at/scene/9e8174d2) | ilk    | CC BY-NC 4.0         | SOG    | 7 MB | 313,696 |

### Terrain

Fits today:

| Capture                                                                | Author            | License (scene page) | Format              | Size   | Splats     |
| ---------------------------------------------------------------------- | ----------------- | -------------------- | ------------------- | ------ | ---------- |
| [Preikestolen, Norway](https://superspl.at/scene/4e0a937d)             | Mykhailo Moroz    | CC BY 4.0            | SOG                 | 13 MB  | 899,462    |
| [Red_Canyon-Hoodoos](https://superspl.at/scene/e1e4a24d)               | PETER GROSSERHODE | CC BY 4.0            | SOG                 | 5 MB   | 369,741    |
| [Mud Volcanoes and the Great Smog](https://superspl.at/scene/a8b029ef) | Dok11             | CC BY 4.0            | SOG                 | 23 MB  | 2,030,049  |
| [Land's End Cliff](https://superspl.at/scene/9e2051b8)                 | Joshua Trapani    | CC BY 4.0            | SOG, streamed (LOD) | 45 MB  | 1,608,479  |
| [Slufter dike](https://superspl.at/scene/d33bc832)                     | Rolf              | CC BY 4.0            | SOG, streamed (LOD) | 51 MB  | 1,983,333  |
| [[See the World] Lago di Barcis](https://superspl.at/scene/94a939d7)   | Ethan             | CC BY 4.0            | SOG                 | 173 MB | 12,894,588 |
| [Sumela Monastery Cliffside](https://superspl.at/scene/5f03cdcb)       | Dok11             | CC BY 4.0            | SOG                 | 25 MB  | 2,149,663  |

Notes on specific entries:

- **The "Apple Lito" scenes** (Splat Boss) are not apples: the one rendered for the comparison page
  is a head scan. Do not use them. There is no good real apple capture.
- **The Moon** (Nicolas Diolez, "Artemis II Data") is a partial splat of half the lunar surface
  built from public NASA imagery: one of the most striking captures found. It is 4.9 million splats
  and 67 MB, so it has to be cut hard.
- **tractography** is a synthetic splat of brain fiber tracts from diffusion imaging, not a photo
  capture. It is a striking neural-circuits view for the Brain toy. Anatomy: ask the owner.
- **Tyrannosaurus Rex, Skip Truck Toy, Bedford Concrete Mixer Toy Car, VW Beetle** are scans of toys
  and models by the same author (Alfred Duemlein); check each for brand marks.
- **Stonehenge (Lichtfeld MRNF)** was trained from a YouTube video (see point 3 above). **Stonehenge
  (gsplat)** by the same author is CC BY-NC-SA, so private only.
- **Seeget3D** "reconstructed with" scenes (tomatoes, David bust and others) are splats trained from
  an existing model's renders; they are CC BY but not captures of a real object.

## 2. Meshes of real things (a Model to splats step needed)

Everything here is a photogrammetry mesh, not a splat. Sketchfab downloads need a free account or an
API token. The no-login route for CC-licensed Sketchfab models is the Objaverse mirror on Hugging
Face (`allenai/objaverse`, the card says ODC-By 1.0 for the dataset and Creative Commons per object:
721,000 CC BY, 25,000 CC BY-NC and others); that is how the Real objects lane fetched its models
(`docs/handoff/RealObjects.md`).

### Smithsonian Open Access 3D (CC0)

The Smithsonian Open Access program publishes its 3D models under CC0 (3d.si.edu). 3d.si.edu
returned HTTP 403 to every request from this environment on October 2, 2026, and the api.si.edu
`DEMO_KEY` was rate limited, so the CC0 label below was read from the Smithsonian's own Sketchfab
account through the Sketchfab API (`license.label` = "CC0 Public Domain", author "The Smithsonian
Institution"). A person with a browser can reach the downloads from 3d.si.edu directly (not verified
from here).

Fits today (CC0, per the Sketchfab API):

| Item                                                                                                                                                                                                                                                                                   | Faces        | Shelf                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------- |
| [Triceratops horridus (Marsh)](https://sketchfab.com/3d-models/triceratops-horridus-marsh-e9c507f179ed4455aac3b208c9e6c973), fossil skull                                                                                                                                              | 150,000      | fossils                |
| [Mammuthus primigenius (Blumbach)](https://sketchfab.com/3d-models/mammuthus-primigenius-blumbach-229976b3db4646b39c44e57a7e3d8744), mammoth fossil                                                                                                                                    | 150,000      | fossils                |
| [Isthminia panamensis skull](https://sketchfab.com/3d-models/isthminia-panamensis-pyenson-et-al-2015-skull-aa1273c4e3404d5ab3b63b0c52caa033), fossil dolphin                                                                                                                           | 150,000      | anatomy: ask the owner |
| [Stylaster sanguineus](https://sketchfab.com/3d-models/stylaster-sanguineus-4f1ddd8352944d16bf3b821b3e71b473), red hydrocoral                                                                                                                                                          | 100,000      | Nature                 |
| [Geochelone carbonaria](https://sketchfab.com/3d-models/none-0bc47e68d77243efa50a22b881970626), tortoise                                                                                                                                                                               | 100,000      | animals                |
| Fish: [Carcharhinus altimus](https://sketchfab.com/3d-models/none-2a21cb5975984e8c86e2d7fa0e7cc773), [leafy sea dragon](https://sketchfab.com/3d-models/none-39d7dcd77673469e8651d691f16c9dd4), [porcupinefish](https://sketchfab.com/3d-models/none-6fc8b7bf018845ab84e56ea6ea0c0e94) | 100,000 each | animals                |
| Corals: [Leptoseris cucullata](https://sketchfab.com/3d-models/none-336995854bfe4e0d8d9a922568d56e86), [Agaricia speciosa](https://sketchfab.com/3d-models/none-1a3cfaceedaf42ffbb77209a7d6f5242)                                                                                      | 100,000 each | Nature                 |
| [Apollo 11 Command Module](https://sketchfab.com/3d-models/none-372bb6781922471cada4e0a9bd5c61fb)                                                                                                                                                                                      | 721,399      | space                  |
| [Space Shuttle Discovery (OV-103)](https://sketchfab.com/3d-models/none-5f7176a2ae284d6b99fc970c9d265c04)                                                                                                                                                                              | 150,000      | space                  |

Private only: none found. No good capture found: gems and minerals (the account has none that can be
downloaded; 3d.si.edu is said to hold minerals but could not be opened).

### Museum and geoscience accounts on Sketchfab

Fits today (license per the Sketchfab API; all need a Sketchfab sign-in):

| Account                       | Item                                                                                                                                                                                                                                                                                   | License  | Faces                                          | Shelf                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------- | -------------------------------------------- |
| Virtual Museums of Małopolska | [Native bismuth](https://sketchfab.com/3d-models/none-7af89cadaeb64ec9bbe62953732e206a)                                                                                                                                                                                                | CC0      | 249,984                                        | elements, minerals                           |
| same                          | [Vaca Muerta meteorite](https://sketchfab.com/3d-models/none-72aede6b479c4ded86fa9553542278bf), [Morasko iron meteorite](https://sketchfab.com/3d-models/none-37fd0d100a3246f2892ece5f8d178c06)                                                                                        | CC0      | 60,000 to 64,000                               | space rocks                                  |
| same                          | [Common raven](https://sketchfab.com/3d-models/none-ec9c0ac738fd4495af334ea2092e8d89), [Golden eagle](https://sketchfab.com/3d-models/none-dd0552b1f93b441cbdd626a5b2abebbf) (taxidermy)                                                                                               | CC0      | 181,000 to 384,000                             | animals                                      |
| NASA Astromaterials3D         | [Antarctic meteorite and Apollo lunar samples](https://sketchfab.com/Astromaterials3D)                                                                                                                                                                                                 | CC0      | 66,000 to 200,000                              | space rocks, Moon                            |
| University of Dundee museums  | [Raven skull](https://sketchfab.com/3d-models/none-dc0ed4da5bce44d9a6609a18821c289d), [brown bear skull](https://sketchfab.com/3d-models/none-e01dc94d20df4b888c7a6979bffb45a9), [penguin skull](https://sketchfab.com/3d-models/none-0f4893dbf99e4b3b865a0ec186c61d7a)                | CC0      | 209,000 to 1.0 M                               | anatomy: ask the owner                       |
| Science Museum Group          | [Model of a human brain](https://sketchfab.com/3d-models/model-of-a-human-brain-fc7ae7b989f94c80a50152e71f44e47c)                                                                                                                                                                      | CC0      | 743,676                                        | anatomy: ask the owner                       |
| rocksandminerals              | [Sulfur](https://sketchfab.com/3d-models/none-f2399e4c123548cfb188c28dd72f0622), barite desert rose, malachite, gypsum rose, agate                                                                                                                                                     | CC BY    | 570,000 to 1.8 M                               | minerals, elements                           |
| tomstevenson                  | [Amethyst hand specimen](https://sketchfab.com/3d-models/none-d3740bc73f8a4dc6a4c91e3710868218), garnet gneiss, lapis lazuli                                                                                                                                                           | CC BY    | 8,600 to 296,000                               | gems, minerals                               |
| florianstephens               | [Amethyst crystals](https://sketchfab.com/3d-models/none-53fd866f7c104323a7d8b14dee727642)                                                                                                                                                                                             | CC BY    | 99,566                                         | gems                                         |
| MGRRE                         | [Native sulfur crystals on calcite](https://sketchfab.com/3d-models/none-f72b9b56e07143929fd57625c983aed9), celestite                                                                                                                                                                  | CC BY    | 140,000 (celestite); 17 M (sulfur: very heavy) | elements, minerals                           |
| Thomas Flynn                  | [Shaggy parasol mushroom](https://sketchfab.com/3d-models/none-7987d22903294567842a5304fcd542f5), [Head of David](https://sketchfab.com/3d-models/none-d29af50360624e5e9b1855666475380d), [Aphrodite Crouching](https://sketchfab.com/3d-models/none-31dcd2d0842f4153a2c45ad24e62754e) | CC BY    | 37,000 to 100,000                              | Nature, sculpture                            |
| Thomas Flynn                  | [Leucopholis irrorata beetle](https://sketchfab.com/3d-models/none-2a20442dca0843409111f0fc6dedb78b)                                                                                                                                                                                   | CC BY-SA | 68,782                                         | insects (fits only under the new BY-SA rule) |

Individual uploaders also publish CC BY bismuth, gold nuggets and ammonites; whether each is a real
scan or a sculpted model was not checked.

Private only (NonCommercial per the Sketchfab API): the British Museum account (263 models, CC
BY-NC-SA or CC BY-NC), the Natural History Museum Vienna (987 models, CC BY-NC), Thomas Flynn's
Hintze Hall and T. rex scans (CC BY-NC), NHM Los Angeles (CC BY-NC-SA), Science Museum Group's
Stephenson's Rocket and artificial arm (CC BY-NC), and the Dundee rhinoceros beetle and hippopotamus
skull (CC BY-NC-SA).

No good capture found: Te Papa (no public Sketchfab models), and Scan the World (no official account
found; license unclear).

### Google Scanned Objects (CC BY 4.0)

1,030 scanned household items (toys, shoes, kitchenware, boxed goods), 13 GB, OBJ plus texture. The
Fuel API (`fuel.gazebosim.org/1.0/GoogleResearch/models`) reports "Creative Commons Attribution 4.0
International" on every model checked, and Google Research's blog says CC BY 4.0. Download needs no
login from Fuel or from the Hugging Face mirror
[suvadityamuk/google-scanned-objects](https://huggingface.co/datasets/suvadityamuk/google-scanned-objects)
(`cc-by-4.0`). Many items carry brand names or logos, which the site's rules forbid: pick unbranded
ones. Fits today (with the brand check). Meshes, so a Model to splats step is needed.

### NIH 3D

[3d.nih.gov](https://3d.nih.gov/terms): "While many entries in NIH 3D fall under public domain or
Creative Commons licenses (e.g., CC-BY), others may have more restrictive terms." The license is per
entry and must be read on each page. Contents are cells, proteins, viruses and CT or MRI-derived
anatomy, not photoreal specimens. One entry read live:
[Cranium and Facial Bones (3DPX-000849)](https://3d.nih.gov/entries/3DPX-000849/2), "Public Domain
(Creative Commons Zero 1.0)", a smooth CT-derived mesh without texture. **Anatomy: ask the owner.**
Nothing photoreal found.

## 3. Hugging Face and other splat collections

- **Real mineral splats**: `idirectships/splat-amet-001` (amethyst), `-azur-001` (azurite),
  `-cupr-001` (cuprite), `-chry-001` (chrysocolla), `-preh-001` (prehnite), e.g.
  [splat-preh-001](https://huggingface.co/datasets/idirectships/splat-preh-001): iPhone captures,
  public, but `cc-by-nc-4.0`. **Private only.**
- **Pixel Lab gemstone pack**
  ([page](https://www.thepixellab.net/3d-gaussian-splat-pack-gemstones)): 30 photoreal gemstone
  splats (.ply, about 7 GB). The page reads "COPYRIGHT 2026 THE PIXEL LAB LLC. ALL RIGHTS RESERVED"
  and sells the pack (reported at $39 with a one-artist license and no redistribution). **Private
  only, and paid.**
- **Splataverse** (`maxwildersmith/splataverse-sketchfab`): about 100,000 Sketchfab splats, 4 TB,
  with per-item licenses mixing CC0, CC BY and CC BY-SA. The dataset is gated (the owner's Hugging
  Face account would have to accept its contact-sharing terms), so its file list and licenses could
  not be read. The largest unexplored pool of real splats; worth a look if the owner wants to pursue
  it.
- **Scene datasets** (Voxel51/gaussian_splatting, Apache-2.0, three large scenes; dylanebert/3dgs,
  no license stated; GaussianWorld indoor scenes, CC BY-SA and gated): research scenes, not objects.
  The Voxel51 license covers the repackaging only, so its source scenes may have their own terms.
  Treat as unclear for redistribution.
- No clean, ungated CC0 or CC BY dataset of splatted object captures was found on Hugging Face.

## 4. Real terrain and geospatial

- **Fits today: USGS 3DEP.**
  [usgs.gov/3d-elevation-program](https://www.usgs.gov/3d-elevation-program): "All 3DEP products are
  available free of charge and without use restrictions." USGS-authored data is in the US public
  domain (credit requested; photos on USGS pages may be copyrighted). It offers 1 m seamless DEMs
  and lidar point clouds, no login.
- **Copernicus DEM** (GLO-30 and GLO-90 on the public AWS buckets): "available on a free basis for
  the general public under the terms and conditions of the Copernicus license". The license text
  could not be read (503), so the attribution wording is **unverified**.
- **NASA**: its media guidelines say 3D models and textures "generally are not subject to copyright
  in the United States"; third-party material and NASA's logos are excluded. SRTM and Earthdata
  policies could not be read (403).
- **OpenTopography**: licenses are per dataset and the terms page could not be read. Unverified.
- **Not allowed**: Google Earth, Earth Studio and Photorealistic 3D Tiles ("You may not use output
  ... to reconstruct 3D models or create similar content"), and Cesium ion ("You may not copy,
  store, or redistribute any portion of Cesium Data Output in ... an offline ... or local computer
  environment"). Mapbox Terrain-DEM is for use in Mapbox SDKs only. **Private only at best.**
- **Real terrain splats on SuperSplat** (CC BY): Red Canyon hoodoos in Utah (5 MB), Preikestolen in
  Norway (13 MB, trained from a YouTube video), the Berca mud volcanoes in Romania (23 MB, from a
  Pexels video), Sumela Monastery cliffside (25 MB), Land's End cliff (45 MB, streamed), Slufter
  dike (51 MB, streamed). Listed above.
- **A height map into splats**: sample a DEM on a grid; each cell becomes one flat Gaussian at its
  height with its axes along the local surface and a scale of about half a cell, colored from
  elevation, slope and aspect shading or draped with a public-domain orthophoto (USGS NAIP), plus
  jittered extra splats on steep ground. A 256 by 256 tile is about 65,000 splats, with every second
  or fourth cell far away. No capture is needed, and the data is public domain.

## 5. Real weather

- **Tornado**: the Maryland paper "Reconstructing Tornadoes in 3D with Gaussian Splatting" (arXiv
  2506.18677; CC BY 4.0 for the paper) reconstructs an idealized vortex in an acrylic lab chamber
  (eight cameras, a fan, a heated water pan with dry ice), not a real storm. The paper links a
  dataset ("Multi-view tornado chamber capture") on a Box page whose contents and license could not
  be read (**unclear: private only**); the project page is a 404 today and no splat files are
  mentioned. The paper's authors cleaned their splats in SuperSplat, but none is published there.
- **Other weather**: no real capture of a thunderstorm, lightning, clouds, a waterfall in storm
  light or aurora was found on SuperSplat, Sketchfab or Hugging Face. What turns up is modeled or
  game assets.
- **No good capture found.** A real-weather toy has to stay procedural (as the Tornado, Storm cloud,
  Volcano and Aurora toys are today).

## 6. Samples of each chemical element (a photoreal periodic table)

Theodore Gray's photographs are copyrighted and are not used. No 3D capture of element samples
exists for the table: splat captures exist for a few minerals only, and most elements are gases,
radioactive or too rare to capture.

- **Closest 3D captures**: bismuth (CC0 mesh from Małopolska), sulfur (CC BY meshes from
  rocksandminerals and MGRRE), iron meteorites (CC0), amethyst and other minerals (CC BY). See
  section 2.
- **Photographs on Wikimedia Commons** (license read on the live file page or from the Commons API):

  | Element | File                                                                                                         | License                                                | Author                    |
  | ------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------- |
  | Iodine  | [Iodine crystals, 99.9% purity](https://commons.wikimedia.org/wiki/File:Iodine_crystals,_99.9%25_purity.jpg) | CC BY 3.0                                              | Dnn87                     |
  | Sulfur  | [Sulfur sample](https://commons.wikimedia.org/wiki/File:Sulfur-sample.jpg)                                   | public domain                                          | Benjah-bmm27              |
  | Gold    | [Gold crystals](https://commons.wikimedia.org/wiki/File:Gold-crystals.jpg)                                   | CC BY-SA 3.0 Germany                                   | Alchemist-hp              |
  | Bismuth | [Bismuth crystal macro](https://commons.wikimedia.org/wiki/File:Bismuth_crystal_macro.jpg)                   | GFDL 1.2+, CC BY-SA 3.0 and CC BY 2.5 (pick CC BY 2.5) | Dschwen                   |
  | Mercury | Mercury (Element 80) 1 to 3                                                                                  | CC BY 2.0                                              | James St. John            |
  | Copper  | Cu-Scheibe.JPG; Copper nodules.jpg                                                                           | CC BY-SA 3.0 de; CC BY-SA 2.5                          | Alchemist-hp; JJ Harrison |
  | Silicon | Silicon Polycrystals.jpg                                                                                     | CC BY-SA 4.0                                           | Best Sci-Fatcs            |

  James St. John has a long CC BY 2.0 series of element and mineral photographs on Commons, the best
  lead for many elements. Phosphorus: no suitable sample photo found.

- **images-of-elements.com** (the Alchemist-hp and Dnn87 project) states "The images are licensed
  under a Creative Commons Attribution 3.0 Unported License, unless otherwise noted", but its
  contributors' Commons files vary (the gold crystals and the copper disc are BY-SA), so each file
  must be read.
- **How to turn a photograph into a toy**: Photo to 3D lifts one clean photo into a relief, which
  gives a limited viewing angle (about plus or minus 30 degrees). It needs a sharp photo (2,000
  pixels or more) on a plain background with the sample cut out. A better depth model (section 8)
  helps.
- **Private only**: the Pixel Lab pack (paid) and the idirectships minerals (CC BY-NC).
- **No good capture found**: noble gases, halogens, alkali metals, radioactive elements, most gases.

## 7. Anatomy (every item waits for the owner's OK)

- **Fits today, after the owner says yes**: the NIH 3D cranium (CC0, CT-derived, untextured), the
  Science Museum Group's brain model (CC0), animal skulls from Dundee (CC0) and the Smithsonian's
  fossil dolphin skull (CC0), a CC BY elephant skull (Dundee), several CC BY human skull scans on
  Sketchfab by individual uploaders (real scan status unchecked; a fetal skull is also there and
  best skipped), and the Open3DModel skull-base model with English labels (CC BY-SA 4.0, viewer
  only, no download confirmed). On SuperSplat (CC BY): the Triceratops skull, a rabbit skull, a
  chicken skeleton and the synthetic brain tractography.
- **Private only**: AnatomyTOOL skull items under CC BY-NC-SA (read in a search result only), the
  SuperSplat "Skull Fog" (CC BY-NC).
- **No good capture found**: photoreal organs or skin specimens under CC0 or CC BY (a heart, a
  liver). BodyParts3D and Anatomography (CC BY-SA models, not photoreal) were not researched.

## 8. Depth models for Photo to 3D

Photo to 3D vendors Depth Anything V2 Small (Apache-2.0, 99 MB). Everything below was read from the
Hugging Face model card or API.

| Model                                                                                    | License                                                        | Size                               | In the browser?                                                                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Depth Anything V2 Small](https://huggingface.co/depth-anything/Depth-Anything-V2-Small) | Apache-2.0                                                     | 99 MB; ONNX int8 27 MB, fp16 50 MB | Yes (what we ship)                                                                                                                |
| [Depth Anything V2 Base](https://huggingface.co/depth-anything/Depth-Anything-V2-Base)   | **CC BY-NC 4.0**                                               | 390 MB; ONNX q4 102 MB             | Runs, but **cannot ship**                                                                                                         |
| [Depth Anything V2 Large](https://huggingface.co/depth-anything/Depth-Anything-V2-Large) | **CC BY-NC 4.0**                                               | 1.3 GB                             | **Cannot ship**                                                                                                                   |
| [Depth Anything 3 Small](https://huggingface.co/onnx-community/depth-anything-v3-small)  | Apache-2.0                                                     | 137 MB (fp32 weights); ONNX build  | Plausible; a good first test                                                                                                      |
| [Depth Anything 3 Base](https://huggingface.co/onnx-community/depth-anything-v3-base)    | Apache-2.0                                                     | 542 MB (fp32 weights); ONNX build  | Heavy for a phone                                                                                                                 |
| Depth Anything 3 Large (v1.1, mono, metric)                                              | Apache-2.0                                                     | larger                             | Too heavy; Giant and Large 1.0 are CC BY-NC                                                                                       |
| [MoGe-2 ViT-S](https://huggingface.co/Ruicheng/moge-2-vits-normal)                       | MIT                                                            | 35 M parameters, 141 MB            | Not yet; a LiteRT build exists ([fp16 71 MB](https://huggingface.co/litert-community/MoGe-2-LiteRT)), no ONNX or WebGPU path read |
| MoGe-2 ViT-L                                                                             | MIT                                                            | 1.3 GB                             | Too heavy                                                                                                                         |
| [Depth Pro](https://huggingface.co/apple/DepthPro-hf)                                    | Apple license (`apple-amlr`; the ONNX build says `apple-ascl`) | 1.9 GB; ONNX q4f16 600 MB          | Too heavy, and the license is a research license: **private only**                                                                |
| [Marigold depth v1.1](https://huggingface.co/prs-eth/marigold-depth-v1-1)                | OpenRAIL++                                                     | 3.5 GB (diffusion)                 | No                                                                                                                                |
| Intel DPT-large, ZoeDepth (NYU)                                                          | Apache-2.0; MIT                                                | 340 MB to 490 MB                   | Older, heavier, lower quality than Depth Anything                                                                                 |

Findings:

- **The larger Depth Anything V2 sizes are NonCommercial**, so "just use a bigger one" is off the
  table. The Apache-2.0 route to better depth is **Depth Anything 3 Small or Base** (ONNX builds on
  Hugging Face; the repository's ONNX Runtime Web loader should take them, but a quick test is
  needed because the DA3 ONNX files carry external weights).
- **MoGe-2** (MIT) gives metric geometry and normals from one photo, which would help the cut at
  depth jumps and a flatter background. It is small enough (ViT-S, 35 M parameters) but has no ONNX
  build to load in a page that I could read; a one-off conversion is possible.
- These are the findings of a read of the model cards, not a speed test. Nothing was run in a
  browser.

## 9. Summary by shelf

| Shelf             | Best bet that fits today                                                                                                                            | Private only                                                             | No good capture                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| Food and fruit    | Heart Shaped Donut, SUSHI, Seeded Bread Loaf, Cowboy Steak, Stollen, Physalis (SuperSplat, CC BY)                                                   | a cereal-box render (CC BY-NC)                                           | a real apple, banana, pineapple, watermelon              |
| Gems and minerals | CC BY mineral meshes (tomstevenson, rocksandminerals, florianstephens) plus Model to splats; the SuperSplat "Homemade Crystal Gem" and "alum-stone" | idirectships mineral splats (CC BY-NC); Pixel Lab pack (paid)            | clean gem splats (emerald, ruby, sapphire, opal, pearl)  |
| Animals           | Fallen owl, puffin, T. rex toy scan (CC BY); Smithsonian CC0 animals as meshes                                                                      | NHM Vienna and British Museum scans; scant3d insect specimens (CC BY-NC) | a clean frog, penguin or cat                             |
| Vehicles          | Eicher tractor, Ferguson 35, BMX, Marin MTB, Vespa, KTM Duke, VW Beetle, Gibb and Hogg locomotive (CC BY)                                           | Prussian T3 steam locomotive (CC BY-NC-SA)                               | a bus, a sports car, a plane that is not military        |
| Landmarks         | Stonehenge, Pantheon interior, Eiffel Tower seen from the Trocadero, Vilnius bell tower, lighthouses, windmills (CC BY)                             | Stonehenge (gsplat) (CC BY-NC-SA); Google Earth (not allowed)            | Taj Mahal, Colosseum, Big Ben, Statue of Liberty         |
| Anatomy           | CC0 skulls and a brain model, the Triceratops skull (owner's OK first)                                                                              | AnatomyTOOL NC items                                                     | organs and skin specimens                                |
| Nature            | Bonsai, Rugiboletus mushroom, cherry blossom (Garrett Nelli), acorn, shells, Thomas Flynn's parasol (CC BY)                                         | CHERRY BLOSSOM at High Park (CC BY-NC-SA)                                | a clean rose or tulip (the White Rose has 12,000 splats) |
| Space             | The Moon (Artemis II data), Earth crochet (CC BY); NASA lunar and meteorite meshes (CC0)                                                            | a cheap-globe splat (CC BY-NC)                                           |                                                          |
| Weather           | none (procedural)                                                                                                                                   | the tornado chamber data (unclear)                                       | real tornadoes, storms, lightning                        |
| Terrain           | USGS 3DEP heights as splats (public domain); Red Canyon hoodoos (CC BY)                                                                             | Google Earth, Cesium, Mapbox                                             |                                                          |

## 10. What would be worth doing next

For the owner to pick from the private comparison page. In order of payoff:

1. Bring in a few of the CC BY splats that clearly beat our versions: the Moon, a donut or sushi,
   the Eicher tractor or BMX, the owl, Stonehenge, the Triceratops skull. Each needs the usual
   `tools/prepare-assets.mjs` pass (crop, decimate, a lighter phone copy) and a credit entry.
2. A **terrain toy from USGS height data** (public domain, no capture needed).
3. A **photoreal elements table** from Commons photographs, through a stronger depth model (Depth
   Anything 3 is the Apache-2.0 candidate).
4. Ask for access to **Splataverse** (gated, CC0, CC BY and CC BY-SA mixed).
5. Anything anatomical waits for the owner's OK.

## Caveats

- Twenty-one scenes were rendered in a browser on October 2, 2026 (reduced to 500,000 to 700,000
  splats where the source was larger). Fourteen are on the private comparison page and look good:
  the Moon, cherry blossom, donut, sushi, owl, tractor, BMX bicycle, bonsai, mushroom, horse statue,
  Triceratops skull, globe, hoodoos, plush. Seven rendered badly or were not what the title said:
  the apple scenes are a head, and the frog and the penguin were cluttered or fuzzy; under automatic
  framing (Stonehenge was washed out, Preikestolen came out in fragments, the rabbit skull was a
  gold blob and the brain tractography looked like fur); the last four stay listed but need hand
  framing, so do not count on them. Every other listed scene's quality was judged from its title and
  author's note only. Check the render before a toy is planned.
- Sketchfab lists show the most-liked items, not every item; the lists are samples.
- Unreachable from this environment: 3d.si.edu and www.si.edu (403), spacedata.copernicus.eu (503),
  the OpenTopography terms page, NASA Earthdata (403), and Commons searches late in the session
  (rate limited).
- Brands and people: check every capture for a logo, a brand name or a person before it is used.
