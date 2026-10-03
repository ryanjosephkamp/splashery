// The real QR toy as a lab source: drives window.__splashery.qr (lane QR's test hook, documented
// in its docs/handoff/QR.md) in Chromium. Serve the toy's tree first:
//   python3 -m http.server 4173 --bind 127.0.0.1   (from a checkout of origin/claude/lane-qr)
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { resize } from "./sim.mjs";
import { contrastRatio } from "./reference.mjs";

export const TOY_STYLES = ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon"];

// Color schemes beyond each style's own preset (a style alone brings its preset colors).
export const TOY_SCHEMES = {
  preset: {},
  pastel: { fg: "#8aa4d0", bg: "#ffffff" },
  gray: { fg: "#808080", bg: "#ffffff" },
  gradient: { gradient: "linear", fg: "#8f2d1f", fg2: "#1d3f73" },
  eyes: { eyes: "own", eye: "#c2372b" },
  inverted: { fg: "#ffffff", bg: "#101010" },
};

const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toImage = (b64) => {
  const png = PNG.sync.read(Buffer.from(b64, "base64"));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
};

export async function toySource({ opt }) {
  const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: Number(opt("viewport", 600)), height: Number(opt("viewport", 600)) },
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=mid&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
  await page.waitForFunction(() => window.__splashery.qr && window.__splashery.qr.info().size, null, { timeout: 60_000 }); // prettier-ignore
  const size = Number(opt("px", 1024));
  const poses = opt("poses", "yaw10,yaw20,yaw35,pitch10,pitch20,pitch35")
    .split(",")
    .filter(Boolean);
  const camStyles = opt("cam-styles", "classic,bricks,gems,bubbles,neon").split(",");
  const camSchemes = opt("cam-schemes", "preset").split(",");

  const set = async (job, text) => {
    const o = { ...TOY_SCHEMES[job.scheme], style: job.style, ecc: job.ec, text };
    // A style alone brings its preset; the scheme's colors win over it.
    await page.evaluate((o) => window.__splashery.qr.set(o), o);
    return page.evaluate(() => {
      const i = window.__splashery.qr.info();
      return {
        version: i.version,
        size: i.size,
        error: i.error,
        warnings: i.warnings,
        options: i.options,
      };
    });
  };
  const flat = async () =>
    toImage(
      await page.evaluate(async (px) => {
        const blob = await window.__splashery.qr.png(px);
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < buf.length; i += 0x8000)
          s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(s);
      }, size),
    );
  // The toy's own camera, turned by `deg` degrees of yaw or pitch (a real 3D view).
  const turned = async (axis, deg) =>
    toImage(
      await page.evaluate(
        async ({ axis, deg, px }) => {
          const { app, qr } = window.__splashery;
          return app.withCapture([px, px], async () => {
            const pose = { ...qr.scanPose(2), [axis]: (deg * Math.PI) / 180 };
            const shot = await app.player.renderAt(app.player.time, pose);
            return shot.toDataURL("image/png").split(",")[1];
          });
        },
        { axis, deg, px: size },
      ),
    );

  return {
    styles: opt("styles", TOY_STYLES.join(",")).split(","),
    async render(job, text) {
      const info = await set(job, text);
      if (info.error) throw new Error(info.error);
      const img = await flat();
      const o = info.options || {};
      const fg = hexRGB(o.fg || "#000000");
      const bg = hexRGB(o.bg || "#ffffff");
      const cams = [];
      if (camStyles.includes(job.style) && camSchemes.includes(job.scheme)) {
        for (const p of poses) {
          const [, axis, deg] = /^(yaw|pitch)(\d+)$/.exec(p);
          cams.push({ id: p, img: await turned(axis, Number(deg)) });
        }
      }
      // Margin of 1 module on each side of the 4-module quiet zone in the flat picture; 2 in turned ones.
      return {
        img,
        modules: info.size + 10,
        camModules: info.size + 12,
        cams,
        version: info.version,
        contrast: contrastRatio(fg, bg),
        warnings: info.warnings,
      };
    },
    close: () => browser.close(),
  };
}
