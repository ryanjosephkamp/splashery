#!/usr/bin/env node
// Lane Any pose: every toy's tap, upright, on its side and upside down,
// measured (docs/audits/poses-2026-10.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pose-sweep.mjs <out.json> [--size=128] [--kitfix] [--from=id] [--only=a,b] [--shelf=food] [--part=1/3]
//
// Each pose turns the whole toy about the camera's line of sight (a quarter
// turn: on its side; a half turn: upside down), through the point the camera
// looks at, as Hands-on poses a toy (Stage.setToyPose). Seen down that line,
// a toy whose effect works in its own frame looks exactly like the upright
// toy turned on the screen, frame for frame. So each posed frame is turned
// back on the screen and compared with the upright frame at the same moment
// after the tap: `err` is the mean color difference (0..255) where either
// frame shows the toy, less the same difference before the tap (`floor`,
// the rendering's own noise), and `move` is how far the upright frames
// moved from the one before the tap (how big the effect is). `rel` is err
// over move. --kitfix poses a kit toy's parts as main did before the Any
// pose engine change (poseKitUniforms), for the "before" sweep. Resumes:
// toys already in <out.json> are skipped.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outFile] = args.filter((a) => !a.startsWith("--"));
if (!outFile) throw new Error("Usage: node tools/pose-sweep.mjs <out.json>");
const size = Number(opt("size", 128));
const kitfix = args.includes("--kitfix");
const only = opt("only", "") ? opt("only", "").split(",") : null;
const shelf = opt("shelf", "");
const from = opt("from", "");

const { TOYS } = await import("../src/toys.js");
let list = TOYS.filter((t) => (!only || only.includes(t.id)) && (!shelf || t.category === shelf));
if (from)
  list = list.slice(
    Math.max(
      0,
      list.findIndex((t) => t.id === from),
    ),
  );
const done = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};

const launch = () =>
  chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
  });
let browser = await launch();
let page = null;
const open = async () => {
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
};
await open();

for (const toy of list) {
  if (done[toy.id]) continue;
  let r;
  try {
    r = await Promise.race([
      page.evaluate(measure, { id: toy.id, size, kitfix }),
      new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 600_000)),
    ]);
  } catch (e) {
    r = { error: String(e.message || e).slice(0, 200) };
    await browser.close().catch(() => {});
    browser = await launch();
    await open();
  }
  done[toy.id] = { kind: toy.kind, shelf: toy.category, labs: !!toy.labs, ...r };
  fs.writeFileSync(outFile, JSON.stringify(done, null, 1));
  const s = (p) => (r[p] ? `${p} err ${r[p].err.toFixed(1)} rel ${r[p].rel.toFixed(2)}` : "");
  console.log(`${toy.id}: ${r.error || `${r.mode || "-"} move ${r.move?.toFixed(1)} ${s("side")} ${s("down")}`}`); // prettier-ignore
}
await browser.close();

// In the page: the toy's tap in three poses, compared.
async function measure({ id, size, kitfix }) {
  const { app, player } = window.__splashery;
  const stage = player.stage;
  const TIMES = [0.35, 0.9, 1.8];
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const quatAxis = (a, t) => [a[0] * Math.sin(t / 2), a[1] * Math.sin(t / 2), a[2] * Math.sin(t / 2), Math.cos(t / 2)]; // prettier-ignore
  const fieldsMod = kitfix ? await import("/src/physics/fields.js") : null;
  const out = { frames: {} };
  const shots = {};
  for (const which of ["up", "side", "down"]) {
    await app.chooseToy(id);
    await wait(300);
    const info = player.toyInfo;
    if (which === "up") {
      out.canPlay = !!player.handsOn && (await import("/src/physics/hands-on.js")).canPlay(info);
      out.mode = info.recipe?.hands && (info.recipe.hands.pieces || info.recipe.hands.joints || info.recipe.hands.ropes || info.recipe.hands.cloth || info.recipe.hands.stretch) ? "pieces" : "toy"; // prettier-ignore
    }
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
    stage.setFixedSize([size, size]);
    const home = () => {
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
    };
    home();
    const cam = player.camera.pose();
    const target = cam.position.map((v, k) => v + cam.forward[k] * cam.distance);
    const angle = which === "side" ? Math.PI / 2 : which === "down" ? Math.PI : 0;
    if (angle) {
      const pose = { pivot: target, q: quatAxis(cam.forward, angle), t: [0, 0, 0] };
      stage.setToyPose(pose);
      if (fieldsMod && player.motion.ctx?.kit) player.motion.handsFix = (u) => fieldsMod.poseKitUniforms(u, pose); // prettier-ignore
    }
    const snap = async () => {
      home();
      pending = 0;
      const c = await stage.captureFrame();
      return c.getContext("2d").getImageData(0, 0, size, size);
    };
    // The clock moves on without drawing (only the measured frames are drawn).
    const advance = async (secs) => {
      const step = 1 / 30;
      for (let t = 0; t < secs - 1e-6; t += step) {
        home();
        for (const h of handlers) h(step);
      }
    };
    // The same clock in every pose (some effects run on the page's clock).
    player.time = 100;
    player.motion.kitClock = { t: 0, last: null, rate: 1 };
    player.motion.moveClock = { t: 0, last: null, rate: 1 };
    await advance(0.4);
    const frames = [await snap()];
    player.act(null);
    let at = 0;
    for (const T of TIMES) {
      await advance(T - at);
      at = T;
      frames.push(await snap());
    }
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    stage.setToyPose(null);
    player.motion.handsFix = null;
    shots[which] = { frames, angle };
  }
  // Compares two frames where either shows the toy: mean |difference| (0..255).
  const diff = (a, b) => {
    let s = 0;
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const la = a.data[i] + a.data[i + 1] + a.data[i + 2];
      const lb = b.data[i] + b.data[i + 1] + b.data[i + 2];
      if (la < 12 && lb < 12) continue;
      s += (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3; // prettier-ignore
      n++;
    }
    return n ? s / n : 0;
  };
  // A frame turned on the screen about its middle.
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const src = document.createElement("canvas");
  src.width = src.height = size;
  const sg = src.getContext("2d");
  const turn = (img, a) => {
    sg.putImageData(img, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    g.translate(size / 2, size / 2);
    g.rotate(a);
    g.translate(-size / 2, -size / 2);
    g.drawImage(src, 0, 0);
    return g.getImageData(0, 0, size, size);
  };
  const up = shots.up.frames;
  const moves = up.slice(1).map((f) => diff(f, up[0]));
  out.move = Math.max(...moves);
  for (const which of ["side", "down"]) {
    const { frames, angle } = shots[which];
    // Which way the screen turns: whichever undoes the pose before the tap.
    const sign = diff(turn(frames[0], angle), up[0]) <= diff(turn(frames[0], -angle), up[0]) ? 1 : -1; // prettier-ignore
    const floor = diff(turn(frames[0], sign * angle), up[0]);
    const errs = frames.slice(1).map((f, i) => Math.max(0, diff(turn(f, sign * angle), up[i + 1]) - floor)); // prettier-ignore
    const err = Math.max(...errs);
    out[which] = { err, floor, errs, rel: err / Math.max(out.move, 1) };
  }
  delete out.frames;
  return out;
}
