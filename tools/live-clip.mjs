#!/usr/bin/env node
// Lane Live input: records a live toy as a looping GIF of the whole page at
// phone size (the toy, its panel and the live indicator), fed by known test
// signals instead of a real microphone or camera.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/live-clip.mjs <out.gif> --toy=<id>
//     [--w=390] [--h=844] [--scale=1] [--secs=6] [--fps=12] [--before=0.5]
//     [--audio=<wav>] [--video=<y4m>] [--press=<selector>[,<selector>…]]
//     [--js=<code run before recording>] [--at=<js run at time t: "t:code;t:code">]
//     [--depth] [--strip=8] [--sheet=full] [--report=<js whose result is printed after>]
//     [--ready=<js: recording waits until it returns true>] [--screen-demo] [--opt=key=value] [--turn=t0,t1,radians]
//     [--song=<sound file>] [--clock] [--dpr=1] [--frames=<dir>]
//
// The page's clock is stepped by hand (as tools/effect-clip.mjs does), so a
// clip shows the toy at its real speed however slow the renderer is.
// --audio: the microphone button gets a virtual microphone whose samples
// come from the WAV (mono, 16 bit), fed to the page's own analyser
// (src/live/mic.js) in step with the clip's clock, so claps, notes and
// spectra land exactly when they sound. --video: Chromium's fake camera
// plays the Y4M file in real time; with --depth each frame waits until the
// depth model has answered, so the depth follows the picture as it would on
// a fast computer (the clip says how long the model took here). --press
// clicks buttons (the live buttons) before recording. --sheet=full opens
// the phone's settings sheet at its full stop first (UI r2), if it has one.
// --song (lane Live input r2): opens the file in the Song landscape, waits
// until it is measured and plays it from the clip's start, its audio clock
// stepped with the clip's (the sound itself is left out: add it to the video
// from <out>.json's songStart, the second of the song at the first frame).
// --clock shows the song's audio clock at the top of the page.
// --dpr renders at that pixel density (2 is a phone's); --frames writes each
// frame as a PNG into the folder (frame-0000.png, …) instead of the GIF, for
// an MP4 without the GIF's 256 colors (ffmpeg -framerate <fps> -i
// <dir>/frame-%04d.png …).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const flag = (name) => args.includes(`--${name}`);
const [out] = args.filter((a) => !a.startsWith("--"));
const toy = opt("toy", "");
if (!out || !toy) throw new Error("Usage: node tools/live-clip.mjs <out.gif> --toy=<id> …");
const W = Number(opt("w", 390));
const H = Number(opt("h", 844));
const scale = Number(opt("scale", 1));
const secs = Number(opt("secs", 6));
const fps = Number(opt("fps", 12));
const before = Number(opt("before", 0.5));
const audio = opt("audio", "");
const video = opt("video", "");
const press = opt("press", "") ? opt("press", "").split(",") : [];
const js = opt("js", "");
const atList = opt("at", "")
  ? opt("at", "")
      .split(";;")
      .map((s) => {
        const i = s.indexOf(":");
        return { t: Number(s.slice(0, i)), code: s.slice(i + 1) };
      })
  : [];
const waitDepth = flag("depth");
const stripN = Number(opt("strip", 0));

// The WAV's samples (16-bit PCM, first channel).
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12;
  let fmt = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12) };
    if (id === "data") {
      const n = Math.floor(size / (2 * fmt.ch));
      const s = new Array(n);
      for (let i = 0; i < n; i++) s[i] = b.readInt16LE(p + 8 + i * 2 * fmt.ch) / 32768;
      return { rate: fmt.rate, samples: s };
    }
    p += 8 + size + (size & 1);
  }
  throw new Error("Not a WAV file.");
}

const launchArgs = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--auto-accept-this-tab-capture",
];
if (video) launchArgs.push(`--use-file-for-fake-video-capture=${path.resolve(video)}`);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: launchArgs,
});
const dpr = Number(opt("dpr", 1));
const framesDir = opt("frames", "");
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
page.on("pageerror", (e) => console.error("page error:", e.message));
if (audio) {
  // The microphone button gets a silent stream; the samples come from the WAV.
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      if (!c?.audio) return real(c);
      const ctx = new AudioContext();
      return ctx.createMediaStreamDestination().stream;
    };
  });
}
if (flag("screen-demo")) {
  // "Share a screen" gets a drawn window instead of the fake device's test
  // pattern: a plain notes window whose text types itself and a clock.
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const c = document.createElement("canvas");
      c.width = 960;
      c.height = 600;
      const g = c.getContext("2d");
      const text =
        "Notes for Saturday\n\n- Water the tomatoes\n- Call Grandma about the picnic\n- Fix the bike's back tire\n- Library books due Monday\n- Try the new bread recipe\n\nSplats on a screen, on a screen.";
      const t0 = performance.now();
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        g.fillStyle = "#2d6a8f";
        g.fillRect(0, 0, 960, 600);
        g.fillStyle = "#f7f4ec";
        g.fillRect(70, 50, 820, 500);
        g.fillStyle = "#d9d3c4";
        g.fillRect(70, 50, 820, 40);
        for (const [i, col] of ["#e0625a", "#e8b43c", "#5cb85c"].entries()) {
          g.fillStyle = col;
          g.beginPath();
          g.arc(98 + i * 26, 70, 8, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#333";
        g.font = "20px sans-serif";
        g.fillText("notes.txt", 440, 77);
        const shown = text.slice(0, Math.floor(t * 14));
        g.font = "30px sans-serif";
        shown.split("\n").forEach((line, i) => g.fillText(line, 110, 140 + i * 40));
        if (Math.floor(t * 2) % 2) {
          const last = shown.split("\n");
          const w = g.measureText(last[last.length - 1]).width;
          g.fillRect(112 + w, 116 + (last.length - 1) * 40, 3, 30);
        }
        g.fillStyle = "#1c3f55";
        g.fillRect(0, 570, 960, 30);
        g.fillStyle = "#fff";
        g.font = "18px sans-serif";
        const s = Math.floor(t);
        g.fillText(`10:4${Math.floor(s / 60) % 10}:${String(s % 60).padStart(2, "0")}`, 860, 591);
        requestAnimationFrame(draw);
      };
      draw();
      return c.captureStream(15);
    };
  });
}
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async (toy) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(toy);
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
}, toy);
await page.waitForTimeout(1500);
// Every --opt=key=value (there may be several).
const opts = Object.fromEntries(
  args.filter((a) => a.startsWith("--opt=")).map((a) => a.slice(6).split("=")),
);
if (Object.keys(opts).length) {
  await page.evaluate((o) => window.__splashery.app.setToyOptions(o), opts);
  await page.waitForTimeout(1000);
}
if (opt("sheet", "") === "full") {
  await page.evaluate(() => document.getElementById("sheet-full")?.click());
  await page.waitForTimeout(600);
}
for (const sel of press) {
  // A script click: on a phone the panel may be folded away.
  await page.evaluate((sel) => document.querySelector(sel).click(), sel);
  await page.waitForTimeout(400);
}
// Wait for any rebuild the buttons started.
await page.waitForFunction(() => window.__splashery.player.motion.recipe && document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
await page.waitForTimeout(800);
if (audio) {
  const wav = readWav(audio);
  await page.evaluate(async ({ samples, rate }) => {
    const { live } = await import("/src/live/live.js");
    const { MicAnalyser } = await import("/src/live/mic.js");
    live.mic?.close();
    // A stand-in for the AnalyserNode: the spectrum of the last 4096
    // samples (Blackman window), in dB like the real one.
    const N = 4096;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    const win = Float64Array.from({ length: N }, (_, i) => 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N)); // prettier-ignore
    const fft = () => {
      for (let i = 1, j = 0; i < N; i++) {
        let bit = N >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
          [re[i], re[j]] = [re[j], re[i]];
          [im[i], im[j]] = [im[j], im[i]];
        }
      }
      for (let len = 2; len <= N; len <<= 1) {
        const a = (-2 * Math.PI) / len;
        for (let i = 0; i < N; i += len)
          for (let k = 0; k < len / 2; k++) {
            const wr = Math.cos(a * k);
            const wi = Math.sin(a * k);
            const xr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
            const xi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
            re[i + k + len / 2] = re[i + k] - xr;
            im[i + k + len / 2] = im[i + k] - xi;
            re[i + k] += xr;
            im[i + k] += xi;
          }
      }
    };
    let mic;
    const analyser = {
      frequencyBinCount: N / 2,
      getFloatFrequencyData(outArr) {
        const x = mic.recent(N);
        for (let i = 0; i < N; i++) {
          re[i] = x[i] * win[i];
          im[i] = 0;
        }
        fft();
        for (let i = 0; i < N / 2; i++) outArr[i] = 20 * Math.log10(Math.hypot(re[i], im[i]) / N + 1e-12); // prettier-ignore
      },
    };
    mic = new MicAnalyser({ sampleRate: rate, close: async () => {} }, analyser);
    mic.node = {}; // samples come in blocks, as from the worklet
    live.mic = mic;
    (await import("/src/live/panel.js")).rehookClap(); // Clap to tap listens to it
    let at = 0;
    // Feeds `secs` of the WAV (looping) and ticks the analyser at 60 Hz.
    window.__feed = (secs) => {
      let n = Math.round(secs * rate);
      let sinceTick = window.__sinceTick || 0;
      while (n > 0) {
        const m = Math.min(n, 256);
        const block = new Float32Array(m);
        for (let i = 0; i < m; i++) block[i] = samples[(at + i) % samples.length];
        at += m;
        n -= m;
        mic.samples(block);
        sinceTick += m;
        while (sinceTick >= rate / 60) {
          sinceTick -= rate / 60;
          mic.tick();
        }
      }
      window.__sinceTick = sinceTick;
    };
  }, wav);
}
if (opt("ready", ""))
  await page.waitForFunction(`(async () => { if (!document.getElementById("progress").hidden) return false; ${opt("ready", "")} })()`, null, { timeout: 180_000, polling: 250 }); // prettier-ignore
// The toy must have finished building, and stayed built for a moment.
for (let calm = 0; calm < 4; ) {
  await page.waitForTimeout(400);
  calm = (await page.evaluate(() => document.getElementById("progress").hidden)) ? calm + 1 : 0;
}
if (js) await page.evaluate(`(async () => { ${js} })()`);
const song = opt("song", "");
if (song) {
  await page.locator("#toy-input-file").setInputFiles(song);
  await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.song?.song?.name, null, { timeout: 120000 }); // prettier-ignore
  for (let i = 0; i < 1200; i++) {
    const done = await page.evaluate(async () => (await import("/src/packs/studio.js")).songAnalysisState().finished); // prettier-ignore
    if (done) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  // A long song's track keeps the clip's time instead of the element's.
  await page.evaluate(async () => {
    const { songTest } = await import("/src/packs/studio.js");
    const t = songTest().track;
    window.__song = { t: 0, on: false };
    if (!t) return;
    t.el.pause();
    t.time = () => window.__song.t;
    Object.defineProperty(t, "playing", { get: () => window.__song.on });
    t.play = () => (window.__song.on = true);
    t.pause = () => (window.__song.on = false);
  });
}
if (flag("clock"))
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "clip-clock";
    d.style.cssText =
      "position:fixed;left:50%;transform:translateX(-50%);top:92px;z-index:99;font:600 13px system-ui;background:#000a;color:#fff;padding:3px 9px;border-radius:10px";
    document.body.append(d);
  });
// Take over the clock.
await page.evaluate(() => {
  const { player } = window.__splashery;
  const stage = player.stage;
  const handlers = stage.updateHandlers.slice();
  window.__pending = 0;
  stage.updateHandlers.length = 0;
  stage.updateHandlers.push(() => {
    const d = window.__pending;
    window.__pending = 0;
    for (const h of handlers) h(d);
  });
});
const step = 1 / fps;
const frames = [];
const total = Math.round((before + secs) / step);
let depthMs = [];
// --turn=t0,t1,radians: one slow, even turn of the view between t0 and t1.
const turn = opt("turn", "") ? opt("turn", "").split(",").map(Number) : null;
let turned = 0;
for (let n = 0; n < total; n++) {
  const t = n * step - before;
  if (turn) {
    const [t0, t1, rad] = turn;
    const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    const want = rad * (0.5 - 0.5 * Math.cos(Math.PI * f)); // eased in and out
    if (Math.abs(want - turned) > 1e-6) {
      await page.evaluate((d) => {
        const c = window.__splashery.player.camera;
        const s = c.getState();
        c.setState({ ...s, yaw: s.yaw + d }, { snap: true });
      }, want - turned);
      turned = want;
    }
  }
  for (const a of atList)
    if (a.t <= t && !a.done) {
      a.done = true;
      await page.evaluate(`(async () => { ${a.code} })()`);
    }
  if (waitDepth) {
    const ms = await page.evaluate(async () => {
      const { MIRROR } = await import("/src/live/relief.js");
      const cam = MIRROR.cam;
      if (!cam) return null;
      const n0 = cam.answers;
      const t0 = performance.now();
      cam.ask();
      while (cam.busy && performance.now() - t0 < 20000)
        await new Promise((r) => setTimeout(r, 30));
      return cam.answers > n0 ? cam.ms : null;
    });
    if (ms) depthMs.push(ms);
  }
  await page.evaluate(
    async ({ step, audio }) => {
      if (audio) window.__feed(step);
      if (window.__song?.on) window.__song.t += step;
      window.__pending = step;
      const { player } = window.__splashery;
      await player.stage.captureFrame();
    },
    { step, audio: !!audio },
  );
  // A clip starts once the toy is built (leading frames under the progress box are dropped).
  if (!frames.length && n < total - 1 && !(await page.evaluate(() => document.getElementById("progress").hidden))) continue; // prettier-ignore
  // The first screenshots can still show the page as it was before the clock was taken over.
  if (n < 2) continue;
  const pos = song ? await page.evaluate(async () => {
    const p = (await import("/src/packs/studio.js")).playState().pos;
    const c = document.getElementById("clip-clock");
    if (c) c.textContent = `audio clock ${p.toFixed(2)} s`;
    return p;
  }) : null; // prettier-ignore
  if (song && frames.length === 0)
    fs.writeFileSync(`${out}.json`, JSON.stringify({ songStart: pos }));
  if (framesDir) {
    fs.mkdirSync(framesDir, { recursive: true });
    fs.writeFileSync(path.join(framesDir, `frame-${String(frames.length).padStart(4, "0")}.png`), await page.screenshot()); // prettier-ignore
    frames.push({ t });
    continue;
  }
  const png = PNG.sync.read(await page.screenshot());
  frames.push({ png, t });
}
if (opt("report", "")) console.log("report:", JSON.stringify(await page.evaluate(`(async () => { ${opt("report", "")} })()`))); // prettier-ignore
await browser.close();

if (framesDir) {
  console.log(`${framesDir}: ${frames.length} frames`);
  process.exit(0);
}
const gifenc = await import("gifenc");
const { GIFEncoder, quantize, applyPalette } = gifenc.default || gifenc;
const ow = Math.round(W * scale);
const oh = Math.round(H * scale);
const resize = (png) => {
  if (scale === 1) return new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
  const outArr = new Uint8Array(ow * oh * 4);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      // Box filter over the source pixels.
      const x0 = Math.floor(x / scale);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) / scale));
      const y0 = Math.floor(y / scale);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) / scale));
      const acc = [0, 0, 0];
      let c = 0;
      for (let yy = y0; yy < Math.min(y1, png.height); yy++)
        for (let xx = x0; xx < Math.min(x1, png.width); xx++) {
          const i = (yy * png.width + xx) * 4;
          acc[0] += png.data[i];
          acc[1] += png.data[i + 1];
          acc[2] += png.data[i + 2];
          c++;
        }
      const o = (y * ow + x) * 4;
      outArr[o] = acc[0] / c;
      outArr[o + 1] = acc[1] / c;
      outArr[o + 2] = acc[2] / c;
      outArr[o + 3] = 255;
    }
  return outArr;
};
const gif = GIFEncoder();
const delay = Math.round(1000 / fps);
const small = frames.map((f) => ({ rgba: resize(f.png), t: f.t }));
for (const f of small) {
  const palette = quantize(f.rgba, 256, { format: "rgb565" });
  gif.writeFrame(applyPalette(f.rgba, palette, "rgb565"), ow, oh, { palette, delay, repeat: 0 });
}
gif.finish();
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, gif.bytes());
console.log(`${out}: ${frames.length} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB`);
if (depthMs.length)
  console.log(`depth model: ${depthMs.length} answers, median ${Math.round(depthMs.sort((a, b) => a - b)[depthMs.length >> 1])} ms`); // prettier-ignore
if (stripN > 1) {
  const picks = Array.from({ length: stripN }, (_, i) => small[Math.round((i / (stripN - 1)) * (small.length - 1))]); // prettier-ignore
  const strip = new PNG({ width: ow * stripN, height: oh });
  picks.forEach((f, k) => {
    for (let y = 0; y < oh; y++)
      for (let x = 0; x < ow; x++) {
        const s = (y * ow + x) * 4;
        const d = (y * ow * stripN + k * ow + x) * 4;
        for (let c = 0; c < 4; c++) strip.data[d + c] = f.rgba[s + c];
      }
  });
  fs.writeFileSync(out.replace(/\.gif$/, "-strip.png"), PNG.sync.write(strip));
}
