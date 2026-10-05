// The site's toy player (site/play/, lane Site): the embed player, one folder
// deeper so the service worker sees what it loads. This points its "Open in
// Splashery" link at the toy itself, and hands the worker the toy's files when
// the player is opened on its own.

import { findToy, holdsStill } from "../../src/toys.js";
import { keepLoaded } from "./offline.js";

const id = new URLSearchParams(location.search).get("toy");
const toy = findToy(id);
const link = document.getElementById("open-link");

function galleryLink() {
  const scene = { app: "splashery", version: 3, toy: { kind: "builtin", id: toy.id } };
  if (toy.camera) scene.camera = { ...toy.camera };
  if (holdsStill(toy)) scene.autoplay = { turntable: false, effect: "none" };
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(scene))));
  return `../../#s=j.${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

if (toy && !location.hash) {
  // embed.js sets the link once the toy starts; set ours after it.
  const fix = () => (link.href = galleryLink());
  fix();
  new MutationObserver(() => {
    if (!link.getAttribute("href").includes("#s=j.")) fix();
  }).observe(link, { attributes: true, attributeFilter: ["href"] });
}

if (window.top === window && "serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((reg) => keepLoaded(reg.active)).catch(() => {});
}
