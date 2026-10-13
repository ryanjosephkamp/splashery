import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import { openR3, screens } from "./cdx-p3d2-r3-common.mjs";
import { calibration, calibrationShot, calibrationMetric } from "./cdx-p3d2-r3-edge.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/cdx-p3d2/r3/calibration");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(config.use.launchOptions);
try {
  const screen = screens[opt("screen", "phone")];
  const page = await browser.newPage({
    viewport: { width: screen.width, height: screen.height },
    deviceScaleFactor: screen.deviceScaleFactor,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openR3(page, opt("url", "http://127.0.0.1:4175/"), screen);
  const rows = [];
  for (const soft of [false, true]) {
    const info = await calibration(page, { soft });
    for (const [yaw, pitch] of [
      [0, 0],
      [-30, 0],
      [30, 0],
      [0, -30],
      [0, 30],
    ]) {
      const shot = await calibrationShot(page, yaw, pitch);
      const buffer = Buffer.from(shot.image.split(",")[1], "base64");
      const file = `${soft ? "soft" : "hard"}-${yaw}-${pitch}.png`;
      fs.writeFileSync(`${out}/${file}`, buffer);
      rows.push({
        soft,
        yaw,
        pitch,
        ...info,
        ...calibrationMetric(PNG.sync.read(buffer), shot.corners, [info.near, info.far]),
        corners: shot.corners,
        file,
      });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ browser: browser.version(), rows, errors }, null, 2),
  );
} finally {
  await browser.close();
}
