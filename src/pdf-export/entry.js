// Lane PDF lab: what a toy's PDF page says, gathered without the app open.
// toyEntry(id, { still }) is all a catalog needs (the Toy pages lane): the
// name, shelf, how-to line, About text, credits and a link that opens the toy
// on the live site. The app adds what only it knows (the scene as it is now,
// sound and flag credits) in index.js.

import { findToy, categoryLabel } from "../toys.js";
import { toyHelp } from "../toy-help.js";
import { encodeSceneHash } from "../codec.js";
import { createScene } from "../state.js";

// The live site: the link and QR on a page made outside the app point here.
export const SITE = "https://ryanjosephkamp.github.io/splashery/";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; // prettier-ignore

// "October 5, 2026".
export function longDate(d = new Date()) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// The credit lines a toy carries in src/toys.js (a scan's source and
// license), as PDF credits.
export function defCredits(def, info = null) {
  const out = [];
  const c = info?.credit || def?.credit;
  if (c) out.push({ label: info?.label || def?.label, ...c });
  for (const r of info?.recipe?.credits || []) out.push({ ...r });
  return out;
}

// A plain line about what a toy is made of.
export function madeOfNote(kind) {
  if (kind === "captured") return "";
  if (kind === "file")
    return "Your own splat file, drawn in your browser. It stays on your device.";
  return "Made in your browser from a recipe and a seed: no photographs or downloaded models, unless they are credited here.";
}

export const SITE_NOTE =
  "Splashery is free and open source (MIT License): ryanjosephkamp.github.io/splashery";

// A link that opens the shelf toy `id` on the site at `base`, with the toy's
// own starting camera.
export async function toyLink(id, base = SITE) {
  const def = findToy(id);
  const scene = createScene({ toy: { kind: "builtin", id }, seed: 1 });
  if (def?.camera) scene.camera = { ...scene.camera, ...def.camera };
  delete scene.createdAt;
  return `${base}#s=${await encodeSceneHash(scene)}`;
}

// Everything a page shows for the shelf toy `id`, without the app.
// `still`: { bytes, type: "jpeg" | "png" }. `url` replaces the default link.
export async function toyEntry(id, { still = null, url = null, base = SITE, date = null } = {}) {
  const def = findToy(id);
  if (!def) throw new Error(`No toy "${id}" on the shelf.`);
  // Without the app there is no built recipe: the help entry's own lines, or
  // the plain fallback.
  const help = toyHelp({ id, kind: def.kind === "kit" ? "kit" : def.kind, label: def.label, rig: true }); // prettier-ignore
  const credits = defCredits(def);
  const made = madeOfNote(def.kind);
  return {
    id,
    label: def.label,
    shelf: categoryLabel(def.category),
    howTo: help.howTo,
    about: help.about,
    credits,
    notes: [made, SITE_NOTE].filter(Boolean),
    url: url || (await toyLink(id, base)),
    still,
    date: date || longDate(),
  };
}
