# Bake-off prompts

The prompt texts for a blind bake-off (`.claude/skills/bakeoff/SKILL.md`). Fill in the `<...>`
placeholders. Nothing here names a contestant's model, tool, or company, and nothing you send to a
contestant, in a title, in a tag, or in a check-in may either: those show up in transcripts and
lists the owner can read.

Placeholders: `<L>` is the entry's branch letter (a lowercase letter that stands for one contestant;
its meaning lives only in the private who file), `<N>` the task number, `<short title>` is for the
contestant to fill in, `SANDBOX_REPO` is `owner/name` of the private sandbox repo.

## 1. A Claude contestant (one session per entry and task)

Start it with `create_session`. A fresh session per entry and task keeps every entry's context the
same size and its usage countable.

- `source_url`: `https://github.com/SANDBOX_REPO`
- `environment_id`: an environment with internet on and no secrets (no `HF_TOKEN`, no keys). Look it
  up with `list_environments`. Never inherit the Operator's own environment: it holds secrets.
- `model`: the contestant's model. Write the model and the effort the session runs at into the
  private usage file (SKILL.md, "Usage and time"), nowhere else. Effort has no `create_session`
  field: set it in the app, and give every contestant the same level unless the grid is about
  effort.
- `outcome_branch`: `bake/<L>-t<N>`
- `title`: `Bake entry <L> task <N>` (no model in it), `tags`: `["bakeoff"]`
- `permission_mode`: omit it, so the session inherits the Operator's.
- `prompt`: the text below. It is the same for every contestant, Claude or Codex, except for its one
  Chromium sentence.

```
Read BAKEOFF.md and AGENTS.md in this repo and follow them. You are entry <L>. Do task <N>. Title your pull request "Bake <L>-t<N>: <short title>" and write the five sections BAKEOFF.md asks for. Internet access is on: if npm packages are missing, install them (npm ci). Chromium is at /opt/pw-browsers/chromium: run the tests with SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium, and never run playwright install. Run the tests BAKEOFF.md asks for and report their real results. Commit as you go. Work alone, without asking questions.
```

## 2. A Codex contestant (the owner starts each task)

The owner runs these in Codex, as a new task per entry and task, on `main`, in the environment of
section 3. When a task finishes, he taps Create PR (draft is fine).

```
Read BAKEOFF.md and AGENTS.md in this repo and follow them. You are entry <L>. Do task <N>. Title your pull request "Bake <L>-t<N>: <short title>" and write the five sections BAKEOFF.md asks for. Internet access is on: if npm packages or Playwright's Chromium are missing, install them (npm ci, then npx playwright install --with-deps chromium) instead of stopping, and leave SPLASHERY_CHROMIUM unset. Run the tests BAKEOFF.md asks for and report their real results. Commit as you go. Work alone, without asking questions.
```

Give the owner one block per task for his entry letters, with the letters and numbers filled in. He
pastes each as it is (`<short title>` is for Codex to fill in). If Codex names its own branch, that
is fine: BAKEOFF.md says to keep it. Add the real branch to the entries file with its task as a
second column (`node tools/bakeoff.mjs codes`).

To run another Codex model later, use the same prompts with its own letter in both places, and
nothing else changed.

## 3. The Codex environment (once)

1. Open Codex (chatgpt.com/codex or the Codex tab), then Settings, then Environments, then Create
   environment. Delete or edit an older environment for the sandbox first.
2. Repository: `SANDBOX_REPO`. If it isn't listed: on github.com, Settings, Applications, Installed
   GitHub Apps, the ChatGPT/Codex app, Configure, and add the sandbox repo.
3. Name: the sandbox repo's name. Branch: `main`.
4. Give the setup assistant the prompt below (step 7). If it can't change a setting itself, set that
   one by hand:
   - Setup script: `bash tools/codex-setup.sh`
   - Agent internet: on, all domains, all methods (agent internet off broke the first Codex run:
     anything missing at task time could not be installed)
   - Environment variables: none. Secrets: none.
5. Wait for setup to finish. A good run ends with "Setup finished in ...s. What works:" and a short
   list. If it fails, send the Operator the last 10 lines of the setup log. The guide is in the
   sandbox at `docs/codex/SETUP.md`.
6. Effort: pick the same level for every Codex run (and write down which). Set it in the task's
   model menu before each task.
7. Prompt for the setup assistant:

```
Please configure this Codex cloud environment for the private repository SANDBOX_REPO, branch main. Don't change, commit or push anything in the repository, and don't open a pull request: only configure the environment and test it.

What runs here: coding tasks for a blind bake-off. Each task edits a pure-browser JavaScript app (static files and ES modules, no build step), then runs Playwright tests in headless Chromium with software WebGL2 (SwiftShader), runs Prettier and a small Node script, and ends with a draft pull request. The repository is large (about 1.1 GB, many binary assets, no Git LFS).

Settings:
1. Image: the universal Linux image, with Node 22 (Node 20 or newer works) and Python 3. The tests start "python3 -m http.server" on port 4173.
2. Setup script: exactly
   bash tools/codex-setup.sh
   It's in the repository. It runs "npm ci" from the lockfile, installs Playwright's Chromium with its system libraries ("npx playwright install --with-deps chromium", which uses apt and needs root), and launches the browser once to check WebGL2. Don't use automatic setup.
3. Maintenance script, if there's a field for one (it runs when a cached container is resumed): the same line, "bash tools/codex-setup.sh". It's safe to run again and takes about a second when nothing changed.
4. Internet access: ON for setup and ON for the agent while tasks run. Unrestricted: all domains and all HTTP methods. The owner chose this on purpose; a run with agent internet off failed.
5. Environment variables: none. Secrets: none. Don't set SPLASHERY_CHROMIUM (unset, the tests use Playwright's own Chromium).
6. Container caching: on, if offered.
7. Disk: setup needs about 3 GB free after the clone. If there's a size option, pick one with room.

Then test the environment, run each of these, and show me the real output:
1. bash tools/codex-setup.sh
   It must end with "Setup finished in ...s. What works:" and lines for repository, disk, node, python3, npm packages, browser and browser launch.
2. npx --no-install prettier --version   (expect the version in package.json)
3. node tools/us-english.mjs --diff   (expect "No British spellings found.")
4. npx playwright test tests/unit.spec.mjs --workers=1   (expect every test to pass, in about 15 to 60 seconds)
5. curl -sI https://registry.npmjs.org/ | head -1 ; curl -sI https://github.com | head -1   (both should answer: this proves the internet is on)
6. df -h .   (free disk)

Report back, in a short list: each setting above and what you set it to; the result of each of the 6 checks; and anything you could not set yourself, with the exact name and place of the setting so I can change it by hand. If a check fails, try the fix the script's error message names (the repository's docs/codex/SETUP.md has a table, "If setup fails"), then run the check again and report both tries.
```

8. One pilot task first, before the rest. Start task 1 only, for one entry, then after 10 to 15
   minutes open its log. Healthy: `npx playwright test` runs and tests pass or fail for real. Bad
   signs: "command not found", "Executable doesn't exist", or `browserType.launch` errors. If it
   looks healthy, start the other tasks. If not, send the Operator a screenshot of the log's end. If
   a task failed or stopped early, don't create a PR for it; send a screenshot of the log's end.

## 4. A judge session

Start one per group of tasks with `create_session`. The same judge takes every entry of a task, so
no task is split between judges.

- `source_url`: `https://github.com/SANDBOX_REPO`, the same no-secrets environment as the
  contestants, and the Artifact tool available.
- `model`: a Sonnet model (the one the lanes use for the Integrator), at high effort.
- `title`: `Bake judge <n>`, `tags`: `["bakeoff-judge"]`.
- `prompt`: `.claude/skills/bakeoff/judge-brief.md`, filled in: `TASKS_HERE` (the task numbers, and
  for each what to render or "nothing to see"), `MAP_HERE` (one `<branch> <code>` line per entry of
  those tasks, cut from the private key), `SANDBOX_REPO`, `CHECK_COMMANDS`, and the page link.

Never put the key file, the who file, or a contestant's model anywhere in a judge's prompt.

## 5. A neutral check-in

Check-ins and notifications are text the owner may read. Name entries only by branch, and never name
a model. A short prompt for a helper (or a scheduled `send_later`):

```
List the draft pull requests and bake/ branches in SANDBOX_REPO. For each entry, by branch only: is a pull request open, how many commits, the time of the last commit, and whether the three-hour time box has passed. Don't say anything about who or what made an entry, and don't open any entry's code. Answer in a table.
```

To check that a Claude session ran on its planned model without putting the model in the Operator's
chat, ask a helper session for a yes or no per entry ("ran on the planned model: yes or no"), or
read the model after the reveal.

## 6. The sandbox's BAKEOFF.md rules (template)

Put this at the top of the sandbox's `BAKEOFF.md`, above the task list. Then add one section per
task, titled "Task <N>: <title>", with what to build or fix, its proof, and its test file name.

```
# Splashery sandbox bake-off

This repo is a private copy of Splashery (main at <SHA>, <date>). It is for a blind bake-off:
several AI coders do the same tasks, and the owner judges the results without knowing who made
what. Nothing here goes to the real site.

## Rules for every entry

- Read `CLAUDE.md` (also `AGENTS.md`) and follow its ground rules and effect quality rules. Where
  they talk about lanes, the Operator, the Effect review page or HANDOFF.md, skip that part: here
  you work alone on one task.
- Work only on your branch, `bake/<letter>-t<N>` (your prompt gives the letter and the task number).
  Start it from `main`. Open one draft PR against `main` titled "Bake <letter>-t<N>: ..." with the
  five sections from CLAUDE.md (Summary, Verification, Deviations, Known issues, What was cut).
  Never merge. If your tool names the branch itself or opens the pull request for you, keep its
  branch name and use the title and sections above; if you can't open the pull request yourself,
  commit everything on your branch and put the title and the five sections in your final message.
- Don't look at the other entries: never open, fetch or read any `bake/` branch or pull request
  other than your own.
- Internet access is allowed (see `AGENTS.md`). Commit as you go, so a stop never loses work.
- Stay blind: never name your model, your tool or your company in code, commits, the PR or any
  file. Don't add a co-author line or a "generated with" footer.
- Time limit: 3 hours of work per task. Stop when it's done or when time is up, and say honestly in
  the PR what is finished and what isn't.
- No secrets. There is no token here, and you don't need one.
- Before you push: run the specs you touched or added with
  `SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test <specs> --workers=1`, then
  `npx prettier --check .` and `node tools/us-english.mjs --diff`. Don't run the whole suite unless
  you have time; the judge runs it on every entry.
- Static files and ES modules only. No new npm packages in the page, no CDN, no server.

## How it's judged

- The owner marks each entry blind, from its card and clip.
- The judge runs the same checks on every entry: the task's proof, the full suite, prettier, the
  US English check, and the house rules.
- Time and usage spent.
```

And at the top of the sandbox's `AGENTS.md` (above Codex's own notes), so the two files agree:

```
# Splashery sandbox: read BAKEOFF.md first

This repository is a private sandbox for a blind bake-off. Here, `BAKEOFF.md` overrides this file
and `CLAUDE.md` wherever they differ: use the branch name and PR title your task gives, and never
name your model, your tool or your company.

Internet access is on. Use it freely for what the work needs: installing packages and browsers,
reading documentation and standards. Two limits: don't copy code or assets from the web unless
their license is one `CLAUDE.md` allows (and credit them as it says), and never open, fetch or read
another entry's work (any `bake/` branch or pull request other than your own). If something the
tests need is missing (`node_modules`, Playwright's Chromium), install it yourself (`npm ci`, then
`npx playwright install --with-deps chromium`) instead of stopping.
```
