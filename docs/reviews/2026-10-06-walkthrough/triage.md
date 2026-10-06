# Triage of the October 6 walkthrough review

The Operator's triage of `notes.md`, item by item, and the lane that owns each. Anything the owner
didn't mention is approved, and so are the site's layout and design on phone and desktop (he wants
them kept). Lanes started on October 6–7, 2026: **Site r2** (`st2`, Sonnet), **Toy pages r2**
(`tp2`, Sonnet), **Sound D** (`sndd`, Opus), **Arcade r2** (`arc2`, Opus) and **Fix9** (`fx9`,
Opus). Later lanes, once slots free: **Space r3** and **Live r8**.

## Kept as they are (the owner's approvals)

- The site's look, layout and density, the landing page, the Toys, Tools and Studio hubs, the
  search, What's new, Embed and share, Privacy, Terms, Credits and desktop: all good.
- The QR pop-out on a hinge at an angle: keep it.
- The Chladni plate works ("one of the coolest things here"); the spring toy, storybook, boombox,
  vintage camera, real alarm clock, water bottle look and pancakes are good.

## Site r2 (`st2`, Sonnet)

1. The footer on every page: "Made by Ryan Kamp" with his contact links, plus a Contact page (also
   linked from Credits). No "made with AI" line in the footer; the disclosure stays where it is. His
   links: waiting on the owner (the list came through empty); until then, the links on his personal
   site (GitHub, LinkedIn, X, YouTube, Hugging Face, his blog), for him to confirm.
2. About: his name links to his personal website's landing page (https://ryanjosephkamp.github.io/).
3. Every link that opens the Splashery app (the footer's gallery link, "Open in Splashery", the
   manual's "open in the toy" links) opens in a new tab. Links to other sites open in a new tab.
4. A toy's name or card anywhere on the site goes to its toy page, not into the app; only an "Open
   in Splashery" button opens the app. This covers the Tools hub's cards and the Science table's toy
   names.
5. Science: the toy gallery first, then the big table and "Is it right?" below it (all kept).
6. The menu: after picking a page from the menu and going back, the menu must not pop open again.
7. Guides and documents linked from the site (writing toy recipes, the scene format, the embed guide
   and the like) get a page on the site, built from the Markdown in the repo at build time so they
   stay in sync, with a link to the GitHub source. Code stays a GitHub link.
8. Long pages with a table of contents (the Tinkerer's Manual, the guides, "How Splashery is made")
   get a quick outline to jump between sections on phone and desktop, without covering the content.
9. The Tinkerer's Manual: its two links to Splashery at the very bottom ("Splashery" in the colophon
   and "Back to Splashery") become one on the web page (keep whatever the PDF needs). An interactive
   glossary can come later.
10. "How Splashery is made": a picture of the workflow, ideally the project's loop graph made with
    GROOPH (3D if it embeds well). The owner reviews it first, privately, before it goes public.

## Toy pages r2 (`tp2`, Sonnet)

1. A toy page's embedded toy plays its sound on a tap by default (a tap counts as the browser's user
   gesture), with a way to mute it.
2. "Open in Splashery" opens in a new tab.
3. A "Learn more" link per toy where it helps (Wikipedia or another trusted source), opening in a
   new tab; skip it where the page already cites its sources (most science toys) or nothing fits
   (the splat mirror). Linking needs no license change.
4. The catalog PDF, round 2: each toy's About text and how to play, its views and settings, a table
   of contents with links and PDF bookmarks, rebuilt from current main.

## Sound D (`sndd`, Opus)

- The clicking "zipper" sound on the photoreal shelf: remove it everywhere (Stollen, Physalis, white
  roses, bonsai photo, mushroom photo, golden maple, peonies in a vase, money tree, monkey doll and
  any other photoreal toy that still has it). Fix it at the root if the toys share it.
- Stollen: the note is too loud. Orange photo: one bubble, not two, and subtler. Physalis: no
  twinkles. The crystal: much subtler. Monkey doll: keep the rubber-band sound. Sunflower photo: a
  new subtle sound (no stretch or wind). White roses: keep the glass ding. Crochet Earth: no
  twinkle. Golden maple: subtler wind. Neon knot: a new sound (the other knots' sound is fine).
- Popcorn: the sizzle should sound like real popcorn popping. Water bottle: a pour from a bottle,
  not a waterfall. Point clouds: subtler wind and twinkle.

## Arcade r2 (`arc2`, Opus)

- Shardball and Page Breaker: a new sound for breaking bricks and blocks (keep Page Breaker's
  special hit sound). In Shardball, the pause and 2D/3D controls move to the bottom near the thumbs,
  and "Go" is explained or merged into play.
- Games with a play button: it doubles as pause (it shows pause while playing).
- Long tail: sharper; drag around the cube to turn it (like the puzzle cube); tap the cube above,
  below or beside the snake to steer it, so the arrows are optional.
- Grain Garden: on a phone you can't leave full screen; fix it.
- Note Rider: load your own song (a MIDI file; an audio file through a converter if it can be done
  well, or say plainly why not).

## Fix9 (`fx9`, Opus)

- Cherries: two cherries on stems that swing like a small Newton's cradle at real speed (no slow
  motion); pulling one off can stay.
- Soda can: the suds spill over the rim and run down before they fade.
- Data in 3D: a tap anywhere on the axes plays the effect too.
- Fluid lab: a warning, or a lighter mode, before it runs on a phone that can't keep up.
- Orange photo: less grainy. Dog plush: the dark gaps under the head and paws (screenshot); fix them
  if the capture allows, or say why not.
- Tiny world: cell division, apoptosis and phagocytosis sharper.

## Elsewhere

- **Real elements** (running): the sound of particles joining the nucleus grates; make it softer,
  closer to the splat simulator's sorting sound. The overall sharpness is already in #318.
- **Space r3** (next): the real planets and moons sharper and less grainy; a tap zooms deep into
  that spot and names the place (country, state, city) from coordinates and an open boundaries
  dataset.
- **Live r8** (next): the Chladni plate (and its sand) sharper; a look into a true 3D version
  (particles settling on the nodal surfaces of a 3D standing wave) only if the physics holds up; an
  on-screen depth slider for the splat mirror and the other depth toys (an overlay, not splats,
  hideable).
- **Worlds**: may grow later, possibly built by the Dot.
- **The Tinkerer's Manual**: wording review later, by the owner.
