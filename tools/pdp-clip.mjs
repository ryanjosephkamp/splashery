#!/usr/bin/env node
// Lane Photo depth (October 9, 2026): clips for the Effect review page, at phone size.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pdp-clip.mjs <out.mp4> <mode> [options]
//
// Modes:
//   rise    Photo to 3D in the Sharp picture: the tap's rise (3.2 s), a pause, and the flatten,
//           frame by frame at the toy's real speed (the "flat" control stepped as the tap eases it,
//           so the toy's own sway runs too). --photo=<sample id>|portrait (the synthetic portrait
//           of tests/pdp-portrait.mjs), --depth=0.7, --view=sharp|splats.
//   slider  the depth slider over the stage dragged to the left and back, closed, its small
//           button dragged, and opened again (a finger dot shows the touch). --wide: at 1440 x 900
//           (drawn at half size), going into full screen and out.
//   sound   the Sound choice in the Toy tab, each choice picked in turn, with its sound in the
//           clip (rendered offline through the voices, as the site plays them).
// Common: --label="…" (a tag in the corner), --fps=15, --dpr=2, --profile=mid. SPLASHERY_URL
// points it at another server (a checkout of main, for the "before" clips).

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const flag = (name) => args.includes(`--${name}`);
const [out, mode = "rise"] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/pdp-clip.mjs <out.mp4> rise|slider|sound [options]");
const fps = Number(opt("fps", 15));
const dpr = Number(opt("dpr", 2));
const label = opt("label", "");
const wide = flag("wide");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const ffmpeg = process.env.FFMPEG || "ffmpeg";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const view = wide ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const page = await browser.newPage({ viewport: view, deviceScaleFactor: wide ? 1 : dpr });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&adapt=off&profile=${opt("profile", "mid")}&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

const ready = () =>
  page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 180_000 }); // prettier-ignore

async function tag(text) {
  if (!text) return;
  await page.evaluate((text) => {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99;padding:5px 10px;border-radius:14px;background:rgba(20,22,26,.78);color:#fff;font:600 13px/1.2 system-ui,sans-serif;pointer-events:none"; // prettier-ignore
    document.body.append(d);
  }, text);
}

// The finger: a white dot that follows the mouse.
async function finger() {
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "pdp-finger";
    d.style.cssText = "position:fixed;z-index:100;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none;display:none"; // prettier-ignore
    document.body.append(d);
    addEventListener("pointermove", (e) => Object.assign(d.style, { left: `${e.clientX}px`, top: `${e.clientY}px`, display: "block" }), true); // prettier-ignore
  });
}

function encoder(file, audio) {
  const a = audio ? ["-i", audio, "-c:a", "aac", "-b:a", "128k", "-shortest"] : [];
  const ff = spawn(
    ffmpeg,
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", ...a,
      "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", "-vf", `scale=${wide ? "720:-2" : "trunc(iw/2)*2:trunc(ih/2)*2"}`, "-movflags", "+faststart", file], // prettier-ignore
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res()))); // prettier-ignore
  return {
    async frame() {
      const png = await page.screenshot({ type: "png" });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    },
    async end() {
      ff.stdin.end();
      await done;
    },
  };
}

if (mode === "rise") {
  const photo = opt("photo", "still-life");
  await page.evaluate(async (photo) => {
    const { app, player } = window.__splashery;
    if (photo === "portrait") {
      const { usePhoto } = await import("/src/packs/photo-3d.js");
      const { portrait } = await import("/tests/pdp-portrait.mjs");
      const p = portrait();
      usePhoto(p.photo, p.depth, "Synthetic portrait");
    }
    await app.chooseToy("photo-3d");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  }, photo);
  await ready();
  await page.evaluate(
    ([source, depth]) => window.__splashery.app.setToyOptions({ source, depth }),
    [photo === "portrait" ? "custom" : photo, Number(opt("depth", 0.7))],
  );
  await page.waitForFunction((s) => {
    const d = window.__splashery.player.proc?.ctx?.kit?.data?.photo;
    return d && !window.__splashery.player.loading && (s === "portrait" ? d.custom : !d.custom);
  }, photo, { timeout: 180_000 }); // prettier-ignore
  await page.evaluate((v) => window.__psv.set("photo-3d", v), opt("view", "sharp"));
  await page.keyboard.press("f");
  await page.evaluate(() => window.__splashery.player.camera.reset());
  await page.waitForTimeout(2500);
  await tag(label);
  const enc = encoder(out);
  // flat: 1 for 0.4 s, down to 0 over 3.2 s (the tap's ease), 0.8 s up, back to 1 over 3.2 s, 0.6 s
  const T = [0.4, 3.2, 0.8, 3.2, 0.6];
  const total = T.reduce((a, b) => a + b, 0);
  const n = Math.round(total * fps);
  for (let k = 0; k < n; k++) {
    const t = k / fps;
    let f = 1;
    if (t < T[0]) f = 1;
    else if (t < T[0] + T[1]) f = 1 - (t - T[0]) / T[1];
    else if (t < T[0] + T[1] + T[2]) f = 0;
    else if (t < total - T[4]) f = (t - T[0] - T[1] - T[2]) / T[3];
    await page.evaluate(async (f) => {
      const pl = window.__splashery.player;
      pl.motion.setControl("flat", f, { snap: true });
      pl.camera.tgt.yaw = pl.camera.cur.yaw = 0;
      pl.stage.requestRender();
      for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    }, f);
    await enc.frame();
    if (k % 15 === 0) process.stdout.write(`frame ${k} of ${n}\r`);
  }
  await enc.end();
}

if (mode === "slider") {
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("photo-3d");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  });
  await ready();
  await page.evaluate(() => {
    try {
      localStorage.removeItem("splashery.stageDialPos");
    } catch {}
  });
  await page.evaluate(() => window.__splashery.app.act());
  await page.waitForTimeout(4000);
  await finger();
  await tag(label);
  const enc = encoder(out);
  const hold = async (s) => {
    for (let i = 0; i < Math.round(s * fps); i++) await enc.frame();
  };
  const center = (sel) =>
    page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }, sel);
  const glide = async (from, to, s, down = true) => {
    await page.mouse.move(from[0], from[1]);
    if (down) await page.mouse.down();
    const n = Math.round(s * fps);
    for (let i = 1; i <= n; i++) {
      const e = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
      await page.mouse.move(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e);
      await enc.frame();
    }
    if (down) await page.mouse.up();
  };
  const stage = await page.evaluate(() => {
    const r = document.getElementById("stage").getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await hold(0.8);
  const grip = await center("#stage-dial-label");
  const left = [stage.x + stage.w * 0.14, stage.y + stage.h * (wide ? 0.55 : 0.62)];
  await glide(grip, left, 1.4);
  await hold(0.6);
  if (wide) {
    // into full screen: it keeps its place on the stage; out again
    await page.evaluate(() => document.getElementById("focus-toggle").click());
    await hold(1.6);
    const g = await center("#stage-dial-label");
    await glide(g, [g[0] + 260, g[1] - 120], 1.2);
    await hold(0.8);
    await page.keyboard.press("Escape");
    await hold(1.4);
  } else {
    // closed: its small button stays there, and moves too
    const x = await center("#stage-dial-hide");
    await page.mouse.move(x[0], x[1]);
    await hold(0.3);
    await page.locator("#stage-dial-hide").click();
    await hold(0.8);
    const b = await center("#stage-dial-show");
    await glide(b, [stage.x + stage.w * 0.5, stage.y + stage.h * 0.82], 1.2);
    await hold(0.6);
    const b2 = await center("#stage-dial-show");
    await page.mouse.move(b2[0], b2[1]);
    await page.locator("#stage-dial-show").click();
    await hold(1.0);
  }
  // a double-click puts it back
  const g2 = await center("#stage-dial-label");
  await page.mouse.move(g2[0], g2[1]);
  await hold(0.3);
  await page.mouse.dblclick(g2[0], g2[1]);
  await hold(1.2);
  await enc.end();
}

if (mode === "sound") {
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("photo-3d");
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  });
  await ready();
  const { DEPTH_SOUNDS } = await import(path.resolve("src/packs/photo-3d.js"));
  const order = DEPTH_SOUNDS.map((x) => x.id);
  const each = 4.4; // seconds per choice: the pick, the tap (the depth rises)
  // The sound: each choice's rise, rendered offline through the voices, one after another.
  const wav = await page.evaluate(
    async ([order, each]) => {
      const { depthSound } = await import("/src/packs/photo-3d.js");
      const { toySound } = await import("/src/toy-sounds.js");
      const { playSpec, specFor, loadSamples } = await import("/src/voices.js");
      const rate = 44100;
      const secs = order.length * each + 0.5;
      const ctx = new OfflineAudioContext(1, Math.ceil(rate * secs), rate);
      const g = ctx.createGain();
      g.gain.value = 0.9;
      g.connect(ctx.destination);
      for (let i = 0; i < order.length; i++) {
        const spec = specFor(depthSound({ sound: order[i] }) ?? toySound("photo-3d"), true);
        await loadSamples(ctx, spec);
        playSpec(ctx, g, i * each + 0.9, spec);
      }
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      const b = new DataView(new ArrayBuffer(44 + d.length * 2));
      const w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
      w(0, "RIFF");
      b.setUint32(4, 36 + d.length * 2, true);
      w(8, "WAVEfmt ");
      b.setUint32(16, 16, true);
      b.setUint16(20, 1, true);
      b.setUint16(22, 1, true);
      b.setUint32(24, rate, true);
      b.setUint32(28, rate * 2, true);
      b.setUint16(32, 2, true);
      b.setUint16(34, 16, true);
      w(36, "data");
      b.setUint32(40, d.length * 2, true);
      for (let i = 0; i < d.length; i++) b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true); // prettier-ignore
      return Array.from(new Uint8Array(b.buffer));
    },
    [order, each],
  );
  const wavFile = path.join(os.tmpdir(), `pdp-sound-${process.pid}.wav`);
  fs.writeFileSync(wavFile, Buffer.from(wav));
  // the Toy tab open on the Sound choice
  await page.evaluate(() => {
    window.__splashery.app.sound.enabled = false; // (the clip's sound is the rendered one)
    // (on a phone the panel opens as a sheet: "More", then the Toy tab)
    const more = document.getElementById("sheet-toggle");
    if (more?.offsetParent && more.getAttribute("aria-expanded") !== "true") more.click();
    document.getElementById("tab-play")?.click();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector(".pdp-sound")?.scrollIntoView({ block: "center" })); // prettier-ignore
  await finger();
  await tag(label);
  const enc = encoder(out, wavFile);
  for (const id of order) {
    const b = await page.evaluate((id) => {
      const r = document.getElementById(`pdp-sound-${id}`).getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }, id);
    await page.mouse.move(b[0], b[1]);
    await page.evaluate((id) => {
      document.getElementById(`pdp-sound-${id}`).click();
      const pl = window.__splashery.player;
      pl.motion.setControl("flat", 1, { snap: true });
    }, id);
    const n = Math.round(each * fps);
    for (let k = 0; k < n; k++) {
      // the depth rises from 0.9 s (the tap), as the sound does
      const t = k / fps - 0.9;
      const f = t < 0 ? 1 : Math.max(0, 1 - t / 3.2);
      await page.evaluate(async (f) => {
        const pl = window.__splashery.player;
        pl.motion.setControl("flat", f, { snap: true });
        pl.stage.requestRender();
        await new Promise((r) => requestAnimationFrame(r));
      }, f);
      await enc.frame();
    }
  }
  await enc.end();
  fs.rmSync(wavFile, { force: true });
}

await browser.close();
console.log(`\nWrote ${out}`);
