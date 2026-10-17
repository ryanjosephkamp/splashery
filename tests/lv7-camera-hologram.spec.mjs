// Task 101: the original camera case, fixture, sampling, and thresholds.
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";
import {
  fakeCamera,
  openMirror,
  measure,
  overFace,
  stillness,
} from "../tools/lv7-mirror-measure.mjs";
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

  test("hologram: nothing drawn over the face, and steady", async ({ playwright, baseURL }) => {
    const browser = await launch(playwright);
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openMirror(page, baseURL + "/", { look: "hologram" });
      const m = await measure(page, { answers: 4 });
      const over = await overFace(page);
      console.log("lv7 mirror, hologram:", JSON.stringify({ ...m, overFace: over }));
      expect(over).toBeLessThan(10); // main: 36 (scanlines and edge glow over the face)
      expect(m.shownJitter).toBeLessThan(3); // main: 11.4 (the scanlines drifted over the face)
      // Stability: the scanlines stand still too (r4: the room's colors moved
      // 10.3 levels a frame here, 5.0 per thousand pixels flickering turned;
      // r5: 0.16 and 0.2).
      const st = await stillness(page);
      console.log("lv7 mirror, hologram, held still:", JSON.stringify(st));
      expect(st.color).toBeLessThan(1.5);
      expect(st.moved).toBeLessThan(1.5);
      expect(st.flickerTurned).toBeLessThan(2);
      // Still the cool cyan look (r3).
      const tint = await page.evaluate(async () => {
        const { MIRROR, mirrorScreen } = await import("/src/live/relief.js");
        const c = document.createElement("canvas");
        c.width = mirrorScreen.width;
        c.height = mirrorScreen.height;
        const g = c.getContext("2d");
        mirrorScreen.draw(g, 1);
        const d = g.getImageData(0, 0, MIRROR.cols, MIRROR.rows).data;
        let r = 0;
        let b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          b += d[i + 2];
        }
        return b / Math.max(1, r);
      });
      expect(tint).toBeGreaterThan(2);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
