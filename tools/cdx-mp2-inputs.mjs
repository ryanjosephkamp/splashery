// Diagnose decoder variability with real retained pixels and model I/O.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { openRender, GRAPHICS_LAUNCH } from "./cdx-mp2-render.mjs";

export async function traceDepthInputs(page, { video = false } = {}) {
  await page.addInitScript(
    ({ video }) => {
      const NativeWorker = window.Worker;
      const rows = [],
        pending = [];
      const record = (kind, m, data) => {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        const row = {
          kind,
          id: m.id,
          w: m.w,
          h: m.h,
          worker: m.traceWorker,
          at: performance.now(),
          sequence: rows.length,
          ...(m.provider ? { provider: m.provider, threads: m.threads } : {}),
        };
        rows.push(row);
        pending.push(
          crypto.subtle.digest("SHA-256", bytes).then((hash) => {
            row.hash = Array.from(new Uint8Array(hash), (b) =>
              b.toString(16).padStart(2, "0"),
            ).join("");
          }),
        );
      };
      const media = [];
      window.__mp3InputTrace = { rows, pending, media };
      let workerId = 0;
      if (video) {
        let nextVideo = 0;
        const ids = new WeakMap();
        const identity = (v) => {
          if (!ids.has(v)) ids.set(v, ++nextVideo);
          return ids.get(v);
        };
        const note = (v, event, details = {}) =>
          media.push({
            video: identity(v),
            event,
            at: performance.now(),
            currentTime: v.currentTime,
            seeking: v.seeking,
            ...details,
          });
        const time = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
        Object.defineProperty(HTMLVideoElement.prototype, "currentTime", {
          configurable: true,
          get: time.get,
          set(target) {
            note(this, "seek", { target });
            this.addEventListener("seeked", () => note(this, "seeked", { target }), { once: true });
            this.requestVideoFrameCallback?.((_, m) =>
              note(this, "presented", {
                target,
                mediaTime: m.mediaTime,
                presentationTime: m.presentationTime,
                expectedDisplayTime: m.expectedDisplayTime,
                presentedFrames: m.presentedFrames,
              }),
            );
            return time.set.call(this, target);
          },
        });
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (...args) {
          const result = draw.apply(this, args);
          if (args[0] instanceof HTMLVideoElement)
            note(args[0], "draw", { width: this.canvas.width, height: this.canvas.height });
          return result;
        };
      }
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.traceWorker = ++workerId;
          this.addEventListener("message", ({ data: m }) => {
            if (m.type === "depth" && m.d?.buffer)
              record("output", { ...m, traceWorker: this.traceWorker }, m.d);
          });
        }
        postMessage(m, ...args) {
          if (m?.type === "frame" && m.data?.buffer)
            record("input", { ...m, traceWorker: this.traceWorker }, m.data);
          return super.postMessage(m, ...args);
        }
      };
    },
    { video },
  );
}

export async function clipInputHashes(page) {
  return page.evaluate(async () => {
    const c = window.__mp3.MOVING.clip;
    const hash = async (data) =>
      Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    const colors = c.colors ? await Promise.all(c.colors.map((v) => hash(v))) : [];
    const depth = c.near ? await Promise.all(c.near.map((v) => hash(v))) : [];
    await Promise.all(window.__mp3InputTrace.pending);
    return {
      w: c.w,
      h: c.h,
      n: c.n,
      duration: c.duration,
      colors,
      depth,
      model: window.__mp3InputTrace.rows,
      video: window.__mp3InputTrace.media,
      retainedJitter: (() => {
        let jitter = 0,
          flips = 0,
          still = 0;
        for (let f = 1; f < c.n && c.colors && c.near; f++)
          for (let i = 0; i < c.near[f].length; i++) {
            let cd = 0;
            for (let k = 0; k < 3; k++)
              cd += (c.colors[f][i * 4 + k] - c.colors[f - 1][i * 4 + k]) ** 2;
            if (cd <= 3 * 8 ** 2) {
              const d = Math.abs(c.near[f][i] - c.near[f - 1][i]) / 255;
              jitter += d;
              flips += d > 0.15;
              still++;
            }
          }
        return {
          heightJitter: jitter / Math.max(1, still),
          edgeFlipsPer1000: (1000 * flips) / Math.max(1, still),
        };
      })(),
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = (key, fallback) =>
    process.argv.find((v) => v.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
  const sources = JSON.parse(
    await fs.readFile(option("sources", ".cache/cdx-mp3/originals/sources.json"), "utf8"),
  );
  const id = option("id", "sample"),
    count = Number(option("count", 2));
  const before = option("before", "93077cf6");
  const out = option("out", ".cache/cdx-mp3/input-hashes.json");
  const files = [
    "src/packs/moving-photo.js",
    "src/packs/photo-sharp.js",
    "src/packs/song-stream.js",
    "src/live/clip-stabilize.js",
  ];
  const results = [];
  const browser = await chromium.launch(GRAPHICS_LAUNCH);
  try {
    const versions = option("versions", "before,after").split(",");
    for (const baseline of [true, false].filter((value) =>
      versions.includes(value ? "before" : "after"),
    ))
      for (let run = 0; run < count; run++) {
        const code = await Promise.all(
          files.map((file) =>
            baseline
              ? execFileSync("git", ["show", `${before}:${file}`], { encoding: "utf8" })
              : fs.readFile(
                  file === "src/packs/moving-photo.js" && option("moving", "")
                    ? option("moving")
                    : file,
                  "utf8",
                ),
          ),
        );
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 3,
        });
        await traceDepthInputs(page, { video: option("video", "false") === "true" });
        for (let i = 0; i < files.length; i++)
          await page.route(`**/${files[i]}`, (route) =>
            route.fulfill({ contentType: "text/javascript", body: code[i] }),
          );
        try {
          await openRender(page, { id, source: sources[id], upload: true, stepped: true });
        } catch (error) {
          const trace = await page.evaluate(async () => {
            const trace = window.__mp3InputTrace;
            await Promise.all(trace.pending);
            return { model: trace.rows, video: trace.media };
          });
          results.push({ baseline, run, id, error: error.message, ...trace });
          await fs.writeFile(out, JSON.stringify({ before, results }, null, 2) + "\n");
          throw error;
        }
        const hashes = await clipInputHashes(page);
        results.push({
          baseline,
          run,
          id,
          sourceHash: createHash("sha256")
            .update(await fs.readFile(sources[id]))
            .digest("hex"),
          codeHash: createHash("sha256").update(code.join("\n")).digest("hex"),
          ...hashes,
        });
        console.log(
          JSON.stringify({
            baseline,
            run,
            id,
            ...hashes.retainedJitter,
            modelInputs: hashes.model.filter((m) => m.kind === "input").length,
          }),
        );
        await fs.writeFile(out, JSON.stringify({ before, results }, null, 2) + "\n");
        await page.close();
      }
  } finally {
    await browser.close();
  }
}
