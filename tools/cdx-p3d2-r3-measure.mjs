// Source-backed edge diagnostics and unexcluded clear pixels, per real pose.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import crypto from "node:crypto";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3, poseR3, texturesR3 } from "./cdx-p3d2-r3-common.mjs";
import { inputFingerprintsR3, pixelMethodHashR3 } from "./cdx-p3d2-r3-fingerprint.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
export const decode = (image) => PNG.sync.read(Buffer.from(image.split(",")[1], "base64"));

export function holesR3(png, corners) {
  const { width: w, height: h, data } = png;
  let area = 0,
    holes = 0;
  for (let y = 0; y < h; y++) {
    const hits = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i],
        b = corners[(i + 1) % corners.length];
      if (a[1] > y + 0.5 !== b[1] > y + 0.5)
        hits.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2)
      for (let x = Math.max(0, Math.ceil(hits[i] - 0.5)); x < w && x + 0.5 < hits[i + 1]; x++) {
        const p = (y * w + x) * 4;
        area++;
        if (data[p] < 5 && data[p + 1] > 250 && data[p + 2] < 5) holes++;
      }
  }
  return { area, holes, holeFraction: holes / area };
}

export function edgesR3(actual, mask, uv, textures, ratio) {
  const { width: w, height: h, data: a } = actual,
    m = mask.data,
    u = uv.data;
  const classify = (i) => (m[i * 4 + 1] < 8 ? 0 : m[i * 4 + 1] < 96 ? 1 : 2);
  const reference = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const type = classify(i);
    if (!type) continue;
    const p = i * 4,
      U = (u[p] * 16 + Math.floor(u[p + 1] / 16)) / 4095,
      V = ((u[p + 1] % 16) * 256 + u[p + 2]) / 4095;
    const t = textures[type === 1 ? "surface" : "background"];
    const x = Math.max(0, Math.min(t.width - 1, Math.floor(U * t.width))),
      y = Math.max(0, Math.min(t.height - 1, Math.floor(V * t.height)));
    const k = (y * t.width + x) * 4;
    reference.set(t.data.subarray(k, k + 3), i * 3);
  }
  const boundary = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        type = classify(i);
      if (!type) continue;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (!classify(j)) continue;
        if (
          type !== classify(j) ||
          Math.abs(m[i * 4] - m[j * 4]) > 32 ||
          Math.abs(m[i * 4 + 2] - m[j * 4 + 2]) > 8
        )
          boundary[i] = 1;
      }
    }
  let count = 0,
    halo = 0,
    sum = 0,
    mae = 0,
    blur = 0,
    blurN = 0,
    maximum = 0;
  const errors = [],
    radius = Math.max(1, Math.ceil(2 * ratio));
  // Separable square dilation gives the same edge neighborhood in linear
  // time, instead of revisiting every neighbor of every screen pixel.
  const horizontal = new Uint8Array(w * h),
    neighborhood = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let total = 0;
    for (let x = 0; x <= radius && x < w; x++) total += boundary[y * w + x];
    for (let x = 0; x < w; x++) {
      horizontal[y * w + x] = total > 0;
      if (x - radius >= 0) total -= boundary[y * w + x - radius];
      if (x + radius + 1 < w) total += boundary[y * w + x + radius + 1];
    }
  }
  for (let x = 0; x < w; x++) {
    let total = 0;
    for (let y = 0; y <= radius && y < h; y++) total += horizontal[y * w + x];
    for (let y = 0; y < h; y++) {
      neighborhood[y * w + x] = total > 0;
      if (y - radius >= 0) total -= horizontal[(y - radius) * w + x];
      if (y + radius + 1 < h) total += horizontal[(y + radius + 1) * w + x];
    }
  }
  for (let y = radius; y < h - radius; y++)
    for (let x = radius; x < w - radius; x++) {
      const i = y * w + x;
      if (!classify(i) || !neighborhood[i]) continue;
      const lo = [255, 255, 255],
        hi = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * w + dx;
          if (!classify(j)) continue;
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], reference[j * 3 + k]);
            hi[k] = Math.max(hi[k], reference[j * 3 + k]);
          }
        }
      let excess = 0,
        error = 0;
      for (let k = 0; k < 3; k++) {
        excess = Math.max(excess, lo[k] - a[i * 4 + k], a[i * 4 + k] - hi[k]);
        error += Math.abs(a[i * 4 + k] - reference[i * 3 + k]);
      }
      excess = Math.max(0, excess - 2); // byte conversion/UV quantization tolerance
      count++;
      if (excess > 8) halo++;
      sum += excess;
      mae += error / 3;
      maximum = Math.max(maximum, excess);
      errors.push(excess);
      // Contrast loss against the source transported to the same screen points.
      let rg = 0,
        ag = 0;
      for (const j of [i + 1, i + w])
        if (classify(j))
          for (let k = 0; k < 3; k++) {
            rg += Math.abs(reference[i * 3 + k] - reference[j * 3 + k]);
            ag += Math.abs(a[i * 4 + k] - a[j * 4 + k]);
          }
      if (rg > 48) {
        blur += Math.max(0, rg - ag) / rg;
        blurN++;
      }
    }
  errors.sort((a, b) => a - b);
  return {
    edgePixels: count,
    haloPixels: halo,
    haloFraction: halo / count,
    haloMean: sum / (255 * count),
    haloP95: (errors[Math.floor(errors.length * 0.95)] || 0) / 255,
    haloMax: maximum / 255,
    sourceColorMAE: mae / (255 * count),
    contrastLoss: blurN ? blur / blurN : 0,
    contrastPixels: blurN,
  };
}

async function main() {
  const out = opt("out", ".cache/cdx-p3d2/r3/sweep");
  fs.mkdirSync(out, { recursive: true });
  const selected = inputs().filter((s) =>
    opt(
      "samples",
      inputs()
        .map((s) => s.id)
        .join(","),
    )
      .split(",")
      .includes(s.id),
  );
  const names = opt("screens", "phone,desktop").split(","),
    depths = opt("depths", "0.2,0.5,1").split(",").map(Number);
  const views = opt("views", "sharp,splats").split(","),
    angles = opt("angles", "20,30").split(",").map(Number);
  const diagonal = opt("diagonal", "true") === "true";
  const poses = [
    [0, 0],
    ...angles.flatMap((a) => [
      [-a, 0],
      [a, 0],
      [0, -a],
      [0, a],
      ...(diagonal
        ? [
            [-a, -a],
            [-a, a],
            [a, -a],
            [a, a],
          ]
        : []),
    ]),
  ];
  const url = opt("url", "http://127.0.0.1:4175/");
  const buildsFile = ".cache/cdx-p3d2/r3/builds.json";
  const build = fs.existsSync(buildsFile)
    ? JSON.parse(fs.readFileSync(buildsFile))[opt("build", "after")]
    : null;
  if (!build) throw new Error("Record the immutable browser build before measuring it.");
  for (const [file, hash] of Object.entries(build.files)) {
    const response = await fetch(new URL(file, url));
    if (!response.ok) throw new Error(`Cannot read browser source: ${file}`);
    const actual = crypto
      .createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex");
    if (actual !== hash) throw new Error(`Browser build differs from its recorded source: ${file}`);
  }
  const settings = {
    build,
    names,
    depths,
    views,
    poses,
    samples: selected.map((s) => s.id),
    methodHash: pixelMethodHashR3(),
    inputHashes: inputFingerprintsR3(selected),
    capturePolicy: {
      sharpFirstFrames: 2,
      sharpRestFrames: Number(opt("sharp-rest-frames", "2")),
      splatsFrames: 2,
    },
  };
  if (![1, 2].includes(settings.capturePolicy.sharpRestFrames))
    throw new Error("Sharp captures must use one or two completed frames.");
  const settingsFile = path.join(out, "settings.json");
  if (
    fs.existsSync(settingsFile) &&
    JSON.stringify(JSON.parse(fs.readFileSync(settingsFile))) !== JSON.stringify(settings)
  )
    throw new Error("Saved sweep settings or browser build changed; use a fresh directory.");
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  const errorFile = path.join(out, "errors.json");
  const retainedErrors =
    opt("resume", "false") === "true" && fs.existsSync(errorFile)
      ? JSON.parse(fs.readFileSync(errorFile))
      : opt("resume", "false") === "true" && fs.existsSync(path.join(out, "run.json"))
        ? JSON.parse(fs.readFileSync(path.join(out, "run.json"))).errors || []
        : [];
  const browser = await chromium.launch(config.use.launchOptions),
    rows = [],
    errors = [...retainedErrors];
  const recordError = (message) => {
    errors.push(message);
    fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
  };
  fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
  try {
    for (const name of names) {
      const screen = screens[name];
      const page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
      page.on("pageerror", (e) => recordError(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" || /GL_INVALID|Invalid command|shader compilation/i.test(m.text()))
          recordError(m.text());
      });
      const display = await openR3(page, url, screen);
      for (const entry of selected) {
        const saved = path.join(out, `${name}-${entry.id}.json`);
        if (opt("resume", "false") === "true" && fs.existsSync(saved)) {
          const previous = JSON.parse(fs.readFileSync(saved));
          const expected = depths.length * views.length * poses.length;
          const keys = previous.map((r) => `${r.depth}/${r.view}/${r.yaw}/${r.pitch}`);
          if (
            previous.length !== expected ||
            new Set(keys).size !== expected ||
            previous.some(
              (r) =>
                r.id !== entry.id ||
                r.screen !== name ||
                !depths.includes(r.depth) ||
                !views.includes(r.view) ||
                !poses.some(([y, p]) => y === r.yaw && p === r.pitch),
            )
          )
            throw new Error(`Incompatible saved poses: ${saved}`);
          rows.push(...previous);
          fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows));
          console.log(name, entry.id, "resumed", previous.length, "poses");
          continue;
        }
        const sampleRows = [];
        let worstHalo = -1,
          worstHole = -1;
        for (const depth of depths)
          for (const view of views) {
            await selectR3(page, entry, depth, view);
            const warmed = new Set();
            const capture = async (yaw, pitch, mode = "color") => {
              const frames =
                view === "sharp" && warmed.has(mode) ? settings.capturePolicy.sharpRestFrames : 2;
              const shot = await poseR3(page, yaw, pitch, mode, [0, 1, 0], frames);
              const pixels = decode(shot.image).data;
              let rgb = false;
              let alpha = false;
              for (let p = 0; p < pixels.length && !(rgb && alpha); p += 4) {
                rgb ||= pixels[p] > 0 || pixels[p + 1] > 0 || pixels[p + 2] > 0;
                alpha ||= pixels[p + 3] > 0;
              }
              if (!rgb || !alpha) {
                recordError(
                  `Invalid blank capture: ${name}/${entry.id}/${view}/${yaw}/${pitch}/${mode}`,
                );
                throw new Error(
                  "The browser returned an empty capture; this pose is not measured.",
                );
              }
              warmed.add(mode);
              return shot;
            };
            let textures;
            if (view === "sharp") {
              const images = await texturesR3(page);
              textures = { surface: decode(images.surface), background: decode(images.background) };
            }
            for (const [yaw, pitch] of poses) {
              const shot = await capture(yaw, pitch),
                actual = decode(shot.image);
              const hole = holesR3(actual, shot.corners);
              let edge = {};
              if (view === "sharp") {
                const mask = decode((await capture(yaw, pitch, "mask")).image);
                const uv = decode((await capture(yaw, pitch, "uv")).image);
                edge = edgesR3(actual, mask, uv, textures, display.ratio);
                if (edge.haloMean > worstHalo) {
                  worstHalo = edge.haloMean;
                  fs.writeFileSync(
                    path.join(out, `${name}-${entry.id}-worst-halo.png`),
                    PNG.sync.write(actual),
                  );
                }
              }
              if (hole.holeFraction > worstHole) {
                worstHole = hole.holeFraction;
                fs.writeFileSync(
                  path.join(out, `${name}-${entry.id}-worst-hole.png`),
                  PNG.sync.write(actual),
                );
              }
              const row = {
                id: entry.id,
                builtin: entry.builtin,
                screen: name,
                depth,
                view,
                yaw,
                pitch,
                captureValidated: true,
                ...display,
                ...hole,
                ...edge,
              };
              rows.push(row);
              sampleRows.push(row);
            }
          }
        fs.writeFileSync(saved, JSON.stringify(sampleRows, null, 2));
        fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows));
        console.log(
          name,
          entry.id,
          sampleRows.length,
          "poses",
          "worst holes",
          worstHole,
          "worst halo",
          worstHalo,
          "errors",
          errors.length,
        );
      }
      await page.close();
    }
    fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows));
    fs.writeFileSync(
      path.join(out, "run.json"),
      JSON.stringify(
        {
          browser: browser.version(),
          url,
          build,
          renderer: process.env.SPLASHERY_GL || "swiftshader",
          rows: rows.length,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}
if (process.argv[1] && new URL(import.meta.url).pathname === path.resolve(process.argv[1]))
  await main();
