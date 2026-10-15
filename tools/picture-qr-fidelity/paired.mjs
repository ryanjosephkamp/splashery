// Isolated paired phone timing. Stop all other study/test workers before running.
// Source decoding is outside the clock; the normal scan cover and checks are inside it.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { LINKS } from "../cdx-circle-study.mjs";
import { sourcePicture, qualifyCapture } from "./qualify.mjs";
const arg = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = ".cache/picture-qr-fidelity",
  baseline = arg("baseline", "41b21e74"),
  baselineDirectory = arg("baseline-dir", `${root}/main`),
  ids = arg("photos", "ai-farm,cdx-qr-ai-fern,cdx-qr-ai-cactus").split(","),
  links =
    arg("links", "0,6,9") === "all"
      ? Array.from({ length: 10 }, (_, i) => i)
      : arg("links", "0,6,9").split(",").map(Number),
  shapes = arg("shapes", "square,circle").split(",");
const corpus = [
  ...SAMPLES,
  ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
].filter((p) => ids.includes("all") || ids.includes(p.id));
const first = arg("first", "").split(",").filter(Boolean);
if (first.length)
  corpus.sort(
    (a, b) =>
      (first.includes(a.id) ? first.indexOf(a.id) : first.length) -
      (first.includes(b.id) ? first.indexOf(b.id) : first.length),
  );

const modes = arg("modes", "main,detail").split(",");
if (modes.some((mode) => !["main", "detail"].includes(mode))) throw Error("Unknown timing mode");
const resumeFrom = arg("resume-from", "");
if (resumeFrom && (modes.length !== 1 || modes[0] !== "main"))
  throw Error("Only unchanged frozen-main measurements may be inherited");
const casesFile = arg("cases", "");
const selectedCases = casesFile ? new Set(JSON.parse(fs.readFileSync(casesFile))) : null;
if (
  selectedCases &&
  (!selectedCases.size ||
    [...selectedCases].some(
      (key) =>
        !corpus.some((p) =>
          links.some((link) => shapes.some((shape) => key === `${p.id}/${link}/${shape}`)),
        ),
    ))
)
  throw Error("Unknown or empty selected case set");
const qualify = arg("qualify", "0") === "1";
const name = arg("name", "phone");
const files = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
    );
const hashes = Object.fromEntries(
  [
    ...files("src/qr-craft"),
    ...files("src/qr"),
    "src/packs/qr-craft.js",
    "src/player.js",
    "src/stage.js",
    "src/photo-splats.js",
    "tools/picture-qr-fidelity/paired.mjs",
    "tools/picture-qr-fidelity/qualify.mjs",
    "tools/picture-qr-fidelity/metrics.mjs",
    "tools/picture-qr-fidelity/captures.mjs",
    "tools/qrs-study/readers.mjs",
    "tools/qrc-picture.mjs",
    "tools/qr-scan-lab/sim.mjs",
    "vendor/jsqr/jsQR.js",
    "package-lock.json",
    ...(casesFile ? [casesFile] : []),
    ...corpus.flatMap((picture) => [
      picture.file,
      ...(qualify ? [`${root}/review/sources/${picture.id}.png`] : []),
    ]),
  ]
    .sort()
    .map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")]),
);
// Every served baseline module must still be the exact frozen Git blob.
const baselineTree = new Map(
  execFileSync("git", ["ls-tree", "-r", baseline, "src"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => {
      const [meta, file] = line.split("\t");
      return [file, meta.split(" ")[2]];
    }),
);
const frozenMain = Object.fromEntries(
  files(`${baselineDirectory}/src`)
    .sort()
    .map((file) => {
      const relative = file.slice(`${baselineDirectory}/`.length),
        bytes = fs.readFileSync(file);
      const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      if (baselineTree.get(relative) !== blob)
        throw Error(`Frozen main differs from Git: ${relative}`);
      return [relative, createHash("sha256").update(bytes).digest("hex")];
    }),
);
const provenanceFile = `${root}/paired-${name}-provenance.json`;
if (fs.existsSync(provenanceFile)) {
  const previous = JSON.parse(fs.readFileSync(provenanceFile));
  if (JSON.stringify(previous.hashes) !== JSON.stringify(hashes))
    throw Error("Source changed. Use a new run name instead of mixing candidate revisions.");
  if (JSON.stringify(previous.args) !== JSON.stringify(process.argv.slice(2)))
    throw Error("Run settings changed. Use a new run name.");
} else
  fs.writeFileSync(
    provenanceFile,
    JSON.stringify(
      {
        baseline,
        head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        started: new Date().toISOString(),
        node: process.version,
        hardwareConcurrency: 4,
        args: process.argv.slice(2),
        hashes,
        frozenMain,
        inheritedMain: resumeFrom || null,
        series:
          modes.length === 2
            ? "balanced paired"
            : "isolated single mode; compare with separately captured frozen main",
      },
      null,
      2,
    ) + "\n",
  );
const timingFile = `${root}/paired-${name}.jsonl`;
const previous = fs.existsSync(timingFile)
  ? fs.readFileSync(timingFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  : [];
const inherited = resumeFrom
  ? JSON.parse(fs.readFileSync(`${root}/paired-${resumeFrom}-provenance.json`))
  : null;
if (inherited) {
  if (inherited.baseline !== baseline) throw Error("Frozen main baseline changed");
  for (const [file, hash] of Object.entries(hashes))
    if (
      (corpus.some((picture) => picture.file === file) ||
        [
          "tools/picture-qr-fidelity/qualify.mjs",
          "tools/picture-qr-fidelity/metrics.mjs",
          "tools/picture-qr-fidelity/captures.mjs",
          "tools/qrs-study/readers.mjs",
          "tools/qr-scan-lab/sim.mjs",
          "vendor/jsqr/jsQR.js",
          "package-lock.json",
        ].includes(file)) &&
      inherited.hashes[file] !== hash
    )
      throw Error(`Frozen-main input or assessment protocol changed: ${file}`);
}
const inheritedRows = resumeFrom
  ? fs
      .readFileSync(`${root}/paired-${resumeFrom}.jsonl`, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse)
      .filter((r) => r.mode === "main" && !r.error)
  : [];
const done = new Set(
  [...previous, ...inheritedRows].filter((r) => !r.error).map((r) => r.pair + "/" + r.mode),
);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const pages = {};
for (const mode of ["main", "detail"]) {
  const page = (pages[mode] = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  }));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 }),
  );
  if (mode === "main")
    await page.route("**/src/**", (route) => {
      const pathname = new URL(route.request().url()).pathname,
        file = `${baselineDirectory}${pathname}`;
      if (!fs.existsSync(file)) throw Error(`Missing frozen main module ${pathname}`);
      return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file) });
    });
  page.on("pageerror", (error) => console.log(mode, error.message));
  await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(
    async (settings) => {
      await import("/src/packs/qr-craft.js");
      const { app: a, qrCraft: q } = window.__splashery;
      q.autoCheck = false;
      if (settings.tiles !== null) q.photoTiles = settings.tiles;
      if (settings.up !== null) q.detailUp = settings.up;
      if (settings.blur !== null) q.textureBlur = settings.blur;
      if (settings.fast !== null) q.preferContinuous = settings.fast;
      if (settings.errors !== null) q.preferCorrection = settings.errors;
      if (settings.errorFraction !== null) q.detailErrorFraction = settings.errorFraction;
      if (settings.direct !== null) q.captureValidation = settings.direct;
      q.detailChannel = settings.channel;
      if (settings.finderGuard !== null) q.finderGuard = settings.finderGuard;
      await a.chooseToy("qr-picture");
      const stage = a.player.stage;
      // Stage.frames counts update ticks even when PlayCanvas skips drawing.
      // Count prerender events so this guard measures actual GPU submissions.
      stage.studyRenders = 0;
      stage.app.on("prerender", () => stage.studyRenders++);
      a.player.setPaused(true);
      while (stage.graveyard.length) await new Promise(requestAnimationFrame);
      // Pausing player updates alone leaves the stage's one-second render
      // tail active. Stop it too, so the other page has the GPU to itself.
      a.player.stage.aliveUntil = 0;
      a.player.stage.app.renderNextFrame = false;
      a.player.stage.device.gl?.finish();
    },
    {
      tiles: arg("tiles", "default") === "default" ? null : arg("tiles", "0") === "1",
      up: arg("up", "default") === "default" ? null : Number(arg("up", "0")),
      blur: arg("texture-blur", "default") === "default" ? null : Number(arg("texture-blur", "0")),
      fast: arg("fast", "default") === "default" ? null : arg("fast", "0") === "1",
      errors: arg("errors", "default") === "default" ? null : arg("errors", "0") === "1",
      errorFraction:
        arg("error-fraction", "default") === "default"
          ? null
          : Number(arg("error-fraction", "0.4")),
      direct: arg("direct", "default") === "default" ? null : arg("direct", "0") === "1",
      channel: arg("channel", ""),
      finderGuard:
        arg("finder-guard", "default") === "default" ? null : Number(arg("finder-guard", "3")),
    },
  );
}
let serial = 0;
for (let repeat = 0; repeat < Number(arg("repeats", "3")); repeat++)
  for (const picture of corpus) {
    if (
      links.every((link) =>
        shapes.every((shape) =>
          modes.every((mode) => done.has(`${picture.id}/${link}/${shape}/${repeat}/${mode}`)),
        ),
      )
    )
      continue;
    if (
      selectedCases &&
      !links.some((link) =>
        shapes.some((shape) => selectedCases.has(`${picture.id}/${link}/${shape}`)),
      )
    )
      continue;
    const source = qualify ? sourcePicture(picture.id) : null;
    for (const page of Object.values(pages))
      await page.evaluate(async (picture) => {
        const { RECIPES } = await import("/src/packs/qr-craft.js"),
          blob = await (await fetch("/" + picture.file)).blob();
        await RECIPES["qr-picture"].input.read(
          "",
          picture.label,
          new File([blob], picture.id + ".jpg", { type: "image/jpeg" }),
        );
      }, picture);
    for (const link of links)
      for (const shape of shapes) {
        if (selectedCases && !selectedCases.has(`${picture.id}/${link}/${shape}`)) continue;
        // Balance order within each shape across successive payloads.
        const reverse = (serial + Math.floor(serial / 2)) % 2;
        serial++;
        const order = (reverse ? ["detail", "main"] : ["main", "detail"]).filter((mode) =>
          modes.includes(mode),
        );
        for (const mode of order) {
          const pair = `${picture.id}/${link}/${shape}/${repeat}`;
          if (done.has(pair + "/" + mode)) continue;
          const page = pages[mode];
          const inactive = pages[mode === "main" ? "detail" : "main"];
          const inactiveBefore = await inactive.evaluate(
            () => window.__splashery.player.stage.studyRenders,
          );
          await page.bringToFront();
          await page.evaluate(() => {
            const { app: a, qrCraft: q } = window.__splashery;
            q.autoCheck = true;
            a.player.setPaused(false);
          });
          const options = {
            text: LINKS[link],
            picture: "own",
            fidelity: mode === "main" ? "standard" : "detail",
            shape,
            level: "H",
            center: "small",
            contrast: 0.5,
            style: "color",
            size: "more",
          };
          const profiler =
            arg("profile", "0") === "1" && mode === "detail"
              ? await page.context().newCDPSession(page)
              : null;
          if (profiler) {
            await profiler.send("Profiler.enable");
            await profiler.send("Profiler.start");
          }
          const start = performance.now();
          await page.evaluate((options) => window.__splashery.app.setToyOptions(options), options);
          try {
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
              options,
              { timeout: 180000 },
            );
          } catch (error) {
            const failure = {
              pair,
              mode,
              picture: picture.id,
              link,
              shape,
              ms: performance.now() - start,
              error: error.message,
            };
            fs.appendFileSync(
              `${root}/paired-${name}-attempts.jsonl`,
              JSON.stringify(failure) + "\n",
            );
            const state = await Promise.race([
              page
                .evaluate(() => {
                  const { app: a, qrCraft: q } = window.__splashery,
                    p = q.picture(),
                    stage = a.player.stage;
                  return {
                    busy: a.busy,
                    paused: a.player.paused,
                    token: a.player.loadToken,
                    checking: p.checking,
                    check: p.check,
                    error: p.error,
                    rendering: p.woven?.rendering,
                    coverDepth: stage.coverDepth,
                    tailHolds: stage.renderTailPauses,
                    captures: stage.captureWaiters.length,
                    renderNextFrame: stage.app.renderNextFrame,
                  };
                })
                .catch(() => null),
              new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
            ]);
            fs.writeFileSync(
              `${root}/paired-${name}-failure.json`,
              JSON.stringify({ ...failure, state }, null, 2),
            );
            await page
              .screenshot({ path: `${root}/paired-${name}-failure.png`, timeout: 5000 })
              .catch(() => null);
            await browser.close();
            throw error;
          }
          const ms = performance.now() - start;
          const inactiveAfter = await inactive.evaluate(
            () => window.__splashery.player.stage.studyRenders,
          );
          if (inactiveAfter !== inactiveBefore)
            throw Error(
              `Inactive page rendered ${inactiveAfter - inactiveBefore} frames during the measured case`,
            );
          if (profiler) {
            const { profile } = await profiler.send("Profiler.stop");
            fs.writeFileSync(
              `${root}/cpu-${arg("name", "phone")}-${picture.id}-${link}-${shape}-${repeat}.json`,
              JSON.stringify(profile),
            );
            await profiler.detach();
          }
          const result = await page.evaluate(async () => {
            const { app: a, qrCraft: q } = window.__splashery,
              p = q.picture();
            a.player.setPaused(true);
            a.player.stage.aliveUntil = 0;
            a.player.stage.app.renderNextFrame = false;
            a.player.stage.device.gl?.finish();
            return {
              shot: q.lastShot(),
              check: p.check,
              codeSize: p.woven.code.size,
              mask: p.woven.code.mask,
              rotation: p.woven.code.rotation || 0,
              rendering: p.woven.rendering,
              correction: p.woven.code.intentionalErrors,
              fidelity: p.woven.fidelity ?? "standard",
              modules:
                2 *
                ((await import("/src/qr/circle.js")).shapeHalf(p.woven.code, p.options.shape) + 1),
              error: p.error,
              notice: p.notice || "",
              fallback: p.fallback || null,
              version: p.woven.code.version,
              margin: p.woven.margin,
              method: p.woven.rendering?.method,
              rejected: p.rejected,
              kitCount: a.player.proc.ctx.kit.count,
            };
          });
          if (qualify) {
            const assessment = await qualifyCapture(source, result, LINKS[link], shape);
            const directory = `${root}/review/${name}-${mode}`;
            fs.mkdirSync(directory, { recursive: true });
            if (
              link === 0 ||
              assessment.scans.some((s) => !s.jsqr || !s.zxingcpp) ||
              arg("save", "").split(",").includes(`${picture.id}/${link}/${shape}`)
            ) {
              fs.writeFileSync(
                `${directory}/${picture.id}-${shape}-${link}-render.png`,
                Buffer.from(result.shot.split(",")[1], "base64"),
              );
              await page.screenshot({
                path: `${directory}/${picture.id}-${shape}-${link}-390x844.png`,
              });
            }
            const { shot, ...metadata } = result;
            fs.appendFileSync(
              `${root}/browser-${name}-${mode}-low-0.jsonl`,
              JSON.stringify({
                key: `${picture.id}/${link}/${shape}`,
                picture: picture.id,
                link,
                text: LINKS[link],
                shape,
                profile: "low",
                ms,
                appearanceMs: ms,
                ...metadata,
                ...assessment,
              }) + "\n",
            );
          }
          delete result.shot;
          const row = {
            repeat,
            pair: `${picture.id}/${link}/${shape}/${repeat}`,
            order: order.join(","),
            inactiveFrames: inactiveAfter - inactiveBefore,
            mode,
            picture: picture.id,
            link,
            shape,
            ms,
            ...result,
          };
          fs.appendFileSync(
            `${root}/paired-${arg("name", "phone")}.jsonl`,
            JSON.stringify(row) + "\n",
          );
          console.log(
            mode,
            picture.id,
            link,
            shape,
            Math.round(ms),
            result.check.ok,
            result.method,
          );
        }
      }
  }
await browser.close();
