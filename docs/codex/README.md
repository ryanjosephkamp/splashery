# Codex tasks

Each file here is one task for Codex, written by the Operator. Ryan starts each with a one-line
prompt:

> Read docs/codex/NN-name.md in this repository and do it.

Ryan runs every Codex task at **High** effort (his call of October 8, 2026, the same level as the
Claude workers).

Each task works on its own `codex/<name>` branch and opens one draft pull request against `main`
(`AGENTS.md` has the rules). The Operator and the Claude lanes check every point before anything
merges.

| File                              | Task                                                           | Changes                               | Needs the web |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------- | ------------- |
| 01-about-audit.md                 | Check every toy's how-to and About text; element facts         | `src/toy-help.js`, reports            | yes           |
| 02-credits-audit.md               | Every shipped asset's license, checked on its source page      | report only                           | yes           |
| 03-test-health.md                 | Flaky and slow tests, with causes and proposed fixes           | report only                           | no            |
| 04-phone-a11y.md                  | Phone, keyboard and screen-reader audit of the public site     | report and screenshots                | no            |
| 05-compat-tests.md                | Old `#s=` links and saved scenes: a corpus and a test file     | one new test file                     | no            |
| 06-perf-audit.md                  | Load size and frame time per toy, and what would lighten it    | report and data                       | no            |
| 08-fidelity-stage1.md             | The boombox trained from Blender renders, on the owner's Mac   | scripts, two SOGs, report             | yes           |
| 09-supersplat-compare.md          | Splashery and SuperSplat compared, with evidence               | report and data                       | yes           |
| 11-hands-on-materials.md          | Real physical properties for the hands-on toys, with sources   | data and report                       | yes           |
| 12-hands-l1-sweep.md              | Every toy picks up, lands, settles and goes home on Reset      | one new test file, report             | no            |
| 13-manual-audit.md                | The Tinkerer's Manual: true, current, and clear to a newcomer  | report and small fixes                | yes           |
| 14-fluid-phone.md                 | The Fluid Lab on a phone: why it locks up, and the fix         | report and data                       | no            |
| 15-notebook.md                    | The lab notebook, brought up to date from the merged PRs       | `docs/NOTEBOOK.md`                    | no            |
| 16-evidence-computing.md          | Is it right? AI and computing, and the Lab: evidence and tests | `docs/evidence/`, a test file, report | yes           |
| 17-evidence-math.md               | Is it right? Math and Shapes                                   | `docs/evidence/`, a test file, report | yes           |
| 18-evidence-space-weather.md      | Is it right? Space and Weather                                 | `docs/evidence/`, a test file, report | yes           |
| 19-evidence-matter-life.md        | Is it right? Tiny world, Atoms, Anatomy, Gems and Science      | `docs/evidence/`, a test file, report | yes           |
| 20-evidence-studio-music.md       | Is it right? Studio, Music and the hands-on physics            | `docs/evidence/`, a test file, report | yes           |
| 21-pdf-motion.md                  | Can a toy move inside a PDF? Samples for every viewer          | report, sample PDFs, scripts          | yes           |
| 22-evidence-earth-imaging.md      | Is it right? Earth and maps, and Imaging                       | `docs/evidence/`, a test file, report | yes           |
| 23-evidence-landmarks-vehicles.md | Is it right? Landmarks, vehicles and medieval machines         | `docs/evidence/`, a test file, report | yes           |
| 24-evidence-games-rules.md        | Are the rules right? Chess, games, the arcade and sports balls | `docs/evidence/`, a test file, report | yes           |
| 25-us-english-report.md           | The American English sweep: a report first, no edits           | report only                           | no            |
| 26-links-and-assets.md            | Broken links, missing files and dead assets                    | a script, report                      | yes           |
| 27-site-a11y.md                   | Keyboard and screen-reader check of the site pages             | a test file, report, screenshots      | no            |
| 28-test-coverage-gaps.md          | Which shared modules no test covers; tests for the pure ones   | one new test file, report             | no            |
| 29-flaky-root-causes.md           | Why the intermittent tests fail, with reproductions            | report only                           | no            |
| 30-docs-cleanup.md                | README, schema and pack docs checked against the code          | small doc fixes, report               | no            |
| 31-credits-consistency.md         | Credits, licenses and assets checked against each other        | a script, report                      | no            |
| 32-moving-photo-stability.md      | A steadier Moving photo to 3D, measured before and after       | `moving-photo.js`, a helper, tests    | no            |
| 33-program-gallery.md             | Sixty splat programs for a gallery, with tests and thumbnails  | a data file, tests, thumbnails        | yes           |

The Codex cloud environment is set up with `tools/codex-setup.sh`; [SETUP.md](SETUP.md) has the
steps for creating it and fixing a failed setup.

## Dot jobs

The [October 2026 report](../audits/dot-jobs-2026-10.md) has capability and usage findings,
ownership prerequisites, and eight ready-to-paste briefs. These are proposals, not dispatched lanes.
Dot conversations avoid ChatGPT limits; delegated Work/Codex tasks use their normal allowances.
Provision the tools and reserve the paths before assigning a brief.

| Brief                                                                                            | Task                                                       | Changes                                            | Needs the web |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------- | ------------- |
| [J01 — Knot inspector](../audits/dot-jobs-2026-10.md#j01--knot-inspector)                        | A labs kit toy with a tracer following a solid knot        | new pack/test/thumb, own registry entries, handoff | yes           |
| [J02 — Material renders](../audits/dot-jobs-2026-10.md#j02--cpu-material-reference-renders)      | Original CPU Blender references and reproducibility data   | isolated script, audit and previews                | yes           |
| [J03 — Impact sounds](../audits/dot-jobs-2026-10.md#j03--impact-sound-candidates)                | Twelve CC0 contact-sound candidates with audition evidence | manifest, checker and report; no shipped audio     | yes           |
| [J04 — Earthquake data](../audits/dot-jobs-2026-10.md#j04--frozen-earthquake-data)               | A dated USGS sample with provenance and unit checks        | static audit data, checker and report              | yes           |
| [J05 — Model CLI tests](../audits/dot-jobs-2026-10.md#j05--model-cli-tests-one-file)             | Synthetic converter CLI regression cases                   | one new test file                                  | no            |
| [J06 — NC checker tests](../audits/dot-jobs-2026-10.md#j06--nc-checker-tests-one-file)           | Negative cases for the NC asset checker                    | one new test file                                  | no            |
| [J07 — License graph](../audits/dot-jobs-2026-10.md#j07--license-evidence-graph-proposal)        | A bounded source and rights review template proposal       | two audit proposals; Grooph read-only              | yes           |
| [J08 — Effect review graph](../audits/dot-jobs-2026-10.md#j08--toy-effect-review-graph-proposal) | Separate tests, motion critique and owner acceptance       | two audit proposals; Grooph read-only              | yes           |
