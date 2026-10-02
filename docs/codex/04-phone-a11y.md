# Codex task 04: phone and accessibility audit

**Branch:** `codex/phone-a11y`, cut from `main`. **Output:** `docs/audits/phone-a11y-2026-10.md` and
its screenshots in `docs/audits/phone-a11y-2026-10/` only. Change nothing else: a UI lane makes the
fixes.

Most visitors, and the owner, use Splashery on a phone. Check the public site as a phone visitor and
as someone using a keyboard or a screen reader. Use a local server
(`python3 -m http.server 4173 --bind 127.0.0.1`) on `main` with Playwright, at 390×844 (touch,
device scale 3) and at 1440×900. Leave the labs switch off. Then repeat a short pass with it on.

1. **Every screen and panel.** That means the gallery and its shelves, a toy open, each tab of the
   side panel, the menus, the About tab and its terms, saving and sharing, and the embed page. For
   each one, check:
   - tap targets of at least 44×44 CSS pixels, and not too close together;
   - text that is cut off, overlaps or runs off the screen;
   - text size at phone width;
   - text and icon contrast (WCAG 2.2 AA; give the measured ratio);
   - what still shows in landscape.

   Take a screenshot of each problem.

2. **Keyboard.** Can someone reach and use every control with Tab, Enter, Space and the arrow keys?
   Is the focus visible and in a sensible order? Can they close every panel with Escape? Can they
   play a toy without a pointer?
3. **Screen reader.** Every button and control has an accessible name, and icon-only buttons say
   what they do. Check that state changes are announced where they matter (a toy loaded, a recording
   started) and that headings and landmarks make sense. Use Playwright's accessibility snapshot and
   say what you couldn't check without a real screen reader.
4. **Motion and sound.** Does the site respect `prefers-reduced-motion`? Does any sound play before
   the visitor taps? Are the live-input toys clear about the microphone or camera before they ask?
5. **Sample 30 toys** across the shelves (list them). For each: does its how-to line fit the screen,
   and can it be played with one thumb?
6. **Write the report.** Open with a summary of at most ten lines, worst first. Then one line per
   problem: where it is, what is wrong, the WCAG criterion if one applies, the screenshot, and the
   file (and line, if you can find it) a fix would touch.

Keep the screenshots small (PNG, under 300 KB each). Run
`npx prettier --check docs/audits/phone-a11y-2026-10.md` and `node tools/us-english.mjs --diff`
before you push.
