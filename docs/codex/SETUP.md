# Setting up a Codex cloud environment for Splashery

This is for Ryan, on a phone. It creates the Codex cloud environment where Codex tasks
(`docs/codex/NN-*.md`) run. The setup script is `tools/codex-setup.sh`.

**What was and wasn't verified (October 7, 2026).** The script was run in a clean fresh clone of
this repository in a Linux container (Node 22, Python 3.13): about 10 seconds with a browser already
present, and about 1 second when run again. Its failure messages were triggered on purpose (not
enough disk, no python3) and read correctly. A test file then passed in that clone. **Not verified,
because nobody here can run Codex itself:** the Codex settings screens below (names and positions
may differ from what you see), the ChatGPT GitHub app's access to your private repository, the
`playwright install --with-deps chromium` step (it needs `apt` and root, which Codex's container is
said to have; the script never ran it here, since Chromium is preinstalled here), the setup time
limit, and how much disk Codex's container has. Treat the first real run as the test.

## Create the environment

1. **Open Codex** in ChatGPT (chatgpt.com/codex, or the Codex tab in the app) and open the
   environment settings: **Settings, then Environments, then Create environment**.
2. **Repository.** Choose `ryanjosephkamp/splashery`. If it isn't in the list, see "Repository not
   visible" below.
3. **Name** it `splashery`.
4. **Branch.** `main`. Each task creates its own `codex/<name>` branch from it.
5. **Setup script.** In the field for the setup script (sometimes under "Advanced" or "Setup
   script"), put exactly:

   ```
   bash tools/codex-setup.sh
   ```

   Don't use "Automatic" setup: it doesn't know about the browser libraries.

6. **Internet access.** Leave it **off for the agent** and **on for setup only** (the default for
   most plans). The script downloads packages and a browser, so it needs internet during setup. The
   tasks that need the web (the briefs say "Needs the web: yes" in `docs/codex/README.md`) need
   internet access on while they run: for those, switch the environment's agent internet access to
   **On** (limited to "Common dependencies" isn't enough for source pages), or set it for that task
   only.
7. **Save**, then wait for the first setup run to finish. A good run ends with a list that starts
   "Setup finished in …s. What works:" and has these lines: repository, disk, node, python3, npm
   packages, browser, browser launch.
8. **Start a task.** Open a new Codex task in this environment and paste one line:

   > Read docs/codex/NN-name.md in this repository and do it.

Environment variables and secrets: none are needed. Don't add `HF_TOKEN` or any other key.

## What the script does

It stops at the first problem, saying which step failed. In order:

1. Checks the checkout (`package.json`, `tests/`, `src/`; and that assets aren't Git LFS pointers).
2. Checks 3 GB of free disk (change with `CODEX_SETUP_MIN_FREE_MB`).
3. Checks Node 20 or newer and npm.
4. Checks `python3` (the tests start `python3 -m http.server`).
5. `npm ci` from the lockfile (skipped when `node_modules` already matches it).
6. `npx playwright install --with-deps chromium`: the browser and the system libraries it needs.
7. Launches the browser once and checks it has WebGL2 (software rendering is fine).
8. Prints what works.

It never rebuilds assets, makes thumbnails or touches the repository's files, so the 1.1 GB checkout
costs only the clone. Run it again any time: finished steps do nothing. `--skip-browser` skips step
6 for a machine that already has Chromium (give its path in `SPLASHERY_CHROMIUM`).

The tests, once setup works: `npx playwright test tests/<file>.spec.mjs`. Don't run the whole suite
in Codex (it takes about an hour and a half, and the briefs say which files to run).

## If setup fails

The log ends with `!! codex-setup FAILED at: <step>`. Find the step.

| Failed step                         | What it means                                                                  | What to do                                                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (before any step) "not found"       | Codex couldn't clone the repository, so `tools/codex-setup.sh` doesn't exist   | Repository not visible, below.                                                                                                                                                                                                                                |
| Check the repository                | The checkout is partial, not on `main`, or the script isn't on that branch yet | Check the environment's branch is `main` and that the Codex setup PR is merged (the script must be on `main`).                                                                                                                                                |
| Check free disk space               | The container has less than 3 GB free after the clone                          | Disk space, below.                                                                                                                                                                                                                                            |
| Check Node and npm                  | No Node, or older than 20                                                      | In the environment settings, pick the universal image with Node 20 or newer (22 is best).                                                                                                                                                                     |
| Check python3                       | No `python3`                                                                   | Use the universal image (it has Python). The tests can't run without it.                                                                                                                                                                                      |
| Install npm packages                | `npm ci` failed: no internet, a registry outage, or a full disk                | Turn internet access on for setup. Re-run setup. If the error names one package, tell the Operator.                                                                                                                                                           |
| Install Playwright's Chromium       | `apt` or the download failed                                                   | See "Missing system packages", below.                                                                                                                                                                                                                         |
| Launch the browser once             | Chromium installed but won't start, or has no WebGL2                           | Usually a missing library: the message says `error while loading shared libraries: libX…`. Re-run the browser step as root (`npx playwright install-deps chromium`). If it says WebGL2 is missing, tell the Operator: tests that draw splats can't run there. |
| Setup timed out (no message at all) | The setup step ran past Codex's time limit                                     | Setup timeout, below.                                                                                                                                                                                                                                         |

### Repository not visible to the ChatGPT GitHub app

The Codex repository list is empty, or lacks `splashery` (a private repository).

1. On GitHub (github.com, signed in as `ryanjosephkamp`): **Settings, then Applications, then
   Installed GitHub Apps**. Find the ChatGPT or Codex connector and tap **Configure**.
2. Under **Repository access**, choose **Only select repositories**, add `splashery` (and
   `splashery-sandbox` if you want it), and **Save**.
3. Back in Codex, refresh the repository list (pull down, or reopen the create screen).
4. If the app isn't installed at all: in Codex, tap **Connect to GitHub** and approve the same
   repository access.

### Setup timeout from the repository size

The clone is about 1.1 GB, and Codex clones before setup runs. If setup stops with no error message,
or the task says the environment "failed to start":

1. Re-run it once: the second try is often faster (the first caches the container).
2. If it times out again, tell the Operator. The fix is on our side: a trimmed copy of the
   repository for Codex without the biggest asset folders, built only after the Operator has checked
   that no Codex task needs them. This isn't built yet.
3. Don't remove `--no-audit`, `--no-fund` or the rest of the script's flags to "debug": they make
   the install faster.

### Missing system packages

`playwright install --with-deps` runs `apt-get install`. It fails when internet is off during setup,
when apt can't reach its mirrors, or when the container isn't root.

1. Make sure internet access is **on** for the setup step.
2. Re-run setup. The message above the failure says which package or mirror failed.
3. If it says "Permission denied" or "are you root?", the container isn't root. The script then
   installs the browser alone and warns; tests that start Chromium may fail with
   `error while loading shared libraries`. Tell the Operator which library.
4. If it says `E: Unable to locate package`, the image is older than Playwright 1.56 supports. Pick
   the newest universal image.

### Disk space

Setup needs about 3 GB after the clone: `node_modules` about 300 MB, Chromium about 600 MB with its
libraries, plus test output.

1. If the log says "only N MB free", pick a bigger container size if Codex offers one.
2. Don't run the whole test suite: its screenshots, traces and `test-results/` can fill the disk.
   Run only the files the brief names.
3. If it still fails, tell the Operator the number in the message.

## After setup works

Reply to the Operator with: "Codex setup works" or the last 10 lines of the log. The Operator then
checks the first task's pull request.
