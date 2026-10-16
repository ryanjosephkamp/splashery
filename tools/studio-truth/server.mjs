import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
};

export async function serve(root, fixtures) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const raw = decodeURIComponent(url.pathname);
      const truth = raw.startsWith("/__truth/");
      const base = path.resolve(truth ? fixtures : root);
      const relative = truth ? raw.slice(9) : raw.slice(1) || "index.html";
      if (relative.split("/").some((s) => s.startsWith(".") || s === "node_modules"))
        throw new Error("Forbidden path");
      const file = path.resolve(base, relative);
      if (!file.startsWith(base + path.sep)) throw new Error("Forbidden path");
      const real = await fsp.realpath(file);
      if (!real.startsWith((await fsp.realpath(base)) + path.sep))
        throw new Error("Forbidden symlink");
      const stat = await fsp.stat(real);
      if (!stat.isFile()) throw new Error("Not a file");
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Accept-Ranges", "bytes");
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (req.headers.range && !range) {
        res.writeHead(416);
        res.end();
        return;
      }
      const start = range ? Number(range[1]) : 0;
      const end = range && range[2] ? Number(range[2]) : stat.size - 1;
      if (start > end || end >= stat.size) {
        res.writeHead(416);
        res.end();
        return;
      }
      res.setHeader("Content-Length", end - start + 1);
      if (range) res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.writeHead(range ? 206 : 200);
      if (req.method === "HEAD") res.end();
      else
        fs.createReadStream(real, { start, end })
          .on("error", () => res.destroy())
          .pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
