# Record: task 57, hard-case samples

## Identity and status

- Task: Codex task 57, hard-case pictures for Photo to 3D.
- Toy: `photo-3d`.
- Branch: `codex/hard-case-samples`; one draft PR against `main`.
- Made by Ryan with Codex (GPT-6), October 13, 2026. The native image tool did not return its image
  model identity.
- Status: implemented, proposed for review; not merged or accepted.

## Recipe contract

The existing `prepare`, `build`, `drive`, controls, and tap action are reused unchanged. The lazy
pack loader adds sample choices and their credits. Units, axes, pivots, part IDs, and quaternion
conventions remain those of the existing Photo to 3D recipe. No new quaternion or host API is
introduced. Browser evidence uses the existing `usePhoto`, `setToyOptions`, motion controls, camera
poses, and `stage.captureFrame` APIs.

## Generation

- Steps: generate each of the 40 prompts in
  [the manifest](../../../tools/cdx-hard-case-candidates.json) with the OpenAI native image tool,
  visually screen the results, resize them with `cdx-hard-case-prepare.py`, run the unchanged
  `tools/dsm-depth.mjs`, score them with `cdx-hard-case-score.mjs`, and select with
  `cdx-hard-case-select.mjs`.
- Environment: managed Linux container, Debian Chromium, software WebGL2 via SwiftShader.
- Versions: Node 24.19.0, Python 3.12.14, Pillow 12.3.0, Playwright 1.56.1, Chromium 151.0.7922.173,
  and the existing vendored Depth Anything V2 Small model/runtime. Pillow and the existing tools are
  already listed in `LICENSES.md`; no library was added.
- Seed: native image generation is nondeterministic; no seed was returned. Selection is
  deterministic from the committed score rows.

## Assets and licenses

[Asset records](asset-records.json) list every retained JPEG and depth map, both SHA-256 hashes,
native source hash, source page, author, sample credit, date checked, and transformations. AI-made
pictures use the owner's existing **AI-made by the owner** Studio sample policy. They are fictional
and labeled beside each choice. Code is offered under Splashery's MIT license.

## Boundaries

- Reused: Photo to 3D's decoder, preparation, renderer, controls, tap action, depth worker/model,
  and the unchanged `tools/dsm-depth.mjs`; task 54's documented scoring proxies.
- New: 40 native picture candidates, 20 retained JPEG/depth pairs, a separate lazy sample registry,
  scoring/selection tools, tests, asset credits, and a complete audit.
- Not simulated: these are synthetic source pictures and relative inferred depth, not real captures,
  true volumetric glass/water geometry, or ground-truth depth measurements.
- Protected files: open-PR implementation files, `manual/`, and `tests/taps.spec.mjs` are unchanged.
  Only task-required additive credit/asset records enter the shared registries.

## Executed evidence

The [verification record](verification.md) gives exact test commands and pass/fail counts. All
candidate scores come from real Chromium Sharp-view renders at the eight specified poses. The
retained samples load and change from flat to raised in real Chromium. No model outputs or scored
renderer pixels are mocked. An inference-only startup page avoids drawing the unrelated opening toy
while the unchanged depth builder runs. Actual phone hardware and ground-truth depth accuracy are
unmeasured.

## Performance

- Per-tier splat counts: unmeasured across all tiers; the real mid-profile count for every candidate
  is in `photo-scores.json`.
- File bytes: JPEG/depth byte counts and hashes are in the asset records; images are 1,280 px wide,
  and maps are 362,612 bytes each. Only a picked sample's pair is fetched.
- Load time, memory, and frame rate at each budget: unmeasured on physical hardware.
- Compared with: the other 39 generated candidates under the same phone-size render and scoring
  settings; no claim of a renderer improvement.

Rule check: none.
