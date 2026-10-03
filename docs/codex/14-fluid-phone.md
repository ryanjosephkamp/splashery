# Codex task 14: the Fluid Lab on a phone

**Branch:** `codex/fluid-phone`, cut from `main`. **Output, and nothing else:**
`docs/audits/fluid-phone-2026-10.md` and its data in `docs/audits/fluid-phone-2026-10/`.

The owner, on October 3, 2026: "the Fluid Lab is still really hard for me to run on my phone … it
starts locking up. The memory or the processor or something just can't handle it. So maybe we should
just have instructions for that, or there's something we can do to improve that performance." This
task measures why and proposes the fix. Lane Fluids builds it afterward.

## Steps

1. **Read** `docs/FLUIDS.md`, `docs/handoff/Fluids.md`, the Fluid Lab's code (find it from
   `src/toys.js`), `docs/audits/perf-2026-10.md` (Codex task 06, for the method) and how the device
   profile picks a tier (`src/player.js`).
2. **Measure** the Fluid Lab and every other fluid toy at the phone tier: Playwright at 390×844 with
   the phone profile, CPU throttling (4× and 6×), WebGL2 and, where offered, WebGPU. For each scene
   and setting: frame time (median and 95th percentile), main-thread long tasks, JS heap and GPU
   memory where measurable, particle and grid counts, and time to the first frame. Note what makes
   it lock up (a setting, a scene, a step that grows without bound).
3. **Compare** with the desktop tier, and with the same scene at lower particle and grid counts, to
   find the largest settings that keep a phone under 33 ms per frame.
4. **Propose**, with numbers: phone defaults; an automatic step down when frame time stays above a
   limit; anything that leaks or grows; and a short "this lab runs best on a computer" hint for the
   heaviest scenes, with where it would show. Give each proposal's `file:line` and its expected
   gain. Don't change the code.
5. **The report:** a summary of at most ten lines, a table per scene, and the proposals in order of
   gain for effort. Say plainly that a real phone was not used, and what that may hide.
6. **Before you push:** `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
   Open a draft PR against `main` titled "Codex task 14: the Fluid Lab on a phone".
