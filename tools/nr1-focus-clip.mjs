// Lane NR1: renders the Neuron specimen's focus sweep as a looping GIF, for judging the merge
// as motion at phone size (tools/effect-clip.mjs films taps, not a slider).
//
//   node tools/cdx-mp2-server.mjs 4173 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/nr1-focus-clip.mjs <out-dir> [--size=320] [--secs=6] [--fps=15] [--low=0] [--stain=nissl] [--profile=high] [--strip=8]
//
// Writes <out-dir>/focus-<stain>.gif: Focus eases from 1 down to --low and back, so the slide
// goes out of focus (pairs of splats merging, level by level) and comes back. --strip=8 also
// writes <out-dir>/focus-<stain>-strip.png.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/nr1-focus-clip.mjs <out-dir> [--stain=nissl]");
const size = Number(opt("size", 320));
const secs = Number(opt("secs", 6));
const fps = Number(opt("fps", 15));
const low = Number(opt("low", 0));
const stain = opt("stain", "nissl");
const profile = opt("profile", "high");
const stripN = Number(opt("strip", 0));

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?labs=1&renderer=webgl2&profile=${profile}&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const { bytes, strip } = await page.evaluate(
  async ({ size, secs, fps, low, stain, stripN }) => {
    const { app, player } = window.__splashery;
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    await app.chooseToy("specimen-neuron");
    await app.setToyOption("stain", stain);
    app.setLook({ background: "#111111" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    player.camera.setTurntable(false);
    const stage = player.stage;
    stage.setFixedSize([size, size]);
    const gif = GIFEncoder();
    const n = Math.round(secs * fps);
    const picks = new Set(Array.from({ length: stripN }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, stripN - 1)))); // prettier-ignore
    const shots = [];
    for (let i = 0; i < n; i++) {
      // Out and back with a gentle ease, holding a moment in focus at each end.
      const u = Math.min(1, Math.max(0, (i / (n - 1) - 0.08) / 0.84));
      const focus = 1 - (1 - low) * (0.5 - 0.5 * Math.cos(2 * Math.PI * u));
      player.motion.setControl("focus", focus, { snap: true });
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      await stage.captureFrame();
      const c = await stage.captureFrame();
      if (picks.has(i)) shots.push({ bmp: await createImageBitmap(c), focus });
      const rgba = c.getContext("2d").getImageData(0, 0, size, size).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, size, { palette, delay: Math.round(1000 / fps), repeat: 0 }); // prettier-ignore
    }
    gif.finish();
    stage.setFixedSize(null);
    let strip = null;
    if (shots.length) {
      const out = document.createElement("canvas");
      out.width = size * shots.length;
      out.height = size + 18;
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#bbb";
      shots.forEach((s, i) => {
        ctx.drawImage(s.bmp, i * size, 0, size, size);
        ctx.fillText(`focus ${s.focus.toFixed(2)}`, i * size + 6, size + 13);
      });
      strip = out.toDataURL("image/png");
    }
    return { bytes: Array.from(gif.bytes()), strip };
  },
  { size, secs, fps, low, stain, stripN },
);
const file = path.join(outDir, `focus-${stain}.gif`);
fs.writeFileSync(file, Buffer.from(bytes));
if (strip)
  fs.writeFileSync(
    path.join(outDir, `focus-${stain}-strip.png`),
    Buffer.from(strip.split(",")[1], "base64"),
  );
console.log(`focus-${stain}: ${file} (${Math.round(bytes.length / 1024)} KB)`);
await browser.close();
