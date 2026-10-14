# Codex task 60: skies and backdrops for the Worlds (made by code, CC0)

**Branch:** `codex/world-skies`, cut from `main`. One draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md` (B4 and D4), the Worlds templates and games under `src/`
(search for the Worlds shelf in `src/toys.js`), and CLAUDE.md's "Effect quality rules".

## Goal

1. **Sixteen skies and backdrops, made by code** (procedural shaders, or Blender renders to
   equirectangular panoramas): clear noon, golden hour, dusk with clouds, overcast, storm, snowfall,
   fog over hills, a fantasy aurora, a fantasy twin-moon night, an underwater caustic dome, a cave
   glow, a desert haze, a jungle canopy, a pirate-sea horizon, a castle-hill sunset, and a sci-fi
   nebula (clearly art). Original and CC0, credited "made by Ryan with Codex". Never presented as a
   real sky or real astronomical data.
2. **A small library**, `src/worlds/skies.js` (new, additive): load a sky by name at the right size
   for the device's budget (a phone tier of 1,024 px or less, a desktop tier up to 4,096 px), WebP
   or KTX2 if the repo already supports it, loaded only when a world asks for it.
3. **A labs preview toy, "Sky picker"**: drag to look around, tap to switch skies, with a how-to
   line, About text, a thumbnail, and its row with the labs flag (edit only your own lines in the
   shared lists).
4. **Don't wire the skies into existing worlds.** List in the report which world or template should
   use which sky; a Worlds lane adopts them later.

## Don't touch

The files of the open PRs (#168, #560, #562, #566, #581 and #582), existing worlds and games, and
`vendor/`.

## Report

`docs/audits/world-skies-2026-10.md` with a contact sheet of all sixteen at phone size and the size
of each tier. Tests: `tests/cdx-skies.spec.mjs` (each sky loads at each tier), plus `taps`, `help`,
`unit` and `smoke`. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff`
are clean.
