// MIT. Real main-branch app, model, GPU frames, and measurement-only diagnostics.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import zlib from "node:zlib";
import config from "../../playwright.config.mjs";
import { ROOT, hash } from "./inputs.mjs";
import { processMemory } from "./memory.mjs";
import { poseR3, texturesR3, referenceDepthR3, projectAnchorsR3 } from "../cdx-p3d2-r3-common.mjs";
import { sourceAnchorsR3 } from "../cdx-p3d2-r3-anchored.mjs";
import { thinAnchorsR4 } from "./artifacts.mjs";
import { minimumField } from "../../src/photo3d/background.js";
import { sampleTruth } from "../studio-truth/sampling.mjs";
import {
  cueDepth,
  referenceError,
  revealQuads,
  poseScores,
  severity,
  summarize,
} from "./scoring.mjs";

export const PROFILES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3, profile: "low" },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, profile: "mid" },
};
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
export async function localServer(entries) {
  const nonce = crypto.randomBytes(16).toString("hex"),
    files = new Map(entries.map((e) => [`/__p3df/${nonce}/${e.id}`, e.file]));
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let file = files.get(pathname);
      if (!file) {
        if (
          pathname.split("/").some((p) => p.startsWith(".")) ||
          !(
            pathname === "/" ||
            /^\/(src|assets|vendor)\//.test(pathname) ||
            /^\/[^/]+\.(html|css|svg|ico|png|webmanifest|json)$/.test(pathname)
          )
        )
          throw new Error("Not public");
        file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
        if (!fs.realpathSync(file).startsWith(ROOT + path.sep)) throw new Error("Not public");
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    inputUrl: (e) => `/__p3df/${nonce}/${e.id}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const decode = (uri) => PNG.sync.read(Buffer.from(uri.split(",")[1], "base64"));
const png = (file, image) => fs.writeFileSync(file, PNG.sync.write(image, { deflateLevel: 3 }));
function crop(image, corners) {
  let left = Math.min(...corners.map((p) => p[0])),
    top = Math.min(...corners.map((p) => p[1])),
    right = Math.max(...corners.map((p) => p[0])),
    bottom = Math.max(...corners.map((p) => p[1]));
  // Include visible spill outside the photo; a review crop must not hide it.
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const p = (y * image.width + x) * 4;
      if (
        image.data[p + 3] &&
        Math.min(image.data[p], image.data[p + 1], image.data[p + 2]) < 250
      ) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
      }
    }
  const x = Math.max(0, Math.min(image.width - 1, Math.floor(left)) - 10),
    y = Math.max(0, Math.min(image.height - 1, Math.floor(top)) - 10);
  const width = Math.max(1, Math.min(image.width, Math.ceil(right) + 10) - x),
    height = Math.max(1, Math.min(image.height, Math.ceil(bottom) + 10) - y);
  const data = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++)
    image.data.copy(
      data,
      row * width * 4,
      ((y + row) * image.width + x) * 4,
      ((y + row) * image.width + x + width) * 4,
    );
  return { width, height, data };
}

function truthScore(entry, prediction) {
  const pose = JSON.parse(fs.readFileSync(entry.truth)).frames[0],
    base = path.dirname(entry.truth);
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(base, pose.depth)));
  const z = new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const rgb = jpeg.decode(fs.readFileSync(path.join(base, pose.rgb)), { useTArray: true });
  const m = PNG.sync.read(fs.readFileSync(path.join(base, pose.mask)));
  const t = sampleTruth(
    {
      pose,
      z,
      mask: Uint8Array.from({ length: m.width * m.height }, (_, i) => m.data[i * 4]),
      rgb: rgb.data,
    },
    prediction.w,
    prediction.h,
  );
  return referenceError(Float32Array.from(prediction.d), t.z, t.mask);
}

export async function measureProfile(
  entry,
  name,
  { server, out, poses, depth, diagnostics = true },
) {
  const screen = PROFILES[name],
    launch = { ...config.use.launchOptions };
  if (!launch.executablePath && fs.existsSync("/usr/bin/chromium"))
    launch.executablePath = "/usr/bin/chromium";
  const service = await chromium.launchServer(launch),
    browser = await chromium.connect(service.wsEndpoint());
  const context = await browser.newContext({
    viewport: { width: screen.width, height: screen.height },
    deviceScaleFactor: screen.deviceScaleFactor,
  });
  const page = await context.newPage(),
    errors = [],
    externalRequests = [],
    samples = [];
  let timer = null;
  const prefix = `${entry.id}-${name}`,
    folder = path.join(out, "renders");
  fs.mkdirSync(folder, { recursive: true });
  try {
    if (entry.truth)
      await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args);
            this.addEventListener("message", ({ data }) => {
              if (data.type === "depth" && data.d && Number.isInteger(data.w))
                window.__p3dfDepth = { w: data.w, h: data.h, d: data.d.slice() };
            });
          }
        };
      });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (["http:", "https:"].includes(u.protocol) && u.origin !== new URL(server.url).origin) {
        externalRequests.push(u.origin);
        return route.abort();
      }
      return route.continue();
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" ||
        /GL_INVALID|sampler type|shader compilation failed/i.test(m.text())
      )
        errors.push(m.text());
    });
    await page.goto(`${server.url}?renderer=webgl2&profile=${screen.profile}&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(
      async ({ screen, isBuiltin }) => {
        const { app, player: pl } = window.__splashery;
        pl.setPaused(true);
        pl.camera.setTurntable(false);
        pl.idle.weight = 0;
        pl.opts.idleDelay = 1e9;
        app.setLook({ background: "#ffffff", ground: "none" });
        pl.stage.setFixedSize([
          Math.round(screen.width * pl.stage.pixelRatio()),
          Math.round(screen.height * pl.stage.pixelRatio()),
        ]);
        if (!isBuiltin) await app.chooseToy("photo-3d");
        pl.stage.onUpdate(() => {
          if (pl.paused && pl.scene.toy.id === "photo-3d" && pl.toyInfo?.recipe)
            pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
        });
        pl.stage.app.on("postrender", () => {
          if (pl.paused && pl.scene.toy.id === "photo-3d") {
            pl.stage.aliveUntil = 0;
            pl.stage.app.renderNextFrame = false;
          }
        });
        const gl = pl.stage.device.gl,
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        window.__p3dfRenderer = ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
      },
      { screen, isBuiltin: entry.kind === "builtin" },
    );
    const supplied =
      entry.depthFile && entry.kind !== "builtin"
        ? Array.from(fs.readFileSync(entry.depthFile))
        : null;
    await page.evaluate(
      ({ id, builtin, depth, supplied }) => {
        const { app, player: pl } = window.__splashery,
          previous = pl.proc?.ctx?.kit?.data?.photo?.uid;
        window.__p3dfComplete = null;
        window.__p3dfDepth = null;
        const start = () => {
          const began = performance.now();
          let completing = false;
          pl.setPaused(false);
          const rendered = () => {
            const photo = pl.proc?.ctx?.kit?.data?.photo;
            if (
              completing ||
              pl.loading ||
              !photo ||
              photo.uid === previous ||
              photo.backgroundPending ||
              !window.__psv?.state().on
            )
              return;
            const foreground = pl.stage.app.scene.layers
              .getLayerByName("World")
              .meshInstances.find(
                (m) =>
                  m.material.getParameter("uDepth") &&
                  m.material.getParameter("uLayer")?.data[2] === 0,
              );
            if (!(foreground?.material.getParameter("uLift")?.data[0] > 0)) return;
            if (builtin && pl.scene.toy.options.source !== id) return;
            const rect = document
              .querySelector("[aria-label='Photo preview']")
              ?.getBoundingClientRect();
            if (rect?.width > 0 && rect?.height > 0) return;
            completing = true;
            pl.stage.app.off("postrender", rendered);
            const gl = pl.stage.device.gl,
              f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            const check = () => {
              const status = gl.clientWaitSync(f, 0, 0);
              if (status === gl.WAIT_FAILED) {
                window.__p3dfComplete = { error: "GPU completion fence failed" };
                return;
              }
              if (status === gl.TIMEOUT_EXPIRED) return setTimeout(check, 0);
              gl.deleteSync(f);
              window.__p3dfComplete = {
                first3dMs: performance.now() - began,
                source: builtin
                  ? "sample selection -> completed new Sharp frame"
                  : supplied
                    ? "supplied-depth construction (decode excluded) -> completed new custom Sharp frame"
                    : "file-input change -> completed new custom Sharp frame",
                backgroundPending: !!photo.backgroundPending,
              };
              pl.setPaused(true);
            };
            check();
          };
          pl.stage.app.on("postrender", rendered);
        };
        window.__p3dfStart = start;
        if (!builtin && !supplied)
          document.addEventListener(
            "change",
            (event) => {
              if (event.target.id === "toy-input-file") start();
            },
            { capture: true, once: true },
          );
        window.__p3dfOptions = { id, depth };
      },
      { id: entry.id, builtin: entry.kind === "builtin", depth, supplied },
    );
    const sample = () => samples.push({ at: Date.now(), ...processMemory(service.process().pid) });
    sample();
    timer = setInterval(sample, 200);
    if (entry.kind === "builtin")
      await page.evaluate(
        async ({ id, depth }) => {
          const { app, player } = window.__splashery;
          const scene = structuredClone(player.scene);
          scene.toy = {
            kind: "builtin",
            id: "photo-3d",
            options: { source: id, depth, view: "sharp", detail: "photo" },
          };
          scene.motion.controls = {};
          window.__p3dfStart();
          await app.applyScene(scene);
        },
        { id: entry.id, depth },
      );
    else if (supplied)
      await page.evaluate(
        async ({ url, bytes, depth }) => {
          const p = await import("/src/packs/photo-3d.js"),
            photo = await p.decodePhoto(await (await fetch(url)).blob());
          window.__p3dfStart();
          const d = p.unpackDepth(new Uint8Array(bytes));
          p.usePhoto(photo, d, "Supplied audit input");
          window.__p3dfDepth = { w: d.w, h: d.h, d: Array.from(d.d) };
          await window.__splashery.app.setToyOptions({
            source: "custom",
            view: "sharp",
            detail: "photo",
            depth,
          });
        },
        { url: server.inputUrl(entry), bytes: supplied, depth },
      );
    else {
      await page.evaluate(async (depth) => {
        await window.__splashery.app.setToyOptions({ depth, view: "sharp", detail: "photo" });
      }, depth);
      await page.locator("#toy-input-file").setInputFiles(entry.file);
    }
    await page.waitForFunction(() => window.__p3dfComplete, null, { timeout: 240000 });
    const timing = await page.evaluate(() => window.__p3dfComplete);
    if (timing.error) throw new Error(timing.error);
    await page.evaluate(async () => {
      const pl = window.__splashery.player;
      pl.motion.setControl("flat", 0, { snap: true });
      pl.motion.setControl("layers", 0, { snap: true });
      for (let i = 0; i < 5; i++) await pl.stage.captureFrame();
    });
    sample();
    clearInterval(timer);
    timer = null;
    const state = await page.evaluate(() => {
      const pl = window.__splashery.player;
      return {
        native: [pl.stage.canvas.width, pl.stage.canvas.height],
        ratio: pl.stage.pixelRatio(),
        dpr: devicePixelRatio,
        profile: pl.profile,
        renderer: window.__p3dfRenderer,
        sharp: window.__psv.state(),
        options: pl.scene.toy.options,
      };
    });
    if (state.dpr !== screen.deviceScaleFactor || state.profile !== screen.profile)
      throw new Error("The requested render profile was not used");
    state.browser = browser.version();
    const textures = await texturesR3(page),
      source = decode(textures.surface),
      field = await referenceDepthR3(page);
    const thin = thinAnchorsR4(source, field),
      allEdges = sourceAnchorsR3(source, field),
      step = Math.max(1, Math.ceil(allEdges.anchors.length / 200)),
      edges = allEdges.anchors.filter((_, i) => i % step === 0),
      quads = revealQuads(field);
    const minimum = minimumField(
      Float32Array.from(field.data, (v) => v / 255),
      field.width,
      field.height,
      Math.ceil(0.471 * field.height),
    );
    let depthScore = cueDepth(source, field);
    if (entry.truth) {
      const predicted = await page.evaluate(() => {
        const d = window.__p3dfDepth;
        if (!d) throw new Error("The actual inference response was not observed");
        return { w: d.w, h: d.h, d: Array.from(d.d) };
      });
      depthScore = truthScore(entry, predicted);
      fs.writeFileSync(path.join(folder, `${prefix}-model-depth.json`), JSON.stringify(predicted));
    }
    const gray = {
      width: field.width,
      height: field.height,
      data: Buffer.alloc(field.width * field.height * 4),
    };
    for (let i = 0; i < field.data.length; i++)
      gray.data.set([field.data[i], field.data[i], field.data[i], 255], i * 4);
    png(path.join(folder, `${prefix}-depth.png`), gray);
    fs.writeFileSync(
      path.join(folder, `${prefix}-anchors.json`),
      JSON.stringify({
        thin,
        edgeCandidates: allEdges.candidates,
        edgeSupported: allEdges.anchors.length,
        edges,
        quads: quads.length,
        field,
      }),
    );
    const rows = [];
    fs.writeFileSync(
      path.join(folder, `${prefix}-depth-diagnostic.json`),
      JSON.stringify(depthScore),
    );
    const { anchors: cueAnchors, ...depthSummary } = depthScore;
    for (const [yaw, pitch] of poses) {
      const color = await poseR3(page, yaw, pitch, "color", [1, 1, 1], 2),
        actual = decode(color.image);
      const file = `${prefix}-${yaw}-${pitch}.png`;
      png(path.join(folder, file), actual);
      const artifacts = {};
      artifacts["renders/" + file] = hash(fs.readFileSync(path.join(folder, file)));
      const boundaryFile = `renders/${prefix}-${yaw}-${pitch}-boundary.json.gz`;
      fs.writeFileSync(
        path.join(out, boundaryFile),
        zlib.gzipSync(JSON.stringify(color.corners), { level: 3 }),
      );
      artifacts[boundaryFile] = hash(fs.readFileSync(path.join(out, boundaryFile)));
      let scores = {};
      if (diagnostics) {
        const m = await poseR3(page, yaw, pitch, "mask", [0, 0, 0], 2),
          u = await poseR3(page, yaw, pitch, "uv", [0, 0, 0], 2),
          mask = decode(m.image),
          uv = decode(u.image);
        if (!mask.data.some((v, i) => i % 4 === 1 && v > 8))
          throw new Error("Blank diagnostic capture");
        png(path.join(folder, `${prefix}-${yaw}-${pitch}-mask.png`), mask);
        png(path.join(folder, `${prefix}-${yaw}-${pitch}-uv.png`), uv);
        for (const kind of ["mask", "uv"]) {
          const name = `renders/${prefix}-${yaw}-${pitch}-${kind}.png`;
          artifacts[name] = hash(fs.readFileSync(path.join(out, name)));
        }
        const projectedEdges = await projectAnchorsR3(page, edges),
          projectedThin = await projectAnchorsR3(page, thin.anchors),
          projectedReveal = await projectAnchorsR3(page, quads);
        scores = poseScores({
          color: actual,
          mask,
          uv,
          field,
          minimum,
          ratio: state.ratio,
          edges,
          thin: thin.anchors,
          projectedEdges,
          projectedThin,
          projectedReveal,
          source,
          corners: color.corners,
        });
        const reveal = {
          width: mask.width,
          height: mask.height,
          data: Buffer.alloc(mask.width * mask.height * 4),
        };
        for (let i = 0; i < scores.holes.roi.length; i++) {
          const v = scores.holes.roi[i];
          if (v) reveal.data.set(v === 255 ? [255, 70, 70, 255] : [70, 150, 255, 255], i * 4);
        }
        const revealFile = `renders/${prefix}-${yaw}-${pitch}-reveal.png`;
        png(path.join(out, revealFile), reveal);
        artifacts[revealFile] = hash(fs.readFileSync(path.join(out, revealFile)));
        // The atlas retains counts and the hashed PNG, not a native-size raster per pose.
        scores.holes = { ...scores.holes };
      }
      rows.push({
        yaw,
        pitch,
        ...scores,
        depth: depthSummary,
        image: "renders/" + file,
        rgbaSha256: hash(actual.data),
        native: state.native,
        boundaryFile,
        artifacts,
      });
    }
    if (externalRequests.length || errors.length)
      throw new Error("Browser errors: " + JSON.stringify({ errors, externalRequests }));
    const turned = rows.filter((r) => r.yaw || r.pitch),
      worst = [...(turned.length ? turned : rows)].sort((a, b) => severity(b) - severity(a))[0],
      front = rows.find((r) => r.yaw === 0 && r.pitch === 0) || rows[0],
      summary = summarize(rows),
      values = Object.fromEntries(Object.entries(summary).map(([k, s]) => [k, s.value]));
    for (const [label, row] of [
      ["front", front],
      ["worst", worst],
    ])
      png(
        path.join(folder, `${prefix}-${label}-crop.png`),
        crop(
          PNG.sync.read(fs.readFileSync(path.join(out, row.image))),
          JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(out, row.boundaryFile)))),
        ),
      );
    const finite = (key) => samples.map((s) => s[key]).filter(Number.isFinite);
    const pss = finite("pssBytes"),
      rss = finite("rssBytes");
    values.speed = timing.first3dMs;
    values.memory = pss.length ? Math.max(...pss) : rss.length ? Math.max(...rss) : null;
    return {
      ...state,
      timing,
      summary,
      values,
      severity: Math.max(...rows.map(severity)),
      front: front.image,
      worst: worst.image,
      frontPreview: `renders/${prefix}-front-crop.png`,
      worstPreview: `renders/${prefix}-worst-crop.png`,
      worstPose: [worst.yaw, worst.pitch],
      depthImage: `renders/${prefix}-depth.png`,
      depthKind: depthScore.kind,
      rows,
      memory: {
        samplingMs: 200,
        window:
          "Immediately before input/selection through first new Sharp frame and five subsequent frames; shorter transients may be missed",
        peakPssBytes: pss.length ? Math.max(...pss) : null,
        peakRssBytes: rss.length ? Math.max(...rss) : null,
        samples,
      },
      errors,
      externalRequests,
    };
  } finally {
    if (timer) clearInterval(timer);
    await browser.close();
    await service.close();
  }
}
