// Task 80 qualification. Full frames, the existing two-reader retries, and
// zxing-cpp's defaults. Every success must equal the encoded payload.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import jpeg from "jpeg-js";
import { encodeQR } from "../src/qr/encode.js";
import { circleLayout } from "../src/qr/circle.js";
import { makeWoven, weave, tidy, SIZES } from "../src/qr-craft/picture.js";
import { codePicture, decorationColor, fitMaskWoven } from "../src/qr-craft/fit.js";
import { finderAt, wovenEyes } from "../src/qr/eyes.js";
import { FIT_EXTRA, FIT_BAND, paleDecoration } from "../src/qr/fit-options.js";
import { SAMPLES } from "../src/qr-craft/samples.js";
import { LINKS as CIRCLE_LINKS, readBoth, readDirect } from "./cdx-circle-study.mjs";
import { LINKS as PICTURE_LINKS } from "./cdx-pics-links.mjs";
import { readJsqr } from "./qr-scan-lab/readers.mjs";
import { readZxingCpp } from "./qrs-study/readers.mjs";
import { capture } from "./qr-scan-lab/sim.mjs";

// Same taps, accumulation order, and Uint8 rounding as sim.mjs. Precompute
// clamped offsets and write scalars to avoid allocating arrays per pixel.
export function studyBlur(img, sigma) {
  if (sigma < 0.3) return img;
  const radius = Math.ceil(sigma * 3);
  const taps = new Float64Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++)
    sum += taps[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < taps.length; i++) taps[i] /= sum;
  const pass = (input, horizontal) => {
    const output = { ...input, data: new Uint8ClampedArray(input.data.length) };
    const length = horizontal ? img.width : img.height;
    const offsets = new Int32Array(length * taps.length);
    for (let n = 0; n < length; n++)
      for (let t = 0; t < taps.length; t++)
        offsets[n * taps.length + t] =
          Math.max(0, Math.min(length - 1, n + t - radius)) * (horizontal ? 4 : img.width * 4);
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const base = horizontal ? y * img.width * 4 : x * 4;
        const start = (horizontal ? x : y) * taps.length;
        let r = 0,
          g = 0,
          b = 0;
        for (let t = 0; t < taps.length; t++) {
          const p = base + offsets[start + t];
          r += input.data[p] * taps[t];
          g += input.data[p + 1] * taps[t];
          b += input.data[p + 2] * taps[t];
        }
        const q = (y * img.width + x) * 4;
        output.data[q] = r;
        output.data[q + 1] = g;
        output.data[q + 2] = b;
        output.data[q + 3] = 255;
      }
    return output;
  };
  return pass(pass(img, true), false);
}

// Production rasterize's exact 4×4 samples. Cache their cell indices and skip
// wholly white pixels; accumulation and Uint8 rounding stay in the same order.
export function fastRasterize(w, ppm, { quiet = 4, blur = 0 } = {}) {
  const N = w.code.size;
  const total = N + 2 * quiet;
  const W = Math.max(1, Math.round(total * ppm));
  const data = new Uint8ClampedArray(W * W * 4).fill(255);
  const cells = new Int32Array(W * 4);
  const valid = new Uint8Array(W);
  for (let p = 0; p < W; p++)
    for (let u = 0; u < 4; u++) {
      const m = ((p + (u + 0.5) / 4) / W) * total - quiet;
      cells[p * 4 + u] = m < 0 || m >= N ? -1 : Math.floor(m * w.k);
      if (cells[p * 4 + u] >= 0) valid[p] = 1;
    }
  for (let y = 0; y < W; y++) {
    if (!valid[y]) continue;
    for (let x = 0; x < W; x++) {
      if (!valid[x]) continue;
      let r = 0,
        g = 0,
        b = 0;
      for (let v = 0; v < 4; v++) {
        const row = cells[y * 4 + v];
        for (let u = 0; u < 4; u++) {
          const col = cells[x * 4 + u];
          if (row < 0 || col < 0) {
            r += 1;
            g += 1;
            b += 1;
            continue;
          }
          const q = (row * w.G + col) * 3;
          r += w.cells[q];
          g += w.cells[q + 1];
          b += w.cells[q + 2];
        }
      }
      const q = (y * W + x) * 4;
      data[q] = (255 * r) / 16;
      data[q + 1] = (255 * g) / 16;
      data[q + 2] = (255 * b) / 16;
    }
  }
  if (blur > 0) layoutBlur(data, W, blur * ppm);
  return { width: W, height: W, data };
}

// picture.js uses a Float32 horizontal intermediate (sim.mjs uses Uint8).
// Retain that distinction and every Gaussian tap while precomputing offsets.
function layoutBlur(data, W, sigma) {
  if (sigma < 0.3) return;
  const radius = Math.ceil(sigma * 3);
  const taps = new Float64Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++)
    sum += taps[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < taps.length; i++) taps[i] /= sum;
  const horizontal = new Int32Array(W * taps.length);
  const vertical = new Int32Array(W * taps.length);
  for (let p = 0; p < W; p++)
    for (let t = 0; t < taps.length; t++) {
      const at = Math.max(0, Math.min(W - 1, p + t - radius));
      horizontal[p * taps.length + t] = at * 4;
      vertical[p * taps.length + t] = at * W * 3;
    }
  const temp = new Float32Array(W * W * 3);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let t = 0; t < taps.length; t++) {
        const p = y * W * 4 + horizontal[x * taps.length + t];
        r += data[p] * taps[t];
        g += data[p + 1] * taps[t];
        b += data[p + 2] * taps[t];
      }
      const q = (y * W + x) * 3;
      temp[q] = r;
      temp[q + 1] = g;
      temp[q + 2] = b;
    }
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let t = 0; t < taps.length; t++) {
        const p = x * 3 + vertical[y * taps.length + t];
        r += temp[p] * taps[t];
        g += temp[p + 1] * taps[t];
        b += temp[p + 2] * taps[t];
      }
      const q = (y * W + x) * 4;
      data[q] = r;
      data[q + 1] = g;
      data[q + 2] = b;
    }
}

export function makeStudyWoven(pic, o) {
  let w = makeWoven(pic, o);
  if (!pic) return w;
  const t = tidy(o);
  const code = w.code;
  let margin = w.margin;
  const strict = [...SIZES, { ppm: 8, blur: 0.3 }, { ppm: 4, blur: 0.3 }];
  const reads = (value) =>
    strict.every(
      (s) => readJsqr(fastRasterize(value, s.ppm, { blur: s.blur })) === value.code.text,
    );
  for (let step = 0; step < 16 && !reads(w) && margin < 0.5; step++) {
    margin = margin < 0 ? 0.02 : Math.min(0.5, margin + 0.02);
    w = weave(code, pic, { ...t, margin });
  }
  return w;
}

export const CANDIDATES = [
  ...[4, 2, 1, 0].map((quiet) => ({
    id: `border-${quiet}-original`,
    quiet,
    shape: "circle",
    eyeShape: "square",
    pale: false,
  })),
  ...[4, 2, 1, 0].map((quiet) => ({
    id: `border-${quiet}-pale`,
    quiet,
    shape: "circle",
    eyeShape: "square",
    pale: true,
  })),
  ...["square", "rounded", "circle"].flatMap((eyeShape) =>
    ["square", "circle"].map((shape) => ({
      id: `eyes-${eyeShape}-${shape}`,
      quiet: 4,
      shape,
      eyeShape,
      pale: shape === "circle",
    })),
  ),
  ...[2, 1, 0].map((quiet) => ({
    id: `eyes-rounded-border-${quiet}`,
    quiet,
    shape: "circle",
    eyeShape: "rounded",
    pale: true,
  })),
];
const pictures = new Map();
const layouts = new WeakMap();
function layoutFor(code, quiet) {
  let byQuiet = layouts.get(code);
  if (!byQuiet) layouts.set(code, (byQuiet = new Map()));
  if (!byQuiet.has(quiet)) byQuiet.set(quiet, circleLayout(code, quiet));
  return byQuiet.get(quiet);
}
export function loadPicture(file) {
  if (pictures.has(file)) return pictures.get(file);
  const j = jpeg.decode(fs.readFileSync(file), { useTArray: true, maxMemoryUsageInMB: 1024 });
  const scale = Math.min(1, 640 / Math.max(j.width, j.height));
  const w = Math.max(1, Math.round(j.width * scale));
  const h = Math.max(1, Math.round(j.height * scale));
  const data = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const q = (Math.floor(y / scale) * j.width + Math.floor(x / scale)) * 4;
      for (let c = 0; c < 3; c++) data[(y * w + x) * 3 + c] = j.data[q + c] / 255;
    }
  const pic = { w, h, data };
  pictures.set(file, pic);
  return pic;
}
const light = (col, pale) => (pale ? paleDecoration(col) : col);

// Matches production's square modules, alternate eyes, round decoration,
// crop coordinates, and pale-decoration treatment. Simulation, not a GPU render.
export function rasterFit(
  code,
  {
    width,
    shape = "circle",
    quiet = 4,
    eyeShape = "square",
    pale = false,
    woven = null,
    pic = null,
    options = {},
    band = FIT_BAND,
  },
) {
  const layout = shape === "circle" ? layoutFor(code, quiet) : null;
  const H = layout?.half ?? code.size / 2 + 4;
  const total = 2 * (H + 1);
  const eye = woven
    ? wovenEyes(woven, eyeShape)
    : weave(code, null, { center: "small", style: "bw" });
  const data = fastRasterize(eye, width / total, { quiet: (total - code.size) / 2 }).data;
  const N = code.size;
  for (let py = 0; py < width; py++)
    for (let px = 0; px < width; px++) {
      const x = ((px + 0.5) / width - 0.5) * total;
      const y = (0.5 - (py + 0.5) / width) * total;
      const r = Math.floor(N / 2 - y);
      const c = Math.floor(x + N / 2);
      const real = r >= 0 && c >= 0 && r < N && c < N;
      if (real) {
        if (!woven && eyeShape !== "square" && finderAt(code, x, y, eyeShape) !== null) {
          let dark = 0;
          for (let v = 0; v < 4; v++)
            for (let u = 0; u < 4; u++)
              if (
                finderAt(
                  code,
                  x + (((u + 0.5) / 4 - 0.5) * total) / width,
                  y + (((v + 0.5) / 4 - 0.5) * total) / width,
                  eyeShape,
                )
              )
                dark++;
          const at = (py * width + px) * 4;
          for (let ch = 0; ch < 3; ch++)
            data[at + ch] = 255 * (1 - (dark / 16) * (1 - [0.07, 0.08, 0.1][ch]));
        }
        continue;
      }
      let col = [1, 1, 1];
      if (layout && Math.hypot(x, y) <= H) {
        const outside = Math.max(Math.abs(x), Math.abs(y)) >= N / 2 + quiet;
        const dot =
          layout.dark(r, c) && Math.hypot(x - (c - N / 2 + 0.5), y - (N / 2 - r - 0.5)) <= 0.44;
        const edge = Math.hypot(x, y) >= H - 0.65;
        if (outside)
          col = decorationColor(pic, { ...options, shape, quiet }, N, x, y, dot || edge, "color");
        if (dot || edge) col = pic ? col : [0.07, 0.08, 0.1];
        if (edge) col = [0.07, 0.08, 0.1];
        if ((outside || edge) && Math.max(Math.abs(x), Math.abs(y)) < N / 2 + quiet + band)
          col = light(col, pale);
      }
      const at = (py * width + px) * 4;
      for (let ch = 0; ch < 3; ch++) data[at + ch] = col[ch] * 255;
    }
  return { width, height: width, data, modules: total };
}
export function trialImages(clean, ppm) {
  const tilt = capture(clean, {
    modules: clean.modules,
    modulePx: ppm,
    yaw: 8,
    pitch: 12,
    roll: 5,
    margin: 0,
    backdrop: [255, 255, 255],
  });
  return [
    ["clean", clean],
    ["blur-0.12", studyBlur(clean, 0.12 * ppm)],
    ["perspective", tilt],
    ["perspective-blur", studyBlur(tilt, 0.12 * ppm)],
    ["blur-0.2", studyBlur(clean, 0.2 * ppm)],
    ["blur-0.3", studyBlur(clean, 0.3 * ppm)],
  ];
}
async function runJob(job, candidates) {
  const rows = [];
  const base = encodeQR(job.text, job.ecc, { boost: false });
  const made = new Map();
  const decoded = new Map();
  for (const candidate of candidates) {
    const signature = JSON.stringify([
      candidate.quiet,
      candidate.shape,
      candidate.eyeShape,
      candidate.pale,
    ]);
    if (decoded.has(signature)) {
      rows.push(...decoded.get(signature).map((row) => ({ ...row, candidate: candidate.id })));
      continue;
    }
    const first = rows.length;
    const pic = job.picture ? loadPicture(job.picture.file) : null;
    const options = {
      text: job.text,
      level: job.ecc,
      size: job.picture ? "more" : "fit",
      contrast: 0.5,
      center: "small",
      style: "color",
      shape: candidate.shape,
      quiet: candidate.quiet,
      pictureFit: "legacy",
      extra: candidate.pale || candidate.eyeShape !== "square" ? FIT_EXTRA : 0,
    };
    const remask = candidate.pale || candidate.id.startsWith("eyes-");
    let code = remask ? encodeQR(job.text, job.ecc, { boost: false, mask: 0 }) : base;
    let woven = null;
    if (pic) {
      const key = `${candidate.shape}/${candidate.quiet}/${options.extra}`;
      if (!made.has(key)) {
        const size = encodeQR(job.text, job.ecc, {
          boost: false,
          min: Math.min(40, base.version + 4),
        }).size;
        const source = codePicture(pic, options, size);
        let value = makeStudyWoven(source, options);
        if (remask)
          value = fitMaskWoven(
            value,
            source,
            options,
            (data, width, height) => readJsqr({ data, width, height }),
            fastRasterize,
          );
        made.set(key, value);
      }
      woven = made.get(key);
      code = woven.code;
    }
    const H =
      candidate.shape === "circle" ? layoutFor(code, candidate.quiet).half : code.size / 2 + 4;
    const total = 2 * (H + 1);
    const sizes = job.sizes || [
      ["phone", 390],
      ["print", 600],
      ["8ppm", Math.round(total * 8)],
      ["4ppm", Math.round(total * 4)],
    ];
    for (const [size, width] of sizes) {
      const clean = rasterFit(code, { ...candidate, width, pic, woven, options });
      for (const [condition, img] of trialImages(clean, width / total)) {
        const direct = readDirect(img);
        const both = readBoth(img, direct);
        const cpp = await readZxingCpp(img);
        rows.push({
          candidate: candidate.id,
          picture: job.picture?.id || "plain",
          ecc: job.ecc,
          text: job.text,
          size,
          condition,
          jsqr: both.jsqr === job.text,
          zxing: both.zxing === job.text,
          zxingcpp: cpp === job.text,
          directJsqr: direct.jsqr === job.text,
          directZxing: direct.zxing === job.text,
          mask: code.mask,
          band: candidate.pale ? FIT_BAND : null,
          pictureFit: options.pictureFit,
          extra: options.extra,
        });
      }
    }
    decoded.set(signature, rows.slice(first));
  }
  return rows;
}
if (!isMainThread) {
  parentPort.on("message", async (job) => {
    try {
      parentPort.postMessage({
        rows: await runJob(
          job,
          workerData.candidates.filter((c) => !job.missing || job.missing.includes(c.id)),
        ),
      });
    } catch (error) {
      parentPort.postMessage({ error: error.stack });
    }
  });
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = (name, fallback) =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] || fallback;
  const chosen = flag("only", "all");
  const candidates =
    chosen === "all" ? CANDIDATES : CANDIDATES.filter((c) => chosen.split(",").includes(c.id));
  const quick = process.argv.includes("--quick");
  const plainOnly = process.argv.includes("--plain");
  const allJobs = CIRCLE_LINKS.slice(0, quick ? 5 : 20).flatMap((text) =>
    (quick ? ["M"] : ["L", "M", "Q", "H"]).map((ecc) => ({ text, ecc })),
  );
  if (!plainOnly)
    for (const picture of SAMPLES.slice(0, quick ? 2 : SAMPLES.length))
      for (const text of PICTURE_LINKS.slice(0, quick ? 1 : 5))
        allJobs.push({ text, ecc: "H", picture });
  const resume = flag("resume", "");
  const previous = resume ? fs.readFileSync(resume, "utf8").trim() : "";
  const restored = previous
    ? previous.startsWith("[")
      ? JSON.parse(previous)
      : previous.split("\n").map((line) => JSON.parse(line))
    : [];
  const selectedIds = new Set(candidates.map((c) => c.id));
  const key = (picture, ecc, text) => JSON.stringify([picture, ecc, text]);
  const groups = new Map();
  for (const row of restored) {
    if (!selectedIds.has(row.candidate)) continue;
    if (row.picture !== "plain" && row.pictureFit !== "legacy") continue;
    if (!row.candidate.endsWith("-original") && row.mask !== 0) continue;
    const candidate = candidates.find((c) => c.id === row.candidate);
    if (candidate.pale && row.band !== FIT_BAND) continue;
    const extra = candidate.pale || candidate.eyeShape !== "square" ? FIT_EXTRA : 0;
    if (row.picture !== "plain" && extra && row.extra !== extra) continue;
    const id = key(row.picture, row.ecc, row.text);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  for (const [id, group] of groups) {
    const whole = group.filter(
      (row) => group.filter((r) => r.candidate === row.candidate).length === 24,
    );
    groups.set(id, whole);
  }
  const completed = new Set(
    [...groups].filter(([, data]) => data.length === candidates.length * 24).map(([id]) => id),
  );
  const rows = [...groups.values()].flat();
  const resumedTrials = rows.length;
  const jobs = allJobs
    .filter((job) => !completed.has(key(job.picture?.id || "plain", job.ecc, job.text)))
    .map((job) => {
      const old = groups.get(key(job.picture?.id || "plain", job.ecc, job.text)) || [];
      return {
        ...job,
        missing: candidates.filter((c) => !old.some((r) => r.candidate === c.id)).map((c) => c.id),
      };
    });
  fs.mkdirSync(".cache", { recursive: true });
  const checkpoint = flag("checkpoint", ".cache/picture-qr-fit-rows.jsonl");
  fs.writeFileSync(checkpoint, rows.map((row) => JSON.stringify(row) + "\n").join(""));
  let next = 0;
  let done = allJobs.length - jobs.length;
  if (done)
    console.log(`Resuming ${done}/${allJobs.length} complete codes, ${resumedTrials} trials`);
  const workers = [];
  await new Promise((resolve, reject) => {
    let live = Math.min(Number(flag("jobs", "4")), jobs.length);
    if (!live) return resolve();
    for (let i = 0; i < live; i++) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { candidates } });
      workers.push(worker);
      const feed = () => {
        if (next >= jobs.length) {
          worker.terminate();
          if (--live === 0) resolve();
          return;
        }
        worker.postMessage(jobs[next++]);
      };
      worker.on("message", (result) => {
        if (result.error) return reject(new Error(result.error));
        rows.push(...result.rows);
        fs.appendFileSync(
          checkpoint,
          result.rows.map((row) => JSON.stringify(row) + "\n").join(""),
        );
        if (++done % 5 === 0 || done === allJobs.length)
          console.log(`${done}/${allJobs.length} codes, ${rows.length} trials`);
        feed();
      });
      worker.on("error", reject);
      feed();
    }
  }).finally(() => workers.forEach((w) => w.terminate()));
  rows.sort((a, b) =>
    JSON.stringify([a.candidate, a.picture, a.ecc, a.text, a.size, a.condition]).localeCompare(
      JSON.stringify([b.candidate, b.picture, b.ecc, b.text, b.size, b.condition]),
    ),
  );
  const summary = candidates.map((candidate) => {
    const trials = rows.filter((r) => r.candidate === candidate.id);
    const bySize = Object.fromEntries(
      [...new Set(trials.map((r) => r.size))].map((size) => {
        const part = trials.filter((r) => r.size === size);
        return [
          size,
          {
            trials: part.length,
            ...Object.fromEntries(
              ["jsqr", "zxing", "zxingcpp"].map((reader) => [
                reader,
                part.filter((r) => r[reader]).length,
              ]),
            ),
          },
        ];
      }),
    );
    return {
      ...candidate,
      trials: trials.length,
      ...Object.fromEntries(
        ["jsqr", "zxing", "zxingcpp", "directJsqr", "directZxing"].map((reader) => [
          reader,
          trials.filter((r) => r[reader]).length,
        ]),
      ),
      all: trials.filter((r) => r.jsqr && r.zxing && r.zxingcpp).length,
      bySize,
      byKind: Object.fromEntries(
        ["plain", "picture"].map((kind) => {
          const part = trials.filter((r) => (r.picture === "plain") === (kind === "plain"));
          return [
            kind,
            Object.fromEntries(
              [...new Set(part.map((r) => r.size))].map((size) => {
                const sized = part.filter((r) => r.size === size);
                return [
                  size,
                  {
                    trials: sized.length,
                    ...Object.fromEntries(
                      ["jsqr", "zxing", "zxingcpp"].map((reader) => [
                        reader,
                        sized.filter((r) => r[reader]).length,
                      ]),
                    ),
                  },
                ];
              }),
            ),
          ];
        }),
      ),
    };
  });
  const result = {
    date: "October 14, 2026",
    quick,
    plainOnly,
    resumedTrials,
    sampling:
      "Production 4 × 4 averaging and Float32-intermediate Gaussian blur; accelerated paths verified byte-for-byte",
    paleFormula: "0.94 + 0.06 × source color",
    geometryExtra: FIT_EXTRA,
    decorationBand: FIT_BAND,
    pictureCrop: "Original sample crop, matching the default saved recipes",
    mask: "0 for explicit borders and eyes; original selection for original controls",
    links: CIRCLE_LINKS,
    pictureLinks: PICTURE_LINKS,
    pictures: SAMPLES.map(({ id, file }) => ({ id, file })),
    readers: {
      jsqr: "1.4.0, existing readBoth retries",
      zxing: "0.21.3, existing readBoth retries",
      zxingcpp: "zxing-wasm 3.1.4, defaults",
    },
    conditions: ["clean", "blur-0.12", "perspective", "perspective-blur", "blur-0.2", "blur-0.3"],
    perspective: { yaw: 8, pitch: 12, roll: 5 },
    summary,
    failures: rows.filter((r) => !r.jsqr || !r.zxing || !r.zxingcpp),
  };
  const out = flag("out", "docs/audits/picture-qr-fit-2026-10-study.json");
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}
