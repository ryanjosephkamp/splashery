#!/usr/bin/env node
// Lane Any pose: proves that upright toys are untouched by the Any pose
// engine change. Renders each toy upright at fixed moments before and after
// its tap, and writes a hash of every frame plus the uniforms the effects
// read, so two runs (main on one port, the branch on another) can be
// compared exactly.
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pose-upright.mjs <out.json> [--url=http://127.0.0.1:4173/] id ...
//   node tools/pose-upright.mjs --compare a.json b.json

import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "--compare") {
  const [a, b] = args.slice(1).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  let same = 0;
  let differ = 0;
  for (const id of Object.keys(a)) {
    if (!b[id]) continue;
    const ok = JSON.stringify(a[id]) === JSON.stringify(b[id]);
    if (ok) same++;
    else {
      differ++;
      console.log(`${id}: differs`);
    }
  }
  console.log(`${same} toys identical, ${differ} differ`);
  process.exit(differ ? 1 : 0);
}
const opt = (name, def) => {
  const x = args.find((s) => s.startsWith(`--${name}=`));
  return x ? x.slice(name.length + 3) : def;
};
const [outFile, ...ids] = args.filter((s) => !s.startsWith("--"));
const base = opt("url", process.env.SPLASHERY_URL || "http://127.0.0.1:4173/");
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const out = {};
for (const id of ids) {
  out[id] = await page.evaluate(
    async ({ id }) => {
      const { app, player } = window.__splashery;
      const stage = player.stage;
      await app.chooseToy(id);
      await new Promise((ok) => setTimeout(ok, 300));
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      app.setLook({ background: "#000000" });
      const handlers = stage.updateHandlers.slice();
      let pending = 0;
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = pending;
        pending = 0;
        for (const h of handlers) h(d);
      });
      stage.setFixedSize([160, 160]);
      const home = () => {
        player.camera.cur = { ...player.camera.home };
        player.camera.tgt = { ...player.camera.home };
      };
      // The uniforms the effects read (the pose's own are left out: main has none).
      const uni = () => {
        const u = {};
        const g = stage.toy.entity.gsplat;
        const all = g._parameters instanceof Map ? [...g._parameters.keys()] : Object.keys(g._parameters || {}); // prettier-ignore
        for (const k of all) {
          if (k.startsWith("uSpPose")) continue;
          const v = g.getParameter(k);
          const d = v?.data ?? v;
          if (d && typeof d.length === "number") u[k] = Array.from(d, (x) => Math.round(x * 1e5) / 1e5); // prettier-ignore
        }
        return u;
      };
      const hash = (img) => {
        let h = 2166136261;
        for (let i = 0; i < img.data.length; i++) h = Math.imul(h ^ img.data[i], 16777619);
        return (h >>> 0).toString(16);
      };
      const step = async (secs) => {
        for (let t = 0; t < secs - 1e-6; t += 1 / 30) {
          home();
          pending = 1 / 30;
          await stage.captureFrame();
        }
      };
      const shots = [];
      await step(0.4);
      const shot = async () => {
        home();
        pending = 0;
        const c = await stage.captureFrame();
        shots.push({ frame: hash(c.getContext("2d").getImageData(0, 0, 160, 160)), u: uni() });
      };
      await shot();
      player.act(null);
      for (const dt of [0.2, 0.5, 0.8, 1.5]) {
        await step(dt);
        await shot();
      }
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      return shots;
    },
    { id },
  );
  console.log(`${id}: ${out[id].map((s) => s.frame).join(" ")}`);
}
fs.writeFileSync(outFile, JSON.stringify(out));
await browser.close();
