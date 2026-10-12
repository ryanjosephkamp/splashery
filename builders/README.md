# Builders: start here

This folder is everything an outside agent needs to build for Splashery. It is the current version
of the pack, always: the folder in the repo is the source, and a ZIP copy (below) is only a
snapshot.

## What Splashery is

Splashery is a toy box of 3D Gaussian splats that runs entirely in the browser. A splat is a small,
soft, colored blob in 3D; a toy is a few hundred thousand of them that together look like a diamond,
a piano, a galaxy, or a scan of a cactus. You orbit a toy, tap it, and it does something: a lid
opens, a flame flickers, a string rings. Most toys are **recipes**, short programs that describe a
toy with the Kit (`src/kit.js`), so the browser builds it from a seed instead of downloading
megabytes of splats. Some toys are **assets**: scans or baked models, loaded as files.

The site is plain static files and ES modules. There is no server, no bundler, no account, and no
tracking. Files a visitor opens stay on their device. The live site is
https://ryanjosephkamp.github.io/splashery/, and GitHub Pages serves it from `main`. The owner, Ryan
(GitHub `ryanjosephkamp`), builds it with a team of agents: Claude sessions that a coordinating
"Operator" session runs, plus outside builders such as you.

## Who this folder is for

You are an agent the owner pointed here: a Codex task, "the Dot" (a ChatGPT agent that is good with
Blender and procedural modeling), or any other builder. You have probably never seen Splashery. You
work on one task at a time, on your own branch, and you hand the work back as a draft pull request.
You never merge. The Operator and the owner review what comes back.

## The prompt the owner gives you

> Read builders/README.md and builders/RULES.md in github.com/ryanjosephkamp/splashery, then do task
> <id> from builders/TASKS.md.

## Reading order

1. [RULES.md](RULES.md): Rules v1. The non-negotiables. Read all of it before you build anything.
2. [TASKS.md](TASKS.md): your task, with its goal, the rules that matter most, and what comes back.
3. [SETUP.md](SETUP.md): get a working environment, and the checks to run before a handback.
4. [REPO-MAP.md](REPO-MAP.md): where everything lives, and what you may touch.
5. [KIT-GUIDE.md](KIT-GUIDE.md): how to write a toy, if your task builds one.
6. [TOY-PACKAGE.md](TOY-PACKAGE.md): the folder you hand back for a toy, so a port is a short job.
7. [WORKSHOP.md](WORKSHOP.md): the experimental area, if your task is an experiment.
8. [CREDITS-GUIDE.md](CREDITS-GUIDE.md): how to credit every asset and your own work.
9. [HANDBACK.md](HANDBACK.md): branches, the pull request, the proof, and the record.

The repo's own notes for its Claude sessions are in [CLAUDE.md](../CLAUDE.md); it agrees with Rules
v1. The toy-writing reference is [docs/PACKS.md](../docs/PACKS.md), and the scene format is
[docs/SCENE-SCHEMA.md](../docs/SCENE-SCHEMA.md).

## The hand-back rule, in short

If a task would break a rule in Rules v1:

- **Sections A, B, C** (people and content, licenses and credit, the visitor's privacy): stop before
  you build anything that breaks it. Hand back to the owner with a "Rule check" note that names the
  rule, says why the task needs to break it, and offers options.
- **Section D** (what ships on the site): you may build it in your sandbox (your own repo or
  branch), clearly marked as breaking that rule, and hand back with the same note. It never goes
  into Splashery until the owner decides.
- **Section E** (how you work): always applies.

Every handback says "Rule check: none" or lists the rules it touches.

## Where your work goes

Your own branch, named `codex/<task>-<slug>` or `dot/<task>-<slug>`, and a draft pull request. The
pull request body, the proof, and the record are in [HANDBACK.md](HANDBACK.md). Reports go in
`docs/audits/`, toy packages in the PR (or your sandbox repo), and experiments in `workshop/`. Never
push to `main`.

## Making the ZIP (for the owner)

From a checkout of the repo, with Node and the system `zip` command:

```sh
git pull
node tools/builders-pack.mjs
```

That writes `builders-pack-<YYYY-MM-DD>.zip` in the current folder. It holds this folder, the repo's
`CLAUDE.md`, `README.md`, `LICENSE`, `LICENSES.md`, and `CREDITS.md`, `docs/PACKS.md`,
`docs/SCENE-SCHEMA.md`, the Tinkerer's Manual as a PDF, and a `PACK-INFO.txt` that names the commit
it came from. The tool refuses to run if it finds a token (such as `hf_…`) in anything it would
pack. Keep the ZIP on Google Drive if you like, but the folder in the repo is always the current
version: when the two differ, trust the repo, and make a new ZIP.
