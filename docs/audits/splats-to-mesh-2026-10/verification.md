# Verification notes

The mesh implementation is on draft PR #702. The fixed geometry benchmark passes its aggregate
quality and topology thresholds. Physical-phone timing and peak memory remain unverified, and seven
100 mm reference meshes fail the sampled 1 mm wall check.

The existing PDF assertion in `tests/pages-r2.spec.mjs` also fails on unmodified `main` at
`ceb51de7a`. [Baseline and branch measurements](baseline-pdf-check.json) record two failures and one
pass on each under idle conditions, plus five passes each under concurrent load, using Chromium 141.
The assertion, renderer files, and sample PDF have identical Git blobs. The cause is not
established. No test threshold, renderer, or sample was changed to hide the failure.

Reproduce on each checkout with the repository's Chromium 141, Xvfb, and llvmpipe environment:

```sh
SPLASHERY_CHROMIUM=/path/to/chromium141 SPLASHERY_GL=llvmpipe DISPLAY=:99 npx playwright test tests/pages-r2.spec.mjs -g 'opaque tilted.*webgl2' --repeat-each=3 --workers=1
```

The initial full CI run also caught stale generated Showcase counts caused by adding the new tool.
Regenerating `src/showcase/facts.json` changed only the total toy and kit counts, and its existing
test now passes. The corrected implementation's full-suite run is linked in the JSON; its complete
result will be recorded in the PR.

The existing Pebbles stacking assertion in `tests/phy.spec.mjs` also failed in CI and its isolated
recheck. On unmodified `main`, three single-worker runs produced two passes and one failure; this
branch produced three passes in the same comparison. [Measurements](baseline-pebbles-check.json)
record the failing height threshold. No physics or test code was changed.

```sh
SPLASHERY_CHROMIUM=/path/to/chromium141 SPLASHERY_GL=llvmpipe DISPLAY=:99 npx playwright test tests/phy.spec.mjs -g 'Pebbles:' --repeat-each=3 --workers=1
```
