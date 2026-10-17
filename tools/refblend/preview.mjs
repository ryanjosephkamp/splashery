#!/usr/bin/env node
// Local-only result viewer. No uploads, external scripts, or changes to the Splashery site.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(here, "../..");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".ply": "application/octet-stream",
  ".wasm": "application/wasm",
};
export async function startPreview(resultDir, port = 0) {
  const result = await fs.realpath(resultDir);
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let base, rel;
      if (pathname === "/") {
        base = here;
        rel = "preview.html";
      } else if (pathname.startsWith("/result/")) {
        base = result;
        rel = pathname.slice(8);
      } else if (pathname.startsWith("/preview/")) {
        base = here;
        rel = pathname.slice(9);
        if (!["preview.js", "motion.mjs"].includes(rel)) throw new Error("Unknown preview file");
      } else if (pathname.startsWith("/src/") || pathname.startsWith("/vendor/")) {
        base = root;
        rel = pathname.slice(1);
      } else {
        res.writeHead(404);
        res.end();
        return;
      }
      if (!mime[path.extname(rel)] || rel.split("/").some((s) => s.startsWith(".") || !s))
        throw new Error("Unsupported file");
      const file = await fs.realpath(path.join(base, rel));
      if (!file.startsWith(base + path.sep)) throw new Error("Outside allowed directory");
      const bytes = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dir = process.argv[2];
  if (!dir) throw new Error("Usage: node tools/refblend/preview.mjs <result> [port]");
  const { url } = await startPreview(dir, Number(process.argv[3] || 0));
  console.log(url);
}
