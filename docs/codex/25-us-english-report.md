# Codex task 25: the American English sweep, report first

**Branch:** `codex/us-english-report`, cut from `main`. **Output:**
`docs/audits/us-english-sweep-2026-10.md` only. Don't change any other file.

CLAUDE.md says new public text is American English and that "one sweep" will fix the older British
text before the blog post: "Don't rewrite older British text on the side." Before that sweep, the
owner wants a report he and the Operator can review: what is there, where, and which hits are safe
to change. `tools/us-english.mjs` already lists British spellings (it never changes a file).

## Steps

1. **Run it over everything.** `node tools/us-english.mjs` with no options lists every hit in public
   text (Markdown outside `docs/reviews/`, strings in `src/**/*.js`, `index.html`, `embed/`). Also
   run it on `site/`, `manual/`, `worlds/`, `pdf-lab/` and the `README.md`, and read the script to
   say what it does not cover.
2. **Sort every hit** into one of these kinds, with a count for each:
   - **Safe:** visible words on the site or in a doc (color, center, gray, license, -ize).
   - **Stored:** an identifier, a file name, an option key or something saved in a link or a scene
     (`colour` in a saved option, a `#s=` key). Changing it breaks old links; say which keys.
   - **Quoted:** a source's title, an author, a proper name or a quotation (`Centre Pompidou`, a
     paper's title), which stays as written.
   - **Owner's words:** `docs/reviews/` and anything quoting the owner verbatim.
   - **False positive.**
3. **Find what the script misses.** Search the same text for British forms it doesn't list:
   -ise/-isation words, -our words, `programme`, `whilst`, `towards`, `learnt`, `tyre`, `kerb`,
   `grey` in strings, British date forms (`7 October 2026`), `metre` for the unit (the unit is
   "meter" in American English text; `metre` for poetry stays), and units spelled the British way.
   Propose additions to the script's word lists, as a patch in the report (don't edit the script).
4. **List the files** with the most safe hits, then give a plan: which files to change in what
   order, which a Claude lane owns (check `docs/WORKSTREAMS.md`; a lane's files change in its PR),
   and which tests contain British text that a change would break (grep `tests/` for the strings).
5. **Give the exact edit list** for the safe hits as a table (file, line, old, new), as a separate
   appendix file `docs/audits/us-english-sweep-2026-10-edits.md` if it has more than 200 rows.

Report open: a summary of at most ten lines. No web needed. Before you push:
`npx prettier --check docs/audits/us-english-sweep-2026-10*.md` and
`node tools/us-english.mjs --diff` (the report quotes British words, so it will list them: say so in
the PR, and put quoted words in code spans to keep the noise low). Open a draft PR titled "Codex
task 25: the American English sweep, report first".
