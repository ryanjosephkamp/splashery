# Lane Site r2: the owner's walkthrough fixes for the site (prefix `st2`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the October push. Repo: ryanjosephkamp/splashery. Your lane: Site r2 (id `SiteR2`, prefix `st2`). Branch: `claude/lane-site-r2` (and `claude/lane-site-r2-engine` for any change to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Site r2: the owner's walkthrough fixes for the site". Handoff file: docs/handoff/SiteR2.md (create it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Sonnet 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026, from the owner's walkthrough review)

Read the owner's own words first: docs/reviews/2026-10-06-walkthrough/notes.md (dictated on his phone; he praised the site and asked for these refinements), then the Operator's triage in docs/reviews/2026-10-06-walkthrough/triage.md, section "Site r2". That section is your list. Anything the owner didn't mention is approved: change nothing else, and keep the look and layout he praised.

Read docs/handoff/Site.md and docs/handoff/SitePages.md first.

Notes on the list:
- Contact (item 1): his name is spelled as on the About page. His "My contact links" list came through empty, so use the links on his personal site until he confirms: https://ryanjosephkamp.github.io/ (his site), https://github.com/ryanjosephkamp, https://www.linkedin.com/in/rjk1999, https://x.com/ryanjosephkamp, https://www.youtube.com/@RyanJosephKamp, https://huggingface.co/ryanjosephkamp and https://ryanjosephkamp.github.io/blog/. No email unless he gives one. Keep the footer line quiet and small: "Made by Ryan Kamp" (or as About spells it) linking to the Contact page.
- New tabs (item 3) and toy names (item 4): one helper in tools/site-pages.mjs for "open in the app" links (target="_blank" rel="noopener") so every hub uses it. The Toy pages r2 lane does the toy pages themselves (tools/site-toy-pages.mjs): don't edit that file.
- The menu after Back (item 6): likely the back/forward cache restoring the open menu; close it on `pageshow` and on navigation. Test it.
- Guides as pages (item 7): build them from the Markdown at site-build time (tools/site-md.mjs may already help) so the page always matches the repo; each page links to its GitHub source. Find every GitHub document link on the site and convert the documents (not code).
- The outline (item 8): small, unobtrusive, keyboard and screen-reader friendly, at phone and desktop width; it must never cover the text or fight scrolling. One shared script for every long page.
- The loop graph (item 10): optional and last. docs/lane-loop.grooph.json exists. If you use the GROOPH npm package, vendor it under vendor/ (check its license; MIT or similar), load it only on that page and list it in LICENSES.md. Build it as an unlinked draft page and post a card for the owner; link it from "How Splashery is made" only after his yes.

You own: tools/site-build.mjs, tools/site-pages.mjs, tools/site-hubs.mjs, tools/site-md.mjs, tools/site-news.json, site/ (regenerate it with `node tools/site-build.mjs`, `npx prettier --write site`, then `node tools/site-build.mjs --check`), manual/index.html (links, the bottom links, the outline only; no wording changes), new shared site scripts and styles, and tests/st2*.spec.mjs. Not yours: tools/site-toy-pages.mjs and tools/tpg-*.mjs (Toy pages r2). Instead of clips, post before-and-after screenshots at 390×844 as cards on Effect review page 2 (ids st2-…).

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it; replace the prefix and lane record with yours). Your changes touch toys and pages the public sees, so the Operator merges them after a full test run (the Integrators run it) and the owner's "good" marks on your cards. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says (no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first READY within about four to six hours, then polish rounds on the owner's marks.

## State

WORKING (October 6, 2026). Model: Sonnet 5.5. No engine PR so far.

## Notes

## Known issues

## For the Operator
