// Diagnose actual draw cost and prepared-cell density without screenshot readbacks.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3 } from "./cdx-p3d2-r3-common.mjs";
const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const browser = await chromium.launch(config.use.launchOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  await openR3(page, opt("url", "http://127.0.0.1:4175/"), screens.phone);
  await selectR3(
    page,
    inputs().find((s) => s.id === opt("sample", "street")),
    1,
    "sharp",
  );
  const data = await page.evaluate(async () => {
    const pl = window.__splashery.player,
      stage = pl.stage,
      gl = stage.device.gl;
    const all = stage.app.scene.layers
      .getLayerByName("World")
      .meshInstances.filter((mi) => mi.material.getParameter("uDepth"));
    const geometry = all.map((mi) => {
      const mesh = mi.mesh,
        meta = [];
      if (mesh.vertexBuffer.format.elements.some((e) => e.name === "TEXCOORD0"))
        mesh.getVertexStream("TEXCOORD0", meta);
      let cuts = 0,
        uncertain = 0;
      for (let i = 0; i < meta.length; i += 4) {
        const mask = Math.round(meta[i + 2]);
        if (mask & 255) cuts++;
        if (mask & 256) uncertain++;
      }
      return {
        layer: mi.material.getParameter("uLayer").data[2],
        vertices: mesh.vertexBuffer.numVertices,
        triangles: mesh.primitive[0].count / 3,
        metaVertices: meta.length / 4,
        cutVertices: cuts,
        uncertainVertices: uncertain,
      };
    });
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const queries = [],
      original = {};
    let measured = false;
    if (ext)
      for (const name of [
        "drawElements",
        "drawArrays",
        "drawElementsInstanced",
        "drawArraysInstanced",
      ]) {
        original[name] = gl[name];
        gl[name] = function (...args) {
          if (!measured) return original[name].apply(gl, args);
          const query = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
          const result = original[name].apply(gl, args);
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          queries.push({
            query,
            name,
            count: args[1],
            shader: stage.device.shader?.name || stage.device.shader?.definition?.name,
          });
          return result;
        };
      }
    try {
      for (let i = 0; i < 40; i++) {
        measured = i >= 20;
        pl.camera.cur = {
          ...pl.camera.home,
          yaw: 0.52 * Math.sin(i / 10),
          pitch: 0.35 * Math.cos(i / 13),
        };
        pl.camera.tgt = { ...pl.camera.cur };
        stage.setCameraPose(pl.camera.pose());
        pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
        stage.aliveUntil = 0;
        await new Promise((resolve) => {
          stage.app.once("postrender", resolve);
          stage.app.renderNextFrame = true;
        });
        stage.aliveUntil = 0;
        stage.app.renderNextFrame = false;
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        await new Promise((resolve, reject) => {
          const check = () => {
            const state = gl.clientWaitSync(fence, 0, 0);
            if (state === gl.WAIT_FAILED) reject(new Error("Fence failed."));
            else if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) resolve();
            else setTimeout(check, 0);
          };
          check();
        });
        gl.deleteSync(fence);
      }
      measured = false;
      const disjoint = ext ? gl.getParameter(ext.GPU_DISJOINT_EXT) : null;
      const draws = queries.map(({ query, ...entry }) => {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        const ns = available && !disjoint ? gl.getQueryParameter(query, gl.QUERY_RESULT) : null;
        gl.deleteQuery(query);
        return { ...entry, ms: ns === null ? null : ns / 1e6 };
      });
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        geometry,
        timerQuery: !!ext,
        disjoint,
        draws,
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        sharp: window.__psv.state(),
      };
    } finally {
      for (const [name, fn] of Object.entries(original)) gl[name] = fn;
    }
  });
  fs.writeFileSync(
    opt("out", ".cache/cdx-p3d2/r3/profile.json"),
    JSON.stringify(
      { browser: browser.version(), url: opt("url", "http://127.0.0.1:4175/"), ...data },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(data));
} finally {
  await browser.close();
}
