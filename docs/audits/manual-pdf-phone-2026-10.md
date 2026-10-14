# Manual PDF on phones: task 73

October 14, 2026. Built by Codex on `codex/manual-pdf-phone` for
[task 73](../codex/73-manual-pdf-phone.md). Rule check: none.

This is the original build and test record at `c8c013687df5a4792661f8bfbcedd782385e3e8e`. Its passes
and screenshots are historical evidence. The follow-up continues that implementation, merges main at
`58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`, and regenerates the service worker. Fresh check counts,
failures, and limits are reported separately in the Verification section of
[draft PR #597](https://github.com/ryanjosephkamp/splashery/pull/597).

The credits page, Books notebook page, and builders pack now follow `manual/pdf-edition.js` too. The
page generator resolves historical PDF mentions to edition links without changing the source
records' wording. The pack reads the edition module from its selected `--root` checkout and includes
the current PDF, the module, and the compatibility copy for old links in packed guides. Every
published build refreshes that copy. Current-PDF assertions in `man5`, `man6`, `man9`, and `ln` use
the edition module. Only `cdx-manual-pdf` (byte equality and HTTP access), `man` (file existence),
`st4` (old-link HTTP access after the front-door swap), and `bld` (old links in the ZIP)
deliberately test the legacy address.

Follow-up checks run in Linux cloud Chromium with the sandbox enabled. A temporary Playwright config
omits the repository's unsafe graphics flags and GPU-blocklist overrides; it retains one worker,
zero retries, the existing assertions, and failure traces. The PDF builder also enables Chromium's
sandbox. Browser archives, fonts, config, logs, and failure artifacts stay outside tracked files.
The full repository suite and real Android viewers remain outside this follow-up's measured scope.

The current download is
[tinkerers-manual-85d32b96193ea275.pdf](../../manual/tinkerers-manual-85d32b96193ea275.pdf): 153
Letter pages, 7,792,711 bytes. Its filename contains the first 16 hexadecimal characters of its
SHA-256 hash. A changed PDF gets a different address. The legacy
[tinkerers-manual.pdf](../../manual/tinkerers-manual.pdf) address remains a byte-identical copy, so
existing links and tools keep working.

The manual cover, whole-manual page, Learn download, and Your book sample use the edition filename.
The generators and sample share `manual/pdf-edition.js`. A default PDF build writes the edition,
updates that module and the legacy copy, and rebuilds the manual and site links. Earlier edition
PDFs are kept; an explicit output filename makes a comparison build without publishing an edition.
The generated service worker version changes with the Learn page.

## Contents and navigation

Every contents entry has a printed page number, including the 20 chapters and appendices and their
88 sections. The builder reserves space for the numbers, reads the actual destinations from its
first PDF, and prints again until the numbers agree with the destinations. The numbers are ordinary
PDF text. A reader can enter one in a viewer's page-number control when tapping a link does nothing.

The build checks the final bytes with the already vendored PDF.js 6.3.289 before publishing:

- All 144 internal link annotations resolve to pages in the PDF.
- All 188 bookmarks resolve to pages and have their heading text immediately below their
  destination.
- All 108 printed contents numbers agree with their destinations and appear beside the corresponding
  link in the contents.
- No external annotation points to the local build server.

The standalone check also verifies the edition filename against its hash and the legacy copy against
the edition. The full results, including every destination page, are in
[navigation.json](manual-pdf-phone-2026-10/navigation.json). Examples: Chapter 1 starts on page 5,
Glossary on page 138, and Quick reference on page 150.

The checker's negative tests change a link to a nonexistent page, move a bookmark away from its
heading on a real page, and move a named contents destination without updating its printed number.
All three corrupted PDFs are rejected. The source contents count is also compared with the checked
count, including links whose opening or closing tags wrap across lines.

Rendered pages inspected: [contents start](manual-pdf-phone-2026-10/contents-start.png),
[chapters](manual-pdf-phone-2026-10/contents-chapters.png), and
[appendices](manual-pdf-phone-2026-10/contents-appendices.png).

## Viewer evidence and Android limits

| Viewer                                                                    | What was tested                                                                                                                                                                    | Result and limit                                                                                                                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF.js 6.3.289 viewer components in desktop Chromium 141.0.7390.37, Linux | Real rendered PDF and annotation layer at 390×844 and 1440×900. Click the Chapter 1 contents link, follow the Glossary bookmark, and type the printed Quick reference page number. | Reaches pages 5, 138, and 150, with the matching heading visible and no page error. The phone dimensions are a desktop browser viewport, not an Android test. |
| Chrome on Android                                                         | Not available here. Task 73 reports that it displayed the newer PDF and did not follow the contents links.                                                                         | Not retested. This PR does not establish that its internal-link behavior changed.                                                                             |
| Brave on Android                                                          | Not available here. Task 73 reports an older cached PDF and contents links that did not jump.                                                                                      | Not retested. The new download address avoids reusing the legacy PDF cache key.                                                                               |
| Google Drive viewer on Android                                            | Not available here. Task 73 reports contents links that did not jump.                                                                                                              | Not retested. No claim that Drive follows the new PDF's internal links or bookmarks.                                                                          |

The PDF.js viewer harness is test code using the existing pinned build-time package listed in
`LICENSES.md`; it is not shipped on the site. Screenshots of the manual download and the rendered
viewer are in `tests/screenshots/cdx-manual-pdf-*.png`. The tests exercise the PDF.js link service
and rendered contents annotations; they do not test Chromium's native PDF viewer, desktop Brave,
Android, or Google Drive.

Standard clickable destinations and bookmarks are preserved. Printed numbers provide the fallback;
there is no claim that this makes an Android viewer follow an internal link. A previously cached
legacy PDF can remain old until its viewer refreshes it. Current download links point to the new
edition address.

## Build and verification

The installed Chromium was 151, so the PDF was built with the pinned
[Playwright Chromium 1194 archive](https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/1194/chromium-linux.zip)
(141.0.7390.37) in `/tmp`. A temporary fontconfig file selected
[Inter 3.19](https://github.com/rsms/inter/releases/download/v3.19/Inter-3.19.zip) and the system's
DejaVu, Liberation, and Noto families. Neither browser nor fonts were installed into system
directories or added to the repository. Both browser and font guards passed without override flags:
DejaVuSans, DejaVuSansMono, Inter, LiberationSans, LiberationSerif, and NotoColorEmoji.

The previously shipped file has 154 pages. The original builder, run with this browser and font
setup, produces 153 pages too. Its chapter and appendix text, extracted without the footers and with
whitespace normalized, equals the new PDF's text. The affine arrow `p ↦ Ap + b` survives. Repeated
comparison builds and the published build produce identical bytes. The manual's source text and
demos were not edited; its two HTML changes are download addresses.

Checks:

```sh
node tools/manual-pdf-check.mjs
node manual/build-pages.mjs --check
node tools/site-build.mjs --check
npx prettier --check .
node tools/us-english.mjs --diff
```

Browser regression coverage: `tests/cdx-manual-pdf.spec.mjs`, `tests/man4-pages.spec.mjs`,
`tests/man5.spec.mjs`, `tests/man6.spec.mjs`, `tests/man9.spec.mjs`, and `tests/site.spec.mjs`,
using the same Chromium and font setup. All 91 selected checks have passing results across the runs:
9 task-specific checks, 71 manual regressions, and 11 site checks. The full repository suite was not
run. Standard screenshots generated by the regression specs are restored; only task-specific
screenshots are retained.

The initial combined run reported a failure in the existing offline service-worker test, then
stalled during artifact cleanup, and was stopped. The remaining four site checks passed separately.
For diagnosis, the offline case was run with trace collection disabled: it passed on clean main
`0b06f00e` in a separate worktree on port 4188 (1.7 minutes), and on this branch (47.2 seconds). The
initial failure is not explained. No existing spec, assertion, retry, skip, or threshold was
changed; these isolated runs do not make the original combined run a clean pass.

To rebuild, serve the checkout locally, run `node manual/build-pages.mjs`, and run
`SPLASHERY_CHROMIUM=<Chromium 141 executable> node tools/manual-pdf.mjs` with the required fonts
available. The default build refreshes the links automatically. Run the standalone check afterward,
and commit both PDF copies, the edition module, and the generated link changes. Keep prior edition
PDFs when publishing another edition.

No new runtime library, manual wording change, demo change, viewer workaround, or redirect page was
added. Android testing remains for a real device; PDF.js navigation and the printed page fallback
were tested here.
