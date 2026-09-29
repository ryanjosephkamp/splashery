// Studio Models (lane Studio Models, "3D model files to splats"): the "Model to
// splats" toy. Open a 3D model (glTF/GLB, OBJ with MTL, STL) in the Toy tab and it
// is turned into splats on this device: flat discs lying on the surface, more of them
// where there is detail, sized to their neighbors so the surface closes, colored
// from the model's texture, vertex colors or material. The conversion itself is in
// studio-models-core.js (the Node tool tools/model-to-splats.mjs uses it too).
//
// What it reads and what it does not is listed at the top of the core file and in
// docs/PACKS.md ("3D models to splats").

import { smoothstep } from "../kit.js";
import {
  parseModel,
  prepareModel,
  sampleSurface,
  wireGeometry,
  wireSplats,
  upAxis,
  mulberry32,
  MODEL_DENSITY,
  MODEL_BUDGETS,
  SPLAT_OPACITY,
  SPLAT_FLAT,
} from "./studio-models-core.js";

export { MODEL_BUDGETS };

// The CC0 samples, each a single GLB in assets/toys/model-splats/ (tools/stm-samples.mjs made them).
export const SAMPLES = [
  {
    id: "burger",
    file: "burger.glb",
    label: "Burger",
    title: "Burger (Food Kit)",
    author: "Kenney",
    source: "https://kenney.nl/assets/food-kit",
  },
  {
    id: "vase",
    file: "vase.glb",
    label: "Blue-and-white vase",
    title: "Antique Ceramic Vase 01",
    author: "James Ray Cock",
    source: "https://polyhaven.com/a/antique_ceramic_vase_01",
  },
];

const MODEL = {
  samples: new Map(), // sample id -> its prepared model
  custom: null, // the model somebody opened
  want: null, // the model the next build uses
  current: null, // the one on show
  uid: 0,
  cache: new Map(),
  info: null, // what the last build made, for shown() and the tests
};

export const modelState = () => ({ ...MODEL.info });

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the sample model.");
  return new Uint8Array(await r.arrayBuffer());
}

// Textures are decoded by the browser (createImageBitmap and a canvas), or in Node
// by the build tools' decoders.
export async function decodeImage(bytes, mime) {
  if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime || "image/png" }), {
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
    const cap = 2048; // a bigger texture is halved on the way in (memory)
    const f = Math.min(1, cap / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * f));
    const h = Math.max(1, Math.round(bmp.height * f));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return { w, h, data: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer) };
  }
  if (mime === "image/png" || bytes[0] === 0x89) {
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

async function loadSample(id) {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
  if (!MODEL.samples.has(s.id)) {
    const bytes = await readBytes(`../../assets/toys/model-splats/${s.file}`);
    const prep = await prepareModel(parseModel(bytes, s.file), { decodeImage });
    prep.name = s.label;
    prep.uid = ++MODEL.uid;
    prep.sample = s;
    MODEL.samples.set(s.id, prep);
  }
  return MODEL.samples.get(s.id);
}

// Opens a model from its bytes (the Toy tab's file, or a test's): parses it, decodes its
// textures and keeps it as "your model". `files` are the other files that came with it
// (a .gltf's buffers and textures, an .obj's .mtl and pictures): a Map of name -> bytes.
export async function openModel(bytes, fileName, files) {
  const prep = await prepareModel(parseModel(bytes, fileName, { files }), { decodeImage });
  prep.uid = ++MODEL.uid;
  MODEL.custom = prep;
  return prep;
}

export function useModel(prep) {
  // For tests and tools: show a prepared model as "your model".
  if (!prep.uid) prep.uid = ++MODEL.uid;
  MODEL.custom = prep;
}

const fmt = (n) => Math.round(n).toLocaleString("en-US");

// The tap: lift off (each splat to its own place in a loose cloud), hold, settle back.
// `p` is the tap's progress (0 to 1); a splat's channel delays its start a little, so
// the lift rises through the model like a wave.
const STAGGER = 0.05;
export function liftShape(p, channel = 0) {
  const q = Math.min(1, Math.max(0, (p - STAGGER * channel) / (1 - 3 * STAGGER)));
  return smoothstep(0, 0.22, q) * (1 - smoothstep(0.52, 1, q));
}

const MODEL_SPLATS = {
  density: MODEL_DENSITY,
  options: [
    {
      key: "source",
      label: "Model",
      type: "select",
      default: "burger",
      choices: [
        ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your model (open one below)" },
      ],
    },
    {
      key: "show",
      label: "Show",
      type: "select",
      default: "splats",
      choices: [
        { id: "splats", label: "Splats" },
        { id: "wire", label: "Wireframe (the mesh's edges)" },
      ],
    },
    {
      key: "up",
      label: "Up is",
      type: "select",
      default: "auto",
      choices: [
        { id: "auto", label: "Automatic (Z for STL, Y for the rest)" },
        { id: "y", label: "Y (glTF, most OBJ)" },
        { id: "z", label: "Z (STL, CAD, some OBJ)" },
      ],
    },
    { key: "light", label: "Soft light baked in", type: "switch", default: true },
    { key: "modelName", label: "Model name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "lift", label: "Lift off", type: "pulse", ease: 3.2 }],
  action: { key: "lift", label: "Lift off and settle back" },
  input: {
    title: "Your own 3D model",
    accept: ".glb,.gltf,.obj,.stl,.mtl,model/gltf-binary,model/gltf+json",
    binary: true,
    fileButton: "Open a 3D model…",
    note: "Open a .glb, a .gltf with everything embedded, an .obj or an .stl (binary or text). It is converted on this device; nothing is uploaded. Not read: Draco- or meshopt-compressed glTF, animation (a skinned model shows in its bind pose) and lights. A .gltf or .obj that needs other files (a .bin, a .mtl, pictures) works when you save it as a .glb.",
    async read(_text, fileName, file, files) {
      if (!file) throw new Error("Open a 3D model file.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const prep = await openModel(bytes, fileName, files);
      return { source: "custom", modelName: prep.name };
    },
    shown: () => {
      const i = MODEL.info;
      if (!i) return "";
      const notes = i.notes?.length ? ` ${i.notes.join(" ")}` : "";
      return i.wire
        ? `${i.name}: ${fmt(i.triangles)} triangles, ${fmt(i.edges)} edges drawn as ${fmt(i.splats)} splats.${notes}`
        : `${i.name}: ${fmt(i.triangles)} triangles became ${fmt(i.splats)} splats.${notes}`;
    },
  },
  credits: SAMPLES.map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  })),
  async prepare(o) {
    if (o.source === "custom" && MODEL.custom) MODEL.want = MODEL.custom;
    else MODEL.want = await loadSample(o.source === "custom" ? SAMPLES[0].id : o.source);
  },
  drive(t, c, out, info) {
    const p = 1 - (c.lift ?? 0);
    out.morph = [0, 1, 2, 3].map((ch) => liftShape(p, ch));
    void info;
  },
  build(k, o) {
    const prep = MODEL.want;
    if (!prep) throw new Error("There is no model to show.");
    MODEL.current = prep;
    k.fitMorphs = false; // the cloud stays near the frame; the model itself fills it
    const seed = prep.uid * 977 + 5;
    const rand = mulberry32(seed);
    const wire = o.show === "wire";
    const up = o.up || "auto";
    const budget = Math.max(100, Math.floor(k.count * 0.98));
    let items;
    let info;
    if (!wire) {
      const key = `${prep.uid}/${budget}/${up}/${o.light !== false}`;
      let s = MODEL.cache.get(key);
      if (!s) {
        s = sampleSurface(prep, budget, { seed: 1, up, light: o.light !== false });
        MODEL.cache.clear();
        MODEL.cache.set(key, s);
      }
      const sz = 1 / 0.01; // a cloud-only recipe's base splat size is 0.01
      items = new Array(s.n);
      for (let i = 0; i < s.n; i++) {
        const nx = s.nrm[i * 3];
        const ny = s.nrm[i * 3 + 1];
        const nz = s.nrm[i * 3 + 2];
        items[i] = {
          p: [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]],
          n: [nx, ny, nz],
          size: s.sigma[i] * sz,
          flat: SPLAT_FLAT,
          color: [s.rgb[i * 3], s.rgb[i * 3 + 1], s.rgb[i * 3 + 2]],
          opacity: SPLAT_OPACITY,
        };
      }
      info = { splats: s.n };
    } else {
      const w = wireGeometry(prep, { up });
      const list = wireSplats(w, budget);
      const unit = 1 / 0.01;
      items = list.map((e) => {
        const across = e.across * unit;
        if (e.corner) return { p: e.p, size: across, color: "#e9f6ff", opacity: 1, dir: null, n: null }; // prettier-ignore
        const sz = across / 0.7;
        return {
          p: e.p,
          dir: e.dir,
          stretch: (e.along * unit) / sz,
          size: sz,
          color: e.hard ? "#f2b13d" : "#5cc8ff",
          opacity: 1,
        };
      });
      info = { splats: items.length, edges: w.edges };
    }
    // Each splat's own place in the loose cloud: out along its normal (or from the
    // middle), a little to the side, so it lifts off the surface and drifts.
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const it of items) {
      ymin = Math.min(ymin, it.p[1]);
      ymax = Math.max(ymax, it.p[1]);
    }
    const span = Math.max(1e-6, ymax - ymin);
    for (const it of items) {
      const [x, y, z] = it.p;
      let n = it.n || null;
      const l = Math.hypot(x, y, z) || 1;
      const out = [x / l, y / l, z / l];
      if (!n) n = out;
      // Outward: face the same way as the position from the middle.
      const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? -1 : 1;
      const up1 = 0.05 + 0.12 * rand();
      const a = rand() * Math.PI * 2;
      const b = 2 * rand() - 1;
      const r = 0.15 * rand();
      const s = Math.sqrt(1 - b * b);
      it.to = [
        x + n[0] * flip * up1 + out[0] * 0.06 + Math.cos(a) * s * r,
        y + n[1] * flip * up1 + out[1] * 0.06 + b * r + 0.04,
        z + n[2] * flip * up1 + out[2] * 0.06 + Math.sin(a) * s * r,
      ];
      it.channel = Math.min(3, Math.floor(((y - ymin) / span) * 4));
    }
    const share = Math.min(1, items.length / k.count);
    k.cloud({ share, pattern: false }, (_r, i) => {
      const it = items[i];
      if (!it) return null;
      return {
        p: it.p,
        n: it.n || undefined,
        dir: it.dir || undefined,
        stretch: it.stretch,
        size: it.size,
        flat: it.flat,
        color: it.color,
        opacity: it.opacity,
        to: it.to,
        channel: it.channel,
        pattern: false,
      };
    });
    MODEL.info = {
      name: prep.name,
      format: prep.format,
      triangles: prep.triangles,
      wire,
      notes: prep.notes,
      up: upAxis(prep, up),
      textured: prep.textured,
      ...info,
    };
    k.data = { model: MODEL.info };
  },
};

export const RECIPES = {
  "model-splats": MODEL_SPLATS,
};
