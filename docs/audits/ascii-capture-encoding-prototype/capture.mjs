import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.SPLASHERY_REPO || path.resolve(HERE, "../../..");
const DEPS = process.env.SPLASHERY_DEPENDENCIES || path.join(REPO, "node_modules");
const BASE = process.env.SPLASHERY_URL || "http://127.0.0.1:47846/";
const address = new URL(BASE);
if (
  !["127.0.0.1", "localhost"].includes(address.hostname) ||
  address.protocol !== "http:" ||
  address.pathname !== "/"
)
  throw new Error("Capture requires a local repository server at its root URL");
const ADAPTER = `${BASE}docs/audits/ascii-capture-encoding-prototype/capture-adapter.js`;
const { chromium } = await import(pathToFileURL(path.join(DEPS, "playwright/index.mjs")));
const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--out="));
const outputRoot = outputArg ? path.resolve(outputArg.slice(6)) : path.join(HERE, "captures");
const toyArgs = args.filter((arg) => !arg.startsWith("--out="));
const toys = toyArgs.length ? toyArgs : ["grapes", "orange", "strawberry"];
if (toys.some((toy) => !["grapes", "orange", "strawberry"].includes(toy)))
  throw new Error("The prototype has three credited, tested presets: grapes, orange, strawberry");
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: REPO,
  encoding: "utf8",
}).trim();
const browser = await chromium.launch({
  executablePath:
    process.env.SPLASHERY_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--use-angle=metal", "--enable-webgl"],
});
let page;
let interrupted = false;
const interrupt = () => {
  interrupted = true;
  page?.evaluate(() => window.__asciiAbort?.abort()).catch(() => {});
};
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
try {
  await fs.mkdir(outputRoot, { recursive: true });
  for (const toy of toys) {
    if (interrupted) throw new Error("Capture canceled");
    const dir = path.join(outputRoot, toy);
    await fs.mkdir(dir); // Never overwrite an earlier capture.
    page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = [];
    const blocked = [];
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(BASE) || url.startsWith("data:") || url.startsWith("blob:"))
        return route.continue();
      blocked.push(url);
      return route.abort();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${BASE}?renderer=webgl2&profile=high&adapt=off`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
    const start = performance.now();
    const result = await page.evaluate(
      async ({ toy, adapter }) => {
        const { app, player } = window.__splashery;
        const { captureToy } = await import(adapter);
        await app.chooseToy(toy);
        if (player.scene.toy.id !== toy || !player.toyInfo) throw new Error("Toy did not load");
        if (toy === "orange") await app.setToyOption("style", "whole");
        app.setLook({ background: "#111111" });
        window.__asciiAbort = new AbortController();
        const result = await captureToy(player, {
          signal: window.__asciiAbort.signal,
        });
        return {
          ...result,
          renderer: player.deviceType,
          credit: player.toyInfo.credit ?? null,
          kind: player.toyInfo.kind ?? null,
        };
      },
      { toy, adapter: ADAPTER },
    );
    for (const [i, frame] of result.frames.entries())
      await fs.writeFile(
        path.join(dir, `frame-${String(i).padStart(3, "0")}.png`),
        Buffer.from(frame.split(",")[1], "base64"),
        { flag: "wx" },
      );
    const metadata = {
      ...result,
      frames: undefined,
      toy,
      revision,
      source:
        "Fresh task-owned page; manual simulation clock, fixed home camera, lossless PNG frames",
      browser: browser.version(),
      captureWallMs: Math.round(performance.now() - start),
      errors,
      blockedExternalRequests: blocked,
    };
    await fs.writeFile(path.join(dir, "capture.json"), JSON.stringify(metadata, null, 2) + "\n", {
      flag: "wx",
    });
    if (errors.length || blocked.length || !Object.values(result.restored).every(Boolean))
      throw new Error(`Capture failed its receipt checks: ${toy}`);
    console.log(
      JSON.stringify({
        toy,
        frames: result.frameCount,
        seconds: result.seconds,
        restored: result.restored,
        wallMs: metadata.captureWallMs,
      }),
    );
    await page.close();
    page = null;
  }
} finally {
  await browser.close();
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
}
