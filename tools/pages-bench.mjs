#!/usr/bin/env node
// Task 95: real, rendered frames and source-aligned page crops. Start the static server first.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/pages-bench.mjs --out=work/pages-r2/main
// --url=http://127.0.0.1:4173/ --toys=picture-lab,your-book,photo-album --cases=sample,text,photo,chart
// --profiles=phone,desktop --repeats=3 --seconds=5. Never runs a stepped clock for timing.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";

const arg = (key, fallback) =>
  process.argv
    .find((a) => a.startsWith(`--${key}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const base = arg("url", "http://127.0.0.1:4173/");
const out = arg("out", "work/pages-r2/bench");
const fixtures = "work/pages-r2/fixtures";
const fixtureFiles = ["text.pdf", "text.png", "photo.pdf", "photo.png", "chart.pdf", "chart.png"];
const digest = (data) => crypto.createHash("sha256").update(data).digest("hex");
const toolSha256 = digest(fs.readFileSync(new URL(import.meta.url)));
const profiles = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2, tier: "low" },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, tier: "mid" },
};
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(fixtures, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await browser.close();
    process.exit(130);
  });

// Original text and chart: CC0, made by Ryan with Codex (GPT-6).
// The independent photo input reuses the credited Picture frame sample in CREDITS.md.
async function makeFixtures() {
  if (
    arg("fresh-fixtures", "0") !== "1" &&
    fixtureFiles.every((name) => fs.existsSync(`${fixtures}/${name}`))
  )
    return;
  const p = await browser.newPage({ viewport: { width: 612, height: 792 } });
  const body =
    "A page should remain clear while it moves. Small letters need dark edges, open spaces, and steady paper beneath them. Turn the leaf, follow its edge, and read the next line. Pictures, diagrams, and words belong to the same solid sheet.";
  const html = (inside) =>
    `<!doctype html><style>@page{size:612px 792px;margin:0}*{box-sizing:border-box}body{margin:0;background:white;color:#17202a}section{width:612px;height:792px;padding:48px;break-after:page}h1{font:32px Georgia;margin:0 0 24px}p{font:22px/1.5 Georgia;margin:0 0 18px}img{width:100%;height:600px;object-fit:contain}</style>${inside}`;
  await p.setContent(
    html(
      `<section><h1>Clear pages, steady turns</h1>${Array.from({ length: 3 }, () => `<p>${body}</p>`).join("")}</section><section><h1>The next page</h1><p>${body}</p></section>`,
    ),
  );
  await p.pdf({ path: `${fixtures}/text.pdf`, preferCSSPageSize: true, printBackground: true });
  await p
    .locator("section")
    .first()
    .screenshot({ path: `${fixtures}/text.png` });
  const photo = fs.readFileSync("assets/toys/picture-frame/islands.jpg").toString("base64");
  for (const kind of ["photo", "chart"]) {
    await p.setContent('<canvas width="612" height="792"></canvas>');
    await p.evaluate(
      async ({ kind, photo }) => {
        const c = document.querySelector("canvas"),
          g = c.getContext("2d");
        g.fillStyle = "#f6f3e9";
        g.fillRect(0, 0, 612, 792);
        if (kind === "photo") {
          const image = new Image();
          image.src = `data:image/jpeg;base64,${photo}`;
          await image.decode();
          c.height = Math.round((c.width * image.height) / image.width);
          g.drawImage(image, 0, 0, c.width, c.height);
        } else {
          g.fillStyle = "#17202a";
          g.font = "bold 30px sans-serif";
          g.fillText("A chart with clear edges", 48, 80);
          g.font = "20px sans-serif";
          g.fillText("Values by season", 48, 124);
          const colors = ["#2563a8", "#c45225", "#278257", "#7655a5"];
          for (let i = 0; i < 4; i++) {
            g.fillStyle = colors[i];
            g.fillRect(70 + i * 125, 600 - [230, 360, 290, 410][i], 80, [230, 360, 290, 410][i]);
            g.fillStyle = "#17202a";
            g.fillText(["Spring", "Summer", "Fall", "Winter"][i], 65 + i * 125, 640);
          }
          g.font = "22px Georgia";
          g.fillText("Fine labels and colored bars stay separate.", 48, 710);
        }
      },
      { kind, photo },
    );
    const png = await p.locator("canvas").screenshot();
    fs.writeFileSync(`${fixtures}/${kind}.png`, png);
    await p.setContent(
      html(
        `<section><img src="data:image/png;base64,${png.toString("base64")}"></section><section><h1>Next picture</h1></section>`,
      ),
    );
    await p.pdf({
      path: `${fixtures}/${kind}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
  }
  await p.close();
}

// Local 8x8-window luminance SSIM (K1=.01, K2=.03), and variance of the
// four-neighbor Laplacian. Both receive the same registered pixels; no best-shift search.
export function clarity(a, b, w, h) {
  const gray = (d) =>
    Float64Array.from(
      { length: w * h },
      (_, i) => (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255,
    );
  const x = gray(a),
    y = gray(b);
  let ss = 0,
    windows = 0;
  for (let by = 0; by + 8 <= h; by += 8)
    for (let bx = 0; bx + 8 <= w; bx += 8) {
      let sx = 0,
        sy = 0,
        xx = 0,
        yy = 0,
        xy = 0;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          const n = (by + j) * w + bx + i,
            A = x[n],
            B = y[n];
          sx += A;
          sy += B;
          xx += A * A;
          yy += B * B;
          xy += A * B;
        }
      const mx = sx / 64,
        my = sy / 64,
        vx = xx / 64 - mx * mx,
        vy = yy / 64 - my * my,
        c = xy / 64 - mx * my;
      ss +=
        ((2 * mx * my + 0.0001) * (2 * c + 0.0009)) /
        ((mx * mx + my * my + 0.0001) * (vx + vy + 0.0009));
      windows++;
    }
  const lap = (d) => {
    let s = 0,
      q = 0,
      n = 0;
    for (let j = 1; j < h - 1; j++)
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i,
          v = d[k - 1] + d[k + 1] + d[k - w] + d[k + w] - 4 * d[k];
        s += v;
        q += v * v;
        n++;
      }
    return q / n - (s / n) ** 2;
  };
  return { ssim: ss / windows, sharpness: lap(y), sourceSharpness: lap(x), width: w, height: h };
}

async function run(toy, input, profile, repeat) {
  const { width, height, deviceScaleFactor, tier } = profiles[profile];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /shader|compil|validation|syntax/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto(`${base}?renderer=webgl2&adapt=off&profile=${tier}&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const loaded = await page.evaluate(
    async ({ toy, input, base, fixtures }) => {
      const { app, player } = window.__splashery;
      const toyStart = performance.now();
      await app.chooseToy(toy);
      const start = input === "sample" ? toyStart : performance.now();
      if (input !== "sample") {
        const ext =
          toy === "your-book" || (toy === "picture-lab" && input === "text") ? "pdf" : "png";
        const url = new URL(`${fixtures}/${input}.${ext}`, base).href;
        if (toy === "photo-album") {
          const blob = await (await fetch(url)).blob();
          await app.openMedia([
            new File([blob], `${input}.png`, { type: "image/png" }),
            new File([blob], `${input}-2.png`, { type: "image/png" }),
          ]);
        } else await app.openMedia(url);
      }
      if (toy === "photo-album") player.act();
      player.stage.requestRender(2000);
      window.__benchStart = start;
      return { name: player.pictures.media?.name };
    },
    { toy, input, base, fixtures },
  );
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      window.__splashery.player.stage.requestRender();
      return (
        p?.media &&
        p.splats() > 0 &&
        p.sheets.filter((s) => !s.hidden).every((s) => !s.want || s.shown?.key === s.want.key)
      );
    },
    null,
    { timeout: 180000 },
  );
  const installedPageMs = await page.evaluate(() => performance.now() - window.__benchStart);
  // New Gaussian sheets need their first sort; count completed page draws,
  // rather than ending the clock as soon as CPU data has been installed.
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) await window.__splashery.player.stage.captureFrame();
  });
  const firstPageMs = await page.evaluate(() => performance.now() - window.__benchStart);
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      window.__splashery.player.stage.requestRender();
      return p.sheets.every((s) => !s.want || s.shown?.key === s.want.key);
    },
    null,
    { timeout: 180000 },
  );
  await page.evaluate(() => {
    const pl = window.__splashery.player;
    pl.stage.requestRender(2000);
  });
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player,
        c = p.camera;
      p.stage.requestRender();
      const calm =
        !p.motion.recipe?.alive?.() &&
        !p.glide &&
        ["yaw", "pitch", "roll", "distance"].every((k) => Math.abs(c.tgt[k] - c.cur[k]) < 1e-4) &&
        p.pictures.sheets.every((s) => !s.want || s.shown?.key === s.want.key);
      // The camera can stop before the album's opening turn lands. Require
      // the recipe to finish and the requested page keys to remain stable,
      // including the detail rebuild that follows a reading-view glide.
      const key = JSON.stringify(p.pictures.sheets.map((s) => s.want?.key || ""));
      if (!calm || key !== window.__benchStableKey) {
        window.__benchStableKey = key;
        window.__benchStableSince = performance.now();
        return false;
      }
      return performance.now() - window.__benchStableSince >= 600;
    },
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => {
    const p = window.__splashery.player;
    p.frozen = true;
    for (const k of ["yaw", "pitch", "roll"]) p.camera.cur[k] = p.camera.tgt[k] = 0;
    p.stage.requestRender(2000);
  });
  await page.waitForTimeout(2000);
  // Pose-aware source registration, followed by sampling at the displayed pixel grid.
  const crop = await page.evaluate(
    async ({ input }) => {
      const pl = window.__splashery.player,
        p = pl.pictures;
      // Flush the front-facing camera into the actual stage before projecting
      // the source. On a slow software GPU, a timed wait can expire before
      // even one draw updates its camera matrix.
      await pl.stage.captureFrame();
      const sh = p.sheets.find((s) => s.slot?.entity.enabled && s.shown && s.n[2] > 0.5);
      if (!sh) return null;
      const source = await p.media.draw(
        sh.shown.page,
        2048,
        Math.round(2048 / p.media.aspect(sh.shown.page)),
      );
      p.decorateCanvas(source, sh, sh.shown.page, p.media, sh.shown.variant);
      const geom = p.geometry(sh, p.media.aspect(sh.shown.page), source.width, source.height);
      // Register the colored face: main's ink/pixels sit six raster pixels
      // ahead of the backing, while a continuous face records its own lift.
      const face = sh.shown.data.surface;
      const pitch = Math.hypot(
        ...p.geometry(sh, p.media.aspect(sh.shown.page), sh.shown.w, sh.shown.h).right,
      );
      const lift = face ? (face.geom.lift ?? Math.hypot(...face.geom.right) * 0.3) : pitch * 6;
      for (let k = 0; k < 3; k++) geom.origin[k] += geom.normal[k] * lift;
      const pos = new Float32Array(12),
        anim = new Float32Array(16);
      for (const [i, [u, v]] of [
        [0, [0, 0]],
        [1, [1, 0]],
        [2, [0, 1]],
        [3, [1, 1]],
      ]) {
        for (let k = 0; k < 3; k++)
          pos[i * 3 + k] =
            geom.origin[k] + geom.right[k] * u * source.width + geom.down[k] * v * source.height;
        anim[i * 4] = (geom.part || 0) + 16;
        anim[i * 4 + 1] = geom.leaf ? 21 : 0;
        anim[i * 4 + 2] = geom.leaf
          ? pos
              .slice(i * 3, i * 3 + 3)
              .reduce((s, x, k) => s + (x - geom.leaf.spine[k]) * geom.leaf.dir[k], 0)
          : 0;
        anim[i * 4 + 3] = geom.leaf?.slot || 0;
      }
      const posed = pos.slice();
      (await import("/src/pose.js")).posePass(
        pos,
        anim,
        4,
        posed,
        pl.leafUniform(),
        pl.motion.partsData,
      );
      const parameter = (key, fallback) => {
        const x = pl.stage.toy.entity.gsplat.getParameter(key);
        return x?.data ?? x ?? fallback;
      };
      const body = parameter("uSpBodyT", [0, 0, 0]);
      const q = parameter("uSpBodyQ", [0, 0, 0, 1]);
      const center = parameter("uSpToy", [0, 0, 0, 1]);
      const pts = Array.from({ length: 4 }, (_, i) => {
        const v = Array.from(posed.slice(i * 3, i * 3 + 3), (x, k) => x - center[k]);
        const c = [
          q[1] * v[2] - q[2] * v[1] + q[3] * v[0],
          q[2] * v[0] - q[0] * v[2] + q[3] * v[1],
          q[0] * v[1] - q[1] * v[0] + q[3] * v[2],
        ];
        const p = [
          v[0] + 2 * (q[1] * c[2] - q[2] * c[1]),
          v[1] + 2 * (q[2] * c[0] - q[0] * c[2]),
          v[2] + 2 * (q[0] * c[1] - q[1] * c[0]),
        ];
        return pl.stage.toScreen(pl.stage.modelToWorld(p.map((x, k) => x + center[k] + body[k])));
      });
      pl.stage.requestRender();
      await new Promise((r) => pl.stage.app.once("postrender", r));
      const frame = await pl.stage.captureFrame();
      const ratio = frame.width / pl.canvas.clientWidth;
      const W = Math.max(
          8,
          Math.round(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * ratio),
        ),
        H = Math.max(
          8,
          Math.round(Math.hypot(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1]) * ratio),
        );
      // Work in actual displayed device pixels; crop excludes headings and borders.
      const box = input === "text" ? [0.08, 0.2, 0.92, 0.6] : [0.12, 0.25, 0.88, 0.6];
      const x0 = Math.round(W * box[0]),
        y0 = Math.round(H * box[1]),
        w = Math.round(W * (box[2] - box[0])),
        h = Math.round(H * (box[3] - box[1]));
      const ref = document.createElement("canvas"),
        got = document.createElement("canvas");
      // Front-facing pages can be compared on the actual framebuffer grid.
      // Keeping the captured pixels intact avoids a half-pixel resampling
      // error that otherwise penalizes sharper letter edges.
      const left = pts[0][0] * ratio,
        top = pts[0][1] * ratio,
        pw = (pts[1][0] - pts[0][0]) * ratio,
        ph = (pts[2][1] - pts[0][1]) * ratio;
      if (
        pw > 0 &&
        ph > 0 &&
        Math.abs(pts[1][1] - pts[0][1]) < 0.01 &&
        Math.abs(pts[2][0] - pts[0][0]) < 0.01
      ) {
        const x = Math.ceil(left + pw * box[0]),
          y = Math.ceil(top + ph * box[1]);
        const cw = Math.floor(left + pw * box[2]) - x,
          ch = Math.floor(top + ph * box[3]) - y;
        ref.width = got.width = cw;
        ref.height = got.height = ch;
        ref.getContext("2d").drawImage(source, left - x, top - y, pw, ph);
        got.getContext("2d").drawImage(frame, x, y, cw, ch, 0, 0, cw, ch);
        return {
          reference: ref.toDataURL(),
          render: got.toDataURL(),
          pts,
          W,
          H,
          box,
          registration: "framebuffer",
          body: Array.from(body),
          bodyQ: Array.from(q),
        };
      }
      ref.width = got.width = w;
      ref.height = got.height = h;
      ref
        .getContext("2d")
        .drawImage(
          source,
          (x0 / W) * source.width,
          (y0 / H) * source.height,
          (w / W) * source.width,
          (h / H) * source.height,
          0,
          0,
          w,
          h,
        );
      const f = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height),
        d = got.getContext("2d").createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const u = (x + x0 + 0.5) / W,
            v = (y + y0 + 0.5) / H;
          const X = (pts[0][0] + (pts[1][0] - pts[0][0]) * u + (pts[2][0] - pts[0][0]) * v) * ratio,
            Y = (pts[0][1] + (pts[1][1] - pts[0][1]) * u + (pts[2][1] - pts[0][1]) * v) * ratio;
          const sx = Math.max(0, Math.min(frame.width - 1, Math.floor(X))),
            sy = Math.max(0, Math.min(frame.height - 1, Math.floor(Y)));
          d.data.set(
            f.data.subarray((sy * frame.width + sx) * 4, (sy * frame.width + sx) * 4 + 4),
            (y * w + x) * 4,
          );
        }
      got.getContext("2d").putImageData(d, 0, 0);
      return {
        reference: ref.toDataURL(),
        render: got.toDataURL(),
        pts,
        W,
        H,
        box,
        body: Array.from(body),
        bodyQ: Array.from(q),
      };
    },
    { input },
  );
  const stem = `${profile}-${toy}-${input}-${repeat}`;
  let quality = null;
  if (crop) {
    const a = PNG.sync.read(Buffer.from(crop.reference.split(",")[1], "base64")),
      b = PNG.sync.read(Buffer.from(crop.render.split(",")[1], "base64"));
    quality = clarity(a.data, b.data, a.width, a.height);
    for (const [key, v] of [
      ["source", crop.reference],
      ["render", crop.render],
    ])
      fs.writeFileSync(`${out}/${stem}-${key}.png`, Buffer.from(v.split(",")[1], "base64"));
  }
  await page.screenshot({ path: `${out}/${stem}.png` });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const mem = (await cdp.send("Performance.getMetrics")).metrics || [];
  // Linux's proportional resident size includes native and software-GPU
  // allocations without counting shared pages once for every process.
  let processMemory = null;
  try {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send("SystemInfo.getProcessInfo");
    let pss = 0,
      rss = 0,
      n = 0;
    for (const p of processInfo) {
      try {
        const s = fs.readFileSync(`/proc/${p.id}/smaps_rollup`, "utf8");
        pss += Number(s.match(/^Pss:\s+(\d+)/m)?.[1] || 0) * 1024;
        rss += Number(s.match(/^Rss:\s+(\d+)/m)?.[1] || 0) * 1024;
        n++;
      } catch {}
    }
    await session.detach();
    if (n) processMemory = { pssBytes: pss, rssBytes: rss, processes: n };
  } catch {}
  const state = await page.evaluate(() => {
    const pl = window.__splashery.player,
      p = pl.pictures;
    const unique = new Set([
      ...p.cache.values(),
      ...p.sheets.map((s) => s.shown?.data).filter(Boolean),
    ]);
    return {
      splats: p.splats(),
      kitSplats: pl.proc.ctx.buf.count,
      sheetBytes: [...unique].reduce(
        (n, d) =>
          n +
          Object.values(d)
            .filter((x) => ArrayBuffer.isView(x))
            .reduce((s, x) => s + x.byteLength, 0) +
          (d.surface ? d.w * d.h * 4 + (d.surface.relief?.d?.byteLength || 0) : 0),
        0,
      ),
      gpuBytes: Object.values(pl.stage.device._vram || {}).reduce(
        (n, x) => n + (typeof x === "number" ? x : 0),
        0,
      ),
      builds: p.stats.builds,
      jsHeap: performance.memory?.usedJSHeapSize || null,
    };
  });
  const motion = await page.evaluate(
    async ({ seconds, toy }) => {
      const pl = window.__splashery.player;
      pl.frozen = false;
      let frames = 0;
      const times = [];
      let last = performance.now();
      const on = () => {
        const t = performance.now();
        times.push(t - last);
        last = t;
        frames++;
      };
      pl.stage.app.on("postrender", on);
      const start = performance.now();
      pl.act();
      const request = () => pl.stage.requestRender();
      const timer = setInterval(request, 16);
      const second = setTimeout(() => pl.act(), seconds * 500);
      await new Promise((r) => setTimeout(r, seconds * 1000));
      clearInterval(timer);
      clearTimeout(second);
      pl.stage.app.off("postrender", on);
      times.sort((a, b) => a - b);
      return {
        frames,
        seconds: (performance.now() - start) / 1000,
        fps: frames / ((performance.now() - start) / 1000),
        p95Ms: times[Math.floor(times.length * 0.95)] || null,
      };
    },
    { seconds: Number(arg("seconds", 5)), toy },
  );
  await page.close();
  return {
    toy,
    input,
    profile,
    repeat,
    ...loaded,
    firstPageMs,
    installedPageMs,
    ...state,
    processMemory,
    cdpHeap: mem.find((x) => x.name === "JSHeapUsedSize")?.value || null,
    quality,
    motion,
    registration: crop && {
      pts: crop.pts,
      W: crop.W,
      H: crop.H,
      box: crop.box,
      method: crop.registration || "rectified",
    },
    errors,
  };
}

try {
  await makeFixtures();
  const records = [];
  for (const profile of arg("profiles", "phone,desktop").split(","))
    for (const toy of arg("toys", "picture-lab,your-book,photo-album").split(","))
      for (const input of arg("cases", "sample,text,photo,chart").split(","))
        for (let repeat = 1; repeat <= Number(arg("repeats", 1)); repeat++) {
          const r = await run(toy, input, profile, repeat);
          records.push(r);
          console.log(JSON.stringify(r));
          fs.writeFileSync(
            `${out}/results.json`,
            JSON.stringify(
              {
                browser: browser.version(),
                toolSha256,
                fixtures: Object.fromEntries(
                  fixtureFiles.map((name) => [
                    name,
                    {
                      sha256: digest(fs.readFileSync(`${fixtures}/${name}`)),
                      bytes: fs.statSync(`${fixtures}/${name}`).size,
                    },
                  ]),
                ),
                base,
                profiles,
                created: new Date().toISOString(),
                records,
              },
              null,
              2,
            ) + "\n",
          );
        }
} finally {
  await browser.close();
}
