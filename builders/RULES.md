# Splashery Rules v1 (for every builder)

The owner, Ryan, and the Operator agreed on these rules on October 12, 2026, for every agent that
builds for Splashery: his Codex agents, his ChatGPT agent ("the Dot"), Claude sessions and anyone
else. **Anything not on this list is fair game.** A change to this file needs both the owner and the
Operator, in a reviewed PR.

Read [README.md](README.md) first for how to use this folder.

## The hand-back rule

When a task would break a rule:

- **A rule in A, B or C** (people and content, licenses and credit, the visitor's privacy): stop
  before building anything that breaks it, and hand back to the owner with a "Rule check" note that
  names the rule, says why the task needs to break it, and offers options.
- **A rule in D** (what ships on the site): you may build it in your sandbox (your own repo or
  branch), clearly marked as breaking that rule, and hand back with the same "Rule check" note. It
  never goes into Splashery until the owner decides.
- **A rule in E** (how you work): always applies; there is no exception.

Every handback says "Rule check: none" or lists the rules it touches.

## A. People and content

- **A1.** No modern real-world firearms, no logos or brand names, no gore. Historical, fantasy and
  sci-fi weapons are fine where a world calls for them. Targets are objects, never people or
  animals. _Why: the site is for everyone, kids included._
- **A2.** No real person's likeness: no living celebrities, no identifiable people. Flags stay
  respectful. Anatomy is a clinical atlas. _Why: consent and respect; no one is surprised to find
  themselves in a toy._
- **A3.** AI-made pictures and video appear only as labeled Studio samples, with no people, logos or
  text. They are never presented as real, and never used for science, math or engineering toys, the
  photoreal shelves, or landmarks shown as real. _Why: science and real places need real data._

## B. Licenses and credit

- **B1.** Assets only under CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, public domain, or NASA 3D
  Resources (insignia removed). Never NoDerivatives, unlicensed, "personal use", paid or scraped.
  The license is checked on the live source page. _Why: everything on the site must be lawful to
  share and remix._
- **B2.** Every asset carries its record: source page, author, license, date checked, file hash, and
  what was changed. BY-SA and NC notices show beside the asset. Anything made from one keeps its
  license. An NC asset and a BY-SA asset never merge into one (side by side in a scene is fine), and
  an NC asset carries `"nc": true` in `tools/assets.json` or `tools/models.json`. _Why: credit stays
  correct, and NC assets can be removed with one command if the site ever earns money._
- **B3.** Code libraries are open source, vendored in `vendor/`, loaded only when their toy opens,
  and listed in `LICENSES.md`. A copyleft license (GPL, AGPL), a library that calls a server, or one
  over 2 MB goes to the owner first. _Why: keeps the site light and its license clean._
- **B4.** Code an agent writes for Splashery is offered under Splashery's MIT license. Original
  assets an agent makes (procedural models, baked splats, sounds) are CC0. Both are credited as
  "made by Ryan with <agent and model>" in `CREDITS.md`, the asset lists and the toy's in-app
  credit. _Why: without a license the work can't legally ship._

## C. The visitor's privacy

- **C1.** A static site: no server, no backend, no accounts, no API keys or secrets in the page, no
  analytics or trackers. _Why: free to host, nothing to breach, nothing to track._
- **C2.** Files people open stay on their device. Nothing is uploaded, stored or sent. _Why: the
  site's promise in its terms of use._
- **C3.** Microphone, camera, screen or location only after a tap, never recorded or sent. A
  recorder saves only to a file the person chooses. _Why: the owner's approvals of September 30 and
  October 4, 2026._
- **C4.** Live data only from keyless public feeds whose terms allow reuse, with the source and time
  shown, and a dated snapshot for when the feed is down. _Why: the owner's calls of October 4 and
  5, 2026._
- **C5.** The owner's notes and files stay private. They never go into a repo, a PR or a page unless
  he approves a cleaned-up version. _Why: his rule of October 11, 2026._

## D. Anything that ships on the Splashery site

- **D1.** Plain static files the browser loads directly: ES modules, no CDN, no bundled JavaScript,
  and no install step to serve the site. Build tools may generate data and assets ahead of time. In
  the Workshop only, a project may ship bundled output if its source is committed beside it. _Why:
  anyone, human or agent, can read, diff and fix every line that runs._
- **D2.** PlayCanvas stays the vendored 2.22.3, reached through `src/pc.js`. Changing the version is
  the owner's call. _Why: one renderer, one version, so every toy behaves the same._
- **D3.** Old share links (`#s=`) and saved scenes (schema v2 and v3) keep loading. _Why: links
  people shared must never break._
- **D4.** It fits a phone. The Auto budget picks the tier for the device, and the "embed transfer ≤
  30 MB" test stays green. Size guidance is a recommendation, not a limit: aim for a default first
  load of 15 MB or less per toy, with bigger tiers opt-in (up to about 40 MB) and no single file
  over 20 MB; say in the handback when a toy goes over. _Why: most visitors are on phones._
- **D5.** New areas open behind the labs switch. The owner decides what leaves labs and what goes on
  the home page. _Why: his rule of September 29, 2026._

## E. How builders work

- **E1.** Your own branch or repo, draft PRs only. Never push to `main`, merge, force-push or
  rewrite history. _Why: every change is reviewed before it reaches the site._
- **E2.** Report honestly: what ran in a real browser, what was mocked, what wasn't measured. _Why:
  effects are judged as motion; a mock can't show that._
- **E3.** Never commit secrets or tokens. _Why: a public repo keeps everything forever._
- **E4.** Public text in American English with the serial comma ("a, b, and c"). _Why: the owner's
  house style since October 9, 2026._

## Not a rule, but the bar every toy is judged by

The effect quality rules in [CLAUDE.md](../CLAUDE.md) ("Effect quality rules"): real motion with
solid parts, separate things moving separately, break-apart effects that break into real pieces,
instruments that are played, games by real rules, materials that look real, crisp text, and every
effect judged as a clip at phone size.

## Fair game, for example

- Blender, Python, compilers and any open-source build tool, listed in `LICENSES.md` with its
  version, never shipped.
- Pre-baked, asset-backed recipes at any splat count, in tiers.
- Hybrid scenes with meshes, lines, text and HTML overlays, labeled "hybrid" where they show. Hybrid
  toys may join the main shelves.
- Custom shaders, new physics, new solvers and new game modes.
- New shelves, tools, games and Workshop experiments.
- Refactors and speedups that keep every test green.

## The owner's decisions behind these rules (October 12, 2026)

- Experiments live in a sandbox (your own repo or branch) and in a **Workshop** area in Splashery
  (`workshop/`, behind the labs switch). See [WORKSHOP.md](WORKSHOP.md).
- Hybrid toys may join the main shelves, labeled hybrid.
- Size is guidance, not a hard limit (D4).
- Agent-made code is MIT and original agent-made assets are CC0 (B4).
- Any open-source build tool is allowed when listed in `LICENSES.md`.
- Bundled JavaScript only in the Workshop, with its source beside it (D1); this may loosen later.
