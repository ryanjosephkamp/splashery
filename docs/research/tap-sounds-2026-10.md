# Tap sounds that feel physical

October 17, 2026 · Codex (GPT-6) · Research and an original synthesis study.

## Recommendation and scope

Keep Splashery's existing modal voices, improve their contact layers and variation, and use
carefully licensed recordings for complex soft textures. Modal synthesis represents resonances; an
object's shape, support, strike, and material all matter, so one material is not one pitch.
Statistical contact models can convey material and motion without a full physical simulation.
[contact] The recipes below are **authored starting points**, not measurements, material constants,
or a validated listening test. Glass and metal can remain ambiguous even in research experiments.
[perception]

The [standalone demo](../../tools/pages/tap-sounds-demo.html) has nine material buttons and their
actual parameters. It uses no recordings, libraries, network requests, storage, or production code.
Code is MIT; original synthesized sounds are CC0. Made by Ryan with Codex (GPT-6).

## Methods: what to use, what to avoid

The phone budgets here are **proposed starting limits**, not measured phone CPU percentages. Cost
estimates describe algorithm structure; benchmark with the renderer running before adopting them. At
48 kHz, 128 frames last 2.67 ms (arithmetic); an AudioWorklet must finish each block on time, avoid
allocation and blocking, and use the actual output length rather than hard-code 128. [worklet]
[quantum]

| Method and character                                                                 | Browser implementation and proposed phone budget                                                                                                                                                                                                                                            | Permissive implementation to study                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal: a knock followed by object-specific, often inharmonic ringing.                | Sum 3–8 damped modes per tap; start with six overlapping taps. Native oscillators plus gains are simple; one worklet with recursive resonators scales without a node per mode. Work is proportional to modes × active voices × frames. [modal]                                              | STK `Modal` and `ModalBar`: resonator banks, strike hardness, and strike position. [modal] [bar] [stk-license]                                                                               |
| Contact/impact: the initial hard tick or soft thump, exciting the body's resonances. | Start with a 1–8 ms smooth force pulse or filtered noise; vary hardness and strength. A force-to-resonator model is more physical than independently adding a beep. Coupled spring/contact simulations need per-sample state and stability care; solve detailed geometry offline. [contact] | STK `ModalBar`'s excitation and hardness controls are a practical simplified impact implementation, not a general collision solver. [bar] [stk-license]                                      |
| Friction/scraping: rough grains, rubbing, or a sustained stick-slip squeal.          | Drive a resonant filter with irregular micro-impacts; map drag speed to event density and force to level. Start with one scrape voice and four resonators; a true nonlinear stick-slip model belongs in a worklet, with bounded work per frame. [contact] [bow]                             | STK `Bowed` and `BowTable` demonstrate friction feedback. They model a bowed string, so adapt the mechanism rather than use a violin preset for every scrape. [bow] [bowtable] [stk-license] |
| Liquid/bubbles: short pitched bloops combined into irregular water textures.         | Use damped bubble oscillations, with smaller bubbles at higher frequencies; event distributions produce a stream. Start with eight simultaneous bubbles plus quiet splash noise. A few oscillators are cheap structurally; dense sprays multiply event and voice cost. [liquid]             | STK `Shakers`, water-drop preset 21, demonstrates a stochastic resonator approximation, not a fluid solver. [shakers] [stk-license]                                                          |
| Granular: small overlapping pieces of texture, useful for crumpling, grit, and pulp. | Schedule windowed 10–40 ms grains from a locally decoded CC0/BY recording or procedural noise; start at 20–50 grains/s and cap eight simultaneous grains. Cost scales with overlap, not just event rate; avoid creating hundreds of nodes per second. [granulate]                           | STK `Granulate` shows grain state, random offsets, and fade envelopes. Sample rights are separate from the code license. [granulate] [stk-license]                                           |

STK's license is MIT-style, with a nonbinding request to return modifications; retain its actual
notice if porting. These are C++ learning references, not drop-in Web Audio modules. [stk-license]
Clatter is a useful pointer to contact research, but its current code uses the Hippocratic License
3.0, **not** MIT, BSD, or Apache-2.0; do not vendor it for this task. [clatter-license]

## Ready recipes for lanes

Each row chooses a particular imagined object and gesture. These are sound-design proposals: wood is
a small block, glass is an empty tumbler, metal is a loose plate, ceramic is a cup, plastic is a
hollow shell, rubber is a solid pad, cloth is folded fabric, paper is a loose sheet, and fruit is a
light fingertip pat on ripe flesh. A pat is not a bite, peel, or cartoon squish. The hard-object
choices follow modal/contact principles; cloth, paper, and fruit are intentionally noise-dominated
approximations, with no claim of empirically established material parameters. [contact]

Model: `body(t) = Σ aᵢ exp(−t/τᵢ) sin(2π f₀ rᵢ t)`, multiplied by a smooth attack. Here `τ` is the
**amplitude e-folding time**, not the sound's total duration; `T60 ≈ 6.908τ`. This is the
decaying-mode model and the exponential envelope relationship. [modal] [target] For a recursive
resonator, pole radius `R = exp(−1/(sampleRate × τ))`; do not copy radii between sample rates. The
demo evaluates the equivalent damped complex rotation into a buffer. [modal]

| Material / intended character | f₀ (Hz); ratios rᵢ                   | τᵢ (ms)                     | Body gain; attack (ms) | Noise gain; low-pass (Hz); noise τ (ms) |
| ----------------------------- | ------------------------------------ | --------------------------- | ---------------------- | --------------------------------------- |
| Wood / dry knock              | 360; 1, 2.57, 4.2                    | 35, 18, 9                   | 1; 1.5                 | .45; 2600; 6                            |
| Glass / light ting            | 780; 1, 2.32, 4.25, 6.63             | 240, 160, 95, 55            | 1; 1                   | .12; 6500; 2                            |
| Metal / diffuse clink         | 310; 1, 1.47, 2.09, 2.56, 3.37, 4.11 | 380, 300, 230, 175, 120, 85 | 1; 1                   | .24; 5200; 3                            |
| Ceramic / hollow tick         | 620; 1, 2.15, 3.9, 5.4               | 85, 50, 28, 16              | 1; 1.3                 | .30; 4200; 4                            |
| Plastic / boxy tok            | 260; 1, 1.82, 2.91, 4.3              | 45, 26, 15, 8               | 1; 2                   | .50; 2200; 8                            |
| Rubber / muted thup           | 140; 1, 1.48, 2.37                   | 24, 14, 8                   | .7; 4                  | .55; 850; 12                            |
| Cloth / brushed pat           | 180; 1, 1.73, 2.8                    | 12, 8, 5                    | .12; 6                 | 1; 1500; 25                             |
| Paper / crisp flick           | 430; 1, 2.31, 4.1                    | 12, 7, 4                    | .18; 1                 | 1; 7500; 14                             |
| Fruit / soft skin pat         | 155; 1, 1.82, 3.02                   | 22, 13, 7                   | .65; 3                 | .85; 1800; 14                           |

Use modal amplitudes `[1, .55, .3, .16, .09, .05]`, truncated to the number of modes, multiplied by
body gain. Contact noise is uniform white noise through a one-pole low-pass,
`α = 1 − exp(−2π cutoff/sampleRate)`, with its own exponential decay and the same attack. All
values, including these gains and cutoffs, are authored choices; the demo is the reference
implementation. Its filter cutoffs and modes stay below `0.45 × sampleRate`.

Paper adds four windowed 8 ms noise grains at 7, 19, 33, and 52 ms, gain .30; fruit adds three 10 ms
grains at 9, 21, and 38 ms, gain .16. With variation on, grain times shift by up to 3 ms. These
propose a small texture layer, not an accurate fracture or flesh simulation. [granulate] Try a
licensed close recording if cloth or fruit still sounds like filtered static.

The demo subtracts the mean before fading the last 12 ms to zero, and scales each buffer to peak .5
before applying tap level variation. It renders through 7τ (or the last grain, whichever is longer),
so metal rings longer than wood. A shared 25 Hz high-pass handles residual low-frequency energy;
audition low material bodies on the actual phone rather than judge by headphones alone.

## Why sounds feel robotic, thin, or alike

These are diagnoses to test, not proof of the cause of any reported Splashery sound:

- **Identical attacks:** propose fresh noise, modal gains ±12%, decay ±8%, overall pitch ±0.6%, and
  level ±8% per tap. Keep frequencies nearly fixed for one object; changing strike location mainly
  changes which modes are excited. STK explicitly changes mode gains with strike position. [bar]
- **One pitched oscillator:** a single sustained sine has little contact texture. Pair a brief
  excitation with irregularly spaced, independently decaying modes; avoid tuning every material to
  the same musical scale. Modal banks and source-filter contact models motivate this recipe. [modal]
  [contact]
- **Unrelated layers:** let one impact strength control body, noise brightness, and level together.
  Use separate transients only for separate physical events, such as a landing after a bounce. This
  is a proposed mapping from the contact model's dependence on force and motion. [contact]
- **Wrong envelope or room:** start promptly, decay instead of sustain, and keep contact noise
  shorter than the rigid body's ring. Propose mostly dry playback, optionally two quiet reflections
  at 17 and 29 ms, gains .05 and .03; these are tuning choices, not measured room acoustics.
  Granular sources need their own windowed edges. [modal] [granulate]
- **Pitch extremes or masking:** lowering only the fundamental can leave bright upper modes; tune
  the entire spectrum and check its actual rendered level. Splashery's glass defaults are 1568 Hz
  with ratios through 6.63 (about 10.4 kHz), not an ultrasonic fundamental. “Too high” alone does
  not establish inaudibility; check output, device, volume, and listener. [voices]

## Clicks and pops: distinguish the failure before fixing it

| Symptom / likely mechanism                                                                           | Practical fix and diagnostic                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click exactly at start, mute, stop, or parameter change: a gain discontinuity. [gain]                | Propose a 1–6 ms attack and an 8–20 ms release, then stop/disconnect after the release. Changing an initial value before playback is fine; jumping an audible gain is not. Automate on `currentTime`. [gain] [ramp]                                                                                                                                                       |
| Click when interrupting an envelope: canceling its scheduled future can change the value. [hold]     | Use `cancelAndHoldAtTime(now)` where supported, then ramp down. Its support is limited; otherwise calculate and anchor the envelope's value at `now`, cancel future events, and ramp. Do not assume reading `.value` reconstructs every automation timeline. [hold]                                                                                                       |
| Error or abrupt tail at silence: exponential ramps cannot end at zero. [exp]                         | Ramp exponentially to a small positive value, then linearly to zero; stop afterward. Trimmed buffers and grains also need fade windows. The demo's buffers start and end at zero. [exp] [granulate]                                                                                                                                                                       |
| Crackle grows with repeated taps: accumulating voices, CPU pressure, or overloaded mixing. [worklet] | Cap polyphony, fade stolen voices, release nodes in `onended`, cache buffers, and leave mix headroom. Count sources and measure output under bursts; a compressor is not a guaranteed brick-wall limiter. These are engineering recommendations.                                                                                                                          |
| Pops only while orbiting: scheduling stalls, render contention, or worklet underruns. [worklet]      | Native scheduled audio and AudioWorklets run separately from UI callbacks; heavy rendering does not prove an audio-thread fault. Compare a prerecorded loop against synthesized taps while orbiting; inspect long tasks and audio timing. Schedule ahead on the audio clock, avoid generating buffers during rendering, and precompute expensive work. [worklet] [buffer] |
| First tap late or silent: context suspension or unfinished sample loading. [best] [buffer]           | Create/resume audio in the user gesture and decode before the action needs it. This differs from a waveform click. Surface failures instead of silently claiming playback. [best]                                                                                                                                                                                         |

At 48 kHz, a proposed eight-mode, six-voice worklet visits 2.304 million mode-samples/second; this
is an operation-count estimate, **not** a promise of phone performance. Native buffer playback
avoids running the synthesis kernel continuously, at the cost of generation time and buffer memory.
An AudioBufferSourceNode is single-use, but the AudioBuffer can be reused. [buffer]

## Open recordings and license decisions

Source pages and license notices were opened on October 17, 2026; no recordings were downloaded.

| Collection                                                                                            | Verified terms and useful search                                                                                                                                                                            | Splashery decision                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)                                        | Pack page lists 130 sounds and CC0. Search its pack for a close dry impact before adding room or pitch changes.                                                                                             | Good first candidate; inspect actual files before promising a particular material.                                                              |
| [Freesound FAQ](https://freesound.org/help/faq/)                                                      | Supports CC0, CC BY, and CC BY-NC; use the search license filter for **Creative Commons 0** or **Attribution**, then confirm each sound's page and version.                                                 | CC0/BY preferred. CC BY requires credit; a site's free download label is not the license.                                                       |
| [OpenGameArt: 100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx) | This particular submission is labeled CC0; other submissions have their own terms. Search for material + action, then open the individual submission.                                                       | Good wood/metal candidate, not a blanket license for the whole site.                                                                            |
| [Sonniss GDC bundle license](https://sonniss.com/gdc-bundle-license/)                                 | Version 2.0, effective August 27, 2026: royalty-free project use, but restricts supplying the sounds themselves, including modified sounds and sample packs. Earlier downloads keep the then-current terms. | Exclude: custom license outside Rules B1's allowed set; do not put raw sounds in this public repository. Free and royalty-free do not mean CC0. |
| [BBC Sound Effects licensing](https://sound-effects.bbcrewind.co.uk/licensing)                        | RemArc permits specified personal, research, and educational uses; commercial licensing is separate.                                                                                                        | Exclude: custom terms outside Rules B1, not a CC0/BY library.                                                                                   |

Search workflow (recommendation): combine **material + object + gesture + recording character**:
`wood block fingertip dry`, `glass tumbler tap close`, `ceramic cup knock`, `plastic lid flick`,
`rubber pad pat`, `cloth sleeve brush`, `paper sheet flick`, or `ripe fruit pat`. Audition the full
original, not only a preview: reject speech, music, clipping, long room tails, and obvious
processing; get 4–8 different takes rather than randomize one sample excessively. Store author,
title, original URL, license/version, checked date, hash, and edits, as required by
[Rules B1–B4](../../builders/RULES.md). [CC0][cc0] waives copyright as far as possible; [CC BY
4.0][by] requires attribution, a license link, and identification of changes. Prefer those two;
BY-SA and NC are allowed only under the repository's per-asset conditions. Exclude ND, unknown
rights, paid/personal-use files, and Freesound's retired Sampling+ license, which is outside the
allowed set. Do not mislabel the repo's allowed NC licenses as forbidden. [freesound]

## The five changes most likely to help Splashery

1. **Refine the existing modal engine, rather than replace it:** retain `MODES` and `modal`, add
   authored per-object damping/contact presets, and include cloth, paper, and fruit. Existing wood,
   glass, and metal already use irregular ratios and shorter upper modes. [voices]
2. **Vary excitation before varying pitch:** adopt bounded noise, strength, and modal-gain
   variation; keep one object's identity stable. Compare variation on/off in the demo before
   choosing ranges. [bar]
3. **Audit interruption and cleanup:** current `envGain` already attacks and decays; preserve that.
   Inspect `stopHeld`'s current-value anchoring and all source cleanup before claiming the orbit
   clicks are fixed. This research changes neither the sound engine nor gesture handling. [voices]
   [sound]
4. **Use licensed texture where synthesis loses detail:** start with CC0 contacts from Kenney or
   individually verified Freesound/OGA files; preload/decode on toy open, reuse buffers, and apply
   short fades. `Sound.preload` already exists, so improve its coverage instead of duplicating it.
   [sound] [buffer]
5. **Add an acceptance pass on actual phones:** level-match candidates, try ten taps plus a rapid
   burst while orbiting, compare dry/room and variation on/off, and ask listeners to identify the
   material without seeing its label. Record confusion and output peaks; synthetic distinctness is
   not proof of physical realism. Spectral and damping cues interact in material judgments.
   [perception]

## Verification and limits

The demo is an isolated proposal, not a fix for production clicks. It synthesizes a fresh mono
buffer per accepted tap, so generation remains UI-thread work; production should cache variants when
a toy opens or generate them in a worker. It caps six sustained voices, fades a stolen voice over 8
ms, rate-limits accepted taps to one per 30 ms, and ramps volume changes. No phone CPU, speaker
response, human listening result, or Safari behavior is claimed without a device check.

Chromium checks passed for all nine materials at 22.05, 44.1, 48, and 96 kHz: finite PCM, zero
endpoints, reference repeatability, and changed variants. A seven-voice offline mix through the
high-pass and volume stage peaked at .888 or less; a 40-tap live burst stayed within seven sources
and cleaned up afterward. Buttons, keyboard activation, volume, and variation worked at 390 × 844
and 1440 × 900 with no overflow, script errors, or external requests. The unavailable-audio message
was checked with Web Audio deliberately removed. Direct `file:` navigation was blocked by the
browser's administrator policy; the standalone page was tested over a local static server.

## Sources opened

[contact]: https://mcdermottlab.mit.edu/papers/Traer_Cusimano_McDermott_2019_DAFx.pdf
[perception]: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0167023
[modal]: https://raw.githubusercontent.com/thestk/stk/master/src/Modal.cpp
[bar]: https://raw.githubusercontent.com/thestk/stk/master/src/ModalBar.cpp
[bow]: https://raw.githubusercontent.com/thestk/stk/master/src/Bowed.cpp
[bowtable]: https://raw.githubusercontent.com/thestk/stk/master/include/BowTable.h
[liquid]: https://persianney.com/kvdoelcsubc/publications/tap05.pdf
[shakers]: https://raw.githubusercontent.com/thestk/stk/master/src/Shakers.cpp
[granulate]: https://raw.githubusercontent.com/thestk/stk/master/src/Granulate.cpp
[stk-license]: https://raw.githubusercontent.com/thestk/stk/master/LICENSE
[clatter-license]: https://raw.githubusercontent.com/alters-mit/clatter/main/LICENSE.md
[worklet]: https://developer.chrome.com/blog/audio-worklet-design-pattern/
[quantum]: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
[gain]: https://developer.mozilla.org/en-US/docs/Web/API/GainNode
[ramp]: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime
[hold]: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/cancelAndHoldAtTime
[exp]: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/exponentialRampToValueAtTime
[target]: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
[buffer]: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
[best]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
[freesound]: https://freesound.org/help/faq/
[cc0]: https://creativecommons.org/publicdomain/zero/1.0/
[by]: https://creativecommons.org/licenses/by/4.0/
[voices]: ../../src/voices.js
[sound]: ../../src/sound.js
