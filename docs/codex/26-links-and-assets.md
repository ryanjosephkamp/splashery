# Codex task 26: broken links and dead assets

**Branch:** `codex/links-and-assets`, cut from `main`. **Output:**
`docs/audits/links-and-assets-2026-10.md` and one new script `tools/cdx-links.mjs` that reproduces
the check. Don't change any other file.

The site is static files served by GitHub Pages, and a wrong path is a silent 404. Nobody has
checked every link and file reference at once. This task finds the broken ones and the dead weight.

## Steps

1. **Write `tools/cdx-links.mjs`** (Node, no new dependencies, offline by default). It reads the
   repository and reports:
   - **Broken local references:** every `href`, `src`, `import`, `fetch(...)` and `url:` that points
     at a file in `index.html`, `embed/`, `site/**/*.html`, `manual/`, `pdf-lab/`, `worlds/`,
     `src/**/*.js`, `styles.css` and `manifest.webmanifest`, resolved the way the browser would
     (relative to the page, and to the `/splashery/` base on GitHub Pages), where the file doesn't
     exist. Include `sitemap.xml`, `site/search-index.json` and `site/sw.js`'s cache list.
   - **Broken Markdown links:** relative links and `#anchor` links in every `*.md` (anchors by
     GitHub's slug rule).
   - **Dead assets:** files under `assets/` and `site/assets/` that nothing references (by path, by
     the id-based paths toys build, e.g. `assets/toys/<id>/…`; say how you matched, and list the
     uncertain ones separately).
   - **Every toy:** each `src/toys.js` entry's `url`, `urlWeak`, thumbnail and credit link resolve.
   - **Case mismatches** (works on a Mac, 404 on Pages), and file names with spaces or characters
     that need escaping.
2. **Check outside links** (needs the web, in a second mode of the same script, `--web`): every
   `https://` link in `CREDITS.md`, `LICENSES.md`, `tools/assets.json`, `tools/models.json`, the toy
   credits in `src/` and the site pages. HEAD first, then GET when HEAD fails; two tries; a polite
   pace (no more than 4 requests a second to one host). Report status codes, redirects (to a new
   URL: give it) and links that need a login. A 403 from a bot-blocking site is "could not verify",
   not "broken". Never send any token or key.
3. **Write the report.** A summary of at most ten lines; then one table per kind (file, line, the
   reference, what's wrong); the dead-asset list with sizes and the total megabytes they could save
   (a proposal only: removing a file is a Claude lane's or the Operator's decision, because of
   `?`-style saved links and the `#s=` compatibility rule); and how to run the script again.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff`; run the script and
say its wall time. Open a draft PR titled "Codex task 26: broken links and dead assets".
