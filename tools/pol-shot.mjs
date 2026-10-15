#!/usr/bin/env node
// Lane Polish: one still of a science toy at phone size (390×844), the camera
// flown to a point as tools/sci-clip.mjs's { fly } does, for checking a fix
// without rendering a whole clip. Labs on (the toys' GPU program runs only
// with labs).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pol-shot.mjs <out.png> --toy=smlm-microscope \
//     [--opt=key=value ...] [--near=0.62] [--point=x,y | --to=x,y,z] [--dist=0.04] [--yaw=0] [--tap] [--secs=2] [--w=390] [--h=844]
//
// --point is the toy's sciPoint (µm from the field's center for the
// microscope), --to a point in recipe coordinates; --dist is in toy radii.
// --tap taps the toy's action (at the point) and runs --secs before the shot.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
const toy = opt("toy", "");
if (!out || !toy) throw new Error("Usage: node tools/pol-shot.mjs <out.png> --toy=<id> …");
const nums = (s) => (s ? s.split(",").map(Number) : null);
const spec = {
  toy,
  options: Object.fromEntries(args.filter((a) => a.startsWith("--opt=")).map((a) => a.slice(6).split("="))), // prettier-ignore
  near: Number(opt("near", 1)),
  point: nums(opt("point", "")),
  to: nums(opt("to", "")),
  dist: opt("dist", "") ? Number(opt("dist", "")) : null,
  yaw: Number(opt("yaw", 0)),
  tap: args.includes("--tap"),
  secs: Number(opt("secs", 2)),
  W: Number(opt("w", 390)),
  H: Number(opt("h", 844)),
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const png = await page.evaluate(async (s) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(s.toy);
  if (Object.keys(s.options).length) await app.setToyOptions(s.options);
  app.setLook({ background: "#111111" });
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
  await new Promise((r) => setTimeout(r, 1200));
  const stage = player.stage;
  const handlers = stage.updateHandlers.slice();
  let pending = 0;
  stage.updateHandlers.length = 0;
  stage.updateHandlers.push(() => {
    const d = pending;
    pending = 0;
    for (const h of handlers) h(d);
  });
  stage.setFixedSize([s.W, s.H]);
  const cam = player.camera;
  cam.home.distance *= s.near;
  const tf = player.motion.ctx?.transform;
  const toWorld = (p) => (tf ? p.map((v, i) => (v - tf.center[i]) * tf.scale) : p);
  const recipe = player.toyInfo?.recipe;
  const to = s.point ? recipe.sciPoint(s.point) : s.to;
  if (to)
    cam.setPan(
      toWorld(to).map((v, i) => (v - cam.center[i]) / cam.radius),
      true,
    );
  const dist = s.dist ? s.dist * cam.radius : cam.home.distance;
  const pose = () => {
    const p = { ...cam.home, yaw: cam.home.yaw + s.yaw, distance: dist };
    cam.cur = { ...p };
    cam.tgt = { ...p };
  };
  pending = 0.5;
  pose();
  await stage.captureFrame();
  if (s.tap) {
    player.act(to ? toWorld(to) : null);
    for (let t = 0; t < s.secs; t += 1 / 15) {
      pending = 1 / 15;
      pose();
      await stage.captureFrame();
    }
  }
  pending = 0.02;
  pose();
  await stage.captureFrame();
  pending = 0;
  const c = await stage.captureFrame();
  return c.toDataURL("image/png");
}, spec);
fs.writeFileSync(out, Buffer.from(png.split(",")[1], "base64"));
console.log(out);
await browser.close();
