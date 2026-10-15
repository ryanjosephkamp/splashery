// Independent checks of the pixels captured from the stage. No candidate model is used here.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { read } from "../qrc-picture.mjs";
import { readZxingCpp } from "../qrs-study/readers.mjs";
import { resize, capture, lightGradient } from "../qr-scan-lab/sim.mjs";
import { gaussBlur } from "../../src/qr-craft/picture.js";
import { loadBlurKernel } from "../../src/qr-craft/fast-blur.js";
import { capturedFidelity, stickerFidelity } from "./metrics.mjs";
import { CONDITIONS, circleCrop } from "./captures.mjs";
await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
const scratch = new Float32Array(3000000);
export function sourcePicture(id) {
  const png = PNG.sync.read(fs.readFileSync(`.cache/picture-qr-fidelity/review/sources/${id}.png`));
  const data = new Float32Array(png.width * png.height * 3);
  for (let i = 0; i < png.width * png.height; i++)
    for (let ch = 0; ch < 3; ch++) data[i * 3 + ch] = png.data[i * 4 + ch] / 255;
  return { w: png.width, h: png.height, data };
}
export async function qualifyCapture(picture, result, text, shape) {
  const img = PNG.sync.read(Buffer.from(result.shot.split(",")[1], "base64")),
    scans = [];
  const reference = shape === "circle" ? circleCrop(picture, result.codeSize) : picture;
  const scores = capturedFidelity(reference, img, result.codeSize, result.modules);
  const stickerScores =
    shape === "circle" ? stickerFidelity(picture, { code: { size: result.codeSize } }, img) : null;
  for (const ppm of [8, 4]) {
    const sticker = resize(img, Math.round(result.modules * ppm));
    for (const c of CONDITIONS.filter((c) => c.ppm === ppm)) {
      let frame =
        c.yaw || c.pitch
          ? capture(sticker, {
              modules: result.modules,
              modulePx: ppm,
              yaw: c.yaw,
              pitch: c.pitch,
              margin: 0.1,
            })
          : { ...sticker, data: new Uint8ClampedArray(sticker.data) };
      if (c.light) frame = lightGradient(frame, c.light);
      if (c.bright !== 1)
        for (let i = 0; i < frame.data.length; i++) if (i % 4 !== 3) frame.data[i] *= c.bright;
      gaussBlur(frame.data, frame.width, frame.height, c.blur * ppm, scratch);
      scans.push({
        condition: c.id,
        jsqr: read(frame.data, frame.width, frame.height) === text,
        zxingcpp: (await readZxingCpp(frame)) === text,
      });
    }
  }
  return {
    captureRGBA8Sha256: createHash("sha256").update(img.data).digest("hex"),
    scores,
    stickerScores,
    scans,
  };
}
