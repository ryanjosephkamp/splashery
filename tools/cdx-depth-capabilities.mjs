// Reproduce provider/isolation experiments without shipping service-worker or runtime changes.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const dir = ".cache/cdx-depth/isolation";
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(
  `${dir}/index.html`,
  "<!doctype html><title>Depth isolation probe</title><p>Local depth benchmark</p>",
);
await fs.writeFile(
  `${dir}/sw.js`,
  `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).then(r=>{const h=new Headers(r.headers);h.set('Cross-Origin-Opener-Policy','same-origin');h.set('Cross-Origin-Embedder-Policy','require-corp');return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});})));`,
);
await fs.mkdir(`${dir}/runtime`, { recursive: true });
for (const file of [
  "ort.wasm.min.mjs",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort.webgpu.min.mjs",
  "ort.all.min.mjs",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.jspi.mjs",
  "ort-wasm-simd-threaded.jspi.wasm",
])
  await fs.copyFile(`.cache/cdx-depth/ort/package/dist/${file}`, `${dir}/runtime/${file}`);
await fs.writeFile(`${dir}/worker.js`, 'import "/src/live/depth-worker.js";');
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4173/.cache/cdx-depth/isolation/index.html");
const before = await page.evaluate(async () => ({
  isolated: crossOriginIsolated,
  sharedMemory: typeof SharedArrayBuffer !== "undefined",
  webgpu: !!(await navigator.gpu?.requestAdapter()),
  webnn: !!navigator.ml,
}));
await page.evaluate(async () => {
  await navigator.serviceWorker.register("./sw.js");
  await navigator.serviceWorker.ready;
});
await page.waitForFunction(() => !!navigator.serviceWorker.controller);
await page.reload();
const after = await page.evaluate(() => ({
  isolated: crossOriginIsolated,
  sharedMemory: typeof SharedArrayBuffer !== "undefined",
}));
console.log({ before, after });
const rows = [];
for (const options of [
  { threads: 1 },
  { threads: 2 },
  { threads: 4 },
  { provider: "webgpu", runtimeUrl: "/.cache/cdx-depth/isolation/runtime/" },
  { provider: "webnn" },
]) {
  const row = await page.evaluate(async (options) => {
    const { createDepthClient } = await import("/src/depth/client.js");
    const { decodePhoto } = await import("/src/packs/photo-3d.js");
    const c = createDepthClient({ workerUrl: "/.cache/cdx-depth/isolation/worker.js" });
    try {
      const t = performance.now();
      const meta = await Promise.race([
        c.request("init", {
          options: { runtimeUrl: "/.cache/cdx-depth/isolation/runtime/", ...options },
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Provider initialization exceeded 60 seconds.")),
            60000,
          ),
        ),
      ]);
      const loadMs = performance.now() - t;
      const photo = await decodePhoto(
        await (await fetch("/assets/toys/photo-3d/forest.jpg")).blob(),
      );
      const times = [];
      let final = meta;
      for (let i = 0; i < 3; i++) {
        const d = await Promise.race([
          c.request("photo", photo),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Provider run exceeded 60 seconds.")), 60000),
          ),
        ]);
        times.push(d.ms);
        final = d;
      }
      return {
        options,
        loadMs,
        provider: final.provider,
        initProvider: meta.provider,
        fallback: final.fallback,
        threads: meta.threads,
        times,
      };
    } catch (err) {
      return { options, error: String(err) };
    } finally {
      c.dispose();
    }
  }, options);
  rows.push(row);
  console.log(row);
}
await fs.writeFile(
  ".cache/cdx-depth/capabilities.json",
  JSON.stringify({ before, after, rows }, null, 2) + "\n",
);
await page.evaluate(async () => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
});
await browser.close();
