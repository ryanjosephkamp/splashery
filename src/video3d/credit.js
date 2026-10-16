// Keep the selected capture's license beside the viewer, including ShareAlike notices.
export function mountSceneCredit(sample, { walk = false } = {}) {
  const root = document.createElement("p");
  root.id = "v3d-source-credit";
  root.dataset.playground = document.getElementById("shelf") ? "true" : "false";
  root.dataset.walk = String(walk);
  root.style.cssText =
    "position:fixed;bottom:42px;left:18px;z-index:23;margin:0;padding:5px 8px;max-width:260px;border-radius:7px;background:var(--paper,#fff);color:var(--ink,#111);font:11px/1.4 var(--font-body,sans-serif)";
  const style = document.createElement("style");
  style.textContent =
    "#v3d-source-credit[data-playground=false][data-walk=true]{bottom:108px!important}@media(max-width:760px){#v3d-source-credit[data-playground=true]{bottom:calc(var(--dock-h,200px) + 14px)!important;max-width:270px}}";
  const source = document.createElement("a");
  source.href = sample.source;
  source.textContent = sample.author;
  source.title = sample.title;
  const license = document.createElement("a");
  license.href = sample.licenseUrl;
  license.textContent = sample.license;
  for (const link of [source, license]) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  root.append(style, source, " · ", license);
  document.body.append(root);
  let installed = false;
  const timer = setInterval(() => {
    // Standalone embeds publish their player after the first toy has built.
    const player = window.__splashery?.player;
    if (!player) return;
    const info = player?.proc?.ctx?.kit?.data?.video;
    if (info?.uid === sample.id && player.scene?.toy?.id === "video-3d") installed = true;
    else if (installed || player?.scene?.toy?.id !== "video-3d") dispose();
  }, 250);
  const dispose = () => {
    clearInterval(timer);
    root.remove();
  };
  return { dispose };
}
