# Codex task 28: test coverage gaps, and tests for the pure modules

**Branch:** `codex/test-coverage-gaps`, cut from `main`. **Output, and nothing else:**
`docs/audits/test-coverage-gaps-2026-10.md` and `tests/cdx-unit.spec.mjs` (one new test file). Don't
edit any other test or any source file.

There are about 170 spec files, but they cluster around lanes' own toys and mostly drive a browser.
The shared modules that every toy depends on are checked only indirectly. A bug in `src/state.js`
(saved scenes and links) would break old `#s=` links, which must keep loading (CLAUDE.md).

## Steps

1. **Map modules to tests.** For every file in `src/*.js` (the top level: `state.js`, `codec.js`,
   `noise.js`, `physics`-style helpers, `motion.js`, `pose.js`, `kit.js`, `rig.js`, `patterns.js`
   and the rest), list which spec files import it or drive it (`grep` the spec files for the module
   name, its exported names, and what it calls on `window`), and how: imported directly, called in
   `page.evaluate`, or only touched by a smoke test. Do the same for `tools/*.mjs` that tests call.
2. **Rank the gaps.** A gap is a module, or an exported function, no test calls on purpose. Rank by
   how many toys depend on it and how bad a bug would be (saved data, sound, physics, loading). List
   the 25 worst, each with `file:line`.
3. **Write `tests/cdx-unit.spec.mjs`.** Tests that need no WebGL: import a pure module in Node
   inside the spec (Playwright specs run in Node; `await import("../src/noise.js")`) and check:
   - `src/codec.js`: round trips for empty, typical and large input; the exact bytes of a known
     small sample.
   - `src/state.js`: decode a set of saved-scene JSON samples and `#s=` link fixtures (reuse
     `tests/fixtures/` if there are any; don't duplicate what `tests/unit.spec.mjs` already checks)
     and check what they become.
   - `src/noise.js`: the same seed gives the same values, and the value range and mean are sane.
   - Any other pure module from step 2's list, until you reach about 60 meaningful assertions.

   If a module can't be imported in Node (it needs `window` or the engine), list it in the report
   with the reason instead. Never mock the module under test.

4. **Time it.** The file must run in under 20 seconds, and must pass on `main`. A real bug you find:
   don't fix it; mark that test `test.fail()` with a comment, and describe it in the report with the
   input, the output and the right output.
5. **The report:** a summary of at most ten lines, the mapping table, the ranked gaps, what the new
   file covers, and what it couldn't.

No web needed. Before you push:
`SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test tests/cdx-unit.spec.mjs`,
`npx prettier --check .`, `node tools/us-english.mjs --diff`. Open a draft PR titled "Codex task 28:
test coverage gaps, and tests for the pure modules".
