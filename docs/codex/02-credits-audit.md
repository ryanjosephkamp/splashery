# Codex task 02: the credits and license audit

**Branch:** `codex/credits-audit`, cut from `main`. **Output:**
`docs/audits/credits-audit-2026-10.md` only. Change nothing else: the Claude lanes fix what you
find.

Splashery may only ship assets under CC0, CC BY, CC BY-SA or the public domain. It never ships NC,
unlicensed, "personal use" or paid files. Each CC BY-SA asset shows its license notice beside it,
and anything made from it stays CC BY-SA (`CLAUDE.md`, "Ground rules"). Each asset's license is
recorded in three places:

- `CREDITS.md`;
- the build manifests `tools/assets.json` (captures) and `tools/models.json` (meshes turned into
  splats), plus `tools/sound-sources.json` for sounds;
- the toy's in-app credit (the `credit` field of its entry in `src/toys.js`, or its pack under
  `src/packs/`).

Vendored code is listed in `LICENSES.md`.

1. **List every asset the site ships.** That means every file under `assets/` (models, captures,
   sounds, images, fonts) and every vendored library under `vendor/`. Match each one to its manifest
   entry and its `CREDITS.md` entry. Flag files with no entry, and entries with no file.
2. **Check each license on its live source page.** Open the source URL and confirm:
   - the license and its version;
   - the author's name as the page gives it;
   - that the file we ship is the one the page offers.

   Flag any mismatch, dead link, license changed since we took the file, or license the rules don't
   allow. Say "not checked" where a page wouldn't open.

3. **Check the three records agree** for each asset: `CREDITS.md`, the manifest and the in-app
   credit name the same author, license and source. For CC BY and CC BY-SA, check that the in-app
   credit gives what the license asks for: the author, the license with a link, and the source.
   Every CC BY-SA asset and everything made from it must say CC BY-SA.
4. **Check the sounds** the same way (`tools/sound-sources.json`, `src/toy-sounds.js`,
   `CREDITS.md`).
5. **Check `LICENSES.md`** against `vendor/` and `package.json`: every vendored library and every
   build devDependency is listed with its license, and the license files ship where the license
   asks.
6. **Write the report.** Open with a summary of at most ten lines: the worst problems first, then
   counts. Then give one table per kind (captures, meshes, sounds, images and fonts, code), one row
   per asset: the asset, the license found, the source link you opened, and "OK" or what is wrong.
   End with a list of the exact fixes a lane should make, file by file.

Run `npx prettier --check docs/audits/credits-audit-2026-10.md` and
`node tools/us-english.mjs --diff` before you push.
