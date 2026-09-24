// Embed player page (embed/index.html): reads the scene from #s=..., takes
// ?theme=light|dark, ?bg=transparent, ?autoplay=<idle effect>, ?zoom=0.5-2
// and ?controls=0 (no zoom buttons) overrides.

import { Viewer, NoGPUError } from "./viewer.js";
import { parseHash } from "./codec.js";

const canvas = document.getElementById("stage");
const status = document.getElementById("embed-status");
const openLink = document.getElementById("open-link");
const params = new URLSearchParams(location.search);
const { s, theme: hashTheme } = parseHash(location.hash);

function say(text) {
  status.hidden = !text;
  status.textContent = text || "";
  if (text) setTimeout(() => (status.hidden = true), 6000);
}

function setPageTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

const background = params.get("bg") || params.get("background") || null;
// A transparent iframe stays see-through only when its colour scheme matches
// the iframe element's on the host page; otherwise the browser paints an
// opaque backdrop behind it. Both sides say "light": the snippet sets it on
// the iframe, and here the meta tag changes too (with "light dark" there, a
// dark-mode visitor would get a dark scheme). "normal" is not enough on the
// host side: on a page whose own meta tag allows dark, it resolves to dark.
if (background === "transparent") {
  const root = document.documentElement;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", "light");
  root.style.colorScheme = "light";
  root.style.background = "transparent";
  document.body.style.background = "transparent";
}

const viewer = new Viewer(canvas, {
  scene: s,
  toy: params.get("toy"),
  theme: params.get("theme") || hashTheme,
  background,
  autoplay: params.get("autoplay"),
  turntable: params.get("turntable") === "off" ? false : undefined,
  zoom: params.get("zoom"),
  onStatus: say,
  onTheme: setPageTheme,
});

// A host page can pass its theme in: postMessage({ type: "splashery:theme", theme }).
addEventListener("message", (e) => {
  if (e.data && e.data.type === "splashery:theme") viewer.setTheme(e.data.theme);
});

const zoomButtons = document.getElementById("zoom-buttons");
zoomButtons.hidden = params.get("controls") === "0";
for (const b of zoomButtons.querySelectorAll("button")) {
  b.addEventListener("click", () => viewer.zoomBy(Number(b.dataset.zoom)));
}

try {
  await viewer.start();
  openLink.href = viewer.openURL();
} catch (err) {
  console.info("Splashery embed could not start:", err?.message || err);
  if (!(err instanceof NoGPUError)) {
    document.getElementById("fallback-reason").textContent += ` (${err?.message || err})`;
  }
  document.getElementById("fallback").hidden = false;
  canvas.hidden = true;
  zoomButtons.hidden = true;
}
document.body.dataset.ready = "true";

window.__splashery = {
  viewer,
  get player() {
    return viewer.player;
  },
  get ready() {
    return document.body.dataset.ready === "true";
  },
  scene: () => viewer.player.scene,
};
