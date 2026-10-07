// Lane QR craft: measures Picture QR in Node. For each sample photo, style,
// center dot, level and contrast, weaves the code (src/qr-craft/picture.js),
// rasterizes it at phone size (8 px a module) and smaller (4 px), and reads it
// with jsQR. Prints the lowest contrast that scans for each, and the measured
// module contrast there.
//   node tools/qrc-picture.mjs [--text=...] [--photos=still-life,forest]
import fs from "node:fs";
import jpeg from "jpeg-js";
import { makeWoven, checkWoven, measure, CENTERS, LEVELS } from "../src/qr-craft/picture.js";
import { SAMPLES } from "../src/qr-craft/samples.js";
import { rasterize, QUIET } from "../src/qr-craft/picture.js";
import { conditions, applyCondition } from "./qr-scan-lab/sim.mjs";
import { readers } from "./qr-scan-lab/readers.mjs";

// The scan lab's phone-like captures (its report's "realistic" set, as
// tools/qr3-scan.mjs uses them).
const PHONE = ["front", "tilt20", "mod4", "mod6", "blur20", "jpeg30", "light30", "persp", "phone"];
const CONDS = conditions().filter((c) => PHONE.includes(c.id));
// How many of the 9 phone-like captures both readers read exactly.
export function phoneLike(w) {
  const img = rasterize(w, 16);
  const modules = w.code.size + 2 * QUIET;
  let n = 0;
  for (const c of CONDS) {
    const cap = applyCondition(img, modules, c);
    if (Object.values(readers).every((r) => r(cap) === w.code.text)) n++;
  }
  return n;
}

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const text = arg("text", "https://ryanjosephkamp.github.io/splashery/");
const photos = arg("photos", SAMPLES.map((s) => s.id).join(",")).split(",");

const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
export const read = (rgba, w, h) =>
  jsQR(rgba, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;

export function loadPicture(file) {
  const j = jpeg.decode(fs.readFileSync(file), { useTArray: true, maxMemoryUsageInMB: 1024 });
  const data = new Float32Array(j.width * j.height * 3);
  for (let i = 0; i < j.width * j.height; i++)
    for (let c = 0; c < 3; c++) data[i * 3 + c] = j.data[i * 4 + c] / 255;
  return { w: j.width, h: j.height, data };
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--phone")) {
  // Each sample at the toy's defaults, and at the lowest contrast the toy's
  // own check passes, through the 9 phone-like captures.
  for (const id of photos) {
    const pic = loadPicture(SAMPLES.find((x) => x.id === id).file);
    for (const style of ["color", "bw"])
      for (const center of ["small", "big"]) {
        let low = null;
        for (let a = 0; a <= 1.0001 && !low; a += 0.05) {
          const w = makeWoven(pic, { text, level: "H", contrast: a, center, style });
          if (checkWoven(w, read).ok) low = { a, w };
        }
        const def = makeWoven(pic, { text, level: "H", contrast: 0.5, center, style });
        console.log(`| ${id} | ${style} | ${center} | ${measure(def).module.toFixed(2)} : 1 | ${checkWoven(def, read).ok ? "✓" : "✗"} | ${phoneLike(def)}/9 | ${low ? Math.round(low.a * 100) + "%" : "none"} | ${low ? phoneLike(low.w) + "/9" : ""} |`); // prettier-ignore
      }
  }
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [];
  for (const id of photos) {
    const s = SAMPLES.find((x) => x.id === id);
    const pic = loadPicture(s.file);
    for (const style of ["color", "bw"])
      for (const center of CENTERS.map((c) => c.id))
        for (const level of LEVELS) {
          let found = null;
          for (let a = 0; a <= 1.0001; a += 0.05) {
            const w = makeWoven(pic, { text, level, contrast: a, center, style });
            const ck = checkWoven(w, read);
            if (ck.ok) {
              found = { a: Math.round(a * 100), m: measure(w), size: w.code.size };
              break;
            }
          }
          rows.push(`| ${id} | ${style} | ${center} | ${level} | ${found ? `${found.a}%` : "none"} | ${found ? found.m.module.toFixed(2) + " : 1" : ""} | ${found?.size ?? ""} |`); // prettier-ignore
          console.log(rows.at(-1));
        }
  }
}
