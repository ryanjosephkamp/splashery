# Lane Photo depth (`pdp`)

Model: Opus 5.5, at high effort. Branches: `claude/lane-photo-depth` (PR "Phase Photo depth: …") and
`claude/lane-photo-depth-engine` (PR #468, "Engine: …", merged first).

## Brief

You are a Splashery worker session started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery.

- Your lane: Photo depth (prefix `pdp`).
- Branches: `claude/lane-photo-depth`, plus `claude/lane-photo-depth-engine` for changes to shared
  UI or the app. That one is a small, additive "Engine: …" PR, merged first.
- PR title: "Phase Photo depth: a clean depth animation in the Sharp view, a movable depth slider
  and the depth sound".
- Handoff file: docs/handoff/PhotoDepth.md. Create it, starting with this brief word for word under
  "## Brief". Then keep "## State", "## Notes", "## Known issues" and "## For the Operator

- Merged in batch 3. If upkeep hasn't run since, `tools/upkeep.mjs` shows the three "ready" depth
  sounds on the Sound Board.
- Next for the Sharp view, once #479 lands: take the depth for the exact video frame on show, and
  blend depth frames in the shader (#479's report leaves both to this lane).
- For #479 on a real phone: an opened short video and GIF (the samples carry depth for every frame,
  so the in-between interpolation isn't measured), a long video's steadiness and frame rate, the
  horse, and opening times.
