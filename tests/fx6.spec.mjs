// Lane Fix6 (docs/handoff/Fix6.md), part 1: Photo to 3D opens your own photos.
//
// On the live site the depth model failed with "offset is out of bounds" whatever photo was
// opened: GitHub Pages sends the model gzipped, with content-length the compressed size, and
// the loader wrote the (bigger) decompressed stream into a buffer of that size. The local test
// server never compresses, so these tests serve the site the way GitHub Pages does.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const ROOT = path.resolve(".");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

// A static server for the repo that gzips every file and sends the compressed length, as
// GitHub Pages does. Extra routes serve test bytes.
const gzCache = new Map();
function gzipServer(extra = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let body = extra[url.pathname];
    let type = "application/octet-stream";
    if (!body) {
      let file = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT)) return res.writeHead(403).end();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html"); // prettier-ignore
      if (!fs.existsSync(file)) return res.writeHead(404).end();
      body = fs.readFileSync(file);
      type = TYPES[path.extname(file)] || type;
    }
    const key = `${url.pathname}:${body.length}`;
    if (!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(body, { level: 6 }));
    const gz = gzCache.get(key);
    res.writeHead(200, {
      "content-type": type,
      "content-encoding": "gzip",
      "content-length": String(gz.length),
      "access-control-allow-origin": "*",
    });
    res.end(gz);
  });
  return new Promise(
    (resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })), // prettier-ignore
  );
}

// A JPEG of w x h with smooth color and some detail (so it is not tiny).
function makeJpeg(w, h, quality = 80) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 255) / w;
      data[i + 1] = (y * 255) / h;
      data[i + 2] = ((x ^ y) & 63) * 3;
      data[i + 3] = 255;
    }
  return Buffer.from(jpeg.encode({ width: w, height: h, data }, quality).data);
}

// Adds an EXIF block with an orientation tag to a JPEG (6: the camera was turned a quarter).
function withOrientation(jpg, orientation) {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big endian, first IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]); // prettier-ignore
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 255]), payload]); // prettier-ignore
  return Buffer.concat([jpg.subarray(0, 2), app1, jpg.subarray(2)]);
}

test("the depth model's loader reads a gzipped download in full", async ({ page }) => {
  // Bytes that barely compress, like the model, so the stream is longer than content-length.
  const bytes = Buffer.alloc(3_000_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 2654435761) >>> 24;
  for (let i = 0; i < bytes.length; i += 3) bytes[i] = 7; // some repetition: gzip gains a little
  const { server, base } = await gzipServer({ "/model.bin": bytes });
  try {
    await page.goto("/?renderer=webgl2&profile=weak");
    const r = await page.evaluate(async (url) => {
      const { fetchBytes } = await import("/src/packs/photo-3d-depth.js");
      const seen = [];
      const out = await fetchBytes(url, (p) => seen.push(p));
      let sum = 0;
      for (let i = 0; i < out.length; i += 997) sum = (sum + out[i] * (i + 1)) % 1e9;
      return { n: out.length, sum, last: seen.at(-1), max: Math.max(...seen.slice(0, -1)) };
    }, `${base}/model.bin`);
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 997) sum = (sum + bytes[i] * (i + 1)) % 1e9;
    expect(r.n).toBe(bytes.length);
    expect(r.sum).toBe(sum);
    // Progress stays under 100% until the download is done, then reads 100%.
    expect(r.max).toBeLessThan(1);
    expect(r.last).toBe(1);
  } finally {
    server.close();
  }
});

test("big and odd photos decode: 12, 24 and 48 MP, a turned camera, a transparent PNG; HEIC says what to do", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const files = {
    "/12mp.jpg": makeJpeg(4000, 3000),
    "/24mp.jpg": makeJpeg(6000, 4000),
    "/48mp.jpg": makeJpeg(8000, 6000, 60),
    "/portrait.jpg": withOrientation(makeJpeg(1200, 800), 6),
  };
  const png = new PNG({ width: 600, height: 400 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 30;
    png.data[i + 1] = 90;
    png.data[i + 2] = 200;
    png.data[i + 3] = (i / 4) % 600 < 300 ? 0 : 255; // left half see-through
  }
  files["/alpha.png"] = PNG.sync.write(png);
  // The start of a HEIC file (an ISO box with an HEIC brand); Chromium can't decode it.
  files["/photo.heic"] = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic", "binary"), Buffer.alloc(64)]); // prettier-ignore
  const { server, base } = await gzipServer(files);
  try {
    await page.goto("/?renderer=webgl2&profile=weak");
    const r = await page.evaluate(async (base) => {
      const { decodePhoto } = await import("/src/packs/photo-3d.js");
      const out = {};
      for (const name of [
        "12mp.jpg",
        "24mp.jpg",
        "48mp.jpg",
        "portrait.jpg",
        "alpha.png",
        "photo.heic",
      ]) {
        const blob = await (await fetch(`${base}/${name}`)).blob();
        try {
          const p = await decodePhoto(blob);
          out[name] = { w: p.w, h: p.h, left: [...p.data.slice(0, 3)], right: [...p.data.slice((p.w - 1) * 4, (p.w - 1) * 4 + 3)] }; // prettier-ignore
        } catch (e) {
          out[name] = { error: e.message };
        }
      }
      return out;
    }, base);
    // Scaled to 2048 px on the long side, aspect kept.
    expect(r["12mp.jpg"]).toMatchObject({ w: 2048, h: 1536 });
    expect(r["24mp.jpg"]).toMatchObject({ w: 2048, h: 1365 });
    expect(r["48mp.jpg"]).toMatchObject({ w: 2048, h: 1536 });
    // Turned upright by its EXIF tag: a 1200 x 800 photo taken with the camera on its side.
    expect(r["portrait.jpg"]).toMatchObject({ w: 800, h: 1200 });
    // The see-through half shows on white, the other half keeps its color.
    expect(r["alpha.png"].left).toEqual([255, 255, 255]);
    expect(r["alpha.png"].right[2]).toBeGreaterThan(180);
    expect(r["photo.heic"].error).toMatch(/HEIC/);
    expect(r["photo.heic"].error).toMatch(/JPEG/);
  } finally {
    server.close();
  }
});

test("on a site that gzips the depth model, your own 24 MP photo opens and builds", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const { server, base } = await gzipServer();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${base}/?renderer=webgl2&adapt=off&profile=mid&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    // The model really came compressed, with the compressed length.
    const head = await page.evaluate(async () => {
      const r = await fetch("/vendor/depth-anything-v2-small/model_quantized.onnx", { method: "GET" }); // prettier-ignore
      const len = Number(r.headers.get("content-length"));
      r.body.cancel();
      return { enc: r.headers.get("content-encoding"), len };
    });
    expect(head.enc).toBe("gzip");
    const real = fs.statSync("vendor/depth-anything-v2-small/model_quantized.onnx").size;
    expect(head.len).toBeLessThan(real);
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
    const buffer = makeJpeg(6000, 4000);
    await page.locator("#toy-input-file").setInputFiles({ name: "my-photo.jpg", mimeType: "image/jpeg", buffer }); // prettier-ignore
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom === true, null, { timeout: 240_000 }); // prettier-ignore
    const info = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.photo);
    expect(info.name).toBe("my-photo");
    await expect(page.locator(".warning:visible")).toHaveCount(0);
    await expect(page.locator("#toy-input")).toContainText("2,048 pixels");
    expect(errors).toEqual([]);
  } finally {
    server.close();
  }
});

// The lane's screenshots: the toy with a photo of your own, on a phone and a desktop.
const SHOTS = path.resolve("tests/screenshots");
test("photo-3d screenshots at 390x844 and 1440x900", async ({ browser }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h, mobile] of [
    [390, 844, true],
    [1440, 900, false],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      ...(mobile ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?renderer=webgl2&adapt=off&profile=weak&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.splats > 5000, null, { timeout: 90_000 }); // prettier-ignore
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SHOTS, `fx6-photo-3d-${w}x${h}.png`) });
    expect(errors).toEqual([]);
    await ctx.close();
  }
});
