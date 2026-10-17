# Codex task 119: research, real places to walk through (up to 4 hours; Codex's cloud or ChatGPT)

**Branch:** `codex/research-real-places`, cut from `main`. One draft PR against `main` with the
report only. This task needs the web. It is written to stand on its own, so the owner can also paste
it into ChatGPT's deep research; then the answer comes back as the report's text.

## Why

Splashery is a pure-browser toy box of 3D Gaussian splats
(https://ryanjosephkamp.github.io/splashery/). Task 115 builds "Walk inside", where a person walks
through a splat scene of a place on a phone. It needs real places to walk through, under licenses
Splashery can use, and ways to show big scenes on a phone. This research finds both.

## Questions

1. **Places with open licenses:** captured 3D places (splats, photogrammetry meshes, or the photos
   to make them) under CC0, CC BY, CC BY-SA, CC BY-NC, or CC BY-NC-SA, never NoDerivatives. Look at
   museum and heritage collections (for example Smithsonian Open Access), scan-sharing sites, public
   research datasets (check that the license covers redistribution), and government sources. For
   each: the license on the live page, the size, the kind of place, and whether it would make a good
   walk.
2. **Making places ourselves:** what it takes to capture a room or a garden well with a phone and
   train it into splats with open tools on an Apple-silicon Mac (the owner has one), with the number
   of photos, time, and quality.
3. **Big scenes on a phone:** levels of detail, streaming, and culling for splats (for example
   PlayCanvas's and SuperSplat's streamed formats, Octree-GS, and others), what a phone can draw at
   30 fps, and the file sizes.
4. **Walking:** how others find the floor and walls in a splat scene, and how they keep people from
   walking through them or getting sick.

## Deliverable

`docs/research/real-places-2026-10.md`, 250 lines at most:

- a table of at least 20 candidate places (name, source link, license, size, kind, and a walk score
  from 1 to 5);
- the ten best, in order, with how to bring each into Splashery;
- the best way to show a big place on a phone, and the gate to hold it to.

Every claim links to its source. American English and the serial comma. PR body: Summary,
Verification, Deviations, Known issues, and What was cut. Credit lines read "Codex (GPT-6)".
