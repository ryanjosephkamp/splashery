// Preload the existing static ES-module graph without resolving or evaluating it.
// Generated data is a list of URLs; original modules remain separate and unchanged.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
function graph(entry) {
  const seen = new Set();
  function visit(file) {
    if (file === "vendor/playcanvas/playcanvas.min.mjs" || seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const imports = [
      ...source.matchAll(/^\s*import\s+(?:(?:[^"'();]*?)\s+from\s+)?["']([^"']+)["']/gm),
      ...source.matchAll(/^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/gm),
    ];
    for (const [, specifier] of imports) {
      if (!specifier.startsWith("."))
        throw new Error(`Unexpected static import: ${file}: ${specifier}`);
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
    }
  }
  visit(entry);
  return [...seen].sort();
}
const graphs = { app: graph("src/app.js"), embed: graph("src/embed.js") };
const file = "src/boot.js";
let source = fs.readFileSync(file, "utf8");
const block = `// BEGIN GENERATED OPENING GRAPHS (tools/load-time-opening-graph.mjs)\nconst OPENING_GRAPHS = ${JSON.stringify(graphs, null, 2)};\n// END GENERATED OPENING GRAPHS`;
const marker = /\/\/ BEGIN GENERATED OPENING GRAPHS[^]*?\/\/ END GENERATED OPENING GRAPHS/;
source = marker.test(source) ? source.replace(marker, block) : block + "\n" + source;
fs.writeFileSync(file, source);
console.log({
  app: graphs.app.length,
  embed: graphs.embed.length,
  deferredScanHelpers: !graphs.app.includes("src/packs/real-objects.js"),
});
