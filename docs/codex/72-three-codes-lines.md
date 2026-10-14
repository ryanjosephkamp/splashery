# Codex task 72: the white lines in Three QR codes in one, on Android

**Branch:** `codex/three-codes-lines`, cut from `main` (after PR #595 has merged, if it has). One
draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md`, `src/packs/qr-lab.js` (the `qr-three` toy), and the audit of
task 69 (`docs/audits/circular-qr-2026-10.md`), which tried and failed to reproduce this in a
desktop browser.

## Why

The owner sees static horizontal white lines across the red, green, and blue squares of Three QR
codes in one on an Android phone, in both Chrome and Brave (October 13, 2026). Task 69 could not
reproduce them with desktop Chromium and llvmpipe, so the cause is likely something only a phone GPU
does: lower shader precision (`mediump` floats), a different blending or sorting result at seams
between module rows, a device pixel ratio of 2.6 to 3.5 that puts row edges between pixels, or
texture filtering at sheet edges.

## Goal

1. **Reproduce it first.** Best: run this task locally on the owner's Mac with his Android phone on
   USB and Chrome's remote debugging (`chrome://inspect`), and screenshot the toy from the phone. In
   the cloud, try to provoke it: force `mediump` precision in the splat shaders on a test build, a
   device scale factor of 2.625 and 3.5, ANGLE and SwiftShader backends, and odd canvas sizes. Say
   which way reproduced it.
2. **Fix it at the cause,** without changing how the toy looks elsewhere, and show before-and-after
   screenshots from the same setup that showed the lines.
3. **A test** that renders the toy under the conditions that showed the lines and checks rows
   between modules for stray bright pixels.

## Don't touch

The files of the other open PRs, `vendor/`, and engine shaders except through a small additive
"Engine: …" commit with a test, if the cause is in the engine.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
