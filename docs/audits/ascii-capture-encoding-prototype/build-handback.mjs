import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const literal = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const noImports = (value) =>
  value.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\n/gm, "").replace(/^export /gm, "");
const gifenc = await fs.readFile(
  path.resolve(HERE, "../../../vendor/gifenc/gifenc.esm.js"),
  "utf8",
);
const exports = gifenc.match(/export\s*\{([\s\S]*?)\};?\s*$/);
if (!exports) throw new Error("gifenc export map was not found");
const aliases = Object.fromEntries(
  [...exports[1].matchAll(/(\w+)\s+as\s+(\w+)/g)].map((match) => [match[2], match[1]]),
);
const names = ["GIFEncoder", "quantize", "applyPalette"];
if (names.some((name) => !aliases[name])) throw new Error("gifenc API changed");
const gifScope = `const { ${names.join(", ")} } = (() => {\n${gifenc.slice(0, exports.index)}\nreturn { ${names.map((name) => name + ": " + aliases[name]).join(", ")} };\n})();`;
const licenses = {};
for (const file of ["splashery-MIT.txt", "gifenc-MIT.txt"])
  licenses[file] =
    "data:text/plain;base64," +
    (await fs.readFile(path.join(HERE, "licenses", file))).toString("base64");
const verified = {};
for (const toy of ["grapes", "orange", "strawberry"])
  for (const mode of ["mono", "color"]) {
    const key = `${toy}/96-${mode}/animation.mp4`;
    verified[key] =
      "data:video/mp4;base64," +
      (await fs.readFile(path.join(HERE, "exports", key))).toString("base64");
  }
const bootstrap = `window.__asciiSources = ${literal(JSON.parse(await fs.readFile(path.join(HERE, "sources.json"), "utf8")))};\nwindow.__asciiVerified = ${literal(verified)};\nwindow.__asciiLicenses = ${literal(licenses)};`;
const parts = [bootstrap, gifScope];
for (const file of ["ascii.js", "encoders.js", "demo.js"])
  parts.push(noImports(await fs.readFile(path.join(HERE, file), "utf8")));
const code = parts.join("\n").replace(/<\/script/gi, "<\\/script");
const template = await fs.readFile(path.join(HERE, "index.html"), "utf8");
const result = template.replace(
  '<script type="module" src="./demo.js"></script>',
  `<script type="module">\n${code}\n</script>`,
);
if (result === template) throw new Error("Template placeholder changed");
const output = process.argv[2];
if (!output)
  throw new Error("Choose a new output file: node build-handback.mjs /tmp/ascii-demo.html");
await fs.writeFile(path.resolve(output), result, { flag: "wx" });
console.log(
  JSON.stringify({
    bytes: Buffer.byteLength(result),
    embeddedSourceFrames: 120,
    verifiedVideos: Object.keys(verified).length,
  }),
);
