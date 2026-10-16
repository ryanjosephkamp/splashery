// MIT. Explicit research overlays of the existing atlas driver. The returned
// camera is inverted through the app's actual recipe fit, not fitted to pixels.
import fs from "node:fs";
import { softBoundaryShader } from "./p3d-next-shader.mjs";
export async function measureNext(entry, profile, options) {
  const original = new URL("./p3df/browser.mjs", import.meta.url);
  let source = fs.readFileSync(original, "utf8");
  const replace = (before, after) => {
    if (!source.includes(before))
      throw new Error("Atlas adapter no longer matches: " + before.slice(0, 60));
    source = source.replace(before, after);
  };
  const worker = fs
    .readFileSync(new URL("../src/photo3d/build-worker.js", import.meta.url), "utf8")
    .replace("self.onmessage = (", "self.onmessage = async (")
    .replace(
      "    const f =",
      `    s.background = patchMatchBackground(cached?.photo || photo, s, ${JSON.stringify(options.patch || {})});\n    const f =`,
    );
  let candidateWorker = 'import { patchMatchBackground } from "./next/patchmatch.js";\n' + worker;
  if (options.clean) {
    const start = candidateWorker.indexOf("    try {\n      if (options.bitmap"),
      end = candidateWorker.indexOf("    const buffers = new Set();");
    if (start < 0 || end < start) throw new Error("Bitmap adapter no longer matches");
    candidateWorker =
      'import { cleanForeground } from "./next/clean-color.js";\n' +
      candidateWorker.slice(0, start) +
      `    const displayPhoto=cleanForeground(cached?.photo || photo,s,${options.band || 3});\n` +
      candidateWorker.slice(start, end).replaceAll("photo.", "displayPhoto.") +
      candidateWorker.slice(end);
  }
  const shader = softBoundaryShader(
    fs.readFileSync(new URL("../src/live/relief-mesh.js", import.meta.url), "utf8"),
    options.band || 3,
  );
  replace(
    "    if (entry.truth)",
    `    const overlayHits = [];
    await page.addInitScript(() => {
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) { super(...args); this.addEventListener("message",({data})=>{if(data.result?.background?.patchmatch)window.__nextFillStats=data.result.background.patchmatch;}); }
      };
    });
    if (${JSON.stringify(options.candidate || "classic")} !== "classic") {
      await context.route("**/src/photo3d/build-worker.js", r => {overlayHits.push("worker");return r.fulfill({body:${JSON.stringify(candidateWorker)},contentType:"text/javascript"});});
      await context.route("**/src/live/relief-mesh.js", r => {overlayHits.push("shader");return r.fulfill({body:${JSON.stringify(shader)},contentType:"text/javascript"});});
    }
    if (entry.truth)`,
  );
  replace("return route.continue();", "return route.fallback();");
  replace(
    "const thin = thinAnchorsR4(source, field),",
    "const thin = diagnostics ? thinAnchorsR4(source, field) : {anchors:[]},",
  );
  replace(
    "allEdges = sourceAnchorsR3(source, field),",
    "allEdges = diagnostics ? sourceAnchorsR3(source, field) : {candidates:0,anchors:[]},",
  );
  replace("quads = revealQuads(field);", "quads = diagnostics ? revealQuads(field) : [];");
  if (options.frozen) {
    const frozen = JSON.stringify(options.frozen);
    replace(
      "const thin = diagnostics ? thinAnchorsR4(source, field) : {anchors:[]},",
      `const frozenProbe=${frozen};
    if(field.width!==frozenProbe.field.width||field.height!==frozenProbe.field.height||field.data.some((v,i)=>v!==frozenProbe.field.data[i]))throw new Error("Frozen source-probe depth field differs");
    const thin=frozenProbe.thin,`,
    );
    replace(
      "allEdges = diagnostics ? sourceAnchorsR3(source, field) : {candidates:0,anchors:[]},",
      "allEdges = {candidates:frozenProbe.edgeCandidates,anchors:{length:frozenProbe.edgeSupported}},",
    );
    replace(
      "edges = allEdges.anchors.filter((_, i) => i % step === 0),",
      "edges = frozenProbe.edges,",
    );
    source = source.replace(
      '"./scoring.mjs"',
      JSON.stringify(new URL("./cdx-p3d5-fast-metrics.mjs", import.meta.url).href),
    );
  }
  replace(
    "  let timer = null;",
    "  let timer = null; const watchdog = setTimeout(()=>browser.close(), 600000);",
  );
  replace(
    "    if (timer) clearInterval(timer);",
    "    clearTimeout(watchdog); if (timer) clearInterval(timer);",
  );
  replace(
    "    const rows = [];",
    `    const rows = []; const targetCameras = [];
    const fillStats = await page.evaluate(()=>window.__nextFillStats || null);
    if (${JSON.stringify(options.candidate || "classic")} !== "classic" && (!overlayHits.includes("worker") || !overlayHits.includes("shader") || !fillStats)) throw new Error("Candidate overlay did not execute");`,
  );
  replace(
    "      const file = `${prefix}-${yaw}-${pitch}.png`;",
    `      targetCameras.push(await page.evaluate(({yaw,pitch}) => {
        const pl = window.__splashery.player, pose = pl.camera.pose(), eye = pl.toRecipe(pose.position);
        const vector = v => { const p = pl.toRecipe(pose.position.map((x,i)=>x+v[i])).map((x,i)=>x-eye[i]); const n=Math.hypot(...p);return p.map(x=>x/n); };
        return {yaw,pitch,eye,right:vector(pose.right),up:vector(pose.up),forward:vector(pose.forward),fov:pl.stage.cameraEntity.camera.fov,width:pl.stage.canvas.width,height:pl.stage.canvas.height};
      },{yaw,pitch}));
      const file = \x60\x24{prefix}-\x24{yaw}-\x24{pitch}.png\x60;`,
  );
  replace(
    "      ...state,\n      timing,",
    "      ...state,\n      targetCameras,\n      overlayProof: {hits:overlayHits,fillStats},\n      timing,",
  );
  source = source.replace(
    /from "([^"]+)"/g,
    (_, name) =>
      `from ${JSON.stringify(name.startsWith(".") ? new URL(name, original).href : import.meta.resolve(name))}`,
  );
  const implementation = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  return implementation.measureProfile(entry, profile, options);
}
