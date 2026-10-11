# Lane Site r3: What's new as a gallery, Playground, and toy dates (prefix `st3`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01GX3jNDDvRMLYjDGmHuDmNN). Repo: ryanjosephkamp/splashery. Your lane: Site r3 (id `SiteR3`,
prefix `st3`). Branch: `claude/lane-site-r3` (and `claude/lane-site-r3-engine` for any change to the
app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Site r3: What's new
as a gallery, Playground, and toy dates". Handoff file: docs/handoff/SiteR3.md (create it; start it
with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known
issues" and "## For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this
lane runs", with your prefix and lane record), then docs/handoff/Site.md, docs/handoff/SitePages.md
and docs/handoff/SiteR2.md.

### Brief (written by the Operator on October 11, 2026, from the owner's requests of October 10 and 11)

1. **What's new as a visual gallery.** Turn the site's What's new page (site/new/, built from
   tools/site-news.json and the merges) into a visual gallery: new toys (each with its thumbnail,
   name, the date it arrived and a link to its toy page), new features, and before-and-after fixes
   (a before and an after picture side by side, with one plain line). Nothing operational: no lanes,
   PR numbers, batches, tests or model names. Newest first. It must read well at 390×844 and
   1440×900, and load fast (lazy images, thumbnails that already exist in the repo where possible).
2. **"Gallery" becomes "Playground".** Rename the app's Gallery (index.html: the button, its title,
   its aria-label, and every place the word shows to people, including help text and the site's
   pages) to "Playground". Keep code identifiers, ids, keyboard shortcuts, `#` links and saved
   scenes exactly as they are, so old links keep working. The app's index.html isn't a site file:
   put that change on `claude/lane-site-r3-engine` as a small "Engine: …" PR.
3. **A date for every toy, with a newest-first view.** Give every toy the date it first arrived on
   main (from git history: the first commit that added its id to src/toys.js or its pack; write a
   small tool in tools/ that derives the dates and stores them in one JSON file you own, so later
   toys get theirs the same way). Show the date on each toy page, and add a "Newest first" order to
   the site's toy lists (and the app's Playground if it fits cleanly; that part goes in the engine
   PR too). Keep the existing orders as they are.
4. **Description tags.** Give every page under site/ a `<meta name="description">` (and the matching
   `og:description`) written from the page's own content: the toy's About line for toy pages, a
   one-sentence summary for hubs and guides. American English, under about 160 characters. Add a
   test that every page has one and that none is empty or duplicated across unrelated pages.

You own: tools/site-build.mjs, tools/site-pages.mjs, tools/site-hubs.mjs, tools/site-md.mjs,
tools/site-news.json, tools/site-og.mjs, tools/site-toy-pages.mjs (dates and descriptions only), a
new tools/toy-dates.mjs and its JSON, site/ (regenerate it with `node tools/site-build.mjs`,
`npx prettier --write site`, then `node tools/site-build.mjs --check`), shared site scripts and
styles, and tests/st3*.spec.mjs. Not yours: manual/ and tools/manual-*.mjs (Manual r5 is running
there), and any toy's code. Don't change the look and layout the owner praised beyond these items.

Cards: before-and-after screenshots at 390×844 (What's new, the Playground button, a toy page with
its date, the newest-first list) on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids st3-…, naming Sonnet 5.5, as
docs/OPERATING.md, "Steps for a lane", says (no republish).

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). The app's Playground rename is something the public sees, so the
Operator merges after a full test run and the owner's "good" marks on your cards. Finish every
working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long
job, schedule a check-in with send_later instead of going idle. Before READY, run CLAUDE.md's
"Before every push" steps (the specs your change touches plus site, spg, tpg, smoke, help and unit;
the Operator's batch runs the full suite). When main moves, merge it into your branch (never
rebase). Usage is tight until the weekly reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers
unless you must, and aim for a first READY within about four hours.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. October 11, 2026. Lane branch
`claude/lane-site-r3`, engine branch `claude/lane-site-r3-engine` (merged into the lane branch so
the Playground test passes).

1. **What's new**: `site/new/` is now three parts, each newest first: New toys (thumbnail, name,
   arrival date, link; the newest 24 public toys plus the newest 24 labs toys, which show with the
   labs switch), New features (cards from `features` in `tools/site-news.json`, optional toy
   picture) and Fixed, before and after (`fixes`: two thumbnail versions side by side, one line).
   The merged-PR lists and `changelog()` are gone. Pictures are copied once by
   `node tools/site-news-shots.mjs` into `site/assets/news/` (git refs named in the JSON).
2. **Playground**: engine PR `claude/lane-site-r3-engine`: `index.html` button title and aria-label,
   the close button, and the two help lines. Ids, `G`, `#s=` links and code names unchanged. The
   site's pages and tool text say "Playground" ("Open in the Playground", "Open the Playground",
   footer "The Playground"). Tests that looked for "Open in the gallery" (site, tp2, tpg specs) now
   look for "Open in the Playground".
3. **Toy dates**: `tools/toy-dates.mjs` (one pass over the first-parent history, merge dates; falls
   back to a pickaxe search, then to the branch's newest commit) writes `tools/toy-dates.json` (461
   toys). It only adds, so a shallow clone keeps old dates. The build calls `toyDates()`, so a toy
   added in a lane gets a date on its page before the JSON is updated. Each toy page has an
   "Arrived" row; the Toys, Studio and Science lists have "Order: By shelf | Newest first" (shared
   `site.js`; `#newest` opens it).
4. **Descriptions**: toy pages use the toy's About line (first sentences, 60 to 160 characters,
   abbreviation-safe); the player page (`play/`) got one; hubs and guides already had them.
   `tests/st3.spec.mjs` checks every page: present, 20 to 160 characters, `og:description` equal,
   none shared.

Tests: `tests/st3.spec.mjs` (8). Ran with it: site, spg, tpg, tp2, st2, smoke, help, unit, ui2,
ui5-engine (see PR for results).

## Notes

- Not done: "Newest first" in the app's Playground. It would need a new control and a fetch of the
  dates JSON in the app; it did not fit cleanly, so the engine PR is the rename only.
- The Operator's upkeep should run `node tools/toy-dates.mjs` after merges (adds dates for new toys;
  never changes one).
- Fix pairs use existing thumbnails at two points in history (fireworks, sunglasses, orange, the
  real Venus, the 5-cell). The Venus and 5-cell are labs toys, so their cards show with the labs
  switch.

## Known issues

- Public view of New toys shows toys from late September, because almost everything since is in the
  labs.

## For the Operator

- Merge the engine PR first, then the lane PR. Run `node tools/toy-dates.mjs` in the upkeep.
- Cards for the owner (st3-…) go on Effect review page 2; see State below once posted.
