#!/usr/bin/env node
// The Alive loop: a color wave that rolls across the code while its gray, what a reader sees,
// stays the same. Samples frames of each style's loop front-on and turned 10 and 20 degrees in
// yaw (the toy's own camera), and reads each with both readers. Writes data/alive-results.csv.
//   SPLASHERY_CHROMIUM=... node tools/qr-scan-lab/alive.mjs [--frames=12] [--styles=a,b] [--px=1024]
import fs from "node:fs";
import { PNG } from "pngjs";
import { toySource, TOY_STYLES } from "./toy-source.mjs";
import { readers, invertedReaders } from "./readers.mjs";
import { resize } from "./sim.mjs";

const args = process.argv.slice(2);
const opt = (name, def) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? def;
const TEXT = "https://ryanjosephkamp.github.io/splashery/";
const frames = Number(opt("frames", 12));
const px = Number(opt("px", 1024));
const src = await toySource({ opt: (n, d) => ({ "cam-styles": "none" })[n] ?? d });
const page = src.page;
const styles = opt("styles", TOY_STYLES.join(",")).split(",");
const LOOP = 44; // frames in the toy's own looping GIF; one period of the wave
const out = ["style,yaw,frame,aliveMoved,jsqr,zxing,jsqr_inv,zxing_inv,jsqr_8px,zxing_8px"];
for (const style of styles) {
  const info = await page.evaluate(
    async ({ style, text }) => {
      await window.__splashery.qr.set({ style, text, ecc: "auto", alive: 1 });
      await window.__splashery.qr.check();
      const i = window.__splashery.qr.info();
      return { size: i.size, options: i.options };
    },
    { style, text: TEXT },
  );
  await page.waitForTimeout(2500); // the Alive switch eases in over a moment
  for (const yaw of [0, 10, 20]) {
    let prev = null;
    for (let k = 0; k < frames; k++) {
      const f = Math.round((k * LOOP) / frames);
      const b64 = await page.evaluate(
        async ({ f, yaw, px }) => {
          const { app, qr } = window.__splashery;
          return app.withCapture([px, px], async () => {
            const dt = (2 * Math.PI) / 1.8 / 44;
            const pose = { ...qr.scanPose(yaw ? 2 : 1), yaw: (yaw * Math.PI) / 180 };
            const shot = await app.player.renderAt(app.player.time + f * dt, pose);
            return shot.toDataURL("image/png").split(",")[1];
          });
        },
        { f, yaw, px },
      );
      const png = PNG.sync.read(Buffer.from(b64, "base64"));
      const img = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
      // Does the picture change from frame to frame (is Alive really running)?
      let moved = 0;
      if (prev) for (let i = 0; i < img.data.length; i += 4 * 97) moved += Math.abs(img.data[i] - prev[i]) + Math.abs(img.data[i + 1] - prev[i + 1]) + Math.abs(img.data[i + 2] - prev[i + 2]); // prettier-ignore
      prev = img.data;
      const small = resize(img, 8 * (info.size + (yaw ? 12 : 10)));
      const set = style.startsWith("neon") && style === "neon" ? invertedReaders : readers;
      const ok = (r, im) => (r(im) === TEXT ? 1 : 0);
      out.push([style, yaw, f, moved > 0 ? 1 : 0, ok(set.jsqr, img), ok(set.zxing, img), ok(invertedReaders.jsqr, img), ok(invertedReaders.zxing, img), ok(set.jsqr, small), ok(set.zxing, small)].join(",")); // prettier-ignore
    }
    console.error(style, yaw, "done");
  }
}
fs.writeFileSync("tools/qr-scan-lab/data/alive-results.csv", out.join("\n") + "\n");
await src.close();
