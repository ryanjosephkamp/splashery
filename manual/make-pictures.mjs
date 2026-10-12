#!/usr/bin/env node
// Takes the real pictures on the manual's "What else Splashery does now" and "What Splashery can do"
// pages (manual/img/pic-*.webp). Each is the app itself, drawn by the same renderer as the site:
// no mockups. A picture is one entry in PICTURES below: one or more panels (a toy, its options, and
// the steps to play before each shot), laid side by side. To add a picture to an item, add an entry
// here, run this file, and add a <figure class="item-pic"> to the page (see the comment at the top
// of manual/unique.html).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node manual/make-pictures.mjs [file ...]
//
// With file names (for example `more-qr`), only those are taken. Steps are played in order:
//   { "wait": 1.2 }      seconds with nothing done (the clock is stepped by hand, so it is exact)
//   { "tap": [x, y, z] } a tap on the toy at that place (recipe coordinates); no place: its own tap
//   { "drag": [[x, y, z], ...], "secs": 0.6, "hold": 0.2 }   press, move, hold, let go (a toy's own drag)
//   { "toss": [[x, y, z], ...], "secs": 0.4 }   Hands-on: pick the toy up at the first point, drag, let go
//   { "shot": true }     takes a picture at this moment (a panel with no shot step takes one at the end)
// A panel's `cam` is [turn, lift, zoom]: degrees added to the home view, and a distance factor.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const OUT = new URL("./img/", import.meta.url).pathname;
const W = 600;
const H = 360;
const BG = "#14161c";

export const PICTURES = [
  // What else Splashery does now (more.html)
  { file: "pic-more-physics", size: [320, 320], panels: [{ toy: "basketball", cam: [0, 0, 1.25], steps: [{ wait: 0.8 }, { shot: true }, { toss: [[0, 0, 0], [0.3, 0.5, 0], [0.9, 1.2, 0]], secs: 0.3 }, { wait: 0.25 }, { shot: true }, { wait: 0.6 }, { shot: true }] }] }, // prettier-ignore
  { file: "pic-more-qr", size: [360, 360], panels: [{ toy: "qr-code" }] },
  { file: "pic-more-captures", size: [360, 360], panels: [{ toy: "marble-bust" }, { toy: "wooden-elephant" }] },
  { file: "pic-more-live", size: [360, 360], panels: [{ toy: "room-echo" }, { toy: "splat-mirror" }] },
  { file: "pic-more-books", size: [320, 320], panels: [{ toy: "your-book" }, { toy: "photo-album" }, { toy: "picture-frame" }] },
  { file: "pic-more-studio", size: [320, 320], panels: [{ toy: "chladni-plate", steps: [{ tap: true }, { wait: 4 }, { shot: true }] }, { toy: "photo-3d" }] },
  { file: "pic-more-models", size: [360, 360], panels: [{ toy: "model-splats" }] },
  { file: "pic-more-worlds", page: "worlds" },
  { file: "pic-more-fluids", size: [360, 360], panels: [{ toy: "fluid-lab" }, { toy: "grand-piano" }] },
  { file: "pic-more-looks", size: [320, 320], panels: [{ toy: "splat-equation", opt: { preset: "seashell", splats: "solid" } }, { toy: "splat-equation", opt: { preset: "seashell", splats: "fine" } }, { toy: "splat-equation", opt: { preset: "seashell", splats: "dots" } }] }, // prettier-ignore
  { file: "pic-more-viewer", page: "app", toy: "splat-equation" },
  // What Splashery can do that other splat tools can't (unique.html)
  { file: "pic-uq-rules", size: [320, 320], panels: [{ toy: "cactus" }, { toy: "strawberry" }, { toy: "knot" }] },
  { file: "pic-uq-equations", size: [320, 320], panels: [{ toy: "splat-equation", opt: { preset: "klein" } }, { toy: "splat-equation", opt: { preset: "trefoil" } }, { toy: "splat-equation", opt: { preset: "galaxy" } }] }, // prettier-ignore
  { file: "pic-uq-moving", size: [320, 320], panels: [{ toy: "chest", steps: [{ wait: 0.5 }, { shot: true }, { tap: true }, { wait: 0.7 }, { shot: true }, { wait: 1.5 }, { shot: true }] }] }, // prettier-ignore
  { file: "pic-uq-physics", size: [320, 320], panels: [{ toy: "rubber-duck", cam: [0, 0, 1.25], steps: [{ wait: 0.8 }, { shot: true }, { toss: [[0, 0, 0], [0.3, 0.5, 0], [0.9, 1.2, 0]], secs: 0.3 }, { wait: 0.25 }, { shot: true }, { wait: 0.6 }, { shot: true }] }] }, // prettier-ignore
  { file: "pic-uq-anything", size: [320, 320], panels: [{ toy: "photo-3d" }, { toy: "night-sky" }, { toy: "volume-viewer" }] },
]; // prettier-ignore

const only = process.argv.slice(2);
const todo = PICTURES.filter((p) => !only.length || only.includes(p.file));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, reducedMotion: "no-preference" }); // prettier-ignore
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=strong&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

// A picture of a whole page, not one toy: the app with its panels, or the Worlds.
async function otherPage(spec) {
  const pg = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  pg.on("pageerror", (e) => console.error("page error:", e.message));
  const png = path.join(OUT, `${spec.file}.png`);
  if (spec.page === "worlds") {
    await pg.goto(`${base}worlds/?labs=1&renderer=webgl2&profile=mid&clock=manual`);
    await pg.waitForFunction(() => document.body.dataset.ready, null, { timeout: 300_000 });
    await pg.evaluate(() => window.__world.enter());
    await pg.evaluate(() => window.__world.catchUp());
    // Walk a little, so the character is mid-stride.
    for (let i = 0; i < 20; i++) await pg.evaluate(() => window.__world.tick(1 / 15, { x: 0, y: 1, amount: 1 })); // prettier-ignore
    await pg.screenshot({ path: png });
  } else {
    await pg.goto(`${base}?renderer=webgl2&profile=strong&adapt=off&labs=1`);
    await pg.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await pg.evaluate(async (toy) => {
      await window.__splashery.app.chooseToy(toy);
    }, spec.toy);
    await pg.waitForTimeout(4000);
    await pg.screenshot({ path: png });
  }
  await pg.close();
  save(spec.file, png, 720);
}
function save(file, png, width) {
  const webp = png.replace(/\.png$/, ".webp");
  execFileSync("python3", ["-I", "-c", "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB');w=int(sys.argv[3]);im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS) if im.width>w else im;im.save(sys.argv[2],'WEBP',quality=80,method=6)", png, webp, String(width)]); // prettier-ignore
  fs.unlinkSync(png);
  console.log(`${file}.webp (${(fs.statSync(webp).size / 1024).toFixed(0)} KB)`);
}

for (const spec of todo) {
  if (spec.page) {
    await otherPage(spec);
    continue;
  }
  const [w, h] = spec.size || [W, H];
  const url = await page.evaluate(
    async ({ spec, w, h, bg }) => {
      const { app, player } = window.__splashery;
      const shots = [];
      for (const panel of spec.panels) {
        await app.chooseToy(panel.toy);
        for (const [k, v] of Object.entries(panel.opt || {})) await app.setToyOption(k, v);
        app.setLook({ background: bg });
        player.opts.idleDelay = 1e9;
        player.idle.weight = 0;
        await new Promise((r) => setTimeout(r, 2500));
        const stage = player.stage;
        const handlers = stage.updateHandlers.slice();
        let pending = 0;
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(() => {
          const d = pending;
          pending = 0;
          for (const hd of handlers) hd(d);
        });
        stage.setFixedSize([w * 2, h * 2]);
        const home = { ...player.camera.home };
        const cam = panel.cam || [0, 0, 1];
        Object.assign(home, { yaw: home.yaw + cam[0], pitch: home.pitch + cam[1] });
        home.distance *= cam[2];
        const hold = () => {
          player.camera.cur = { ...home };
          player.camera.tgt = { ...home };
        };
        const step = 1 / 15;
        const frame = async () => {
          pending = step;
          hold();
          await stage.captureFrame();
          pending = 0;
          return stage.captureFrame();
        };
        const take = async () => {
          for (let i = 0; i < 4; i++) await frame();
          const c = await frame();
          shots.push(await createImageBitmap(c));
        };
        pending = 0.5;
        hold();
        await stage.captureFrame();
        const steps = panel.steps || [{ shot: true }];
        let shotAny = false;
        for (const s of steps) {
          if (s.wait) for (let t = 0; t < s.wait - 1e-6; t += step) await frame();
          else if (s.tap) {
            player.act(s.tap === true ? null : player.fromRecipe(s.tap));
            await frame();
          } else if (s.shot) {
            await take();
            shotAny = true;
          } else if (s.toss) {
            // Hands-on: press on the first point, drag along the rest, let go (a quick let-go tosses it).
            const pts = s.toss;
            const hands = player.handsOn;
            hands.setOn(true);
            hands.pressAt(player.fromRecipe(pts[0]), ...player.screenPoint(pts[0]));
            await frame();
            const n = Math.max(1, Math.round((s.secs ?? 0.4) / step));
            for (let i = 1; i <= n; i++) {
              const f = Math.min(pts.length - 1, (i / n) * (pts.length - 1));
              const j = Math.min(pts.length - 2, Math.floor(f));
              const p = pts[j].map((v, c) => v + (pts[j + 1][c] - v) * (f - j));
              hands.moveTo(...player.screenPoint(p));
              await frame();
            }
            hands.release();
          } else if (s.drag) {
            const pts = s.drag;
            const at = (u) => {
              const f = Math.min(pts.length - 1, u * (pts.length - 1));
              const i = Math.min(pts.length - 2, Math.floor(f));
              const k = f - i;
              return pts[i].map((v, j) => v + (pts[i + 1][j] - v) * k);
            };
            let finger = player.screenPoint(pts[0]);
            player.grabStart(player.fromRecipe(pts[0]), ...finger);
            await frame();
            const n = Math.max(1, Math.round((s.secs ?? 0.6) / step));
            for (let i = 1; i <= n; i++) {
              finger = player.screenPoint(at(i / n));
              player.grabAt(...finger);
              await frame();
            }
            for (let t = 0; t < (s.hold ?? 0) - 1e-6; t += step) await frame();
            player.grabEnd();
          }
        }
        if (!shotAny) await take();
        stage.setFixedSize(null);
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(...handlers);
      }
      const out = document.createElement("canvas");
      out.width = w * shots.length;
      out.height = h;
      const g = out.getContext("2d");
      g.imageSmoothingQuality = "high";
      shots.forEach((b, i) => g.drawImage(b, i * w, 0, w, h));
      return out.toDataURL("image/png");
    },
    { spec, w, h, bg: BG },
  );
  const png = path.join(OUT, `${spec.file}.png`);
  fs.writeFileSync(png, Buffer.from(url.split(",")[1], "base64"));
  save(spec.file, png, 1100);
}
await browser.close();
