#!/usr/bin/env node
// Lane QR lab r2: clips of the QR lab toys at phone size, for the Effect
// review page. Like tools/effect-clip.mjs, the clock is stepped by hand, so a
// clip shows each motion at its real speed however slow the renderer is. Each
// clip is a script of steps (rebuild with options and fire a control, wait,
// read the Damage lab's meter, read the three codes), and a caption bar under
// the stage says what is happening, with the meter's numbers as the toy
// computes them.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/qrs-clip.mjs <out-dir> [--size=360] [--fps=12] [clip ...]
//
// Clips: anatomy-parts, anatomy-pop, anatomy-encode, anatomy-encode-pop, damage-spread, damage-levels,
// damage-heal, damage-tear-burn, damage-splats, three. Writes <out-dir>/qrs-<clip>.gif and
// a strip of 8 frames, <out-dir>/qrs-<clip>-strip.png.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const outDir = args.find((a) => !a.startsWith("--")) || ".cache/qrs-clips";
const size = Number(opt("size", 360));
const fps = Number(opt("fps", 12));
const all = ["anatomy-parts", "anatomy-pop", "anatomy-encode-pop", "anatomy-encode", "damage-spread", "damage-levels", "damage-heal", "damage-tear-burn", "damage-splats", "three"]; // prettier-ignore
const pick = args.filter((a) => !a.startsWith("--")).slice(1);
const clips = pick.length ? pick : all;
fs.mkdirSync(outDir, { recursive: true });

const URL0 = "https://ryanjosephkamp.github.io/splashery/";

// Each step: { toy } | { opts, key, cap } | { wait, cap } | { check } | { read3 } | { act } | { set: [key, value] }
const SCRIPTS = {
  "anatomy-parts": [
    { toy: "qr-anatomy" },
    {
      opts: { view: "parts", part: "", text: "HELLO WORLD", level: "Q" },
      key: "lift",
      cap: "A real QR code: version 1, level Q",
    },
    { wait: 1.2 },
    ...["finder", "separator", "timing", "format", "dark", "data", "ecc", "mask"].flatMap((p) => [{ opts: { view: "parts", part: p }, key: "lift", cap: `part:${p}` }, { wait: 1.6 }]), // prettier-ignore
  ],
  "anatomy-pop": [
    { toy: "qr-anatomy" },
    { opts: { view: "parts", part: "", text: "HELLO WORLD", level: "Q", pop: true }, key: "lift", cap: "Pop the lit part out: on" }, // prettier-ignore
    { wait: 0.8 },
    ...["finder", "timing", "format", "data", "ecc"].flatMap((p) => [{ opts: { view: "parts", part: p }, key: "lift", cap: `part:${p}` }, { wait: 2.2 }]), // prettier-ignore
    { opts: { view: "encode", step: "mode" }, key: "lift", cap: "step:mode" },
    { wait: 2.2 },
  ],
  "anatomy-encode": [
    { toy: "qr-anatomy" },
    ...["mode", "count", "data", "pad", "ecc", "blocks"].flatMap((st) => [{ opts: { view: "encode", step: st, text: "HELLO WORLD", level: "Q" }, key: "lift", cap: `step:${st}` }, { wait: 1.5 }]), // prettier-ignore
    { opts: { view: "encode", step: "place" }, key: "place", cap: "step:place" },
    { wait: 6.4 },
    { opts: { view: "encode", step: "mask3" }, key: "mask", cap: "step:mask3" },
    { wait: 2.8 },
    { opts: { view: "encode", step: "chosen" }, key: "lift", cap: "step:chosen" },
    { wait: 1.6 },
    { opts: { view: "encode", step: "format" }, key: "lift", cap: "step:format" },
    { wait: 1.6 },
  ],
  "anatomy-encode-pop": [
    { toy: "qr-anatomy" },
    ...["mode", "count", "data", "pad", "ecc", "blocks"].flatMap((st) => [{ opts: { view: "encode", step: st, text: "HELLO WORLD", level: "Q", pop: true }, key: "lift", cap: `step:${st}` }, { wait: 1.5 }]), // prettier-ignore
    { opts: { view: "encode", step: "place" }, key: "place", cap: "step:place" },
    { wait: 6.4 },
    { opts: { view: "encode", step: "mask3" }, key: "mask", cap: "step:mask3" },
    { wait: 2.8 },
    { opts: { view: "encode", step: "chosen" }, key: "lift", cap: "step:chosen" },
    { wait: 1.6 },
    { opts: { view: "encode", step: "format" }, key: "lift", cap: "step:format" },
    { wait: 1.6 },
  ],
  "damage-spread": [
    { toy: "qr-damage" },
    {
      opts: { damage: "", level: "M", show: "damaged", tool: "scratch", region: "all", text: URL0 },
      key: "drop",
    },
    { wait: 0.6 },
    { check: true },
    { wait: 0.8 },
    ...Array.from({ length: 7 }, (_, i) => [{ opts: { damage: `scratch:${((i + 1) * 0.12).toFixed(2)}:all:1;smudge:${(i * 0.08).toFixed(2)}:center:2` }, key: "drop" }, { wait: 0.9 }, { check: true }, { wait: 0.9 }]).flat(), // prettier-ignore
  ],
  "damage-levels": [
    { toy: "qr-damage" },
    { opts: { damage: "", level: "all", show: "damaged", text: URL0 }, key: "drop" },
    { wait: 0.6 },
    { check: true },
    { wait: 0.8 },
    ...[0.25, 0.35, 0.45, 0.55, 0.62, 0.7].flatMap((a) => [{ opts: { damage: `sticker:${a}:center:1` }, key: "drop" }, { wait: 1.0 }, { check: true }, { wait: 0.9 }]), // prettier-ignore
  ],
  "damage-heal": [
    { toy: "qr-damage" },
    { opts: { damage: "sticker:0.24:finder:1;scratch:0.42:all:2", level: "M", show: "damaged", text: URL0 }, key: "drop" }, // prettier-ignore
    { wait: 1.2 },
    { check: true },
    { wait: 1.2 },
    { heal: true },
    { wait: 6.5 },
    { check: true },
    { wait: 1.2 },
  ],
  "damage-tear-burn": [
    { toy: "qr-damage" },
    { opts: { damage: "", level: "M", show: "damaged", text: URL0 }, key: "drop" },
    { wait: 0.6 },
    {
      opts: { damage: "tear:0.3:corner:1" },
      key: "drop",
      cap: "Tear: the corner peels up and falls away",
    },
    { wait: 2.2 },
    { check: true },
    { wait: 0.8 },
    {
      opts: { damage: "tear:0.3:corner:1;burn:0.3:finder:3" },
      key: "drop",
      cap: "Burn: the corner chars and crumbles",
    },
    { wait: 2.4 },
    { check: true },
    { wait: 1.0 },
  ],
  "damage-splats": [
    { toy: "qr-damage" },
    { opts: { damage: "", level: "M", show: "damaged", text: URL0 }, key: "drop" },
    { wait: 0.4 },
    { check: true },
    ...[0.15, 0.3, 0.45].flatMap((v) => [{ set: ["wave", v], cap: `Move in time: modules moving up to ${(v * 0.6).toFixed(2)} modules` }, { wait: 1.2 }, { check: true }]), // prettier-ignore
    { set: ["wave", 0] },
    ...[0.25, 0.5].flatMap((v) => [{ set: ["curve", v], cap: `Curve: bent through ${Math.round(v * 200)}°` }, { wait: 0.8 }, { check: true }]), // prettier-ignore
    { set: ["curve", 0] },
    ...[0.25, 0.5, 0.7].flatMap((v) => [{ set: ["tilt", v], cap: `Tilt: turned ${Math.round(v * 80)}° away` }, { wait: 0.8 }, { check: true }]), // prettier-ignore
    { set: ["tilt", 0] },
    { opts: { damage: "blur:0.6:all:1" }, key: "drop", cap: "Blur: splats 2.8 times as wide" },
    { wait: 0.8 },
    { check: true },
    { opts: { damage: "shrink:0.5:all:1" }, key: "drop", cap: "Shrink: splats 58% of their size" },
    { wait: 0.8 },
    { check: true },
    { wait: 0.6 },
  ],
  three: [
    { toy: "qr-three" },
    { read3: true },
    { wait: 1.0 },
    { act: true, cap: "Pulled apart: the red, green and blue codes" },
    { wait: 4.6 },
    { read3: true },
    { wait: 1.2 },
  ],
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto("http://127.0.0.1:4173/?renderer=webgl2&profile=high&adapt=off&labs=1");
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

for (const clip of clips) {
  const script = SCRIPTS[clip];
  if (!script) throw new Error(`No clip ${clip}`);
  const res = await page.evaluate(
    async ({ script, size, fps }) => {
      const { app, player } = window.__splashery;
      // The pack's hook appears once its first toy loads.
      let lab = window.__splashery.qrLab;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const BAR = 76;
      const stage = player.stage;
      const step = 1 / fps;
      const gif = GIFEncoder();
      const shots = [];
      let caption = "";
      let meter = "";
      let pending = 0;
      let hooked = null;
      const hook = () => {
        hooked = stage.updateHandlers.slice();
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(() => {
          const d = pending;
          pending = 0;
          for (const h of hooked) h(d);
        });
        stage.setFixedSize([size, size]);
      };
      const unhook = () => {
        if (!hooked) return;
        stage.setFixedSize(null);
        stage.updateHandlers.length = 0;
        stage.updateHandlers.push(...hooked);
        hooked = null;
      };
      const out = document.createElement("canvas");
      out.width = size;
      out.height = size + BAR;
      const g = out.getContext("2d", { willReadFrequently: true });
      const wrap = (text, x, y, w, lh) => {
        const words = text.split(" ");
        let line = "";
        for (const wd of words) {
          if (g.measureText(line + wd).width > w && line) {
            g.fillText(line, x, y);
            y += lh;
            line = "";
          }
          line += wd + " ";
        }
        g.fillText(line, x, y);
      };
      const frames = [];
      const frame = async () => {
        pending = step;
        player.camera.cur = { ...player.camera.home };
        player.camera.tgt = { ...player.camera.home };
        await stage.captureFrame();
        pending = 0;
        const c = await stage.captureFrame();
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, size, size + BAR);
        g.drawImage(c, 0, 0, size, size);
        g.fillStyle = "#f2f2f2";
        g.fillRect(0, size, size, BAR);
        g.fillStyle = "#111";
        g.font = "600 13px sans-serif";
        wrap(caption, 8, size + 17, size - 16, 16);
        g.font = "12px sans-serif";
        g.fillStyle = meter.startsWith("✗")
          ? "#b3261e"
          : meter.startsWith("✓")
            ? "#1d6b3a"
            : "#222";
        wrap(meter, 8, size + 52, size - 16, 15);
        frames.push(g.getImageData(0, 0, size, size + BAR).data.slice());
      };
      const wait = async (secs) => {
        for (let t = 0; t < secs - 1e-6; t += step) await frame();
      };
      const describe = (c) => {
        const levels = lab.damage().codes.map((x) => x.level);
        if (c.codes.length === 1) {
          const r = c.codes[0];
          const b = r.analysis.blocks.map((x) => `${x.lost}/${x.fixable}`).join(", ");
          return `${r.scans ? "✓ Scans" : "✗ Doesn't scan"} (jsQR). Lost/fixable codewords per block: ${b}.`;
        }
        return c.codes.map((r, i) => `${levels[i]} ${r.scans ? "✓" : "✗"} (${r.analysis.blocks.map((x) => `${x.lost}/${x.fixable}`).join(",")})`).join("   "); // prettier-ignore
      };
      const parts = { finder: "Finder patterns: how a scanner finds the code", separator: "Separators: a light border around each finder", timing: "Timing patterns: the grid's ruler", format: "Format information: level Q, mask, 15 bits twice", dark: "The dark module: always dark", data: "Data codewords: the text", ecc: "Error correction codewords (Reed–Solomon)", mask: "The mask: the modules it turned over" }; // prettier-ignore
      const stepCap = (id) => {
        const s = lab.anatomy().steps;
        const m = { mode: `1. Mode: ${s.modeName.toLowerCase()} (${s.bits.mode})`, count: `2. Count: ${s.count} → ${s.bits.count}`, data: `3. Data bits: ${s.bits.data.length} bits`, pad: `4. Terminator and ${s.padBytes.length} pad bytes`, ecc: `5. Error correction: ${s.eccPerBlock} codewords`, blocks: `6. ${s.blocks.length} block(s), interleaved`, place: "7. Placement along the zigzag", chosen: `9. Mask ${s.mask} wins (penalty ${s.masks[s.mask].penalty.total})`, format: `10. Format information: ${s.format.toString(2).padStart(15, "0")}` }; // prettier-ignore
        if (id.startsWith("mask"))
          return `8. Mask ${id.slice(4)}: penalty ${s.masks[Number(id.slice(4))].penalty.total}`;
        return m[id] || id;
      };
      hook();
      for (const st of script) {
        if (st.toy) {
          unhook();
          await app.chooseToy(st.toy);
          lab = window.__splashery.qrLab;
          lab.autoCheck = false;
          app.setLook({ background: "#ffffff" });
          player.opts.idleDelay = 1e9;
          player.idle.weight = 0;
          await new Promise((r) => setTimeout(r, 1200));
          hook();
          pending = 0.5;
          await stage.captureFrame();
        }
        if (st.opts) {
          unhook();
          // A step that adds damage: only what it adds moves.
          if (st.opts.damage !== undefined && lab.damage)
            lab.setPrev(lab.damage().options?.damage ?? "");
          await player.switchTo({ options: st.opts, key: st.key, value: 1 });
          hook();
          pending = 0;
          await stage.captureFrame();
          meter = "";
        }
        if (st.set) player.setControl(st.set[0], st.set[1]);
        if (st.act) player.act();
        if (st.heal) {
          unhook();
          await lab.heal();
          hook();
          caption = "Heal it: what the reader read (red: read wrong), set right block by block";
        }
        if (st.cap) caption = st.cap.startsWith("part:") ? parts[st.cap.slice(5)] : st.cap.startsWith("step:") ? stepCap(st.cap.slice(5)) : st.cap; // prettier-ignore
        if (st.check) {
          unhook();
          const c = await lab.checkDamage();
          hook();
          meter = describe(c);
          if (!caption) caption = "The Damage lab";
        }
        if (st.read3) {
          unhook();
          const r = await lab.readThree();
          hook();
          meter = `Split reader: R ${r.split[0] ? "✓" : "✗"}  G ${r.split[1] ? "✓" : "✗"}  B ${r.split[2] ? "✓" : "✗"}. Plain reader: ${r.plain === null ? "nothing" : r.plain === lab.three().rgb.texts[1] ? "the green code" : "“" + r.plain + "”"}.`; // prettier-ignore
          if (!caption) caption = "Three QR codes in one square (red, green, blue)";
        }
        if (st.wait) await wait(st.wait);
      }
      unhook();
      const delay = Math.round(1000 / fps);
      const H = size + BAR;
      frames.forEach((rgba, i) => {
        const palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, H, { palette, delay, repeat: 0 }); // prettier-ignore
      });
      gif.finish();
      // A strip of 8 frames.
      const strip = document.createElement("canvas");
      const n = Math.min(8, frames.length);
      strip.width = size * n;
      strip.height = H;
      const sg = strip.getContext("2d");
      for (let i = 0; i < n; i++) {
        const k = Math.round((i / Math.max(1, n - 1)) * (frames.length - 1));
        sg.putImageData(new ImageData(new Uint8ClampedArray(frames[k]), size, H), i * size, 0);
      }
      return {
        bytes: Array.from(gif.bytes()),
        strip: strip.toDataURL("image/png"),
        frames: frames.length,
      };
    },
    { script, size, fps },
  );
  const out = path.join(outDir, `qrs-${clip}.gif`);
  fs.writeFileSync(out, Buffer.from(res.bytes));
  fs.writeFileSync(path.join(outDir, `qrs-${clip}-strip.png`), Buffer.from(res.strip.split(",")[1], "base64")); // prettier-ignore
  console.log(`${clip}: ${out} (${res.frames} frames, ${(res.bytes.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
