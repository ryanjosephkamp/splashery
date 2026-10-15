// Recompute both fringe definitions from retained pixels. Reject the result if
// the original definition cannot reproduce every retained score and probe count.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import { openR4, selectR4, inputsR4, screens, fingerprintR4 } from "./cdx-p3d4-common.mjs";
import { texturesR3, referenceDepthR3, projectAnchorsR3 } from "./cdx-p3d2-r3-common.mjs";
import { fringeR4, thinAnchorsR4 } from "./cdx-p3d4-metrics.mjs";
const opt = (name, fallback) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dir = opt("input", ".cache/photo-3d-r4/scout-v7"),
  bytes = fs.readFileSync(path.join(dir, "results.json")),
  study = JSON.parse(bytes),
  rows = [];
for (let build = 0; build < 2; build++) {
  const actual = await fingerprintR4(study.urls[build], Object.keys(study.builds[build].files));
  if (JSON.stringify(actual) !== JSON.stringify(study.builds[build]))
    throw new Error("The retained source build changed.");
}
const browser = await chromium.launch(config.use.launchOptions);
try {
  for (const screenName of [...new Set(study.rows.map((v) => v.screen))]) {
    const screen = screens[screenName],
      pages = [];
    for (const url of study.urls) {
      const page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
      await openR4(page, url, screen);
      pages.push(page);
    }
    for (const id of [
      ...new Set(study.rows.filter((v) => v.screen === screenName).map((v) => v.id)),
    ]) {
      const entry = inputsR4().find((v) => v.id === id);
      for (const page of pages) await selectR4(page, entry, 1, "sharp");
      const t = await texturesR3(pages[0]),
        photo = PNG.sync.read(Buffer.from(t.surface.split(",")[1], "base64")),
        field = await referenceDepthR3(pages[0]),
        anchors = thinAnchorsR4(photo, field);
      fs.writeFileSync(path.join(dir, `${screenName}-${id}-anchors.json`), JSON.stringify(anchors));
      for (const row of study.rows.filter((v) => v.screen === screenName && v.id === id)) {
        if (row.view !== "sharp") throw new Error("Only the Sharp diagnostic has been qualified.");
        const comparison = [];
        for (let build = 0; build < 2; build++) {
          const page = pages[build];
          await page.evaluate(({ yaw, pitch }) => {
            const pl = window.__splashery.player;
            pl.camera.cur = {
              ...pl.camera.home,
              yaw: (yaw * Math.PI) / 180,
              pitch: (pitch * Math.PI) / 180,
            };
            pl.camera.tgt = { ...pl.camera.cur };
            pl.stage.setCameraPose(pl.camera.pose());
            pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
          }, row);
          await page.evaluate(async () => {
            await window.__splashery.player.stage.captureFrame();
          });
          const projected = await projectAnchorsR3(page, anchors.anchors),
            prefix = `${screenName}-${id}-${row.view}-${row.yaw}-${row.pitch}-${build ? "after" : "checkpoint"}`,
            image = PNG.sync.read(fs.readFileSync(path.join(dir, `${prefix}-color.png`))),
            ratio = image.width / screen.width;
          const legacy = fringeR4(image, projected, anchors.anchors, ratio),
            local = fringeR4(image, projected, anchors.anchors, ratio, { localBackground: true }),
            old = row.comparison[build].thin;
          if (
            legacy.evaluated !== old.evaluated ||
            legacy.missing !== old.missing ||
            (legacy.fringeMean !== null && Math.abs(legacy.fringeMean - old.fringeMean) > 1e-8)
          )
            throw new Error(
              `The retained probe projection changed: ${prefix}, ${legacy.fringeMean} vs ${old.fringeMean}.`,
            );
          comparison.push({ build: build ? "after" : "checkpoint", legacy, local });
        }
        rows.push({
          id,
          screen: screenName,
          view: row.view,
          yaw: row.yaw,
          pitch: row.pitch,
          comparison,
        });
      }
      console.log(screenName, id, rows.length);
    }
    for (const page of pages) await page.close();
  }
  fs.writeFileSync(
    path.join(dir, "local-fringe.json"),
    JSON.stringify(
      {
        parentSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        legacyReproduced: true,
        methodSha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(import.meta.filename))
          .update(fs.readFileSync("tools/cdx-p3d4-metrics.mjs"))
          .digest("hex"),
        rows,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
