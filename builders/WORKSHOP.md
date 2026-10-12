# The Workshop

The Workshop is the owner's experimental area. It is a place to try things that don't fit a pack
yet: a new renderer idea, a high-fidelity remake, a toy first draft, a tool. It lives in this repo
at `workshop/<project>/` (the folder doesn't exist yet; task T11 builds its foundation, below), and
it shows on the site only with the labs switch on, labeled **"Workshop: experimental"**.

The point is speed and safety together. You can build a bold thing without learning the whole
engine, and nothing you build can break the main site or the main test suite.

## What a project is

Each project is a **self-contained static page** in its own folder:

```
workshop/
  index.html                 the Workshop page (a list of projects; labs only)
  _template/                 a project template to copy
  <project>/
    index.html               the project's page
    main.js                  its code (ES modules)
    README.md                what it is, who made it, what it needs, how to judge it
    record.md                the record (HANDBACK.md)
    assets/                  its files
    src/                     the source, if the project ships bundled output (see below)
```

A project **imports Splashery's own files by relative path and never copies them**:

```js
import * as pc from "../../src/pc.js"; // PlayCanvas, vendored 2.22.3, only through here
import { Kit } from "../../src/kit.js"; // the Kit
import { PROFILES } from "../../src/generators.js"; // the detail tiers
```

A copy of an engine file goes stale and forks the project from the site. If a project needs a change
in an engine file, say so in its README; the owner decides.

## The rules in the Workshop

**Only Rules v1 applies** ([RULES.md](RULES.md)), with the Workshop's one loosening: a project may
ship bundled JavaScript if its source is committed beside it (Rules D1). Everything else holds: the
people, content, license, credit, and privacy rules (A, B, C); PlayCanvas stays the vendored 2.22.3
(D2); and how you work (E): your own branch, draft PRs, honest reports.

**The engine's conventions do not apply.** A Workshop project doesn't have to be one entity, use the
splat file format, or save into a scene. It can be any static page that does something interesting.
(It must still keep old `#s=` links and saved scenes working, which it does by not touching them
[Rules D3], and fit a phone [D4].)

## How a project is listed and tested

- **The Workshop page** (`workshop/index.html`) lists every project: a card with its name, a
  one-line description, who made it, its status, and its link. It shows **"Workshop: experimental"**
  at the top. A project is added by one entry in the page's list, as a toy adds one line to a shared
  list: add only yours.
- **The labs switch gates it.** The link to the Workshop appears in the app (and on the site) only
  when labs is on (`labsOn()` in `src/toys.js`; `?labs=1`; see [SETUP.md](SETUP.md)). The page
  itself should show a short "turn labs on" note when it is opened without it.
- **One smoke test** (`tests/wks.spec.mjs`) opens the Workshop page and each project's page and
  checks that it loads with no console errors and the page isn't blank. That is all. **A project
  gets no other test in the main suite**, so an experiment can never break it. A project's own
  checks run by hand and are written in its README.

## Promotion

The owner looks at the Workshop and picks a project. A lane then **ports it into a pack**: a kit
recipe or an asset-backed recipe (see [KIT-GUIDE.md](KIT-GUIDE.md)), with the shelf entry, sound,
help, credits, and tests a shelf toy needs. The project's package ([TOY-PACKAGE.md](TOY-PACKAGE.md))
and record make that a short job. Until the owner picks it, a project stays in the Workshop; nothing
in the Workshop goes on the home page or leaves labs without his decision (Rules D5).

## The Workshop foundation: a spec to build from (task T11)

This is what the first Workshop PR builds. The design is open: this says what must exist, not how it
looks.

1. **The index page.** `workshop/index.html`: a list of projects with a card each (name,
   description, maker, status, link), the "Workshop: experimental" label, and the labs note. It is a
   plain static page that uses the site's own styles and header where it can. It reads the list from
   one small data file or one array, so a project adds one entry.
2. **A project template.** `workshop/_template/`: a minimal working project (a page that makes a
   PlayCanvas scene through `src/pc.js`, shows a splat toy built with the Kit, and has a README and
   a record stub). Copying the folder and renaming it is how a project starts. It shows the relative
   imports above.
3. **The labs-gated link.** A link to the Workshop from the app and from the site, visible only when
   labs is on (copy the pattern the Worlds link uses in `index.html`). This touches engine files, so
   it is its own small, additive pull request titled "Engine: …", merged first.
4. **The smoke test.** `tests/wks.spec.mjs`: the Workshop index and every project page load with no
   console errors, and nothing else. The template folder is tested too.
5. **A compare view.** A project page, `workshop/compare/`, that shows **two things side by side**:
   two Workshop projects, or two tiers of one toy. It has:
   - a **budget slider** that sets the splat count (a tier or any value between), so you can see how
     a toy degrades;
   - a **frame-rate readout** (frames per second, with a short average) for each side;
   - a **memory readout** for each side (for example the JavaScript heap where the browser reports
     it, and the size of the files loaded), and "unavailable" where the browser won't say. Each
     readout says what it measures and what it can't. The design, and how the two sides are loaded,
     are open. It should work with the template project and with one tier of an existing toy.

What comes back: the pull requests (the Workshop PR, and the "Engine: …" PR for the link), a README
for the Workshop, screenshots at 390×844 and 1440×900 of the index and the compare view, a clip of
the budget slider changing a toy, the handback's record ([HANDBACK.md](HANDBACK.md)), and the honest
list of what ran in a real browser and what didn't.
