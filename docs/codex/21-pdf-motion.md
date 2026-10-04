# Codex task 21: can a Splashery toy move inside a PDF?

**Branch:** `codex/pdf-motion`, cut from `main`. **Output, and nothing else:**
`docs/audits/pdf-motion-2026-10.md`, sample PDFs and their sources in
`docs/audits/pdf-motion-2026-10/` (each PDF 15 MB or less), and the build scripts that make them in
`tools/pdf-motion/` (any new tool listed in `LICENSES.md`).

The owner, October 4, 2026: "I want you to really clearly explain to me why we cannot embed a
Splashery toy in a digital PDF that, when viewed from a typical digital PDF viewer, could actually
either be interactive or at least could move ... Is there any way that we can kind of, like, almost
like jailbreak LaTeX, or something that we can compile into a PDF so that it would do that? ...
Maybe it would only be viewable in a certain PDF viewer." He is "not going to let up on this". This
task finds out, with working samples he can open on his own devices.

A Splashery toy is a WebGL page that draws hundreds of thousands of Gaussian splats, sorted and
blended every frame, from ES modules. The question is what of that, or what picture of it, a PDF can
carry and which viewers will play it.

## Steps

1. **Research, with sources you open.** For each way a PDF can move or respond, say what it is,
   which viewers support it today (Adobe Acrobat and Reader on macOS, Windows, iOS and Android;
   Apple Preview and iOS Files; Chrome's and Edge's built-in viewer (PDFium); Firefox's (PDF.js);
   Foxit; PDF-XChange; Okular; SumatraPDF), and what it can show of a toy. At least:
   - frame animation with the LaTeX `animate` package (JavaScript or OCG frames);
   - PDF JavaScript in Chrome's PDFium viewer, as in the public "Doom in a PDF" and PDF Tetris
     projects (what it can draw, at what size and speed);
   - PDF.js scripting in Firefox;
   - 3D annotations (U3D and PRC, through `media9` or `movie15`): a mesh or a point cloud that turns
     in the viewer;
   - embedded video and sound (RichMedia, the multimedia features, Screen annotations);
   - file attachments (an HTML file of the toy attached to the PDF) and links or QR codes to the
     live toy;
   - any other trick you find (a JavaScript-driven form field "canvas", layers, page transitions).
2. **Why a real splat toy can't run inside a PDF**: say it plainly and exactly, with sources: what a
   PDF viewer gives a document (no WebGL, no general-purpose drawing surface, no module loading,
   restricted or disabled JavaScript, security limits) and what Splashery needs.
3. **Build a sample PDF for each way that works anywhere**, from a real toy (render frames with
   `tools/effect-clip.mjs` or Playwright from the local server; a point cloud of a toy's splat
   centers and colors for the 3D annotation): at least an `animate` flip book of a toy's effect, a
   PDFium JavaScript animation, a 3D point-cloud annotation, a PDF with an embedded video, and a
   plain one with a still, a link and a QR code. Install what you need (MacTeX, TeX Live or
   tectonic); say what you used.
4. **A table** in the report: each sample × each viewer, marked "moves", "responds", "still only" or
   "untested", with what you tested yourself and what you read; leave the cells you couldn't test
   for the owner, and list exactly how he should test each one (which app, which device).
5. **Recommendations**: the best way to put a moving or interactive Splashery toy in a PDF for (a)
   readers using Acrobat, (b) readers in a browser, (c) everyone; and what a Splashery feature would
   look like ("Export as PDF" for a toy, and the catalog of every toy, one per page, which a Claude
   lane will build).
6. **Before you push:** `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
   Open a draft PR against `main` titled "Codex task 21: can a Splashery toy move inside a PDF?".
