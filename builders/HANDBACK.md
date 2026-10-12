# Handback

How to hand work back: the branch, the pull request, the proof, and the record. Rules E1 to E3 are
behind all of it ([RULES.md](RULES.md)): your own branch, draft pull requests only, never merge, and
report honestly.

## Branch and pull request

- **One task per branch.** Name it `codex/<task>-<slug>` or `dot/<task>-<slug>`, for example
  `codex/t4-kit-cleanup` or `dot/t3-gem-remake`. Cut it from the current `main`.
- **A draft pull request** against `ryanjosephkamp/splashery` (or against your own sandbox repo, if
  your task says so, or if the work breaks a rule in section D). Leave it a draft.
- **You never merge.** Not your pull request, not anyone's. Never push to `main`, force-push, or
  rewrite history. The Operator and the owner merge.
- **When main moves,** merge it into your branch. Never rebase a pushed branch.
- Change only what the task says. Reports go in `docs/audits/`, experiments in `workshop/`.
- Title: `<Task id>: <what it does>` (for example "T4: kit cleanup, no behavior change"). Say in the
  Summary which agent and model built it ("made by Ryan with <agent and model>", Rules B4).

## The pull request body

Five sections, in this order, then a rule check and the record:

```md
## Summary

What changed and why, in a few short sentences. Say which agent and model built it.

## Verification

What ran and what it showed (the proof list below). Say what ran in a real browser, what was mocked,
and what you didn't measure.

## Deviations

Anything you did differently from the task, and why.

## Known issues

What is still wrong, rough, or untested.

## What was cut

What the task asked for that you didn't do, and why.

Rule check: none <or: the rules it touches, as in "The hand-back rule" below>

## Record

<the record, below; or a link to record.md in the branch>
```

## The hand-back rule

When a task would break a rule in [RULES.md](RULES.md):

- **A rule in A, B, or C:** stop before you build anything that breaks it. Hand back with a "Rule
  check" note that names the rule, says why the task needs to break it, and offers options.
- **A rule in D:** you may build it in your sandbox (your own repo or branch), clearly marked as
  breaking that rule, and hand back with the same note. It never goes into Splashery until the owner
  decides.
- **A rule in E:** always applies. There is no exception.

Every handback says "Rule check: none" or lists the rules it touches, in this form:

```md
Rule check: B1 (the only source for the scan is under a "personal use" license). Why the task needs
it: the owner asked for this exact object. Options: (1) use the CC0 model from <page> instead; (2)
ask the creator for a CC BY grant; (3) drop the toy.
```

## The proof

Attach what shows the work does what you say:

1. **The checker's output**, once `tools/port-check.mjs` exists (coming with the Baked engine PR);
   until then, the hand checks listed in [TOY-PACKAGE.md](TOY-PACKAGE.md), "Checking a package".
2. **The real-browser test run**: the specs for the area you touched, and for any change under
   `src/`, `smoke`, `kit`, `taps`, `help`, `hta`, and `unit`
   (`node tools/suite.mjs --files=smoke,kit,taps,help,hta,unit`), with the pass and fail counts.
   Keep "embed transfer ≤ 30 MB" green. Say which specs you ran and which you couldn't.
3. **The pre-push checks**: `npx prettier --check .` and `node tools/us-english.mjs --diff`, clean
   (see [SETUP.md](SETUP.md), section 6).
4. **Screenshots at 390×844 and 1440×900** of every new or changed toy (and of a new page).
5. **A clip per effect**, made with `tools/effect-clip.mjs`, at phone size. Watch each one before
   you attach it. Effects are judged as motion, never as stills (the bar in
   [KIT-GUIDE.md](KIT-GUIDE.md)).
6. **Licenses**: `node tools/nc-assets.mjs --check` if you touched the asset lists.

A **mock is not a measurement.** If a number came from a mock, a calculation, or a guess, say so.

## The record

One record per task, in `record.md` (or in the pull request body). Copy this template and fill in
every section. Write "none" or "unmeasured" rather than leaving a section empty.

```md
# Record: <task id>, <slug>

## Identity and status

- Task: <T-number and title>
- Toy or project id: <id, or "none" for a report>
- Branch and pull request: <branch>, <PR link>
- Made by: <agent and model>, on <date> ("made by Ryan with <agent and model>", Rules B4)
- Status: proposed | implemented | reviewed | accepted | held (you set "proposed" or "implemented";
  the Operator and the owner set the rest)

## The recipe contract

- Hooks used: <build, drive, controls, action, prepare, …>
- Units: <for example "recipe units, +Y up; the kit scales the toy to a sphere of radius 0.95">
- Axes and pivots: <each part's pivot and axis>
- Part ids: <the ids, and what each moves>
- Quaternion order: <x, y, z, w as the kit uses; or "no quaternions">
- Host APIs used: <the Kit and engine functions the recipe calls>

## Generation

- Command: <the exact command or steps that made the assets>
- Environment: <OS, machine, container>
- Versions: <Blender, Python, Node, and every tool; and their licenses if new (LICENSES.md)>
- Seed: <the seed, or "none, deterministic">

## Assets and licenses

| File | sha256 | Source page | Author | License | Date checked | Changes |
| ---- | ------ | ----------- | ------ | ------- | ------------ | ------- |

(One row per file or source. "Original, CC0, made by Ryan with <agent and model>" for your own.)

## Boundaries

- Reused: <what already existed and was used as is>
- New: <what this task added>
- Not simulated: <what looks like physics or behavior but is only animated, faked, or baked>

## Executed evidence

| Check                      | How it ran                                                 | Result   |
| -------------------------- | ---------------------------------------------------------- | -------- |
| <for example "tap effect"> | real browser (Chromium via Playwright) / mock / unmeasured | <result> |

(Say for each: a real browser run, a mock, or unmeasured.)

## Performance

- Splat counts and bytes per tier: <numbers, or "unmeasured">
- Load time, memory, and frame rate at each budget: <measured numbers with the device, or
  "unmeasured">
- Compared with: <the baseline, if any>
```

The record is the owner's way to judge a task without rerunning it, so a measured number needs the
device and the method, and an unmeasured one says "unmeasured".

## Last, before you stop

- The pull request is a draft, on your branch, and not merged.
- The body has the five sections, the rule check, and the record.
- Nothing in it is a secret, a token, or one of the owner's private notes (Rules C5, E3).
- American English with the serial comma in everything public (Rules E4).
- Then say so, in your final message: what is done, what ran, and what didn't.
