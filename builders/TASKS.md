# Tasks

The task catalog for outside builders. The owner starts you with one line:

> Read builders/README.md and builders/RULES.md in github.com/ryanjosephkamp/splashery, then do task
> <id> from builders/TASKS.md.

Find your task id below. Each task has a goal, the rules that matter most, what comes back, the
best-fit agent, and a prompt you can paste. Read [README.md](README.md) and [RULES.md](RULES.md)
first; every task obeys all of Rules v1, and "the rules that matter most" only names the ones this
task is most likely to bump into. Hand back as [HANDBACK.md](HANDBACK.md) says.

| Id  | Task                                                        | Best fit         |
| --- | ----------------------------------------------------------- | ---------------- |
| T1  | Performance pass, one shelf at a time                       | Codex            |
| T2  | Splat tiers for kit toys, chosen by Auto                    | Codex            |
| T3  | High-fidelity remakes of kit toys, Blender-baked (Workshop) | the Dot          |
| T4  | Code cleanup with no behavior change                        | Codex            |
| T5  | The known flaky tests' causes                               | Codex            |
| T6  | Smaller downloads                                           | Codex            |
| T7  | Photoreal sourcing (a list with records, no files)          | Codex            |
| T8  | New toy first drafts in the open shelves (Workshop)         | Codex or the Dot |
| T9  | Engine experiments, in the Workshop only                    | Codex            |
| T10 | Manual and site audits                                      | Codex            |
| T11 | The Workshop foundation                                     | Codex            |
| T12 | Flagship pilots: five proposals, one page each              | Codex or the Dot |

Every prompt below begins with the same opening, so each is self-contained:

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md.

---

## T1: Performance pass, one shelf at a time

**Goal.** Measure how fast a shelf's toys load and run, then make them faster without changing a
single frame. Pick one shelf (a `category` in `src/toys.js`, such as `gems` or `food`). For each toy
on it, measure the load time, the memory, and the frame rate at each budget (low, mid, high, and
max; the tiers are in `src/generators.js`, `PROFILES`). Then speed up the recipes and the loaders
(build time, allocations, file reads) and measure again.

**Rules that matter most.** D4 (it fits a phone; the "embed transfer ≤ 30 MB" test stays green), E2
(say what you measured in a real browser and how, and what you didn't), and the effect quality bar
(a faster toy looks the same: compare frames before and after).

**What comes back.** A pull request with the changes; a before-and-after table per toy and per
budget (the device, the method, and the numbers); proof that the output is unchanged (matching
screenshots or hashes of the built splat buffer for a fixed seed); the record with the Performance
section filled in with measured numbers. `node tools/check-packs.mjs <pack>` gives build times in
Node; the browser numbers need a real run.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T1 (performance pass) on the `<shelf>`
> shelf. Measure load time, memory, and frame rate for each toy at each budget, in a real browser,
> and write down the device and method. Speed up the recipes and loaders for that shelf without
> changing a frame: prove it by building each toy with a fixed seed before and after and comparing
> the splat buffers, and by comparing screenshots. Stay inside `src/packs/` and the shelf's own
> files; if an engine change would help, describe it in the PR instead of making it. Branch
> `codex/t1-<shelf>`. Hand back a draft PR with a before-and-after table per toy and budget, and the
> record.

## T2: Splat tiers for kit toys, chosen by Auto

**Goal.** Give kit toys proper splat-count tiers. A kit toy builds at the count the device's Auto
budget picks (`PROFILES` in `src/generators.js`); some toys look fine at the low tier and others
fall apart. Find, for a set of toys, the lowest count at which each still reads clearly and keeps
its effect, and the count above which more splats add nothing visible. Report a table of recommended
tiers per toy, and where a recipe's density or sizes need adjusting to hold up at the low tier, make
that change.

**Rules that matter most.** D4 (the Auto budget picks the tier for the device; size is guidance),
the effect quality bar (materials look real at every tier: no speckle, no see-through solids), E2
(renders at each tier are real-browser renders).

**What comes back.** A pull request with the table (toy, tier, count, a screenshot at 390×844, a
note), any recipe changes, a clip of each changed effect at the low tier, and the record. Don't
change the shared tier table in the engine; propose changes to it in the PR.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T2 (splat tiers for kit toys). Pick the
> `<shelf>` shelf. For each kit toy, render it at the low, mid, and high tiers in a real browser
> (`?profile=low`, `mid`, `high`, or `max` on the URL forces a tier; see tools/toy-shots.mjs), judge
> where it stops reading clearly, and recommend the tiers. Fix recipes that fall apart at the low
> tier (in `src/packs/` only). Don't edit the engine; propose engine changes in the PR. Branch
> `codex/t2-<shelf>`. Hand back a draft PR with the table, screenshots, a clip of each changed
> effect, and the record.

## T3: High-fidelity remakes of kit toys, Blender-baked, as Workshop packages

**Goal.** Take a kit toy that looks simple and remake it at high fidelity: model it in Blender
(procedurally where you can), bake it to splats, and keep the same tap effect with the same solid
moving parts. The point is to show how much better a baked toy can look than a kit one, inside the
rules. Pick toys on shelves that are open for new work (see TASKS T8 for the shelves), or one the
owner names.

**Rules that matter most.** A1 (no real firearms, logos, or brand names), A2 (no real person's
likeness), B2 and B4 (every asset has its record; your original assets are CC0 and credited "made by
Ryan with <agent and model>"), D1 (a Workshop project may ship bundled output only with its source
beside it), and the effect quality bar (parts move as solid pieces; never bend a scan).

**What comes back.** A toy package ([TOY-PACKAGE.md](TOY-PACKAGE.md)) under `workshop/<project>/`:
the recipe, the manifest, one set of files per tier, the record with the generation command,
versions and seed, the Blender file's source or script, screenshots at 390×844 and 1440×900, and a
clip of each effect. The package goes in a draft PR (or your sandbox repo); the owner picks which to
promote.

**Best-fit agent.** The Dot (Blender and procedural modeling).

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T3 (a high-fidelity remake) of the toy
> `<toy id>`. Model it in Blender, procedurally where you can, bake it to splats in tiers, and keep
> its tap effect with solid moving parts that match the original recipe in `src/packs/` (read it,
> and builders/KIT-GUIDE.md). Everything you make is original and CC0, credited "made by Ryan with
> <agent and model>"; use no outside asset unless its license is checked on the live page and
> recorded. Hand back a toy package per builders/TOY-PACKAGE.md under `workshop/<project>/` on
> branch `dot/t3-<slug>`, a draft PR, screenshots at 390×844 and 1440×900, a clip per effect, and
> the full record. The asset format and `tools/port-convert.mjs` come with the Baked engine PR;
> until it lands, hand back 3DGS `.ply` tiers and a per-splat part file, and say so.

## T4: Code cleanup with no behavior change

**Goal.** Clean up code in an area you choose (or the area the owner names): dead code, duplicated
helpers, unclear names, long functions, stale comments. No behavior change. Every test that passed
before still passes, and every toy builds the same splats from the same seed.

**Rules that matter most.** E1 (small, reviewable pull requests), D3 (old `#s=` links and saved
scenes keep loading), and never edit `tests/taps.spec.mjs`. Don't touch the shared lists beyond your
own lines, and leave other lanes' files alone unless the task names them.

**What comes back.** One or more small draft PRs (one area each), a list of what changed and why,
proof of no behavior change (the specs for the area, `smoke`, `kit`, `taps`, `help`, `hta`, `unit`,
and for a pack a before-and-after comparison of built splat buffers), and the record.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T4 (code cleanup, no behavior change)
> in `<area>`. Remove dead code and duplication, clarify names and comments, and keep every behavior
> identical: prove it with the specs for the area and `smoke,kit,taps,help,hta,unit`, and for a pack
> by building each toy with a fixed seed before and after and comparing the splat buffers. Keep each
> PR small and one area. Never edit `tests/taps.spec.mjs`. Branch `codex/t4-<area>`. Hand back draft
> PRs, what changed and why, the proof, and the record.

## T5: The known flaky tests' causes

**Goal.** Some tests fail now and then on plain `main` and pass when run alone. Find out why and fix
the cause. The list is in `docs/OPERATOR.md`, "Known flaky tests" (smoke, tpg, hl1, stm, fl7,
qrs-toys, live4, phy, ui4, wd, wdr3, smd-moving, hh5-gems, p3d), and
`docs/audits/test-health-2026-10.md` has earlier findings. A flake is a symptom: a race, a timeout
that is too tight for a slow machine, a shared state, or a real bug.

**Rules that matter most.** Never skip, disable, or quarantine a test to make it pass. Never edit
`tests/taps.spec.mjs`. E2 (a flake is not a root cause: show the cause, and show the test passing
many times), and D3.

**What comes back.** A pull request with one fix per root cause (a test or code change), for each:
the cause in plain words, the evidence (a reproduction that fails before and passes after, run with
`--repeat-each 8` or more, on a loaded machine if you can), and the record. Anything you can't fix
gets a written cause and a proposal.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T5 (the known flaky tests' causes).
> Start from the list in docs/OPERATOR.md, "Known flaky tests", and
> docs/audits/test-health-2026-10.md. For each test, reproduce the flake
> (`npx playwright test <file> --repeat-each 8`, and under load by running two files at once), find
> the root cause, and fix it in the test or the code. Never skip, disable, or quarantine a test, and
> never edit tests/taps.spec.mjs. Branch `codex/t5-<test>`, one draft PR per root cause. Hand back
> each cause in plain words with before-and-after repeat runs, and the record.

## T6: Smaller downloads

**Goal.** Make what visitors download smaller: better compression of splat and image files, lazy
loading of things that aren't needed at first paint, and fewer bytes per toy. Measure first: which
toys and which libraries cost the most, and which load before they are needed.

**Rules that matter most.** D4 (a default first load of 15 MB or less per toy; bigger tiers opt-in
up to about 40 MB; no single file over 20 MB; the "embed transfer ≤ 30 MB" test stays green), D1
(static files only; no bundler for the site), B3 (a new library needs a `LICENSES.md` entry, and one
over 2 MB goes to the owner first), and "no visible change" to the toys.

**What comes back.** A pull request per change, a byte table before and after (per toy and per
library, measured as the network transfer in a real browser), screenshots showing no visible
difference, and the record. A build tool you use is listed in `LICENSES.md` with its version and is
never shipped.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T6 (smaller downloads). First measure,
> in a real browser, the transfer size of each toy and each lazily loaded library, and list the
> biggest. Then reduce bytes without visible change: better compression, lazy loading, trimming
> unused data. Keep the site static (no bundler for the page), keep "embed transfer ≤ 30 MB" green,
> and list any new build tool in LICENSES.md (never shipped). Branch `codex/t6-<slug>`. Hand back a
> draft PR per change with before-and-after byte tables, screenshots showing no change, and the
> record.

## T7: Photoreal sourcing

**Goal.** Find real 3D captures and scans (photogrammetry, Gaussian splat captures, CT and other
open volumes) that Splashery could use for photoreal toys, on the shelves that are open for work.
Check each license on its live page. Hand back a list with a record for each candidate. **Download
nothing into the repo, and propose no files, until the owner approves a candidate.**

**Rules that matter most.** B1 (only CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, public domain, or
NASA 3D Resources with insignia removed; never ND, unlicensed, "personal use", paid, or scraped;
check the license on the live source page), B2 (the record), A2 (no real person's likeness) and A1
(no brand names or logos), and A3 (real data for photoreal and science: no AI-made pictures).

**What comes back.** A report in `docs/audits/<name>-<date>.md`: for each candidate, the title, the
source page, the author, the license (as shown on the live page, quoted), the date checked, the file
format and size, what the object is and which toy it could make, any condition (an NC flag, a BY-SA
notice, insignia to remove), and a recommendation. A short "rejected" list says why each was left
out. No asset files.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T7 (photoreal sourcing). Find CC0 and
> CC BY (and, with the flags the rules require, BY-SA and BY-NC) real 3D scans and captures that
> would make good photoreal Splashery toys on the open shelves. Open every source page and check the
> license on the live page; quote it and write the date. Never use ND, unlicensed, personal-use,
> paid, or scraped material, and download nothing into the repo. Write the list as
> docs/audits/photoreal-sources-<date>.md with a full record per candidate and a rejected list.
> Branch `codex/t7-<slug>`. Hand back a draft PR with the report and the record.

## T8: New toy first drafts in the open shelves

**Goal.** Write first drafts of new toys for the shelves that are open for new work: science, tools,
the Studio, codes (QR and barcodes), Space, Tiny world, atoms, math, and AI and computing. The owner
closed the other shelves (balls, food, nature, gems, medieval, holidays, music, Open me, animals,
and the cartoon vehicles); don't add toys there. A first draft is a working toy with its tap effect,
built as a Workshop package; a lane ports the ones the owner picks. Read `docs/TOY-PLAN.md` first,
so you don't duplicate a toy.

**Rules that matter most.** A1, A2, A3 (no AI-made pictures in science, math, or engineering toys),
B1 and B2 (every asset's record), B4 (credit), D5 (new areas open behind the labs switch), and the
effect quality bar (real motion with solid parts; the grape is the bar).

**What comes back.** A toy package per toy ([TOY-PACKAGE.md](TOY-PACKAGE.md)) under
`workshop/<project>/`: a recipe, a manifest, files if any, the record, screenshots at 390×844 and
1440×900, and a clip per effect, plus a one-paragraph pitch (what it teaches or shows, and what the
tap does). Don't edit `src/toys.js`, `src/toy-sounds.js`, or `src/toy-help.js`; the port does.

**Best-fit agent.** Codex or the Dot (the Dot for anything modeled in Blender).

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T8 (new toy first drafts) for the
> `<shelf>` shelf (one of: science, tools, Studio, codes, Space, Tiny world, atoms, math, AI and
> computing). Read docs/TOY-PLAN.md so you don't duplicate a toy, and builders/KIT-GUIDE.md and
> builders/TOY-PACKAGE.md. Build up to `<n>` toys as Workshop packages under `workshop/<project>/`,
> each with a real, physical tap effect with solid moving parts, screenshots at 390×844 and
> 1440×900, a clip per effect, and a record. Use only assets you made (CC0, credited "made by Ryan
> with <agent and model>") or whose licenses you checked on the live page and recorded. Branch
> `codex/t8-<slug>` or `dot/t8-<slug>`. Hand back a draft PR and the record.

## T9: Engine experiments, in the Workshop only

**Goal.** Try an engine idea without touching the engine: a new splat kernel, a faster sort, a
different way to draw or light splats, a physics solver, a streaming loader. Build it as a Workshop
project that imports Splashery's `src/` files by relative path and replaces nothing. Measure it
against the engine's own way, side by side (the Workshop's compare view, once it exists).

**Rules that matter most.** D2 (PlayCanvas stays the vendored 2.22.3, reached through `src/pc.js`),
D1 (a Workshop project may ship bundled output only with its source beside it), D4 (it must fit a
phone), E2 (measured, with the device and method, or "unmeasured"), and D3. **Don't edit anything in
`src/` or `vendor/`.**

**What comes back.** A Workshop project (README, record, source), a measured comparison with the
current engine (frame time, load time, memory, and the visual difference, on named devices),
screenshots at 390×844 and 1440×900, a clip, and a plain recommendation: promote, iterate, or drop.
If it should become an engine change, say what the small, additive "Engine: …" PR would be; don't
make it.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T9 (an engine experiment) for this
> idea: `<idea>`. Build it as a Workshop project under `workshop/<project>/` that imports
> Splashery's src/ files by relative path and changes nothing in src/ or vendor/. Measure it against
> the current engine's way in a real browser (frame time, load time, memory, visual difference; name
> the device and method; write "unmeasured" where you couldn't). Branch `codex/t9-<slug>`. Hand back
> a draft PR with the project, the comparison, screenshots at 390×844 and 1440×900, a clip, a
> recommendation, and the record.

## T10: Manual and site audits

**Goal.** Audit the Tinkerer's Manual (`manual/`) or the Splashery site (`site/`) the way earlier
audits did (see `docs/audits/`, for example `manual-audit-2026-10.md` and its round-two folder):
read it as a new reader, run its live demos, follow its links, and report what is wrong, missing,
unclear, or out of date, with a page and a quote for each. A report, not a rewrite.

**Rules that matter most.** E2 (cite every outside fact with a link you actually opened; say what
you couldn't check), C5 (no private notes in a public report), and E4 (American English with the
serial comma). Don't edit the manual or the site; report.

**What comes back.** A report in `docs/audits/<name>-<date>.md`: a short summary first (a few
lines), then findings sorted by how much they matter, each with the page, a quote, what is wrong,
and a suggested fix; screenshots at 390×844 and 1440×900 where layout matters; and a list of what
you could and couldn't check. The record.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T10 (an audit) of
> `<the manual | the site | a named part>`. Follow the format of the reports in docs/audits/. Read
> it as a new reader, run the live demos in a real browser, follow every link, and check every
> outside fact against a source page you actually opened. Report findings by importance with a page
> and a quote each, and say what you couldn't check. Don't edit the manual or the site. Write
> docs/audits/<name>-<date>.md. Branch `codex/t10-<slug>`. Hand back a draft PR with the report and
> the record.

## T11: The Workshop foundation

**Goal.** Build the Workshop's foundation: the index page, a project template, the labs-gated link,
the smoke test, and the compare view. The spec, with what each piece must do and what is left open,
is in [WORKSHOP.md](WORKSHOP.md), "The Workshop foundation".

**Rules that matter most.** D1 (static files; ES modules), D2, D5 (labs switch; labeled "Workshop:
experimental"), D3, and the engine rule: the link from the app touches engine files, so it goes in
its own small, additive "Engine: …" PR, merged first. The smoke test is the only test a Workshop
project gets in the main suite.

**What comes back.** Two draft PRs: "Engine: the labs-gated Workshop link" and "T11: the Workshop
foundation". The Workshop PR holds `workshop/` (the index page, `_template/`, `compare/`),
`tests/wks.spec.mjs`, and a README for the Workshop. Proof: the smoke test passing, screenshots at
390×844 and 1440×900 of the index and the compare view, a clip of the budget slider, and the record.

**Best-fit agent.** Codex.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T11 (the Workshop foundation). Read
> builders/WORKSHOP.md, "The Workshop foundation: a spec to build from", and build what it lists:
> the workshop/ index page, a project template folder, a link from the app and the site that shows
> only with the labs switch (its own small "Engine: …" PR), the smoke test tests/wks.spec.mjs, and a
> compare view with a budget slider and frame-rate and memory readouts. The design is open. Branches
> `codex/t11-workshop` and `codex/t11-workshop-engine`. Hand back two draft PRs, the smoke test run,
> screenshots at 390×844 and 1440×900, a clip of the slider, and the record.

## T12: Flagship pilots: five proposals

**Goal.** Propose five ambitious toys that show what Blender-baked, high-fidelity splats can do
inside the rules and the open shelves (science, tools, the Studio, codes, Space, Tiny world, atoms,
math, and AI and computing). One page each, for the owner to pick from **before anything is built.**
Each page says what the toy is, why it is a showpiece, what the tap does (real motion with solid
parts), how it would be made (Blender steps, sources, tiers), where the assets would come from and
under what license, the size and phone budget, and the risks. **Build nothing.**

**Rules that matter most.** A1, A2, A3 (no AI-made pictures in science or math toys), B1 and B2
(name each asset's source and license; check licenses on live pages), D4 (a phone budget), D5, and
C5 (no private notes). Pilots stay inside the rules; if one would break a rule, say which and offer
a version that doesn't.

**What comes back.** A report in `docs/audits/flagship-pilots-<date>.md`: a short summary table of
the five, then one page each (about 300 words, with a sketch or a reference image only if its
license allows), a recommendation of which to build first, and the record. No code, no assets.

**Best-fit agent.** Codex or the Dot.

**Prompt to paste.**

> You are building for Splashery, a browser toy box of 3D Gaussian splats
> (github.com/ryanjosephkamp/splashery). Read builders/README.md and builders/RULES.md first, then
> follow builders/SETUP.md and builders/HANDBACK.md. Do task T12 (flagship pilots). Propose five
> ambitious Splashery toys that show what Blender-baked, high-fidelity splats can do, on the shelves
> that are open for work, and stay inside the rules. Write one page each (what it is, why it is a
> showpiece, what the tap does with solid moving parts, how it would be made in Blender, where
> assets come from with licenses checked on live pages, the size and phone budget, and the risks),
> plus a summary table and a recommendation for the owner to pick from. Build nothing. Read
> docs/TOY-PLAN.md so you don't repeat a toy. Write docs/audits/flagship-pilots-<date>.md. Branch
> `codex/t12-pilots` or `dot/t12-pilots`. Hand back a draft PR with the report and the record.
