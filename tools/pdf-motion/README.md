# PDF motion experiments

These scripts write only the task's sample directory. Run from the repository root. They do not add
a site export feature. Use the captured baseline recorded in `capture.json` when reproducing the
source scene; rebuilding against a later checkout may change the toy.

## Capture

Install the repository's pinned npm dependencies with `npm ci`. Start a local server in a separate
terminal:

```sh
python3 -m http.server 4189 --bind 127.0.0.1
```

Then capture the real toy with the installed browser:

```sh
SPLASHERY_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node tools/pdf-motion/capture.mjs
```

`SPLASHERY_URL` can replace the default server URL. The script requests WebGL2, disables adaptive
quality and idle motion, sets a fixed camera and simulation clock, captures 40 JPEG frames, samples
2,382 centers and colors, and creates the live-link QR. It uses the same capture approach as
`tools/effect-clip.mjs`. The time represented is five seconds; capture wall time is not playback
speed. This exports the procedurally generated grapes toy, with no downloaded model or photograph.

## Build and inspect

Required external programs: `pdflatex` with `animate`, `asy`, `ffmpeg` with `libx264`, `ffprobe`,
and `pdftoppm`. Required Python libraries: ReportLab 4.4.9, pypdf 6.10.0, Pillow 12.3.0. The report
records the actual installed versions. One setup on a machine without these libraries is:

```sh
python3 -m venv /tmp/splashery-pdf-env
/tmp/splashery-pdf-env/bin/pip install reportlab==4.4.9 pypdf==6.10.0 pillow==12.3.0
/tmp/splashery-pdf-env/bin/python tools/pdf-motion/build.py
/tmp/splashery-pdf-env/bin/python tools/pdf-motion/verify.py
node tools/pdf-motion/verify-qr.mjs
```

This run used Codex's existing bundled Python instead of creating that environment. It used the
Homebrew Asymptote 3.15 binary because the MacTeX 3.09 binary crashed. `ASYMPTOTE` can select the
working executable; `PDFTOPPM` can select a bundled Poppler executable. Asymptote's colored marker
export can take several minutes. Each generated PDF must remain at or below 15,000,000 bytes.

`build.py` writes the PDFs, `.tex` sources, PDF JavaScript, field frames, `.asy` source, PRC
geometry, MP4, HTML launcher, and a hash manifest. It uses pypdf's object API (including
`_add_object`), hence the version pin. After changing only 3D annotation packaging,
`point_cloud(reuse_prc=True)` may be called through Python to reuse the already generated geometry;
do not use that option after changing the point data or Asymptote source. A normal full build always
exports fresh geometry.

`verify.py` checks strict parsing, text on each page, size limits, changing field frames, payload
and attachment integrity, H.264 dimensions/duration, URL and page timing. It renders static posters
and a source filmstrip. `verify-qr.mjs` independently decodes the QR from the rendered PDF, using
the existing jsQR dependency. Neither script establishes native animation, 3D or video playback.

For viewer checks, download/open the PDFs in the actual named viewer, follow the report's steps, and
record the app and OS versions, the visible result, and any prompt. Do not count a PDF thumbnail,
Poppler render, or browser WebGL capture as evidence of active PDF playback.
