#!/usr/bin/env node
// Lane Space r2: the "Real galaxies" pictures. Downloads each picture listed
// in src/space/galaxies.js (ESA/Hubble and ESO, CC BY 4.0), crops a square
// round its galaxy and writes assets/toys/real-galaxies/<id>.jpg, 768 × 768.
//
//   node tools/sp2-galaxies.mjs

import fs from "node:fs";
import jpeg from "jpeg-js";
import { GALAXIES } from "../src/space/galaxies.js";

const OUT = "assets/toys/real-galaxies";
const SIZE = 768;
fs.mkdirSync(OUT, { recursive: true });
for (const g of GALAXIES) {
  const r = await fetch(g.url);
  if (!r.ok) throw new Error(`${g.url}: HTTP ${r.status}`);
  const img = jpeg.decode(Buffer.from(await r.arrayBuffer()), { useTArray: true });
  const out = Buffer.alloc(SIZE * SIZE * 4);
  const [cx, cy] = g.center;
  const s = (2 * g.radius) / SIZE;
  for (let j = 0; j < SIZE; j++)
    for (let i = 0; i < SIZE; i++) {
      // The mean of the source pixels under this one (a box filter).
      const x0 = cx - g.radius + i * s;
      const y0 = cy - g.radius + j * s;
      const acc = [0, 0, 0];
      let n = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y0 + s); y++)
        for (let x = Math.floor(x0); x < Math.ceil(x0 + s); x++) {
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          const k = (y * img.width + x) * 4;
          acc[0] += img.data[k];
          acc[1] += img.data[k + 1];
          acc[2] += img.data[k + 2];
          n++;
        }
      const o = (j * SIZE + i) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = n ? Math.round(acc[c] / n) : 0;
      out[o + 3] = 255;
    }
  const enc = jpeg.encode({ data: out, width: SIZE, height: SIZE }, 84).data;
  fs.writeFileSync(`${OUT}/${g.id}.jpg`, enc);
  console.log(
    `${g.id}: ${img.width}×${img.height} -> ${SIZE}², ${Math.round(enc.length / 1024)} KB`,
  );
}
