// Pack: volume-viewer (lane Volume viewer, prefix vol, October 8, 2026; labs). A Studio tool that
// opens a person's own volume (a CT, MRI or microscope scan) and draws it as splats
// (docs/handoff/VolumeViewer.md).
//
// - Opens DICOM (a series of slices, a folder, a .zip or one multi-frame file), NIfTI (.nii,
//   .nii.gz), TIFF stacks and raw volumes (with a small form), on the device: nothing is uploaded
//   (src/volume/read.js; DICOM through dicom-parser in vendor/, loaded only for a DICOM file).
// - Draws it as volume splats spaced to the device's budget, honoring the voxel size, with window
//   and level (presets: bone, soft tissue, full range, or the sliders), a transfer function (colors
//   and opacity), a cut plane on each axis that a drag moves (the engine's volume kind and
//   out.volume, lane Imaging), a thin-slice view, and the maximum-intensity picture
//   (src/volume/view.js). A tap steps through the presets.
// - Samples: real scans of things that aren't people: the CWI walnut (CC BY 4.0, the Imaging
//   lane's file) and a young gar's head (Brian Metscher, CC BY 4.0; tools/vol-gar.mjs).

import { readVolume, parseRawForm, RAW_TYPES, VolumeError } from "../volume/read.js";
import { buildVolume, buildMIP, windowFor, wl, COLORMAPS, PRESETS } from "../volume/view.js";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const mb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`); // prettier-ignore
const app = () => globalThis.__splashery?.app;
const isPhoneish = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
// A length in millimeters, in the unit that reads best.
export function mm(v) {
  const a = Math.abs(v);
  if (a >= 10) return `${v.toFixed(a >= 100 ? 0 : 1)} mm`;
  if (a >= 1) return `${v.toFixed(2)} mm`;
  if (a >= 0.01) return `${(v * 1000).toFixed(a >= 0.1 ? 0 : 1)} µm`;
  return `${(v * 1000).toFixed(2)} µm`;
}
const num = (v) => {
  const a = Math.abs(v);
  return a >= 100 ? fmt(v) : a >= 1 ? v.toFixed(1) : v.toPrecision(2);
};

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok)
    throw new VolumeError("Could not load the sample. Check the connection and try again.");
  return new Uint8Array(await r.arrayBuffer());
}

// ---- Samples ----------------------------------------------------------------------------------------

export const SAMPLES = [
  {
    id: "walnut",
    label: "A walnut (X-ray CT)",
    file: "../../assets/toys/walnut-ct/walnut.vol.gz",
    preset: "full",
    colors: "bone",
    credit: {
      label: "Walnut",
      title: "Cone-Beam X-Ray CT Data Collection Designed for Machine Learning: Samples 1-8 (Walnut 1)", // prettier-ignore
      source: "https://doi.org/10.5281/zenodo.2686726",
      author: "Henri Der Sarkissian, Felix Lucka, Maureen van Eijnatten, Giulia Colacicco, Sophia Bethany Coban, K. Joost Batenburg (CWI)", // prettier-ignore
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  {
    id: "gar",
    label: "A young gar's head (micro-CT)",
    file: "../../assets/toys/volume-viewer/gar.nii.gz",
    preset: "full",
    colors: "bone",
    credit: {
      label: "Gar",
      title: "MicroCT images of 3 early gar (Lepisosteus osseus) stages between 12.7mm and 21.7mm (the 12.8 mm larva, averaged to 17.7 µm)", // prettier-ignore
      source: "https://doi.org/10.5281/zenodo.19021581",
      author: "Brian Metscher (University of Vienna)",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
];

// The walnut's file (the Imaging lane's own format, WCT1): its size, voxel size and 8-bit values.
// Its slices run down the walnut: voxel z is down, as lane Imaging draws it.
function walnutVolume(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== "WCT1")
    throw new VolumeError("The walnut's volume file is not readable.");
  const [nx, ny, nz] = [dv.getUint16(4, true), dv.getUint16(6, true), dv.getUint16(8, true)];
  const s = dv.getFloat32(10, true);
  const src = b.subarray(14, 14 + nx * ny * nz);
  const data = Float32Array.from(src);
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    nx,
    ny,
    nz,
    data,
    spacing: [s, s, s],
    view: [
      { axis: 0, sign: 1 },
      { axis: 2, sign: 1 },
      { axis: 1, sign: -1 },
    ],
    min,
    max,
    unit: "",
    modality: "CT",
    format: "X-ray CT",
    bits: "8-bit",
    name: "Walnut 1 (CWI)",
    source: { nx, ny, nz, spacing: [s, s, s] },
    notes: [],
  };
}

async function loadSample(s, progress) {
  progress?.(`Loading the ${s.credit.label.toLowerCase()}…`);
  const bytes = await readBytes(s.file);
  if (s.id === "walnut") {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return walnutVolume(new Uint8Array(await new Response(ds).arrayBuffer()));
  }
  const v = await readVolume([{ name: s.file.split("/").pop(), bytes }]);
  v.name = s.credit.label;
  return v;
}

// ---- State ------------------------------------------------------------------------------------------

const VV = {
  vols: new Map(), // sample id -> volume
  loading: new Map(),
  custom: null, // the person's volume
  uid: 0,
  files: null, // the last files opened (kept so the raw form can read them again)
  raw: { size: "", type: "uint16", little: true, spacing: "1 1 1", header: "auto" },
  note: "",
  last: null, // the last build's facts, for the panel
  cut: { at: 1, grab: null, key: "" },
  panel: null,
  ext: 1,
};

// The volume a source names, loading a sample the first time.
async function volumeFor(source, progress) {
  if (source === "custom") {
    if (VV.custom) return VV.custom;
    VV.note = "Your volume isn't open on this device, so this is the walnut. Open your file below.";
    source = "walnut";
  }
  const s = SAMPLES.find((x) => x.id === source) || SAMPLES[0];
  if (VV.vols.has(s.id)) return VV.vols.get(s.id);
  if (!VV.loading.has(s.id)) VV.loading.set(s.id, loadSample(s, progress));
  try {
    const v = await VV.loading.get(s.id);
    VV.vols.set(s.id, v);
    return v;
  } finally {
    VV.loading.delete(s.id);
  }
}

// The person's voxel size (mm), if they set one: "0.5 0.5 2".
function spacingOverride(V, text) {
  const v = String(text || "")
    .split(/[\s,x×]+/i)
    .filter(Boolean)
    .map(Number);
  if (v.length !== 3 || !v.every((x) => x > 0 && Number.isFinite(x))) return V;
  const f = V.shrink || [1, 1, 1];
  return { ...V, spacing: v.map((x, i) => x * f[i]), source: { ...V.source, spacing: v }, stats: V.stats }; // prettier-ignore
}

// Reads files the person opened (or the last ones again, with the raw form's answers).
async function openFiles(files, progress, { raw = null } = {}) {
  VV.files = files;
  const total = files.reduce((s, f) => s + (f.size ?? f.bytes?.length ?? 0), 0);
  progress?.(`Reading ${files.length > 1 ? `${files.length} files` : files[0].name} (${mb(total)})…`); // prettier-ignore
  const list = [];
  for (const f of files)
    list.push({ name: f.webkitRelativePath || f.name, bytes: f.bytes || new Uint8Array(await f.arrayBuffer()) }); // prettier-ignore
  const max = isPhoneish() ? 4e6 : 8e6;
  const V = await readVolume(list, { raw, max });
  VV.custom = V;
  VV.note = "";
  VV.uid++;
  return { source: "custom", fileName: V.name.slice(0, 120), uid: VV.uid };
}

// ---- The recipe -------------------------------------------------------------------------------------

const CUT_DIRS = {
  front: { normal: [0, 0, 1], axis: 2, label: "Front to back" },
  top: { normal: [0, 1, 0], axis: 1, label: "Top down" },
  side: { normal: [1, 0, 0], axis: 0, label: "Side to side" },
};
const PRESET_ORDER = PRESETS.map((p) => p.id);
// How much farther apart the sheets are than the splats within them (src/volume/view.js): the
// cut face and the slice get the budget (the owner's "Just sharper", October 8, 2026).
const SHEETS = { cut: 3, slice: 5 };

function cutDrag() {
  return {
    at: () => true,
    plane: "view",
    start(p) {
      VV.cut.grab = { y: p[1], at: VV.cut.at };
    },
    move(p) {
      if (!VV.cut.grab) return;
      VV.cut.at = clamp(VV.cut.grab.at + ((p[1] - VV.cut.grab.y) / (2 * VV.ext)) * 1.2, 0, 1);
    },
    end() {
      VV.cut.grab = null;
    },
  };
}

// Fix10: Play's two passes (the pulse eases over 5 s, each pass about 2.5 s).
const SWEEP_SOUND = {
  down: { voice: "whoom", f: 260, decay: 1.6, vol: 0.32 },
  up: { voice: "whoom", f: 220, decay: 1.5, vol: 0.26 },
};

function driveVolume(t, c, out, info) {
  const d = info.data;
  if (!d || d.mip) return;
  if (VV.cut.key !== d.key) {
    VV.cut.key = d.key;
    VV.cut.at = 1;
  }
  let at = VV.cut.at;
  // Fix10: Play's own sound, a dark, soft rush for each pass of the cut (down, then back up).
  const was = VV.sweepWas ?? 0;
  VV.sweepWas = c.sweep;
  if (c.sweep > was + 0.5) out.cues.push(SWEEP_SOUND.down);
  else if (was > 0.5 && c.sweep <= 0.5) out.cues.push(SWEEP_SOUND.up);
  // The sweep: the cut runs down through the volume and back.
  if (c.sweep > 0.001) at = Math.min(at, 1 - Math.sin(Math.PI * (1 - c.sweep)) * 0.85);
  const dir = CUT_DIRS[d.cut] || CUT_DIRS.front;
  const ext = Math.abs(d.half[dir.axis]) + d.pitch;
  const vol = { window: [0, 1] };
  if (d.slice) {
    vol.normal = dir.normal;
    vol.at = -ext + 2 * ext * (at > 0.999 ? 0.5 : at);
    vol.slab = d.sheet; // one sheet at a time
  } else if (at < 0.999) {
    vol.normal = dir.normal;
    vol.at = -ext + 2 * ext * at;
    vol.glow = [0.05, 0.035, 0.012];
    vol.glowWidth = 0.6 * d.sheet;
  }
  out.volume = vol;
}

function buildViewer(k, o) {
  const V0 = VV.current;
  if (!V0) throw new Error("The volume has not loaded.");
  const V = spacingOverride(V0, o.spacing);
  const [lo, hi] = windowFor(V, o);
  const budget = k.count;
  const cut = CUT_DIRS[o.cut] ? o.cut : "front";
  const mip = o.view === "mip";
  const r = mip
    ? buildMIP(k, V, { lo, hi, axis: CUT_DIRS[cut].axis, colors: o.colors, budget })
    : buildVolume(k, V, { lo, hi, colors: o.colors, opacity: o.opacity, budget, rand: k.rand, sheets: { axis: CUT_DIRS[cut].axis, k: o.slice ? SHEETS.slice : SHEETS.cut, flat: !!o.slice } }); // prettier-ignore
  VV.ext = Math.max(...r.half);
  k.data = {
    key: `${o.source}:${o.source === "custom" ? VV.uid : ""}`,
    cut,
    slice: !!o.slice && !mip,
    half: r.half,
    pitch: r.pitch,
    sheet: r.sheet ?? r.pitch,
    mip,
  };
  VV.last = { V, lo, hi, n: r.n, pitch: r.pitch, mip, empty: r.n === 0 };
  VV.panel?.refresh();
}

// The facts shown under the file button.
export function describe() {
  const L = VV.last;
  if (!L) return VV.note || "";
  const { V } = L;
  const s = V.source;
  const u = V.unit ? ` ${V.unit}` : "";
  const w = wl([L.lo, L.hi]);
  const lines = [
    `${V.name}: ${s.nx} × ${s.ny} × ${s.nz} voxels of ${s.spacing.map(mm).join(" × ")} (${V.format}${V.bits ? `, ${V.bits}` : ""}).`, // prettier-ignore
    `Values ${num(V.min)} to ${num(V.max)}${u}; window ${num(L.lo)} to ${num(L.hi)}${u} (W ${num(w.width)}, L ${num(w.level)}).`, // prettier-ignore
    L.empty
      ? "Nothing in this volume is inside the window: try another preset."
      : `${fmt(L.n)} splats, one every ${mm(L.pitch)}${L.mip ? " (the maximum-intensity picture)" : ""}.`, // prettier-ignore
    ...(V.notes || []),
  ];
  if (VV.note) lines.unshift(VV.note);
  return lines.join("\n");
}

// ---- The panel: the folder button and the raw form ---------------------------------------------------

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function renderPanel() {
  const box = el("div", "vol-panel");
  box.id = "vol-panel";
  const stats = el("p", "note");
  stats.id = "vol-stats";
  stats.style.whiteSpace = "pre-line";
  const status = el("p", "note");
  status.id = "vol-status";
  status.setAttribute("role", "status");
  const error = el("div", "warning");
  error.id = "vol-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const run = async (files, raw) => {
    error.hidden = true;
    try {
      const options = await openFiles(files, (t) => (status.textContent = t), { raw });
      status.textContent = "";
      await app()?.setToyOptions(options);
    } catch (e) {
      status.textContent = "";
      error.textContent = e?.message || String(e);
      error.hidden = false;
    }
  };
  // A folder of DICOM slices or TIFFs (the file button takes several files, or a zip).
  const row = el("div", "button-row");
  const folder = el("button", "", "Open a folder of slices…");
  folder.type = "button";
  folder.id = "vol-folder";
  const pick = document.createElement("input");
  pick.type = "file";
  pick.hidden = true;
  pick.multiple = true;
  pick.webkitdirectory = true;
  pick.id = "vol-folder-input";
  folder.addEventListener("click", () => pick.click());
  pick.addEventListener("change", () => {
    const files = [...(pick.files || [])];
    pick.value = "";
    if (files.length) run(files, null);
  });
  row.append(folder, pick);
  // The raw form.
  const raw = el("details", "vol-raw");
  raw.id = "vol-raw";
  raw.append(el("summary", "", "A raw volume (no header): its size and value type"));
  const field = (label, input) => {
    const r = el("label", "row");
    r.append(el("span", "", label), input);
    raw.append(r);
    return input;
  };
  const text = (id, value, placeholder) => {
    const t = document.createElement("input");
    t.type = "text";
    t.className = "option-text";
    t.id = id;
    t.value = value;
    t.placeholder = placeholder;
    t.spellcheck = false;
    t.autocomplete = "off";
    return t;
  };
  const size = field("Size (columns rows slices)", text("vol-raw-size", VV.raw.size, "256 256 128")); // prettier-ignore
  const type = field("Value type", document.createElement("select"));
  type.id = "vol-raw-type";
  const TYPE_LABELS = { uint8: "8-bit unsigned", int8: "8-bit signed", uint16: "16-bit unsigned", int16: "16-bit signed", uint32: "32-bit unsigned", int32: "32-bit signed", float32: "32-bit float", float64: "64-bit float" }; // prettier-ignore
  for (const t of RAW_TYPES) type.add(new Option(TYPE_LABELS[t], t));
  type.value = VV.raw.type;
  const order = field("Byte order", document.createElement("select"));
  order.id = "vol-raw-order";
  order.add(new Option("Little endian (most files)", "little"));
  order.add(new Option("Big endian", "big"));
  order.value = VV.raw.little ? "little" : "big";
  const spacing = field("Voxel size in mm (x y z)", text("vol-raw-spacing", VV.raw.spacing, "0.5 0.5 1.25")); // prettier-ignore
  const header = field("Header bytes to skip", text("vol-raw-header", VV.raw.header, "auto"));
  const go = el("button", "primary", "Read it as a raw volume");
  go.type = "button";
  go.id = "vol-raw-go";
  const rawRow = el("div", "button-row");
  rawRow.append(go);
  raw.append(rawRow);
  go.addEventListener("click", () => {
    VV.raw = { size: size.value, type: type.value, little: order.value === "little", spacing: spacing.value, header: header.value.trim() || "auto" }; // prettier-ignore
    error.hidden = true;
    try {
      parseRawForm(VV.raw);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
      return;
    }
    if (!VV.files?.length) {
      error.textContent = "Open the raw file first (Open a volume…), then read it with this form.";
      error.hidden = false;
      return;
    }
    run(VV.files, VV.raw);
  });
  box.append(row, stats, status, error, raw);
  const refresh = () => {
    stats.textContent = describe();
  };
  refresh();
  VV.panel = { refresh };
  return box;
}

const VIEWER = {
  kernel: "sharp", // labs: a sharper splat edge (src/kernels.js)
  density: 2,
  turntable: false,
  options: [
    {
      key: "source",
      label: "Volume",
      type: "select",
      default: "walnut",
      choices: [
        ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your volume (open one below)" },
      ],
    },
    {
      key: "view",
      label: "View",
      type: "select",
      default: "volume",
      choices: [
        { id: "volume", label: "3D volume" },
        { id: "mip", label: "Maximum intensity (the brightest along each line)" },
      ],
    },
    {
      key: "preset",
      label: "Window",
      type: "select",
      default: "full",
      choices: [
        ...PRESETS.map((p) => ({ id: p.id, label: p.label })),
        { id: "custom", label: "Your own (the sliders below)" },
      ],
    },
    { key: "level", label: "Level (your own window)", type: "slider", min: 0, max: 1, step: 0.01, default: 0.5 }, // prettier-ignore
    { key: "width", label: "Width (your own window)", type: "slider", min: 0.01, max: 1, step: 0.01, default: 0.5 }, // prettier-ignore
    {
      key: "colors",
      label: "Colors",
      type: "select",
      default: "bone",
      choices: Object.entries(COLORMAPS).map(([id, c]) => ({ id, label: c.label })),
    },
    {
      key: "opacity",
      label: "Opacity",
      type: "select",
      default: "solid",
      choices: [
        { id: "solid", label: "Solid (everything in the window opaque)" },
        { id: "layers", label: "Layers (the low end of the window faint)" },
      ],
    },
    {
      key: "cut",
      label: "Cut",
      type: "select",
      default: "front",
      choices: Object.entries(CUT_DIRS).map(([id, d]) => ({ id, label: d.label })),
    },
    { key: "slice", label: "Only a thin slice at the cut", type: "switch", default: false },
    {
      key: "spacing",
      label: "Voxel size in mm (blank: the file's)",
      type: "text",
      default: "",
      placeholder: "0.5 0.5 2",
      maxLength: 60,
    },
    { key: "fileName", label: "File", type: "text", default: "", hidden: true },
    { key: "uid", label: "Opened", type: "slider", min: 0, max: 1e9, default: 0, hidden: true },
  ],
  controls: [
    { key: "sweep", label: "Sweep the cut through", type: "pulse", ease: 5 },
    { key: "step", label: "Next preset", type: "pulse", ease: 0.4 },
  ],
  // The Play button sweeps the cut through; a tap on the volume steps to the next preset.
  action: {
    key: "sweep",
    quiet: ["sweep"], // Fix10: Play's rushes are the drive's cues
    label: "Sweep the cut through (tap the volume for the next preset: bone, soft tissue, full range)", // prettier-ignore
    at(point, c) {
      void point;
      void c;
      const o = VV.options;
      if (!o) return null;
      const i = PRESET_ORDER.indexOf(o.preset);
      return { options: { preset: PRESET_ORDER[(i + 1) % PRESET_ORDER.length] }, key: "step" };
    },
  },
  note: "Drag up or down on the volume to move the cut; tap it for the next preset. Play sweeps the cut through.",
  drag: cutDrag(),
  input: {
    title: "Your own volume",
    accept: ".dcm,.dicom,.ima,.nii,.gz,.zip,.tif,.tiff,.raw,.bin,.img,.vol,.dat",
    binary: true,
    multiple: true,
    drop: true,
    fileButton: "Open a volume…",
    maxBytes: () => (isPhoneish() ? 600e6 : 2e9),
    tooBig: (cap) => `That is over ${mb(cap)}, more than this device can read at once. Try it on a computer, or open a part of the series.`, // prettier-ignore
    note: "Opens DICOM (pick all the slices, a folder or a .zip, or one multi-frame file), NIfTI (.nii, .nii.gz), TIFF stacks and raw volumes. It all stays on this device; nothing is uploaded. DICOM is read with dicom-parser, loaded only when a DICOM file is opened.", // prettier-ignore
    async read(_text, _name, file, files, progress = () => {}) {
      if (!files?.length) throw new Error("Open a volume file.");
      return openFiles(files, progress, { raw: null });
    },
    live: [{ render: () => renderPanel() }],
    shown() {
      return VV.last ? `Showing ${VV.last.V.name}.` : "";
    },
  },
  credits: SAMPLES.map((s) => ({ ...s.credit })),
  async prepare(o) {
    VV.options = o;
    VV.note = "";
    VV.current = await volumeFor(o.source, (t) => app()?.ui?.progress?.update?.(0.1, t));
  },
  drive: driveVolume,
  build: buildViewer,
};

export const RECIPES = { "volume-viewer": VIEWER };
// For the tests and the clip tools.
export const VOLUME_STATE = VV;
