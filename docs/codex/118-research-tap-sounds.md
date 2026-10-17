# Codex task 118: research, tap sounds that sound real (up to 4 hours; Codex's cloud or ChatGPT)

**Branch:** `codex/research-tap-sounds`, cut from `main`. One draft PR against `main` with the
report and one demo page only. This task needs the web. It is written to stand on its own, so the
owner can also paste it into ChatGPT's deep research; then the answer comes back as the report's
text, without the demo page.

## Why

Splashery is a pure-browser toy box of 3D Gaussian splats
(https://ryanjosephkamp.github.io/splashery/). Every toy makes a sound when tapped: most are made by
code with Web Audio at the moment of the tap, and some are short recorded files under CC0 or CC BY.
The owner's sound reviews keep finding the same problems: sounds that are robotic, thin, or alike
from toy to toy, clicks while the view turns, and sounds pitched too high to hear. This research
finds better ways to make tap sounds in a browser.

## Questions

1. **Synthesis that sounds physical:** modal synthesis (a struck object's ringing from its shape and
   material), contact and impact models, friction and scraping, liquid and bubble sounds, and
   granular methods. For each: how it sounds, what it costs on a phone in Web Audio or an
   AudioWorklet, and open implementations (Apache-2.0, MIT, or BSD) to learn from.
2. **Materials:** how wood, glass, metal, ceramic, plastic, rubber, cloth, paper, and fruit should
   differ, with the parameters to use (frequencies, damping, and noise).
3. **Open sound libraries:** which collections are CC0 or CC BY (for example Freesound's CC0 filter,
   Kenney, and Sonniss's free bundles, whose license must be checked), how to search them well, and
   which libraries Splashery can't use and why.
4. **What makes a sound feel robotic** and how to avoid it: variation per tap, layering, envelopes,
   room, and pitch.
5. **Glitches:** why Web Audio sounds click or pop (gain jumps, too many nodes, the audio thread
   during heavy rendering), and the fixes.

## Deliverables

- `docs/research/tap-sounds-2026-10.md`, 250 lines at most: answers with sources, then a recipe per
  material (parameters a lane can use), and the five changes that would help Splashery's sounds
  most.
- `tools/pages/tap-sounds-demo.html`: a standalone page (not shipped, not linked from the site) with
  a button per material that plays your best synthesized tap, and its parameters beside it.

Every claim links to its source. American English and the serial comma. PR body: Summary,
Verification, Deviations, Known issues, and What was cut. Credit lines read "Codex (GPT-6)".
