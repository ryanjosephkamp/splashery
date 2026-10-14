// Lane Powers of ten: the stars within about 1,600 light-years (500 pc) of
// the Sun, from the HYG database v4.4 (David Nash, astronexus; CC BY-SA 4.0;
// Hipparcos, Yale and Gliese catalogs), for the zoom's "stars round the Sun"
// stop. Writes assets/toys/powers-of-ten/stars-500pc.bin: per star five
// int16s, its equatorial J2000 x, y, z (units of 0.05 pc), absolute
// magnitude (hundredths) and temperature (tens of kelvin, from B−V by
// Ballesteros 2012).
//
//   node tools/pot-stars.mjs

import fs from "node:fs/promises";
import zlib from "node:zlib";

const URL_HYG =
  "https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz"; // (Git LFS)
const URL_ALT =
  "https://codeberg.org/astronexus/hyg/raw/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz";
const OUT = new URL("../assets/toys/powers-of-ten/stars-500pc.bin", import.meta.url);
const MAX_PC = 500;

async function fetchGz() {
  for (const u of [URL_HYG, URL_ALT]) {
    const r = await fetch(u);
    if (r.ok && (r.headers.get("content-type") || "").includes("octet"))
      return zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8");
  }
  throw new Error("Could not fetch HYG v4.4.");
}

// One CSV line into fields (quotes, no embedded newlines).
function fields(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const teff = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));

const text = await fetchGz();
const lines = text.split("\n");
const head = fields(lines[0]);
const col = (name) => head.indexOf(name);
const [cx, cy, cz, cd, cm, cc] = ["x", "y", "z", "dist", "absmag", "ci"].map(col);
const rows = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const f = fields(lines[i]);
  const d = Number(f[cd]);
  if (!(d > 0.01) || d > MAX_PC) continue; // the Sun (0) and the far, unmeasured ones
  const bv = f[cc] === "" ? 0.65 : Number(f[cc]);
  rows.push([Number(f[cx]), Number(f[cy]), Number(f[cz]), Number(f[cm]), teff(Math.max(-0.4, Math.min(2, bv)))]); // prettier-ignore
}
const buf = new Int16Array(rows.length * 5);
rows.forEach((r, i) => {
  buf[i * 5] = Math.round(r[0] / 0.05);
  buf[i * 5 + 1] = Math.round(r[1] / 0.05);
  buf[i * 5 + 2] = Math.round(r[2] / 0.05);
  buf[i * 5 + 3] = Math.round(Math.max(-15, Math.min(25, r[3])) * 100);
  buf[i * 5 + 4] = Math.round(r[4] / 10);
});
await fs.writeFile(OUT, Buffer.from(buf.buffer));
console.log(`${rows.length} stars within ${MAX_PC} pc, ${(buf.byteLength / 1024).toFixed(0)} KB`);
