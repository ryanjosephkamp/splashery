# Codex tasks

Each file here is one task for Codex, written by the Operator. Ryan starts each with a one-line
prompt:

> Read docs/codex/NN-name.md in this repository and do it.

Ryan runs every Codex task at **High** effort (his call of October 8, 2026, the same level as the
Claude workers).

Each task works on its own `codex/<name>` branch and opens one draft pull request against `main`
(`AGENTS.md` has the rules). The Operator and the Claude lanes check every point before anything
merges.

| File                              | Task                                                                                                | Changes                                              | Needs the web |
| --------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| 01-about-audit.md                 | Check every toy's how-to and About text; element facts                                              | `src/toy-help.js`, reports                           | yes           |
| 02-credits-audit.md               | Every shipped asset's license, checked on its source page                                           | report only                                          | yes           |
| 03-test-health.md                 | Flaky and slow tests, with causes and proposed fixes                                                | report only                                          | no            |
| 04-phone-a11y.md                  | Phone, keyboard and screen-reader audit of the public site                                          | report and screenshots                               | no            |
| 05-compat-tests.md                | Old `#s=` links and saved scenes: a corpus and a test file                                          | one new test file                                    | no            |
| 06-perf-audit.md                  | Load size and frame time per toy, and what would lighten it                                         | report and data                                      | no            |
| 08-fidelity-stage1.md             | The boombox trained from Blender renders, on the owner's Mac                                        | scripts, two SOGs, report                            | yes           |
| 09-supersplat-compare.md          | Splashery and SuperSplat compared, with evidence                                                    | report and data                                      | yes           |
| 11-hands-on-materials.md          | Real physical properties for the hands-on toys, with sources                                        | data and report                                      | yes           |
| 12-hands-l1-sweep.md              | Every toy picks up, lands, settles and goes home on Reset                                           | one new test file, report                            | no            |
| 13-manual-audit.md                | The Tinkerer's Manual: true, current, and clear to a newcomer                                       | report and small fixes                               | yes           |
| 14-fluid-phone.md                 | The Fluid Lab on a phone: why it locks up, and the fix                                              | report and data                                      | no            |
| 15-notebook.md                    | The lab notebook, brought up to date from the merged PRs                                            | `docs/NOTEBOOK.md`                                   | no            |
| 16-evidence-computing.md          | Is it right? AI and computing, and the Lab: evidence and tests                                      | `docs/evidence/`, a test file, report                | yes           |
| 17-evidence-math.md               | Is it right? Math and Shapes                                                                        | `docs/evidence/`, a test file, report                | yes           |
| 18-evidence-space-weather.md      | Is it right? Space and Weather                                                                      | `docs/evidence/`, a test file, report                | yes           |
| 19-evidence-matter-life.md        | Is it right? Tiny world, Atoms, Anatomy, Gems and Science                                           | `docs/evidence/`, a test file, report                | yes           |
| 20-evidence-studio-music.md       | Is it right? Studio, Music and the hands-on physics                                                 | `docs/evidence/`, a test file, report                | yes           |
| 21-pdf-motion.md                  | Can a toy move inside a PDF? Samples for every viewer                                               | report, sample PDFs, scripts                         | yes           |
| 22-evidence-earth-imaging.md      | Is it right? Earth and maps, and Imaging                                                            | `docs/evidence/`, a test file, report                | yes           |
| 23-evidence-landmarks-vehicles.md | Is it right? Landmarks, vehicles and medieval machines                                              | `docs/evidence/`, a test file, report                | yes           |
| 24-evidence-games-rules.md        | Are the rules right? Chess, games, the arcade and sports balls                                      | `docs/evidence/`, a test file, report                | yes           |
| 25-us-english-report.md           | The American English sweep: a report first, no edits                                                | report only                                          | no            |
| 26-links-and-assets.md            | Broken links, missing files and dead assets                                                         | a script, report                                     | yes           |
| 27-site-a11y.md                   | Keyboard and screen-reader check of the site pages                                                  | a test file, report, screenshots                     | no            |
| 28-test-coverage-gaps.md          | Which shared modules no test covers; tests for the pure ones                                        | one new test file, report                            | no            |
| 29-flaky-root-causes.md           | Why the intermittent tests fail, with reproductions                                                 | report only                                          | no            |
| 30-docs-cleanup.md                | README, schema and pack docs checked against the code                                               | small doc fixes, report                              | no            |
| 31-credits-consistency.md         | Credits, licenses and assets checked against each other                                             | a script, report                                     | no            |
| 32-moving-photo-stability.md      | A steadier Moving photo to 3D, measured before and after                                            | `moving-photo.js`, a helper, tests                   | no            |
| 33-program-gallery.md             | Sixty splat programs for a gallery, with tests and thumbnails                                       | a data file, tests, thumbnails                       | yes           |
| 37-depth-engine.md                | Faster, steadier depth for the Studio                                                               | the depth worker, tests, report                      | yes           |
| 38-moving-photo-r2.md             | Moving photo to 3D, as good on your own clip as on the samples                                      | `moving-photo.js`, samples, tests                    | yes           |
| 39-photo-3d-r2.md                 | Photo to 3D with no gaps                                                                            | Photo to 3D, the relief mesh, tests                  | no            |
| 40-video-3d-r2.md                 | Video to 3D, a world you can walk through                                                           | `src/video3d/`, samples, tests                       | yes           |
| 41-splat-mirror-r2.md             | A steadier, cleaner Splat mirror                                                                    | `src/live/relief.js`, tests                          | no            |
| 42-fluid-lab-phone-r2.md          | The Fluid Lab, smooth on a phone                                                                    | `src/fluids/`, tests, report                         | no            |
| 43-arcade-new-games.md            | Three new arcade games, played by real rules                                                        | new game modules, tests                              | yes           |
| 44-photoreal-planets.md           | The photoreal planets, polished                                                                     | `src/space/`, tiles, tests                           | yes           |
| 45-elements-polish.md             | The periodic table and the real elements, polished                                                  | the elements toys, photos, tests                     | yes           |
| 46-blender-worlds.md              | Blender-built worlds, baked to splats (after PR #549)                                               | `tools/blender/`, a world, tests                     | yes           |
| 47-manual-audit-r4.md             | The third manual audit's fixes (Manual r8, #571), audited                                           | report only                                          | yes           |
| 48-moving-photo-r3.md             | Moving photo to 3D with no holes and no white specks (a long Goal run on #560)                      | `moving-photo.js` and task 38's files, tests, report | no            |
| 49-prototypes-to-labs.md          | Truss bridge, gear train and coupled oscillators: prototypes into labs toys                         | new packs, shared-list lines, tests, evidence        | no            |
| 50-suite-speed-flakes.md          | The full test suite at least 2× faster, and the known flakes fixed at their cause                   | tests, `tools/suite.mjs`, report                     | no            |
| 51-load-time.md                   | Faster first load with the same look (task 06's wins, measured)                                     | assets, loaders, report                              | no            |
| 52-phone-a11y-fixes.md            | The phone and accessibility audit's fixes                                                           | site UI, tests, report                               | no            |
| 53-photo-3d-r3.md                 | Photo to 3D perfected: no outlines in the Sharp view, no holes (a long Goal run on #566)            | Photo to 3D, the relief, tests, report               | yes           |
| 54-sample-pictures.md             | New AI-made Photo to 3D samples, and backgrounds made for the Picture QR                            | samples, `src/qr-craft/samples.js`, tests, report    | yes           |
| 55-video-3d-clarity.md            | Video to 3D, sharp and clear (a long Goal run on #562)                                              | `src/video3d/`, bakes, tests, report                 | yes           |
| 56-ground-truth-scenes.md         | Test scenes with exact depth and camera paths, and a scorer, for the Studio                         | tools, fixtures, report                              | yes           |
| 57-hard-case-samples.md           | Hard-case AI-made Photo to 3D samples (glass, hair, thin parts, reflections)                        | samples, records, tests, report                      | yes           |
| 58-qr-theme-packs.md              | Six themed packs of Picture QR backgrounds that scan with any link (after #582)                     | backgrounds, records, tests, report                  | yes           |
| 59-material-swatches.md           | Twenty real-looking materials made by code, a helper, and a labs swatch toy                         | `src/materials/`, a labs toy, tests, report          | yes           |
| 60-world-skies.md                 | Sixteen skies and backdrops made by code for the Worlds, and a labs Sky picker                      | `src/worlds/skies.js`, a labs toy, tests, report     | yes           |
| 61-prototypes-batch-2.md          | Double pendulum, orbit transfer, logistic map and projectile drag into labs toys                    | new packs, shared-list lines, tests, evidence        | yes           |
| 62-prototypes-batch-3.md          | Pathfinding, room acoustics, field lines, Doppler and color space into labs toys                    | new packs, shared-list lines, tests, evidence        | yes           |
| 63-new-labs-trio.md               | Wing section lab, monochord and Apollo capsule interior: three new labs toys                        | new packs, a NASA model, tests, evidence             | yes           |
| 64-workshop-foundation.md         | The Workshop foundation (builders/TASKS.md T11). Held October 13: experiments go to the Splash Shop | `workshop/`, an Engine PR, a smoke test              | no            |
| 65-compat-tests-r2.md             | Old links and saved scenes locked in by tests (task 05 finished, on #197)                           | one test file, a corpus, a schema note               | no            |
| 66-kit-tiers.md                   | Splat tiers for the Science, Space and Math kit toys (builders/TASKS.md T2)                         | recipes in `src/packs/`, report                      | no            |
| 67-flagship-pilots.md             | Five flagship pilots, proposed (builders/TASKS.md T12; a report, nothing built)                     | report only                                          | yes           |
| 68-splat-sharpness-experiment.md  | Sharper splats on screen without shimmer, a Workshop experiment (T9)                                | `workshop/`, report                                  | no            |
| 69-circular-qr.md                 | Circular QR codes in five QR toys, and two QR fixes (grainy anatomy, white lines)                   | the QR packs, tests, report                          | yes           |
| 70-playground-site-links.md       | The Playground links to the site and each toy's page; settings reachable in landscape               | the app's UI, tests                                  | no            |
| 71-renderer-diagnostics.md        | When 3D can't start: keep the real cause, a local report, honest tests and guidance                 | start-up path (an Engine commit), tests              | no            |

The Codex cloud environment is set up with `tools/codex-setup.sh`; [SETUP.md](SETUP.md) has the
steps for creating it and fixing a failed setup.

## Dot jobs

The [October 2026 report](../audits/dot-jobs-2026-10.md) has capability and usage findings,
ownership prerequisites, and eight ready-to-paste briefs. These are proposals, not dispatched lanes.
Dot conversations avoid ChatGPT limits; delegated Work/Codex tasks use their normal allowances.
Provision the tools and reserve the paths before assigning a brief.

| Brief                                                                                            | Task                                                                    | Changes                                            | Needs the web |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------- | ------------- |
| [J01 — Knot inspector](../audits/dot-jobs-2026-10.md#j01--knot-inspector)                        | A labs kit toy with a tracer following a solid knot                     | new pack/test/thumb, own registry entries, handoff | yes           |
| [J02 — Material renders](../audits/dot-jobs-2026-10.md#j02--cpu-material-reference-renders)      | Original CPU Blender references and reproducibility data                | isolated script, audit and previews                | yes           |
| [J03 — Impact sounds](../audits/dot-jobs-2026-10.md#j03--impact-sound-candidates)                | Twelve CC0 contact-sound candidates with audition evidence              | manifest, checker and report; no shipped audio     | yes           |
| [J04 — Earthquake data](../audits/dot-jobs-2026-10.md#j04--frozen-earthquake-data)               | A dated USGS sample with provenance and unit checks                     | static audit data, checker and report              | yes           |
| [J05 — Model CLI tests](../audits/dot-jobs-2026-10.md#j05--model-cli-tests-one-file)             | Synthetic converter CLI regression cases                                | one new test file                                  | no            |
| [J06 — NC checker tests](../audits/dot-jobs-2026-10.md#j06--nc-checker-tests-one-file)           | Negative cases for the NC asset checker                                 | one new test file                                  | no            |
| [J07 — License graph](../audits/dot-jobs-2026-10.md#j07--license-evidence-graph-proposal)        | A bounded source and rights review template proposal                    | two audit proposals; Grooph read-only              | yes           |
| [J08 — Effect review graph](../audits/dot-jobs-2026-10.md#j08--toy-effect-review-graph-proposal) | Separate tests, motion critique and owner acceptance                    | two audit proposals; Grooph read-only              | yes           |
| 36-manual-audit-r3.md                                                                            | The whole Tinkerer's Manual, audited a third time (after #542 and #545) | report only                                        | yes           |

## The third wave (tasks 55 to 68, October 13, 2026)

While the weekly reset is a day away, Codex does the heavy lifting. Tasks 55 to 57 serve the owner's
first priority (any picture or video into clear 3D); 57, 58, 59 and 60 make new pictures and
materials within Rules v1 (AI-made pictures only as labeled Studio samples and Picture QR
backgrounds; everything else made by code, CC0); 61 to 63 add labs toys on the open shelves; 64 to
68 build the platform. PRs #570 and #576 have merged, so their files are free. The Operator keeps
the list of what is running and what to start next.

## The Studio push (tasks 37 to 41, October 12, 2026)

The owner's first priority for Codex: the Studio's 2D-to-3D toys (Photo to 3D, Moving photo to 3D,
Video to 3D and the Splat mirror) as good as they can be. The five tasks run at the same time, each
in its own Codex session, and each task file names the files it may change so they don't collide.
Task 37 owns the depth model that the other toys call. Task 38 starts from task 32's branch and
replaces PR #479. All four toys are behind the labs switch, so the Operator merges each PR after its
tests pass and the owner has seen its clips.

The second wave (tasks 42 to 46) can run beside them; their files don't overlap the Studio's: the
Fluid Lab on a phone, three new arcade games, the photoreal planets, the periodic table and the real
elements, and Blender-built worlds (after the Baked engine, PR #549, is on `main`). More ideas are
in `builders/TASKS.md` (Blender-baked remakes, the Workshop, performance, photoreal sourcing).
