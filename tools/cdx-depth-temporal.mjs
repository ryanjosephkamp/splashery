// Static-color-region temporal residual. A lower number can also mean blur; inspect depth edges.
import fs from "node:fs";
import jpeg from "jpeg-js";
import { SAMPLES } from "../src/packs/moving-photo.js";
import { resampleArea, normalizeDepth } from "../src/packs/photo-3d-core.js";
const read = (file) => {
  const b = fs.readFileSync(file);
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const clips = JSON.parse(fs.readFileSync(".cache/cdx-depth/clips.json", "utf8"));
const result = [];
for (const s of SAMPLES) {
  const [w, h] = clips.find((c) => c.id === s.id).output;
  const img = jpeg.decode(fs.readFileSync(`assets/toys/moving-photo-3d/${s.file}-sheet-1.jpg`), {
    useTArray: true,
  });
  const guides = [];
  for (let i = 0; i < 6; i++) {
    const data = new Uint8Array(s.w * s.h * 4);
    const ox = (i % s.cols) * s.w,
      oy = Math.floor(i / s.cols) * s.h;
    for (let y = 0; y < s.h; y++) {
      const at = ((oy + y) * img.width + ox) * 4;
      data.set(img.data.subarray(at, at + s.w * 4), y * s.w * 4);
    }
    guides.push(resampleArea({ w: s.w, h: s.h, data }, w, h));
  }
  const dense = Array.from({ length: 6 }, (_, i) =>
    read(`.cache/cdx-depth/dense-clips/clip-${s.id}-${i}.f32`),
  );
  const video = Array.from({ length: 6 }, (_, i) =>
    normalizeDepth(read(`.cache/cdx-depth/video/clip-${s.id}-${i}.f32`)),
  );
  let a = 0,
    b = 0,
    n = 0;
  for (let i = 1; i < 6; i++)
    for (let k = 0; k < w * h; k++) {
      let diff = 0;
      for (let c = 0; c < 3; c++) diff += Math.abs(guides[i][k * 3 + c] - guides[i - 1][k * 3 + c]);
      if (diff / 3 < 0.01) {
        a += Math.abs(dense[i][k] - dense[i - 1][k]);
        b += Math.abs(video[i][k] - video[i - 1][k]);
        n++;
      }
    }
  result.push({
    id: s.id,
    width: w,
    height: h,
    staticPixels: n,
    v2Int8Residual: a / n,
    videoResidual: b / n,
  });
}
fs.writeFileSync(".cache/cdx-depth/temporal.json", JSON.stringify(result, null, 2) + "\n");
console.log(result);
