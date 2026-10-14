#!/usr/bin/env node
// Lane Live r7: how clean and how steady the Splat mirror is, measured on a
// generated mannequin (tools/lv7-mannequin.mjs --still: one pose, a camera's
// noise in every frame) through Chromium's fake camera. Used by
// tests/lv7.spec.mjs and, from the command line, for the before and after
// numbers in docs/handoff/LiveR7.md.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lv7-mirror-measure.mjs <still.y4m> [--look=plain|hologram] [--answers=10]
//
// The measures, over the middle of the face (eyes, nose and mouth), between
// one depth answer and the next while nothing in front of the camera moves
// (the jitters are medians over the answers):
//
//   heightJitter  how far each cell's height moves (0..1 of the relief)
//   colorJitter   how far each cell's color moves (0..255, mean of r, g, b)
//   shownJitter   how far the drawn picture's pixels move, face on and
//                 turned a little (0..255), everything together
//   sharpness     how much of the camera's own edges reach the drawn face:
//                 the mean gradient of the drawn face over the camera's
//                 picture of it at the same size (1 is as sharp as the
//                 camera; polish round)
//   drawMs        the picture's work per frame on the main thread (ms)
//   grain         the drawn face's fine detail that the camera's picture
//                 doesn't have: the mean difference between the drawn face
//                 and the same face blurred a little, less the camera's own
//                 (0..255; 0 is as smooth as the camera's picture)
//
// and for the hologram look, `overFace`: how much the look adds over the
// face (scanlines and glowing edges) beyond tinting it: the mean
// difference between the face's cells and a plain cyan tint of the same
// colors (0..255).

import { chromium } from "@playwright/test";
import { PNG } from "pngjs";

// The middle of the mannequin's face in the camera's frame (fractions, as the
// mirror shows it: mirrored left to right).
export const FACE = { x0: 0.44, x1: 0.58, y0: 0.4, y1: 0.63 };

export const fakeCamera = (y4m, args = []) => [
  ...args,
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${y4m}`,
];

// Opens the mirror with the camera on and the depth answering.
export async function openMirror(page, base, { look = "plain", query = "" } = {}) {
  await page.goto(
    `${base}?renderer=webgl2&adapt=off&profile=mid&labs=1${query ? `&${query}` : ""}`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("splat-mirror"));
  await page.waitForFunction(() => document.getElementById("progress").hidden && window.__splashery.player.motion.recipe, null, { timeout: 180_000 }); // prettier-ignore
  if (look !== "plain") {
    await page.evaluate((look) => window.__splashery.app.setToyOptions({ look }), look);
    await page.waitForTimeout(500);
    await page.waitForFunction(() => document.getElementById("progress").hidden, null, { timeout: 180_000 }); // prettier-ignore
  }
  await page.evaluate(() => document.querySelector("#live-camera-stage").click());
  await page.evaluate(async () => {
    const { MIRROR } = await import("/src/live/relief.js");
    const t0 = performance.now();
    while (!(MIRROR.cam?.answers >= 12) && performance.now() - t0 < 240000)
      await new Promise((r) => setTimeout(r, 300));
  });
}

// One fresh depth answer, then a few frames drawn (the heights ease).
async function nextAnswer(page) {
  await page.evaluate(async () => {
    const { MIRROR } = await import("/src/live/relief.js");
    const cam = MIRROR.cam;
    const n0 = cam.answers;
    const t0 = performance.now();
    while (cam.answers === n0 && performance.now() - t0 < 30000) {
      cam.ask();
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  await page.waitForTimeout(400);
}

// The face's cells: heights (0..1) and colors (r, g, b).
async function cells(page) {
  return page.evaluate((F) => {
    return import("/src/live/relief.js").then(({ MIRROR }) => {
      const cam = MIRROR.cam;
      const { cols, rows } = cam;
      const h = [];
      const c = [];
      for (let j = Math.floor(F.y0 * rows); j < F.y1 * rows; j++)
        for (let i = Math.floor(F.x0 * cols); i < F.x1 * cols; i++) {
          const k = j * cols + i;
          h.push(cam.heights[k]);
          c.push(cam.lastColors[k * 4], cam.lastColors[k * 4 + 1], cam.lastColors[k * 4 + 2]);
        }
      return { h, c };
    });
  }, FACE);
}

// The face's box on the page (CSS pixels), from where the picture shows.
async function faceBox(page) {
  return page.evaluate(async (F) => {
    const { MIRROR } = await import("/src/live/relief.js");
    const p = window.__splashery.player;
    const height = (2 * MIRROR.rows) / MIRROR.cols;
    const z = 0.9 * MIRROR.gain * 0.8;
    const pts = [
      [F.x0, F.y0],
      [F.x1, F.y0],
      [F.x0, F.y1],
      [F.x1, F.y1],
    ].map(([u, v]) => p.screenPoint([(u - 0.5) * 2, (0.5 - v) * height, z]));
    const r = document.getElementById("stage").getBoundingClientRect();
    const xs = pts.map((q) => q[0] + r.left);
    const ys = pts.map((q) => q[1] + r.top);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }, FACE);
}

async function shot(page, clip) {
  await page.evaluate(() => window.__splashery.player.stage.captureFrame());
  return PNG.sync.read(await page.screenshot({ clip }));
}

const meanAbs = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

// The mean difference between an image (gray) and its 5 by 5 box blur.
export function fineDetail(png) {
  const { width: w, height: h, data } = png;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  let s = 0;
  let n = 0;
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      let b = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) b += g[(y + j) * w + x + i];
      s += Math.abs(g[y * w + x] - b / 25);
      n++;
    }
  return n ? s / n : 0;
}

// The mean gradient (gray, 0..255 per pixel) of an image.
export function edgeEnergy(png) {
  const { width: w, height: h, data } = png;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  let s = 0;
  let n = 0;
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w - 1; x++) {
      s += Math.hypot(g[y * w + x + 1] - g[y * w + x], g[(y + 1) * w + x] - g[y * w + x]);
      n++;
    }
  return n ? s / n : 0;
}

const pixels = (png) => {
  const out = new Float32Array(png.width * png.height * 3);
  for (let i = 0; i < png.width * png.height; i++)
    for (let k = 0; k < 3; k++) out[i * 3 + k] = png.data[i * 4 + k];
  return out;
};

// The camera's own picture of the face at the size it shows (for grain).
async function cameraFace(page, clip) {
  const data = await page.evaluate(
    async ({ F, w, h }) => {
      const { MIRROR } = await import("/src/live/relief.js");
      const v = MIRROR.cam.video;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      const W = v.videoWidth;
      const H = v.videoHeight;
      // Mirrored, like the mirror.
      g.translate(w, 0);
      g.scale(-1, 1);
      g.drawImage(v, (1 - F.x1) * W, F.y0 * H, (F.x1 - F.x0) * W, (F.y1 - F.y0) * H, 0, 0, w, h);
      return Array.from(g.getImageData(0, 0, w, h).data);
    },
    { F: FACE, w: Math.round(clip.width * 2), h: Math.round(clip.height * 2) },
  );
  return { width: Math.round(clip.width * 2), height: Math.round(clip.height * 2), data };
}

export async function measure(page, { answers = 10, turn = 0.35, dump = null } = {}) {
  const hj = [];
  const cj = [];
  const sj = [];
  const tj = [];
  let grain = [];
  const edges = [];
  const box = await faceBox(page);
  let last = null;
  let lastShot = null;
  let lastTurned = null;
  const cam = page.evaluate.bind(page);
  for (let k = 0; k < answers; k++) {
    await nextAnswer(page);
    const now = await cells(page);
    const face = await shot(page, box);
    // A little turned (the relief's grain shows there), then back.
    await cam((d) => {
      const c = window.__splashery.player.camera;
      const s = c.getState();
      c.setState({ ...s, yaw: s.yaw + d }, { snap: true });
    }, turn);
    const turned = await shot(page, box);
    await cam((d) => {
      const c = window.__splashery.player.camera;
      const s = c.getState();
      c.setState({ ...s, yaw: s.yaw - d }, { snap: true });
    }, turn);
    if (last) {
      hj.push(meanAbs(now.h, last.h));
      cj.push(meanAbs(now.c, last.c));
      sj.push(meanAbs(pixels(face), pixels(lastShot)));
      tj.push(meanAbs(pixels(turned), pixels(lastTurned)));
    }
    grain.push(fineDetail(face));
    edges.push(edgeEnergy(face));
    if (dump && k === answers - 1) {
      const fs = await import("node:fs");
      fs.writeFileSync(`${dump}-face.png`, PNG.sync.write(face));
      fs.writeFileSync(`${dump}-turned.png`, PNG.sync.write(turned));
    }
    last = now;
    lastShot = face;
    lastTurned = turned;
  }
  const camFace = await cameraFace(page, box);
  const src = fineDetail(camFace);
  // The camera's face was drawn at twice the CSS size, like the shots.
  const drawMs = await page.evaluate(async () => {
    const { MIRROR, mirrorScreen } = await import("/src/live/relief.js");
    const c = document.createElement("canvas");
    c.width = mirrorScreen.width;
    c.height = mirrorScreen.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      MIRROR.last = i / 60 - 1 / 60;
      mirrorScreen.draw(g, i / 60);
    }
    return (performance.now() - t0) / 20;
  });
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  // The jitters are medians over the answers: on a loaded machine one slow
  // frame (heights caught mid-ease) shouldn't decide the measure.
  const median = (a) => {
    const b = [...a].sort((x, y) => x - y);
    return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : 0; // prettier-ignore
  };
  return {
    heightJitter: median(hj),
    colorJitter: median(cj),
    shownJitter: median(sj),
    shownJitterTurned: median(tj),
    grain: Math.max(0, mean(grain) - src),
    sharpness: mean(edges) / Math.max(1e-6, edgeEnergy(camFace)),
    drawMs,
    grid: await page.evaluate(async () => {
      const { MIRROR } = await import("/src/live/relief.js");
      return `${MIRROR.cols}x${MIRROR.rows}`;
    }),
    box,
  };
}

// Live r7 (the owner's "Please improve stability" of October 6, on the r4
// clips): how still the mirror holds while nothing in front of the camera
// moves, over the whole picture, not only the face. For `secs`, every frame
// the mirror draws is compared with the one before (what the splats are
// given: their colors, their heights, and the background layer's colors,
// heights and which of its splats show), then the drawn picture is
// screenshotted `shots` times, face on and turned, each shot against the one
// before. All are means per frame or per shot (0 is perfectly still):
//
//   color        the picture's colors (0..255, mean of r, g, b)
//   height       the picture's heights (thousandths of the relief)
//   moved        the share of the picture's splats (per thousand) whose
//                height moved more than a hundredth in a frame
//   backColor, backHeight, backShown   the background layer's (backShown:
//                the share of its splats, per thousand, that appeared or hid)
//   shown, shownTurned   the drawn page (0..255), face on and turned
//   flicker, flickerTurned   the share of the drawn page's pixels (per
//                thousand) that changed by more than 24 levels
export async function stillness(page, { secs = 6, shots = 6, turn = 0.35 } = {}) {
  await page.evaluate(async () => {
    const { MIRROR, mirrorScreen } = await import("/src/live/relief.js");
    const S = (window.__still = { n: 0, color: 0, height: 0, moved: 0, backColor: 0, backHeight: 0, backShown: 0, prev: null }); // prettier-ignore
    const draw = mirrorScreen.draw;
    window.__stillDraw = draw;
    mirrorScreen.draw = function (g, time) {
      draw.call(this, g, time);
      const W = g.canvas.width;
      const H = g.canvas.height;
      const { cols, rows } = MIRROR;
      const d = g.getImageData(0, 0, W, H).data;
      const p = S.prev;
      S.prev = d;
      if (!p || p.length !== d.length) return;
      let c = 0;
      let h = 0;
      let mv = 0;
      let bc = 0;
      let bh = 0;
      let bs = 0;
      let nb = 0;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const o = (j * W + i) * 4;
          c += (Math.abs(d[o] - p[o]) + Math.abs(d[o + 1] - p[o + 1]) + Math.abs(d[o + 2] - p[o + 2])) / 3; // prettier-ignore
          const q = o + cols * 4;
          const dh = Math.abs(d[q] - p[q]) / 255;
          h += dh;
          if (dh > 0.01) mv++;
          if (H >= rows * 2) {
            const b = ((j + rows) * W + i) * 4;
            const bq = b + cols * 4;
            if (d[bq + 3] !== p[bq + 3]) bs++;
            if (d[bq + 3] && p[bq + 3]) {
              bc += (Math.abs(d[b] - p[b]) + Math.abs(d[b + 1] - p[b + 1]) + Math.abs(d[b + 2] - p[b + 2])) / 3; // prettier-ignore
              bh += Math.abs(d[bq + 2] - p[bq + 2]) / 255;
              nb++;
            }
          }
        }
      const n = cols * rows;
      S.n++;
      S.color += c / n;
      S.height += (1000 * h) / n;
      S.moved += (1000 * mv) / n;
      S.backColor += nb ? bc / nb : 0;
      S.backHeight += nb ? (1000 * bh) / nb : 0;
      S.backShown += (1000 * bs) / n;
    };
  });
  await page.waitForTimeout(secs * 1000);
  const frames = await page.evaluate(async () => {
    const { mirrorScreen } = await import("/src/live/relief.js");
    mirrorScreen.draw = window.__stillDraw;
    const S = window.__still;
    const k = Math.max(1, S.n);
    return { frames: S.n, color: S.color / k, height: S.height / k, moved: S.moved / k, backColor: S.backColor / k, backHeight: S.backHeight / k, backShown: S.backShown / k }; // prettier-ignore
  });
  const box = await pictureBox(page);
  const yaw = (d) =>
    page.evaluate((d) => {
      const c = window.__splashery.player.camera;
      const s = c.getState();
      c.setState({ ...s, yaw: s.yaw + d }, { snap: true });
    }, d);
  const diff = (a, b) => {
    let s = 0;
    let f = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const v = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3; // prettier-ignore
      s += v;
      if (v > 24) f++;
    }
    const n = a.data.length / 4;
    return [s / n, (1000 * f) / n];
  };
  const on = [];
  const off = [];
  let lastOn = null;
  let lastOff = null;
  for (let k = 0; k < shots; k++) {
    await page.waitForTimeout(500);
    const a = await shot(page, box);
    await yaw(turn);
    const b = await shot(page, box);
    await yaw(-turn);
    if (lastOn) {
      on.push(diff(a, lastOn));
      off.push(diff(b, lastOff));
    }
    lastOn = a;
    lastOff = b;
  }
  const avg = (a, i) => a.reduce((s, v) => s + v[i], 0) / Math.max(1, a.length);
  return { ...frames, shown: avg(on, 0), flicker: avg(on, 1), shownTurned: avg(off, 0), flickerTurned: avg(off, 1) }; // prettier-ignore
}

// The whole picture's box on the page (CSS pixels).
async function pictureBox(page) {
  return page.evaluate(async () => {
    const { MIRROR } = await import("/src/live/relief.js");
    const p = window.__splashery.player;
    const height = (2 * MIRROR.rows) / MIRROR.cols;
    const pts = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([u, v]) => p.screenPoint([(u - 0.5) * 2, (0.5 - v) * height, 0]));
    const r = document.getElementById("stage").getBoundingClientRect();
    const xs = pts.map((q) => q[0] + r.left);
    const ys = pts.map((q) => q[1] + r.top);
    const x = Math.max(0, Math.min(...xs));
    const y = Math.max(0, Math.min(...ys));
    return { x, y, width: Math.min(r.right, Math.max(...xs)) - x, height: Math.min(r.bottom, Math.max(...ys)) - y }; // prettier-ignore
  });
}

// The hologram's additions over the face: each face cell against a plain
// cyan tint of its colors (what the look would be with nothing on top).
export async function overFace(page) {
  return page.evaluate(async (F) => {
    const { MIRROR, mirrorScreen } = await import("/src/live/relief.js");
    const cols = MIRROR.cols;
    const rows = MIRROR.rows;
    const c = document.createElement("canvas");
    c.width = mirrorScreen.width;
    c.height = mirrorScreen.height;
    const g = c.getContext("2d");
    mirrorScreen.draw(g, performance.now() / 1000);
    const holo = g.getImageData(0, 0, cols, rows).data;
    const src = MIRROR.cam.lastColors;
    // The plain tint: the brightness, as the look colors it.
    const ys = [];
    const hs = [];
    for (let j = Math.floor(F.y0 * rows); j < F.y1 * rows; j++)
      for (let i = Math.floor(F.x0 * cols); i < F.x1 * cols; i++) {
        const k = (j * cols + i) * 4;
        ys.push((0.3 * src[k] + 0.59 * src[k + 1] + 0.11 * src[k + 2]) / 255);
        hs.push(holo[k + 1] / 255);
      }
    // Fit hs ≈ a + b·ys (any plain tint), and report what the fit can't
    // explain (lines, glows): the mean leftover, 0..255.
    const n = ys.length;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const mh = hs.reduce((s, v) => s + v, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (ys[i] - my) * (hs[i] - mh);
      sxx += (ys[i] - my) ** 2;
    }
    const b = sxx > 0 ? sxy / sxx : 0;
    let left = 0;
    for (let i = 0; i < n; i++) left += Math.abs(hs[i] - (mh + b * (ys[i] - my)));
    return (left / n) * 255;
  }, FACE);
}

// The command line: prints the numbers.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : def;
  };
  const [y4m] = args.filter((a) => !a.startsWith("--"));
  const look = opt("look", "plain");
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: fakeCamera(y4m, ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]), // prettier-ignore
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // prettier-ignore
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await openMirror(page, process.env.SPLASHERY_URL || "http://127.0.0.1:4173/", { look, query: opt("query", "") }); // prettier-ignore
  const m = args.includes("--still-only") ? {} : await measure(page, { answers: Number(opt("answers", 10)), dump: opt("dump", null) }); // prettier-ignore
  if (look === "hologram" && !args.includes("--still-only")) m.overFace = await overFace(page);
  // (--still-secs=6: also how still it holds, the whole picture; see stillness.)
  if (opt("still-secs", ""))
    m.still = await stillness(page, { secs: Number(opt("still-secs", 6)) });
  console.log(JSON.stringify({ look, ...m }, null, 1));
  await browser.close();
}
