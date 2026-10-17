// Task 101: the original camera case, fixture, sampling, and thresholds.
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import { fakeCamera, openMirror, measure, stillness } from "../tools/lv7-mirror-measure.mjs";
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-lv7-"));

test.describe("the mirror on a camera (a generated mannequin)", () => {
  test.describe.configure({ timeout: 600_000 });
  let y4m;
  test.beforeAll(() => {
    y4m = path.join(DIR, "still.y4m");
    execFileSync("node", ["tools/lv7-mannequin.mjs", y4m, "--still", "--frames=20"], { stdio: "ignore" }); // prettier-ignore
  });

  const launch = (playwright) =>
    playwright.chromium.launch({ ...config.use.launchOptions, args: fakeCamera(y4m, config.use.launchOptions.args) }); // prettier-ignore

  test("plain: steadier than before, frame to frame, and sharper", async ({
    playwright,
    baseURL,
  }) => {
    const browser = await launch(playwright);
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openMirror(page, baseURL + "/");
      const m = await measure(page, { answers: 8 });
      console.log("lv7 mirror, plain:", JSON.stringify(m));
      // (Medians over the answers, with room for a loaded machine, where every
      // jitter runs higher: this lane measured 0.7 to 1.0 face on and 1.2 to
      // 3.0 turned on this container, main 1.41 to 1.51 and 2.31 to 3.23.)
      expect(m.colorJitter).toBeLessThan(1.6); // main: 3.63
      // The depth model's own guess wanders on a still picture; the relief
      // follows it no more than before.
      expect(m.heightJitter).toBeLessThan(0.03); // main: 0.013
      expect(m.shownJitter).toBeLessThan(1.3); // main: 1.41 to 1.51
      // Turned, the picture moves mostly with the depth model's own wobble,
      // which runs from about 1.6 to over 4 on a loaded machine whatever the
      // code (the face-on, color and height jitters above carry the claim);
      // this catches a turned view gone wrong.
      expect(m.shownJitterTurned).toBeLessThan(6); // main: 2.31 to 3.23 (unloaded)
      // The polish round: sharper (how much of the camera's own edges reach
      // the face; 0.51 to 0.52 before it, 0.56 to 0.57 after).
      expect(m.sharpness).toBeGreaterThan(0.54);
      // Stability (the owner's "Please improve stability" of October 6): held
      // still, the whole picture holds still, splats and colors, face on and
      // turned. r4 measured here: heights 0.69 (thousandths of the relief a
      // frame), 5.9 per thousand splats moving a frame, 5.3 per thousand
      // pixels flickering turned; r5: 0.14, 0.12 and 1.1.
      const st = await stillness(page);
      console.log("lv7 mirror, plain, held still:", JSON.stringify(st));
      expect(st.height).toBeLessThan(0.4);
      expect(st.moved).toBeLessThan(1.5);
      expect(st.flickerTurned).toBeLessThan(3);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
