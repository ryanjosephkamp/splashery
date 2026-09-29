// Photo to 3D (lane Photo to 3D, prefix p3d): the "Photo to 3D" toy, on the Studio shelf (labs).
// Open a photo in the Toy tab and a depth model, running on this device, works out how far away
// each part of the picture is; the photo is then rebuilt as splats, each one at its place in the
// picture and at its depth, colored from the photo. Turn it and near things move across far ones.
// Where the depth jumps the surface is cut, so a near object stands as its own layer.
//
// The pure conversion is photo-3d-core.js; the depth model is photo-3d-depth.js, which is loaded
// (with ONNX Runtime Web and the 27 MB model) only when someone opens a photo of their own: the
// three samples come with their depth maps, made by tools/p3d-depth.mjs.

import { smoothstep, quatAxisAngle } from "../kit.js";
import {
  buildPhotoSplats,
  PHOTO_DENSITY,
  PHOTO_BUDGETS,
  LAYERS,
  SPLAT_OPACITY,
  SPLAT_FLAT,
} from "./photo-3d-core.js";

export { PHOTO_BUDGETS };

// The CC0 samples in assets/toys/photo-3d/: a photo (<id>.jpg) and its depth map (<id>.depth).
export const SAMPLES = [
  {
    id: "forest",
    label: "Forest path",
    title: "Forest Away Path",
    author: "Seaq68 (from Pixabay, marked CC0 on Wikimedia Commons)",
    source: "https://commons.wikimedia.org/wiki/File:Forest_Away_Path.jpg",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "street",
    label: "Cobbled street",
    title: "Carleton Street off Leeman Road, York",
    author: "Malcolmxl5",
    source:
      "https://commons.wikimedia.org/wiki/File:Carleton_Street_off_Leeman_Road_York_Jul25.jpg",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "still-life",
    label: "Still life",
    title: "Still Life with Cheese",
    author: "Antoine Vollon (Metropolitan Museum of Art Open Access)",
    source: "https://commons.wikimedia.org/wiki/File:Still_Life_with_Cheese_MET_DT1989.jpg",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
];

const P3D = {
  samples: new Map(), // sample id -> { photo, depth, uid, name }
  custom: null, // the photo somebody opened: { photo, depth, uid, name, ms }
  want: null,
  uid: 0,
  cache: new Map(),
  info: null, // what the last build made, for shown() and the tests
};

export const photoState = () => ({ ...P3D.info });

const MAX_SIDE = 2048; // a bigger photo is reduced on the way in (memory)

// A photo (a Blob or File, or its bytes) as { w, h, data: RGBA }. The browser decodes it (and turns
// it upright by its EXIF tag); in Node the build tools' decoders do.
export async function decodePhoto(source) {
  if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
    const blob = source instanceof Blob ? source : new Blob([source]);
    let bmp;
    try {
      bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      throw new Error("That file is not a photo this toy can read. Open a JPEG, PNG or WebP.");
    }
    const f = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(2, Math.round(bmp.width * f));
    const h = Math.max(2, Math.round(bmp.height * f));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#fff"; // a transparent PNG shows on white
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return { w, h, data: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer) };
  }
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(await source.arrayBuffer());
  if (bytes[0] === 0x89) {
    const { PNG } = await import("pngjs");
    const p = PNG.sync.read(globalThis.Buffer.from(bytes));
    return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
  }
  const jpeg = (await import("jpeg-js")).default;
  const j = jpeg.decode(globalThis.Buffer.from(bytes), {
    useTArray: true,
    maxMemoryUsageInMB: 1024,
  });
  return { w: j.width, h: j.height, data: j.data };
}

// A depth map is stored as: width (u16), height (u16), min and max (f32), then u16 samples.
export function packDepth({ w, h, d }) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < d.length; i++) {
    if (d[i] < lo) lo = d[i];
    if (d[i] > hi) hi = d[i];
  }
  const out = new Uint8Array(12 + d.length * 2);
  const v = new DataView(out.buffer);
  v.setUint16(0, w, true);
  v.setUint16(2, h, true);
  v.setFloat32(4, lo, true);
  v.setFloat32(8, hi, true);
  const span = hi > lo ? hi - lo : 1;
  for (let i = 0; i < d.length; i++)
    v.setUint16(12 + i * 2, Math.round(((d[i] - lo) / span) * 65535), true);
  return out;
}

export function unpackDepth(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const w = v.getUint16(0, true);
  const h = v.getUint16(2, true);
  const lo = v.getFloat32(4, true);
  const hi = v.getFloat32(8, true);
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++)
    d[i] = lo + (v.getUint16(12 + i * 2, true) / 65535) * (hi - lo);
  return { w, h, d };
}

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the sample photo.");
  return new Uint8Array(await r.arrayBuffer());
}

async function loadSample(id) {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
  if (!P3D.samples.has(s.id)) {
    const [jpg, dep] = await Promise.all([
      readBytes(`../../assets/toys/photo-3d/${s.id}.jpg`),
      readBytes(`../../assets/toys/photo-3d/${s.id}.depth`),
    ]);
    P3D.samples.set(s.id, {
      photo: await decodePhoto(jpg),
      depth: unpackDepth(dep),
      uid: ++P3D.uid,
      name: s.label,
      sample: s,
    });
  }
  return P3D.samples.get(s.id);
}

// Shows a photo and its depth as "your photo" (for tests and tools).
export function usePhoto(photo, depth, name = "Your photo") {
  P3D.custom = { photo, depth, uid: ++P3D.uid, name, ms: 0 };
  return P3D.custom;
}

// Opens a photo somebody picked: decodes it, then the depth model (loaded now, for the first time)
// works out the depth. Returns what the toy shows.
export async function openPhoto(file, name) {
  const photo = await decodePhoto(file);
  const { estimateDepth } = await import("./photo-3d-depth.js");
  const depth = await estimateDepth(photo);
  const p = usePhoto(photo, { w: depth.w, h: depth.h, d: depth.d }, name || "Your photo");
  p.ms = depth.ms;
  return p;
}

const fmt = (n) => Math.round(n).toLocaleString("en-US");

// The tap: the layers rise out of the flat picture one after another, the far one first.
// `r` is how far it has risen (0 flat, 1 with its depth); returns each layer's morph (1 flat, 0 risen).
export function layerMorph(r, layer) {
  const start = 0.12 * layer;
  return 1 - smoothstep(0, 1, (r - start) / 0.64);
}

const PHOTO_3D = {
  density: PHOTO_DENSITY,
  turntable: false,
  options: [
    {
      key: "source",
      label: "Photo",
      type: "select",
      default: "forest",
      choices: [
        ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your photo (open one below)" },
      ],
    },
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: "photoName", label: "Photo name", type: "text", default: "", hidden: true },
  ],
  controls: [
    { key: "rise", label: "Depth", type: "toggle", default: 0, ease: 3.2 },
    { key: "layers", label: "Layers", type: "toggle", default: 0, ease: 1 },
  ],
  action: { key: "rise", label: "Raise or flatten the depth" },
  input: {
    title: "Your own photo",
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    binary: true,
    fileButton: "Open a photo…",
    note: "Open a JPEG, PNG or WebP photo. A depth model that runs on this device (about 27 MB, loaded the first time) works out how far away each part of the picture is, and the photo is rebuilt as splats in 3D. Nothing is uploaded. It takes a few seconds, longer on a phone.",
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a photo.");
      const p = await openPhoto(
        file,
        (file.name || fileName || "Your photo").replace(/\.[^.]+$/, ""),
      );
      return { source: "custom", photoName: p.name };
    },
    shown() {
      const i = P3D.info;
      if (!i) return "";
      const took = i.ms ? ` The depth model took ${(i.ms / 1000).toFixed(1)} s.` : "";
      return `${i.name}: ${fmt(i.splats)} splats in ${i.pieces} pieces of surface.${took}`;
    },
  },
  credits: SAMPLES.map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
  async prepare(o) {
    if (o.source === "custom" && P3D.custom) P3D.want = P3D.custom;
    else P3D.want = await loadSample(o.source === "custom" ? SAMPLES[0].id : o.source);
  },
  drive(t, c, out) {
    const r = c.rise ?? 0;
    out.morph = [0, 1, 2, 3].map((b) => layerMorph(r, b));
    // The toy sways as the depth rises (and falls), so the parallax shows: one slow swing each way.
    const yaw = 0.3 * Math.sin(2 * Math.PI * r) * Math.sin(Math.PI * r) ** 0.5;
    out.body = { quat: quatAxisAngle([0, 1, 0], yaw) };
    // "Layers" pulls the depth bands apart along the view direction.
    const L = c.layers ?? 0;
    for (let b = 0; b < LAYERS; b++) out.parts[`layer${b}`] = { offset: [0, 0, (b - (LAYERS - 1) / 2) * 0.22 * L] }; // prettier-ignore
  },
  build(k, o) {
    const src = P3D.want;
    if (!src) throw new Error("There is no photo to show.");
    const budget = Math.max(100, Math.floor(k.count * 0.98));
    const key = `${src.uid}/${budget}/${o.depth}`;
    let s = P3D.cache.get(key);
    if (!s) {
      s = buildPhotoSplats(src.photo, src.depth, { count: budget, depth: o.depth ?? 0.5 });
      P3D.cache.clear();
      P3D.cache.set(key, s);
    }
    k.fitMorphs = false; // the flat picture lies inside the relief
    const parts = [];
    for (let b = 0; b < LAYERS; b++) parts.push(k.part(`layer${b}`, { pivot: [0, 0, 0], axis: [0, 0, 1] })); // prettier-ignore
    const unit = 1 / 0.01; // a cloud-only recipe's base splat size is 0.01
    const share = Math.min(1, s.n / k.count);
    k.cloud({ share, pattern: false }, (_r, i) => {
      if (i >= s.n) return null;
      const b = s.band[i];
      return {
        p: [s.relief[i * 3], s.relief[i * 3 + 1], s.relief[i * 3 + 2]],
        to: [s.flat[i * 3], s.flat[i * 3 + 1], s.flat[i * 3 + 2]],
        channel: b,
        part: parts[b],
        n: [0, 0, 1],
        size: s.sigma[i] * unit,
        flat: SPLAT_FLAT,
        color: [s.rgb[i * 3], s.rgb[i * 3 + 1], s.rgb[i * 3 + 2]],
        opacity: SPLAT_OPACITY,
        pattern: false,
      };
    });
    P3D.info = {
      name: src.name,
      uid: src.uid,
      splats: s.n,
      grid: [s.gx, s.gy],
      pieces: s.stats.bigPieces,
      cutEdges: s.stats.cutEdges,
      relief: s.stats.relief,
      ms: src.ms || 0,
      custom: src === P3D.custom,
    };
    k.data = { photo: P3D.info };
  },
};

export const RECIPES = {
  "photo-3d": PHOTO_3D,
};
