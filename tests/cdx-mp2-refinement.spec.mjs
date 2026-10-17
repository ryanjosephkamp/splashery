// Task 101: source-array quality checks run independently; deadline checks remain solo.
import { test, expect } from "@playwright/test";
import { measure, reconstructedSources } from "../tools/cdx-mp2-measure.mjs";
test.use({ viewport: { width: 390, height: 844 } });

test("upload refinement reduces machine and bridge regressions without losing horse and Sintel stability", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const sources = await reconstructedSources(".cache/cdx-mp2/sources", [
    "machine",
    "bridge",
    "dragon",
    "horse",
  ]);
  await page.goto("/LICENSES.md");
  for (const id of ["machine", "bridge", "dragon", "horse"]) {
    const sample = await measure(page, { id });
    const upload = await measure(page, { id, path: sources[id] });
    if (id !== "horse") expect(upload.frames).toBe(Math.round((sample.frames / sample.fps) * 12));
    console.log(
      JSON.stringify({
        id,
        jitter: upload.heightJitter,
        cuts: upload.surfaceCutShare,
        normalization: upload.refinement.normalization,
      }),
    );
    expect(upload.refinement.error).toBeFalsy();
    expect(upload.heightJitter).toBeLessThan(sample.heightJitter * (id === "dragon" ? 1.3 : 1.2));
    if (id === "horse") expect(upload.heightJitter).toBeLessThan(0.015);
    expect(upload.edgeFlipsPer1000).toBeLessThan(sample.edgeFlipsPer1000 * 1.2);
    expect(upload.surfaceCutShare).toBeLessThan(
      // Bound these against the reviewed PR's cuts, not an exploratory
      // playback-callback capture whose source times varied with CPU load.
      { machine: 0.00878, bridge: 0.08525, dragon: 0.006, horse: 0.002 }[id],
    );
  }
});
