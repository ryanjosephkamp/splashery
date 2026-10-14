#!/usr/bin/env node
// Lane Science r3's clips: the Science toys' new data as looping GIFs at
// phone size, with labs on, scripted per card (tools/sci-clip.mjs's steps,
// plus { opt: { key: value } }, which switches an option mid-clip, keeping
// the card's framing, for a tour of several structures or maps).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/sci3-clip.mjs <out-dir> [--w=390] [--h=844] [--fps=12] [--strip=6] [--strip-scale=0.5] card ...
//
// Writes <out-dir>/<card>.gif (and <card>-strip.png with --strip; with
// --frames, each frame as a JPEG in <card>-frames/ for an MP4, e.g.
// ffmpeg -framerate 12 -i %04d.jpg -pix_fmt yuv420p -crf 20 card.mp4). The clock
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
const profile = opt("profile", "high"); // the tier (r2: "low" for the phone's)
const framesOut = args.includes("--frames"); // also <card>-frames/NNNN.jpg, for an MP4

// A card: the toy, its options, and a script of timed steps. Each step runs
// at `t` seconds: { yaw: radians per second } turns the camera from then on;
// { set: { key: value } } sets controls; { ease: { key, from, to, secs } }
// moves a control smoothly; { tap: [x, y, z] | true } taps (a point in
// recipe coordinates, or the toy's action); { file, options } opens a file
// through the toy's input panel; { fly: { to: [x, y, z] (recipe), point:
// [x, y] (the toy's sciPoint), dist: toy radii, secs } } moves the camera in
// (or out) as a pinch would, its aim to the point and its distance eased on a
// log scale (r2: the microscope and the galaxy zoom with the camera).
const tour = (key, ids, every, from = 0) => ids.map((id, i) => ({ t: from + i * every, opt: { [key]: id } })); // prettier-ignore
const CARDS = {
  // r2 round (the owner's "sharper, polish, enhance" of October 5): the sharp
  // kernel on the map, the terrain and the contour lab; three more molecules.
  "sci3-cryoem-capsid-r4": { toy: "cryoem-map", options: { map: "aav" }, near: 0.72, secs: 8, steps: [{ t: 0, yaw: 0.3 }, { t: 3, tap: true }] }, // prettier-ignore
  "sci3-cryoem-apoferritin-r3": { toy: "cryoem-map", options: { map: "apoferritin" }, near: 0.72, secs: 8, steps: [{ t: 0, yaw: 0.4 }, { t: 2.5, tap: true }] }, // prettier-ignore
  "sci3-cryoem-ribosome-r3": { toy: "cryoem-map", options: { map: "ribosome" }, near: 0.95, secs: 8, steps: [{ t: 0, yaw: 0.4 }, { t: 3, tap: true }] }, // prettier-ignore
  "sci3-cryoem-model-r3": { toy: "cryoem-map", options: { map: "apoferritin", model: true }, near: 0.85, secs: 7, steps: [{ t: 0, yaw: 0.45 }] }, // prettier-ignore
  "sci3-terrain-r2": { toy: "terrain-box", options: { place: "grand-canyon", exag: "2" }, secs: 10, steps: [{ t: 0, yaw: 0.2 }, { t: 1.5, tap: true }, { t: 6.5, tap: true }] }, // prettier-ignore
  "sci3-terrain-helens-r2": { toy: "terrain-box", options: { place: "st-helens", exag: "2", contours: true }, secs: 7, steps: [{ t: 0, yaw: 0.45 }] }, // prettier-ignore
  "sci3-contour-lab-r2": { toy: "contour-lab", options: { place: "st-helens", exag: "2" }, secs: 9, steps: [{ t: 0, yaw: 0.25 }, { t: 1.2, tap: true }, { t: 5.5, tap: true }] }, // prettier-ignore
  "sci3-life-r2": { toy: "thermal-ellipsoids", options: { structure: "alanine", level: "50" }, secs: 7.5, near: 1.0, steps: [{ t: 0, yaw: 0.5 }, ...tour("structure", ["alanine", "histidine", "thymidine"], 2.5)] }, // prettier-ignore
  "sci3-cryoem-capsid-r3": { toy: "cryoem-map", options: { map: "aav" }, near: 0.72, secs: 8, steps: [{ t: 0, yaw: 0.3 }, { t: 3, tap: true }] }, // prettier-ignore
  "sci3-telescope-filters-r2": { toy: "galaxy-box", options: { galaxy: "m12i", view: "telescope", filter: "blue", seeing: "ground" }, pitch: 1.4, secs: 13.5, steps: [{ t: 0, yaw: 0.02 }, ...tour("filter", ["blue", "red", "color"], 4.5)] }, // prettier-ignore
  "sci3-cryoem-model-r2": { toy: "cryoem-map", options: { map: "apoferritin", model: true }, near: 0.85, secs: 7, steps: [{ t: 0, yaw: 0.45 }] }, // prettier-ignore
  "sci3-telescope-r2": { toy: "galaxy-box", options: { galaxy: "m12i", view: "telescope", filter: "color", seeing: "ground" }, pitch: 1.4, secs: 9, steps: [{ t: 0, yaw: 0.02 }] }, // prettier-ignore
  "sci3-cryoem-apoferritin-r2": { toy: "cryoem-map", options: { map: "apoferritin" }, near: 0.72, secs: 8, steps: [{ t: 0, yaw: 0.4 }, { t: 2.5, tap: true }] }, // prettier-ignore
  "sci3-cryoem-ribosome-r2": { toy: "cryoem-map", options: { map: "ribosome" }, near: 0.95, secs: 8, steps: [{ t: 0, yaw: 0.4 }, { t: 3, tap: true }] }, // prettier-ignore
  "sci3-cryoem-capsid-r2": { toy: "cryoem-map", options: { map: "aav" }, near: 0.72, secs: 8, steps: [{ t: 0, yaw: 0.3 }, { t: 3, tap: true }] }, // prettier-ignore
  "sci3-minerals-r2": {
    toy: "thermal-ellipsoids",
    options: { structure: "quartz", level: "50" },
    secs: 12.5,
    near: 0.8,
    steps: [{ t: 0, yaw: 0.45 }, ...tour("structure", ["quartz", "calcite", "beryl", "rock-salt", "ice"], 2.5)], // prettier-ignore
  },
  "sci3-dna-r2": {
    toy: "thermal-ellipsoids",
    options: { structure: "a-dna", level: "50" },
    secs: 15,
    steps: [{ t: 0, yaw: 0.5 }, ...tour("structure", ["a-dna", "rna-quadruplex", "rrna-loop", "dna-drug", "dna-ruthenium"], 3)], // prettier-ignore
  },
  "sci3-life": {
    toy: "thermal-ellipsoids",
    options: { structure: "cytosine", level: "50" },
    secs: 12.5,
    near: 1.0,
    steps: [{ t: 0, yaw: 0.5 }, ...tour("structure", ["cytosine", "guanine", "serotonin", "nad", "capsaicin"], 2.5)], // prettier-ignore
  },
  "sci3-terrain": {
    toy: "terrain-box",
    options: { place: "grand-canyon", exag: "2" },
    secs: 10,
    steps: [
      { t: 0, yaw: 0.2 },
      { t: 1.5, tap: true },
      { t: 6.5, tap: true },
    ],
  },
  "sci3-terrain-helens": {
    toy: "terrain-box",
    options: { place: "st-helens", exag: "2", contours: true },
    secs: 7,
    steps: [{ t: 0, yaw: 0.45 }],
  },
  "sci3-contour-lab": {
    toy: "contour-lab",
    options: { place: "st-helens", exag: "2" },
    secs: 9,
    steps: [
      { t: 0, yaw: 0.25 },
      { t: 1.2, tap: true },
      { t: 5.5, tap: true },
    ],
  },
  "sci3-galaxies": {
    toy: "galaxy-box",
    options: { galaxy: "m12i", view: "gas" },
    secs: 10.5,
    steps: [{ t: 0, yaw: 0.12 }, ...tour("galaxy", ["m12i", "m12i-z2", "m11h"], 3.5)],
  },
  "sci3-telescope": {
    toy: "galaxy-box",
    options: { galaxy: "m12i", view: "telescope", filter: "color", seeing: "ground" },
    pitch: 1.4,
    secs: 9,
    steps: [{ t: 0, yaw: 0.02 }],
  },
  "sci3-telescope-filters": {
    toy: "galaxy-box",
    options: { galaxy: "m12i", view: "telescope", filter: "blue", seeing: "ground" },
    pitch: 1.4,
    secs: 13.5,
    steps: [{ t: 0, yaw: 0.02 }, ...tour("filter", ["blue", "red", "color"], 4.5)],
  },
  "sci3-molecules": {
    toy: "thermal-ellipsoids",
    options: { structure: "sucrose", level: "50" },
    secs: 10,
    near: 0.75,
    steps: [{ t: 0, yaw: 0.5 }, ...tour("structure", ["sucrose", "paracetamol", "ibuprofen", "vitamin-c"], 2.5)], // prettier-ignore
  },
  "sci3-minerals": {
    toy: "thermal-ellipsoids",
    options: { structure: "quartz", level: "50" },
    secs: 12.5,
    near: 0.8,
    steps: [{ t: 0, yaw: 0.45 }, ...tour("structure", ["quartz", "calcite", "beryl", "rock-salt", "ice"], 2.5)], // prettier-ignore
  },
  "sci3-dna": {
    toy: "thermal-ellipsoids",
    options: { structure: "b-dna", level: "50" },
    secs: 8,
    steps: [{ t: 0, yaw: 0.5 }, ...tour("structure", ["b-dna", "z-dna"], 4)],
  },
  "sci3-microscope-pores": {
    toy: "smlm-microscope",
    options: { data: "pores" },
    secs: 7,
    steps: [
      { t: 0, yaw: 0.03 },
      { t: 1, fly: { point: [-1.5, 1.5], dist: 0.25, secs: 5 } },
    ],
  },
  "sci3-microscope-sets": {
    toy: "smlm-microscope",
    options: { data: "actin" },
    secs: 9,
    steps: [{ t: 0, yaw: 0.06 }, ...tour("data", ["actin", "mitochondria", "microtubules3d"], 3)],
  },
  "sci3-cryoem-apoferritin": {
    toy: "cryoem-map",
    options: { map: "apoferritin" },
    near: 0.72,
    secs: 8,
    steps: [
      { t: 0, yaw: 0.4 },
      { t: 2.5, tap: true },
    ],
  },
  "sci3-cryoem-ribosome": {
    toy: "cryoem-map",
    options: { map: "ribosome" },
    near: 0.72,
    secs: 8,
    steps: [
      { t: 0, yaw: 0.4 },
      { t: 3, tap: true },
    ],
  },
  "sci3-cryoem-capsid": {
    toy: "cryoem-map",
    options: { map: "aav" },
    near: 0.72,
    secs: 8,
    steps: [
      { t: 0, yaw: 0.3 },
      { t: 3, tap: true },
    ],
  },
  "sci3-cryoem-model": {
    toy: "cryoem-map",
    options: { map: "apoferritin", model: true },
    near: 0.72,
    secs: 7,
    steps: [{ t: 0, yaw: 0.45 }],
  },
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=${profile}&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const name of cards) {
  const card = CARDS[name];
  if (!card) throw new Error(`No card ${name}`);
  const files = {};
  for (const s of card.steps) if (s.file) files[s.file] = fs.readFileSync(s.file, "utf8");
  const frameDir = path.join(outDir, `${name}-frames`);
  if (framesOut) fs.mkdirSync(frameDir, { recursive: true });
  let frameNo = 0;
  await page.exposeFunction(`saveFrame_${name.replace(/\W/g, "_")}`, (data) => {
    fs.writeFileSync(path.join(frameDir, `${String(frameNo++).padStart(4, "0")}.jpg`), Buffer.from(data.split(",")[1], "base64")); // prettier-ignore
  });
  const { bytes, strip } = await page.evaluate(
    async ({ card, W, H, fps, stripN, bg, files, stripScale, framesOut, saver }) => {
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
      if (card.pitch !== undefined) cam.home.pitch = card.pitch;
      let yaw = cam.home.yaw;
      let yawRate = 0;
      let dist = cam.home.distance;
      let flight = null;
      const pose = () => {
        cam.cur = { ...cam.home, yaw, distance: dist };
        cam.tgt = { ...cam.home, yaw, distance: dist };
      };
      const panNow = () => cam.aim.map((v, i) => (v - cam.center[i]) / cam.radius);
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
          if (s.fly) {
            const f = s.fly;
            const to = f.point ? recipe().sciPoint(f.point) : f.to;
            const w = to ? toWorld(to) : null;
            const pan = w ? w.map((v, i) => (v - cam.center[i]) / cam.radius) : panNow();
            flight = { t0: time, secs: f.secs ?? 2, d0: dist, d1: (f.dist ?? 1) * cam.radius, p0: panNow(), p1: pan }; // prettier-ignore
          }
          if (s.opt) {
            const keep = cam.home.distance;
            await app.setToyOptions(s.opt);
            cam.home.distance = keep;
            pending = 0.05;
            await stage.captureFrame();
          }
          if (s.tap) player.act(s.tap === true ? null : toWorld(s.tap));
          if (s.file) {
            const opts = await recipe().input.read(files[s.file], s.file.split("/").pop());
            const keep = cam.home.distance;
            await app.setToyOptions(opts);
            // The rebuild resets the camera's home to the app's default
            // distance (the live view keeps its own); keep the card's framing.
            cam.home.distance = keep;
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
        if (flight) {
          const f = Math.max(0, Math.min(1, (time - flight.t0) / flight.secs));
          const sm = f * f * (3 - 2 * f);
          dist = flight.d0 * Math.pow(flight.d1 / flight.d0, sm);
          cam.setPan(
            flight.p0.map((v, i) => v + (flight.p1[i] - v) * sm),
            true,
          );
        }
        yaw += yawRate * step;
        pending = step;
        pose();
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        if (pickAt.has(n)) shots.push({ bmp: await createImageBitmap(c), t: time });
        if (framesOut) await window[saver](c.toDataURL("image/jpeg", 0.95));
        const rgba = c.getContext("2d").getImageData(0, 0, W, H).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay, repeat: 0 }); // prettier-ignore
      }
      gif.finish();
      cam.home.distance = homeDistance;
      cam.setPan(null, true);
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
    { card, W, H, fps, stripN, bg, files, stripScale, framesOut, saver: `saveFrame_${name.replace(/\W/g, "_")}` }, // prettier-ignore
  );
  const out = path.join(outDir, `${name}.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  if (strip) fs.writeFileSync(path.join(outDir, `${name}-strip.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${name}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
