#!/usr/bin/env node
// Records clips of a world (worlds/index.html) as looping GIFs, page text
// and all (the start screen, cards, the list and the thumb stick are part
// of the page, so every frame is a screenshot of the whole page). The
// world's clock is stepped by hand (?clock=manual), so a clip moves at real
// speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/world-clip.mjs <out-dir> [--world=test-island] [--size=390x844] [--fps=10] [--dpr=2] [--scale=0.5] [--profile=mid] [--strip=8] [--before=http://127.0.0.1:4174/] [--modes] [--render=hybrid] walk landmark touch list character island ground props sky hybrid-walk hybrid-shore hybrid-shadows hybrid-sky hybrid-depth
//
// --modes records each scene twice, splats mode on the left and hybrid
// mode on the right (?render=); --render= picks one mode for a plain clip.
// --left=<query> --right=<query> [--labels=A,B] records any two variants
// side by side (the character A/B: --left=&render=hybrid&character=splats
// --right=&render=hybrid&character=mesh --labels=Splats,Mesh).
//
// Writes <out-dir>/wd-<name>.gif (and -strip.png with --strip). The
// scenes are scripted below; each is a list of steps: walk with an input
// for some seconds, drag to look, tap, press buttons, hold still.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...names] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !names.length)
  throw new Error("Usage: node tools/world-clip.mjs <out-dir> scene ...");
const [W, H] = opt("size", "390x844").split("x").map(Number);
const fps = Number(opt("fps", 10));
const dpr = Number(opt("dpr", 2));
const scale = Number(opt("scale", 1 / dpr));
const world = opt("world", "test-island");
const profile = opt("profile", "mid");
const stripN = Number(opt("strip", 0));
const before = opt("before", "");
const modes = args.includes("--modes");
const render = opt("render", "");
const left = opt("left", "");
const right = opt("right", "");
const labels = opt("labels", "A,B").split(",");

// ---- Scenes ---------------------------------------------------------------------

const SCENES = {
  // Walking round the island: a walk, a look round, a run along the beach,
  // then the camera pulls back for a wide view.
  walk: [
    { place: [-4, 14, 180] },
    { hold: 0.6 },
    { move: { y: 1 }, secs: 2.2 },
    { move: { y: 1 }, look: [0.9, 0], secs: 1.4 },
    { move: { y: 1, run: true }, secs: 2.4 },
    { move: { y: 1, x: -0.5, run: true }, secs: 1.2 },
    { hold: 0.8 },
    { camera: { distance: 13, pitch: 0.75 }, secs: 1.6 },
  ],
  // Walking up to a sign: its card opens as page text.
  landmark: [
    { place: [-11, 6, 270] },
    { hold: 0.5 },
    { move: { y: 1 }, until: "card", secs: 6 },
    { move: { y: 0.5 }, secs: 0.5 },
    { hold: 2.4 },
  ],
  // The phone controls: the thumb stick walks, a drag on the right looks,
  // a tap on a sign opens its card.
  touch: [
    { place: [7, 19.5, 125], touch: true },
    { hold: 0.6 },
    { stick: [0, 0.7], secs: 1.4 },
    { stick: [0.45, 0.6], secs: 0.8 },
    { stick: [0, 0], drag: [110, 0], secs: 1.0 },
    { drag: [-110, 0], secs: 1.0 },
    { hold: 0.3 },
    { tapSign: "boulders", hold: 2.4 },
  ],

  // The character close up: a walk and a run seen from the side, then
  // standing (idle) while the camera comes round to its face.
  character: [
    { place: [-7, 3, 180], camera: { distance: 1.55, pitch: 0.06 } },
    { hold: 0.6 },
    { move: { x: 1 }, secs: 2.4 },
    { move: { x: 1, run: true }, secs: 1.8 },
    { hold: 1.0 },
    { look: [1.6, 0], secs: 2.2 },
    { hold: 1.2 },
  ],

  // Round 2 (a sharper island): a walk along the shore.
  island: [
    { place: [-23, -9, 0], camera: { distance: 5.2, pitch: 0.3 } },
    { hold: 0.5 },
    { move: { y: 1 }, secs: 3.2 },
    { move: { y: 1 }, look: [-0.7, 0], secs: 2.4 },
    { hold: 0.6 },
  ],
  // The ground and grass up close.
  ground: [
    { place: [-6, 4, 150], camera: { distance: 2.6, pitch: 0.72 } },
    { hold: 0.5 },
    { move: { y: 0.6 }, secs: 3 },
    { look: [0.8, -0.3], secs: 2 },
    { hold: 0.5 },
  ],
  // Walking past the props: the oak, the mushrooms, a pine, bushes.
  props: [
    { place: [-16, 1, 90], camera: { distance: 4.2, pitch: 0.22 } },
    { hold: 0.5 },
    { move: { y: 1 }, secs: 4.5 },
    { move: { y: 1 }, look: [0.6, 0], secs: 2.5 },
    { hold: 0.5 },
  ],
  // The aerial view behind the start screen, without the screen.
  sky: [{ start: true, overview: true, hold: 5 }],

  // Hybrid (lit models for the ground, water and sky; splats for the rest),
  // recorded with --modes: the west beach walk.
  "hybrid-walk": [
    { place: [-26, -12, 10], camera: { distance: 5.2, pitch: 0.3 } },
    { hold: 0.5 },
    { move: { y: 1 }, secs: 3 },
    { move: { y: 1 }, look: [-0.8, 0], secs: 2.4 },
    { move: { y: 1, run: true }, secs: 1.6 },
    { hold: 0.6 },
  ],
  // Water and sand up close: into the shallows and back out.
  "hybrid-shore": [
    { place: [-28, 1, 270], camera: { distance: 3.4, pitch: 0.34 } },
    { hold: 0.5 },
    { move: { y: 0.6 }, secs: 2.6 },
    { look: [1.2, 0], secs: 1.8 },
    { move: { y: -0.6 }, secs: 1.6 },
    { hold: 0.6 },
  ],
  // The sun's shadows: the character and the props cast them.
  "hybrid-shadows": [
    { place: [-7, -1, 225], camera: { distance: 5.5, pitch: 0.62 } },
    { hold: 0.5 },
    { move: { y: 1 }, secs: 2.6 },
    { move: { x: 1 }, secs: 1.8 },
    { look: [1.1, 0], secs: 1.8 },
    { hold: 0.6 },
  ],
  // A slow look round at the sky and the far hills.
  "hybrid-sky": [
    { place: [12, 14, 0], camera: { distance: 4.5, pitch: -0.12 } },
    { hold: 0.4 },
    { look: [Math.PI * 1.2, 0], secs: 6 },
    { hold: 0.4 },
  ],
  // The character, the same walk (recorded with --left and --right): idle,
  // a walk away, a walk across (its profile), a run, then it walks back
  // toward the camera.
  "hybrid-character": [
    { place: [-4, 14, 180], camera: { distance: 3.4, pitch: 0.16 }, noCards: true },
    { hold: 1.0 },
    { move: { y: 1 }, secs: 2.0 },
    { move: { x: 1 }, secs: 2.2 },
    { move: { x: 1, run: true }, secs: 1.4 },
    { move: { y: -1 }, secs: 1.6 },
    { hold: 1.0 },
  ],
  // Depth, close up: a bush half behind a hill, then the character wading.
  "hybrid-depth": [
    { place: [-17.2, 0.8, 180], camera: { distance: 3.2, pitch: 0.08 } },
    { hold: 0.4 },
    { move: { y: 0.5 }, secs: 1.6 },
    { hold: 0.4 },
    { place: [-30.2, -2, 90], camera: { distance: 3, pitch: 0.22 } },
    { hold: 0.4 },
    { move: { y: -0.5 }, secs: 1.4 },
    { look: [0.9, 0], secs: 1.6 },
    { hold: 0.4 },
  ],
  // The start screen over the wide view, the plain list, and "Go there".
  list: [
    { start: true, hold: 2.2 },
    { click: "#start-list", hold: 2.4 },
    { scroll: "#places", hold: 1.2 },
    { clickGo: "lookout", hold: 2.6 },
  ],
};

// ---- Recording ------------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});

// Records a scene on the page at `url` (a Splashery root); returns its
// frames. `tag` labels every frame ("Before", "After").
async function record(scene, url, tag = null, query = "") {
  const touch = scene.some((s) => s.touch);
  // Drawn at twice the size and shrunk, like a phone's sharp screen.
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch }); // prettier-ignore
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(
    `${url}worlds/?labs=1&renderer=webgl2&profile=${profile}&clock=manual&world=${world}${query}`,
  );
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 240_000 }); // prettier-ignore
  if (tag)
    await page.evaluate((tag) => {
      const d = document.createElement("div");
      d.textContent = tag;
      d.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);padding:6px 16px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font:600 17px system-ui,sans-serif;z-index:99"; // prettier-ignore
      document.body.append(d);
    }, tag);
  const dt = 1 / fps;
  const frames = [];
  let finger = null;
  const shoot = async () => {
    const png = PNG.sync.read(await page.screenshot());
    const w = Math.round(png.width * scale);
    const h = Math.round(png.height * scale);
    const rgba = shrink(png, w, h);
    frames.push({ rgba, w, h });
  };
  // One frame: the world steps dt with this input, then a screenshot.
  const tick = async (input = null) => {
    await page.evaluate(({ dt, input }) => window.__world.tick(dt, input), { dt, input });
    await page.evaluate(() => window.__world.tick(0));
    await shoot();
  };
  const setFinger = async (p) => {
    finger = p;
    await page.evaluate((p) => {
      let f = document.getElementById("clip-finger");
      if (!f) {
        f = document.createElement("div");
        f.id = "clip-finger";
        f.style.cssText =
          "position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.35);pointer-events:none;z-index:99";
        document.body.append(f);
      }
      f.hidden = !p;
      if (p) {
        f.style.left = `${p[0]}px`;
        f.style.top = `${p[1]}px`;
      }
    }, p);
  };
  // noCards: landmark cards stay closed (the scene is about something else).
  if (scene.some((s) => s.noCards)) await page.evaluate(() => (window.__world.page.openCard = () => {})); // prettier-ignore
  // A scene that shows the start screen enters only through its buttons.
  let started = scene.some((s) => s.start);
  for (const s of scene) {
    if (!started) {
      await page.evaluate(() => window.__world.enter());
      started = true;
    }
    // The camera's distance and tilt first, so a new place starts with them.
    if (s.camera)
      await page.evaluate((c) => Object.assign(window.__world.world.camera, c), s.camera);
    if (s.place) {
      await page.evaluate((p) => {
        window.__world.place(p[0], p[1], p[2]);
        window.__world.world.camera.snap(
          window.__world.world.focus(),
          window.__world.world.char.facing,
        );
      }, s.place);
      // Let the level of detail catch up before the first frame.
      for (let i = 0; i < 12; i++) await page.evaluate(() => window.__world.tick(0));
    }
    if (s.touch) {
      await page.evaluate(() => {
        document.getElementById("stick").hidden = false;
        const h = document.querySelector(".only-keys");
        if (h) h.style.display = "none";
        const t = document.querySelector(".only-touch");
        if (t) t.style.display = "inline";
      });
    }
    if (s.overview)
      await page.evaluate(() => {
        document.getElementById("start").hidden = true;
        window.__world.world.overview = true;
        window.__world.catchUp();
      });
    if (s.click) await page.click(s.click);
    if (s.scroll) await page.evaluate((sel) => document.querySelector(sel).scrollBy(0, 400), s.scroll); // prettier-ignore
    if (s.clickGo) await page.click(`#places-list li[data-landmark="${s.clickGo}"] button`);
    if (s.tapSign) {
      const pt = await page.evaluate((id) => {
        const w = window.__world.world;
        const sgn = w.signs.find((x) => x.landmark.id === id);
        const p = w.view.toScreen([sgn.pos[0], sgn.pos[1] + 1.6, sgn.pos[2]]);
        return [p[0], p[1]];
      }, s.tapSign);
      await setFinger(pt);
      await page.touchscreen.tap(pt[0], pt[1]);
    }
    const secs = s.secs ?? s.hold ?? 0;
    const n = Math.max(1, Math.round(secs * fps));
    for (let i = 0; i < n; i++) {
      if (s.look) await page.evaluate(([a, b]) => window.__world.world.camera.look(a, b), [s.look[0] / n, s.look[1] / n]); // prettier-ignore
      if (s.drag) {
        const x = W * 0.72 + (s.drag[0] * i) / n;
        await setFinger([x, H * 0.45]);
        await page.evaluate((d) => window.__world.world.camera.look(-d * 0.0065, 0), s.drag[0] / n);
      }
      if (s.stick) {
        const on = s.stick[0] || s.stick[1];
        await page.evaluate((v) => {
          const c = window.__world.page.controls;
          c.stickVec = v;
          const R = 64;
          c.knob.style.transform = `translate(${v[0] * R * 0.55}px, ${-v[1] * R * 0.55}px)`;
        }, s.stick);
        if (on) {
          const r = await page.evaluate(() => document.getElementById("stick").getBoundingClientRect().toJSON()); // prettier-ignore
          await setFinger([
            r.x + r.width / 2 + s.stick[0] * 35,
            r.y + r.height / 2 - s.stick[1] * 35,
          ]);
        } else if (!s.drag) await setFinger(null);
      }
      const input = s.move || (s.stick && (s.stick[0] || s.stick[1]) ? { x: s.stick[0], y: s.stick[1], run: Math.hypot(...s.stick) > 0.92 } : null); // prettier-ignore
      await tick(input);
      if (s.until === "card" && (await page.evaluate(() => window.__world.card()))) break;
    }
    if (s.tapSign) await setFinger(null);
  }
  await ctx.close();
  return frames;
}

for (const name of names) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`No scene "${name}" (${Object.keys(SCENES).join(", ")}).`);
  let frames;
  if (left && right)
    frames = sideBySide(await record(scene, base, labels[0], left), await record(scene, base, labels[1], right)); // prettier-ignore
  else if (modes)
    frames = sideBySide(await record(scene, base, "Splats", "&render=splats"), await record(scene, base, "Hybrid", "&render=hybrid")); // prettier-ignore
  else {
    const q = render ? `&render=${render}` : "";
    frames = await record(scene, base, before ? "After" : null, q);
    // --before=<url>: the same scene on another build, side by side.
    if (before) frames = sideBySide(await record(scene, before, "Before", q), frames);
  }
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (const f of frames) {
    const palette = quantize(f.rgba, 256, { format: "rgb565" });
    gif.writeFrame(applyPalette(f.rgba, palette, "rgb565"), f.w, f.h, { palette, delay, repeat: 0 }); // prettier-ignore
  }
  gif.finish();
  const file = path.join(outDir, `wd-${name}.gif`);
  fs.writeFileSync(file, gif.bytes());
  console.log(`${file}: ${frames.length} frames, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  if (stripN > 1) writeStrip(frames, stripN, path.join(outDir, `wd-${name}-strip.png`));
}
await browser.close();

// Two runs of a scene, frame by frame, left and right.
function sideBySide(left, right) {
  const n = Math.min(left.length, right.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = left[i];
    const b = right[i];
    const w = a.w + b.w;
    const h = Math.min(a.h, b.h);
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      rgba.set(a.rgba.subarray(y * a.w * 4, (y + 1) * a.w * 4), y * w * 4);
      rgba.set(b.rgba.subarray(y * b.w * 4, (y + 1) * b.w * 4), (y * w + a.w) * 4);
    }
    out.push({ rgba, w, h });
  }
  return out;
}

// Box-filters an RGBA PNG down to w x h.
function shrink(png, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = png.width / w;
  const sy = png.height / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          const i = (yy * png.width + xx) * 4;
          for (let k = 0; k < 4; k++) acc[k] += png.data[i + k];
          n++;
        }
      const o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = acc[k] / Math.max(1, n);
    }
  return out;
}

function writeStrip(frames, n, file) {
  const { w, h } = frames[0];
  const pick = Array.from({ length: n }, (_, i) => frames[Math.round((i / (n - 1)) * (frames.length - 1))]); // prettier-ignore
  const png = new PNG({ width: w * n, height: h });
  pick.forEach((f, i) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4;
        const d = (y * w * n + i * w + x) * 4;
        for (let k = 0; k < 4; k++) png.data[d + k] = f.rgba[s + k];
      }
  });
  fs.writeFileSync(file, PNG.sync.write(png));
}
