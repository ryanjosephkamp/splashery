#!/usr/bin/env node
// Lane MP1: how crisp Moving photo to 3D's picture is, as a phone shows it. Renders a clip at a
// phone's size (390 by 844 at 3x, the picture about 1170 pixels wide), head-on and paused at a
// time, in the Sharp and Splats views, and scores the picture's fine detail: the mean gradient
// (Sobel, on brightness) of the picture's middle, over the same of the source's own frame at that
// time scaled to the same size. 1 is as crisp as the film's master; less is softer.
//
//   node tools/mp1-crisp.mjs <clip id> <seconds> <reference.png> [--old=<dir>] [--out=<dir>]
//
// <reference.png> is the master's frame at that time (ffmpeg -ss <s> -i <master> -frames:v 1).
// --old=<dir> serves the clip's .webm and .mp2depth from <dir> instead (the files before a change).
// Needs the static server on 4173 (node tools/cdx-mp2-server.mjs 4173).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const [id, seconds, reference] = args.filter((a) => !a.startsWith("--"));
const old = opt("old");
const out = opt("out");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

// The mean Sobel magnitude of the brightness inside the middle 80% of an RGBA picture.
function detail({ width: w, height: h, data }) {
  const y = (x, j) => {
    const o = (j * w + x) * 4;
    return 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
  };
  let sum = 0,
    n = 0;
  for (let j = Math.round(h * 0.1); j < Math.round(h * 0.9); j++)
    for (let x = Math.round(w * 0.1); x < Math.round(w * 0.9); x++) {
      const gx = y(x + 1, j - 1) + 2 * y(x + 1, j) + y(x + 1, j + 1) - y(x - 1, j - 1) - 2 * y(x - 1, j) - y(x - 1, j + 1); // prettier-ignore
      const gy = y(x - 1, j + 1) + 2 * y(x, j + 1) + y(x + 1, j + 1) - y(x - 1, j - 1) - 2 * y(x, j - 1) - y(x + 1, j - 1); // prettier-ignore
      sum += Math.hypot(gx, gy);
      n++;
    }
  return sum / n;
}

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const result = { id, seconds: Number(seconds), old: !!old };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); // prettier-ignore
  if (old)
    await page.route(/-long\.(webm|mp2depth)$/, (route) => {
      const file = path.join(old, route.request().url().split("/").pop());
      if (!fs.existsSync(file)) return route.continue();
      const body = fs.readFileSync(file);
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || "");
      if (!range) return route.fulfill({ body, headers: { "accept-ranges": "bytes" } });
      const a = Number(range[1]),
        b = range[2] ? Number(range[2]) : body.length - 1;
      return route.fulfill({
        status: 206,
        body: body.subarray(a, b + 1),
        headers: { "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${body.length}` },
      });
    });
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=high&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.evaluate((c) => window.__splashery.app.setToyOptions({ clip: c }), id);
  await page.waitForFunction(
    async (c) =>
      (await import("/src/packs/moving-photo.js")).MOVING.clip?.sample === c &&
      document.getElementById("progress").hidden,
    id,
    { timeout: 180_000 },
  );
  await page.evaluate(() => window.__splashery.app.setControl("play", 0));
  for (const view of ["sharp", "splats"]) {
    await page.evaluate(
      async (v) => (await import("/src/packs/photo-sharp.js")).setSharpView("moving-photo-3d", v),
      view,
    );
    await page.evaluate(async (t) => {
      const { movingTransport } = await import("/src/packs/moving-photo.js");
      movingTransport.seek(t);
      const pl = window.__splashery.player;
      pl.camera.setState({ ...pl.camera.getState(), yaw: 0, pitch: 0 }, { snap: true });
      pl.stage.requestRender?.();
    }, Number(seconds));
    await page.waitForTimeout(5000);
    // The stage's own frame (the picture spans its width).
    const url = await page.evaluate(async () =>
      (await window.__splashery.player.stage.captureFrame()).toDataURL("image/png"),
    );
    const shot = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
    // Find the picture: the rows and columns where the frame isn't the page's background.
    const { width: W, height: H, data } = shot;
    const bg = [data[0], data[1], data[2]];
    const off = (x, j) => {
      const o = (j * W + x) * 4;
      return Math.abs(data[o] - bg[0]) + Math.abs(data[o + 1] - bg[1]) + Math.abs(data[o + 2] - bg[2]) > 30; // prettier-ignore
    };
    const midY = Math.round(H / 2),
      midX = Math.round(W / 2);
    let x0 = 0,
      x1 = W - 1,
      y0 = 0,
      y1 = H - 1;
    while (x0 < midX && !off(x0, midY)) x0++;
    while (x1 > midX && !off(x1, midY)) x1--;
    while (y0 < midY && !off(midX, y0)) y0++;
    while (y1 > midY && !off(midX, y1)) y1--;
    // (inside the dark frame, about 3% of the width)
    const inset = Math.round((x1 - x0) * 0.035);
    x0 += inset;
    x1 -= inset;
    y0 += inset;
    y1 -= inset;
    const crop = new PNG({ width: x1 - x0, height: y1 - y0 });
    PNG.bitblt(shot, crop, x0, y0, crop.width, crop.height, 0, 0);
    result[view] = { width: crop.width, height: crop.height, detail: detail(crop) };
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `${id}-${view}${old ? "-old" : ""}.png`), PNG.sync.write(crop)); // prettier-ignore
    }
  }
  // The master's frame at the same size, through the browser's own high-quality scaling.
  const ref = await page.evaluate(
    async ({ url, w, h }) => {
      const img = await createImageBitmap(await (await fetch(url)).blob());
      const c = new OffscreenCanvas(w, h);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, w, h);
      return Array.from(g.getImageData(0, 0, w, h).data);
    },
    {
      url: `data:image/png;base64,${fs.readFileSync(reference).toString("base64")}`,
      w: result.sharp.width,
      h: result.sharp.height,
    },
  );
  result.master = detail({ width: result.sharp.width, height: result.sharp.height, data: ref });
  for (const view of ["sharp", "splats"]) result[view].score = result[view].detail / result.master;
} finally {
  await browser.close();
}
console.log(JSON.stringify(result));
