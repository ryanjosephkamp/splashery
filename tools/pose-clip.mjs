#!/usr/bin/env node
// Lane Any pose: a toy's tap played upright, lying on its side and upside
// down, side by side, for judging whether an effect keeps working in any
// pose (docs/audits/poses-2026-10.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pose-clip.mjs <out-dir> [--size=240] [--secs=3] [--fps=12] [--strip=6] [--level1] [--poses=up,side,down] id[:secs] ...
//
// Writes <out-dir>/<id>-poses.gif (the poses side by side, the tap at the
// same moment in each) and, with --strip, <out-dir>/<id>-poses.png (one row
// per pose). Each pose is a Hands-on pose of the whole toy (Level 1, about
// its middle), set as a toss would leave it: the toy's entity is turned and
// lifted so it rests on the floor where it stood, and held there. --level1 plays a toy whose
// recipe has its own `hands` (pieces, ropes) as one whole body instead, as
// such toys played before they had pieces.

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
if (!outDir || !ids.length) throw new Error("Usage: node tools/pose-clip.mjs <out-dir> id ...");
const size = Number(opt("size", 240));
const secsAll = Number(opt("secs", 3));
const fps = Number(opt("fps", 12));
const stripN = Number(opt("strip", 0));
const level1 = args.includes("--level1");
const poses = opt("poses", "up,side,down").split(",");

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
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const spec of ids) {
  const [id, own] = spec.split(":");
  const secs = own ? Number(own) : secsAll;
  const { bytes, strip } = await page.evaluate(
    async ({ id, size, secs, fps, stripN, level1, poses }) => {
      const { app, player } = window.__splashery;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const { posePreset } = await import("/src/effects-pose.js");
      const stage = player.stage;
      const step = 1 / fps;
      const n = Math.round(secs / step);
      const rows = [];
      for (const which of poses) {
        await app.chooseToy(id);
        app.setLook({ background: "#111111" });
        player.opts.idleDelay = 1e9;
        player.idle.weight = 0;
        await new Promise((r) => setTimeout(r, 800));
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
        // The pose: Hands-on's whole-toy body turned and set down where it stood.
        const ho = player.handsOn;
        const hands = player.toyInfo.recipe?.hands;
        if (level1 && player.toyInfo.recipe) player.toyInfo.recipe.hands = undefined;
        if (which !== "up") {
          ho.setOn(true);
          ho.ensure();
          if (ho.mode === "toy") {
            const p = posePreset(ho, which);
            ho.body.pos = p.pos;
            ho.body.q = p.q;
            ho.moved = true;
            ho.apply();
            // Held still in that pose, so the poses compare frame by frame.
            ho.step = () => false;
          } else {
            // Pieces toys are never turned whole; shown turned anyway.
            const s = Math.SQRT1_2;
            const q = which === "side" ? [0, 0, s, s] : [1, 0, 0, 0];
            stage.setToyPose({ pivot: player.toyInfo.center, q, t: [0, 0, 0] });
          }
        }
        if (level1 && player.toyInfo.recipe) player.toyInfo.recipe.hands = hands;
        const frames = [];
        const grab = async () => {
          pending = step;
          home();
          await stage.captureFrame();
          pending = 0;
          const c = await stage.captureFrame();
          frames.push(await createImageBitmap(c));
        };
        pending = 0.5;
        await stage.captureFrame();
        await grab();
        player.act(null);
        for (let i = 1; i < n; i++) await grab();
        stage.setFixedSize(null);
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(...handlers);
        delete ho.step;
        ho.setOn(false);
        stage.setToyPose(null);
        rows.push({ which, frames });
      }
      const W = size * rows.length;
      const H = size + 16;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      const label = { up: "upright", side: "on its side", down: "upside down" };
      const gif = GIFEncoder();
      for (let f = 0; f < n; f++) {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, W, H);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#bbb";
        rows.forEach((r, i) => {
          ctx.drawImage(r.frames[f], i * size, 0, size, size);
          ctx.fillText(label[r.which] || r.which, i * size + 6, size + 12);
        });
        const rgba = ctx.getImageData(0, 0, W, H).data;
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), W, H, { palette, delay: Math.round(1000 / fps), repeat: 0 }); // prettier-ignore
      }
      gif.finish();
      let strip = null;
      if (stripN > 1) {
        const out = document.createElement("canvas");
        out.width = size * stripN;
        out.height = (size + 16) * rows.length;
        const sc = out.getContext("2d");
        sc.fillStyle = "#111";
        sc.fillRect(0, 0, out.width, out.height);
        sc.font = "12px sans-serif";
        sc.fillStyle = "#bbb";
        rows.forEach((r, j) => {
          for (let i = 0; i < stripN; i++) {
            const f = Math.min(n - 1, Math.round((i / (stripN - 1)) * (n - 1)));
            sc.drawImage(r.frames[f], i * size, j * (size + 16), size, size);
            sc.fillText(`${label[r.which] || r.which} ${(f * step).toFixed(1)}s`, i * size + 6, j * (size + 16) + size + 12); // prettier-ignore
          }
        });
        strip = out.toDataURL("image/png");
      }
      return { bytes: Array.from(gif.bytes()), strip };
    },
    { id, size, secs, fps, stripN, level1, poses },
  );
  const out = path.join(outDir, `${id}-poses.gif`);
  fs.writeFileSync(out, Buffer.from(bytes));
  if (strip) fs.writeFileSync(path.join(outDir, `${id}-poses.png`), Buffer.from(strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${id}: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
