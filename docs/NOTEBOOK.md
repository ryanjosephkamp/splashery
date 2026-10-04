# Lab notebook

A running record for the blog post and the "How it's made" page (the owner's answer of September 29,
2026: "start a running lab notebook now … so nothing is lost"). One entry per lane when it merges:
what it built, which model built it, how long it ran, the numbers that matter, and what we learned.
The Operator adds entries; the Learn lane keeps the notebook tidy.

## Models

Since September 29, 2026, each lane runs one assigned model: Opus 5.5 for the engine, the toys,
sounds, fidelity and the Operator; Sonnet 5.5 for the Worlds content, the Studio converters, the
docs and the Integrator. Earlier lanes (Phases A to E4 and the lanes up to Manual) all ran on Opus
5.5. One blind A/B toy (the same small toy built by each model, marked by the owner without knowing
which is which) is planned for the blog.

## Entries

| Date                  | Lane          | Model      | What it built                                                                                                                                                                   | Notes                                                                                                                                                                                                                                   |
| --------------------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| September 23–26, 2026 | Phase A       | Opus 5.5   | Sharper splats (device tiers and a Detail setting), embed fixes, an upright honeybee and the homepage embed (#13; homepage repository #33)                                      | Phones drew 140k splats and desktops 200k at the time; the owner called the sharpness "basically perfect". The merge date is not recorded.                                                                                              |
| September 23–26, 2026 | Phase B       | Opus 5.5   | The phone shelf as a full grid, two-line thumbnail labels and a "Find your own splat" help panel (#17)                                                                          | 283 toys on the shelf; the first grid screen loads about 55 thumbnails (about 58 KB); 49 tests passed.                                                                                                                                  |
| September 23–26, 2026 | Phase C1      | Opus 5.5   | Visual fixes for 26 toys: grain, ball textures, and rebuilds of the camera, boombox, elephant and horse (#18)                                                                   | Grain had one cause: random placement left about a quarter of a surface thin. An even-placement option fixed it.                                                                                                                        |
| September 23–26, 2026 | Phase C2      | Opus 5.5   | Clearer or more dramatic tap effects for 33 toys the owner found subtle (#19)                                                                                                   | Thumbnails redone for 10 toys; 4 touch-and-drag toys were left for Phase F.                                                                                                                                                             |
| September 23–26, 2026 | Phase D       | Opus 5.5   | A sound for every toy (about 80 synthesized voices), scan rigs, taps that know where they landed and drag-to-stretch (#20)                                                      | All 283 shelf toys got a sound spec, 32 of them on and off pairs; 179 toys still only hopped. Nobody had listened to the sounds when the phase ended.                                                                                   |
| September 24, 2026    | Phase E1      | Opus 5.5   | New tap effects for 33 scans and shapes: color keys, whole-body effects and kit-built add-ons (#21)                                                                             | 23 sound specs changed. The owner's review of September 24 led to E1b.                                                                                                                                                                  |
| September 24–25, 2026 | Phase E1b     | Opus 5.5   | Fixes from the E1 review (19 toys), a chess game as a kit toy, a laptop you can type on, the effect quality rules and the effect clip tool (#22–#24)                            | The clip tool takes about 90 seconds per toy under software rendering. The record also says 13 of the 33 E1 toys were redone: both figures are in history.md.                                                                           |
| September 25, 2026    | Phase E1c     | Opus 5.5   | Fixes from the E1b review: a phone panel bug, chess from PGN files, and the elephant, horse, cat, hockey puck, Newton's cradle, xylophone and tomatoes (#26–#28)                | The owner approved the effects on September 25. Chess grew to 48 tokens (32 pieces and 16 spares).                                                                                                                                      |
| September 25–26, 2026 | Phase E2      | Opus 5.5   | New taps for 32 space, atom and gem toys, idle motion for the Sun, rings, aurora and galaxy, and (from the review) a chemistry toy that reads names and SMILES (#29–#31)        | 24 of 32 clips good at the review. The chemistry toy knows 69 elements, 66 named molecules and 4 proteins.                                                                                                                              |
| September 26, 2026    | Phase E3      | Opus 5.5   | New taps for 26 tiny-world, anatomy and math toys, and the morph, band, fade and skin channels for soft shapes (#32)                                                            | 23 of 26 clips good at the review; the 3 notes were fixed in the same PR.                                                                                                                                                               |
| September 26, 2026    | Phase E4      | Opus 5.5   | New taps for 28 nature and weather toys: falling leaves, petals and coconuts as loose pieces, jointed fronds, a breaking wave (#33)                                             | 30 clips (the saguaro's second tap and the pebbles' Cairn style included); 26 good, 4 needed fixes.                                                                                                                                     |
| September 26, 2026    | E4-finish     | Opus 5.5   | The four E4 fixes: the ice swan melts in solid pieces, the ocean wave curls and crashes, the pinecone's scales break off, and the lava lamp gets blob options (#37)             | All approved at once. The ice swan has 10 pieces and 30 drops; the wave is a skinned sheet on 8 keyframes.                                                                                                                              |
| September 26, 2026    | E5            | Opus 5.5   | Taps and sounds for 17 food toys that come apart as real pieces and come back (#35)                                                                                             | 14 of 17 looked right at once; redos: bananas r2, croissant r2, pretzel r2 and r3.                                                                                                                                                      |
| September 26, 2026    | E6a           | Opus 5.5   | 20 balls with real arcs, spin and bounciness (#38)                                                                                                                              | 18 of 20 looked right at once; the basketball and the bowling ball needed a second round.                                                                                                                                               |
| September 26, 2026    | E6b           | Opus 5.5   | 18 taps: eleven landmarks with respectful moments, a school of fish, nautilus, sea urchin, frog, shield, crown and snowman (#36)                                                | All 18 looked right at once.                                                                                                                                                                                                            |
| September 27, 2026    | F             | Opus 5.5   | A puzzle cube that turns under the finger, Newton's cradle, chess by tapping and bricks that build five models, plus an engine re-sort for pieces that land far away (#45, #42) | All 4 looked right at once. The cube has 26 cubies as tokens; the scramble is 14 random turns.                                                                                                                                          |
| September 27, 2026    | G             | Opus 5.5   | An image-to-3D tool (a free Hugging Face Space) and two shipped toys, a pencil and a tin can, with a Look choice (#43; looks #47, #48)                                          | 2 toys shipped, 1 failed; a run took about 30 seconds and the quota ran out after 4 runs. The owner liked the looks but wanted real-looking defaults, so there was a second round.                                                      |
| September 28, 2026    | Math          | Opus 5.5   | A safe equation reader (no eval) and five toys on the math shelf: a graph plotter, a surface plotter, circle and waves, Fourier circles and a Pythagoras proof; two fixes (#50) | 42 famous curves and 16 famous surfaces; 5 of 7 clips good the first time, the other 2 redone.                                                                                                                                          |
| September 28, 2026    | Fix3          | Opus 5.5   | The bananas without the loose crown, and an ocean wave that collapses on one smooth clock (#54)                                                                                 | The wave was good the first time; the bananas were marked "fix" (remove the crown) and redone.                                                                                                                                          |
| September 28, 2026    | AI            | Opus 5.5   | A shelf of 12 AI and computing toys where you watch the data move, some with 3D views (#52, engine #56)                                                                         | 4 review rounds; 2 of 11 clips good in round 1. The CNN reads a digit you draw (97.0% right on unseen digits); the word vectors use 24,000 real GloVe words.                                                                            |
| September 28, 2026    | Help          | Opus 5.5   | A how-to line that shows when a toy opens, a "?" button and an "About this toy" text (#57)                                                                                      | 88 how-to lines and 13 About texts to start; the owner approved the texts.                                                                                                                                                              |
| September 28, 2026    | HelpTextA     | Opus 5.5   | A how-to line and an About text for every toy on ten shelves (#60)                                                                                                              | 149 toys; the owner approved every text, no "fix" marks.                                                                                                                                                                                |
| September 28, 2026    | HelpTextB     | Opus 5.5   | A how-to line and an About text for every toy on eleven shelves (#59)                                                                                                           | 154 toys (111 new how-to lines, 43 kept, 148 new About texts); the owner approved every text.                                                                                                                                           |
| September 28, 2026    | Manual        | Opus 5.5   | The splat equation toy and the Tinkerer's Manual with its 25-page PDF (#65)                                                                                                     | About 2.5 hours; all five cards marked good the first time.                                                                                                                                                                             |
| September 28, 2026    | Pictures      | Opus 5.5   | The picture engine: PDFs, photos, GIFs and videos into splats (#64)                                                                                                             | All eight clips marked good; a book of 200 pages kept about 19k splats shown.                                                                                                                                                           |
| September 29, 2026    | Screens       | Opus 5.5   | The Screen in four styles and the Gaussian splatting toy with a real fit in a worker (#72, engine #71)                                                                          | About 6 hours; seven of eight clips good the first time, the sorting clip redone.                                                                                                                                                       |
| September 29, 2026    | Viewer        | Opus 5.5   | Whole PDF figures (a NaN bug, not censorship), pinch that only zooms, tilt lock, top-bar buttons, flags per toy, terms of use (#75)                                             | About 2 hours; all five clips marked good the first time.                                                                                                                                                                               |
| September 29, 2026    | Studio Sound  | Sonnet 5.5 | The Studio shelf: the song landscape (a real spectrogram you fly over) and the Chladni plate (#80; engine #81 by the Operator)                                                  | About 2.5 hours to READY; first cards marked "grainy", fixed in one round (solid sheets, denser sand).                                                                                                                                  |
| September 29, 2026    | Learn         | Sonnet 5.5 | The Manual audited and brought up to date (34 pages) and this notebook backfilled (#84)                                                                                         | About 2 hours; both cards marked good the first time.                                                                                                                                                                                   |
| September 29, 2026    | Lab           | Opus 5.5   | A sharper splat kernel (labs option) and splat fields on the GPU (#83, engine #85)                                                                                              | About 1.5 hours to READY; all six cards marked good the first time.                                                                                                                                                                     |
| September 29, 2026    | Studio Models | Sonnet 5.5 | 3D model files to splats: a Studio toy that opens a glTF, OBJ or STL model, and `tools/model-to-splats.mjs` (#86; engine #87 by the Operator)                                   | About 5 hours from start to merge; merged behind the labs switch before the owner's marks (five cards waiting).                                                                                                                         |
| September 28–29, 2026 | Books         | Opus 5.5   | Your book (any PDF, five styles, pages that turn and curl), the photo album and the picture frame (#73, engine #74)                                                             | About 15 hours from start to merge, with its own engine PR; merged behind the labs switch before the owner's marks (six cards waiting).                                                                                                 |
| September 29, 2026    | Fidelity A    | Opus 5.5   | The grainy-toy audit and 24 of the worst toys made sharp (#77)                                                                                                                  | About 12 hours from start to merge; 23 of 24 cards good the first time, the Klein bottle redone once.                                                                                                                                   |
| September 29, 2026    | Fidelity B    | Opus 5.5   | The other 73 toys on the audit list made sharp, and even versions of the kit's shapes (#90)                                                                                     | About 8.5 hours from start to merge; all 73 cards good the first time.                                                                                                                                                                  |
| September 29, 2026    | Worlds        | Opus 5.5   | The world engine and the Test island: a world of splats you walk around, from recipes, with its own level of detail (#78)                                                       | About 14 hours from start to merge; the owner liked the mechanics, not the grain or the simple character, so round 2 split into Worlds r2 and Character.                                                                                |
| September 29, 2026    | Anatomy       | Opus 5.5   | The anatomy atlas: a clinical figure peeled layer by layer in solid pieces, with a labels list beside the stage (#92, engine #93)                                               | About 6.5 hours from start to merge; kit-built, since no layered CC0 or CC BY body exists; all three cards good the first time.                                                                                                         |
| September 29, 2026    | A/B (maker A) | Sonnet 5.5 | The toy piano, built blind against maker B (#89, closed)                                                                                                                        | Its three cards were marked "too grainy"; closed after the owner's marks.                                                                                                                                                               |
| September 29, 2026    | A/B (maker B) | Opus 5.5   | The toy piano: a hammer strikes a ringing rod for each key; Twinkle, Twinkle (#91)                                                                                              | About 5 hours to READY; all three cards good the first time, so it won the blind A/B and merged as a public toy.                                                                                                                        |
| September 29, 2026    | Character     | Opus 5.5   | A detailed person for Worlds, kit-built from splats: real proportions, a sculpted face, hands, clothes, and a walk, run and idle (#110)                                         | About 4 hours; the owner: "Better, but still looks too low-poly", and stopped the lane there. The lesson: a person made of rigid splat parts reads as low-poly at game distance; the hybrid round tries a lit, skinned model beside it. |
| September 29, 2026    | Books r2      | Opus 5.5   | Sharper book and album covers, edges, spines, leather and linen ([#112]).                                                                                                       | Time not recorded. 405 tests passed before later merges. Even faces, fine edge splats and density 1 replaced blurry edges and speckle.                                                                                                  |
| September 29, 2026    | Sharpness     | Opus 5.5   | Labs controls and measurements for pixel ratio, culling, adaptive resolution and anti-aliasing ([#107]).                                                                        | Time not recorded. 14 toys and the island measured in software. Lifting the 2× cap to 3× narrowed edges by about a third; real-phone cost was not measured.                                                                             |
| September 29, 2026    | Chemistry     | Opus 5.5   | The periodic table, all elements in the atom toy, and more molecules, crystals and orbitals ([#100], engine [#99]).                                                             | Time not recorded. 118 elements, 19 molecular conformers and 30 orbital choices; 440 tests passed in the recorded full run. Two sharpness review rounds followed.                                                                       |
| September 29, 2026    | Song live     | Sonnet 5.5 | A scrolling Live view of the Song landscape, with fading cells and caps that follow loudness ([#119]).                                                                          | Time not recorded. 48 caps. The focused run reported 87 passes and one help-length failure, then fixed. The full run did not finish.                                                                                                    |
| September 29, 2026    | Machines A    | Opus 5.5   | A Turing machine, difference engine, Enigma machine and Bombe, with working rules and typed input ([#102]).                                                                     | Time not recorded. Four toys; 110 focused tests passed after the detail fixes. All five first cards needed more sharpness. The second full run was interrupted.                                                                         |
| September 30, 2026    | Books r3      | Opus 5.5   | Pages you tap and pull, a molded gold frame, GIFs and videos in frames, and ordered photo sets ([#123], engine [#117]).                                                         | Time not recorded. 449 tests passed and two failed on main too. Video seeking failed on the local server without range requests; opening the test clip as a file fixed it.                                                              |
| September 30, 2026    | Photo to 3D   | Sonnet 5.5 | A photo becomes a depth relief on the device, with layer and depth choices ([#98]).                                                                                             | Time not recorded. 10 lane tests passed. The 27 MB depth model took 3.5–5 s on the container CPU; first use downloaded about 41 MB. Phone speed was not measured.                                                                       |
| September 30, 2026    | Lab r2        | Opus 5.5   | Reliable taps on the faint galaxy, pulses where you tap, and sharper Splat equation choices ([#116], engine [#115]).                                                            | Time not recorded. Galaxy hits rose from 0/25 to 25/25 at both sizes after lowering the picking opacity threshold. The full run passed 450 tests in four chunks.                                                                        |
| September 30, 2026    | Real objects  | Opus 5.5   | Seven everyday objects from 3D models, with moving parts, sharper surfaces and closed clothing joins ([#97]).                                                                   | Time not recorded. Five toys approved; can and bottle pours stayed in labs for Fluids. 38/40 spec files passed; the two failing files also failed on main.                                                                              |
| September 30, 2026    | Screens r2    | Opus 5.5   | Sharper TV, cinema and hologram sets, with real switches and media held while off ([#111], engine [#109]).                                                                      | Time not recorded. 450 tests passed in reconciled shards, then 60 focused checks after main moved. Density rose from 0.8 to 2; all five review cards were good.                                                                         |
| September 30, 2026    | Pianos        | Opus 5.5   | Four keyboards with moving keys and mechanisms, songs, a song bar, and MIDI and ABC readers ([#104], engine [#103]).                                                            | Time not recorded. 88 keys on each piano, 61 on the other two. The full run passed 520/521; the cat timing failure passed alone. Final cards were all good.                                                                             |
| September 30, 2026    | Fluids v1     | Opus 5.5   | The Fluid lab: particle liquids, smoke, steam and flames, with viscosity choices and reference checks ([#121]).                                                                 | Time not recorded. 502/504 tests passed initially; both failures passed alone. Mid-tier liquid solver medians were 14–30 ms. Honey stopped rather than creeping.                                                                        |
| September 30, 2026    | Sound sources | Sonnet 5.5 | A recorded-sound candidate catalog and coverage report for the sound lanes ([#140]).                                                                                            | Time not recorded. 102/158 change requests had a CC0 candidate: 252 entries. All 207 preview URLs returned 200. Originals needed a login; some matches were weak.                                                                       |
| September 30, 2026    | Worlds r2     | Opus 5.5   | A sharper island: even ground and water, crisp signs, solid bushes, rebaked props and tiered rendering ([#108]).                                                                | Time not recorded. Ground speckle fell from 0.07 to 0.03 in software measurements. 429/430 tests passed; the resized render test then passed in the 16-test lane run.                                                                   |
| September 30, 2026    | Quality audit | Sonnet 5.5 | A quality sweep of every public toy, the weakest 30, likely causes and proposed fixes ([#149]).                                                                                 | Time not recorded. 318 toys measured; 28 tap clips judged as frame strips. Scores were one reviewer’s judgments, with about one point of uncertainty; owner review was pending.                                                         |
| September 30, 2026    | Worlds hybrid | Opus 5.5   | Model ground, water and sky beside splat props, with shared light, shadows and a mesh character ([#127]).                                                                       | Time not recorded. About 6 MB of assets. 528/529 tests passed; the cat timing failure passed alone. The stylized character read better, but its derived walk was stiff.                                                                 |
| September 30, 2026    | Books r4      | Opus 5.5   | Page focus, One page reading on portrait phones, cleaner turns and sharper stapled paper ([#126]).                                                                              | Time not recorded. 519 tests passed before later merges. A single tap waits about 0.3 s to distinguish a double-tap; page focus was left out of embeds.                                                                                 |
| September 30, 2026    | Fix4          | Opus 5.5   | Visible clock hands, clearer marble glass, and an engine option for view-dependent glass opacity ([#134], [#136]).                                                              | Time not recorded. The clock needed pose sorting as well as lifted hands. Four toy and four engine checks passed; the full run stopped early. The marble did not yet use the new opacity kind.                                          |
| October 1, 2026       | Fix5          | Opus 5.5   | Flag-colored balloon scraps, a solid alarm-clock hand, glass taps, clearer help and live-time clock choices ([#145]).                                                           | Time not recorded. 8 lane tests passed. Partial rig weights had bent the scanned hand; a separate solid hand replaced it. The combined run caught an overlong help line, then fixed.                                                    |
| October 1, 2026       | UI r2         | Opus 5.5   | Focus mode, larger panels and drawing pads, pan saved in scenes, and Home Screen app files ([#131]; handoff [#166]).                                                            | Time not recorded. 12 lane tests passed. The earlier full run passed 564/568; the pan bug was fixed and timing checks passed alone. Stroke length replaced pointer-event count.                                                         |
| October 1, 2026       | Sound A       | Opus 5.5   | Recorded samples, credits, sound checks and revised sounds for the first shelves ([#141], [#142]; handoff [#161]).                                                              | Time not recorded. 67 toys; the handoff lists 57 CC0 sample files: 34 recordings plus 23 piano notes. Five lane tests passed. Listening proxies left final sound acceptance to the owner.                                               |
| October 1, 2026       | Video 3D      | Opus 5.5   | A video-to-3D labs spike: on-device camera solving and splat training, PLY export and flight replay ([#133], engine [#137]).                                                    | Time not recorded. 587/589 tests passed on a quiet CPU; both failures passed alone. Software training left soft unseen angles and moving-person ghosts; real-device numbers were pending.                                               |
| October 1, 2026       | UI r4         | Opus 5.5   | Drag across keys to play a glissando on six keyboard toys, with every crossed key registered ([#157], engine [#156]; handoff [#166]).                                           | Time not recorded. Four lane and two engine tests passed, plus 145 existing checks. All six clips were good. Interpolating between pointer samples prevented skipped keys.                                                              |
| October 1, 2026       | Sound B       | Opus 5.5   | Revised sounds for the other shelves, including real recordings and new synthesized voices ([#138]; handoff [#165]).                                                            | Time not recorded. 108 toys; 28 recordings and 43 new voices. The recorded full run passed 416 then 207 tests. After re-encoding, all 85 sound files totaled 986,778 bytes.                                                             |
| October 1, 2026       | UI r3         | Opus 5.5   | Tap to pause and resume long effects, still defaults for chart and keyboard toys, and a top-bar flag button ([#146]; handoff [#166]).                                           | Time not recorded. Eight lane tests passed. Two failures were fixed and one passed alone. Two checks remained red: a rig check also failed on main, and a long-effect test still expected restart.                                      |
| October 1, 2026       | Fix6          | Opus 5.5   | Photo loading fixed, Enigma typing, a periodic-table tour without loading flashes, and a smoother guitar ([#154], [#155], [#159]; handoff [#167]).                              | Time not recorded. Gzipped content length had sized a decompressed buffer too small. A 24 MP JPEG built in 6.2 s on the test server; the Operator’s final 150 checks passed.                                                            |
| October 1, 2026       | Worlds r3     | Opus 5.5   | A more detailed mesh character with captured motion, scanned props, and sharper hybrid terrain and water ([#135]).                                                              | Time not recorded. Hybrid downloads were 9.49–10.50 MB. 32 lane checks passed; the full run passed 582/583 and the remaining timing check passed alone. Software frame times were relative only.                                        |
| October 1, 2026       | Live input    | Opus 5.5   | Microphone toys, a depth mirror, live Photo to 3D, a voice tuner, clap-to-tap and screen sharing ([#150], engine [#144]).                                                       | Time not recorded. Devices start on a tap. Fake-device tests covered permissions, Stop and signals; 46 focused checks passed after merging main. Physical-device capture was not verified.                                              |
| October 2, 2026       | Shelves       | Opus 5.5   | Shelf moves, a dressed Torus, and five planet looks with saved choices ([#148], engine [#147]; handoff [#171]).                                                                 | Time not recorded. Torus built in 364–423 ms at 200k splats. The handoff records 141/141 focused passes and repaired shelf expectations. The handoff warns against per-splat assertions.                                                |
| October 2, 2026       | Science       | Opus 5.5   | Thermal ellipsoids, a super-resolution microscope and an approximate simulated galaxy, each opening real data ([#132]).                                                         | Time not recorded. Three labs toys; 20 lane tests passed. The galaxy used 300k of 2.37 million gas particles. Gaussian spreads followed the data; phone frame rates were unmeasured.                                                    |
| October 2, 2026       | Photoreal     | Sonnet 5.5 | A source and license report by shelf, plus a private page comparing captures with the toys ([#175]).                                                                            | Time not recorded. 14 captures kept from 21 examined; no capture shipped in this round. The private viewer was not tested, and unreachable sources were marked.                                                                         |
| October 2, 2026       | Live input r2 | Opus 5.5   | Long songs play while a worker measures them, with four new measured looks and synchronized Live motion ([#163], engine [#162]).                                                | Time not recorded. A 10-minute MP3 started in 1.2–1.8 s in one software setting, versus 8.9 s before. All 12 WAV clicks crossed within 50 ms. Other formats still decoded whole.                                                        |
| October 2, 2026       | Science r2    | Opus 5.5   | Pinch-and-scroll zoom for the microscope and galaxy, and the thermal-ellipsoid phone fix ([#181], engine [#182]; handoff [#189]).                                               | Time not recorded. 124 checks passed. A packed-type clash caused oversized atom discs; low-tier aspirin renders fell from 2,293 to 62 ms in software after the fix and budget reduction.                                                |
| October 2, 2026       | Fluids r4     | Opus 5.5   | A GPU liquid solver, a shaded liquid surface, grid smoke and flames, and traced props ([#152]; handoff [#190]).                                                                 | Time not recorded. 12 lane tests passed. Dam-break RMS error fell from 1.23 to 0.27 over the same 13 reference points. The CPU path remained for browsers without WebGPU.                                                               |
| October 2, 2026       | Fluids r5     | Opus 5.5   | A tappable faucet, a brighter clear stream, stable cooling lava and lighter phone settings ([#180]; handoff [#190]).                                                            | Time not recorded. 14 lane tests passed. Hidden prop splats had blocked taps; retaining them restored picking. Phone settings reduced particles and stepped down under load; phone timings were unmeasured.                             |
| October 2, 2026       | Video 3D r6   | Opus 5.5   | Short training runs grow splats; street and statue samples were retrained more sharply ([#169]).                                                                                | Time not recorded. Both reached 120k splats; street edge sharpness rose 37%, statue 21%. 679 tests passed before the final asset update. A fixed refinement schedule had prevented growth.                                              |
| October 2, 2026       | Video 3D r7   | Opus 5.5   | Filming guidance, plain failures with one retry, phone training settings and steering during flight replay ([#186]).                                                            | Time not recorded. The handoff records an Integrator run of 774/774. Phone-safe used 1,200 steps and 30k splats, with no growth. Bursts and the time limit were not tested on a real phone.                                             |
| October 2, 2026       | Live input r3 | Opus 5.5   | Tilt and audio transport, microphone recording, a clearer echo meter, a steadier mirror and Moving photo to 3D ([#191], engine [#187]).                                         | Time not recorded. 137 focused checks passed with the engine. Mirror flashing fell from 15,635 pixels to under 2,500 in its test. Per-frame depth took about 1.4 s on the software setup.                                               |
| October 2, 2026       | Sound C       | Opus 5.5   | The October 2 sound review, sound that pauses with motion, and samples ready for the first tap ([#192], engine [#183]).                                                         | Time not recorded. 44 review toys; 42 marked site, lungs ready, ice cream kept. The dice sample began 7.6 ms after motion in a slow-fetch test. The 730-pass/23-fail run used the wrong fixture port.                                   |
| October 3, 2026       | Sharpness A   | Opus 5.5   | Sharper surfaces on 32 toys across landmarks, vehicles, Medieval, Open me, gems, space and weather ([#172]).                                                                    | Time not recorded. All 32 were approved. 145 focused checks passed after the storybook split. Even opaque surfaces and calmer colors removed grain without raising tier budgets.                                                        |
| October 3, 2026       | Fix7          | Opus 5.5   | Taps where you tap, revised pause behavior, repaired looks and bonds, a wide periodic table and Enigma step-back ([#174], [#179]).                                              | Time not recorded. 24 part-two cards; 158 focused tests passed after main moved. Two older tests still needed count or fixture updates. The part-one full-run count was inconsistent in its PR.                                         |
| October 3, 2026       | Sharpness B   | Opus 5.5   | Sharper food, toys, math, computing and album covers, closed bases, and draggable plotter sliders ([#185], engine [#200]).                                                      | Time not recorded. 341 toys viewed from below. 65 checks passed after the tomato rig fix; the whole suite was not repeated after later changes. Scan defects and some gyroid specks remained.                                           |
| October 3, 2026       | Sharp A book  | Opus 5.5   | The storybook’s sharper words, cover and page edges, with pages sorted where they turn ([#202]).                                                                                | Time not recorded. 9 lane checks passed after main moved; the high-tier book built 151,781 splats in 321 ms. Sorting fixed washed-out words; a brief closing notch and specks remained.                                                 |
| October 3, 2026       | Live input r4 | Opus 5.5   | The Chladni plate plays your audio, changes sand patterns with pitch, and hides its bow during external audio ([#199]).                                                         | Time not recorded. Two new tests and 145 regression checks passed. Fake-microphone and file tests showed the sand switching between 195 and 375 Hz; chords followed one dominant mode.                                                  |
| October 3, 2026       | Live input r5 | Opus 5.5   | Moving photo plays synchronized sound with sharper frames; the mirror cuts depth edges and fills the background ([#207]).                                                       | Time not recorded. Four new tests and 150 regression checks passed after fixes. Max detail held about 44 MB for 48 frames. A never-seen background was a smooth guess; real phones were untested.                                       |
| October 3, 2026       | Fluids r6     | Opus 5.5   | Liquid tops meet the glass, streams are thinner, lava shares one cooling material, and the falling drop is flattened ([#204]; handoff [#220]).                                  | Time not recorded. 14 lane tests passed; the full suite was not run. Four views checked the glass surface. Lava ropes, drop wobble and the owner’s phone checks remained open.                                                          |
| October 3, 2026       | QR scan lab   | Sonnet 5.5 | A simulated-camera scan harness, two readers, a scorecard and regression checks for the QR styles ([#215]).                                                                     | Time not recorded. The handoff’s completed second round passed eight styles at four captures each in 44 s. Its full sweep took about 25 minutes. Simulated captures do not establish real-phone scan reliability.                       |
| October 3, 2026       | Photoreal r2  | Sonnet 5.5 | 30 new captured toys in labs, full and lite files, credits, and a command that lists NonCommercial assets ([#212]).                                                             | Time not recorded. 27 CC BY and three NC assets. Full files reached 1M splats and 15 MB; lite files 300k. Mid-tier cost and the full test suite were not verified by the lane.                                                          |
| October 3, 2026       | QR            | Opus 5.5   | A splat QR generator with eight content kinds, seven styles, scan checks, motion and exports ([#216]).                                                                          | Time not recorded. 11 lane tests passed; 44 GIF frames × 8 variants read back. M became Auto after the scan lab’s measurements. The full suite stopped at 91/845; some Bubbles clip frames failed.                                      |
| October 3, 2026       | Codex audits  | GPT-6 / ?  | Performance, licenses, accessibility, test health, materials, viewer comparison and Hands-on audits ([#206], [#195], [#196], [#213], [#234], [#237], [#235]).                   | Time not recorded. GPT-6 is named in [#234]; other audit models are not recorded. Performance covered 342 toys; test health found 17 distinct failures; Hands-on flagged 109/373. Findings were proposals.                              |
| October 3, 2026       | Fidelity      | Opus 5.5   | Trained-file decoding and rigged parts, an eleven-part orrery recipe, and render/train/measure tools ([#209], engine [#210]).                                                   | Time not recorded. Five tests passed with 272 KB of stand-in parts. Brush training had not run and the orrery was not on the shelf. Captured splats kept view-dependent color; kit parts kept base color only.                          |
| October 3, 2026       | Physics       | Opus 5.5   | Hands-on play, a small physics engine, stable grabs and stacking, and nine showcase toys ([#176], [#203], [#222], [#184]).                                                      | Time not recorded. The grab’s 98 checks passed; the placement probe stacked cleanly 8/8 times, versus 1/3 before. Showcase testing covered 76 spec files; stones could remain pinned above removed stones.                              |
| October 3, 2026       | UI r5         | Opus 5.5   | Reachable gallery controls, better piano framing and rotation, larger model files, and stage recording with sound ([#177], [#178]).                                             | Time not recorded. Three lane tests passed; a 66 MB model opened on both tiers. Recording capped takes at 60 s and 1920 px. Real-phone recording and the final full run were not verified.                                              |
| October 3, 2026       | Books r5      | Opus 5.5   | PDF links, figures and album photos that rise from the page, plus Draw a box for other figures ([#219], engine [#218]).                                                         | Time not recorded. The handoff records 91 focused passes after main moved; the full run was left to Integrators. Vector figures needed a drawn box; cover-page links still did not work.                                                |

Backfilled through October 3, 2026, on main at `aba77089`. New dates are the merge commit’s date in
Eastern time for the round’s last substantive PR. Engine and handoff-only PRs are grouped with that
round; their individual merge dates are in the linked source titles below. Review revisions within
one toy PR stay in one entry. Ops PRs and Codex’s Dot jobs PR are omitted; the seven merged Codex
audits share one entry. Earlier entries and the notes below remain as written.

New counts, timings, lessons and model names come from the linked PR bodies and lane handoffs. They
are reported results, not fresh tests of those branches. No elapsed lane duration was recorded in
those sources, so each new entry says so. The QR scan lab’s PR body still describes its first push;
its completed results come from its handoff.

Dates are merge dates where the record has them; otherwise the day of the owner's review, or the
span the record supports (Phases A to D have no recorded merge day). Every lane before September 29,
2026 ran Opus 5.5 (CLAUDE.md, "Working style"), though most lane records do not name the model.
Hours are in the records only from Manual on (the Operator's rows); the rows above say what the
records state and nothing more. The Operator adds a row for each lane when it merges, below the last
one.

## Lessons

What the lanes learned, grouped, each with the lane it came from. The full versions are in
[handoff/history.md](handoff/history.md), the lane handoff files and PACKS.md.

### Engine

- Splats are sorted in the pose they were built in, so a body that turns more than a quarter turn
  draws its far side over its near side. Build it twice, half a turn apart, and show the copy nearer
  its built pose (lane E2); for one round body, the part's `cull` flag does it with one copy (lane
  E6a), but a long body such as the football loses its ends, so it uses two copies (lane Math).
- A splat has one behavior, so a morph and another behavior cannot share a splat; morphing toys lost
  their breathing (lane E3).
- Pieces that move far, such as cube pieces and bricks, set `out.resort` on the frame they land,
  once per landing (lane F); pieces gliding just in front of a flat board need it a few times during
  the glide (lane AI).
- The app frames a toy by the bounds of all its splats, so hidden effect pieces are built inside the
  toy and grown by their part, even with `fit: false` (lanes E6a and E6b).
- Uniforms a toy does not set keep the previous toy's values in the shared shader scope, so every
  rig sets all its effect uniforms (lane E1).
- A phone panel opened while a scan loads shut itself; the sheet folds at the pick, not after the
  load (lane E1c).
- `k.roundedBox` with a high power (7 or more) leaves a thin band with no splats across its middle,
  so E5 moved the sushi board to `k.box` (lane E5); it also takes full sizes, not half sizes (lane
  E6a).
- PDF.js's modern build needs a Map method that the test browser and many phones lack, so the legacy
  build is vendored (lane Pictures).
- With the default cull limits a page built three times finer than the screen goes blank. The limits
  are lowered only while a picture toy shows, and the near and far detail follows the view (lane
  Pictures).
- One splat container per sheet, rebuilt for each page, keeps the splat count and memory flat for a
  200-page book (lane Pictures).
- A captured toy can offer looks as finished pairs of files; only the look's id goes into links
  (lane G).
- The scene reader drops characters outside ASCII, so typed text is stored in an ASCII form (lane
  Math).
- The equation reader knows only x, y, t, r, θ, a and b, so the splat equation toy hands it u and v
  as θ and y (lane Manual).
- A page that turns over (kind `leaf`) is drawn in the order it was built, so a second sheet on its
  back showed paper and no ink. The Manual's little book uses one sheet, whose far side shows in
  mirror image (lane Learn).

### Effects

- Never bend a scan with soft regions for a visible effect. Cut the part out with hard edges, swap
  in a kit-built part, or choose a different effect (lane E1b); when a scan's part cannot move
  without tearing, hide it and build a kit replacement traced from the scan's splats, as with the
  elephant's trunk (lane E1c).
- Grain had one main cause: random placement leaves about a quarter of a surface thin. An opt-in
  even placement fixes it (lane C1).
- Tiny splats vanish on small screens (under about 2 pixels). Keep size divided by the square root
  of weight near 0.5 or more and check clips at 300 to 360 pixels (lane E2). The same cause hid the
  text in the AI toys, where splats now sit only on the ink (lane AI), and a thin ribbon at weight 9
  (lane Math).
- Where a morph turns a surface a lot, use rounder splats; where it stretches one, use slightly
  larger splats, or the far side speckles through (lane E3).
- A skinned sheet (two tokens per splat) bends a whole surface through keyframes. Keep the bending
  in the plane the camera looks along and use rounder splats (lane E4-finish).
- Keyframes eased one by one stop at every key. Run one steady clock through all of them, then a
  smooth curve between the keys (lane Fix3).
- To bend one piece that touches itself, twist space smoothly instead of moving its center line, or
  the crossings pull apart (lane E5).
- Pieces that melt ride on the piece they grow from, or they are left hanging (lane E4-finish).
- Figures that walk toward the camera are built at the point of their path nearest the camera, or
  they vanish under the ground (lane E6b).
- Baked light turns with a spinning body. For a glossy ball, spin an unlit copy under a fixed
  see-through light layer (lane E6a); and paint finger holes on a body that turns instead of boring
  them (lane E6a).
- A traveling wave with morphs splits the moving pieces across three channels a third of a cycle
  apart, and something that grows out of a hidden spot is built bunched up there and morphs out
  (lane E6b).
- A set of copies, each morphing exactly into the next, gives real-time bending through keyframes of
  any shape (lane Math).
- The kit fits a toy to a sphere, so a long, thin model comes out small; lay it out as a compact
  block (lane AI).
- An image-to-3D scan's unseen side is a guess, so pick taps that keep the photographed side toward
  the camera (lane G); paint every splat of a region when recoloring a scan, or the unpainted ones
  show as pale speckle (lane G).
- Soft splats blurred together in the sorting clip. Drawing each splat as what it is, a small
  colored ellipsoid, made it crisp (lane Screens). An exact fit must divide out the random size the
  kit gives each splat (lane Screens).

### Review

- Judge an effect as a clip at phone size, not as a still, and post the clip before asking for a
  merge (lane E1b).
- Play every tap frame by frame in a test and check that its last moment matches the rest pose and
  the morph channels are back at 0 (lane E4).
- A GIF clip needs one palette for the whole clip, or flat colors split into blocks; the blocks were
  in the clip, not the toy (lanes Pictures and Screens).
- Look at legibility in the real app at 390 by 844, and make clips 480 pixels wide, because 320
  looked blurry on the phone (lane AI).
- Fix the cause. The AI text was made lighter for three review rounds before round 4 fixed it at its
  root (lane AI).
- Real photos, not our own kit renders, give an image-to-3D toy a real look (lane G).
- Help text says "the toy" does something only where it is true of the toy, and leaves out facts it
  cannot confirm (lane HelpTextA).
- Check every claim in a document against the code. The Manual's own example toys had a color in a
  format the kit does not read, and a picture-toy sample that showed a blank page back, until the
  audit built and looked at them (lane Learn).

### Parallel lanes

- An engine change goes in a small "Engine: …" PR that merges first: F's #45 before #42, AI's #56
  before #52, G's #47 before #48, and Screens' #71 before #72 (lanes F, AI, G and Screens).
- A lane test that counts a shelf's toys exactly breaks when another lane adds a toy. Count only the
  lane's own toys; the Manual's toy broke two finished lanes' tests, fixed in #69 (lanes Manual and
  Screens).
- A shared test that names a toy as its "no entry" example breaks when a text lane gives that toy an
  entry; the Operator fixed it in #61 (lane HelpTextB).
- Two text lanes editing one file keep both sides on a conflict, then run the help test (lanes
  HelpTextA and HelpTextB).
- PR #66 merged early with only the handoff, so the Screens toys came in a new PR (lane Screens).
- Seven parallel builders once used up a week's usage in one go, so the Operator watches the limits
  and paces the lanes, up to eight at once (lane Operator).
- The owner's cuts happen: emoji were dropped from the math toys because letters mattered more (lane
  Math).

### Tools

- A full test run rewrites other lanes' screenshots as well as the standard ones. After it, run
  `node tools/upkeep.mjs --restore-shots` and `git checkout -- tests/screenshots/`, then add your
  own (lane G).
- Read splat centers in the page (`player.stage.toy.resource.centers`) to place rig regions; that
  found the fly's legs that the renders hid (lane E1b).
- A rare engine warning (a texture-format mismatch in an instanced draw) came back four times from
  E2 to E6a; keep the test results if it returns (lane E2). The strawberry smoke test failed once
  under load and passed on the rerun (lanes E5 and E6a).
- The `chop` voice is a helicopter rotor, not a knife; knife chops are `slap` plus `crack` (lane
  E5).
- Where a recipe leaves a tap unclear, render a filmstrip (`effect-clip.mjs --strip=8`) and read the
  drive code; HelpTextB did this for about 45 toys (lane HelpTextB).
- In an automated browser the help line shows only with `?help=show`, so stage screenshots stay
  steady (lane Help).
- Page screenshots stall in the stepped-clock clip tool once a toy animates, so capture the stage
  canvas instead (lane Screens). And `pkill -f` with a pattern that also appears in the same command
  line stops that shell too (lane Screens).
- Keep a document's code samples in files that a test builds, and have a test compare the page with
  the files, so a sample cannot drift from the code (lane Learn).

## The two models

From September 29, 2026 each lane runs one assigned model (the Models section above), so the
notebook can compare Opus 5.5 and Sonnet 5.5 on the same kinds of numbers. For every lane the
notebook records, from the Operator's check-ins and the owner's marks:

- **Time**: how long the lane ran, from its start to READY (hours), and how long to merge.
- **Rounds of fixes**: how many review rounds came after the first (each redone clip is a `-r2` or
  `-r3` card).
- **First-time "good" marks**: how many of the lane's cards the owner marked good on the first
  review, out of how many.
- **Test failures before READY**: how many full test runs failed before the lane said READY, and
  what caused each.

What the records show today:

- **Time**: only the Operator's rows for Manual (about 2.5 hours) and Screens (about 6 hours). The
  earlier lanes have merge dates and no hours.
- **Rounds and first-time marks**: stated in the records for most lanes from Phase E2 on (see the
  rows above), and not for Phases A to D.
- **Test failures before READY**: no lane gives a count. The records mention only single events: the
  strawberry smoke test that failed once under load (E5, E6a), a cat-statue warning (E6a), two stale
  help tests (HelpTextB), and count tests that broke when a lane added toys (Manual).
- **Model**: named in the record for Screens; for the other early lanes, only the rule that they all
  ran Opus 5.5.

A caution for the blog: lanes differ in size and kind (an engine lane against a text lane), so the
notebook's numbers compare lanes, and they compare models only where the lanes are alike. Nothing is
estimated: an empty cell stays empty.

**The blind A/B toy.** The roadmap plans one small toy, built by each model, that the owner marks
without knowing which is which. The plan for the notebook, proposed by this lane for the Operator to
decide:

1. One small toy the owner wants, with one written brief that both models get word for word, on the
   same repository state, at the default effort, in two lanes at the same time.
2. Each lane posts its clip and card under a neutral name (toy A and toy B). The Operator alone
   keeps the key that says which model built which, and never tells the owner until the marks are
   in.
3. The owner marks each toy good or fix with a note, as for any card; a fix round, if there is one,
   is blind too.
4. The notebook then records, for each side: the model, time to READY, rounds of fixes, tests
   failing before READY, the size of the toy and its recipe, and the owner's marks and notes,
   followed by the reveal.
5. The blog shows both clips side by side and says plainly what the numbers can and cannot show from
   one toy.

[#97]:
  https://github.com/ryanjosephkamp/splashery/pull/97
  "Merged September 30, 2026, 6:21:19 AM Eastern"
[#98]:
  https://github.com/ryanjosephkamp/splashery/pull/98
  "Merged September 30, 2026, 3:56:52 AM Eastern"
[#99]:
  https://github.com/ryanjosephkamp/splashery/pull/99
  "Merged September 29, 2026, 5:09:36 PM Eastern"
[#100]:
  https://github.com/ryanjosephkamp/splashery/pull/100
  "Merged September 29, 2026, 10:42:32 PM Eastern"
[#102]:
  https://github.com/ryanjosephkamp/splashery/pull/102
  "Merged September 29, 2026, 11:16:01 PM Eastern"
[#103]:
  https://github.com/ryanjosephkamp/splashery/pull/103
  "Merged September 30, 2026, 7:52:21 AM Eastern"
[#104]:
  https://github.com/ryanjosephkamp/splashery/pull/104
  "Merged September 30, 2026, 7:52:26 AM Eastern"
[#107]:
  https://github.com/ryanjosephkamp/splashery/pull/107
  "Merged September 29, 2026, 10:41:29 PM Eastern"
[#108]:
  https://github.com/ryanjosephkamp/splashery/pull/108
  "Merged September 30, 2026, 5:27:09 PM Eastern"
[#109]:
  https://github.com/ryanjosephkamp/splashery/pull/109
  "Merged September 29, 2026, 5:09:39 PM Eastern"
[#111]:
  https://github.com/ryanjosephkamp/splashery/pull/111
  "Merged September 30, 2026, 6:53:04 AM Eastern"
[#112]:
  https://github.com/ryanjosephkamp/splashery/pull/112
  "Merged September 29, 2026, 6:20:44 PM Eastern"
[#115]:
  https://github.com/ryanjosephkamp/splashery/pull/115
  "Merged September 30, 2026, 5:48:06 AM Eastern"
[#116]:
  https://github.com/ryanjosephkamp/splashery/pull/116
  "Merged September 30, 2026, 5:48:12 AM Eastern"
[#117]:
  https://github.com/ryanjosephkamp/splashery/pull/117
  "Merged September 30, 2026, 2:53:04 AM Eastern"
[#119]:
  https://github.com/ryanjosephkamp/splashery/pull/119
  "Merged September 29, 2026, 10:42:48 PM Eastern"
[#121]:
  https://github.com/ryanjosephkamp/splashery/pull/121
  "Merged September 30, 2026, 1:52:19 PM Eastern"
[#123]:
  https://github.com/ryanjosephkamp/splashery/pull/123
  "Merged September 30, 2026, 2:53:09 AM Eastern"
[#126]:
  https://github.com/ryanjosephkamp/splashery/pull/126
  "Merged September 30, 2026, 9:11:35 PM Eastern"
[#127]:
  https://github.com/ryanjosephkamp/splashery/pull/127
  "Merged September 30, 2026, 5:54:18 PM Eastern"
[#131]:
  https://github.com/ryanjosephkamp/splashery/pull/131
  "Merged October 1, 2026, 4:12:35 AM Eastern"
[#132]:
  https://github.com/ryanjosephkamp/splashery/pull/132
  "Merged October 2, 2026, 3:56:21 AM Eastern"
[#133]:
  https://github.com/ryanjosephkamp/splashery/pull/133
  "Merged October 1, 2026, 9:48:34 AM Eastern"
[#134]:
  https://github.com/ryanjosephkamp/splashery/pull/134
  "Merged September 30, 2026, 11:08:23 PM Eastern"
[#135]:
  https://github.com/ryanjosephkamp/splashery/pull/135
  "Merged October 1, 2026, 7:24:49 PM Eastern"
[#136]:
  https://github.com/ryanjosephkamp/splashery/pull/136
  "Merged September 30, 2026, 8:23:20 PM Eastern"
[#137]:
  https://github.com/ryanjosephkamp/splashery/pull/137
  "Merged October 1, 2026, 1:50:05 AM Eastern"
[#138]:
  https://github.com/ryanjosephkamp/splashery/pull/138
  "Merged October 1, 2026, 2:25:26 PM Eastern"
[#140]:
  https://github.com/ryanjosephkamp/splashery/pull/140
  "Merged September 30, 2026, 4:44:54 PM Eastern"
[#141]:
  https://github.com/ryanjosephkamp/splashery/pull/141
  "Merged October 1, 2026, 1:50:00 AM Eastern"
[#142]:
  https://github.com/ryanjosephkamp/splashery/pull/142
  "Merged October 1, 2026, 5:51:51 AM Eastern"
[#144]:
  https://github.com/ryanjosephkamp/splashery/pull/144
  "Merged October 1, 2026, 1:08:53 PM Eastern"
[#145]:
  https://github.com/ryanjosephkamp/splashery/pull/145
  "Merged October 1, 2026, 12:41:53 AM Eastern"
[#146]:
  https://github.com/ryanjosephkamp/splashery/pull/146
  "Merged October 1, 2026, 4:13:57 PM Eastern"
[#147]:
  https://github.com/ryanjosephkamp/splashery/pull/147
  "Merged October 1, 2026, 1:49:56 AM Eastern"
[#148]:
  https://github.com/ryanjosephkamp/splashery/pull/148
  "Merged October 2, 2026, 12:53:27 AM Eastern"
[#149]:
  https://github.com/ryanjosephkamp/splashery/pull/149
  "Merged September 30, 2026, 5:28:55 PM Eastern"
[#150]:
  https://github.com/ryanjosephkamp/splashery/pull/150
  "Merged October 1, 2026, 7:45:10 PM Eastern"
[#152]:
  https://github.com/ryanjosephkamp/splashery/pull/152
  "Merged October 2, 2026, 8:31:58 AM Eastern"
[#154]:
  https://github.com/ryanjosephkamp/splashery/pull/154
  "Merged October 1, 2026, 9:00:17 AM Eastern"
[#155]:
  https://github.com/ryanjosephkamp/splashery/pull/155
  "Merged October 1, 2026, 4:13:51 PM Eastern"
[#156]:
  https://github.com/ryanjosephkamp/splashery/pull/156
  "Merged October 1, 2026, 2:08:53 PM Eastern"
[#157]:
  https://github.com/ryanjosephkamp/splashery/pull/157
  "Merged October 1, 2026, 2:08:58 PM Eastern"
[#159]:
  https://github.com/ryanjosephkamp/splashery/pull/159
  "Merged October 1, 2026, 4:56:58 PM Eastern"
[#161]:
  https://github.com/ryanjosephkamp/splashery/pull/161
  "Merged October 1, 2026, 11:30:21 AM Eastern"
[#162]:
  https://github.com/ryanjosephkamp/splashery/pull/162
  "Merged October 2, 2026, 5:34:36 AM Eastern"
[#163]:
  https://github.com/ryanjosephkamp/splashery/pull/163
  "Merged October 2, 2026, 7:08:07 AM Eastern"
[#165]:
  https://github.com/ryanjosephkamp/splashery/pull/165
  "Merged October 2, 2026, 5:41:27 AM Eastern"
[#166]:
  https://github.com/ryanjosephkamp/splashery/pull/166
  "Merged October 2, 2026, 5:41:29 AM Eastern"
[#167]:
  https://github.com/ryanjosephkamp/splashery/pull/167
  "Merged October 2, 2026, 5:41:31 AM Eastern"
[#169]:
  https://github.com/ryanjosephkamp/splashery/pull/169
  "Merged October 2, 2026, 3:21:06 PM Eastern"
[#171]:
  https://github.com/ryanjosephkamp/splashery/pull/171
  "Merged October 2, 2026, 5:41:34 AM Eastern"
[#172]:
  https://github.com/ryanjosephkamp/splashery/pull/172
  "Merged October 3, 2026, 12:44:47 AM Eastern"
[#174]:
  https://github.com/ryanjosephkamp/splashery/pull/174
  "Merged October 3, 2026, 12:08:13 AM Eastern"
[#175]:
  https://github.com/ryanjosephkamp/splashery/pull/175
  "Merged October 2, 2026, 5:41:24 AM Eastern"
[#176]:
  https://github.com/ryanjosephkamp/splashery/pull/176
  "Merged October 2, 2026, 11:09:05 AM Eastern"
[#177]:
  https://github.com/ryanjosephkamp/splashery/pull/177
  "Merged October 2, 2026, 12:40:19 PM Eastern"
[#178]:
  https://github.com/ryanjosephkamp/splashery/pull/178
  "Merged October 3, 2026, 2:45:31 PM Eastern"
[#179]:
  https://github.com/ryanjosephkamp/splashery/pull/179
  "Merged October 3, 2026, 1:03:43 AM Eastern"
[#180]:
  https://github.com/ryanjosephkamp/splashery/pull/180
  "Merged October 2, 2026, 8:32:04 AM Eastern"
[#181]:
  https://github.com/ryanjosephkamp/splashery/pull/181
  "Merged October 2, 2026, 8:31:52 AM Eastern"
[#182]:
  https://github.com/ryanjosephkamp/splashery/pull/182
  "Merged October 2, 2026, 8:31:47 AM Eastern"
[#183]:
  https://github.com/ryanjosephkamp/splashery/pull/183
  "Merged October 2, 2026, 10:06:07 AM Eastern"
[#184]:
  https://github.com/ryanjosephkamp/splashery/pull/184
  "Merged October 3, 2026, 2:45:28 PM Eastern"
[#185]:
  https://github.com/ryanjosephkamp/splashery/pull/185
  "Merged October 3, 2026, 5:43:29 AM Eastern"
[#186]:
  https://github.com/ryanjosephkamp/splashery/pull/186
  "Merged October 2, 2026, 5:02:38 PM Eastern"
[#187]:
  https://github.com/ryanjosephkamp/splashery/pull/187
  "Merged October 2, 2026, 6:49:07 PM Eastern"
[#189]:
  https://github.com/ryanjosephkamp/splashery/pull/189
  "Merged October 2, 2026, 12:41:16 PM Eastern"
[#190]:
  https://github.com/ryanjosephkamp/splashery/pull/190
  "Merged October 2, 2026, 12:41:20 PM Eastern"
[#191]:
  https://github.com/ryanjosephkamp/splashery/pull/191
  "Merged October 2, 2026, 6:49:12 PM Eastern"
[#192]:
  https://github.com/ryanjosephkamp/splashery/pull/192
  "Merged October 2, 2026, 6:49:17 PM Eastern"
[#195]:
  https://github.com/ryanjosephkamp/splashery/pull/195
  "Merged October 2, 2026, 11:56:51 PM Eastern"
[#196]:
  https://github.com/ryanjosephkamp/splashery/pull/196
  "Merged October 2, 2026, 11:56:55 PM Eastern"
[#199]:
  https://github.com/ryanjosephkamp/splashery/pull/199
  "Merged October 3, 2026, 8:06:33 AM Eastern"
[#200]:
  https://github.com/ryanjosephkamp/splashery/pull/200
  "Merged October 3, 2026, 4:26:15 AM Eastern"
[#202]:
  https://github.com/ryanjosephkamp/splashery/pull/202
  "Merged October 3, 2026, 5:43:31 AM Eastern"
[#203]:
  https://github.com/ryanjosephkamp/splashery/pull/203
  "Merged October 3, 2026, 8:06:28 AM Eastern"
[#204]:
  https://github.com/ryanjosephkamp/splashery/pull/204
  "Merged October 3, 2026, 8:06:43 AM Eastern"
[#206]:
  https://github.com/ryanjosephkamp/splashery/pull/206
  "Merged October 2, 2026, 10:46:54 PM Eastern"
[#207]:
  https://github.com/ryanjosephkamp/splashery/pull/207
  "Merged October 3, 2026, 8:06:38 AM Eastern"
[#209]:
  https://github.com/ryanjosephkamp/splashery/pull/209
  "Merged October 3, 2026, 2:45:26 PM Eastern"
[#210]:
  https://github.com/ryanjosephkamp/splashery/pull/210
  "Merged October 3, 2026, 2:45:23 PM Eastern"
[#212]:
  https://github.com/ryanjosephkamp/splashery/pull/212
  "Merged October 3, 2026, 11:16:48 AM Eastern"
[#213]:
  https://github.com/ryanjosephkamp/splashery/pull/213
  "Merged October 3, 2026, 5:53:51 AM Eastern"
[#215]:
  https://github.com/ryanjosephkamp/splashery/pull/215
  "Merged October 3, 2026, 11:16:43 AM Eastern"
[#216]:
  https://github.com/ryanjosephkamp/splashery/pull/216
  "Merged October 3, 2026, 12:16:22 PM Eastern"
[#218]:
  https://github.com/ryanjosephkamp/splashery/pull/218
  "Merged October 3, 2026, 2:45:33 PM Eastern"
[#219]:
  https://github.com/ryanjosephkamp/splashery/pull/219
  "Merged October 3, 2026, 2:45:36 PM Eastern"
[#220]:
  https://github.com/ryanjosephkamp/splashery/pull/220
  "Merged October 3, 2026, 2:45:38 PM Eastern"
[#222]:
  https://github.com/ryanjosephkamp/splashery/pull/222
  "Merged October 3, 2026, 2:45:21 PM Eastern"
[#234]:
  https://github.com/ryanjosephkamp/splashery/pull/234
  "Merged October 3, 2026, 1:47:28 PM Eastern"
[#235]:
  https://github.com/ryanjosephkamp/splashery/pull/235
  "Merged October 3, 2026, 1:47:33 PM Eastern"
[#237]:
  https://github.com/ryanjosephkamp/splashery/pull/237
  "Merged October 3, 2026, 1:47:31 PM Eastern"

Lane handoffs: [Books](handoff/Books.md), [BooksR5](handoff/BooksR5.md),
[Chemistry](handoff/Chemistry.md), [Fidelity](handoff/Fidelity.md), [Fix4](handoff/Fix4.md),
[Fix5](handoff/Fix5.md), [Fix6](handoff/Fix6.md), [Fix7](handoff/Fix7.md),
[Fluids](handoff/Fluids.md), [Lab](handoff/Lab.md), [LiveInput](handoff/LiveInput.md),
[MachinesA](handoff/MachinesA.md), [Photo3D](handoff/Photo3D.md), [Photoreal](handoff/Photoreal.md),
[PhotorealR2](handoff/PhotorealR2.md), [Physics](handoff/Physics.md), [Pianos](handoff/Pianos.md),
[QR](handoff/QR.md), [QRLab](handoff/QRLab.md), [RealObjects](handoff/RealObjects.md),
[Science](handoff/Science.md), [ScreensR2](handoff/ScreensR2.md), [SharpA](handoff/SharpA.md),
[SharpB](handoff/SharpB.md), [Sharpness](handoff/Sharpness.md), [Shelves](handoff/Shelves.md),
[SoundA](handoff/SoundA.md), [SoundB](handoff/SoundB.md), [SoundC](handoff/SoundC.md),
[UIr2](handoff/UIr2.md), [UIr3](handoff/UIr3.md), [UIr4](handoff/UIr4.md), [UIr5](handoff/UIr5.md),
[Video3D](handoff/Video3D.md), [Worlds](handoff/Worlds.md).
