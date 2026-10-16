import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { LINKS as STUDY_LINKS } from "../cdx-circle-study.mjs";
import { read } from "../qrc-picture.mjs";
import { readZxingCpp } from "../qrs-study/readers.mjs";
import { resize, capture, lightGradient } from "../qr-scan-lab/sim.mjs";
import { loadBlurKernel } from "../../src/qr-craft/fast-blur.js";
import { gaussBlur } from "../../src/qr-craft/picture.js";
import { capturedFidelity, stickerFidelity } from "./metrics.mjs";
import { circleCrop } from "./captures.mjs";
import { CONDITIONS } from "./captures.mjs";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
const blurScratch = new Float32Array(3000000);
const mode = arg("mode", "detail"),
  profile = arg("profile", "low");
const isMain = mode.startsWith("main");
const automatic = arg("auto", "0") === "1";
const payloads = arg("payloads", "").split(",").filter(Boolean).map(Number);
const shapes = arg("shapes", "square,circle").split(",");
const ids = arg("photos", "ai-farm,cdx-qr-ai-blue-vase").split(",");
const shard = Number(arg("shard", "0")),
  shards = Number(arg("shards", "1"));
const corpus = [...SAMPLES, ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json"))]
  .filter((s) => ids.includes("all") || ids.includes(s.id))
  .filter((s, i) => i % shards === shard);
const out = `.cache/picture-qr-fidelity/browser-${mode}-${profile}-${shard}.jsonl`;
const previous = fs.existsSync(out)
  ? fs.readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  : [];
const completed = previous.filter((r) => r.scores && r.scans?.length === CONDITIONS.length);
const incomplete = previous.filter((r) => !completed.includes(r));
if (incomplete.length) {
  // Preserve interrupted harness attempts, then retry their missing captures.
  // Completed scan failures stay in the matrix and are never silently retried.
  fs.appendFileSync(`${out}.attempts.jsonl`, incomplete.map(JSON.stringify).join("\n") + "\n");
  fs.writeFileSync(out, completed.map(JSON.stringify).join("\n") + (completed.length ? "\n" : ""));
}
const done = new Set(completed.map((r) => r.key));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
if (isMain)
  await page.route("**/src/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file = `.cache/picture-qr-fidelity/main${pathname}`;
    if (!fs.existsSync(file)) throw Error(`Missing frozen main module ${pathname}`);
    return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file) });
  });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (message) => {
  if (message.type() === "error") console.log("browsererror", message.text().slice(0, 5000));
  else if (message.text().startsWith("Picture QR candidate")) console.log(message.text());
});
await page.goto(`http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=${profile}&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
await page.evaluate(
  async ({ linear, tiles, up, blur, trace, guard, fast, errors, direct, green, channel }) => {
    await import("/src/packs/qr-craft.js");
    window.__splashery.qrCraft.autoCheck = false;
    window.__splashery.qrCraft.linearLattice = linear;
    window.__splashery.qrCraft.photoTiles = tiles;
    window.__splashery.qrCraft.detailUp = up;
    window.__splashery.qrCraft.textureBlur = blur;
    window.__splashery.qrCraft.trace = trace;
    window.__splashery.qrCraft.textureGuard = guard;
    window.__splashery.qrCraft.preferContinuous = fast;
    window.__splashery.qrCraft.preferCorrection = errors;
    window.__splashery.qrCraft.captureValidation = direct;
    window.__splashery.qrCraft.green = green;
    window.__splashery.qrCraft.detailChannel = channel;
    await window.__splashery.app.chooseToy("qr-picture");
  },
  {
    linear: arg("lattice", "legacy") === "linear",
    tiles: arg("tiles", "0") === "1",
    up: Number(arg("up", "0")),
    blur: Number(arg("texture-blur", "0")),
    trace: arg("trace", "0") === "1",
    guard: Number(arg("guard", "0")),
    fast: arg("fast", "0") === "1",
    errors: arg("errors", "0") === "1",
    direct: arg("direct", "0") === "1",
    green: arg("green", "0") === "1",
    channel: arg("channel", ""),
  },
);
for (const picture of corpus) {
  const source = await page.evaluate(async (picture) => {
    const { RECIPES } = await import("/src/packs/qr-craft.js");
    const blob = await (await fetch("/" + picture.file)).blob();
    await RECIPES["qr-picture"].input.read(
      "",
      picture.label,
      new File([blob], picture.id + ".jpg", { type: "image/jpeg" }),
    );
    // Repeat the toy's decoder independently, so fidelity uses its exact resized source pixels.
    const bmp = await createImageBitmap(blob),
      f = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * f));
    canvas.height = Math.max(1, Math.round(bmp.height * f));
    canvas
      .getContext("2d", { willReadFrequently: true })
      .drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return canvas.toDataURL("image/png");
  }, picture);
  const sourcePng = PNG.sync.read(Buffer.from(source.split(",")[1], "base64"));
  const sourceData = new Float32Array(sourcePng.width * sourcePng.height * 3);
  for (let i = 0; i < sourcePng.width * sourcePng.height; i++)
    for (let ch = 0; ch < 3; ch++) sourceData[i * 3 + ch] = sourcePng.data[i * 4 + ch] / 255;
  const sourcePicture = { w: sourcePng.width, h: sourcePng.height, data: sourceData };
  fs.mkdirSync(".cache/picture-qr-fidelity/review/sources", { recursive: true });
  fs.writeFileSync(
    `.cache/picture-qr-fidelity/review/sources/${picture.id}.png`,
    Buffer.from(source.split(",")[1], "base64"),
  );
  for (const [link, text] of [...STUDY_LINKS.slice(0, Number(arg("links", "1"))).entries()].filter(
    ([index]) => !payloads.length || payloads.includes(index),
  ))
    for (const shape of shapes) {
      const key = `${picture.id}/${link}/${shape}`;
      if (done.has(key)) continue;
      let row;
      try {
        await page.evaluate((automatic) => {
          window.__splashery.app.player.setPaused(false);
          if (automatic) window.__splashery.qrCraft.autoCheck = true;
        }, automatic);
        const start = performance.now();
        await page.evaluate(
          async (o) => {
            await window.__splashery.app.setToyOptions(o);
          },
          {
            text,
            picture: "own",
            level: "H",
            contrast: 0.5,
            center: "small",
            style: "color",
            size: "more",
            shape,
            fidelity: isMain ? "standard" : "detail",
          },
        );
        await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120000 });
        if (automatic)
          await page.waitForFunction(
            ({ text, shape }) => {
              const { app: a, qrCraft: q } = window.__splashery,
                p = q.picture();
              return (
                !a.busy &&
                p.options.text === text &&
                p.options.shape === shape &&
                p.check?.stage?.length === 2 &&
                !p.checking &&
                !a.player.stage.coverDepth &&
                !document.querySelector(".stage-cover")
              );
            },
            { text, shape },
            { timeout: 120000 },
          );
        const appearanceMs = performance.now() - start;
        const result = await page.evaluate(
          async ({ automatic, prediction }) => {
            const { app: a, qrCraft: q } = window.__splashery;
            const ck = automatic ? q.picture().check : await q.checkPicture();
            const w = q.picture().woven;
            const { shapeHalf } = await import("/src/qr/circle.js");
            // Independent post-capture reads do not need an animating GPU stage.
            // Resume before the next measured option change.
            a.player.setPaused(true);
            let predicted;
            if (prediction && w.fidelity === "detail") {
              const { textureFrame } = await import("/src/qr-craft/frame.js");
              const frame = textureFrame(w, null, q.picture().options.shape);
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = frame.width;
              canvas
                .getContext("2d")
                .putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
              predicted = canvas.toDataURL("image/png");
            }
            return {
              predicted,
              shot: q.lastShot(),
              check: ck,
              version: w.code.version,
              codeSize: w.code.size,
              mask: w.code.mask,
              rotation: w.code.rotation || 0,
              rendering: w.rendering,
              correction: w.code.intentionalErrors,
              margin: w.margin,
              fidelity: w.fidelity ?? "standard",
              modules: 2 * (shapeHalf(w.code, q.picture().options.shape) + 1),
              count: a.player.proc.ctx.kit.count,
              error: q.picture().error,
            };
          },
          { automatic, prediction: arg("prediction", "0") === "1" },
        );
        const ms = performance.now() - start;
        if (!result.shot) throw Error(result.error || "No rendered pixels");
        const img = PNG.sync.read(Buffer.from(result.shot.split(",")[1], "base64")),
          scans = [];
        const reference =
          shape === "circle" ? circleCrop(sourcePicture, result.codeSize) : sourcePicture;
        const scores = capturedFidelity(reference, img, result.codeSize, result.modules);
        const whole =
          shape === "circle"
            ? stickerFidelity(sourcePicture, { code: { size: result.codeSize } }, img)
            : null;
        for (const ppm of [8, 4]) {
          const sticker = resize(img, Math.round(result.modules * ppm));
          for (const c of CONDITIONS.filter((c) => c.ppm === ppm)) {
            let frame =
              c.yaw || c.pitch
                ? capture(sticker, {
                    modules: result.modules,
                    modulePx: ppm,
                    yaw: c.yaw,
                    pitch: c.pitch,
                    margin: 0.1,
                  })
                : { ...sticker, data: new Uint8ClampedArray(sticker.data) };
            if (c.light) frame = lightGradient(frame, c.light);
            if (c.bright !== 1)
              for (let i = 0; i < frame.data.length; i++)
                if (i % 4 !== 3) frame.data[i] *= c.bright;
            gaussBlur(frame.data, frame.width, frame.height, c.blur * ppm, blurScratch);
            scans.push({
              condition: c.id,
              jsqr: read(frame.data, frame.width, frame.height) === text,
              zxingcpp: (await readZxingCpp(frame)) === text,
            });
          }
        }
        const directory = `.cache/picture-qr-fidelity/review/${mode}`;
        fs.mkdirSync(directory, { recursive: true });
        if (result.predicted) {
          fs.writeFileSync(
            `${directory}/${picture.id}-${shape}-${link}-predicted.png`,
            Buffer.from(result.predicted.split(",")[1], "base64"),
          );
          fs.writeFileSync(
            `${directory}/${picture.id}-${shape}-${link}-render.png`,
            Buffer.from(result.shot.split(",")[1], "base64"),
          );
          delete result.predicted;
        }
        if (link === 0 || scans.some((s) => !s.jsqr || !s.zxingcpp)) {
          fs.writeFileSync(
            `${directory}/${picture.id}-${shape}-${link}-render.png`,
            Buffer.from(result.shot.split(",")[1], "base64"),
          );
          await page.screenshot({
            path: `${directory}/${picture.id}-${shape}-${link}-390x844.png`,
          });
        }
        delete result.shot;
        row = {
          key,
          picture: picture.id,
          link,
          text,
          shape,
          profile,
          ms,
          appearanceMs,
          scores,
          stickerScores: whole,
          ...result,
          scans,
        };
      } catch (e) {
        if (page.isClosed() || !browser.isConnected()) throw e;
        row = { key, picture: picture.id, link, text, shape, profile, error: e.message };
      }
      fs.appendFileSync(out, JSON.stringify(row) + "\n");
      console.log(
        key,
        row.error ||
          `${row.scans.filter((s) => s.jsqr && s.zxingcpp).length}/24 ${Math.round(row.ms)}ms, ${row.fidelity}`,
      );
    }
}
await browser.close();
