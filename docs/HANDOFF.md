# Handoff

Where Splashery stands, in short. The Operator session keeps this file; each lane keeps its own file
in [handoff/](handoff/). The ground rules are in [CLAUDE.md](../CLAUDE.md); how the parallel lanes
work is in [OPERATING.md](OPERATING.md).

## State of main (2026-09-26)

- Phases A to E4 are merged: A (splashery PR #13, homepage PR #33 in
  `ryanjosephkamp/ryanjosephkamp.github.io`), B (#17), C1 (#18), C2 (#19), D (#20), E1 (#21), E1b
  (#22–#24), E1c (#26–#28), E2 (#29–#31), E3 (#32) and E4 (#33, merged 2026-09-26). The owner
  approved everything from E3.
- The first parallel lanes all merged on 2026-09-26: E4-finish (#37), E6b (#36), E5 (#35) and E6a
  (#38). The owner approved every clip on the Effect review page, including the redone ones (the
  bananas, croissant and pretzel; the basketball's robot hand and the bowling ball). Summaries and
  known issues: [handoff/history.md](handoff/history.md), "Lanes".
- The shelf has 284 toys (30 scans, 4 shapes and 250 kit toys; with the protein toy). The plan
  (`tools/toy-plan.json`, [TOY-PLAN.md](TOY-PLAN.md)): 282 keep and 2 more (the puzzle cube and the
  bricks, lane F). Every planned new tap effect is built. Scene schema v3; v2 still loads.
- Every kit toy's tap is checked by `tests/taps.spec.mjs`; its known exceptions (with reasons) are
  listed at its top. The full suite has 147 tests.
- Locked (owner approved, do not change its look or behaviour): the laptop. Its smoke test guards
  it.

## Active lanes

The full table, with owned files, sessions, branches and PRs, is [WORKSTREAMS.md](WORKSTREAMS.md).

| Lane             | Status                                                               | Handoff                       |
| ---------------- | -------------------------------------------------------------------- | ----------------------------- |
| Operator         | Running                                                              | —                             |
| F Touch and drag | Running ([#42](https://github.com/ryanjosephkamp/splashery/pull/42)) | [handoff/F.md](handoff/F.md)  |
| G AI image-to-3D | Running ([#43](https://github.com/ryanjosephkamp/splashery/pull/43)) | [handoff/G.md](handoff/G.md)  |
| H Later          | After the toy lanes                                                  | —                             |
| New toys         | When the owner asks                                                  | The Toy Ideas page (approved) |

E4-finish, E5, E6a and E6b are done (WORKSTREAMS.md, "Done"). F and G started on 2026-09-27 (the
Operator opened both sessions). New-toy lanes come from the ideas the owner approves on the Toy
Ideas page; the owner wants real photo-scans, not cartoons, for everyday objects where a good one
exists (lane G tries making some).

The prompts are on the Splashery Parallel Plan page (OPERATING.md, "Pages").

## Where things are

- [handoff/history.md](handoff/history.md): the phase notes from A to E4 and a summary of each
  finished lane, with every lesson, the known issues by phase, the phases table, the owner's asks
  and the settled decisions.
- [handoff/](handoff/)`<lane>.md`: each lane's brief, state, notes and known issues.
- [PACKS.md](PACKS.md): how to write a recipe; channels (section 6); draw order and effect quality
  (7b).
- [TOY-PLAN.md](TOY-PLAN.md): every toy's planned tap effect and sound, generated from
  `tools/toy-plan.json` by `node tools/toy-plan.mjs`.
- [reviews/](reviews/): the owner's reviews, word for word, with screenshots.
- [BACKLOG.md](BACKLOG.md), [ROADMAP.md](ROADMAP.md), [SCENE-SCHEMA.md](SCENE-SCHEMA.md),
  `CREDITS.md`, `LICENSES.md`, `README.md` (features and code layout).
- The private pages (Effect review, Sound Board, Toy Plan, Toy Ideas, Parallel Plan, Operator
  Manual): links in OPERATING.md, "Pages".
- The Operator's daily routines (from 2026-09-27, Eastern time): three toy ideas on the Toy Ideas
  page at 7:43, then the owner's digest at 7:54.

## Lessons at a glance

Each has its full notes in handoff/history.md (the phase is in brackets) and, for most, in PACKS.md.

- Effect quality rules (E1b): CLAUDE.md and PACKS.md 7b. Judge effects as clips at phone size.
- Draw order (E2): splats sort in their built pose; build pieces where they are seen at their
  fullest; turning about the view keeps the order; spinning bodies are built twice.
- Hidden pieces count in the fit (E2); `fit: false` (E3 review) leaves a shape out of the fit.
- Channels and morphs (E3): one behaviour per splat; rounder or larger splats where a morph turns or
  stretches a surface.
- Loose pieces as tokens, and pieces built where they end (E4).
- Skinned sheets, twists of space, negative glow, spinning gloss, `cull` for one spinning body, and
  hidden pieces counting in the framing (the E lanes, 2026-09-26): PACKS.md 3, 6 and 7b.
- Tiny splats vanish on small screens: keep `size / sqrt(weight)` near 0.5 or more (E2).
- Scan rigs, kit parts for scans and add-ons (D, E1, E1b, E1c).
- A rare engine warning (2026-09-25; back once on 2026-09-26 in a phone test, just after a scan
  loaded, and once in a lane's full run as a SwiftShader warning in the cat statue smoke test), a
  flaky drag in the stretchy-toy smoke test, and the strawberry smoke test (once not settled 3 s
  after its tap, in two lanes' runs): keep `test-results/` if any comes back.

## Standing facts

- `HF_TOKEN` was checked on 2026-09-24 (whoami: account `ryanjosephkamp`, role `read`). If it is
  ever missing or rejected, tell the owner exactly what to change: the cloud environment menu in the
  session's title bar, then Edit, then an environment variable named `HF_TOKEN`.
- In the cloud sandbox, headless Chromium cannot reach github.io. To screenshot a host page that
  embeds the live site, route `https://ryanjosephkamp.github.io/splashery/**` to the local server
  (`context.route` plus `route.fetch`).

## What the owner asked for across the board (2026-09-23)

- Every toy gets its own tap effect and its own sound. Toys with a twin (the two rubber ducks, the
  two croissants, the two alarm clocks, the cactus and the saguaro, the grape and the grapes) must
  act and sound different.
- Some effects depend on where you touch or drag (lane F). Say so if something is not feasible; a
  good fallback is fine.
- Stay respectful: nothing destructive or disrespectful on the White House or the Washington
  Monument, and no fighting or gore (the Colosseum gets a chariot race, not gladiators).
- The full text is in handoff/history.md.

## Decisions

Settled on 2026-09-24, when the owner approved every recommendation:

- Sounds: synthesize by default; CC0 audio samples are fine for the few that synthesis does badly (a
  real quack, an alarm bell, a crowd). Record each sample in CREDITS.md.
- Pine tree: it shakes off a dusting of snow (the decorated tree keeps the lights).
- An owner-set `?detail=high` embed option for the homepage is approved for Phase H, capped by
  device tier.

Settled on 2026-09-26: the remaining work runs as parallel lanes with an Operator session
(OPERATING.md).

Still open (ask when it comes up, in Phase H):

- The favourite maths toy for the homepage: Menger sponge or hypercube? One embed or several?
