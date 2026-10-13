// Full-picture, every-frame goal sweep. Real app, decoder, model, and shaders;
// stepped source clocks and a fixed camera. Reference renders remove cuts only
// for the measurement mask, never for the displayed picture.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { pictureMetrics } from "./cdx-mp2-pixels.mjs";
import { LONG_SAMPLES } from "../src/packs/moving-photo.js";

export const GRAPHICS_ARGS = [
  ...(process.env.SPLASHERY_GL === "llvmpipe"
    ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
    : ["--use-angle=swiftshader"]),
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
  "--disable-gpu-driver-bug-workarounds",
  "--enable-unsafe-webgpu",
  "--enable-features=Vulkan,WebGPU",
  "--use-webgpu-adapter=swiftshader",
  "--use-vulkan=swiftshader",
];
export const GRAPHICS_LAUNCH = {
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  ...(process.env.SPLASHERY_GL === "llvmpipe" ? { headless: false } : {}),
  args: GRAPHICS_ARGS,
};

export async function openRender(
  page,
  {
    id = "sample",
    source,
    upload = false,
    tier = "low",
    renderer = "webgl2",
    stepped = false,
  } = {},
) {
  await page.goto(
    `${process.env.SPLASHERY_URL || "http://127.0.0.1:4388/"}?renderer=${renderer}&adapt=off&profile=${tier}&labs=1`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__psv?.state().on && !window.__splashery.player.loading);
  await page.evaluate(async () => {
    window.__mp3 = await import("/src/packs/moving-photo.js");
    window.__splashery.app.setControl("play", 0);
  });
  const started = Date.now();
  if (upload) {
    await page.setInputFiles("#toy-input-file", source);
    await page.waitForFunction(
      () =>
        window.__mp3.MOVING.clip === window.__mp3.MOVING.custom &&
        !window.__splashery.player.loading &&
        window.__psv.state().on,
      null,
      { timeout: 600_000 },
    );
  } else {
    await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), id);
  }
  const openMs = Date.now() - started;
  const selected = await page.evaluate(
    ({ id, upload }) => {
      const m = window.__mp3,
        c = m.MOVING.clip;
      return !!c && (upload ? c === m.MOVING.custom : c.sample === id);
    },
    { id, upload },
  );
  if (!selected) throw new Error(`The requested ${upload ? "upload" : id} did not finish opening`);
  // Selection can become visible inside build before its regular Sharp source
  // replaces the opening preview. Measure the completed scene, not that clone.
  await page.waitForFunction(() => !window.__splashery.player.loading, null, { timeout: 600_000 });
  // The old clip path ages out while a paused long scene builds. Once the
  // full source is bound, explicitly sync the manual capture's Sharp view.
  // Collect complete depth with the app's real worker, while its unchanged
  // preview stays still. Continuous software rendering competes with model
  // preparation and adds no information to the final every-frame sweep.
  await page.evaluate(async () => {
    const moving = window.__mp3,
      setup = document.createElement("canvas");
    setup.width = moving.MOVING.grid.cols * 2;
    setup.height = moving.MOVING.grid.rows;
    moving.MOVING.t = 0;
    moving.MOVING.frame = 0;
    // Legacy long clips obtain their first depth bytes from this real screen
    // draw. A paused build need not have received that automatic draw yet.
    moving.MOVING_PHOTO.screen.draw(setup.getContext("2d"));
    const sharp = await import("/src/packs/photo-sharp.js");
    sharp.sharpClip(moving.MOVING, {
      width: 2,
      height: (2 * moving.MOVING.grid.rows) / moving.MOVING.grid.cols,
      full: moving.MOVING.full,
    });
    sharp.sharpDrive({});
    if (!window.__psv?.state().on) throw new Error("Completed Sharp scene did not synchronize");
    const pl = window.__splashery.player,
      st = pl.stage;
    window.__mp3Preparation = { handlers: st.updateHandlers, request: st.requestRender };
    pl.setPaused(true);
    st.updateHandlers = [];
    st.requestRender = () => {};
    st.aliveUntil = 0;
    st.app.renderNextFrame = false;
    window.__mp3.MOVING.clip.audio?.track.pause();
    window.__mp3.MOVING.clip.video?.pause();
  });
  await page.waitForFunction(
    () => {
      const c = window.__mp3.MOVING.clip;
      return (!c.refinement || c.refinement.done) && (!c.job || c.job.done);
    },
    null,
    { timeout: 1_800_000 },
  );
  await page.evaluate(
    async ({ source, id, stepped }) => {
      const m = window.__mp3,
        { player, app } = window.__splashery;
      const c = m.MOVING.clip;
      const held = window.__mp3Preparation;
      player.stage.updateHandlers = held.handlers;
      player.stage.requestRender = held.request;
      delete window.__mp3Preparation;
      if (c.refinement?.error) throw new Error(c.refinement.error);
      if (c.job && c.depth.done < c.depth.n) throw new Error("Long depth did not finish");
      app.setControl("play", 0);
      player.motion.recipe.drive = () => {};
      player.frozen = true;
      player.setPaused(true);
      const requestRender = player.stage.requestRender.bind(player.stage);
      player.stage.requestRender = () => requestRender(0);
      player.stage.aliveUntil = 0;
      player.idle.weight = 0;
      player.opts.idleDelay = 1e9;
      player.camera.setState(
        { ...player.camera.getState(), yaw: 0.18, pitch: 0.08 },
        { snap: true },
      );
      player.camera.update(0);
      player.stage.setCameraPose(player.camera.pose());
      c.audio?.track.pause();
      c.video?.pause();
      // The short Bunny's Sharp picture uses its native source video. Keep it
      // explicitly reachable for verified seeks, rather than relying on RVFC.
      if (!c.video && id === "sample" && source) {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.src = `/${source}`;
        await new Promise((resolve, reject) => {
          v.onloadeddata = resolve;
          v.onerror = reject;
        });
        c.video = v;
      }
      if (!c.video && c.audio) c.audio.url = "";
      // Let the last refinement ease finish before recording final geometry.
      if (c.transition || c.depthEase) await new Promise((r) => setTimeout(r, 550));
      m.MOVING.t = 0;
      m.MOVING.frame = 0;
      const canvas = document.createElement("canvas");
      canvas.width = m.MOVING.grid.cols * 2;
      canvas.height = m.MOVING.grid.rows;
      window.__mp3Canvas = canvas;
      m.MOVING_PHOTO.screen.draw(canvas.getContext("2d"));
      (await import("/src/packs/photo-sharp.js")).sharpDrive({});
      player.stage.setClearColor([0, 0, 0], 0);
      await player.stage.captureFrame();
      // Each measured source frame explicitly calls the actual screen draw,
      // Sharp sync, camera update, and engine capture. Paused app callbacks
      // add unrelated work between the three renders without advancing time.
      if (stepped) player.stage.updateHandlers = [];
    },
    { source, id, stepped },
  );
  return { openMs };
}

export async function renderFrame(
  page,
  time,
  {
    yaw = 0.18,
    evidence = false,
    pictureOnly = false,
    frame = true,
    measure = true,
    sourceWitness = true,
    screenDiagnostics = false,
    debugSpecks = false,
    verifyDepth = false,
  } = {},
) {
  return page.evaluate(
    async ({
      time,
      yaw,
      evidence,
      pictureOnly,
      frame,
      measure,
      sourceWitness,
      screenDiagnostics,
      debugSpecks,
      verifyDepth,
      oracle,
    }) => {
      const m = window.__mp3,
        c = m.MOVING.clip,
        pl = window.__splashery.player,
        st = pl.stage;
      const t = Math.max(0, Math.min(c.duration - 1e-7, time));
      const decodedAt = Math.max(0, Math.min(c.video?.duration || c.duration, time));
      m.MOVING.t = t;
      m.MOVING.frame = m.frameAt(c, t);
      if (c.video && (Math.abs(c.video.currentTime - decodedAt) > 0.0001 || c.video.seeking)) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            c.video.removeEventListener("seeked", done);
            reject(new Error("Source seek timed out"));
          }, 10000);
          const done = () => {
            if (c.video.seeking || Math.abs(c.video.currentTime - decodedAt) > 0.001) return;
            clearTimeout(timer);
            c.video.removeEventListener("seeked", done);
            resolve();
          };
          c.video.addEventListener("seeked", done);
          c.video.currentTime = decodedAt;
        });
      }
      if (c.video) {
        // seeked can precede the decoder's canvas-readable picture. The
        // paused video needs two paint cycles before its native snapshot.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      pl.camera.setState({ ...pl.camera.getState(), yaw, pitch: 0.08 }, { snap: true });
      pl.camera.update(0);
      st.setCameraPose(pl.camera.pose());
      m.MOVING_PHOTO.screen.draw(window.__mp3Canvas.getContext("2d"));
      (await import("/src/packs/photo-sharp.js")).sharpDrive({});
      const layer = st.app.scene.layers.getLayerByName("World");
      const meshes = layer.meshInstances.filter((mi) => mi.node.name === "psv-relief");
      const surface = meshes.find((mi) => mi.material.parameters.uLayer?.data[2] === 0);
      if (!surface) throw new Error("No actual Sharp surface to measure");
      let nativePixels = null;
      const readNative = (gpu) => {
        // Video color conversion can differ by one level between Chromium's
        // GPU and CPU canvas paths. Independently read both real paths; never
        // tolerate pixel differences or use the displayed canvas as support.
        const native = gpu
          ? document.createElement("canvas")
          : (window.__mp3Native ||= document.createElement("canvas"));
        native.width = c.video.videoWidth;
        native.height = c.video.videoHeight;
        const g = native.getContext("2d", { willReadFrequently: !gpu });
        g.drawImage(c.video, 0, 0);
        return {
          width: native.width,
          height: native.height,
          data: g.getImageData(0, 0, native.width, native.height).data,
          rasterPath: gpu ? "default canvas" : "read-frequent canvas",
        };
      };
      const samePixels = (a, b) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
      };
      if (c.video?.readyState >= 2) {
        const color = surface.material.parameters.uColor.data.getSource();
        nativePixels = readNative(false);
        if (
          !color?.getContext ||
          color.width !== nativePixels.width ||
          color.height !== nativePixels.height
        )
          throw new Error("Displayed color is not the exact native video canvas");
        const shown = color.getContext("2d").getImageData(0, 0, color.width, color.height).data;
        if (!samePixels(shown, nativePixels.data)) {
          nativePixels = readNative(true);
          if (!samePixels(shown, nativePixels.data))
            throw new Error("Displayed native picture is stale after seeking");
        }
      }
      const pose = () =>
        JSON.stringify([
          [...st.cameraEntity.getWorldTransform().data],
          [...st.cameraEntity.camera.projectionMatrix.data],
          [...surface.node.getWorldTransform().data],
          ...["uGrid", "uLift", "uTf", "uBodyQ", "uBodyT"].map((key) => [
            ...surface.material.parameters[key].data,
          ]),
        ]);
      if (!frame) meshes.find((mi) => mi.material.parameters.uLayer?.data[2] === 2).visible = false;
      const plain = await st.captureFrame();
      if (!measure)
        return {
          time: t,
          sourceTime: c.video?.currentTime ?? t,
          canvas: [plain.width, plain.height],
          dpr: st.pixelRatio(),
          picture: plain.toDataURL("image/png"),
        };
      const plainPose = pose();
      const p = plain.getContext("2d").getImageData(0, 0, plain.width, plain.height).data;
      const pc = await import("/src/pc.js");
      if (!window.__mp3Ref || window.__mp3Ref.surface !== surface) {
        if (window.__mp3Ref) {
          layer.removeMeshInstances([window.__mp3Ref.mi]);
          window.__mp3Ref.mat.destroy();
        }
        const desc = surface.material.shaderDesc;
        const mat = new pc.ShaderMaterial({
          ...desc,
        });
        mat.cull = pc.CULLFACE_NONE;
        mat.depthTest = true;
        mat.depthWrite = true;
        mat.update();
        const mi = new pc.MeshInstance(surface.mesh, mat, surface.node);
        mi.cull = false;
        mi.visible = false;
        layer.addMeshInstances([mi]);
        window.__mp3Ref = { surface, mat, mi };
      }
      const ref = window.__mp3Ref;
      for (const [name, param] of Object.entries(surface.material.parameters))
        ref.mat.setParameter(name, param.data);
      // Use the same compiled vertex/fragment program. Removing discard from
      // the shader lets the compiler change vertex precision at the outline,
      // which can create a false one-pixel hole in the comparison mask.
      const uncut = [...surface.material.parameters.uLayer.data];
      uncut[1] = 1e6;
      ref.mat.setParameter("uLayer", uncut);
      const visible = meshes.map((mi) => mi.visible);
      meshes.forEach((mi) => (mi.visible = false));
      ref.mi.visible = true;
      const reference = await st.captureFrame();
      if (plainPose !== pose())
        throw new Error("The camera or relief moved between comparison renders");
      const r = reference
        .getContext("2d")
        .getImageData(0, 0, reference.width, reference.height).data;
      ref.mi.visible = false;
      meshes.forEach((mi, i) => (mi.visible = visible[i]));
      const pixelOracle = (0, eval)(`(${oracle})`);
      const screenMetric =
        !sourceWitness || screenDiagnostics
          ? pixelOracle(
              p,
              r,
              plain.width,
              plain.height,
              Math.round(12 * st.pixelRatio()),
              null,
              true,
            )
          : null;
      let metric = screenMetric;
      let unwitnessed = 0;
      const speckDetails = [];
      if (sourceWitness) {
        // Resolve picture roles on every frame. An opaque frame can move a
        // preliminary silhouette's rim, so candidate-driven role discovery
        // could miss a speck eight pixels inside the actual source edge.
        let pictureMask, searchMetric;
        // Inspect raw pixels at physical source ownership, never the painted
        // UV of an old backing that borrowed a bright neighbor. Encode the
        // exact native pixel index in RGB24, with opaque alpha; no UV rounding
        // or canvas premultiplication can change the source coordinate.
        let sourceData, sw, sh;
        if (nativePixels) {
          sw = nativePixels.width;
          sh = nativePixels.height;
          sourceData = nativePixels.data;
        } else {
          sw = c.w;
          sh = c.h;
          sourceData = c.colors[m.MOVING.frame];
        }
        if (!sourceData || sw * sh >= 16777215)
          throw new Error("No exact displayed source pixels for the source witness");
        const cache = (window.__mp3Proof ||= new Map());
        const originals = meshes.map((mi) => mi.material);
        for (const mi of meshes) {
          const original = mi.material;
          let proof = cache.get(original);
          if (!proof) {
            const desc = original.shaderDesc;
            const owned = !!desc.attributes?.aClipCell;
            const ownerGL = owned
              ? `
  if (abs(aPosition.z) > 0.5 && abs(aPosition.z) < 4.5) {
    if (abs(aPosition.z) < 2.5) vSourceUv.x = (float(cell.x) + 0.5) / float(size.x);
    else vSourceUv.y = (float(cell.y) + 0.5) / float(size.y);
  }`
              : "";
            const ownerWG = owned
              ? `
  if (abs(input.aPosition.z) > 0.5 && abs(input.aPosition.z) < 4.5) {
    if (abs(input.aPosition.z) < 2.5) { output.vSourceUv.x = (f32(cell.x) + 0.5) / f32(size.x); }
    else { output.vSourceUv.y = (f32(cell.y) + 0.5) / f32(size.y); }
  }`
              : "";
            proof = new pc.ShaderMaterial({
              ...desc,
              uniqueName: `${desc.uniqueName}NativeWitness`,
              vertexGLSL: desc.vertexGLSL
                .replace("varying vec2 vUv;", "varying vec2 vUv;\nvarying vec2 vSourceUv;")
                .replace("vUv = vec2(0.0);", "vSourceUv = vec2(0.0); vUv = vec2(0.0);")
                .replace("vUv = cuv;", "vSourceUv = uv; vUv = cuv;")
                .replace("vUv = uv;", `vSourceUv = uv; ${ownerGL}\n  vUv = uv;`),
              vertexWGSL: desc.vertexWGSL
                .replace("varying vUv: vec2f;", "varying vUv: vec2f;\nvarying vSourceUv: vec2f;")
                .replace(
                  "output.vUv = vec2f(0.0);",
                  "output.vSourceUv = vec2f(0.0); output.vUv = vec2f(0.0);",
                )
                .replace("output.vUv = cuv;", "output.vSourceUv = uv; output.vUv = cuv;")
                .replace(
                  "output.vUv = uv;",
                  `output.vSourceUv = uv; ${ownerWG}\n  output.vUv = uv;`,
                ),
              fragmentGLSL: desc.fragmentGLSL
                .replace(
                  "varying vec2 vUv;",
                  "varying vec2 vUv;\nvarying vec2 vSourceUv;\nuniform vec2 uSourceSize;\nuniform float uSourceProof;\nuniform float uSourceRole;",
                )
                .replace(
                  /gl_FragColor = [^\n]+;/,
                  `$&
  if (uSourceProof > 0.5) {
    vec2 pixel = clamp(floor(vSourceUv * uSourceSize), vec2(0.0), uSourceSize - 1.0);
    float id = pixel.y * uSourceSize.x + pixel.x;
    if (uSourceRole > 1.5) id = 16777215.0;
    gl_FragColor = vec4(floor(id / 65536.0), mod(floor(id / 256.0), 256.0), mod(id, 256.0), 255.0) / 255.0;
  }`,
                ),
              fragmentWGSL: desc.fragmentWGSL
                .replace(
                  "varying vUv: vec2f;",
                  "varying vUv: vec2f;\nvarying vSourceUv: vec2f;\nuniform uSourceSize: vec2f;\nuniform uSourceProof: f32;\nuniform uSourceRole: f32;",
                )
                .replace(
                  "return output;",
                  `if (uniform.uSourceProof > 0.5) {
    let pixel = clamp(floor(input.vSourceUv * uniform.uSourceSize), vec2f(0.0), uniform.uSourceSize - 1.0);
    var id = pixel.y * uniform.uSourceSize.x + pixel.x;
    if (uniform.uSourceRole > 1.5) { id = 16777215.0; }
    output.color = vec4f(floor(id / 65536.0), floor(id / 256.0) % 256.0, id % 256.0, 255.0) / 255.0;
  }
  return output;`,
                ),
            });
            proof.cull = original.cull;
            proof.depthTest = original.depthTest;
            proof.depthWrite = original.depthWrite;
            proof.update();
            cache.set(original, proof);
          }
          for (const [key, param] of Object.entries(original.parameters))
            proof.setParameter(key, param.data);
          proof.setParameter("uSourceSize", [sw, sh]);
          proof.setParameter("uSourceProof", 1);
          proof.setParameter("uSourceRole", original.parameters.uLayer.data[2]);
          mi.material = proof;
        }
        let proofData;
        try {
          const proofFrame = await st.captureFrame();
          proofData = proofFrame
            .getContext("2d")
            .getImageData(0, 0, proofFrame.width, proofFrame.height).data;
        } finally {
          meshes.forEach((mi, i) => {
            mi.material = originals[i];
          });
        }
        if (plainPose !== pose()) throw new Error("Source witness changed the relief's pose");
        if (nativePixels) {
          if (
            !samePixels(readNative(false).data, nativePixels.data) &&
            !samePixels(readNative(true).data, nativePixels.data)
          )
            throw new Error("Native source changed between picture and source-witness captures");
        }
        pictureMask = new Uint8Array(p.length / 4);
        for (let pixel = 0; pixel < pictureMask.length; pixel++) {
          const offset = pixel * 4;
          if (p[offset + 3] < 128) pictureMask[pixel] = r[offset + 3] >= 128;
          else if (proofData[offset + 3] < 128) pictureMask[pixel] = 1;
          else {
            const id =
              proofData[offset] * 65536 + proofData[offset + 1] * 256 + proofData[offset + 2];
            pictureMask[pixel] = id !== 16777215;
          }
        }
        searchMetric = pixelOracle(
          p,
          r,
          plain.width,
          plain.height,
          Math.round(12 * st.pixelRatio()),
          {},
          true,
          pictureMask,
        );
        const support = {};
        for (const q of searchMetric.candidates) {
          if (q.alpha < 128) continue;
          const offset = q.pixel * 4;
          if (proofData[offset + 3] < 128) {
            support[q.pixel] = 0;
            unwitnessed++;
            continue;
          }
          const id =
            proofData[offset] * 65536 + proofData[offset + 1] * 256 + proofData[offset + 2];
          if (id === 16777215) {
            support[q.pixel] = 38;
            continue;
          }
          if (id >= sw * sh)
            throw new Error("Source witness pixel index is outside the native frame");
          const x = id % sw,
            y = Math.floor(id / sw);
          let maximum = 0;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const xx = Math.max(0, Math.min(sw - 1, x + dx)),
                yy = Math.max(0, Math.min(sh - 1, y + dy));
              const p = (yy * sw + xx) * 4;
              maximum = Math.max(
                maximum,
                sourceData[p] * 0.2126 + sourceData[p + 1] * 0.7152 + sourceData[p + 2] * 0.0722,
              );
            }
          support[q.pixel] = maximum;
        }
        // Candidate discovery already scanned this exact picture, mask, rim,
        // and neighborhood. Resolve source support once per candidate rather
        // than repeating the complete scan with unchanged input pixels.
        let edgeSpecks = 0;
        for (const q of searchMetric.candidates) {
          const i = q.pixel * 4;
          const luminance = p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722;
          const value = luminance * (p[i + 3] / 255) + 255 * (1 - p[i + 3] / 255);
          if (q.alpha < 128 || value > support[q.pixel] + 60) {
            edgeSpecks++;
            if (debugSpecks) {
              const o = q.pixel * 4;
              const id = proofData[o] * 65536 + proofData[o + 1] * 256 + proofData[o + 2];
              speckDetails.push({
                ...q,
                value,
                sourceMax: support[q.pixel],
                shown: Array.from(p.slice(o, o + 4)),
                reference: Array.from(r.slice(o, o + 4)),
                sourcePixel: [id % sw, Math.floor(id / sw)],
                sourceSize: [sw, sh],
              });
            }
          }
        }
        metric = { ...searchMetric, edgeSpecks };
      }
      delete metric.candidates;
      metric.screenEdgeSpecks = screenMetric?.edgeSpecks ?? null;
      metric.unwitnessedSpecks = unwitnessed;
      if (metric.pixels < 100) throw new Error("Coverage reference did not render a picture");
      const near = c.long ? c.scratch.bytes : c.near[m.MOVING.frame];
      let colors = c.long ? c.scratch.colors : c.colors[m.MOVING.frame];
      if (!colors && c.scratch?.g) colors = c.scratch.g.getImageData(0, 0, c.w, c.h).data;
      if (verifyDepth) {
        const uploaded = surface.material.parameters.uDepth.data._levels[0];
        if (!samePixels(uploaded, near))
          throw new Error("Displayed R8 depth differs from the measured depth field");
      }
      const previous = window.__mp3Previous;
      let jitter = 0,
        flips = 0,
        still = 0;
      if (previous && colors)
        for (let i = 0; i < near.length; i++) {
          let cd = 0;
          for (let k = 0; k < 3; k++) cd += (colors[i * 4 + k] - previous.colors[i * 4 + k]) ** 2;
          if (cd <= 3 * 8 ** 2) {
            const d = Math.abs(near[i] - previous.near[i]) / 255;
            jitter += d;
            flips += d > 0.15;
            still++;
          }
        }
      window.__mp3Previous = { near: near.slice(), colors: colors?.slice() };
      return {
        ...metric,
        time: t,
        frame: m.MOVING.frame,
        sourceTime: c.video?.currentTime ?? t,
        sourcePixelsVerified: !!nativePixels || !c.video,
        sourceRasterPath: nativePixels?.rasterPath || "retained RGBA",
        depthPixelsVerified: verifyDepth,
        ...(debugSpecks ? { speckDetails } : {}),
        jitter,
        flips,
        still,
        canvas: [plain.width, plain.height],
        dpr: st.pixelRatio(),
        ...(evidence || pictureOnly ? { picture: plain.toDataURL("image/png") } : {}),
        ...(evidence ? { reference: reference.toDataURL("image/png") } : {}),
      };
    },
    {
      time,
      yaw,
      evidence,
      pictureOnly,
      frame,
      measure,
      sourceWitness,
      screenDiagnostics,
      debugSpecks,
      verifyDepth,
      oracle: pictureMetrics.toString(),
    },
  );
}

// A decoder/compositor can still change a paused picture during a long software
// capture. Repeat only a rejected source snapshot, never a quality result. Each
// accepted attempt must pass the same exact whole-frame native correspondence.
async function verifiedFrame(page, time, options, deadline) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (Date.now() >= deadline) return null;
    try {
      return {
        ...(await renderFrame(page, time, { ...options, verifyDepth: attempt > 0 })),
        nativeCaptureRetries: attempt,
      };
    } catch (error) {
      if (
        !/Native source changed between picture and source-witness captures|Displayed native picture is stale after seeking/.test(
          error.message,
        )
      )
        throw error;
      console.log(
        JSON.stringify({
          rejectedNativeCapture: true,
          time,
          attempt: attempt + 1,
          message: error.message,
        }),
      );
      if (attempt === 2) throw error;
      // A repeated long screen draw can rebuild color-guided depth at the same
      // clock. Reset the real Sharp cache too, so its R8/patch upload cannot
      // retain geometry from the rejected native snapshot.
      await page.evaluate(async () => {
        const m = window.__mp3;
        const sharp = await import("/src/packs/photo-sharp.js");
        const shape = {
          width: 2,
          height: (2 * m.MOVING.grid.rows) / m.MOVING.grid.cols,
          full: m.MOVING.full,
        };
        // Reinitialize the normal source identity without an intermediate
        // render. Its decoder remains the same; the next sync must repaint
        // the paused native snapshot as well as upload current depth.
        sharp.sharpClip({ ...m.MOVING, clip: { ...m.MOVING.clip } }, shape);
        sharp.sharpClip(m.MOVING, shape);
      });
    }
  }
}

export async function renderGoal(option, reconstructedSources) {
  const dir = option("dir", ".cache/cdx-mp3");
  await fs.mkdir(dir, { recursive: true });
  const sources = option("sources", "")
    ? JSON.parse(await fs.readFile(option("sources"), "utf8"))
    : await reconstructedSources(".cache/cdx-mp2/sources");
  for (const s of LONG_SAMPLES) sources[s.id] = `assets/toys/moving-photo-3d/${s.file}.webm`;
  sources.fast60 = "assets/toys/moving-photo-3d/cdx-mp2-fast-60.webm";
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([id, source]) => [
        id,
        createHash("sha256")
          .update(await fs.readFile(source))
          .digest("hex"),
      ]),
    ),
  );
  const profiles = {
    phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, tier: "low" },
    desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, tier: "mid" },
  };
  const browser = await chromium.launch(GRAPHICS_LAUNCH);
  const results = [],
    errors = [];
  const out = option("out", `${dir}/goal.json`);
  const snapshot = option("snapshot", "");
  const sourceWitness = option("source-witness", "true") !== "false";
  const screenDiagnostics = option("screen-diagnostics", "false") === "true";
  const oracleVersion = "native-role-v4";
  const deadline = Date.parse(option("deadline", "")) || Infinity;
  const codeFiles = [
    "src/packs/moving-photo.js",
    "src/packs/photo-sharp.js",
    "src/packs/song-stream.js",
    "src/live/clip-stabilize.js",
  ];
  const code = snapshot
    ? await Promise.all(codeFiles.map((file) => fs.readFile(`${snapshot}/${file}`, "utf8")))
    : null;
  const snapshotHash = code ? createHash("sha256").update(code.join("\n")).digest("hex") : null;
  if (option("resume", "") === "true") {
    const previous = JSON.parse(await fs.readFile(out, "utf8"));
    if (previous.baseline !== option("baseline", "") || previous.snapshotHash !== snapshotHash)
      throw new Error("Cannot resume measurements from a different code snapshot");
    if (previous.oracleVersion !== oracleVersion)
      throw new Error("Cannot resume measurements from a different picture-mask oracle");
    if ((previous.sourceWitness ?? false) !== sourceWitness)
      throw new Error("Cannot resume measurements with a different source witness rule");
    results.push(
      ...previous.results.filter(
        (r) =>
          r.everyFrame &&
          !r.errors.length &&
          (!previous.sourceHashes || previous.sourceHashes[r.id] === sourceHashes[r.id]),
      ),
    );
  }
  try {
    for (const [profile, config] of Object.entries(profiles)) {
      if (option("profiles", "") && !option("profiles").split(",").includes(profile)) continue;
      for (const [id, source] of Object.entries(sources)) {
        if (option("ids", "") && !option("ids").split(",").includes(id)) continue;
        for (const upload of id === "fast60" ? [true] : [false, true]) {
          // Pause between complete cases so timing suites can run alone.
          const stopFile = option("stop-file", "");
          if (Date.now() >= deadline || (stopFile && (await fs.stat(stopFile).catch(() => null))))
            return;
          if (results.some((r) => r.profile === profile && r.id === id && r.upload === upload))
            continue;
          if (
            option("paths", "") &&
            !option("paths")
              .split(",")
              .includes(upload ? "upload" : "sample")
          )
            continue;
          const page = await browser.newPage(config);
          page.setDefaultTimeout(600_000);
          const caseErrors = [];
          page.on("pageerror", (e) => caseErrors.push(e.message));
          page.on("console", (m) => {
            if (
              m.type() === "error" ||
              (m.type() === "warning" && /shader|invalid|parsing|validation/i.test(m.text()))
            )
              caseErrors.push(m.text());
          });
          const baseline = option("baseline", "");
          if (code)
            for (let i = 0; i < codeFiles.length; i++)
              await page.route(`**/${codeFiles[i]}`, (route) =>
                route.fulfill({ contentType: "text/javascript", body: code[i] }),
              );
          if (baseline)
            for (const file of [
              "src/packs/moving-photo.js",
              "src/packs/photo-sharp.js",
              "src/packs/song-stream.js",
              "src/live/clip-stabilize.js",
            ])
              await page.route(`**/${file}`, (route) =>
                route.fulfill({
                  contentType: "text/javascript",
                  body: execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }),
                }),
              );
          const start = Date.now();
          let openingDeadline = false;
          const openingTimer = Number.isFinite(deadline)
            ? setTimeout(
                () => {
                  openingDeadline = true;
                  page.close().catch(() => {});
                },
                Math.max(1, deadline - Date.now()),
              )
            : null;
          try {
            const opening = await openRender(page, {
              id,
              source,
              upload,
              tier: config.tier,
              stepped: true,
            });
            clearTimeout(openingTimer);
            const info = await page.evaluate(() => {
              const c = window.__mp3.MOVING.clip;
              return {
                w: c.w,
                h: c.h,
                n: c.n,
                duration: c.duration,
                delays: c.video ? null : c.delays,
                graphics: (() => {
                  const gl = window.__splashery.player.stage.device.gl;
                  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
                  return ext
                    ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                    : window.__splashery.player.stage.deviceType;
                })(),
                refinement: c.refinement
                  ? {
                      done: c.refinement.done,
                      error: c.refinement.error,
                      measured: c.refinement.measured,
                    }
                  : c.job
                    ? { done: c.job.done, measured: c.depth.done }
                    : null,
              };
            });
            const stream = JSON.parse(
              execFileSync(
                "ffprobe",
                [
                  "-v",
                  "error",
                  "-select_streams",
                  "v:0",
                  "-show_entries",
                  "stream=avg_frame_rate,r_frame_rate",
                  "-of",
                  "json",
                  source,
                ],
                { encoding: "utf8" },
              ),
            ).streams[0];
            const [numerator, denominator] = (
              stream.avg_frame_rate === "0/0" ? stream.r_frame_rate : stream.avg_frame_rate
            )
              .split("/")
              .map(Number);
            const nativeFps = numerator / denominator;
            const fps =
              upload || id === "sample" || id === "horse" || id.endsWith("-long") ? nativeFps : 16;
            const decoded = JSON.parse(
              execFileSync(
                "ffprobe",
                [
                  "-v",
                  "error",
                  "-select_streams",
                  "v:0",
                  "-show_frames",
                  "-show_entries",
                  "frame=best_effort_timestamp_time,pkt_duration_time,duration_time",
                  "-of",
                  "json",
                  source,
                ],
                { encoding: "utf8" },
              ),
            ).frames;
            let times;
            if (info.delays) {
              let clock = 0;
              times = info.delays.map((delay) => {
                const at = clock + delay / 4000;
                clock += delay / 1000;
                return at;
              });
            } else {
              times = decoded
                .map((f, i) => {
                  const at = Number(f.best_effort_timestamp_time);
                  const dt =
                    Number(f.duration_time || f.pkt_duration_time) ||
                    Number(decoded[i + 1]?.best_effort_timestamp_time) - at ||
                    1 / nativeFps;
                  return { at, time: at + dt / 4 };
                })
                .map((f) => {
                  if (f.at < 0 || f.at > info.duration + 0.005)
                    throw new Error(
                      `Decoded source frame at ${f.at}s is outside the opened clip's ${info.duration}s`,
                    );
                  return Math.min(info.duration, f.time);
                });
            }
            if (!times.length || new Set(times).size !== times.length)
              throw new Error("Source frame timestamps are missing or duplicated");
            const total = times.length;
            const limit = Math.min(total, Number(option("limit", total)));
            const frames = [];
            const review =
              option("review", "") &&
              profile === "phone" &&
              id !== "fast60" &&
              (!upload || ["bridge", "machine"].includes(id))
                ? `${option("review")}/${id}-${upload ? "upload" : "sample"}`
                : null;
            if (review) await fs.mkdir(review, { recursive: true });
            for (let f = 0; f < limit; f++) {
              if (Date.now() >= deadline) break;
              const r = await verifiedFrame(
                page,
                times[f],
                {
                  sourceWitness,
                  screenDiagnostics,
                  pictureOnly: !!review,
                },
                deadline,
              );
              if (!r) break;
              if (review)
                await fs.writeFile(
                  `${review}/${String(f).padStart(5, "0")}.png`,
                  Buffer.from(r.picture.split(",")[1], "base64"),
                );
              const { picture, ...stats } = r;
              frames.push(stats);
              if (f % 120 === 0)
                console.log(
                  JSON.stringify({
                    progress: true,
                    profile,
                    id,
                    upload,
                    frame: f,
                    total: limit,
                    elapsedMs: Date.now() - start,
                    holes: r.holeShare,
                    specks: r.edgeSpecks,
                  }),
                );
            }
            if (!frames.length) return;
            const worstHole = frames.reduce((a, b) => (a.holeShare >= b.holeShare ? a : b));
            const worstSpeck = frames.reduce((a, b) => (a.edgeSpecks >= b.edgeSpecks ? a : b));
            for (const [name, worst] of [
              ["holes", worstHole],
              ["specks", worstSpeck],
            ]) {
              if (Date.now() >= deadline) break;
              const r = await verifiedFrame(
                page,
                worst.time,
                {
                  evidence: true,
                  sourceWitness,
                  screenDiagnostics,
                },
                deadline,
              );
              if (!r) break;
              await fs.writeFile(
                `${dir}/${profile}-${id}-${upload ? "upload" : "sample"}-${name}.png`,
                Buffer.from(r.picture.split(",")[1], "base64"),
              );
            }
            const sum = (key) => frames.reduce((n, f) => n + f[key], 0);
            const result = {
              profile,
              id,
              upload,
              source,
              graphicsThreads: process.env.LP_NUM_THREADS || "driver default",
              ...info,
              ...opening,
              nativeFps,
              measuredFps: fps,
              decodedSourceFrames: decoded.length,
              framesMeasured: frames.length,
              framesTotal: total,
              everyFrame: frames.length === total,
              stoppedAtDeadline: frames.length < limit && Date.now() >= deadline,
              nativeCaptureRetries: frames.reduce(
                (sum, f) => sum + (f.nativeCaptureRetries || 0),
                0,
              ),
              heightJitter: sum("jitter") / Math.max(1, sum("still")),
              edgeFlipsPer1000: (1000 * sum("flips")) / Math.max(1, sum("still")),
              worstHoleShare: worstHole.holeShare,
              worstHoleTime: worstHole.time,
              maxEdgeSpecks: worstSpeck.edgeSpecks,
              maxScreenEdgeSpecks: frames.some((f) => f.screenEdgeSpecks !== null)
                ? Math.max(...frames.map((f) => f.screenEdgeSpecks))
                : null,
              maxUnwitnessedSpecks: Math.max(...frames.map((f) => f.unwitnessedSpecks)),
              worstSpeckTime: worstSpeck.time,
              elapsedMs: Date.now() - start,
              errors: caseErrors,
              frames,
            };
            results.push(result);
            console.log(JSON.stringify({ ...result, frames: undefined }));
          } catch (e) {
            errors.push({
              profile,
              id,
              upload,
              message: e.message,
              stoppedAtDeadline: openingDeadline,
            });
            console.log(JSON.stringify(errors.at(-1)));
          } finally {
            clearTimeout(openingTimer);
            await page.close();
          }
          await fs.writeFile(
            out,
            JSON.stringify(
              {
                protocol:
                  "full projected picture; source-excluding 5x5 bright outliers in a 12 CSS-pixel rim; real shaders; fixed yaw 0.18, pitch 0.08; stepped native source times",
                baseline: option("baseline", ""),
                snapshot,
                snapshotHash,
                sourceWitness,
                screenDiagnostics,
                steppedDrive: true,
                oracleVersion,
                sourceHashes,
                sourceKind: option("sources", "")
                  ? "specified source cuts"
                  : "original Bunny and horse; three short uploads reconstructed from JPEG sheets; native long films; procedural fast60",
                results,
                errors,
              },
              null,
              2,
            ) + "\n",
          );
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (errors.length) process.exitCode = 1;
}
