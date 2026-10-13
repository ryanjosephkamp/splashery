// Check warmed Sharp captures against a second completed frame, including diagnostic shaders.
import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3, poseR3 } from "./cdx-p3d2-r3-common.mjs";
import { decode } from "./cdx-p3d2-r3-measure.mjs";
const builds = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/builds.json"));
const rows = [],
  errors = [];
for (const [build, url] of [
  ["before", "http://127.0.0.1:4174/"],
  ["after", "http://127.0.0.1:4177/"],
]) {
  for (const [file, hash] of Object.entries(builds[build].files)) {
    const response = await fetch(new URL(file, url));
    const actual = crypto
      .createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex");
    if (!response.ok || actual !== hash) throw new Error(`Browser source changed: ${file}`);
  }
  const browser = await chromium.launch(config.use.launchOptions);
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await openR3(page, url, screens.phone);
    for (const id of ["forest", "lighthouse"]) {
      await selectR3(
        page,
        inputs().find((s) => s.id === id),
        1,
        "sharp",
      );
      for (const mode of ["color", "mask", "uv"]) {
        // Compile and settle each mode before checking subsequent poses.
        await poseR3(page, 0, 0, mode);
        for (const [yaw, pitch] of [
          [-30, 0],
          [30, 0],
          [0, -30],
          [0, 30],
        ]) {
          const shot = await poseR3(page, yaw, pitch, mode, [0, 1, 0], 2, true);
          const first = decode(shot.firstImage),
            second = decode(shot.image);
          let maximum = 0,
            changed = 0;
          for (let i = 0; i < first.data.length; i++) {
            const difference = Math.abs(first.data[i] - second.data[i]);
            maximum = Math.max(maximum, difference);
            if (difference) changed++;
          }
          const row = {
            build,
            id,
            mode,
            yaw,
            pitch,
            buffer: [shot.width, shot.height],
            maximum,
            changed,
          };
          rows.push(row);
          console.log(JSON.stringify(row));
          if (maximum)
            throw new Error("A warmed first Sharp capture differs from its second frame.");
        }
      }
    }
  } finally {
    await browser.close();
  }
}
const result = {
  builds: { before: builds.before, after: builds.after },
  rows,
  errors,
  scope:
    "Two phone inputs, four 30-degree axis poses, color/mask/UV, both immutable builds. Modes first compiled and settled at neutral; no claim about asynchronous Fine Splats sorting.",
};
fs.writeFileSync(".cache/cdx-p3d2/r3/capture-check.json", JSON.stringify(result, null, 2));
if (errors.length) throw new Error("Capture check recorded browser errors.");
