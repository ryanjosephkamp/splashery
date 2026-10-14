# Codex task 33: a big gallery of splat programs

**Branch:** `codex/program-gallery`, cut from `main`. **Changes:** one new data file
`src/equation-gallery.json`, one new test file `tests/cdx-gallery.spec.mjs`, a thumbnail script
`tools/cdx-gallery-thumbs.mjs` with its images in `assets/gallery/`, and a report
`docs/audits/program-gallery-2026-10.md`. Don't edit any other file. The site page and the manual
will use your data later, in a Claude lane.

The owner wants Level 4 of the Tinkerer's Manual ("A gallery of programs") to become a first-class
product: a large gallery of programs for the splat equation toy, with its own page on the site. This
task writes the programs. It is also a test of how well you write recipes, so quality matters more
than count.

## Read first

- `manual/index.html`, Level 3 (the language) and Level 4 (the current gallery of 15 programs).
- `src/packs/splat-equation.js`: the fields, the defaults, `compileProgram` and the presets.
- `src/equation.js`: the expression reader.

The rules, in short:

- There are 12 fields: x, y, z, hue, r, g, b and size are expressions in u, v and t; u and v are
  ranges; count is a number from 100 to 10,000; spread is `grid` or `random`.
- Each field can be at most 120 characters.
- t runs from 0 to 2π, and only 12 moments are stored.
- A program needs x, y, z and u.

## Steps

1. **Write 60 programs** in `src/equation-gallery.json`. Each entry has `id`, `title`, `group`, a
   one-sentence `about` in plain American English, the program text exactly as a reader would type
   it, `source` (a URL for the shape's math where one exists: Wikipedia, MathWorld or a paper) and
   `loops` (true if the motion loops seamlessly). Cover these groups, 8–12 programs each:
   - **Classic surfaces:** sphere variants, torus knots, Möbius strip, Klein bottle (figure 8),
     Boy's surface, Enneper, catenoid, helicoid, Dini's surface, seashells.
   - **Curves as tubes or beads:** Lissajous, trefoil, cinquefoil, spirals, the Lorenz-like
     parametric look-alikes (say plainly that they are look-alikes).
   - **Nature-like shapes:** flower petals, a nautilus, a pinecone spiral (Fibonacci angle), a
     jellyfish bell, a coral fan.
   - **Things in motion:** waves, breathing shapes, rotating fields, morphs that loop with t.
   - **Color play:** hue by height, by angle, by curvature-like terms; r/g/b gradients.
   - **Math showpieces:** the Hopf fibration (a sampled version), a Fourier epicycle curve,
     superquadrics, a Riemann-surface look.
2. **Make each one good.**
   - It compiles with the toy's own `compileProgram`, and every field is 120 characters or fewer.
   - It draws without "impossible point" gaps, unless a gap is the point.
   - It reads well at phone size.
   - It loops cleanly when it uses t (prefer sin and cos of t; avoid plain t).
   - Its count fits the budget.
   - No two programs are near-duplicates.
3. **Test.** `tests/cdx-gallery.spec.mjs`:
   - every entry has every key;
   - every program compiles in the page with `compileProgram`;
   - every field is within 120 characters;
   - the share of skipped points is under 2% unless the entry says why;
   - every `loops: true` program ends where it began (positions at t = 0 and t = 2π match);
   - the ids are unique;
   - every title and about passes `node tools/us-english.mjs`.
4. **Thumbnails.** `tools/cdx-gallery-thumbs.mjs` opens each program in the splat equation toy (the
   way `tools/make-thumbs.mjs` opens toys) and saves a 256-pixel WebP per program to
   `assets/gallery/<id>.webp`. Render at 1,024 and scale down, because small splats vanish at 256.
5. **Report.** Write it in `docs/audits/program-gallery-2026-10.md`:
   - the list, with one line per program;
   - which ones were hard to write and why;
   - which limits got in the way (120 characters, 12 moments, the count cap). The owner is weighing
     separate experiments with those limits raised.
   - five programs you think are the best.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 33: a big gallery of splat programs" with the five sections from CLAUDE.md.
