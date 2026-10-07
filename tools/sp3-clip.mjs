#!/usr/bin/env node
// Lane Space r3: a clip of a real world's tap zoom at phone size, as an MP4.
// Like tools/sp2-clip.mjs (the clock is stepped by hand, labs on), with two
// differences: the tap lands on a named spot (latitude and longitude), and
// the clip's clock waits while the toy rebuilds round that spot (a phone
// shows the turn running meanwhile; here it would only show as a pause).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/sp3-clip.mjs <out-dir> \
//     real-earth:48.857,2.352 [--hold=3] [--before=1.5] [--size=360] [--h=780] [--fps=24] [--strip=8]
//
// Writes <out-dir>/<id>-<n>.mp4 (n counting the spots of one toy) and, with
// --strip, a strip of frames beside it. The clip: the world turning, the tap,
// the turn and the zoom, --hold seconds on the name, a second tap, and back out.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...specs] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !specs.length)
  throw new Error("Usage: node tools/sp3-clip.mjs <out-dir> id:lat,lon ...");
const size = Number(opt("size", 360));
const high = Number(opt("h", 780));
const fps = Number(opt("fps", 24));
const before = Number(opt("before", 1.5));
const hold = Number(opt("hold", 3));
const stripN = Number(opt("strip", 0));

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
let frameDir = null;
await page.exposeFunction("__sp3Frame", (n, url) => {
  fs.writeFileSync(path.join(frameDir, `${String(n).padStart(5, "0")}.png`), Buffer.from(url.split(",")[1], "base64")); // prettier-ignore
});
const count = new Map();
for (const spec of specs) {
  const [id, spot] = spec.split(":");
  const [lat, lon] = spot.split(",").map(Number);
  const n = (count.get(id) ?? 0) + 1;
  count.set(id, n);
  const name = `${id}-${n}`;
  frameDir = path.join(outDir, `${name}-frames`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  const strip = await page.evaluate(
    async ({ id, lat, lon, size, high, fps, before, hold, stripN }) => {
      const { app, player } = window.__splashery;
      const m = await import("/src/packs/space-r2.js");
      const world =
        { "real-moons": "io", "real-small-worlds": "pluto" }[id] ?? id.replace(/^real-/, "");
      const DEG = Math.PI / 180;
      // Facing the spot, a little before it, so the turn shows.
      const z0 = m.zoomState(world);
      Object.assign(z0, { phase: "idle", spin: -(lon - 12) * DEG, at: "" });
      await app.chooseToy(id);
      app.setLook({ background: "#000000" });
      // The sun a little left of the viewer, so the spot is lit.
      app.setControl("sun", 0.42);
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1500));
      const stage = player.stage;
      const handlers = stage.updateHandlers.slice();
      let pending = 0;
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = pending;
        pending = 0;
        for (const h of handlers) h(d);
      });
      stage.setFixedSize([size, high]);
      const step = 1 / fps;
      const shots = [];
      let k = 0;
      let t = 0;
      const frame = async () => {
        // (The clock waits while the toy rebuilds round the spot.)
        while (player.switching) await new Promise((r) => setTimeout(r, 50));
        pending = step;
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        await window.__sp3Frame(k++, c.toDataURL("image/png"));
        t += step;
        return c;
      };
      pending = 0.5;
      await stage.captureFrame();
      const keep = async (c, label) => {
        if (shots.length < stripN) shots.push({ bmp: await createImageBitmap(c), label });
      };
      let c;
      for (let s = 0; s < before; s += step) c = await frame();
      await keep(c, "before");
      // The tap, on the spot as it shows now.
      const q = m.zoomState(world).q;
      const d = m.dirOf(lat, lon);
      const [x, y, zq, w] = q;
      const cx = y * d[2] - zq * d[1] + w * d[0];
      const cy = zq * d[0] - x * d[2] + w * d[1];
      const cz = x * d[1] - y * d[0] + w * d[2];
      const v = [d[0] + 2 * (y * cz - zq * cy), d[1] + 2 * (zq * cx - x * cz), d[2] + 2 * (x * cy - y * cx)]; // prettier-ignore
      player.act(player.fromRecipe(v));
      const inSecs = 5.2 + hold;
      const marks = stripN > 2 ? Array.from({ length: stripN - 2 }, (_, i) => ((i + 1) * inSecs) / (stripN - 1)) : []; // prettier-ignore
      let s0 = t;
      for (let s = 0; s < inSecs; s += step) {
        c = await frame();
        if (marks.length && t - s0 >= marks[0]) (marks.shift(), await keep(c, `${(t - s0).toFixed(1)}s`)); // prettier-ignore
      }
      // The second tap goes back out.
      player.act(player.fromRecipe([0, 0, 1]));
      for (let s = 0; s < 3.6; s += step) c = await frame();
      await keep(c, "out");
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      if (!shots.length) return null;
      const out = document.createElement("canvas");
      out.width = size * shots.length;
      out.height = high + 18;
      const g = out.getContext("2d");
      g.fillStyle = "#000";
      g.fillRect(0, 0, out.width, out.height);
      g.font = "12px sans-serif";
      g.fillStyle = "#bbb";
      shots.forEach((sh, i) => {
        g.drawImage(sh.bmp, i * size, 0, size, high);
        g.fillText(sh.label, i * size + 6, high + 13);
      });
      return out.toDataURL("image/png");
    },
    { id, lat, lon, size, high, fps, before, hold, stripN },
  );
  const out = path.join(outDir, `${name}.mp4`);
  const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(fps), "-i", path.join(frameDir, "%05d.png"), "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]); // prettier-ignore
  if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr}`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  if (strip) fs.writeFileSync(path.join(outDir, `${name}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${name}: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
await browser.close();
