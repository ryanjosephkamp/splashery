#!/usr/bin/env node
// Task 39. Real phone renders, with two pixels excluded at the projected border.
// Count clear-color holes, backing exposure, and geometric/UV tears separately.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { ALL_SAMPLES } from "../src/packs/photo-3d.js";

export function footprint(png) {
  const points = [];
  const { width: w, height: h, data } = png;
  for (let y = 0; y < h; y++) {
    let first = -1,
      last = -1;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (!(data[p] < 5 && data[p + 1] > 250 && data[p + 2] < 5)) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) points.push([first, y], [last, y]);
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lo = half(points),
    hi = half([...points].reverse());
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

export function pixels(png, corners = footprint(png)) {
  const { width: w, height: h, data } = png;
  let holes = 0,
    backing = 0,
    area = 0,
    tears = 0;
  for (let y = 0; y < h; y++) {
    const hits = [];
    for (let k = 0; k < corners.length; k++) {
      const a = corners[k],
        b = corners[(k + 1) % corners.length];
      if (a[1] > y + 0.5 !== b[1] > y + 0.5)
        hits.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    // The border can be concave after a turn. Preserve every paired interval:
    // joining the outermost hits would count the concavity outside the photo.
    let span = 0;
    let run = 0;
    for (let x = 0; x <= w; x++) {
      const p = (y * w + x) * 4;
      while (span + 1 < hits.length && x + 0.5 >= hits[span + 1] - 2) span += 2;
      const ok = span + 1 < hits.length && x + 0.5 > hits[span] + 2 && x + 0.5 < hits[span + 1] - 2;
      const magenta = ok && data[p] > 210 && data[p + 1] < 60 && data[p + 2] > 210;
      if (ok) {
        area++;
        if (data[p] < 5 && data[p + 1] > 250 && data[p + 2] < 5) holes++;
        if (magenta) backing++;
      }
      if (magenta) run++;
      else {
        if (run >= 12) tears += run;
        run = 0;
      }
    }
  }
  // This is a reproducible proxy for broad exposed backing bands, not hidden-scene truth.
  return { holes, backing, backingRuns: tears, area };
}

export async function open(page, profile = "low") {
  await page.goto(
    `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&profile=${profile}&adapt=off&labs=1`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("photo-3d");
    player.idle.weight = 0;
    player.opts.idleDelay = 1e9;
    app.setLook({ background: "#00ff00", ground: "none" });
    player.stage.setFixedSize([390, 844]);
    player.stage.canvas.style.width = "390px";
    player.stage.canvas.style.height = "844px";
  });
}

export async function sample(page, id, depth, view) {
  await page.evaluate(
    async ([id, depth, view]) => {
      const { app, player } = window.__splashery;
      player.setPaused(false);
      await app.setToyOptions({ source: id, depth, view: "sharp" });
      player.motion.setControl("flat", 0, { snap: true });
      player.motion.setControl("layers", 0, { snap: true });
      const sharp = await import("/src/packs/photo-sharp.js");
      sharp.setSharpView("photo-3d", "sharp");
      player.camera.cur = { ...player.camera.home, yaw: 0, pitch: 0 };
      player.camera.tgt = { ...player.camera.cur };
      for (let k = 0; k < 3; k++) await player.stage.captureFrame();
      if (!sharp.sharpState().on) throw new Error("The Sharp calibration surface did not render.");
      if (view === "splats") {
        sharp.setSharpView("photo-3d", view);
        for (let k = 0; k < 2; k++) await player.stage.captureFrame();
        if (player.photo?.version !== player.proc.ctx.kit.data.photo.uid)
          throw new Error("The splats are showing a stale photo texture.");
      }
      player.setPaused(true);
    },
    [id, depth, view],
  );
}

export async function shot(
  page,
  direction,
  angle,
  diagnostic = false,
  clear = [0, 1, 0],
  label = "",
) {
  return page.evaluate(
    async ([direction, angle, diagnostic, clear, label]) => {
      const pl = window.__splashery.player;
      window.__psv.tint(diagnostic === true || diagnostic === "splat-backing");
      const r = (angle * Math.PI) / 180;
      const yaw = direction === "left" ? -r : direction === "right" ? r : 0;
      const pitch = direction === "up" ? r : direction === "down" ? -r : 0;
      pl.camera.cur = { ...pl.camera.home, yaw, pitch };
      pl.camera.tgt = { ...pl.camera.cur };
      pl.stage.setCameraPose(pl.camera.pose());
      // Freeze the raised photo, not the camera. Refresh the Sharp drive so its
      // idle lifecycle remains live while the animation clock is paused.
      const out = { parts: {} };
      pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, out);
      const restore = [];
      let restoreSplat;
      if (diagnostic === "splat-backing") {
        const mat = pl.stage.app.scene.gsplat.material;
        const original = mat.shaderChunks.glsl.get("gsplatModifyPS");
        // Keep the real coverage, sorting, alpha, and photo-UV boundary.
        // Only classify its final color: foreground black, backing magenta.
        const replacement = original.replace(
          "  spKernelColor(uv, color);",
          "  spKernelColor(uv, color); vec4 cdxA = getSpPhotoA(); color.rgb = (cdxA.z < .5 || cdxA.z > 1.5) ? vec3(1.0, 0.0, 1.0) : vec3(0.0);",
        );
        if (replacement === original) throw new Error("No photo splat diagnostic hook.");
        mat.shaderChunks.glsl.set("gsplatModifyPS", replacement);
        mat.update();
        restoreSplat = () => {
          mat.shaderChunks.glsl.set("gsplatModifyPS", original);
          mat.update();
        };
      }
      if (diagnostic === "tears") {
        const world = pl.stage.app.scene.layers.getLayerByName("World");
        for (const mi of world.meshInstances) {
          const mat = mi.material;
          if (!mat.getParameter("uDepth") || !mat.shaderDesc) continue;
          const original = mat.shaderDesc;
          const vertexGLSL = original.vertexGLSL
            .replace("varying vec2 vUv;", "varying vec2 vUv; varying vec2 cdxTarget;")
            .replace("void main(void) {", "void main(void) { cdxTarget = aPosition.xy;");
          const diagnosticCode = `
            vec2 tx = dFdx(cdxTarget), ty = dFdy(cdxTarget);
            vec2 cx = dFdx(vUv), cy = dFdy(vUv);
            float dt = tx.x * ty.y - tx.y * ty.x;
            bool cdxBad = false;
            if (abs(dt) > 1e-18) {
              vec2 gu = (cx * ty.y - cy * tx.y) / dt;
              vec2 gv = (cy * tx.x - cx * ty.x) / dt;
              float du = (dFdx(vD) * ty.y - dFdy(vD) * tx.y) / dt;
              float dv = (dFdy(vD) * tx.x - dFdx(vD) * ty.x) / dt;
              if (uLayer.z < .5) cdxBad = max(abs(du) / uGrid.z, abs(dv) / uGrid.w) > 2.0 * uLayer.y;
              else if (uLayer.z < 1.5) cdxBad = max(length(gu), length(gv)) > 3.0 || min(length(gu), length(gv)) < .333 || gu.x * gv.y - gu.y * gv.x < -.01;
            }
          `;
          const fragmentGLSL = original.fragmentGLSL
            .replace("varying vec2 vUv;", "varying vec2 vUv; varying vec2 cdxTarget;")
            .replace("void main(void) {", `void main(void) { ${diagnosticCode}`)
            .replace(
              "gl_FragColor =",
              "c = cdxBad ? vec3(1.0, 0.0, 1.0) : vec3(0.0); gl_FragColor =",
            );
          mat.shaderDesc = {
            ...original,
            uniqueName: `${original.uniqueName}-cdx-tears`,
            vertexGLSL,
            fragmentGLSL,
          };
          mat.update();
          restore.push([mat, original]);
        }
      }
      pl.stage.setClearColor(clear, 1);
      if (!diagnostic || diagnostic === "splat-backing") await pl.stage.captureFrame();
      const f = await pl.stage.captureFrame();
      if (label) {
        const g = f.getContext("2d");
        g.fillStyle = "#222";
        g.font = "14px sans-serif";
        const lines = label.split("\n");
        lines.forEach((line, i) =>
          g.fillText(line, 12, f.height - 24 - (lines.length - 1 - i) * 18, f.width - 24),
        );
      }
      for (const [mat, original] of restore) {
        mat.shaderDesc = original;
        mat.update();
      }
      restoreSplat?.();
      const a = pl.toyInfo.recipe.photo.rect()[2] * 2;
      const mi = pl.stage.app.scene.layers
        .getLayerByName("World")
        .meshInstances.find(
          (m) =>
            m.material.getParameter("uLayer")?.data[2] === 0 && m.material.getParameter("uDepth"),
        );
      const tex = mi.material.getParameter("uDepth").data;
      const softTex =
        mi.material.getParameter("uFill")?.data[0] > 0.5
          ? mi.material.getParameter("uSoftDepth")?.data
          : null;
      const d = softTex ? softTex._levels[0] : tex._levels[0],
        w = softTex ? softTex.width : tex.width,
        h = softTex ? softTex.height : tex.height;
      const sample = (u, v) => {
        const x = Math.max(0, Math.min(w - 1, u * w - 0.5)),
          y = Math.max(0, Math.min(h - 1, v * h - 0.5));
        const x0 = Math.floor(x),
          y0 = Math.floor(y),
          fx = x - x0,
          fy = y - y0;
        const x1 = Math.min(w - 1, x0 + 1),
          y1 = Math.min(h - 1, y0 + 1);
        return (
          ((d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx) * (1 - fy) +
            (d[y1 * w + x0] * (1 - fx) + d[y1 * w + x1] * fx) * fy) /
          255
        );
      };
      const R = pl.proc.ctx.kit.data.photo.relief;
      const corners = [];
      for (let side = 0; side < 4; side++)
        for (let i = 0; i < 32; i++) {
          const t = i / 32;
          const [u, v] =
            side === 0 ? [t, 0] : side === 1 ? [1, t] : side === 2 ? [1 - t, 1] : [0, 1 - t];
          let z = softTex ? sample(u, v) * 25 : 0;
          if (!softTex)
            for (let j = -2; j <= 2; j++)
              for (let k = -2; k <= 2; k++)
                z += sample(
                  Math.min(1, Math.max(0, u + (k * 0.02) / a)),
                  Math.min(1, Math.max(0, v + j * 0.02)),
                );
          corners.push(
            pl.stage
              .toScreen(pl.fromRecipe([(u - 0.5) * a, 0.5 - v, R * (z / 25 - 0.5)]))
              .slice(0, 2),
          );
        }
      return { image: f.toDataURL("image/png"), corners };
    },
    [direction, angle, diagnostic, clear, label],
  );
}

export async function splatTears(page) {
  return page.evaluate(async () => {
    const pl = window.__splashery.player;
    const { Mat4 } = await import("/src/pc.js");
    const camera = pl.stage.cameraEntity.camera;
    const m = new Mat4()
      .mul2(camera.projectionMatrix, camera.viewMatrix)
      .mul(pl.stage.toy.entity.getWorldTransform()).data;
    const b = pl.proc.ctx.buf;
    let count = 0,
      area = 0,
      maxAspect = 0;
    for (let i = 0; i < b.count; i++) {
      const x = b.pos[i * 3],
        y = b.pos[i * 3 + 1],
        z = b.pos[i * 3 + 2];
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0) continue;
      let xx = 0,
        xy = 0,
        yy = 0;
      // Every photo disc has equal in-plane axes and normal +Z; its random
      // in-plane rotation does not change this projected covariance.
      for (let a = 0; a < 3; a++) {
        const scale = b.scale[i * 3 + a];
        const dx = ((m[a * 4] * w - cx * m[a * 4 + 3]) / (w * w)) * 195 * scale;
        const dy = ((m[a * 4 + 1] * w - cy * m[a * 4 + 3]) / (w * w)) * 422 * scale;
        xx += dx * dx;
        xy += dx * dy;
        yy += dy * dy;
      }
      const delta = Math.hypot(xx - yy, 2 * xy);
      const lo = Math.max(1e-12, (xx + yy - delta) / 2),
        hi = (xx + yy + delta) / 2;
      const aspect = Math.sqrt(hi / lo);
      maxAspect = Math.max(maxAspect, aspect);
      if (aspect > 3 && Math.sqrt(hi) * 4.8 >= 12) {
        count++;
        area += Math.PI * Math.sqrt(hi * lo) * 2.4 ** 2;
      }
    }
    return { tearSplats: count, tears: Math.round(area), maxAspect };
  });
}

function sheet(rows, out) {
  const images = rows.sort((a, b) => b.holes + b.tears - a.holes - a.tears).slice(0, 12);
  const s = new PNG({ width: 390 * 4, height: 844 * 3 });
  images.forEach((r, k) => {
    const p = PNG.sync.read(fs.readFileSync(path.join(out, r.file)));
    PNG.bitblt(p, s, 0, 0, 390, 844, (k % 4) * 390, Math.floor(k / 4) * 844);
  });
  fs.writeFileSync(path.join(out, "worst.png"), PNG.sync.write(s));
  fs.writeFileSync(path.join(out, "worst.json"), JSON.stringify(images, null, 2));
}

async function main() {
  const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
  const ids = opt("samples", ALL_SAMPLES.map((s) => s.id).join(",")).split(",");
  const depths = opt("depths", "0.2,0.5,1").split(",").map(Number);
  const angles = opt("angles", "10,20,30").split(",").map(Number);
  const views = opt("views", "sharp,splats").split(",");
  const measureSplatBacking = opt("splat-backing", "false") === "true";
  const out = opt("out", ".cache/cdx-p3d2/before");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /GL_INVALID|Invalid command|shader compilation/i.test(m.text()))
      errors.push(m.text());
  });
  const rows = [];
  try {
    await open(page, opt("profile", "low"));
    for (const id of ids) {
      for (const depth of depths)
        for (const view of views) {
          await sample(page, id, depth, view);
          for (const angle of angles)
            for (const direction of ["left", "right", "up", "down"]) {
              const s = await shot(page, direction, angle);
              const p = PNG.sync.read(Buffer.from(s.image.split(",")[1], "base64"));
              const m = pixels(p, s.corners);
              m.backing = 0;
              m.backingRuns = 0;
              m.tears = 0;
              if (view === "sharp") {
                const d = await shot(page, direction, angle, true);
                const t = pixels(
                  PNG.sync.read(Buffer.from(d.image.split(",")[1], "base64")),
                  s.corners,
                );
                m.backing = t.backing;
                m.backingRuns = t.backingRuns;
                fs.writeFileSync(
                  path.join(out, `${id}-${depth}-${view}-${angle}-${direction}-diagnostic.png`),
                  Buffer.from(d.image.split(",")[1], "base64"),
                );
                const td = await shot(page, direction, angle, "tears");
                m.tears = pixels(
                  PNG.sync.read(Buffer.from(td.image.split(",")[1], "base64")),
                  s.corners,
                ).backing;
                fs.writeFileSync(
                  path.join(out, `${id}-${depth}-${view}-${angle}-${direction}-tears.png`),
                  Buffer.from(td.image.split(",")[1], "base64"),
                );
              } else {
                Object.assign(m, await splatTears(page));
                m.backing = null;
                m.backingRuns = null;
                if (measureSplatBacking) {
                  const d = await shot(page, direction, angle, "splat-backing");
                  const t = pixels(
                    PNG.sync.read(Buffer.from(d.image.split(",")[1], "base64")),
                    s.corners,
                  );
                  m.backing = t.backing;
                  m.backingRuns = t.backingRuns;
                  fs.writeFileSync(
                    path.join(out, `${id}-${depth}-${view}-${angle}-${direction}-diagnostic.png`),
                    Buffer.from(d.image.split(",")[1], "base64"),
                  );
                }
              }
              const file = `${id}-${depth}-${view}-${angle}-${direction}.png`;
              fs.writeFileSync(path.join(out, file), PNG.sync.write(p));
              rows.push({ id, depth, view, angle, direction, ...m, corners: s.corners, file });
            }
        }
      fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows, null, 2));
      console.log(id, `${rows.length} renders`, `errors ${errors.length}`);
    }
    sheet([...rows], out);
    fs.writeFileSync(path.join(out, "errors.json"), JSON.stringify(errors, null, 2));
  } finally {
    await browser.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
