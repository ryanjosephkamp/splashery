// MIT. Measure the actual vendored WASM runtime, with pinned local ONNX bytes.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { localServer } from "./p3df/browser.mjs";
const args = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const root = process.cwd(),
  folder = path.resolve(args.out || ".cache/photo-3d-next/wasm");
fs.mkdirSync(folder, { recursive: true });
const specs = [
  { id: "da2", file: "vendor/depth-anything-v2-small/model_quantized.onnx", side: 518 },
  {
    id: "distill",
    file: ".cache/photo-3d-next/models/FuryTMP--Distill-Any-Depth-Small-onnx.onnx",
    side: 518,
    square: true,
  },
  { id: "da3-small", file: ".cache/photo-3d-next/models/josazar--da3-small-onnx.onnx", side: 518 },
  {
    id: "moge-small",
    file: ".cache/photo-3d-next/models/Ruicheng--moge-2-vits-normal-onnx.onnx",
    side: 518,
    points: true,
  },
].filter((x) => !args.models || args.models.split(",").includes(x.id));
if (args.file) {
  if (specs.length !== 1) throw new Error("--file needs exactly one --models value");
  specs[0].file = args.file;
}
for (const spec of specs) {
  spec.tokens = Number(args.tokens || 1200);
  spec.runs = Number(args.runs || 3);
  spec.saveOutputs = args["save-outputs"] === "true";
}
const photos = JSON.parse(
  fs.readFileSync(args.manifest || ".cache/photo-3d-next/depth-inputs.json"),
).filter((x) => x.category === "truth");
const entries = [
  ...photos,
  ...specs.map((x) => ({ ...x, id: "model-" + x.id, file: path.resolve(x.file) })),
];
const server = await localServer(entries),
  browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  });
const result = {
  runtime: "vendored ONNX Runtime Web, WASM, one thread",
  methodSha256: createHash("sha256")
    .update(fs.readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  browser: browser.version(),
  physicalPhone: false,
  complete: false,
  models: [],
};
try {
  for (const spec of specs) {
    const page = await browser.newPage();
    await page.route("**/next-harness", (r) =>
      r.fulfill({
        body: "<!doctype html><title>Local depth bake-off</title>",
        contentType: "text/html",
      }),
    );
    await page.goto(server.url + "next-harness");
    const modelBytes = fs.readFileSync(spec.file);
    const row = {
      id: spec.id,
      side: spec.side,
      tokens: spec.tokens,
      modelBytes: modelBytes.length,
      modelSha256: createHash("sha256").update(modelBytes).digest("hex"),
      rows: [],
      error: null,
    };
    result.models.push(row);
    try {
      await page.evaluate(
        async ({ url }) => {
          const ort = await import("/vendor/onnxruntime-web/ort.wasm.min.mjs");
          ort.env.wasm.wasmPaths = new URL("/vendor/onnxruntime-web/", location.href).href;
          ort.env.wasm.numThreads = 1;
          const began = performance.now();
          const s = await ort.InferenceSession.create(await (await fetch(url)).arrayBuffer(), {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });
          window.bench = { ort, s, loadMs: performance.now() - began };
        },
        { url: server.inputUrl({ id: "model-" + spec.id }) },
      );
      for (const photo of photos) {
        const timed = await page.evaluate(
          async ({ url, spec }) => {
            const { ort, s, loadMs } = window.bench;
            const { modelSize, resampleArea } = await import("/src/photo3d/pixels.js");
            const { decodePhoto } = await import("/src/packs/photo-3d.js");
            const photo = await decodePhoto(await (await fetch(url)).blob());
            const { dw, dh } = modelSize(photo.w, photo.h, spec.side),
              source = resampleArea(photo, dw, dh);
            const w = spec.square ? 518 : dw,
              h = spec.square ? 518 : dh,
              px = new Float32Array(3 * w * h),
              mean = [0.485, 0.456, 0.406],
              std = [0.229, 0.224, 0.225],
              ox = Math.floor((w - dw) / 2),
              oy = Math.floor((h - dh) / 2);
            for (let c = 0; c < 3; c++)
              for (let y = 0; y < dh; y++)
                for (let x = 0; x < dw; x++)
                  px[c * w * h + (y + oy) * w + x + ox] = spec.points
                    ? source[(y * dw + x) * 3 + c]
                    : (source[(y * dw + x) * 3 + c] - mean[c]) / std[c];
            const feeds = { [s.inputNames[0]]: new ort.Tensor("float32", px, [1, 3, h, w]) };
            if (spec.points)
              feeds.num_tokens = new ort.Tensor("int64", BigInt64Array.of(BigInt(spec.tokens)), []);
            const rgbHash = Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", source.buffer)),
              (v) => v.toString(16).padStart(2, "0"),
            ).join("");
            const times = [],
              saved = [];
            for (let k = 0; k < spec.runs; k++) {
              const began = performance.now(),
                output = await s.run(feeds);
              times.push(performance.now() - began);
              if (spec.saveOutputs && k === spec.runs - 1)
                for (const [name, t] of Object.entries(output)) {
                  if (!spec.points && name !== s.outputNames[0]) continue;
                  if (spec.points && !["points", "mask", "scale"].includes(name)) continue;
                  if (t.type !== "float32") throw new Error("Unexpected output type: " + t.type);
                  const bytes = new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength);
                  let encoded = "";
                  for (let i = 0; i < bytes.length; i += 32768)
                    encoded += String.fromCharCode(...bytes.subarray(i, i + 32768));
                  saved.push({ name, type: t.type, dims: t.dims, base64: btoa(encoded) });
                }
              for (const t of Object.values(output)) t.dispose();
            }
            for (const t of Object.values(feeds)) t.dispose();
            return {
              loadMs,
              rgbHash,
              dw,
              dh,
              ox,
              oy,
              saved,
              w,
              h,
              times,
              postprocess: spec.points
                ? "WASM forward only; focal recovery timed separately in native study"
                : "WASM forward only",
            };
          },
          { url: server.inputUrl(photo), spec },
        );
        if (timed.saved.length) {
          const expected = JSON.parse(
            fs.readFileSync(
              path.join(".cache/photo-3d-next/production-inputs", photo.id + ".json"),
            ),
          );
          if (timed.rgbHash !== expected.rgbSha256)
            throw new Error("Browser input differs from production RGB tensor");
          timed.outputs = timed.saved.map((v, i) => {
            const bytes = Buffer.from(v.base64, "base64"),
              file = `${spec.id}/${photo.id}-${i}.f32`;
            fs.mkdirSync(path.join(folder, spec.id), { recursive: true });
            fs.writeFileSync(path.join(folder, file), bytes);
            return {
              name: v.name,
              type: v.type,
              dims: v.dims,
              file,
              sha256: createHash("sha256").update(bytes).digest("hex"),
            };
          });
        }
        delete timed.saved;
        row.rows.push({ id: photo.id, ...timed });
        fs.writeFileSync(path.join(folder, "wasm.json"), JSON.stringify(result, null, 2));
        console.log(spec.id, photo.id, timed.times.map(Math.round).join(","));
      }
    } catch (e) {
      row.error = e.message;
      console.log(spec.id, "ERROR", e.message.slice(0, 240));
    } finally {
      await page.close();
    }
  }
  result.complete = true;
} finally {
  fs.writeFileSync(path.join(folder, "wasm.json"), JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
}
