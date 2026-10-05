# Splashery: notes for Claude sessions

Splashery is a pure-browser toy box of 3D Gaussian splats. The owner is Ryan (GitHub
`ryanjosephkamp`). The live site is https://ryanjosephkamp.github.io/splashery/ and GitHub Pages
serves it from `main`.

**Start here:** read [docs/HANDOFF.md](docs/HANDOFF.md) (the state of main and the active lanes) and
[docs/OPERATING.md](docs/OPERATING.md) (how parallel sessions work). A lane session then reads its
row in [docs/WORKSTREAMS.md](docs/WORKSTREAMS.md) and its own `docs/handoff/<lane>.md`, does that
lane's work, and keeps its handoff file current. Only the Operator session edits HANDOFF.md.

## Parallel sessions

Several sessions build at once: one per lane, plus the long-lived Operator session that plans and
coordinates. [docs/OPERATING.md](docs/OPERATING.md) has the rules. In short:

- The Operator runs the lanes (since September 27, 2026). It writes each lane's brief, starts the
  worker session with it, checks and steers it, reconciles the PRs and brings the owner finished
  work. The owner talks only to the Operator and reviews the clips. A worker puts its questions in
  its final message ("READY:", "WORKING:" or "BLOCKED:"), not to the owner.
- Each worker runs the model its lane is assigned, at the default effort (the owner's split of
  September 29, 2026): Opus 5.5 for the engine, the toys, sounds, fidelity and the Operator; Sonnet
  5.5 for the Worlds content (games, templates), the Studio converters, the docs and the Integrator.
  Any other model needs the owner's permission first. Every lane, PR and clip names its model. The
  Operator checks each worker's model at every check-in and stops one that has run on another.
- A lane edits only the files it owns (its row in WORKSTREAMS.md) and its own toys' entries in the
  shared lists (`src/toy-sounds.js`, `src/toy-help.js`, `tools/toy-plan.json`, `src/toys.js`,
  credits).
- Regenerate TOY-PLAN.md; never merge it by hand.
- No engine changes in a lane PR: a small, additive "Engine: …" PR, merged first.
- Never edit `tests/taps.spec.mjs` (it finds every kit toy's tap by itself); a lane's extra tests go
  in `tests/<prefix>.spec.mjs`.
- Lanes post clips and cards to the Effect review page without republishing it (OPERATING.md, "Steps
  for a lane").
- When main moves, merge it into your branch; never rebase a pushed branch.

## Ground rules

- Static files and ES modules only. No bundler, CDN, server, or API keys in the page. PlayCanvas
  2.22.3 is vendored in `vendor/` and imported only through `src/pc.js`. PDF.js and omggif (approved
  September 28, 2026) are vendored there too, loaded only when someone opens a PDF or a GIF. ONNX
  Runtime Web and the Depth Anything V2 Small model (approved September 29, 2026) are vendored there
  too, loaded only when someone turns a photo into 3D. Splat.js (MIT; approved September 30, 2026,
  for the video-to-3D spike) may join them, behind the labs switch, loaded only when someone opens a
  video for it. Project Nayuki's QR Code generator (MIT) and jsQR (Apache-2.0) (approved October
  3, 2026) are vendored there too, loaded only when someone opens the QR code toy.
- Libraries (the owner's rule of October 4, 2026): the Operator may approve an open-source library a
  toy or tool needs without asking the owner each time: vendored in `vendor/`, loaded only when its
  toy opens, listed in `LICENSES.md` and named in the PR. A copyleft license (GPL, AGPL), a library
  that calls a server, or one over 2 MB goes to the owner first. He approved a LAZ reader for point
  clouds and a DICOM reader for medical volumes the same day.
- Live input (approved September 30, 2026): a toy asks for the microphone, the camera or screen
  capture only when the person taps to start it. Nothing is requested or loaded before that, and
  nothing is recorded, stored or sent anywhere. One exception (the owner's request of October 4,
  2026): a recorder, such as the Sound lab's, may record when the person taps Record, keeps the
  recording on the device and saves it only to a file the person chooses.
- Live data (the owner's calls of October 4, 2026): the earthquakes toy may read the USGS earthquake
  feed when the person opens it or taps to refresh, and other open geographic feeds (animal
  tracking, migration) may be read the same way when their terms allow reuse. Only keyless public
  endpoints; the source and the time of the data show beside it; nothing is stored or sent; a dated
  snapshot ships with the site for when the feed can't be reached. The Night sky may ask for the
  person's location only when they tap for it, and never stores or sends it. The molecule viewer may
  fetch a structure from the Protein Data Bank (CC0) by its code when the person asks (the owner's
  "PDB fetch yes", October 5, 2026); the same terms apply.
- Build tools in `tools/` may use pinned devDependencies. List each one in `LICENSES.md`. Programs
  outside npm that train splats on the owner's Mac (Blender, Brush or msplat; the Splat Fidelity
  Plan, approved October 3, 2026) are build tools too: listed in `LICENSES.md`, never shipped.
- Assets must be CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA or public domain. Never a NoDerivatives
  ("ND") license, and never unlicensed, "personal use" or paid files. CC BY-SA (allowed since the
  owner's call of October 2, 2026) is per asset: its license notice shows beside it, and anything
  made from it (a splat converted from a BY-SA mesh) stays BY-SA. CC BY-NC and CC BY-NC-SA (the
  owner's call of October 3, 2026) are per asset on four conditions: its license notice shows beside
  it; never ND; it carries `"nc": true` in `tools/assets.json` or `tools/models.json`, so one
  command (`node tools/nc-assets.mjs`) lists every NC asset to take out if the site ever earns
  money; and anything made from it keeps its license. Never merge an NC asset and a BY-SA asset into
  one asset (side by side in a scene is fine). Check the license on the live source page. Record it
  in `CREDITS.md`, in `tools/assets.json` or `tools/models.json`, and in the toy's in-app credit.
  One exception (the owner's call of September 30, 2026): the Wikipedia book fetches an article live
  from Wikipedia's REST API when the reader asks for it (CC BY-SA text). It is never stored in the
  repo, shipped with the site or saved in a scene, and the article's credit and license show beside
  it.
- AI-made samples (the owner's calls of October 5, 2026, Push Plan AI1 to AI5): pictures and video
  the owner makes with his own AI image or video plan may ship as Studio samples (Photo to 3D, Video
  to 3D, Moving photo to 3D), labeled as AI-made beside them, with no people, logos or text, and
  never presented as real captures or real places. Record each in `CREDITS.md` and
  `tools/assets.json` as AI-made by the owner. AI-made pictures and video are never used for
  science, math or engineering toys, the photoreal shelves, or landmarks shown as real; those keep
  real data and real captures.
- Photoreal captures under licenses the site can't use (ND, no license) may be viewed privately, on
  a private page, for comparison (the owner's call of October 2, 2026). They never go into the repo
  or the site.
- Old `#s=` links and saved scene JSON (schema v2 and v3) must keep loading.
- No modern real-world firearms, no logos or brand names, no gore. Flags stay respectful. Since
  September 29, 2026, historical, fantasy and sci-fi weapons are fine where a world calls for them
  (a cutlass, a flintlock, ship cannons, a space blaster, a bow), and so are an inspector for those
  designs and a butterfly-knife toy. Targets are objects, never people or animals.
- Anatomy is shown as a clinical atlas (the skin layer smooth like an anatomical mannequin, organs
  as in a textbook). Ask the owner before using any CC BY-SA or NC source.
- Splashery doesn't inspect, filter or censor what people open. Files stay on their device, and the
  terms of use in the About tab say they are responsible for what they open and share.
- American English for every new public-facing text: the docs, the words on the site (toy names,
  descriptions, buttons, credits) and PR titles and bodies. So color, center, gray, math, license,
  toward, catalog, -ize endings, and dates like "September 27, 2026". Code identifiers, file names
  and anything stored in links or saved scenes stay as they are. Don't rewrite older British text on
  the side: one sweep does that before the blog post.
- Secrets: `HF_TOKEN` (a Hugging Face read token) is for build-time tools only. Never print it,
  commit it, or put it in logs, PRs or files. To check it, test that it is set
  (`[ -n "$HF_TOKEN" ]`), or call the whoami API and print only the account name and token role.

## Effect quality rules

The owner's reviews set these (details and examples in docs/PACKS.md, "Effect quality"). Check every
new or changed effect against them before calling it done.

- Real motion, not a warped picture. Parts move as solid pieces. Never bend a scan with soft regions
  for a visible effect. If a scan cannot move a part cleanly, cut the part out with hard edges, swap
  in a kit-built part, rebuild the toy as a kit toy, or choose a different effect.
- Separate things move separately (each tomato, each drupelet, each chess piece).
- Break-apart effects break into real pieces that fall off and come back.
- Instruments are played: the strings, keys or skins visibly move with each note.
- Things that talk move their mouths. Animals and statues move like the real thing.
- Games follow real rules. Balls and discs move like the real thing when thrown or hit.
- Materials look like the real material: no see-through solids, no blur, no speckle.
- The grape (a peel that shows the pale flesh) is the bar: a clear, physical effect you read at a
  glance.
- Judge effects as motion at phone size, not only as small stills: render a clip of each changed
  effect (`tools/effect-clip.mjs`) and publish them on the private "Effect review" page for the
  owner before asking for a merge.

## Before every push

- `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`. Never run
  `playwright install`. Keep the "embed transfer ≤ 30 MB" test green.
- `node tools/us-english.mjs --diff`: new public text in American English (it lists British
  spellings in the lines your branch adds).
- `npx prettier --check .`. If `.claude/worktrees/` exists, also pass
  `--ignore-path .gitignore --ignore-path .prettierignore --ignore-path .git/info/exclude`.
- For new or changed toys:
  - Run `node tools/check-packs.mjs <pack>`.
  - Review a contact sheet made with `tools/contact-sheet.mjs`.
  - Re-render thumbnails with `tools/make-thumbs.mjs`.
  - The tools expect `python3 -m http.server 4173 --bind 127.0.0.1` to be running.
- Take screenshots at 390×844 and 1440×900 and save them in `tests/screenshots/`. A lane names its
  own `<prefix>-<name>-390x844.png` and `…-1440x900.png`, and after the full test run puts the
  standard screenshots back with `node tools/upkeep.mjs --restore-shots` (the Operator refreshes
  them on main).

## Pull requests

- Open draft PRs against `main`. The body has five sections: Summary, Verification, Deviations,
  Known issues, What was cut.
- Merging (the owner's rules of September 29, 2026): the Operator merges its own Ops PRs, anything
  behind the labs switch, and additive engine PRs once the full test run passes. Changes to toys the
  public already sees wait for the owner's "good" marks, then the Operator merges them. The owner
  alone decides what leaves labs, rule changes and the homepage. Always use "Create a merge commit".
  Workers never merge.
- Use the branch the session assigns. For stacked PRs, add `-<part>` suffixes and merge them in
  order.
- A lane opens one PR titled "Phase <lane>: …". The Operator's PRs are "Ops: …" on
  `claude/operator-<topic>`. Keep your PR mergeable: when main moves, merge it into your branch.
- Report honestly. Say what was verified and what was skipped.

## Working style

- The push (the owner's call of October 4, 2026): about ten to twelve busy workers on this account,
  on his banked reset, until the weekly reset of Wednesday, October 7, 2026, 4 p.m. ET; then back to
  about six (seven at most). The Integrators run the full suite for the lanes.
- Shelves (the owner's call of October 4, 2026): the toy shelves are closing. Balls, food, nature,
  gems, medieval, holidays, music (no new instruments), Open me, animals and the cartoon vehicles
  get only their hands-on finishing; a new toy there only when the owner asks (a new animal only as
  a photoreal capture). Landmarks, the body, weather and fire grow only with photoreal or
  high-fidelity work (real 3D captures, volumetric data). New work goes to science, tools, the
  Studio, Pictures and Pages, QR codes, the labs, Space, Tiny world, Atoms, Math, and AI and
  computing. A stepping-stone lab is fine when it teaches something a planned toy needs (a wind lab
  before a tornado).
- Pace before the push (the owner's choice of October 2, 2026): up to ten Splashery workers at once
  for the close-out of the toys; then back to about six (seven at most). Before that (from the
  weekly reset of September 30, 4 p.m. ET) it was about six workers at once (seven at most) plus an
  Integrator, paced by the 5-hour limit; the owner reports the weekly usage morning and evening.
  (Until then it was up to 12, and 8 before the morning of September 29.) Once 6 or more lanes run,
  an Integrator worker runs the combined test runs. A lane uses at most one helper at a time. (Seven
  parallel builders once used up a week's usage in one go, so the Operator watches the limits.)
- New parts of the site (Studio, Worlds, Lab and Learn) open behind the labs switch; the owner
  decides when each goes public.
- The owner works from the phone app. Keep replies short and plain, and give step-by-step
  instructions whenever the owner has to do something.

## Where things are

- `README.md`: features and code layout.
- `docs/OPERATING.md`: how parallel sessions work. `docs/WORKSTREAMS.md`: the lanes and who owns
  what. `docs/handoff/`: each lane's file and `history.md` (the phase notes from A to E4).
- `docs/ROADMAP.md`: the plan.
- `docs/BACKLOG.md`: what is not being built now, and what would unblock it.
- `docs/TOY-PLAN.md`: every toy's planned tap effect, sound and fixes, generated from
  `tools/toy-plan.json` by `node tools/toy-plan.mjs` (run it after adding or finishing a toy).
- `tools/upkeep.mjs`: the Operator's upkeep after a merge (TOY-PLAN.md, the Sound Board page file,
  the standard screenshots). `tools/sound-board.mjs` builds the Sound Board page and
  `tools/help-board.mjs` the Help Board (every toy's how-to line and About text).
- `docs/reviews/`: the owner's reviews, verbatim, with screenshots (sound notes too).
- `tools/sound-review.json`: the sound review, per toy (notes, plans and new sounds to hear), shown
  on the Sound Board (OPERATING.md, "The sound review").
- `docs/PACKS.md`: how to write toy recipes.
- `docs/SCENE-SCHEMA.md`: the scene format.
- `CREDITS.md` and `LICENSES.md`: attributions and licences.
