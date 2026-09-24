#!/usr/bin/env node
// Renders a scan from the front, right, top and back with an orthographic
// camera and a world-coordinate grid, for placing rig regions (src/rigs.js).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rig-map.mjs <out-dir> [--size=420] [--rig] [--at=0.6] [--views=front,right,top,back,bottom,left] [--center=x,y,z --half=0.4] id ...
//
// Writes <out-dir>/<id>-map.png. Grid lines are 0.1 apart, labelled every
// 0.5. Front looks along -z (x right, y up), right along -x (-z right),
// top along -y (x right, -z up), back along +z (-x right). --rig tints each
// rig part (as ?rig=show does); --at=0.6 taps the toy and renders the pose
// that many seconds later. --center and --half zoom in on a box of that
// half-size round a point (grid lines stay 0.1 apart, labelled every 0.5,
// with extra labels every 0.1 when zoomed).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...ids] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !ids.length) throw new Error("Usage: node tools/rig-map.mjs <out-dir> id ...");
const size = Number(opt("size", 420));
const rig = args.includes("--rig");
const at = opt("at", "") === "" ? null : Number(opt("at", ""));
const views = opt("views", "front,right,top,back").split(",");
const zoomAt = opt("center", "") ? opt("center", "").split(",").map(Number) : null;
const zoomHalf = Number(opt("half", 0));

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off${rig ? "&rig=show" : ""}`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of ids) {
  const dataUrl = await page.evaluate(
    async ({ id, size, at, views, zoomAt, zoomHalf }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy(id);
      app.setLook({ background: "#202020" });
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
      stage.setFixedSize([size, size]);
      const info = player.toyInfo;
      const R = info.radius;
      const c = zoomAt || info.center;
      const half = zoomHalf || Math.ceil(R * 1.15 * 10) / 10;
      const cam = stage.cameraEntity.camera;
      const saved = { proj: cam.projection, oh: cam.orthoHeight, pose: stage.setCameraPose };
      let pose = null;
      stage.setCameraPose = () => {
        const e = stage.cameraEntity;
        e.setPosition(...pose.pos);
        e.setEulerAngles(...pose.euler);
      };
      cam.projection = 1; // orthographic
      cam.orthoHeight = half;
      const D = R * 6;
      const VIEWS = {
        front: { pos: [c[0], c[1], c[2] + D], euler: [0, 0, 0], ax: [0, 1], sx: [1, 1] },
        right: { pos: [c[0] + D, c[1], c[2]], euler: [0, 90, 0], ax: [2, 1], sx: [-1, 1] },
        top: { pos: [c[0], c[1] + D, c[2]], euler: [-90, 0, 0], ax: [0, 2], sx: [1, -1] },
        back: { pos: [c[0], c[1], c[2] - D], euler: [0, 180, 0], ax: [0, 1], sx: [-1, 1] },
        left: { pos: [c[0] - D, c[1], c[2]], euler: [0, -90, 0], ax: [2, 1], sx: [1, 1] },
        bottom: { pos: [c[0], c[1] - D, c[2]], euler: [90, 0, 0], ax: [0, 2], sx: [1, 1] },
      };
      const advance = async (secs) => {
        let left = secs;
        while (left > 1e-6) {
          const d = Math.min(1 / 30, left);
          left -= d;
          pending = d;
          await stage.captureFrame();
        }
      };
      pose = VIEWS.front;
      await advance(0.3);
      if (at !== null) {
        player.act(null);
        await advance(at);
      }
      const shots = [];
      for (const v of views) {
        pose = VIEWS[v];
        pending = 0;
        await stage.captureFrame();
        await stage.captureFrame();
        shots.push([v, await stage.captureFrame()]);
      }
      cam.projection = saved.proj;
      cam.orthoHeight = saved.oh;
      stage.setCameraPose = saved.pose;
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);

      const out = document.createElement("canvas");
      out.width = size * shots.length;
      out.height = size + 18;
      const g = out.getContext("2d");
      g.fillStyle = "#202020";
      g.fillRect(0, 0, out.width, out.height);
      g.font = "11px sans-serif";
      shots.forEach(([name, img], i) => {
        const v = VIEWS[name];
        const ox = i * size;
        g.drawImage(img, ox, 0, size, size);
        // World -> pixel along each screen axis.
        const px = (w, k) => size / 2 + (v.sx[k] * (w - c[v.ax[k]]) * size) / (2 * half);
        for (let k = 0; k < 2; k++) {
          const lo = Math.floor((c[v.ax[k]] - half) * 10);
          const hi = Math.ceil((c[v.ax[k]] + half) * 10);
          for (let n = lo; n <= hi; n++) {
            const w = n / 10;
            const major = n % 5 === 0 || (zoomHalf > 0 && zoomHalf < 0.6);
            const p = k === 0 ? px(w, 0) : size - px(w, 1);
            g.strokeStyle = major ? "rgba(0,220,255,0.55)" : "rgba(0,220,255,0.18)";
            g.lineWidth = 1;
            g.beginPath();
            if (k === 0) {
              g.moveTo(ox + p, 0);
              g.lineTo(ox + p, size);
            } else {
              g.moveTo(ox, p);
              g.lineTo(ox + size, p);
            }
            g.stroke();
            if (major) {
              g.fillStyle = "rgba(120,240,255,0.95)";
              if (k === 0) g.fillText(w.toFixed(1), ox + p + 2, size - 4);
              else g.fillText(w.toFixed(1), ox + 2, p - 2);
            }
          }
        }
        const names = ["x", "y", "z"];
        g.fillStyle = "#ddd";
        g.fillText(`${name}: ${names[v.ax[0]]}${v.sx[0] < 0 ? "-" : "+"} right, ${names[v.ax[1]]}${v.sx[1] < 0 ? "-" : "+"} up`, ox + 6, size + 13); // prettier-ignore
      });
      return out.toDataURL("image/png");
    },
    { id, size, at, views, zoomAt, zoomHalf },
  );
  const out = path.join(outDir, `${id}-map.png`);
  fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`${id}: ${out}`);
}
await browser.close();
