// The toy shelf: built-in toys. Captured toys are SOG files under
// assets/toys/<id>/ (prepared with tools/prepare-assets.mjs, credits in
// CREDITS.md); procedural toys are generator presets built in the browser.

export const TOYS = [
  {
    id: "cactus",
    label: "Cactus",
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
];

export function findToy(id) {
  return TOYS.find((t) => t.id === id) || null;
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
