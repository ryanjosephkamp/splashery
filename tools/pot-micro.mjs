// Lane Powers of ten: cuts the zoom's pictures under the microscope (and the
// leaf) into squares centered where the next scene sits, every half decade,
// from their sources (src/powers/stops.js, MICRO), and writes them to
// assets/toys/powers-of-ten/micro-<id>-<e>.jpg (1024 px or the source's
// own pixels, whichever is fewer).
//
//   node tools/pot-micro.mjs [id ...]

import fs from "node:fs/promises";
import jpeg from "jpeg-js";
import { MICRO } from "../src/powers/stops.js";

const OUT = new URL("../assets/toys/powers-of-ten/", import.meta.url);

// POT_CACHE=<dir>: a source already saved there under its file name is read
// from it instead (the hosts rate-limit repeated downloads).
async function source(url) {
  const cached = process.env.POT_CACHE && new URL(url).pathname.split("/").pop();
  if (cached) {
    try {
      const b = await fs.readFile(`${process.env.POT_CACHE}/${cached}`);
      return jpeg.decode(b, { useTArray: true, maxMemoryUsageInMB: 2048 });
    } catch {
      // not there: fetch it
    }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return jpeg.decode(Buffer.from(await r.arrayBuffer()), { useTArray: true, maxMemoryUsageInMB: 2048 }); // prettier-ignore
}

// The square of `side` source pixels centered at (cx, cy), averaged down to
// n x n.
function cut(img, cx, cy, side, n) {
  const out = Buffer.alloc(n * n * 4);
  const x0 = cx - side / 2;
  const y0 = cy - side / 2;
  const step = side / n;
  const k = Math.max(1, Math.round(step));
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let v = 0; v < k; v++)
        for (let u = 0; u < k; u++) {
          const x = Math.min(
            img.width - 1,
            Math.max(0, Math.floor(x0 + (i + (u + 0.5) / k) * step)),
          );
          const y = Math.min(
            img.height - 1,
            Math.max(0, Math.floor(y0 + (j + (v + 0.5) / k) * step)),
          );
          const o = (y * img.width + x) * 4;
          r += img.data[o];
          g += img.data[o + 1];
          b += img.data[o + 2];
          c++;
        }
      const o = (j * n + i) * 4;
      out[o] = r / c;
      out[o + 1] = g / c;
      out[o + 2] = b / c;
      out[o + 3] = 255;
    }
  return out;
}

const only = process.argv.slice(2);
for (const m of MICRO) {
  if (only.length && !only.includes(m.id)) continue;
  const img = await source(m.url);
  const perM = img.width / m.width; // source pixels per meter
  for (const L of m.layers) {
    const side = 10 ** L.e * perM;
    if (side > Math.min(img.width, img.height) + 1) throw new Error(`${m.id} ${L.e}: the square is bigger than the picture`); // prettier-ignore
    const n = Math.min(1024, Math.round(side));
    const px = cut(img, m.center[0] * img.width, m.center[1] * img.height, side, n);
    const enc = jpeg.encode({ data: px, width: n, height: n }, 86);
    await fs.writeFile(new URL(L.file, OUT), enc.data);
    console.log(`${L.file}: ${n} px, ${(enc.data.length / 1024).toFixed(0)} KB`);
  }
}
