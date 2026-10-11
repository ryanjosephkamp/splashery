# Lane Manual r5 (prefix `man5`)

## Brief

You are a Splashery worker session, started by the Operator (session_01A4ChKuJQqgoCrWAzQMpD4R). Repo: ryanjosephkamp/splashery. Your lane: Manual r5 (id `ManualR5`, prefix `man5`). Branch: `claude/lane-manual-r5`, started from `claude/lane-manual-r4` (PR #513, not merged yet; merge main into your branch once it is). PR title: "Phase Manual r5: chapter pages, the audit's fixes, and two new chapters". Handoff file: docs/handoff/ManualR5.md (create it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Sonnet 5.5, high effort.

Read CLAUDE.md, docs/HANDOFF.md, docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this lane runs", with your prefix and lane record), and the Manual lanes' handoffs (docs/handoff/ManualR3.md, ManualR4.md, especially "For the next round").

### Brief (written by the Operator on October 11, 2026, from the owner's notes of October 10 and 11)

The Tinkerer's Manual (manual/) is the owner's favorite long read. He loves the demos, the pop-up definitions and the folds; keep how they look. Length is no problem. Build in this order:

1. **Chapter pages.** Split the web manual into one page per chapter (call them chapters in titles and navigation; "Level N" stays inside the text only where it means a learning level), with Next and Previous buttons at the top and bottom. The full table of contents goes on the first page. The collapsible contents navigation is on every page, collapsed by default. Remove the standalone level map block (it duplicates the contents). Keep the PDF export complete (all chapters, in order). Delete nothing else: every demo, fold, pop-up and section stays. Old links (manual/#anchor) must still land on the right section (a small redirect is fine). Update the site and toy links that point into the manual, and your tests.
2. **The Codex audit's fixes.** The read-only audit is docs/audits/manual-audit-2026-10/REPORT.md on branch `codex/manual-audit-task34` (PR #509; read it with `git fetch origin codex/manual-audit-task34` and `git show FETCH_HEAD:docs/audits/manual-audit-2026-10/REPORT.md`). Fix every finding you agree with, highest severity first: F01 (Sharp view draws a textured relief, not splats; say Splashery is primarily splat-based), the PDF missing the 60 gallery programs, the stale limits, the gallery curves, the demo readouts, and the PDF's localhost download link. For a finding you disagree with, say why in the handoff with evidence. Make the PDF build reproducible if you can (pinned browser, the same bytes from the same input) or say what blocks it.
3. **Two new chapters.**
   - "How Splashery is built": how the code is organized (src/, src/packs/, tools/, tests/, vendor/), why (static files and ES modules only, no bundler or server), what PlayCanvas does for us (the WebGL/WebGPU renderer and splat sorting) and what is our own code, and every third-party library with its job, its license, and when it loads (LICENSES.md lists them). Accurate to the code: cite file paths.
   - "Share links and QR codes": a #s= link holds the whole scene as JSON, compressed with deflate-raw and written as base64url by src/codec.js ("d." prefix, or "j." uncompressed); it's not a hash or a server lookup, so nothing is stored anywhere and a hand-edited character usually breaks it; how a scene fits a QR code (the QR lanes' scene QR); old links keep loading (schema v2 and v3). A small live demo that encodes and decodes a tiny scene would be welcome.
4. Cards at phone size on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says (no republish), ids man5-…, naming Sonnet 5.5: the chapter navigation before and after, and each new chapter's demo.

You own: manual/, tools/manual-*.mjs (the PDF build), tests/man5*.spec.mjs (and the earlier man*.spec.mjs where the split changes them), the site's links into the manual, and your handoff file. Don't touch site/ pages beyond those links (a site lane will change What's New and the navigation). No engine changes.

How this lane runs: finish every working turn with "READY:", "WORKING:" or "BLOCKED:". For a long job, schedule a check-in with send_later instead of going idle. Before READY, run CLAUDE.md's "Before every push" steps. When main moves, merge it into your branch (never rebase). The Operator merges after a full suite and the owner's marks. After your READY, the owner runs a second Codex audit; you fix what it finds in the same PR.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Started October 11, 2026. Branch `claude/lane-manual-r5`.

- Step 1 (chapter pages): restored from `claude/lane-manual-r5-wip` (see ManualR4.md, "For the next round") and main merged. Working through verification.
- Steps 2 to 4: not started.

## Notes

## Known issues

## For the Operator
