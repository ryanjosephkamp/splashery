// An ephemeral loopback server exposes only the renderer's static code and
// explicitly registered model bytes. Private packs never get a public URL.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";

const root = fileURLToPath(new URL("../", import.meta.url));
export async function renderer({ timeoutMs = 600000 } = {}) {
  const files = new Map();
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (files.has(url.pathname)) {
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(files.get(url.pathname));
        return;
      }
      const rel = decodeURIComponent(url.pathname).slice(1);
      if (!/^(src|vendor)\//.test(rel) || rel.split("/").includes(".."))
        throw new Error("No such route");
      const file = path.resolve(root, rel);
      if (!fs.realpathSync(file).startsWith(root)) throw new Error("No such route");
      res.writeHead(200, {
        "Content-Type": file.endsWith(".html") ? "text/html" : "text/javascript",
      });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      timeout: Math.max(1, Math.min(timeoutMs, 60000)),
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
      ],
    });
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    page.setDefaultTimeout(Math.min(60000, timeoutMs));
    const timer = setTimeout(() => {
      browser.close().catch(() => {});
    }, timeoutMs);
    timer.unref();
    let closing;
    page.on("pageerror", (e) => console.error(`Reference renderer: ${e.message}`));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/src/refbuild/render.html`);
    await page.waitForFunction(() => !!window.refRender, { timeout: 60000 });
    return {
      async load(bytes) {
        files.set("/model.ply", Buffer.from(bytes));
        await page.evaluate((url) => window.refRender.load(url), `${base}/model.ply`);
      },
      async render(camera, width = 256, height = width, background = [1, 1, 1], alpha = 0) {
        const url = await page.evaluate(
          ({ camera, width, height, background, alpha }) =>
            window.refRender.render(camera, width, height, background, alpha),
          { camera, width, height, background, alpha },
        );
        return PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
      },
      async close() {
        clearTimeout(timer);
        closing ||= (async () => {
          await browser.close();
          await new Promise((resolve) => server.close(resolve));
        })();
        await closing;
      },
    };
  } catch (e) {
    await browser?.close();
    server.close();
    throw e;
  }
}
