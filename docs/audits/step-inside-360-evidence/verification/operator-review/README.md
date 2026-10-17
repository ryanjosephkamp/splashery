# Operator review follow-up

Made by Ryan with Codex (GPT-6), October 17, 2026.

[Review instructions](https://github.com/ryanjosephkamp/splashery/pull/700#issuecomment-6232459351)
are applied in `c02292e54916e7c2dcfa58f67a8dd68524102c46`. Latest merged main is
`cad2c4479ad9279cb4ddc9bb1d6cc4f4387c1da3`. Main's additional documentation and standalone research
demos change no Studio runtime, test, asset, dependency, or suite-config bytes. The site and toy
plan were rebuilt; the site had no further generated changes.

The sample names are Sunlit room and Lamplit room. Panorama credits follow the last Codex section.
The standard one-line pack re-export, separate list header, and owner entry are included. All 1,653
existing frozen files match merged main.

Fresh local verification on this head: **96/96 related tests** (19 panorama and 77 Classic golden)
and **272/272 preflight checks** passed. The two current browser screenshots and complete local logs
are retained here.

[Full CI](https://github.com/ryanjosephkamp/splashery/actions/runs/39066150615) is pending. Final
counts and isolated rechecks will be recorded after all files report.

The earlier ec3dee4cf matrix is preserved in [pre-main-update-ci](pre-main-update-ci/README.md): all
402 files, 3,424 tests: 3,421 passed, two failed, and one existing private-fixture skip. The two
unlisted failures, pages-r2:495 and shr:202, passed isolated rechecks. Its combined summary job was
waiting for a runner and was canceled automatically by the legitimate latest-main push after all
sixteen shards finished. Every raw shard log and all 402 file progress rows are retained; failed
tests remain failures in those original counts.

The 25.63% whole-set depth gain and all three regressions remain in the main report: arches 15.46%,
still-life 17.03%, and fresh-room-03 7.42%. The inference pipeline, viewer, model, and sample
image/depth bytes are unchanged. The eight recordings retain their historical labels and original
f94345f3f source identity. The sole changed recorded-source file, samples.js, has corrected display
labels; its old and current hashes are recorded. Physical-phone performance remains unmeasured.
