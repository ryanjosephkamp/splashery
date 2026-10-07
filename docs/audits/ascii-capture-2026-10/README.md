# ASCII capture lab: evidence (October 6, 2026)

Lane AsciiCapture. Model: Opus 5.5. Small files only (no video).

- `repeat-jobs.json`: `tests/asc-repeat.spec.mjs`, ten grapes jobs at 48 columns in a row, then five
  Cancels at varied points mid-capture. After each one (two forced garbage collections first): CDP
  `Performance.getMetrics` (Documents, Frames, JSEventListeners, Nodes, JSHeapUsedSize) and the lab
  page's own handles (iframes, pending timers, live object URLs). Flat throughout: 1 document, 1
  frame, 31 listeners, 0 iframes, 0 timers, the JS heap 2.7 to 2.8 MB, one object URL after a
  success (the GIF) and none after a Cancel. GPU memory is not measured.
- `sheet-grapes.png`, `sheet-orange.png`, `sheet-strawberry.png`: every fifth frame of each preset's
  downloaded GIF (72 columns, color), made with ffmpeg's `tile` filter.

Run on: Chromium 141.0.7390.37 (Playwright's), Linux, SwiftShader (no GPU). A job took about 35
seconds (grapes, orange) and about 106 seconds (strawberry) there. No phone was available: the lab
page's Device check box is for the owner's phone screenshots.
