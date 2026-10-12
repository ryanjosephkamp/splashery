// A tiny static server that behaves like GitHub Pages (lane Site r4): a folder is served at "/",
// "/dir" redirects to "/dir/", a folder serves its index.html, and a missing path gets the root
// 404.html with status 404. The folder can be switched while the server runs, which lets a test
// play a visitor who comes back after a deploy. Symbolic links are followed (the staged front door
// links the app's own files).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

export async function startPages(dir) {
  const state = { dir: path.resolve(dir), hits: [] };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let rel = decodeURIComponent(url.pathname);
    state.hits.push(rel);
    let file = path.join(state.dir, rel);
    if (!file.startsWith(state.dir)) return end(res, 403, "no");
    let stat = null;
    try {
      stat = fs.statSync(file);
    } catch {
      // missing
    }
    if (stat?.isDirectory()) {
      if (!rel.endsWith("/")) {
        res.writeHead(301, { Location: `${rel}/${url.search}` });
        return res.end();
      }
      file = path.join(file, "index.html");
      try {
        stat = fs.statSync(file);
      } catch {
        stat = null;
      }
    }
    if (!stat?.isFile()) {
      const nf = path.join(state.dir, "404.html");
      if (fs.existsSync(nf)) {
        res.writeHead(404, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
        return res.end(fs.readFileSync(nf));
      }
      return end(res, 404, "Not found");
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    hits: state.hits,
    setDir: (d) => (state.dir = path.resolve(d)),
    close: () => new Promise((ok) => server.close(ok)),
  };
}

function end(res, code, text) {
  res.writeHead(code, { "Content-Type": "text/plain" });
  res.end(text);
}
