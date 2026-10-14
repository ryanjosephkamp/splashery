#!/usr/bin/env node
// Lane QR r3: does the code scan while it moves and while its colors live?
// Drives the QR toy's test hook (window.__splashery.qr.frame, docs/handoff/
// QRr3.md) and reads every picture with the scan lab's two readers (jsQR and
// zxing-js, tools/qr-scan-lab/readers.mjs): a picture counts only when both
// return the exact text. Glowing Neon (light on dark) is read by their
// inverted passes.
//
//   node tools/qr3-scan.mjs motions [--styles=classic,dots] [--motions=ripple,fold] [--steps=10]
//   node tools/qr3-scan.mjs alive [--styles=...] [--patterns=wave,current] [--frames=12]
//   node tools/qr3-scan.mjs themes [--themes=...] [--styles=classic,...]
//   options: --out=dir (pictures and results.json), --set='{"fg":"#123"}'
//
// motions: the frames at progress 0, 1/steps, …, 1, front on, read at the full
//   1024 px render and shrunk to 8 px per module (phone size); the last frame
//   also through the scan lab's phone-like captures.
// alive: `frames` phases of one loop of each pattern, front on and turned 10°
//   and 20° in yaw, at 8 px per module (and full size).
// themes: each color theme (src/qr/themes.js) in each style: its measured
//   contrast, the flat render through the phone-like captures, and the toy's
//   own camera turned 10° and 20°.
//
// Needs the local server (python3 -m http.server 4173 --bind 127.0.0.1) and
// SPLASHERY_CHROMIUM.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { readers, invertedReaders } from "./qr-scan-lab/readers.mjs";
import { applyCondition, conditions, resize } from "./qr-scan-lab/sim.mjs";

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith("--")) || "motions";
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const TEXT = "https://ryanjosephkamp.github.io/splashery/";
const out = opt("out", "");
const PX = Number(opt("px", 1024));
// The scan lab's phone-like captures (its report's "realistic" set).
const PHONE = ["front", "tilt20", "mod4", "mod6", "blur20", "jpeg30", "light30", "persp", "phone"];
const CONDS = conditions().filter((c) => PHONE.includes(c.id));
if (out) fs.mkdirSync(out, { recursive: true });

const toImage = (url) => {
  const png = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
};
const both = (set, img) => set.jsqr(img) === TEXT && set.zxing(img) === TEXT;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on(
  "console",
  (m) => m.type() === "error" && console.error("console:", m.text().slice(0, 300)),
);
await page.goto(`${BASE}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
await page.evaluate(() => (window.__splashery.qr.autoCheck = false));

const allStyles = ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon", "neon-light"];
const styles = opt("styles", allStyles.join(",")).split(",");
const extra = JSON.parse(opt("set", "{}"));
const results = [];

async function setUp(o) {
  const info = await page.evaluate(async (o) => {
    await window.__splashery.qr.set(o);
    await window.__splashery.qr.check();
    return window.__splashery.qr.info();
  }, o);
  return info;
}
const frame = (o) => page.evaluate((o) => window.__splashery.qr.frame(o), o).then(toImage);
const save = (name, img) => {
  if (!out) return;
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  fs.writeFileSync(`${out}/${name}.png`, PNG.sync.write(png));
};

if (mode === "motions") {
  const motions = opt("motions", (await page.evaluate(() => window.__splashery.qr.motions())).join(",")).split(","); // prettier-ignore
  const steps = Number(opt("steps", 10));
  for (const style of styles) {
    const info = await setUp({ style, text: TEXT, ...extra });
    const set = style === "neon" ? invertedReaders : readers;
    const modules = info.size + 10;
    for (const motion of motions) {
      const row = { style, motion, frames: [], phone: null };
      for (let i = 0; i <= steps; i++) {
        const q = i / steps;
        const img = await frame({ motion, q, size: PX });
        const small = resize(img, 8 * modules);
        row.frames.push({ q, full: both(set, img) ? 1 : 0, phone: both(set, small) ? 1 : 0 });
        if (out) save(`${style}-${motion}-${String(i).padStart(2, "0")}`, small);
        if (i === steps) {
          let n = 0;
          for (const c of CONDS) n += both(set, applyCondition(img, modules, c)) ? 1 : 0;
          row.phone = `${n}/${CONDS.length}`;
        }
      }
      const reads = row.frames.filter((f) => f.phone).map((f) => f.q.toFixed(1));
      console.log(`${style.padEnd(11)} ${motion.padEnd(9)} reads at 8 px/module: ${reads.length}/${row.frames.length} [${reads.join(" ")}]  end frame phone-like ${row.phone}`); // prettier-ignore
      results.push(row);
    }
  }
} else if (mode === "alive") {
  const patterns = opt("patterns", (await page.evaluate(() => window.__splashery.qr.patterns())).join(",")).split(","); // prettier-ignore
  const frames = Number(opt("frames", 12));
  for (const style of styles) {
    for (const pattern of patterns) {
      const info = await setUp({ style, text: TEXT, alivePattern: pattern, ...extra });
      const set = style === "neon" ? invertedReaders : readers;
      const row = { style, pattern, yaw: {} };
      for (const yaw of [0, 10, 20]) {
        let full = 0;
        let phone = 0;
        const modules = info.size + (yaw ? 12 : 10);
        for (let k = 0; k < frames; k++) {
          const phase = (2 * Math.PI * k) / frames;
          const img = await frame({ alive: 1, phase, size: PX, yaw, margin: yaw ? 2 : 1 });
          const small = resize(img, 8 * modules);
          full += both(set, img) ? 1 : 0;
          phone += both(set, small) ? 1 : 0;
          if (out && yaw === 0) save(`${style}-${pattern}-${String(k).padStart(2, "0")}`, small);
        }
        row.yaw[yaw] = { full, phone, of: frames };
      }
      const y = row.yaw;
      console.log(`${style.padEnd(11)} ${pattern.padEnd(8)} 8 px/module: front ${y[0].phone}/${frames}, 10° ${y[10].phone}/${frames}, 20° ${y[20].phone}/${frames}  (full size ${y[0].full}, ${y[10].full}, ${y[20].full})`); // prettier-ignore
      results.push(row);
    }
  }
} else if (mode === "themes") {
  const { THEMES } = await import("../src/qr/themes.js");
  const want = opt("themes", "");
  const list = THEMES.filter((t) => !want || want.split(",").includes(t.id));
  for (const theme of list) {
    for (const style of opt("styles", "classic").split(",")) {
      const info = await page.evaluate(async ({ id, style, text }) => {
        const qr = window.__splashery.qr;
        await qr.set({ style, text });
        await qr.theme(id);
        await qr.check();
        return qr.info();
      }, { id: theme.id, style, text: TEXT }); // prettier-ignore
      const inverted = info.warnings.some((w) => /inverted|light on dark/i.test(w));
      const set = inverted ? invertedReaders : readers;
      const modules = info.size + 10;
      const img = await frame({ size: PX });
      let n = 0;
      for (const c of CONDS) n += both(set, applyCondition(img, modules, c)) ? 1 : 0;
      const cams = [];
      for (const yaw of [10, 20]) {
        const t = await frame({ size: PX, yaw, margin: 2 });
        cams.push(both(set, resize(t, 8 * (info.size + 12))) ? 1 : 0);
      }
      const row = { theme: theme.id, style, contrast: info.contrast, check: !!info.check?.ok, phone: `${n}/${CONDS.length}`, cams }; // prettier-ignore
      if (out) save(`${theme.id}-${style}`, resize(img, 8 * modules));
      console.log(`${theme.id.padEnd(14)} ${style.padEnd(10)} contrast ${Number(info.contrast).toFixed(2)}:1  check ${row.check ? "✓" : "✗"}  phone-like ${row.phone}  turned 10° ${cams[0] ? "✓" : "✗"} 20° ${cams[1] ? "✓" : "✗"}`); // prettier-ignore
      results.push(row);
    }
  }
}
if (out) fs.writeFileSync(`${out}/results-${mode}.json`, JSON.stringify(results, null, 1));
await browser.close();
