# Codex task 117: research, pictures to 3D objects (up to 4 hours; Codex's cloud or ChatGPT)

**Branch:** `codex/research-pictures-to-objects`, cut from `main`. One draft PR against `main` with
the report only. This task needs the web. It is written to stand on its own, so the owner can also
paste it into ChatGPT's deep research; then the answer comes back as the report's text.

## Why

Splashery is a pure-browser toy box of 3D Gaussian splats
(https://ryanjosephkamp.github.io/splashery/). Tasks 113 and 114 build a toolkit that lets an agent
turn a few pictures of a real object (a chair seen on a furniture site, a lamp, a toy) into a 3D
toy, using Splashery's kit shapes or Blender, and score the result against the pictures. This
research finds what else could help: models and methods that make a 3D object from one or a few
pictures, and what an agent could use as a starting point.

## Questions

1. **Image-to-3D models** from 2024 to 2026 (for example TRELLIS, Hunyuan3D, TripoSR, SF3D, SPAR3D,
   InstantMesh, LGM, and SAM 3D, plus any newer): for each, the license for code **and weights**
   (checked on the live page), whether its outputs may be used freely, its size, and whether it runs
   on a CPU in a cloud container, on an Apple-silicon Mac, or in a browser, and how long one object
   takes there.
2. **Quality on furniture and household objects:** thin legs, slats, holes, glass, and the back that
   isn't in the picture. Which methods hold up, with published numbers or your own test on two CC0
   objects rendered from 3 views.
3. **Agents that model:** work where a language model writes Blender or CAD code from pictures (for
   example BlenderGym, BlenderLLM, LL3M, CAD-Recode, and newer). What they get right, what loop they
   use (render, compare, fix), and what an agent in Codex's cloud could copy.
4. **Photogrammetry from a few pictures:** what open, license-clean tools do with 3 to 10 pictures
   (pose estimation, sparse views), and where they fail.
5. **Segmentation and cameras:** the best open (Apache-2.0, MIT, or BSD) background removal and
   camera estimation that could run at build time.

## Deliverable

`docs/research/pictures-to-objects-2026-10.md`, 250 lines at most:

- one table of every candidate (license for code and weights, outputs, size, where it runs, time,
  quality notes, and a source link);
- the three best things to add to tasks 113 and 114's toolkit, each with what it would take and the
  gate to hold it to;
- what can't be used and why (license, a server, or size).

Only Apache-2.0, MIT, or BSD code and weights could ever run in Splashery or its build tools without
the owner's yes; list others for reference only. Every claim links to its source. American English
and the serial comma. PR body: Summary, Verification, Deviations, Known issues, and What was cut.
Credit lines read "Codex (GPT-6)".
