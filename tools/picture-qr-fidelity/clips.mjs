// Deterministic phone-size tap clips, using the stepping method in tools/effect-clip.mjs.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { LINKS } from "../cdx-circle-study.mjs";
const arg = (key, fallback) =>
  process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const out = arg("out", ".cache/picture-qr-fidelity/review-export/clips");
const baseline = arg("baseline", "cb8a8315"),
  baselineDirectory = arg("baseline-dir", ".cache/picture-qr-fidelity/review-pass");
fs.mkdirSync(out, { recursive: true });
const files = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
    );
const hash = (list) =>
  Object.fromEntries(
    list
      .sort()
      .map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")]),
  );
const baselineTree = new Map(
  execFileSync("git", ["ls-tree", "-r", baseline, "src"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => {
      const [meta, file] = line.split("\t");
      return [file, meta.split(" ")[2]];
    }),
);
for (const file of files(`${baselineDirectory}/src`)) {
  const relative = file.slice(`${baselineDirectory}/`.length),
    bytes = fs.readFileSync(file),
    blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  if (baselineTree.get(relative) !== blob) throw Error(`Frozen main differs from Git: ${relative}`);
}
fs.writeFileSync(
  path.join(out, "provenance.json"),
  JSON.stringify(
    {
      model: "Codex (GPT-6)",
      author: "Ryan with Codex (GPT-6)",
      baseline,
      head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      created: new Date().toISOString(),
      hashes: hash([
        ...files("src/qr-craft"),
        ...files("src/qr"),
        "src/packs/qr-craft.js",
        "src/player.js",
        "src/stage.js",
        "src/photo-splats.js",
        "vendor/jsqr/jsQR.js",
        "package-lock.json",
        "tools/picture-qr-fidelity/clips.mjs",
        "assets/toys/photo-3d/ai/farm.jpg",
        "assets/toys/qr-picture/codex/cdx-qr-ai-fern.jpg",
      ]),
      frozenMain: hash(files(`${baselineDirectory}/src`)),
    },
    null,
    2,
  ) + "\n",
);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const clips = [];
for (const mode of ["main", "detail"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 }),
  );
  if (mode === "main")
    await page.route("**/src/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const file = `${baselineDirectory}${pathname}`;
      if (!fs.existsSync(file)) throw Error(`Missing frozen main module ${pathname}`);
      return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file) });
    });
  await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await import("/src/packs/qr-craft.js");
    window.__splashery.qrCraft.autoCheck = false;
    await window.__splashery.app.chooseToy("qr-picture");
  });
  for (const [picture, shape] of [
    ["ai-farm", "circle"],
    ["cdx-qr-ai-fern", "square"],
  ]) {
    await page.evaluate(
      async (options) => {
        window.__splashery.qrCraft.autoCheck = true;
        await window.__splashery.app.setToyOptions(options);
      },
      {
        text: LINKS[0],
        picture,
        shape,
        fidelity: mode === "main" ? "standard" : "detail",
        level: "H",
        contrast: 0.5,
        center: "small",
        size: "more",
        style: "color",
      },
    );
    await page.waitForFunction(
      ({ picture, shape }) => {
        const { app: a, qrCraft: q } = window.__splashery,
          p = q.picture();
        return (
          !a.busy &&
          p.options.picture === picture &&
          p.options.shape === shape &&
          p.check?.stage?.length === 2 &&
          !p.checking &&
          !a.player.stage.coverDepth &&
          !document.querySelector(".stage-cover")
        );
      },
      { picture, shape },
      { timeout: 180000 },
    );
    if (mode === "detail") {
      fs.mkdirSync(path.join(out, "screenshots"), { recursive: true });
      for (const size of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(
            out,
            "screenshots",
            `cdx-qr-fidelity-${picture}-${shape}-${size.width}x${size.height}.png`,
          ),
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    const result = await page.evaluate(async () => {
      const { app: a, qrCraft: q } = window.__splashery,
        player = a.player,
        stage = player.stage;
      q.autoCheck = false;
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const { shapeHalf } = await import("/src/qr/circle.js");
      const w = q.picture().woven,
        kit = player.proc.ctx.kit,
        half = shapeHalf(w.code, q.picture().options.shape),
        pose = {
          yaw: 0,
          pitch: 0,
          roll: 0,
          distance:
            ((half + 1) * kit.transform.scale) /
            Math.tan((19 * Math.PI) / 180) /
            player.camera.radius,
        };
      const size = 390,
        fps = 15,
        before = 0.4,
        seconds = 3.6,
        total = Math.round((before + seconds) * fps),
        handlers = stage.updateHandlers.slice();
      let pending = 0;
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const dt = pending;
        pending = 0;
        for (const handler of handlers) handler(dt);
      });
      stage.setFixedSize([size, size]);
      const gif = GIFEncoder(),
        shots = [],
        picks = new Set([0, 6, 13, 20, 27, 34, 45, 59]);
      for (let frame = 0; frame < total; frame++) {
        if (frame === Math.round(before * fps)) player.act([0, 0, 0]);
        pending = 1 / fps;
        player.camera.cur = { ...player.camera.home, ...pose };
        player.camera.tgt = { ...player.camera.home, ...pose };
        await stage.captureFrame();
        pending = 0;
        const canvas = await stage.captureFrame(),
          rgba = canvas.getContext("2d").getImageData(0, 0, size, size).data,
          palette = quantize(rgba, 256, { format: "rgb565" });
        gif.writeFrame(applyPalette(rgba, palette, "rgb565"), size, size, {
          palette,
          delay: Math.round(1000 / fps),
          repeat: 0,
        });
        if (picks.has(frame))
          shots.push({ bitmap: await createImageBitmap(canvas), time: frame / fps - before });
      }
      gif.finish();
      const strip = document.createElement("canvas");
      strip.width = size * shots.length;
      strip.height = size + 22;
      const context = strip.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, strip.width, strip.height);
      context.fillStyle = "#333";
      context.font = "13px sans-serif";
      shots.forEach((shot, index) => {
        context.drawImage(shot.bitmap, index * size, 0);
        context.fillText(
          shot.time < 0 ? "Before tap" : `${shot.time.toFixed(1)} s`,
          index * size + 8,
          size + 16,
        );
        shot.bitmap.close();
      });
      stage.setFixedSize(null);
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      return {
        bytes: Array.from(gif.bytes()),
        strip: strip.toDataURL("image/png"),
        check: q.picture().check,
      };
    });
    const name = `gpt6-${mode}-${picture}-${shape}`;
    fs.writeFileSync(path.join(out, `${name}.gif`), Buffer.from(result.bytes));
    fs.writeFileSync(
      path.join(out, `${name}-strip.png`),
      Buffer.from(result.strip.split(",")[1], "base64"),
    );
    clips.push({
      mode,
      model: "Codex (GPT-6)",
      author: "Ryan with Codex (GPT-6)",
      picture,
      shape,
      file: `${name}.gif`,
      strip: `${name}-strip.png`,
      check: result.check,
    });
    fs.writeFileSync(path.join(out, "clips.json"), JSON.stringify(clips, null, 2) + "\n");
    console.log(name, result.bytes.length, result.check?.ok);
  }
  await page.close();
}
await browser.close();
