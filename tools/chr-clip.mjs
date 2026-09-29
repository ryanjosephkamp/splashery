#!/usr/bin/env node
// Records clips of the Worlds character on its own patch of ground as
// looping GIFs (lane Character): a close-up turn, standing, walking and
// running from the side, three color sets, and the old character beside
// the new one. The clock is stepped by hand, so a clip moves at real speed
// however slow the renderer is. For the follow camera on the Test island,
// use tools/world-clip.mjs.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   git show origin/main:src/worlds/character.js > .cache/chr-old/character.js   (imports made absolute; before-after only)
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/chr-clip.mjs <out-dir> [--size=390x844] [--fps=12] [--dpr=2] [--count=64000] [--strip=8] closeup idle walk-side run-side colors before-after
//
// Writes <out-dir>/chr-<scene>.gif (and -strip.png with --strip).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";
import { PAGE } from "./chr-page.mjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...names] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !names.length) throw new Error("Usage: node tools/chr-clip.mjs <out-dir> scene ...");
const [W, H] = opt("size", "390x844").split("x").map(Number);
const fps = Number(opt("fps", 12));
const dpr = Number(opt("dpr", 2));
const count = Number(opt("count", 64000));
const stripN = Number(opt("strip", 0));

// The world file's colors for the color card: the Test island's, a
// second and a third set.
const LOOKS = [
  { shirt: "#e0533d", trousers: "#35507a", skin: "#c98e6a", hair: "#3a2a1e", shoes: "#2e2e33" },
  { shirt: "#2f7d6d", trousers: "#c8b89a", skin: "#8a5a3c", hair: "#141010", shoes: "#f2f0ea" },
  { shirt: "#f2d04a", trousers: "#2c2c30", skin: "#f0c8a8", hair: "#b8793e", shoes: "#8a2e2e" },
];

const rad = (d) => (d * Math.PI) / 180;
const orbit = (yaw, dist, h, target) => [
  [target[0] + Math.sin(rad(yaw)) * dist, h, target[2] + Math.cos(rad(yaw)) * dist],
  target,
];

// Each scene: { secs, figures: [{ look, old }], frame(t) -> { poses: [[state or "gait", time, at, facing]], cam: [pos, target], speeds } }.
// A "gait" pose uses the figure's own gait, stepped each frame at `speeds`.
const SCENES = {
  // A slow turn round the standing person, then down to the shoes, past
  // a hand and up to the face.
  closeup: {
    secs: 11,
    figures: [{}],
    frame: (t) => {
      // Camera keys: [time, yaw, distance, height, target height].
      const K = [
        [0, 20, 1.4, 1.05, 0.9],
        [6, 380, 1.4, 1.05, 0.9],
        [7.2, 400, 0.62, 0.3, 0.12],
        [8.4, 430, 0.55, 0.85, 0.82],
        [9.6, 380, 0.46, 1.64, 1.6],
        [11, 370, 0.44, 1.64, 1.6],
      ];
      let i = 0;
      while (i < K.length - 2 && t > K[i + 1][0]) i++;
      const u = Math.min(1, Math.max(0, (t - K[i][0]) / (K[i + 1][0] - K[i][0])));
      const e = i === 0 ? u : u * u * (3 - 2 * u);
      const k = K[i].map((x, j) => x + (K[i + 1][j] - x) * e);
      return { poses: [[{ speed: 0, phase: 0 }, t, [0, 0, 0], 0]], cam: orbit(k[1], k[2], k[3], [0, k[4], 0]) }; // prettier-ignore
    },
  },
  // Six seconds standing: breathing, a weight shift and a glance.
  idle: {
    secs: 6,
    figures: [{}],
    frame: (t) => ({ poses: [[{ speed: 0, phase: 0 }, t + 1.5, [0, 0, 0], 0]], cam: orbit(28, 1.55, 1.15, [0, 0.9, 0]) }), // prettier-ignore
  },
  // The follow camera on the Test island, then a side view on the ground
  // patch.
  walk: { island: { place: [-4, 14, 180], secs: 4.5, input: { x: 0, y: 1, amount: 1 } }, ...gaitScene(1.9, 3) }, // prettier-ignore
  run: { island: { place: [-4, 14, 180], secs: 3.5, input: { x: 0, y: 1, amount: 1, run: true } }, ...gaitScene(4.6, 2.5) }, // prettier-ignore
  "walk-side": gaitScene(1.9, 4),
  "run-side": gaitScene(4.6, 3),
  // Three color sets from a world file, standing.
  colors: {
    secs: 4,
    figures: LOOKS.map((look, i) => ({ look, at: [(i - 1) * 0.75, 0, 0] })),
    frame: (t) => ({
      poses: LOOKS.map((_, i) => [{ speed: 0, phase: 0 }, t + i * 2.3, [(i - 1) * 0.75, 0, 0], 0]),
      cam: orbit(10 * Math.sin(t * 0.8), 2.5, 1.2, [0, 0.95, 0]),
    }),
  },
  // The old character (main before this lane) beside the new one:
  // standing, then walking.
  "before-after": {
    secs: 6,
    labels: ["Before", "After"],
    figures: [{ old: true }, {}],
    frame: (t) => {
      const walk = Math.max(0, t - 2.4);
      const v = walk > 0 ? 1.9 : 0;
      const z = (1.9 * walk) % 1; // the tiles repeat every meter
      return {
        speeds: [v, v],
        poses: [
          ["gait", t, [-0.45, 0, z], 0],
          ["gait", t, [0.45, 0, z], 0],
        ],
        cam: orbit(0, 2.7, 1.2, [0, 0.9, z]),
      };
    },
  },
};

// Walking or running past a camera that tracks alongside.
function gaitScene(v, secs) {
  return {
    secs,
    figures: [{}],
    frame: (t) => {
      const z = (v * t) % 1; // the tiles repeat every meter, so the ground seems endless
      return {
        speeds: [v],
        poses: [["gait", t, [0, 0, z], 0]],
        cam: orbit(90, 2.5, 1.0, [0, 0.9, z]),
      };
    },
  };
}

// ---- Recording ------------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});

for (const name of names) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`No scene "${name}" (${Object.keys(SCENES).join(", ")}).`);
  const frames = [];
  if (scene.island) frames.push(...(await recordIsland(scene.island)));
  frames.push(...(await recordGround(scene)));
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (const { rgba, w, h } of frames) {
    const palette = quantize(rgba, 256, { format: "rgb565" });
    gif.writeFrame(applyPalette(rgba, palette, "rgb565"), w, h, { palette, delay, repeat: 0 });
  }
  gif.finish();
  const file = path.join(outDir, `chr-${name}.gif`);
  fs.writeFileSync(file, gif.bytes());
  console.log(`${file}: ${frames.length} frames, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  if (stripN > 1) writeStrip(frames, stripN, path.join(outDir, `chr-${name}-strip.png`));
}
await browser.close();

async function shoot(page) {
  const png = PNG.sync.read(await page.screenshot());
  const w = Math.round(png.width / dpr);
  const h = Math.round(png.height / dpr);
  return { rgba: shrink(png, w, h), w, h };
}

// The standalone character on its ground patch.
async function recordGround(scene) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr }); // prettier-ignore
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}chr-clip-page`);
  await page.setContent(PAGE("/src/worlds/character.js", "/.cache/chr-old/character.js"));
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => window.__chr.ground());
  if (scene.labels) await page.evaluate((l) => window.__chr.labels(l), scene.labels);
  for (const f of scene.figures)
    await page.evaluate(([f, n]) => window.__chr.build(f.look || {}, n, { old: !!f.old }), [f, f.old ? 54000 : count]); // prettier-ignore
  const frames = [];
  const n = Math.round(scene.secs * fps);
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const f = scene.frame(t);
    await page.evaluate(
      ([poses, cam, speeds, dt]) => {
        if (speeds) window.__chr.advance(dt, speeds);
        poses.forEach((p, k) => window.__chr.pose(p[0], p[1], p[2], p[3], k));
        window.__chr.cam(cam[0], cam[1]);
      },
      [f.poses, f.cam, f.speeds, 1 / fps],
    );
    await page.evaluate(() => window.__chr.frame());
    await page.evaluate(() => window.__chr.frame());
    frames.push(await shoot(page));
  }
  await ctx.close();
  return frames;
}

// The Test island with the Worlds page's own follow camera; the clock is
// stepped by hand (?clock=manual).
async function recordIsland(isl) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr }); // prettier-ignore
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}worlds/?labs=1&renderer=webgl2&profile=${opt("profile", "mid")}&clock=manual`); // prettier-ignore
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 300_000 }); // prettier-ignore
  await page.evaluate(() => window.__world.enter());
  await page.evaluate((p) => {
    window.__world.place(p[0], p[1], p[2]);
    window.__world.world.camera.snap(
      window.__world.world.focus(),
      window.__world.world.char.facing,
    );
  }, isl.place);
  for (let i = 0; i < 12; i++) await page.evaluate(() => window.__world.tick(0));
  const frames = [];
  const n = Math.round(isl.secs * fps);
  for (let i = 0; i < n; i++) {
    const input = i < n - Math.round(fps * 0.6) ? isl.input : null; // stops at the end
    await page.evaluate(([dt, input]) => window.__world.tick(dt, input), [1 / fps, input]);
    await page.evaluate(() => window.__world.tick(0));
    frames.push(await shoot(page));
  }
  await ctx.close();
  return frames;
}

// Box-filters an RGBA PNG down to w x h.
function shrink(png, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = png.width / w;
  const sy = png.height / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      let m = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          const i = (yy * png.width + xx) * 4;
          for (let k = 0; k < 4; k++) acc[k] += png.data[i + k];
          m++;
        }
      const o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = acc[k] / Math.max(1, m);
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
