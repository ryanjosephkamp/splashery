# Video to 3D R5 review evidence

This branch is evidence only. **Never merge it.** Product code and the active Goal are in
[draft PR #673](https://github.com/ryanjosephkamp/splashery/pull/673). Full acceptance is not yet
established. Missing outcomes, failed image proofs, and interrupted work remain visible.

The 20 corpus files below are exact copies of the previously licensed task 88 derivatives from
`dcf23f841c8469383dd9afd1c1e47ffdf3ccf14b`, checked against the unchanged manifest. No clip was
replaced, brightened, stabilized, sharpened, or given artificial camera motion. Original source
spans, authors, licenses, transformations, and SHA-256 hashes are in [manifest.json](manifest.json).
Each clip and its derived reconstruction retain its own recorded license; the files are separate
assets. Generated code is MIT, made by Ryan with Codex (GPT-6).

## Initial controls

[Control logs and cached inputs](evidence/initial-controls/) retain both expected failing tests and
passing checks. The solve fixtures simulate the reconstruction boundary and use the real Session and
video pipeline; they do not measure camera quality or GPU speed. Cached surface comparisons verify
exact initialization bytes and are not native bakes. Original JSON and script bytes are stored
losslessly with gzip; decompression restores the original filenames.

## Corpus credit

| Clip                                                                                 | Author                              | License                                                         | Source                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Cat playing with a circular toy indoors](corpus/cat-track.mp4)                      | Clément Bucco-Lechat                | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Cat_playing_with_a_round_track_toy.webm)                                                      |
| [Cat playing outside, handheld tablet](corpus/cat-plays.mp4)                         | Riverarvi                           | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Cat_Plays.webm)                                                                               |
| [Buddha statue, camera held still](corpus/buddha.mp4)                                | https://www.youtube.com/user/Editor | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0)        | [Original source](https://commons.wikimedia.org/wiki/File:Statue_of_Buddha.webm)                                                                        |
| [Chameleon among flowering branches](corpus/chameleon-flowers.mp4)                   | Ventrovert                          | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)        | [Original source](https://commons.wikimedia.org/wiki/File:Chameleon_on_ixora_flowers.webm)                                                              |
| [Potted flowering plants, handheld](corpus/dianthus.mp4)                             | Tanvir Rahat                        | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Dianthus_plants_and_flowers_,_Rajshahi_,_Bangladesh.webm)                                     |
| [Stone ruins, handheld panorama](corpus/pisac.mp4)                                   | MorePix                             | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Original source](https://commons.wikimedia.org/wiki/File:Panorama_of_P%C3%ADsac_Ruins,_Peru_2024.webm)                                                 |
| [Sleeping dog close up indoors](corpus/sleeping-dog.mp4)                             | Amada44                             | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)  | [Original source](https://commons.wikimedia.org/wiki/File:REM_-_Rapid_eye_movement_sleep_of_a_dog.webm)                                                 |
| [Palace entrance statue, handheld approach](corpus/palace-statue.mp4)                | Sayvhior                            | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](https://commons.wikimedia.org/wiki/File:A_moulded_statue_at_the_entrance_to_the_palace_of_the_Obi_of_Issele_Uku.webm)                 |
| [Residential street, aerial lateral pass](corpus/oa-street.mp4)                      | Sillerkiil                          | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Original source](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Oa_street_in_Supilinn,_Tartu,_Estonia._July_2021.webm)                         |
| [Old stone handball court, camera walks inside](corpus/ullard.mp4)                   | A.-K. D.                            | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Ullard_handball_alley.webm)                                                                   |
| [Mountain panorama, handheld sweep](corpus/snaefell.mp4)                             | Tiny Toast                          | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)        | [Original source](https://commons.wikimedia.org/wiki/File:Panorama_on_Snaefell.webm)                                                                    |
| [Lighthouse at sunset, camera orbits the tower](corpus/fremantle-orbit.mp4)          | JamesBromberger                     | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Original source](https://commons.wikimedia.org/wiki/File:Orbit_around_Fremantle_South_Mole_Lighthouse_at_sunset.webm)                                  |
| [Abandoned lighthouse and textured ground, aerial orbit](corpus/ihasalu-orbit.mp4)   | Sillerkiil                          | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](<https://commons.wikimedia.org/wiki/File:Drone_video_of_abandoned_Ihasalu_lighthouse_near_Neeme_village_in_Estonia_(July_2022).webm>) |
| [Rotating Fresnel lens inside a lighthouse](corpus/fresnel-lens.mp4)                 | Myotus                              | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Fresnel_lenses_rotating_at_Split_Rock_Lighthouse.webm)                                        |
| [Basilica interior ceiling and stained glass, handheld tilt](corpus/saint-denis.mp4) | Quahadi                             | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Interior_of_Basilique_Saint-Denis_134306.webm)                                                |
| [Horse sculpture close detail, camera tilts up](corpus/horse-statue.mp4)             | Angelarene88                        | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)  | [Original source](https://commons.wikimedia.org/wiki/File:Traveler_horse_statue.webm)                                                                   |
| [Offshore lighthouse platform, close drone approach](corpus/royal-sovereign.mp4)     | Alexis Markwick                     | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Original source](https://commons.wikimedia.org/wiki/File:Royal_Sovereign_Lighthouse_drone_visit.webm)                                                  |
| [Stone castle ruins, aerial orbit](corpus/viljandi-ruins.mp4)                        | Sillerkiil                          | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Original source](https://commons.wikimedia.org/wiki/File:Viljandi_ordulinnus_2021,_droonivideo.webm)                                                   |
| [Bog islands and shore, low aerial pass](corpus/kakerdi-bog.mp4)                     | Sillerkiil                          | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Original source](https://commons.wikimedia.org/wiki/File:Drone_video_of_Kakerdi_lake_and_Kakerdaja_bog_in_Estonia,_september_2021.webm)                |
| [Rocky island houses and lighthouse, fast drone pass](corpus/fjoloy.mp4)             | Rik Knops                           | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0)        | [Original source](https://commons.wikimedia.org/wiki/File:Aerial_views_of_Fj%C3%B8l%C3%B8y_Lighthouse,_Rennes%C3%B8y,_Rogaland_county,_Norway.webm)     |

Rule check: none.
