// Task 57: task 54 hole/halo proxies in the real toy, at eight yaw/pitch poses.
// Serve on 4173, prepare candidate JPEGs, run tools/dsm-depth.mjs, then run this tool.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
const candidates = JSON.parse(fs.readFileSync("tools/cdx-hard-case-candidates.json", "utf8"));
const PICTURES = candidates.map((r) => [r.prompt, r.file, r.name, r.category]);
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const out = "docs/audits/hard-case-samples-2026-10";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
page.on("pageerror", (e) => console.error(e.message));
await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=mid&labs=1");
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
const rows = fs.existsSync(`${out}/photo-scores.json`)
  ? JSON.parse(fs.readFileSync(`${out}/photo-scores.json`))
  : [];
for (const [prompt, file, name, group] of PICTURES) {
  if (rows.some((r) => r.file === file) || !fs.existsSync(`assets/toys/photo-3d/ai/${file}.depth`))
    continue;
  const result = await page.evaluate(
    async ({ file, name }) => {
      const { app, player } = window.__splashery;
      const pack = await import("/src/packs/photo-3d.js");
      const core = await import("/src/packs/photo-3d-core.js");
      const photo = await pack.decodePhoto(
        new Uint8Array(await (await fetch(`/assets/toys/photo-3d/ai/${file}.jpg`)).arrayBuffer()),
      );
      const depth = pack.unpackDepth(
        new Uint8Array(await (await fetch(`/assets/toys/photo-3d/ai/${file}.depth`)).arrayBuffer()),
      );
      await app.chooseToy("photo-3d");
      pack.usePhoto(photo, depth, `${name} (AI-made)`);
      await app.setToyOptions({ source: "custom", depth: 0.5, view: "sharp" });
      player.idle.weight = 0;
      player.motion.setControl("flat", 0, { snap: true });
      player.motion.setControl("layers", 0, { snap: true });
      window.__psv.set("photo-3d", "sharp");
      for (let i = 0; i < 8; i++) await player.stage.captureFrame();
      const info = player.proc.ctx.kit.data.photo;
      if (info.name !== `${name} (AI-made)`) throw Error("Wrong sample: " + info.name);
      const s = core.buildPhotoSplats(photo, depth, { count: 199500, depth: 0.5 });
      const fit = player.motion.ctx.transform;
      const edges = [];
      const stride = Math.max(1, Math.floor(s.gx / 100));
      for (let y = stride * 3; y < s.gy - stride * 3; y += stride)
        for (let x = stride * 3; x < s.gx - stride * 3; x += stride) {
          const i = y * s.gx + x;
          for (const d of [stride, stride * s.gx])
            if (Math.abs(s.depth[i] - s.depth[i + d]) > 0.045)
              edges.push({ i, j: i + d, jump: Math.abs(s.depth[i] - s.depth[i + d]) });
        }
      edges.sort((a, b) => b.jump - a.jump);
      edges.length = Math.min(240, edges.length);
      const pos = (i) => [
        (((i % s.gx) + 0.5) / s.gx) * s.aspect - s.aspect / 2,
        0.5 - (Math.floor(i / s.gx) + 0.5) / s.gy,
        s.stats.relief * (s.depth[i] - 0.5),
      ];
      const color = (i) => {
        const x = Math.min(photo.w - 1, Math.floor((((i % s.gx) + 0.5) / s.gx) * photo.w)),
          y = Math.min(photo.h - 1, Math.floor(((Math.floor(i / s.gx) + 0.5) / s.gy) * photo.h));
        return Array.from(photo.data.subarray((y * photo.w + x) * 4, (y * photo.w + x) * 4 + 3));
      };
      const project = (p) =>
        player.stage.toScreen(
          player.stage.modelToWorld(p.map((v, i) => (v - fit.center[i]) * fit.scale)),
        );
      player.stage.setFixedSize([390, 520]);
      const poses = [];
      let worstShot = "",
        worst = -1;
      for (const axis of ["yaw", "pitch"])
        for (const deg of [-30, -20, 20, 30]) {
          player.camera.cur = {
            ...player.camera.home,
            yaw: 0,
            pitch: 0,
            [axis]: (deg * Math.PI) / 180,
          };
          player.camera.tgt = { ...player.camera.cur };
          app.setLook({ background: "#ff00ff" });
          for (let k = 0; k < 4; k++) await player.stage.captureFrame();
          const shot = await player.stage.captureFrame(),
            ctx = shot.getContext("2d"),
            img = ctx.getImageData(0, 0, shot.width, shot.height).data;
          // Row envelopes follow the rendered relief, rather than a flat rectangle whose
          // perspective differs at the border. Inset eight pixels; report this proxy honestly.
          const background = (x, y) => {
            const i = (y * shot.width + x) * 4;
            return img[i] > 245 && img[i + 1] < 10 && img[i + 2] > 245;
          };
          const spans = [];
          let top = shot.height,
            bottom = 0;
          for (let y = 0; y < shot.height; y++) {
            let left = shot.width,
              right = -1;
            for (let x = 0; x < shot.width; x++)
              if (!background(x, y)) {
                left = Math.min(left, x);
                right = x;
              }
            spans.push([left, right]);
            if (right - left > 32) {
              top = Math.min(top, y);
              bottom = y;
            }
          }
          let holes = 0,
            area = 0,
            halo = 0,
            samples = 0;
          for (let y = top + 8; y < bottom - 8; y++)
            for (let x = spans[y][0] + 8; x < spans[y][1] - 8; x++) {
              area++;
              if (background(x, y)) holes++;
            }
          for (const e of edges) {
            const a = project(pos(e.i)),
              b = project(pos(e.j)),
              ca = color(e.i),
              cb = color(e.j);
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 40) continue;
            for (let k = 0; k < 7; k++) {
              const t = (k + 0.5) / 7,
                x = Math.round(a[0] * (1 - t) + b[0] * t),
                y = Math.round(a[1] * (1 - t) + b[1] * t);
              if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue;
              const p = (y * shot.width + x) * 4;
              if (img[p] > 245 && img[p + 1] < 10 && img[p + 2] > 245) continue;
              for (let c = 0; c < 3; c++) {
                halo +=
                  Math.max(
                    0,
                    Math.min(ca[c], cb[c]) - 8 - img[p + c],
                    img[p + c] - Math.max(ca[c], cb[c]) - 8,
                  ) / 255;
                samples++;
              }
            }
          }
          if (!area || !samples) throw Error("Empty measurement region");
          const row = {
            axis,
            degrees: deg,
            holePixels: holes,
            area,
            holeFraction: holes / area,
            edgeSamples: samples,
            haloExcursion: halo / samples,
          };
          poses.push(row);
          const cost = 70 * row.holeFraction + 30 * row.haloExcursion;
          if (cost > worst) {
            worst = cost;
            app.setLook({ background: "#ede9e3" });
            for (let k = 0; k < 3; k++) await player.stage.captureFrame();
            worstShot = (await player.stage.captureFrame()).toDataURL("image/png");
          }
        }
      player.stage.setFixedSize(null);
      return {
        poses,
        edgeCount: edges.length,
        score: 100 - worst,
        splats: info.splats,
        pieces: info.pieces,
        worstShot,
      };
    },
    { file, name },
  );
  const { worstShot, ...metrics } = result;
  fs.mkdirSync(".cache/hard-case-samples/views", { recursive: true });
  fs.writeFileSync(
    `.cache/hard-case-samples/views/${file}.png`,
    Buffer.from(worstShot.split(",")[1], "base64"),
  );
  const jpg = `assets/toys/photo-3d/ai/${file}.jpg`;
  const dep = `assets/toys/photo-3d/ai/${file}.depth`;
  rows.push({
    prompt,
    file,
    name,
    category: group,
    sha256: hash(jpg),
    depthSha256: hash(dep),
    ...metrics,
  });
  fs.writeFileSync(`${out}/photo-scores.json`, JSON.stringify(rows, null, 2) + "\n");
  console.log(`${prompt} ${name}: ${result.score.toFixed(3)}, ${result.edgeCount} edges`);
}
await browser.close();
console.log(`Measured ${rows.length} of ${PICTURES.length} candidates.`);
