# Jobs for Dot agents — October 2026

**Usage boundary:** OpenAI confirms that Dot conversations do not count toward ChatGPT usage limits.
Work and Codex tasks started or managed by a Dot use those products' normal allowances, and deeper
Dot work has a plan allowance. This does **not** establish unlimited free job execution. These jobs
depend on the execution route and available tools; do not silently delegate to Work or Codex to
satisfy the goal of avoiding that usage. [OpenAI: Meet dots](https://learn.chatgpt.com/docs/dots)

## Summary

- Codex researched 18 candidates and wrote eight briefs; no job was built or assigned.
- The briefs cover a kit toy, Blender, two data jobs, two tests, and two graph proposals.
- Dot conversations avoid ChatGPT limits; Work/Codex delegation uses normal allowances.
- Direct Dot developer tools and its maximum job duration remain unconfirmed.
- Reserve paths and provision tools first; every job ends at one draft Splashery PR.
- Only the Operator posts effect clips; Ryan judges motion and decides Grooph adoption.
- Grooph remains read-only; its proposals stay in Splashery.

## What a Dot can do today

Checked October 3, 2026. These are documentation findings, not a live test of Ryan's Dot.

OpenAI's key usage sentence is: “Conversations with your dot don’t count toward your ChatGPT usage
limits.” The same page distinguishes delegated Work/Codex usage and a deeper-work allowance. Its
description of Dot as “always-on” supports background work, but supplies no fixed maximum continuous
job duration. [Meet dots](https://learn.chatgpt.com/docs/dots)

| Question                    | Confirmed behavior and practical limit                                                                                                                                                                                                                                                                                  | Official source opened                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Repository access           | Connected, enabled plugins use existing account permissions. Private repository access must be granted through the connection; a URL alone grants nothing.                                                                                                                                                              | [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps)                               |
| Branches and PRs            | The GitHub example says “GitHub to investigate an issue and prepare a pull request.” This supports PR preparation, but does not enumerate branch-write or draft-PR permissions. Preflight the configured connection's ability to create the named branch, push, and open a draft.                                       | [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps)                               |
| Browser, terminal, programs | Dot has its own cloud computer, files, software, and browser sessions. Local skills require a connected computer. The inspected Dot pages do not guarantee a shell, OS, Node, Playwright, Chromium, Blender, administrator access, or GPU.                                                                              | [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps)                               |
| Other execution routes      | Dot can start separate cloud threads, use an already configured Codex cloud environment, and create or continue local tasks. Local execution requires the connected computer online with the ChatGPT app open. Each route needs its own setup and usage decision.                                                       | [Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory)                                   |
| Codex cloud tools           | Cloud environments support configured repositories, dependencies, tools, setup scripts, and network settings. This does not establish installed programs on Dot's own computer. “Computer and browser use” is listed as unsupported there; headless browser testing through installed tools needs a separate preflight. | [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)                       |
| Duration                    | Cloud work can continue while the user's computer is off. No numeric Dot job limit was found in the inspected overview, computers, tasks, or controls pages. Estimates below are planning estimates, not promised run limits.                                                                                           | [Meet dots](https://learn.chatgpt.com/docs/dots), [Controls](https://learn.chatgpt.com/docs/dots/controls) |
| Approvals and credentials   | Existing permissions and approval controls apply. Configure GitHub access through the account connection; never put tokens, passwords, cookies, or secret values in a brief, file, or log. Missing access is a blocker, not permission to change security settings.                                                     | [Controls](https://learn.chatgpt.com/docs/dots/controls)                                                   |

**Can Blender be installed?** Blender documents `--background` (“Run in background”) and Python
scripts through `--python`. A bounded build-time render job is plausible on a compatible,
sufficiently provisioned computer. Installation on Dot's own computer remains **unconfirmed**. Use
an already provisioned Blender installation or an owner-approved environment setup; do not rent a
GPU or start a billed task as a fallback. Record `blender --version` and render a tiny CPU scene
before starting the full job. Blender's hardware requirements still apply. Its program license does
not automatically license third-party source assets; these scenes use original geometry.
[Blender command line](https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html),
[requirements](https://www.blender.org/download/requirements/),
[artwork and licensing](https://www.blender.org/about/license/).

## Repository evidence and boundaries

Splashery was inspected at main commit `9f87dc02b8afdec0e5b5d52b486be195d67dd464` after fetching
main on October 3. This report uses `codex/dot-jobs` in a separate checkout; the original
`codex/test-health` checkout was preserved.

Sources: [CLAUDE.md](../../CLAUDE.md), [OPERATING.md](../OPERATING.md),
[WORKSTREAMS.md](../WORKSTREAMS.md), [HANDS-ON-PLAN.md](../HANDS-ON-PLAN.md),
[TOY-PLAN.md](../TOY-PLAN.md), [PACKS.md](../PACKS.md), [BACKLOG.md](../BACKLOG.md), all existing
[Codex briefs](../codex/README.md), asset preparation/model converters, Blender world builders, and
pack/effect tools. The generated toy plan was cross-checked against `tools/toy-plan.json`. Asset
preparation writes full/lite SOG pairs; the model CLI can write isolated PLYs without shared
manifest changes. That distinction makes a calibration report much less coupled than a new scan.

Grooph was inspected through a pinned source archive at `dd342fc9f0f0a19405b46bbb21deab22b572667b`:
README, authoring instructions, graph IR, template documentation, CLI commands, and example
patterns. It is an authoring/compiler surface; its implemented compile target is Claude Code, while
Codex is planned. Templates have a `template` block and are instantiated before export. Neither
proposal below can claim a Dot runtime or a working Dot compile target.
[Grooph README](https://raw.githubusercontent.com/ryanjosephkamp/grooph/dd342fc9f0f0a19405b46bbb21deab22b572667b/README.md),
[templates](https://raw.githubusercontent.com/ryanjosephkamp/grooph/dd342fc9f0f0a19405b46bbb21deab22b572667b/docs/templates.md),
[graph IR](https://raw.githubusercontent.com/ryanjosephkamp/grooph/dd342fc9f0f0a19405b46bbb21deab22b572667b/docs/graph-ir.md).

The open-PR check on October 3 showed hands-on engines (#226, #224, #225) and demos (#229, #230 and
the A lane), Physics (#184, #222), Books r5 (#218, #219), Fidelity (#209, #210), QR (#216), UI r5
(#178), and paused Worlds r4 (#168). Compatibility already has PR #197. This is an ownership
snapshot, not execution evidence. The Operator must reconcile ownership again before dispatch.
[GitHub open-PR snapshot source](https://api.github.com/repos/ryanjosephkamp/splashery/pulls?state=open&per_page=100).

Exclude new assignments for boombox training (task 08), Fidelity's brass orrery/parts, QR testing,
historical scene compatibility, hands-on engine/demo code, and paused Worlds tools. An
unassigned-looking line of a frozen pack grants no write permission. J01 creates a separate pack,
leaves existing knot/torus-knot recipes alone, and does not implement the backlog's future Knots
shelf.

### Rules for every candidate

- **Ownership:** record the Operator's reservation first. No engine, `src/pc/`, frozen-pack,
  existing-test, `tests/taps.spec.mjs`, package-file, review-publishing, or operating-document
  edits. Toy jobs add only their own registry entries. Stop on an overlapping assignment.
- **Model:** `CLAUDE.md` pins Claude models by lane. This report starts no lane and grants no model
  exception. The briefs are written as Ryan's future assignments: pasting one gives Dot an explicit
  exception for that bounded job, without changing the standing policy.
- **Licenses:** prefer original work, CC0, or public domain. Current policy also allows CC BY, CC
  BY-SA, CC BY-NC, and CC BY-NC-SA with their credit/derivative terms. NC assets need `nc: true` and
  a per-asset notice; never fuse NC and BY-SA into one asset. Never use ND, unlicensed,
  personal-use-only, or paid assets. Anatomy exceptions still need owner approval. Unknown rights
  block use. No logos, brand names, or insignia in toys.
- **Effects:** rigid objects stay solid; joints move real separate parts; breaking makes pieces;
  instruments visibly move working parts. No global bending, smeared scans, speckle, or generic hop
  substituted for a meaningful tap. New toys stay in labs. Workers capture full phone-size motion
  clips; **only the Operator posts to Effect review**, and Ryan judges acceptance.
- **Text and delivery:** American English, opened source links, additive reports under
  `docs/audits/`. Each named `dot/<name>` branch starts from current main and opens exactly one
  draft Splashery PR against main. No merge, release, public publishing, Grooph change, issue, or
  PR.
- **Usage:** preflight the execution route. If direct Dot execution lacks tools or GitHub writes,
  return a blocker without silently creating Work/Codex tasks, spending, requesting secrets, or
  changing security settings. Do not promise zero usage for an unchecked route.

### Common validation (V0)

Each future job inherits these exact checks plus its row-specific commands. `SPLASHERY_CHROMIUM`
names an already installed executable; `/opt/pw-browsers/chromium` is the repository sandbox
example, not a confirmed Dot path. Never run `playwright install`. The full suite is the standing
`CLAUDE.md` before-push rule. In a clean isolated checkout, restore only tracked screenshots
regenerated by tests. Report blocked/skipped/failed checks with causes and keep the PR a draft.

```sh
npx prettier --check .
node tools/us-english.mjs --diff
SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test
git diff --check
git diff --name-only origin/main...HEAD
```

Sizes estimate active work and verification with tools available, not tokens, cost, or guaranteed
completion time. Every row inherits V0 and all rules above. The selected briefs repeat their limits.

## Candidate table

| ID / selection   | Job and output paths                                                                                                                                                                                         | Tools / network / credentials                                                                           | Additional exact checks and owner review                                                                                                                                                                                                                                                                                                           | Ownership and source rule                                                                                                   | Branch → PR                                               | Size                | Risk                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| **J01 selected** | Knot inspector: `src/packs/dot-knots.js`, `tests/dot-knots.spec.mjs`, `assets/toys/knot-inspector/thumb.webp`, `docs/handoff/DotKnots.md`; own toy/help/sound/plan entries and generated `docs/TOY-PLAN.md`. | Node/npm, installed Playwright/Chromium, locked dependency downloads, GitHub connection; no secrets.    | `node tools/check-packs.mjs`; `node tools/toy-plan.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-knots.spec.mjs tests/kit.spec.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" node tools/effect-clip.mjs .cache/dot-knots/clips --size=320 --secs=5 knot-inspector`. Operator posts; Ryan judges.                 | BACKLOG knots idea, new pack only; original equations, no Wolfram dataset/code. Existing math pack frozen.                  | `dot/knot-inspector` → draft on Splashery main            | 1–2 days            | Medium: registry collisions and visual quality.               |
| **J02 selected** | `tools/dot-material-renders.py`, `docs/audits/dot-material-renders.md`, previews/manifest in its audit folder; raw scene/renders in `.cache/dot-material-renders/`.                                          | Provisioned Blender/Python, CPU Cycles, GitHub connection; no runtime network/secrets.                  | `blender --background --python tools/dot-material-renders.py -- --out .cache/dot-material-renders --previews docs/audits/dot-material-renders`; repeat with `--verify`; `python3 -m json.tool docs/audits/dot-material-renders/manifest.json`. Owner inspects contact sheets; no effect change.                                                    | Original sphere/cube; visual shader references, not measured properties. No wd/Fidelity edits.                              | `dot/material-renders` → draft on Splashery main          | 4–8 hours + renders | Medium: Blender/headless CPU execution unconfirmed.           |
| **J03 selected** | `docs/audits/dot-impact-sounds.md`, `docs/audits/dot-impact-sounds.json`, `tools/dot-impact-sounds-check.mjs`; audio in `.cache/dot-impact-sounds/` only.                                                    | Node, ffmpeg/ffprobe, public Kenney access, GitHub connection; no login/secrets.                        | `node tools/dot-impact-sounds-check.mjs --cache .cache/dot-impact-sounds`; `python3 -m json.tool docs/audits/dot-impact-sounds.json`. Owner auditions before later sound-lane integration.                                                                                                                                                         | Twelve CC0 contact cues; per-file provenance; no shipped audio or sound registry edits.                                     | `dot/impact-sounds` → draft on Splashery main             | 3–6 hours           | Low–medium: actual file coverage needs inspection.            |
| **J04 selected** | `docs/audits/dot-earthquakes.md`, `docs/audits/dot-earthquakes.json`, `tools/dot-earthquake-check.mjs`; raw feed cached.                                                                                     | Node, public USGS HTTPS, GitHub connection; no API key/secrets.                                         | `node tools/dot-earthquake-check.mjs docs/audits/dot-earthquakes.json`; `node tools/dot-earthquake-check.mjs --self-test`; `python3 -m json.tool docs/audits/dot-earthquakes.json`. No current effect change.                                                                                                                                      | Static prerequisite for BACKLOG earthquake idea; establish USGS authorship before redistribution; unknown stays null.       | `dot/earthquake-data` → draft on Splashery main           | 3–6 hours           | Medium: provenance and changing feed.                         |
| **J05 selected** | Only `tests/dot-model-cli.spec.mjs`; synthetic fixtures/output in OS temporary directories.                                                                                                                  | Node/npm/Playwright, installed Chromium for V0, GitHub connection; no data network/secrets.             | `node --check tests/dot-model-cli.spec.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-model-cli.spec.mjs`. Check PLY structure, axes, flags, seeds, errors. No effect change.                                                                                                                                       | Beyond existing `tests/stm.spec.mjs` GLB smoke; converter/existing tests read-only.                                         | `dot/model-cli-tests` → draft on Splashery main           | 3–5 hours           | Low–medium: uncovered bug cannot be fixed in this scope.      |
| **J06 selected** | Only `tests/dot-nc-cli.spec.mjs`; temporary roots copy unchanged CLI with synthetic manifests.                                                                                                               | Node/npm/Playwright, installed Chromium for V0, GitHub connection; no source downloads/secrets.         | `node --check tests/dot-nc-cli.spec.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-nc-cli.spec.mjs`. Assert failed exits, IDs, NC/ND cases and JSON.                                                                                                                                                                | Existing `tests/pr2.spec.mjs` covers real positive path; add negative/token cases, no policy edits.                         | `dot/nc-cli-tests` → draft on Splashery main              | 2–4 hours           | Low: classification is not legal clearance.                   |
| **J07 selected** | `docs/audits/dot-license-template.md` and `docs/audits/dot-license-template.grooph.json`.                                                                                                                    | Already installed Grooph CLI, public read-only Grooph sources, Node/npm, GitHub connection; no secrets. | `grooph validate docs/audits/dot-license-template.grooph.json --json`; `python3 -m json.tool docs/audits/dot-license-template.grooph.json`. Ryan decides adoption; no graph runs.                                                                                                                                                                  | Fresh critic, separate outputs, bounded retries, human rights decision; Splashery proposal only.                            | `dot/license-evidence-template` → draft on Splashery main | 3–5 hours           | Low: no supported Dot compile target.                         |
| **J08 selected** | `docs/audits/dot-toy-review-template.md` and `docs/audits/dot-toy-review-template.grooph.json`.                                                                                                              | Same preflight as J07; public docs only; no secrets.                                                    | `grooph validate docs/audits/dot-toy-review-template.grooph.json --json`; `python3 -m json.tool docs/audits/dot-toy-review-template.grooph.json`. Ryan reviews proposal; no publishing/execution.                                                                                                                                                  | Machine checks plus independent motion bar; Operator posting is a human handoff.                                            | `dot/toy-review-template` → draft on Splashery main       | 3–5 hours           | Low–medium: preserve separate acceptance gates.               |
| J09 reserve      | New dynamics teaching recipe: `src/packs/dot-dynamics.js`, own `dot-dynamics` registry/help/sound/plan/thumb entries, `tests/dot-dynamics.spec.mjs`, `docs/handoff/DotDynamics.md`.                          | Node/npm, installed Playwright/Chromium, primary mathematical sources, GitHub connection; no secrets.   | `node tools/check-packs.mjs`; `node tools/toy-plan.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-dynamics.spec.mjs tests/kit.spec.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" node tools/effect-clip.mjs .cache/dot-dynamics/clips --size=320 --secs=5 dot-dynamics`. Operator posts; Ryan reviews.            | New bounded equation sampler inspired by thin-curve concerns; existing Lorenz/math/physics code untouched.                  | `dot/dynamics-recipe` → draft on Splashery main           | 1–2 days            | Medium: numerical stability and distinct purpose.             |
| J10 reserve      | Rigid-panel fold study: `src/packs/dot-fold-study.js`, own `dot-fold-study` registry/help/sound/plan/thumb entries, `tests/dot-fold-study.spec.mjs`, `docs/handoff/DotFoldStudy.md`.                         | Node/npm, installed Playwright/Chromium, original panels/rotations, GitHub connection; no secrets.      | `node tools/check-packs.mjs`; `node tools/toy-plan.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-fold-study.spec.mjs tests/kit.spec.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" node tools/effect-clip.mjs .cache/dot-fold-study/clips --size=320 --secs=5 dot-fold-study`. Operator posts; Ryan reviews.      | Separate teaching toy inspired by origami thin-parts concern; no crane/joints/soft-body edits or claim of paper simulation. | `dot/fold-study` → draft on Splashery main                | 1–2 days            | Medium–high: solid panels and occlusion.                      |
| J11 reserve      | Thin Lorenz curves upgrade proposal: `docs/audits/dot-lorenz-thickness.md` and measurements/comparison captures in its audit folder; no recipe edit.                                                         | Node/npm, installed Playwright/Chromium, local baseline, GitHub connection; no secrets.                 | `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" node tools/effect-clip.mjs .cache/dot-lorenz/clips --size=320 --secs=5 lorenz`; `python3 -m json.tool docs/audits/dot-lorenz-thickness/measurements.json`. Operator supplies proposed references for Ryan.                                                                                               | BACKLOG quality follow-up; respect frozen math/Sharpness ownership, propose only.                                           | `dot/lorenz-thickness-proposal` → draft on Splashery main | 4–6 hours           | Low–medium: captures are not an implemented repair.           |
| J12 reserve      | Blender-to-PLY calibration: `tools/dot-mesh-calibration.py`, `docs/audits/dot-mesh-calibration.md` and small audit previews; GLB/PLY in `.cache/dot-mesh-calibration/`.                                      | Provisioned Blender, Node/model CLI, GitHub connection; no external assets/secrets.                     | `blender --background --python tools/dot-mesh-calibration.py -- --out .cache/dot-mesh-calibration`; `node tools/model-to-splats.mjs .cache/dot-mesh-calibration/calibration.glb --seed 7 --splats 20000 --out .cache/dot-mesh-calibration/calibration.ply`; Blender command with `--verify`. Owner checks reference comparisons; no effect change. | Original cube/cylinder/thin ring; no models/assets manifest change or bulk asset conversion.                                | `dot/mesh-calibration` → draft on Splashery main          | 4–8 hours           | Medium: converted mesh is not a trained capture.              |
| J13 reserve      | Original colored-block training-view starter: `tools/dot-training-views.py`, `docs/audits/dot-training-views.md`, audit manifest/contact sheet; views in `.cache/dot-training-views/`.                       | Provisioned Blender/Python, CPU renderer, GitHub connection; no trainer/CUDA/rental/secrets.            | `blender --background --python tools/dot-training-views.py -- --out .cache/dot-training-views`; repeat with `--verify`; `python3 -m json.tool docs/audits/dot-training-views/manifest.json`. Owner checks coverage; no effect change.                                                                                                              | Fidelity preparation on a separate scene; no boombox/orrery/`tools/fidelity/` edit or trained SOG claim.                    | `dot/training-view-starter` → draft on Splashery main     | 4–8 hours + renders | Medium: training quality unverified.                          |
| J14 reserve      | Science redistribution audit: `docs/audits/dot-science-licenses.md` and `.json` for current crystal/localization sample sources; no new datasets copied.                                                     | Browser, public source/supplement access, Node/Python, GitHub connection; no paid portal/secrets.       | `python3 -m json.tool docs/audits/dot-science-licenses.json`; `node tools/check-packs.mjs`. Check identity, dataset terms, citation, redistribution/derivatives individually. No effect change.                                                                                                                                                    | Science-owned paths read-only; unavailable terms unverified, never assumed permitted.                                       | `dot/science-license-audit` → draft on Splashery main     | 4–8 hours           | Medium: paper/code license does not establish dataset rights. |
| J15 reserve      | Physical-properties uncertainty companion: `docs/audits/dot-material-uncertainty.md` and `.json` covering temperature, surface pairs, ranges, and methods for task 11.                                       | Browser, available primary papers/standards, Python/Node, GitHub connection; no purchases/secrets.      | `python3 -m json.tool docs/audits/dot-material-uncertainty.json`; independently verify every unit/conversion and source scope. No effect change.                                                                                                                                                                                                   | Additive task 11 companion, not competing material data; no `src/physics/materials.js` or existing task-output edits.       | `dot/material-uncertainty` → draft on Splashery main      | 4–8 hours           | Medium: context-dependent measurements.                       |
| J16 reserve      | Only `tests/dot-ply-input.spec.mjs`; generated tiny valid and malformed PLY fixtures inside the test.                                                                                                        | Node/npm/Playwright, installed Chromium for V0, GitHub connection; no data downloads/secrets.           | `node --check tests/dot-ply-input.spec.mjs`; `SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-ply-input.spec.mjs`. Finite/bounds/error cases missing from current coverage; no effect change.                                                                                                                               | Read `src/video3d/ply.js` and current tests; stop if expected behavior is unspecified or already covered. No parser repair. | `dot/ply-input-tests` → draft on Splashery main           | 3–5 hours           | Medium: malformed-input contract or discovered bug.           |
| J17 reserve      | Render-budget graph proposal: `docs/audits/dot-render-budget-template.md` and `.grooph.json`; tool check → small render → coverage check → human capacity decision → stop.                                   | Installed Grooph CLI, public read-only docs, Node/npm, GitHub connection; no secrets.                   | `grooph validate docs/audits/dot-render-budget-template.grooph.json --json`; `python3 -m json.tool docs/audits/dot-render-budget-template.grooph.json`. Ryan reviews; graph not run.                                                                                                                                                               | Explicit iterations/minutes; missing tools or excess projected work stop before scale. No GPU-rental/spending node.         | `dot/render-budget-template` → draft on Splashery main    | 3–4 hours           | Low: budget estimate, not runtime guarantee.                  |
| J18 reserve      | One-test-file graph proposal: `docs/audits/dot-test-file-template.md` and `.grooph.json`; gap evidence → sole-file builder → allowlist check → fresh critic → draft handback.                                | Installed Grooph CLI, public read-only docs, Node/npm, GitHub connection; no secrets.                   | `grooph validate docs/audits/dot-test-file-template.grooph.json --json`; `python3 -m json.tool docs/audits/dot-test-file-template.grooph.json`. Ryan reviews; graph not run.                                                                                                                                                                       | Production defects remain handback findings, never broader writes. No Grooph registry/install edits.                        | `dot/test-file-template` → draft on Splashery main        | 3–4 hours           | Low: needs a proven gap/contract first.                       |

## Why these eight

J05 and J06 have the smallest write surface and concrete gaps: the existing model CLI coverage is a
GLB smoke, while photoreal tests check NC classification's positive path. J02, J03, and J04 create
reusable prerequisites without taking a live lane's runtime files. J07 and J08 make custody/review
explicit without changing Grooph. J01 is the one visible implementation: a separate pack needs no
unfinished hands-on engine. Dispatch it last because owner motion review remains necessary.

Kenney's Impact Sounds page identifies the pack as CC0; the worker must inspect selected files. USGS
documents GeoJSON coordinate order/depth, but distinguishes its own public-domain work from
third-party material. Torus-knot parameters must be coprime; use an original implementation rather
than copied Wolfram data or software.
[Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds),
[USGS GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php),
[USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits),
[Wolfram KnotData](https://reference.wolfram.com/language/ref/KnotData.html).

## Eight ready-to-paste briefs

Paste one as Ryan's assignment after the Operator reserves its paths and provisions the execution
route. Missing prerequisites produce a precise BLOCKED handback instead of a question, scope
expansion, or unapproved delegated task. A worker does not accept its own visible effect or adopt a
template into Grooph.

### J01 — Knot inspector

```text
Ryan assigns this bounded job to Dot, an exception to CLAUDE.md's lane model pins for this job only. Build a new labs kit recipe, knot-inspector, with coprime torus-knot presets (2,3), (2,5), and (3,4). On tap, a small tracer travels continuously around the closed strand and returns to rest; the strand stays solid and unchanged. Controls select preset and strand thickness. Help explains crossings and that this is a mathematical curve, not physical rope simulation. Use original equations/geometry; check https://reference.wolfram.com/language/ref/KnotData.html for the parameter restriction without copying its data, examples, images, or code.

Use an isolated Splashery checkout from current main on dot/knot-inspector. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, docs/PACKS.md, docs/BACKLOG.md, and relevant kit recipes/tests. Confirm the Operator has reserved the pack/entries. If ownership overlaps, tools/access are absent, or direct Dot execution cannot complete the job, return BLOCKED with the exact missing item. No questions, Work/Codex delegation, compute rental, secrets, or security-setting changes.

Allowed: new src/packs/dot-knots.js, tests/dot-knots.spec.mjs, assets/toys/knot-inspector/thumb.webp, docs/handoff/DotKnots.md, tests/screenshots/dot-knots-390x844.png, tests/screenshots/dot-knots-1440x900.png; only this toy's new entries in src/toys.js, src/toy-help.js, src/toy-sounds.js, tools/toy-plan.json; regenerate docs/TOY-PLAN.md with node tools/toy-plan.mjs. Use category key `maths` and a separate dot-knots pack. No existing knot/torus-knot/math recipes, engine, shared sound, other registry, existing-test, tests/taps.spec.mjs, package, operating, or review-document edit. No new shelf/global UI. American English, existing kit API, deterministic seeds, labs only. No downloaded asset, dependency, logo, brand, or insignia. Original geometry needs no third-party asset credit; cite mathematical facts in the handoff.

Preflight node --version, npm ci, and test -x "$SPLASHERY_CHROMIUM" using installed Chromium; never playwright install. Run node tools/check-packs.mjs dot-knots; node tools/toy-plan.mjs; SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-knots.spec.mjs tests/kit.spec.mjs. Test closed curves, finite geometry, determinism, every preset on low/max tiers, option persistence, tap continuity, and return to rest. Define preset IDs trefoil, cinquefoil, torus34. Capture each full phone-size clip with SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" node tools/effect-clip.mjs .cache/dot-knots/clips/trefoil --size=320 --secs=5 --opt=preset=trefoil knot-inspector, repeating in distinct folders for the other IDs. Capture this toy at 390x844 and 1440x900 into the two allowed screenshots. Make only this toy's thumbnail with existing tools, enabling labs in the browser context as needed without editing tools. Run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" node tools/contact-sheet.mjs .cache/dot-knots/contact.png knot-inspector and inspect it.

Before push run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test, npx prettier --check ., node tools/us-english.mjs --diff, and git diff --check. Restore only tracked screenshots regenerated by tests in this clean checkout; keep new evidence in .cache. Compare the final changed-path list to the allowlist. A failed check never authorizes a protected-file fix.

Open exactly one draft PR against Splashery main titled "Dot: knot inspector", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. Hand back branch/PR/commit, commands/results, thumb/clip paths, and limitations in docs/handoff/DotKnots.md. Only the Operator posts clips to private Effect review; Ryan judges full motion before acceptance. Do not post, publish, mark ready, merge, release, or change Grooph. Size: 1–2 days; medium registry/visual risk.
```

### J02 — CPU material reference renders

```text
Ryan assigns this bounded job to Dot, a model-policy exception for this job only. Render original Blender spheres and beveled cubes in matte ceramic, brushed metal, and clear glass: three views per shape/material, 18 PNGs total, 512 by 512, CPU Cycles, 32 samples, fixed lights/seed/transforms. Label shader settings as visual references, not measured friction, restitution, or physical truth. Produce a contact sheet and reproducibility manifest, not a trained splat or toy.

Use an isolated Splashery checkout from current main on dot/material-renders. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, docs/PACKS.md and existing Blender/asset builders read-only. Confirm the Operator reservation. Preflight blender --version and python3 --version, then a tiny CPU smoke render. Dot's native Blender/installation rights are unconfirmed: use a provisioned executable. Missing tool/access/ownership or direct execution means BLOCKED with evidence, without questions, Work/Codex fallback, security/package changes, GPU rental, spending, or secrets.

Commit only tools/dot-material-renders.py, docs/audits/dot-material-renders.md, and docs/audits/dot-material-renders/ containing manifest and preview PNGs (at most 2 MB combined). Raw .blend/full PNGs go in ignored .cache/dot-material-renders/. No wd-*, tools/fidelity/, runtime, manifests, registry, tests, tests/taps.spec.mjs, package, operating, or Grooph edits. Original geometry/materials only; no downloaded textures, brands, logos, or insignia. American English. Cite https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html and https://www.blender.org/about/license/; Blender's license does not establish third-party asset rights.

Implement --out, --previews, --verify. Run blender --background --python tools/dot-material-renders.py -- --out .cache/dot-material-renders --previews docs/audits/dot-material-renders. Repeat with --verify to check 18 nonempty decoded images, dimensions, finite transforms, complete camera/material coverage, CPU settings, version, and hashes against the manifest. Run python3 -m json.tool docs/audits/dot-material-renders/manifest.json. Verify repeatable scene parameters and record image differences; do not demand cross-version byte identity.

For repository checks preflight Node/npm and installed Chromium; never playwright install. Before push run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test, npx prettier --check ., node tools/us-english.mjs --diff, and git diff --check. Restore only tracked screenshots regenerated by testing in this clean checkout, verify the allowlist, and report unavailable/failed checks honestly.

Open exactly one draft Splashery-main PR titled "Dot: CPU material references", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. The audit records commands, version, CPU timing, manifest, contact sheets, custody, raw locations, and limitations. Ryan reviews contact sheets for usefulness; no effect change or Effect review posting. Stop at draft handback: no mark-ready, merge, publishing, release, Grooph change, or billed fallback. Size: 4–8 hours plus renders; medium environment risk.
```

### J03 — Impact-sound candidates

```text
Ryan assigns this bounded data job to Dot, a model-policy exception for this job only. Shortlist 12 distinct short impact sounds for future wood, metal, glass, and soft-object contacts, three useful candidates per group when actual files support it. Start at https://kenney.nl/assets/impact-sounds, inspect the download/license, and preserve source filenames. Do not invent a material identity from ambiguous filenames: distinguish listening-based suggestions from source claims and report coverage gaps. This is not a replacement tap soundtrack.

Use an isolated Splashery checkout from main on dot/impact-sounds. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, tools/sound-sources.json, tools/sound-lint.mjs and src/toy-sounds.js read-only. Confirm the Operator reservation. Preflight node --version, ffmpeg -version, ffprobe -version, public downloads, and GitHub permissions. Use provisioned tools. Missing tool, unclear rights, overlap, or unavailable direct Dot execution means BLOCKED, without questions, Work/Codex fallback, installs, security changes, spending, or secrets.

Commit only docs/audits/dot-impact-sounds.md, docs/audits/dot-impact-sounds.json, tools/dot-impact-sounds-check.mjs. Originals/audition WAVs stay in ignored .cache/dot-impact-sounds/. No shipped audio; no sound-source/review catalog, runtime, toy/sound/credit registry, LICENSES.md, test, tests/taps.spec.mjs, package, operating/review-page, or Grooph edit. Confirm CC0 from the actual pack license, not unrelated website terms. American English and opened citations; no brands, logos, or insignia.

Each record includes stable ID, source/download URLs, author, exact license reference, access date, archive/original SHA-256, source filename/path, rate/channels/duration, suggested group, listening note, derivative recipe, audition path/hash, uncertainty. Make at most one-second auditions with documented trimming/mono normalization, conservative peak target, and unchanged originals; peak alone does not establish equivalent loudness. Listen to every original/audition and reject silent, clipped, or misleading files rather than filling the quota with duplicates.

Implement and run node tools/dot-impact-sounds-check.mjs --cache .cache/dot-impact-sounds to verify 12 unique records, hashes, ffprobe decoding, finite durations, audition format/length, and complete source/license fields; missing files/malformed records must fail. Run python3 -m json.tool docs/audits/dot-impact-sounds.json. For standing repository checks use provisioned npm/Chromium, never playwright install; run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test, npx prettier --check ., node tools/us-english.mjs --diff, git diff --check. Restore only tracked test-generated screenshots in the clean checkout and prove the three-file diff; report failed/skipped checks.

Open exactly one draft Splashery-main PR titled "Dot: impact-sound candidates", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. Record licensing evidence, counts/gaps, cue coverage, cache paths, audition instructions, and verification. If fewer than 12 valid candidates exist, expose the gap instead of claiming completion. Ryan auditions before later sound-lane integration. No current effect change or review-page posting; no mark-ready, merge, publishing, release, or Grooph change. Size: 3–6 hours; low–medium source/selection risk.
```

### J04 — Frozen earthquake data

```text
Ryan assigns this bounded data job to Dot, a model-policy exception for this job only. Prepare a dated static prerequisite for the live-earthquake backlog idea. Fetch one USGS GeoJSON summary feed documented at https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php; record exact URL, UTC fetch time, response metadata and SHA-256. Preserve the untouched response in .cache/dot-earthquakes/. Select at most 100 records deterministically by descending event time then ID. No live API, globe recipe, physics, or production fetch.

Use an isolated Splashery checkout from main on dot/earthquake-data. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, docs/BACKLOG.md and Science conventions read-only. Confirm the Operator reservation. Preflight Node, public HTTPS and GitHub permissions. Missing tools/access, overlap, or unavailable direct execution means BLOCKED, without questions, Work/Codex fallback, API keys/secrets, paid services, or security changes.

Commit only docs/audits/dot-earthquakes.md, docs/audits/dot-earthquakes.json, tools/dot-earthquake-check.mjs. No assets, runtime, registries, Science/Worlds/physics, existing tests, tests/taps.spec.mjs, package, operating, or Grooph edits. American English and opened citations. Check https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits and establish USGS authorship before redistributing records: a feed host/network code alone does not prove every contribution is public domain. Exclude uncertain third-party material. If rights cannot be established, return an empty blocked manifest/report, not unverified data.

Store event ID, event/updated UTC times, nullable magnitude/type, longitude degrees, latitude degrees, depth kilometers, status, network, event URL, provenance. Preserve null as unknown, never zero. Respect longitude/latitude/depth order, retain negative depths rather than clamping, and distinguish snapshot date from event dates. Record units and selection/exclusion rules. No hazard forecast or safety recommendation.

Implement and run node tools/dot-earthquake-check.mjs docs/audits/dot-earthquakes.json to check schema, unique IDs, finite present numbers, coordinate ranges, UTC times, at-most-100 size, ordering, units/provenance, and raw-hash correspondence if cache is available. Run node tools/dot-earthquake-check.mjs --self-test with valid/null records, swapped/out-of-range coordinates, duplicates and bad timestamps; keep self-tests in the new checker. Run python3 -m json.tool docs/audits/dot-earthquakes.json. Distinguish a blocked empty dataset from a usable completed sample.

Before push use provisioned npm/Chromium; never playwright install. Run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test, npx prettier --check ., node tools/us-english.mjs --diff, git diff --check. Restore only tracked screenshots regenerated by tests in this clean checkout; prove the three-file diff and report failed/unavailable checks.

Open exactly one draft Splashery-main PR titled "Dot: frozen earthquake sample", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. Include counts, provenance, exclusions, fetch/check receipts, raw location, and limitations. No current effect review; a future toy requires Operator-posted clips and Ryan's acceptance. Stop at draft handback; no mark-ready, merge, release, publishing, or Grooph change. Size: 3–6 hours; medium provenance risk.
```

### J05 — Model CLI tests, one file

```text
Ryan assigns this bounded test job to Dot, a model-policy exception for this job only. Extend tools/model-to-splats.mjs CLI coverage beyond tests/stm.spec.mjs's GLB smoke. Use synthetic OBJ+MTL, ASCII/binary STL, tiny external-buffer glTF; cover --out, --seed, --up, --no-light and missing/unreadable input. Establish expectations from production code/docs; do not invent undocumented validation rules.

Use an isolated Splashery checkout from main on dot/model-cli-tests. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, tools/model-to-splats.mjs, src/packs/studio-models-core.js and tests/stm.spec.mjs. Confirm the Operator reservation. Preflight node --version and npm ci with unchanged lockfile. Missing prerequisites/ownership/direct execution means BLOCKED, without questions, Work/Codex fallback, secrets, security changes, or unrelated installs.

The committed diff is exactly one new file: tests/dot-model-cli.spec.mjs. No production, existing-test, tests/taps.spec.mjs, fixture, doc, package, manifest, screenshot, operating, or Grooph edit. Original fixture strings/bytes live in the test; use fs.mkdtempSync in OS temporary directories and clean in finally. No downloaded model, external asset license, logo, brand, or insignia. American English. Child processes have bounded timeouts and no shell/public network.

Execute the real CLI. Independently parse output PLY header/payload: vertex/property counts, exact byte length, finite values, justified radius/centering tolerances, unit quaternions, axis-up and material/no-light behavior on an asymmetric fixture. Same input/seed/options must give identical bytes in the same environment; changed seed affects positions. Missing/unreadable input exits unsuccessfully with useful diagnostics. Assert a splat cap, not an unsupported exact count. Do not mirror the converter algorithm to manufacture expected output.

Run node --check tests/dot-model-cli.spec.mjs and SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-model-cli.spec.mjs. The file needs no browser fixture/network. For the standing full-suite check preflight installed Chromium and run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test; never playwright install. Before push run npx prettier --check ., node tools/us-english.mjs --diff, git diff --check. Restore only tracked test-regenerated screenshots in this clean checkout and prove the one-new-file diff. A justified production failure goes in PR evidence; no production fix or weakened assertion.

Open exactly one draft Splashery-main PR titled "Dot: model CLI regression tests", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. The PR body is the entire handback: coverage gaps/contracts, commands/results, smallest defect reproduction, cleanup and one-file proof. No extra report. No effect change/Effect review posting; no mark-ready, merge, release, publishing, or Grooph change. Size: 3–5 hours; low–medium contract/bug risk.
```

### J06 — NC checker tests, one file

```text
Ryan assigns this bounded test job to Dot, a model-policy exception for this job only. Test failure paths and token boundaries of tools/nc-assets.mjs; tests/pr2.spec.mjs already covers real photoreal metadata and successful --check/--json. Do not duplicate it. These are operational classification tests, not legal clearance of real assets.

Use an isolated Splashery checkout from main on dot/nc-cli-tests. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, tools/nc-assets.mjs, tests/pr2.spec.mjs and manifest schemas read-only. Confirm the Operator reservation; preflight node --version and npm ci without lockfile edits. Missing access/tool/ownership/direct execution means BLOCKED, without questions, Work/Codex fallback, secrets, spending, security changes, or unrelated installs.

Commit exactly one new file, tests/dot-nc-cli.spec.mjs. Never edit checker, real metadata/credits, policy, existing tests, tests/taps.spec.mjs, fixtures, docs, screenshots, packages, operating files, or Grooph. Generate tiny synthetic manifests and minimal src/toys.js in OS temporary roots with package.json type module; copy the production checker byte-for-byte into each root's tools/nc-assets.mjs and assert those bytes match. This uses its actual relative-root behavior without changing real files. Clean every root in finally. Original synthetic records need no external assets; American English, no logos/brands/insignia.

Run actual CLI subprocesses with timeouts. Check status/stdout/stderr for untagged NC in assets.json and models.json separately, an NC credit without tagged matching record, wrongly tagged CC0, ND in asset/model/credit, valid tagged CC BY-NC and CC BY-NC-SA, case-insensitive separated NC/ND tokens, and unrelated substrings that must not match. Assert offending ID/reason, not an entire brittle error string. Check --json fields and toy associations for own-ID and URL users. Test only documented behavior; string classification does not establish permission/attribution.

Run node --check tests/dot-nc-cli.spec.mjs and SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test tests/dot-nc-cli.spec.mjs. This file needs no browser fixture/network. Preflight installed Chromium for SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test; never playwright install. Before push run npx prettier --check ., node tools/us-english.mjs --diff, git diff --check. Restore only tracked test-generated screenshots in this clean checkout; prove the single-new-file diff. Report justified failing cases without production fixes or weakened tests.

Open exactly one draft Splashery-main PR titled "Dot: NC checker failure-path tests", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. PR body is the full handback: gap/contract evidence, fixture isolation, commands/results, defect reproduction, diff proof. No extra report or effect change. No Effect review posting, mark-ready, merge, release, publishing, or Grooph change. Size: 2–4 hours; low operational risk.
```

### J07 — License-evidence graph proposal

```text
Ryan assigns this bounded proposal job to Dot, a model-policy exception for this job only. Propose a Grooph template: source researcher produces immutable source/rights evidence; completeness check filters it; fresh critic independently inspects opened terms/provenance; human gate judges rights sufficient for later integration; stop hands back draft artifacts. Inaccessible/ambiguous/unlicensed sources cannot pass. Do not run the graph, agents, merge, publish, spend, or download credentialed material.

Use an isolated Splashery checkout from main on dot/license-evidence-template. Read its AGENTS.md, CLAUDE.md, docs/OPERATING.md and docs/WORKSTREAMS.md; confirm the Operator reservation. Read Grooph README, docs/graph-ir.md, docs/templates.md, patterns/review-gate.grooph.json and patterns/metric-sandwich.grooph.json read-only at https://github.com/ryanjosephkamp/grooph, recording the commit. Grooph's implemented target is Claude Code; Codex is planned, not a Dot runtime. Use supported schema/target values; manual Dot use is a proposal, not functioning compilation.

Commit only docs/audits/dot-license-template.md and docs/audits/dot-license-template.grooph.json in Splashery. No Grooph mutation, patterns/registry, issue/PR, settings/hooks, ~/.grooph or ~/.codex edits. No runtime/test/tests/taps.spec.mjs/package/license/operating edits. No secrets, copied datasets, brands/logos/insignia; American English and opened citations. Preflight installed grooph --version, Node/npm, GitHub access. Missing CLI/schema/access/reservation/direct execution means BLOCKED, without questions, global install, Work/Codex fallback, spending, or security changes.

Create a template block with task, output-path, source-manifest and acceptance-checklist slots. Distinguish template from instantiated graph. Researcher/checker/critic have separate output ownership; critic has fresh context, evidence, write-outputs and needed command permissions, but denies edit-files. Any retry loop has at most three iterations and a reachable dispatch budget. Route invalid evidence explicitly; unknown rights/missing inputs reach a blocked stop. Human approval means rights/adoption review, not merge permission. Explain bars, caps, custody, license layers and a concrete filled example in Markdown. Start no subagents.

Run grooph validate docs/audits/dot-license-template.grooph.json --json and python3 -m json.tool docs/audits/dot-license-template.grooph.json. Through the installed CLI's documented template commands, instantiate with example values into an OS temporary directory and validate that filled graph; do not register, export, or run it. Report warnings accurately; unsupported Dot compilation is not permission to invent schema fields.

For standing Splashery checks use provisioned npm/Chromium; never playwright install. Run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test, npx prettier --check ., node tools/us-english.mjs --diff, git diff --check. Restore only tracked test-regenerated screenshots in this clean checkout; prove the two-file diff and report unavailable/failed checks.

Open exactly one draft Splashery-main PR titled "Dot: license-evidence template proposal", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. Hand back proposal/graph, pinned sources, template/filled-example validation, and limitations. Ryan decides Grooph adoption. No current effect change/review posting; no mark-ready, merge, publishing, release, or Grooph change. Size: 3–5 hours; low proposal risk.
```

### J08 — Toy-effect review graph proposal

```text
Ryan assigns this bounded proposal job to Dot, a model-policy exception for this job only. Propose a Grooph template: owner-reserved kit builder produces recipe/full phone-size clips; deterministic check verifies scope/budgets/tests; fresh motion critic compares full clips with a written visual bar; Operator handoff supplies clips for private Effect review; Ryan accepts/rejects the effect; stop hands back the draft. Tests cannot substitute for Ryan's judgment. Workers never post/publish review clips.

Use an isolated Splashery checkout from main on dot/toy-review-template. Read AGENTS.md, CLAUDE.md, docs/OPERATING.md, docs/WORKSTREAMS.md, docs/PACKS.md and effect-clip tool read-only; confirm the Operator reservation. Read Grooph README, docs/graph-ir.md, docs/templates.md, patterns/metric-sandwich.grooph.json and patterns/review-gate.grooph.json read-only at https://github.com/ryanjosephkamp/grooph; pin the commit. It is an authoring/compiler surface with a Claude Code target; do not claim a working Dot/Codex compile target or Dot runtime.

Commit only docs/audits/dot-toy-review-template.md and docs/audits/dot-toy-review-template.grooph.json in Splashery. No toy/engine/registry/test/tests/taps.spec.mjs/package/operating/review-page/hook/~/.codex/~/.grooph change. No Grooph mutation, issue, PR, graph execution or subagent creation. American English, opened citations, original examples; no downloaded assets, logos/brands/insignia, secrets, or dependencies. Preflight installed grooph --version, Node/npm, GitHub access. Missing tool/reservation/direct execution means BLOCKED, without questions, install/security changes, spending, or Work/Codex fallback.

Use template slots for toy brief/ID, allowed paths, exact test command, visual checklist/reference, full clip paths and Operator handoff. Builder/critic have separate outputs; critic is fresh, sees immutable build/clip/test evidence, writes its report, cannot edit recipes. Separate machine and motion bars. Motion bar rejects bending solid objects, smear/speckle, invisible working parts, and missing return to rest. Failed clip decoding or missing owner mark is missing evidence, never success. Operator posting is a human handoff, not worker permission. Acceptance ends at stop, never automatic merge/release. Bound repairs at three iterations with a reachable dispatch budget; retain unresolved findings at the cap.

Run grooph validate docs/audits/dot-toy-review-template.grooph.json --json and python3 -m json.tool docs/audits/dot-toy-review-template.grooph.json. Instantiate an example through documented installed-CLI commands in an OS temporary directory and validate it; report warnings. Do not register/export/run it. Markdown explains graph shape, distinct pass conditions, evidence-to-commit linkage, sample handback and manual Dot-use limitations, not a claimed executed acceptance.

Before push use provisioned npm/Chromium and run SPLASHERY_CHROMIUM="$SPLASHERY_CHROMIUM" npx playwright test, npx prettier --check ., node tools/us-english.mjs --diff, git diff --check; never playwright install. Restore only tracked test-generated screenshots in this clean checkout; prove two-file scope and report blocked/failed checks.

Open exactly one draft Splashery-main PR titled "Dot: toy-effect review template proposal", with Summary, Verification, Deviations, Known issues, What was cut; identify Dot in Summary. Hand back proposal/graph, pinned references, validation and limitations. Ryan decides Grooph adoption. No actual toy effect/review posting; no mark-ready, merge, publishing, release, or Grooph change. Size: 3–5 hours; low–medium acceptance-model risk.
```

## Report verification and limits

This task changes only this report and `docs/codex/README.md`. Candidate commands are future
acceptance commands, not receipts. No Dot environment was connected/tested, no candidate built, and
no Grooph graph run. The report checks passed: `npx prettier --check .`,
`node tools/us-english.mjs --diff` (including the staged report), and `git diff --cached --check`.
Structural checks found seven summary lines, 18 candidate rows, eight fenced briefs, and valid
README anchors/local links. No candidate acceptance command was run. The standing full Playwright
check was blocked before execution: `/opt/pw-browsers/chromium` is absent, and the existing
port-4173 server serves the preserved `codex/test-health` checkout rather than this main-based
report checkout. It was left running; using it would not verify this branch. The PR records this
deviation.

The first suggested handoff is J06, then J05, provided direct Dot execution supplies shell and
GitHub operations. A failed preflight yields a blocker, not a claim that delegated Codex work
completed without consuming its normal allowance.
