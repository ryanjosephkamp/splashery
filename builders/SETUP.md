# Setup

How to get a working environment in a cloud agent or on a Mac, and the checks to run before you hand
anything back. Every command here was run in a Linux cloud container on October 12, 2026 (Node
22.22.0, Chromium preinstalled at `/opt/pw-browsers/chromium`) unless it is marked **not tested**.

## 1. Clone and install

```sh
git clone https://github.com/ryanjosephkamp/splashery.git
cd splashery
git checkout -b codex/<task>-<slug>        # or dot/<task>-<slug>; never work on main
npm ci
```

- Node 22 is what was tested. The repo sets no minimum, and the scripts use modern ES modules and
  `fetch`, so use a current LTS (20 or later).
- `npm ci` installs only build tools and test tools (`package.json`, devDependencies). The site
  itself has no install step (Rules D1).
- Needs network for `npm ci`. It took about a minute in the container.

## 2. A Chromium for Playwright

The tests and the clip tools drive a real Chromium. Pick one:

- **Preinstalled Chromium** (the Claude cloud containers have one): set
  `export SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium`. Don't run `playwright install` there.
- **Playwright's own Chromium**: leave `SPLASHERY_CHROMIUM` unset, then run
  `npx playwright install chromium` once. **Not tested** here (the container already had a
  Chromium).
- **Any other Chromium or Chrome**: set `SPLASHERY_CHROMIUM` to its executable's path. **Not
  tested** on a Mac.

The config (`playwright.config.mjs`) starts Chromium with SwiftShader flags, so WebGL2 works with no
GPU. WebGPU checks skip themselves when there is no adapter; that is not a failure.

## 3. Serve the site

The tools and the specs load the site from a local server. Leave this running in another terminal
(or in the background):

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/ to see the Playground. Playwright also starts this server by itself when
nothing is listening on 4173 (`SPLASHERY_PORT` picks another port for both). `npm run serve` runs
the same command. There is nothing to build: edit a file, reload the page.

## 4. Look at your work

### Check that a kit toy builds (no browser)

```sh
node tools/check-packs.mjs <pack or toy id>        # for example: node tools/check-packs.mjs gems
```

It builds the toy in Node and prints the splat count and the time. It fails on a non-finite number
or a build over 1.5 seconds. About 4 seconds for the `gems` pack.

### Screenshots at 390×844 and 1440×900

```sh
node builders/screenshot.mjs <out-dir> <toy id> [--labs]
```

This writes `<toy id>-390x844.png` (a phone) and `<toy id>-1440x900.png` (a desktop). Add `--labs`
for a toy behind the labs switch. It takes a few seconds per size. Look at both images before you
hand them back.

### An effect clip

```sh
node tools/effect-clip.mjs <out-dir> --size=320 --strip=8 <toy id>:<seconds>
```

For example `node tools/effect-clip.mjs clips --size=240 --strip=8 diamond:3` writes
`clips/diamond.gif` (a looping GIF of the tap) and `clips/diamond-strip.png` (8 frames side by
side). It took about 45 seconds. The clock is stepped by hand, so the clip shows the effect at its
real speed. Watch the clip before you hand it back. The tool's header lists more options (`--taps`,
`--opt=key=value`, `--seq`, `--keys`, `--pgn`). For a drag, use `tools/drag-clip.mjs`. A smaller MP4
can be made from the GIF with ffmpeg; the steps are in `docs/OPERATING.md`, "Steps for a lane"
(**not tested** by this guide).

### A contact sheet and thumbnails (for a new or changed kit toy)

```sh
node tools/contact-sheet.mjs sheet.png <pack>
node tools/make-thumbs.mjs <pack>
```

Both need the server from step 3. **Not tested** by this guide; the usage is at the top of each
script. Every toy should read at 200 px and fill its square.

## 5. Run the tests

One spec file, with the server running or not (Playwright starts one if needed):

```sh
npx playwright test tests/unit.spec.mjs            # 20 tests, about 10 seconds
```

The same file through the suite runner, which keeps a report and can resume:

```sh
node tools/suite.mjs --files=unit                  # about 10 seconds
```

The full suite is `node tools/suite.mjs` (add `--jobs=2` to run two files at once, and
`--gl=llvmpipe` where a virtual display is available). **Not tested** here: it takes about four and
a half hours on one worker. Don't run it for a task. Run these instead:

- the spec files for the area you changed;
- `smoke`, `kit`, `taps`, `help`, `hta`, and `unit`, if you touched `src/`:
  `node tools/suite.mjs --files=smoke,kit,taps,help,hta,unit`.

Keep the "embed transfer ≤ 30 MB" test green (it is in `smoke`). Say in the pull request which specs
you ran and which you couldn't.

Some tests fail now and then on plain `main`, and pass when run alone. They are listed in
`docs/OPERATOR.md`, "Known flaky tests". One failure that passes alone is a flake; two failures in a
row are real.

The specs write screenshots into `tests/screenshots/`. After a run, put them back with
`git checkout -- tests/screenshots/` unless your task says to add some.

## 6. The checks before a handback

```sh
npx prettier --check .                  # formatting; about a minute. Fix with: npx prettier --write <files>
node tools/us-english.mjs --diff        # British spellings in the lines your branch adds
npx playwright test tests/<your spec>   # your own specs, and the ones for the files you touched
```

- `us-english --diff` compares against `origin/main`. Run `git fetch origin main` first, or an old
  `origin/main` makes it list lines you didn't write.
- If a `.claude/worktrees/` folder exists, run prettier with
  `--ignore-path .gitignore --ignore-path .prettierignore --ignore-path .git/info/exclude`.
- For a new or changed kit toy, also run `node tools/check-packs.mjs <pack>`.
- Then follow [HANDBACK.md](HANDBACK.md).

## 7. The labs switch

New toys and new areas open behind the labs switch (Rules D5). Add `?labs=1` to any Splashery URL:
`http://127.0.0.1:4173/?labs=1`. The browser remembers it (in `localStorage`, key `splashery.labs`);
`?labs=0` turns it off again. In code, `labsOn()` from `src/toys.js` says whether it is on, and a
toy entry marked `labs: true` shows on the shelf only when it is. `builders/screenshot.mjs` takes
`--labs` for the same reason.

## What this guide could not test

- A Mac, and a Chromium other than the container's preinstalled one.
- `npx playwright install chromium`.
- The full suite (about four and a half hours).
- `tools/contact-sheet.mjs`, `tools/make-thumbs.mjs`, and the ffmpeg step for MP4 clips.
