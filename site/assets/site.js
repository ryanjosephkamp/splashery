// The preview site's shared script (lane Site): the phone menu, the color
// theme, the live toy's theme, and the service worker for site/ only.

import { keepLoaded } from "./offline.js";

const root = document.documentElement;
const THEME_KEY = "splashery.site.theme";

// ---- The menu on a phone ---------------------------------------------------------------
const menuButton = document.querySelector(".menu-button");
const menu = document.getElementById("site-menu");
function setMenu(open) {
  menuButton.setAttribute("aria-expanded", String(open));
  menu.classList.toggle("open", open);
  menuButton.querySelector(".menu-label").textContent = open ? "Close" : "Menu";
}
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  setMenu(open);
  if (open) menu.querySelector("a, input, button")?.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    menuButton.focus();
  }
});

// ---- Color theme: follows the device, or the choice made here ---------------------------
const themeButton = document.querySelector(".theme-button");
const dark = matchMedia("(prefers-color-scheme: dark)");
const saved = () => {
  try {
    return localStorage.getItem(THEME_KEY) || "auto";
  } catch {
    return "auto";
  }
};
const resolved = (t) => (t === "auto" ? (dark.matches ? "dark" : "light") : t);
function applyTheme(t) {
  if (t === "auto") delete root.dataset.theme;
  else root.dataset.theme = t;
  const label = { auto: "Auto", light: "Light", dark: "Dark" }[t];
  if (themeButton) {
    themeButton.querySelector(".theme-label").textContent = label;
    themeButton.setAttribute(
      "aria-label",
      t === "auto" ? "Color theme: follows your device" : `Color theme: ${label.toLowerCase()}`,
    );
  }
  for (const f of document.querySelectorAll("iframe")) tellFrame(f);
}
function tellFrame(frame) {
  try {
    frame.contentWindow?.postMessage(
      { type: "splashery:theme", theme: resolved(saved()) },
      location.origin,
    );
  } catch {
    // not ours
  }
}
themeButton?.addEventListener("click", () => {
  const next = { auto: "light", light: "dark", dark: "auto" }[saved()];
  try {
    if (next === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {
    // private window: the choice lasts for this page
  }
  applyTheme(next);
});
dark.addEventListener("change", () => applyTheme(saved()));
applyTheme(saved());
for (const f of document.querySelectorAll("iframe")) {
  f.addEventListener("load", () => setTimeout(() => tellFrame(f), 300));
}

// ---- Offline: the service worker, scoped to site/ -----------------------------------------
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const base = new URL(root.dataset.root || "./", document.baseURI);
  navigator.serviceWorker
    .register(new URL("sw.js", base), { scope: base.pathname })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => keepLoaded(reg.active))
    .catch((err) => console.info("Splashery: offline use is not available here.", err?.message));
}
