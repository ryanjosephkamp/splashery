// A paired source-anchored audit. Freeze candidate source/depth anchors once
// per profile and input, then use those same anchors for both browser builds.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import {
  inputs,
  screens,
  openR3,
  selectR3,
  poseR3,
  texturesR3,
  referenceDepthR3,
  projectAnchorsR3,
} from "./cdx-p3d2-r3-common.mjs";
import { sourceAnchorsR3, anchoredEdgesR3 } from "./cdx-p3d2-r3-anchored.mjs";
const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/cdx-p3d2/r3/anchored-sweep");
fs.mkdirSync(path.join(out, "anchors"), { recursive: true });
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const builds = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/builds.json"));
const methodHash = sha(
  [
    "tools/cdx-p3d2-r3-anchor-sweep.mjs",
    "tools/cdx-p3d2-r3-anchored.mjs",
    "tools/cdx-p3d2-r3-common.mjs",
  ]
    .map((f) => fs.readFileSync(f))
    .reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0)),
);
const settings = {
  methodHash,
  before: builds.before,
  after: builds.after,
  screens: opt("screens", "phone,desktop"),
  depths: opt("depths", "0.2,0.5,1"),
  samples: opt("samples", "all"),
};
const settingsFile = path.join(out, "settings.json");
if (
  fs.existsSync(settingsFile) &&
  JSON.stringify(JSON.parse(fs.readFileSync(settingsFile))) !== JSON.stringify(settings)
)
  throw new Error("Anchor method, builds or inputs changed; use a fresh output directory.");
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
const decode = (image) => PNG.sync.read(Buffer.from(image.split(",")[1], "base64"));
const rows = [],
  errors = [];
const browser = await chromium.launch(config.use.launchOptions);
try {
  for (const name of opt("screens", "phone,desktop").split(",")) {
    const screen = screens[name],
      pages = [];
    for (const url of [
      opt("before", "http://127.0.0.1:4174/"),
      opt("after", "http://127.0.0.1:4177/"),
    ]) {
      const page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await openR3(page, url, screen);
      pages.push(page);
    }
    for (const entry of inputs().filter(
      (s) => opt("samples", "all") === "all" || opt("samples", "").split(",").includes(s.id),
    )) {
      const file = path.join(out, `${name}-${entry.id}.json`);
      if (fs.existsSync(file)) {
        rows.push(...JSON.parse(fs.readFileSync(file)));
        continue;
      }
      await selectR3(pages[1], entry, 1, "sharp");
      const sourcePhoto = decode((await texturesR3(pages[1])).surface);
      const anchorFile = path.join(out, "anchors", `${name}-${entry.id}.json`);
      const depthField = await referenceDepthR3(pages[1]);
      const anchors = fs.existsSync(anchorFile)
        ? JSON.parse(fs.readFileSync(anchorFile))
        : sourceAnchorsR3(sourcePhoto, depthField);
      anchors.sourceHash = sha(sourcePhoto.data);
      anchors.depthHash = sha(Uint8Array.from(depthField.data));
      anchors.methodHash = methodHash;
      fs.writeFileSync(anchorFile, JSON.stringify(anchors));
      const sampleRows = [];
      for (let build = 0; build < 2; build++) {
        let worst = -1;
        for (const depth of opt("depths", "0.2,0.5,1").split(",").map(Number)) {
          await selectR3(pages[build], entry, depth, "sharp");
          for (const [yaw, pitch] of [
            [0, 0],
            [-20, 0],
            [20, 0],
            [0, -20],
            [0, 20],
            [-30, 0],
            [30, 0],
            [0, -30],
            [0, 30],
          ]) {
            const shot = await poseR3(pages[build], yaw, pitch),
              image = decode(shot.image);
            const metric = anchoredEdgesR3(
              image,
              await projectAnchorsR3(pages[build], anchors.anchors),
              anchors.anchors,
              sourcePhoto,
            );
            const row = {
              id: entry.id,
              screen: name,
              build: build ? "after" : "before",
              depth,
              yaw,
              pitch,
              buffer: [shot.width, shot.height],
              deviceScaleFactor: screen.deviceScaleFactor,
              ratio: shot.width / screen.width,
              candidates: anchors.candidates,
              colorRejected: anchors.colorRejected,
              depthRejected: anchors.depthRejected,
              borderRejected: anchors.borderRejected,
              stableAnchors: anchors.evaluated,
              ...metric,
            };
            rows.push(row);
            sampleRows.push(row);
            if (metric.anchoredMAE !== null && metric.anchoredMAE > worst) {
              worst = metric.anchoredMAE;
              fs.writeFileSync(
                path.join(out, `${name}-${entry.id}-${row.build}-worst-anchored.png`),
                PNG.sync.write(image),
              );
            }
          }
        }
      }
      fs.writeFileSync(file, JSON.stringify(sampleRows, null, 2));
      fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows));
      console.log(
        name,
        entry.id,
        anchors.evaluated,
        "stable anchors",
        sampleRows.length,
        "poses",
        JSON.stringify(
          sampleRows
            .filter((r) => r.anchoredMAE !== null)
            .reduce((a, b) => (!a || b.anchoredMAE > a.anchoredMAE ? b : a), null),
        ),
      );
    }
    for (const page of pages) await page.close();
  }
  fs.writeFileSync(
    path.join(out, "run.json"),
    JSON.stringify(
      {
        browser: browser.version(),
        rows: rows.length,
        errors,
        builds,
        settings,
        method:
          "Source color/depth anchors frozen from candidate per profile; fitted near-side interior depths; identical independent anchors in both builds. Stable, high-contrast source patches only. No renderer UV or generated-background color in reference. Color differences include minification and uncertain disocclusion; this is not hidden-scene ground truth.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
