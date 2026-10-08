# Codex task 31: credits and licenses agree with each other

**Branch:** `codex/credits-consistency`, cut from `main`. **Output:**
`docs/audits/credits-consistency-2026-10.md` and one new script, `tools/cdx-credits-check.mjs`, that
reproduces the checks. Don't change any other file: the owner's license rules (CLAUDE.md, "Ground
rules") are strict, so every fix goes to the Operator.

Task 02 (`docs/audits/credits-audit-2026-10.md`) checked every asset's license on its source page.
This task checks the repository's own records against each other, offline, so a mismatch can't hide.
The records are: `CREDITS.md`, `LICENSES.md`, `tools/assets.json`, `tools/models.json`, the `credit`
objects in `src/toys.js` and `src/packs/*.js`, the in-app credit text, `site/` credits, and the
files under `assets/` and `vendor/`.

## Steps

1. **Write `tools/cdx-credits-check.mjs`** (Node, no dependencies, offline, prints a table and exits
   1 when it finds anything). It checks:
   - Every asset in `tools/assets.json` and `tools/models.json` has a license from the allowed list
     (CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, public domain; or the owner's special cases:
     AI-made by the owner, NASA media guidelines, Wikipedia text), a source URL, an author, and
     appears in `CREDITS.md`.
   - Every NC license carries `"nc": true`, and no asset is ND, unlicensed or "personal use" (search
     the license strings for `ND`, `NoDerivatives`, `personal`, `unknown`, empty).
   - No asset merges a BY-SA with an NC asset (look for assets that list both as sources).
   - Every toy with `kind: "captured"` or a model-based recipe has a `credit` with title, author,
     source and license, and the license in the toy equals the one in `assets.json` or
     `models.json`.
   - Every file under `assets/` belongs to a toy or a record (list the orphans), and every record
     points at a file that exists.
   - Every library under `vendor/` appears in `LICENSES.md` with its version and license, and the
     version matches `vendor/` or `package.json`; every devDependency in `package.json` is in
     `LICENSES.md`.
   - Everything `node tools/nc-assets.mjs` lists is consistent with the `nc` flags.
2. **Run it** and also run `node tools/nc-assets.mjs`. Don't fix records yourself.
3. **Write the report:** a summary of at most ten lines; a table of every mismatch (record, file and
   line, what disagrees, the likely correct value and how you know from the repository); the
   orphans; the records you couldn't check offline and why; how to run the script. Don't paste long
   license texts.

No web needed (the web checks are task 02's and task 26's). Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft PR titled "Codex task
31: credits and licenses agree with each other".
