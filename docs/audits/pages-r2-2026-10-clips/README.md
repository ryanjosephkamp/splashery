# Book and Picture lab round 2: phone motion comparisons

Task 95. Made by Ryan with Codex (GPT-6), October 15–16, 2026. Rule check: none.

This is an evidence-only branch, `codex/book-picture-lab-r2-clips`. **Never merge this branch.** The
implementation belongs to `codex/book-picture-lab-r2` and its draft pull request.

The comparisons use a 390×844 CSS-pixel viewport, device scale 2, low detail, and adaptation off.
Main is the unchanged `cc297c89e`, including Fix13 (#665). The frozen implementation is `f5f8cef90`;
its engine changes end at `bec7999a4`. Main later advanced to `94216d772` only in five documentation
files, which were merged into the implementation as `5361db4cb`. Rendering source remains unchanged
by that merge. Both checkouts run in Chromium on the same Linux software renderer, one at a time.
These are browser recordings, not physical-phone measurements.

Every recorded scene uses an 8-step-per-second animation clock. Each main/candidate pair uses the
same cadence and capture method, recorded in its metadata. The three toy scenes show completed
renders of the actual canvas at phone CSS scale, padded to 390×844, with settings labels and the
browser UI omitted. These canvas captures wait for a completed draw before readiness, another
afterward, and a third for the saved frame, rather than repeatedly capturing the browser page.
Preparation waits are omitted, and frames have been encoded for playback. These clips show sheet
continuity, edge quality, and the sequence of effects. They do not measure throughput or inference
speed. The separate real-clock benchmark in `docs/audits/pages-r2-2026-10.md` records performance.

Each scene shows Pop out with Pop-up layers off, returns the card, repeats with layers on, and shows
an oblique view. The book includes camera sweeps; other scenes retain the oblique view after the
first rise to reduce camera-only frames. The three toy scenes also turn a page. Optional text,
chart, and diagram scenes are supported by the recorder. Their original material is CC0; the book
test PDF and shipped samples already belong to this repository. Existing photo credits and licenses
continue to apply. Recording contributions, original text, charts, and diagrams are CC0; tool code
is MIT.

## Recordings

Recordings are captured from the final source after the isolated quantitative matrix, then inspected
before publication. The paired files use main on the left and round 2 on the right.

| Scene       | Paired recording       | Contact sheet                 |
| ----------- | ---------------------- | ----------------------------- |
| Your book   | [MP4](your-book.mp4)   | [JPEG](your-book-strip.jpg)   |
| Picture lab | [MP4](picture-lab.mp4) | [JPEG](picture-lab-strip.jpg) |
| Photo album | [MP4](photo-album.mp4) | [JPEG](photo-album-strip.jpg) |

The [local video gallery](index.html) includes all three paired toy clips and separate main and
round 2 recordings at full phone width. The [quantitative archive](benchmark/README.md) retains the
matched raw records, comparison checks, exact crops, and SHA-256 manifest.
[Still comparisons](stills/README.md) show body text at native framebuffer pixels and each toy at
phone and desktop sizes. The [fixtures](fixtures/README.md) preserve the exact input bytes;
[CI records](ci/README.md) preserve full-suite summaries beyond Actions artifact retention.
[Dense frame reviews](review/README.md) sample each sequence in order.
[Earlier trials](exploratory/README.md) retain strict misses outside the final comparison.
[Recording metadata](recordings.json) retains the scene observations, renderer, viewport, duration,
frame count, and clock description. Photo source authors, source pages, licenses, and the
repository's original checks remain in [CREDITS.md](../../../CREDITS.md). No visitor files appear in
these recordings.

## Reproduction

Serve main on port 4180 and the implementation on port 4173. Generate the cached benchmark fixtures
once with `tools/pages-bench.mjs` before recording. With the implementation's recorder:

```sh
DISPLAY=:91 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium \
  SPLASHERY_URL=http://127.0.0.1:4180/ node tools/pg6-clip.mjs \
  work/pages-r2/clips-main r2-book r2-lab r2-album r2-text r2-chart r2-diagram \
  --profile=low --dpr=2 --width=390 --prep-ms=120000 --frames=1 --draws=1
```

Repeat against port 4173 into `work/pages-r2/clips-round2`. Metadata records the viewport, renderer,
profile, scene, frame count, and duration. Side-by-side encodings label main on the left and round 2
on the right. The recordings use full-color PNG intermediates, so GIF palette reduction does not
affect the comparison videos. Raw PNG and GIF intermediates stay outside Git.

## Goal-window result

Partial Goal result: 118/144 planned cases retained, 19/24 groups fully paired, and 15/19 scored
groups pass every applicable strict gate. Loading and memory misses remain; clean full-suite reruns
were pending at handback. All 12 phone groups meet the frame-rate and memory gates, and all three
phone text fixtures meet both quality gates. The quantitative archive states exact coverage. Never
merge this branch.
