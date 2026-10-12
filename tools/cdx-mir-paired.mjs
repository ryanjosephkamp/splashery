#!/usr/bin/env node
// Operator review: identical poses, sensor frames, depth replies, virtual
// draw times, camera angles, and picture grids on both sides of the change.
// The unchanged shipped worker makes the replies; only its transport is
// replayed. GPU screenshots use the actual page and relief renderer.
// DISPLAY=:99 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/usr/bin/chromium \
//   node tools/cdx-mir-paired.mjs .cache/cdx-mir-paired
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import { cameras, CLIPS } from "./cdx-mir-camera.mjs";
import { FACE, fakeCamera, edgeEnergy, fineDetail } from "./lv7-mirror-measure.mjs";
import { openProfile, timing } from "./cdx-mir-measure.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const median = (a) => [...a].sort((a, b) => a - b)[a.length >> 1] ?? 0;
const delta = (a, b) => mean(a.map((v, i) => Math.abs(v - b[i])));
const pixels = (p) => Array.from(p.data).filter((_, i) => i % 4 !== 3);
export const PHASES = {
  still: [0],
  turn: [0, 0.25, 0.5, 0.75],
  wave: [0, 0.125, 0.25, 0.375],
  "low-light": [0],
};

function inputs(dir, clips, phases) {
  const poses = [];
  for (const clip of clips)
    for (const phase of phases[clip]) {
      const folder = path.join(dir, `${clip}-${phase}`);
      cameras(folder, 12, [clip], phase);
      const y4m = path.join(folder, `${clip}.y4m`);
      const rgba = path.join(folder, "frames.rgba");
      if (!fs.existsSync(rgba) || fs.statSync(rgba).mtimeMs < fs.statSync(y4m).mtimeMs)
        execFileSync("ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-threads",
          "1",
          "-i",
          y4m,
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgba",
          rgba,
        ]);
      const bytes = fs.readFileSync(rgba);
      if (bytes.length !== 12 * 320 * 240 * 4) throw new Error(`Unexpected frame data: ${rgba}`);
      const cleanDir = path.join(folder, "clean");
      cameras(cleanDir, 1, [clip], phase, 0);
      const clean = path.join(cleanDir, "frame.rgba");
      if (!fs.existsSync(clean))
        execFileSync("ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-threads",
          "1",
          "-i",
          path.join(cleanDir, `${clip}.y4m`),
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgba",
          clean,
        ]);
      poses.push({
        clip,
        phase,
        folder,
        url: `/${path.relative(root, path.resolve(rgba))}`,
        clean: `/${path.relative(root, path.resolve(clean))}`,
        inputHash: hash(bytes),
      });
    }
  return poses;
}

async function controlled(page) {
  return page.evaluate(async () => {
    const mod = await import("/src/live/relief.js");
    const old = mod.MIRROR.cam;
    old.ask = () => {};
    const start = performance.now();
    while (old.busy && performance.now() - start < 30000)
      await new Promise((r) => setTimeout(r, 20));
    if (old.busy) throw new Error("Camera worker did not settle");
    const worker = old.worker;
    old.worker = null;
    old.close();
    const out = document.createElement("canvas");
    out.width = mod.mirrorScreen.width;
    out.height = mod.mirrorScreen.height;
    out.getContext("2d", { willReadFrequently: true });
    const video = document.createElement("canvas");
    video.width = video.videoWidth = 320;
    video.height = video.videoHeight = 240;
    video.getContext("2d", { willReadFrequently: true });
    const frame = document.createElement("canvas");
    const side = old.side;
    frame.width = Math.max(14, Math.round(side / 14) * 14);
    frame.height = Math.max(14, Math.round((side * 240) / 320 / 14) * 14);
    const S = (window.__cdxPair = {
      mod,
      worker,
      out,
      video,
      frame,
      side,
      id: 1000000,
      waiting: null,
      opts: {
        cols: old.cols,
        rows: old.rows,
        tier: Object.keys(mod.DEPTH_SIDE).find((k) => mod.DEPTH_SIDE[k] === side),
        mirror: old.mirror,
        depth: false,
        back: old.back ? { cols: old.back.cols, rows: old.back.rows } : null,
      },
      view: window.__splashery.player.camera.getState(),
      depth: mod.MIRROR.depth,
    });
    worker.onmessage = ({ data: m }) => {
      if (m.type === "error") S.waiting?.reject(new Error(m.text));
      if (m.type === "depth" && m.id === S.waiting?.id) S.waiting.resolve(m);
    };
    mod.mirrorScreen.draw = (g) => g.drawImage(out, 0, 0);
    mod.mirrorScreen.version = () => 0;
    return {
      side,
      grid: `${old.cols}x${old.rows}`,
      input: `${frame.width}x${frame.height}`,
      gain: mod.MIRROR.gain,
    };
  });
}

async function replies(page, pose, meta, modelHash) {
  const file = path.join(pose.folder, `depth-${meta.side}.json`);
  if (fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    if (
      cached.version === 2 &&
      cached.modelHash === modelHash &&
      cached.inputHash === pose.inputHash
    )
      return file;
  }
  const frames = await page.evaluate(async (url) => {
    const S = window.__cdxPair;
    S.mod.MIRROR.depth = S.depth;
    S.mod.MIRROR.gain = S.depth;
    const rgba = await (await fetch(url)).arrayBuffer();
    const g = S.video.getContext("2d", { willReadFrequently: true });
    const fg = S.frame.getContext("2d", { willReadFrequently: true });
    const answers = [];
    const encode = (bytes) => {
      let binary = "";
      for (let j = 0; j < bytes.length; j += 8192)
        binary += String.fromCharCode(...bytes.subarray(j, j + 8192));
      return btoa(binary);
    };
    for (let i = 0; i < 12; i++) {
      g.putImageData(
        new ImageData(new Uint8ClampedArray(rgba, i * 320 * 240 * 4, 320 * 240 * 4), 320, 240),
        0,
        0,
      );
      fg.drawImage(S.video, 0, 0, S.frame.width, S.frame.height);
      const data = fg.getImageData(0, 0, S.frame.width, S.frame.height).data;
      const input = encode(data);
      const id = ++S.id;
      const answer = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Depth reply timeout")), 30000);
        S.waiting = {
          id,
          resolve: (m) => {
            clearTimeout(timeout);
            resolve(m);
          },
          reject,
        };
        S.worker.postMessage({ type: "frame", id, w: S.frame.width, h: S.frame.height, data }, [
          data.buffer,
        ]);
      });
      answers.push({
        w: answer.w,
        h: answer.h,
        ms: answer.ms,
        d: encode(new Uint8Array(answer.d.buffer)),
        input,
      });
    }
    return answers;
  }, pose.url);
  fs.writeFileSync(
    file,
    JSON.stringify({ version: 2, modelHash, inputHash: pose.inputHash, frames }),
  );
  return file;
}

async function beginPose(page, pose, file) {
  await page.evaluate(
    async ({ url, depth }) => {
      const S = window.__cdxPair;
      S.mod.MIRROR.depth = S.depth;
      S.mod.MIRROR.gain = S.depth;
      S.rgba = await (await fetch(url)).arrayBuffer();
      const fixture = await (await fetch(depth)).json();
      S.answers = fixture.frames.map((f) => ({
        ...f,
        d: new Float32Array(Uint8Array.from(atob(f.d), (v) => v.charCodeAt(0)).buffer),
        input: Uint8Array.from(atob(f.input), (v) => v.charCodeAt(0)),
      }));
      S.cam?.close();
      // Each held pose starts from the same empty filter state. Motion
      // between poses is measured separately by the free-running tool.
      const cam = (S.cam = new S.mod.CameraDepth(S.video, S.opts));
      S.mod.MIRROR.cam = cam;
      const send = cam.ask.bind(cam);
      cam.ask = () => {};
      S.answerWork = [];
      cam.worker = {
        terminate() {},
        postMessage(m) {
          if (
            m.data.length !== S.answer.input.length ||
            !m.data.every((v, i) => v === S.answer.input[i])
          )
            throw new Error("Recorded model input differs from captured replay frame");
          const start = performance.now();
          cam.onAnswer({ type: "depth", ...S.answer, id: m.id });
          S.answerWork.push(performance.now() - start);
        },
      };
      S.step = (i) => {
        S.video
          .getContext("2d")
          .putImageData(
            new ImageData(
              new Uint8ClampedArray(S.rgba, i * 320 * 240 * 4, 320 * 240 * 4),
              320,
              240,
            ),
            0,
            0,
          );
        S.answer = S.answers[i];
        cam.draw(S.out.getContext("2d"), { gain: S.mod.MIRROR.gain, dt: 1 / 30 });
        send();
        for (let j = 0; j < 6; j++)
          cam.draw(S.out.getContext("2d"), { gain: S.mod.MIRROR.gain, dt: 1 / 30 });
      };
      for (let i = 0; i < 8; i++) S.step(i);
    },
    { url: pose.url, depth: `/${path.relative(root, path.resolve(file))}` },
  );
}

function featureContrast(image, clean) {
  if (image.width !== clean.width || image.height !== clean.height)
    throw new Error("Feature crops differ");
  const gray = (p) =>
    Float32Array.from(
      { length: p.width * p.height },
      (_, i) => (p.data[i * 4] + p.data[i * 4 + 1] + p.data[i * 4 + 2]) / 3,
    );
  const a = gray(image),
    b = gray(clean),
    w = image.width,
    h = image.height;
  let edge = 0,
    ref = 0,
    noise = 0,
    n = 0,
    count = 0;
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const e = Math.hypot(b[i + 1] - b[i], b[i + w] - b[i]);
      if (e >= 3) {
        // Project onto the clean edge direction: perpendicular sensor noise
        // must not count as better contrast.
        edge += ((a[i + 1] - a[i]) * (b[i + 1] - b[i]) + (a[i + w] - a[i]) * (b[i + w] - b[i])) / e;
        ref += e;
        count++;
      } else if (e < 0.5) {
        noise += Math.abs(a[i] - b[i]);
        n++;
      }
    }
  if (count < 20 || n < 20) throw new Error("Not enough clean edges or flat pixels");
  return { featureSharpness: edge / ref, flatNoise: noise / n, featurePixels: count };
}

async function flatFeature(page, pose, label) {
  await page.evaluate(() => {
    const S = window.__cdxPair;
    S.mod.MIRROR.depth = S.mod.MIRROR.gain = 0;
    S.cam.draw(S.out.getContext("2d"), { gain: 0, dt: 1 / 30 });
  });
  const flat = await sample(page, null, 0);
  const image = PNG.sync.read(await page.screenshot({ clip: flat.box }));
  await page.evaluate(async (url) => {
    const S = window.__cdxPair;
    const bytes = await (await fetch(url)).arrayBuffer();
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 240;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(bytes), 320, 240), 0, 0);
    const ref = document.createElement("canvas");
    ref.width = S.cam.cols;
    ref.height = S.cam.rows;
    const g = ref.getContext("2d");
    g.imageSmoothingQuality = "high";
    if (S.cam.mirror) {
      g.translate(ref.width, 0);
      g.scale(-1, 1);
    }
    const [x, y, w, h] = S.cam.crop;
    g.drawImage(c, x * 320, y * 240, w * 320, h * 240, 0, 0, ref.width, ref.height);
    S.out.getContext("2d").putImageData(g.getImageData(0, 0, ref.width, ref.height), 0, 0);
  }, pose.clean);
  const reference = await sample(page, null, 0);
  const clean = PNG.sync.read(await page.screenshot({ clip: reference.box }));
  fs.writeFileSync(path.join(pose.folder, `${label}-flat.png`), PNG.sync.write(image));
  fs.writeFileSync(path.join(pose.folder, `${label}-clean.png`), PNG.sync.write(clean));
  return featureContrast(image, clean);
}

async function sample(page, index, turn) {
  return page.evaluate(
    async ({ index, turn, F }) => {
      const S = window.__cdxPair;
      if (index !== null) S.step(index);
      const cam = S.cam;
      const h = [],
        c = [];
      for (let y = Math.floor(F.y0 * cam.rows); y < F.y1 * cam.rows; y++)
        for (let x = Math.floor(F.x0 * cam.cols); x < F.x1 * cam.cols; x++) {
          const k = y * cam.cols + x;
          h.push(cam.heights[k]);
          c.push(cam.lastColors[k * 4], cam.lastColors[k * 4 + 1], cam.lastColors[k * 4 + 2]);
        }
      const p = window.__splashery.player;
      p.camera.setState({ ...S.view, yaw: S.view.yaw + turn }, { snap: true });
      p.screen.g.drawImage(S.out, 0, 0);
      p.stage.setScreenCanvas(p.screen.canvas);
      await p.stage.captureFrame();
      const height = (2 * cam.rows) / cam.cols;
      const z = 0.9 * S.mod.MIRROR.gain * 0.8;
      const pts = [
        [F.x0, F.y0],
        [F.x1, F.y0],
        [F.x0, F.y1],
        [F.x1, F.y1],
      ].map(([u, v]) => p.screenPoint([(u - 0.5) * 2, (0.5 - v) * height, z]));
      const rect = document.getElementById("stage").getBoundingClientRect();
      const xs = pts.map((v) => v[0] + rect.left),
        ys = pts.map((v) => v[1] + rect.top);
      const box = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
      const w = Math.round(box.width * 2),
        hh = Math.round(box.height * 2);
      const image = document.createElement("canvas");
      image.width = w;
      image.height = hh;
      const g = image.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.translate(w, 0);
      g.scale(-1, 1);
      g.drawImage(
        S.video,
        (1 - F.x1) * 320,
        F.y0 * 240,
        (F.x1 - F.x0) * 320,
        (F.y1 - F.y0) * 240,
        0,
        0,
        w,
        hh,
      );
      return {
        h,
        c,
        box,
        reference: { width: w, height: hh, data: Array.from(g.getImageData(0, 0, w, hh).data) },
        answers: cam.answers,
      };
    },
    { index, turn, F: FACE },
  );
}

async function poseMeasure(page, pose, file, label) {
  await beginPose(page, pose, file);
  const height = [],
    color = [],
    shown = [],
    turned = [],
    edges = [],
    grain = [];
  let previous = null;
  for (let i = 8; i < 12; i++) {
    const front = await sample(page, i, 0);
    const face = PNG.sync.read(await page.screenshot({ clip: front.box }));
    const side = await sample(page, null, 0.35);
    const turn = PNG.sync.read(await page.screenshot({ clip: side.box }));
    if (front.answers !== i + 1) throw new Error("Replay skipped a model answer");
    if (previous) {
      height.push(delta(front.h, previous.h));
      color.push(delta(front.c, previous.c));
      shown.push(delta(pixels(face), pixels(previous.face)));
      turned.push(delta(pixels(turn), pixels(previous.turn)));
    }
    edges.push(edgeEnergy(face) / Math.max(1e-6, edgeEnergy(front.reference)));
    grain.push(Math.max(0, fineDetail(face) - fineDetail(front.reference)));
    previous = { ...front, face, turn };
    if (i === 11) {
      fs.writeFileSync(path.join(pose.folder, `${label}-face.png`), PNG.sync.write(face));
      fs.writeFileSync(path.join(pose.folder, `${label}-turned.png`), PNG.sync.write(turn));
    }
  }
  const features = await flatFeature(page, pose, label);
  const profiler = process.env.CDX_MIR_PROFILE ? await page.context().newCDPSession(page) : null;
  if (profiler) {
    await profiler.send("Profiler.enable");
    await profiler.send("Profiler.start");
  }
  const work = await page.evaluate(async () => {
    const S = window.__cdxPair;
    S.mod.MIRROR.depth = S.mod.MIRROR.gain = S.depth;
    // Drain software GPU work before timing CPU filtering. The actual
    // production draw (including camera readback) is timed separately.
    const stage = window.__splashery.player.stage;
    const handlers = stage.updateHandlers,
      request = stage.requestRender;
    stage.updateHandlers = [];
    stage.requestRender = () => {};
    stage.aliveUntil = 0;
    stage.app.renderNextFrame = false;
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 24; i++) S.cam.draw(S.out.getContext("2d"), { gain: S.depth, dt: 1 / 30 });
    const times = [];
    for (let batch = 0; batch < 5; batch++) {
      const start = performance.now();
      for (let i = 0; i < 12; i++)
        S.cam.draw(S.out.getContext("2d"), { gain: S.mod.MIRROR.gain, dt: 1 / 30 });
      times.push((performance.now() - start) / 12);
    }
    stage.updateHandlers = handlers;
    stage.requestRender = request;
    stage.requestRender();
    return { draw: times, answer: S.answerWork.slice(8), moving: S.cam.moving };
  });
  if (profiler) {
    const { profile } = await profiler.send("Profiler.stop");
    fs.writeFileSync(path.join(pose.folder, `${label}-cpu.json`), JSON.stringify(profile));
    await profiler.detach();
  }
  return {
    phase: pose.phase,
    inputHash: pose.inputHash,
    heightJitter: median(height),
    colorJitter: median(color),
    shownJitter: median(shown),
    shownJitterTurned: median(turned),
    sharpness: mean(edges),
    grain: mean(grain),
    ...features,
    drawMs: median(work.draw),
    drawBatches: work.draw,
    answerMs: median(work.answer),
    moving: work.moving,
  };
}

export async function paired(
  dir = ".cache/cdx-mir-paired",
  {
    profiles = ["low", "mid", "high"],
    clips = CLIPS,
    phases = PHASES,
    includeReview = true,
    liveTiming = true,
    labels = null,
    resume = false,
  } = {},
) {
  const poses = inputs(dir, clips, phases);
  cameras(".cache/cdx-mir", 120, ["still"]);
  const sources = {
    before: execFileSync("git", ["show", "ec4aaa37:src/live/relief.js"], { encoding: "utf8" }),
    after: fs.readFileSync(new URL("../src/live/relief.js", import.meta.url), "utf8"),
  };
  if (includeReview)
    sources.review = execFileSync("git", ["show", "ab4cd7c1:src/live/relief.js"], {
      encoding: "utf8",
    });
  const modelHash = hash(
    Buffer.concat([
      fs.readFileSync(path.join(root, "src/live/depth-worker.js")),
      fs.readFileSync(path.join(root, "vendor/depth-anything-v2-small/model_quantized.onnx")),
    ]),
  );
  const resultFile = path.join(dir, "paired.json");
  const results =
    resume && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, "utf8")) : {};
  for (const profile of profiles)
    for (const [label, source] of Object.entries(sources)) {
      if (labels && !labels.includes(label)) continue;
      if (label === "review" && profile !== "mid") continue;
      const prior = results[`${profile}-${label}`];
      if (
        resume &&
        prior?.sourceHash === hash(source) &&
        prior.modelHash === modelHash &&
        (!liveTiming || prior.live) &&
        prior.poses.length === poses.length &&
        prior.poses.every(
          (p, i) =>
            p.inputHash === poses[i].inputHash &&
            p.clip === poses[i].clip &&
            p.phase === poses[i].phase,
        )
      ) {
        console.log(`Reuse ${profile}-${label}: same source, model, and input poses`);
        continue;
      }
      const browser = await chromium.launch({
        ...config.use.launchOptions,
        args: fakeCamera(
          path.join(root, ".cache/cdx-mir/still.y4m"),
          config.use.launchOptions.args,
        ),
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
        });
        await page.route("**/src/live/relief.js", (route) =>
          route.fulfill({ contentType: "text/javascript", body: source }),
        );
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await openProfile(page, process.env.SPLASHERY_URL || "http://127.0.0.1:4173/", profile);
        const live = liveTiming ? await timing(page) : null;
        const meta = await controlled(page);
        const all = [];
        for (const pose of poses) {
          const file = await replies(page, pose, meta, modelHash);
          const m = await poseMeasure(page, pose, file, `${profile}-${label}`);
          all.push({ clip: pose.clip, ...m });
          console.log(`${profile} ${label} ${pose.clip} phase ${pose.phase}: ${JSON.stringify(m)}`);
        }
        results[`${profile}-${label}`] = {
          sourceHash: hash(source),
          modelHash,
          ...meta,
          live,
          poses: all,
          errors,
        };
        fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
      } finally {
        await browser.close();
      }
    }
  return results;
}
if (import.meta.url === `file://${process.argv[1]}`)
  await paired(process.argv[2] || ".cache/cdx-mir-paired", {
    resume: process.argv.includes("--resume"),
    includeReview: !process.argv.includes("--no-review"),
  });
