# Codex task 98: Splashery v1.0: every labs toy ready, then public

**Branch:** `codex/release-v1`, cut from `main` after Ops PRs carrying tasks 91 (#671) and 96 (#670)
have merged; if they haven't, cut from `main` and merge `main` again once they have. One draft PR
against `main`. Read `AGENTS.md`, `builders/RULES.md`, CLAUDE.md, and `docs/OPERATING.md` ("Merging
and conflicts").

## Why

The owner's call of October 16, 2026: every labs toy goes public at the v1.0 release, and the
release is named v1.0. The Featured shelf stays in his order with the Studio first. Today 106 toys
carry `labs: true` in `src/toys.js`; a visitor without `?labs=1` sees none of them. Before they go
public, each one has to meet the bar the public shelf already meets.

## Part 1: the readiness audit (do this first; change nothing yet)

A tool, `tools/release-audit.mjs`, that opens every labs toy at 390×844 and 1440×900 in normal mode
with the toy's labs flag lifted for the run (for example `?labs=1&first-toy=<id>`), and records for
each:

1. **Loads:** ready within 20 s on the phone profile, no `pageerror`, no failed request, the canvas
   not blank (sample pixels), and a tap on its center runs without errors.
2. **Text:** a how-to line and About text in `src/toy-help.js`, a sound in `src/toy-sounds.js`, an
   entry in `tools/toy-plan.json`, a thumbnail, and a site page under `site/toys/`.
3. **Licenses:** every asset it loads is in `tools/assets.json` or `tools/models.json` with a
   license CLAUDE.md allows; CC BY-SA and CC BY-NC assets show their notice beside the toy (in its
   in-app credit); NC assets carry `"nc": true` (`node tools/nc-assets.mjs` lists them); credits are
   in `CREDITS.md`.
4. **Words:** American English with the serial comma in its public text (`node tools/us-english.mjs`
   on its lines), no "labs", "prototype", "beta", or "coming soon" wording that would read wrong
   once it's public.
5. **Live input and data:** a toy that uses the microphone, camera, screen, location, or a live feed
   asks only on a tap and shows the source and time of live data, as CLAUDE.md requires.

Write the result to `docs/audits/release-v1-2026-10/README.md` as one table (toy, shelf, each check
pass or fail with the reason) plus the phone and desktop screenshots of every toy in a folder there
(WebP, about 60 KB each; keep the folder under 30 MB). Post the table in the PR body before Part 2.

## Part 2: fix what the audit found

Fix each failure at its cause, toy by toy, with the smallest change that passes. Follow CLAUDE.md's
"Effect quality rules" when a fix touches an effect. A toy that can't be made ready in this task (a
broken capture, a missing license, a heavy model) stays in labs; list each one with the reason and
what would unblock it. Don't change toys the owner already marked good beyond what the audit needs.

## Part 3: make them public

1. Remove `labs: true` from every toy that passed. Keep the labs switch itself (`labsOn()`,
   `?labs=1`, `?labs=0`) for future work in progress, and keep the engine experiments it gates (the
   kernel picker, gloss, GPU fields, `readSplats`) behind it: they are not toys.
2. **Site sections:** the Studio is toys and goes public with them. The Worlds, Lab, and Learn
   sections are not toys: leave them as they are and list in the PR body what each would need to go
   public, for the owner to decide.
3. Update every test that asserts a toy is hidden in normal mode (for example the shelf counts,
   `cmp2-engine`, the Featured list in normal mode) so it checks the new public state just as
   strictly. Never skip, loosen, or delete a check; a test about the labs switch itself should keep
   testing it with a toy or feature that is still behind it.
4. Old `#s=` links, saved scenes (schema v2 and v3), and embeds keep loading
   (`tests/cdx-compat*.spec.mjs` and task 65's corpus if it has merged).
5. Regenerate the generated files with the repo's tools (`node tools/toy-plan.mjs`,
   `node tools/site-build.mjs`, `node tools/shw-facts.mjs`, thumbnails with `tools/make-thumbs.mjs`
   where missing).

## Part 4: the release notes

`docs/releases/v1.0.md`: what Splashery is in two sentences, what v1.0 contains (the shelves and
their toy counts, the Studio tools, the manual), what is new since the toys were labs-only, known
limits (phones without WebGL2, very slow renderers), and the credits pointer. American English,
plain words, no marketing claims. The owner adds the git tag and the GitHub release from this text;
the Operator saves the checkpoint branch after the merge.

## Verification

- The audit table, before and after Part 2.
- The full spec list for every area you touch, run with `node tools/suite.mjs --jobs=2` under GitHub
  Actions' setup (`SPLASHERY_GL=llvmpipe`, the SwiftShader list in `tools/suite.json`), plus
  `smoke`, `kit`, `taps`, `help`, `hta`, `unit`, and the compat specs. Counts in the PR body. The
  Operator adds the `full-suite` label after review.
- Screenshots at 390×844 and 1440×900 of the normal-mode shelf ("All" and Featured) before and
  after, for the owner: this changes what the public sees, so it merges only after his "good".

## Rules

No new assets, libraries, or toys. No engine changes except what a readiness fix needs, each as its
own small "Engine:" commit. Never edit `tests/taps.spec.mjs`. Report honestly what passed, what was
fixed, and what stays in labs.
