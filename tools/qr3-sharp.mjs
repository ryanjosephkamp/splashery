#!/usr/bin/env node
// Lane QR r3: how crisp are the QR toy's modules on screen? Opens the toy in
// Scan view at phone size (390×844 CSS px at a pixel ratio of 2, as most
// phones draw) and desktop size (1440×900 at 1), screenshots the code and
// measures, per style:
//
// - edge: the median 10–90% rise across every boundary between a dark and a
//   light module, along rows and columns through module centers, in CSS
//   pixels (lower is crisper);
// - in-module noise: the mean standard deviation of gray over the middle 60%
//   of each dark and each light module, in gray levels (0..255; lower is
//   cleaner);
// - margin: the median gray of the light modules minus that of the dark ones.
//
//   node tools/qr3-sharp.mjs [--styles=classic,dots] [--url-extra=&kernel=sharp]
//     [--tune='{"m":7}'] [--label=name] [--out=dir]
//
// --tune sets build knobs (src/qr/build.js, TUNE) before the code is built.
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1) and
// SPLASHERY_CHROMIUM.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const styles = opt("styles", "classic,dots,rounded,bricks,gems,bubbles,neon-light").split(",");
const extra = opt("url-extra", "");
const tune = JSON.parse(opt("tune", "{}"));
const label = opt("label", "now");
const out = opt("out", "");
const VIEWS = [
  { id: "phone", width: 390, height: 844, dpr: 2 },
  { id: "desktop", width: 1440, height: 900, dpr: 1 },
];
const QUIET = 4;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : NaN;
};

// The screenshot's gray at CSS position (x, y), bilinear.
function sampler(png, dpr) {
  const g = (x, y) => {
    const i = (y * png.width + x) * 4;
    return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  };
  return (cx, cy) => {
    const x = Math.min(png.width - 1.001, Math.max(0, cx * dpr - 0.5));
    const y = Math.min(png.height - 1.001, Math.max(0, cy * dpr - 0.5));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    return (
      g(x0, y0) * (1 - fx) * (1 - fy) +
      g(x0 + 1, y0) * fx * (1 - fy) +
      g(x0, y0 + 1) * (1 - fx) * fy +
      g(x0 + 1, y0 + 1) * fx * fy
    );
  };
}

function measure(png, dpr, rect, N, dark) {
  const at = sampler(png, dpr);
  const mod = rect.width / (N + 2 * QUIET);
  const cx = (c) => rect.x - rect.x + (c + QUIET + 0.5) * mod; // relative to the clip
  const cy = (r) => (r + QUIET + 0.5) * mod;
  const isDark = (r, c) => r >= 0 && c >= 0 && r < N && c < N && dark[r * N + c] === 1;
  const edges = [];
  // A profile across the boundary between (r, c) and the next module along
  // (dr, dc): 10% and 90% crossings between the two module centers' levels.
  const step = 0.25 / dpr; // quarter device pixel
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        const a = isDark(r, c);
        const b = isDark(r + dr, c + dc);
        if (a === b || r + dr >= N || c + dc >= N) continue;
        const x0 = cx(c);
        const y0 = cy(r);
        const prof = [];
        for (let t = 0; t <= mod; t += step) prof.push(at(x0 + dc * t, y0 + dr * t));
        const lo = Math.min(prof[0], prof.at(-1));
        const hi = Math.max(prof[0], prof.at(-1));
        if (hi - lo < 40) continue;
        const rising = prof.at(-1) > prof[0];
        const cross = (f) => {
          const v = lo + (hi - lo) * f;
          for (let i = 1; i < prof.length; i++) {
            const p = rising ? prof[i - 1] : -prof[i - 1];
            const q = rising ? prof[i] : -prof[i];
            const w = rising ? v : -v;
            if (p < w && q >= w) return (i - 1 + (w - p) / (q - p)) * step;
          }
          return NaN;
        };
        const ta = rising ? cross(0.1) : cross(0.9);
        const tb = rising ? cross(0.9) : cross(0.1);
        const w = Math.abs(tb - ta);
        if (Number.isFinite(w)) edges.push(w);
      }
  // Noise inside modules and the gray margin.
  const noise = [];
  const dk = [];
  const lt = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const vals = [];
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) vals.push(at(cx(c) + (i / 10) * mod, cy(r) + (j / 10) * mod));
      const m = vals.reduce((s, v) => s + v, 0) / vals.length;
      noise.push(Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length));
      (isDark(r, c) ? dk : lt).push(m);
    }
  return {
    edge: median(edges),
    edges: edges.length,
    noise: noise.reduce((s, v) => s + v, 0) / noise.length,
    margin: median(lt) - median(dk),
    modulePx: mod,
  };
}

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const rows = [];
for (const v of VIEWS) {
  const page = await browser.newPage({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${BASE}?renderer=webgl2&adapt=off&profile=mid&labs=1${extra}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (tune) => {
    const b = await import("/src/qr/build.js");
    if (b.TUNE) Object.assign(b.TUNE, tune);
  }, tune);
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
  await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
  await page.evaluate(() => (window.__splashery.qr.autoCheck = false));
  // The toy's first build settles its camera over a few frames.
  await page.waitForTimeout(2000);
  for (const style of styles) {
    await page.evaluate((style) => window.__splashery.qr.set({ style }), style);
    // Wait until the camera has settled in Scan view (the rect stops moving).
    let last = "";
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      const r = JSON.stringify(await page.evaluate(() => window.__splashery.qr.screenRect()));
      if (r === last) break;
      last = r;
    }
    const info = await page.evaluate(async () => {
      const { encodeQR } = await import("/src/qr/encode.js");
      const i = window.__splashery.qr.info();
      const code = encodeQR(i.text, i.options.ecc === "auto" || !i.options.ecc ? "M" : i.options.ecc); // prettier-ignore
      return { rect: window.__splashery.qr.screenRect(), N: code.size, dark: Array.from(code.dark), splats: window.__splashery.app.player.proc?.ctx?.buf?.count, perModule: window.__splashery.app.player.proc?.ctx?.kit?.data?.perModule }; // prettier-ignore
    });
    const clip = {
      x: Math.round(info.rect.x),
      y: Math.round(info.rect.y),
      width: Math.round(info.rect.width),
      height: Math.round(info.rect.height),
    };
    const buf = await page.screenshot({ clip });
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(`${out}/${label}-${style}-${v.id}.png`, buf);
    }
    const png = PNG.sync.read(buf);
    const m = measure(png, v.dpr, { ...info.rect, width: clip.width }, info.N, info.dark);
    const row = { label, view: v.id, style, ...m, splats: info.splats, perModule: info.perModule };
    rows.push(row);
    console.log(
      `${label.padEnd(10)} ${v.id.padEnd(8)} ${style.padEnd(11)} edge ${m.edge.toFixed(2)} css px (${m.edges})  noise ${m.noise.toFixed(1)}  margin ${m.margin.toFixed(0)}  module ${m.modulePx.toFixed(1)} css px  m=${info.perModule} splats=${info.splats}`, // prettier-ignore
    );
  }
  await page.close();
}
await browser.close();
if (out) fs.writeFileSync(`${out}/${label}.json`, JSON.stringify(rows, null, 1));
