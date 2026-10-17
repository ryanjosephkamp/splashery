# Codex task 111: Splashery offline, save the site and chosen toys to use without a connection (a Goal run, up to 10 hours)

**Branch:** `codex/offline`, cut from `main`. One draft PR against `main`. Read `AGENTS.md`,
`builders/RULES.md`, `site/sw.js` and its builder (`tools/site-build.mjs`), and how the app loads
toys and assets (`src/app.js`, `src/toys.js`, `src/loaders.js`).

## Why

People ask to use Splashery without a connection. Today only the preview site's pages have a service
worker (`site/sw.js`). The Playground app has none. And a downloaded copy can't simply be opened as
a file, because ES modules don't load from `file://`. All the assets come to about 858 MB, far too
much to cache at once. So offline has to be chosen: the app itself, plus the toys a person picks.

## The work

1. **The app works offline.** A service worker for the Playground caches the app shell (HTML, CSS,
   and every `src/` module the shell imports) in a versioned cache. A new deploy replaces it
   cleanly, and a page never runs mixed versions.
2. **"Keep for offline", per toy:**
   - A toy's menu gets "Keep for offline", with the toy's size shown first. It caches the toy's
     pack, its assets, its thumbnail, and its sounds.
   - A "Saved for offline" list shows the space used and lets the person remove toys.
   - Choices are offered by shelf too ("all of Math, 12 MB").
3. **Kit toys** are built from code, so most are tiny. Captured toys keep their phone (lite) file by
   default, and the full file only when chosen.
4. **Honest states:**
   - Offline, a toy that isn't saved shows "Not saved for offline" with its size.
   - The Studio tools say which parts need a download first: the depth model and ONNX Runtime can be
     kept too, at their sizes.
   - Live data toys (earthquakes, Wikipedia) say they need a connection, and they use their dated
     snapshot where one exists.
5. **Storage limits:** ask for persistent storage when the person saves, handle quota errors with a
   plain message, and never evict a saved toy silently.
6. **No tracking:** nothing is sent anywhere. The service worker only serves Splashery's own files.

## Gates

1. A Playwright test with the network turned off: the app opens, and every saved toy opens and
   plays. An unsaved toy shows its message. A Studio tool whose model was kept still runs.
2. An update test: deploy a new version, and the page moves to it on the next load without mixed
   files. Old `#s=` links and saved scenes still load.
3. First-visit speed is no worse than today: the service worker installs after the first frame.
4. The embed transfer test (30 MB or less) and every existing spec pass.
5. A short Tinkerer's Manual section on offline use.

## Rules

Plain service worker code in `src/offline/` and a new `sw.js` at the app's root, with no library.
Name every changed shared file in the PR. American English and the serial comma. Last, merge `main`
and run `node tools/preflight.mjs`. Progress notes at 4 and 8 hours. PR body: Summary, Verification,
Deviations, Known issues, and What was cut.
