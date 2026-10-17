# Codex task 103: faster toys on phones, measured (a Goal run, up to 12 hours)

**Branch:** `codex/phone-speed`, cut from `main`. One draft PR against `main`. Raw measurements go
on `codex/phone-speed-clips`, never merged. Read `AGENTS.md`, `builders/RULES.md`, `docs/PACKS.md`,
and the earlier audits: task 06 (`06-perf-audit.md`) and task 51 (#588, load time).

## Why

Most visitors will come on a phone. With every labs toy going public at v1.0, the slowest toys set
how the whole site feels. Task 06 measured frame time once, but many toys have come since.

## Part 1: measure every toy (3 hours at most)

`tools/phone-speed.mjs` opens every toy at 390×844 on the phone profile (`?profile=weak`) in
Chromium with software GL, and records:

- time to the first drawn frame;
- the steady median and 95th-percentile frame time, at rest and during the tap effect;
- the JS heap and the transferred bytes.

Software GL is slower than a phone, so use these as relative numbers.

Also make a small page the owner can open on his phone, `tools/pages/phone-speed.html`. It runs the
30 slowest toys one by one and shows the same numbers in a table he can copy into a message. Nothing
is sent anywhere. One run from his phone is the real-device check.

## Part 2: the 15 slowest toys

Pick the 15 worst by first view or frame time, and find each one's cause:

- splat count against the phone tier's budget;
- per-frame work in `drive()`, such as allocations or rebuilding arrays;
- sort pressure from large moving parts;
- textures or files loaded before the first frame;
- worker setup.

Fix within each toy's recipe or pack. Shared fixes go in their own "Engine: …" commits with a test.

## Gates

1. Each of the 15 toys gets at least 25% faster on first view or on frame time, whichever was its
   problem. The median of the 15 improves by at least 30%.
2. No visible change: SSIM of 0.98 or more against the before still at phone size, at rest and
   mid-tap, for each toy. The motion and the effect stay the same. Where a toy can't meet this, it
   goes in Known issues with stills, not in the PR.
3. No other toy gets slower by more than 5%. Every existing spec passes. The embed transfer test
   stays at 30 MB or less.
4. The owner's phone run of the page, before and after, if he has time. Otherwise the software-GL
   numbers stand.

## Rules

Pack and recipe changes, plus "Engine:" commits. No new toys, and no change to how any toy looks or
plays. Never edit `tests/taps.spec.mjs` or loosen a test. Your tests go in
`tests/cdx-speed.spec.mjs`. American English and the serial comma. Last, merge `main` and run
`node tools/preflight.mjs`. Progress notes at 4 and 8 hours. PR body: Summary, Verification,
Deviations, Known issues, and What was cut.
