# Blender cloud render evidence

October 17, 2026. Rendered and measured by Codex (GPT-6), for
[PR #701](https://github.com/ryanjosephkamp/splashery/pull/701).

- `model-contact.jpg`: all 72 orbit views, three CC0 Poly Haven objects at 24 views each.
- `panorama-contact.jpg`: the three full equirectangular panoramas.
- `measurements.json`: installation, disk, per-operation and wall times, source provenance, every
  output byte count/SHA-256, strict repeat comparisons, truth-scene benchmarks, and backend probes.
- `truth-contact.jpg`, `burger-contact.jpg`, and `prior-measurements.json`: retained first-pass
  evidence from the earlier PR revision, with its own hashes and source provenance.

The complete depth, normals, masks, camera matrices, beauty renders, manifests, and checksum files
remain outside git. Each combined model build contains 127 files; all 381 files matched on the two
fresh-process runs. The contact sheets are rendered models, not real photographs.

The source tools, pinned model dependencies, reproduction commands, benchmark definitions, and
limitations are in the
[report](https://github.com/ryanjosephkamp/splashery/blob/codex/blender-cloud-public/docs/audits/blender-cloud-2026-10.md).
Poly Haven models are CC0: Rubber Duck Toy by Plat251, Garden Gnome by Bhargav Kubal, and Carved
Wooden Elephant by Greg Zaal, already recorded in `tools/models.json`. No new source model is
shipped. The original truth scenes are CC0, made by Ryan with Codex (GPT-6). The retained burger
model is from Kenney's CC0 Food Kit. Source URLs and hashes are in the measurements and tool
records.
