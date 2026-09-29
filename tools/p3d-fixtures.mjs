// Photo to 3D (lane Photo to 3D): makes the test photos in tests/fixtures/p3d/ from numbers, released
// under CC0 1.0. A "scene" is a bright disc on a striped wall: a photo with an obvious near thing
// and far thing, so a depth model puts them at different depths.
import fs from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

const dir = "tests/fixtures/p3d";
fs.mkdirSync(dir, { recursive: true });
function scene(w, h) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const wall = ((x >> 3) & 1) === 0 ? [176, 132, 92] : [150, 108, 74];
      const floor = y > h * 0.72;
      let c = floor ? [96 + (y - h * 0.72), 100, 108] : wall;
      const dx = x - w * 0.5;
      const dy = y - h * 0.55;
      if (dx * dx + dy * dy < (h * 0.26) ** 2) c = [232, 64, 52]; // a red ball in front
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  return { width: w, height: h, data };
}
const s = scene(96, 72);
fs.writeFileSync(`${dir}/scene.png`, PNG.sync.write(Object.assign(new PNG({ width: 96, height: 72 }), { data: s.data })));
fs.writeFileSync(`${dir}/scene.jpg`, jpeg.encode(s, 90).data);
console.log("wrote", dir);
