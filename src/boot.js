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
    // A shared scan's helpers can transfer and compile before GPU setup.
    // A failed or malformed link keeps the app's existing fallback behavior.
    import("./opening-pack.js").then(({ warmOpeningPack }) => warmOpeningPack()).catch(() => {});
    if (
      typeof DecompressionStream === "function" &&
      HTMLScriptElement.supports?.("importmap") &&
      canAddImportMaps() &&
      location.origin !== "null" &&
      !new URLSearchParams(location.search).has("raw-engine")
    ) {
      try {
        const response = await fetch(`${engine.href}.gz`);
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
    await ready;
    await import(entry.href);
  }
  start().catch((error) =>
    setTimeout(() => {
      throw error;
    }),
  );
})();
