# Codex task 82: Checkpoints for the owner's favorite toys (five parallel parts, a to e)

**Branch:** `codex/toy-checkpoints-<letter>`, cut from `main`. One draft PR per part against `main`.
Clips go on `codex/toy-checkpoints-<letter>-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md, and `docs/studio/photo-3d-checkpoint.md`, the model to follow.

## Why

Photo to 3D now has a checkpoint: a saved branch, a list of the files that make it up, restore
steps, and the rule that later work must beat it. The owner wants the same for the toys he finds
most impressive, plus a plain explanation of exactly how each one works, so that later rounds can
improve them without losing what they are now.

The Operator saves the whole repository at one commit on the branch
`claude/checkpoint-toys-2026-10-14` before you start. Every part points at that branch. Never push
to, rebase, or delete it.

## The parts

| Part | Toys (toy id)                                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a    | QR code (`qr-code`), QR damage lab (`qr-damage`), Picture QR (`qr-picture`)                                                                                                      |
| b    | Moving photo to 3D (`moving-photo-3d`), Video to 3D (`video-3d`), Splat mirror (`splat-mirror`), Model to splats (`model-splats`)                                                |
| c    | Sound in a box (`chladni-cell`), Chladni plate (`chladni-plate`), Song landscape (`song-landscape`)                                                                              |
| d    | Picture lab (`picture-lab`), Your book (`your-book`), Photo album (`photo-album`)                                                                                                |
| e    | Powers of ten (`powers-of-ten`), Super-resolution microscope (`smlm-microscope`), Galaxy in a box (`galaxy-box`), Point clouds (`point-clouds`), Volume viewer (`volume-viewer`) |

## For each toy

One file, `docs/studio/<toy id>-checkpoint.md`, in the shape of `photo-3d-checkpoint.md`:

1. **Where the checkpoint lives:** the branch and commit.
2. **How it works,** from the code: what goes in (files, camera, microphone, data), every step to
   the splats on screen, every setting and what it changes, the math or science it uses (with
   sources), and what it shares with other toys. A diagram where it helps (Mermaid in the Markdown
   is fine). Exact file and function names.
3. **The files that make it up,** and the tests that define its behavior.
4. **How to restore it** (the `git checkout <branch> -- <files>` line), and which other toys share
   those files and must be checked after a restore.
5. **What it does best and its known limits,** measured where you can (load time, frame rate at the
   phone profile, sizes), and ideas for later rounds.

Plus clips of each toy at 390×844 on the clips branch, linked from its file.

## Rules

Documentation only: no change to `src/`, `assets/`, `vendor/`, or tests. American English and the
serial comma. No new images in the repository over 1 MB each; put larger evidence on the clips
branch. PR body with Summary, Verification, Deviations, Known issues, and What was cut.

Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
