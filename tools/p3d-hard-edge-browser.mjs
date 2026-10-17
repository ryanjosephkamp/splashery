// MIT. Explicit H-only loader/binding overlays. Classic files and shader text stay unchanged.
import fs from "node:fs";
import http from "node:http";
import { measureNext } from "./p3d-next-browser.mjs";

export async function measureHardEdge(entry, profile, options) {
  if (options.candidate === "classic") return measureNext(entry, profile, options);
  if (options.candidate !== "fill") throw new Error("Use classic or fill for Layered H");
  let sharp = fs.readFileSync(new URL("../src/packs/photo-sharp.js", import.meta.url), "utf8");
  const replace = (before, after, count = 1) => {
    if (sharp.split(before).length !== count + 1)
      throw new Error("Classic binding adapter changed");
    sharp = sharp.replaceAll(before, after);
  };
  replace('import("../live/relief-mesh.js")', 'import("../photo3d/next/relief.js")', 2);
  replace(
    "  m.setBackground(src.background);",
    `  m.setBackground(src.background);
  if (src.background?.classicRgba && globalThis.__nextFillStats) {
    const b = src.background, foreground = m.matS.getParameter("uBackground").data,
      backing = m.matB.getParameter("uColor").data;
    globalThis.__nextFillStats.colorBinding = {
      foregroundSeparate: foreground !== backing,
      foregroundMatchesClassic: foreground._levels[0].length === b.classicRgba.length && foreground._levels[0].every((v,i)=>v===b.classicRgba[i]),
      backingMatchesFilled: backing._levels[0].length === b.rgba.length && backing._levels[0].every((v,i)=>v===b.rgba[i]),
    };
  }`,
  );
  const hits = [],
    upstream = options.server;
  const proxy = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    let body;
    if (pathname === "/src/photo3d/next/fill.js") {
      hits.push("builder-alias");
      body = 'export { fillSurface } from "./hard-edge.js";';
    } else if (pathname === "/src/packs/photo-sharp.js") {
      hits.push("renderer-loader");
      body = sharp;
    } else if (pathname === "/src/photo3d/next/relief.js") hits.push("foreground-renderer");
    else if (pathname === "/src/photo3d/next/hard-edge.js") hits.push("background-builder");
    if (body !== undefined) {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      return res.end(body);
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
  await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  try {
    const result = await measureNext(entry, profile, {
      ...options,
      server: { ...upstream, url: `http://127.0.0.1:${proxy.address().port}/` },
    });
    const binding = result.overlayProof.fillStats?.colorBinding;
    if (
      !["builder-alias", "renderer-loader", "foreground-renderer", "background-builder"].every(
        (h) => hits.includes(h),
      ) ||
      !binding?.foregroundSeparate ||
      !binding.foregroundMatchesClassic ||
      !binding.backingMatchesFilled
    )
      throw new Error("Layered H did not preserve Classic foreground color bindings");
    result.overlayProof.colorBinding = binding;
    result.overlayProof.bindingHits = hits;
    return result;
  } finally {
    await new Promise((resolve) => proxy.close(resolve));
  }
}
