# Specimen

A concept portfolio for Ryan Kamp as a scientific visualization researcher, with
[Splashery](https://ryanjosephkamp.github.io/splashery/) as the centerpiece. One page, static files,
no dependencies, no build step.

**The signature:** a microscope slide holding a neuron made of 32,768 Gaussian splats. Turn the
focus and they merge, pair by pair, down to one Gaussian with the same mass, center and covariance;
tap the cell and a Hodgkin–Huxley spike runs down its axon, hopping the myelin. Pinned labels light
the part they name, and three stains re-dye the same splats.

## Run it

```bash
python3 -m http.server 4175
```

from the repository root, then open http://localhost:4175/concepts/specimen/.

## The page

| Section | What a visitor can do |
|---|---|
| The slide | Focus (pointer, touch, arrow keys), fire (button, or tap the cell), turn it by dragging, switch labels on and point at one, change the stain. |
| Case I, Splashery | Pull any of 23 science toys from four drawers onto the bench: each is the real Splashery embed, loaded on request, with a choice of autoplay effect. Below it, a catalog of what the science shelves are computed from. |
| Case II, the method | Four figures to work by hand: one splat and its shadow, two splats and their merge, three dyes in a shuffled order, and the push that does or does not make a spike. |
| Case III, the cabinet | grooph first, with its loop graph running in splats; then seven more projects, each with an emblem in splats; the capstone last, in one line. |
| Case IV, provenance | Degrees, advisor, research interests. |

## Files

| File | What it holds |
|---|---|
| `index.html` | All of the content. Edit copy and links here. |
| `styles.css` | Design tokens at the top (`:root`), then one block per section. |
| `specimen.js` | The math, with no DOM: the neuron recipe, the splat tree (`merge`, `buildTree`), `prepare` (what a stage needs), and the Hodgkin–Huxley integrator. |
| `worker.js` | Grows the neuron off the main thread. `main.js` does it itself where module workers fail. |
| `main.js` | The WebGL2 `Stage`, the hero, the four figures, the cabinet emblems, and the lazy Splashery embeds. |
| `verify.mjs` | The check behind the page's claims. `node concepts/specimen/verify.mjs`. |
| `assets/fonts/` | [Newsreader](https://fonts.google.com/specimen/Newsreader) variable font, roman and italic, latin subset (SIL Open Font License). |

To add a Splashery toy to a drawer, add an `<a data-toy="its-id">` to the drawer in `index.html`,
and see its embed render on the bench before relying on it. To change the splat count, change
`DEPTH` in `specimen.js` (every count in the recipe is a share of 32,768 and scales with it), then
the numbers in `index.html` and this file.

## The verified detail

Lowering the focus replaces each pair of splats with their moment-matched merge. `verify.mjs`
checks every one of the 32,767 merged splats against all the leaves beneath it, every one of the 16
levels against the finest, that every covariance is positive definite and every splat's stain
shares still sum to one: 98,318 checks, largest drift about 1e-13. It also checks that each pinned
label picks out at least one splat and no splat answers to two labels, and that the spike model
rests at −65 mV, fires at its threshold, and does not fire just below it.

## How it is drawn

Splats here absorb light instead of emitting it, like a stained section on a bright stage. Each
splat adds optical depth to a float buffer; a second pass shows `exp(−depth)`. Sums do not depend on
order, so nothing is sorted. Where float render targets are missing it multiplies in 8 bits instead.

The page opens two WebGL2 contexts and no more: one for the slide, and one hidden stage that every
figure and emblem is drawn on and copied out of. Emblems are sampled the first time they are
scrolled to. If frames arrive late on the slide, it draws fewer pixels, never fewer splats.

## Reduced motion

No turntable, no opening focus sweep, the focus and the stains jump instead of gliding, Fire shows
one still frame and the finished chart, the one-splat figure holds still until dragged, and the
grooph graph and the emblems are drawn once, in full focus.
