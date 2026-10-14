# Codex task 71: when 3D can't start, say why and test it honestly

**Branch:** `codex/renderer-diagnostics`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `src/stage.js` (how the renderer starts: WebGPU first, then
WebGL2), `src/pc.js`, the app's start-up and fallback code, and `tests/smoke.spec.mjs`.

## Why

On October 13, 2026 a managed cloud browser opened the live site and got only the fallback poster:
"Splashery could not start a renderer: WebGL not supported." Today:

- Every device-creation error is wrapped as one generic error, so the message can't tell a missing
  GPU from any other start-up failure.
- The fallback sets the page's ready flag and returns before the normal UI and toy load, so a test
  that waits only for "ready" can pass with no renderer at all.

## Goal

1. **Keep the real cause.** When device creation fails, keep the original error and its cause
   alongside the friendly message. Offer a small "Details" link on the fallback that opens a local
   report the person can read and copy: the backends tried, whether the WebGPU API exists, the
   adapter outcome, the WebGL2 context outcome, and the final error. Nothing is sent or stored
   (Rules v1, C1 and C2).
2. **Three separate states.** Distinguish page settled, renderer ready, and first toy frame drawn,
   each as its own attribute or event (keep the existing one with its current meaning for old
   tests). The smoke test checks a real initialized backend and a drawn frame; the fallback gets its
   own test that forces the failure and checks the poster, the message, and the report.
3. **Honest guidance.** The fallback text says what may help (a recent browser, hardware
   acceleration on) without promising it will; some managed or cloud browsers have no graphics
   device at all.
4. **Never weaken security.** No flags or advice that disable the browser sandbox, bypass GPU
   blocklists, or force an unsafe software WebGL fallback.

## Tests and proof

`tests/cdx-renderer-diag.spec.mjs` (the forced-failure path and the three states), plus `smoke`,
`taps`, `help`, `unit`, and `embed` (never edit `tests/taps.spec.mjs`; don't loosen any existing
assertion). Screenshots of the fallback with its report at 390×844 and 1440×900 in the PR body.

## Don't touch

Changes to `src/stage.js` and the start-up path are engine changes: make them a small, additive
"Engine: …" commit with a test, and keep the normal rendering path exactly as it is. Don't touch the
files of the open PRs (#560, #562, #581, #582, #588, #589, and #591) or `vendor/`.

## Later (not in this task)

A clearly labeled preview for browsers with no GPU (still images or recorded clips of the toys,
never presented as the 3D toy) is a separate idea for the owner to decide.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
