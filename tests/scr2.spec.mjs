// Task 101: independent screen checks, with all original cases and sizes.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { buildRecipe } from "../src/kit.js";
import { applyClay, PROFILES } from "../src/generators.js";

import {
  openScreen,
  settle,
  tapAt,
  screenPixels,
  difference,
  ON_TIME,
  OFF_TIME,
} from "./scr2-helpers.mjs";

test("switched off (or the curtains closed), the screen looks the same whichever sample it holds", async ({
  page,
}) => {
  test.setTimeout(900_000);
  for (const style of (process.env.SCR2_STYLES || "tv,flat,cinema").split(",")) {
    const shots = {};
    for (const sample of ["gif", "video"]) {
      // At the desktop size, zoomed in close (the owner's view).
      await openScreen(page, { style, sample }, { width: 1440, height: 900 });
      await page.evaluate(() => {
        const cam = window.__splashery.player.camera;
        const st = cam.getState();
        cam.setState({ ...st, distance: st.distance * 0.6 }, { snap: true });
      });
      // On and playing, then off with the Toy tab's button.
      await page.evaluate(() => window.__splashery.player.act());
      await settle(page, ON_TIME[style] + 0.3);
      await page.evaluate(() => window.__splashery.player.act());
      await settle(page, OFF_TIME[style] + 0.3);
      const hidden = await page.evaluate(() => {
        const sh = window.__splashery.player.pictures.sheets[0];
        return { enabled: !!sh.slot?.entity?.enabled, hidden: sh.hidden };
      });
      expect(hidden, `${style} ${sample}`).toEqual({ enabled: false, hidden: true });
      shots[sample] = await screenPixels(page);
      if (process.env.SCR2_DEBUG)
        fs.writeFileSync(
          `${process.env.SCR2_DEBUG}/scr2-${style}-${sample}.png`,
          PNG.sync.write(shots[sample]),
        );
    }
    const d = difference(shots.gif, shots.video);
    expect(d.count, `${style}: ${JSON.stringify(d)}`).toBe(0);
  }
});
