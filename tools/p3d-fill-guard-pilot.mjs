// MIT. A bounded diagnostic; overrides are explicit and never affect the app on disk.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import { inventory, hash } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { measureNext } from "./p3d-next-browser.mjs";
import { POSES } from "./p3df/scoring.mjs";

const root = path.resolve(".cache/photo-3d-fill"),
  ids = process.argv[2]?.split(",") || ["spiral-stairs", "forest", "street"],
  entries = inventory().filter((e) => ids.includes(e.id)),
  upstream = await localServer(entries),
  out = path.join(root, "guard-pilot"),
  sourceHash = hash(fs.readFileSync("src/photo3d/next/fill-guard.js"));
const proxy = http.createServer((req, res) => {
  if (req.url === "/src/photo3d/next/fill.js") {
    res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
    return res.end('export { fillSurface } from "./fill-guard.js";');
  }
  http
    .get(new URL(req.url, upstream.url), (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    })
    .on("error", () => {
      res.writeHead(502);
      res.end();
    });
});
await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
const server = { ...upstream, url: `http://127.0.0.1:${proxy.address().port}/` };
try {
  for (const entry of entries) {
    const folder = path.join(out, entry.id);
    fs.mkdirSync(folder, { recursive: true });
    const frozen = JSON.parse(
      zlib.gunzipSync(
        fs.readFileSync(path.join(root, "probes", `${entry.id}-phone-anchors.json.gz`)),
      ),
    );
    const observation = await measureNext(entry, "phone", {
      server,
      out: folder,
      poses: POSES,
      depth: 0.5,
      diagnostics: true,
      frozen,
      candidate: "fill",
    });
    fs.writeFileSync(
      path.join(folder, "observation.json"),
      JSON.stringify({ id: entry.id, sourceHash, observation }),
    );
    console.log(
      entry.id,
      JSON.stringify(observation.values),
      JSON.stringify(observation.overlayProof),
    );
  }
} finally {
  await new Promise((r) => proxy.close(r));
  await upstream.close();
}
