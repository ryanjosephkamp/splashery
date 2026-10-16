# Follow-up verification

The 20-file local collection contains 323 tests: 322 passed, one failed, and none skipped. The
[summary](summary.md), [counts](counts.json), per-file reports, and selected logs retain the actual
first-run result. Archived text logs have terminal escapes and trailing whitespace removed; the test
results and diagnostics are retained. The source remains the rendering bytes at `9b9d30d37`; the
collection resumed seven completed files, then ran the remaining 13 with two workers, scheduling
`bk` alone.

All Storybook, Pop-out, page, engine, and book-turn checks pass. The one failure is `smoke:856`, the
scan-rig cat-head check: its movement and return pixel assertions passed, but Chromium emitted
`GL_INVALID_OPERATION` for a texture/sampler format mismatch. Three subsequent isolated repetitions
passed on the candidate, and three on unchanged main at `6c38b4f69`. These checks did not reproduce
or explain the original warning. They do not erase that failure. No assertion, threshold, skip, or
retry setting was loosened.

All 16 standalone Node checks pass. The Operator's requested fresh head full-suite run remains
pending after the push. This is an evidence-only branch; never merge it.

Rule check: none.

The first mandatory preflight ran all 270 checks: 269 passed, and the repository-map check found the
untracked temporary `work/` folder. The scratch data and its worktrees were moved outside the
implementation checkout, and their Git worktree registrations were repaired. The test and repository
map were left unchanged. The diagnostic log is retained as `preflight-workspace-layout.log`; the
clean-checkout rerun is recorded separately.

The clean-checkout mandatory preflight passes all seven steps, including **270/270 tests across 13
shelf-wide specs, with zero failures and zero skips**, on implementation commit `f41bbdb5a`, after
merging main through `bc7960eb3`. [Complete output](preflight-clean.log) and
[final source proof](../final-integration.json) are retained. This does not erase the separate
smoke-test warning or substitute for a fresh full-suite run.
