# Lane PIC2: the Pictures toys' page sounds and pages, and Picture QR

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane PIC2 (prefix `pic2`), Opus 5.5 at
high effort, branch `claude/pic2`, PR "Phase PIC2: page sounds, Picture lab pages in place, Picture
QR defaults". From the owner's walkthrough of October 17, 2026:

- The Photo album: a Pop out tap raises a photo, and must not play the page-turn sound.
- The Picture lab: no page-turn sound, and pages change in place again (no slide, no turn).
- Your book, the Photo album, and the Storybook: a softer page turn; their animations stay.
- Picture QR: the lowest contrast and the biggest code by default, and a new sound.
- Take over Codex #656 (task 79, Most detail and its fidelity report), merge it with main, finish
  it, and close #656 pointing to the PIC2 PR.

The Storybook is public, so its sound change waits for the owner's "good". The rest is labs.

## State

- Part 1, the engine half of #656: PR #712 (`claude/pic2-engine`), "Engine: opt-in photo tiles, a
  recipe splat limit, and identical-uniform skipping". Merges first.
- Part 2: "Phase PIC2" on `claude/pic2`, which merges `claude/pic2-engine`.

## What changed

- **The album's stray turn sound** had two causes. Its tap action wasn't `quiet`, so the app played
  the album's page sound on every tap, a Pop out tap included. And the figure's lift cue
  (`POP_SOUNDS.rise`) was the `pageflip` voice, a synthesized page turn. Now the album's tap is
  quiet and its page sound is a cue from the drive for a tap that queues a turn (as in Your book),
  and the lift is a short, soft `rustle`. The lift change also reaches Your book's, the Storybook's,
  and the lab's Pop out.
- **The Picture lab**: the slide (`labSlide`, lane Polish) is gone; a page change calls `pics.go()`
  at once and the sheet shows the new page when it's built. Its tap is quiet. Its `TOY_SOUNDS` entry
  (needed on the shelf) is now a faint card tap that plays only on the Sound Board.
  `tests/pol-pages.spec.mjs`'s slide test now checks the in-place change instead.
- **Softer page turns**: `PAGE_SOUNDS` (Your book's five styles, and the Storybook, which plays the
  hardcover page) at about half the volume (1.1 to 0.55), pitch 0.94, and a lighter hardcover
  landing (0.3 to 0.14); the album's page 1.2 to 0.6 and its thud 0.45 to 0.2; the pulled page's
  settle 0.12 to 0.08; the Sound Board's `your-book` and `book` entries to match.
- **Picture QR**: `contrast` defaults to 0 and `size` to `most`. Only the options a person changes
  go into a link, so a link that carries its own contrast and size opens as it was. The new sound is
  a `drip` and five soft `marimba` notes.
- **#656, kept**: all of its runtime code (`src/qr-craft/` detail, scan pool, second reader
  (zxing-wasm 3.1.4, vendored), fast raster and blur kernels, frame, views, policy;
  `src/qr/picture-errors.js`, `src/qr/picture-padding.js`, `src/qr/circle.js`'s dot-free sticker),
  its tests (`tests/cdx-qr-*.spec.mjs`, `tests/cdx-circle-qr.spec.mjs`), its study tools and corpus
  fixtures (`tools/picture-qr-fidelity/`), its audits (`docs/audits/picture-qr-fidelity-*.md`), the
  findings and tables (`tools/picture-qr-fidelity/results/review-pass/{findings,tables}.md`), and
  its LICENSES, CREDITS, and `tools/assets.json` entries.
- **#656, dropped**: the 21 MB of raw study results (they stay on `codex/picture-qr-fidelity`), its
  four screenshots, and a comment-only edit to `tests/qr4-craft.spec.mjs`.

## Notes for the next session

- Clips render with a scratch variant of `tools/effect-clip.mjs` that logs every sound the app plays
  at its clip time and mixes it in; `effect-clip.mjs` itself has no sound.
