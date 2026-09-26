# Handoff

Where Splashery stands, in short. The Operator session keeps this file; each lane keeps its own file
in [handoff/](handoff/). The ground rules are in [CLAUDE.md](../CLAUDE.md); how the parallel lanes
work is in [OPERATING.md](OPERATING.md).

## State of main (2026-09-26)

- Phases A to E4 are merged: A (splashery PR #13, homepage PR #33 in
  `ryanjosephkamp/ryanjosephkamp.github.io`), B (#17), C1 (#18), C2 (#19), D (#20), E1 (#21), E1b
  (#22–#24), E1c (#26–#28), E2 (#29–#31), E3 (#32) and E4 (#33, merged 2026-09-26). The owner
  approved everything from E3.
- The shelf has 284 toys (30 scans, 4 shapes and 250 kit toys; with the protein toy). The plan
  (`tools/toy-plan.json`, [TOY-PLAN.md](TOY-PLAN.md)): 227 keep, 2 more (the puzzle cube and the
  bricks), 55 new. Scene schema v3; v2 still loads.
- The owner's E4 review (Effect review page, `e4-*`): 26 of 30 clips look right; the ice swan, the
  ocean wave, the pinecone and the lava lamp need work (lane E4-finish).
- Parallel lanes began on 2026-09-26. Every kit toy's tap is checked by `tests/taps.spec.mjs`; its
  known exceptions (with reasons) are listed at its top.
- Locked (owner approved, do not change its look or behaviour): the laptop. Its smoke test guards
  it.

## Active lanes

The full table, with owned files, sessions, branches and PRs, is [WORKSTREAMS.md](WORKSTREAMS.md).

| Lane                      | Status               | Handoff                                      |
| ------------------------- | -------------------- | -------------------------------------------- |
| Operator                  | Ready (Prompt 2A)    | —                                            |
| E4-finish                 | Waiting for Prompt 3 | [handoff/E4-finish.md](handoff/E4-finish.md) |
| E5 Food                   | Ready (Prompt 2B)    | [handoff/E5.md](handoff/E5.md)               |
| E6a Balls                 | Ready (Prompt 2C)    | [handoff/E6a.md](handoff/E6a.md)             |
| E6b Landmarks and friends | Ready (Prompt 2D)    | [handoff/E6b.md](handoff/E6b.md)             |
| F Touch and drag          | Later (Prompt 2E)    | [handoff/F.md](handoff/F.md)                 |
| G AI image-to-3D          | Later (Prompt 2F)    | [handoff/G.md](handoff/G.md)                 |
| H Later                   | After the toy lanes  | —                                            |

The prompts are on the Splashery Parallel Plan page (OPERATING.md, "Pages").

## Where things are

- [handoff/history.md](handoff/history.md): the phase notes from A to E4, with every lesson, the
  known issues by phase, the phases table, the owner's asks and the settled decisions.
- [handoff/](handoff/)`<lane>.md`: each lane's brief, state, notes and known issues.
- [PACKS.md](PACKS.md): how to write a recipe; channels (section 6); draw order and effect quality
  (7b).
- [TOY-PLAN.md](TOY-PLAN.md): every toy's planned tap effect and sound, generated from
  `tools/toy-plan.json` by `node tools/toy-plan.mjs`.
- [reviews/](reviews/): the owner's reviews, word for word, with screenshots.
- [BACKLOG.md](BACKLOG.md), [ROADMAP.md](ROADMAP.md), [SCENE-SCHEMA.md](SCENE-SCHEMA.md),
  `CREDITS.md`, `LICENSES.md`, `README.md` (features and code layout).
- The private pages (Effect review, Sound Board, Toy Plan, Parallel Plan, Operator Manual): links in
  OPERATING.md, "Pages".

## Lessons at a glance

Each has its full notes in handoff/history.md (the phase is in brackets) and, for most, in PACKS.md.

- Effect quality rules (E1b): CLAUDE.md and PACKS.md 7b. Judge effects as clips at phone size.
- Draw order (E2): splats sort in their built pose; build pieces where they are seen at their
  fullest; turning about the view keeps the order; spinning bodies are built twice.
- Hidden pieces count in the fit (E2); `fit: false` (E3 review) leaves a shape out of the fit.
- Channels and morphs (E3): one behaviour per splat; rounder or larger splats where a morph turns or
  stretches a surface.
- Loose pieces as tokens, and pieces built where they end (E4).
- Tiny splats vanish on small screens: keep `size / sqrt(weight)` near 0.5 or more (E2).
- Scan rigs, kit parts for scans and add-ons (D, E1, E1b, E1c).
- A rare engine warning (2026-09-25; back once on 2026-09-26 in a phone test, just after a scan
  loaded) and a flaky drag in the stretchy-toy smoke test: keep `test-results/` if either comes
  back.

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
