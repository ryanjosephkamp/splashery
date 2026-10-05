// Offline helper (lane Site): on the first visit the page and its live toy load
// before the service worker is in charge, so the worker never saw those files.
// This hands it their addresses (from the browser's own list of what loaded),
// in this window and in any same-origin frame, a few times while a toy loads.

function loadedURLs(win) {
  const out = [];
  try {
    for (const e of win.performance.getEntriesByType("resource")) out.push(e.name);
    for (const e of win.performance.getEntriesByType("navigation")) out.push(e.name);
    for (let i = 0; i < win.frames.length; i++) out.push(...loadedURLs(win.frames[i]));
  } catch {
    // a frame from another site
  }
  return out;
}

export function keepLoaded(worker) {
  if (!worker) return;
  const sent = new Set();
  const send = () => {
    const urls = loadedURLs(window).filter(
      (u) => u.startsWith(location.origin) && !u.includes("/sw.js") && !sent.has(u),
    );
    if (!urls.length) return;
    urls.forEach((u) => sent.add(u));
    worker.postMessage({ type: "splashery:keep", urls });
  };
  send();
  // A splat file can take a while: look again as the toy loads.
  for (const ms of [2000, 6000, 15000, 30000]) setTimeout(send, ms);
  addEventListener("load", send);
}
