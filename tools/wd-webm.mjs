#!/usr/bin/env node
// Turns a review clip (a GIF from tools/world-clip.mjs) into a WebM video,
// which is several times smaller for scenes full of grass and water. The
// Effect review page plays WebM clips as well as GIFs. Chromium does the
// encoding (MediaRecorder, VP9), frame by frame from a canvas, so nothing
// else needs installing.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/wd-webm.mjs <clip.gif> [out.webm] [--fps=10] [--kbps=2500]
//
// The GIF's frames are unpacked with omggif (vendored) into .cache/webm/,
// which the local server serves to the page.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { GifReader } from "../vendor/omggif/omggif.js";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [src, outArg] = args.filter((a) => !a.startsWith("--"));
if (!src) throw new Error("Usage: node tools/wd-webm.mjs <clip.gif> [out.webm]");
const out = outArg || src.replace(/\.gif$/i, ".webm");
const fps = Number(opt("fps", 10));
const kbps = Number(opt("kbps", 2500));
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

// Unpack the frames (each drawn over the last, as a GIF shows them).
const gif = new GifReader(new Uint8Array(fs.readFileSync(src)));
const dir = ".cache/webm";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const rgba = new Uint8Array(gif.width * gif.height * 4);
for (let i = 0; i < gif.numFrames(); i++) {
  gif.decodeAndBlitFrameRGBA(i, rgba);
  const png = new PNG({ width: gif.width, height: gif.height });
  png.data = Buffer.from(rgba);
  fs.writeFileSync(path.join(dir, `${i}.png`), PNG.sync.write(png));
}

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage();
await page.goto(`${base}${dir}/`);
const b64 = await page.evaluate(
  async ({ n, w, h, fps, kbps, dir }) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const stream = c.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: kbps * 1000 }); // prettier-ignore
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    const imgs = [];
    for (let i = 0; i < n; i++) imgs.push(await createImageBitmap(await (await fetch(`/${dir}/${i}.png`)).blob())); // prettier-ignore
    rec.start();
    for (const im of imgs) {
      g.drawImage(im, 0, 0);
      track.requestFrame();
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
    await new Promise((r) => setTimeout(r, 200));
    rec.stop();
    await done;
    const buf = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); // prettier-ignore
    return btoa(s);
  },
  { n: gif.numFrames(), w: gif.width, h: gif.height, fps, kbps, dir },
);
fs.writeFileSync(out, Buffer.from(b64, "base64"));
await browser.close();
console.log(`${out}: ${gif.numFrames()} frames, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
