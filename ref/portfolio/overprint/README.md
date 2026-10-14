# Overprint

A concept for Ryan Kamp's portfolio. The page is one live print: a single cloud of Gaussian splats,
laid down in two inks on paper, that re-forms for each section. Static files, no build step, no
dependencies.

**The signature.** The name is drawn in splats. Push the pointer through it, drag to turn it, or
open the recipe card and change what it is made from: type a word, move a parameter, or write the
three expressions of a surface yourself.

## Run it

```bash
python3 -m http.server 4178
```

Then open http://localhost:4178/concepts/overprint/ (serve from the repository root).

## Files

| File | What it holds |
|---|---|
| `index.html` | All of the content. Each section names its form in `data-form` and where the form sits in `data-at`. |
| `styles.css` | Tokens at the top (`:root`): paper, the two inks, type steps. |
| `main.js` | The recipes (`word`, `lorenz`, `klein`, `gyroid`, `loop`, `qr`, `yours`), the table that names them (`FORMS`), a small QR encoder for the `qr` recipe (`qrMatrix`), the WebGL2 press (`Cloud`), and the page logic (`start`). |

## How the print is made

1. A recipe returns, for each splat, a center, the stroke it is laid along, and an ink. It also
   says how wide its splats are and how much ink each lays down.
2. Pass one draws every splat in a single instanced call onto two plates (the red and green
   channels of one texture), adding as it goes. A splat is a Gaussian with a long axis that follows
   its stroke through the turn and the perspective, and a short radius.
3. Pass two prints the plates onto the paper: ink saturates as it builds, the second plate is
   sampled a little off register, and where both inks land one multiplies the other.

A change of form uploads new targets; each splat sets off from wherever it is and they leave in turn.

## How many splats, and where they go

| Device | Splats made |
|---|---|
| The default | 96,000 |
| A small screen (shorter side under 700 pixels) or four processor cores or fewer | 48,000 |
| Two cores or fewer, or 2 GB of memory or less | 24,000 |

If frames still run long (under about 30 a second for a sustained stretch), the page draws half of
what it made, then a quarter, with each splat swelled so the ink comes to the same. After that it
drops to a coarser canvas. The count shown on the page is the count being drawn.

Splats are placed with low-discrepancy sequences, not random numbers, because white noise leaves
clumps and holes that read as grain: the golden ratio along a line, R2 over a plane, R3 through a
volume. Any first part of such a sequence is as even as the whole, which is what makes drawing half
of the splats safe. A path that has to be computed in order (the Lorenz attractor) is written out
in a golden-ratio stride for the same reason. Random numbers only set a stroke's angle and a
splat's depth.

Each recipe sizes its own splats to the gap between them, so a form is as sharp as its count
allows: a filled shape shares its inked area among its splats, a line makes each stroke as long as
the step to the next, and a QR module shares itself among the splats dealt to it. On a screen with
one device pixel to a CSS pixel the canvas is drawn at one and a half times its size, which keeps
hairlines fine.

## The projects

The page follows the list in `docs/FACTS.md`: Splashery first and largest (two sections), grooph
second, then Ars Magna and aqrobat, each with a form of its own. The other five share a numbered
list, and the capstone is that list's last, short entry. The list's own form is an ampersand.

## The QR code

The aqrobat figure is a real QR code holding aqrobat's address, encoded on the page by `qrMatrix`:
version 3 (29 by 29 modules), error correction M, byte mode, which is one block of 44 data words
and 26 check words, with room for 42 bytes. Its eight masks are scored and the best is kept. The
`qr` recipe then fills every dark module with splats, the same number to each.

A code has to be seen whole to be read. Beside the text on a wide screen that takes nothing. On a
narrow one (under 960 pixels) a form marked `whole` in `FORMS` is sized so that all of it, quiet
margin included, fits between the bar and the middle of the screen. It rides up inside its
section's window, then holds under the bar while the section's text passes below it: `main.js` sets
`--cut` on that text as the page scrolls, and `.is-under` in `styles.css` cuts the text away above
that line. The figure holds still, where the other forms sway.

## Adding a form

Write a recipe that fills `pos`, `tan` and `ink`, sets `width` and `gain`, and ends with
`finish(...)`. Order its splats so that any first part of them covers the whole form. Add it to
`FORMS`, and name it in a section's `data-form`. To offer it in the recipe card, give it `label`, `recipe`,
`controls` and `note`, and add its key to `SHELF`.

The paper and ink colors live in two places that must agree: `:root` in `styles.css` and the
`PAPER`, `TEAL` and `HOT` constants in `main.js`.
