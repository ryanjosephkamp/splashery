// Controlled warm-asset appearance timing. Run with other study workers stopped.
// Includes ordinary automatic layout/stage checks and removal of the scanning cover.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { LINKS } from "../cdx-circle-study.mjs";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const repeats = Number(arg("repeats", "3")),
  links = arg("links", "0,6,9").split(",").map(Number);
const ids = arg("photos", "ai-farm,wildflowers,cdx-qr-ai-fern").split(",");
const corpus = [
  ...SAMPLES,
  ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
].filter((p) => ids.includes("all") || ids.includes(p.id));
const out = `.cache/picture-qr-fidelity/benchmark-${arg("name", "phone")}.jsonl`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
for (let repeat = 0; repeat < repeats; repeat++)
  for (const mode of arg("mode", "both") === "both"
    ? repeat % 2
      ? ["detail", "main"]
      : ["main", "detail"]
    : [arg("mode", "detail")]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    if (mode === "main")
      await page.route("**/src/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        const file = `.cache/picture-qr-fidelity/main${path}`;
        if (!fs.existsSync(file)) throw Error(`Missing frozen main module ${path}`);
        return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file) });
      });
    page.on("console", (m) => {
      if (m.text().includes("worker fallback")) console.log(m.text());
    });
    await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=low&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(
      async ({ tiles, up, blur }) => {
        await import("/src/packs/qr-craft.js");
        window.__splashery.qrCraft.autoCheck = false;
        window.__splashery.qrCraft.photoTiles = tiles;
        window.__splashery.qrCraft.detailUp = up;
        window.__splashery.qrCraft.textureBlur = blur;
        await window.__splashery.app.chooseToy("qr-picture");
      },
      {
        tiles: arg("tiles", "0") === "1",
        up: Number(arg("up", "0")),
        blur: Number(arg("texture-blur", "0")),
      },
    );
    for (const picture of corpus) {
      await page.evaluate(async (p) => {
        const { RECIPES } = await import("/src/packs/qr-craft.js");
        const blob = await (await fetch("/" + p.file)).blob();
        await RECIPES["qr-picture"].input.read(
          "",
          p.label,
          new File([blob], p.id + ".jpg", { type: "image/jpeg" }),
        );
      }, picture);
      for (const link of links)
        for (const shape of ["square", "circle"]) {
          await page.evaluate(() => {
            window.__splashery.qrCraft.autoCheck = true;
          });
          const session = arg("cpu", "0") === "1" ? await page.context().newCDPSession(page) : null;
          if (session) {
            await session.send("Profiler.enable");
            await session.send("Profiler.start");
          }
          const start = performance.now();
          await page.evaluate(
            async (o) => {
              await window.__splashery.app.setToyOptions(o);
            },
            {
              text: LINKS[link],
              picture: "own",
              fidelity: mode === "main" ? "standard" : "detail",
              shape,
              level: "H",
              center: "small",
              contrast: 0.5,
              style: "color",
              size: "more",
            },
          );
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
            { text: LINKS[link], shape },
            { timeout: 180000 },
          );
          const ms = performance.now() - start;
          if (session) {
            const { profile } = await session.send("Profiler.stop");
            fs.writeFileSync(
              `.cache/picture-qr-fidelity/cpu-${mode}-${picture.id}-${link}-${shape}.json`,
              JSON.stringify(profile),
            );
            await session.detach();
          }
          const result = await page.evaluate(() => {
            const { app: a, qrCraft: q } = window.__splashery,
              p = q.picture();
            return {
              shot: q.lastShot(),
              check: p.check,
              margin: p.woven.margin,
              method: p.woven.rendering?.method,
              rejected: p.rejected,
              kitCount: a.player.proc.ctx.kit.count,
            };
          });
          if (result.shot) {
            fs.mkdirSync(".cache/picture-qr-fidelity/benchmark-renders", { recursive: true });
            fs.writeFileSync(
              `.cache/picture-qr-fidelity/benchmark-renders/${mode}-${picture.id}-${link}-${shape}.png`,
              Buffer.from(result.shot.split(",")[1], "base64"),
            );
            delete result.shot;
          }
          const row = { repeat, mode, picture: picture.id, link, shape, ms, ...result };
          fs.appendFileSync(out, JSON.stringify(row) + "\n");
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
    await page.close();
  }
await browser.close();
