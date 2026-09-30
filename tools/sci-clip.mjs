#!/usr/bin/env node
// Lane Science's clips: the Science toys as looping GIFs at phone size, with
// labs on (their GPU program runs only with labs), scripted per card: the
// camera turning, options, controls eased over time, taps and opening a
// file of your own.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/sci-clip.mjs <out-dir> [--w=390] [--h=844] [--fps=12] [--strip=6] [--strip-scale=0.5] card ...
//
// Writes <out-dir>/<card>.gif (and <card>-strip.png with --strip). The clock
// is stepped by hand, so a clip runs at real speed however slow the
// renderer is. The cards are in CARDS below.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...cards] = args.filter((a) => !a.startsWith("--"));
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const fps = Number(opt("fps", 12));
const stripN = Number(opt("strip", 0));
const bg = opt("bg", "#111111");
const stripScale = Number(opt("strip-scale", 0.5)); // the strip's frames at this scale

// A card: the toy, its options, and a script of timed steps. Each step runs
// at `t` seconds: { yaw: radians per second } turns the camera from then on;
// { set: { key: value } } sets controls; { ease: { key, from, to, secs } }
// moves a control smoothly; { tap: [x, y, z] | true } taps (a point in
// recipe coordinates, or the toy's action); { file, options } opens a file
// through the toy's input panel.
const CARDS = {
  "sci-ellipsoids": {
    toy: "thermal-ellipsoids",
    options: { structure: "aspirin", level: "50" },
    secs: 6,
    near: 0.8,
    steps: [{ t: 0, yaw: 0.45 }],
  },
  "sci-jiggle": {
    toy: "thermal-ellipsoids",
    options: { structure: "aspirin", level: "50" },
    secs: 6,
    near: 0.8,
    steps: [
      { t: 0, yaw: 0.12 },
      { t: 0.6, tap: true },
      { t: 4.8, tap: true },
    ],
  },
  "sci-protein": {
    toy: "thermal-ellipsoids",
    options: { structure: "crambin", level: "50" },
    secs: 7,
    steps: [
      { t: 0, yaw: 0.1, focus: "TYR44" },
      { t: 0.8, ease: { key: "zoom", from: 0, to: 0.92, secs: 4 } },
    ],
  },
  "sci-microscope": {
    toy: "smlm-microscope",
    options: { data: "sample", color: "depth" },
    secs: 7.5,
    near: 0.62,
    steps: [
      { t: 0, yaw: 0.05 },
      { t: 1.2, focus: [-0.4, -0.4], tap: true },
    ],
  },
  "sci-galaxy": {
    toy: "galaxy-box",
    options: { color: "temperature" },
    secs: 8,
    near: 0.85,
    steps: [
      { t: 0, yaw: 0.3 },
      { t: 3.5, focus: [6, 0, 3], tap: true },
    ],
  },
  "sci-open": {
    toy: "thermal-ellipsoids",
    options: { structure: "aspirin", level: "50" },
    secs: 6,
    steps: [
      { t: 0, yaw: 0.35 },
      { t: 1.2, file: "tests/fixtures/sci/paracetamol-cod-2104364.cif" },
    ],
  },
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const name of cards) {
  const card = CARDS[name];
  if (!card) throw new Error(`No card ${name}`);
  const files = {};
  for (const s of card.steps) if (s.file) files[s.file] = fs.readFileSync(s.file, "utf8");
  const { bytes, strip } = await page.evaluate(
    async ({ card, W, H, fps, stripN, bg, files, stripScale }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      await app.chooseToy(card.toy);
      if (card.options) await app.setToyOptions(card.options);
      app.setLook({ background: bg });
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
      stage.setFixedSize([W, H]);
      const cam = player.camera;
      const homeDistance = cam.home.distance;
      if (card.near) cam.home.distance *= card.near;
      let yaw = cam.home.yaw;
      let yawRate = 0;
      const pose = () => {
        cam.cur = { ...cam.home, yaw };
        cam.tgt = { ...cam.home, yaw };
      };
      const step = 1 / fps;
      const gif = GIFEncoder();
      const delay = Math.round(1000 / fps);
      const total = Math.round(card.secs / step);
      const pickAt = new Set();
      for (let i = 0; i < stripN; i++) pickAt.add(Math.round(((i + 0.5) / stripN) * total));
      const shots = [];
      const eases = [];
      const tf = () => player.motion.ctx?.transform;
      const toWorld = (p) => {
        const t = tf();
        return t ? p.map((v, i) => (v - t.center[i]) * t.scale) : p;
      };
      const recipe = () => player.toyInfo?.recipe;
      pending = 0.5;
      await stage.captureFrame();
      const done = new Set();
      for (let n = 0; n < total; n++) {
        const time = n * step;
        for (const [i, s] of card.steps.entries()) {
          if (done.has(i) || s.t > time + 1e-6) continue;
          done.add(i);
          if (s.yaw !== undefined) yawRate = s.yaw;
          if (s.set) for (const [k, v] of Object.entries(s.set)) app.setControl(k, v);
          if (s.ease) eases.push({ ...s.ease, t0: time });
          if (s.focus) recipe()?.sciFocus?.(s.focus);
          if (s.tap) player.act(s.tap === true ? null : toWorld(s.tap));
          if (s.file) {
            const opts = await recipe().input.read(files[s.file], s.file.split("/").pop());
            await app.setToyOptions(opts);
            pending = 0.05;
            await stage.captureFrame();
          }
        }
        for (const e of eases) {
          const f = Math.max(0, Math.min(1, (time - e.t0) / e.secs));
          const sm = f * f * (3 - 2 * f);
          player.motion.state[e.key] = e.from + (e.to - e.from) * sm;
          app.setControl(e.key, e.from + (e.to - e.from) * sm);
        }
        yaw += yawRate * step;
        pending = step;
        pose();
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        if (pickAt.has(n)) shots.push({ bmp: await createImageBitmap(c), t: time });
        const rgba = c.getContext("2d").getImageData(0, 0, W, H).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay, repeat: 0 }); // prettier-ignore
      }
      gif.finish();
      cam.home.distance = homeDistance;
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      let strip = null;
      if (shots.length) {
        const sw = Math.round(W * stripScale);
        const sh = Math.round(H * stripScale);
        const out = document.createElement("canvas");
        out.width = sw * shots.length;
        out.height = sh + 18;
        const ctx = out.getContext("2d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#bbb";
        shots.forEach((s, i) => {
          ctx.drawImage(s.bmp, i * sw, 0, sw, sh);
          ctx.fillText(`${s.t.toFixed(1)}s`, i * sw + 6, sh + 13);
        });
        strip = out.toDataURL("image/png");
      }
      return { bytes: Array.from(gif.bytes()), strip };
    },
    { card, W, H, fps, stripN, bg, files, stripScale },
  );
  const out = path.join(outDir, `${name}.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  if (strip) fs.writeFileSync(path.join(outDir, `${name}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${name}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
