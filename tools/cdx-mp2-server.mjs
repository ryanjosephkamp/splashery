#!/usr/bin/env node
// Local static verification server with byte ranges. Chromium cannot seek
// these WebM files through Python's SimpleHTTPServer (seekable.end() is 0).
// This is a build/test tool, never imported or required by the static site.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const port = Number(process.argv[2] || 4388);
// A phone can reach the local benchmark when explicitly bound to the LAN.
const host = process.env.SPLASHERY_HOST || "127.0.0.1";
const types = {
  ".md": "text/plain",
  ".txt": "text/plain",
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};
http
  .createServer((req, res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      if (name.split("/").some((part) => part.startsWith("."))) throw new Error("missing");
      if (name.endsWith("/")) name += "index.html";
      const file = path.resolve(root, `.${name}`);
      if (!file.startsWith(`${root}${path.sep}`) || !fs.statSync(file).isFile())
        throw new Error("missing");
      const size = fs.statSync(file).size;
      let start = 0,
        end = size - 1;
      const header = req.headers.range;
      if (header) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(header);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          return res.end();
        }
        if (!match[1]) start = Math.max(0, size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (start > end || start >= size) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          return res.end();
        }
      }
      const headers = {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      };
      if (header) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      res.writeHead(header ? 206 : 200, headers);
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file, { start, end }).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, host, () => console.log(`Static byte-range server: http://${host}:${port}/`));
