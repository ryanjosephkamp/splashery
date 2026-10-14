// Paired, real-browser quality study. Resumable only with identical source and
// method hashes. Every pose and every unsupported diagnostic is retained.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import {
  openR4,
  selectR4,
  inputsR4,
  screens,
  fingerprintR4,
  renderFilesR4,
} from "./cdx-p3d4-common.mjs";
import { poseR3, texturesR3, referenceDepthR3, projectAnchorsR3 } from "./cdx-p3d2-r3-common.mjs";
import { holesR3, edgesR3 } from "./cdx-p3d2-r3-measure.mjs";
import { minimumField } from "../src/photo3d/background.js";
import { streakR4, thinAnchorsR4, fringeR4 } from "./cdx-p3d4-metrics.mjs";
import { inputFingerprintsR3 } from "./cdx-p3d2-r3-fingerprint.mjs";
const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const requestedCaptures = Number(opt("captures", 2));
if (![1, 2].includes(requestedCaptures))
  throw new RangeError("Capture one or two completed Sharp frames.");
const out = opt("out", ".cache/photo-3d-r4/scout"),
  urls = [opt("before", "http://127.0.0.1:4174/"), opt("after", "http://127.0.0.1:4175/")],
  builds = await Promise.all(urls.map((url) => fingerprintR4(url))),
  methodFiles = [
    "cdx-p3d4-measure.mjs",
    "cdx-p3d4-common.mjs",
    "cdx-p3d4-metrics.mjs",
    "cdx-p3d2-r3-common.mjs",
    "cdx-p3d2-r3-measure.mjs",
    "cdx-p3d2-r3-anchored.mjs",
  ],
  method = crypto
    .createHash("sha256")
    .update(Buffer.concat(methodFiles.map((f) => fs.readFileSync(`tools/${f}`))))
    .digest("hex"),
  inputHashes = inputFingerprintsR3(inputsR4()),
  file = path.join(out, "results.json");
fs.mkdirSync(out, { recursive: true });
const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null;
if (
  saved &&
  (saved.method !== method ||
    (saved.requestedCaptures ?? 2) !== requestedCaptures ||
    JSON.stringify(saved.builds) !== JSON.stringify(builds) ||
    JSON.stringify(saved.inputHashes) !== JSON.stringify(inputHashes))
)
  throw new Error("Source or metric method changed. Use a fresh evidence directory.");
fs.mkdirSync(path.join(out, "method-source"), { recursive: true });
for (const file of methodFiles)
  fs.copyFileSync(`tools/${file}`, path.join(out, "method-source", file));
const baselineSources = [];
const baselineRows = new Map();
const rowKey = (r) => JSON.stringify([r.screen, r.id, r.view, r.yaw, r.pitch]);
for (const dir of opt("baseline", "").split(",").filter(Boolean)) {
  const bytes = fs.readFileSync(path.join(dir, "results.json")),
    study = JSON.parse(bytes);
  if (
    JSON.stringify(study.builds[0]) !== JSON.stringify(builds[0]) ||
    JSON.stringify(study.inputHashes) !== JSON.stringify(inputHashes)
  )
    throw new Error("A reused checkpoint must have identical sources and input hashes.");
  for (const name of methodFiles.filter((name) => name !== "cdx-p3d4-measure.mjs"))
    if (
      !fs
        .readFileSync(path.join(dir, "method-source", name))
        .equals(fs.readFileSync(`tools/${name}`))
    )
      throw new Error(`Reused checkpoint metric or camera method changed: ${name}`);
  const source = {
    dir,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    rows: study.rows.length,
  };
  baselineSources.push(source);
  for (const row of study.rows)
    if (!baselineRows.has(rowKey(row))) baselineRows.set(rowKey(row), { row, source });
}
if (saved && JSON.stringify(saved.baselineSources || []) !== JSON.stringify(baselineSources))
  throw new Error("The reused checkpoint evidence changed; use a fresh directory.");
const rows = saved?.rows || [],
  errors = saved?.errors || [];
const save = (extra = {}) =>
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        method,
        requestedCaptures,
        builds,
        inputHashes,
        urls,
        baselineSources,
        rows,
        errors,
        ...extra,
      },
      null,
      2,
    ),
  );
const decode = (uri) => PNG.sync.read(Buffer.from(uri.split(",")[1], "base64"));
const browser = await chromium.launch(config.use.launchOptions);

function cohorts(mask, uv, field, minimum, ratio) {
  const { width: w, height: h } = mask,
    result = new Uint8Array(w * h),
    near = new Uint8Array(w * h),
    radius = Math.ceil(24 * ratio);
  for (let i = 0; i < result.length; i++) {
    const p = i * 4,
      type = mask.data[p + 1];
    if (type < 8) continue;
    const u = (uv.data[p] * 16 + Math.floor(uv.data[p + 1] / 16)) / 4095,
      v = ((uv.data[p + 1] % 16) * 256 + uv.data[p + 2]) / 4095,
      x = Math.min(field.width - 1, Math.floor(u * field.width)),
      y = Math.min(field.height - 1, Math.floor(v * field.height)),
      k = y * field.width + x;
    if (Math.min(u, v, 1 - u, 1 - v) < 0.04) continue;
    const hidden = field.data[k] / 255 - minimum[k] > 0.03;
    if (type > 96 && hidden) result[i] = 1;
    else if (type < 96 && !hidden) result[i] = 2;
  }
  // Visible controls must be near a revealed region in this same rendered pose.
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (result[y * w + x] === 1) last = x;
      if (x - last <= radius) near[y * w + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (result[y * w + x] === 1) last = x;
      if (last - x <= radius) near[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (near[y * w + x]) last = y;
      if (result[y * w + x] === 2 && y - last > radius) result[y * w + x] = 3;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (near[y * w + x]) last = y;
      if (result[y * w + x] === 3) result[y * w + x] = last - y <= radius ? 2 : 0;
    }
  }
  return result;
}

try {
  for (const screenName of opt("screens", "phone,desktop").split(",")) {
    const screen = screens[screenName],
      pages = [];
    for (const url of urls) {
      const page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
      page.on("pageerror", (e) => errors.push({ screenName, url, error: e.message }));
      page.on("console", (m) => {
        if (m.type() === "error" || /GL_INVALID|sampler type|Invalid ShaderModule/.test(m.text()))
          errors.push({ screenName, url, error: m.text() });
      });
      await openR4(page, url, screen);
      pages.push(page);
    }
    const ids = opt(
      "samples",
      "forest,cdx-hard-bicycle-spokes,cdx-hard-bare-branches,dot-cdx-plant-studio",
    );
    for (const entry of inputsR4().filter((s) => ids === "all" || ids.split(",").includes(s.id)))
      for (const view of opt("views", "sharp").split(",")) {
        if (view !== "sharp")
          throw new Error("The current mask and UV diagnostics are calibrated for Sharp only.");
        if (
          rows.filter((r) => r.id === entry.id && r.screen === screenName && r.view === view)
            .length === 9
        )
          continue;
        let reuseVerified = false,
          reuseAllowed = true;
        for (const page of pages) await selectR4(page, entry, 1, view);
        const textures = [],
          fields = [];
        for (const page of pages) {
          const t = await texturesR3(page);
          const index = textures.length;
          fs.writeFileSync(
            path.join(
              out,
              `${screenName}-${entry.id}-${index ? "after" : "checkpoint"}-background.png`,
            ),
            Buffer.from(t.background.split(",")[1], "base64"),
          );
          if (!index)
            fs.writeFileSync(
              path.join(out, `${screenName}-${entry.id}-source.png`),
              Buffer.from(t.surface.split(",")[1], "base64"),
            );
          textures.push({ surface: decode(t.surface), background: decode(t.background) });
          fields.push(await referenceDepthR3(page));
        }
        const anchors = thinAnchorsR4(textures[0].surface, fields[0]),
          minimum = minimumField(
            Float32Array.from(fields[0].data, (v) => v / 255),
            fields[0].width,
            fields[0].height,
            Math.ceil(0.471 * fields[0].height),
          );
        fs.writeFileSync(
          path.join(out, `${screenName}-${entry.id}-anchors.json`),
          JSON.stringify(anchors),
        );
        const singleAllowed = [requestedCaptures === 1, requestedCaptures === 1];
        const calibrated = [false, false];
        const poses = [
          [0, 0],
          ...[20, -20, 30, -30].flatMap((a) => [
            [a, 0],
            [0, a],
          ]),
        ];
        for (const [yaw, pitch] of poses) {
          if (
            rows.some(
              (r) =>
                r.id === entry.id &&
                r.screen === screenName &&
                r.view === view &&
                r.yaw === yaw &&
                r.pitch === pitch,
            )
          )
            continue;
          const comparison = [];
          for (let build = 0; build < 2; build++) {
            const page = pages[build];
            await page.bringToFront();
            const reused =
              build === 0
                ? baselineRows.get(rowKey({ id: entry.id, screen: screenName, view, yaw, pitch }))
                : null;
            if (reused && reuseAllowed) {
              const prefix = `${screenName}-${entry.id}-${view}-${yaw}-${pitch}-checkpoint`;
              if (!reuseVerified) {
                const witness = decode(
                    (await poseR3(page, yaw, pitch, "color", [0, 1, 0], 2)).image,
                  ),
                  original = PNG.sync.read(
                    fs.readFileSync(path.join(reused.source.dir, `${prefix}-color.png`)),
                  );
                reuseAllowed =
                  witness.width === original.width &&
                  witness.height === original.height &&
                  Buffer.from(witness.data).equals(Buffer.from(original.data));
                reuseVerified = true;
                if (!reuseAllowed)
                  console.log(
                    JSON.stringify({
                      checkpointReuseDeclined: entry.id,
                      screen: screenName,
                      reason:
                        "The current witness frame differs; recapture this entire checkpoint group.",
                    }),
                  );
              }
              if (reuseAllowed) {
                const hashes = {};
                for (const kind of ["color", "mask", "uv"]) {
                  const name = `${prefix}-${kind}.png`,
                    bytes = fs.readFileSync(path.join(reused.source.dir, name));
                  hashes[name] = crypto.createHash("sha256").update(bytes).digest("hex");
                  fs.writeFileSync(path.join(out, name), bytes);
                }
                comparison.push({
                  ...reused.row.comparison[0],
                  reused: {
                    study: reused.source.sha256,
                    files: hashes,
                    witness:
                      "Byte-identical completed checkpoint color frame at the first reused pose.",
                  },
                });
                continue;
              }
            }
            const captureCalibration = { requested: requestedCaptures, used: 2, witnesses: {} };
            const take = async (mode, background) => {
              const verify = requestedCaptures === 1 && !calibrated[build];
              const captures = !verify && singleAllowed[build] ? 1 : 2;
              captureCalibration.used = captures;
              const shot = await poseR3(page, yaw, pitch, mode, background, captures, verify);
              if (verify) {
                const first = decode(shot.firstImage),
                  second = decode(shot.image);
                const identical =
                  first.width === second.width &&
                  first.height === second.height &&
                  Buffer.from(first.data).equals(Buffer.from(second.data));
                const hash = (x) => crypto.createHash("sha256").update(x.data).digest("hex");
                captureCalibration.witnesses[mode] = {
                  identical,
                  first: hash(first),
                  second: hash(second),
                };
                if (!identical) singleAllowed[build] = false;
              }
              return shot;
            };
            const color = await take("color", [0, 1, 0]),
              mask = await take("mask", [0, 0, 0]),
              uv = await take("uv", [0, 0, 0]),
              actual = decode(color.image),
              m = decode(mask.image),
              u = decode(uv.image),
              ratio = actual.width / screen.width,
              projected = await projectAnchorsR3(page, anchors.anchors),
              classes = cohorts(m, u, fields[0], minimum, ratio),
              prefix = `${screenName}-${entry.id}-${view}-${yaw}-${pitch}-${build ? "after" : "checkpoint"}`;
            calibrated[build] = true;
            if (!actual.data.some((v, i) => i % 4 !== 3 && v > 8 && !(i % 4 === 1 && v > 250)))
              throw new Error("Empty rendered capture.");
            for (const [kind, shot] of [
              ["color", color],
              ["mask", mask],
              ["uv", uv],
            ])
              fs.writeFileSync(
                path.join(out, `${prefix}-${kind}.png`),
                Buffer.from(shot.image.split(",")[1], "base64"),
              );
            comparison.push({
              build: build ? "after" : "checkpoint",
              captureCalibration,
              buffer: [actual.width, actual.height],
              holes: holesR3(actual, color.corners),
              edges: edgesR3(actual, m, u, textures[build], ratio),
              streak: streakR4(actual, classes, Math.max(2, Math.round(3 * ratio))),
              thin: fringeR4(actual, projected, anchors.anchors, ratio),
              thinLocal: fringeR4(actual, projected, anchors.anchors, ratio, {
                localBackground: true,
              }),
              backgroundFill: await page.evaluate(
                () => window.__splashery.player.proc.ctx.kit.data.photo.backgroundFill || null,
              ),
              projection: await page.evaluate(() => {
                const pl = window.__splashery.player,
                  mi = pl.stage.app.scene.layers
                    .getLayerByName("World")
                    .meshInstances.find(
                      (m) =>
                        m.material.getParameter("uDepth") &&
                        m.material.getParameter("uLayer").data[2] === 0,
                    );
                return {
                  camera: Array.from(pl.stage.cameraEntity.camera.camera._viewProjMat.data),
                  recipe: [
                    [0, 0, 0],
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1],
                  ].map((v) => pl.fromRecipe(v)),
                  grid: Array.from(mi.material.getParameter("uGrid").data),
                  lift: Array.from(mi.material.getParameter("uLift").data),
                  buffer: [pl.stage.canvas.width, pl.stage.canvas.height],
                };
              }),
            });
          }
          const row = {
            id: entry.id,
            screen: screenName,
            view,
            yaw,
            pitch,
            thinSupport: {
              candidates: anchors.candidates,
              depthRejected: anchors.depthRejected,
              supported: anchors.supported,
              sampled: anchors.anchors.length,
            },
            comparison,
          };
          rows.push(row);
          save({ browser: browser.version() });
          console.log(JSON.stringify(row));
        }
        for (let i = 0; i < 2; i++) {
          const current = await fingerprintR4(urls[i], Object.keys(builds[i].files));
          if (current.hash !== builds[i].hash)
            throw new Error("Served renderer changed during measurement.");
        }
      }
    for (const page of pages) await page.close();
  }
  save({ browser: browser.version(), completed: true });
} finally {
  await browser.close();
}
