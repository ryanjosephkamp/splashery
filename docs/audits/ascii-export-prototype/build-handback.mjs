// Make a single offline HTML handback from the exact reviewed core and demo.
// No dependencies, model calls, source downloads, or media encoding.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function buildHandback(output) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const samples = JSON.parse(await fs.readFile(path.join(here, "samples.json"), "utf8"));
  const embedded = {};
  for (const sample of samples) {
    const files = [
      "animation.gif",
      "animation.mp4",
      ...Array.from(
        { length: sample.frameCount },
        (_, i) => `frame-${String(i).padStart(3, "0")}.jpg`,
      ),
    ];
    for (const file of files) {
      const mime = file.endsWith(".jpg")
        ? "image/jpeg"
        : file.endsWith(".gif")
          ? "image/gif"
          : "video/mp4";
      embedded[`${sample.toy}/${file}`] =
        `data:${mime};base64,${(await fs.readFile(path.join(here, "samples", sample.toy, file))).toString("base64")}`;
    }
  }
  const literal = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const core = (await fs.readFile(path.join(here, "../../../src/export/ascii.js"), "utf8")).replace(
    /^export /gm,
    "",
  );
  const demo = (await fs.readFile(path.join(here, "demo.js"), "utf8")).replace(/^import .*\n/, "");
  const script =
    `window.__asciiSamples = ${literal(samples)};\nwindow.__asciiEmbedded = ${literal(embedded)};\n${core}\n${demo}`.replace(
      /<\/script/gi,
      "<\\/script",
    );
  const template = await fs.readFile(path.join(here, "index.html"), "utf8");
  const html = template.replace(
    '<script type="module" src="./demo.js"></script>',
    `<script type="module">\n${script}\n</script>`,
  );
  if (html === template) throw new Error("Demo script placeholder was not found");
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, html, { flag: "wx" });
  return { bytes: Buffer.byteLength(html), toys: samples.map((sample) => sample.toy) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error("Usage: node build-handback.mjs <new-output.html>");
  console.log(JSON.stringify(await buildHandback(process.argv[2])));
}
