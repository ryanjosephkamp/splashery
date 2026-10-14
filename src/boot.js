// BEGIN GENERATED OPENING GRAPHS (tools/load-time-opening-graph.mjs)
const OPENING_GRAPHS = {
  app: [
    "manual/pdf-edition.js",
    "src/app.js",
    "src/camera.js",
    "src/chunks.js",
    "src/codec.js",
    "src/effects-pose.js",
    "src/effects.js",
    "src/exports.js",
    "src/font.js",
    "src/generators.js",
    "src/gzip.js",
    "src/kernels.js",
    "src/kit.js",
    "src/live/live.js",
    "src/live/panel.js",
    "src/live/record.js",
    "src/loaders.js",
    "src/media.js",
    "src/motion.js",
    "src/noise.js",
    "src/opening-pack.js",
    "src/packs/dog-plush-fill.js",
    "src/packs/even.js",
    "src/packs/photoreal-r2.js",
    "src/packs/photoreal-r3-bases.js",
    "src/packs/photoreal-r3-rigs.js",
    "src/packs/photoreal-r3.js",
    "src/paint.js",
    "src/patterns.js",
    "src/pc.js",
    "src/photo-splats.js",
    "src/physics/fields.js",
    "src/physics/hands-on.js",
    "src/physics/joints.js",
    "src/physics/materials.js",
    "src/physics/soft.js",
    "src/physics/world.js",
    "src/picture-splats.js",
    "src/pictures.js",
    "src/player.js",
    "src/pose.js",
    "src/rig-fx.js",
    "src/rig.js",
    "src/rigs.js",
    "src/sharpness.js",
    "src/site-toy-pages.js",
    "src/sound-credits.js",
    "src/sound.js",
    "src/stage.js",
    "src/state.js",
    "src/toy-sounds.js",
    "src/toys.js",
    "src/ui.js",
    "src/voices.js",
  ],
  embed: [
    "manual/pdf-edition.js",
    "src/camera.js",
    "src/chunks.js",
    "src/codec.js",
    "src/effects-pose.js",
    "src/effects.js",
    "src/embed.js",
    "src/font.js",
    "src/generators.js",
    "src/gzip.js",
    "src/kernels.js",
    "src/kit.js",
    "src/loaders.js",
    "src/media.js",
    "src/motion.js",
    "src/noise.js",
    "src/opening-pack.js",
    "src/packs/dog-plush-fill.js",
    "src/packs/even.js",
    "src/packs/photoreal-r2.js",
    "src/packs/photoreal-r3-bases.js",
    "src/packs/photoreal-r3-rigs.js",
    "src/packs/photoreal-r3.js",
    "src/paint.js",
    "src/patterns.js",
    "src/pc.js",
    "src/photo-splats.js",
    "src/physics/fields.js",
    "src/physics/hands-on.js",
    "src/physics/joints.js",
    "src/physics/materials.js",
    "src/physics/soft.js",
    "src/physics/world.js",
    "src/picture-splats.js",
    "src/pictures.js",
    "src/player.js",
    "src/pose.js",
    "src/rig-fx.js",
    "src/rig.js",
    "src/rigs.js",
    "src/sharpness.js",
    "src/stage.js",
    "src/state.js",
    "src/toys.js",
    "src/viewer.js",
  ],
};
// END GENERATED OPENING GRAPHS
// Start the page with the exact vendored engine source. The import map is
// installed before the app's module graph starts, preserving all native/live exports.
// A harmless resolution probe detects support for adding import maps after a module starts.
(() => {
  const base = new URL(import.meta.url);
  const script = document.querySelector("script[data-splashery-entry]");
  const entry = new URL(script?.dataset.splasheryEntry || "app.js", base);
  const engine = new URL("../vendor/playcanvas/playcanvas.min.mjs", base);
  const imports = {};
  const ready =
    document.readyState === "loading"
      ? new Promise((resolve) =>
          document.addEventListener("DOMContentLoaded", resolve, { once: true }),
        )
      : Promise.resolve();
  function canAddImportMaps() {
    const name = "splashery-import-map-probe";
    const target = new URL("./boot.js?probe", base).href;
    const probe = document.createElement("script");
    probe.type = "importmap";
    probe.textContent = JSON.stringify({ imports: { [name]: target } });
    document.head.appendChild(probe);
    try {
      return import.meta.resolve(name) === target;
    } catch {
      return false;
    }
  }
  async function start() {
    const compressed =
      typeof DecompressionStream === "function" &&
      HTMLScriptElement.supports?.("importmap") &&
      canAddImportMaps() &&
      location.origin !== "null" &&
      !new URLSearchParams(location.search).has("raw-engine");
    const transfer = compressed ? fetch(`${engine.href}.gz`) : null;
    // Fetch source responses while the engine transfers. Unlike modulepreload,
    // script preloads do not resolve imports before the native engine map exists.
    const graph = entry.pathname.endsWith("/embed.js") ? OPENING_GRAPHS.embed : OPENING_GRAPHS.app;
    const sources = [];
    for (const file of graph) {
      const source = document.createElement("link");
      source.rel = "preload";
      source.as = "script";
      source.crossOrigin = "anonymous";
      source.href = new URL(`../${file}`, base).href;
      document.head.appendChild(source);
      sources.push(source);
    }
    if (transfer) {
      try {
        const response = await transfer;
        if (!response.ok) throw new Error("Compressed engine unavailable");
        let bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
          bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        }
        imports[engine.href] = URL.createObjectURL(new Blob([bytes], { type: "text/javascript" }));
      } catch {
        // An unavailable compressed copy keeps the original vendored URL.
      }
    }
    if (Object.keys(imports).length) {
      const map = document.createElement("script");
      map.type = "importmap";
      map.textContent = JSON.stringify({ imports });
      document.head.appendChild(map);
    }
    // Claim every warmed response as a module once its engine imports can resolve.
    // Deep dependencies otherwise wait for recursive discovery and can trigger
    // Chromium's unused script-preload warning on a slow opening.
    for (const source of sources) {
      source.removeAttribute("as");
      source.rel = "modulepreload";
    }
    // Preserve the original engine preload: fetch and compile the mapped
    // module while the app's remaining dependency graph is still loading.
    const preload = document.createElement("link");
    preload.rel = "modulepreload";
    preload.href = imports[engine.href] || engine.href;
    document.head.appendChild(preload);
    // Warm the selected scan independently of the app's larger module graph.
    // Both entry modules await its shared promise before GPU initialization.
    import("./opening-pack.js").catch(() => {});
    await ready;
    await import(entry.href);
  }
  start().catch((error) =>
    setTimeout(() => {
      throw error;
    }),
  );
})();
