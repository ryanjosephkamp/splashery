// The toy shelf: built-in toys. Captured toys are SOG files under
// assets/toys/<id>/ (prepared with tools/prepare-assets.mjs, credits in
// CREDITS.md); procedural toys are generator presets built in the browser.
//
// This catalogue is metadata only (ids, labels, categories, search words) so
// it stays small as the shelf grows; toy code that needs more than a
// generator preset lives in per-pack modules that load when a toy is picked.

// Shelf categories, in shelf order. A category only shows once it has toys.
export const CATEGORIES = [
  { id: "scans", label: "Scans" },
  { id: "shapes", label: "Shapes" },
  { id: "balls", label: "Balls" },
  { id: "space", label: "Space" },
  { id: "tiny", label: "Tiny world" },
  { id: "atoms", label: "Atoms" },
  { id: "gems", label: "Gems" },
  { id: "anatomy", label: "Body" },
  { id: "nature", label: "Nature" },
  { id: "weather", label: "Weather & fire" },
  { id: "food", label: "Food" },
  { id: "toys", label: "Toys" },
  { id: "objects", label: "Open me" },
  { id: "medieval", label: "Medieval" },
  { id: "animals", label: "Animals" },
  { id: "maths", label: "Maths" },
  { id: "holidays", label: "Holidays" },
  { id: "music", label: "Music" },
  { id: "vehicles", label: "Vehicles" },
  { id: "landmarks", label: "Landmarks" },
];

export const TOYS = [
  {
    id: "cactus",
    label: "Cactus",
    category: "scans",
    tags: "plant succulent pot captured photo real",
    kind: "captured",
    url: "assets/toys/cactus/cactus.sog",
    urlWeak: "assets/toys/cactus/cactus-lite.sog",
    credit: {
      title: "Cactus (3DGS sample data)",
      author: "steam studio / 3D SCAN STUDIO iris",
      source: "https://note.com/steam_studio/n/ne9736d94f162",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      changes: "Converted to SOG, spherical harmonics removed, recentred, scaled and cropped.",
    },
  },
  {
    id: "strawberry",
    label: "Strawberry",
    category: "scans",
    tags: "fruit food berry captured photo real",
    kind: "captured",
    url: "assets/toys/strawberry/strawberry.sog",
    urlWeak: "assets/toys/strawberry/strawberry-lite.sog",
    camera: { yaw: 0.25, pitch: 0.3, roll: 0, distance: 5.6 },
    credit: {
      title: "Strawberry",
      author: "Dany Bittel",
      source: "https://superspl.at/scene/84df8849",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      changes: "Converted, decimated, spherical harmonics removed, recentred and scaled.",
    },
  },
  {
    id: "cookie",
    label: "Heart cookie",
    category: "scans",
    tags: "food biscuit heart sweet captured photo real",
    kind: "captured",
    url: "assets/toys/cookie/cookie.sog",
    urlWeak: "assets/toys/cookie/cookie-lite.sog",
    credit: {
      title: "Heart Cookie",
      author: "Dany Bittel",
      source: "https://superspl.at/scene/bd964899",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      changes: "Converted, spherical harmonics removed, recentred and scaled.",
    },
  },
  {
    id: "bee",
    label: "Honeybee",
    category: "scans",
    tags: "insect animal bug honeybee captured photo real",
    kind: "captured",
    url: "assets/toys/bee/bee.sog",
    urlWeak: "assets/toys/bee/bee-lite.sog",
    credit: {
      title: "Japanese Bee",
      author: "YUMA Co., Ltd.",
      source: "https://superspl.at/scene/ae58ed2c",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      changes: "Converted, decimated, spherical harmonics removed, recentred and scaled.",
    },
  },
  {
    id: "blob",
    label: "Jelly blob",
    category: "shapes",
    tags: "jelly noise candy generated",
    kind: "procedural",
    generator: {
      shape: "blob",
      palette: "candy",
      seed: 7,
      sizeJitter: 0.35,
      roughness: 0.25,
      colorNoise: 0.2,
    },
  },
  {
    id: "donut",
    label: "Donut",
    category: "shapes",
    tags: "doughnut torus food sprinkles frosting generated",
    kind: "procedural",
    generator: {
      shape: "torus",
      palette: "frosting",
      seed: 5,
      sizeJitter: 0.3,
      roughness: 0.2,
      colorNoise: 0.3,
    },
    camera: { yaw: 0.4, pitch: 0.62, roll: 0, distance: 5 },
  },
  {
    id: "knot",
    label: "Neon knot",
    category: "shapes",
    tags: "trefoil neon maths generated",
    kind: "procedural",
    generator: {
      shape: "knot",
      palette: "neon",
      seed: 11,
      sizeJitter: 0.3,
      roughness: 0.15,
      colorNoise: 0.15,
    },
  },
  {
    id: "planet",
    label: "Tiny planet",
    category: "shapes",
    tags: "earth world globe space generated v1",
    kind: "procedural",
    note: "A tribute to Splashery v1",
    generator: {
      shape: "sphere",
      palette: "planet",
      seed: 3,
      sizeJitter: 0.3,
      roughness: 0.2,
      colorNoise: 0.25,
    },
  },
  // Kit toys: recipes in src/packs/<pack>.js, built in the browser.
  {
    id: "heart",
    label: "Beating heart",
    category: "anatomy",
    kind: "kit",
    pack: "anatomy",
    tags: "organ body cardio pulse love valentine",
  },
  {
    id: "campfire",
    label: "Campfire",
    category: "weather",
    kind: "kit",
    pack: "elements",
    tags: "fire flame camping logs embers sparks",
    camera: { yaw: 0.5, pitch: 0.38, roll: 0, distance: 5 },
  },
  {
    id: "chest",
    label: "Treasure chest",
    category: "objects",
    kind: "kit",
    pack: "objects",
    tags: "pirate gold coins gems box lid open close",
    camera: { yaw: 0.45, pitch: 0.42, roll: 0, distance: 5.4 },
  },
];

export function findToy(id) {
  return TOYS.find((t) => t.id === id) || null;
}

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || "";
}

// Categories that have at least one toy, in shelf order.
export function shelfCategories() {
  return CATEGORIES.filter((c) => TOYS.some((t) => t.category === c.id));
}

// Lower-case, accent-free text for search matching.
export function foldText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Toys matching a search: every word must appear in the label, the
// category name or the toy's search words. Label matches come first.
export function searchToys(query, toys = TOYS) {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return toys.slice();
  const scored = [];
  for (const t of toys) {
    const label = foldText(t.label);
    const hay = `${label} ${foldText(categoryLabel(t.category))} ${foldText(t.tags)} ${t.id}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = words.reduce(
      (n, w) => n + (label.startsWith(w) ? 3 : label.includes(w) ? 2 : 0),
      0,
    );
    scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.t);
}

// Resolves an asset path against the Splashery root (works from the app,
// the embed page and the custom element on another site).
export const ROOT = new URL("../", import.meta.url);

export function assetURL(path) {
  return new URL(path, ROOT).href;
}

export function thumbURL(toy) {
  return assetURL(`assets/toys/${toy.id}/thumb.webp`);
}
