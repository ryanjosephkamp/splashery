# Codex tasks

Each file here is one task for Codex, written by the Operator. Ryan starts each with a one-line
prompt:

> Read docs/codex/NN-name.md in this repository and do it.

Each task works on its own `codex/<name>` branch and opens one draft pull request against `main`
(`AGENTS.md` has the rules). The Operator and the Claude lanes check every point before anything
merges.

| File                     | Task                                                          | Changes                    | Needs the web |
| ------------------------ | ------------------------------------------------------------- | -------------------------- | ------------- |
| 01-about-audit.md        | Check every toy's how-to and About text; element facts        | `src/toy-help.js`, reports | yes           |
| 02-credits-audit.md      | Every shipped asset's license, checked on its source page     | report only                | yes           |
| 03-test-health.md        | Flaky and slow tests, with causes and proposed fixes          | report only                | no            |
| 04-phone-a11y.md         | Phone, keyboard and screen-reader audit of the public site    | report and screenshots     | no            |
| 05-compat-tests.md       | Old `#s=` links and saved scenes: a corpus and a test file    | one new test file          | no            |
| 06-perf-audit.md         | Load size and frame time per toy, and what would lighten it   | report and data            | no            |
| 08-fidelity-stage1.md    | The boombox trained from Blender renders, on the owner's Mac  | scripts, two SOGs, report  | yes           |
| 09-supersplat-compare.md | Splashery and SuperSplat compared, with evidence              | report and data            | yes           |
| 11-hands-on-materials.md | Real physical properties for the hands-on toys, with sources  | data and report            | yes           |
| 12-hands-l1-sweep.md     | Every toy picks up, lands, settles and goes home on Reset     | one new test file, report  | no            |
| 13-manual-audit.md       | The Tinkerer's Manual: true, current, and clear to a newcomer | report and small fixes     | yes           |
| 14-fluid-phone.md        | The Fluid Lab on a phone: why it locks up, and the fix        | report and data            | no            |
| 15-notebook.md           | The lab notebook, brought up to date from the merged PRs      | `docs/NOTEBOOK.md`         | no            |

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
