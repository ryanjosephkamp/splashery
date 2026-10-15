// Task 58: build the audit tables and this task's additive credit block from measured evidence.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { THEMES } from "./cdx-qr-themes-art.mjs";
import { LINKS } from "./cdx-qr-themes-links.mjs";
import { requirePassedMatrix } from "./cdx-qr-themes-evidence.mjs";
import { EVIDENCE } from "./cdx-qr-themes.mjs";
import { THEME_PICTURES } from "../src/qr-craft/theme-pictures.js";

const selection = JSON.parse(fs.readFileSync(`${EVIDENCE}/selection.json`));
const layouts = THEMES.flatMap(([theme]) =>
  JSON.parse(fs.readFileSync(`${EVIDENCE}/layout-${theme}.json`)),
);
const renders = THEMES.flatMap(([theme]) =>
  JSON.parse(fs.readFileSync(`${EVIDENCE}/browser-${theme}.json`)),
);
const verificationFile = `${EVIDENCE}/verification.json`;
const verification = fs.existsSync(verificationFile)
  ? JSON.parse(fs.readFileSync(verificationFile))
  : [];
const kept = selection.filter((s) => s.kept);
for (const r of kept) {
  requirePassedMatrix(
    layouts.find((l) => l.id === r.id),
    "layout",
  );
  requirePassedMatrix(
    renders.find((b) => b.id === r.id),
    "browser",
  );
}
execFileSync("python3", ["tools/cdx-qr-themes-sheets.py"], { stdio: "inherit" });
const csv = [
  "id,theme,link,characters,layout_phone,layout_small,render_phone_330,render_print_900_focus,render_8ppm,render_4ppm,raw_900_diagnostic,detail",
];
for (const r of kept) {
  const l = layouts.find((l) => l.id === r.id),
    b = renders.find((b) => b.id === r.id);
  for (let i = 0; i < LINKS.length; i++)
    csv.push(
      [
        r.id,
        r.theme,
        JSON.stringify(LINKS[i]),
        LINKS[i].length,
        ...l.links[i].scans.map((s) => Number(s.ok)),
        ...b.links[i].scans.map((s) => Number(s.ok)),
        Number(b.links[i].raw900),
        l.links[i].score.toFixed(6),
      ].join(","),
    );
}
fs.writeFileSync(`${EVIDENCE}/scan-table.csv`, csv.join("\n") + "\n");
let doc = `# Picture QR theme packs: October 14, 2026

Made by Ryan with Codex (GPT-6), on \`codex/qr-theme-packs\`; work started from main
\`e404cf36\` after [task 54, PR #582](https://github.com/ryanjosephkamp/splashery/pull/582)
merged. **48 original code-made backgrounds: eight distinct subjects in each of six themes,
selected from ${selection.length} candidates.** Every retained background passed all ten links and all 60
qualifying checks at the toy's default settings. Rule check: none.

## Artwork, credit, and loading

The initial 120 candidates are ten different illustrations per theme in two paper/contrast
treatments. Seasons initially yielded only seven passing subjects, so six additional independent
warm/dusk treatments of Spring blossom, Tulip, and Pumpkin, followed by two treatments each of
Winter fir and Autumn acorn, were screened with the same ten links and unchanged acceptance
criteria. Patterns received two additional original geometric motifs, Large chevrons and Nested
squares, in two treatments each, after its initial set also yielded only seven passing subjects.
Forest likewise had seven passing subjects; two original leaf illustrations, Ginkgo fan and
Birch branch, were added in two treatments each and tested with the same unchanged criteria.
The original SVG source is [cdx-qr-themes-art.mjs](../../tools/cdx-qr-themes-art.mjs).
The generator takes a theme, motif, and variant; it never receives a URL, QR mask, or module grid.
The subjects have broad shapes, quiet corners, and restrained detail, following
[task 54's findings](sample-pictures-2026-10.md). The slight off-center composition is intentional:
many motifs sit around (54, 52) in the 100-unit square, slightly right and below its center.
The offsets and asymmetric shapes leave quiet space near the corners for the code's fixed
finder patterns, helping the subject remain recognizable where those patterns cover the image.
These positions are fixed in the original artwork and reused for every link; the QR grid keeps
its normal position. Pattern backgrounds are made by code.
Space-art is fictional illustration, labeled “imaginary art” in each choice; it is never a sky
capture or scientific data. Celebrations have no text, logos, people, or real-country flags.
All six source contact sheets and all six final phone sheets were visually inspected.

All new assets are offered under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
(deed opened October 14, 2026), credited “Made by Ryan with Codex (GPT-6).”
All 48 shipping pictures are code-made; none is AI-made. Each selected option says “code-made, CC0”; the About credit names
the maker, source, and license. Full records, hashes, generation notes, and tested links are in
[tools/assets.json](../../tools/assets.json), under \`pictureQrSamples\`, and
[CREDITS.md](../../CREDITS.md).

The existing Picture select uses one native option group per theme. Existing choices and the
Felt farm default keep their IDs and order. The manifest contains only metadata; a JPEG is
fetched only after selecting it. Each 960×960 shipping JPEG is produced by Chromium
151.0.7922.173 at quality 88. Contact sheets use the repository's licensed Pillow 12.3.0.
The shipped assets total ${(THEME_PICTURES.reduce((n, s) => n + fs.statSync(s.file).size, 0) / 1024 / 1024).toFixed(2)} MiB;
none is loaded on the initial page or when opening Picture QR with its default picture.

## Ten-link scan protocol

The synthetic links below are encoded, never fetched. They include HTTP, HTTPS, query strings,
fragments, escaped characters, and short and long payloads.

${LINKS.map((s) => `- ${s.length} characters: \`${s}\``).join("\n")}

Every trial uses the production encoder and vendored jsQR: H error correction, contrast 0.5,
small center, color style, square shape, and More detail. The production adaptive nudge remains
enabled; each link's actual margin is recorded. No setting is changed to rescue a candidate.

All ${selection.length} candidates have ten-link layout measurements at the production check's 8 and 4
pixels/module with 0.2-module focus blur (20 checks per candidate). The worst-link detail score
ranks candidates. Score-ranked candidates then load through the toy's actual local-file decoder
and real Chromium 151.0.7922.173/WebGL2 splat renderer (ANGLE/Mesa llvmpipe) at a 390×844 viewport,
with the mid profile and automatic performance adaptation disabled. Each link is captured with the
production export camera at 900×900, with task 54's two full-size render frames and 80 ms sort
wait. The [capture helper](../../tools/cdx-qr-themes-capture.mjs) transfers the same PNG as base64
instead of a per-number array. Its RGBA is byte-identical to the original helper for a short
HTTP URL, an HTTP query, and the longest link; see
[the protocol check](qr-theme-packs-2026-10/capture-protocol.json). Four qualifying
rendered decodes follow: the unblurred 330-pixel phone reduction, the 900-pixel print-focus
simulation (0.2-module Gaussian blur), and reductions to 8 and 4 pixels/module. A candidate
must pass all 40 rendered checks as well as all 20 layout checks. Selection retains the top
eight passing distinct subjects per theme, using only the best eligible variant of a subject.
Lower-ranked candidates need no browser screening once eight distinct higher-ranked ones pass.

**Print focus is a simulation on real rendered pixels, not a physical print or camera test.**
The raw 900-pixel decode is a separate diagnostic in every rendered trial and in the table below.
Unresolved halftone dots at that resolution can confuse jsQR, as task 54 documented; raw exports
are not claimed to scan perfectly. No failed qualifying trial is omitted or replaced. The
finite ten-link benchmark does not guarantee every possible link, angle, camera, or lighting
condition. Long payloads can exceed practical phone resolution.

The detail score is task 54's metric, measured against the actual stored JPEG with the production
woven colors averaged per module:
\`100 × (0.55 × (1 − RGB_MAE) + 0.45 × max(0, gradient_cosine))\`.
The reported score is the minimum over all ten links, including forced finder areas. It measures
color and edge preservation, not semantic recognition; the phone sheets provide the visual check.

## Kept backgrounds and phone contact sheets

The full per-link [scan table](qr-theme-packs-2026-10/scan-table.csv) has all 480 retained-background
link trials. The JSON evidence also contains source hashes, versions, adaptive margins, image
properties, per-link detail scores, scan results, and hashes of the actual rendered RGBA.

`;
for (const [theme, group] of THEMES) {
  doc += `### ${group}\n\n![${group}: eight actual 330-pixel phone renders](qr-theme-packs-2026-10/${theme}-phone.jpg)\n\n`;
  doc +=
    "| Background | Worst-link detail | Layout checks | Rendered checks | Raw 900px diagnostic |\n| --- | ---: | ---: | ---: | ---: |\n";
  for (const r of kept.filter((r) => r.theme === theme)) {
    const l = layouts.find((l) => l.id === r.id),
      b = renders.find((b) => b.id === r.id);
    doc += `| ${r.name} | ${r.score.toFixed(3)} | ${requirePassedMatrix(l, "layout")} | ${requirePassedMatrix(b, "browser")} | ${b.links.filter((l) => l.raw900).length}/${b.links.length} |\n`;
  }
  doc += `\n[All ${layouts.filter((r) => r.theme === theme).length} source candidates](qr-theme-packs-2026-10/${theme}-candidates.jpg),
[layout measurements](qr-theme-packs-2026-10/layout-${theme}.json), and
[rendered measurements](qr-theme-packs-2026-10/browser-${theme}.json).\n\n`;
}
doc += `## All ${selection.length} candidate decisions\n\n[Machine-readable selection](qr-theme-packs-2026-10/selection.json). Every cut has a reason.\n\n| ID | Subject | Worst-link detail | Decision |\n| --- | --- | ---: | --- |\n`;
for (const r of selection)
  doc += `| ${r.id} | ${r.name} | ${r.score.toFixed(3)} | ${r.kept ? "Keep" : "Cut"}: ${r.reason} |\n`;
doc += `
## Reproduction and verification

From the repository root, with its devDependencies and Chromium already installed:

\`\`\`sh
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-qr-themes.mjs --generate
node tools/cdx-qr-themes.mjs --screen
# In another terminal: python3 -m http.server 4173 --bind 127.0.0.1
# For the measured Mesa path, start Xvfb on :88, then set:
# DISPLAY=:88 LIBGL_ALWAYS_SOFTWARE=1 LP_NUM_THREADS=1 SPLASHERY_GL=llvmpipe
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-qr-themes-browser.mjs
node tools/cdx-qr-themes.mjs --select
node tools/cdx-qr-themes-report.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/cdx-qr-themes.spec.mjs
SPLASHERY_CHROMIUM=/usr/bin/chromium npx playwright test tests/qr*.spec.mjs tests/{smoke,kit,help,hta,unit,taps}.spec.mjs
npx prettier --check .
node tools/us-english.mjs --diff
\`\`\`

Screening resumes only when a candidate's recorded JPEG hash, current payload list, default options,
and exact scan matrix match. Passing records require all ten links and every expected trial.
Delete this task's layout
and browser JSON to force a complete remeasurement. The generator regenerates all ${selection.length} sources in
\`.cache/qr-themes\`; only the 48 kept JPEGs ship. Run Prettier on generated text files after
selection/reporting. The artwork regression checks deterministic, payload-independent SVG output.
Browser regressions exercise all 48 selected backgrounds with HTTP, the default HTTPS link, and
the longest query-string link, the actual picker, production scan check, and production PNG export.
Each theme also compares the screening helper's RGBA exactly with the production PNG export.

${verification.length ? `| Check | Method | Result |\n| --- | --- | --- |\n${verification.map((r) => `| ${r.check} | ${r.method} | ${r.result} |`).join("\n")}` : "Verification results are pending the final runs."}

The initial existing-suite failures were checked against an isolated archive of main's sources
at \`c044dc9d\` (documentation merge \`d40261ee\` has identical runtime sources):

- \`tests/kit.spec.mjs:87\`, “every kit toy has a recipe that builds deterministically and fits the unit ball,”
  hits the existing circular Picture QR guard at its 8,000-splat budget,
  using the unchanged Felt farm default. [Narrow CPU reproduction](qr-theme-packs-2026-10/baseline-circle.json).
- \`tests/qr4-craft.spec.mjs:142\`, “the QR code toy builds the very same splats from the shared builder,”
  produces \`d98ad9f6…\`, rather than its recorded \`b3918a78…\`,
  on both baseline and feature under Node 24.19.0. [Hash reproduction](qr-theme-packs-2026-10/baseline-shared-builder.json).
- \`tests/qrc-picture.spec.mjs:119\`, “Picture QR in the browser: the splats read back, the PNG reads back, and a tap ends on a code that reads,”
  uses legacy Wildflowers and reads \`null\` at both stage scales after its flip, on baseline,
  full feature run, and isolated feature rerun. Its initial stage and PNG checks pass.
- \`tests/smoke.spec.mjs:978\`, “the Toy tab has the essentials, and Reset everything takes a toy back to how it started,”
  leaves the France pattern on Jelly blob in the baseline and full feature
  run; its isolated feature rerun passes. This result is inconsistent between runs.
  [Both browser reproductions](qr-theme-packs-2026-10/baseline-browser.json).

Wildflowers and Reset are not established flakes, and these earlier failures were not waived.
No existing assertion was changed or skipped. All 59 new theme
tests pass. Physical phone-camera and print measurements remain unmeasured.

Main updates through \`11d83626\` were merged after the full runs, as required by the handback
rules. Those upstream runtime edits only version the notebook's manual PDF reference and update
its showcase byte estimate. QR encoding, rendering, controls, and scan inputs are unchanged.
The task's diff against main contains no manual or existing-test edits.

For the Operator's follow-up, current main \`6c3764ff\` was also merged into this branch.
It includes the upstream engine change that lets recipes disable render-resolution adaptation
within device profile caps. The exact unchanged Wildflowers and Reset cases both pass on an
isolated archive of this current main (38.7 and 26.8 seconds). The circular QR guard still
reproduces in a narrow Node build at 8,000 splats, and the exact shared-builder case still
fails with the same two hashes. These current measurements supersede the older baseline for
the two browser cases; they do not establish either case as a known flake.
The same unchanged cases also pass on the updated PR branch (44.5 and 24.7 seconds).
The focused feature run has **7 passed and 2 failed** in 5.8 minutes: both browser cases and
five theme metadata/viewport checks pass; the broad kit guard and shared-builder hash still fail.
The earlier browser failures' cause remains undetermined; no additional runtime fix was made.
See [the Operator follow-up measurements](qr-theme-packs-2026-10/operator-recheck.json).

## Credits-page follow-up: October 15, 2026

Merged current main \`d1f300b4\` for the Operator's merge-batch follow-up. The committed
credits page initially omitted the task-58 section. Rebuilding exposed the remaining failure:
the first-column header “Theme” was treated as an entry by \`tests/spg.spec.mjs\`, while the
page's CSS displays that header as “THEME.” The rebuilt-page run had seven passes and this
one failure, with only “Theme” in its missing-entry list.

The theme-pack table now uses the standard “Name” header and puts each picture's name first,
followed by its theme, file, maker, and license. This also makes the unchanged credits test
check all 48 picture names individually. The original credit content from current main is
preserved, and every new link uses a plain address. The site Markdown reader is unchanged.
The report generator writes the corrected table, and \`node tools/site-build.mjs\` regenerates
the credits page, the Picture QR toy page's credit, and the service-worker version.
Main \`3d43af20\` was subsequently merged, bringing Powers of ten labels and checkpoint
documentation; the site was rebuilt again with both branches' generated pages included.

## Scope, deviations, and cuts

No renderer, encoder, manual, existing test, Photo to 3D, Moving photo, or Video to 3D source was
edited. \`tests/taps.spec.mjs\` is unchanged. The only shared-list edits are the new task-58 credit
block and 48 new \`pictureQrSamples\` records, explicitly required by this task. Existing records
and credit text are preserved, including those touched by open PRs #560 and #562; no files owned
by #581 are changed. PR #566 was already merged when this task started.

All artwork is code-made, a permitted choice in the brief. Unselected subjects and unused
palette variants are cut by the score/diversity rule or scan results above. There is no new
runtime library, thumbnail prefetch, server call, or payload-derived background. The generated
\`site/\` copy is rebuilt for the Operator's credits-page follow-up.

## Task record

- Identity: task 58, Picture QR theme packs; toy \`qr-picture\`; branch
  \`codex/qr-theme-packs\`; status implemented. Made by Ryan with Codex (GPT-6), October 14, 2026.
- Recipe contract: existing Picture QR build, prepare, controls, local-file input, scan check,
  credit, and PNG export hooks are reused. This task adds sample metadata and option groups;
  recipe units, axes, pivots, part IDs, quaternion order, and host APIs remain those of
  \`src/packs/qr-craft.js\`. No new moving parts or quaternion code.
- Generation: the commands above run in the Linux x86-64 cloud workspace, using Node 24.19.0,
  Chromium 151.0.7922.173, Python 3.12.14, and Pillow 12.3.0. Deterministic geometry; no random seed.
  All generation and test libraries already appear in \`LICENSES.md\`; no runtime library is added.
- Assets: the 48 file-by-file source, maker, CC0, check-date, SHA-256, and change records are in
  \`tools/assets.json\` and \`CREDITS.md\`. The change is original SVG rasterization, with no
  third-party image input. Sources are never a scientific or photographic capture.
- Boundaries: production encoder, reliability nudge, picture decoder, renderer, UI select,
  credits, and export are reused. New artwork, lazy metadata, generation/screening tools,
  evidence, and regressions are added. Print focus is simulated; physical printing is unmeasured.
- Executed evidence: browser scans are real Chromium renders decoded by jsQR; layout scans are
  production CPU rasterizations. Neither uses mocked decode results. The verification table
  records the regression and pre-push results. Static pictures have no new motion effect.
- Performance: total shipped JPEG bytes are recorded above; all 48 lazy requests are checked in
  the browser regressions. Per-tier splat bytes, device load time, memory, and frame rate are
  unmeasured. There is no renderer or encoder change; no comparative performance claim is made.
`;
fs.writeFileSync("docs/audits/qr-theme-packs-2026-10.md", doc);
const marker = "\n## Picture QR theme packs (Codex task 58)\n";
let credits = fs.readFileSync("CREDITS.md", "utf8");
const index = credits.indexOf(marker);
if (index >= 0) {
  const next = credits.indexOf("\n## ", index + marker.length);
  credits = credits.slice(0, index) + (next < 0 ? "" : credits.slice(next));
}
credits +=
  marker +
  `
48 original code-made illustrations, selected from ${selection.length} candidates, **Made by Ryan with Codex
(GPT-6)**. All are offered under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
checked October 14, 2026. Source: [the original illustration generator](tools/cdx-qr-themes-art.mjs).
Fictional artwork; Space-art is imaginary art, never a real capture or scientific data.
Chromium 151.0.7922.173 rasterizes the original SVG to 960×960 JPEGs at quality 88. No source
picture uses a QR payload or grid. Each choice says code-made; pictures load only when selected.
The complete records and SHA-256 hashes are under \`pictureQrSamples\` in \`tools/assets.json\`.
See [the scan report](docs/audits/qr-theme-packs-2026-10.md) for ten-link results and detail scores.

| Name | Theme | File | Maker | License |
| --- | --- | --- | --- | --- |
`;
for (const s of THEME_PICTURES)
  credits += `| ${s.label} | ${s.group} | [JPEG](${s.file}) | Made by Ryan with Codex (GPT-6) | CC0 1.0 |\n`;
fs.writeFileSync("CREDITS.md", credits);
console.log(
  `Wrote report, ${kept.length * LINKS.length} scan-table rows, 12 contact sheets, and additive credits.`,
);
