# Fix9: the walkthrough's toy fixes

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the October push. Repo: ryanjosephkamp/splashery. Your lane: Fix9 (id `Fix9`, prefix `fx9`). Branch: `claude/lane-fix9` (and `claude/lane-fix9-engine` for any change to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Fix9: the walkthrough's toy fixes". Handoff file: docs/handoff/Fix9.md (create it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026, from the owner's walkthrough review)

Read the owner's own words first: docs/reviews/2026-10-06-walkthrough/notes.md (dictated on his phone; he praised the site and asked for these refinements), then the Operator's triage in docs/reviews/2026-10-06-walkthrough/triage.md, section "Fix9". That section is your list. Anything the owner didn't mention is approved: change nothing else, and keep the look and layout he praised.

Notes on the list:
- Cherries: two cherries on a joined stem that swing like a small Newton's cradle at real speed (pendulum period from the stem length; no slow motion); pulling one off can stay. Use the physics engine in src/physics/ as the Physics lane did (docs/handoff/Physics.md).
- Soda can: the suds spill over the rim and run down the can before they fade, solid and opaque.
- Data in 3D: a tap anywhere on the axes or the plot's box plays the effect, not only on a point.
- Fluid lab: on a phone that can't keep up (measure the frame time for the first second), show a short, plain warning with a lighter mode or a way back, before the phone stalls.
- Orange photo (the photoreal orange): less grainy, the way the Photoreal and Fidelity lanes sharpened others (docs/handoff/PhotorealR2.md, PhotorealR3.md, Fidelity.md). Dog plush: the dark gaps under the head and paws in the owner's screenshot (docs/reviews/2026-10-06-walkthrough/dog-plush-gaps.jpg). Find whether they come from the capture or from our cut and lift; fix them if you can, or say exactly why not.
- Tiny world: cell division, apoptosis and phagocytosis sharper (docs/handoff/TinyR2.md).
- Clips at phone size on Effect review page 2, before and after (ids fx9-…).

You own: the named toys' recipes and helpers, their lines in the shared lists, and tests/fx9*.spec.mjs. If a named toy's pack belongs to a lane that is running now (see WORKSTREAMS), ask the Operator first.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it; replace the prefix and lane record with yours). Your changes touch toys and pages the public sees, so the Operator merges them after a full test run (the Integrators run it) and the owner's "good" marks on your cards. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says (no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first READY within about four to six hours, then polish rounds on the owner's marks.

## State

- Started October 7, 2026. None of the named packs (food, real-objects, data-climate, fluid-lab,
  photoreal-r2, tiny-r2) belongs to a lane running now: their lanes are merged and idle.

## Notes

## Known issues

## For the Operator
