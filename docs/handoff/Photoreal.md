# Lane Photoreal: where photoreal captures of our toys can come from (prefix `pr`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photoreal, "Photoreal captures: research and a private
comparison page" (prefix `pr`). Branch: `claude/lane-photoreal` (documents only). PR title: "Phase
Photoreal: where photoreal captures of our toys can come from". Handoff file:
docs/handoff/Photoreal.md. Model: Sonnet 5.5 (research and docs).

### Brief (written by the Operator on October 2, 2026, from the owner's review and his answers that day)

The owner thinks the photoreal scans are the best things on the site ("the absolute highest fidelity
best objects in the entire site are the photoreal ones") and wants to see photoreal versions of what
we already have, even under licenses we keep off the site, to compare privately and then decide what
to add. His calls of October 2, 2026:

- P1 yes: a **private comparison page** where he can see photoreal captures beside our toys,
  including ones whose licenses we keep off the site, as long as the source lets you download them
  for personal use. Nothing on it is published, committed or shared.
- P2 yes: **CC BY-SA is now allowed on the public site**, per asset, with its notice beside it
  (anything made from it stays BY-SA). Anatomy sources still go to him first.
- P3: **NonCommercial, unlicensed, "personal use" and paid assets stay private**: never in the
  repository or on the site.
- P4: this lane. N15 (later, after you): a photoreal elements table inspired by Theodore Gray's _The
  Elements_ (a real sample of each element, each also a toy); his photos are copyrighted and can't
  be used, so the samples must come from elsewhere. N27 (later, with you): other depth models for
  Photo to 3D.

His review, word for word: docs/reviews/2026-10-02-mega-review/review.md (look for "photo real",
"photoreal", "geospatial", "tornado", "anatomy" and "Theodore Gray").

#### What to deliver

1. **docs/research/PHOTOREAL.md** (public; links and facts only, no files): for each shelf, the best
   photoreal captures we could use for our existing toys, plus new subjects he named (real terrain,
   real weather such as tornadoes, anatomy, samples of each chemical element). For each candidate:
   what it is, link, format (Gaussian splat .ply/.spz/.sog/.splat, or a photogrammetry mesh we could
   convert with Model to splats), size, and its license **as stated on the live page**, sorted into
   three groups: "fits today" (CC0, CC BY, public domain, now also CC BY-SA), "private only" (NC,
   unlicensed, personal use, paid), and "no good capture found". Start with the shelves where a real
   capture would matter most: food and fruit, gems and minerals, animals (figurines or specimens,
   never living people), vehicles, landmarks, anatomy, Nature, Weather, terrain. Good places to look
   (check each license yourself): Smithsonian Open Access (CC0), Google Scanned Objects (check its
   license), NIH 3D, USGS and OpenTopography (terrain), museum collections on Sketchfab under CC BY,
   Polycam and Scaniverse public galleries, SuperSplat and PlayCanvas galleries, Hugging Face
   datasets of splats, Wikimedia Commons (for the elements: many element photos there are CC BY or
   CC BY-SA). Also a short section on depth models for Photo to 3D (larger Depth Anything V2 sizes,
   Depth Pro, MoGe and others): license, size, browser feasibility.
2. **A private comparison page**: a private claude.ai artifact (it's private to the owner's account;
   never shared) showing 10 to 20 of the most striking candidates live as splats (PlayCanvas from
   cdn.jsdelivr.net, loading the files from the artifact's own asset store; load the
   `artifact-capabilities` and `artifact-design` skills before you build it), each beside our toy's
   current thumbnail (from the repository's `thumbs/`, uploaded to the page) with its name, source,
   license and size. Private-only items are fine on this page; they must never go into the
   repository. Keep each asset under the store's size limit (convert or decimate if needed). Give
   the Operator the page's link.
3. Nothing in the site changes in this lane: no toys, no assets in the repository. The owner picks
   from the page, and a later lane brings in what he chooses.

#### You own

- docs/research/PHOTOREAL.md, docs/handoff/Photoreal.md and the private page. Nothing else in the
  repository.

Many lanes run at the same time (Sound C, Fix7, Physics, Sharpness A, UI r5, Fluids, Video 3D, Live
input, Science and the Integrators); you don't touch their files.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message, and the Operator
  answers or relays them. Messages that arrive in this session "From the Operator" come from the
  coordinator on the owner's behalf.
- Model: Sonnet 5.5 only, at the default effort (the owner's assignment of September 29, 2026:
  research, docs and converters on Sonnet 5.5). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging: the Operator merges docs-only PRs after checking them. Never merge anything yourself.
- Language: every new text is in American English (color, center, gray, license, toward, -ize
  endings, dates like "October 2, 2026").
- Read first: CLAUDE.md (the ground rules), docs/OPERATING.md and CREDITS.md (how we record licenses
  today).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State".
- Licenses: read each license on the source's live page, not from a listing or a search snippet, and
  quote the exact license name. If a page is unclear, say "unclear" and put it in "private only".
- No logos, brand names or insignia on anything you'd propose for the site; nothing that targets
  real people; no modern real-world firearms.
- Push your work in progress about every hour and open your draft PR early. Before pushing:
  `npx prettier --check .` and `node tools/us-english.mjs --diff`.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary.
- Finish every working turn with a short final message that starts with "READY:" (PR link, the
  private page's link, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly
  what you need).

## State

Model: Sonnet 5.5 (default effort), plus one Sonnet 5.5 helper for the non-SuperSplat sources.

Started October 2, 2026. In progress: the research document, the private comparison page. Nothing is
pushed yet.

## Notes

- SuperSplat's scene pages publish each scene's license and download switch as data
  (`/scene/<id>.data`); the `rel="license"` link on the HTML page agrees with it. SuperSplat has no
  CC0 choice: the licenses seen were CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, CC BY-ND and CC
  BY-NC-ND.
- The thumbnails the brief calls `thumbs/` live in `assets/toys/<id>/thumb.webp`.

## Known issues

(none yet)

## For the Operator

(to fill in)
