import fs from "node:fs";
import { ALL_SAMPLES } from "../src/packs/photo-3d.js";

export const screens = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3, profile: "low" },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, profile: "mid" },
};
export function inputs() {
  const extras = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/sources/manifest.json"));
  return [
    ...ALL_SAMPLES.map((s) => ({ ...s, builtin: true })),
    ...extras.map((s) => ({ ...s, builtin: false })),
  ];
}
export async function openR3(page, url, screen) {
  const { width, height, profile } = screen;
  await page.route("**/__r3/**", (route) => {
    const [id, kind] = new URL(route.request().url()).pathname.slice("/__r3/".length).split("/");
    const entry = inputs().find((s) => s.id === id);
    if (!entry) return route.abort();
    return route.fulfill({
      body: fs.readFileSync(kind === "depth" ? entry.depthFile : entry.file),
      contentType:
        kind === "depth"
          ? "application/octet-stream"
          : entry.file.endsWith(".gif")
            ? "image/gif"
            : "image/jpeg",
    });
  });
  await page.goto(`${url}?renderer=webgl2&profile=${profile}&adapt=off&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  return page.evaluate(
    async ({ width, height }) => {
      const { app, player: pl } = window.__splashery;
      await app.chooseToy("photo-3d");
      pl.idle.weight = 0;
      pl.opts.idleDelay = 1e9;
      app.setLook({ background: "#00ff00", ground: "none" });
      const ratio = pl.stage.pixelRatio();
      pl.stage.setFixedSize([Math.round(width * ratio), Math.round(height * ratio)]);
      pl.stage.canvas.style.width = `${width}px`;
      pl.stage.canvas.style.height = `${height}px`;
      return {
        dpr: devicePixelRatio,
        ratio,
        buffer: [pl.stage.canvas.width, pl.stage.canvas.height],
      };
    },
    { width, height },
  );
}
export async function selectR3(page, entry, depth, view) {
  await page.evaluate(
    async ({ id, builtin, depth, view }) => {
      const { app, player: pl } = window.__splashery;
      pl.setPaused(false);
      if (!builtin && window.__r3Input !== id) {
        const p = await import("/src/packs/photo-3d.js");
        const photo = await p.decodePhoto(await (await fetch(`/__r3/${id}/photo`)).blob());
        const d = p.unpackDepth(
          new Uint8Array(await (await fetch(`/__r3/${id}/depth`)).arrayBuffer()),
        );
        p.usePhoto(photo, d, `Review input: ${id}`);
        window.__r3Input = id;
      }
      await app.setToyOptions({ source: builtin ? id : "custom", depth, view: "sharp" });
      pl.motion.setControl("flat", 0, { snap: true });
      pl.motion.setControl("layers", 0, { snap: true });
      const sharp = await import("/src/packs/photo-sharp.js");
      sharp.setSharpView("photo-3d", "sharp");
      for (let i = 0; i < 3; i++) await pl.stage.captureFrame();
      if (view === "splats") {
        sharp.setSharpView("photo-3d", "splats");
        for (let i = 0; i < 2; i++) await pl.stage.captureFrame();
        if (pl.photo?.version !== pl.proc.ctx.kit.data.photo.uid)
          throw new Error("Stale photo texture.");
      }
      pl.setPaused(true);
    },
    { id: entry.id, builtin: entry.builtin, depth, view },
  );
}

export async function poseR3(page, yaw, pitch, mode = "color", background = [0, 1, 0]) {
  return page.evaluate(
    async ({ yaw, pitch, mode, background }) => {
      const pl = window.__splashery.player;
      const { Vec3 } = await import("/src/pc.js");
      pl.camera.cur = {
        ...pl.camera.home,
        yaw: (yaw * Math.PI) / 180,
        pitch: (pitch * Math.PI) / 180,
      };
      pl.camera.tgt = { ...pl.camera.cur };
      pl.stage.setCameraPose(pl.camera.pose());
      pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
      const all = pl.stage.app.scene.layers
        .getLayerByName("World")
        .meshInstances.filter((mi) => mi.material.getParameter("uDepth"));
      const restore = [];
      if (mode !== "color")
        for (const mi of all) {
          const mat = mi.material,
            old = mat.shaderDesc,
            back = mat.getParameter("uLayer").data[2];
          let output;
          if (mode === "uv")
            output = `vec2 q=floor(clamp(vUv,0.0,1.0)*4095.0+0.5); gl_FragColor=vec4(floor(q.x/16.0)/255.0,(mod(q.x,16.0)*16.0+floor(q.y/256.0))/255.0,mod(q.y,256.0)/255.0,1.0);`;
          else
            output =
              back === 0
                ? old.fragmentGLSL.includes("varying vec3 vCell")
                  ? `gl_FragColor=vec4(vCell.y/3.0,64.0/255.0,vCell.x,1.0);`
                  : `gl_FragColor=vec4(textureLod(uBand,vCenter,0.0).r,64.0/255.0,textureLod(uDepth,vCenter,0.0).r,1.0);`
                : `gl_FragColor=vec4(0.0,128.0/255.0,0.0,1.0);`;
          mat.shaderDesc = {
            ...old,
            uniqueName: old.uniqueName + "-r3-" + mode,
            fragmentGLSL: old.fragmentGLSL.replace(
              /gl_FragColor = [^;]+;/,
              `if (coverage < 0.5) discard; ${output.replace(",coverage)", ",1.0)")}`,
            ),
          };
          mat.update();
          restore.push([mat, old]);
        }
      pl.stage.setClearColor(mode === "color" ? background : [0, 0, 0], 1);
      await pl.stage.captureFrame();
      const frame = await pl.stage.captureFrame();
      const image = frame.toDataURL();
      for (const [mat, old] of restore) {
        mat.shaderDesc = old;
        mat.update();
      }
      pl.stage.aliveUntil = 0;
      pl.stage.app.renderNextFrame = false;
      const mi = all.find((m) => m.material.getParameter("uLayer").data[2] === 0);
      const depth = mi.material.getParameter("uDepth").data,
        soft = mi.material.getParameter("uSoftDepth")?.data;
      const d = soft ? soft._levels[0] : depth._levels[0],
        w = soft ? soft.width : depth.width,
        h = soft ? soft.height : depth.height;
      const sample = (u, v) => {
        const x = Math.max(0, Math.min(w - 1, u * w - 0.5)),
          y = Math.max(0, Math.min(h - 1, v * h - 0.5));
        const i = Math.floor(x),
          j = Math.floor(y),
          fx = x - i,
          fy = y - j,
          i1 = Math.min(w - 1, i + 1),
          j1 = Math.min(h - 1, j + 1);
        return (
          ((d[j * w + i] * (1 - fx) + d[j * w + i1] * fx) * (1 - fy) +
            (d[j1 * w + i] * (1 - fx) + d[j1 * w + i1] * fx) * fy) /
          255
        );
      };
      const aspect = mi.material.getParameter("uGrid").data[0],
        R = mi.material.getParameter("uLift").data[0];
      const corners = [];
      for (let side = 0; side < 4; side++)
        for (let i = 0; i < 32; i++) {
          const t = i / 32,
            [u, v] =
              side === 0 ? [t, 0] : side === 1 ? [1, t] : side === 2 ? [1 - t, 1] : [0, 1 - t];
          let bd = 0;
          if (soft) bd = sample(u, v);
          else {
            for (let j = -2; j <= 2; j++)
              for (let k = -2; k <= 2; k++) bd += sample(u + (k * 0.02) / aspect, v + j * 0.02);
            bd /= 25;
          }
          const p = pl.stage.cameraEntity.camera.camera.worldToScreen(
            new Vec3(...pl.fromRecipe([(u - 0.5) * aspect, 0.5 - v, R * (bd - 0.5)])),
            frame.width,
            frame.height,
          );
          corners.push([p.x, p.y]);
        }
      return { image, corners, width: frame.width, height: frame.height };
    },
    { yaw, pitch, mode, background },
  );
}

export async function texturesR3(page) {
  return page.evaluate(() => {
    const all =
      window.__splashery.player.stage.app.scene.layers.getLayerByName("World").meshInstances;
    const image = (tex) => {
      const c = document.createElement("canvas");
      c.width = tex.width;
      c.height = tex.height;
      const g = c.getContext("2d", { willReadFrequently: true }),
        src = tex.getSource();
      if (src && !ArrayBuffer.isView(src)) g.drawImage(src, 0, 0);
      else
        g.putImageData(
          new ImageData(new Uint8ClampedArray(tex._levels[0]), tex.width, tex.height),
          0,
          0,
        );
      return c.toDataURL();
    };
    const get = (back) =>
      all
        .find(
          (mi) =>
            mi.material.getParameter("uLayer")?.data[2] === back &&
            mi.material.getParameter("uDepth"),
        )
        .material.getParameter("uColor").data;
    return { surface: image(get(0)), background: image(get(1)) };
  });
}

export async function referenceDepthR3(page) {
  return page.evaluate(() => {
    const mi = window.__splashery.player.stage.app.scene.layers
      .getLayerByName("World")
      .meshInstances.find(
        (mi) =>
          mi.material.getParameter("uLayer")?.data[2] === 0 && mi.material.getParameter("uDepth"),
      );
    const tex = mi.material.getParameter("uDepth").data;
    return { width: tex.width, height: tex.height, data: Array.from(tex._levels[0]) };
  });
}

export async function projectAnchorsR3(page, anchors) {
  return page.evaluate(
    async (profiles) => {
      const pl = window.__splashery.player,
        { Vec3 } = await import("/src/pc.js");
      const mi = pl.stage.app.scene.layers
        .getLayerByName("World")
        .meshInstances.find(
          (mi) =>
            mi.material.getParameter("uLayer")?.data[2] === 0 && mi.material.getParameter("uDepth"),
        );
      const grid = mi.material.getParameter("uGrid").data,
        lift = mi.material.getParameter("uLift").data;
      return profiles.map((profile) =>
        profile.map(({ u, v, depth }) => {
          const position = pl.fromRecipe([
            (u - 0.5) * grid[0],
            (0.5 - v) * grid[1],
            lift[0] * (depth - lift[1]),
          ]);
          const camera = pl.stage.cameraEntity.camera.camera,
            world = new Vec3(...position);
          const p = camera.worldToScreen(world, pl.stage.canvas.width, pl.stage.canvas.height);
          const m = camera._viewProjMat.data;
          return [p.x, p.y, world.x * m[3] + world.y * m[7] + world.z * m[11] + m[15]];
        }),
      );
    },
    anchors.map((a) => a.profile.map(({ u, v, depth }) => ({ u, v, depth }))),
  );
}
