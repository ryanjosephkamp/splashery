// Lane QR lab r2, the study of splat QR codes (X2): three codes in one
// square. src/qr-lab/rgb.js gives each module one of eight colors (the red
// channel carries the first code, green the second, blue the third). This
// part builds that code from splats, photographs it as in the sweeps, then
// adds what a phone camera does to color: channel crosstalk (rgb.js,
// crosstalk(k)) and JPEG, both as jpeg-js writes it (4:4:4, every pixel keeps
// its own color) and with 4:2:0 chroma subsampling as phone cameras save
// photos (color averaged over each 2×2 block; done here by hand, since
// jpeg-js doesn't). It reads each picture two ways:
//   split   Splashery's splitting reader (rgb.js, readRGB): each channel as
//           a gray picture, read by each of the three readers;
//   plain   each reader on the color picture as it is (what an ordinary
//           scanner app does): which of the three texts, if any, comes out.
// A one-color code of the same version is the control. Writes rgb.csv,
// rgb-raw.csv and pictures in rgb/.
import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import { encodeRGB, readRGB, crosstalk, channel } from "../../src/qr-lab/rgb.js";
import { encodeSteps } from "../../src/qr-lab/steps.js";
import { applyCondition, resize } from "../qr-scan-lab/sim.mjs";
import { screenShot, CONDITIONS, toCSV, wilson } from "./core.mjs";
import { readerFns, READERS } from "./readers.mjs";
import { toPNG } from "./raster.mjs";

export const SETS = {
  short: ["Red: splats!", "Green: splats!", "Blue: splats!"],
  url: [
    "https://ryanjosephkamp.github.io/splashery/#red",
    "https://ryanjosephkamp.github.io/splashery/#grn",
    "https://ryanjosephkamp.github.io/splashery/#blu",
  ],
};

// 4:2:0: to YCbCr (BT.601, as JPEG/JFIF), Cb and Cr averaged over each 2×2
// block, back to RGB.
export function chroma420(img) {
  const { width: W, height: H, data: d } = img;
  const out = new Uint8ClampedArray(d.length);
  const Y = new Float32Array(W * H);
  const Cb = new Float32Array(W * H);
  const Cr = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      let cb = 0;
      let cr = 0;
      let n = 0;
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++)
          if (x + i < W && y + j < H) {
            const k = (y + j) * W + x + i;
            cb += Cb[k];
            cr += Cr[k];
            n++;
          }
      cb /= n;
      cr /= n;
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++)
          if (x + i < W && y + j < H) {
            const k = (y + j) * W + x + i;
            out[k * 4] = Y[k] + 1.402 * cr;
            out[k * 4 + 1] = Y[k] - 0.344136 * cb - 0.714136 * cr;
            out[k * 4 + 2] = Y[k] + 1.772 * cb;
            out[k * 4 + 3] = 255;
          }
    }
  return { width: W, height: H, data: out };
}
function jpegRT(img, q) {
  const enc = jpeg.encode({ width: img.width, height: img.height, data: Buffer.from(img.data) }, q); // prettier-ignore
  const dec = jpeg.decode(enc.data, { useTArray: true, formatAsRGBA: true });
  return { width: dec.width, height: dec.height, data: new Uint8ClampedArray(dec.data) };
}

// The camera's color pipeline after the scan lab's capture (its own JPEG
// left out): crosstalk k, then the saving.
function photograph(img, wide, c, k, save, seed) {
  let p = applyCondition(img, wide, { ...c, jpeg: 0 }, seed);
  if (k) p = crosstalk(p, k);
  const q = c.jpeg || 75;
  if (save === "444") p = jpegRT(p, q);
  else if (save === "420") p = jpegRT(chroma420(p), q);
  return p;
}

// The splats of an RGB code: every module a tile of its own color.
function rgbSpec(colors) {
  return {
    // Modules close up only with neighbors of the same color.
    opts: { lightTiles: true, key: (i) => colors[i * 3] * 4 + colors[i * 3 + 1] * 2 + colors[i * 3 + 2] }, // prettier-ignore
    transform: (sp) => {
      for (const s of sp) if (s.mod >= 0) s.color = [colors[s.mod * 3], colors[s.mod * 3 + 1], colors[s.mod * 3 + 2]]; // prettier-ignore
      return sp;
    },
  };
}

export async function runRGB(out, { grid = "small", trials = 1 } = {}) {
  const dir = path.join(out, "rgb");
  fs.mkdirSync(dir, { recursive: true });
  const levels = grid === "tiny" ? ["M"] : ["L", "M", "Q", "H"];
  const ks = grid === "full" ? [0, 0.05, 0.1, 0.15, 0.2, 0.3] : [0, 0.1, 0.3];
  const saves = ["raw", "444", "420"];
  const sets = grid === "full" ? Object.keys(SETS) : ["url"];
  const rows = [];
  const t0 = Date.now();
  for (const set of sets)
    for (const level of levels) {
      const texts = SETS[set];
      const enc = encodeRGB(texts, level);
      const fake = { size: enc.size, modules: new Uint8Array(enc.size * enc.size).fill(1) };
      // The control: the green text alone, a one-color code of the same version.
      const mono = encodeSteps(texts[1], level, { version: enc.version });
      for (let trial = 0; trial < trials; trial++) {
        const shot = screenShot(fake, rgbSpec(enc.colors), trial);
        const ctl = screenShot(mono, {}, trial);
        if (trial === 0 && level === "M" && set === "url") {
          fs.writeFileSync(path.join(dir, "rgb-code.png"), toPNG(resize(shot.img, 280)));
          for (const [ci, name] of ["red", "green", "blue"].entries()) fs.writeFileSync(path.join(dir, `channel-${name}.png`), toPNG(resize(channel(shot.img, ci), 180))); // prettier-ignore
        }
        for (const c of CONDITIONS)
          for (const k of ks)
            for (const save of saves) {
              if (c.id !== "front" && save === "raw") continue; // a phone always saves a JPEG
              const seed = 7 + trial * 101 + c.id.length;
              const photo = photograph(shot.img, shot.wide, c, k, save, seed);
              const row = { set, level, version: enc.version, trial, cond: c.id, k, save };
              for (const r of READERS) {
                const got = await Promise.all(readRGB(photo, readerFns[r]));
                got.forEach((g, i) => (row[`${r}_${"rgb"[i]}`] = g === texts[i] ? 1 : 0));
                row[`${r}_all3`] = got.every((g, i) => g === texts[i]) ? 1 : 0;
                const plain = await readerFns[r](photo);
                row[`${r}_plain`] = plain == null ? "" : texts.indexOf(plain) >= 0 ? "rgb"[texts.indexOf(plain)] : "other"; // prettier-ignore
              }
              const cphoto = photograph(ctl.img, ctl.wide, c, k, save, seed);
              for (const r of READERS) row[`${r}_mono`] = (await readerFns[r](cphoto)) === texts[1] ? 1 : 0; // prettier-ignore
              rows.push(row);
            }
      }
    }
  const cols = ["set", "level", "version", "trial", "cond", "k", "save", ...READERS.flatMap((r) => [`${r}_r`, `${r}_g`, `${r}_b`, `${r}_all3`, `${r}_plain`, `${r}_mono`])]; // prettier-ignore
  fs.writeFileSync(path.join(out, "rgb-raw.csv"), toCSV(rows, cols));
  // Summary per level, capture, crosstalk and saving (sets and trials pooled).
  const sum = [];
  const key = (r) => `${r.level}|${r.cond}|${r.k}|${r.save}`;
  const keys = [...new Set(rows.map(key))];
  for (const kk of keys) {
    const rs = rows.filter((r) => key(r) === kk);
    const row = { level: rs[0].level, cond: rs[0].cond, k: rs[0].k, save: rs[0].save, n: rs.length }; // prettier-ignore
    for (const r of READERS) {
      const all3 = rs.reduce((s, x) => s + x[`${r}_all3`], 0);
      const chans = rs.reduce((s, x) => s + x[`${r}_r`] + x[`${r}_g`] + x[`${r}_b`], 0);
      const mono = rs.reduce((s, x) => s + x[`${r}_mono`], 0);
      const [lo, hi] = wilson(all3, rs.length);
      row[`${r}_all3`] = Math.round((all3 / rs.length) * 100) / 100;
      row[`${r}_all3_ci`] = `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
      row[`${r}_channels`] = Math.round((chans / (3 * rs.length)) * 100) / 100;
      row[`${r}_mono`] = Math.round((mono / rs.length) * 100) / 100;
      const plains = rs.map((x) => x[`${r}_plain`]);
      row[`${r}_plain`] = ["r", "g", "b", "other"].map((t) => `${t}:${plains.filter((p) => p === t).length}`).join(" ") + ` none:${plains.filter((p) => p === "").length}`; // prettier-ignore
    }
    sum.push(row);
  }
  fs.writeFileSync(path.join(out, "rgb.csv"), toCSV(sum, ["level", "cond", "k", "save", "n", ...READERS.flatMap((r) => [`${r}_all3`, `${r}_all3_ci`, `${r}_channels`, `${r}_mono`, `${r}_plain`])])); // prettier-ignore
  console.log(`rgb: ${rows.length} captures (each read 12 ways, plus the control) in ${((Date.now() - t0) / 1000).toFixed(0)} s`); // prettier-ignore
  return sum;
}
